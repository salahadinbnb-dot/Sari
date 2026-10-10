// v11 "behind the curtain": a sharp player learns a new move - between the legs, cross, cross back, hop back, rise -
// in a few reps, then makes it his own. The same real take (CMU 06_13's step-back sequence, v8's rep 4) at three
// stages, then live against a man who has learned it too:
//  rep1  - thinking it: the whole thing slower, the hop back a slow, floating 0.5 s; his man has time to get back
//          from the cross and the shot comes up short
//  rep3  - wiring it: quicker everywhere, the hop 0.38 s
//  rep6  - owning it: full speed, the hop 0.31 s - gone before his man is back
//  live  - his man knows it now: he barely bites on the cross and steps right back in at the step-back. So the hop
//          back is the set-up: ball up to the forehead (78_22's shot fake), he leaves his feet, and you rise (124_05)
//          as he comes down
// Court: rim at (0,0), offense attacks -z.
import { anchoredTrack, RIM } from './play5.js';

export const CLIPS11 = ['06_13', '124_05', '78_30', '78_22', '78_25'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
// 124_05's jump drifts ~0.35 m in the air, mostly sideways; keep a third of it so the jump goes up, not across
const JUMP_STRAIGHT = { from: 3.15, to: 3.72, k: 0.33, ramp: 0.12 };
const SHOT = (from, at, extra = {}) => ({ clip: '124_05', from, at, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT, ...extra });
const simOf = (sg, ct) => sg.at + (ct - sg.from) / (sg.rate ?? 1);
// 06_13's move, in clip time
const MOVE = { legs: 28.80, cross: 29.18, back: 29.52, hop0: 29.55, hop1: 30.05, gather: 29.9 };

// his recovery, the same every rep (s after your cross): sliding back at you from `back`, sitting down at `sit`
const REC = { back: 0.85, sit: 1.32 };
// the practice reps: the same take at a given pace (`a`: the dribble moves, `b`: the hop back)
function practice(a, b, spot, miss) {
  return {
    simEnd: 3.4 / Math.min(1, a) + 0.4,
    plan: { hold: [0, 0.02], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 0.8, camAngle: 0.2, camSide: 1, camH: 1.8, camPush: 0.4, ...(miss ? { miss } : {}) },
    build(clips, legs) {
      const P = this.plan;
      const A = { clip: '06_13', from: 28.6, at: 0, rate: a };
      const B = { clip: '06_13', from: 29.5, at: simOf(A, 29.5), rate: b, inert: 0.1 };
      P.dribble = [0.0, simOf(B, 29.75)]; P.gatherAt = simOf(B, MOVE.gather);
      const segs = [A, B, SHOT(3.04, simOf(B, 30.12), { inert: 0.18 })];
      const tOff = simOf(segs[2], 3.17), SPOT = spot;
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[2], 3.38), tCross = simOf(A, MOVE.cross);
      // him: a stride off, square; slides with the first cross (78_30's slide to his right, a reaction time after it),
      // then plants and slides back at you (its slide to his left from where it's picking up speed - it runs ~80 deg
      // left of where he faces - aimed a stride short of where you'll shoot) and sits down there. The same man every
      // rep, on the same clock from your cross: the slower your hop, the more of the way back he gets
      const h = you.hip(tCross), F = you.at(tCross).yaw, at0 = { x: h.x + Math.sin(F) * 1.15, z: h.z + Math.cos(F) * 1.15 };
      const yr = you.hip(release), L = Math.hypot(at0.x - yr.x, at0.z - yr.z) || 1, T = { x: yr.x + (at0.x - yr.x) / L * 0.9, z: yr.z + (at0.z - yr.z) / L * 0.9 };
      const tBack = tCross + REC.back, tSit = tCross + REC.sit;
      const dsegs = [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } }, { clip: '78_30', from: 0.05, at: tCross + 0.15, inert: 0.2 },
        { clip: '78_30', from: 1.45, at: tBack, inert: 0.2, yawAbs: (p) => yawTo(p, T) - 80 * Math.PI / 180 },
        { clip: '78_30', from: 2.45, at: tSit, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, yr) }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, tCross, { ...at0, yaw: yawTo(at0, h) });
      // his hand comes up as he gets back - on the same clock every rep, so the quicker you are, the less of it there is
      P.contest = [{ from: tCross + 1.1, rise: 0.25, to: release + 0.5, side: 'L', reach: 0.1 }];
      // the parts of the move, in sim time (for the chunk strip), and the hop's length
      P.parts = { legs: simOf(A, MOVE.legs), cross: tCross, back: simOf(A, MOVE.back), hop0: simOf(B, MOVE.hop0), hop1: simOf(B, MOVE.hop1), off: tOff };
      P.vals = { hop: (P.parts.hop1 - P.parts.hop0).toFixed(2) };
      return { you, d1 };
    },
  };
}

export const REPS = {
  rep1: practice(0.8, 1.0, { x: -2.6, z: 6.3 }, { side: 0.04, kick: 0.3 }),
  rep3: practice(0.9, 1.3, { x: -2.6, z: 6.3 }),
  rep6: practice(1.0, 1.6, { x: -2.6, z: 6.3 }),
  live: {
    simEnd: 4.1,
    plan: { hold: [0, 0.02], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 0.8, camAngle: 0.2, camSide: 1, camH: 1.8, camPush: 0.4 },
    build(clips, legs) {
      const P = this.plan;
      // you: the move at full speed, and off the hop back the ball goes up to your forehead - 78_22's shot fake (the
      // ball rising from the hip at 1.5, at the top 1.9-2.2), eyes on the rim - then down into the dip and up
      // (124_05) as he comes down past you. You've picked up your dribble, so it's the fake and the shot: no travel
      const A = { clip: '06_13', from: 28.6, at: 0 };
      const B = { clip: '06_13', from: 29.5, at: simOf(A, 29.5), rate: 1.6, inert: 0.1 };
      P.dribble = [0.0, simOf(B, 29.75)]; P.gatherAt = simOf(B, MOVE.gather);
      const C = { clip: '78_22', from: 1.5, at: simOf(B, 30.08), rate: 1.15, inert: 0.2 };
      const fakeTop = simOf(C, 1.95);
      const segs = [A, B, C, SHOT(3.0, simOf(C, 2.25), { inert: 0.3 })];
      const tOff = simOf(segs[3], 3.17), SPOT = { x: -2.6, z: 6.3 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[3], 3.38), tCross = simOf(A, MOVE.cross);
      P.lookRim = [simOf(C, 1.6), simOf(C, 2.3)];
      // him: square a stride off; on the cross he only gives a step (he's seen it), and as you go back he steps right
      // back in at you (78_25's last chop steps, aimed at a spot a stride off you) - and at the top of your fake he leaves
      // his feet (124_05's jump). He comes down where he went up, a stride in front of you, as you go up
      const jumpAt = fakeTop - 0.2, hop0 = simOf(B, MOVE.hop0), run = tCross + 0.4;
      const h = you.hip(tCross), F = you.at(tCross).yaw, at0 = { x: h.x + Math.sin(F) * 1.15, z: h.z + Math.cos(F) * 1.15 };
      const hj = you.hip(jumpAt);
      const T = (p) => { const d = Math.hypot(p.x - hj.x, p.z - hj.z) || 1; return { x: hj.x + (p.x - hj.x) / d * 0.95, z: hj.z + (p.z - hj.z) / d * 0.95 }; };
      const landAt = jumpAt + (3.76 - 3.05), hl = you.hip(landAt);
      const dsegsFor = (carry) => [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } },
        { clip: '78_30', from: 0.05, at: tCross + 0.15, inert: 0.2 },
        { clip: '78_25', from: 1.95, at: run, inert: 0.2, yawAbs: (p) => yawTo(p, T(p)) - 42 * Math.PI / 180 },
        { clip: '124_05', from: 3.05, at: jumpAt, inert: 0.16, unwind: { from: 3.15, to: 3.72, ramp: 0.08 }, compress: { ...JUMP_STRAIGHT, k: 0.15, carry } },
        { clip: '78_30', from: 2.45, at: landAt + 0.1, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, hl) }];
      // (the jump's carry takes him to 0.75 m off you, from wherever his steps leave him: built once to find that)
      const probe = anchoredTrack(clips, dsegsFor({ x: 0, z: 0 }), legs.d1, tCross, { ...at0, yaw: yawTo(at0, h) });
      const pj = probe.hip(jumpAt), pl = probe.hip(landAt), air = 3.72 - 3.15, dj = Math.hypot(pj.x - hl.x, pj.z - hl.z) || 1;
      const land = { x: hl.x + (pj.x - hl.x) / dj * 0.75, z: hl.z + (pj.z - hl.z) / dj * 0.75 };
      const carry = { x: (land.x - pl.x) / air, z: (land.z - pl.z) / air };
      const d1 = anchoredTrack(clips, dsegsFor(carry), legs.d1, tCross, { ...at0, yaw: yawTo(at0, h) });
      P.vals = { ...(P.vals || {}), carry: Math.hypot(carry.x, carry.z).toFixed(2), jumpFrom: Math.hypot(pj.x - hj.x, pj.z - hj.z).toFixed(2) };
      // his hands up at the ball on the fake; by the time you rise he's coming down
      P.contest = [{ from: jumpAt - 0.2, rise: 0.2, to: jumpAt + 0.6, fall: 0.25, both: true, reach: 0.16 }];
      P.parts = { legs: simOf(A, MOVE.legs), cross: tCross, back: simOf(A, MOVE.back), hop0, hop1: simOf(B, MOVE.hop1), fake: fakeTop, off: tOff, run, jump: jumpAt };
      P.vals = { ...P.vals, hop: (P.parts.hop1 - P.parts.hop0).toFixed(2) };
      return { you, d1 };
    },
  },
};

export function buildRep(name, clips, legs) { return REPS[name].build(clips, legs); }
