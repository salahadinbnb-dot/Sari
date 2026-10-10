// v2: 1v1 vs the square defender, driven by retargeted CMU mocap (see play1v1.js, game2.js).
import * as THREE from 'three';
import { buildArena, arenaEnvironment } from './arena.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS, buildTracks } from './play1v1.js';
import { Game, PLAN } from './game2.js';
import { buildTimeMap, FPS, SIM_END } from './timeline2.js';
import { makeBall } from './ball.js';
import { CamRig2, freezeCam2 } from './camera2.js';
import { Hud } from './hud.js';
import * as S2 from './script2.js';
import { Overlays, makeIndicator } from './overlays.js';
import { buildTele2 } from './tele2.js';

const W = 1920, H = 1080;
const q = new URLSearchParams(location.search);

export const SPECS = {
  you: { model: '04', tex: 'you', height: 1.96 },
  d1: { model: '03', tex: 'd1', height: 1.97 },
};

async function init() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.has('noaa'), preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(q.has('half') ? 0.5 : 1);
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

  const arena = buildArena(renderer, scene, { ledWords: ['READ HIM FIRST', 'TEST THE DRIVE', 'CHECKPOINT', 'ATTACK THE CLOSEOUT', 'HOOPS IQ'] });
  const T = await loadTemplates(['04', '03']);
  const players = {};
  for (const [name, s] of Object.entries(SPECS)) {
    const { root, k } = makePlayerMesh(T, s);
    scene.add(root);
    players[name] = { root, rig: new Rig(root, k), spec: s };
  }
  const clips = {};
  for (const c of CLIPS) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const tracks = buildTracks(clips, { you: legOf(players.you.rig), d1: legOf(players.d1.rig) });
  const game = new Game(tracks, { you: players.you.rig, d1: players.d1.rig });
  const ball = makeBall(scene);
  const camRig = new CamRig2(game);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 140);
  const frames = buildTimeMap(FPS);
  const hud = new Hud(document.getElementById('hud'), S2);
  const overlays = new Overlays(scene);
  const indicator = makeIndicator(scene);
  window.__frames = frames.length; window.__fps = FPS;
  await new Promise(r => setTimeout(r, 2500));
  return { renderer, scene, camera, arena, players, game, ball, camRig, frames, hud, overlays, indicator };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, arena, players, game, ball, camRig, frames, hud, overlays, indicator } = ctx;

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
  const Y = game.youPose(st); players.you.rig.applyMocap(Y.T, Y.T.src, Y.opt);
  const D = game.d1Pose(st); players.d1.rig.applyMocap(D.T, D.T.src, D.opt);
  const b = game.ball(st);
  ball.position.copy(b.pos); ball.quaternion.copy(b.q);
  arena.net.update(b.state === 'net' ? b.netU : (b.state === 'drop' ? 1.2 : 0), b.state === 'net' ? 1 : 0);
  return b;
}
const proj = (v) => {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1 };
};
function place(c) { camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }

window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)];
  const st = fr.st;
  poseAll(st);
  place(freezeCam2(fr.freeze, fr.fu, camRig.at(st), game, st));
  const F = game.frame('you', st);
  indicator.position.set(F.p.x, 0, F.p.z); indicator.rotation.y = F.yaw + Math.PI;
  overlays.clear();
  buildTele2(overlays, hud, fr, st, game, proj);
  hud.update(fr, st, game, camera, proj, (n) => players[n].rig.P.Head);
  renderScene();
  return performance.now() - t0;
};
// debug: render sim time st with the gameplay cam (or an explicit {pos, look})
window.renderSim = (st, cam) => {
  poseAll(st);
  if (cam) { camera.position.set(...cam.pos); camera.lookAt(...cam.look); camera.fov = cam.fov || 45; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
  else place(camRig.at(st));
  overlays.clear(); hud.root.style.display = 'none'; document.getElementById('tele').style.display = 'none';
  indicator.visible = false;
  renderScene();
};
window.closeCam = (name, st, angDeg = 0, dist = 3.2, h = 1.3) => {
  const F = game.frame(name, st);
  const a = F.yaw + angDeg * Math.PI / 180;
  const c = F.p.clone().add(new THREE.Vector3(Math.sin(a) * dist, h, Math.cos(a) * dist));
  return { pos: c.toArray(), look: F.p.clone().add(new THREE.Vector3(0, 0.95, 0)).toArray() };
};
// sound events (video seconds) for tools/audio.py: dribbles, catch, release, glass, swish, freezes, squeaks
window.events = () => {
  const vtOf = (st) => {
    for (let i = 0; i + 1 < frames.length; i++) {
      const a = frames[i], b = frames[i + 1];
      if (a.freeze || b.freeze) continue;
      if (a.st <= st && st < b.st) return a.vt + (st - a.st) / (b.st - a.st) / FPS;
    }
    return null;
  };
  const rateAt = (st) => { const f = frames.find(x => !x.freeze && x.st >= st); return f ? f.rate : 1; };
  const ev = { duration: frames.length / FPS, bounces: [], catches: [], swish: [], score: [], freezes: [], squeaks: [], steps: [], releases: [], board: [] };
  const push = (arr, st, extra = {}) => { const v = vtOf(st); if (v !== null) arr.push({ t: v, rate: rateAt(st), ...extra }); };
  for (const cy of game.cycles) push(ev.bounces, cy.r + cy.td, { gain: 1.0 });
  // ball drop after the make (same physics as game2.shotBall)
  { let py = 3.05 - 0.52, vy = -1.8, t = PLAN.netEnd; const G = 9.81, R = 0.12;
    for (let k = 0; k < 6; k++) { const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (py - R))) / G; t += tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = R;
      if (vy < 0.35) break; push(ev.bounces, t, { gain: 0.85 * Math.min(1, Math.abs(vHit) / 6) }); } }
  push(ev.catches, PLAN.lastCatch, { gain: 0.8 });
  push(ev.releases, PLAN.release, { gain: 0.6 });
  push(ev.board, PLAN.board, { gain: 1.0 });
  push(ev.swish, PLAN.rim + 0.04);
  push(ev.score, PLAN.rim + 0.1);
  for (const t of [2.9, 3.47, 6.1, 6.46, 8.62, 8.9]) push(ev.squeaks, t, { gain: 0.7 });
  let prev = null;
  for (const f of frames) { if (f.freeze && f.freeze !== prev) ev.freezes.push({ t: f.vt, dur: f.fdur, tag: f.freeze }); prev = f.freeze || null; }
  let lastStep = null;
  for (const c of S2.CAPTIONS) { if (c.step !== lastStep) push(ev.steps, c.from + 1e-3); lastStep = c.step; }
  return ev;
};
window.diagnose = () => {
  const out = [], bones = ['L_Foot', 'R_Foot', 'L_Hand', 'R_Hand', 'Head', 'Pelvis', 'L_Calf', 'R_Calf', 'L_Forearm', 'R_Forearm'];
  const prev = {}, prev2 = {}, v = new THREE.Vector3(), dt = 1 / 60;
  const gap = [];
  for (let st = 0; st <= SIM_END; st += dt) {
    const b = poseAll(st);
    for (const n of ['you', 'd1']) {
      const P = players[n]; P.root.updateMatrixWorld(true);
      const cur = {};
      for (const bn of bones) { P.rig.b[bn].getWorldPosition(v); cur[bn] = v.clone(); }
      if (prev[n] && prev2[n]) for (const bn of bones) {
        const acc = cur[bn].clone().sub(prev[n][bn]).sub(prev[n][bn].clone().sub(prev2[n][bn])).length() / (dt * dt);
        if (acc > 260) out.push([+st.toFixed(2), n, bn, Math.round(acc)]);
      }
      prev2[n] = prev[n]; prev[n] = cur;
    }
    // ball vs right palm while the ball is in hand
    if (b.state === 'held' && st < PLAN.release) {
      const r = players.you.rig; const x = new THREE.Vector3(1, 0, 0).applyQuaternion(r.W.R_Hand), y = new THREE.Vector3(0, 1, 0).applyQuaternion(r.W.R_Hand);
      const palm = r.P.R_Hand.clone().addScaledVector(x, 0.085).addScaledVector(y, 0.018);
      const d = palm.distanceTo(b.pos) - 0.12;
      if (Math.abs(d) > 0.035) gap.push([+st.toFixed(2), +d.toFixed(3)]);
    }
  }
  return { popCount: out.length, pops: out.slice(0, 60), palmGapCount: gap.length, palmGap: gap.filter((_, i) => i % 3 === 0).slice(0, 60) };
};
window.game = game; window.players = players;
window.__ready = true;
