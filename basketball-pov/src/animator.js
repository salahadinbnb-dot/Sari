// Sequences mocap clip segments per player with crossfades and world placement.
import * as THREE from 'three';
import { sampleClip, facingYaw, hipCenter, Placement, toTargets, blendTargets } from './mocap.js';

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// per-clip calibration: floor height, foot rest angle, scale for a given leg length
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
  clip.cal = { ourLeg, minY, footRest, scale: ourLeg / clip.legLen };
  return clip.cal;
}

function sampleCal(clip, t) {
  const s = sampleClip(clip, t);
  for (const k of Object.keys(s.pos)) s.pos[k].y -= clip.cal.minY;
  return s;
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
    const T = toTargets(sampleCal(clip, this.clipTime(sg, t)), sg.pl);
    T.src = { armLen: clip.armLen, scale: clip.cal.scale, footRest: clip.cal.footRest };
    return T;
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
      const B = blendTargets(P, T, u);
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
