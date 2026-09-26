// three.js scene: rigged body (glTF), retargeting from the control skeleton, props, camera, lights,
// live view and thumbnail rendering. Mirrors MotionScene.swift + SkinnedFigure.swift + MotionView.swift,
// including the studio environment map and the muscle-region shader.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { Pose, Skeleton, Side, orthonormalized, qFromBasis, Vec as V, deg } from './skeleton.js?v=6';
import { makeProp } from './props.js?v=6';
import { motionSpec, effectiveHandCurl } from './library.js?v=6';
import { MUSCLE_BIT, GROUP_OF_ID } from './muscles.js?v=6';

// ---- shared assets (fetched once; each figure parses its own copy of the glTF)
// The body ships as glTF JSON with a base64 buffer (hosts only serve standard web types). Decoding the
// buffer here and packing a GLB in memory means the loader never has to fetch a data: URL.
function jsonToGlb(text) {
  const json = JSON.parse(text);
  const uri = json.buffers[0].uri || '';
  const bin = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), c => c.charCodeAt(0));
  delete json.buffers[0].uri; json.buffers[0].byteLength = bin.length;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad4 = n => (4 - (n % 4)) % 4;
  const jsonPad = pad4(jsonBytes.length), binPad = pad4(bin.length);
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
  const buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  let o = 12;
  dv.setUint32(o, jsonBytes.length + jsonPad, true); dv.setUint32(o + 4, 0x4E4F534A, true); o += 8;
  u8.set(jsonBytes, o); o += jsonBytes.length; for (let i = 0; i < jsonPad; i++) u8[o++] = 0x20;
  dv.setUint32(o, bin.length + binPad, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8;
  u8.set(bin, o);
  return buf;
}
// bump when any file in assets/ changes: browsers and the artifact CDN cache the plain URLs aggressively
const ASSET_V = '6';
let assetsPromise = null;
export function loadAssets(base = './assets/') {
  if (assetsPromise) return assetsPromise;
  const tex = (url, filter) => new Promise((res, rej) => new THREE.TextureLoader().load(url, t => {
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false;
    t.magFilter = filter; t.minFilter = filter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; res(t);
  }, undefined, rej));
  assetsPromise = (async () => {
    const [glb, bones, mask] = await Promise.all([
      fetch(base + 'body.gltf.json?v=' + ASSET_V).then(r => { if (!r.ok) throw new Error('body.gltf.json ' + r.status); return r.text(); }).then(jsonToGlb),
      fetch(base + 'bones.json?v=' + ASSET_V).then(r => r.json()),
      tex(base + 'mask.png?v=' + ASSET_V, THREE.NearestFilter),
    ]);
    let detail = null;
    try { detail = await tex(base + 'detail.jpg?v=' + ASSET_V, THREE.LinearFilter); detail.generateMipmaps = true; detail.minFilter = THREE.LinearMipmapLinearFilter; } catch (e) { detail = null; }
    return { glb, bones, mask, detail };
  })();
  return assetsPromise;
}

// ---- studio environment (port of MotionScene.studioEnvironment): dark floor, soft grey sky, key + rim softboxes
function studioEnvironmentTexture() {
  const w = 256, h = 128, data = new Uint8Array(w * h * 4);
  const softbox = (az, el, cx, cy, halfW, halfH) => {
    let dx = Math.abs(az - cx); if (dx > Math.PI) dx = 2 * Math.PI - dx;
    const dy = Math.abs(el - cy);
    const fx = Math.max(0, 1 - Math.max(0, dx - halfW) / 0.25), fy = Math.max(0, 1 - Math.max(0, dy - halfH) / 0.15);
    return fx * fy;
  };
  const keyDir = V(-2.0, 4.5, 4.0).normalize(), rimDir = V(0.5, 3.5, -4.5).normalize();
  const keyAz = Math.atan2(keyDir.x, keyDir.z), keyEl = Math.asin(keyDir.y);
  const rimAz = Math.atan2(rimDir.x, rimDir.z), rimEl = Math.asin(rimDir.y);
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h, theta = (v - 0.5) * Math.PI;          // row 0 = bottom (dir.y = -1)
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w, phi = (u - 0.5) * 2 * Math.PI;      // three.js equirect: u = atan2(z, x)
      const dir = V(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
      const az = Math.atan2(dir.x, dir.z), el = theta;
      const t = el / (Math.PI / 2);
      let r, g, b;
      if (t >= 0) { r = 0.30 + 0.28 * t; g = 0.31 + 0.30 * t; b = 0.35 + 0.34 * t; }
      else { const k = -t; r = 0.30 - 0.26 * k; g = 0.31 - 0.27 * k; b = 0.35 - 0.31 * k; }
      const key = softbox(az, el, keyAz, keyEl, 0.45, 0.28) * 0.9;
      const rim = softbox(az, el, rimAz, rimEl, 0.35, 0.2) * 0.5;
      r = Math.min(1, r + key + rim * 0.85); g = Math.min(1, g + key + rim * 0.9); b = Math.min(1, b + key + rim);
      const o = (j * w + i) * 4;
      data[o] = r * 255; data[o + 1] = g * 255; data[o + 2] = b * 255; data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function configureRenderer(renderer) {
  renderer.toneMapping = THREE.NoToneMapping;          // SceneKit (wantsHDR = false) does no tone mapping either
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function environmentFor(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(studioEnvironmentTexture()).texture;
  pmrem.dispose();
  return env;
}

// ---- Skinned figure
const MAPPING = [
  ['pelvis', 'pelvis', V(0, 1, 0)], ['spine', 'spine_01', V(0, 1, 0)], ['chest', 'spine_03', V(0, 1, 0)],
  ['neck', 'neck_01', V(0, 1, 0)], ['head', 'head', V(0, 1, 0)],
  ['shoulderL', 'upperarm_l', V(0, -1, 0)], ['elbowL', 'lowerarm_l', V(0, -1, 0)], ['wristL', 'hand_l', V(0, -1, 0)],
  ['shoulderR', 'upperarm_r', V(0, -1, 0)], ['elbowR', 'lowerarm_r', V(0, -1, 0)], ['wristR', 'hand_r', V(0, -1, 0)],
  ['hipL', 'thigh_l', V(0, -1, 0)], ['kneeL', 'calf_l', V(0, -1, 0)], ['hipR', 'thigh_r', V(0, -1, 0)], ['kneeR', 'calf_r', V(0, -1, 0)],
];
const IDENTITY_MAPPED = [['ankleL', 'foot_l'], ['ankleR', 'foot_r']];

function setWorldQuaternion(obj, q) {
  const pq = new THREE.Quaternion();
  obj.parent.updateWorldMatrix(true, false);
  obj.parent.getWorldQuaternion(pq);
  obj.quaternion.copy(pq.invert().multiply(q)).normalize();
  obj.updateMatrixWorld(true);
}

export class SkinnedFigure {
  static async create(assets) {
    const gltf = await new GLTFLoader().parseAsync(assets.glb.slice(0), '');
    return new SkinnedFigure(gltf, assets);
  }

  constructor(gltf, assets) {
    this.root = new THREE.Group();
    const model = gltf.scene;
    const info = assets.bones;
    const pelvisY = info.pelvis.head[1];
    this.scale = Skeleton.pelvisHeight / pelvisY;
    model.scale.setScalar(this.scale);
    this.root.add(model);
    this.root.updateMatrixWorld(true);

    this.bones = {};
    model.traverse(o => { if (o.isBone || info[o.name]) this.bones[o.name] = o; });
    this.bindQ = {}; this.bindHead = {}; this.bindDir = {}; this.align = {}; this.palm = {};
    for (const name in this.bones) {
      const b = this.bones[name];
      this.bindQ[name] = new THREE.Quaternion(); b.getWorldQuaternion(this.bindQ[name]);
      const d = info[name];
      if (d) {
        const h = V(d.head[0], d.head[1], d.head[2]).multiplyScalar(this.scale);
        const t = V(d.tail[0], d.tail[1], d.tail[2]).multiplyScalar(this.scale);
        this.bindHead[name] = h; this.bindDir[name] = t.clone().sub(h).normalize();
      }
    }
    this.pelvisBindWorld = new THREE.Vector3(); this.bones.pelvis.getWorldPosition(this.pelvisBindWorld);
    this.applyOrder = [];
    for (const [joint, bone, rest] of MAPPING) {
      if (!this.bindDir[bone]) continue;
      this.align[bone] = new THREE.Quaternion().setFromUnitVectors(this.bindDir[bone], rest);
      this.applyOrder.push([joint, bone]);
    }
    for (const [joint, bone] of IDENTITY_MAPPED) { this.align[bone] = new THREE.Quaternion(); this.applyOrder.push([joint, bone]); }
    for (const s of Side.both) this._calibrateHand(s);
    this.grips = {};
    this._buildGrips();
    this._setupMaterial(model, assets);
    this.apply(Pose.standing(), 0.3);
  }

  _calibrateHand(side) {
    const s = side.name.toLowerCase(); const hand = 'hand_' + s;
    const handDir = this.bindDir[hand], handHead = this.bindHead[hand];
    const idx = this.bindHead['index_01_' + s], pinky = this.bindHead['pinky_01_' + s], thumb = this.bindHead['thumb_01_' + s];
    if (!handDir || !idx || !pinky || !thumb) return;
    const lateral = orthonormalized(idx.clone().sub(pinky), handDir, V(side.sign, 0, 0));
    let n = new THREE.Vector3().crossVectors(lateral, handDir).normalize();
    const thumbOff = thumb.clone().sub(handHead);
    const thumbPalmar = thumbOff.clone().sub(handDir.clone().multiplyScalar(thumbOff.dot(handDir))).dot(n);
    if (thumbPalmar < 0) n.negate();
    this.palm[side.name] = n;
    const fingersRest = V(0, -1, 0);
    const a = this.align[hand];
    const p0 = orthonormalized(n.clone().applyQuaternion(a), fingersRest, V(0, 0, 1));
    const target = V(0, 0, 1);
    const angle = Math.atan2(new THREE.Vector3().crossVectors(p0, target).dot(fingersRest), Math.max(-1, Math.min(1, p0.dot(target))));
    this.align[hand] = new THREE.Quaternion().setFromAxisAngle(fingersRest, angle).multiply(a).normalize();
  }

  _buildGrips() {
    for (const side of Side.both) {
      const name = side.name === 'L' ? 'hand_l' : 'hand_r';
      const hand = this.bones[name], dir = this.bindDir[name], head = this.bindHead[name], palm = this.palm[side.name];
      if (!hand || !palm) continue;
      const grip = new THREE.Object3D(); grip.name = 'grip.' + side.name;
      hand.add(grip);
      const worldPos = head.clone().add(dir.clone().multiplyScalar(0.072)).add(palm.clone().multiplyScalar(0.012));
      const y = dir.clone().negate();
      const z = orthonormalized(palm, y, V(0, 0, 1));
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      const worldQ = qFromBasis(x, y, z);
      hand.updateWorldMatrix(true, false);
      grip.position.copy(hand.worldToLocal(worldPos.clone()));
      const hq = new THREE.Quaternion(); hand.getWorldQuaternion(hq);
      grip.quaternion.copy(hq.invert().multiply(worldQ));
      this.grips[side.name] = grip;
    }
  }

  gripNode(sideName) { return this.grips[sideName]; }

  _setupMaterial(model, assets) {
    let hasColor = false;
    model.traverse(o => { if (o.isMesh && o.geometry.attributes.color) hasColor = true; });
    this.uniformSets = [];
    const groupOf = o => { for (let n = o; n; n = n.parent) { const m = /^grp_(\d+)_/.exec(n.name || ''); if (m) return +m[1]; } return -1; };
    const make = fixedGroup => this._makeMaterial(assets, hasColor, fixedGroup);
    const shared = make(-1);
    model.traverse(o => { if (o.isMesh) { const g = groupOf(o); o.material = g >= 0 ? make(g) : shared; o.frustumCulled = false; } });
    this.material = shared;
  }

  _makeMaterial(assets, hasColor, fixedGroup) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0, vertexColors: hasColor });
    m.defines = { USE_UV: '' };
    const uniforms = {
      maskTex: { value: assets.mask }, detailTex: { value: assets.detail || assets.mask }, hasDetail: { value: assets.detail ? 1 : 0 },
      highlightBits: { value: 0 }, aoStrength: { value: 0.85 }, groupLUT: { value: GROUP_OF_ID }, fixedGroup: { value: fixedGroup },
    };
    this.uniformSets.push(uniforms);
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D maskTex; uniform sampler2D detailTex; uniform float hasDetail;
          uniform float highlightBits; uniform float aoStrength; uniform int groupLUT[64]; uniform float fixedGroup;
          int fmId; int fmGroup; float fmDetail;`)
        .replace('#include <map_fragment>', `
          fmId = int(texture2D(maskTex, vUv).r * 255.0 + 0.5);
          fmGroup = fixedGroup >= 0.0 ? int(fixedGroup) : ((fmId >= 0 && fmId < 64) ? groupLUT[fmId] : 0);
          fmDetail = (hasDetail > 0.5 && fixedGroup < 0.0) ? texture2D(detailTex, vUv).r : 1.0;
          uint bits = uint(highlightBits);
          bool lit = fmGroup > 0 && fmGroup < 20 && (((bits >> uint(fmGroup)) & 1u) == 1u);
          vec3 base = vec3(0.80, 0.82, 0.86);
          if (fmGroup == 20) base = vec3(0.05, 0.05, 0.06);            // shorts
          else if (fmGroup == 21) base = vec3(0.16, 0.14, 0.13);       // hair
          else if (fmGroup == 22) base = vec3(0.08, 0.09, 0.11);       // eyes
          else if (fmGroup == 30) base = vec3(0.87, 0.84, 0.83);       // skin (écorché head, hands, feet)
          else if (fmGroup == 19) base = vec3(0.86, 0.87, 0.90);       // tendons
          if (lit) base = vec3(0.16, 0.50, 1.0);
          // fibre striations + dark borders come from the detail map (1 = plain surface)
          float shade = mix(0.30, 1.06, fmDetail);
          if (fmGroup == 0 || fmGroup >= 20) shade = mix(0.75, 1.0, fmDetail);
          base *= shade;
          diffuseColor.rgb *= base;
          if (lit) totalEmissiveRadiance += vec3(0.03, 0.14, 0.42) * shade;
        `)
        .replace('#include <color_fragment>', `
          #ifdef USE_COLOR
            diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, aoStrength);
          #endif
        `)
        .replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          if (fmGroup == 20) roughnessFactor = 0.85;
          else if (fmGroup == 21) roughnessFactor = 0.92;
        `);
    };
    m.customProgramCacheKey = () => 'fm-body-v3';
    return m;
  }

  setHighlighted(muscles) {
    let bits = 0;
    for (const mu of muscles) { const b = MUSCLE_BIT[mu]; if (b) bits |= 1 << b; }
    if (muscles.includes('rearDeltoids')) bits |= 1 << MUSCLE_BIT.deltoids;
    for (const u of this.uniformSets) u.highlightBits.value = bits;
  }

  apply(pose, handCurl = 0.3) {
    const t = pose.worldTransforms();
    if (this.bones.pelvis) {
      const p = this.pelvisBindWorld.clone().add(pose.pelvisOffset);
      const parent = this.bones.pelvis.parent; parent.updateWorldMatrix(true, false);
      this.bones.pelvis.position.copy(parent.worldToLocal(p));
    }
    for (const [joint, bone] of this.applyOrder) {
      const node = this.bones[bone]; if (!node) continue;
      const q = t[joint].rotation.clone().multiply(this.align[bone]).multiply(this.bindQ[bone]).normalize();
      setWorldQuaternion(node, q);
    }
    for (const s of Side.both) this._applyFingers(s, handCurl);
    this.root.updateMatrixWorld(true);
  }

  _applyFingers(side, curl) {
    const s = side.name.toLowerCase(); const hand = this.bones['hand_' + s]; const palm = this.palm[side.name];
    if (!hand || !palm) return;
    const hq = new THREE.Quaternion(); hand.getWorldQuaternion(hq);
    const delta = hq.multiply(this.bindQ['hand_' + s].clone().invert()).normalize();
    const c = Math.max(0, Math.min(1, curl));
    const curlChain = (names, closedAngles, openAngles) => {
      let q = new THREE.Quaternion();
      names.forEach((name, i) => {
        const node = this.bones[name], d = this.bindDir[name], bind = this.bindQ[name];
        if (!node || !d) return;
        const axis = new THREE.Vector3().crossVectors(d, palm).normalize();
        const angle = deg(openAngles[i] + (closedAngles[i] - openAngles[i]) * c);
        q = q.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).normalize();
        setWorldQuaternion(node, delta.clone().multiply(q).multiply(bind).normalize());
      });
    };
    for (const f of ['index', 'middle', 'ring', 'pinky']) curlChain([`${f}_01_${s}`, `${f}_02_${s}`, `${f}_03_${s}`], [62, 88, 55], [6, 10, 10]);
    curlChain([`thumb_01_${s}`, `thumb_02_${s}`, `thumb_03_${s}`], [28, 40, 30], [4, 4, 4]);
  }
}

// ---- Scene
export class MotionScene {
  static async create(assets, opts) { return new MotionScene(await SkinnedFigure.create(assets), opts); }

  constructor(figure, { zoomOut = 1, shift = 0 } = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.figure = figure;
    this.scene.add(this.figure.root);
    this.propRoot = new THREE.Group(); this.scene.add(this.propRoot);
    this.props = [];
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.zoomOut = zoomOut; this.shift = shift;
    this._lights();
    this.spec = null; this.startTime = null; this.phase = 0;
  }
  _lights() {
    const s = this.scene;
    // SceneKit intensities (1000 = 1.0): both engines divide the diffuse by π, so the values carry over directly
    s.add(new THREE.AmbientLight(0xe6edff, 0.09));
    const key = new THREE.DirectionalLight(0xfffcf7, 0.9); key.position.set(-2.0, 4.5, 4.0); s.add(key);
    const fill = new THREE.DirectionalLight(0xd9e6ff, 0.32); fill.position.set(3.5, 2.5, 2.0); s.add(fill);
    const rim = new THREE.DirectionalLight(0xcce0ff, 0.6); rim.position.set(0.5, 3.5, -4.5); s.add(rim);
  }
  setEnvironment(tex) { this.scene.environment = tex; this.scene.environmentIntensity = 1.0; }
  setCamera(c) {
    const az = deg(c.azimuth), el = deg(c.elevation);
    const distance = c.distance * this.zoomOut;
    const target = V(c.lateralOffset || 0, c.targetHeight, 0);
    const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), V(0, 1, 0)).normalize();
    target.add(right.multiplyScalar(this.shift));
    this.camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
    this.camera.lookAt(target);
    this.camera.fov = c.fov || 30; this.camera.updateProjectionMatrix();
  }
  load(spec) {
    this.spec = spec;
    for (const p of this.props) p.remove();
    this.props = spec.props.map(makeProp);
    for (const p of this.props) this.propRoot.add(p.node);
    this.figure.setHighlighted(spec.highlight);
    this.setCamera(spec.camera);
    this.startTime = null;
    this.seek(0);
  }
  loadExercise(id) { this.load(motionSpec(id)); }
  seek(phase) {
    const spec = this.spec; if (!spec) return;
    this.phase = phase;
    const pose = spec.clip.pose(phase);
    this.figure.apply(pose, effectiveHandCurl(spec));
    const fig = this.figure;
    const ctx = {
      pose, phase, time: phase * spec.clip.duration,
      grip: side => { const g = fig.gripNode(side); const p = new THREE.Vector3(); g.getWorldPosition(p); return p; },
      hand: side => { const g = fig.gripNode(side); const q = new THREE.Quaternion(); g.getWorldQuaternion(q);
        return { fingers: V(0, -1, 0).applyQuaternion(q), palm: V(0, 0, 1).applyQuaternion(q), thumb: V(1, 0, 0).applyQuaternion(q) }; },
      attach: (node, side) => { const g = fig.gripNode(side); const sc = new THREE.Vector3(); g.getWorldScale(sc); node.scale.setScalar(1 / Math.max(sc.x, 1e-4)); g.add(node); },
    };
    for (const p of this.props) p.update(ctx);
  }
  update(time) {
    if (!this.spec) return 0;
    if (this.startTime == null) this.startTime = time;
    const t = time - this.startTime;
    const ph = (t % this.spec.clip.duration) / this.spec.clip.duration;
    this.seek(ph);
    return ph;
  }
}

// ---- Live view (the session screen)
export class LiveView {
  static async create(canvas, assets) {
    const scene = await MotionScene.create(assets, { zoomOut: 1.0, shift: 0.05 });
    return new LiveView(canvas, scene);
  }
  constructor(canvas, scene) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    configureRenderer(this.renderer);
    this.scene = scene;
    this.scene.setEnvironment(environmentFor(this.renderer));
    this.canvas = canvas; this.running = false; this.exerciseId = null; this.fadeStart = 0;
    this._resize();
    this._onResize = () => this._resize(); window.addEventListener('resize', this._onResize);
  }
  _resize() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.scene.camera.aspect = w / h; this.scene.camera.updateProjectionMatrix();
  }
  show(exerciseId) {
    if (exerciseId === this.exerciseId) return;
    this.exerciseId = exerciseId;
    this.scene.loadExercise(exerciseId);
    this.fadeStart = performance.now();
  }
  start() {
    if (this.running) return; this.running = true;
    const loop = now => {
      if (!this.running) return;
      this.scene.update(now / 1000);
      const f = Math.min(1, (now - this.fadeStart) / 450);      // reference-style fade-in when switching exercises
      this.canvas.style.opacity = (0.06 + 0.94 * f).toFixed(3);
      this.renderer.render(this.scene.scene, this.scene.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }
  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}

// ---- Thumbnails (list rows, strip, home anatomy figures)
export class ThumbnailRenderer {
  static async create(assets) { return new ThumbnailRenderer(await MotionScene.create(assets)); }
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    configureRenderer(this.renderer);
    this.scene = scene;
    this.scene.setEnvironment(environmentFor(this.renderer));
    this.cache = new Map();
    this.queue = []; this.busy = false;
    try { const c = JSON.parse(localStorage.getItem('fm.thumbs.v7') || '{}'); for (const k in c) this.cache.set(k, c[k]); } catch (e) {}
  }
  _render(spec, phase, w, h, zoom) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.scene.camera.aspect = w / h;
    this.scene.zoomOut = 1 / zoom; this.scene.shift = 0;
    this.scene.load(spec);
    this.scene.seek(phase);
    this.renderer.render(this.scene.scene, this.scene.camera);
    return this.canvas.toDataURL('image/png');
  }
  exercise(id, size = 160) {
    const key = `${id}@${size}`;
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    return this._enqueue(key, () => this._render(motionSpec(id), 0.42, size, size, 1.28));
  }
  anatomy(spec, w, h) {
    const key = `anatomy@${w}x${h}@${spec.highlight.slice().sort().join(',')}@${spec.camera.azimuth}@${spec.tint || ''}`;
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    return this._enqueue(key, () => this._render(spec, 0, w, h, 1.0));
  }
  _enqueue(key, fn) {
    return new Promise(resolve => {
      this.queue.push({ key, fn, resolve });
      if (!this.busy) this._pump();
    });
  }
  _pump() {
    const job = this.queue.shift();
    if (!job) { this.busy = false; this._persist(); return; }
    this.busy = true;
    requestAnimationFrame(() => {
      let url = this.cache.get(job.key);
      if (!url) { url = job.fn(); this.cache.set(job.key, url); }
      job.resolve(url);
      this._pump();
    });
  }
  _persist() {
    // keep small thumbnails across reloads (best effort; the quota is a few MB)
    try {
      const out = {}; let bytes = 0;
      for (const [k, v] of this.cache) { if (k.includes('@128') || k.includes('@144') || k.includes('@168')) { out[k] = v; bytes += v.length; } if (bytes > 3_500_000) break; }
      localStorage.setItem('fm.thumbs.v7', JSON.stringify(out));
    } catch (e) {}
  }
}
