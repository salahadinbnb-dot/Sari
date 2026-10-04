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
        // align to what the previous segment is showing at this segment's start time
        const pt = this.atIndex(i - 1, sg.at);
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
    // a jump that keeps the run-up's momentum (c.carry: world m/s): carried along over the airborne part
    if (c.carry) { const air = Math.max(0, u - c.from) / (sg.rate || 1); off.x += c.carry.x * air; off.z += c.carry.z * air; }
    for (const v of Object.values(T.pos)) v.add(off);
  }
  clipTime(sg, t) {
    const clip = this.clips[sg.clip];
    const dt = Math.max(0, t - sg.at);
    if (sg.idle) {
      const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * dt / sg.idle.period);
      return Math.min(sg.from + sg.idle.amp * u, clip.dur);
    }
    if (sg.boost) return Math.min(this.warp(sg, dt), clip.dur);
    return Math.min(sg.from + dt * sg.rate, clip.dur);
  }
  // A higher jump from the same take (seg.boost = {from, to, k, pre, hk}: toe-off and touchdown in clip time, the
  // height scale, the push-off ramp before toe-off, the horizontal scale). A ballistic flight k times as high lasts
  // sqrt(k) times as long at the same g, so the airborne part of the clip is played sqrt(k) times slower and its
  // rise over the takeoff-landing line is scaled by k. Just before toe-off the hips are taken a little lower and
  // brought up faster (the feet stay planted, the knees fold a bit more) so the takeoff speed is sqrt(k) times the
  // performer's and the flight starts without a kink. Clip time as a function of segment time:
  // (the flight always lasts sqrt(k) times the performer's at g, whatever the segment's playback rate)
  warp(sg, dt) {
    const b = sg.boost, s = Math.sqrt(b.k);
    const c0 = sg.from + dt * sg.rate;
    if (c0 <= b.from) return c0;
    const tFrom = (b.from - sg.from) / sg.rate, air = (b.to - b.from) * s;
    if (dt <= tFrom + air) return b.from + (dt - tFrom) / s;
    return b.to + (dt - tFrom - air) * sg.rate;
  }
  boostOffset(T, sg, ct) {
    const b = sg.boost, clip = this.clips[sg.clip], s = Math.sqrt(b.k), pre = b.pre ?? 0.08, hk = b.hk ?? 1;
    if (ct < b.from - pre) return;
    if (!b._hip) {
      const H = (u) => sg.pl.p(hipCenter(sampleCal(clip, u)));
      b._hip = H; b._h0 = H(b.from); b._h1 = H(b.to);
    }
    let dy = 0, dx = 0, dz = 0, legs = true;
    if (ct < b.from) { // push-off: hips lower then faster up, feet planted (takeoff speed: s times the performer's)
      const h = b._hip(ct), w = smooth((ct - (b.from - pre)) / pre);
      dy = (s / sg.rate - 1) * w * (h.y - b._h0.y); legs = false;
    } else if (ct <= b.to) {
      const h = b._hip(ct), u = (ct - b.from) / (b.to - b.from), base = b._h0.y + (b._h1.y - b._h0.y) * u;
      dy = (b.k - 1) * (h.y - base);
      // hk 1: the same distance (a slower drift), hk = sqrt(k): the same horizontal speed (a longer flight)
      dx = (hk - 1) * (h.x - b._h0.x); dz = (hk - 1) * (h.z - b._h0.z);
    } else { dx = (hk - 1) * (b._h1.x - b._h0.x); dz = (hk - 1) * (b._h1.z - b._h0.z); } // landed further on
    if (!dy && !dx && !dz) return;
    for (const [k, v] of Object.entries(T.pos)) {
      if (!legs && /femur|tibia|foot|toes/.test(k)) continue;
      v.y += dy; v.x += dx; v.z += dz;
    }
  }
  segTargets(i, t) {
    const sg = this.segs[i];
    const clip = this.clips[sg.clip];
    const ct = this.clipTime(sg, t);
    const T = toTargets(sampleCal(clip, ct), sg.pl);
    if (sg.unwind && ct > sg.unwind.from) unwind(T, clip, sg.unwind, ct);
    if (sg.compress && ct > sg.compress.from) this.compress(T, sg, ct);
    if (sg.boost) this.boostOffset(T, sg, ct);
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
    return this.atIndex(i, t);
  }
  // segment i at time t, crossfaded from whatever the previous segment was showing (which may itself still be
  // mid-crossfade when this one starts, so blends nest instead of restarting from an un-blended pose)
  atIndex(i, t) {
    const sg = this.segs[i];
    const T = this.segTargets(i, t);
    if (i > 0 && sg.inert && t >= sg.at && t - sg.at < sg.inert) return this.inertialize(i, t, T);
    if (i > 0 && !sg.inert && t - sg.at < sg.blend) {
      const P = this.atIndex(i - 1, t);
      const u = smooth((t - sg.at) / sg.blend);
      if (sg._turn === undefined) { // turn direction fixed at the middle of the blend
        const m = sg.at + sg.blend / 2; let d = this.segTargets(i, m).yaw - this.atIndex(i - 1, m).yaw;
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
  // Inertialized cut (seg.inert = settle time in s): the new segment plays from its first frame and only the
  // difference to where the old one was - pose offset and velocity - is carried over and dies away like a
  // critically damped spring. Unlike a crossfade nothing is averaged, so the new motion keeps its own timing
  // and footwork.
  inertialize(i, t, T) {
    const sg = this.segs[i];
    if (!sg._off) {
      const t0 = sg.at, h = 1 / 120;
      const P0 = this.atIndex(i - 1, t0), Pm = this.atIndex(i - 1, t0 - h), N0 = this.segTargets(i, t0), Np = this.segTargets(i, t0 + h);
      const off = { pos: {}, vel: {}, quat: {}, yaw: 0 };
      for (const k of Object.keys(N0.pos)) {
        off.pos[k] = P0.pos[k].clone().sub(N0.pos[k]);
        off.vel[k] = P0.pos[k].clone().sub(Pm.pos[k]).sub(Np.pos[k].clone().sub(N0.pos[k])).multiplyScalar(1 / h);
      }
      for (const k of Object.keys(N0.quat)) off.quat[k] = P0.quat[k].clone().multiply(N0.quat[k].clone().invert());
      let d = P0.yaw - N0.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; off.yaw = d;
      sg._off = off;
    }
    const o = sg._off, tau = t - sg.at, lam = 6.6 / sg.inert, e = Math.exp(-lam * tau), k = (1 + lam * tau) * e;
    for (const j of Object.keys(T.pos)) T.pos[j].addScaledVector(o.pos[j], k).addScaledVector(o.vel[j], tau * e);
    const I = new THREE.Quaternion();
    for (const j of Object.keys(T.quat)) T.quat[j] = I.clone().slerp(o.quat[j], k).multiply(T.quat[j]);
    T.yaw += o.yaw * k;
    return T;
  }
  hip(t) { const T = this.at(t); return T.pos.lhipjoint.clone().add(T.pos.rhipjoint).multiplyScalar(0.5); }
}
