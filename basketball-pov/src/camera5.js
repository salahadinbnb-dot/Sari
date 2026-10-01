// v5 cameras (portrait). duel: three-quarter view of the shooter and his defender, wide enough to keep the
// defender's feet and the floor meter in frame; rim: beside the rim for the result; finish: from the weak side of the
// lane for the drive, the contact and the layup. Smoothed per rep with a critically damped follow and a look-ahead.
import * as THREE from 'three';
import { smooth, clamp } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIM = V(0, 3.05, 0);

export class Cam5 {
  constructor(reps) {
    this.reps = reps; this.paths = {};
    for (const [name, rep] of Object.entries(reps)) for (const mode of rep.plan.contact ? ['finish'] : ['duel', 'rim']) this.paths[name + ':' + mode] = this.bake(rep, mode);
  }
  ideal(rep, mode, t) {
    const y = rep.frame('you', t).p, d = rep.frame('d1', t).p;
    if (mode === 'duel') {
      // three-quarter view from the sideline side (camAngle swings it round behind the shooter), just under head
      // height, pulled back to keep both of them in the narrow frame, tilted so their feet sit at the same place
      // on screen whatever the distance (above the timing strip, with the floor meter in view)
      const A = rep.plan.camAngle ?? 0.6, HC = 1.75, FEET = 14.3 * Math.PI / 180;
      const mid = y.clone().lerp(d, 0.5), line = d.clone().sub(y); const sep = line.length(); line.normalize();
      let n = V(-line.z, 0, line.x); if (n.x < 0) n.negate();          // the sideline side
      const back = line.clone().negate(), dir = n.clone().multiplyScalar(Math.cos(A)).addScaledVector(back, Math.sin(A)).normalize();
      const dist = Math.max(4.1, (sep * Math.cos(A) + 1.5) / 0.573);
      const pos = mid.clone().addScaledVector(dir, dist); pos.y = HC;
      const look = mid.clone(); look.y = HC - dist * Math.tan(Math.atan(HC / dist) - FEET);
      return { pos, look, fov: 54 };
    }
    if (mode === 'rim') {
      // off to the side of the rim on the shooter's half, a little under it: the ball crosses the frame and drops in
      const r0 = rep.frame('you', rep.plan.release).p, s = V(r0.x, 0, r0.z).normalize();
      const n = V(-s.z, 0, s.x); if (n.x < 0) n.negate();
      const pos = s.clone().multiplyScalar(1.3).addScaledVector(n, 2.4); pos.y = 1.85;
      const look = RIM.clone().add(V(0, -0.3, 0)).addScaledVector(s, 0.25);
      return { pos, look, fov: 54 };
    }
    // finish: low on the weak side of the lane, facing the drive: he comes at the camera, the help defender slides in
    // from the right and meets his left shoulder side-on; the pan settles between the contact and the rim for the finish
    const c = rep.plan.contact, pos = V(-3.1, 1.65, 1.5);
    const mid = y.clone().lerp(d, 0.5); mid.y = 1.25;
    const u = smooth((t - 0.7) / (c.t + 0.15 - 0.7));
    return { pos, look: mid.lerp(V(0.55, 1.95, 0.55), u), fov: 58 };
  }
  bake(rep, mode) {
    const dt = 1 / 240, lead = mode === 'duel' ? 0.3 : 0.2, track = [], end = rep.plan.simEnd, wp = mode === 'duel' ? 3.2 : 2.2, wl = mode === 'duel' ? 4.2 : 3.4;
    let pos = null, look = null; const vp = V(), vl = V();
    const step = (x, v, target, om) => { const f = 1 + 2 * dt * om, oo = om * om, hoo = dt * oo, hhoo = dt * hoo, detInv = 1 / (f + hhoo); return [(f * x + dt * v + hhoo * target) * detInv, (v + hoo * (target - x)) * detInv]; };
    for (let t = 0; t <= end + 1e-6; t += dt) {
      const want = this.ideal(rep, mode, Math.min(t + lead, end));
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      for (const a of ['x', 'y', 'z']) { [pos[a], vp[a]] = step(pos[a], vp[a], want.pos[a], wp); [look[a], vl[a]] = step(look[a], vl[a], want.look[a], wl); }
      track.push({ pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
    return { dt, track };
  }
  at(repName, mode, st) {
    const p = this.paths[repName + ':' + mode], f = clamp(st / p.dt, 0, p.track.length - 1), i = Math.floor(f), j = Math.min(i + 1, p.track.length - 1), u = f - i;
    const a = p.track[i], b = p.track[j];
    return { pos: a.pos.clone().lerp(b.pos, u), look: a.look.clone().lerp(b.look, u), fov: a.fov };
  }
}
