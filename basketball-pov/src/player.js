// Loads Rocketbox athletes, clones them per player, applies per-player uniforms, and exposes a Rig for posing.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function tex(url, srgb = true) {
  if (texCache.has(url)) return texCache.get(url);
  const t = texLoader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  texCache.set(url, t);
  return t;
}

export async function loadTemplates(ids) {
  const out = {};
  for (const id of ids) {
    const mgr = new THREE.LoadingManager();
    mgr.setURLModifier(u => (/\.(tga|png|jpg)$/i.test(u) && !u.includes('/assets/')) ? '/assets/raw/m04/body_specular.jpg' : u);
    const obj = await new FBXLoader(mgr).loadAsync(`/assets/raw/m${id}/model.fbx`);
    obj.traverse(o => { if (o.isLight) o.visible = false; });
    out[id] = obj;
  }
  return out;
}

// spec: { model:'04', tex:'you' (folder under assets/players), height: 1.98 }
export function makePlayerMesh(templates, spec) {
  const root = SkeletonUtils.clone(templates[spec.model]);
  const k = 0.01 * (spec.height / 1.81);
  root.scale.setScalar(k);
  const base = `/assets/players/${spec.tex}/`;
  root.traverse(o => {
    if (o.isLight) o.parent && o.parent.remove(o);
    if (!o.isSkinnedMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map(m => {
      const n = m.name.toLowerCase();
      const part = n.includes('head') ? 'head' : n.includes('opacity') ? 'opacity' : 'body';
      const mat = new THREE.MeshStandardMaterial({ name: m.name });
      if (part === 'opacity') {
        mat.map = tex(`/assets/players/${spec.tex}/opacity_color.png`);
        mat.alphaTest = 0.45; mat.side = THREE.DoubleSide; mat.roughness = 0.7;
      } else {
        mat.map = tex(base + `${part}_color.jpg`);
        mat.normalMap = tex(spec.model !== '04' && part === 'body' ? `/assets/players/${spec.tex}/body_normal.jpg` : `/assets/raw/m${spec.model}/${part}_normal.png`, false);
        mat.normalScale = new THREE.Vector2(1, 1);
        mat.roughnessMap = tex(`/assets/players/${spec.tex}/${part}_rough.jpg`, false);
        mat.roughness = 1.0;
      }
      mat.envMapIntensity = 0.55;
      return mat;
    });
  });
  return { root, k };
}

// ---------- Rig: procedural posing with 2-bone IK on the Biped skeleton ----------
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

function frameQuat(along, ref) {
  // orthonormal frame with columns (along, ref', along x ref') -> quaternion
  const a = along.clone().normalize();
  const r = ref.clone().addScaledVector(a, -ref.dot(a)).normalize();
  const c = new THREE.Vector3().crossVectors(a, r);
  _m.makeBasis(a, r, c);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}
// rotation that takes frame(a0,r0) to frame(a1,r1)
export function alignQuat(a0, r0, a1, r1) {
  const q0 = frameQuat(a0, r0), q1 = frameQuat(a1, r1);
  return q1.multiply(q0.invert());
}

export class Rig {
  constructor(root, k) {
    this.root = root; this.k = k;
    this.b = {};
    root.traverse(o => { if (o.isBone) this.b[o.name.replace('Bip01_', '').replace('Bip01', 'Root')] = o; });
    this.restLocal = {};
    for (const [n, bone] of Object.entries(this.b)) this.restLocal[n] = bone.quaternion.clone();
    // rest model-space quaternions (root rotation excluded)
    root.updateMatrixWorld(true);
    this.restModel = {};
    const rootInv = root.quaternion.clone().invert();
    for (const [n, bone] of Object.entries(this.b)) {
      const q = new THREE.Quaternion(); bone.getWorldQuaternion(q);
      this.restModel[n] = rootInv.clone().multiply(q);
    }
    this.len = {
      thigh: this.b.L_Calf.position.length() * k, calf: this.b.L_Foot.position.length() * k,
      upper: this.b.L_Forearm.position.length() * k, fore: this.b.L_Hand.position.length() * k,
    };
    this.restPelvisY = this.b.Root.position.y * k;
    this.W = {}; // world quats computed this frame
    this.P = {}; // world positions computed this frame
  }

  // FK helper: set bone world quaternion (parent must already be solved)
  setWorld(name, qWorld) {
    const bone = this.b[name];
    const parentQ = this.W[this.parentName(name)];
    bone.quaternion.copy(parentQ.clone().invert().multiply(qWorld));
    this.W[name] = qWorld.clone();
    const pp = this.P[this.parentName(name)];
    this.P[name] = pp.clone().add(bone.position.clone().multiplyScalar(this.k).applyQuaternion(parentQ));
  }
  keepLocal(name, localQ) {
    const bone = this.b[name];
    if (localQ) bone.quaternion.copy(localQ); else bone.quaternion.copy(this.restLocal[name]);
    const parentQ = this.W[this.parentName(name)];
    this.W[name] = parentQ.clone().multiply(bone.quaternion);
    this.P[name] = this.P[this.parentName(name)].clone().add(bone.position.clone().multiplyScalar(this.k).applyQuaternion(parentQ));
  }
  parentName(name) {
    const p = this.b[name].parent;
    if (!p.isBone) return '__root';
    return p.name.replace('Bip01_', '').replace('Bip01', 'Root');
  }
  // rest-follow orientation: bone keeps its rest model orientation, carried by a frame quaternion
  follow(name, frameQ) { return frameQ.clone().multiply(this.restModel[name]); }

  // Main pose entry. pose = { pos, yaw, hipY, pelvisQ(optional extra), chestLean, chestTwist, chestSide,
  //   lookAt(Vector3|null), feet:{L:{pos, yaw, pitch}, R:{...}}, hands:{L:{pos, pole, palm, dir, curl}, R:{...}} }
  apply(pose) {
    const root = this.root;
    root.position.set(pose.pos.x, 0, pose.pos.z);
    root.quaternion.setFromAxisAngle(Y, pose.yaw);
    root.updateMatrix(); root.updateMatrixWorld(false);
    const rootQ = root.quaternion.clone();
    this.W.__root = rootQ; this.P.__root = root.position.clone();
    const body = rootQ.clone(); // body frame (forward = +Z local)
    const fwd = Z.clone().applyQuaternion(body), left = X.clone().applyQuaternion(body);

    // pelvis: position is world-specified (hip bob, sway); orientation = yaw + pelvis twist/tilt
    const pelvisQ = body.clone();
    if (pose.pelvisTwist) pelvisQ.multiply(new THREE.Quaternion().setFromAxisAngle(Y, pose.pelvisTwist));
    if (pose.pelvisTilt) pelvisQ.multiply(new THREE.Quaternion().setFromAxisAngle(X, pose.pelvisTilt));
    if (pose.pelvisRoll) pelvisQ.multiply(new THREE.Quaternion().setFromAxisAngle(Z, pose.pelvisRoll));
    const rootBone = this.b.Root;
    const hipWorld = new THREE.Vector3(pose.pos.x, pose.hipY, pose.pos.z).add(pose.hipOffset || new THREE.Vector3());
    // Root bone local position (in root space, cm-scaled): invert root transform
    const local = hipWorld.clone().sub(root.position).applyQuaternion(rootQ.clone().invert()).multiplyScalar(1 / this.k);
    rootBone.position.copy(local);
    const qRoot = pelvisQ.clone().multiply(this.restModel.Root);
    rootBone.quaternion.copy(rootQ.clone().invert().multiply(qRoot));
    this.W.Root = qRoot; this.P.Root = hipWorld.clone();
    this.keepLocal('Pelvis');
    this.keepLocal('Spine');

    // upper body: lean (about body left axis), twist (about up), side bend
    const lean = pose.chestLean || 0, twist = pose.chestTwist || 0, side = pose.chestSide || 0;
    const spineParts = [['Spine1', 0.35], ['Spine2', 0.4], ['Neck', 0.25]];
    let acc = pelvisQ.clone();
    const chestFrameBase = pelvisQ.clone();
    let cum = new THREE.Quaternion();
    for (const [n, w] of spineParts) {
      const qLean = new THREE.Quaternion().setFromAxisAngle(X, lean * w);
      const qTw = new THREE.Quaternion().setFromAxisAngle(Y, twist * w);
      const qSd = new THREE.Quaternion().setFromAxisAngle(Z, side * w);
      cum.multiply(qTw).multiply(qLean).multiply(qSd);
      const frame = chestFrameBase.clone().multiply(cum);
      this.setWorld(n, this.follow(n, frame));
      acc = frame;
    }
    this.chestFrame = acc.clone();
    // head: look at target
    let headFrame = acc.clone();
    if (pose.lookAt) {
      const hp = this.P.Neck.clone().add(new THREE.Vector3(0, 0.12, 0));
      const d = pose.lookAt.clone().sub(hp).normalize();
      const yawH = Math.atan2(d.x, d.z), pitchH = -Math.asin(THREE.MathUtils.clamp(d.y, -0.9, 0.9));
      headFrame = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchH * 0.8, yawH, 0, 'YXZ'));
      // limit relative to chest
      const rel = acc.clone().invert().multiply(headFrame);
      const e = new THREE.Euler().setFromQuaternion(rel, 'YXZ');
      e.y = THREE.MathUtils.clamp(e.y, -1.1, 1.1); e.x = THREE.MathUtils.clamp(e.x, -0.6, 0.5); e.z = 0;
      headFrame = acc.clone().multiply(new THREE.Quaternion().setFromEuler(e));
    }
    this.setWorld('Head', this.follow('Head', headFrame));
    for (const n of Object.keys(this.b)) { // face bones keep rest
      if (this.b[n].parent === this.b.Head || (this.b[n].parent && this.b[n].parent.parent === this.b.Head)) this.b[n].quaternion.copy(this.restLocal[n]);
    }

    // legs
    for (const s of ['L', 'R']) this.solveLeg(s, pose.feet[s], body, pelvisQ);
    // arms
    for (const s of ['L', 'R']) this.solveArm(s, pose.hands[s], acc, pose.shrug ? pose.shrug[s] : 0);
  }

  solveLeg(s, foot, body, pelvisQ) {
    const thigh = `${s}_Thigh`, calf = `${s}_Calf`, fb = `${s}_Foot`;
    // hip joint position from FK of Spine
    const spineQ = this.W.Spine;
    const H = this.P.Spine.clone().add(this.b[thigh].position.clone().multiplyScalar(this.k).applyQuaternion(spineQ));
    const A = foot.pos.clone(); // ankle target
    const L1 = this.len.thigh, L2 = this.len.calf;
    let d = A.clone().sub(H); let dist = d.length();
    const maxD = (L1 + L2) * 0.999;
    if (dist > maxD) { d.multiplyScalar(maxD / dist); A.copy(H).add(d); dist = maxD; }
    const dir = d.clone().normalize();
    // knee pole: along foot direction (toe dir) mixed with body forward
    const toe = new THREE.Vector3(Math.sin(foot.yaw), 0, Math.cos(foot.yaw));
    const pole = (foot.kneePole || toe.clone()).clone();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const K = H.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
    // thigh orientation
    const fT = this.follow(thigh, pelvisQ);
    const a0 = X.clone().applyQuaternion(fT), r0 = Y.clone().applyQuaternion(fT);
    const qT = alignQuat(a0, r0, K.clone().sub(H), perp).multiply(fT);
    this.setWorld(thigh, qT);
    const fC = qT.clone().multiply(this.restLocal[calf]);
    const a1 = X.clone().applyQuaternion(fC), r1 = Y.clone().applyQuaternion(fC);
    const qC = alignQuat(a1, r1, A.clone().sub(K), perp).multiply(fC);
    this.setWorld(calf, qC);
    // foot: X axis points down, Y forward(toe)
    const pitch = foot.pitch || 0; // + = heel up (toe down)
    const toeDir = toe.clone().multiplyScalar(Math.cos(pitch)).add(new THREE.Vector3(0, -Math.sin(pitch), 0));
    const down = new THREE.Vector3(0, -1, 0).multiplyScalar(Math.cos(pitch)).addScaledVector(toe, -Math.sin(pitch));
    const fF = this.follow(fb, body);
    const qF = alignQuat(X.clone().applyQuaternion(fF), Y.clone().applyQuaternion(fF), down, toeDir).multiply(fF);
    // correct: rest foot Y axis has toe-out baked in; we align rest Y (with its toe-out) to toeDir
    this.setWorld(fb, qF);
    const toeB = `${s}_Toe0`;
    const toeBend = foot.toeBend || 0;
    this.keepLocal(toeB, this.restLocal[toeB].clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, toeBend * (s === 'L' ? 1 : -1))));
  }

  solveArm(s, hand, chestQ, shrug) {
    const clav = `${s}_Clavicle`, up = `${s}_UpperArm`, fo = `${s}_Forearm`, hb = `${s}_Hand`;
    // clavicle: rest follow + shrug/protraction
    const cq = this.restLocal[clav].clone();
    if (shrug) cq.multiply(new THREE.Quaternion().setFromAxisAngle(Z, shrug * 0.25));
    this.keepLocal(clav, cq);
    const S = this.P[clav].clone().add(this.b[up].position.clone().multiplyScalar(this.k).applyQuaternion(this.W[clav]));
    const L1 = this.len.upper, L2 = this.len.fore;
    const Wt = hand.pos.clone();
    let d = Wt.clone().sub(S); let dist = d.length();
    const maxD = (L1 + L2) * 0.995, minD = 0.12;
    if (dist > maxD) { d.multiplyScalar(maxD / dist); dist = maxD; }
    if (dist < minD) { d.multiplyScalar(minD / dist); dist = minD; }
    const W = S.clone().add(d);
    const dir = d.clone().normalize();
    const pole = hand.pole.clone();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    let perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
    if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3(0, -1, 0).addScaledVector(dir, dir.y);
    perp.normalize();
    const E = S.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
    const fU = this.follow(up, chestQ);
    const qU = alignQuat(X.clone().applyQuaternion(fU), Y.clone().applyQuaternion(fU), E.clone().sub(S), perp).multiply(fU);
    this.setWorld(up, qU);
    const fF = qU.clone().multiply(this.restLocal[fo]);
    const qF = alignQuat(X.clone().applyQuaternion(fF), Y.clone().applyQuaternion(fF), W.clone().sub(E), perp).multiply(fF);
    this.setWorld(fo, qF);
    // hand: along = hand.dir, palm normal (+Y axis) = hand.palm
    const fH = qF.clone().multiply(this.restLocal[hb]);
    const hd = hand.dir ? hand.dir.clone() : W.clone().sub(E).normalize();
    const palm = hand.palm ? hand.palm.clone() : Y.clone().applyQuaternion(fH);
    const qH = alignQuat(X.clone().applyQuaternion(fH), Y.clone().applyQuaternion(fH), hd, palm).multiply(fH);
    this.setWorld(hb, qH);
    // fingers curl
    const curl = hand.curl ?? 0.25;
    for (const f of ['0', '1', '2', '3', '4']) {
      const base = `${s}_Finger${f}`;
      if (!this.b[base]) continue;
      const amt = f === '0' ? curl * 0.4 : curl;
      for (const seg of ['', '1', '2']) {
        const n = base + seg; if (!this.b[n]) continue;
        const ax = f === '0' ? Y : Z;
        this.b[n].quaternion.copy(this.restLocal[n]).multiply(new THREE.Quaternion().setFromAxisAngle(ax, -amt * (seg === '' ? 0.5 : 0.9) * (s === 'L' ? 1 : 1)));
      }
    }
  }
  wrist(s) { return this.P[`${s}_Hand`]; }

  // Drive the rig from retargeted mocap targets (world space). T: {pos:{joint:Vector3}, quat:{bone:Quaternion}, yaw}
  // opt: { handOverride: {L,R} (hand targets to use instead of mocap), look: Vector3|null, lookW: 0..1, curl }
  applyMocap(T, src, opt = {}) {
    const root = this.root, k = this.k;
    const hip = T.pos.lhipjoint.clone().add(T.pos.rhipjoint).multiplyScalar(0.5);
    root.position.set(hip.x, 0, hip.z);
    root.quaternion.setFromAxisAngle(Y, T.yaw);
    root.updateMatrix(); root.updateMatrixWorld(false);
    const rootQ = root.quaternion.clone();
    this.W.__root = rootQ; this.P.__root = root.position.clone();
    // pelvis
    const qRoot = T.quat.root.clone().multiply(this.restModel.Root);
    const rb = this.b.Root;
    rb.position.copy(hip.clone().sub(root.position).applyQuaternion(rootQ.clone().invert()).multiplyScalar(1 / k));
    rb.quaternion.copy(rootQ.clone().invert().multiply(qRoot));
    this.W.Root = qRoot; this.P.Root = hip.clone();
    this.keepLocal('Pelvis'); this.keepLocal('Spine');
    // spine chain from source rotations
    this.setWorld('Spine1', this.follow('Spine1', T.quat.lowerback.clone().slerp(T.quat.thorax, 0.35)));
    this.setWorld('Spine2', this.follow('Spine2', T.quat.thorax));
    this.setWorld('Neck', this.follow('Neck', T.quat.thorax.clone().slerp(T.quat.upperneck, 0.5)));
    let headQ = T.quat.head.clone();
    if (opt.look && opt.lookW > 0) {
      const hp = this.P.Neck.clone().add(new THREE.Vector3(0, 0.12, 0));
      const d = opt.look.clone().sub(hp).normalize();
      const want = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.asin(THREE.MathUtils.clamp(d.y, -0.9, 0.9)) * 0.8, Math.atan2(d.x, d.z), 0, 'YXZ'));
      headQ.slerp(want, opt.lookW);
    }
    this.setWorld('Head', this.follow('Head', headQ));
    for (const n of Object.keys(this.b)) {
      if (this.b[n].parent === this.b.Head || (this.b[n].parent && this.b[n].parent.parent === this.b.Head)) this.b[n].quaternion.copy(this.restLocal[n]);
    }
    const pelvisQ = T.quat.root.clone();
    const chestQ = this.W.Neck.clone().multiply(this.restModel.Neck.clone().invert());
    // legs: ankles from mocap, knee pole from mocap knee
    for (const side of ['L', 'R']) {
      const s = side.toLowerCase();
      const hipJ = T.pos[s + 'hipjoint'], knee = T.pos[s + 'femur'], ankle = T.pos[s + 'tibia'], ball = T.pos[s + 'foot'];
      const line = ankle.clone().sub(hipJ).normalize();
      const pole = knee.clone().sub(hipJ); pole.addScaledVector(line, -pole.dot(line));
      const toe = ball.clone().sub(ankle);
      const horiz = Math.hypot(toe.x, toe.z);
      const below = Math.atan2(-toe.y, horiz);
      const pitch = below - src.footRest;
      this.solveLeg(side, { pos: ankle.clone(), yaw: Math.atan2(toe.x, toe.z), pitch: THREE.MathUtils.clamp(pitch, -0.5, 1.3), toeBend: THREE.MathUtils.clamp(pitch, 0, 1) * 0.8, kneePole: pole.normalize() }, rootQ, pelvisQ);
    }
    // arms: wrist relative to shoulder, rescaled to our arm length; elbow pole from mocap elbow.
    // opt.handOverride[side] = {pos, palm?, dir?, pole?, curl?, w?} blends toward an explicit hand target (w = weight).
    for (const side of ['L', 'R']) {
      const s = side.toLowerCase();
      const sh = T.pos[s + 'clavicle'], el = T.pos[s + 'humerus'], wr = T.pos[s + 'radius'], hd = T.pos[s + 'hand'];
      // our shoulder (after clavicle rest)
      this.keepLocal(`${side}_Clavicle`);
      const S = this.P[`${side}_Clavicle`].clone().add(this.b[`${side}_UpperArm`].position.clone().multiplyScalar(k).applyQuaternion(this.W[`${side}_Clavicle`]));
      const ratio = (this.len.upper + this.len.fore) / (src.armLen * src.scale);
      const wrist = S.clone().add(wr.clone().sub(sh).multiplyScalar(ratio));
      const line = wr.clone().sub(sh).normalize();
      const pole = el.clone().sub(sh); pole.addScaledVector(line, -pole.dot(line));
      const dir = hd.clone().sub(wr).normalize();
      const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(T.quat[s + 'hand']);
      const nat = { pos: wrist, pole: pole.lengthSq() > 1e-6 ? pole.normalize() : new THREE.Vector3(0, -1, 0), palm, dir, curl: opt.curl ?? 0.3 };
      const ov = opt.handOverride && opt.handOverride[side];
      let tgt = nat;
      if (ov && (ov.w ?? 1) > 0) {
        const w = Math.min(1, ov.w ?? 1);
        const mix = (a, b) => { if (!b) return a; const v = a.clone().lerp(b, w); return v.lengthSq() > 1e-8 ? v.normalize() : b.clone(); };
        tgt = {
          pos: nat.pos.clone().lerp(ov.pos, w), pole: mix(nat.pole, ov.pole), palm: mix(nat.palm, ov.palm), dir: mix(nat.dir, ov.dir),
          curl: ov.curl === undefined ? nat.curl : nat.curl + (ov.curl - nat.curl) * w,
        };
      }
      this.solveArm(side, tgt, chestQ, 0);
    }
  }

}
