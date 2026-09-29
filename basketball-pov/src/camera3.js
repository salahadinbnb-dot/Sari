// v3: broadcast-style side camera from the right sideline stands, tracking the ball handler and panning with the shot.
import * as THREE from 'three';
import { SIM_END } from './timeline3.js';
import { clamp, smooth } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIM = V(0, 3.05, 0);
const LEAD = 0.5;

export class SideCam {
  constructor(game, plan) {
    this.game = game; this.plan = plan;
    // shot line (shooter -> rim at the release) and the side normal toward the right sideline
    const y = game.frame('you', plan.release).p;
    this.s = V(RIM.x - y.x, 0, RIM.z - y.z).normalize(); this.n = V(-this.s.z, 0, this.s.x);
    if (this.n.x < 0) this.n.negate();
    const dt = 1 / 120; this.dt = dt; this.track = [];
    let pos = null, look = null; const vp = V(), vl = V();
    const w = 3.0;
    const step = (x, v, target, om) => {
      const f = 1 + 2 * dt * om, oo = om * om, hoo = dt * oo, hhoo = dt * hoo, detInv = 1 / (f + hhoo);
      return [(f * x + dt * v + hhoo * target) * detInv, (v + hoo * (target - x)) * detInv];
    };
    for (let t = 0; t <= SIM_END + 1e-6; t += dt) {
      const want = this.ideal(t + LEAD);  // feed-forward so the spring's lag doesn't leave the framing late
      if (!pos) { pos = want.pos.clone(); look = want.look.clone(); }
      for (const ax of ['x', 'y', 'z']) { [pos[ax], vp[ax]] = step(pos[ax], vp[ax], want.pos[ax], w); [look[ax], vl[ax]] = step(look[ax], vl[ax], want.look[ax], w * 1.2); }
      this.track.push({ pos: pos.clone(), look: look.clone(), fov: want.fov });
    }
  }
  ideal(t) {
    const P = this.plan, you = this.game.frame('you', Math.min(t, SIM_END)).p;
    // frame the ball handler tight through the rise, then widen to the shot framing (shooter left, rim right, the
    // whole arc in frame) as the ball goes up
    const shot = smooth((t - (P.release - 0.6)) / 0.9);
    const k = 0.16 + 0.29 * shot;
    const T = you.clone().lerp(V(RIM.x, 0, RIM.z), k);
    const intro = 1 - smooth(t / 1.4);
    // azimuth off the shot line's side normal (+ = behind the shooter): a quarter-behind side angle reads the dribble
    // moves, then it swings round to square-on (a touch in front) for the step-back and the shot, where the
    // separation opens up across the screen instead of in depth
    const phi = (27 - 35 * smooth((t - 2.7) / 0.85)) * Math.PI / 180;
    const c = this.n.clone().multiplyScalar(Math.cos(phi)).addScaledVector(this.s, -Math.sin(phi));
    const pos = T.clone().addScaledVector(c, 7.37 + 1.9 * shot + 2.75 * intro); pos.y = 3.4 + 0.5 * shot + 1.4 * intro;
    const look = T.clone().add(V(0, 1.1 + 1.3 * shot, 0));
    return { pos, look, fov: 34 - 2 * smooth((t - 1.3) / 1.0) + 8 * shot };
  }
  at(st) {
    const i = clamp(st / this.dt, 0, this.track.length - 1), i0 = Math.floor(i), i1 = Math.min(i0 + 1, this.track.length - 1), u = i - i0;
    const a = this.track[i0], b = this.track[i1];
    return { pos: a.pos.clone().lerp(b.pos, u), look: a.look.clone().lerp(b.look, u), fov: a.fov + (b.fov - a.fov) * u };
  }
}
