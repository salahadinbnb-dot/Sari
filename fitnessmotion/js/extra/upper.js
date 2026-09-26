// Upper-body pack: bodyweight presses, barbell/dumbbell pressing, pulling, curls and triceps work.
import { EXTRA_PROPS, StaticProp, Furniture } from '../props.js?v=7';

// short flat bench moved back along −Z (feet-up work where the body must stay centred on the origin)
EXTRA_PROPS['upper.bench'] = d => { const n = Furniture.bench(0); n.position.z = d.z; return new StaticProp(n); };

export const data = [
  { id: 'pike-push-up', name: 'Pike Push-Up', groups: ['Shoulders', 'Triceps', 'Chest'], equipment: 'bodyweight', weight: null, reps: 10, sets: 3, timed: false,
    steps: ['Start in a push-up, then walk your feet in and lift your hips into an upside-down V.',
      'Bend your elbows to lower the top of your head toward the floor between your hands.',
      'Press back up to straight arms, keeping your hips high the whole time.'],
    tip: 'Keep the hips stacked high; letting them drop turns it into a regular push-up.' },
  { id: 'decline-push-up', name: 'Decline Push-Up', groups: ['Chest', 'Shoulders', 'Triceps'], equipment: 'bench', weight: null, reps: 12, sets: 3, timed: false,
    steps: ['Place your toes on a bench and your hands on the floor slightly wider than your shoulders.',
      'Brace your core and lower your chest toward the floor, elbows at about 45 degrees.',
      'Push the floor away until your arms are straight, keeping your body in one line.'],
    tip: 'Do not let your hips sag or pike up; squeeze glutes and abs to keep a straight line.' },
  { id: 'barbell-overhead-press', name: 'Barbell Overhead Press', groups: ['Shoulders', 'Triceps'], equipment: 'barbell', weight: 65, reps: 8, sets: 4, timed: false,
    steps: ['Stand tall with the bar resting on your upper chest, hands just outside your shoulders.',
      'Brace your core and glutes, then press the bar straight up past your face.',
      'Lock out overhead with the bar over mid-foot, then lower it back under control.'],
    tip: 'Avoid leaning far back to finish the rep; squeeze your glutes to protect the lower back.' },
  { id: 'dumbbell-pullover', name: 'Dumbbell Pullover', groups: ['Chest', 'Back', 'Triceps'], equipment: 'dumbbellBench', weight: 30, reps: 12, sets: 3, timed: false,
    steps: ['Lie on a flat bench holding one dumbbell with both hands above your chest.',
      'Keep a slight bend in your elbows and lower the weight in an arc behind your head.',
      'Feel the stretch in your chest and lats, then pull the dumbbell back over your chest.'],
    tip: 'Keep the elbow angle fixed; bending and straightening turns it into a triceps extension.' },
  { id: 'renegade-row', name: 'Renegade Row', groups: ['Back', 'Abs', 'Biceps'], equipment: 'dumbbells', weight: 25, reps: 10, sets: 3, timed: false,
    steps: ['Hold a high plank with your hands on two dumbbells and your feet wide.',
      'Row one dumbbell up to your ribs while pressing the other hard into the floor.',
      'Lower it with control and repeat on the other side, keeping your hips square.'],
    tip: 'Do not let your hips twist toward the rowing arm; widen your feet if you need more stability.' },
  { id: 'chin-up', name: 'Chin-Up', groups: ['Back', 'Biceps'], equipment: 'pullUpBar', weight: null, reps: 8, sets: 3, timed: false,
    steps: ['Hang from the bar with your palms facing you, hands about shoulder-width apart.',
      'Pull your chest toward the bar by driving your elbows down to your sides.',
      'Get your chin over the bar, then lower yourself all the way to straight arms.'],
    tip: 'Avoid half reps and kipping; start every rep from a full, controlled hang.' },
  { id: 'barbell-curl', name: 'Barbell Curl', groups: ['Biceps', 'Forearms'], equipment: 'barbell', weight: 50, reps: 10, sets: 3, timed: false,
    steps: ['Stand tall holding a barbell with an underhand grip, hands shoulder-width apart.',
      'Keep your elbows pinned to your sides and curl the bar up toward your shoulders.',
      'Squeeze your biceps at the top, then lower the bar slowly to straight arms.'],
    tip: 'Do not swing the bar up with your hips or let your elbows drift forward.' },
  { id: 'seated-concentration-curl', name: 'Seated Concentration Curl', groups: ['Biceps'], equipment: 'dumbbellBench', weight: 20, reps: 10, sets: 3, timed: false,
    steps: ['Sit on a bench with your legs wide and lean forward holding one dumbbell.',
      'Brace the back of your working elbow against the inside of the same thigh.',
      'Curl the dumbbell up toward your shoulder, squeeze, then lower it all the way.'],
    tip: 'Keep your upper arm still against the thigh; do not use your shoulder to lift the weight.' },
  { id: 'barbell-skull-crusher', name: 'Barbell Skull Crusher', groups: ['Triceps'], equipment: 'barbellBench', weight: 40, reps: 10, sets: 3, timed: false,
    steps: ['Lie on a flat bench holding a barbell with a narrow overhand grip above your chest.',
      'Keeping your upper arms still, bend your elbows to lower the bar toward your forehead.',
      'Extend your elbows to press the bar back up until your arms are straight.'],
    tip: 'Keep your elbows pointing up and in; letting them flare out shifts the load off the triceps.' },
  { id: 'bent-over-rear-delt-fly', name: 'Bent-Over Rear Delt Fly', groups: ['Shoulders', 'Back'], equipment: 'dumbbells', weight: 12, reps: 12, sets: 3, timed: false,
    steps: ['Hinge at the hips until your chest is nearly parallel to the floor, dumbbells hanging down.',
      'With a soft bend in your elbows, raise the dumbbells out to your sides.',
      'Squeeze your shoulder blades at the top, then lower the weights slowly.'],
    tip: 'Use light weights and do not shrug; lead with your elbows, not your hands.' },
];

export function motions(H) {
  const { Pose, Side, V, qx, qz, deg, Skeleton, cam, clip, rep, alternating, spec, P, proneLine, plantHands, benchLie, overChest, hinge } = H;

  /** Straight body pivoting on the toes at (pivotY, pivotZ); angle > 0 = head up, < 0 = head down. */
  function line(angle, pivotY, pivotZ) {
    const p = Pose.prone(); p.set('pelvis', qx(90 - angle));
    const reach = 0.92;
    p.pelvisOffset = V(0, pivotY + reach * Math.sin(deg(angle)) - Skeleton.pelvisHeight, pivotZ + reach * Math.cos(deg(angle)));
    for (const s of Side.both) { p.set(s.hip, qx(0)); p.set(s.knee, qx(0)); p.set(s.ankle, qx(-55)); }
    return p;
  }
  const unit = (x, y, z) => V(x, y, z).normalize();

  return {
    'pike-push-up': () => {
      const pose = (hipY, torso, handZ) => {
        const p = Pose.prone(); p.set('pelvis', qx(90 + torso));
        p.pelvisOffset = V(0, hipY - Skeleton.pelvisHeight, 0);
        for (const s of Side.both) p.reachLeg(s, V(s.sign * 0.13, 0.11, -0.46), V(0, -1, 0.4));
        for (const s of Side.both) p.set(s.ankle, qx(-60));
        p.setHead({ pitch: 10 });
        p.reachBoth(V(0.28, 0.07, handZ), V(0.6, 0.2, -0.6), 'down');
        return p;
      };
      const top = pose(0.90, 40, 0.52), bottom = pose(0.82, 72, 0.52);
      return spec(rep(2.8, top, bottom, 0.45, 0.06), cam(75, 10, 3.6, 0.5), [P.mat()], ['deltoids', 'triceps', 'chest']);
    },

    'decline-push-up': () => {
      const benchZ = -0.88;
      const top = line(4, 0.50, benchZ - 0.02), bottom = line(-11, 0.50, benchZ - 0.02);
      plantHands(top, top, 0.32); plantHands(bottom, top, 0.32, 0.03, V(0.7, 0.6, -0.3));
      bottom.setHead({ pitch: -6 });
      return spec(rep(2.6, top, bottom, 0.45, 0.06), cam(65, 12, 4.4, 0.45), [{ kind: 'upper.bench', z: benchZ }], ['chest', 'deltoids', 'triceps', 'abs']);
    },

    'barbell-overhead-press': () => {
      const base = Pose.standing(); const sy = base.shoulderY;
      for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.15, Skeleton.ankleHeight, 0), V(s.sign * 0.2, 0, 1));
      base.levelFeet();
      const rack = base.clone(), mid = base.clone(), top = base.clone();
      rack.reachBoth(V(0.26, sy + 0.02, 0.17), V(0.35, -1, 0.5), 'forward');
      mid.setHead({ pitch: -8 }); mid.pelvisOffset.z += 0.01;
      mid.reachBoth(V(0.27, sy + 0.30, 0.14), V(0.7, -1, 0.3), 'forward');
      top.reachBoth(V(0.26, sy + 0.62, 0.0), V(1, -0.2, -0.1), 'forward');
      const c = clip(3.0, [[0, rack], [0.2, mid], [0.42, top], [0.52, top], [0.74, mid], [0.94, rack], [1, rack]]);
      return spec(c, cam(35, 6, 4.4, 1.2), [P.barbell(1.5)], ['deltoids', 'triceps', 'traps']);
    },

    'dumbbell-pullover': () => {
      const top = benchLie(0), low = benchLie(0);
      const t = top.worldTransforms();
      const sh = t.shoulderL.position.clone().add(t.shoulderR.position).multiplyScalar(0.5);
      // one dumbbell cupped with both hands: grips nearly touching
      const hi = V(0, sh.y + 0.60, sh.z + 0.02), lo = V(0, sh.y + 0.02, sh.z - 0.58);
      for (const s of Side.both) {
        top.reachArm(s, hi.clone().add(V(s.sign * 0.05, 0, 0)), V(s.sign * 0.8, 0, -0.3), 'inward');
        low.reachArm(s, lo.clone().add(V(s.sign * 0.05, 0, 0)), V(s.sign * 0.8, 0.6, 0), 'inward');
      }
      return spec(rep(3.2, top, low, 0.48, 0.06), cam(70, 16, 4.4, 0.75), [P.dumbbell('L'), P.flatBench()], ['chest', 'lats', 'triceps']);
    },

    'renegade-row': () => {
      const base = proneLine(22, { pivotZ: -0.95 });
      for (const s of Side.both) base.set(s.hip, qz(s.sign * 9));
      const t = base.worldTransforms(); const shZ = t.shoulderL.position.z;
      base.reachBoth(V(0.27, 0.08, shZ), V(0.6, 0.6, -0.4), 'inward');
      const row = s => {
        const p = base.clone();
        p.setTorso({ yaw: s.sign * 6, split: 0.5 });
        const tt = p.worldTransforms(); const sh = tt[s.shoulder].position;
        p.reachArm(s, V(s.sign * 0.24, sh.y - 0.12, sh.z - 0.30), V(s.sign * 0.2, 1, -0.5), 'inward');
        p.reachArm(Side.other(s), V(-s.sign * 0.27, 0.08, shZ), V(-s.sign * 0.6, 0.6, -0.4), 'inward');
        return p;
      };
      return spec(alternating(3.6, base, row(Side.L), row(Side.R)), cam(55, 14, 4.4, 0.5), [P.dumbbells()], ['lats', 'rearDeltoids', 'biceps', 'abs', 'obliques']);
    },

    'chin-up': () => {
      const hang = Pose.standing(); hang.pelvisOffset = V(0, 2.28 - 0.07 - 0.62 - Skeleton.shoulderHeight + 0.02, -0.05);
      for (const s of Side.both) { hang.set(s.hip, qx(-10)); hang.set(s.knee, qx(40)); hang.set(s.ankle, qx(20)); }
      hang.reachBoth(V(0.22, 2.28, -0.05), V(0.5, 0.1, 0.4), 'backward');
      const top = hang.clone(); top.pelvisOffset.y += 0.46; top.pelvisOffset.z += 0.02; top.setTorso({ pitch: -10 }); top.setHead({ pitch: -12 });
      top.reachBoth(V(0.22, 2.28, -0.05), V(0.12, -0.5, 0.9), 'backward');
      return spec(rep(3.0, hang, top, 0.42, 0.10), cam(30, 4, 5.2, 1.55), [P.pullUpBar()], ['lats', 'biceps', 'rearDeltoids', 'forearms']);
    },

    'barbell-curl': () => {
      const base = Pose.standing(); const sy = base.shoulderY;
      for (const s of Side.both) base.reachLeg(s, V(s.sign * 0.14, Skeleton.ankleHeight, 0), V(s.sign * 0.2, 0, 1));
      base.levelFeet();
      const down = base.clone(), up = base.clone();
      down.reachBoth(V(0.22, sy - 0.60, 0.12), V(0.3, -0.5, -1), 'forward');
      up.reachBoth(V(0.22, sy - 0.14, 0.26), V(0.3, -0.7, -1), 'backward'); up.setTorso({ pitch: -2 });
      return spec(rep(3.0, down, up, 0.42, 0.10), cam(35, 6, 3.9, 0.98), [P.barbell(1.3)], ['biceps', 'forearms']);
    },

    'seated-concentration-curl': () => {
      const base = Pose.seated(0.45, 0.26);
      const t0 = base.worldTransforms(); const ankles = Side.both.map(sd => t0[sd.ankle].position.clone());
      base.set('pelvis', qx(20)); base.setTorso({ pitch: 35, roll: -8 }); base.setHead({ pitch: 22 });
      Side.both.forEach((sd, i) => base.reachLeg(sd, ankles[i], V(sd.sign * 0.5, 0.2, 1)));
      base.levelFeet();
      const t = base.worldTransforms();
      const S = t.shoulderR.position;
      // back of the working elbow rests against the inner right thigh, just behind the knee
      const E = V(-0.12, 0.60, 0.34);
      const reachFrom = dir => E.clone().add(dir.normalize().multiplyScalar(Skeleton.foreArm + Skeleton.handLength));
      const downH = reachFrom(V(0.08, -1, 0.10)), upH = reachFrom(V(0.25, 0.8, -0.45));
      const down = base.clone(), up = base.clone();
      down.reachArm(Side.R, downH, E.clone().sub(S.clone().add(downH).multiplyScalar(0.5)), 'forward');
      up.reachArm(Side.R, upH, E.clone().sub(S.clone().add(upH).multiplyScalar(0.5)), 'backward');
      // free hand braced on the left knee
      const kL = t.kneeL.position;
      for (const p of [down, up]) p.reachArm(Side.L, V(kL.x - 0.02, kL.y + 0.06, kL.z - 0.06), V(0.8, 0.2, -0.4), 'down');
      return spec(rep(2.8, down, up, 0.42, 0.10), cam(-40, 10, 3.4, 0.7), [P.dumbbell('R'), P.bench(0)], ['biceps']);
    },

    'barbell-skull-crusher': () => {
      const up = benchLie(0), down = benchLie(0);
      const t = up.worldTransforms();
      const w = 0.15;
      for (const s of Side.both) {
        const S = t[s.shoulder].position;
        const hi = V(s.sign * w, S.y + 0.62, S.z - 0.06);
        const E = S.clone().add(unit(0, 1, -0.12).multiplyScalar(Skeleton.upperArm)); E.x = s.sign * (w + 0.04);
        const lo = E.clone().add(unit(0, -0.9, -1).multiplyScalar(Skeleton.foreArm + Skeleton.handLength)); lo.x = s.sign * w;
        up.reachArm(s, hi, V(s.sign * 0.2, 0.3, 1), 'forward');
        down.reachArm(s, lo, V(s.sign * 0.15, 1, 0.3), 'forward');
      }
      return spec(rep(2.8, up, down, 0.45, 0.08), cam(70, 16, 4.2, 0.75), [P.barbell(1.2), P.flatBench()], ['triceps']);
    },

    'bent-over-rear-delt-fly': () => {
      const base = hinge(78, 0.12, 0.18);
      const t = base.worldTransforms();
      const down = base.clone(), up = base.clone();
      for (const s of Side.both) {
        const S = t[s.shoulder].position;
        down.reachArm(s, V(s.sign * 0.16, S.y - 0.58, S.z + 0.02), V(s.sign * 0.8, 0.2, -0.3), 'inward');
        up.reachArm(s, V(s.sign * 0.76, S.y - 0.04, S.z - 0.02), V(0, 1, -0.4), 'down');
      }
      return spec(rep(2.8, down, up, 0.42, 0.10), cam(20, 12, 4.2, 0.85), [P.dumbbells()], ['rearDeltoids', 'traps', 'deltoids']);
    },
  };
}
