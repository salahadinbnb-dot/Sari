// v4 phone camera: handheld, portrait. One smoothed path per shot (live from the side, a low replay angle in front,
// then behind the shooter for the shot), each a critically damped follow with a little feed-forward, plus
// deterministic hand shake that plays in sim time (so it slows down with the slow-motion replays).
import * as THREE from 'three';
import { smooth, clamp } from './motion.js';
import { SHOTS } from './timeline4.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIM = V(0, 3.05, 0);
const shake = (t, s) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.7 + s * 4.1) * 0.2;

export class PhoneCam {
  constructor(game, plan) {
    this.game = game; this.plan = plan;
    const y = game.frame('you', plan.release).p;
    this.s = V(RIM.x - y.x, 0, RIM.z - y.z).normalize(); this.n = V(-this.s.z, 0, this.s.x); if (this.n.x < 0) this.n.negate();
    this.paths = {};
    for (const sh of SHOTS) this.paths[sh.id] = this.bake(sh);
  }
  you(t) { return this.game.frame('you', t).p; }
  d1(t) { return this.game.frame('d1', t).p; }
  // ideal framing per shot at sim time t
  ideal(id, t) {
    const P = this.plan, you = this.you(t), d1 = this.d1(t), n = this.n, s = this.s;
    if (id === 'live') {
      // a friend on the right sideline, a step behind: holds both of them, then chases the ball to the rim
      const pos = you.clone().addScaledVector(n, 3.1).addScaledVector(s, -1.2); pos.y = 1.5;
      const mid = you.clone().lerp(d1, 0.4); mid.y = 0.95;
      const b = this.game.ball(Math.max(t, P.release)).pos;
      const up = smooth((t - (P.release - 0.1)) / 0.35) * (1 - 0.55 * smooth((t - (P.rim + 0.45)) / 0.8));
      const ballLook = b.clone().lerp(RIM, 0.25); ballLook.y = Math.min(ballLook.y, 2.2 + 0.45 * (ballLook.y - 2.2));
      return { pos, look: mid.lerp(ballLook, up), fov: 66 };
    }
    if (id === 'replay') {
      // low, in front and to his right: the dribble moves at knee height
      const c = n.clone().multiplyScalar(Math.cos(-0.52)).addScaledVector(s, -Math.sin(-0.52));
      const pos = you.clone().addScaledVector(c, 3.3 - 0.3 * smooth((t - 1.2) / 1.7)); pos.y = 0.8;
      const look = you.clone(); look.y = 0.8;
      return { pos, look, fov: 64 };
    }
    // behind the shooter: his back at the bottom, the rim above
    const pos = you.clone().addScaledVector(s, -2.35).addScaledVector(n, 0.45); pos.y = 1.75;
    const look = you.clone().addScaledVector(s, 3.6); look.y = 1.55 + 0.5 * smooth((t - P.release) / 0.9);
    return { pos, look, fov: 64 };
  }
  bake(sh) {
    // follow stiffness (position, aim) and look-ahead, in sim seconds: the slow replay tracks tighter, like a gimbal
    const F = { live: [1.6, 3.6, 0.25], replay: [3.0, 7.0, 0.3], rim: [2.4, 3.0, 0.15] }[sh.id];
    const dt = 1 / 240, lead = F[2], track = [];
    let pos = null, look = null; const vp = V(), vl = V();
    const step = (x, v, target, om) => { const f = 1 + 2 * dt * om, oo = om * om, hoo = dt * oo, hhoo = dt * hoo, detInv = 1 / (f + hhoo); return [(f * x + dt * v + hhoo * target) * detInv, (v + hoo * (target - x)) * detInv]; };
    const wP = F[0], wL = F[1];
    for (let t = sh.from - 0.6; t <= sh.to + 0.05; t += dt) {
      const want = this.ideal(sh.id, t + lead);
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      for (const a of ['x', 'y', 'z']) { [pos[a], vp[a]] = step(pos[a], vp[a], want.pos[a], wP); [look[a], vl[a]] = step(look[a], vl[a], want.look[a], wL); }
      track.push({ t, pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
    return { t0: sh.from - 0.6, dt, track, amp: sh.id === 'live' ? 1 : 0.55 };
  }
  at(id, st) {
    const p = this.paths[id], f = clamp((st - p.t0) / p.dt, 0, p.track.length - 1), i = Math.floor(f), j = Math.min(i + 1, p.track.length - 1), u = f - i;
    const a = p.track[i], b = p.track[j];
    const pos = a.pos.clone().lerp(b.pos, u), look = a.look.clone().lerp(b.look, u);
    // hand shake: a few mm of position, a fraction of a degree of aim and roll
    const k = p.amp, s0 = { live: 1, replay: 7, rim: 13 }[id];
    pos.x += shake(st, s0) * 0.008 * k; pos.y += shake(st, s0 + 2) * 0.006 * k; pos.z += shake(st, s0 + 4) * 0.008 * k;
    look.x += shake(st * 1.1, s0 + 6) * 0.03 * k; look.y += shake(st * 0.9, s0 + 8) * 0.025 * k;
    return { pos, look, fov: a.fov, roll: shake(st * 0.8, s0 + 10) * 0.006 * k };
  }
}
