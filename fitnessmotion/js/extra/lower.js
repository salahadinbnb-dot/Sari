// Lower-body pack: squats, lunges, step-ups, hinges, kettlebell swing, wall sit, all-fours glute work and calf raises.
import * as THREE from '../../vendor/three.module.min.js';
import { EXTRA_PROPS, PropNode, StaticProp, Geo, Materials, Furniture } from '../props.js?v=7';
import { orthonormalized, qFromBasis } from '../skeleton.js?v=7';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.75 });
const wall = new THREE.MeshStandardMaterial({ color: 0x5c5f66, roughness: 0.9 });

// Plyo box: height d.height, front face at z = d.front.
EXTRA_PROPS['lower.box'] = d => {
  const g = new THREE.Group(); const h = d.height ?? 0.45, depth = 0.50, front = d.front ?? 0.26;
  g.add(Geo.box(0.62, h, depth, wood, V3(0, h / 2, front + depth / 2)));
  g.add(Geo.box(0.64, 0.02, depth + 0.02, Materials.rubber, V3(0, h + 0.01, front + depth / 2)));
  return new StaticProp(g);
};
// Flat wall behind the figure; front face at z = d.face.
EXTRA_PROPS['lower.wall'] = d => {
  const g = new THREE.Group(); const face = d.face ?? -0.15;
  g.add(Geo.box(1.8, 2.3, 0.12, wall, V3(0, 1.15, face - 0.06)));
  return new StaticProp(g);
};
// Standard flat bench shifted along z (for a rear foot or seat placed away from the origin).
EXTRA_PROPS['lower.bench'] = d => { const n = Furniture.bench(0); n.position.z = d.z ?? 0; return new StaticProp(n); };

// One dumbbell held vertically at the chest, cupped under the top plate by both hands.
class GobletProp extends PropNode {
  constructor() {
    super();
    const db = Geo.dumbbell(0.16, 0.075); db.quaternion.setFromAxisAngle(V3(0, 0, 1), Math.PI / 2);
    this.node.add(db);
  }
  update(ctx) {
    const l = ctx.grip('L'), r = ctx.grip('R');
    this.node.position.copy(l).add(r).multiplyScalar(0.5).add(V3(0, -0.12, 0.02));
  }
}
EXTRA_PROPS['lower.goblet'] = () => new GobletProp();

// One kettlebell held by the handle in both hands; the bell hangs along the fingers.
class SwingBellProp extends PropNode {
  constructor() {
    super();
    this.node.add(Geo.torus(0.075, 0.013, Materials.metalDark, V3(0, 0, 0)));
    this.node.add(Geo.sphere(0.10, Materials.metalDark, V3(0, -0.15, 0)));
  }
  update(ctx) {
    const l = ctx.grip('L'), r = ctx.grip('R');
    this.node.position.copy(l).add(r).multiplyScalar(0.5);
    let x = l.clone().sub(r); if (x.length() < 1e-4) x = V3(1, 0, 0); x.normalize();
    const fingers = ctx.hand('L').fingers.add(ctx.hand('R').fingers);
    const y = orthonormalized(fingers.negate(), x, V3(0, 1, 0));
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    this.node.quaternion.copy(qFromBasis(x, y, z));
  }
}
EXTRA_PROPS['lower.swingBell'] = () => new SwingBellProp();

export const data = [
  { id: 'goblet-squat', name: 'Goblet Squat', groups: ['Legs', 'Glutes'], equipment: 'dumbbells', weight: 35, reps: 12, sets: 3, timed: false,
    steps: ['Hold one dumbbell vertically at your chest, cupping the top end.', 'Sit your hips down between your heels, elbows inside your knees.', 'Drive through the whole foot to stand tall.'],
    tip: 'Keep the chest up and the weight close; letting it drift forward rounds the back.' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', groups: ['Legs', 'Glutes'], equipment: 'dumbbellBench', weight: 25, reps: 10, sets: 3, timed: false,
    steps: ['Rest your rear foot laces-down on a bench, dumbbells at your sides.', 'Lower straight down until the front thigh is about parallel.', 'Push through the front heel to rise, then switch legs after the set.'],
    tip: 'Stand far enough from the bench that the front knee stays over the mid-foot.' },
  { id: 'lateral-lunge', name: 'Lateral Lunge', groups: ['Legs', 'Glutes'], equipment: 'bodyweight', weight: null, reps: 12, sets: 3, timed: false,
    steps: ['Step wide to one side, toes pointing forward.', 'Sit the hips back over the stepping leg, other leg straight.', 'Push off to return to centre and alternate sides.'],
    tip: 'Keep both feet flat; lifting the heel of the bent leg shifts the load to the knee.' },
  { id: 'box-step-up', name: 'Box Step Up', groups: ['Legs', 'Glutes'], equipment: 'box', weight: null, reps: 12, sets: 3, timed: false,
    steps: ['Place your whole foot on the box.', 'Drive through that heel to stand tall on top of the box.', 'Step down with control and lead with the other leg next rep.'],
    tip: 'Do not push off the back foot; the leg on the box should do the work.' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', groups: ['Glutes', 'Legs', 'Back'], equipment: 'kettlebell', weight: 35, reps: 15, sets: 3, timed: false,
    steps: ['Hinge and hike the bell back between your thighs, arms straight.', 'Snap your hips forward to float the bell to chest height.', 'Let it fall and hinge again as your forearms meet your thighs.'],
    tip: 'It is a hip hinge, not a squat or a front raise; the arms only guide the bell.' },
  { id: 'single-leg-romanian-deadlift', name: 'Single-Leg Romanian Deadlift', groups: ['Legs', 'Glutes'], equipment: 'dumbbells', weight: 25, reps: 10, sets: 3, timed: false,
    steps: ['Stand on one leg, dumbbell in the opposite hand.', 'Hinge forward as the free leg reaches back in line with your torso.', 'Squeeze the standing glute to return upright; switch sides after the set.'],
    tip: 'Keep the hips square to the floor; opening the hip of the free leg twists the spine.' },
  { id: 'wall-sit', name: 'Wall Sit', groups: ['Legs', 'Glutes'], equipment: 'bodyweight', weight: null, reps: 45, sets: 3, timed: true,
    steps: ['Lean your back flat against a wall.', 'Slide down until your thighs are parallel to the floor.', 'Keep knees over ankles and hold for the time.'],
    tip: 'Keep your hands off your thighs; pushing on them takes the load off the quads.' },
  { id: 'donkey-kick', name: 'Donkey Kick', groups: ['Glutes', 'Legs'], equipment: 'bodyweight', weight: null, reps: 15, sets: 3, timed: false,
    steps: ['Start on hands and knees, hands under shoulders, knees under hips.', 'Keeping the knee bent, press one sole up toward the ceiling.', 'Lower with control and alternate legs.'],
    tip: 'Stop when the thigh is level with the back; kicking higher arches the lower back.' },
  { id: 'fire-hydrant', name: 'Fire Hydrant', groups: ['Glutes'], equipment: 'bodyweight', weight: null, reps: 15, sets: 3, timed: false,
    steps: ['Start on hands and knees with a flat back.', 'Keeping the knee bent 90°, lift one leg out to the side.', 'Pause at hip height, lower slowly and alternate sides.'],
    tip: 'Keep your hips level; leaning over the support knee hides a short range of motion.' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', groups: ['Calves'], equipment: 'dumbbellBench', weight: 40, reps: 15, sets: 3, timed: false,
    steps: ['Sit on a bench with dumbbells resting on your lower thighs.', 'Press through the balls of your feet to lift the heels high.', 'Pause at the top, then lower the heels fully.'],
    tip: 'Pause at the top instead of bouncing; momentum robs the calves of the work.' },
];

export function motions(H) {
  const { Pose, Side, V, qx, qy, qz, euler, deg, Skeleton, cam, clip, rep, alternating, spec, P, qIdentityFor } = H;
  const A = Skeleton.ankleHeight;

  /** Arms hanging straight down beside the thighs, following the pelvis wherever it is. */
  const hang = (p, width = 0.26, fwd = 0.06, palm = 'inward') => {
    const t = p.worldTransforms();
    const y = t.shoulderL.position.y - Skeleton.upperArm - Skeleton.foreArm - Skeleton.handLength + 0.03;
    const z = (t.shoulderL.position.z + t.shoulderR.position.z) / 2;
    p.reachBoth(V(width, y, z + fwd), V(0.35, -0.3, -1), palm);
    return p;
  };
  const flat = (p, ...sides) => { for (const s of sides) p.set(s.ankle, qIdentityFor(p, s)); return p; };
  /** World-space foot rotation `q` for side s (knee rotation compensated). */
  const footWorld = (p, s, q) => { p.set(s.ankle, qIdentityFor(p, s).multiply(q)); return p; };

  /** Hands-and-knees base: knees under hips, hands under shoulders, flat back, head toward +Z. */
  const allFours = () => {
    const p = Pose.prone(); p.set('pelvis', qx(80));
    p.pelvisOffset = V(0, 0.56 - Skeleton.pelvisHeight, -0.10);
    for (const s of Side.both) p.set(s.hip, qx(0));
    const t = p.worldTransforms();
    for (const s of Side.both) {
      const hip = t[s.hip].position;
      p.reachLeg(s, V(s.sign * 0.12, 0.08, hip.z - 0.43), V(0, -0.5, 1));
      footWorld(p, s, qx(170));
    }
    p.setHead({ pitch: -10 });
    const t2 = p.worldTransforms();
    p.reachBoth(V(0.20, 0.03, t2.shoulderL.position.z), V(0.3, 0.2, -1), 'down');
    return p;
  };

  const M = {};

  M['goblet-squat'] = () => {
    const pose = depth => {
      const p = Pose.squat(depth, 0.22, 16);
      for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.22, A, 0), V(s.sign * 0.5, 0.05, 1));
      p.levelFeet();
      const t = p.worldTransforms(); const c = t.chest; const up = V(0, 1, 0).applyQuaternion(c.rotation), fwd = V(0, 0, 1).applyQuaternion(c.rotation);
      const base = c.position.clone().add(up.multiplyScalar(0.10)).add(fwd.multiplyScalar(0.24));
      for (const s of Side.both) p.reachArm(s, base.clone().add(V(s.sign * 0.06, 0, 0)), V(s.sign * 0.5, -1, -0.2), 'up');
      return p;
    };
    return spec(rep(3.0, pose(0.02), pose(0.95), 0.45, 0.06), cam(40, 8, 4.0, 0.85), [{ kind: 'lower.goblet' }], ['quads', 'glutes', 'hamstrings'], 1);
  };

  M['bulgarian-split-squat'] = () => {
    const pose = depth => {
      const p = Pose.standing(); p.pelvisOffset = V(0, -0.06 - depth * 0.36, 0.02 + depth * 0.02);
      p.setTorso({ pitch: 8 + depth * 8 });
      p.reachLeg(Side.L, V(0.12, A, 0.40), V(0, 0.1, 1)); flat(p, Side.L);
      p.reachLeg(Side.R, V(-0.12, 0.50, -0.55), V(0, -0.6, 1)); footWorld(p, Side.R, qx(165));
      return hang(p, 0.30, 0.04);
    };
    return spec(rep(3.0, pose(0), pose(1), 0.45, 0.06), cam(65, 8, 4.4, 0.8), [P.dumbbells(), { kind: 'lower.bench', z: -0.62 }], ['quads', 'glutes', 'hamstrings']);
  };

  M['lateral-lunge'] = () => {
    const stand = Pose.standing(); hang(stand, 0.24, 0.04);
    const clasp = p => {
      const t = p.worldTransforms(); const c = t.chest.position;
      for (const h of Side.both) p.reachArm(h, V(c.x + h.sign * 0.05, c.y + 0.04, c.z + 0.34), V(h.sign * 0.6, -1, -0.3), 'inward');
    };
    const lunge = s => {
      const o = Side.other(s); const p = Pose.standing();
      p.pelvisOffset = V(s.sign * 0.54, -0.30, -0.12); p.setTorso({ pitch: 34 });
      p.reachLeg(s, V(s.sign * 0.78, A, 0.02), V(s.sign * 0.5, 0.1, 1));
      p.reachLeg(o, V(o.sign * 0.10, A, 0.0), V(0, 0, 1));
      p.levelFeet(); clasp(p);
      return p;
    };
    const step = s => {
      const o = Side.other(s); const p = Pose.standing();
      p.pelvisOffset = V(s.sign * 0.16, -0.06, -0.03); p.setTorso({ pitch: 12 });
      p.reachLeg(s, V(s.sign * 0.46, A + 0.12, 0.02), V(s.sign * 0.3, 0.1, 1));
      p.reachLeg(o, V(o.sign * 0.10, A, 0.0), V(0, 0, 1));
      p.levelFeet(); clasp(p);
      return p;
    };
    const L = lunge(Side.L), R = lunge(Side.R);
    const c = clip(4.4, [[0, stand], [0.10, step(Side.L)], [0.22, L], [0.30, L], [0.40, step(Side.L)], [0.5, stand],
      [0.60, step(Side.R)], [0.72, R], [0.80, R], [0.90, step(Side.R)], [1, stand]]);
    return spec(c, cam(10, 8, 4.8, 0.8), [], ['quads', 'glutes', 'hamstrings']);
  };

  M['box-step-up'] = () => {
    const BOX = 0.45, onBox = BOX + A, fz = 0.42;
    const stand = Pose.standing(); hang(stand);
    const plant = lead => { // lead foot on the box, trail foot on the floor
      const o = Side.other(lead); const p = Pose.standing();
      p.pelvisOffset = V(0, -0.08, 0.12); p.setTorso({ pitch: 16 });
      p.reachLeg(lead, V(lead.sign * 0.12, onBox, fz), V(0, 0.3, 1));
      p.reachLeg(o, V(o.sign * 0.11, A, 0), V(0, 0, 1));
      flat(p, lead, o); return hang(p, 0.30, 0.02);
    };
    const drive = lead => { // halfway up, trail foot leaving the floor
      const o = Side.other(lead); const p = Pose.standing();
      p.pelvisOffset = V(0, BOX * 0.55, 0.30); p.setTorso({ pitch: 10 });
      p.reachLeg(lead, V(lead.sign * 0.12, onBox, fz), V(0, 0.3, 1));
      p.reachLeg(o, V(o.sign * 0.11, A + 0.18, 0.14), V(0, 0.2, 1));
      flat(p, lead); footWorld(p, o, qx(25)); return hang(p, 0.26, 0.06);
    };
    const top = Pose.standing(); top.pelvisOffset = V(0, BOX, fz);
    for (const s of Side.both) top.reachLeg(s, V(s.sign * 0.11, onBox, fz), V(0, 0, 1));
    top.levelFeet(); hang(top);
    const down = lead => { // trail leg steps back down to the floor first
      const o = Side.other(lead); const p = plant(lead); return p;
    };
    const c = clip(5.2, [[0, stand], [0.08, plant(Side.L)], [0.18, drive(Side.L)], [0.26, top], [0.30, top], [0.40, down(Side.L)], [0.5, stand],
      [0.58, plant(Side.R)], [0.68, drive(Side.R)], [0.76, top], [0.80, top], [0.90, down(Side.R)], [1, stand]]);
    return spec(c, cam(60, 8, 5.2, 1.2), [{ kind: 'lower.box', height: BOX, front: 0.26 }], ['quads', 'glutes', 'hamstrings']);
  };

  M['kettlebell-swing'] = () => {
    const stance = 0.22;
    const base = (pitch, drop, back) => {
      const p = Pose.standing(); p.pelvisOffset = V(0, -drop, -back);
      for (const s of Side.both) p.reachLeg(s, V(s.sign * stance, A, 0), V(s.sign * 0.35, 0.1, 1));
      p.levelFeet(); p.setTorso({ pitch }); p.setHead({ pitch: -pitch * 0.4 });
      return p;
    };
    const arms = (p, dir, palm) => { // straight arms from the shoulders along `dir`
      const t = p.worldTransforms(); const sh = t.shoulderL.position.clone().add(t.shoulderR.position).multiplyScalar(0.5);
      const d = dir.clone().normalize().multiplyScalar(0.60);
      p.reachBoth(V(0.05, sh.y + d.y, sh.z + d.z), V(0.3, -0.2, -1), palm);
      return p;
    };
    const bottom = arms(base(60, 0.11, 0.24), V(0, -1, -0.45), 'backward');
    const mid = arms(base(20, 0.06, 0.06), V(0, -1, 0.35), 'backward');
    const top = arms(base(-4, 0, 0), V(0, -0.05, 1), 'down');
    const c = clip(1.8, [[0, bottom], [0.22, mid], [0.40, top], [0.50, top], [0.70, mid], [0.90, bottom], [1, bottom]]);
    return spec(c, cam(75, 8, 4.4, 0.9), [{ kind: 'lower.swingBell' }], ['glutes', 'hamstrings', 'lowerBack', 'quads'], 1);
  };

  M['single-leg-romanian-deadlift'] = () => {
    const pose = tilt => { // tilt 0 = upright, 1 = torso and free leg horizontal
      const p = Pose.standing(); const a = 78 * tilt;
      p.set('pelvis', qx(a)); p.pelvisOffset = V(0, -0.04 - tilt * 0.06, -0.02 - tilt * 0.06);
      p.setTorso({ pitch: 4 * tilt }); p.setHead({ pitch: -a * 0.15 });
      p.reachLeg(Side.L, V(0.10, A, 0.02), V(0, 0.1, 1)); flat(p, Side.L);
      const t = p.worldTransforms(); const hip = t.hipR.position;
      const back = V(0, Math.cos(deg(a)) * -1, -Math.sin(deg(a))); // along the torso line, downward/backward
      const reach = tilt < 0.2 ? V(-0.12, A + 0.06, -0.22) : hip.clone().add(back.multiplyScalar(0.84)).setX(-0.12);
      p.reachLeg(Side.R, reach, V(0, -0.3 * tilt, 1 - tilt * 0.9));
      footWorld(p, Side.R, qx(tilt < 0.2 ? 30 : 80));
      const t2 = p.worldTransforms(); const sR = t2.shoulderR.position, sL = t2.shoulderL.position;
      p.reachArm(Side.R, V(sR.x + 0.02, sR.y - 0.60, sR.z + 0.04), V(-0.3, -0.2, -1), 'inward');
      p.reachArm(Side.L, V(sL.x + 0.22, sL.y - 0.48, sL.z + 0.10), V(1, -0.2, -0.4), 'inward');
      return p;
    };
    return spec(rep(3.4, pose(0), pose(1), 0.45, 0.10), cam(70, 8, 4.4, 0.8), [P.dumbbell('R')], ['hamstrings', 'glutes', 'lowerBack']);
  };

  M['wall-sit'] = () => {
    const p = Pose.seated(0.44, 0.10); p.pelvisOffset.z = 0;
    for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.18, A, 0.46), V(s.sign * 0.2, 0.2, 1));
    p.levelFeet();
    { const t = p.worldTransforms(); const sh = t.shoulderL.position; p.reachBoth(V(0.17, sh.y - 0.02, sh.z + 0.60), V(0.5, -1, 0), 'inward'); }
    const breathe = p.clone(); breathe.pelvisOffset.y -= 0.012; breathe.setTorso({ pitch: 1 });
    return spec(clip(3.0, [[0, p], [0.5, breathe], [1, p]]), cam(65, 8, 4.2, 0.75), [{ kind: 'lower.wall', face: -0.15 }], ['quads', 'glutes']);
  };

  M['donkey-kick'] = () => {
    const base = allFours();
    const kick = s => {
      const p = base.clone(); const t = p.worldTransforms(); const hip = t[s.hip].position;
      p.reachLeg(s, V(s.sign * 0.12, hip.y + 0.46, hip.z - 0.44), V(0, -1, -0.4));
      footWorld(p, s, qx(180));
      return p;
    };
    return spec(alternating(3.2, base, kick(Side.L), kick(Side.R)), cam(80, 10, 4.2, 0.5), [P.mat()], ['glutes', 'hamstrings']);
  };

  M['fire-hydrant'] = () => {
    const base = allFours();
    const lift = s => {
      const p = base.clone(); const t = p.worldTransforms(); const hip = t[s.hip].position;
      const a = deg(62); const knee = hip.clone().add(V(s.sign * Math.sin(a) * 0.45, -Math.cos(a) * 0.45, 0));
      p.reachLeg(s, knee.clone().add(V(0, 0, -0.43)), V(s.sign * 0.8, -0.6, 0.6));
      footWorld(p, s, qx(170));
      p.set('pelvis', qx(80).multiply(qz(-s.sign * 4)));
      return p;
    };
    return spec(alternating(3.2, base, lift(Side.L), lift(Side.R)), cam(160, 14, 4.2, 0.5), [P.mat()], ['glutes']);
  };

  M['seated-calf-raise'] = () => {
    const pose = up => {
      const p = Pose.seated(0.45, 0.10);
      const h = up * 0.12, back = up * 0.04;
      for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.18, A + h, 0.46 - back), V(s.sign * 0.2, 0.2, 1));
      for (const s of Side.both) footWorld(p, s, qx(42 * up));
      const t = p.worldTransforms();
      for (const s of Side.both) { const k = t[s.knee].position; p.reachArm(s, V(k.x, k.y + 0.12, k.z - 0.09), V(s.sign * 0.5, -0.3, -1), 'down'); }
      return p;
    };
    return spec(rep(2.2, pose(0), pose(1), 0.42, 0.14), cam(60, 6, 3.6, 0.55), [P.dumbbells(), P.bench(0)], ['calves']);
  };

  return M;
}
