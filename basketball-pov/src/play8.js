// v8 "slow? make him move": a shooter who isn't fast or strong beats his man with what he does first - the fake, the
// change of pace, the stop - and rises over him. Each rep is built from whole real takes (CMU mocap) cut together
// with inertialized transitions, like v5, and placed off the moment that matters:
//  1 head fake    - 78_22 sells the shot (ball to the forehead, eyes on the rim), rips it down and breaks right off
//                   one hard dribble, then stops and rises (124_05's pull-up); the closeout (78_25) leaves his feet on
//                   the fake (124_05's jump) and has to land and slide after him (78_30)
// Court: rim at (0,0), offense attacks -z.
import * as THREE from 'three';
import { anchoredTrack, RIM } from './play5.js';
import { findPushes } from './rep5.js';

export const CLIPS8 = ['78_22', '124_05', '78_25', '78_30', '78_20', '78_24', '78_32', '06_13'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
// 124_05's jump drifts ~0.35 m in the air, mostly sideways; keep a third of it so the jump goes up, not across
const JUMP_STRAIGHT = { from: 3.15, to: 3.72, k: 0.33, ramp: 0.12 };
// the pull-up: 124_05 from just after its own dribble (ball in both hands, stepping into it) - dip at 3.0, takeoff
// 3.17, release 3.38
const SHOT = (from, at, extra = {}) => ({ clip: '124_05', from, at, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT, ...extra });
const simOf = (sg, ct) => sg.at + (ct - sg.from) / (sg.rate ?? 1);

export const REPS = {
  headfake: {
    simEnd: 4.6,
    plan: { hold: [0, 1.66], holdHands: true, lookRim: [0.25, 1.2], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 1.0, camAngle: 1.0, camSide: -1 },
    build(clips, legs) {
      const P = this.plan;
      // you: sizes him up with the ball at the hip, sells the shot (clip 1.6-2.2: ball up to the forehead), rips it
      // down and breaks right - the come-down and the crouch played 1.9x (a real rip-through is quick), the break a
      // touch fast - one hard dribble, then stops and rises
      const A = { clip: '78_22', from: 1.2, at: 0 };
      const B = { clip: '78_22', from: 2.35, at: simOf(A, 2.35), rate: 2.2, inert: 0.12 };
      const C = { clip: '78_22', from: 3.3, at: simOf(B, 3.3), rate: 1.25, inert: 0.12 };
      // his one dribble (the right hand pushing down as he steps by) and the gather on the way back up
      const push = findPushes(clips['78_22'], 3.4, 4.2).find(p => p.hand === 'R');
      const s1 = simOf(C, push.c1);
      P.dribble = [C.at + 0.01, s1 + 0.02]; P.gatherAt = s1 + 0.3;
      const segs = [A, B, C, SHOT(2.75, P.gatherAt - 0.06)];
      const tOff = simOf(segs[3], 3.17), SPOT = { x: 1.9, z: 4.7 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[3], 3.38);
      // the closeout: 78_25's sprint, still chopping his feet at the fake (clip 1.99), a stride in front of him and to
      // his left (taking away the shot), square to him; at the top of the fake he leaves his feet at him (124_05's
      // jump, cut in out of the chop steps, carrying 1.4 m/s of the closeout with him)...
      const jumpAt = 0.74, h = you.hip(jumpAt), F = you.at(jumpAt).yaw, fw = { x: Math.sin(F), z: Math.cos(F) }, lf = { x: Math.cos(F), z: -Math.sin(F) };
      // (he flies straight down the line he closed out on, past your left shoulder)
      const at0 = { x: h.x + fw.x * 1.3 + lf.x * 0.5, z: h.z + fw.z * 1.3 + lf.z * 0.5 }, carry = { x: -fw.x * 1.35, z: -fw.z * 1.35 };
      const landAt = jumpAt + (3.76 - 3.05);
      // ...lands at your shoulder facing the wrong way; once you're by him he turns and gets two slides in after you
      // (the end of 78_30's slide to his left, which travels ~105 deg left of where he faces) and stops a stride
      // short - late
      const yr = you.hip(release), aim = (p) => { const d = Math.hypot(yr.x - p.x, yr.z - p.z), k = Math.max(0, d - 1.3) / d; return { x: p.x + (yr.x - p.x) * k, z: p.z + (yr.z - p.z) * k }; };
      const dsegs = [{ clip: '78_25', from: 1.99 - jumpAt, at: 0 },
        { clip: '124_05', from: 3.05, at: jumpAt, inert: 0.16, unwind: { from: 3.15, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.15, carry } },
        { clip: '78_30', from: 1.9, at: landAt + 0.6, rate: 0.9, inert: 0.3, yawAbs: (p) => yawTo(p, aim(p)) - 105 * Math.PI / 180 },
        { clip: '78_30', from: 2.45, at: landAt + 0.6 + 0.55 / 0.9, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, yr) }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, jumpAt, { ...at0, yaw: yawTo(at0, h) });
      const tStop = 0.3;
      // his hands: up at the ball on the fake; one hand up late from the side on the shot
      P.contest = [{ from: jumpAt - 0.2, rise: 0.2, to: landAt - 0.1, fall: 0.25, both: true, reach: 0.16 },
        { from: release - 0.15, rise: 0.25, to: release + 0.5, side: 'L', reach: 0.05, late: true }];
      // reads: closing out, set with his hand up, then up in the air on the fake; down and beaten after
      P.marks = { bite: jumpAt + 0.26 }; P.vals = { air: (landAt - (jumpAt + 0.12)).toFixed(1) };
      P.labels = [{ t: 0, kind: 'closing', open: 0.55 }, { t: tStop, kind: 'chop', open: 0.3 },
        { t: jumpAt + 0.12, kind: 'air', open: 1 }, { t: landAt, kind: 'beat', open: 1 }];
      return { you, d1 };
    },
  },
  // 2 - jab and shoulder fake left, go right: he's quicker than you, but he has to answer the fake first
  jab: {
    simEnd: 3.7,
    plan: { hold: [0, 1.0], holdHands: true, pushHand: 'R', gatherDur: 0.2, shotClip: 3.38, flight: 1.1, camRef: 0.6, camAngle: 1.0, camSide: -1 },
    build(clips, legs) {
      const P = this.plan;
      // you: 78_20 - ball held in front, sizing him up (its own ready pose, kept alive), then the jab and shoulder
      // dip to your left (clip 0.35-0.55) and the go to the right with one dribble, played a touch slow - you're
      // not fast - then stop and rise
      const A = { clip: '78_20', from: 0.28, at: 0, idle: { amp: 0.04, period: 1.6 } };
      const B = { clip: '78_20', from: 0.28, at: 0.6, rate: 0.9, inert: 0.15 };
      const push = findPushes(clips['78_20'], 0.6, 1.0, 'R')[0];
      const s1 = simOf(B, push.c1);
      P.hold = [0, simOf(B, push.c0) - 0.12]; P.dribble = [simOf(B, push.c0) - 0.05, s1 + 0.02]; P.gatherAt = s1 + 0.28;
      const segs = [A, B, SHOT(2.75, P.gatherAt - 0.06)];
      const tOff = simOf(segs[2], 3.17), SPOT = { x: -1.9, z: 5.0 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[2], 3.38), tFake = simOf(B, 0.45);
      // him: square to you, a stride off, in his stance; he jumps at the fake - a slide to his right (78_30, from
      // mid-slide) - then has to stop, re-plant and come back the other way (78_30's stop and slide left)
      const t0 = 0.3, h = you.hip(t0), F = you.at(t0).yaw, at0 = { x: h.x + Math.sin(F) * 1.25, z: h.z + Math.cos(F) * 1.25 };
      const dsegs = [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } },
        { clip: '78_30', from: 0.42, at: tFake + 0.2, inert: 0.2 }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, t0, { ...at0, yaw: yawTo(at0, h) });
      P.contest = [{ from: release - 0.2, rise: 0.25, to: release + 0.5, side: 'R', reach: 0.05, late: true }];
      // how far his fake-side slide took him the wrong way
      const lf = { x: Math.cos(F), z: -Math.sin(F) }, p0 = d1.hip(tFake);
      let wrong = 0; for (let t = tFake; t < release; t += 0.02) { const p = d1.hip(t); wrong = Math.max(wrong, (p.x - p0.x) * lf.x + (p.z - p0.z) * lf.z); }
      P.marks = { bite: tFake + 0.45 }; P.vals = { wrong: wrong.toFixed(1) };
      P.labels = [{ t: 0, kind: 'balanced', open: 0 }, { t: tFake + 0.25, kind: 'wrong', open: 1 }];
      return { you, d1 };
    },
  },
  // 3 - hesi pull-up: he's running with you, a half step ahead to cut you off; you stop on a dime and rise - he needs
  // a reaction and a stop of his own, and goes on by
  hesi: {
    simEnd: 3.4,
    plan: { hold: [0, 0.05], pushHand: 'R', gatherDur: 0.2, shotClip: 3.38, flight: 1.1, camRef: 1.3, camAngle: 0.15, camSide: -1, camH: 2.5 },
    build(clips, legs) {
      const P = this.plan;
      // you: 78_32 (a straight drive from a stop, right hand), played at 0.72 - you top out near 3 m/s - two
      // dribbles, then the stop and the pull-up: 124_05 cut in on the second dribble's way back up, so the drive's
      // speed dies in one stride (about -5 m/s2)
      const A = { clip: '78_32', from: 0.0, at: 0, rate: 0.72 };
      const push = findPushes(clips['78_32'], 0.8, 1.2, 'R')[0], s1 = simOf(A, push.c1);
      P.dribble = [0.05, s1 + 0.02]; P.gatherAt = s1 + 0.26;
      const tStop = P.gatherAt - 0.08, segs = [A, SHOT(2.72, tStop, { inert: 0.35 })];
      const tOff = simOf(segs[1], 3.17), SPOT = { x: 1.2, z: 5.2 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[1], 3.38);
      // him: running with you on your left, a half step ahead (78_25's sprint, which travels ~45 deg left of where he
      // faces - so he faces you), timed so his own stop (clip 1.8) starts a reaction time after yours
      const RT = 0.25, from = 1.8 - (tStop + RT);
      const h = you.hip(tStop), F = you.at(tStop).yaw, fw = { x: Math.sin(F), z: Math.cos(F) }, lf = { x: Math.cos(F), z: -Math.sin(F) };
      const at0 = { x: h.x + lf.x * 0.85 + fw.x * 0.35, z: h.z + lf.z * 0.85 + fw.z * 0.35 };
      const d1 = anchoredTrack(clips, [{ clip: '78_25', from, at: 0 }], legs.d1, tStop, { ...at0, yaw: F - 45 * Math.PI / 180 });
      P.contest = [{ from: release - 0.1, rise: 0.25, to: release + 0.5, side: 'R', reach: 0.05, late: true }];
      // your speed going into the stop, and how far that carries him in a reaction time (0.225 s, Singh 2020)
      const a = you.hip(tStop - 0.15), b = you.hip(tStop - 0.05), v = Math.hypot(b.x - a.x, b.z - a.z) / 0.1;
      P.marks = { bite: tStop + 0.1 }; P.vals = { react: (v * 0.225).toFixed(1), v: v.toFixed(1) };
      P.labels = [{ t: 0, kind: 'running', open: 0.2 }, { t: tStop + 0.12, kind: 'overrun', open: 1 }];
      return { you, d1 };
    },
  },
  // 4 - step-back: you attack, he slides to cut off the cross; you snatch it back and hop back while he's still
  // sliding the other way
  stepback: {
    simEnd: 3.2,
    plan: { hold: [0, 0.02], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 0.8, camAngle: 1.25, camSide: 1, camH: 2.5 },
    build(clips, legs) {
      const P = this.plan;
      // you: 06_13 (low, quick freestyle dribbling) from 28.6: attacking, between the legs (28.80), the cross to
      // your left (29.18) and back (29.52) as you hop back (29.55-30.05), then rise (124_05 cut in at the landing)
      // (the hop back played 1.6x: the take drifts back; a real step-back snatches it back in one hop)
      const A = { clip: '06_13', from: 28.6, at: 0 };
      const B = { clip: '06_13', from: 29.5, at: simOf(A, 29.5), rate: 1.6, inert: 0.1 };
      P.dribble = [0.0, simOf(B, 29.75)]; P.gatherAt = simOf(B, 29.9);
      const segs = [A, B, SHOT(3.04, simOf(B, 30.12), { inert: 0.18 })];
      const tOff = simOf(segs[2], 3.17), SPOT = { x: -2.6, z: 6.3 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[2], 3.38), tCross = simOf(A, 29.18);
      // him: a stride off, square; slides with the first cross (78_30's slide to his right, from its start, a
      // reaction time after the cross) and is still going that way when you hop back; stops and comes back late
      const h = you.hip(tCross), F = you.at(tCross).yaw, at0 = { x: h.x + Math.sin(F) * 1.15, z: h.z + Math.cos(F) * 1.15 };
      const dsegs = [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } }, { clip: '78_30', from: 0.05, at: tCross + 0.15, inert: 0.2 }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, tCross, { ...at0, yaw: yawTo(at0, h) });
      P.contest = [{ from: release - 0.1, rise: 0.25, to: release + 0.5, side: 'L', reach: 0.05, late: true }];
      P.marks = { bite: tCross + 0.35 }; P.vals = {};
      P.labels = [{ t: 0, kind: 'balanced', open: 0 }, { t: tCross + 0.3, kind: 'lean', open: 1 }];
      return { you, d1 };
    },
  },
};

export function buildRep(name, clips, legs) { return REPS[name].build(clips, legs); }
