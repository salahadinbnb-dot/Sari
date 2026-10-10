// v7 "get your hands on it" (steals): reps built from whole real takes (CMU mocap), placed off the moment that
// matters - the strike or the catch - so the reach is real: the ball is where the defender's hand can get it.
//  cross - 06_13 (low, fast freestyle dribble): right-hand dribbles out of reach, then a crossover in front of him;
//          the defender (a stance, 78_24, into 78_30's slide and stop) swipes up through it with his right hand and
//          goes after it (78_27's push-off to his right)
// Court: rim at (0,0), offense attacks -z.
import * as THREE from 'three';
import { anchoredTrack } from './play5.js';
import { Rep7 } from './rep7.js';

export const CLIPS7 = ['06_13', '78_24', '78_30', '78_27', '78_32', '78_25'];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);

// place a defender take so that at tRef his shoulder (side 'R'/'L') sits `reach` metres from the ball point B,
// on the line from B back toward him (dir: unit vector on the floor pointing from the ball to where he stands),
// facing `yaw`
function placeForReach(clips, segs, leg, tRef, B, dir, yaw, side, reach) {
  const trial = anchoredTrack(clips, segs, leg, tRef, { x: 0, z: 0, yaw });
  const P = trial.at(tRef), h = trial.hip(tRef), sh = P.pos[side === 'R' ? 'rclavicle' : 'lclavicle'];
  const dv = sh.y - B.y, horiz = Math.sqrt(Math.max(0.05, reach * reach - dv * dv));
  const want = V(B.x + dir.x * horiz, 0, B.z + dir.z * horiz); // where the shoulder goes (on the floor)
  return anchoredTrack(clips, segs, leg, tRef, { x: want.x - (sh.x - h.x), z: want.z - (sh.z - h.z), yaw });
}

export const REPS = {
  cross: {
    simEnd: 2.3,
    plan: { kind: 'cross', dribble: [0, 1.6], minPush: -1.5, strike: { hand: 'R', pop: 2.3, lead: 0.17, at: 0.62 },
      cam: { overBack: 3.5, overOff: 1.15, overH: 2.15, overLook: 0.85, overFov: 46, sideSign: 1, sideDist: 4.4 } },
    build(clips, legs, rigs) {
      // the dribbler at the top of the key, facing down the floor at you (0 = clip 34.85: he's just stopped coming
      // forward; right-hand dribbles while he drifts to his left, then the cross at 35.85)
      const SPOT = { x: 0.6, z: 7.2 };
      const bh = anchoredTrack(clips, [{ clip: '06_13', from: 34.85, at: 0 }], legs.bh, 1.0, { ...SPOT, yaw: yawTo(SPOT, { x: 0.2, z: 0 }) });
      // the cross: the first flight from his right hand to his left; strike on the way up, before it reaches the hand
      const probe = new Rep7('probe', { bh }, { bh: rigs.bh }, clips, { ...this.plan, simEnd: this.simEnd, strike: null });
      const fl = probe.flights.find(f => f.cross && f.from === 'R');
      const ts = fl.tb + this.plan.strike.at * (fl.c - fl.tb), B = probe.dribbleBall(ts).B;
      this.plan.strike.t = ts;
      // the defender: a stance (78_24) into 78_30's slide to his right and its stop, timed so he's stopped at the
      // strike, square to the dribbler; his right shoulder 0.74 m from the ball
      // (he stands a little off the dribbler's left: the dribbler's ball side turned away from him, a stagger)
      const toD = probe.fwd('bh', ts).clone().applyAxisAngle(V(0, 1, 0), 20 * Math.PI / 180), yaw = Math.atan2(-toD.x, -toD.z);
      // ...and after the poke he goes after it: 78_27's push-off to his right, cut in just after the strike
      const segs = [{ clip: '78_24', from: 0.0, at: 0 }, { clip: '78_30', from: 0.0, at: ts - 0.95, inert: 0.2 },
        { clip: '78_27', from: 0.35, at: ts + 0.06, inert: 0.15 }];
      const df = placeForReach(clips, segs, legs.df, ts, B, toD, yaw, 'R', 0.62);
      // knocked loose: low, out to his right and a touch forward, where he's going
      const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(-f.z, 0, f.x);
      this.plan.strike.out = r.clone().multiplyScalar(0.85).addScaledVector(f, 0.12).addScaledVector(V(0, 1, 0), 0.35);
      return { bh, df };
    },
  },
};

REPS.trail = {
  simEnd: 1.78,
  plan: { kind: 'trail', dribble: [0, 2.2], minPush: -2.9, strike: { hand: 'L', pop: 1.5, keep: 1.0, lead: 0.2, at: 0.55 },
    cam: { chaseBack: 3.6, chaseSide: -1.5, chaseH: 2.5, chaseFov: 50, sideSign: -1, sideDist: 4.6 } },
  build(clips, legs, rigs) {
    // he's beaten you: 78_32, a straight drive from a stop, right hand, building to ~4 m/s, down the right side
    const SPOT = { x: 2.2, z: 6.2 };
    const bh = anchoredTrack(clips, [{ clip: '78_32', from: 0.0, at: 0 }], legs.bh, 1.0, { ...SPOT, yaw: yawTo(SPOT, { x: 1.2, z: 1.0 }) });
    // the poke: on the way up after his second dribble, from behind, before it gets back to his hand
    const probe = new Rep7('probe', { bh }, { bh: rigs.bh }, clips, { ...this.plan, simEnd: this.simEnd, strike: null });
    const fl = probe.flights[1], ts = fl.tb + this.plan.strike.at * (fl.c - fl.tb), B = probe.dribbleBall(ts).B;
    this.plan.strike.t = ts;
    // you: out of your stance into a sprint (78_25) with him, half a step behind on his ball side; your inside (left)
    // hand 0.66 m from the ball
    const f = probe.fwd('bh', ts), r = V(-f.z, 0, f.x), yaw = Math.atan2(f.x, f.z);
    const toD = f.clone().multiplyScalar(-0.62).addScaledVector(r, 0.78).normalize();
    const segs = [{ clip: '78_25', from: 0.0, at: ts - 1.25 }];
    const df = placeForReach(clips, segs, legs.df, ts, B, toD, yaw, 'L', 0.52);
    // tipped forward, ahead of him and a little out: it keeps his speed and gets a bit more
    this.plan.strike.swipe = f.clone().multiplyScalar(0.85).addScaledVector(V(0, 1, 0), 0.4).addScaledVector(r, 0.1);
    this.plan.strike.out = f.clone().multiplyScalar(0.8).addScaledVector(r, 0.35).addScaledVector(V(0, 1, 0), 0.3);
    return { bh, df };
  },
};
REPS.lane = {
  simEnd: 2.7,
  plan: { kind: 'lane', dribble: [0, 1.4], minPush: -1.5, pass: { speed: 7.5, f: 0.66 },
    cam: { highBack: 4.0, highH: 4.6, highFov: 54, highLook: 0.56 } },
  build(clips, legs, rigs) {
    // the passer at the top, dribbling in place (06_13's opening), right hand; he picks it up as it comes up off his
    // third dribble, winds up and throws a chest pass to the right wing
    const P = { x: -0.4, z: 7.9 }, R = { x: 5.0, z: 5.6 };
    const bh = anchoredTrack(clips, [{ clip: '06_13', from: 1.9, at: 0 }], legs.bh, 1.4, { ...P, yaw: yawTo(P, R) });
    const probe = new Rep7('probe', { bh }, { bh: rigs.bh }, clips, { ...this.plan, simEnd: this.simEnd, dribble: [0, 2.2], pass: null });
    const S = this.plan.pass, pk = probe.pushes[2];
    S.pick = pk.catch; S.wind = S.pick + 0.12; S.rel = S.wind + 0.24;
    this.plan.dribble = [0, S.pick];
    // the receiver: on the wing, set, showing a target (78_24's stance, kept alive)
    const rc = anchoredTrack(clips, [{ clip: '78_24', from: 0.05, at: 0, idle: { amp: 0.25, period: 1.7 } }], legs.rc, 1.0, { ...R, yaw: yawTo(R, P) });
    // you: guarding him, sagged 1.25 m off the line toward the rim - it looks open - in a stance; you leave on the
    // windup (78_27's push-off) and catch it two-thirds of the way out, in front of him
    const p0 = V(P.x, 0, P.z), r0 = V(R.x, 0, R.z), L = r0.clone().sub(p0), len = L.length(), u = L.normalize();
    let n = V(-u.z, 0, u.x); if (n.dot(p0.clone().negate()) < 0) n.negate(); // toward the rim side
    const I = p0.clone().addScaledVector(u, S.f * len), D0 = I.clone().addScaledVector(n, 1.25).addScaledVector(u, 0.25);
    const m = I.clone().sub(D0).normalize(), yaw = Math.atan2(m.x, m.z) + 40 * Math.PI / 180;
    const segs = [{ clip: '78_24', from: 0.05, at: 0, idle: { amp: 0.25, period: 1.7 } }, { clip: '78_27', from: 0.4, at: S.wind, inert: 0.12 }];
    // (where the catch happens: the pass line at the catch time - flight time comes from the speed)
    const flight0 = len * S.f / S.speed, tInt = S.rel + flight0, fy = V(Math.sin(yaw), 0, Math.cos(yaw));
    const hip = I.clone().addScaledVector(fy, -0.42);
    const df = anchoredTrack(clips, segs, legs.df, tInt, { x: hip.x, z: hip.z, yaw });
    // the camera (up behind the passer) slides a little toward your side so you come in from inside the frame
    this.plan.cam.highSide = Math.sign(n.dot(V(-u.z, 0, u.x))) * 1.0;
    return { bh, rc, df };
  },
};

export function buildRep(name, clips, legs, rigs) {
  const R = REPS[name], tracks = R.build(clips, legs, rigs);
  return new Rep7(name, tracks, rigs, clips, { ...R.plan, simEnd: R.simEnd });
}
