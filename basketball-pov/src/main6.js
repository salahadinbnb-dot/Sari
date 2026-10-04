// v6 "get up": a vertical film-room clip on the approach and the dunk, in the practice gym with the anatomical
// skeleton. Rep 1: the approach (speed, the big step, the plant, the arms) into a rim touch. Rep 2: the dunk -
// the same approach all-out, ball cocked back behind the head, thrown down, hanging on the rim. 1080x1920, 30 fps,
// motion blur from sub-frames.
import * as THREE from 'three';
import { buildGym, gymEnvironment } from './gym.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS6, REPS6 } from './play6.js';
import { Rep6, RIM } from './rep6.js';
import { buildTimeMap, FPS, SEQ } from './timeline6.js';
import { makeBall } from './ball.js';
import { Cam6 } from './camera6.js';
import { loadBones, makeBoneSkeleton, makeShoes } from './boneskel.js';
import { NetFlex } from './net6.js';
import { Hud6 } from './hud6.js';
import { Marks6 } from './marks6.js';
import { smooth } from './motion.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const SUB = q.has('sub') ? +q.get('sub') : 2;
const SPEC = { model: '04', tex: 'you', height: 1.96 };

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
  key.position.set(3.0, 13, 9.0); key.target.position.set(0, 0, 1.5); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 8; sc.bottom = -6; sc.near = 2; sc.far = 30;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
  scene.add(key, key.target);
  for (const [x, z, i] of [[-5, 3, 0.55], [6, -2, 0.45]]) { const l = new THREE.DirectionalLight(0xf2f4ff, i); l.position.set(x, 12, z); scene.add(l); }
  const gym = buildGym(renderer, scene, { scoreboard: false, net: false });
  const net = new NetFlex(scene);
  const T = await loadTemplates(['04']);
  const { root, k } = makePlayerMesh(T, SPEC); scene.add(root);
  const player = { root, rig: new Rig(root, k) };
  const bones = await loadBones('../assets/bones');
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe4d8c2, roughness: 0.52, metalness: 0, envMapIntensity: 0.8 });
  { let m = null; root.traverse(o => { if (o.isSkinnedMesh && !m) m = o; }); player.bones = makeBoneSkeleton(bones, m, { feet: false, material: boneMat }); player.shoes = makeShoes(m); m.visible = false; }
  const clips = {}; for (const c of CLIPS6) clips[c] = await loadClip(c);
  const legs = { you: player.rig.len.thigh + player.rig.len.calf };
  const reps = {};
  for (const name of Object.keys(REPS6)) reps[name] = new Rep6(name, REPS6[name].build(clips, legs), player.rig, clips, { ...REPS6[name].plan, simEnd: REPS6[name].simEnd });
  const ball = makeBall(scene);
  const marks = new Marks6(scene, reps);
  const cam = new Cam6(reps);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 120);
  const frames = buildTimeMap(FPS);
  const hud = new Hud6(document.getElementById('hud'), reps, frames, FPS);
  const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
  const rtScene = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: q.has('nomsaa') ? 0 : 4 });
  const rtAccum = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType });
  window.__frames = frames.length; window.__fps = FPS;
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 1500));
  return { renderer, scene, camera, gym, net, player, reps, ball, marks, cam, frames, hud, rtScene, rtAccum };
}

const ctx = await init().catch(e => { window.__error = String(e.stack || e); throw e; });
const { renderer, scene, camera, gym, net, player, reps, ball, marks, cam, frames, hud, rtScene, rtAccum } = ctx;

const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const accMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, w: { value: 1 } }, vertexShader: VS,
  fragmentShader: 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }',
  blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
// phone look plus a freeze grade (a freeze drops saturation and brightness a little so the overlays read), and a flash
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: rtAccum.texture }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, fz: { value: 0 }, flash: { value: 0 } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D t; uniform float seed; uniform vec2 res; uniform float fz; uniform float flash; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main(){
      vec3 c = texture2D(t, vUv).rgb * 1.06 + 0.004;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(c, vec3(l), 0.35 * fz) * (1.0 - 0.18 * fz);
      c += flash * (0.35 + c);
      vec2 d = vUv - 0.5; d.x *= res.x / res.y; c *= 1.0 - 0.32 * smoothstep(0.35, 1.05, length(d) * 1.35);
      float g = (h(vUv * res) + h(vUv * res + 17.3) - 1.0) * 0.022; c += g * (0.35 + c);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, depthTest: false, depthWrite: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat);
const quadScene = new THREE.Scene(); quadScene.add(quad);

const STANCH = new THREE.Vector3(0, 0, -3.38);
function poseAll(rep, st, mode) {
  const Y = rep.youPose(st); player.rig.applyMocap(Y.T, Y.T.src, Y.opt);
  const b = rep.ballAt(st);
  ball.visible = !!b;
  if (b) { ball.position.copy(b); ball.quaternion.copy(rep.ballQ(st)); }
  const ns = rep.netState(st); net.update(ns);
  gym.hoop.rimPivot.rotation.x = ns.angle;
  // the stanchion rocks about its base
  const a = rep.boardShake(st), B = gym.hoop.board;
  B.position.set(0, 0, 0); B.rotation.set(0, 0, 0);
  B.position.sub(STANCH).applyAxisAngle(new THREE.Vector3(1, 0, 0), a).add(STANCH); B.rotation.x = a;
  marks.update(rep, st, mode);
  // the highest point he gets to right now: fingertips (the hand bone's x runs along the fingers), or the top of the ball
  const rig = player.rig, X = new THREE.Vector3(1, 0, 0);
  let top = 0; for (const s of ['L', 'R']) top = Math.max(top, rig.P[s + '_Hand'].y + X.clone().applyQuaternion(rig.W[s + '_Hand']).y * 0.19);
  lastReach = b ? b.y + 0.12 : top;
}
let lastReach = 0;
function place(c, jx, jy) {
  camera.position.set(c.pos.x, c.pos.y, c.pos.z); camera.up.set(0, 1, 0); camera.lookAt(c.look.x, c.look.y, c.look.z);
  if (c.roll) camera.rotateZ(c.roll);
  camera.fov = c.fov; camera.setViewOffset(W, H, jx, jy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const JIT = [[-0.25, -0.25], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [0, 0], [0.125, -0.375], [-0.375, 0.125], [0.375, 0.375]];
function renderSub(rep, mode, st, k, first) {
  poseAll(rep, st, mode);
  // (window.camOverride = {pos, look, fov} pins the camera, for trying angles in stills)
  place(window.camOverride || cam.at(rep.name, mode, st), JIT[k % JIT.length][0], JIT[k % JIT.length][1]);
  scene.updateMatrixWorld(true);
  if (first) { const v = marks.group.visible; gym.floor.visible = false; marks.group.visible = false; gym.reflector.onBeforeRender(renderer, scene, camera); gym.floor.visible = true; marks.group.visible = v; }
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  accMat.uniforms.t.value = rtScene.texture; accMat.uniforms.w.value = 1 / SUB; quad.material = accMat;
  renderer.setRenderTarget(rtAccum); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
}
function present(seed, fz, flash = 0) {
  renderer.setRenderTarget(null); quad.material = outMat; outMat.uniforms.seed.value = seed; outMat.uniforms.fz.value = fz; outMat.uniforms.flash.value = flash; renderer.render(quadScene, quadCam);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

renderSub(reps.touch, 'side', 1.0, 0, true); present(0, 0);

let cached = null;
window.renderFrame = (i) => {
  const t0 = performance.now();
  const fr = frames[Math.min(i, frames.length - 1)], rep = reps[fr.rep], seg = SEQ[fr.seg];
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
  hud.update(fr, fr.st, camera, lastReach);
  const fz = fr.freeze && !fr.card ? smooth(fr.fu * 8) : (fr.card ? 0.6 : 0);
  present(i * 0.618, fz, hud.flash || 0);
  return performance.now() - t0;
};
// stills for checks: renderSim(rep, st, mode) with the HUD as it would be in the nearest frame of that rep
window.renderSim = (name, st, mode = 'side') => {
  const rep = reps[name];
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < SUB; k++) renderSub(rep, mode, st, k, k === 0);
  cached = null;
  let best = null; for (const f of frames) if (f.rep === name && !f.card && (!best || Math.abs(f.st - st) < Math.abs(best.st - st))) best = f;
  if (best) hud.update({ ...best, st, cam: mode }, st, camera, lastReach);
  present(1.0, 0);
};
window.events = () => {
  const ev = { duration: frames.length / FPS, steps: [], rimTouch: [], slam: [], bounces: [], swish: [], cuts: [], freezes: [], whoosh: [] };
  let vt = 0, prev = null;
  SEQ.forEach((s) => {
    const live = s.freeze === undefined, n = live ? Math.round((s.to - s.from) / s.rate * FPS) : Math.round(s.dur * FPS), v0 = vt;
    if (prev && (prev.cam !== s.cam || prev.rep !== s.rep) && !s.card && !prev.card) ev.cuts.push({ t: v0 });
    if (!live && !s.card) ev.freezes.push({ t: v0 });
    if (live) {
      const rep = reps[s.rep];
      const push = (arr, st, extra = {}) => { if (st >= s.from && st < s.to) arr.push({ t: v0 + (st - s.from) / s.rate, rate: s.rate, ...extra }); };
      for (const f of rep.footfalls) push(ev.steps, f.t, { gain: f.gain, plant: !!f.plant });
      push(ev.whoosh, rep.k.off - 0.02);
      if (rep.plan.kind === 'touch') push(ev.rimTouch, rep.touch.t);
      else { push(ev.slam, rep.d.rel + 0.01); push(ev.swish, rep.d.rel + 0.03); for (const b of rep.flight.bounces) push(ev.bounces, b.t, { gain: Math.min(1, b.v / 7) }); }
    }
    vt += n / FPS; prev = s;
  });
  return ev;
};
window.reps = reps; window.player = player; window.hud = hud;
window.__ready = true;
