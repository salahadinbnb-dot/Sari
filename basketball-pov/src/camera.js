// Behind-the-ball-handler camera ("2K player cam"), precomputed with critically damped smoothing.
import * as THREE from 'three';
import { TL, RIM } from './timeline.js';
import { clamp, smooth } from './motion.js';

export class CamRig {
  constructor(W) {
    this.W = W;
    const dt = 1 / 120;
    this.dt = dt;
    this.track = [];
    let pos = null, look = null, vp = new THREE.Vector3(), vl = new THREE.Vector3();
    const omega = 3.2; // stiffness
    for (let t = 0; t <= TL.simEnd + 1e-6; t += dt) {
      const want = this.ideal(t);
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      // critically damped spring
      const step = (x, v, target, w) => {
        const f = 1 + 2 * dt * w, oo = w * w, hoo = dt * oo, hhoo = dt * hoo;
        const detInv = 1 / (f + hhoo);
        const detX = f * x + dt * v + hhoo * target;
        const detV = v + hoo * (target - x);
        return [detX * detInv, detV * detInv];
      };
      for (const ax of ['x', 'y', 'z']) {
        [pos[ax], vp[ax]] = step(pos[ax], vp[ax], want.pos[ax], omega);
        [look[ax], vl[ax]] = step(look[ax], vl[ax], want.look[ax], omega * 1.25);
      }
      this.track.push({ pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
  }
  ideal(t) {
    const W = this.W;
    const y = W.you.path.at(Math.min(t, TL.simEnd));
    const p = new THREE.Vector3(y.x, 0, y.z);
    // aim between the rim and the action; after the pass follow the ball toward the rim
    const rim = new THREE.Vector3(RIM.x, 0, RIM.z);
    const dir = rim.clone().sub(p); dir.y = 0; const dist = dir.length(); dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x); // right of travel toward rim: dir x up = (-dz?) -> check: dir=(0,0,-1) => right=(1,0,0)
    const back = 4.25 - 0.35 * clamp((9.0 - dist) / 6, 0, 1);
    const pos = p.clone().addScaledVector(dir, -back).addScaledVector(right, 1.0).add(new THREE.Vector3(0, 3.0, 0));
    const look = p.clone().addScaledVector(dir, Math.min(4.0, dist * 0.55)).addScaledVector(right, 0.15).add(new THREE.Vector3(0, 1.0, 0));
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
export function freezeCam(tag, fu, base, W, st) {
  if (!tag) return base;
  const ease = smooth(fu / 0.22) * (1 - smooth((fu - 0.8) / 0.2));
  const you = W.frame('you', st);
  const rim = new THREE.Vector3(RIM.x, 0, RIM.z);
  const dir = rim.clone().sub(you.p).setY(0).normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const up = new THREE.Vector3(0, 1, 0);
  const out = { pos: base.pos.clone(), look: base.look.clone(), fov: base.fov };
  if (tag === 'intro') {
    const u = smooth(fu);
    const hi = you.p.clone().addScaledVector(dir, -8.5).addScaledVector(right, 3.8).add(new THREE.Vector3(0, 7.2, 0));
    const hiLook = you.p.clone().addScaledVector(dir, 3.5).add(new THREE.Vector3(0, 0.4, 0));
    out.pos = hi.lerp(base.pos, u); out.look = hiLook.lerp(base.look, u);
    return out;
  }
  if (tag === 'setup') {
    const u = smooth(fu) * 0.16;
    out.pos.lerp(out.look, u);
    return out;
  }
  if (tag === 'notbeaten') {
    const d1 = W.frame('d1', st);
    const mid = you.p.clone().lerp(d1.p, 0.5);
    const target = mid.clone().addScaledVector(dir, 1.1).add(new THREE.Vector3(0, 0.75, 0));
    const p = mid.clone().addScaledVector(dir, -2.6).addScaledVector(right, 2.4).add(up.clone().multiplyScalar(3.35));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  if (tag === 'opening') {
    const target = you.p.clone().addScaledVector(dir, 1.7).addScaledVector(right, -0.4).add(new THREE.Vector3(0, 0.7, 0));
    const p = you.p.clone().addScaledVector(dir, -4.6).addScaledVector(right, 1.5).add(up.clone().multiplyScalar(4.7));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  if (tag === 'help') {
    const d2 = W.frame('d2', st), sc = W.frame('screener', st);
    const mid = you.p.clone().add(d2.p).add(sc.p).multiplyScalar(1 / 3);
    const target = mid.clone().addScaledVector(dir, 0.9).add(new THREE.Vector3(0, 0.9, 0));
    const p = you.p.clone().addScaledVector(dir, -5.2).addScaledVector(right, 1.9).add(up.clone().multiplyScalar(5.6));
    out.pos.lerp(p, ease); out.look.lerp(target, ease);
    return out;
  }
  return out;
}
