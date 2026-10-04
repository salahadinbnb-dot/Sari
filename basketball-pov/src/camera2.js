// v2: behind-the-ball-handler camera following YOU's mocap hips (critically damped), plus freeze analysis cams.
import * as THREE from 'three';
import { SIM_END, RIM } from './timeline2.js';
import { clamp, smooth } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// aim point behind the rim: the camera direction settles instead of whipping around as he reaches the basket
const AIM = V(0.15, 0, -2.4);

export class CamRig2 {
  constructor(game) {
    this.game = game;
    const dt = 1 / 120;
    this.dt = dt;
    this.track = [];
    let pos = null, look = null;
    const vp = V(), vl = V();
    const omega = 3.1;
    const step = (x, v, target, w) => {
      const f = 1 + 2 * dt * w, oo = w * w, hoo = dt * oo, hhoo = dt * hoo;
      const detInv = 1 / (f + hhoo);
      return [(f * x + dt * v + hhoo * target) * detInv, (v + hoo * (target - x)) * detInv];
    };
    for (let t = 0; t <= SIM_END + 1e-6; t += dt) {
      const want = this.ideal(t);
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      for (const ax of ['x', 'y', 'z']) {
        [pos[ax], vp[ax]] = step(pos[ax], vp[ax], want.pos[ax], omega);
        [look[ax], vl[ax]] = step(look[ax], vl[ax], want.look[ax], omega * 1.3);
      }
      this.track.push({ pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
  }
  ideal(t) {
    const F = this.game.frame('you', Math.min(t, SIM_END));
    const p = F.p;
    const dist = Math.hypot(p.x - RIM.x, p.z - RIM.z);
    const dir = AIM.clone().sub(p); dir.y = 0; dir.normalize();
    const right = V(-dir.z, 0, dir.x);
    const close = clamp((6.5 - dist) / 5, 0, 1);
    const pos = p.clone().addScaledVector(dir, -(4.5 - 0.5 * close)).addScaledVector(right, 1.75 - 0.55 * close).add(V(0, 3.25 - 0.3 * close, 0));
    const look = p.clone().addScaledVector(dir, Math.min(4.0, Math.max(1.2, dist * 0.55))).addScaledVector(right, 0.45 - 0.3 * close).add(V(0, 1.0, 0));
    // on the finish, tilt up toward the rim
    look.lerp(V(RIM.x + 0.2, 2.3, RIM.z + 0.3), smooth((t - 8.5) / 0.7) * 0.55);
    return { pos, look, fov: 45 };
  }
  at(st) {
    const i = clamp(st / this.dt, 0, this.track.length - 1);
    const i0 = Math.floor(i), i1 = Math.min(i0 + 1, this.track.length - 1), u = i - i0;
    const a = this.track[i0], b = this.track[i1];
    return { pos: a.pos.clone().lerp(b.pos, u), look: a.look.clone().lerp(b.look, u), fov: a.fov + (b.fov - a.fov) * u };
  }
}

// Freeze-frame "analysis" camera moves layered on top of the gameplay cam.
export function freezeCam2(tag, fu, base, game, st) {
  if (!tag) return base;
  const ease = smooth(fu / 0.22) * (1 - smooth((fu - 0.8) / 0.2));
  const you = game.frame('you', st), d1 = game.frame('d1', st);
  const rim = V(RIM.x, 0, RIM.z);
  const dir = rim.clone().sub(you.p).setY(0).normalize();
  const right = V(-dir.z, 0, dir.x);
  const out = { pos: base.pos.clone(), look: base.look.clone(), fov: base.fov };
  if (tag === 'intro') {
    const u = smooth(fu);
    const hi = you.p.clone().addScaledVector(dir, -8.5).addScaledVector(right, 3.8).add(V(0, 7.2, 0));
    const hiLook = you.p.clone().addScaledVector(dir, 3.5).add(V(0, 0.4, 0));
    out.pos = hi.lerp(base.pos, u); out.look = hiLook.lerp(base.look, u);
    return out;
  }
  if (tag === 'setup') {
    const u = smooth(fu / 0.3) * (1 - smooth((fu - 0.85) / 0.15)) * 0.2;
    out.pos.lerp(out.look, u);
    return out;
  }
  const mid = you.p.clone().lerp(d1.p, 0.5);
  if (tag === 'notbeaten') {
    const target = mid.clone().addScaledVector(dir, 0.9).add(V(0, 0.7, 0));
    const p = mid.clone().addScaledVector(dir, -3.3).addScaledVector(right, 2.9).add(V(0, 3.9, 0));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  if (tag === 'closeout') {
    // high, from behind his right shoulder: D1's run and the lane he'll attack are both in frame
    const target = mid.clone().addScaledVector(dir, 0.35).addScaledVector(right, 0.55).add(V(0, 0.6, 0));
    const p = mid.clone().addScaledVector(dir, -0.6).addScaledVector(right, 4.3).add(V(0, 3.4, 0));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  if (tag === 'opening') {
    const target = you.p.clone().addScaledVector(dir, 1.5).addScaledVector(right, -0.5).add(V(0, 0.7, 0));
    const p = you.p.clone().addScaledVector(dir, -4.4).addScaledVector(right, 1.2).add(V(0, 4.8, 0));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  return out;
}
