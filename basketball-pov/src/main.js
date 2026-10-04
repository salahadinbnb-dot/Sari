import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildArena, arenaEnvironment } from './arena.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { World } from './world.js';
import { TL, buildTimeMap } from './timeline.js';
import { makeBall } from './ball.js';
import { CamRig, freezeCam } from './camera.js';
import { Hud } from './hud.js';
import { Overlays, makeIndicator } from './overlays.js';
import { buildTelestration } from './tele.js';

const W = 1920, H = 1080, FPS = 30;
const q = new URLSearchParams(location.search);

export const SPECS = {
  you: { model: '04', tex: 'you', height: 1.96 },
  screener: { model: '04', tex: 'screener', height: 2.07 },
  wing: { model: '04', tex: 'wing', height: 1.99 },
  d1: { model: '03', tex: 'd1', height: 1.97 },
  d2: { model: '02', tex: 'd2', height: 2.06 },
  d3: { model: '02', tex: 'd3', height: 1.98 },
};

async function init() {
  const canvas = document.getElementById('gl');
  const scaleRes = q.has('half') ? 0.5 : 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.has('noaa'), preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(scaleRes);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !q.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;

  await document.fonts.load('800 40px BC');
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(arenaEnvironment(), 0.02).texture;
  scene.environmentIntensity = 1.0;

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a4a3a, 0.75));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.6);
  key.position.set(3.5, 16, 12); key.target.position.set(0, 0, 4);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 12; sc.bottom = -10; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9); rim.position.set(-6, 10, -8); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(0, 6, 20); scene.add(fill);

  const arena = buildArena(renderer, scene);
  const T = await loadTemplates(['04', '03', '02']);
  const players = {};
  for (const [name, s] of Object.entries(SPECS)) {
    const { root, k } = makePlayerMesh(T, s);
    scene.add(root);
    players[name] = { root, rig: new Rig(root, k), spec: s, scale: s.height / 1.81 };
  }
  const specs = Object.fromEntries(Object.entries(players).map(([n, p]) => [n, { scale: p.scale }]));
  const world = new World(specs);
  const ball = makeBall(scene);
  const camRig = new CamRig(world);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 140);
  const frames = buildTimeMap(FPS);
  const hud = new Hud(document.getElementById('hud'));
  const overlays = new Overlays(scene);
  const indicator = makeIndicator(scene);
  window.__frames = frames.length;
  await new Promise(r => setTimeout(r, 2500));
  return { renderer, scene, camera, arena, players, world, ball, camRig, frames, hud, overlays, indicator };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, arena, players, world, ball, camRig, frames, hud, overlays, indicator } = ctx;

function renderScene() {
  scene.updateMatrixWorld(true);
  const { floor, reflector } = arena;
  floor.visible = false; overlays.group.visible = false; indicator.visible = false;
  reflector.onBeforeRender(renderer, scene, camera);
  floor.visible = true; overlays.group.visible = true; indicator.visible = true;
  renderer.render(scene, camera);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

function poseAll(st) {
  for (const [n, P] of Object.entries(players)) P.rig.apply(world.pose(n, st));
  const b = world.ball(st);
  ball.position.copy(b.pos);
  ball.quaternion.copy(b.q);
  arena.net.update(b.state === 'net' ? b.netU : (b.state === 'drop' ? 1.2 : 0), b.state === 'net' ? 1 : 0);
}

window.renderSim = (st, camOverride) => {
  const t0 = performance.now();
  poseAll(st);
  const c = camRig.at(st);
  camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix();
  if (camOverride) { camera.position.set(...camOverride.pos); camera.lookAt(...camOverride.look); }
  renderScene();
  return performance.now() - t0;
};
window.closeCam = (name, st, angDeg = 0, dist = 3.2, h = 1.3) => {
  const F = world.frame(name, st);
  const a = F.yaw + angDeg * Math.PI / 180;
  const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  const c = F.p.clone().addScaledVector(d, dist).add(new THREE.Vector3(0, h, 0));
  return { pos: c.toArray(), look: F.p.clone().add(new THREE.Vector3(0, 0.95, 0)).toArray() };
};
const proj = (v) => {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1 };
};
window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)];
  const st = fr.st;
  poseAll(st);
  const c = freezeCam(fr.freeze, fr.fu, camRig.at(st), world, st);
  camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const F = world.frame('you', st);
  indicator.position.set(F.p.x, 0, F.p.z); indicator.rotation.y = F.yaw + Math.PI;
  overlays.clear();
  buildTelestration(overlays, hud, fr, st, world, proj);
  hud.update(fr, st, world, camera, proj, (n) => players[n].rig.P.Head);
  renderScene();
  return performance.now() - t0;
};
window.diagnose = () => {
  const out = [];
  const names = Object.keys(players);
  const prev = {}, prev2 = {};
  const bonesToCheck = ['L_Foot', 'R_Foot', 'L_Hand', 'R_Hand', 'Head', 'Pelvis', 'L_Calf', 'R_Calf', 'L_Forearm', 'R_Forearm'];
  const v = new THREE.Vector3();
  const dt = 1 / 30;
  const reachErr = {};
  for (let st = 0; st <= TL.simEnd; st += dt) {
    for (const n of names) {
      const pose = world.pose(n, st);
      const P = players[n];
      P.rig.apply(pose);
      P.root.updateMatrixWorld(true);
      const cur = {};
      for (const b of bonesToCheck) { P.rig.b[b].getWorldPosition(v); cur[b] = v.clone(); }
      // IK reach error for ankles
      for (const side of ['L', 'R']) {
        const e = cur[side + '_Foot'].distanceTo(pose.feet[side].pos);
        if (e > 0.03) { reachErr[n] = reachErr[n] || []; reachErr[n].push([+st.toFixed(2), side, +e.toFixed(3)]); }
      }
      if (prev[n] && prev2[n]) {
        for (const b of bonesToCheck) {
          const acc = cur[b].clone().sub(prev[n][b]).sub(prev[n][b].clone().sub(prev2[n][b])).length() / (dt * dt);
          if (acc > 260) out.push([+st.toFixed(2), n, b, Math.round(acc)]);
        }
      }
      prev2[n] = prev[n]; prev[n] = cur;
    }
  }
  const reach = Object.fromEntries(Object.entries(reachErr).map(([n, a]) => [n, a.length + ' frames, e.g. ' + JSON.stringify(a.slice(0, 6))]));
  return { pops: out.slice(0, 80), popCount: out.length, reach };
};
window.stepsOf = (n, a, b) => {
  const ev = world.plans[n].events; const out = [];
  for (const side of ['L', 'R']) for (const e of ev[side]) if (e.tLift >= a && e.tLift <= b) out.push([side, +e.tLift.toFixed(3), +e.tLand.toFixed(3), e.from.toArray().map(v => +v.toFixed(2)), e.to.toArray().map(v => +v.toFixed(2)), +e.speed.toFixed(2)]);
  out.sort((x, y) => x[1] - y[1]);
  return out;
};
window.__ready = true;
