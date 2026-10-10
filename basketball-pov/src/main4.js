// v4: the tweener / cross / cross / step-back three as a phone clip in a practice gym, played by anatomical
// skeletons in sneakers (OpenSim bone meshes on the mocap rigs). Portrait 1080x1920 at 30 fps; every frame averages
// sub-frames across a 180-degree shutter for real motion blur, with a sub-pixel jitter that doubles as anti-aliasing.
import * as THREE from 'three';
import { buildGym, gymEnvironment } from './gym.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS3, buildTracks3, D1_FIT } from './play3.js';
import { Game3, PLAN3 } from './game3.js';
import { buildTimeMap, FPS, SHOTS } from './timeline4.js';
import { makeBall } from './ball.js';
import { PhoneCam } from './camera4.js';
import { loadBones, makeBoneSkeleton, makeShoes } from './boneskel.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const SUB = q.has('sub') ? +q.get('sub') : 4;
export const SPECS = { you: { model: '04', tex: 'you', height: 1.96 }, d1: { model: '03', tex: 'd1', height: 1.97 } };

async function init() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(q.has('half') ? 0.5 : 1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(gymEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.55;
  // overhead high-bays: one key that casts the shadows, two softer ones from the other lamps, bounce off the maple
  scene.add(new THREE.HemisphereLight(0xdfe4f2, 0x7a5a3a, 0.55));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.5);
  key.position.set(3.2, 13, 9.5); key.target.position.set(1.8, 0, 5.2); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 9; sc.bottom = -7; sc.near = 2; sc.far = 30;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
  scene.add(key, key.target);
  for (const [x, z, i] of [[-5, 3, 0.55], [6, -2, 0.45]]) { const l = new THREE.DirectionalLight(0xf2f4ff, i); l.position.set(x, 12, z); scene.add(l); }
  const gym = buildGym(renderer, scene);
  const T = await loadTemplates(['04', '03']);
  const players = {};
  for (const [name, s] of Object.entries(SPECS)) { const { root, k } = makePlayerMesh(T, s); scene.add(root); players[name] = { root, rig: new Rig(root, k), spec: s }; }
  const bones = await loadBones('../assets/bones');
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe4d8c2, roughness: 0.52, metalness: 0, envMapIntensity: 0.8 });
  for (const p of Object.values(players)) {
    let m = null; p.root.traverse(o => { if (o.isSkinnedMesh && !m) m = o; });
    p.bones = makeBoneSkeleton(bones, m, { feet: false, material: boneMat }); p.shoes = makeShoes(m); m.visible = false;
  }
  const clips = {}; for (const c of CLIPS3) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const tracks = buildTracks3(clips, { you: legOf(players.you.rig), d1: legOf(players.d1.rig) });
  const game = new Game3(tracks, { you: players.you.rig, d1: players.d1.rig }, clips);
  const ball = makeBall(scene);
  const cam = new PhoneCam(game, PLAN3);
  const camera = new THREE.PerspectiveCamera(66, W / H, 0.05, 120);
  const frames = buildTimeMap(FPS);
  // accumulation buffers
  const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
  const rtScene = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: q.has('nomsaa') ? 0 : 4 });
  const rtAccum = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType });
  window.__frames = frames.length; window.__fps = FPS;
  await new Promise(r => setTimeout(r, 2500));
  return { renderer, scene, camera, gym, players, game, ball, cam, frames, rtScene, rtAccum };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, gym, players, game, ball, cam, frames, rtScene, rtAccum } = ctx;

const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const accMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, w: { value: 1 } }, vertexShader: VS,
  fragmentShader: 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }',
  blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
// phone look: exposure, a touch of lift in the blacks, sensor grain, soft vignette
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: rtAccum.texture }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D t; uniform float seed; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main(){
      vec3 c = texture2D(t, vUv).rgb * 1.06 + 0.004;
      vec2 d = vUv - 0.5; d.x *= res.x / res.y; c *= 1.0 - 0.32 * smoothstep(0.35, 1.05, length(d) * 1.35);
      float g = (h(vUv * res) + h(vUv * res + 17.3) - 1.0) * 0.022; c += g * (0.35 + c);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, depthTest: false, depthWrite: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat);
const quadScene = new THREE.Scene(); quadScene.add(quad);

function poseAll(st) {
  const Y = game.youPose(st); players.you.rig.applyMocap(Y.T, Y.T.src, Y.opt);
  const D = game.d1Pose(st); players.d1.rig.applyMocap(D.T, D.T.src, D.opt);
  const b = game.ball(st);
  ball.position.copy(b.pos); ball.quaternion.copy(b.q);
  gym.net.update(b.state === 'net' ? b.netU : (b.state === 'drop' ? 1.2 : 0), b.state === 'net' ? 1 : 0);
}
function place(c, jx, jy) {
  camera.position.copy(c.pos); camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0); camera.lookAt(c.look);
  camera.fov = c.fov; camera.setViewOffset(W, H, jx, jy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const JIT = [[-0.25, -0.25], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [0, 0], [0.125, -0.375], [-0.375, 0.125], [0.375, 0.375]];
function renderSub(st, shot, k, first) {
  poseAll(st);
  place(cam.at(shot, st), JIT[k % JIT.length][0], JIT[k % JIT.length][1]);
  scene.updateMatrixWorld(true);
  if (first) { gym.floor.visible = false; gym.reflector.onBeforeRender(renderer, scene, camera); gym.floor.visible = true; }
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  accMat.uniforms.t.value = rtScene.texture; accMat.uniforms.w.value = 1 / SUB; quad.material = accMat;
  renderer.setRenderTarget(rtAccum); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
}
function present(seed) {
  renderer.setRenderTarget(null); quad.material = outMat; outMat.uniforms.seed.value = seed; renderer.render(quadScene, quadCam);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

// first draws compile programs and allocate shadow maps (and log a GL warning once): do that before any real frame
renderSub(0.5, 'live', 0, true); present(0);

window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)];
  const shutter = fr.rate / (2 * FPS), sh = SHOTS[fr.shotIdx];
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < SUB; k++) {
    const st = Math.min(sh.to, Math.max(sh.from, fr.st + ((k + 0.5) / SUB - 0.5) * shutter));
    renderSub(st, fr.shot, k, k === 0);
  }
  present(i * 0.618);
  return performance.now() - t0;
};
// stills for checks: renderSim(st, shotId)
window.renderSim = (st, shot = 'live') => {
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  const n = SUB; for (let k = 0; k < n; k++) renderSub(st, shot, k, k === 0);
  present(1.0);
};
window.events = () => {
  const ev = { duration: frames.length / FPS, bounces: [], catches: [], swish: [], score: [], freezes: [], squeaks: [], steps: [], releases: [], board: [], cuts: [], shots: [] };
  // one entry per shot: sim times map into that shot's stretch of video
  let vt = 0;
  for (const s of SHOTS) {
    const n = Math.round((s.to - s.from) / s.rate * FPS), v0 = vt;
    ev.shots.push({ id: s.id, t: v0, dur: n / FPS, rate: s.rate });
    if (v0 > 0) ev.cuts.push({ t: v0 });
    const push = (arr, st, extra = {}) => { if (st >= s.from && st < s.to) arr.push({ t: v0 + (st - s.from) / s.rate, rate: s.rate, ...extra }); };
    for (const f of game.flights) push(ev.bounces, f.tb, { gain: 0.95 });
    { let py = 3.05 - 0.54, vy = -1.9, t = PLAN3.netEnd; const G = 9.81, R = 0.12;
      for (let k = 0; k < 6; k++) { const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (py - R))) / G; t += tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = R; if (vy < 0.35) break; push(ev.bounces, t, { gain: 0.85 * Math.min(1, Math.abs(vHit) / 6) }); } }
    push(ev.catches, PLAN3.gatherAt, { gain: 0.8 });
    push(ev.releases, PLAN3.release, { gain: 0.7 });
    push(ev.swish, PLAN3.rim + 0.03);
    if (s.id === 'live') push(ev.score, PLAN3.rim + 0.08);
    const k = PLAN3.tweener; for (const j of [k, k + 1, k + 2]) push(ev.squeaks, game.pushes[j].s1 - 0.02, { gain: 0.8 });
    push(ev.squeaks, game.pushes[k + 2].s1 + 0.35, { gain: 0.9 });
    push(ev.squeaks, D1_FIT.closeAt + 0.05, { gain: 0.85 }); push(ev.squeaks, D1_FIT.closeAt + 0.7, { gain: 0.6 });
    vt += n / FPS;
  }
  return ev;
};
window.game = game; window.players = players;
window.__ready = true;
