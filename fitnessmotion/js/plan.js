// Multi-week training plans: a goal-driven split, fixed exercise picks per day and week-by-week
// progression (sets, reps, load) with a deload week. Pure data — the Store owns persistence.

export const GOALS = {
  muscle: { name: 'Build Muscle', icon: '💪', blurb: 'Hypertrophy: moderate weight, 8–12 reps, steady volume increases.', reps: 10, sets: 3, load: 1, rest: 90 },
  strength: { name: 'Get Stronger', icon: '🏋️', blurb: 'Heavier compound lifts, 4–6 reps, longer rest.', reps: 5, sets: 4, load: 1.1, rest: 150 },
  fatloss: { name: 'Lose Fat', icon: '🔥', blurb: 'Higher reps, short rest and a conditioning finisher every day.', reps: 14, sets: 3, load: 0.8, rest: 45 },
  fitness: { name: 'Get Fit', icon: '⚡', blurb: 'Balanced strength and conditioning for everyday fitness.', reps: 12, sets: 3, load: 0.9, rest: 60 },
};
export const LEVELS = { Beginner: 0.75, Intermediate: 1, Advanced: 1.2 };
export const PLACES = {
  gym: { name: 'Gym', icon: '🏢', equipment: null },
  home: { name: 'Home + dumbbells', icon: '🏠', equipment: ['bodyweight', 'dumbbells', 'dumbbellBench', 'bench', 'band', 'kettlebell', 'box'] },
  bodyweight: { name: 'No equipment', icon: '🤸', equipment: ['bodyweight', 'bench', 'box'] },
};

// Six weeks: build, push, deload, peak. `sets`/`reps` are added to the goal baseline, `load` multiplies it.
export const WEEKS = [
  { name: 'Foundation', note: 'Learn the movements. Finish every set with 2–3 reps in the tank.', sets: 0, reps: 0, load: 1.0 },
  { name: 'Build', note: 'Same exercises, a little more weight. Log every set.', sets: 0, reps: 1, load: 1.05 },
  { name: 'Overload', note: 'Extra set on every exercise. This week should feel hard.', sets: 1, reps: 0, load: 1.08 },
  { name: 'Deload', note: 'Lighter week to recover. Move fast, keep form perfect.', sets: -1, reps: 0, load: 0.8 },
  { name: 'Peak', note: 'Heaviest weights of the plan. Rest fully between sets.', sets: 1, reps: -2, load: 1.12 },
  { name: 'Test', note: 'Beat your Week 2 numbers — then build your next plan.', sets: 0, reps: -1, load: 1.15 },
];

// Day templates: [muscle group, how many exercises]
const DAYS = {
  Push: [['Chest', 2], ['Shoulders', 2], ['Triceps', 2]],
  Pull: [['Back', 3], ['Biceps', 2], ['Forearms', 1]],
  Legs: [['Legs', 3], ['Glutes', 1], ['Calves', 1], ['Abs', 1]],
  Upper: [['Chest', 2], ['Back', 2], ['Shoulders', 1], ['Biceps', 1], ['Triceps', 1]],
  Lower: [['Legs', 2], ['Glutes', 2], ['Calves', 1], ['Abs', 1]],
  'Full Body': [['Legs', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Glutes', 1], ['Abs', 1]],
};
const SPLITS = {
  2: ['Full Body', 'Full Body'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'],
  5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};
export const splitFor = (days, goal) => (goal === 'fatloss' && days === 3 ? ['Full Body', 'Full Body', 'Full Body'] : SPLITS[days]);
export const DAY_GROUPS = name => DAYS[name].map(([g]) => g);

// small seeded PRNG so a plan is stable for its seed
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * @param opts {goal, days, level, place, seed}
 * @param catalog exercise definitions ({id, name, groups, equipment, weight, reps, timed})
 */
export function buildPlan(opts, catalog) {
  const goal = GOALS[opts.goal], level = LEVELS[opts.level] || 1, rand = rng(opts.seed || 1);
  const allowed = PLACES[opts.place]?.equipment;
  const pool = catalog.filter(d => !allowed || allowed.includes(d.equipment));
  const strengthy = opts.goal === 'strength';
  // compound, loaded moves first for strength; otherwise a light shuffle keeps plans varied
  const score = d => (d.groups.length > 1 ? 2 : 0) + (d.weight != null ? (strengthy ? 2 : 0.5) : 0) - (d.timed ? 3 : 0) + rand() * (strengthy ? 1 : 2.5);
  const split = splitFor(opts.days, opts.goal);
  const usedByType = {};
  const days = split.map((type, i) => {
    const used = usedByType[type] || (usedByType[type] = new Set());
    const picks = [];
    for (const [group, n] of DAYS[type]) {
      let opts2 = pool.filter(d => d.groups[0] === group && !d.groups.includes('Cardio') && !picks.includes(d));
      if (opts2.length < n) opts2 = opts2.concat(pool.filter(d => d.groups.includes(group) && !opts2.includes(d) && !picks.includes(d)));
      const ranked = opts2.map(d => [score(d) - (used.has(d.id) ? 5 : 0), d]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      for (const d of ranked.slice(0, n)) { picks.push(d); used.add(d.id); }
    }
    if (opts.goal === 'fatloss' || opts.goal === 'fitness') {
      const cardio = pool.filter(d => d.groups.includes('Cardio') && !picks.includes(d));
      if (cardio.length) picks.push(cardio[Math.floor(rand() * cardio.length)]);
    }
    const letter = split.filter((t, j) => t === type && j < i).length;
    const name = split.filter(t => t === type).length > 1 ? `${type} ${'ABC'[letter]}` : type;
    return { name, type, exercises: picks.map(d => d.id) };
  });
  const byId = Object.fromEntries(catalog.map(d => [d.id, d]));
  const weeks = WEEKS.map((w, wi) => ({
    name: w.name, note: w.note,
    days: days.map(day => ({
      name: day.name, type: day.type, done: false, sessionId: null,
      items: day.exercises.map(id => {
        const d = byId[id];
        if (d.timed) return { exerciseId: id, sets: Math.max(2, goal.sets + w.sets - 1), reps: Math.round(d.reps * (wi === 3 ? 0.8 : 1 + wi * 0.05)), weight: null, timed: true };
        const reps = Math.max(3, goal.reps + w.reps);
        const weight = d.weight == null ? null : Math.max(5, Math.round(d.weight * goal.load * w.load * level / 5) * 5);
        return { exerciseId: id, sets: Math.max(2, goal.sets + w.sets), reps: d.weight == null && opts.goal === 'strength' ? Math.max(8, reps + 4) : reps, weight, timed: false };
      }),
    })),
  }));
  return { id: 'plan-' + (opts.seed || 1).toString(36), createdAt: Date.now(), options: { ...opts }, rest: goal.rest, weeks, current: { week: 0, day: 0 } };
}

/** Rough minutes for a day: ~40 s of work per set plus the plan's rest. */
export const dayMinutes = (day, rest) => Math.round(day.items.reduce((a, it) => a + it.sets * (40 + rest), 0) / 60);
export const planProgress = plan => {
  const all = plan.weeks.flatMap(w => w.days); return { done: all.filter(d => d.done).length, total: all.length };
};
/** First unfinished day at or after the plan's cursor (wraps to earlier gaps), or null when complete. */
export function nextDay(plan) {
  const flat = plan.weeks.flatMap((w, wi) => w.days.map((d, di) => ({ wi, di, d })));
  const start = flat.findIndex(x => x.wi === plan.current.week && x.di === plan.current.day);
  const order = [...flat.slice(Math.max(start, 0)), ...flat.slice(0, Math.max(start, 0))];
  const hit = order.find(x => !x.d.done);
  return hit ? { week: hit.wi, day: hit.di } : null;
}
