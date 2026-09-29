// v3: between-the-legs, cross, cross, step-back three -- side (broadcast) camera. Mocap-driven (play3.js, game3.js).
import * as THREE from 'three';
import { buildArena, arenaEnvironment } from './arena.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS3, buildTracks3, D1_FIT } from './play3.js';
import { Game3, PLAN3 } from './game3.js';
import { buildTimeMap, FPS, SIM_END } from './timeline3.js';
import { makeBall } from './ball.js';
import { SideCam } from './camera3.js';
import { Hud3 } from './hud3.js';
import { makeIndicator } from './overlays.js';

const W = 1920, H = 1080;
const q = new URLSearchParams(location.search);
export const SPECS = { you: { model: '04', tex: 'you', height: 1.96 }, d1: { model: '03', tex: 'd1', height: 1.97 } };

async function init() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.has('noaa'), preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(q.has('half') ? 0.5 : 1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !q.has('noshadow'); renderer.shadowMap.type = THREE.PCFShadowMap;
  await document.fonts.load('800 40px BC');
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(arenaEnvironment(), 0.02).texture;
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a4a3a, 0.75));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.6);
  key.position.set(3.5, 16, 12); key.target.position.set(0, 0, 4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 12; sc.bottom = -10; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9); rim.position.set(-6, 10, -8); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(14, 7, 6); scene.add(fill);
  const arena = buildArena(renderer, scene, { ledWords: ['STORM', 'BLAZE', 'HOOPS IQ', 'STEP-BACK', 'GAME TIME'] });
  const T = await loadTemplates(['04', '03']);
  const players = {};
  for (const [name, s] of Object.entries(SPECS)) { const { root, k } = makePlayerMesh(T, s); scene.add(root); players[name] = { root, rig: new Rig(root, k), spec: s }; }
  const clips = {}; for (const c of CLIPS3) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const tracks = buildTracks3(clips, { you: legOf(players.you.rig), d1: legOf(players.d1.rig) });
  const game = new Game3(tracks, { you: players.you.rig, d1: players.d1.rig }, clips);
  const ball = makeBall(scene);
  const cam = new SideCam(game, PLAN3);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 160);
  const frames = buildTimeMap(FPS);
  const k = PLAN3.tweener, pu = game.pushes;
  const callouts = [
    { t: pu[k].s1 - 0.06, dur: 0.75, text: 'BETWEEN THE LEGS', dx: -150, dy: 0 },
    { t: pu[k + 1].s1 - 0.06, dur: 0.6, text: 'CROSS', dx: 150, dy: 0 },
    { t: pu[k + 2].s1 - 0.06, dur: 0.6, text: 'CROSS', dx: -140, dy: 0 },
    { t: pu[k + 2].s1 + 0.2, dur: 0.75, text: 'STEP-BACK', dx: 150, dy: -10 },
  ];
  const hud = new Hud3(document.getElementById('hud'), PLAN3, callouts);
  const indicator = makeIndicator(scene);
  window.__frames = frames.length; window.__fps = FPS;
  await new Promise(r => setTimeout(r, 2500));
  return { renderer, scene, camera, arena, players, game, ball, cam, frames, hud, indicator };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, arena, players, game, ball, cam, frames, hud, indicator } = ctx;

function renderScene() {
  scene.updateMatrixWorld(true);
  const { floor, reflector } = arena;
  floor.visible = false; indicator.visible = false;
  reflector.onBeforeRender(renderer, scene, camera);
  floor.visible = true; indicator.visible = true;
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
const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, visible: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 }; };
function place(c) { camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
const sepAtRelease = (() => { const a = game.frame('you', PLAN3.release).p, b = game.frame('d1', PLAN3.release).p; return a.distanceTo(b); })();

window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)], st = fr.st;
  poseAll(st);
  place(cam.at(st));
  const F = game.frame('you', st);
  indicator.position.set(F.p.x, 0, F.p.z); indicator.rotation.y = F.yaw + Math.PI;
  hud.update(fr, st, proj, { youHead: players.you.rig.P.Head.clone(), youRight: F.r.clone(), d1Head: players.d1.rig.P.Head.clone(), separation: sepAtRelease });
  renderScene();
  return performance.now() - t0;
};
window.renderSim = (st, c) => {
  poseAll(st);
  if (c) { camera.position.set(...c.pos); camera.lookAt(...c.look); camera.fov = c.fov || 40; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); } else place(cam.at(st));
  hud.root.style.display = 'none'; indicator.visible = false; renderScene();
};
window.closeCam = (name, st, angDeg = 0, dist = 3.2, h = 1.3) => {
  const F = game.frame(name, st), a = F.yaw + angDeg * Math.PI / 180;
  const c = F.p.clone().add(new THREE.Vector3(Math.sin(a) * dist, h, Math.cos(a) * dist));
  return { pos: c.toArray(), look: F.p.clone().add(new THREE.Vector3(0, 0.95, 0)).toArray() };
};
window.events = () => {
  const vtOf = (st) => { for (let i = 0; i + 1 < frames.length; i++) { const a = frames[i], b = frames[i + 1]; if (a.freeze || b.freeze) continue; if (a.st <= st && st < b.st) return a.vt + (st - a.st) / (b.st - a.st) / FPS; } return null; };
  const rateAt = (st) => { const f = frames.find(x => !x.freeze && x.st >= st); return f ? f.rate : 1; };
  const ev = { duration: frames.length / FPS, bounces: [], catches: [], swish: [], score: [], freezes: [], squeaks: [], steps: [], releases: [], board: [], buzzer: [] };
  const push = (arr, st, extra = {}) => { const v = vtOf(st); if (v !== null) arr.push({ t: v, rate: rateAt(st), ...extra }); };
  for (const f of game.flights) push(ev.bounces, f.tb, { gain: 0.95 });
  { let py = 3.05 - 0.54, vy = -1.9, t = PLAN3.netEnd; const G = 9.81, R = 0.12;
    for (let k = 0; k < 6; k++) { const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (py - R))) / G; t += tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = R; if (vy < 0.35) break; push(ev.bounces, t, { gain: 0.85 * Math.min(1, Math.abs(vHit) / 6) }); } }
  push(ev.catches, PLAN3.gatherAt, { gain: 0.8 });
  push(ev.releases, PLAN3.release, { gain: 0.7 });
  push(ev.swish, PLAN3.rim + 0.03);
  push(ev.score, PLAN3.rim + 0.08);
  push(ev.buzzer, 4.4);
  { const a0 = vtOf(PLAN3.release + 0.15), a1 = vtOf(PLAN3.rim); if (a0 !== null && a1 !== null) ev.anticipation = [{ t0: a0, t1: a1 }]; }
  const k = PLAN3.tweener; for (const j of [k, k + 1, k + 2]) push(ev.squeaks, game.pushes[j].s1 - 0.02, { gain: 0.8 });
  push(ev.squeaks, game.pushes[k + 2].s1 + 0.35, { gain: 0.9 });
  push(ev.squeaks, D1_FIT.closeAt + 0.05, { gain: 0.85 }); push(ev.squeaks, D1_FIT.closeAt + 0.7, { gain: 0.6 }); // his plant + stop
  let prev = null; for (const f of frames) { if (f.freeze && f.freeze !== prev) ev.freezes.push({ t: f.vt, dur: f.fdur, tag: f.freeze }); prev = f.freeze || null; }
  return ev;
};
window.game = game; window.players = players;
window.__ready = true;
