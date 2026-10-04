// v10 "shoot over him": an isolation pull-up against a good contest, in three beats - gather, set, rise - and the same
// iso without the middle beat. Built from whole real takes (CMU mocap) on the v5 engine:
//  1 iso    - one continuous take (124_05): triple threat sizing him up, one hard dribble, the ball up into both hands
//             as the first foot lands (the gather), the 1-2 into a square stance and the dip, then straight up; the
//             defender (78_30's stance) holds his ground and contests straight up (124_05's jump)
//  2 drift  - 78_32's hard drive pulled up without stopping: the shot rides the drive's momentum forward in the air,
//             into the same contest, and comes off the back of the rim
// Court: rim at (0,0), offense attacks -z.
import { anchoredTrack, RIM } from './play5.js';
import { findPushes } from './rep5.js';

export const CLIPS10 = ['124_05', '78_30', '78_32'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
// 124_05's jump drifts ~0.35 m in the air, mostly sideways; keep a third of it so the jump goes up, not across
const JUMP_STRAIGHT = { from: 3.15, to: 3.72, k: 0.33, ramp: 0.12 };
const simOf = (sg, ct) => sg.at + (ct - sg.from) / (sg.rate ?? 1);

// the defender: square to you a stride off in his stance (78_30's stop, kept alive), then straight up with you -
// out of his stance into 124_05's jump, cut in a beat after your takeoff, hands up
// (placed `gap` metres toward the rim from where you are at tRef, or at `at` if given)
function contestTracks(clips, legs, you, tRef, gap, takeoff, side = 0, at = null) {
  const h = you.hip(tRef), a = Math.atan2(RIM.x - h.x, RIM.z - h.z), F = you.at(tRef).yaw, lf = { x: Math.cos(F), z: -Math.sin(F) };
  const at0 = at || { x: h.x + Math.sin(a) * gap + lf.x * side, z: h.z + Math.cos(a) * gap + lf.z * side };
  const jumpAt = takeoff + 0.08 - (3.17 - 3.05);
  const segs = [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } },
    { clip: '124_05', from: 3.05, at: jumpAt, inert: 0.25, unwind: { from: 3.15, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.1 } }];
  return anchoredTrack(clips, segs, legs.d1, tRef, { ...at0, yaw: yawTo(at0, h) });
}

export const REPS = {
  iso: {
    simEnd: 4.6,
    plan: { hold: [0, 1.6], pushHand: 'R', gatherDur: 0.18, shotClip: 3.38, flight: 1.15, camRef: 2.0, camAngle: 0.25, camSide: 1, camH: 1.6, camPush: 0.7 },
    build(clips, legs) {
      const P = this.plan;
      // you: one continuous take (124_05) - triple threat, sizing him up (its stance, kept alive), then one hard dribble,
      // the ball up into both hands as the first foot lands (the gather), the 1-2 into a square stance, the dip, and up
      // (the take turns him ~60 deg from the dribble to the shot - it was a catch from the side; here he faces his man
      // and the rim the whole way, so that turn is taken out)
      const A = { clip: '124_05', from: 1.8, at: 0, idle: { amp: 0.06, period: 1.5 } };
      const B = { clip: '124_05', from: 1.8, at: 1.3, inert: 0.2, unwind: { from: 2.25, to: 3.12, ramp: 0.25 } };
      const C = { clip: '124_05', from: 3.12, at: simOf(B, 3.12), inert: 0.05, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT };
      const push = findPushes(clips['124_05'], 2.1, 2.5, 'R')[0];
      P.hold = [0, simOf(B, push.c0) - 0.12]; P.dribble = [B.at, simOf(B, push.c1) + 0.02]; P.gatherAt = simOf(B, 2.6);
      const tOff = simOf(B, 3.17), SPOT = { x: 2.9, z: 4.85 }; P.takeoffAt = tOff;
      const you = anchoredTrack(clips, [A, B, C], legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(B, 3.38);
      // him: set, a stride and a half off; you come to him with the dribble and the 1-2 and rise into his hand
      const d1 = contestTracks(clips, legs, you, 0.5, 1.75, tOff);
      P.contest = [{ from: tOff - 0.05, rise: 0.22, to: release + 0.55, side: 'L', reach: 0.12 }];
      // the beats: the gather (both hands on it, first foot down), the set (second foot down, the dip), the release
      P.beats = { gather: P.gatherAt + 0.02, set: tOff - 0.07, rise: release - 0.01 };
      P.labels = [{ t: 0, kind: 'sizeup', open: 0 }, { t: P.gatherAt - 0.05, kind: 'gather', open: 0 }, { t: simOf(B, 2.88), kind: 'set', open: 0 }, { t: tOff - 0.05, kind: 'rise', open: 0 }];
      return { you, d1 };
    },
  },
  drift: {
    simEnd: 4.4,
    plan: { hold: [0, 0.05], pushHand: 'R', gatherDur: 0.18, shotClip: 3.38, flight: 1.1, camRef: 1.4, camAngle: 0.25, camSide: 1, camH: 1.6, camPush: 0.7,
      miss: { long: true, side: 0.05, kick: 0.25 } },
    build(clips, legs) {
      const P = this.plan;
      // you: the same iso off a hard drive (78_32, two dribbles), pulled up without stopping: 124_05 cut in late, in
      // its step-in, and the jump carries the drive forward (1.3 m/s in the air) - you go up and forward, into him
      const A = { clip: '78_32', from: 0.0, at: 0, rate: 0.9 };
      const push = findPushes(clips['78_32'], 0.8, 1.2, 'R')[0], s1 = simOf(A, push.c1);
      P.dribble = [0.05, s1 + 0.02]; P.gatherAt = s1 + 0.22;
      const B = { clip: '124_05', from: 2.86, at: P.gatherAt + 0.02, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.33 } };
      const tOff = simOf(B, 3.17), SPOT = { x: 2.6, z: 5.0 }; P.takeoffAt = tOff;
      const probe = anchoredTrack(clips, [A, B], legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const F = probe.at(tOff).yaw; B.compress.carry = { x: Math.sin(F) * 1.3, z: Math.cos(F) * 1.3 };
      const you = anchoredTrack(clips, [A, B], legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(B, 3.38);
      // him: set where your drift is taking you - a stride past your release point along the way you're floating
      const K = you.hip(tOff), R0 = you.hip(release), dl = Math.hypot(R0.x - K.x, R0.z - K.z) || 1;
      const spot = { x: R0.x + (R0.x - K.x) / dl * 0.8, z: R0.z + (R0.z - K.z) / dl * 0.8 };
      const d1 = contestTracks(clips, legs, you, tOff, 0, tOff, 0, spot);
      P.contest = [{ from: tOff - 0.05, rise: 0.22, to: release + 0.55, side: 'L', reach: 0.12 }];
      P.beats = { gather: P.gatherAt + 0.02, rise: release - 0.01 };
      P.labels = [{ t: 0, kind: 'drive', open: 0.4 }, { t: P.gatherAt - 0.05, kind: 'nostop', open: 1 }, { t: tOff - 0.05, kind: 'drifting', open: 1 }];
      return { you, d1 };
    },
  },
};

export function buildRep(name, clips, legs) { return REPS[name].build(clips, legs); }
