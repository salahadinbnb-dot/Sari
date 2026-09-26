// One looping motion clip (+ camera, props, muscle highlight) per exercise.
// Port of FitnessMotion/Motion/MotionLibrary.swift.
import { Pose, MotionClip, Side, Vec as V, euler, qx, qy, deg, Skeleton } from './skeleton.js?v=6';

export const cam = (azimuth, elevation = 8, distance = 4.2, targetHeight = 0.95, fov = 30, lateralOffset = 0) =>
  ({ azimuth, elevation, distance, targetHeight, fov, lateralOffset });

const clip = (duration, keys) => new MotionClip(duration, keys);
const rep = (duration, a, b, up = 0.42, hold = 0.08, bottomHold = 0.06) =>
  clip(duration, [[0, a], [up, b], [up + hold, b], [1 - bottomHold, a], [1, a]]);
const alternating = (duration, neutral, left, right) =>
  clip(duration, [[0, neutral], [0.22, left], [0.30, left], [0.5, neutral], [0.72, right], [0.80, right], [1, neutral]]);
const spec = (c, camera, props, highlight, handCurl = null) => ({ clip: c, camera, props, highlight, handCurl });

// ---- prop descriptors (see props.js)
const P = {
  dumbbells: () => ({ kind: 'dumbbells', sides: ['L', 'R'] }),
  dumbbell: s => ({ kind: 'dumbbells', sides: [s] }),
  barbell: width => ({ kind: 'barbell', width }),
  bench: backAngle => ({ kind: 'bench', backAngle }),
  latPulldown: () => ({ kind: 'latPulldown' }),
  cableRow: () => ({ kind: 'cableRow' }),
  cableColumn: (pulleyHeight, position, attachment, side) => ({ kind: 'cableColumn', pulleyHeight, position, attachment, side }),
  kettlebell: s => ({ kind: 'kettlebell', side: s }),
  ball: (position, radius) => ({ kind: 'ball', position, radius }),
  abWheel: () => ({ kind: 'abWheel' }),
  band: (anchor, hands) => ({ kind: 'band', anchor, hands }),
  parallelBars: () => ({ kind: 'parallelBars' }),
  assist: pullUp => ({ kind: 'assistMachine', pullUp }),
  preacher: () => ({ kind: 'preacherBench' }),
  backExt: () => ({ kind: 'backExtensionMachine' }),
  crunch: () => ({ kind: 'crunchMachine' }),
  stepmill: () => ({ kind: 'stepmill' }),
  ropes: anchor => ({ kind: 'battleRopes', anchor }),
  mat: () => ({ kind: 'mat' }),
  rack: () => ({ kind: 'squatRack' }),
};

const B = {}; // builders by id

// ---- Standing dumbbell work
function curl(palmBottom, palmTop, highlight, width = 0.27, upWidth = 0.22) {
  const down = Pose.standing(); down.hangArms(width, 0.10, palmBottom);
  const up = Pose.standing(); const sy = up.shoulderY;
  up.reachBoth(V(upWidth, sy - 0.14, 0.24), V(0.3, -0.7, -1), palmTop); up.setTorso({ pitch: -2 });
  return spec(rep(3.0, down, up, 0.42, 0.10), cam(35, 6, 3.9, 0.98), [P.dumbbells()], highlight);
}
B['dumbbell-curl'] = () => curl('forward', 'backward', ['biceps']);
B['hammer-curl'] = () => curl('inward', 'inward', ['biceps', 'forearms']);
B['dumbbell-reverse-curl'] = () => curl('backward', 'forward', ['forearms', 'biceps']);
B['outer-dumbbell-curl'] = () => curl('forward', 'outward', ['biceps'], 0.34, 0.36);

function zottman(preacher) {
  const base = preacher ? Pose.seated() : Pose.standing();
  if (preacher) { base.setTorso({ pitch: 14 }); base.pelvisOffset.y += 0.06; }
  const sy = base.shoulderY;
  const down = base.clone(), up = base.clone(), upPron = base.clone(), downPron = base.clone();
  if (preacher) {
    down.reachBoth(V(0.16, 0.78, 0.60), V(0.1, -0.5, 0.9), 'forward');
    up.reachBoth(V(0.16, 1.22, 0.44), V(0.1, -0.5, 0.9), 'backward');
    upPron.reachBoth(V(0.16, 1.22, 0.44), V(0.1, -0.5, 0.9), 'forward');
    downPron.reachBoth(V(0.16, 0.78, 0.60), V(0.1, -0.5, 0.9), 'backward');
  } else {
    down.hangArms(0.27, 0.10, 'forward');
    up.reachBoth(V(0.22, sy - 0.14, 0.24), V(0.3, -0.7, -1), 'backward');
    upPron.reachBoth(V(0.22, sy - 0.14, 0.24), V(0.3, -0.7, -1), 'forward');
    downPron.hangArms(0.27, 0.10, 'backward');
  }
  const c = clip(3.6, [[0, down], [0.36, up], [0.44, up], [0.56, upPron], [0.62, upPron], [0.92, downPron], [1, down]]);
  return spec(c, cam(35, 6, preacher ? 3.4 : 3.9, preacher ? 0.75 : 0.98),
    preacher ? [P.dumbbells(), P.preacher()] : [P.dumbbells()], ['biceps', 'forearms']);
}
B['zottman-curl'] = () => zottman(false);
B['zottman-preacher-curl'] = () => zottman(true);

B['arnold-press'] = () => {
  const base = Pose.seated(); const sy = base.shoulderY;
  const start = base.clone(), mid = base.clone(), top = base.clone();
  start.reachBoth(V(0.25, sy + 0.03, 0.30), V(0.05, -1, 0.35), 'backward');
  mid.reachBoth(V(0.42, sy + 0.10, 0.06), V(0.7, -1, -0.1), 'forward');
  top.reachBoth(V(0.20, sy + 0.62, 0.02), V(1, -0.15, -0.2), 'forward');
  const c = clip(3.4, [[0, start], [0.27, mid], [0.5, top], [0.56, top], [0.76, mid], [1, start]]);
  return spec(c, cam(0, 8, 3.6, 0.95), [P.dumbbells(), P.bench(82)], ['deltoids', 'rearDeltoids']);
};
B['dumbbell-shoulder-press'] = () => {
  const base = Pose.seated(); const sy = base.shoulderY;
  const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.40, sy + 0.10, 0.06), V(0.7, -1, -0.1), 'forward');
  up.reachBoth(V(0.20, sy + 0.62, 0.02), V(1, -0.15, -0.2), 'forward');
  return spec(rep(2.8, down, up, 0.42, 0.08), cam(0, 8, 3.6, 0.95), [P.dumbbells(), P.bench(82)], ['deltoids', 'triceps']);
};
B['dumbbell-seesaw-press'] = () => {
  const base = Pose.standing(); const sy = base.shoulderY;
  base.reachBoth(V(0.36, sy + 0.08, 0.10), V(0.7, -1, -0.1), 'inward');
  const left = base.clone(), right = base.clone();
  left.reachArm(Side.L, V(0.20, sy + 0.62, 0.02), V(1, -0.15, -0.2), 'inward');
  right.reachArm(Side.R, V(-0.20, sy + 0.62, 0.02), V(-1, -0.15, -0.2), 'inward');
  return spec(alternating(3.2, base, left, right), cam(20, 8, 4.0, 1.05), [P.dumbbells()], ['deltoids', 'triceps']);
};
B['dumbbell-high-shrug'] = () => {
  const down = Pose.standing(); down.hangArms(0.22, 0.16, 'backward');
  const up = Pose.standing(); const sy = up.shoulderY;
  up.shrug(0.06); up.reachBoth(V(0.25, sy - 0.30, 0.16), V(1, 0.2, -0.4), 'backward');
  return spec(rep(2.6, down, up, 0.42, 0.12), cam(150, 8, 3.9, 1.0), [P.dumbbells()], ['traps', 'neck', 'rearDeltoids', 'deltoids']);
};

// ---- Machines
B['lat-pulldown'] = () => {
  const base = Pose.seated(0.45, 0.10); base.setTorso({ pitch: -4 }); const sy = base.shoulderY;
  const top = base.clone(), bottom = base.clone();
  top.reachBoth(V(0.44, sy + 0.60, 0.08), V(1, 0.1, -0.3), 'forward'); top.setHead({ pitch: -12 });
  bottom.setTorso({ pitch: -12 }); bottom.reachBoth(V(0.46, sy - 0.06, 0.16), V(0.9, -0.5, -0.5), 'forward');
  const c = clip(3.2, [[0, top], [0.42, bottom], [0.52, bottom], [0.94, top], [1, top]]);
  return spec(c, cam(180, 6, 4.4, 1.15), [P.latPulldown()], ['lats', 'traps', 'rearDeltoids', 'biceps']);
};
B['cable-row'] = () => {
  const base = Pose.standing(); base.pelvisOffset = V(0, 0.36 - Skeleton.pelvisHeight, 0);
  for (const s of Side.both) { base.reachLeg(s, V(s.sign * 0.13, 0.30, 0.86), V(s.sign * 0.1, 1, 0.3)); base.set(s.ankle, qx(-25)); }
  const sy = base.shoulderY;
  const ext = base.clone(), pulled = base.clone();
  ext.setTorso({ pitch: 14 }); ext.reachBoth(V(0.10, sy - 0.30, 0.70), V(0.5, -0.3, -0.8), 'inward');
  pulled.setTorso({ pitch: -6 }); pulled.reachBoth(V(0.14, sy - 0.40, 0.16), V(0.4, -0.2, -1), 'inward');
  return spec(rep(3.0, ext, pulled, 0.42, 0.10), cam(55, 10, 4.3, 0.7), [P.cableRow()], ['lats', 'traps', 'rearDeltoids', 'biceps']);
};
B['cable-shrug'] = () => {
  const down = Pose.standing(); down.hangArms(0.22, 0.18, 'backward');
  const up = down.clone(); up.shrug(0.07); up.reachBoth(V(0.22, up.shoulderY - 0.56, 0.18), V(0.4, -0.3, -1), 'backward');
  return spec(rep(2.4, down, up, 0.42, 0.12), cam(155, 8, 4.0, 1.0), [P.cableColumn(0.12, V(0, 0, 1.1), 'straightBar')], ['traps', 'neck']);
};
B['cable-side-bend'] = () => {
  const base = Pose.standing(); base.hangArms(0.24, 0.04);
  const bent = base.clone(); bent.setTorso({ roll: 22 });
  bent.reachArm(Side.L, V(0.30, 0.72, 0.04), V(0.4, -0.3, -1), 'inward');
  bent.reachArm(Side.R, V(-0.26, 0.60, 0.04), V(-0.4, -0.3, -1), 'inward');
  const straight = base.clone(); straight.setTorso({ roll: -6 });
  return spec(rep(2.6, straight, bent, 0.45, 0.08), cam(0, 6, 4.0, 1.0), [P.cableColumn(0.15, V(-0.95, 0, 0.1), 'singleHandle', 'R')], ['obliques']);
};
B['cable-twist'] = () => {
  const base = Pose.squat(0.15, 0.24); const sy = base.shoulderY;
  const left = base.clone(), right = base.clone();
  left.setTorso({ yaw: -35 }); left.reachBoth(V(0.05, sy - 0.25, 0.55), V(0.4, -1, -0.2), 'inward');
  right.setTorso({ yaw: 35 }); right.reachBoth(V(0.05, sy - 0.25, 0.55), V(0.4, -1, -0.2), 'inward');
  return spec(rep(2.8, left, right, 0.45, 0.08), cam(20, 8, 4.2, 1.0), [P.cableColumn(1.1, V(1.15, 0, 0.2), 'singleHandle', 'L')], ['obliques', 'abs']);
};
B['cable-shoulder-press'] = () => {
  const base = Pose.standing(); const sy = base.shoulderY;
  const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.36, sy + 0.08, 0.10), V(0.7, -1, -0.1), 'forward');
  up.reachBoth(V(0.20, sy + 0.62, 0.02), V(1, -0.15, -0.2), 'forward');
  return spec(rep(2.8, down, up, 0.42, 0.08), cam(25, 8, 4.0, 1.1), [P.cableColumn(0.15, V(0, 0, -1.0), 'dualHandles')], ['deltoids', 'triceps']);
};
B['cable-seated-crunch'] = () => {
  const base = Pose.seated(); const sy = base.shoulderY;
  const up = base.clone(), down = base.clone();
  up.setTorso({ pitch: 6 }); up.reachBoth(V(0.12, sy + 0.14, 0.12), V(0.5, -1, 0.2), 'inward');
  down.setTorso({ pitch: 48 }); down.reachBoth(V(0.12, sy - 0.30, 0.34), V(0.5, -0.8, 0.2), 'inward'); down.setHead({ pitch: 20 });
  return spec(rep(2.6, up, down, 0.42, 0.10), cam(70, 8, 3.6, 0.85), [P.cableColumn(2.1, V(0, 0, -0.95), 'rope'), P.bench(0)], ['abs', 'obliques']);
};
B['cable-seated-rear-lateral-raise'] = () => {
  const base = Pose.seated(); base.setTorso({ pitch: 55 }); base.setHead({ pitch: -20 }); const sy = base.shoulderY;
  const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.14, sy - 0.62, 0.34), V(0.6, -0.4, -0.7), 'inward');
  up.reachBoth(V(0.62, sy - 0.20, 0.30), V(0.6, 0.3, -0.7), 'down');
  return spec(rep(2.8, down, up, 0.45, 0.08), cam(35, 10, 3.8, 0.8), [P.cableColumn(0.15, V(0, 0, 1.2), 'dualHandles'), P.bench(0)], ['rearDeltoids', 'traps']);
};
B['overhead-rope-tricep-extension'] = () => {
  const base = Pose.squat(0.08, 0.18); base.setTorso({ pitch: 15 }); const sy = base.shoulderY;
  const bent = base.clone(), ext = base.clone();
  bent.reachBoth(V(0.10, sy + 0.16, -0.16), V(0.3, 1, 0.4), 'inward');
  ext.reachBoth(V(0.12, sy + 0.56, 0.16), V(0.3, 1, 0.4), 'inward');
  return spec(rep(2.8, bent, ext, 0.45, 0.08), cam(60, 8, 4.2, 1.15), [P.cableColumn(0.15, V(0, 0, -1.1), 'rope')], ['triceps']);
};

// ---- Lower body
B['dumbbell-squat'] = () => {
  const up = Pose.squat(0.0, 0.18); up.hangArms(0.27, 0.06);
  const down = Pose.squat(0.85, 0.18, 28); down.hangArms(0.30, 0.16);
  return spec(rep(3.0, up, down, 0.45, 0.06), cam(35, 8, 4.0, 0.85), [P.dumbbells()], ['quads', 'glutes', 'hamstrings']);
};
B['jump-squat'] = () => {
  const down = Pose.squat(0.8, 0.18, 28); down.reachBoth(V(0.20, down.shoulderY - 0.40, 0.40), V(0.4, -0.6, -1), 'inward');
  const air = Pose.standing(); air.pelvisOffset = V(0, 0.32, 0);
  air.reachBoth(V(0.30, air.shoulderY - 0.62, -0.20), V(0.4, -0.3, -1), 'inward');
  for (const s of Side.both) air.set(s.ankle, qx(35));
  const land = Pose.squat(0.5, 0.18, 20); land.reachBoth(V(0.24, land.shoulderY - 0.45, 0.30), V(0.4, -0.6, -1), 'inward');
  const c = clip(1.8, [[0, down], [0.30, air], [0.55, land], [0.75, down], [1, down]]);
  return spec(c, cam(35, 8, 4.4, 1.0), [], ['quads', 'glutes', 'calves']);
};
function lungePose(front, depth, kneeDrive = false) {
  const p = Pose.standing(); const drop = depth * 0.36; p.pelvisOffset = V(0, -drop, 0);
  const back = Side.other(front);
  if (kneeDrive) p.reachLeg(front, V(front.sign * 0.12, 0.55, 0.30), V(0, 0.3, 1));
  else p.reachLeg(front, V(front.sign * 0.12, Skeleton.ankleHeight, 0.34), V(0, 0.1, 1));
  p.reachLeg(back, V(back.sign * 0.12, Skeleton.ankleHeight + 0.06, -0.48), V(0, 0.2, 1));
  p.set(back.ankle, qx(40));
  const sy = p.shoulderY;
  p.reachArm(back, V(back.sign * 0.22, sy - 0.20, 0.30), V(back.sign * 0.4, -0.5, -1), 'inward');
  p.reachArm(front, V(front.sign * 0.22, sy - 0.45, -0.22), V(front.sign * 0.4, -0.3, -1), 'inward');
  return p;
}
function jumpLunge(sprinter) {
  const l = lungePose(Side.L, 0.9), r = lungePose(Side.R, 0.9);
  const air = Pose.standing(); air.pelvisOffset = V(0, 0.18, 0);
  air.reachBoth(V(0.22, air.shoulderY - 0.40, 0.05), V(0.4, -0.5, -1), 'inward');
  let airL = air, airR = air;
  if (sprinter) {
    airL = lungePose(Side.L, 0.0, true); airL.pelvisOffset = V(0, 0.12, 0);
    airR = lungePose(Side.R, 0.0, true); airR.pelvisOffset = V(0, 0.12, 0);
  }
  const c = clip(2.0, [[0, l], [0.22, airL], [0.42, r], [0.5, r], [0.72, airR], [0.92, l], [1, l]]);
  return spec(c, cam(40, 8, 4.4, 0.95), [], ['quads', 'glutes', 'hamstrings']);
}
B['jump-lunge'] = () => jumpLunge(false);
B['jump-sprinter-lunge'] = () => jumpLunge(true);
function splitSquat(onBench) {
  const pose = depth => {
    const p = Pose.standing(); p.pelvisOffset = V(0, -depth * 0.34, 0.05);
    p.reachLeg(Side.L, V(0.12, Skeleton.ankleHeight, 0.30), V(0, 0.1, 1));
    if (onBench) { p.reachLeg(Side.R, V(-0.12, 0.47, -0.52), V(0, 0.1, 1)); p.set('ankleR', qx(60)); }
    else { p.reachLeg(Side.R, V(-0.12, Skeleton.ankleHeight + 0.05, -0.50), V(0, 0.2, 1)); p.set('ankleR', qx(35)); }
    p.setTorso({ pitch: 6 });
    const sy = p.shoulderY;
    p.reachBoth(V(0.40, sy + 0.05, -0.16), V(0.6, -0.7, -0.5), 'forward');
    return p;
  };
  const props = [P.barbell(1.5)]; if (onBench) props.push(P.bench(0));
  return spec(rep(3.0, pose(0.1), pose(1.0), 0.45, 0.06), cam(55, 8, 4.4, 0.9), props, ['quads', 'glutes', 'hamstrings']);
}
B['barbell-split-squat'] = () => splitSquat(false);
B['barbell-split-squat-on-bench'] = () => splitSquat(true);
B['barbell-sumo-deadlift'] = () => {
  const pose = depth => {
    const p = Pose.squat(depth * 0.75, 0.42, 30);
    p.reachBoth(V(0.16, 0.20 + (1 - depth) * 0.42, 0.10), V(0.4, -0.3, -1), 'backward');
    return p;
  };
  return spec(rep(3.2, pose(1.0), pose(0.05), 0.45, 0.10), cam(30, 8, 4.2, 0.9), [P.barbell(1.8)], ['glutes', 'hamstrings', 'quads', 'lowerBack']);
};
B['dumbbell-romanian-deadlift'] = () => {
  const top = Pose.squat(0.05, 0.16); top.hangArms(0.24, 0.14, 'backward');
  const bottom = Pose.squat(0.18, 0.16, 0); bottom.pelvisOffset = V(0, -0.07, -0.20);
  for (const s of Side.both) bottom.reachLeg(s, V(s.sign * 0.16, Skeleton.ankleHeight, 0), V(s.sign * 0.2, 0.1, 1));
  bottom.setTorso({ pitch: 78 }); bottom.setHead({ pitch: -25 });
  bottom.reachBoth(V(0.22, 0.50, 0.26), V(0.4, -0.2, -1), 'backward');
  return spec(rep(3.2, top, bottom, 0.45, 0.08), cam(60, 8, 4.2, 0.9), [P.dumbbells()], ['hamstrings', 'glutes', 'lowerBack']);
};
B['band-deadlift'] = () => {
  const top = Pose.squat(0.05, 0.20); top.hangArms(0.24, 0.14, 'backward');
  const bottom = Pose.squat(0.45, 0.20, 55); bottom.reachBoth(V(0.22, 0.55, 0.20), V(0.4, -0.2, -1), 'backward');
  return spec(rep(3.0, bottom, top, 0.45, 0.10), cam(45, 8, 4.2, 0.9), [P.band(V(0, 0.02, 0.04), ['L', 'R'])], ['glutes', 'hamstrings', 'lowerBack']);
};
B['ankle-plantar-flexion'] = () => {
  const down = Pose.standing(); down.hangArms(0.25, 0.04);
  const up = down.clone(); up.pelvisOffset = V(0, 0.085, 0.0); for (const s of Side.both) up.set(s.ankle, qx(32));
  return spec(rep(2.2, down, up, 0.45, 0.12), cam(150, 6, 3.9, 0.95), [], ['calves']);
};
B['ankle-dorsal-flexion'] = () => {
  const down = Pose.standing(); down.hangArms(0.25, 0.04);
  const up = down.clone(); up.pelvisOffset = V(0, -0.012, -0.03); for (const s of Side.both) up.set(s.ankle, qx(-24));
  return spec(rep(2.2, down, up, 0.45, 0.12), cam(90, 6, 3.9, 0.95), [], ['tibialis']);
};

// ---- Rows / pulls
B['dumbbell-row'] = () => {
  const base = Pose.standing(); base.pelvisOffset = V(0, -0.12, -0.05);
  base.setTorso({ pitch: 62 }); base.setHead({ pitch: -30 });
  base.reachLeg(Side.L, V(0.16, Skeleton.ankleHeight, -0.30), V(0.1, 0.1, 1));
  base.reachLeg(Side.R, V(-0.16, 0.47, -0.05), V(-0.1, 1, 0.5)); base.set('ankleR', qx(70));
  base.reachArm(Side.L, V(0.20, 0.47, 0.42), V(0.3, -0.2, -1), 'down');
  const down = base.clone(), up = base.clone();
  down.reachArm(Side.R, V(-0.26, 0.42, 0.20), V(-0.3, -0.2, -1), 'inward');
  up.reachArm(Side.R, V(-0.28, 0.92, 0.02), V(-0.2, 0.9, -0.8), 'inward');
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(300, 8, 4.0, 0.8), [P.dumbbell('R'), P.bench(0)], ['lats', 'rearDeltoids', 'biceps', 'traps']);
};
B['kettlebell-bent-over-row'] = () => {
  // hip hinge: knees soft, torso ~48° forward, kettlebells hang below the shoulders and row to the hips
  const base = Pose.squat(0.18, 0.2, 0); base.setTorso({ pitch: 48 }); base.setHead({ pitch: -20 });
  const sh = base.worldTransforms().shoulderL.position;
  const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.22, sh.y - 0.56, sh.z + 0.02), V(0.4, -0.3, -1), 'inward');
  up.reachBoth(V(0.24, sh.y - 0.28, sh.z - 0.12), V(0.3, 0.8, -0.8), 'inward');
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(45, 8, 4.0, 0.85), [P.kettlebell('L'), P.kettlebell('R')], ['lats', 'rearDeltoids', 'biceps']);
};
B['kettlebell-angled-press'] = () => {
  const base = Pose.standing(); const sy = base.shoulderY;
  base.reachArm(Side.L, V(0.2, sy - 0.45, 0.02), V(0.5, -0.3, -1), 'inward');
  const down = base.clone(), up = base.clone();
  down.reachArm(Side.R, V(-0.18, sy + 0.05, 0.16), V(-0.6, -1, 0.0), 'inward');
  up.reachArm(Side.R, V(-0.42, sy + 0.55, 0.06), V(-1, -0.2, -0.2), 'forward'); up.setTorso({ roll: 12 });
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(25, 8, 4.0, 1.1), [P.kettlebell('R')], ['deltoids', 'triceps']);
};
function barbellCurl(width, bentOver) {
  const base = Pose.standing(); if (bentOver) { base.setTorso({ pitch: 30 }); base.setHead({ pitch: -20 }); }
  const sy = base.shoulderY; const down = base.clone(), up = base.clone(); const half = width / 2 - 0.12;
  if (bentOver) {
    down.reachBoth(V(half, sy - 0.62, 0.28), V(0.3, -0.5, -1), 'forward');
    up.reachBoth(V(half, sy - 0.28, 0.42), V(0.3, -0.8, -1), 'backward');
  } else {
    down.reachBoth(V(half, sy - 0.60, 0.12), V(0.3, -0.5, -1), 'forward');
    up.reachBoth(V(half, sy - 0.14, 0.26), V(0.3, -0.7, -1), 'backward');
  }
  return spec(rep(3.0, down, up, 0.42, 0.10), cam(30, 6, 3.9, 0.98), [P.barbell(width + 0.5)], ['biceps', 'forearms']);
}
B['wide-grip-barbell-curl'] = () => barbellCurl(0.95, false);
B['barbell-standing-concentration-curl'] = () => barbellCurl(0.55, true);
B['wide-grip-barbell-upright-row'] = () => {
  const base = Pose.standing(); const sy = base.shoulderY; const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.36, sy - 0.60, 0.12), V(0.3, -0.5, -1), 'backward');
  up.reachBoth(V(0.36, sy - 0.10, 0.14), V(1, 0.4, -0.3), 'backward'); up.shrug(0.03);
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(25, 6, 3.9, 1.0), [P.barbell(1.5)], ['deltoids', 'traps']);
};
B['barbell-standing-twist'] = () => {
  const base = Pose.squat(0.1, 0.22); const sy = base.shoulderY;
  base.reachBoth(V(0.48, sy + 0.05, -0.16), V(0.6, -0.7, -0.5), 'forward');
  const left = base.clone(), right = base.clone(); left.setTorso({ yaw: 40 }); right.setTorso({ yaw: -40 });
  const c = clip(3.0, [[0, base], [0.25, left], [0.5, base], [0.75, right], [1, base]]);
  return spec(c, cam(0, 8, 4.2, 1.0), [P.barbell(1.6)], ['obliques', 'abs']);
};

// ---- Bands
B['band-high-curl'] = () => {
  const base = Pose.standing(); const sy = base.shoulderY; const ext = base.clone(), curlP = base.clone();
  ext.reachBoth(V(0.62, sy + 0.05, 0.02), V(0.3, -1, -0.3), 'forward');
  curlP.reachBoth(V(0.28, sy + 0.08, 0.02), V(0.3, -1, -0.3), 'backward');
  return spec(rep(2.6, ext, curlP, 0.42, 0.10), cam(0, 6, 4.2, 1.1),
    [P.band(V(1.2, 1.45, 0.0), ['L']), P.band(V(-1.2, 1.45, 0.0), ['R'])], ['biceps']);
};
B['band-curl'] = () => {
  const down = Pose.standing(); down.hangArms(0.27, 0.12, 'forward');
  const up = Pose.standing(); up.reachBoth(V(0.22, up.shoulderY - 0.14, 0.24), V(0.3, -0.7, -1), 'backward');
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(35, 6, 3.9, 0.98), [P.band(V(0, 0.02, 0.06), ['L', 'R'])], ['biceps']);
};
B['band-high-row'] = () => {
  const base = Pose.splitStance(Side.R, 0.15, 0.28, 0.06); base.setTorso({ pitch: 12 }); const sy = base.shoulderY;
  const ext = base.clone(), pulled = base.clone();
  ext.reachBoth(V(0.16, sy + 0.05, 0.62), V(0.5, -0.4, -0.8), 'down');
  pulled.reachBoth(V(0.28, sy - 0.10, 0.10), V(0.8, -0.2, -1), 'down');
  return spec(rep(2.6, ext, pulled, 0.42, 0.10), cam(45, 8, 4.2, 1.0), [P.band(V(0, 2.0, 1.4), ['L', 'R'])], ['lats', 'rearDeltoids', 'traps']);
};
B['band-face-pull'] = () => {
  const base = Pose.squat(0.08, 0.2); const sy = base.shoulderY; const ext = base.clone(), pulled = base.clone();
  ext.reachBoth(V(0.14, sy + 0.08, 0.62), V(0.5, 0.1, -0.8), 'inward');
  pulled.reachBoth(V(0.34, sy + 0.14, 0.06), V(0.8, 0.4, -0.6), 'inward');
  return spec(rep(2.6, ext, pulled, 0.42, 0.10), cam(45, 8, 4.2, 1.05), [P.band(V(0, 1.6, 1.4), ['L', 'R'])], ['rearDeltoids', 'traps']);
};
B['band-crunch'] = () => {
  const base = Pose.kneeling(); const sy = base.shoulderY; const up = base.clone(), down = base.clone();
  up.setTorso({ pitch: 8 }); up.reachBoth(V(0.12, sy + 0.10, 0.06), V(0.5, -1, 0.2), 'inward');
  down.setTorso({ pitch: 52 }); down.setHead({ pitch: 20 }); down.reachBoth(V(0.12, sy - 0.32, 0.28), V(0.5, -0.8, 0.2), 'inward');
  return spec(rep(2.4, up, down, 0.42, 0.10), cam(70, 8, 3.6, 0.7), [P.band(V(0, 2.1, -0.9), ['L', 'R']), P.mat()], ['abs', 'obliques']);
};
B['alternating-high-band-chest-press'] = () => {
  const base = Pose.splitStance(Side.L, 0.15, 0.30, 0.06); base.setTorso({ pitch: 6 }); const sy = base.shoulderY;
  base.reachBoth(V(0.34, sy - 0.02, 0.10), V(0.9, -0.3, -0.5), 'down');
  const left = base.clone(), right = base.clone();
  left.reachArm(Side.L, V(0.12, sy - 0.12, 0.60), V(0.9, -0.3, -0.5), 'down');
  right.reachArm(Side.R, V(-0.12, sy - 0.12, 0.60), V(-0.9, -0.3, -0.5), 'down');
  return spec(alternating(3.0, base, left, right), cam(40, 8, 4.2, 1.0), [P.band(V(0, 1.9, -1.4), ['L', 'R'])], ['chest', 'triceps', 'deltoids']);
};

// ---- Bodyweight / machines
B['inverted-row'] = () => {
  const base = Pose.standing(); base.set('pelvis', qx(-70)); base.pelvisOffset = V(0, 0.40 - Skeleton.pelvisHeight, 0.0);
  for (const s of Side.both) { base.set(s.hip, qx(-20)); base.set(s.knee, qx(0)); base.set(s.ankle, qx(-10)); }
  const down = base.clone(); down.reachBoth(V(0.30, 1.02, -0.35), V(0.5, 0.2, -1), 'backward');
  const up = base.clone(); up.pelvisOffset = V(0, 0.62 - Skeleton.pelvisHeight, 0.0);
  up.reachBoth(V(0.32, 1.02, -0.35), V(0.9, 0.4, -0.6), 'backward');
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(70, 12, 4.4, 0.7), [P.rack(), P.barbell(1.5)], ['lats', 'rearDeltoids', 'biceps']);
};
B['assisted-pull-up'] = () => {
  const base = Pose.kneeling(); base.pelvisOffset = V(0, 1.05 - Skeleton.pelvisHeight, 0.0);
  for (const s of Side.both) { base.set(s.knee, qx(85)); base.set(s.ankle, qx(60)); }
  const sy = base.shoulderY; const down = base.clone(), up = base.clone();
  down.reachBoth(V(0.45, sy + 0.66, 0.0), V(1, 0.1, -0.2), 'forward');
  up.pelvisOffset = V(0, 1.45 - Skeleton.pelvisHeight, 0.02); up.reachBoth(V(0.45, up.shoulderY + 0.20, 0.06), V(1, -0.4, -0.3), 'forward');
  return spec(rep(3.0, down, up, 0.42, 0.10), cam(155, 6, 4.8, 1.35), [P.assist(true)], ['lats', 'biceps', 'rearDeltoids']);
};
B['assisted-dip'] = () => {
  const base = Pose.kneeling(); base.pelvisOffset = V(0, 1.05 - Skeleton.pelvisHeight, 0.0);
  for (const s of Side.both) { base.set(s.knee, qx(85)); base.set(s.ankle, qx(60)); }
  base.setTorso({ pitch: 10 }); const sy = base.shoulderY; const up = base.clone(), down = base.clone();
  up.reachBoth(V(0.30, sy - 0.60, 0.02), V(0.3, -0.2, -1), 'inward');
  down.pelvisOffset = V(0, 0.80 - Skeleton.pelvisHeight, 0.0); down.setTorso({ pitch: 18 });
  down.reachBoth(V(0.30, down.shoulderY - 0.30, 0.02), V(0.4, 0.4, -1), 'inward');
  return spec(rep(2.8, up, down, 0.45, 0.08), cam(35, 6, 4.4, 1.2), [P.assist(false)], ['triceps', 'chest', 'deltoids']);
};
function hangingLegRaise(twist, hold) {
  const base = Pose.standing(); base.pelvisOffset = V(0, 1.02 - Skeleton.pelvisHeight, 0.0); const sy = base.shoulderY;
  base.reachBoth(V(0.30, sy - 0.32, 0.10), V(0.4, -0.1, -1), 'inward'); base.shrug(-0.02);
  for (const s of Side.both) base.set(s.ankle, qx(25));
  const raised = base.clone(); for (const s of Side.both) { raised.set(s.hip, qx(-88)); raised.set(s.knee, qx(6)); } raised.setTorso({ pitch: 8 });
  if (twist) {
    const left = raised.clone(), right = raised.clone();
    left.setTorso({ yaw: 25, split: 1 }); right.setTorso({ yaw: -25, split: 1 });
    for (const s of Side.both) { left.set(s.hip, euler(-85, 25)); right.set(s.hip, euler(-85, -25)); }
    const c = clip(3.2, [[0, base], [0.3, left], [0.38, left], [0.5, base], [0.8, right], [0.88, right], [1, base]]);
    return spec(c, cam(30, 6, 4.6, 1.05), [P.parallelBars()], ['abs', 'obliques']);
  }
  if (hold) {
    const breathe = raised.clone(); breathe.setTorso({ pitch: 6 });
    return spec(clip(3.0, [[0, raised], [0.5, breathe], [1, raised]]), cam(60, 6, 4.6, 1.05), [P.parallelBars()], ['abs', 'quads']);
  }
  return spec(rep(2.8, base, raised, 0.42, 0.10), cam(60, 6, 4.6, 1.05), [P.assist(false)], ['abs', 'quads']);
}
B['assisted-straight-leg-raise'] = () => hangingLegRaise(false, false);
B['parallel-bar-straight-leg-raise-hold'] = () => hangingLegRaise(false, true);
B['parallel-bar-twisting-leg-raise'] = () => hangingLegRaise(true, false);
B['back-extension-machine'] = () => {
  const base = Pose.seated(); base.reachBoth(V(0.14, base.shoulderY - 0.05, 0.10), V(0.7, -0.6, -0.2), 'inward');
  const flexed = base.clone(), ext = base.clone(); flexed.setTorso({ pitch: 35 }); flexed.setHead({ pitch: 10 }); ext.setTorso({ pitch: -22 });
  return spec(rep(2.8, flexed, ext, 0.42, 0.10), cam(80, 8, 3.8, 0.85), [P.backExt()], ['lowerBack', 'glutes']);
};
B['overhead-crunch-machine'] = () => {
  const base = Pose.seated(); const sy = base.shoulderY; base.reachBoth(V(0.16, sy + 0.30, 0.16), V(0.7, -0.8, 0.3), 'backward');
  const up = base.clone(), down = base.clone(); up.setTorso({ pitch: 0 });
  down.setTorso({ pitch: 42 }); down.setHead({ pitch: 15 }); down.reachBoth(V(0.16, sy - 0.10, 0.36), V(0.7, -0.8, 0.3), 'backward');
  return spec(rep(2.6, up, down, 0.42, 0.10), cam(80, 8, 3.8, 0.85), [P.crunch()], ['abs', 'obliques']);
};
B['plank'] = () => {
  const p = Pose.prone(); p.pelvisOffset = V(0, 0.36 - Skeleton.pelvisHeight, 0); p.set('pelvis', qx(80)); p.setTorso({ pitch: -4 });
  p.reachBoth(V(0.14, 0.02, 0.60), V(0.3, 0.9, 0.3), 'down');
  for (const s of Side.both) { p.set(s.hip, qx(-2)); p.set(s.knee, qx(0)); p.set(s.ankle, qx(-40)); }
  const breathe = p.clone(); breathe.pelvisOffset.y += 0.01;
  return spec(clip(3.0, [[0, p], [0.5, breathe], [1, p]]), cam(75, 10, 4.4, 0.35), [P.mat()], ['abs', 'obliques', 'lowerBack']);
};
function rollout(ball) {
  const back = Pose.kneeling(); const out = Pose.kneeling();
  const tilt = ball ? 30 : 38; const rad = deg(tilt);
  out.pelvisOffset = V(0, (0.07 + Skeleton.thigh * Math.cos(rad) + 0.02) - Skeleton.pelvisHeight, Skeleton.thigh * Math.sin(rad));
  for (const s of Side.both) { out.set(s.hip, qx(tilt)); out.set(s.knee, qx(90 - tilt)); out.set(s.ankle, qx(90)); }
  if (ball) {
    back.setTorso({ pitch: 28 }); back.reachBoth(V(0.14, 0.62, 0.46), V(0.3, 0.6, -0.8), 'down');
    out.setTorso({ pitch: 42 }); out.reachBoth(V(0.14, 0.60, 0.92), V(0.3, 0.8, -0.5), 'down');
  } else {
    back.setTorso({ pitch: 48 }); back.setHead({ pitch: -10 }); back.reachBoth(V(0.16, 0.10, 0.48), V(0.3, 0.6, -0.8), 'down');
    out.setTorso({ pitch: 52 }); out.setHead({ pitch: -20 }); out.reachBoth(V(0.16, 0.10, 1.05), V(0.3, 0.9, -0.3), 'down');
  }
  const props = [P.mat()]; props.push(ball ? P.ball(V(0, 0.30, 0.78), 0.30) : P.abWheel());
  return spec(rep(3.2, back, out, 0.45, 0.08), cam(75, 10, 4.2, 0.45), props, ['abs', 'obliques', 'lats']);
}
B['ab-wheel-rollout'] = () => rollout(false);
B['stability-ball-rollout'] = () => rollout(true);
B['stability-ball-crunch'] = () => {
  const base = Pose.standing(); base.set('pelvis', qx(-70)); base.pelvisOffset = V(0, 0.55 - Skeleton.pelvisHeight, 0);
  for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.16, Skeleton.ankleHeight, 0.55), V(s.sign * 0.1, 0.4, 1));
  const down = base.clone(), up = base.clone();
  down.setTorso({ pitch: -20 }); down.reachBoth(V(0.12, 0.95, -0.40), V(0.8, 0.2, 0.2), 'backward');
  up.setTorso({ pitch: 40 }); up.reachBoth(V(0.12, 1.05, -0.05), V(0.8, 0.4, 0.2), 'backward');
  return spec(rep(2.6, down, up, 0.42, 0.10), cam(80, 8, 4.2, 0.6), [P.ball(V(0, 0.30, -0.12), 0.30)], ['abs', 'obliques']);
};
B['stability-ball-sit-up'] = () => {
  const base = Pose.standing(); base.set('pelvis', qx(-75)); base.pelvisOffset = V(0, 0.55 - Skeleton.pelvisHeight, 0);
  for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.16, Skeleton.ankleHeight, 0.55), V(s.sign * 0.1, 0.4, 1));
  const down = base.clone(), up = base.clone();
  down.setTorso({ pitch: -15 }); down.reachBoth(V(0.16, 0.85, -0.45), V(0.8, 0.2, 0.2), 'backward');
  up.setTorso({ pitch: 85 }); up.reachBoth(V(0.16, 0.85, 0.40), V(0.8, -0.3, 0.2), 'backward');
  return spec(rep(2.8, down, up, 0.42, 0.10), cam(80, 8, 4.2, 0.6), [P.ball(V(0, 0.30, -0.12), 0.30)], ['abs']);
};
B['stability-ball-leg-curl'] = () => {
  const base = Pose.supine(); base.pelvisOffset = V(0, 0.30 - Skeleton.pelvisHeight, 0);
  base.reachBoth(V(0.36, 0.05, -0.30), V(0.5, 0.5, 0.5), 'down');
  const ext = base.clone(), curled = base.clone();
  for (const s of Side.both) { ext.reachLeg(s, V(s.sign * 0.12, 0.34, 0.95), V(0, 1, 0.2)); curled.reachLeg(s, V(s.sign * 0.12, 0.34, 0.52), V(0, 1, 0.2)); }
  curled.pelvisOffset = V(0, 0.40 - Skeleton.pelvisHeight, 0.02);
  return spec(rep(2.8, ext, curled, 0.42, 0.10), cam(75, 12, 4.4, 0.4), [P.mat(), P.ball(V(0, 0.30, 0.95), 0.30)], ['hamstrings', 'glutes']);
};
B['air-bike'] = () => {
  const base = Pose.supine(); base.pelvisOffset = V(0, 0.15 - Skeleton.pelvisHeight, 0); base.setTorso({ pitch: 30 });
  base.reachBoth(V(0.14, 0.42, -0.42), V(0.8, 0.5, 0.2), 'backward');
  const side = s => {
    const p = base.clone(); const o = Side.other(s);
    p.reachLeg(s, V(s.sign * 0.10, 0.45, 0.30), V(0, 1, 0.1));
    p.reachLeg(o, V(o.sign * 0.12, 0.30, 0.95), V(0, 1, 0.1));
    p.setTorso({ pitch: 34, yaw: s.sign * 22 });
    return p;
  };
  const mid = base.clone(); for (const s of Side.both) mid.reachLeg(s, V(s.sign * 0.12, 0.42, 0.62), V(0, 1, 0.1));
  return spec(alternating(2.6, mid, side(Side.L), side(Side.R)), cam(70, 22, 4.4, 0.35), [P.mat()], ['abs', 'obliques']);
};
function lyingLegRaise(straight) {
  const base = Pose.supine(); base.reachBoth(V(0.30, 0.04, 0.05), V(0.5, 0.5, 0.5), 'down');
  for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.12, 0.12, 0.98), V(0, 1, 0));
  const raised = s => { const p = base.clone(); p.reachLeg(s, V(s.sign * 0.12, straight ? 0.95 : 0.60, 0.55), V(0, 1, straight ? -0.5 : 0.8)); return p; };
  return spec(alternating(2.8, base, raised(Side.L), raised(Side.R)), cam(70, 16, 4.4, 0.4), [P.mat()], ['abs', 'quads']);
}
B['alternate-lying-floor-leg-raise'] = () => lyingLegRaise(false);
B['alternating-straight-leg-raise'] = () => lyingLegRaise(true);
B['starfish-crunch'] = () => {
  const base = Pose.supine(); base.reachBoth(V(0.55, 0.05, -0.40), V(0.5, 0.5, 0.5), 'up');
  for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.40, 0.08, 0.90), V(0, 1, 0));
  const crunch = s => {
    const p = base.clone(); const o = Side.other(s);
    p.setTorso({ pitch: 38, yaw: s.sign * 15 });
    p.reachLeg(o, V(o.sign * 0.14, 0.75, 0.55), V(0, 1, -0.3));
    p.reachArm(s, V(o.sign * 0.05, 0.85, 0.35), V(s.sign * 0.8, 0.5, -0.2), 'down');
    return p;
  };
  return spec(alternating(3.0, base, crunch(Side.L), crunch(Side.R)), cam(60, 24, 4.6, 0.35), [P.mat()], ['abs', 'obliques']);
};
B['wipers'] = () => {
  const base = Pose.supine(); base.reachBoth(V(0.60, 0.05, -0.20), V(0.5, 0.5, 0.5), 'down');
  for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.10, 0.98, 0.10), V(0, 0.2, 1));
  const swing = s => {
    const p = base.clone();
    for (const side of Side.both) p.reachLeg(side, V(s.sign * 0.60 + side.sign * 0.10, 0.62, 0.10), V(0, 0.2, 1));
    p.set('pelvis', qx(-90).multiply(qy(s.sign * -25)).normalize());
    return p;
  };
  const c = clip(3.0, [[0, base], [0.25, swing(Side.L)], [0.5, base], [0.75, swing(Side.R)], [1, base]]);
  return spec(c, cam(20, 24, 4.4, 0.45), [P.mat()], ['obliques', 'abs']);
};
B['around-the-world-superman-hold'] = () => {
  const base = Pose.prone(); base.setTorso({ pitch: -22 }); base.setHead({ pitch: -15 });
  for (const s of Side.both) { base.set(s.hip, qx(12)); base.set(s.knee, qx(0)); base.set(s.ankle, qx(30)); }
  const front = base.clone(), sides = base.clone(), back = base.clone();
  front.reachBoth(V(0.20, 0.30, 0.95), V(0.5, 0.8, -0.3), 'down');
  sides.reachBoth(V(0.80, 0.30, 0.20), V(0.3, 0.9, -0.3), 'down');
  back.reachBoth(V(0.40, 0.32, -0.50), V(0.5, 0.8, 0.3), 'down');
  const c = clip(4.0, [[0, front], [0.3, sides], [0.5, back], [0.7, sides], [1, front]]);
  return spec(c, cam(60, 22, 4.6, 0.3), [P.mat()], ['lowerBack', 'glutes', 'rearDeltoids']);
};
B['stepmill'] = () => {
  const step = (front, up) => {
    const p = Pose.standing(); p.pelvisOffset = V(0, 0.17 + up * 0.12, 0.10 + up * 0.10); p.setTorso({ pitch: 10 });
    const back = Side.other(front);
    p.reachLeg(front, V(front.sign * 0.12, 0.35 + 0.06, 0.27), V(0, 0.3, 1));
    p.reachLeg(back, V(back.sign * 0.12, 0.18 + 0.06 + up * 0.10, 0.05 - up * 0.02), V(0, 0.2, 1));
    p.set(back.ankle, qx(25 * up));
    const sy = p.shoulderY; p.reachBoth(V(0.34, sy - 0.32, 0.40), V(0.5, -0.5, -0.8), 'inward');
    return p;
  };
  const c = clip(2.0, [[0, step(Side.L, 0)], [0.25, step(Side.L, 1)], [0.5, step(Side.R, 0)], [0.75, step(Side.R, 1)], [1, step(Side.L, 0)]]);
  return spec(c, cam(55, 8, 4.4, 1.1), [P.stepmill()], ['quads', 'glutes', 'calves']);
};
B['battle-ropes'] = () => {
  const base = Pose.squat(0.22, 0.24, 12); const sy = base.shoulderY; const high = base.clone(), low = base.clone();
  high.reachArm(Side.L, V(0.20, sy + 0.05, 0.40), V(0.5, -0.8, -0.5), 'inward');
  high.reachArm(Side.R, V(-0.20, sy - 0.55, 0.40), V(-0.5, -0.8, -0.5), 'inward');
  low.reachArm(Side.L, V(0.20, sy - 0.55, 0.40), V(0.5, -0.8, -0.5), 'inward');
  low.reachArm(Side.R, V(-0.20, sy + 0.05, 0.40), V(-0.5, -0.8, -0.5), 'inward');
  return spec(clip(0.9, [[0, high], [0.5, low], [1, high]]), cam(35, 8, 4.6, 0.9), [P.ropes(V(0, 0.06, 2.6))], ['deltoids', 'forearms', 'abs']);
};

const cache = new Map();
export function motionSpec(id) {
  if (cache.has(id)) return cache.get(id);
  let s;
  if (B[id]) s = B[id]();
  else { const p = Pose.standing(); p.hangArms(); s = spec(clip(2, [[0, p], [1, p]]), cam(35), [], []); }
  cache.set(id, s);
  return s;
}

/** Standing anatomy pose used by the home screen figures. */
export function anatomySpec(highlight, back) {
  const p = Pose.standing(); p.hangArms(0.30, 0.02, 'forward');
  return spec(clip(1, [[0, p], [1, p]]), cam(back ? 180 : 0, 2, 5.2, 0.93, 24), [], highlight, 0.25);
}

const HELD = new Set(['dumbbells', 'barbell', 'latPulldown', 'cableRow', 'cableColumn', 'kettlebell', 'abWheel', 'band',
  'parallelBars', 'assistMachine', 'battleRopes', 'backExtensionMachine', 'crunchMachine', 'stepmill']);
export function effectiveHandCurl(s) {
  if (s.handCurl != null) return s.handCurl;
  for (const p of s.props) if (HELD.has(p.kind)) return 1;
  return 0.25;
}
