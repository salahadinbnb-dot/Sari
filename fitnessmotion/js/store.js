// Exercise catalogue, settings, workout generation, sessions and persistence (localStorage).
// Port of Models/Exercise.swift + Models/Store.swift.
import { PACKS } from './extra/index.js?v=7';
import { buildPlan, nextDay } from './plan.js?v=7';

export const GROUPS = ['Back', 'Biceps', 'Chest', 'Triceps', 'Shoulders', 'Abs', 'Legs', 'Glutes', 'Calves', 'Forearms'];
export const GROUP_MUSCLES = {
  Back: ['lats', 'traps', 'rearDeltoids', 'lowerBack'], Biceps: ['biceps', 'forearms'], Chest: ['chest'], Triceps: ['triceps'],
  Shoulders: ['deltoids', 'rearDeltoids'], Abs: ['abs', 'obliques'], Legs: ['quads', 'hamstrings'], Glutes: ['glutes'],
  Calves: ['calves', 'tibialis'], Forearms: ['forearms'], Cardio: [],
};

const e = (id, name, groups, equipment, weight = null, reps = 10, sets = 4, timed = false) => ({ id, name, groups, equipment, weight, reps, sets, timed });
export const CATALOG = [
  e('ab-wheel-rollout', 'Ab Wheel Rollout', ['Abs'], 'abWheel', null, 10),
  e('air-bike', 'Air Bike', ['Abs'], 'bodyweight', null, 20),
  e('alternate-lying-floor-leg-raise', 'Alternate Lying Floor Leg Raise', ['Abs'], 'bodyweight', null, 16),
  e('alternating-high-band-chest-press', 'Alternating High Band Chest Press', ['Chest', 'Triceps'], 'band', null, 12),
  e('alternating-straight-leg-raise', 'Alternating Straight Leg Raise', ['Abs'], 'bodyweight', null, 16),
  e('ankle-dorsal-flexion', 'Ankle - Dorsal Flexion', ['Calves'], 'bodyweight', null, 10),
  e('ankle-plantar-flexion', 'Ankle - Plantar Flexion', ['Calves'], 'bodyweight', null, 10),
  e('arnold-press', 'Arnold Press', ['Shoulders', 'Triceps'], 'dumbbells', 25, 8),
  e('around-the-world-superman-hold', 'Around The World Superman Hold', ['Back', 'Glutes'], 'bodyweight', null, 8),
  e('assisted-dip', 'Assisted Dip', ['Triceps', 'Chest'], 'machine', 60, 10),
  e('assisted-pull-up', 'Assisted Pull Up', ['Back', 'Biceps'], 'machine', 60, 8),
  e('assisted-straight-leg-raise', 'Assisted Straight Leg Raise', ['Abs'], 'machine', null, 12),
  e('back-extension-machine', 'Back Extension Machine', ['Back', 'Glutes'], 'machine', 80, 12),
  e('band-crunch', 'Band Crunch', ['Abs'], 'band', null, 15),
  e('band-curl', 'Band Curl', ['Biceps'], 'band', null, 12),
  e('band-deadlift', 'Band Deadlift', ['Legs', 'Glutes', 'Back'], 'band', null, 12),
  e('band-face-pull', 'Band Face Pull', ['Shoulders', 'Back'], 'band', null, 15),
  e('band-high-curl', 'Band High Curl', ['Biceps'], 'band', null, 12),
  e('band-high-row', 'Band High Row', ['Back'], 'band', null, 12),
  e('barbell-split-squat', 'Barbell Split Squat', ['Legs', 'Glutes'], 'barbell', 65, 10),
  e('barbell-split-squat-on-bench', 'Barbell Split Squat On Bench', ['Legs', 'Glutes'], 'barbell', 65, 10),
  e('barbell-standing-concentration-curl', 'Barbell Standing Concentration Curl', ['Biceps'], 'barbell', 40, 10),
  e('barbell-standing-twist', 'Barbell Standing Twist', ['Abs'], 'barbell', 45, 16),
  e('barbell-sumo-deadlift', 'Barbell Sumo Deadlift', ['Legs', 'Glutes', 'Back'], 'barbell', 135, 8),
  e('battle-ropes', 'Battle Ropes', ['Shoulders', 'Cardio'], 'ropes', null, 30, 4, true),
  e('cable-row', 'Cable Row', ['Back', 'Biceps'], 'cable', 100, 8),
  e('cable-seated-crunch', 'Cable Seated Crunch', ['Abs'], 'cable', 60, 15),
  e('cable-seated-rear-lateral-raise', 'Cable Seated Rear Lateral Raise', ['Shoulders', 'Back'], 'cable', 20, 12),
  e('cable-shoulder-press', 'Cable Shoulder Press', ['Shoulders', 'Triceps'], 'cable', 50, 10),
  e('cable-shrug', 'Cable Shrug', ['Back'], 'cable', 80, 12),
  e('cable-side-bend', 'Cable Side Bend', ['Abs'], 'cable', 40, 12),
  e('cable-twist', 'Cable Twist', ['Abs'], 'cable', 40, 12),
  e('dumbbell-curl', 'Dumbbell Curl', ['Biceps'], 'dumbbells', 18, 10),
  e('dumbbell-high-shrug', 'Dumbbell High Shrug', ['Back', 'Shoulders'], 'dumbbells', 30, 8),
  e('dumbbell-reverse-curl', 'Dumbbell Reverse Curl', ['Forearms', 'Biceps'], 'dumbbells', 15, 12),
  e('dumbbell-romanian-deadlift', 'Dumbbell Romanian Deadlift', ['Legs', 'Glutes', 'Back'], 'dumbbells', 40, 10),
  e('dumbbell-row', 'Dumbbell Row', ['Back', 'Biceps'], 'dumbbells', 40, 10),
  e('dumbbell-seesaw-press', 'Dumbbell Seesaw Press', ['Shoulders', 'Triceps'], 'dumbbells', 25, 10),
  e('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', ['Shoulders', 'Triceps'], 'dumbbells', 25, 8),
  e('dumbbell-squat', 'Dumbbell Squat', ['Legs', 'Glutes'], 'dumbbells', 35, 10),
  e('hammer-curl', 'Hammer Curl', ['Biceps', 'Forearms'], 'dumbbells', 18, 10),
  e('inverted-row', 'Inverted Row', ['Back', 'Biceps'], 'bodyweight', null, 10),
  e('jump-lunge', 'Jump Lunge', ['Legs', 'Glutes', 'Cardio'], 'bodyweight', null, 16),
  e('jump-sprinter-lunge', 'Jump Sprinter Lunge', ['Legs', 'Glutes', 'Cardio'], 'bodyweight', null, 16),
  e('jump-squat', 'Jump Squat', ['Legs', 'Glutes', 'Cardio'], 'bodyweight', null, 12),
  e('kettlebell-angled-press', 'Kettlebell Angled Press', ['Shoulders', 'Triceps'], 'kettlebell', 25, 10),
  e('kettlebell-bent-over-row', 'Kettlebell Bent Over Row', ['Back', 'Biceps'], 'kettlebell', 35, 10),
  e('lat-pulldown', 'Lat Pulldown', ['Back', 'Biceps'], 'cable', 100, 8),
  e('outer-dumbbell-curl', 'Outer Dumbbell Curl', ['Biceps'], 'dumbbells', 15, 12),
  e('overhead-crunch-machine', 'Overhead Crunch Machine', ['Abs'], 'machine', 60, 15),
  e('overhead-rope-tricep-extension', 'Overhead Rope Tricep Extension', ['Triceps'], 'cable', 40, 12),
  e('parallel-bar-straight-leg-raise-hold', 'Parallel Bar Straight Leg Raise Hold', ['Abs'], 'parallelBars', null, 20, 4, true),
  e('parallel-bar-twisting-leg-raise', 'Parallel Bar Twisting Leg Raise', ['Abs'], 'parallelBars', null, 12),
  e('plank', 'Plank', ['Abs'], 'bodyweight', null, 45, 4, true),
  e('stability-ball-crunch', 'Stability Ball Crunch', ['Abs'], 'stabilityBall', null, 15),
  e('stability-ball-leg-curl', 'Stability Ball Leg Curl', ['Legs', 'Glutes'], 'stabilityBall', null, 12),
  e('stability-ball-rollout', 'Stability Ball Rollout', ['Abs'], 'stabilityBall', null, 10),
  e('stability-ball-sit-up', 'Stability Ball Sit Up', ['Abs'], 'stabilityBall', null, 15),
  e('starfish-crunch', 'Starfish Crunch', ['Abs'], 'bodyweight', null, 16),
  e('stepmill', 'Stepmill', ['Legs', 'Cardio'], 'machine', null, 60, 4, true),
  e('wide-grip-barbell-curl', 'Wide Grip Barbell Curl', ['Biceps'], 'barbell', 45, 10),
  e('wide-grip-barbell-upright-row', 'Wide Grip Barbell Upright Row', ['Shoulders', 'Back'], 'barbell', 45, 10),
  e('wipers', 'Wipers', ['Abs'], 'bodyweight', null, 16),
  e('zottman-curl', 'Zottman Curl', ['Biceps', 'Forearms'], 'dumbbells', 15, 10),
  e('zottman-preacher-curl', 'Zottman Preacher Curl', ['Biceps', 'Forearms'], 'dumbbells', 15, 10),
  // added exercises (flagged NEW in the picker)
  e('push-up', 'Push Up', ['Chest', 'Triceps'], 'bodyweight', null, 12),
  e('knee-push-up', 'Knee Push Up', ['Chest', 'Triceps'], 'bodyweight', null, 12),
  e('dumbbell-bench-press', 'Dumbbell Bench Press', ['Chest', 'Triceps'], 'dumbbellBench', 40, 10),
  e('incline-dumbbell-press', 'Incline Dumbbell Press', ['Chest', 'Shoulders'], 'dumbbellBench', 35, 10),
  e('dumbbell-fly', 'Dumbbell Fly', ['Chest'], 'dumbbellBench', 20, 12),
  e('barbell-bench-press', 'Barbell Bench Press', ['Chest', 'Triceps'], 'barbellBench', 115, 8),
  e('chest-dip', 'Chest Dip', ['Chest', 'Triceps'], 'dipBars', null, 10),
  e('bench-dip', 'Bench Dip', ['Triceps', 'Chest'], 'bench', null, 12),
  e('dumbbell-kickback', 'Dumbbell Kickback', ['Triceps'], 'dumbbells', 15, 12),
  e('cable-tricep-pushdown', 'Cable Tricep Pushdown', ['Triceps'], 'cable', 50, 12),
  e('lying-dumbbell-tricep-extension', 'Lying Dumbbell Tricep Extension', ['Triceps'], 'dumbbellBench', 20, 12),
  e('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', ['Shoulders'], 'dumbbells', 15, 12),
  e('dumbbell-front-raise', 'Dumbbell Front Raise', ['Shoulders'], 'dumbbells', 15, 12),
  e('pull-up', 'Pull Up', ['Back', 'Biceps'], 'pullUpBar', null, 8),
  e('barbell-deadlift', 'Barbell Deadlift', ['Back', 'Legs', 'Glutes'], 'barbell', 155, 6),
  e('barbell-bent-over-row', 'Barbell Bent Over Row', ['Back', 'Biceps'], 'barbell', 95, 10),
  e('bodyweight-squat', 'Bodyweight Squat', ['Legs', 'Glutes'], 'bodyweight', null, 15),
  e('dumbbell-reverse-lunge', 'Dumbbell Reverse Lunge', ['Legs', 'Glutes'], 'dumbbells', 25, 12),
  e('glute-bridge', 'Glute Bridge', ['Glutes', 'Legs'], 'bodyweight', null, 15),
  e('barbell-hip-thrust', 'Barbell Hip Thrust', ['Glutes', 'Legs'], 'barbellBench', 135, 10),
  e('standing-calf-raise', 'Standing Calf Raise', ['Calves'], 'dumbbells', 30, 15),
  e('mountain-climber', 'Mountain Climber', ['Abs', 'Cardio'], 'bodyweight', null, 30, 4, true),
  e('burpee', 'Burpee', ['Chest', 'Legs', 'Cardio'], 'bodyweight', null, 10),
  e('jumping-jacks', 'Jumping Jacks', ['Calves', 'Cardio'], 'bodyweight', null, 45, 3, true),
  e('crunch', 'Crunch', ['Abs'], 'bodyweight', null, 20),
  e('dead-bug', 'Dead Bug', ['Abs'], 'bodyweight', null, 12),
  e('russian-twist', 'Russian Twist', ['Abs'], 'bodyweight', null, 20),
  e('high-knees', 'High Knees', ['Legs', 'Cardio'], 'bodyweight', null, 30, 3, true),
];
for (const pack of PACKS) for (const d of pack.data) CATALOG.push(e(d.id, d.name, d.groups, d.equipment, d.weight ?? null, d.reps ?? 10, d.sets ?? 4, !!d.timed));
export const PACK_CUES = Object.fromEntries(PACKS.flatMap(pack => pack.data.map(d => [d.id, { steps: d.steps, tip: d.tip }])));
export const NEW_IDS = new Set(CATALOG.slice(CATALOG.findIndex(d => d.id === 'push-up')).map(d => d.id));
CATALOG.sort((a, b) => a.name.localeCompare(b.name));
export const BY_ID = Object.fromEntries(CATALOG.map(d => [d.id, d]));
export const REFERENCE_WORKOUT = ['lat-pulldown', 'dumbbell-high-shrug', 'cable-row', 'dumbbell-curl', 'hammer-curl', 'dumbbell-shoulder-press', 'arnold-press'];

export const ROUTINES = {
  'My Routine': [['Back', 'Biceps', 'Shoulders'], ['Chest', 'Triceps', 'Abs'], ['Legs', 'Glutes', 'Abs']],
  '3 Day Classic': [['Chest', 'Shoulders', 'Triceps'], ['Back', 'Biceps', 'Forearms'], ['Legs', 'Glutes', 'Calves']],
  '4 Day Classic': [['Chest', 'Triceps'], ['Back', 'Biceps'], ['Shoulders', 'Abs'], ['Legs', 'Glutes', 'Calves']],
  'Push, Pull, Legs': [['Chest', 'Shoulders', 'Triceps'], ['Back', 'Biceps', 'Forearms'], ['Legs', 'Glutes', 'Calves']],
  'Push, Pull': [['Chest', 'Shoulders', 'Triceps', 'Legs'], ['Back', 'Biceps', 'Glutes', 'Abs']],
  'Upper, Lower': [['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'], ['Legs', 'Glutes', 'Calves', 'Abs']],
  'Full Body': [['Chest', 'Back', 'Legs', 'Shoulders', 'Abs']],
  'Adaptive': [['Back', 'Biceps', 'Shoulders'], ['Chest', 'Triceps', 'Abs'], ['Legs', 'Glutes', 'Calves']],
};
export const OBJECTIVES = ['Muscle Growth', 'Strength', 'Endurance', 'Weight Loss'];
export const REP_RANGES = { Low: 0.7, Normal: 1, High: 1.4 };
export const EXPERIENCE = { Beginner: 0.75, Intermediate: 1, Advanced: 1.25 };

export const EQUIPMENT = [
  { id: 'bodyweight', name: 'Bodyweight', icon: '🏃', items: ['Bodyweight Only'], alwaysOn: true },
  { id: 'household', name: 'Household Items', icon: '🏠', items: ['Chair', 'Large Textbook', 'Stick', 'Towel'] },
  { id: 'freeweights', name: 'Free Weights', icon: '🏋️', items: ['Dumbbells', 'Barbell', 'Kettlebells', 'Weight Plates', 'EZ Bar'] },
  { id: 'benches', name: 'Benches', icon: '🛋️', items: ['Flat Bench', 'Incline (Adjustable) Bench', 'Decline Bench', 'Preacher Bench'] },
  { id: 'racks', name: 'Racks', icon: '🗄️', items: ['Dumbbell Rack', 'Squat Rack Or Power Rack'] },
  { id: 'bars', name: 'Bars', icon: '➖', items: ['Pull Up Bar', 'Dip Bars', 'Parallel Bars'] },
  { id: 'bands', name: 'Bands', icon: '⭕', items: ['Resistance Bands', 'Loop Bands', 'Mini Bands'] },
  { id: 'cables', name: 'Cable Machines', icon: '🔌', items: ['Cable Crossover', 'Lat Pulldown', 'Seated Row', 'Single Cable Station'] },
  { id: 'attachments', name: 'Cable Attachments', icon: '🔗', items: ['Straight Bar', 'Rope', 'V-Bar', 'Single Handle', 'Wide Bar'] },
  { id: 'machines', name: 'Weight Machines', icon: '⚙️', items: ['Chest Press Machine', 'Fly Machine', 'Leg Press', 'Leg Curl', 'Leg Extension', 'Assisted Pull Up / Dip', 'Back Extension Machine', 'Crunch Machine', 'Stepmill'] },
  { id: 'other', name: 'Other', icon: '📦', items: ['Stability Ball', 'Ab Wheel', 'Battle Ropes', 'Medicine Ball', 'Plyo Box'] },
];
const DEFAULT_EQUIPMENT = {
  bodyweight: ['Bodyweight Only'], household: ['Large Textbook'], freeweights: ['Dumbbells'], benches: ['Incline (Adjustable) Bench'],
  racks: [], bars: [], bands: ['Resistance Bands', 'Loop Bands', 'Mini Bands'], cables: ['Cable Crossover', 'Lat Pulldown', 'Seated Row', 'Single Cable Station'],
  attachments: ['Straight Bar', 'Rope', 'V-Bar', 'Single Handle', 'Wide Bar'], machines: ['Chest Press Machine', 'Fly Machine'], other: [],
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const KEY = 'fitnessmotion.state.v1';

export function summary(item) {
  const unit = item.timed ? 'sec' : 'reps';
  return item.weight != null ? `${item.weight} lbs x ${item.reps} ${unit} x ${item.sets} sets` : `${item.reps} ${unit} x ${item.sets} sets`;
}
export const isDone = item => item.completed.length >= item.sets;
export const restLabel = s => { const m = Math.floor(s / 60), r = s % 60; return m === 0 ? `${r}s` : (r === 0 ? `${m}min` : `${m}min ${r}s`); };

function defaultSettings() {
  return {
    routine: 'My Routine', durationMinutes: 60, objective: 'Muscle Growth', repRange: 'Normal', weeklyGoal: 5, experience: 'Intermediate',
    restMin: 75, restMax: 120, restSound: true, restEnabled: true, randomness: 50, circuit: false,
    equipment: JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT)),
    routineDays: ROUTINES['My Routine'].map(g => ({ id: uid(), groups: g.slice() })), currentDay: 0,
  };
}

export class Store {
  constructor() {
    this.listeners = new Set();
    this.workout = []; this.settings = defaultSettings(); this.history = []; this.saved = []; this.profile = { name: 'Salah Bro' }; this.session = null; this.plan = null;
    this.load();
    if (!this.workout.length) this.workout = REFERENCE_WORKOUT.map(id => this.make(BY_ID[id]));
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); this.save(); }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!s) return;
      Object.assign(this, { workout: s.workout || [], history: s.history || [], saved: s.saved || [], profile: s.profile || this.profile, session: s.session || null, plan: s.plan || null });
      this.settings = Object.assign(defaultSettings(), s.settings || {});
    } catch (e) { console.warn('state load failed', e); }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ workout: this.workout, settings: this.settings, history: this.history, saved: this.saved, profile: this.profile, session: this.session, plan: this.plan })); }
    catch (e) { console.warn('state save failed', e); }
  }

  make(def) { return { id: uid(), exerciseId: def.id, name: def.name, weight: def.weight, reps: def.reps, sets: def.sets, timed: def.timed, completed: [] }; }
  get todayGroups() { const d = this.settings.routineDays; return d.length ? d[Math.min(this.settings.currentDay, d.length - 1)].groups : ['Back', 'Biceps', 'Shoulders']; }
  get todayHighlight() { return [...new Set(this.todayGroups.flatMap(g => GROUP_MUSCLES[g] || []))]; }
  has(id) { return this.workout.some(w => w.exerciseId === id); }

  allows(def) {
    const eq = this.settings.equipment; const has = (c, i) => (eq[c] || []).includes(i); const any = c => (eq[c] || []).length > 0;
    switch (def.equipment) {
      case 'bodyweight': return true; case 'dumbbells': return has('freeweights', 'Dumbbells'); case 'barbell': return has('freeweights', 'Barbell');
      case 'kettlebell': return has('freeweights', 'Kettlebells'); case 'cable': return any('cables'); case 'machine': return any('machines');
      case 'band': return any('bands'); case 'bench': return any('benches'); case 'stabilityBall': return has('other', 'Stability Ball');
      case 'abWheel': return has('other', 'Ab Wheel'); case 'parallelBars': return has('bars', 'Parallel Bars') || has('bars', 'Dip Bars');
      case 'ropes': return has('other', 'Battle Ropes');
      case 'dumbbellBench': return has('freeweights', 'Dumbbells') && any('benches');
      case 'barbellBench': return has('freeweights', 'Barbell') && any('benches');
      case 'pullUpBar': return has('bars', 'Pull Up Bar');
      case 'box': return has('other', 'Plyo Box') || any('benches');
      case 'medicineBall': return has('other', 'Medicine Ball');
      case 'dipBars': return has('bars', 'Dip Bars') || has('bars', 'Parallel Bars');
      default: return true;
    }
  }
  applySettings(item) {
    if (item.weight != null) { const w = item.weight * EXPERIENCE[this.settings.experience]; item.weight = Math.max(5, Math.round(w / 5) * 5); }
    if (!item.timed) item.reps = Math.max(4, Math.round(item.reps * REP_RANGES[this.settings.repRange]));
    const last = this.lastPerformance(item.exerciseId); if (last && last.weight != null) item.weight = last.weight;
    return item;
  }
  lastPerformance(id) {
    for (const s of [...this.history].sort((a, b) => b.startedAt - a.startedAt)) {
      const ex = s.exercises.find(x => x.exerciseId === id); if (ex && ex.completed.length) return ex.completed[ex.completed.length - 1];
    }
    return null;
  }
  timesPerformed(id) { return this.history.filter(s => s.exercises.some(x => x.exerciseId === id && x.completed.length)).length; }

  addExercises(ids) { for (const id of ids) if (!this.has(id) && BY_ID[id]) this.workout.push(this.applySettings(this.make(BY_ID[id]))); this.emit(); }
  removeExercises(ids) { this.workout = this.workout.filter(w => !ids.includes(w.exerciseId)); this.emit(); }
  remove(item) { this.workout = this.workout.filter(w => w.id !== item.id); this.emit(); }
  move(i, j) { const w = this.workout; const [it] = w.splice(i, 1); w.splice(j, 0, it); this.emit(); }
  update(item) {
    const i = this.workout.findIndex(w => w.id === item.id); if (i >= 0) this.workout[i] = item;
    if (this.session) { const j = this.session.exercises.findIndex(w => w.id === item.id); if (j >= 0) this.session.exercises[j] = item; }
    this.emit();
  }
  /** Exercises that train the same primary muscle group, same equipment first. */
  alternatives(item) {
    const def = BY_ID[item.exerciseId]; if (!def) return [];
    return CATALOG.filter(d => d.id !== def.id && d.groups[0] === def.groups[0] && !this.has(d.id))
      .sort((a, b) => (a.equipment === def.equipment ? 0 : 1) - (b.equipment === def.equipment ? 0 : 1) || a.name.localeCompare(b.name));
  }
  replace(item, newId) {
    const def = BY_ID[newId]; if (!def) return;
    const fresh = this.applySettings(this.make(def));
    const i = this.workout.findIndex(w => w.id === item.id); if (i >= 0) this.workout[i] = fresh;
    if (this.session) { const j = this.session.exercises.findIndex(w => w.id === item.id); if (j >= 0) this.session.exercises[j] = { ...fresh }; }
    this.emit(); return fresh;
  }
  addAfter(item, newId) {
    const def = BY_ID[newId]; if (!def || this.has(newId)) return;
    const fresh = this.applySettings(this.make(def));
    const i = this.workout.findIndex(w => w.id === item.id); this.workout.splice(i < 0 ? this.workout.length : i + 1, 0, fresh);
    if (this.session) { const j = this.session.exercises.findIndex(w => w.id === item.id); this.session.exercises.splice(j < 0 ? this.session.exercises.length : j + 1, 0, { ...fresh }); }
    this.emit(); return fresh;
  }
  swap(item) {
    const def = BY_ID[item.exerciseId]; if (!def) return;
    const c = CATALOG.filter(d => d.id !== def.id && d.groups[0] === def.groups[0] && this.allows(d) && !this.has(d.id));
    if (!c.length) return;
    const pick = c[Math.floor(Math.random() * c.length)];
    const i = this.workout.findIndex(w => w.id === item.id); this.workout[i] = this.applySettings(this.make(pick)); this.emit();
  }
  generateWorkout() {
    const groups = this.todayGroups; const budget = Math.max(3, Math.min(9, Math.floor(this.settings.durationMinutes / 8)));
    let pool = CATALOG.filter(d => this.allows(d)); if (pool.length < 6) pool = CATALOG;
    const shuffle = this.settings.randomness / 100; const picked = [];
    for (const g of groups) {
      let opts = pool.filter(d => d.groups[0] === g && !picked.includes(d));
      if (!opts.length) opts = pool.filter(d => d.groups.includes(g) && !picked.includes(d));
      opts = opts.map(d => [this.timesPerformed(d.id) + Math.random() * shuffle * 4, d]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      for (const d of opts.slice(0, Math.max(1, Math.floor(budget / Math.max(groups.length, 1))))) picked.push(d);
    }
    const list = picked.length ? picked : REFERENCE_WORKOUT.map(id => BY_ID[id]);
    this.workout = list.slice(0, budget).map(d => this.applySettings(this.make(d))); this.emit();
  }
  setTodayGroups(groups) {
    const d = this.settings.routineDays;
    if (!d.length) this.settings.routineDays = [{ id: uid(), groups }]; else d[Math.min(this.settings.currentDay, d.length - 1)].groups = groups;
    this.generateWorkout();
  }
  applyRoutine(name) {
    if (name === this.settings.routine) return;
    this.settings.routine = name; this.settings.routineDays = ROUTINES[name].map(g => ({ id: uid(), groups: g.slice() })); this.settings.currentDay = 0;
    this.generateWorkout();
  }
  addDay() { const d = { id: uid(), groups: ['Chest', 'Back'] }; this.settings.routineDays.push(d); this.emit(); return d; }
  resetAlgorithm() { this.history = []; this.workout = REFERENCE_WORKOUT.map(id => this.make(BY_ID[id])); this.emit(); }

  saveCurrent(name) { this.saved.unshift({ id: uid(), name, createdAt: Date.now(), exercises: this.workout.map(w => ({ ...w, completed: [] })) }); this.emit(); }
  loadSaved(s) { this.workout = s.exercises.map(w => ({ ...w, id: uid(), completed: [] })); this.emit(); }
  deleteSaved(s) { this.saved = this.saved.filter(x => x.id !== s.id); this.emit(); }

  startSession() {
    this.workout = this.workout.map(w => ({ ...w, completed: [] }));
    this.session = { id: uid(), startedAt: Date.now(), endedAt: null, exercises: this.workout.map(w => ({ ...w })), title: this.todayGroups.join(', ') };
    this.emit();
  }
  logSet(item) {
    const s = this.session; if (!s) return false;
    const i = s.exercises.findIndex(x => x.id === item.id); if (i < 0) return false;
    const ex = s.exercises[i]; if (ex.completed.length >= ex.sets) return true;
    ex.completed.push({ reps: ex.reps, weight: ex.weight, date: Date.now() });
    const j = this.workout.findIndex(x => x.id === item.id); if (j >= 0) this.workout[j] = ex;
    this.emit(); return isDone(ex);
  }
  undoSet(item) {
    const s = this.session; if (!s) return; const ex = s.exercises.find(x => x.id === item.id); if (!ex || !ex.completed.length) return;
    ex.completed.pop(); const j = this.workout.findIndex(x => x.id === item.id); if (j >= 0) this.workout[j] = ex; this.emit();
  }
  sessionAdd(ids) { this.addExercises(ids); if (!this.session) return; for (const w of this.workout) if (!this.session.exercises.some(x => x.exerciseId === w.exerciseId)) this.session.exercises.push({ ...w }); this.emit(); }
  sessionRemove(ids) { this.removeExercises(ids); if (this.session) { this.session.exercises = this.session.exercises.filter(x => !ids.includes(x.exerciseId)); this.emit(); } }
  // ---- training plan
  createPlan(opts) { this.plan = buildPlan({ ...opts, seed: Date.now() % 1e9 }, CATALOG); this.emit(); return this.plan; }
  endPlan() { this.plan = null; this.emit(); }
  get nextPlanDay() { return this.plan ? nextDay(this.plan) : null; }
  planDay(ref) { return this.plan && ref ? this.plan.weeks[ref.week].days[ref.day] : null; }
  /** Load a plan day as the current workout and start the session. */
  startPlanDay(ref) {
    const day = this.planDay(ref); if (!day) return;
    this.workout = day.items.filter(it => BY_ID[it.exerciseId]).map(it => {
      const w = this.make(BY_ID[it.exerciseId]); w.sets = it.sets; w.reps = it.reps; w.timed = it.timed;
      const last = this.lastPerformance(it.exerciseId);
      w.weight = it.weight == null ? null : Math.max(it.weight, last && last.weight != null && ref.week > 0 ? last.weight : 0);
      return w;
    });
    this.session = null; this.startSession();
    this.session.planRef = { ...ref }; this.session.title = `Week ${ref.week + 1} · ${day.name}`;
    this.emit();
  }
  finishSession() {
    const s = this.session; if (!s) return;
    s.endedAt = Date.now();
    if (this.totalSets(s) > 0) this.history.unshift(s);
    this.session = null;
    const day = this.planDay(s.planRef);
    if (day && this.totalSets(s) > 0) {
      day.done = true; day.sessionId = s.id;
      const nx = nextDay(this.plan); if (nx) this.plan.current = nx;
      this.emit(); return;
    }
    const n = Math.max(this.settings.routineDays.length, 1); this.settings.currentDay = (this.settings.currentDay + 1) % n;
    this.generateWorkout();
  }
  discardSession() { this.session = null; this.workout = this.workout.map(w => ({ ...w, completed: [] })); this.emit(); }

  totalSets(s) { return s.exercises.reduce((a, x) => a + x.completed.length, 0); }
  volume(s) { return s.exercises.reduce((a, x) => a + x.completed.reduce((b, c) => b + (c.weight || 0) * c.reps, 0), 0); }
  /** Sets logged per muscle group since a timestamp (each set counts for every group the exercise trains). */
  setsByGroup(sinceMs) {
    const counts = {}; let total = 0;
    for (const s of this.history) {
      if (s.startedAt < sinceMs) continue;
      for (const ex of s.exercises) {
        const def = BY_ID[ex.exerciseId]; const n = ex.completed.length; if (!def || !n) continue;
        total += n; for (const g of def.groups) counts[g] = (counts[g] || 0) + n;
      }
    }
    return { counts, total };
  }
  /** Volume (weight × reps) buckets for the Strength Progress chart, plus the previous period for the progress %. */
  series(mode) {
    const day = 86400000; const now = new Date(); now.setHours(23, 59, 59, 999);
    let buckets = [], labels = [], prevStart, curStart;
    if (mode === 'week') {
      for (let i = 6; i >= 0; i--) { const d = new Date(now.getTime() - i * day); buckets.push([new Date(d).setHours(0, 0, 0, 0), new Date(d).setHours(23, 59, 59, 999)]); labels.push(d.toLocaleDateString(undefined, { weekday: 'narrow' })); }
      curStart = buckets[0][0]; prevStart = curStart - 7 * day;
    } else if (mode === 'month') {
      for (let i = 3; i >= 0; i--) { const end = now.getTime() - i * 7 * day; buckets.push([end - 7 * day + 1, end]); labels.push('W' + (4 - i)); }
      curStart = buckets[0][0]; prevStart = curStart - 28 * day;
    } else {
      for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999); buckets.push([d.getTime(), e.getTime()]); labels.push(d.toLocaleDateString(undefined, { month: 'narrow' })); }
      curStart = buckets[0][0]; prevStart = new Date(now.getFullYear() - 1, now.getMonth() - 11, 1).getTime();
    }
    const values = buckets.map(([a, b]) => this.history.filter(s => s.startedAt >= a && s.startedAt <= b).reduce((sum, s) => sum + this.volume(s), 0));
    const cur = this.history.filter(s => s.startedAt >= curStart);
    const prev = this.history.filter(s => s.startedAt >= prevStart && s.startedAt < curStart);
    const curTotal = cur.reduce((a, s) => a + this.volume(s), 0), prevTotal = prev.reduce((a, s) => a + this.volume(s), 0);
    const average = cur.length ? curTotal / cur.length : 0;
    const progress = prevTotal > 0 ? (curTotal - prevTotal) / prevTotal * 100 : (curTotal > 0 ? 100 : 0);
    return { labels, values, average, progress, hasData: cur.length > 0 };
  }
  get stats() {
    const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const days = new Set(this.history.map(s => new Date(s.startedAt).toDateString()));
    let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    return {
      workouts: this.history.length, sets: this.history.reduce((a, s) => a + this.totalSets(s), 0),
      volume: this.history.reduce((a, s) => a + this.volume(s), 0), thisWeek: this.history.filter(s => s.startedAt >= weekStart.getTime()).length, streak, days,
    };
  }
}
