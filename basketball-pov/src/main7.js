// v7 "get your hands on it": steals, as a vertical film-room clip in the practice gym with the anatomical
// skeletons. On the ball against a good dribbler (take it when it crosses in front of him; when he's beaten you,
// from behind) and off the ball (bait the lane, leave on the windup). A ring on the ball shows when it's actually
// reachable. 1080x1920 at 30 fps with motion blur.
import * as THREE from 'three';
import { buildGym, gymEnvironment } from './gym.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS7, REPS, buildRep } from './play7.js';
import { buildTimeMap, FPS, SEQ } from './timeline7.js';
import { makeBall } from './ball.js';
import { Cam7 } from './camera7.js';
import { loadBones, makeBoneSkeleton, makeShoes } from './boneskel.js';
import { Hud7 } from './hud7.js';
import { smooth } from './motion.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const SUB = q.has('sub') ? +q.get('sub') : 2;
// (built taller than they read: in their relaxed stance the skeletons stand about 6'5" to the top of the skull)
// df is you (the defender); bh the ball handler; rc the receiver on the passing rep
const SPECS = { df: { model: '04', tex: 'you', height: 2.125 }, bh: { model: '03', tex: 'd1', height: 2.135 }, rc: { model: '04', tex: 'wing', height: 2.125 } };

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
  scene.add(new THREE.HemisphereLight(0xdfe4f2, 0x7a5a3a, 0.55));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.5);
  key.position.set(3.2, 13, 12.5); key.target.position.set(0.8, 0, 6.0); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 9; sc.bottom = -8; sc.near = 2; sc.far = 32;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
  scene.add(key, key.target);
  for (const [x, z, i] of [[-5, 3, 0.55], [6, -2, 0.45]]) { const l = new THREE.DirectionalLight(0xf2f4ff, i); l.position.set(x, 12, z); scene.add(l); }
  const gym = buildGym(renderer, scene, { scoreboard: false });
  const T = await loadTemplates(['04', '03']);
  const players = {};
  for (const [name, s] of Object.entries(SPECS)) { const { root, k } = makePlayerMesh(T, s); scene.add(root); players[name] = { root, rig: new Rig(root, k), spec: s }; }
  const bones = await loadBones('../assets/bones');
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe4d8c2, roughness: 0.52, metalness: 0, envMapIntensity: 0.8 });
  for (const p of Object.values(players)) {
    let m = null; p.root.traverse(o => { if (o.isSkinnedMesh && !m) m = o; });
    p.bones = makeBoneSkeleton(bones, m, { feet: false, material: boneMat }); p.shoes = makeShoes(m); m.visible = false;
  }
  const clips = {}; for (const c of CLIPS7) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const legs = {}, rigs = {}; for (const [n, p] of Object.entries(players)) { legs[n] = legOf(p.rig); rigs[n] = p.rig; }
  const reps = {};
  for (const name of Object.keys(REPS)) reps[name] = buildRep(name, clips, legs, rigs);
  const ball = makeBall(scene);
  const cam = new Cam7(reps);
  const camera = new THREE.PerspectiveCamera(54, W / H, 0.05, 120);
  const frames = buildTimeMap(reps, FPS);
  const hud = new Hud7(document.getElementById('hud'), reps, frames, FPS);
  const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
  const rtScene = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: q.has('nomsaa') ? 0 : 4 });
  const rtAccum = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType });
  window.__frames = frames.length; window.__fps = FPS;
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1500));
  return { renderer, scene, camera, gym, players, reps, ball, cam, frames, hud, rtScene, rtAccum };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, gym, players, reps, ball, cam, frames, hud, rtScene, rtAccum } = ctx;

const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const accMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, w: { value: 1 } }, vertexShader: VS,
  fragmentShader: 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }',
  blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
// phone look plus a freeze grade: a freeze frame drops the saturation and brightness a little so the overlays read
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: rtAccum.texture }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, fz: { value: 0 } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D t; uniform float seed; uniform vec2 res; uniform float fz; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main(){
      vec3 c = texture2D(t, vUv).rgb * 1.06 + 0.004;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(c, vec3(l), 0.35 * fz) * (1.0 - 0.18 * fz);
      vec2 d = vUv - 0.5; d.x *= res.x / res.y; c *= 1.0 - 0.32 * smoothstep(0.35, 1.05, length(d) * 1.35);
      float g = (h(vUv * res) + h(vUv * res + 17.3) - 1.0) * 0.022; c += g * (0.35 + c);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, depthTest: false, depthWrite: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat);
const quadScene = new THREE.Scene(); quadScene.add(quad);

function poseAll(rep, st) {
  for (const [name, p] of Object.entries(players)) {
    const on = !!rep.tracks[name]; p.root.visible = on; p.bones.visible = on; p.shoes.visible = on;
    if (!on) continue;
    const X = rep.pose(name, st); p.rig.applyMocap(X.T, X.T.src, X.opt);
  }
  const b = rep.ball(st);
  ball.position.copy(b.pos); ball.quaternion.copy(b.q);
  gym.net.update(0, 0);
}
function place(c, jx, jy) {
  camera.position.set(c.pos.x, c.pos.y, c.pos.z); camera.up.set(0, 1, 0); camera.lookAt(c.look.x, c.look.y, c.look.z);
  camera.fov = c.fov; camera.setViewOffset(W, H, jx, jy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const JIT = [[-0.25, -0.25], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [0, 0], [0.125, -0.375], [-0.375, 0.125], [0.375, 0.375]];
function renderSub(rep, mode, st, k, first) {
  poseAll(rep, st);
  // (window.camOverride = {pos, look, fov} pins the camera, for trying angles in stills)
  place(window.camOverride || cam.at(rep.name, mode, st), JIT[k % JIT.length][0], JIT[k % JIT.length][1]);
  scene.updateMatrixWorld(true);
  if (first) { gym.floor.visible = false; gym.reflector.onBeforeRender(renderer, scene, camera); gym.floor.visible = true; }
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  accMat.uniforms.t.value = rtScene.texture; accMat.uniforms.w.value = 1 / SUB; quad.material = accMat;
  renderer.setRenderTarget(rtAccum); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
}
function present(seed, fz) {
  renderer.setRenderTarget(null); quad.material = outMat; outMat.uniforms.seed.value = seed; outMat.uniforms.fz.value = fz; renderer.render(quadScene, quadCam);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

// first draws compile programs and allocate shadow maps (and log a GL warning once): do that before any real frame
{ const r0 = Object.values(reps)[0]; renderSub(r0, SEQ.find(s => s.rep === r0.name).cam, 0.3, 0, true); present(0, 0); }

let cached = null;
window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)], rep = reps[fr.rep], seg = SEQ[fr.seg];
  // a freeze is one picture: render it once and only re-grade it (fresh grain) for the following frames
  const key = fr.freeze ? `${fr.rep}:${fr.cam}:${fr.st}` : null;
  if (!key || key !== cached) {
    renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
    const shutter = fr.freeze ? 0 : fr.rate / (2 * FPS);
    for (let k = 0; k < SUB; k++) {
      const st = fr.freeze ? fr.st : Math.min(seg.to, Math.max(seg.from, fr.st + ((k + 0.5) / SUB - 0.5) * shutter));
      renderSub(rep, fr.cam, st, k, k === 0);
    }
    cached = key;
  }
  hud.update(fr, fr.st, camera);
  const fz = fr.freeze && !fr.card ? smooth(fr.fu * 8) : (fr.card ? 0.6 : 0);
  present(i * 0.618, fz);
  return performance.now() - t0;
};
// stills for checks: renderSim(rep, st, mode) with the HUD as it would be in the nearest frame of that rep
window.renderSim = (name, st, mode) => {
  const rep = reps[name];
  let best = null; for (const f of frames) if (f.rep === name && !f.card && (!best || Math.abs(f.st - st) < Math.abs(best.st - st))) best = f;
  mode = mode || (best ? best.cam : 'over');
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < SUB; k++) renderSub(rep, mode, st, k, k === 0);
  cached = null;
  hud.update({ ...best, st, cam: mode }, st, camera);
  present(1.0, 0);
};
window.events = () => {
  const ev = { duration: frames.length / FPS, bounces: [], squeaks: [], pokes: [], catches: [], releases: [], swish: [], cuts: [], freezes: [] };
  let vt = 0, prev = null;
  SEQ.forEach((s, k) => {
    const live = s.freeze === undefined, n = live ? Math.round((s.to - s.from) / s.rate * FPS) : Math.round(s.dur * FPS), v0 = vt;
    if (prev && (prev.cam !== s.cam || prev.rep !== s.rep) && !s.card && !prev.card) ev.cuts.push({ t: v0 });
    if (!live && !s.card) ev.freezes.push({ t: v0 });
    if (live) {
      const rep = reps[s.rep], P = rep.plan;
      const push = (arr, st, extra = {}) => { if (st >= s.from && st < s.to) arr.push({ t: v0 + (st - s.from) / s.rate, rate: s.rate, ...extra }); };
      for (const f of rep.flights) if (!P.strike || f.tb < rep.strike.t) push(ev.bounces, f.tb, { gain: 0.9 });
      if (rep.loose) for (const b of rep.loose.bounces) push(ev.bounces, b.t, { gain: Math.min(1, b.speed / 4) });
      if (P.strike) push(ev.pokes, rep.strike.t);
      if (P.pass) { push(ev.catches, P.pass.pick + 0.02, { gain: 0.55 }); push(ev.releases, P.pass.rel, { gain: 1.2 }); push(ev.catches, P.pass.tInt, { gain: 1.1 }); }
      for (const tr of Object.values(rep.tracks)) for (const sg of tr.segs.slice(1)) push(ev.squeaks, sg.at + 0.05, { gain: 0.8 });
    }
    vt += n / FPS; prev = s;
  });
  return ev;
};
window.reps = reps; window.players = players; window.hud = hud;
window.__ready = true;
