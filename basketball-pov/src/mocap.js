// CMU mocap clips -> world-space targets for the Rocketbox rig (retargeting by positions + spine rotations).
import * as THREE from 'three';

const clipCache = new Map();
let jsonSource = async (name) => (await fetch(`/assets/mocap/json/${name}.json`)).json();
export function setClipSource(fn) { jsonSource = fn; }
export async function loadClip(name) {
  if (clipCache.has(name)) return clipCache.get(name);
  const d = await jsonSource(name);
  const c = { name, fps: d.fps, n: d.n, dur: (d.n - 1) / d.fps, pos: {}, quat: {} };
  for (const [k, v] of Object.entries(d.pos)) c.pos[k] = Float32Array.from(v);
  const m = new THREE.Matrix4();
  for (const [k, v] of Object.entries(d.mat)) {
    const q = new Float32Array(d.n * 4);
    for (let i = 0; i < d.n; i++) {
      const e = v.slice(i * 9, i * 9 + 9);
      m.set(e[0], e[1], e[2], 0, e[3], e[4], e[5], 0, e[6], e[7], e[8], 0, 0, 0, 0, 1);
      const qq = new THREE.Quaternion().setFromRotationMatrix(m);
      q.set([qq.x, qq.y, qq.z, qq.w], i * 4);
    }
    // keep quaternion signs continuous
    for (let i = 1; i < d.n; i++) {
      const dot = q[i * 4] * q[i * 4 - 4] + q[i * 4 + 1] * q[i * 4 - 3] + q[i * 4 + 2] * q[i * 4 - 2] + q[i * 4 + 3] * q[i * 4 - 1];
      if (dot < 0) for (let j = 0; j < 4; j++) q[i * 4 + j] *= -1;
    }
    c.quat[k] = q;
  }
  // leg / arm lengths of the performer
  const P = (k, i) => new THREE.Vector3(c.pos[k][i * 3], c.pos[k][i * 3 + 1], c.pos[k][i * 3 + 2]);
  c.legLen = P('lhipjoint', 0).distanceTo(P('lfemur', 0)) + P('lfemur', 0).distanceTo(P('ltibia', 0));
  c.armLen = P('lclavicle', 0).distanceTo(P('lhumerus', 0)) + P('lhumerus', 0).distanceTo(P('lradius', 0));
  clipCache.set(name, c);
  return c;
}

// sample clip at time t (seconds, clamped); returns raw source-space joints + bone quats
export function sampleClip(c, t) {
  const f = THREE.MathUtils.clamp(t * c.fps, 0, c.n - 1);
  const i0 = Math.floor(f), i1 = Math.min(i0 + 1, c.n - 1), u = f - i0;
  const pos = {}, quat = {};
  for (const [k, a] of Object.entries(c.pos)) {
    pos[k] = new THREE.Vector3(a[i0 * 3] + (a[i1 * 3] - a[i0 * 3]) * u, a[i0 * 3 + 1] + (a[i1 * 3 + 1] - a[i0 * 3 + 1]) * u, a[i0 * 3 + 2] + (a[i1 * 3 + 2] - a[i0 * 3 + 2]) * u);
  }
  for (const [k, a] of Object.entries(c.quat)) {
    const q0 = new THREE.Quaternion(a[i0 * 4], a[i0 * 4 + 1], a[i0 * 4 + 2], a[i0 * 4 + 3]);
    const q1 = new THREE.Quaternion(a[i1 * 4], a[i1 * 4 + 1], a[i1 * 4 + 2], a[i1 * 4 + 3]);
    quat[k] = q0.slerp(q1, u);
  }
  return { pos, quat };
}

// facing yaw of the performer from the hip line (forward = left x up, i.e. body faces +Z when left is +X)
export function facingYaw(s) {
  const l = s.pos.lhipjoint, r = s.pos.rhipjoint;
  const left = new THREE.Vector3(l.x - r.x, 0, l.z - r.z).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, new THREE.Vector3(0, 1, 0));
  return Math.atan2(fwd.x, fwd.z);
}
export function hipCenter(s) { return s.pos.lhipjoint.clone().add(s.pos.rhipjoint).multiplyScalar(0.5); }

// Placement: rotate source around its anchor by rotY, scale, move to world anchor.
export class Placement {
  constructor(srcAnchor, srcYaw, worldAnchor, worldYaw, scale) {
    this.src = srcAnchor.clone(); this.src.y = 0;
    this.world = worldAnchor.clone(); this.world.y = 0;
    this.rotY = worldYaw - srcYaw;
    this.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY);
    this.scale = scale;
  }
  p(v) { const o = v.clone().sub(this.src); const y = o.y; o.y = 0; o.applyQuaternion(this.q).multiplyScalar(this.scale); o.y = y * this.scale; return o.add(this.world); }
  r(q) { return this.q.clone().multiply(q); }
}

// Convert one sampled source frame (+placement) into world-space pose targets
export function toTargets(s, pl) {
  const T = { pos: {}, quat: {} };
  for (const [k, v] of Object.entries(s.pos)) T.pos[k] = pl.p(v);
  for (const [k, q] of Object.entries(s.quat)) T.quat[k] = pl.r(q);
  T.yaw = facingYaw(s) + pl.rotY;
  return T;
}

// Blend two target sets (u=0 -> a, u=1 -> b)
export function blendTargets(a, b, u) {
  if (u <= 0) return a; if (u >= 1) return b;
  const T = { pos: {}, quat: {} };
  for (const k of Object.keys(a.pos)) T.pos[k] = a.pos[k].clone().lerp(b.pos[k], u);
  for (const k of Object.keys(a.quat)) T.quat[k] = a.quat[k].clone().slerp(b.quat[k], u);
  let d = b.yaw - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  T.yaw = a.yaw + d * u;
  return T;
}
