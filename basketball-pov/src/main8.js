// v8 "make him move": the v5 film-room page (practice gym, anatomical skeletons, floor balance meter, timing strip,
// freezes, slow motion, rim cut) on the v8 reps - a shooter who isn't fast beating his man with fakes, changes of
// pace and the stop. 1080x1920 at 30 fps with motion blur.
import * as THREE from 'three';
import { buildGym, gymEnvironment } from './gym.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS8, REPS, buildRep } from './play8.js';
import { Rep, RIM } from './rep5.js';
import { buildTimeMap, FPS, SEQ } from './timeline8.js';
import { makeBall } from './ball.js';
import { Cam5 } from './camera5.js';
import { loadBones, makeBoneSkeleton, makeShoes } from './boneskel.js';
import { FloorMeter } from './meter5.js';
import { Hud8 } from './hud8.js';
import { smooth } from './motion.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const SUB = q.has('sub') ? +q.get('sub') : 2;
// (built taller than they read: in their relaxed stance the skeletons stand about 6'5" to the top of the skull)
const SPECS = { you: { model: '04', tex: 'you', height: 2.125 }, d1: { model: '03', tex: 'd1', height: 2.135 } };

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
  key.position.set(3.2, 13, 9.5); key.target.position.set(1.8, 0, 4.2); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 9; sc.bottom = -7; sc.near = 2; sc.far = 30;
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
  const clips = {}; for (const c of CLIPS8) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const legs = { you: legOf(players.you.rig), d1: legOf(players.d1.rig) };
  const rigs = { you: players.you.rig, d1: players.d1.rig };
  const reps = {};
  for (const name of Object.keys(REPS)) reps[name] = new Rep(name, buildRep(name, clips, legs), rigs, clips, { ...REPS[name].plan, simEnd: REPS[name].simEnd });
  const ball = makeBall(scene);
  const meter = new FloorMeter(scene);
  const cam = new Cam5(reps);
  const camera = new THREE.PerspectiveCamera(54, W / H, 0.05, 120);
  const frames = buildTimeMap(reps, FPS);
  const hud = new Hud8(document.getElementById('hud'), reps, frames, FPS);
  const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
  const rtScene = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: q.has('nomsaa') ? 0 : 4 });
  const rtAccum = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType });
  window.__frames = frames.length; window.__fps = FPS;
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1500));
  return { renderer, scene, camera, gym, players, reps, ball, meter, cam, frames, hud, rtScene, rtAccum };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, gym, players, reps, ball, meter, cam, frames, hud, rtScene, rtAccum } = ctx;

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

function poseAll(rep, st, mode) {
  const Y = rep.youPose(st); players.you.rig.applyMocap(Y.T, Y.T.src, Y.opt);
  const D = rep.d1Pose(st); players.d1.rig.applyMocap(D.T, D.T.src, D.opt);
  const b = rep.ball(st);
  ball.position.copy(b.pos); ball.quaternion.copy(b.q);
  gym.net.update(b.state === 'net' ? b.netU : (b.state === 'drop' ? 1.2 : 0), b.state === 'net' ? 1 : 0);
  // the meter lives while the read matters: through the release (the contact for the finish), then fades
  const P = rep.plan, end = P.contact ? P.contact.t + 0.5 : P.release + 0.3;
  meter.update(rep.balance(st), mode === 'rim' ? 0 : 1 - smooth((st - end) / 0.3));
}
function place(c, jx, jy) {
  camera.position.set(c.pos.x, c.pos.y, c.pos.z); camera.up.set(0, 1, 0); camera.lookAt(c.look.x, c.look.y, c.look.z);
  camera.fov = c.fov; camera.setViewOffset(W, H, jx, jy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const JIT = [[-0.25, -0.25], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [0, 0], [0.125, -0.375], [-0.375, 0.125], [0.375, 0.375]];
function renderSub(rep, mode, st, k, first) {
  poseAll(rep, st, mode);
  // (window.camOverride = {pos, look, fov} pins the camera, for trying angles in stills)
  place(window.camOverride || cam.at(rep.name, mode, st), JIT[k % JIT.length][0], JIT[k % JIT.length][1]);
  scene.updateMatrixWorld(true);
  if (first) { const v = meter.group.visible; gym.floor.visible = false; meter.group.visible = false; gym.reflector.onBeforeRender(renderer, scene, camera); gym.floor.visible = true; meter.group.visible = v; }
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  accMat.uniforms.t.value = rtScene.texture; accMat.uniforms.w.value = 1 / SUB; quad.material = accMat;
  renderer.setRenderTarget(rtAccum); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
}
function present(seed, fz) {
  renderer.setRenderTarget(null); quad.material = outMat; outMat.uniforms.seed.value = seed; outMat.uniforms.fz.value = fz; renderer.render(quadScene, quadCam);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

// first draws compile programs and allocate shadow maps (and log a GL warning once): do that before any real frame
renderSub(Object.values(reps)[0], 'duel', 0.5, 0, true); present(0, 0);

// where his shoulder meets the help defender's chest at the contact, on screen (the camera is where the last draw left it)
const hitAt = (rep) => {
  const c = rep.plan.contact; if (!c) return null;
  const p = rep.tab('hip', c.t).lerp(rep.tab('d1hip', c.t), 0.55); p.y = 1.38; p.project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, visible: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
};
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
  hud.update(fr, fr.st, hitAt(rep));
  const fz = fr.freeze && !fr.card ? smooth(fr.fu * 8) : (fr.card ? 0.6 : 0);
  present(i * 0.618, fz);
  return performance.now() - t0;
};
// stills for checks: renderSim(rep, st, mode) with the HUD as it would be in the nearest frame of that rep
window.renderSim = (name, st, mode = 'duel') => {
  const rep = reps[name];
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < SUB; k++) renderSub(rep, mode, st, k, k === 0);
  cached = null;
  let best = null; for (const f of frames) if (f.rep === name && !f.card && (!best || Math.abs(f.st - st) < Math.abs(best.st - st))) best = f;
  hud.update({ ...best, st, cam: mode }, st, hitAt(rep));
  present(1.0, 0);
};
window.events = () => {
  const ev = { duration: frames.length / FPS, bounces: [], catches: [], swish: [], releases: [], squeaks: [], cuts: [], board: [], thuds: [], whistles: [], freezes: [], rims: [] };
  let vt = 0, prev = null;
  SEQ.forEach((s, k) => {
    const live = s.freeze === undefined, n = live ? Math.round((s.to - s.from) / s.rate * FPS) : Math.round(s.dur * FPS), v0 = vt;
    if (prev && (prev.cam !== s.cam || prev.rep !== s.rep) && !s.card && !prev.card) ev.cuts.push({ t: v0 });
    if (!live && !s.card) ev.freezes.push({ t: v0 });
    if (live) {
      const rep = reps[s.rep], P = rep.plan;
      const push = (arr, st, extra = {}) => { if (st >= s.from && st < s.to) arr.push({ t: v0 + (st - s.from) / s.rate, rate: s.rate, ...extra }); };
      for (const f of rep.flights) push(ev.bounces, f.tb, { gain: 0.95 });
      { let py = RIM.y - 0.54, vy = -1.9, t = P.netEnd; const G = 9.81, R = 0.12;
        for (let j = 0; j < 6; j++) { const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (py - R))) / G; t += tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = R; if (vy < 0.35) break; push(ev.bounces, t, { gain: 0.85 * Math.min(1, Math.abs(vHit) / 6) }); } }
      push(ev.catches, P.gatherAt, { gain: 0.8 });
      push(ev.releases, P.release, { gain: 0.7 });
      push(ev.swish, P.rim + 0.03);
      if (P.board) push(ev.board, P.board);
      if (P.contact) push(ev.thuds, P.contact.t);
      // sneakers: every change of move on either side
      for (const tr of [rep.tracks.you, rep.tracks.d1]) for (const sg of tr.segs.slice(1)) push(ev.squeaks, sg.at + 0.05, { gain: 0.8 });
      if (P.takeoff) push(ev.squeaks, P.takeoff - 0.04, { gain: 0.7 });
    }
    vt += n / FPS; prev = s;
  });
  return ev;
};
window.reps = reps; window.players = players; window.hud = hud;
window.__ready = true;
