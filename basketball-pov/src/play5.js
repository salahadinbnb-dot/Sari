// v5 "read his weight": four reps on the right wing, each its own pair of mocap tracks (sim time starts at 0).
//  1 contested make  - he's balanced, you rise anyway: he contests, it drops, still the wrong time
//  2 on his heels    - hard drive, he retreats; pull up while his weight is still going back
//  3 on the lean     - jab, his hips go outside his feet; rise before he re-plants
//  4 contact finish  - drive, he walls up at the rim; hit him first, absorb, finish off the glass
// Court: rim at (0,0), offense attacks -z (as in play3.js).
import { Track } from './animator.js';

const deg = Math.PI / 180;
export const RIM = { x: 0, z: 0 };
export const CLIPS5 = ['78_22', '78_32', '78_20', '06_15', '124_06', '78_30', '78_28', '78_26'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
const toward = (p, q, d) => { const a = yawTo(p, q); return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }; };
// 06_15 turns left as he rises; he should face the rim at the gather (clip 1.55), so a segment that starts at clip
// time `from` is placed this much right of the rim line (measured from the clip's hip yaw)
const TURN = [[1.9, 24], [2.0, 30], [2.1, 35], [2.2, 37], [2.3, 37]];
const JUMPER_TURN = (from) => {
  for (let i = 0; i + 1 < TURN.length; i++) if (from <= TURN[i + 1][0]) { const [a, x] = TURN[i], [b, y] = TURN[i + 1]; return (x + (y - x) * (from - a) / (b - a)) * deg; }
  return 37 * deg;
};

export const SPOT = { x: 2.3, z: 7.3 };
export const REPS = {
  contested: {
    simEnd: 4.4,
    you: () => [
      { clip: '78_22', from: 0.3, at: 0, place: { ...SPOT, yaw: yawTo(SPOT, RIM) } },
      { clip: '06_15', from: 2.1, at: 1.2, blend: 0.3, shot: true, yawAbs: (p) => yawTo(p, RIM) + JUMPER_TURN(2.1) },
    ],
    d1: (youAt) => { const s = toward(SPOT, RIM, 1.05); return [
      { clip: '78_30', from: 3.93, at: 0, idle: { amp: 0.16, period: 1.7 }, place: { ...s, yaw: yawTo(s, SPOT) } },
    ]; },
    plan: { hold: [0, 1.3], gatherAt: 1.22, gatherDur: 0.3, shotClip: 2.8, flight: 1.22, contest: { from: 1.6, to: 2.55, side: 'L', high: 0.74, reach: 0.14 } },
  },
  heels: {
    simEnd: 4.6,
    you: () => [
      { clip: '78_22', from: 0.3, at: 0, place: { ...SPOT, yaw: yawTo(SPOT, RIM) } },
      { clip: '78_32', from: 0.25, at: 0.7, blend: 0.25, yawAbs: (p) => yawTo(p, RIM) - 32 * deg },
      { clip: '06_15', from: 2.3, at: 1.12, blend: 0.28, shot: true, yawAbs: (p) => yawTo(p, RIM) + JUMPER_TURN(2.3) },
    ],
    d1: (youAt) => { const s = toward(SPOT, RIM, 1.15); return [
      { clip: '78_30', from: 3.93, at: 0, idle: { amp: 0.16, period: 1.7 }, place: { ...s, yaw: yawTo(s, SPOT) } },
      // drops left-back to shadow the drive, then keeps drifting straight back after the ball handler has stopped
      { clip: '78_28', from: 0.45, at: 0.86, blend: 0.2, yawAbs: (p, t) => yawTo(p, youAt(t)) + 10 * deg },
      { clip: '78_30', from: 3.93, at: 2.35, blend: 0.45, idle: { amp: 0.12, period: 1.9 }, yawAbs: (p, t) => yawTo(p, youAt(t)) },
    ]; },
    plan: { read: 'heels', hold: [0, 0.78], dribble: [0.78, 1.08], gatherAt: 1.1, gatherDur: 0.26, shotClip: 2.8, flight: 1.15, contest: { from: 1.75, to: 2.4, side: 'L', high: 0.5, reach: 0.15 } },
  },
  lean: {
    simEnd: 4.4,
    you: () => [
      { clip: '78_22', from: 0.3, at: 0, place: { ...SPOT, yaw: yawTo(SPOT, RIM) } },
      { clip: '78_20', from: 0.38, at: 0.55, blend: 0.2, yawAbs: (p) => yawTo(p, RIM) + 35 * deg },
      { clip: '06_15', from: 2.3, at: 0.95, blend: 0.28, shot: true, yawAbs: (p) => yawTo(p, RIM) + JUMPER_TURN(2.3) },
    ],
    d1: (youAt) => { const s = toward(SPOT, RIM, 1.1); return [
      { clip: '78_30', from: 3.93, at: 0, idle: { amp: 0.16, period: 1.7 }, place: { ...s, yaw: yawTo(s, SPOT) } },
      // bites on the jab: slides with it, hips going out over his feet
      { clip: '78_30', from: 0.25, at: 0.8, blend: 0.2, yawAbs: (p, t) => yawTo(p, youAt(t)) },
    ]; },
    plan: { read: 'lean', camAngle: 1.1, hold: [0, 1.0], gatherAt: 0.96, gatherDur: 0.28, shotClip: 2.8, flight: 1.2, contest: { from: 1.6, to: 2.3, side: 'R', high: 0.45, reach: 0.12 } },
  },
  contact: {
    simEnd: 4.2,
    // start spots solved by tools/fitcontact5.mjs: release about a metre off the rim on the right side; the help
    // defender, still sliding, meets the finisher's left shoulder at the take-off
    you: (F = CONTACT_FIT) => [
      { clip: '78_32', from: 0.05, at: 0, place: { x: F.you.x, z: F.you.z, yaw: yawTo(F.you, F.aim) } },
      { clip: '124_06', from: 2.55, at: 1.0, blend: 0.3, shot: true, yawAbs: (p) => yawTo(p, F.aim2) },
    ],
    d1: (youAt, F = CONTACT_FIT) => [
      { clip: '78_30', from: 3.93, at: 0, idle: { amp: 0.16, period: 1.7 }, place: { x: F.d1.x, z: F.d1.z, yaw: F.d1Yaw } },
      // rotates over from the lane (78_26: run, then a hard stop with his weight back) and is still braking when
      // the finisher's shoulder arrives
      { clip: '78_26', from: 0.9, at: 0.75, blend: 0.2, yawAbs: () => F.runYaw },
    ],
    plan: { dribble: [0, 0.95], gatherAt: 1.08, gatherDur: 0.25, layup: { releaseClip: 3.36, side: 'R', oneHand: 1.62 }, contest: { from: 1.15, to: 2.4, both: true, high: 0.72, reach: 0.05 },
      contact: { t: 1.45, push: 0.2, you: 0.07 } },
  },
};
export const CONTACT_FIT = {"you":{"x":4.25,"z":2.841},"aim":{"x":1.225,"z":0.021},"aim2":{"x":0.5,"z":0.2},"d1":{"x":1.761,"z":3.415},"d1Yaw":2.108,"runYaw":2.594};

export function buildRep(name, clips, legs, fit) {
  const R = REPS[name];
  const you = new Track(clips, fit ? R.you(fit) : R.you(), legs.you);
  const youAt = (t) => { const h = you.hip(t); return { x: h.x, z: h.z }; };
  const d1 = new Track(clips, fit ? R.d1(youAt, fit) : R.d1(youAt), legs.d1);
  return { you, d1 };
}
