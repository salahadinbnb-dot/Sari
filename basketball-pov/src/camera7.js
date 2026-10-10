// v7 cameras (portrait). over: behind you (the defender), off your right shoulder, looking at the ball handler - what
// you see, with your hand in the picture; side: square to the line between you and him, waist high; chase: behind
// and above a drive, following it; high: up over the passing lane. Smoothed per rep with a critically damped follow.
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Cam7 {
  constructor(reps) {
    this.reps = reps; this.paths = {};
    for (const [name, rep] of Object.entries(reps)) for (const mode of ['over', 'side', 'chase', 'low'].concat(rep.passLine ? ['high'] : [])) this.paths[name + ':' + mode] = this.bake(rep, mode);
  }
  ideal(rep, mode, t) {
    const C = rep.plan.cam || {}, b = rep.frame('bh', t), d = rep.frame('df', t);
    const mid = b.p.clone().lerp(d.p, 0.5), line = b.p.clone().sub(d.p).setY(0).normalize(), n = V(-line.z, 0, line.x);
    if (mode === 'over') {
      // behind the defender, a little to his right (C.overSide: -1 for his left), looking past him at the dribbler
      const s = C.overSide ?? 1, back = C.overBack ?? 2.3;
      const pos = d.p.clone().addScaledVector(line, -back).addScaledVector(n, -s * (C.overOff ?? 0.95)); pos.y = C.overH ?? 1.8;
      const look = d.p.clone().lerp(b.p, 0.62); look.y = C.overLook ?? 0.95;
      // after a steal, the loose ball pulls the camera's eye
      const ts = rep.strike && rep.strike.t;
      if (ts !== undefined && t > ts) { const B = rep.ball(t).pos, u = 0.55 * smooth((t - ts) / 0.4); look.lerp(V(B.x, Math.min(B.y, 1.0), B.z), u); pos.addScaledVector(n, -0.6 * u); }
      return { pos, look, fov: C.overFov ?? 50 };
    }
    if (mode === 'side') {
      // square to the line between them, from the side the plan picks (C.sideSign), framing both
      const s = C.sideSign ?? 1, dist = C.sideDist ?? 4.2;
      const pos = mid.clone().addScaledVector(n, s * dist); pos.y = C.sideH ?? 1.25;
      const look = mid.clone(); look.y = C.sideLook ?? 0.9;
      return { pos, look, fov: C.sideFov ?? 48 };
    }
    if (mode === 'chase') {
      // behind the drive and up, following both of them
      const f = b.f, pos = mid.clone().addScaledVector(f, -(C.chaseBack ?? 3.4)).addScaledVector(V(-f.z, 0, f.x), C.chaseSide ?? 1.2); pos.y = C.chaseH ?? 2.6;
      const look = mid.clone().addScaledVector(f, 0.8); look.y = 0.8;
      return { pos, look, fov: C.chaseFov ?? 52 };
    }
    if (mode === 'low') {
      // low, in front of the dribbler and off to the side: the ball at eye level
      const s = C.lowSide ?? 1, pos = b.p.clone().addScaledVector(line, -1.2).addScaledVector(n, s * 2.4); pos.y = 0.75;
      const look = b.p.clone().lerp(d.p, 0.45); look.y = 0.8;
      return { pos, look, fov: 46 };
    }
    // high: up behind the passer, looking down the pass at the receiver - the pass runs up the tall frame, you come
    // into it from the side
    const L = rep.passLine, u = L.to.clone().sub(L.from).setY(0).normalize(), side = C.highSide ?? 0;
    const pos = L.from.clone().setY(0).addScaledVector(u, -(C.highBack ?? 3.2)).addScaledVector(V(-u.z, 0, u.x), side); pos.y = C.highH ?? 4.2;
    const look = L.from.clone().lerp(L.to, C.highLook ?? 0.62).addScaledVector(V(-u.z, 0, u.x), side * 0.7); look.y = 0.5;
    return { pos, look, fov: C.highFov ?? 52 };
  }
  bake(rep, mode) {
    const dt = 1 / 240, lead = 0.15, track = [], end = rep.plan.simEnd, wp = 3.0, wl = 4.0;
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
