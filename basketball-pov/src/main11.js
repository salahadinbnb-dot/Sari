// v11 "behind the curtain": the v5 film-room page (practice gym, anatomical skeletons, freezes, slow motion, rim cut)
// on the v11 reps - one new move at rep 1, 3 and 6, then live. Each rep plays as it looks in the gym; then the
// picture splits down the middle and slides apart like a curtain onto the same rep, dark, with what he's running
// drawn over it in light: the two players as lines, the ball, a beam from his eyes to what he's watching, rep 1's
// ghost racing rep 3, his man's weight, and the options he sees. 1080x1920 at 30 fps with motion blur.
import * as THREE from 'three';
import { buildGym, gymEnvironment } from './gym.js';
import { loadTemplates, makePlayerMesh, Rig } from './player.js';
import { loadClip } from './mocap.js';
import { CLIPS11, REPS, buildRep } from './play11.js';
import { Rep, RIM } from './rep5.js';
import { buildTimeMap, FPS, SEQ } from './timeline11.js';
import { makeBall } from './ball.js';
import { Cam5 } from './camera5.js';
import { loadBones, makeBoneSkeleton, makeShoes } from './boneskel.js';
import { Hud11, INTRO } from './hud11.js';
import { clamp, smooth } from './motion.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const SUB = q.has('sub') ? +q.get('sub') : 2;
// (built taller than they read: in their relaxed stance the skeletons stand about 6'5" to the top of the skull)
const SPECS = { you: { model: '04', tex: 'you', height: 2.125 }, d1: { model: '03', tex: 'd1', height: 2.135 } };
const CARDS = {
  intro: INTRO,
  night: `<div class="moon"></div><div class="k">THAT NIGHT</div><div class="h" style="font-size:120px">HE SLEEPS<br>ON IT</div>
    <div class="p">In one classic study, people tapped a practiced<br>sequence <b>about 20% faster</b> after a night's sleep,<br>with no more practice. Later reviews find less<br>than that: sleep may mostly help it stick.</div>
    <div class="cite">Walker et al. 2002, Neuron 35:205 · Pan & Rickard 2015, Psychol Bull 141:812</div>`,
  outro: `<div class="big">Slow it down<br>to <em>learn</em> it.</div><div class="big" style="margin-top:34px">Fix <em>one thing</em><br>a rep.</div><div class="big" style="margin-top:34px">Eyes off<br>the <em>ball.</em></div><div class="big" style="margin-top:34px">Then <em>mix</em><br>the pieces.</div>
    <div class="src">Stages of learning (cognitive, associative, autonomous): Fitts & Posner 1967, Human Performance · Steps fusing into chunks with practice: Sakai, Kitaguchi<br>& Hikosaka 2003, Exp Brain Res 152:229 · Sleep: Walker et al. 2002, Neuron 35:205; Pan & Rickard 2015, Psychol Bull 141:812 · Motion: CMU Graphics Lab Motion Capture Database</div>`,
};

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
  const clips = {}; for (const c of CLIPS11) clips[c] = await loadClip(c);
  const legOf = (r) => r.len.thigh + r.len.calf;
  const legs = { you: legOf(players.you.rig), d1: legOf(players.d1.rig) };
  const rigs = { you: players.you.rig, d1: players.d1.rig };
  const reps = {};
  for (const name of Object.keys(REPS)) reps[name] = new Rep(name, buildRep(name, clips, legs), rigs, clips, { ...REPS[name].plan, simEnd: REPS[name].simEnd });
  // closest-defender distance at the release, in feet
  for (const rep of Object.values(reps)) { const P = rep.plan; P.vals = { ...(P.vals || {}), sep: (rep.frame('you', P.release).p.distanceTo(rep.frame('d1', P.release).p) / 0.3048).toFixed(1) }; }
  const ball = makeBall(scene);
  const cam = new Cam5(reps);
  const camera = new THREE.PerspectiveCamera(54, W / H, 0.05, 120);
  const frames = buildTimeMap(reps, FPS);
  const hud = new Hud11(document.getElementById('hud'), reps, frames, FPS, CARDS);
  const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
  const rtScene = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: q.has('nomsaa') ? 0 : 4 });
  const rtAccum = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType });
  window.__frames = frames.length; window.__fps = FPS; window.reps = reps;
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
// phone look; behind the curtain (bh) the gym goes dark and cold so the lines drawn over it read; the curtain (op,
// 0..1) splits the real picture down the middle and slides the halves apart over the dark one
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: rtAccum.texture }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, bh: { value: 0 }, op: { value: -1 } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D t; uniform float seed; uniform vec2 res; uniform float bh; uniform float op; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    vec3 real(vec2 uv){ return texture2D(t, uv).rgb * 1.06 + 0.004; }
    vec3 dark(vec2 uv){ vec3 c = texture2D(t, uv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return mix(c, vec3(l), 0.88) * vec3(0.20, 0.30, 0.40) + vec3(0.002, 0.006, 0.012); }
    void main(){
      vec3 c; float seam = 0.0;
      if (op >= 0.0) {
        float s = 0.5 * op * op * (3.0 - 2.0 * op) * 1.02;
        if (vUv.x < 0.5 - s) { c = real(vec2(vUv.x + s, vUv.y)); c *= 1.0 - 0.6 * smoothstep(0.07, 0.0, 0.5 - s - vUv.x) * step(0.001, s); }
        else if (vUv.x > 0.5 + s) { c = real(vec2(vUv.x - s, vUv.y)); c *= 1.0 - 0.6 * smoothstep(0.07, 0.0, vUv.x - 0.5 - s) * step(0.001, s); }
        else c = dark(vUv);
        seam = step(0.001, s) * (exp(-abs(vUv.x - (0.5 - s)) * res.x / 3.0) + exp(-abs(vUv.x - (0.5 + s)) * res.x / 3.0));
      } else c = bh > 0.5 ? dark(vUv) : real(vUv);
      vec2 d = vUv - 0.5; d.x *= res.x / res.y; c *= 1.0 - (0.32 + 0.25 * bh) * smoothstep(0.35, 1.05, length(d) * 1.35);
      c += seam * vec3(0.25, 0.9, 1.0) * 0.9;
      float g = (h(vUv * res) + h(vUv * res + 17.3) - 1.0) * 0.022; c += g * (0.35 + c);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, depthTest: false, depthWrite: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat);
const quadScene = new THREE.Scene(); quadScene.add(quad);

function poseAll(rep, st) {
  const Y = rep.youPose(st); players.you.rig.applyMocap(Y.T, Y.T.src, Y.opt);
  const D = rep.d1Pose(st); players.d1.rig.applyMocap(D.T, D.T.src, D.opt);
  const b = rep.ball(st);
  ball.position.copy(b.pos); ball.quaternion.copy(b.q);
  gym.net.update(b.state === 'net' ? b.netU : (b.state === 'drop' ? 1.2 : 0), b.state === 'net' ? 1 : 0);
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
function present(seed, bh, op) {
  renderer.setRenderTarget(null); quad.material = outMat; Object.assign(outMat.uniforms.seed, { value: seed }); outMat.uniforms.bh.value = bh; outMat.uniforms.op.value = op;
  renderer.render(quadScene, quadCam);
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

// ---- behind the curtain: lines drawn over the dark picture ----
const ov = document.getElementById('ov'), g2 = ov.getContext('2d');
const CY = '62,230,255', CO = '255,107,94', AM = '255,194,58', VI = '190,150,255';
const v3 = new THREE.Vector3();
const scr = (p) => { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, ok: v3.z < 1 }; };
const LIMBS = [['Head', 'Neck'], ['Neck', 'Spine2'], ['Spine2', 'Spine1'], ['Spine1', 'Spine'], ['Spine', 'Pelvis'],
  ['Neck', 'L_UpperArm'], ['L_UpperArm', 'L_Forearm'], ['L_Forearm', 'L_Hand'], ['Neck', 'R_UpperArm'], ['R_UpperArm', 'R_Forearm'], ['R_Forearm', 'R_Hand'],
  ['Pelvis', 'L_Thigh'], ['L_Thigh', 'L_Calf'], ['L_Calf', 'L_Foot'], ['Pelvis', 'R_Thigh'], ['R_Thigh', 'R_Calf'], ['R_Calf', 'R_Foot']];
function joints(rig) {
  const J = {};
  for (const n of ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Pelvis', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot']) J[n] = rig.b[n].getWorldPosition(new THREE.Vector3());
  // the skull's middle sits about 10 cm over the head bone; toes ahead of the ankles
  J.skull = J.Head.clone().add(new THREE.Vector3(0, 0.1, 0));
  return J;
}
function figure(J, rgb, a, wid = 7, dash = null) {
  g2.save(); g2.lineCap = 'round'; g2.lineJoin = 'round'; g2.strokeStyle = `rgba(${rgb},${a})`; g2.lineWidth = wid; g2.shadowColor = `rgba(${rgb},${0.9 * a})`; g2.shadowBlur = 22;
  if (dash) g2.setLineDash(dash);
  g2.beginPath();
  for (const [p, c] of LIMBS) { const A = scr(J[p]), B = scr(J[c]); g2.moveTo(A.x, A.y); g2.lineTo(B.x, B.y); }
  g2.stroke();
  const s = scr(J.skull), e = scr(J.skull.clone().add(new THREE.Vector3(0, 0.11, 0)));
  g2.beginPath(); g2.arc(s.x, s.y, Math.abs(e.y - s.y), 0, Math.PI * 2); g2.stroke();
  g2.restore();
}
function glowDot(p, r, rgb, a = 1) {
  const s = scr(p); const gr = g2.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.4);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.4, `rgba(${rgb},${0.55 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g2.fillStyle = gr; g2.beginPath(); g2.arc(s.x, s.y, r * 2.4, 0, Math.PI * 2); g2.fill();
  return s;
}
function chip(x, y, text, rgb, dark = '#021a20', size = 34, align = 'center') {
  g2.save(); g2.font = `900 ${size}px BC`; const w = g2.measureText(text).width + 28, h = size + 14;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g2.shadowColor = `rgba(${rgb},0.7)`; g2.shadowBlur = 24; g2.fillStyle = `rgb(${rgb})`; g2.fillRect(x0, y - h / 2, w, h);
  g2.shadowBlur = 0; g2.fillStyle = dark; g2.textBaseline = 'middle'; g2.fillText(text, x0 + 14, y + 2); g2.restore();
  return { x0, w, h };
}
// a beam of attention: from his eyes to what he's watching, widening as it goes, a ring on the target - or, when the
// target is out of the picture (the rim, from the side), an arrowhead where the beam leaves it
function beam(from, to, label, rgb, a) {
  const A = scr(from); let B = scr(to); const X0 = 60, X1 = W - 60, Y0 = 520, Y1 = H - 520;
  let k = 1; const dx0 = B.x - A.x, dy0 = B.y - A.y;
  if (B.x > X1) k = Math.min(k, (X1 - A.x) / dx0); if (B.x < X0) k = Math.min(k, (X0 - A.x) / dx0);
  if (B.y < Y0) k = Math.min(k, (Y0 - A.y) / dy0); if (B.y > Y1) k = Math.min(k, (Y1 - A.y) / dy0);
  const out = k < 1; if (out) B = { x: A.x + dx0 * Math.max(0, k), y: A.y + dy0 * Math.max(0, k) };
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, ux = dx / L, uy = dy / L;
  const gr = g2.createLinearGradient(A.x, A.y, B.x, B.y); gr.addColorStop(0, `rgba(${rgb},${0.85 * a})`); gr.addColorStop(1, `rgba(${rgb},${0.28 * a})`);
  g2.save(); g2.fillStyle = gr; g2.shadowColor = `rgba(${rgb},${0.8 * a})`; g2.shadowBlur = 30; g2.beginPath(); g2.moveTo(A.x + nx * 5, A.y + ny * 5); g2.lineTo(B.x + nx * 38, B.y + ny * 38); g2.lineTo(B.x - nx * 38, B.y - ny * 38); g2.lineTo(A.x - nx * 5, A.y - ny * 5); g2.closePath(); g2.fill();
  g2.strokeStyle = `rgba(${rgb},${a})`; g2.fillStyle = `rgba(${rgb},${a})`; g2.lineWidth = 5; g2.shadowColor = `rgba(${rgb},${a})`; g2.shadowBlur = 20;
  if (out) { g2.beginPath(); g2.moveTo(B.x + ux * 46, B.y + uy * 46); g2.lineTo(B.x + nx * 34, B.y + ny * 34); g2.lineTo(B.x - nx * 34, B.y - ny * 34); g2.closePath(); g2.fill(); }
  else { g2.beginPath(); g2.arc(B.x, B.y, 40, 0, Math.PI * 2); g2.stroke(); }
  g2.restore();
  // the label sits under the target, kept inside the frame
  g2.globalAlpha = a; g2.font = '900 34px BC'; const w = g2.measureText(label).width + 28;
  chip(clamp(B.x, 40 + w / 2, W - 40 - w / 2), B.y + 78, label, rgb); g2.globalAlpha = 1;
}
// where his eyes are, by rep: on the ball while he's thinking it through; coming up as it wires; on his man's hips
// once it's one chunk; live, on his man, then the rim to sell the fake
function eyesOn(rep, st, Jd, ballP) {
  const P = rep.plan, Q = P.parts, hips = Jd.Pelvis.clone().add(new THREE.Vector3(0, 0.05, 0)), rim = new THREE.Vector3(RIM.x, RIM.y, RIM.z);
  const blend = (a, b, u) => ({ p: a.p.clone().lerp(b.p, u), label: u < 0.5 ? a.label : b.label });
  const BALL = { p: ballP, label: 'EYES: BALL' }, HIPS = { p: hips, label: 'EYES: HIS HIPS' }, RIMT = { p: rim, label: 'EYES: RIM' }, SELL = { p: rim, label: 'EYES: RIM (SELLING IT)' };
  // (everyone looks at the rim to shoot: from the gather on)
  const shot = smooth((st - (P.gatherAt - 0.05)) / 0.2);
  if (rep.name === 'rep1') return blend(BALL, RIMT, shot);
  if (rep.name === 'rep3') return blend(blend(BALL, HIPS, smooth((st - Q.back) / 0.3)), RIMT, shot);
  if (rep.name === 'rep6') return blend(HIPS, RIMT, shot);
  // live: on his man through the move and the read, then the rim - to sell the fake, then to shoot
  return blend(HIPS, st < Q.fake + 0.2 ? SELL : RIMT, smooth((st - (Q.fake - 0.35)) / 0.2));
}
function overlay(rep, fr, st, a) {
  g2.clearRect(0, 0, W, H);
  if (a <= 0) return;
  poseAll(rep, st);
  const Jy = joints(players.you.rig), Jd = joints(players.d1.rig), bp = rep.ball(st).pos.clone();
  g2.globalAlpha = 1;
  // rep 1's ghost, at this same moment of its rep, racing rep 3
  if (fr.show === 'ghost') {
    const G = reps.rep1, Y = G.youPose(st); players.you.rig.applyMocap(Y.T, Y.T.src, Y.opt); players.you.root.updateMatrixWorld(true);
    const Jg = joints(players.you.rig); figure(Jg, VI, 0.7 * a, 6, [14, 12]);
    const s = scr(Jg.skull); g2.globalAlpha = 0.9 * a; chip(s.x, s.y - 92, 'REP 1, SAME MOMENT', VI, '#140530', 28); g2.globalAlpha = 1;
    poseAll(rep, st);
  }
  figure(Jd, CO, 0.85 * a, 7);
  figure(Jy, CY, a, 8);
  glowDot(bp, 22, AM, a);
  // his man's weight, live: how fast he's coming at you - an arrow along the floor from him toward you
  if (fr.show === 'read' || fr.show === 'options') {
    const dp = rep.frame('d1', st).p.clone(), yp = rep.frame('you', st).p.clone(), to = yp.clone().sub(dp).setY(0), dist = to.length(); to.normalize();
    const v = rep.frame('d1', st + 0.05).p.clone().sub(rep.frame('d1', st - 0.05).p).multiplyScalar(10).setY(0), at = Math.max(0, v.dot(to));
    const base = dp.clone().setY(0.03), tip = base.clone().addScaledVector(to, Math.min(dist - 0.35, 0.25 + at * 0.3));
    const A = scr(base), B = scr(tip), ang = Math.atan2(B.y - A.y, B.x - A.x);
    g2.save(); g2.globalAlpha = a; g2.strokeStyle = `rgb(${CO})`; g2.fillStyle = `rgb(${CO})`; g2.lineWidth = 12; g2.shadowColor = `rgb(${CO})`; g2.shadowBlur = 24;
    g2.beginPath(); g2.moveTo(A.x, A.y); g2.lineTo(B.x, B.y); g2.stroke();
    g2.beginPath(); g2.moveTo(B.x + Math.cos(ang) * 30, B.y + Math.sin(ang) * 30); g2.lineTo(B.x + Math.cos(ang + 2.3) * 30, B.y + Math.sin(ang + 2.3) * 30); g2.lineTo(B.x + Math.cos(ang - 2.3) * 30, B.y + Math.sin(ang - 2.3) * 30); g2.fill();
    g2.restore();
    const hp = scr(Jd.Pelvis), text = `HIS WEIGHT: ${at.toFixed(1)} M/S AT YOU`; g2.font = '900 30px BC'; const w = g2.measureText(text).width + 28;
    g2.globalAlpha = a; chip(clamp(hp.x + 60 + w / 2, 40 + w / 2, W - 40 - w / 2), hp.y - 140, text, CO, '#2a0400', 30); g2.globalAlpha = 1;
  }
  // the options he sees as his man comes at him
  if (fr.show === 'options') {
    g2.globalAlpha = a;
    chip(W / 2, H - 520, 'SHOOT IT?  HE\'S RIGHT THERE  ✕', CO, '#2a0400', 40);
    chip(W / 2, H - 450, 'SELL IT, LET HIM FLY BY  ✓', AM, '#1a1200', 40);
    g2.globalAlpha = 1;
  }
  // his eyes
  const E = eyesOn(rep, st, Jd, bp), eye = Jy.skull.clone().add(new THREE.Vector3(0, 0.02, 0));
  beam(eye, E.p, E.label, CY, a);
}

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
  const op = fr.curtain !== null && fr.curtain !== undefined ? clamp((fr.curtain - 0.08) / 0.7, 0, 1) : -1;
  present(i * 0.618, fr.behind ? 1 : 0, op);
  // the lines: in the gap the curtain has opened, then everywhere behind it
  const a = fr.card ? 0 : (op >= 0 ? smooth((op - 0.3) / 0.5) : (fr.behind ? 1 : 0));
  const half = op >= 0 ? 50 * (1 - (op * op * (3 - 2 * op)) * 1.02) : 0;
  ov.style.clipPath = op >= 0 ? `inset(0 ${Math.max(0, half)}% 0 ${Math.max(0, half)}%)` : 'none';
  overlay(rep, fr, fr.st, a);
  hud.update(fr, fr.st);
  return performance.now() - t0;
};
// stills for checks: renderSim(rep, st, mode, behind, show) with the HUD as it would be in the nearest frame of that rep
window.renderSim = (name, st, mode = 'duel', behind = false, show = undefined) => {
  const rep = reps[name];
  renderer.setRenderTarget(rtAccum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let k = 0; k < SUB; k++) renderSub(rep, mode, st, k, k === 0);
  cached = null;
  let best = null; for (const f of frames) if (f.rep === name && !f.card && f.behind === behind && f.curtain === null && (!best || Math.abs(f.st - st) < Math.abs(best.st - st))) best = f;
  const fr = { ...(best || frames[0]), st, cam: mode, behind, show: show ?? best?.show, curtain: null };
  present(1.0, behind ? 1 : 0, -1); ov.style.clipPath = 'none';
  overlay(rep, fr, st, behind ? 1 : 0);
  hud.update(fr, st);
};
window.events = () => {
  const ev = { duration: frames.length / FPS, bounces: [], catches: [], swish: [], releases: [], squeaks: [], cuts: [], board: [], thuds: [], whistles: [], freezes: [], rims: [], curtains: [] };
  let vt = 0, prev = null;
  SEQ.forEach((s, k) => {
    const live = s.freeze === undefined, n = live ? Math.round((s.to - s.from) / s.rate * FPS) : Math.round(s.dur * FPS), v0 = vt;
    if (prev && (prev.cam !== s.cam || prev.rep !== s.rep) && !s.card && !prev.card && !s.curtain) ev.cuts.push({ t: v0 });
    if (s.curtain) ev.curtains.push({ t: v0 + 0.1 });
    else if (!live && !s.card && s.behind) ev.freezes.push({ t: v0 });
    if (live) {
      const rep = reps[s.rep], P = rep.plan;
      const push = (arr, st, extra = {}) => { if (st >= s.from && st < s.to) arr.push({ t: v0 + (st - s.from) / s.rate, rate: s.rate, ...extra }); };
      for (const f of rep.flights) push(ev.bounces, f.tb, { gain: 0.95 });
      if (P.miss) {
        rep.ball(P.rim + 0.01); push(ev.rims, P.rim);
        for (const h of rep._miss.hits) push(ev.bounces, h.t, { gain: 0.85 * Math.min(1, h.v / 5) });
      } else {
        let py = RIM.y - 0.54, vy = -1.9, t = P.netEnd; const G = 9.81, R = 0.12;
        for (let j = 0; j < 6; j++) { const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (py - R))) / G; t += tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = R; if (vy < 0.35) break; push(ev.bounces, t, { gain: 0.85 * Math.min(1, Math.abs(vHit) / 6) }); }
        push(ev.swish, P.rim + 0.03);
      }
      push(ev.catches, P.gatherAt, { gain: 0.8 });
      push(ev.releases, P.release, { gain: 0.7 });
      for (const tr of [rep.tracks.you, rep.tracks.d1]) for (const sg of tr.segs.slice(1)) push(ev.squeaks, sg.at + 0.05, { gain: 0.8 });
      if (P.takeoff) push(ev.squeaks, P.takeoff - 0.04, { gain: 0.7 });
    }
    vt += n / FPS; prev = s;
  });
  return ev;
};

// first draws compile programs and allocate shadow maps (and log a GL warning once): do that before any real frame
renderSub(Object.values(reps)[0], 'duel', 0.5, 0, true); present(0, 0, -1);
window.__ready = true;
