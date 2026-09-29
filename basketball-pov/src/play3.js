// v3 "tweener": right-wing isolation. YOU: left-hand dribble in -> between-the-legs -> cross -> cross + step-back ->
// pull-up three. D1 slides with every move but the step-back loses him. Court: rim at (0,0), offense attacks -z.
import { Track } from './animator.js';

const PI = Math.PI, deg = PI / 180;
export const CLIPS3 = ['06_04', '06_13', '06_15', '124_05', '78_30', '78_28', '78_27', '78_22'];
export const RIM = { x: 0, z: 0 };
export const START3 = { you: { x: 2.6, z: 10.0 }, d1: { x: 2.5, z: 7.15 } };
export const COMBO_AT = 1.2, SHOT_AT = 2.85;           // sim times the combo / jumper segments start
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);

export function youSegs3() {
  return [
    // walks the ball in with the left hand (06_04: forward dribble, left hand)
    { clip: '06_04', from: 0.9, at: 0.0, place: { x: START3.you.x, z: START3.you.z, yaw: yawTo(START3.you, { x: 3.55, z: 7.2 }) } },
    // 06_13 free-style: L->R between the legs (28.80), R->L cross (29.18), L->R cross (29.52) + step-back
    { clip: '06_13', from: 28.4, at: COMBO_AT, blend: 0.3, yawAbs: (p) => yawTo(p, RIM) - 13 * deg },
    // 06_15: picks it up and rises; his release goes where he faced at the gather -> face the rim
    { clip: '06_15', from: 1.9, at: SHOT_AT, blend: 0.3, shot: true, yawAbs: (p) => yawTo(p, RIM) + 24 * deg },  // clip turns 24deg by 1.9
    // after the landing: stands and watches it, then backs off as it drops (124_05 after his own layup)
    { clip: '124_05', from: 4.6, at: SHOT_AT + (3.9 - 1.9), blend: 0.4 },
  ];
}

// D1 tuning (solved by tools/fitd1.mjs): idle spot = YOU's position at `ref` + dist toward the rim (rotated by bear),
// zigzag start/rate so its flip (clip 1.4) lands on YOU's first cross, and its travel heading.
export const D1_FIT = { ref: 0.9, dist: 1.0, bear: -20, rate: 0.85, travel: 145, closeAt: 3.5, closeFrom: 1.2, closeLead: 0.75, closeGap: 1.15 };
export function d1Segs3(youAt, F = D1_FIT) {
  const P = (t) => youAt(t);
  const y0 = P(F.ref), toRim = Math.atan2(-y0.x, -y0.z) + F.bear * deg;
  const spot = { x: y0.x + Math.sin(toRim) * F.dist, z: y0.z + Math.cos(toRim) * F.dist };
  const zzAt = 2.0 - (1.4 - 0.3) / F.rate;
  return [
    // sizes him up
    { clip: '78_30', from: 3.93, at: 0.0, idle: { amp: 0.16, period: 1.7 }, place: { x: spot.x, z: spot.z, yaw: yawTo(spot, P(0.5)) } },
    // 78_28 zigzag retreat: back-left (mirrors the walk-in), flips back-right on the first cross (clip 1.4),
    // and is still going that way when the second cross + step-back come
    { clip: '78_28', from: 0.3, at: zzAt, rate: F.rate, blend: 0.3, yawAbs: (p, t) => yawTo(P(t + 0.8), p) - F.travel * deg },
    // plants out of the zigzag and sprints at the shooter (78_27, travels ~40deg right of facing): ~2 m away and
    // still closing at the release, he gets there after the ball is gone
    { clip: '78_27', from: F.closeFrom, at: F.closeAt, blend: 0.3, yawAbs: (p, t) => {
      const y = P(t + F.closeLead), a = Math.atan2(-y.x, -y.z); // stop a stride short of him, between him and the rim
      return yawTo(p, { x: y.x + Math.sin(a) * F.closeGap, z: y.z + Math.cos(a) * F.closeGap }) + 40 * deg; } },
    // settles into a live stance (78_22 ready stance) while the ball is in the air
    { clip: '78_22', from: 0.3, at: F.closeAt + (2.1 - F.closeFrom), rate: 0.7, blend: 0.5 },  // (his hands go up from clip 1.65)
  ];
}

export function buildTracks3(clips, legs, fit = D1_FIT) {
  const you = new Track(clips, youSegs3(), legs.you);
  const youAt = (t) => { const h = you.hip(t); return { x: h.x, z: h.z }; };
  const d1 = new Track(clips, d1Segs3(youAt, fit), legs.d1);
  return { you, d1 };
}
