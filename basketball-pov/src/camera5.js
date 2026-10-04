// v5 cameras (portrait). duel: three-quarter view of the shooter and his defender, wide enough to keep the
// defender's feet and the floor meter in frame; rim: beside the rim for the result; finish: from the baseline for the
// drive, the contact and the layup. Smoothed per rep with a critically damped follow and a look-ahead.
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
      // three-quarter view from one side (camAngle swings it round behind the shooter), just under head height,
      // pulled back to keep both of them in the narrow frame, tilted so their feet sit at the same place on screen
      // whatever the distance (above the timing strip, with the floor meter in view). The side is fixed per rep
      // from the line between them at camRef, so the camera never swings across them when the defender slides.
      const A = rep.plan.camAngle ?? 0.6, HC = 1.75, FEET = 14.3 * Math.PI / 180;
      if (!rep._camDir) {
        const tr = rep.plan.camRef ?? rep.plan.release, y0 = rep.frame('you', tr).p, d0 = rep.frame('d1', tr).p, l0 = d0.clone().sub(y0).normalize();
        let n = V(-l0.z, 0, l0.x); if (n.x < 0) n.negate();
        rep._camDir = n.multiplyScalar(Math.cos(A)).addScaledVector(l0.clone().negate(), Math.sin(A)).normalize();
      }
      const dir = rep._camDir, mid = y.clone().lerp(d, 0.5), across = Math.abs(d.clone().sub(y).dot(V(-dir.z, 0, dir.x)));
      const dist = Math.max(4.1, (across + 1.5) / 0.573);
      const pos = mid.clone().addScaledVector(dir, dist); pos.y = HC;
      const look = mid.clone(); look.y = HC - dist * Math.tan(Math.atan(HC / dist) - FEET);
      // through the shot it tilts up so the set, the release and the follow-through stay in the picture
      const P = rep.plan;
      // and pushes in a little toward the shooter, so the form is big enough to read
      let fov = 54;
      if (P.setAt !== undefined && !P.contact) {
        const up = smooth((t - (P.setAt - 0.55)) / 0.4) * (1 - smooth((t - (P.land + 0.15)) / 0.4));
        const k = P.camPush ?? 1; // less where the defender is further off and has to stay in the picture
        look.y += 0.8 * up; pos.y += 0.25 * up; fov -= 9 * up * k;
        const yy = y.clone().setY(look.y); look.lerp(yy, 0.3 * up * k);
      }
      return { pos, look, fov };
    }
    if (mode === 'rim') {
      // off to the side of the rim on the shooter's half, a little under it: the ball crosses the frame and drops in
      const r0 = rep.frame('you', rep.plan.release).p, s = V(r0.x, 0, r0.z).normalize();
      const n = V(-s.z, 0, s.x); if (n.x < 0) n.negate();
      const pos = s.clone().multiplyScalar(1.3).addScaledVector(n, 2.4); pos.y = 1.85;
      const look = RIM.clone().add(V(0, -0.3, 0)).addScaledVector(s, 0.25);
      return { pos, look, fov: 54 };
    }
    // finish: from the baseline, low, just right of the stanchion and facing up the lane: he drives at the camera, the help
    // defender slides in from the side and takes the shoulder side-on; after the contact it tilts up to the glass.
    // Tight on the setup while they're far away, widening as the drive comes in.
    const c = rep.plan.contact, pos = V(1.25, 1.45, -3.05);
    const mid = y.clone().lerp(d, 0.5); mid.y = 1.2;
    const u = smooth((t - (c.t + 0.05)) / (rep.plan.release + 0.15 - c.t));
    return { pos, look: mid.lerp(V(0.5, 2.3, 0.35), u), fov: 48 + 10 * smooth((t - 0.3) / (c.t - 0.3)) + 4 * u };
  }
  bake(rep, mode) {
    const dt = 1 / 240, lead = mode === 'duel' ? 0.3 : 0.2, track = [], end = rep.plan.simEnd, wp = mode === 'duel' ? 3.2 : 2.2, wl = { duel: 4.2, rim: 3.4, finish: 5.5 }[mode];
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
