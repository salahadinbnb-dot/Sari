// v9 "lockdown": you're the defender. The same kind of good ball handler as v8, and the things that beat a slow
// shooter's man there don't beat you: you stay down on the fake, you slide with the cross instead of lunging at it,
// and as a team you stop the ball and get back out to your man. Built from whole real takes (CMU mocap) on the v5
// engine, each ending in a contested miss:
//  1 stay down  - 78_22's shot fake and break (the v8 head fake, same move); you close out (78_25) and stop with your
//                 hands up, feet down, slide with the break (78_30) and contest the pull-up
//  2 mirror     - 06_13's attack and crosses into a pull-up (124_05); you hold a cushion and slide with his cross
//                 (78_30), chest in front, and contest
//  3 help       - his man drives (78_32) by your teammate (78_25); you sprint over from the gap and stop the ball
//                 (78_26), he jump-stops and kicks it out to your man (124_05), and you close out (78_25) and contest
// Court: rim at (0,0), offense attacks -z.
import { anchoredTrack, RIM } from './play5.js';
import { findPushes } from './rep5.js';

export const CLIPS9 = ['78_22', '124_05', '78_25', '78_30', '06_13', '78_32', '78_26'];
const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
const JUMP_STRAIGHT = { from: 3.15, to: 3.72, k: 0.33, ramp: 0.12 };
const SHOT = (from, at, extra = {}) => ({ clip: '124_05', from, at, inert: 0.3, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT, ...extra });
const simOf = (sg, ct) => sg.at + (ct - sg.from) / (sg.rate ?? 1);
const DEG = Math.PI / 180;
// a point `d` metres in front of the shooter at t (toward the rim), where you want to be
const inFront = (you, t, d) => { const h = you.hip(t), a = Math.atan2(RIM.x - h.x, RIM.z - h.z); return { x: h.x + Math.sin(a) * d, z: h.z + Math.cos(a) * d }; };
// how far a take's hips travel on the floor between clip times a and b (our scale)
function travel(clip, a, b) {
  const H = clip.pos.lhipjoint, K = clip.pos.rhipjoint, at = (ct) => { const i = Math.max(0, Math.min(clip.n - 1, Math.round(ct * clip.fps))); return [(H[i * 3] + K[i * 3]) / 2, (H[i * 3 + 2] + K[i * 3 + 2]) / 2]; };
  let d = 0, p = at(a); for (let ct = a + 0.02; ct <= b + 1e-6; ct += 0.02) { const q = at(ct); d += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  return d * (clip.cal ? clip.cal.scale : 1);
}
// the clip time to start a stretch that ends at `end` so the hips cover `dist`
function startFor(clip, end, dist, lo, hi) { for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (travel(clip, m, end) > dist) lo = m; else hi = m; } return (lo + hi) / 2; }

export const REPS = {
  staydown: {
    simEnd: 4.6,
    plan: { hold: [0, 1.66], holdHands: true, lookRim: [0.25, 1.2], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 1.0, camAngle: 1.0, camSide: -1,
      miss: { side: 0.04, kick: 0.3 } },
    build(clips, legs) {
      const P = this.plan;
      // him: the v8 head fake, beat for beat - sizes you up, sells the shot, rips it down, breaks right off one hard
      // dribble and pulls up
      const A = { clip: '78_22', from: 1.2, at: 0 };
      const B = { clip: '78_22', from: 2.35, at: simOf(A, 2.35), rate: 2.2, inert: 0.12 };
      const C = { clip: '78_22', from: 3.3, at: simOf(B, 3.3), rate: 1.25, inert: 0.12 };
      const push = findPushes(clips['78_22'], 3.4, 4.2).find(p => p.hand === 'R'), s1 = simOf(C, push.c1);
      P.dribble = [C.at + 0.01, s1 + 0.02]; P.gatherAt = s1 + 0.3;
      const segs = [A, B, C, SHOT(2.75, P.gatherAt - 0.06)];
      const tOff = simOf(segs[3], 3.17), SPOT = { x: 1.9, z: 4.7 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[3], 3.38);
      // you: the same closeout, but you stop - chop steps, hands up at the ball, feet on the floor (78_25 through its
      // stop); on his break you slide with him (78_30's slide to your left, which travels ~75 deg left of where you
      // face), aimed to stop a stride in front of his pull-up, then square up and contest
      const t0 = 0.74, h = you.hip(t0), F = you.at(t0).yaw, fw = { x: Math.sin(F), z: Math.cos(F) }, lf = { x: Math.cos(F), z: -Math.sin(F) };
      const at0 = { x: h.x + fw.x * 1.3 + lf.x * 0.3, z: h.z + fw.z * 1.3 + lf.z * 0.3 };
      const goal = inFront(you, release, 0.55), tGo = C.at + 0.22;
      const close = { clip: '78_25', from: 1.99 - t0, at: 0 };
      const probe = anchoredTrack(clips, [close], legs.d1, t0, { ...at0, yaw: yawTo(at0, h) }), q = probe.hip(tGo);
      // (start the slide where what's left of it covers the ground to that spot; played to land just before his release)
      const from = startFor(clips['78_30'], 2.45, Math.hypot(goal.x - q.x, goal.z - q.z), 1.1, 2.3), rate = Math.max(1, (2.45 - from) / (release - 0.25 - tGo));
      const dsegs = [close,
        { clip: '78_30', from, at: tGo, rate, inert: 0.25, yawAbs: (p) => yawTo(p, goal) - 75 * DEG },
        { clip: '78_30', from: 2.45, at: tGo + (2.45 - from) / rate, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, you.hip(release)) },
        { clip: '78_25', from: 2.62, at: Math.max(tGo + (2.45 - from) / rate + 0.1, release - 0.4), inert: 0.3, idle: { amp: 0.05, period: 1.5 }, yawAbs: (p) => yawTo(p, you.hip(release)) }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, t0, { ...at0, yaw: yawTo(at0, h) });
      // hands: up at the ball through the fake (no jump), then both up on the shot
      P.contest = [{ from: 0.62, rise: 0.22, to: 1.35, fall: 0.3, both: true, reach: 0.12 },
        { from: release - 0.3, rise: 0.25, to: release + 0.6, both: true, reach: 0.1 }];
      P.labels = [{ t: 0, kind: 'closing', open: 0.55 }, { t: 0.3, kind: 'chop', open: 0.3 }, { t: 0.7, kind: 'stay', open: 0 },
        { t: tGo, kind: 'slide', open: 0.1 }, { t: release - 0.35, kind: 'contest', open: 0 }];
      P.marks = { bite: 1.0, go: tGo + 0.25 }; P.vals = {};
      return { you, d1 };
    },
  },
  mirror: {
    simEnd: 3.0,
    plan: { hold: [0, 0.02], gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 0.6, camAngle: 0.55, camSide: 1, camH: 2.0,
      miss: { side: -0.05, kick: -0.35 } },
    build(clips, legs) {
      const P = this.plan;
      // him: 06_13 from 28.9 - attacking, the cross to his left (29.18) and back (29.52), and with nowhere to go he
      // pulls up off the second cross (124_05 cut in as the ball comes back up)
      const A = { clip: '06_13', from: 28.9, at: 0 };
      P.dribble = [0.0, simOf(A, 29.66)]; P.gatherAt = simOf(A, 29.78);
      const segs = [A, SHOT(2.75, simOf(A, 29.74), { inert: 0.3 })];
      const tOff = simOf(segs[1], 3.17), SPOT = { x: -2.4, z: 6.0 };
      const you = anchoredTrack(clips, segs, legs.you, tOff, { ...SPOT, yaw: yawTo(SPOT, RIM) });
      const release = simOf(segs[1], 3.38), c1 = simOf(A, 29.18), c2 = simOf(A, 29.52);
      // you: a cushion off him, hips down (78_30's stop, kept alive) - he comes to you; a short slide with his cross
      // (78_30's slide to your right, from mid-slide, quick) into your stance again, square to him, and up into the
      // contest (78_25's stance after its stop, hips higher)
      const h = you.hip(0), F = you.at(0).yaw, at0 = { x: h.x + Math.sin(F) * 1.9, z: h.z + Math.cos(F) * 1.9 };
      const dsegs = [{ clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } },
        { clip: '78_30', from: 0.5, at: c1 + 0.12, rate: 1.4, inert: 0.18 },
        { clip: '78_30', from: 0.95, at: c1 + 0.12 + 0.42 / 1.4, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, you.hip(release)) },
        { clip: '78_25', from: 2.62, at: release - 0.4, inert: 0.3, idle: { amp: 0.05, period: 1.5 }, yawAbs: (p) => yawTo(p, you.hip(release)) }];
      const d1 = anchoredTrack(clips, dsegs, legs.d1, 0, { ...at0, yaw: yawTo(at0, h) });
      P.contest = [{ from: release - 0.3, rise: 0.25, to: release + 0.6, both: true, reach: 0.1 }];
      P.labels = [{ t: 0, kind: 'balanced', open: 0 }, { t: c1 + 0.1, kind: 'mirror', open: 0.05 }, { t: release - 0.35, kind: 'contest', open: 0 }];
      P.marks = { bite: c2 + 0.05 }; P.vals = {};
      return { you, d1 };
    },
  },
  // 3 - help and recover: his man drives by your teammate; you step over from the wing and stop the ball, he kicks
  // it out to your man, and you get back out to him - short, hand high - and contest. Two reps share your track:
  // the drive and the help (his ball until the pass), then the kick-out and the closeout (your man's ball after it).
  help: {
    simEnd: 4.6,
    plan: { gatherDur: 0.2, shotClip: 3.38, flight: 1.15, camRef: 2.4, camAngle: 0.9, camSide: -1, camH: 2.4, miss: { side: 0.05, kick: 0.3 } },
    build(clips, legs) {
      const P = this.plan;
      // the driver: 78_32's straight drive from the top at 0.9x, two dribbles, then he jump-stops when he sees you
      // (124_05's gather and dip, held) and kicks it out
      const A = { clip: '78_32', from: 0.0, at: 0, rate: 0.9 };
      const pk = findPushes(clips['78_32'], 0.8, 1.2, 'R')[0], s1 = simOf(A, pk.c1);
      const planA = { pushHand: 'R', dribble: [0.05, s1 + 0.02], gatherAt: s1 + 0.24, gatherDur: 0.2, passOut: true, simEnd: this.simEnd };
      const stopAt = planA.gatherAt - 0.06, t0 = stopAt + 0.5;
      const asegs = [A, { clip: '124_05', from: 2.75, at: stopAt, inert: 0.35 }, { clip: '124_05', from: 2.98, at: stopAt + 0.23, inert: 0.15, idle: { amp: 0.03, period: 1.2 } }];
      const STOP = { x: -1.6, z: 3.1 };
      const o1 = anchoredTrack(clips, asegs, legs.you, stopAt + 0.3, { ...STOP, yaw: yawTo(STOP, RIM) });
      planA.release = t0;
      // your man: spotted up on the left wing, ready (124_05's stance, kept alive), and the catch and shoot - its
      // turn from the catch to the rim (60 deg in the take) cut to the 22 deg there is from the pass to the rim here
      const WING = { x: -4.45, z: 4.25 }, flight = Math.hypot(WING.x - STOP.x, WING.z - STOP.z) / 8.5, t1 = t0 + flight;
      const c0 = t1 - 0.4, tTake = c0 + (3.12 - 1.92);
      const o2 = anchoredTrack(clips, [{ clip: '124_05', from: 1.85, at: 0, idle: { amp: 0.06, period: 1.6 } },
        { clip: '124_05', from: 1.92, at: c0, inert: 0.2, unwind: { from: 2.32, to: 3.12, ramp: 0.2, k: 0.63 } },
        { clip: '124_05', from: 3.12, at: tTake, inert: 0.05, shot: true, unwind: { from: 3.17, to: 3.72, ramp: 0.08 }, compress: JUMP_STRAIGHT }],
        legs.you, tTake, { ...WING, yaw: yawTo(WING, RIM) });
      P.pass = { from: { x: 0, y: 1.2, z: 0 }, t0, t1 }; P.gatherAt = t1; planA.passDir = { x: WING.x - STOP.x, z: WING.z - STOP.z };
      const release = tTake + (3.38 - 3.12);
      // your teammate, beaten: 78_25's sprint half a step behind the driver, on his left
      const hS = o1.hip(stopAt), FS = o1.at(stopAt).yaw, fwS = { x: Math.sin(FS), z: Math.cos(FS) }, lfS = { x: Math.cos(FS), z: -Math.sin(FS) };
      const xAt = { x: hS.x - fwS.x * 1.0 + lfS.x * 0.55, z: hS.z - fwS.z * 1.0 + lfS.z * 0.55 };
      const x1 = anchoredTrack(clips, [{ clip: '78_25', from: 1.8 - stopAt, at: 0 }], legs.d1, stopAt, { ...xAt, yaw: FS - 45 * DEG });
      // you: guarding your man from the gap (sagged off him toward the ball, hips down - 78_30's stop, kept alive);
      // on the drive you sprint over and break down in front of him (78_26, which runs ~45 deg left of where you
      // face), then on the kick-out you close out (78_25's sprint and stop, which runs ~40 deg left of where you face),
      // stopping a stride short of your man as he goes up
      const help = { x: STOP.x - fwS.x * -0.95, z: STOP.z - fwS.z * -0.95 }; // in front of the stop, toward the rim
      const GAP = { x: WING.x + (help.x - WING.x) * 0.45, z: WING.z + (help.z - WING.z) * 0.45 + 0.4 };
      const tHelp = 0.42, close = inFront(o2, release, 0.75);
      const g0 = { clip: '78_30', from: 0.93, at: 0, idle: { amp: 0.1, period: 1.6 } };
      const probe = anchoredTrack(clips, [g0], legs.d1, 0, { ...GAP, yaw: yawTo(GAP, o1.hip(0)) });
      const q0 = probe.hip(tHelp), hFrom = startFor(clips['78_26'], 1.95, Math.hypot(help.x - q0.x, help.z - q0.z), 0.2, 1.6);
      const hRate = Math.max(0.8, (1.95 - hFrom) / (stopAt + 0.15 - tHelp));
      const dsegs = [g0,
        { clip: '78_26', from: hFrom, at: tHelp, rate: hRate, inert: 0.2, yawAbs: (p) => yawTo(p, help) - 45 * DEG },
        { clip: '78_26', from: 1.95, at: tHelp + (1.95 - hFrom) / hRate, inert: 0.25, idle: { amp: 0.05, period: 1.4 }, yawAbs: (p) => yawTo(p, o1.hip(t0)) }];
      // (the closeout: from where the help leaves you, sized to stop a stride short of him)
      const probe2 = anchoredTrack(clips, dsegs, legs.d1, 0, { ...GAP, yaw: yawTo(GAP, o1.hip(0)) }), q1 = probe2.hip(t0 + 0.05);
      const cFrom = startFor(clips['78_25'], 2.05, Math.hypot(close.x - q1.x, close.z - q1.z), 0.6, 1.9);
      const cRate = Math.max(0.85, (2.05 - cFrom) / (release - 0.2 - (t0 + 0.05)));
      dsegs.push({ clip: '78_25', from: cFrom, at: t0 + 0.05, rate: cRate, inert: 0.2, yawAbs: (p) => yawTo(p, close) - 40 * DEG },
        { clip: '78_25', from: 2.3, at: t0 + 0.05 + (2.05 - cFrom) / cRate, inert: 0.3, idle: { amp: 0.06, period: 1.5 }, yawAbs: (p) => yawTo(p, o2.hip(release)) });
      const d1 = anchoredTrack(clips, dsegs, legs.d1, 0, { ...GAP, yaw: yawTo(GAP, o1.hip(0)) });
      P.contest = [{ from: release - 0.35, rise: 0.25, to: release + 0.6, side: 'L', reach: 0.08 }];
      planA.contest = [{ from: stopAt - 0.1, rise: 0.2, to: t0 + 0.1, fall: 0.2, both: true, reach: 0.05 }];
      P.labels = [{ t: 0, kind: 'balanced', open: 0 }, { t: tHelp, kind: 'help', open: 0.05 }, { t: t0 + 0.05, kind: 'recover', open: 0.3 },
        { t: release - 0.4, kind: 'contest', open: 0 }];
      planA.labels = P.labels;
      P.marks = { bite: stopAt + 0.2, pass: t0 }; P.vals = { flight: flight.toFixed(2) };
      P.camTeam = { off: { x: -0.5, y: 4.3, z: 5.4 }, lookOff: { x: -0.2, z: -0.5 }, lookY: 0.5, fov: 56 };
      return { you: o2, d1, extra: { o1, x1 }, partA: { tracks: { you: o1, d1 }, plan: planA } };
    },
  },
};

export function buildRep(name, clips, legs) { return REPS[name].build(clips, legs); }
