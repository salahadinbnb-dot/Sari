// Control skeleton, forward kinematics, two-bone IK and base poses.
// Port of FitnessMotion/Motion/Skeleton.swift. The figure faces +Z at rest, Y is up,
// the figure's own left side is +X.
import * as THREE from '../vendor/three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
export const deg = d => d * Math.PI / 180;

export const Skeleton = {
  pelvisHeight: 0.96, shoulderHalfWidth: 0.215, hipHalfWidth: 0.10,
  upperArm: 0.30, foreArm: 0.26, handLength: 0.07, thigh: 0.45, shin: 0.43, footLength: 0.25, ankleHeight: 0.06,
  get chestHeight() { return this.pelvisHeight + 0.10 + 0.20; },
  get shoulderHeight() { return this.chestHeight + 0.19; },
};

export const JOINTS = ['pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];

const PARENT = {
  pelvis: null, spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck',
  shoulderL: 'chest', elbowL: 'shoulderL', wristL: 'elbowL', shoulderR: 'chest', elbowR: 'shoulderR', wristR: 'elbowR',
  hipL: 'pelvis', kneeL: 'hipL', ankleL: 'kneeL', hipR: 'pelvis', kneeR: 'hipR', ankleR: 'kneeR',
};

const REST = {
  pelvis: V(0, Skeleton.pelvisHeight, 0), spine: V(0, 0.10, 0), chest: V(0, 0.20, 0), neck: V(0, 0.24, 0), head: V(0, 0.09, 0),
  shoulderL: V(Skeleton.shoulderHalfWidth, 0.19, 0), shoulderR: V(-Skeleton.shoulderHalfWidth, 0.19, 0),
  elbowL: V(0, -Skeleton.upperArm, 0), elbowR: V(0, -Skeleton.upperArm, 0),
  wristL: V(0, -Skeleton.foreArm, 0), wristR: V(0, -Skeleton.foreArm, 0),
  hipL: V(Skeleton.hipHalfWidth, -0.02, 0), hipR: V(-Skeleton.hipHalfWidth, -0.02, 0),
  kneeL: V(0, -Skeleton.thigh, 0), kneeR: V(0, -Skeleton.thigh, 0),
  ankleL: V(0, -Skeleton.shin, 0), ankleR: V(0, -Skeleton.shin, 0),
};

const MIRROR = { shoulderL: 'shoulderR', elbowL: 'elbowR', wristL: 'wristR', shoulderR: 'shoulderL', elbowR: 'elbowL', wristR: 'wristL',
  hipL: 'hipR', kneeL: 'kneeR', ankleL: 'ankleR', hipR: 'hipL', kneeR: 'kneeL', ankleR: 'ankleL' };

export const Side = {
  L: { name: 'L', sign: 1, shoulder: 'shoulderL', elbow: 'elbowL', wrist: 'wristL', hip: 'hipL', knee: 'kneeL', ankle: 'ankleL' },
  R: { name: 'R', sign: -1, shoulder: 'shoulderR', elbow: 'elbowR', wrist: 'wristR', hip: 'hipR', knee: 'kneeR', ankle: 'ankleR' },
};
Side.both = [Side.L, Side.R];
Side.other = s => (s === Side.L ? Side.R : Side.L);

// ---- rotation helpers
export const qAxis = (axis, degrees) => new THREE.Quaternion().setFromAxisAngle(axis, deg(degrees));
export const qx = d => qAxis(V(1, 0, 0), d);
export const qy = d => qAxis(V(0, 1, 0), d);
export const qz = d => qAxis(V(0, 0, 1), d);
export const qIdentity = () => new THREE.Quaternion();
export function euler(pitch = 0, yaw = 0, roll = 0) {
  return qx(pitch).multiply(qy(yaw)).multiply(qz(roll)).normalize();
}
export function qFromBasis(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m).normalize();
}
export function orthonormalized(v, axis, fallback) {
  let p = v.clone().sub(axis.clone().multiplyScalar(v.dot(axis)));
  if (p.length() < 1e-4) {
    p = fallback.clone().sub(axis.clone().multiplyScalar(fallback.dot(axis)));
    if (p.length() < 1e-4) p = new THREE.Vector3().crossVectors(axis, V(1, 0, 0));
  }
  return p.normalize();
}
export function mirrorQuat(q) { return new THREE.Quaternion(q.x, -q.y, -q.z, q.w); }
export const PalmFacing = { forward: 'forward', backward: 'backward', inward: 'inward', outward: 'outward', up: 'up', down: 'down' };

// ---- Pose
export class Pose {
  constructor() { this.rotations = {}; this.pelvisOffset = V(0, 0, 0); this.offsets = {}; }
  get(j) { return this.rotations[j] || qIdentity(); }
  set(j, q) { this.rotations[j] = q.clone().normalize(); }
  clone() {
    const p = new Pose();
    for (const k in this.rotations) p.rotations[k] = this.rotations[k].clone();
    p.pelvisOffset = this.pelvisOffset.clone();
    for (const k in this.offsets) p.offsets[k] = this.offsets[k].clone();
    return p;
  }
  static lerp(a, b, t) {
    const out = new Pose();
    for (const j of JOINTS) out.rotations[j] = a.get(j).clone().slerp(b.get(j), t);
    out.pelvisOffset = a.pelvisOffset.clone().lerp(b.pelvisOffset, t);
    const keys = new Set([...Object.keys(a.offsets), ...Object.keys(b.offsets)]);
    for (const k of keys) out.offsets[k] = (a.offsets[k] || V(0, 0, 0)).clone().lerp(b.offsets[k] || V(0, 0, 0), t);
    return out;
  }
  get shoulderY() { return Skeleton.shoulderHeight + this.pelvisOffset.y; }

  worldTransforms() {
    const out = {};
    const resolve = j => {
      if (out[j]) return out[j];
      const local = this.get(j);
      const offset = REST[j].clone().add(this.offsets[j] || V(0, 0, 0));
      if (j === 'pelvis') offset.add(this.pelvisOffset);
      let t;
      const p = PARENT[j];
      if (p) {
        const pt = resolve(p);
        t = { position: pt.position.clone().add(offset.clone().applyQuaternion(pt.rotation)), rotation: pt.rotation.clone().multiply(local).normalize() };
      } else {
        t = { position: offset, rotation: local.clone().normalize() };
      }
      out[j] = t;
      return t;
    };
    for (const j of JOINTS) resolve(j);
    return out;
  }

  gripPosition(side, t) {
    t = t || this.worldTransforms();
    const w = t[side.wrist];
    return w.position.clone().add(V(0, -Skeleton.handLength, 0).applyQuaternion(w.rotation));
  }

  // ---- IK
  reachArm(side, target, pole, palm = null, palmTwist = 0) {
    let wristTarget = target.clone();
    for (let i = 0; i < 2; i++) {
      const t = this.worldTransforms();
      const s = t[side.shoulder];
      this._solveChain(side.shoulder, side.elbow, side.wrist, s, wristTarget, pole, Skeleton.upperArm, Skeleton.foreArm, false, t.chest.rotation);
      const t2 = this.worldTransforms();
      const fingers = V(0, -1, 0).applyQuaternion(t2[side.wrist].rotation);
      wristTarget = target.clone().sub(fingers.multiplyScalar(Skeleton.handLength));
    }
    if (palm) this.setPalm(side, palm, palmTwist);
  }

  reachLeg(side, ankleTarget, pole = V(0, 0, 1)) {
    const t = this.worldTransforms();
    this._solveChain(side.hip, side.knee, side.ankle, t[side.hip], ankleTarget, pole, Skeleton.thigh, Skeleton.shin, true, t.pelvis.rotation);
  }

  _solveChain(root, mid, end, rootWorld, target, pole, a, b, frontAlongPole, parentRotation) {
    const s = rootWorld.position;
    let d = target.clone().sub(s).length();
    d = Math.min(Math.max(d, Math.abs(a - b) + 0.01), a + b - 0.002);
    const u = target.clone().sub(s).normalize();
    const p = orthonormalized(pole.clone().normalize(), u, V(0, 0, -1));
    const cosT = (a * a + d * d - b * b) / (2 * a * d);
    const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
    const elbow = s.clone().add(u.clone().multiplyScalar(Math.cos(theta) * a)).add(p.clone().multiplyScalar(Math.sin(theta) * a));
    const dir1 = elbow.clone().sub(s).normalize();
    const dir2 = target.clone().sub(elbow).normalize();
    const front = frontAlongPole ? p : p.clone().negate();
    const y1 = dir1.clone().negate();
    const z1 = orthonormalized(front, y1, V(0, 0, 1));
    const x1 = new THREE.Vector3().crossVectors(y1, z1).normalize();
    const q1 = qFromBasis(x1, y1, z1);
    const y2 = dir2.clone().negate();
    const z2 = orthonormalized(front, y2, V(0, 0, 1));
    const x2 = new THREE.Vector3().crossVectors(y2, z2).normalize();
    const q2 = qFromBasis(x2, y2, z2);
    this.set(root, parentRotation.clone().invert().multiply(q1));
    this.set(mid, q1.clone().invert().multiply(q2));
    if (!this.rotations[end]) this.set(end, qIdentity());
  }

  setPalm(side, facing, extraTwist = 0) {
    this.set(side.wrist, qIdentity());
    const t = this.worldTransforms();
    const e = t[side.elbow];
    const fingers = V(0, -1, 0).applyQuaternion(e.rotation);
    const palm0 = V(0, 0, 1).applyQuaternion(e.rotation);
    let desired;
    switch (facing) {
      case 'forward': desired = V(0, 0, 1); break;
      case 'backward': desired = V(0, 0, -1); break;
      case 'inward': desired = V(-side.sign, 0, 0); break;
      case 'outward': desired = V(side.sign, 0, 0); break;
      case 'up': desired = V(0, 1, 0); break;
      default: desired = V(0, -1, 0);
    }
    const target = orthonormalized(desired, fingers, palm0);
    const cosA = Math.max(-1, Math.min(1, palm0.dot(target)));
    const sinA = new THREE.Vector3().crossVectors(palm0, target).dot(fingers);
    const angle = Math.atan2(sinA, cosA);
    this.set(side.wrist, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -angle + deg(extraTwist)));
  }

  // ---- authoring helpers (MotionLibrary.swift extension)
  reachBoth(target, pole, palm, twist = 0) {
    for (const s of Side.both) {
      this.reachArm(s, V(s.sign * target.x, target.y, target.z), V(s.sign * pole.x, pole.y, pole.z), palm, twist);
    }
  }
  setTorso({ pitch = 0, yaw = 0, roll = 0, split = 0.5 } = {}) {
    this.set('spine', euler(pitch * split, yaw * split, roll * split));
    this.set('chest', euler(pitch * (1 - split), yaw * (1 - split), roll * (1 - split)));
  }
  setHead({ pitch = 0, yaw = 0 } = {}) {
    this.set('neck', euler(pitch * 0.5, yaw * 0.5));
    this.set('head', euler(pitch * 0.5, yaw * 0.5));
  }
  shrug(amount) { this.offsets.shoulderL = V(0, amount, 0); this.offsets.shoulderR = V(0, amount, 0); }
  hangArms(width = 0.26, forward = 0.06, palm = 'inward') {
    const y = this.shoulderY - Skeleton.upperArm - Skeleton.foreArm - Skeleton.handLength + 0.03;
    this.reachBoth(V(width, y, forward), V(0.35, -0.3, -1), palm);
  }
  handsOnHips() { this.reachBoth(V(0.19, this.shoulderY - 0.42, 0.02), V(1, 0.2, -0.6), 'inward'); }

  // ---- base poses
  static standing() {
    const p = new Pose();
    for (const j of JOINTS) p.set(j, qIdentity());
    p.set('shoulderL', euler(0, 0, 6)); p.set('shoulderR', euler(0, 0, -6));
    p.set('elbowL', euler(-8)); p.set('elbowR', euler(-8));
    return p;
  }
  static seated(seatHeight = 0.45, kneeSpread = 0.12) {
    const p = Pose.standing();
    p.pelvisOffset = V(0, seatHeight + 0.06 - Skeleton.pelvisHeight, 0);
    const t = p.worldTransforms();
    for (const s of Side.both) {
      const hip = t[s.hip].position;
      p.reachLeg(s, V(hip.x + s.sign * kneeSpread, Skeleton.ankleHeight, 0.46), V(s.sign * 0.25, 0.15, 1));
    }
    return p;
  }
  static supine() {
    const p = Pose.standing();
    p.set('pelvis', qx(-90));
    p.pelvisOffset = V(0, 0.13 - Skeleton.pelvisHeight, 0);
    for (const j of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR']) p.set(j, qIdentity());
    return p;
  }
  static prone() {
    const p = Pose.standing();
    p.set('pelvis', qx(90));
    p.pelvisOffset = V(0, 0.15 - Skeleton.pelvisHeight, 0);
    for (const j of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR']) p.set(j, qIdentity());
    return p;
  }
  static kneeling() {
    const p = Pose.standing();
    p.pelvisOffset = V(0, 0.54 - Skeleton.pelvisHeight, 0);
    for (const s of Side.both) { p.set(s.hip, qIdentity()); p.set(s.knee, qx(90)); p.set(s.ankle, qx(90)); }
    return p;
  }
  static squat(depth, stance = 0.16, lean = 20, footZ = 0.0) {
    const p = Pose.standing();
    const drop = depth * 0.42;
    p.pelvisOffset = V(0, -drop, -depth * 0.10);
    p.setTorso({ pitch: lean * depth, split: 0.5 });
    for (const s of Side.both) p.reachLeg(s, V(s.sign * stance, Skeleton.ankleHeight, footZ), V(s.sign * 0.35, 0.05, 1));
    p.levelFeet();
    return p;
  }

  /** Staggered standing stance: `front` foot ahead, both feet flat, slight knee bend, weight centred. */
  static splitStance(front = Side.L, stance = 0.16, spread = 0.26, drop = 0.05) {
    const p = Pose.standing();
    p.pelvisOffset = V(0, -drop, 0.02);
    for (const s of Side.both) {
      const z = s === front ? spread : -spread * 0.8;
      p.reachLeg(s, V(s.sign * stance, Skeleton.ankleHeight, z), V(s.sign * 0.3, 0.05, 1));
    }
    p.levelFeet();
    return p;
  }

  /** Point both feet straight forward and flat on the floor regardless of shin tilt. */
  levelFeet(yaw = 0) {
    const t = this.worldTransforms();
    const desired = qy(yaw);
    for (const s of Side.both) this.set(s.ankle, t[s.knee].rotation.clone().invert().multiply(desired));
  }
}

// ---- clips
export class MotionClip {
  constructor(duration, keys) { this.duration = duration; this.keys = keys; }
  pose(phase) {
    const keys = this.keys;
    if (keys.length < 2) return keys.length ? keys[0][1] : Pose.standing();
    const p = phase - Math.floor(phase);
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1][0] < p) i++;
    const [t0, a] = keys[i];
    const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(t1 - t0, 1e-4);
    let t = Math.max(0, Math.min(1, (p - t0) / span));
    const eased = t * t * (3 - 2 * t);
    return Pose.lerp(a, b, eased);
  }
}

export const Vec = V;
