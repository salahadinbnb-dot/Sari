// Muscle-region IDs painted into assets/mask.png (one byte per texel) and how they roll up into the
// highlightable groups the motion library talks about. Keep in sync with tools/body/make_mask.py and
// FitnessMotion/Motion/SkinnedFigure.swift.

export const MUSCLE_BIT = { traps: 1, deltoids: 2, rearDeltoids: 3, chest: 4, lats: 5, biceps: 6, triceps: 7, forearms: 8, abs: 9,
  obliques: 10, lowerBack: 11, glutes: 12, quads: 13, hamstrings: 14, calves: 15, tibialis: 16, neck: 17 };

// Region id → group bit (0 = skin / none, 20 = shorts, 21 = hair, 22 = eyes). Ids 1..17 are the plain
// groups themselves; ids 32+ are the sub-muscles drawn by the écorché mask and map back onto a group.
const LUT = new Array(64).fill(0);
for (let i = 1; i <= 17; i++) LUT[i] = i;
LUT[20] = 20; LUT[21] = 21; LUT[22] = 22;
const SUB = {
  32: 'chest', 33: 'chest',                  // pectoralis clavicular / sternal heads
  34: 'abs', 35: 'abs', 36: 'abs', 37: 'abs', // rectus abdominis segments
  38: 'obliques', 39: 'obliques',            // external oblique / serratus
  40: 'deltoids', 41: 'deltoids', 42: 'rearDeltoids', // anterior / lateral / posterior deltoid
  43: 'biceps', 44: 'biceps',                // long / short head + brachialis
  45: 'triceps', 46: 'triceps',              // lateral / long head
  47: 'forearms', 48: 'forearms',            // flexors / extensors
  49: 'traps', 50: 'traps',                  // upper / middle trapezius
  51: 'lats', 52: 'lats',                    // latissimus / teres
  53: 'lowerBack', 54: 'lowerBack',          // erector spinae l/r
  55: 'quads', 56: 'quads', 57: 'quads',     // rectus femoris / vastus lateralis / vastus medialis
  58: 'hamstrings', 59: 'hamstrings',        // biceps femoris / semitendinosus
  60: 'calves', 61: 'calves',                // gastrocnemius medial / lateral
  62: 'tibialis', 63: 'glutes',
};
for (const id in SUB) LUT[id] = MUSCLE_BIT[SUB[id]] || 0;
LUT[63] = 12;
export const GROUP_OF_ID = LUT;
