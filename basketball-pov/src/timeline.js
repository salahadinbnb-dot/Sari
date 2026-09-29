// The possession. Court coords: rim at (0,0), +z toward half court. Offense attacks toward -z.
// YOU faces -z (yaw = PI): YOUR right = +x.  D1 faces +z (yaw 0).
import { Path, keyed, stanceTrack, yawOf, smooth, clamp, lerp } from './motion.js';

const PI = Math.PI;
export const RIM = { x: 0, z: 0, y: 3.05 };

export const TL = {
  simEnd: 13.4,
  players: {},
};

// ---------- YOU ----------
TL.players.you = {
  path: new Path([
    [0, 0.35, 8.28], [0.85, 0.35, 8.28, 1],
    [4.3, 0.35, 8.28, 1], [4.8, 1.3, 7.9], [5.35, 2.2, 7.45], [5.72, 2.42, 7.38, 1],
    [5.95, 2.42, 7.38, 1], [6.55, 1.95, 8.05], [7.12, 1.4, 8.72, 1],
    [8.6, 1.4, 8.72, 1], [8.85, 2.02, 8.55], [9.1, 2.6, 7.97], [9.4, 2.93, 6.95], [9.75, 2.76, 5.62], [10.05, 2.52, 4.86], [10.38, 2.32, 4.3], [10.8, 2.2, 3.95, 1],
    [13.4, 2.2, 3.95, 1],
  ]),
  // face: rim; during the catch turn toward the wing; on the drive, lean into the direction of travel
  yaw: (t, W) => {
    const p = W.you.path.at(t);
    const toRim = yawOf(RIM.x - p.x, RIM.z - p.z);
    const toWing = yawOf(-6.3 - p.x, 5.05 - p.z);
    let y = lerpA(toWing, toRim, smooth((t - 0.55) / 0.55) * 0.75 + 0.25 * smooth((t - 0.95) / 0.4));
    if (t < 0.55) y = lerpA(toWing, toRim, 0.0);
    const v = W.you.path.vel(t); const sp = Math.hypot(v.x, v.z);
    const drive = smooth((t - 8.55) / 0.25) * (1 - smooth((t - 10.3) / 0.4)) * clamp((sp - 0.6) / 1.2, 0, 1);
    if (drive > 0) y = lerpA(y, lerpA(yawOf(v.x, v.z), toRim, 0.35), drive);
    return y;
  },
  stance: stanceTrack([[0, 'athletic'], [1.1, 'triple'], [4.35, 'dribble', 0.2], [10.1, 'athletic', 0.3], [11.0, 'upright', 0.6]]),
  gait: (t) => (t > 5.9 && t < 7.2) ? 'back' : 'run',
  // jab step: right foot forward-right and back
  footOverride: (side, t, W, base) => {
    if (side !== 'R' || t < 2.7 || t > 3.42) return null;
    return { kind: 'jab', t0: 2.7, out: 2.86, hold: 3.14, back: 3.36, fwd: 0.34, right: 0.16 };
  },
  actions: [
    [0, 'ready'], [0.45, 'catch'], [0.85, 'hold'], [4.3, 'dribble'], [10.02, 'pass'], [10.4, 'follow'], [11.2, 'relax'],
  ],
  look: (t, W) => (t < 0.85 ? W.ballPos(t) : t > 9.8 && t < 10.3 ? W.pos('screener', t, 1.4) : t > 10.3 ? W.ballPos(t) : W.pos('d1', t, 1.6)),
};

// ---------- D1: on-ball defender ----------
TL.players.d1 = {
  path: new Path([
    [0, 0.35, 7.32, 1],
    [4.33, 0.35, 7.32, 1], [4.85, 1.32, 6.95], [5.4, 2.08, 6.58], [5.75, 2.22, 6.5, 1],
    [6.05, 2.22, 6.5, 1], [6.65, 1.8, 7.12], [7.25, 1.32, 7.74, 1],
    [8.62, 1.32, 7.74, 1], [8.9, 1.62, 8.32], [9.15, 2.28, 8.62], [9.38, 2.56, 8.08], [9.58, 2.45, 7.42], [9.88, 2.34, 6.35], [10.12, 2.24, 5.55], [10.42, 2.14, 4.86], [10.9, 2.0, 4.45, 1],
    [13.4, 2.0, 4.45, 1],
  ]),
  yaw: (t, W) => {
    const face = W.faceYaw('d1', 'you', t);
    const v = W.d1.path.vel(t); const sp = Math.hypot(v.x, v.z);
    const chase = smooth((t - 8.72) / 0.2) * (1 - smooth((t - 10.4) / 0.4)) * clamp((sp - 0.8) / 1.2, 0, 1);
    return chase > 0 ? lerpA(face, yawOf(v.x, v.z), chase * 0.8) : face;
  },
  stance: stanceTrack([[0, 'defense'], [8.8, 'athletic', 0.2], [10.6, 'defense', 0.4], [11.4, 'upright', 0.8]]),
  gait: (t) => (t < 8.7 ? 'slide' : 'run'),
  actions: [[0, 'defend'], [8.8, 'runArms'], [10.5, 'defend'], [11.4, 'relax']],
  look: (t, W) => W.ballPos(t),
};

// ---------- SCREENER (teammate big) ----------
TL.players.screener = {
  path: new Path([
    [0, -2.15, 0.95, 1],
    [6.0, -2.15, 0.95, 1], [6.8, -1.1, 3.3], [7.7, 0.95, 6.4], [8.28, 1.93, 7.83, 1],
    [9.18, 1.93, 7.83, 1], [9.55, 1.3, 6.7], [9.9, 0.62, 5.2], [10.25, 0.26, 3.8], [10.47, 0.16, 3.1], [10.72, 0.1, 2.3], [10.95, 0.06, 1.55, 1],
    [11.25, 0.04, 1.15], [11.55, 0.02, 0.95, 1],
    [13.4, 0.02, 0.95, 1],
  ]),
  yaw: (t, W) => {
    const runYaw = (tt) => { const v = W.screener.path.vel(tt); return yawOf(v.x, v.z); };
    if (t < 6.0) return W.faceYaw('screener', 'you', t);
    if (t < 6.25) return lerpA(W.faceYaw('screener', 'you', 6.0), runYaw(6.3), smooth((t - 6.0) / 0.25));
    if (t < 8.0) return runYaw(t);
    if (t < 9.2) return lerpA(runYaw(7.95), SCREEN_YAW, smooth((t - 8.0) / 0.35));
    if (t < 10.85) {
      const target = t < 10.47 ? runYaw(t) : PI;
      return lerpA(SCREEN_YAW, target, smooth((t - 9.2) / 0.3));
    }
    return PI;
  },
  stance: stanceTrack([[0, 'athletic'], [6.0, 'athletic'], [8.1, 'screen', 0.2], [9.15, 'athletic', 0.2], [11.6, 'upright', 0.6]]),
  gait: () => 'run',
  actions: [[0, 'ready'], [6.0, 'runArms'], [8.05, 'screen'], [9.2, 'target'], [10.4, 'catch'], [10.47, 'hold'], [10.72, 'layup'], [11.22, 'finish'], [11.75, 'relax', 0.5]],
  jump: { t0: 10.95, t1: 11.55, h: 0.55 },
  look: (t, W) => (t < 10.5 ? W.ballPos(t) : { x: 0, y: 3.1, z: 0 }),
};

// ---------- D2: help defender (guards the screener) ----------
TL.players.d2 = {
  path: new Path([
    [0, -1.25, 1.75, 1],
    [6.15, -1.25, 1.75, 1], [7.4, 0.1, 4.2], [8.25, 0.78, 5.12, 1],
    [9.55, 0.78, 5.12, 1], [9.8, 1.4, 4.45], [10.06, 2.0, 3.86, 1],
    [10.22, 2.0, 3.86, 1], [10.55, 1.3, 3.1], [10.95, 0.62, 2.15, 1],
    [13.4, 0.62, 2.15, 1],
  ]),
  yaw: (t, W) => lerpA(W.faceYaw('d2', 'you', t), W.faceYaw('d2', 'screener', t), smooth((t - 10.02) / 0.35)),
  stance: stanceTrack([[0, 'help'], [6.15, 'athletic', 0.2], [8.1, 'help', 0.3], [9.6, 'defense', 0.2], [10.2, 'athletic', 0.15], [11.3, 'upright', 0.8]]),
  gait: (t) => (t > 9.5 && t < 10.15 ? 'slide' : 'run'),
  actions: [[0, 'help'], [6.1, 'runArms'], [8.1, 'help'], [9.6, 'defend'], [10.2, 'runArms', 0.3], [10.85, 'contest', 0.4], [11.5, 'relax', 0.5]],
  look: (t, W) => W.ballPos(t),
};

// ---------- WING (passes to YOU) ----------
TL.players.wing = {
  path: new Path([[0, -6.3, 5.05, 1], [1.2, -6.3, 5.05, 1], [2.2, -6.55, 4.7, 1], [13.4, -6.55, 4.7, 1]]),
  yaw: (t, W) => W.faceYaw('wing', t < 1 ? 'you' : 'you', t),
  stance: stanceTrack([[0, 'wing']]),
  gait: () => 'run',
  actions: [[0, 'hold'], [0.25, 'chestPass'], [0.55, 'ready']],
  look: (t, W) => W.ballPos(t),
};

// ---------- D3 (guards the wing) ----------
TL.players.d3 = {
  path: new Path([[0, -5.55, 4.55, 1], [0.6, -5.55, 4.55, 1], [1.4, -5.0, 4.95, 1], [13.4, -5.0, 4.95, 1]]),
  // on the ball: face the wing; after the pass: open up toward the court (ball-you-man), no 180-degree ambiguity
  yaw: (t, W) => lerpA(W.faceYaw('d3', 'wing', t), lerpA(0.2, W.faceYaw('d3', 'you', t), 0.35), smooth((t - 0.5) / 0.6)),
  stance: stanceTrack([[0, 'defense'], [1.5, 'help', 0.5]]),
  gait: () => 'slide',
  actions: [[0, 'defend'], [1.3, 'help']],
  look: (t, W) => W.ballPos(t),
};

const SCREEN_YAW = -PI / 2 + 0.25;
function lerpA(a, b, t) { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * clamp(t, 0, 1); }

// ---------- BALL ----------
// dribble bounce times (floor contacts) for YOU
const B = [4.5, 4.92, 5.33, 5.78, 6.2, 6.62, 7.05, 7.5, 7.95, 8.4, 8.78, 9.14, 9.5, 9.86];
TL.ball = [
  { t: 0, state: 'held', who: 'wing', anchor: 'chest' },
  { t: 0.26, state: 'flight', to: { who: 'you', anchor: 'catch', t: 0.86 }, arc: 0.22 },
  { t: 0.86, state: 'held', who: 'you', anchor: 'catch' },
  { t: 1.0, state: 'held', who: 'you', anchor: 'pocket', blend: 0.4 },
  { t: 4.3, state: 'dribble', who: 'you', bounces: B, end: 10.02 },
  { t: 10.02, state: 'flight', to: { who: 'screener', anchor: 'catch', t: 10.47 }, bounceAt: 0.6 },
  { t: 10.47, state: 'held', who: 'screener', anchor: 'catch' },
  { t: 10.6, state: 'held', who: 'screener', anchor: 'gather', blend: 0.18 },
  { t: 10.95, state: 'held', who: 'screener', anchor: 'layup', blend: 0.3 },
  { t: 11.22, state: 'shot', t1: 11.58 },
  { t: 11.58, state: 'net', t1: 11.82 },
  { t: 11.82, state: 'drop', t1: 13.4 },
];

// ---------- video time mapping: [simStart, simEnd, rate] and freezes ----------
TL.segments = [
  { freeze: 0.0, dur: 1.6, tag: 'intro' },
  { from: 0.0, to: 1.05, rate: 1.0 },
  { freeze: 1.05, dur: 1.7, tag: 'setup' },
  { from: 1.05, to: 4.3, rate: 1.0 },
  { from: 4.3, to: 5.46, rate: 0.7 },
  { freeze: 5.46, dur: 3.6, tag: 'notbeaten' },
  { from: 5.46, to: 7.12, rate: 1.0 },
  { from: 7.12, to: 8.6, rate: 1.0 },
  { from: 8.6, to: 9.5, rate: 0.6 },
  { freeze: 9.5, dur: 2.4, tag: 'opening' },
  { from: 9.5, to: 9.98, rate: 0.6 },
  { freeze: 9.98, dur: 3.0, tag: 'help' },
  { from: 9.98, to: 10.6, rate: 0.5 },
  { from: 10.6, to: 11.9, rate: 1.0 },
  { from: 11.9, to: 13.3, rate: 0.62 },
];

export function buildTimeMap(fps) {
  const frames = [];
  let vt = 0;
  for (const s of TL.segments) {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ st: s.freeze, vt: vt + i / fps, freeze: s.tag, fu: i / n, fdur: s.dur });
      vt += n / fps;
    } else {
      const dur = (s.to - s.from) / s.rate;
      const n = Math.round(dur * fps);
      for (let i = 0; i < n; i++) frames.push({ st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate });
      vt += n / fps;
    }
  }
  return frames;
}
