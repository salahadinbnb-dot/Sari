// Deterministic motion synthesis: root paths, facing, stances, footstep planning.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
export function lerpAng(a, b, t) { return a + angDiff(a, b) * t; }
export const fwdOf = (yaw) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
export const leftOf = (yaw) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
export const yawOf = (dx, dz) => Math.atan2(dx, dz);

// ---------- Hermite path through timed keys: [t, x, z, stop?] ----------
export class Path {
  constructor(keys) {
    this.k = keys.map(k => ({ t: k[0], x: k[1], z: k[2], stop: !!k[3] }));
    const k = this.k;
    for (let i = 0; i < k.length; i++) {
      if (k[i].stop || i === 0 || i === k.length - 1) { k[i].vx = 0; k[i].vz = 0; continue; }
      const a = k[i - 1], b = k[i + 1];
      const dt = b.t - a.t;
      k[i].vx = (b.x - a.x) / dt; k[i].vz = (b.z - a.z) / dt;
    }
    // first/last keys: allow explicit non-stop to keep moving
    if (!keys[0][3] && k.length > 1 && keys[0][4] === 'moving') { k[0].vx = (k[1].x - k[0].x) / (k[1].t - k[0].t); k[0].vz = (k[1].z - k[0].z) / (k[1].t - k[0].t); }
  }
  at(t) {
    const k = this.k;
    if (t <= k[0].t) return { x: k[0].x, z: k[0].z };
    if (t >= k[k.length - 1].t) { const e = k[k.length - 1]; return { x: e.x, z: e.z }; }
    let i = 0; while (k[i + 1].t < t) i++;
    const a = k[i], b = k[i + 1], h = b.t - a.t, s = (t - a.t) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return { x: h00 * a.x + h10 * h * a.vx + h01 * b.x + h11 * h * b.vx, z: h00 * a.z + h10 * h * a.vz + h01 * b.z + h11 * h * b.vz };
  }
  vel(t, e = 1 / 240) { const a = this.at(t - e), b = this.at(t + e); return { x: (b.x - a.x) / (2 * e), z: (b.z - a.z) / (2 * e) }; }
}

// keyed scalar/angle tracks with smooth blends: [[t, value], ...] ; value held, blended over `blend` seconds before next key time
export function keyed(keys, blend = 0.25, isAngle = false) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    let i = 0; while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
    if (i + 1 >= keys.length) return keys[i][1];
    const [t1, v1] = keys[i + 1]; const v0 = keys[i][1];
    const b = keys[i + 1][2] ?? blend;
    if (t < t1 - b) return v0;
    const u = smooth((t - (t1 - b)) / b);
    return isAngle ? lerpAng(v0, v1, u) : (typeof v0 === 'number' ? lerp(v0, v1, u) : (u < 0.5 ? v0 : v1));
  };
}

// ---------- stances ----------
export const STANCES = {
  upright:  { hipF: 0.965, width: 0.17, stagL: 0.0, stagR: 0.0, toe: 0.14, lean: 0.06 },
  athletic: { hipF: 0.905, width: 0.25, stagL: 0.05, stagR: -0.08, toe: 0.2, lean: 0.24 },
  triple:   { hipF: 0.885, width: 0.26, stagL: 0.1, stagR: -0.1, toe: 0.22, lean: 0.3 },
  dribble:  { hipF: 0.885, width: 0.25, stagL: 0.06, stagR: -0.06, toe: 0.2, lean: 0.3 },
  defense:  { hipF: 0.81, width: 0.31, stagL: -0.02, stagR: 0.08, toe: 0.3, lean: 0.34 },
  help:     { hipF: 0.85, width: 0.29, stagL: 0.03, stagR: 0.03, toe: 0.28, lean: 0.28 },
  screen:   { hipF: 0.89, width: 0.33, stagL: 0.0, stagR: 0.0, toe: 0.22, lean: 0.12 },
  wing:     { hipF: 0.93, width: 0.22, stagL: 0.03, stagR: -0.03, toe: 0.18, lean: 0.16 },
};
export function stanceBlend(a, b, u) {
  const o = {}; for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], u); return o;
}
export function stanceTrack(keys, blend = 0.3) {
  return (t) => {
    if (t <= keys[0][0]) return STANCES[keys[0][1]];
    let i = 0; while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
    if (i + 1 >= keys.length) return STANCES[keys[i][1]];
    const [t1, n1, b1] = keys[i + 1]; const b = b1 ?? blend;
    if (t < t1 - b) return STANCES[keys[i][1]];
    return stanceBlend(STANCES[keys[i][1]], STANCES[n1], smooth((t - (t1 - b)) / b));
  };
}

// ---------- footstep planner ----------
// P: { scale, path:Path, yaw(t), stance(t), footOverride(side,t)->{pos,yaw,pitch}|null, gait:'run'|'slide'... }
export function planFeet(P, t0, t1, dt = 1 / 120) {
  const s = P.scale;
  const ank = 0.098 * s;
  const legLen = 0.8 * s;
  const ideal = (side, t) => {
    const st = P.stance(t);
    const p = P.path.at(t); const yaw = P.yaw(t);
    const f = fwdOf(yaw), l = leftOf(yaw);
    const sg = side === 'L' ? 1 : -1;
    const stag = side === 'L' ? st.stagL : st.stagR;
    const pos = new THREE.Vector3(p.x, ank, p.z).addScaledVector(l, sg * st.width * s).addScaledVector(f, stag * s);
    return { pos, yaw: yaw + sg * st.toe };
  };
  const feet = {};
  for (const side of ['L', 'R']) { const i = ideal(side, t0); feet[side] = { planted: true, pos: i.pos, yaw: i.yaw, ev: null }; }
  const events = { L: [], R: [] };
  let lastLift = -10, lastSide = 'R';
  for (let t = t0; t <= t1 + 1e-9; t += dt) {
    const v = P.path.vel(t); const speed = Math.hypot(v.x, v.z);
    const yaw = P.yaw(t);
    // finish swings
    for (const side of ['L', 'R']) {
      const F = feet[side];
      if (!F.planted && t >= F.ev.tLand) { F.planted = true; F.pos = F.ev.to.clone(); F.yaw = F.ev.toYaw; }
    }
    // overrides (jab steps etc.) are handled at eval time; planner freezes that foot during override windows
    const moving = speed > 0.3;
    const g = gaitParams(speed, P.gait ? P.gait(t) : 'run');
    const canLift = (side) => {
      const F = feet[side], O = feet[side === 'L' ? 'R' : 'L'];
      if (!F.planted) return false;
      if (P.footOverride && P.footOverride(side, t + 0.02)) return false;
      if (!O.planted) { const u = (t - O.ev.tLift) / (O.ev.tLand - O.ev.tLift); if (u < g.overlap) return false; }
      return true;
    };
    const errOf = (side, tt) => { const i = ideal(side, tt); return { d: i.pos.distanceTo(feet[side].pos), dy: Math.abs(angDiff(feet[side].yaw, i.yaw)) }; };
    let lift = null;
    // reach trigger: a planted foot that is about to be left behind must step now
    {
      const hp = P.path.at(t + 0.04);
      let worst = null, wd = 0.5 * legLen;
      for (const side of ['L', 'R']) {
        const F = feet[side]; if (!F.planted) continue;
        const O = feet[side === 'L' ? 'R' : 'L'];
        if (!O.planted) { const u = (t - O.ev.tLift) / (O.ev.tLand - O.ev.tLift); if (u < 0.45) continue; }
        if (P.footOverride && P.footOverride(side, t + 0.02)) continue;
        const d = Math.hypot(F.pos.x - hp.x, F.pos.z - hp.z);
        if (d > wd) { wd = d; worst = side; }
      }
      if (worst && t - lastLift > 0.09) lift = worst;
    }
    if (lift) { /* reach step */ } else if (moving) {
      if (t - lastLift >= g.interval) {
        let side = lastSide === 'L' ? 'R' : 'L';
        if (t - lastLift > g.interval * 2.5) {
          // starting from rest: lead with foot on the side of travel (slides) or whichever is farther from its future ideal
          const lat = v.x * leftOf(yaw).x + v.z * leftOf(yaw).z;
          const fw = v.x * fwdOf(yaw).x + v.z * fwdOf(yaw).z;
          if (Math.abs(lat) > Math.abs(fw) * 0.8) side = lat > 0 ? 'L' : 'R';
          else side = errOf('L', t + 0.3).d > errOf('R', t + 0.3).d ? 'L' : 'R';
        }
        if (canLift(side) && errOf(side, t + g.swing).d > 0.05 * s) lift = side;
      }
    } else if (t - lastLift > 0.16) {
      let best = null, bestE = 0;
      for (const side of ['L', 'R']) {
        if (!canLift(side)) continue;
        const e = errOf(side, t + 0.2);
        const score = e.d / (0.1 * s) + e.dy / 0.4;
        if (score > 1 && score > bestE && (feet[side === 'L' ? 'R' : 'L'].planted)) { best = side; bestE = score; }
      }
      lift = best;
    }
    if (lift) {
      const F = feet[lift];
      const sw = moving ? g.swing : 0.24;
      const tLand = t + sw;
      const I = ideal(lift, tLand);
      const vl = P.path.vel(tLand);
      const lead = moving ? g.lead : 0;
      const to = I.pos.clone().add(new THREE.Vector3(vl.x, 0, vl.z).multiplyScalar(lead));
      // keep within reach of hip at landing
      const hp = P.path.at(tLand);
      const hor = new THREE.Vector3(to.x - hp.x, 0, to.z - hp.z);
      const maxH = 0.62 * legLen;
      if (hor.length() > maxH) { hor.setLength(maxH); to.x = hp.x + hor.x; to.z = hp.z + hor.z; }
      F.planted = false;
      F.ev = { side: lift, tLift: t, tLand, from: F.pos.clone(), to, fromYaw: F.yaw, toYaw: I.yaw, h: (moving ? g.height : 0.045) * s, run: speed > 3.0, speed };
      events[lift].push(F.ev);
      lastLift = t; lastSide = lift;
    }
  }
  return { events, ank, ideal };
}

function gaitParams(v, gait) {
  const u = clamp((v - 0.3) / 3.7, 0, 1);
  if (gait === 'slide') {
    return { interval: lerp(0.25, 0.165, u), swing: lerp(0.2, 0.145, u), overlap: 0.9, lead: 0.02, height: lerp(0.05, 0.07, u) };
  }
  if (gait === 'back') {
    return { interval: lerp(0.32, 0.22, u), swing: lerp(0.26, 0.19, u), overlap: 0.9, lead: 0.03, height: 0.06 };
  }
  return { interval: lerp(0.3, 0.205, u), swing: lerp(0.23, 0.29, u), overlap: lerp(0.95, 0.5, u), lead: 0.065, height: lerp(0.07, 0.16, u) };
}

// evaluate foot pose at time t from planned events (heel lift anticipation included)
export function footAt(plan, side, t, override) {
  if (override) return override;
  const evs = plan.events[side];
  let prev = null, cur = null, next = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (t >= e.tLift && t < e.tLand) { cur = e; break; }
    if (e.tLift > t) { next = e; break; }
    prev = e;
  }
  if (cur) {
    const u = (t - cur.tLift) / (cur.tLand - cur.tLift);
    const e = smoother(u);
    const pos = cur.from.clone().lerp(cur.to, e);
    const lift = Math.sin(Math.PI * clamp(u * 1.05, 0, 1));
    pos.y += cur.h * lift * (cur.run ? (u < 0.5 ? 1.0 : 1.0) : 1);
    // running: foot trails up behind early in swing
    let pitch;
    if (cur.run) pitch = u < 0.35 ? lerp(0.75, 0.35, u / 0.35) : u < 0.85 ? lerp(0.35, -0.12, (u - 0.35) / 0.5) : lerp(-0.12, 0, (u - 0.85) / 0.15);
    else pitch = u < 0.3 ? lerp(0.35, 0.12, u / 0.3) : u < 0.85 ? lerp(0.12, -0.08, (u - 0.3) / 0.55) : lerp(-0.08, 0, (u - 0.85) / 0.15);
    if (cur.run) pos.y += 0.05 * Math.sin(Math.PI * clamp(u * 1.4, 0, 1));
    return { pos, yaw: lerpAng(cur.fromYaw, cur.toYaw, e), pitch, toeBend: cur.run && u < 0.3 ? 0.4 * (1 - u / 0.3) : 0, swinging: true, u };
  }
  // planted
  const base = prev ? { pos: prev.to.clone(), yaw: prev.toYaw } : null;
  let pos, yaw;
  if (base) { pos = base.pos; yaw = base.yaw; }
  else if (next) { pos = next.from.clone(); yaw = next.fromYaw; }
  else { pos = plan.ideal(side, t).pos; yaw = plan.ideal(side, t).yaw; }
  let pitch = 0, toeBend = 0;
  if (next) {
    const lead = next.run ? 0.14 : 0.1;
    const a = clamp(1 - (next.tLift - t) / lead, 0, 1);
    pitch = (next.run ? 0.75 : 0.35) * smooth(a);
    toeBend = pitch * 0.9;
    pos = pos.clone(); pos.y += Math.sin(pitch) * 0.13 * (plan.ank / 0.098 / 1.0) * 1.0;
  }
  return { pos, yaw, pitch, toeBend, swinging: false };
}
