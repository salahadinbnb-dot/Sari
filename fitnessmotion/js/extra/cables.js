// Cable-station and selectorized machine exercises: crossover, pulley isolation work and seated leg/chest machines.
import * as THREE from '../../vendor/three.module.min.js';
import { EXTRA_PROPS, PropNode, Geo, Materials } from '../props.js?v=7';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const qxd = d => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), d * Math.PI / 180);
const qyr = r => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r);
const qzd = d => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), d * Math.PI / 180);
const { box, cylinder } = Geo;
const frame = Materials.metalFrame, dark = Materials.metalDark, pad = Materials.padding;

/** A single cable tower at `post`, pulley at height `h` facing `facing` (horizontal). Returns { node, anchor }. */
function tower(post, h, facing) {
  const f = facing.clone().setY(0).normalize();
  const g = new THREE.Group(); g.position.copy(post); g.quaternion.copy(qyr(Math.atan2(f.x, f.z)));
  g.add(box(0.12, 2.3, 0.12, frame, V(0, 1.15, 0)));
  g.add(box(0.7, 0.05, 0.6, frame, V(0, 0.025, -0.12)));
  g.add(box(0.34, 1.0, 0.2, dark, V(0, 0.55, -0.2)));
  g.add(box(0.36, 0.06, 0.24, frame, V(0, 2.3, -0.1)));
  g.add(box(0.07, 0.16, 0.16, frame, V(0, h, 0.09)));
  g.add(cylinder(0.06, 0.04, dark, V(0, h, 0.13), qzd(90)));
  return { node: g, anchor: post.clone().add(f.multiplyScalar(0.16)).setY(h) };
}

/** Bar/handle segment whose axis runs along the fist (thumb direction). */
function handleAt(seg, g, axis, half) { Geo.place(seg, g.clone().addScaledVector(axis, -half), g.clone().addScaledVector(axis, half)); }

// ---- two-tower crossover with a D-handle in each hand
class CrossoverProp extends PropNode {
  constructor(d) {
    super();
    const { x, z, h } = d; this.anchors = {};
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const t = tower(V(s * x, 0, z), h, V(-s, 0, 0.55)); this.node.add(t.node); this.anchors[side] = t.anchor;
    }
    this.node.add(box(2 * x + 0.12, 0.08, 0.08, frame, V(0, 2.32, z)));
    this.cables = {}; this.handles = {};
    for (const side of ['L', 'R']) {
      this.cables[side] = Geo.segment(0.008, Materials.cable); this.node.add(this.cables[side]);
      this.handles[side] = Geo.segment(0.016, frame); this.node.add(this.handles[side]);
    }
  }
  update(ctx) {
    for (const side of ['L', 'R']) {
      const g = ctx.grip(side);
      Geo.place(this.cables[side], this.anchors[side], g);
      handleAt(this.handles[side], g, ctx.hand(side).thumb, 0.065);
    }
  }
}

// ---- single tower with an attachment: 'rope' (face pull), 'shared' (one handle held in both hands), 'bar', 'handle'
class TowerProp extends PropNode {
  constructor(d) {
    super();
    const t = tower(d.post, d.h, d.facing); this.node.add(t.node); this.anchor = t.anchor;
    this.attach = d.attach; this.side = d.side || 'L'; this.width = d.width || 0.5;
    this.cable = Geo.segment(0.008, Materials.cable); this.node.add(this.cable);
    if (this.attach === 'rope') {
      this.ropes = [Geo.segment(0.017, Materials.rubber), Geo.segment(0.017, Materials.rubber)];
      this.knobs = [Geo.sphere(0.028, Materials.rubber, V(0, 0, 0)), Geo.sphere(0.028, Materials.rubber, V(0, 0, 0))];
      for (const n of [...this.ropes, ...this.knobs]) this.node.add(n);
    } else {
      this.bar = Geo.segment(this.attach === 'bar' ? 0.014 : 0.016, frame); this.node.add(this.bar);
    }
  }
  update(ctx) {
    const a = this.anchor;
    if (this.attach === 'rope') {
      const gl = ctx.grip('L'), gr = ctx.grip('R');
      const mid = gl.clone().add(gr).multiplyScalar(0.5);
      const knot = mid.clone().addScaledVector(a.clone().sub(mid).normalize(), 0.16);
      Geo.place(this.cable, a, knot);
      [gl, gr].forEach((g, i) => {
        const end = g.clone().addScaledVector(g.clone().sub(knot).normalize(), 0.05);
        Geo.place(this.ropes[i], knot, end); this.knobs[i].position.copy(end);
      });
    } else if (this.attach === 'bar') {
      const l = ctx.grip('L'), r = ctx.grip('R'); const mid = l.clone().add(r).multiplyScalar(0.5);
      const x = l.clone().sub(r).normalize();
      handleAt(this.bar, mid, x, this.width / 2); Geo.place(this.cable, a, mid);
    } else if (this.attach === 'shared') {
      const l = ctx.grip('L'), r = ctx.grip('R'); const mid = l.clone().add(r).multiplyScalar(0.5);
      handleAt(this.bar, mid, l.clone().sub(r).normalize(), 0.11); Geo.place(this.cable, a, mid);
    } else {
      const g = ctx.grip(this.side);
      handleAt(this.bar, g, ctx.hand(this.side).thumb, 0.065); Geo.place(this.cable, a, g);
    }
  }
}

// ---- 45° leg press: fixed seat + rails, sled platform follows the soles
const LP = { pelvis: V(0, 0.52, -0.55), recline: 56, d: V(0, Math.SQRT1_2, Math.SQRT1_2), u: V(0, Math.SQRT1_2, -Math.SQRT1_2) };
class LegPressProp extends PropNode {
  constructor() {
    super();
    const fixed = new THREE.Group(); fixed.position.set(0, 0, LP.pelvis.z); this.node.add(fixed);
    const n = fixed, { d, u } = LP, pelvis = LP.pelvis.clone().setZ(0), r = LP.recline * Math.PI / 180;
    const t = V(0, Math.cos(r), -Math.sin(r)), back = V(0, -Math.sin(r), -Math.cos(r));
    n.add(box(0.46, 0.07, 0.78, pad, pelvis.clone().addScaledVector(t, 0.36).addScaledVector(back, 0.155), qxd(-LP.recline + 90)));
    n.add(box(0.46, 0.07, 0.40, pad, pelvis.clone().add(V(0, -0.14, 0.08)), qxd(-12)));
    n.add(box(0.1, 0.36, 0.1, frame, V(0, 0.18, 0.05)));
    n.add(box(0.1, 0.5, 0.1, frame, V(0, 0.36, -0.42), qxd(-30)));
    n.add(box(0.7, 0.05, 1.9, frame, V(0, 0.025, 0.45)));
    // rails along d, parallel to the sled path and ~0.3 m beneath it
    const railA = V(0, 0.22, 0.20), railB = railA.clone().addScaledVector(d, 1.45);
    for (const x of [-0.26, 0.26]) {
      const rl = Geo.segment(0.035, frame); Geo.place(rl, railA.clone().setX(x), railB.clone().setX(x)); n.add(rl);
      n.add(box(0.07, railB.y, 0.07, frame, V(x, railB.y / 2, railB.z)));
    }
    n.add(box(0.64, 0.07, 0.07, frame, railB.clone()));
    // handles beside the seat
    for (const x of [-0.29, 0.29]) {
      n.add(box(0.05, 0.05, 0.3, frame, V(x, 0.46, 0.0)));
      n.add(cylinder(0.018, 0.14, Materials.rubber, V(x, 0.46, 0.17), qxd(90)));
    }
    this.sled = new THREE.Group(); this.node.add(this.sled);
    this.sled.add(box(0.72, 0.58, 0.04, dark, V(0, 0, 0)));
    this.sled.add(box(0.64, 0.08, 0.26, frame, V(0, -0.30, 0.10)));
    for (const x of [-0.26, 0.26]) this.sled.add(cylinder(0.04, 0.34, frame, V(x, -0.27, 0.16), qxd(90)));
    for (const x of [-0.38, 0.38]) { this.sled.add(cylinder(0.02, 0.24, frame, V(x, 0.12, 0.14), qxd(90))); this.sled.add(cylinder(0.2, 0.05, dark, V(x, 0.12, 0.20), qxd(90))); }
    this.u = u; this.d = d;
  }
  update(ctx) {
    const w = ctx.pose.worldTransforms();
    const a = w.ankleL.position.clone().add(w.ankleR.position).multiplyScalar(0.5);
    const sole = a.addScaledVector(this.d, 0.075).addScaledVector(this.u, 0.07);
    this.sled.position.copy(sole.addScaledVector(this.d, 0.02)).setX(0);
    this.sled.quaternion.copy(qxd(-45));
  }
}

// ---- seated leg extension / leg curl: shin pad on a lever pivoting at the knees
class LegLeverProp extends PropNode {
  constructor(d) {
    super();
    const n = this.node; this.curl = d.curl; const seat = d.seat;
    n.add(box(0.44, 0.08, 0.50, pad, V(0, seat - 0.04, 0.16)));
    n.add(box(0.44, 0.66, 0.08, pad, V(0, seat + 0.40, d.curl ? -0.20 : -0.15), qxd(d.curl ? -12 : -6)));
    n.add(box(0.1, seat - 0.08, 0.1, frame, V(0, (seat - 0.08) / 2, 0.1)));
    n.add(box(0.6, 0.05, 1.1, frame, V(0, 0.025, 0.1)));
    n.add(box(0.36, 1.0, 0.22, dark, V(0.52, 0.55, -0.25)));
    n.add(box(0.08, 1.25, 0.08, frame, V(0.36, 0.62, -0.25)));
    for (const x of [-0.30, 0.30]) {
      n.add(box(0.05, 0.05, 0.30, frame, V(x, seat + 0.05, 0.02)));
      n.add(cylinder(0.018, 0.14, Materials.rubber, V(x, seat + 0.05, 0.17), qxd(90)));
    }
    n.add(box(0.06, seat + 0.1, 0.06, frame, V(0.34, (seat + 0.1) / 2, 0.44)));
    if (d.curl) {
      // thigh hold-down pad above the knees
      n.add(cylinder(0.055, 0.44, pad, V(0, seat + 0.23, 0.36), qzd(90)));
      n.add(box(0.05, 0.3, 0.05, frame, V(0.30, seat + 0.12, 0.36)));
    }
    this.lever = Geo.segment(0.028, frame); n.add(this.lever);
    this.pad = cylinder(0.055, 0.40, pad, V(0, 0, 0), qzd(90)); n.add(this.pad);
    this.hub = cylinder(0.05, 0.05, dark, V(0, 0, 0), qzd(90)); n.add(this.hub);
  }
  update(ctx) {
    const w = ctx.pose.worldTransforms();
    const knee = w.kneeL.position.clone().add(w.kneeR.position).multiplyScalar(0.5);
    const ankle = w.ankleL.position.clone().add(w.ankleR.position).multiplyScalar(0.5);
    const kr = w.kneeL.rotation;
    const front = V(0, 0, 1).applyQuaternion(kr); front.x = 0; front.normalize();
    const up = V(0, 1, 0).applyQuaternion(kr); up.x = 0; up.normalize();
    const p = ankle.clone().addScaledVector(up, 0.07).addScaledVector(front, this.curl ? -0.085 : 0.085); p.x = 0;
    this.pad.position.copy(p);
    const pivot = V(0.30, knee.y, knee.z);
    this.hub.position.copy(pivot);
    Geo.place(this.lever, pivot, V(0.30, p.y, p.z));
  }
}

// ---- seated chest press: handles on levers pivoting high behind the seat
class ChestPressProp extends PropNode {
  constructor(d) {
    super();
    const n = this.node, seat = d.seat;
    n.add(box(0.44, 0.08, 0.42, pad, V(0, seat - 0.04, 0.06)));
    n.add(box(0.44, 0.72, 0.08, pad, V(0, seat + 0.42, -0.17), qxd(-4)));
    n.add(box(0.1, seat - 0.08, 0.1, frame, V(0, (seat - 0.08) / 2, 0.05)));
    n.add(box(0.1, 1.82, 0.1, frame, V(0, 0.91, -0.30)));
    n.add(box(0.34, 1.0, 0.22, dark, V(0, 0.55, -0.50)));
    n.add(box(1.36, 0.05, 0.9, frame, V(0, 0.025, -0.15)));
    n.add(box(1.36, 0.08, 0.08, frame, V(0, 1.82, -0.30)));
    this.pivots = { L: V(0.64, 1.78, -0.24), R: V(-0.64, 1.78, -0.24) };
    for (const x of [-0.64, 0.64]) n.add(box(0.08, 1.78, 0.08, frame, V(x, 0.89, -0.30)));
    this.parts = {};
    for (const s of ['L', 'R']) {
      n.add(box(0.06, 0.1, 0.1, dark, this.pivots[s]));
      const lever = Geo.segment(0.026, frame), grip = Geo.segment(0.019, Materials.rubber), arm = Geo.segment(0.022, frame);
      n.add(lever); n.add(grip); n.add(arm); this.parts[s] = { lever, grip, arm };
    }
  }
  update(ctx) {
    for (const s of ['L', 'R']) {
      const g = ctx.grip(s), sg = s === 'L' ? 1 : -1, { lever, grip, arm } = this.parts[s];
      const inner = g.clone().add(V(-sg * 0.06, 0, 0)), outer = g.clone().add(V(sg * 0.10, 0, 0));
      Geo.place(grip, inner, outer);
      const elbow = outer.clone().add(V(sg * 0.04, 0, 0));
      Geo.place(arm, outer, elbow);
      Geo.place(lever, elbow, this.pivots[s]);
    }
  }
}

EXTRA_PROPS['cables.crossover'] = d => new CrossoverProp(d);
EXTRA_PROPS['cables.tower'] = d => new TowerProp(d);
EXTRA_PROPS['cables.legPress'] = () => new LegPressProp();
EXTRA_PROPS['cables.legLever'] = d => new LegLeverProp(d);
EXTRA_PROPS['cables.chestPress'] = d => new ChestPressProp(d);

export const data = [
  { id: 'cable-crossover-fly', name: 'Cable Crossover Fly', groups: ['Chest', 'Shoulders'], equipment: 'cable', weight: 25, reps: 12, sets: 3, timed: false,
    steps: ['Set both pulleys high, grab a handle in each hand and step forward into a split stance.', 'With a soft bend in the elbows, sweep your hands down and together in front of your hips.', 'Squeeze your chest, then let your arms open back wide under control.'],
    tip: 'Keep the elbow angle fixed; bending and straightening the arms turns the fly into a press.' },
  { id: 'cable-face-pull', name: 'Cable Face Pull', groups: ['Shoulders', 'Back'], equipment: 'cable', weight: 30, reps: 15, sets: 3, timed: false,
    steps: ['Set a rope at head height and hold it with thumbs pointing back toward you.', 'Pull the rope toward your face, splitting the ends and driving elbows high and wide.', 'Pause with hands beside your ears, then extend your arms slowly.'],
    tip: 'Do not lean back to move the weight; keep the torso tall and let the rear delts pull.' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', groups: ['Shoulders'], equipment: 'cable', weight: 15, reps: 12, sets: 3, timed: false,
    steps: ['Stand side-on to a low pulley and take the handle across your body with the far hand.', 'Raise the arm out to the side with a slight elbow bend until it reaches shoulder height.', 'Lower slowly back across your body, keeping tension on the cable.'],
    tip: 'Lead with the elbow, not the hand, and avoid shrugging the shoulder toward your ear.' },
  { id: 'cable-bicep-curl', name: 'Cable Bicep Curl', groups: ['Biceps', 'Forearms'], equipment: 'cable', weight: 40, reps: 12, sets: 3, timed: false,
    steps: ['Face a low pulley holding a straight bar with an underhand, shoulder-width grip.', 'Pin your elbows at your sides and curl the bar up toward your shoulders.', 'Squeeze at the top, then lower the bar until the arms are straight.'],
    tip: 'Keep elbows still at your sides; letting them drift forward shifts the work to the shoulders.' },
  { id: 'straight-arm-pulldown', name: 'Straight Arm Pulldown', groups: ['Back', 'Triceps'], equipment: 'cable', weight: 40, reps: 12, sets: 3, timed: false,
    steps: ['Face a high pulley holding a straight bar, hinge slightly forward with arms extended.', 'Keeping arms nearly straight, sweep the bar down in an arc to your thighs.', 'Squeeze your lats, then let the bar rise back to eye level with control.'],
    tip: 'Do not bend the elbows to push the bar down; the movement comes from the shoulders.' },
  { id: 'cable-woodchopper', name: 'Cable Woodchopper', groups: ['Abs', 'Shoulders'], equipment: 'cable', weight: 30, reps: 12, sets: 3, timed: false,
    steps: ['Stand side-on to a high pulley and grasp the handle with both hands above your shoulder.', 'Rotate your torso and pull the handle diagonally down across your body to the opposite hip.', 'Return along the same path under control; switch sides after the set.'],
    tip: 'Rotate through the torso and hips together; do not just pull the handle down with the arms.' },
  { id: 'leg-press', name: 'Leg Press', groups: ['Legs', 'Glutes'], equipment: 'machine', weight: 180, reps: 10, sets: 4, timed: false,
    steps: ['Sit back in the machine with feet hip-width in the middle of the platform.', 'Release the safeties and lower the sled until your knees bend to about 90 degrees.', 'Press through your heels to extend your legs without locking the knees.'],
    tip: 'Keep your lower back on the pad; going too deep lets the hips roll up and rounds the spine.' },
  { id: 'leg-extension', name: 'Leg Extension', groups: ['Legs'], equipment: 'machine', weight: 70, reps: 12, sets: 3, timed: false,
    steps: ['Sit with your knees in line with the pivot and the pad on the front of your lower shins.', 'Hold the handles and straighten your knees until the legs are fully extended.', 'Squeeze your quads briefly, then lower the pad slowly.'],
    tip: 'Do not swing the weight up; keep your hips down on the seat and move only at the knee.' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', groups: ['Legs'], equipment: 'machine', weight: 70, reps: 12, sets: 3, timed: false,
    steps: ['Sit with the lower pad behind your ankles and the thigh pad locked just above your knees.', 'Curl your heels down and back under the seat as far as you can.', 'Pause, then let the pad return slowly until the legs are nearly straight.'],
    tip: 'Keep your back against the pad; lifting the hips off the seat takes tension off the hamstrings.' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', groups: ['Chest', 'Triceps', 'Shoulders'], equipment: 'machine', weight: 90, reps: 10, sets: 4, timed: false,
    steps: ['Adjust the seat so the handles line up with the middle of your chest.', 'Press the handles forward until your arms are straight but not locked.', 'Let the handles return slowly until your hands are beside your chest.'],
    tip: 'Keep your shoulder blades back against the pad; do not let the shoulders roll forward at the end.' },
];

export function motions(H) {
  const { Pose, Side, V, qx, qy, deg, Skeleton, cam, clip, rep, spec } = H;
  const M = {};

  M['cable-crossover-fly'] = () => {
    const base = Pose.splitStance(Side.L, 0.15, 0.24, 0.05); base.setTorso({ pitch: 14 }); const sy = base.shoulderY;
    const open = base.clone(), shut = base.clone();
    open.reachBoth(V(0.74, sy + 0.12, 0.02), V(0.3, -0.9, -0.2), 'forward');
    shut.reachBoth(V(0.07, sy - 0.40, 0.46), V(0.9, -0.3, -0.4), 'inward');
    const props = [{ kind: 'cables.crossover', x: 1.05, z: -0.22, h: 1.95 }];
    return spec(rep(3.0, open, shut, 0.42, 0.10), cam(25, 10, 4.8, 1.15), props, ['chest', 'deltoids'], 1);
  };

  M['cable-face-pull'] = () => {
    const base = Pose.splitStance(Side.L, 0.15, 0.20, 0.04); base.setTorso({ pitch: -3 }); const sy = base.shoulderY;
    const ext = base.clone(), pulled = base.clone();
    ext.reachBoth(V(0.09, sy + 0.14, 0.60), V(0.5, 0.2, -0.8), 'inward');
    pulled.reachBoth(V(0.24, sy + 0.24, 0.04), V(1, 0.5, -0.4), 'inward'); pulled.shrug(0.0);
    const props = [{ kind: 'cables.tower', post: V(0, 0, 1.25), h: 1.72, facing: V(0, 0, -1), attach: 'rope' }];
    return spec(rep(2.6, ext, pulled, 0.42, 0.12), cam(55, 10, 4.4, 1.2), props, ['rearDeltoids', 'traps', 'deltoids'], 1);
  };

  M['cable-lateral-raise'] = () => {
    const base = Pose.standing(); base.pelvisOffset = V(0, -0.03, 0); base.setTorso({ roll: 4 });
    for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.16, Skeleton.ankleHeight, 0), V(s.sign * 0.3, 0.05, 1));
    base.levelFeet();
    base.reachArm(Side.R, V(-0.19, base.shoulderY - 0.42, 0.03), V(-1, 0.2, -0.6), 'inward');
    const sy = base.shoulderY;
    const down = base.clone(), up = base.clone();
    down.reachArm(Side.L, V(-0.04, 0.86, 0.20), V(0.4, -0.2, -1), 'inward');
    up.reachArm(Side.L, V(0.72, sy + 0.02, 0.10), V(0.1, -1, -0.3), 'down');
    const props = [{ kind: 'cables.tower', post: V(-0.80, 0, 0.10), h: 0.14, facing: V(1, 0, 0), attach: 'handle', side: 'L' }];
    return spec(rep(2.8, down, up, 0.42, 0.10), cam(20, 8, 4.4, 1.0), props, ['deltoids', 'traps'], 1);
  };

  M['cable-bicep-curl'] = () => {
    const base = Pose.standing(); base.pelvisOffset = V(0, -0.02, 0);
    for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.15, Skeleton.ankleHeight, 0), V(s.sign * 0.3, 0.05, 1));
    base.levelFeet(); const sy = base.shoulderY;
    const down = base.clone(), up = base.clone();
    down.reachBoth(V(0.20, 0.84, 0.16), V(0.3, 0.2, -1), 'forward');
    up.reachBoth(V(0.19, sy - 0.14, 0.26), V(0.3, -0.7, -1), 'backward'); up.setTorso({ pitch: -3 });
    const props = [{ kind: 'cables.tower', post: V(0, 0, 0.95), h: 0.12, facing: V(0, 0, -1), attach: 'bar', width: 0.62 }];
    return spec(rep(2.8, down, up, 0.42, 0.10), cam(40, 6, 4.2, 0.95), props, ['biceps', 'forearms'], 1);
  };

  M['straight-arm-pulldown'] = () => {
    const base = H.hinge(28, 0.05, 0.08); base.setHead({ pitch: -18 });
    const t = base.worldTransforms();
    const arm = (p, ang) => {
      for (const s of Side.both) {
        const sh = t[s.shoulder].position; const a = deg(ang);
        const target = sh.clone().add(V(s.sign * 0.03, -Math.cos(a) * 0.60, Math.sin(a) * 0.60));
        p.reachArm(s, target, V(s.sign * 0.4, -0.4, -1), 'backward');
      }
      return p;
    };
    const top = arm(base.clone(), 104), bottom = arm(base.clone(), 18);
    const props = [{ kind: 'cables.tower', post: V(0, 0, 1.05), h: 2.1, facing: V(0, 0, -1), attach: 'bar', width: 0.6 }];
    return spec(rep(2.8, top, bottom, 0.42, 0.10), cam(70, 8, 4.6, 1.1), props, ['lats', 'triceps', 'rearDeltoids'], 1);
  };

  M['cable-woodchopper'] = () => {
    const pose = (turn, drop, hand, pitch) => {
      const p = Pose.standing(); p.pelvisOffset = V(0, -drop, 0);
      p.set('pelvis', qy(turn * 0.35));
      for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.24, Skeleton.ankleHeight, 0), V(s.sign * 0.35, 0.05, 1));
      p.levelFeet();
      p.setTorso({ yaw: turn * 0.65, pitch });
      for (const s of Side.both) p.reachArm(s, hand.clone().add(V(s.sign * 0.045, 0, 0)), V(s.sign * 0.6, -0.8, -0.3), 'inward');
      return p;
    };
    const high = pose(-45, 0.04, V(-0.48, 1.78, 0.30), -4);
    const low = pose(40, 0.14, V(0.40, 0.74, 0.40), 18);
    const props = [{ kind: 'cables.tower', post: V(-1.25, 0, 0.35), h: 2.0, facing: V(1, 0, -0.1), attach: 'shared' }];
    return spec(rep(2.6, high, low, 0.40, 0.08), cam(20, 8, 5.0, 1.1), props, ['obliques', 'abs', 'deltoids'], 1);
  };

  M['leg-press'] = () => {
    const pose = dist => {
      const p = Pose.standing(); p.set('pelvis', qx(-LP.recline));
      p.pelvisOffset = LP.pelvis.clone().sub(V(0, Skeleton.pelvisHeight, 0));
      p.setTorso({ pitch: 8 }); p.setHead({ pitch: 22 });
      const t = p.worldTransforms();
      for (const s of Side.both) {
        const hip = t[s.hip].position;
        const target = hip.clone().setX(s.sign * 0.15).addScaledVector(LP.d, dist).addScaledVector(LP.u, -0.04);
        p.reachLeg(s, target, V(s.sign * 0.35, 0.7, -0.7));
      }
      const tw = p.worldTransforms(); const foot = qx(-135);
      for (const s of Side.both) p.set(s.ankle, tw[s.knee].rotation.clone().invert().multiply(foot));
      p.reachBoth(V(0.29, 0.47, LP.pelvis.z + 0.17), V(0.4, 0.6, -0.6), 'inward');
      return p;
    };
    return spec(rep(3.0, pose(0.86), pose(0.60), 0.45, 0.06), cam(72, 12, 4.4, 0.8), [{ kind: 'cables.legPress' }], ['quads', 'glutes', 'hamstrings'], 1);
  };

  const seatedMachine = (seat, lean) => {
    const p = Pose.seated(seat, 0.06); p.setTorso({ pitch: lean });
    p.reachBoth(V(0.30, seat + 0.05, 0.19), V(0.4, 0.5, -0.8), 'inward');
    return p;
  };
  /** Thigh held level on the seat; shin swung to `phi` degrees from hanging straight down (positive = forward). */
  const kneeAt = (p, phi) => {
    const t = p.worldTransforms();
    for (const s of Side.both) {
      const hip = t[s.hip].position; const a = deg(phi);
      const knee = hip.clone().add(V(s.sign * 0.03, -0.03, Skeleton.thigh - 0.005));
      const ankle = knee.clone().add(V(0, -Math.cos(a) * Skeleton.shin, Math.sin(a) * Skeleton.shin));
      const pole = knee.clone().sub(hip.clone().add(ankle).multiplyScalar(0.5));
      p.reachLeg(s, ankle, pole); p.set(s.ankle, qx(-8));
    }
    return p;
  };

  M['leg-extension'] = () => {
    const seat = 0.56; const base = seatedMachine(seat, -6);
    const down = kneeAt(base.clone(), -12), up = kneeAt(base.clone(), 84);
    up.setTorso({ pitch: -8 }); up.reachBoth(V(0.30, seat + 0.05, 0.19), V(0.4, 0.5, -0.8), 'inward');
    return spec(rep(2.6, down, up, 0.42, 0.10), cam(70, 8, 3.9, 0.75), [{ kind: 'cables.legLever', seat, curl: false }], ['quads'], 1);
  };

  M['seated-leg-curl'] = () => {
    const seat = 0.52; const base = seatedMachine(seat, -10);
    const straight = kneeAt(base.clone(), 76), curled = kneeAt(base.clone(), -28);
    return spec(rep(2.8, straight, curled, 0.42, 0.10), cam(70, 8, 3.9, 0.75), [{ kind: 'cables.legLever', seat, curl: true }], ['hamstrings', 'calves'], 1);
  };

  M['machine-chest-press'] = () => {
    const seat = 0.48; const base = Pose.seated(seat, 0.10); base.setTorso({ pitch: -3 });
    const sy = base.shoulderY;
    const back = base.clone(), out = base.clone();
    back.reachBoth(V(0.30, sy - 0.14, 0.16), V(1, -0.3, -0.5), 'down');
    out.reachBoth(V(0.22, sy - 0.10, 0.64), V(0.8, -0.6, -0.2), 'down');
    return spec(rep(2.6, back, out, 0.42, 0.08), cam(50, 10, 4.2, 1.0), [{ kind: 'cables.chestPress', seat }], ['chest', 'triceps', 'deltoids'], 1);
  };

  return M;
}
