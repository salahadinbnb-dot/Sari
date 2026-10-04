// v5 "read his weight": four reps on the right side of the floor, each built from whole real takes (CMU mocap)
// cut together where the poses match (tools/transit.py) with inertialized transitions:
//  1 contested make  - catch and shoot (124_05) into a controlled closeout (78_25): he arrives balanced, contests
//  2 on his heels    - hard first step (78_32) into a pull-up (124_05) while he's still dropping back (78_28)
//  3 on the lean     - crossover dribble (06_14) into a pull-up (124_05) while he's still sliding (78_30)
//  4 contact finish  - drive (78_32) into a layup (124_06) through a help defender who isn't set (78_26)
// Players are placed by anchoring a moment of each take to a spot on the floor (hip position and facing), so the
// spacing is set where it matters (the release, the contact) and everything else follows from the real motion.
// Court: rim at (0,0), offense attacks -z.
import * as THREE from 'three';
import { Track } from './animator.js';
import { sampleClip, facingYaw } from './mocap.js';

export const RIM = { x: 0, z: 0 };
export const CLIPS5 = ['124_05', '124_06', '06_14', '78_25', '78_26', '78_28', '78_30', '78_32'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
// 124_05's jump drifts ~0.35 m in the air, mostly sideways; keep a third of it so the jump goes up, not across
const JUMP_STRAIGHT = { from: 3.15, to: 3.72, k: 0.33, ramp: 0.12 };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Build a track whose first segment is placed so that at sim time tRef the hip is at want.{x,z} facing want.yaw.
// Later segments continue from the earlier ones, so a rigid move of the first placement moves the whole track.
export function anchoredTrack(clips, segs, leg, tRef, want) {
  const copy = (s) => ({ ...s, ...(s.compress ? { compress: { ...s.compress } } : {}) });
  const trial = new Track(clips, segs.map((s, i) => i ? copy(s) : { ...copy(s), place: { x: 0, z: 0, yaw: 0 } }), leg);
  const T = trial.at(tRef), h = trial.hip(tRef), a = wrap(want.yaw - T.yaw);
  const r = new THREE.Vector3(h.x, 0, h.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  return new Track(clips, segs.map((s, i) => i ? copy(s) : { ...copy(s), place: { x: want.x - r.x, z: want.z - r.z, yaw: a } }), leg);
}
const clipYaw = (clip, ct) => facingYaw(sampleClip(clip, ct));

export const REPS = {
  // 1 - catch on the wing (kick-out from the corner) as the defender closes out from the lane; he chops his feet,
  // arrives balanced with his hand up, and the shot goes up over it anyway
  contested: {
    simEnd: 4.0,
    plan: { pass: { from: { x: 6.4, y: 1.45, z: 1.6 }, t0: -0.35, t1: 0.4 }, gatherAt: 0.4, gatherDur: 0.2, shotClip: 3.38, flight: 1.2, camRef: 1.2,
      contest: { from: 1.22, rise: 0.3, to: 2.0, both: true, reach: 0.1 },
      labels: [{ t: 0, kind: 'closing', open: 0.55 }, { t: 0.62, kind: 'chop', open: 0.3 }, { t: 0.86, kind: 'balanced', open: 0 }] },
    build(clips, legs) {
      const SPOT = { x: 3.0, z: 6.95 }; // a step behind the arc on the right wing
      // shooter: 124_05 from the moment before the catch; the air turn is taken out so he lands where he took off
      const you = anchoredTrack(clips, [{ clip: '124_05', from: 1.92, at: 0, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT }],
        legs.you, 3.17 - 1.92, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      // the kick-out comes from where he's facing at the catch (the corner), chest high, ~5 m away
      { const c = you.hip(0.4), f = you.at(0.4).yaw; REPS.contested.plan.pass.from = { x: c.x + Math.sin(f) * 5.2, y: 1.4, z: c.z + Math.cos(f) * 5.2 }; }
      // closeout: anchored at the stop (clip 2.05): a metre in front of him on the rim side, square to him
      // (timed so he stands up out of his stance - the clip's own rise - into the contest as the shooter goes up)
      const tStop = 0.88, h = you.hip(tStop), dir = Math.atan2(RIM.x - h.x, RIM.z - h.z);
      const stop = { x: h.x + Math.sin(dir) * 1.32, z: h.z + Math.cos(dir) * 1.32 };
      // ...and he gets off the floor to contest: out of his stance into a straight-up two-foot jump (the jump of
      // 124_05, cut in where the poses match), hands up
      const d1 = anchoredTrack(clips, [{ clip: '78_25', from: 2.05 - tStop, at: 0 },
        { clip: '124_05', from: 3.05, at: 2.467 - (2.05 - tStop), inert: 0.22, unwind: { from: 3.15, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.15 } }],
        legs.d1, tStop, { ...stop, yaw: yawTo(stop, h) });
      return { you, d1 };
    },
  },
  // 2 - hard first step at him; he drops back to stay in front; pull up while he's still going backwards
  heels: {
    simEnd: 4.2,
    plan: { hold: [0, 0.05], dribble: [0.05, 0.5], gatherAt: 0.5, gatherDur: 0.22, shotClip: 3.38, flight: 1.2, read: 'heels', camRef: 0.6, camPush: 0.6,
      contest: { from: 1.5, rise: 0.3, to: 2.3, side: 'L', reach: 0.08, late: true } },
    build(clips, legs) {
      const segs = [{ clip: '78_32', from: 0.0, at: 0 },
        { clip: '124_05', from: 2.70, at: 0.517, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT }];
      const tOff = 0.517 + (3.17 - 2.70), SPOT = { x: 2.75, z: 7.05 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      // the retreat: 78_28 drop-steps and runs back at an angle, hips open 45 degrees to the drive, so it goes straight
      // away from the ball (fitted: ~1.6 m/s backwards from the first step to the takeoff, 1.65 m off at the takeoff)
      const h = you.hip(tOff), dir = Math.atan2(RIM.x - h.x, RIM.z - h.z), tRef = tOff;
      const at = { x: h.x + Math.sin(dir - 0.25) * 1.65, z: h.z + Math.cos(dir - 0.25) * 1.65 };
      // ...then plants (78_30's stop, matched to the retreat at 0.9 s) - too late to get a hand up in time
      const d1 = anchoredTrack(clips, [{ clip: '78_28', from: 0.12, at: 0, rate: 0.85 },
        { clip: '78_30', from: 2.067, at: (0.9 - 0.12) / 0.85, inert: 0.25 }], legs.d1, tRef, { ...at, yaw: yawTo(at, h) + Math.PI / 4 });
      return { you, d1 };
    },
  },
  // 3 - crossover, he slides hard with it; stop and rise while his momentum is still carrying him sideways
  lean: {
    simEnd: 4.4,
    plan: { dribble: [0, 1.15], gatherAt: 1.16, gatherDur: 0.22, shotClip: 3.38, flight: 1.2, read: 'lean', camRef: 1.05, camPush: 0.6, camAngle: 1.15,
      // (no contest: he's still sliding away when the ball goes up)
    },
    build(clips, legs) {
      const segs = [{ clip: '06_14', from: 0.0, at: 0 },
        { clip: '124_05', from: 2.60, at: 1.20, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT }];
      const tOff = 1.20 + (3.17 - 2.60), SPOT = { x: 2.95, z: 6.95 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      // the slide: 78_30's first slide (to his right), the stop and the push back, timed off the cross back
      // he guards the dribble square (the dribbler faces the baseline side; the turn into the shot comes later):
      // his first slide answers the first cross, the second, harder one carries him past as you stop and rise
      // (fitted so both slides run across his front - not at him - and leave him ~1.9 m off at the release)
      const tRef = 1.05, h0 = you.hip(tRef), f0 = you.at(tRef).yaw - 40 * Math.PI / 180;
      const at = { x: h0.x + Math.sin(f0) * 1.6, z: h0.z + Math.cos(f0) * 1.6 };
      const d1 = anchoredTrack(clips, [{ clip: '78_30', from: 0.0, at: 0 }], legs.d1, tRef, { ...at, yaw: yawTo(at, h0) - 40 * Math.PI / 180 });
      return { you, d1 };
    },
  },
  // 4 - drive baseline side, the help defender slides over from the lane and is still moving when the shoulder
  // gets to him; finish off the glass through the contact
  contact: {
    simEnd: 4.0,
    plan: { dribble: [0, 1.0], gatherAt: 1.05, gatherDur: 0.22, layup: { releaseClip: 3.36, side: 'R', oneHand: 1.62 },
      contest: { from: 1.5, rise: 0.3, to: 2.3, both: true, reach: 0.05 }, contact: { t: 1.38, push: 0.2, you: 0.07 } },
    build(clips, legs) {
      const segs = [{ clip: '78_32', from: 0.0, at: 0 },
        { clip: '124_06', from: 2.633, at: 1.05, inert: 0.25, shot: true, unwind: { from: 3.02, to: 3.85, ramp: 0.12, k: 0.85 } }];
      const tTake = 1.05 + (3.02 - 2.633), TAKE = { x: 0.95, z: 0.95 };
      const you = anchoredTrack(clips, segs, legs.you, tTake, { ...TAKE, yaw: yawTo(TAKE, { x: 0.25, z: 0.05 }) });
      // help: 78_26 sprints over and breaks down; anchored so that at the contact he is at the driver's left
      // shoulder, a step up the lane, facing him - caught as he breaks down, still sliding (~1.5 m/s)
      const c = REPS.contact.plan.contact.t, h = you.hip(c), f = you.at(c).yaw, CL = 1.65;
      const left = { x: Math.cos(f), z: -Math.sin(f) }, fw = { x: Math.sin(f), z: Math.cos(f) };
      const at = { x: h.x + left.x * 0.48 + fw.x * 0.22, z: h.z + left.z * 0.48 + fw.z * 0.22 };
      // ...and after the bump he gathers and goes up late, straight up (the jump of 124_05, cut in as his slide
      // dies): his hands get there as the ball comes off the glass
      const d1 = anchoredTrack(clips, [{ clip: '78_26', from: CL - c, at: 0 },
        { clip: '124_05', from: 2.90, at: c + (1.70 - CL), inert: 0.3, unwind: { from: 3.15, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.15 } }],
        legs.d1, c, { ...at, yaw: yawTo(at, h) });
      return { you, d1 };
    },
  },
};

export function buildRep(name, clips, legs) { return REPS[name].build(clips, legs); }
export { clipYaw };
