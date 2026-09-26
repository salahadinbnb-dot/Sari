// Core & conditioning pack: planks, lying ab work, bird dog, plyometrics and medicine-ball slams.
import * as THREE from '../../vendor/three.module.min.js';
import { EXTRA_PROPS, StaticProp, PropNode, Geo, Materials } from '../props.js?v=7';

// ---- props
const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
const woodEdge = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.85 });
const BOX = { h: 0.50, w: 0.62, d: 0.50, z: 0.58 }; // plyo box: top at y=0.5, front face at z=0.33
EXTRA_PROPS['core.box'] = () => {
  const n = new THREE.Group();
  n.add(Geo.box(BOX.w, BOX.h - 0.02, BOX.d, wood, new THREE.Vector3(0, (BOX.h - 0.02) / 2, BOX.z)));
  n.add(Geo.box(BOX.w + 0.01, 0.02, BOX.d + 0.01, woodEdge, new THREE.Vector3(0, BOX.h - 0.01, BOX.z)));
  n.add(Geo.box(BOX.w * 0.35, 0.05, 0.01, woodEdge, new THREE.Vector3(0, BOX.h * 0.72, BOX.z + BOX.d / 2 + 0.003)));
  return new StaticProp(n);
};

const ballMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.95 });
const ballBand = new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.8 });
/** Medicine ball held between the palms: sits at the midpoint of the grips, never below the floor. */
class MedBallProp extends PropNode {
  constructor(radius) {
    super(); this.r = radius;
    this.node.add(Geo.sphere(radius, ballMat, new THREE.Vector3(0, 0, 0)));
    this.node.add(Geo.torus(radius * 0.995, 0.012, ballBand, new THREE.Vector3(0, 0, 0)));
  }
  update(ctx) {
    const p = ctx.grip('L').add(ctx.grip('R')).multiplyScalar(0.5);
    p.y = Math.max(this.r, p.y);
    this.node.position.copy(p);
  }
}
EXTRA_PROPS['core.medball'] = d => new MedBallProp(d.radius || 0.12);

export const data = [
  { id: 'side-plank', name: 'Side Plank', groups: ['Abs'], equipment: 'bodyweight', weight: null, reps: 30, sets: 3, timed: true,
    steps: ['Lie on your side with the elbow under the shoulder and feet stacked.', 'Lift the hips so the body forms a straight line from head to feet.', 'Hold, breathing steadily, then switch sides.'],
    tip: "Don't let the hips sag or drift back; keep them stacked and pushed forward." },
  { id: 'reverse-crunch', name: 'Reverse Crunch', groups: ['Abs'], equipment: 'bodyweight', weight: null, reps: 15, sets: 3, timed: false,
    steps: ['Lie on your back, arms by your sides, knees bent at 90 degrees above the hips.', 'Curl the knees toward the chest, peeling the hips off the floor.', 'Lower the hips slowly back to the start.'],
    tip: 'Lift with the abs, not momentum; avoid swinging the legs to get the hips up.' },
  { id: 'hollow-body-hold', name: 'Hollow Body Hold', groups: ['Abs'], equipment: 'bodyweight', weight: null, reps: 30, sets: 3, timed: true,
    steps: ['Lie on your back and press the lower back into the floor.', 'Lift shoulders, arms and straight legs a few inches off the floor.', 'Hold the banana shape while breathing steadily.'],
    tip: 'If your lower back arches off the floor, raise the legs higher or bend the knees.' },
  { id: 'bird-dog', name: 'Bird Dog', groups: ['Abs', 'Back', 'Glutes'], equipment: 'bodyweight', weight: null, reps: 12, sets: 3, timed: false,
    steps: ['Start on all fours, hands under shoulders and knees under hips.', 'Reach one arm forward and the opposite leg back until both are level.', 'Return with control and repeat on the other side.'],
    tip: 'Keep the hips square to the floor; avoid rotating or arching the lower back.' },
  { id: 'flutter-kicks', name: 'Flutter Kicks', groups: ['Abs'], equipment: 'bodyweight', weight: null, reps: 30, sets: 3, timed: false,
    steps: ['Lie on your back with hands under the hips and head slightly lifted.', 'Raise both straight legs a few inches off the floor.', 'Kick the legs up and down in small, quick alternating strokes.'],
    tip: 'Keep the lower back flat on the floor; smaller kicks are better than big sloppy ones.' },
  { id: 'v-up', name: 'V-Up', groups: ['Abs'], equipment: 'bodyweight', weight: null, reps: 12, sets: 3, timed: false,
    steps: ['Lie flat with arms overhead and legs straight.', 'Lift arms and legs together, reaching the hands toward the feet in a V.', 'Lower back to the floor with control.'],
    tip: "Don't crash back down; control the lowering so the abs stay working." },
  { id: 'box-jump', name: 'Box Jump', groups: ['Legs', 'Glutes', 'Calves', 'Cardio'], equipment: 'box', weight: null, reps: 10, sets: 3, timed: false,
    steps: ['Stand facing the box, feet hip-width apart.', 'Swing the arms and jump onto the box, landing softly in a squat.', 'Stand tall on top, then step back down one foot at a time.'],
    tip: 'Land with knees tracking over the toes; step down instead of jumping down.' },
  { id: 'skater-jump', name: 'Skater Jump', groups: ['Legs', 'Glutes', 'Cardio'], equipment: 'bodyweight', weight: null, reps: 20, sets: 3, timed: false,
    steps: ['Stand on one leg with a slight squat and lean forward.', 'Bound sideways, landing softly on the opposite foot.', 'Sweep the free leg behind you and swing the arms across; repeat.'],
    tip: 'Land softly with a bent knee and hold the landing briefly before the next bound.' },
  { id: 'plank-jack', name: 'Plank Jack', groups: ['Abs', 'Shoulders', 'Cardio'], equipment: 'bodyweight', weight: null, reps: 20, sets: 3, timed: false,
    steps: ['Start in a high plank with hands under the shoulders and feet together.', 'Jump the feet out wide, keeping the hips level.', 'Jump the feet back together and repeat.'],
    tip: 'Keep the hips from bouncing up and down; the upper body stays still.' },
  { id: 'medicine-ball-slam', name: 'Medicine Ball Slam', groups: ['Abs', 'Shoulders', 'Back', 'Cardio'], equipment: 'medicineBall', weight: 15, reps: 12, sets: 3, timed: false,
    steps: ['Stand with feet shoulder-width apart holding the ball at the chest.', 'Lift the ball overhead, rising onto the toes.', 'Slam it to the floor with force, hinge to pick it up and repeat.'],
    tip: 'Hinge at the hips and bend the knees to pick up the ball; keep the back flat.' },
];

export function motions(H) {
  const { Pose, Side, V, qx, qz, deg, Skeleton, cam, clip, rep, alternating, spec, P, proneLine, plantHands, qIdentityFor } = H;

  const pos = (p, j) => p.worldTransforms()[j].position;
  /** Scan x in [lo, hi] and return the x minimising f(x). */
  const argmin = (f, lo, hi, steps = 60) => {
    let best = lo, bv = Infinity;
    for (let i = 0; i <= steps; i++) { const x = lo + (hi - lo) * i / steps; const v = f(x); if (v < bv) { bv = v; best = x; } }
    const step = (hi - lo) / steps; lo = best - step; hi = best + step;
    for (let i = 0; i <= steps; i++) { const x = lo + (hi - lo) * i / steps; const v = f(x); if (v < bv) { bv = v; best = x; } }
    return best;
  };
  /** Translate the whole pose so that `joint` lands on `target` (only the given axes). */
  const anchor = (p, joint, target, axes = 'xyz') => {
    const cur = pos(p, joint);
    for (const a of axes) p.pelvisOffset[a] += target[a] - cur[a];
    return p;
  };
  const midShoulder = p => { const t = p.worldTransforms(); return t.shoulderL.position.clone().add(t.shoulderR.position).multiplyScalar(0.5); };

  // ---- Side plank on the right forearm, facing +X, feet at −Z, head toward +Z.
  function sidePlank(dip) {
    const shoulderTarget = 0.37, footY = 0.065, footZ = -0.92;
    const build = angle => {
      const a = deg(angle);
      const m = new THREE.Matrix4().makeBasis(V(0, Math.cos(a), -Math.sin(a)), V(0, Math.sin(a), Math.cos(a)), V(1, 0, 0));
      const p = Pose.standing(); p.set('pelvis', new THREE.Quaternion().setFromRotationMatrix(m));
      for (const s of Side.both) { p.set(s.hip, qz(-s.sign * 4)); p.set(s.knee, qx(0)); p.set(s.ankle, qx(-8)); }
      anchor(p, 'ankleR', V(0, footY, footZ));
      return p;
    };
    const angle = argmin(x => Math.abs(pos(build(x), 'shoulderR').y - shoulderTarget), 5, 40);
    const p = build(angle);
    const sh0 = pos(p, 'shoulderR').clone(), ankle0 = pos(p, 'ankleR').clone(), ankleL0 = pos(p, 'ankleL').clone();
    if (dip) {
      // hips sag toward the floor: pelvis drops, trunk and legs bend back so shoulder and feet stay put
      p.pelvisOffset.y -= dip;
      const r1 = argmin(r => { p.setTorso({ roll: r }); return pos(p, 'shoulderR').distanceTo(sh0); }, -25, 25);
      p.setTorso({ roll: r1 });
      const r2 = argmin(r => { p.set('hipR', qz(r + 4)); return pos(p, 'ankleR').distanceTo(ankle0); }, -25, 25);
      for (const s of Side.both) p.set(s.hip, qz(r2 - s.sign * 4));
      void ankleL0;
    }
    const sh = pos(p, 'shoulderR');
    p.reachArm(Side.R, V(sh0.x + 0.31, 0.035, sh0.z + 0.03), V(-0.5, -1, 0), 'down');
    const shL = pos(p, 'shoulderL');
    p.reachArm(Side.L, V(shL.x + 0.02, shL.y + 0.62, shL.z), V(0, 0, -1), 'forward');
    p.setHead({ pitch: 0 });
    void sh;
    return p;
  }

  // ---- lying on the back (head toward −Z)
  const armsAlongside = p => p.reachBoth(V(0.27, 0.035, 0.02), V(0.6, 0.6, -0.2), 'down');

  function reverseCrunch() {
    const flat = Pose.supine(); const base = midShoulder(flat);
    const pose = (tilt, hip, knee) => {
      const p = Pose.supine(); p.set('pelvis', qx(-90 - tilt)); p.setTorso({ pitch: tilt, split: 0.55 });
      for (const s of Side.both) { p.set(s.hip, qx(-hip)); p.set(s.knee, qx(knee)); p.set(s.ankle, qx(10)); }
      const cur = midShoulder(p); p.pelvisOffset.add(base.clone().sub(cur));
      armsAlongside(p);
      return p;
    };
    const table = pose(0, 90, 90), curled = pose(38, 112, 118);
    return spec(rep(2.6, table, curled, 0.42, 0.10), cam(70, 14, 4.2, 0.35), [P.mat()], ['abs', 'obliques']);
  }

  function hollow(level) {
    const p = Pose.supine(); p.set('pelvis', qx(-86));
    p.setTorso({ pitch: 22 + level * 3, split: 0.3 }); p.setHead({ pitch: 8 });
    for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.08, 0.30 + level * 0.04, 0.92), V(0, 1, 0));
    for (const s of Side.both) p.set(s.ankle, p.get(s.ankle).clone().multiply(qx(35)));
    const sh = midShoulder(p);
    p.reachBoth(V(0.13, sh.y + 0.26, sh.z - 0.58), V(1, 0.3, 0), 'inward');
    return p;
  }

  function flutter() {
    const base = Pose.supine(); base.setTorso({ pitch: 12, split: 0.3 }); base.setHead({ pitch: 14 });
    base.reachBoth(V(0.13, 0.03, 0.04), V(0.6, 0.6, -0.2), 'down');
    const kick = s => {
      const p = base.clone(); const o = Side.other(s);
      p.reachLeg(s, V(s.sign * 0.09, 0.44, 0.86), V(0, 1, 0));
      p.reachLeg(o, V(o.sign * 0.09, 0.20, 0.92), V(0, 1, 0));
      for (const side of Side.both) p.set(side.ankle, qx(40));
      return p;
    };
    return spec(clip(0.9, [[0, kick(Side.L)], [0.5, kick(Side.R)], [1, kick(Side.L)]]), cam(70, 14, 4.2, 0.35), [P.mat()], ['abs', 'quads']);
  }

  function vUp() {
    const flat = Pose.supine(); flat.set('pelvis', qx(-90));
    for (const s of Side.both) flat.set(s.ankle, qx(35));
    const sh = midShoulder(flat);
    flat.reachBoth(V(0.17, 0.05, sh.z - 0.62), V(1, 0.6, 0), 'up');
    const v = Pose.supine(); v.set('pelvis', qx(-90 + 32)); v.setTorso({ pitch: 22 }); v.setHead({ pitch: 5 });
    v.pelvisOffset = V(0, 0.15 - Skeleton.pelvisHeight, 0.06);
    const legDir = V(0, Math.sin(deg(58)), Math.cos(deg(58)));
    for (const s of Side.both) {
      const hip = pos(v, s.hip);
      v.reachLeg(s, hip.clone().add(legDir.clone().multiplyScalar(0.87)), V(0, 1, -0.3));
      v.set(s.ankle, qx(35));
    }
    const t = v.worldTransforms(); const ank = t.ankleL.position.clone().add(t.ankleR.position).multiplyScalar(0.5);
    const vsh = midShoulder(v); const dir = ank.clone().sub(vsh).normalize();
    const hand = vsh.clone().add(dir.multiplyScalar(0.66));
    v.reachBoth(V(0.12, hand.y, hand.z), V(1, -0.3, -0.3), 'inward');
    return spec(rep(2.4, flat, v, 0.42, 0.10), cam(75, 12, 4.4, 0.4), [P.mat()], ['abs', 'quads']);
  }

  // ---- all fours
  function birdDog() {
    const base = Pose.prone(); base.set('pelvis', qx(88));
    base.pelvisOffset = V(0, 0.55 - Skeleton.pelvisHeight, -0.05);
    for (const s of Side.both) { base.set(s.hip, qx(-88)); base.set(s.knee, qx(90)); base.set(s.ankle, qx(45)); }
    base.setTorso({ pitch: -18 }); base.setHead({ pitch: 10 });
    // put the knees on the floor
    const kz = pos(base, 'kneeL'); base.pelvisOffset.y += 0.06 - kz.y;
    const shz = pos(base, 'shoulderL').z;
    base.reachBoth(V(0.19, 0.03, shz + 0.07), V(0.3, 0, -1), 'down');
    const ext = s => {
      const p = base.clone(); const o = Side.other(s);
      const sh = pos(p, s.shoulder);
      p.reachArm(s, V(sh.x - s.sign * 0.02, sh.y + 0.03, sh.z + 0.64), V(s.sign * 0.3, -1, 0), 'inward');
      const hip = pos(p, o.hip);
      p.reachLeg(o, V(hip.x, hip.y + 0.03, hip.z - 0.87), V(0, -1, 0));
      p.set(o.ankle, qx(-35));
      return p;
    };
    return spec(alternating(4.4, base, ext(Side.L), ext(Side.R)), cam(65, 14, 4.2, 0.5), [P.mat()], ['abs', 'lowerBack', 'glutes', 'deltoids']);
  }

  // ---- plyometrics
  function boxJump() {
    const up = { x: 0, y: BOX.h, z: BOX.z - 0.02 };
    const lift = (p, dz, dy) => { p.pelvisOffset.z += dz; p.pelvisOffset.y += dy; return p; };
    const armsDown = p => p.hangArms(0.25, 0.04);
    const stand = Pose.squat(0.0, 0.14); armsDown(stand);
    const load = Pose.squat(0.55, 0.15, 34);
    load.reachBoth(V(0.24, load.shoulderY - 0.50, -0.34), V(0.3, -0.2, -1), 'inward');
    const air = Pose.standing(); air.pelvisOffset = V(0, 0.34, 0.30); air.setTorso({ pitch: 18 });
    for (const s of Side.both) air.reachLeg(s, V(s.sign * 0.14, BOX.h + 0.14, 0.36), V(s.sign * 0.2, 0.3, 1));
    for (const s of Side.both) air.set(s.ankle, qx(30));
    air.reachBoth(V(0.20, air.shoulderY + 0.12, 0.30 + 0.56), V(0.3, -1, 0), 'inward');
    const land = lift(Pose.squat(0.6, 0.15, 30, 0), up.z, up.y);
    for (const s of Side.both) land.reachLeg(s, V(s.sign * 0.15, BOX.h + Skeleton.ankleHeight, up.z), V(s.sign * 0.35, 0.05, 1));
    land.levelFeet(); land.reachBoth(V(0.20, land.shoulderY - 0.18, up.z + 0.42), V(0.4, -1, -0.2), 'inward');
    const top = Pose.squat(0.0, 0.14); armsDown(top); lift(top, up.z, up.y);
    // step back down with the right foot first
    const step = Pose.standing(); step.pelvisOffset = V(0, 0.94 - Skeleton.pelvisHeight, 0.26); step.setTorso({ pitch: 14 });
    step.reachLeg(Side.L, V(0.13, BOX.h + Skeleton.ankleHeight, BOX.z - 0.14), V(0.2, 0.1, 1)); step.set('ankleL', qIdentityFor(step, Side.L));
    step.reachLeg(Side.R, V(-0.14, Skeleton.ankleHeight + 0.02, 0.02), V(-0.1, 0.1, 1)); step.set('ankleR', qIdentityFor(step, Side.R).multiply(qx(15)));
    step.reachBoth(V(0.26, step.shoulderY - 0.56, 0.18), V(0.4, -0.3, -1), 'inward');
    const c = clip(3.6, [[0, stand], [0.10, stand], [0.20, load], [0.32, air], [0.42, land], [0.50, land], [0.62, top], [0.70, top], [0.84, step], [0.96, stand], [1, stand]]);
    return spec(c, cam(62, 8, 5.2, 0.95), [{ kind: 'core.box' }], ['quads', 'glutes', 'calves', 'hamstrings']);
  }

  function skater() {
    const land = s => {
      const o = Side.other(s); const p = Pose.standing();
      p.set('pelvis', qx(22)); p.pelvisOffset = V(s.sign * 0.42, -0.24, -0.06);
      p.setTorso({ pitch: 16, roll: -s.sign * 4 }); p.setHead({ pitch: -12 });
      p.reachLeg(s, V(s.sign * 0.50, Skeleton.ankleHeight, 0.10), V(s.sign * 0.25, 0.1, 1)); p.set(s.ankle, qIdentityFor(p, s));
      p.reachLeg(o, V(s.sign * 0.24, 0.20, -0.40), V(o.sign * 0.1, 0.1, 1)); p.set(o.ankle, qx(45));
      const t = p.worldTransforms(); const shS = t[s.shoulder].position, shO = t[o.shoulder].position;
      p.reachArm(o, V(shS.x + s.sign * 0.02, shO.y - 0.42, shO.z + 0.42), V(o.sign * 0.3, -0.6, -1), 'inward');
      p.reachArm(s, V(shS.x + s.sign * 0.14, shS.y - 0.52, shS.z - 0.30), V(s.sign * 0.3, -0.3, -1), 'inward');
      return p;
    };
    const air = Pose.standing(); air.set('pelvis', qx(12)); air.pelvisOffset = V(0, 0.02, -0.02); air.setTorso({ pitch: 10 });
    for (const s of Side.both) { air.reachLeg(s, V(s.sign * 0.14, 0.22, -0.06), V(0, 0.2, 1)); air.set(s.ankle, qx(30)); }
    air.hangArms(0.26, 0.06);
    const L = land(Side.L), R = land(Side.R);
    const c = clip(2.0, [[0, L], [0.16, L], [0.33, air], [0.5, R], [0.66, R], [0.83, air], [1, L]]);
    return spec(c, cam(10, 8, 4.8, 0.85), [], ['quads', 'glutes', 'calves']);
  }

  function plankJack() {
    const pose = (spread, bounce) => {
      const p = proneLine(22); p.pelvisOffset.y += bounce;
      for (const s of Side.both) p.set(s.hip, qz(s.sign * spread));
      plantHands(p, proneLine(22));
      return p;
    };
    const closed = pose(1.5, 0), open = pose(22, 0), air = pose(11, 0.035);
    return spec(clip(1.0, [[0, closed], [0.25, air], [0.5, open], [0.75, air], [1, closed]]), cam(160, 26, 4.4, 0.35), [P.mat()], ['abs', 'deltoids', 'obliques', 'glutes']);
  }

  function ballSlam() {
    const hold = (p, target, pole) => { for (const s of Side.both) p.reachArm(s, V(target.x + s.sign * 0.135, target.y, target.z), V(s.sign * pole.x, pole.y, pole.z), 'inward'); return p; };
    const chest = Pose.squat(0.05, 0.2); hold(chest, V(0, chest.shoulderY - 0.24, 0.32), V(1, -0.8, -0.4));
    const over = Pose.standing(); over.pelvisOffset = V(0, 0.05, 0);
    for (const s of Side.both) over.reachLeg(s, V(s.sign * 0.2, Skeleton.ankleHeight + 0.05, 0), V(s.sign * 0.2, 0, 1));
    over.levelFeet(); for (const s of Side.both) over.set(s.ankle, over.get(s.ankle).clone().multiply(qx(24)));
    over.setTorso({ pitch: -8 }); over.setHead({ pitch: -12 });
    hold(over, V(0, over.shoulderY + 0.52, -0.06), V(1, 0, -0.2));
    const slam = Pose.squat(0.55, 0.22, 0); slam.pelvisOffset = V(0, -0.34, -0.20);
    for (const s of Side.both) slam.reachLeg(s, V(s.sign * 0.22, Skeleton.ankleHeight, 0), V(s.sign * 0.4, 0.1, 1));
    slam.levelFeet(); slam.setTorso({ pitch: 72 }); slam.setHead({ pitch: -30 });
    hold(slam, V(0, 0.12, 0.44), V(1, 0.2, -0.3));
    const c = clip(2.4, [[0, chest], [0.10, chest], [0.32, over], [0.40, over], [0.52, slam], [0.68, slam], [0.90, chest], [1, chest]]);
    return spec(c, cam(55, 8, 4.4, 0.85), [{ kind: 'core.medball', radius: 0.12 }], ['abs', 'lats', 'deltoids', 'glutes'], 0.55);
  }

  return {
    'side-plank': () => {
      const hold = sidePlank(0), sag = sidePlank(0.06);
      return spec(clip(3.4, [[0, hold], [0.5, sag], [1, hold]]), cam(60, 14, 4.2, 0.45), [P.mat()], ['obliques', 'abs', 'deltoids', 'glutes']);
    },
    'reverse-crunch': reverseCrunch,
    'hollow-body-hold': () => spec(clip(3.0, [[0, hollow(0)], [0.5, hollow(1)], [1, hollow(0)]]), cam(70, 12, 4.2, 0.35), [P.mat()], ['abs', 'quads']),
    'bird-dog': birdDog,
    'flutter-kicks': flutter,
    'v-up': vUp,
    'box-jump': boxJump,
    'skater-jump': skater,
    'plank-jack': plankJack,
    'medicine-ball-slam': ballSlam,
  };
}
