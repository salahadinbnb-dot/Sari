// v6 cameras (portrait). side: on his right, square to the run-up, tracking him at hip height (he runs left to right
// toward the hoop); rim: low by the baseline, looking up past the rim as he rises into it; replay: from his left and
// above, level with the rim. Smoothed per rep with a critically damped follow and a look-ahead; a jolt at the slam.
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIM = V(0, 3.05, 0);

export class Cam6 {
  constructor(reps) {
    this.reps = reps; this.paths = {};
    for (const [name, rep] of Object.entries(reps)) for (const mode of ['side', 'rim', 'replay']) this.paths[name + ':' + mode] = this.bake(rep, mode);
  }
  // the run-up line (start -> takeoff), its right-hand normal
  line(rep) {
    if (!rep._line) {
      const a = rep.tab('hip', 0.3), b = rep.tab('hip', rep.k.off), f = V(b.x - a.x, 0, b.z - a.z).normalize();
      rep._line = { a, b, f, n: V(-f.z, 0, f.x) };
    }
    return rep._line;
  }
  ideal(rep, mode, t) {
    const k = rep.k, h = rep.tab('hip', t), L = this.line(rep);
    if (mode === 'side') {
      // square to the run-up, ~6 m off; it pans with him and settles where it can see the plant, the jump and the
      // rim; tilts up as he goes up
      const toff = rep.tab('hip', k.off), u = smooth((t - (k.off - 0.6)) / 0.7);
      const c = h.clone().lerp(toff.clone().addScaledVector(L.f, 0.25), u);
      const dist = 5.6 + 0.7 * u;
      const pos = c.clone().addScaledVector(L.n, dist).addScaledVector(L.f, -0.4 + 0.3 * u); pos.y = 1.25 + 0.2 * u;
      const look = c.clone().addScaledVector(L.f, 0.35 * (1 - u)); look.y = 1.05 + 0.45 * u;
      return { pos, look, fov: 50 + 4 * u };
    }
    if (mode === 'rim') {
      // low, behind the baseline on the right of the hoop, looking up across the front of the rim
      const pos = V(2.45, 0.95, -2.05);
      const ap = rep.tab('hip', k.apex), look = ap.clone().lerp(RIM, 0.55); look.y = 2.35 + 0.25 * smooth((t - k.off) / 0.4);
      return { pos, look, fov: 64 };
    }
    // replay: from his left, a little in front, up at rim height; follows him up to the rim
    const u = smooth((t - (k.off - 0.15)) / 0.45), hip = rep.tab('hip', t);
    const pos = RIM.clone().addScaledVector(L.n, -3.4).addScaledVector(L.f, -1.5); pos.y = 2.2 + 0.55 * u;
    const look = hip.clone().lerp(RIM, 0.08 + 0.42 * u); look.y = hip.y + 0.55 + (2.5 - hip.y - 0.55) * u;
    return { pos, look, fov: 54 };
  }
  bake(rep, mode) {
    const dt = 1 / 240, lead = mode === 'side' ? 0.18 : 0.1, track = [], end = rep.plan.simEnd, wp = mode === 'side' ? 4.5 : 3, wl = mode === 'side' ? 5.5 : 4.5;
    let pos = null, look = null; const vp = V(), vl = V();
    const step = (x, v, target, om) => { const f = 1 + 2 * dt * om, oo = om * om, hoo = dt * oo, hhoo = dt * hoo, detInv = 1 / (f + hhoo); return [(f * x + dt * v + hhoo * target) * detInv, (v + hoo * (target - x)) * detInv]; };
    // (the replay is only ever seen from just before the takeoff: start its follow there, settled)
    const t0 = mode === 'replay' ? rep.k.off - 0.45 : 0;
    for (let t = 0; t <= end + 1e-6; t += dt) {
      const want = this.ideal(rep, mode, Math.min(Math.max(t, t0) + lead, end));
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      for (const a of ['x', 'y', 'z']) { [pos[a], vp[a]] = step(pos[a], vp[a], want.pos[a], wp); [look[a], vl[a]] = step(look[a], vl[a], want.look[a], wl); }
      track.push({ pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
    return { dt, track };
  }
  at(repName, mode, st) {
    const p = this.paths[repName + ':' + mode], f = clamp(st / p.dt, 0, p.track.length - 1), i = Math.floor(f), j = Math.min(i + 1, p.track.length - 1), u = f - i;
    const a = p.track[i], b = p.track[j], rep = this.reps[repName];
    const out = { pos: a.pos.clone().lerp(b.pos, u), look: a.look.clone().lerp(b.look, u), fov: a.fov };
    // the slam jolts the camera (a few cm, dying away in a quarter second)
    if (rep.plan.kind === 'dunk') {
      const tau = st - rep.d.grab;
      if (tau > 0 && tau < 0.5) { const e = Math.exp(-9 * tau), s = mode === 'rim' ? 0.05 : 0.025; out.pos.add(V(Math.sin(tau * 71) * s * e, Math.sin(tau * 53 + 1) * s * e, Math.sin(tau * 61 + 2) * s * e)); out.roll = Math.sin(tau * 47) * 0.012 * e; }
    }
    return out;
  }
}
