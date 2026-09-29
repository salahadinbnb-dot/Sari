// Sequences mocap clip segments per player with crossfades and world placement.
import * as THREE from 'three';
import { sampleClip, facingYaw, hipCenter, Placement, toTargets, blendTargets } from './mocap.js';

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// per-clip calibration: floor height, foot rest angle, scale for a given leg length, and a lift so a planted
// ankle sits at our model's ankle height (the performer's markers put it ~2 cm lower -> shoes sank into the floor)
export const OUR_ANKLE = 0.106;
export function calibrate(clip, ourLeg) {
  if (clip.cal && clip.cal.ourLeg === ourLeg) return clip.cal;
  let minY = 1e9;
  const below = [];
  for (let i = 0; i < clip.n; i++) {
    minY = Math.min(minY, clip.pos.ltoes[i * 3 + 1], clip.pos.rtoes[i * 3 + 1]);
  }
  for (let i = 0; i < clip.n; i++) {
    for (const s of ['l', 'r']) {
      const ay = clip.pos[s + 'tibia'][i * 3 + 1] - minY;
      if (ay > 0.13) continue; // only grounded ankles
      const dx = clip.pos[s + 'foot'][i * 3] - clip.pos[s + 'tibia'][i * 3];
      const dy = clip.pos[s + 'foot'][i * 3 + 1] - clip.pos[s + 'tibia'][i * 3 + 1];
      const dz = clip.pos[s + 'foot'][i * 3 + 2] - clip.pos[s + 'tibia'][i * 3 + 2];
      below.push(Math.atan2(-dy, Math.hypot(dx, dz)));
    }
  }
  below.sort((a, b) => a - b);
  const footRest = below.length ? below[Math.floor(below.length * 0.3)] : 0.5;
  const scale = ourLeg / clip.legLen;
  const hs = [];
  for (let i = 0; i < clip.n; i++) for (const s of ['l', 'r']) { const h = clip.pos[s + 'tibia'][i * 3 + 1] - minY; if (h < 0.13) hs.push(h); }
  hs.sort((a, b) => a - b);
  const planted = hs.length ? hs[Math.floor(hs.length * 0.3)] : 0.09;
  clip.cal = { ourLeg, minY, footRest, scale, lift: Math.max(0, OUR_ANKLE / scale - planted) };
  return clip.cal;
}

function sampleCal(clip, t) {
  const s = sampleClip(clip, t);
  for (const k of Object.keys(s.pos)) s.pos[k].y += clip.cal.lift - clip.cal.minY;
  return s;
}

// Counter-rotate a clip's facing change while airborne (from..to in clip time), about the hip center.
// Keeps e.g. a layup from spinning the body away from the rim; frozen after 'to' so planted feet don't slide.
const _yawCache = new Map();
function clipYaw(clip, ct) {
  const k = clip.name + ':' + ct.toFixed(4);
  if (!_yawCache.has(k)) _yawCache.set(k, facingYaw(sampleClip(clip, ct)));
  return _yawCache.get(k);
}
function unwind(T, clip, u, ct) {
  const w = smooth((ct - u.from) / (u.ramp || 0.1));
  let d = clipYaw(clip, Math.min(ct, u.to)) - clipYaw(clip, u.from);
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const a = -d * w * (u.k ?? 1);
  if (Math.abs(a) < 1e-6) return;
  const hip = T.pos.lhipjoint.clone().add(T.pos.rhipjoint).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  for (const v of Object.values(T.pos)) { const y = v.y; v.sub(hip).applyQuaternion(q).add(hip); v.y = y; }
  for (const k of Object.keys(T.quat)) T.quat[k] = q.clone().multiply(T.quat[k]);
  T.yaw += a;
}

export class Track {
  // segs: [{clip, from, to, at, rate, blend, place:{x,z,yaw}|'continue', turn, shift:[dx,dz], idle:{amp,period}}]
  constructor(clips, segs, ourLeg) {
    this.clips = clips;
    this.segs = segs.map(s => ({ rate: 1, blend: 0.3, turn: 0, ...s }));
    this.ourLeg = ourLeg;
    for (const s of this.segs) calibrate(clips[s.clip], ourLeg);
    // resolve placements sequentially
    let prevEnd = null;
    for (let i = 0; i < this.segs.length; i++) {
      const sg = this.segs[i];
      const clip = clips[sg.clip];
      const s0 = sampleCal(clip, sg.from);
      const srcHip = hipCenter(s0), srcYaw = facingYaw(s0);
      let wx, wz, wyaw;
      if (sg.place && sg.place !== 'continue') { wx = sg.place.x; wz = sg.place.z; wyaw = sg.place.yaw; }
      else {
        // align to the previous segment's pose at this segment's start time
        const pt = this.segTargets(i - 1, sg.at);
        const hip = pt.pos.lhipjoint.clone().add(pt.pos.rhipjoint).multiplyScalar(0.5);
        wx = hip.x; wz = hip.z; wyaw = pt.yaw;
      }
      if (typeof sg.yawAbs === 'function') wyaw = sg.yawAbs({ x: wx, z: wz }, sg.at);
      wyaw += sg.turn;
      if (sg.shift) { wx += sg.shift[0]; wz += sg.shift[1]; }
      sg.pl = new Placement(srcHip, srcYaw, new THREE.Vector3(wx, 0, wz), wyaw, clip.cal.scale);
      prevEnd = sg;
    }
  }
  // Shorten the horizontal travel after clip time c.from (airborne part of a jump): the body drifts only c.k of the
  // clip's distance; the offset is frozen from c.to (landing) on so planted feet don't slide.
  compress(T, sg, ct) {
    const c = sg.compress, clip = this.clips[sg.clip];
    const hipAt = (u) => { const s = sampleCal(clip, u); return sg.pl.p(hipCenter(s)); };
    if (!c._h0) c._h0 = hipAt(c.from);
    const u = Math.min(ct, c.to);
    const h = hipAt(u);
    const w = smooth((u - c.from) / (c.ramp || 0.2));
    const off = h.sub(c._h0).multiplyScalar((c.k - 1) * w); off.y = 0;
    for (const v of Object.values(T.pos)) v.add(off);
  }
  clipTime(sg, t) {
    const clip = this.clips[sg.clip];
    const dt = Math.max(0, t - sg.at);
    if (sg.idle) {
      const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * dt / sg.idle.period);
      return Math.min(sg.from + sg.idle.amp * u, clip.dur);
    }
    return Math.min(sg.from + dt * sg.rate, clip.dur);
  }
  segTargets(i, t) {
    const sg = this.segs[i];
    const clip = this.clips[sg.clip];
    const ct = this.clipTime(sg, t);
    const T = toTargets(sampleCal(clip, ct), sg.pl);
    if (sg.unwind && ct > sg.unwind.from) unwind(T, clip, sg.unwind, ct);
    if (sg.compress && ct > sg.compress.from) this.compress(T, sg, ct);
    T.src = { armLen: clip.armLen, scale: clip.cal.scale, footRest: clip.cal.footRest };
    T.planted = { L: this.planted(sg, t, 'l'), R: this.planted(sg, t, 'r') };
    return T;
  }
  // 0..1: how firmly this foot is planted in the source clip (slow + low), at the clip's effective playback speed
  planted(sg, t, s) {
    const clip = this.clips[sg.clip], e = 1 / 60, a = clip.pos[s + 'tibia'];
    const at = (ct) => { const f = THREE.MathUtils.clamp(ct * clip.fps, 0, clip.n - 1), i = Math.floor(f), j = Math.min(i + 1, clip.n - 1), u = f - i;
      return [0, 1, 2].map(c => a[i * 3 + c] + (a[j * 3 + c] - a[i * 3 + c]) * u); };
    const p0 = at(this.clipTime(sg, t - e)), p1 = at(this.clipTime(sg, t + e)), pc = at(this.clipTime(sg, t));
    const sp = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / (2 * e) * clip.cal.scale;
    const h = (pc[1] - clip.cal.minY + clip.cal.lift) * clip.cal.scale;
    return (1 - smooth((sp - 0.25) / 0.35)) * (1 - smooth((h - 0.15) / 0.05));
  }
  // targets at time t with crossfade from the previous segment
  at(t) {
    let i = 0;
    while (i + 1 < this.segs.length && this.segs[i + 1].at <= t) i++;
    const sg = this.segs[i];
    const T = this.segTargets(i, t);
    if (i > 0 && t - sg.at < sg.blend) {
      const P = this.segTargets(i - 1, t);
      const u = smooth((t - sg.at) / sg.blend);
      if (sg._turn === undefined) { // turn direction fixed at the middle of the blend
        const m = sg.at + sg.blend / 2; let d = this.segTargets(i, m).yaw - this.segTargets(i - 1, m).yaw;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sg._turn = d;
      }
      const B = blendTargets(P, T, u, sg._turn);
      B.src = {
        armLen: P.src.armLen + (T.src.armLen - P.src.armLen) * u,
        scale: P.src.scale + (T.src.scale - P.src.scale) * u,
        footRest: P.src.footRest + (T.src.footRest - P.src.footRest) * u,
      };
      return B;
    }
    return T;
  }
  hip(t) { const T = this.at(t); return T.pos.lhipjoint.clone().add(T.pos.rhipjoint).multiplyScalar(0.5); }
}
