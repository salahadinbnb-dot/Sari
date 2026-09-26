// FitnessMotion web app: screens and interactions (three tabs: Profile · Workouts · Planning).
import { Store, CATALOG, BY_ID, GROUPS, GROUP_MUSCLES, ROUTINES, OBJECTIVES, REP_RANGES, EXPERIENCE, EQUIPMENT, NEW_IDS, summary, isDone, restLabel } from './store.js?v=7';
import { CUES } from './cues.js?v=7';
import { loadAssets, LiveView, ThumbnailRenderer } from './scene.js?v=7';
import { anatomySpec } from './library.js?v=7';

const $ = (sel, el = document) => el.querySelector(sel);
// Pre-warmed WebGL viewers (parsing the body once per viewer), re-parented into whichever screen needs them.
const livePool = {};
async function acquireLive(kind) {
  if (!livePool[kind]) {
    const canvas = document.createElement('canvas'); canvas.className = 'live';
    livePool[kind] = await LiveView.create(canvas, assets);
  }
  return livePool[kind];
}
function warmLive() { acquireLive('session').catch(() => {}); acquireLive('preview').catch(() => {}); }
function mountLive(live, host) { host.appendChild(live.canvas); live._resize(); live.start(); }
function parkLive(live) { live.stop(); live.canvas.remove(); }
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = new Store();
let thumbs = null, assets = null;
const app = $('#app');
const ICONS = {
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  workouts: '<svg viewBox="0 0 24 24"><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/></svg>',
  planning: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="15" r=".8"/><circle cx="12" cy="15" r=".8"/><circle cx="16" cy="15" r=".8"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.7l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.7L4.6 11a7.6 7.6 0 0 0-.1 1 7.6 7.6 0 0 0 .1 1l-2.1 1.6a.5.5 0 0 0-.1.7l2 3.4c.1.2.4.3.6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.3 0 .5-.2.5-.4l.4-2.7a7.3 7.3 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.7L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
};
const GROUP_ORDER = ['Back', 'Biceps', 'Chest', 'Triceps', 'Legs', 'Glutes', 'Shoulders', 'Abs', 'Calves', 'Forearms'];

// ---------- shell
let tab = 'workouts';
const screenEl = h('<div class="screen"><div id="page" class="scroll" style="display:flex;flex-direction:column"></div><div class="tabbar"></div></div>');
app.appendChild(screenEl);
const page = $('#page', screenEl);
const tabbar = $('.tabbar', screenEl);
function renderTabbar() {
  tabbar.innerHTML = '';
  for (const [id, label] of [['profile', 'Profile'], ['workouts', 'Workouts'], ['planning', 'Planning']]) {
    const b = h(`<button class="${tab === id ? 'active' : ''}">${ICONS[id]}<span>${label}</span></button>`);
    b.onclick = () => { tab = id; render(); };
    tabbar.appendChild(b);
  }
}
function render() {
  renderTabbar();
  page.innerHTML = ''; page.scrollTop = 0;
  page.style.cssText = 'display:flex;flex-direction:column';
  page.classList.add('scroll');
  if (tab === 'workouts') renderHome(); else if (tab === 'planning') renderPlanning(); else renderProfile();
}
store.subscribe(() => { if (!document.querySelector('.modal')) render(); });

const header = ({ gear = true, search = false } = {}) => h(`<div class="header">
  ${search ? `<button class="hbtn left" aria-label="Search exercises">${ICONS.search}</button>` : ''}
  <div class="wordmark"><span class="logo"><i class="a"></i><i class="b"></i><i class="c"></i></span><span>Fitness<span class="m">Motion</span></span></div>
  ${gear ? `<button class="hbtn gear" aria-label="Settings">${ICONS.gear}</button>` : ''}</div>`);
function thumbInto(el, id, size) { thumbs.exercise(id, size).then(url => { const img = new Image(); img.src = url; img.alt = ''; el.innerHTML = ''; el.appendChild(img); }); }

// ---------- home
function renderHome() {
  const hd = header({ gear: true, search: true });
  $('.gear', hd).onclick = () => openSettings();
  $('.left', hd).onclick = () => openAddExercise(false, null, { focusSearch: true });
  page.appendChild(hd);
  const wrap = h('<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"></div>');
  const sc = h('<div class="scroll"></div>'); wrap.appendChild(sc); page.appendChild(wrap);
  page.classList.remove('scroll'); page.style.overflow = 'hidden';
  const hero = h('<div class="hero"><img alt="Front view, target muscles in blue"><img alt="Back view, target muscles in blue"></div>');
  const hl = store.todayHighlight;
  thumbs.anatomy(anatomySpec(hl, false), 170, 340).then(u => hero.children[0].src = u);
  thumbs.anatomy(anatomySpec(hl, true), 170, 340).then(u => hero.children[1].src = u);
  sc.appendChild(hero);
  const row = h('<div class="row2"><button class="pillbtn">🏋️ Equipment</button><button class="pillbtn">＋ Muscle Groups</button></div>');
  row.children[0].onclick = () => openEquipment(); row.children[1].onclick = () => openMuscleGroups();
  sc.appendChild(row);
  sc.appendChild(h(`<h2 class="count">${store.workout.length} Exercises</h2>`));
  store.workout.forEach((item, i) => {
    const r = h(`<div class="ex-row tappable"><div class="thumb"></div><div class="t"><div class="name">${esc(item.name)}</div><div class="sum">${summary(item)}</div></div><button class="more" aria-label="More">···</button></div>`);
    thumbInto($('.thumb', r), item.exerciseId, 168);
    r.onclick = ev => { if (ev.target.closest('.more')) return; if (!store.session) store.startSession(); openSession({ selectId: item.id }); };
    $('.more', r).onclick = ev => { ev.stopPropagation(); showMenu(ev.currentTarget, [
      ['Edit sets, reps & weight', () => openExerciseSheet(item)],
      ['View alternatives', () => openAlternatives(item)],
      i > 0 ? ['Move up', () => store.move(i, i - 1)] : null,
      i < store.workout.length - 1 ? ['Move down', () => store.move(i, i + 1)] : null,
      ['Remove', () => store.remove(item), 'red'],
    ].filter(Boolean)); };
    sc.appendChild(r);
  });
  const add = h('<button class="linkrow"><span class="plus">+</span>Add Exercise</button>'); add.onclick = () => openAddExercise(false); sc.appendChild(add);
  const save = h(`<div class="center"><button>⤓ Save Workout</button>${store.saved.length ? `<button style="color:var(--text2);font-size:17px">Saved (${store.saved.length})</button>` : ''}</div>`);
  save.children[0].onclick = () => textSheet({ title: 'Save Workout', subtitle: "Save today's exercises so you can load them again later.", value: store.todayGroups.join(', '), action: 'Save',
    onSubmit: name => { store.saveCurrent(name || store.todayGroups.join(', ')); toast('Workout saved'); } });
  if (save.children[1]) save.children[1].onclick = () => openSaved();
  sc.appendChild(save);
  sc.appendChild(h('<div class="section">Stay Fit</div>'));
  const card = h('<button class="card" style="text-align:left;display:block;width:calc(100% - 32px)"><h3>Home Workouts</h3><p>Stay fit from the comfort of your home! These workouts are quick, fun and require no equipment.</p></button>');
  card.onclick = () => openHomeWorkouts(); sc.appendChild(card);
  sc.appendChild(h('<div class="spacer"></div>'));
  const sticky = h(`<div class="sticky"><button class="primary">▶ ${store.session ? 'Resume Workout' : 'Start Workout'}</button></div>`);
  $('.primary', sticky).onclick = () => { if (!store.session) store.startSession(); openSession(); };
  wrap.appendChild(sticky);
}

function showMenu(anchor, items) {
  const r = anchor.getBoundingClientRect();
  const m = h('<div class="menu"></div>');
  for (const [label, fn, cls] of items) { const b = h(`<button class="${cls || ''}">${label}</button>`); b.onclick = () => { close(); fn(); }; m.appendChild(b); }
  const ov = h('<div class="overlay" style="background:rgba(0,0,0,.35)"></div>');
  const close = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) close(); };
  ov.appendChild(m); app.appendChild(ov);
  m.style.top = Math.min(r.bottom + 4, window.innerHeight - m.offsetHeight - 20) + 'px';
  m.style.right = (window.innerWidth - r.right + 4) + 'px';
}
function toast(text) { const t = h(`<div class="toast">${esc(text)}</div>`); app.appendChild(t); setTimeout(() => t.remove(), 1600); }

// ---------- bottom sheets
function bottomSheet(inner, { onClose } = {}) {
  const ov = h('<div class="overlay"></div>'); const sh = h('<div class="bsheet"><div class="handle"></div></div>');
  sh.appendChild(inner); ov.appendChild(sh); app.appendChild(ov);
  const close = () => { ov.remove(); onClose && onClose(); };
  ov.onclick = e => { if (e.target === ov) close(); };
  return close;
}
function optionSheet({ icon, title, subtitle, options, selected, onSelect }) {
  const inner = h(`<div style="display:flex;flex-direction:column;min-height:0"><div class="icon">${icon}</div><h3>${title}</h3><p>${subtitle}</p><div class="opts"></div></div>`);
  const close = bottomSheet(inner);
  for (const [label, value] of options) {
    const b = h(`<button class="${value === selected ? 'sel' : ''}">${label}</button>`);
    b.onclick = () => { close(); onSelect(value); }; $('.opts', inner).appendChild(b);
  }
}
function actionSheet({ icon, title, subtitle, action, perform }) {
  const inner = h(`<div><div class="icon">${icon}</div><h3>${title}</h3><p>${subtitle}</p><div class="opts" style="margin-top:40px"><button>${action}</button></div></div>`);
  const close = bottomSheet(inner); $('button', inner).onclick = () => { close(); perform(); };
}
function textSheet({ title, subtitle, value = '', action = 'Save', onSubmit }) {
  const inner = h(`<div><h3 style="margin-top:24px">${esc(title)}</h3><p>${esc(subtitle || '')}</p><div style="padding:22px 20px 0"><input class="field" type="text" autocomplete="off"></div><div class="foot" style="padding-top:18px"><button class="primary">${esc(action)}</button></div></div>`);
  const input = $('input', inner); input.value = value;
  const close = bottomSheet(inner);
  const submit = () => { const v = input.value.trim(); close(); onSubmit(v); };
  $('.primary', inner).onclick = submit;
  input.onkeydown = e => { if (e.key === 'Enter') submit(); };
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

// ---------- muscle groups (the reference's full-screen checklist)
function openMuscleGroups() {
  const sel = new Set(store.todayGroups);
  const m = h(`<div class="modal mg"><button class="x" aria-label="Close">✕</button><h2>Which muscle groups would you like to target?</h2><div class="scroll list"></div><div class="sticky"><button class="primary">DONE</button></div></div>`);
  const list = $('.list', m);
  const draw = () => {
    list.innerHTML = '';
    for (const g of GROUP_ORDER) {
      const on = sel.has(g);
      const r = h(`<button class="mg-row ${on ? 'on' : ''}"><span>${g}</span><span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span></button>`);
      r.onclick = () => { on ? sel.delete(g) : sel.add(g); draw(); };
      list.appendChild(r);
    }
    list.appendChild(h('<div class="spacer"></div>'));
  };
  draw(); app.appendChild(m);
  $('.x', m).onclick = () => m.remove();
  $('.primary', m).onclick = () => { const ordered = GROUP_ORDER.filter(g => sel.has(g)); if (ordered.length) store.setTodayGroups(ordered); m.remove(); render(); };
}

// ---------- exercise sheet (the reference's wheel pickers + View Alternatives / Remove / Save)
function wheel(label, values, current, format = v => String(v)) {
  const col = h(`<div class="wheel" role="listbox" aria-label="${esc(label)}"><div class="pad"></div>${values.map(v => `<div class="opt"><b>${format(v)}</b><span>${esc(label)}</span></div>`).join('')}<div class="pad"></div></div>`);
  let idx = Math.max(0, values.indexOf(current)); if (idx < 0) idx = 0;
  const ITEM = 60;
  const update = () => { const i = Math.round(col.scrollTop / ITEM); idx = Math.max(0, Math.min(values.length - 1, i)); [...col.querySelectorAll('.opt')].forEach((o, k) => o.classList.toggle('sel', k === idx)); };
  col.addEventListener('scroll', update, { passive: true });
  col.value = () => values[idx];
  col.init = () => { col.scrollTop = idx * ITEM; update(); };
  return col;
}
function openExerciseSheet(item, { onSaved } = {}) {
  const it = { ...item };
  const timed = it.timed;
  const inner = h(`<div class="xsheet"><h3>${esc(it.name)}</h3><div class="wheels"></div><div class="opts"><button class="alt">View Alternatives</button><button class="rm red">Remove</button><button class="save">Save</button></div></div>`);
  const wheels = $('.wheels', inner);
  const wSets = wheel('SETS', Array.from({ length: 10 }, (_, i) => i + 1), it.sets);
  const wReps = timed ? wheel('SEC', Array.from({ length: 36 }, (_, i) => (i + 1) * 5), it.reps) : wheel('REPS', Array.from({ length: 30 }, (_, i) => i + 1), it.reps);
  wheels.appendChild(wSets); wheels.appendChild(wReps);
  let wLbs = null;
  if (it.weight != null) { wLbs = wheel('LBS', Array.from({ length: 401 }, (_, i) => i), it.weight); wheels.appendChild(wLbs); }
  const close = bottomSheet(inner);
  requestAnimationFrame(() => { wSets.init(); wReps.init(); wLbs && wLbs.init(); });
  $('.alt', inner).onclick = () => { close(); openAlternatives(item, { onDone: onSaved }); };
  $('.rm', inner).onclick = () => { close(); store.remove(item); onSaved && onSaved(); };
  $('.save', inner).onclick = () => {
    it.sets = wSets.value(); it.reps = wReps.value(); if (wLbs) it.weight = wLbs.value();
    store.update(it); close(); onSaved && onSaved();
  };
}
async function openAlternatives(item, { onDone } = {}) {
  const alts = store.alternatives(item);
  const m = h(`<div class="overlay center alts"><div class="altcard"><div class="alttitle"></div><div class="altdemo"></div><div class="altbar"><button class="add">＋ Add</button><button class="rep">⇄ Replace</button></div><div class="dots"></div></div></div>`);
  app.appendChild(m);
  if (!alts.length) { $('.alttitle', m).textContent = 'No alternatives for this muscle group'; $('.altbar', m).innerHTML = '<button class="closeb">Close</button>'; $('.closeb', m).onclick = () => m.remove(); return; }
  let idx = 0;
  const title = $('.alttitle', m), dots = $('.dots', m), demo = $('.altdemo', m);
  const live = await acquireLive('preview');
  mountLive(live, demo);
  const show = i => {
    idx = (i + alts.length) % alts.length;
    title.textContent = alts[idx].name;
    live.show(alts[idx].id);
    dots.innerHTML = alts.slice(0, 12).map((_, k) => `<i class="${k === idx % 12 ? 'on' : ''}"></i>`).join('');
  };
  show(0);
  let x0 = null;
  demo.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  demo.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -40) show(idx + 1); else if (dx > 40) show(idx - 1); });
  demo.addEventListener('click', e => { const r = demo.getBoundingClientRect(); show(e.clientX - r.left < r.width / 2 ? idx - 1 : idx + 1); });
  const finish = () => { parkLive(live); m.remove(); onDone && onDone(); render(); };
  $('.add', m).onclick = () => { store.addAfter(item, alts[idx].id); toast('Added ' + alts[idx].name); finish(); };
  $('.rep', m).onclick = () => { store.replace(item, alts[idx].id); toast('Replaced with ' + alts[idx].name); finish(); };
  m.onclick = e => { if (e.target === m) finish(); };
}
function openEdit(item, opts) { openExerciseSheet(item, opts); }

function openSaved() {
  const inner = h('<div><h3 style="font-size:24px;margin-top:20px">Saved Workouts</h3><div class="body" style="padding-top:16px"></div></div>');
  const close = bottomSheet(inner);
  for (const s of store.saved) {
    const r = h(`<div class="saved-row"><div style="flex:1"><div style="font-size:19px;font-weight:600">${esc(s.name)}</div><div style="color:var(--text2);font-size:15px;margin-top:4px">${s.exercises.length} exercises · ${new Date(s.createdAt).toLocaleDateString()}</div></div><button class="load">Load</button><button class="del" aria-label="Delete">🗑</button></div>`);
    $('.load', r).onclick = () => { store.loadSaved(s); close(); }; $('.del', r).onclick = () => { store.deleteSaved(s); r.remove(); };
    $('.body', inner).appendChild(r);
  }
}

const PRESETS = [
  ['Quick Core', '8 min · no equipment', ['plank', 'air-bike', 'alternating-straight-leg-raise', 'starfish-crunch', 'wipers']],
  ['Legs at Home', '12 min · no equipment', ['jump-squat', 'jump-lunge', 'jump-sprinter-lunge', 'ankle-plantar-flexion', 'ankle-dorsal-flexion']],
  ['Back & Posture', '10 min · no equipment', ['around-the-world-superman-hold', 'inverted-row', 'plank', 'alternate-lying-floor-leg-raise']],
];
function openHomeWorkouts() {
  const inner = h('<div><h3 style="font-size:26px;margin-top:20px">Home Workouts</h3><p>Quick, fun and equipment-free.</p><div class="body" style="padding-top:16px"></div></div>');
  const close = bottomSheet(inner);
  for (const [name, sub, ids] of PRESETS) {
    const r = h(`<button class="saved-row" style="width:100%;text-align:left"><div style="display:flex">${ids.slice(0, 3).map(() => '<span class="thumb mini"></span>').join('')}</div><div style="flex:1;margin-left:24px"><div style="font-size:19px;font-weight:600">${name}</div><div style="color:var(--text2);font-size:15px;margin-top:4px">${sub}</div></div><span style="color:var(--text2)">›</span></button>`);
    ids.slice(0, 3).forEach((id, i) => thumbInto(r.querySelectorAll('.thumb')[i], id, 112));
    r.onclick = () => { store.workout = ids.map(id => store.make(BY_ID[id])); store.emit(); close(); };
    $('.body', inner).appendChild(r);
  }
}

// ---------- settings / training rows
function trainingRows(container, { includeReset = false } = {}) {
  const s = store.settings;
  const row = (icon, title, value, fn) => { const r = h(`<button class="srow"><span class="ic">${icon}</span><span>${title}</span><span class="val">${value}</span></button>`); r.onclick = fn; container.appendChild(r); };
  row('▦', 'Routine', s.routine, () => optionSheet({ icon: '▦', title: 'Routine', subtitle: 'Which routine would you like to follow?', options: Object.keys(ROUTINES).map(k => [k, k]), selected: s.routine, onSelect: v => { store.applyRoutine(v); rerenderModal(); } }));
  row('◷', 'Duration', `${s.durationMinutes} min`, () => optionSheet({ icon: '◷', title: 'Duration', subtitle: 'Changes the length of your workout. We recommend between 40 and 60 min, but a 20 min workout is infinitely better than none!', options: [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(m => [`${m} min`, m]), selected: s.durationMinutes, onSelect: v => { s.durationMinutes = v; store.generateWorkout(); rerenderModal(); } }));
  row('★', 'Objective', s.objective, () => optionSheet({ icon: '★', title: 'Objective', subtitle: 'What are you training for? This changes rep ranges and rest.', options: OBJECTIVES.map(o => [o, o]), selected: s.objective, onSelect: v => { s.objective = v; store.emit(); rerenderModal(); } }));
  row('🏋', 'Equipment', 'Edit', () => openEquipment());
  row('◔', 'Rep Ranges', s.repRange, () => optionSheet({ icon: '◔', title: 'Rep Ranges', subtitle: 'Low favours heavier strength work, High favours lighter endurance sets.', options: Object.keys(REP_RANGES).map(k => [k, k]), selected: s.repRange, onSelect: v => { s.repRange = v; store.emit(); rerenderModal(); } }));
  row('◎', 'Weekly Goal', `${s.weeklyGoal}x a week`, () => optionSheet({ icon: '◎', title: 'Weekly Goal', subtitle: 'How often would you like to workout? This has no effect on the algorithm, but hopefully it motivates you!', options: [1, 2, 3, 4, 5, 6, 7].map(n => [`${n}x a week`, n]), selected: s.weeklyGoal, onSelect: v => { s.weeklyGoal = v; store.emit(); rerenderModal(); } }));
  row('▮▮▮', 'Experience', s.experience, () => optionSheet({ icon: '▮▮▮', title: 'Experience', subtitle: 'Changes exercises and weight recommendations, but not by much.', options: Object.keys(EXPERIENCE).map(k => [k, k]), selected: s.experience, onSelect: v => { s.experience = v; store.emit(); rerenderModal(); } }));
  row('⏱', 'Rest Timer', `${restLabel(s.restMin)} - ${restLabel(s.restMax)}`, () => openRestTimer());
  row('🎲', 'Randomness', `${s.randomness}%`, () => openRandomness());
  const c = h(`<div class="srow"><span class="ic">⟳</span><span>Circuit Training</span><button class="toggle ${s.circuit ? 'on' : ''}" style="margin-left:auto" aria-label="Circuit training"><i></i></button></div>`);
  $('.toggle', c).onclick = () => { if (s.circuit) { s.circuit = false; store.emit(); rerenderModal(); } else actionSheet({ icon: '⟳', title: 'Circuit Training', subtitle: 'Turns your workout into a circuit. Enable this to automatically advance to your next exercise after each set.', action: 'Turn on', perform: () => { s.circuit = true; store.emit(); rerenderModal(); } }); };
  container.appendChild(c);
  if (includeReset) row('↺', 'Reset Training Algorithm', '', () => { store.resetAlgorithm(); toast('Training data reset'); rerenderModal(); });
}
let modalRerender = null;
function rerenderModal() { if (modalRerender) modalRerender(); else render(); }

function openSettings() {
  const m = h('<div class="modal"><div class="scroll settings"><h1>Settings<button class="x" aria-label="Close">✕</button></h1><div class="section plain">Training</div><div class="rows"></div><div class="section plain" style="margin-top:30px">More</div><div class="feedback"><div class="wordmark" style="justify-content:center;font-size:24px"><span class="logo"><i class="a"></i><i class="b"></i><i class="c"></i></span><span>Fitness<span class="m">Motion</span></span></div><p>We are always happy to hear your feedback and help you</p><a href="mailto:feedback@fitnessmotion.app?subject=FitnessMotion%20feedback">Contact Us</a></div><p style="font-size:13px;color:var(--text3);margin-top:24px">FitnessMotion · exercise demos are rendered live from an original 3D anatomy body.</p><div style="height:40px"></div></div></div>');
  const prev = modalRerender; modalRerender = () => { $('.rows', m).innerHTML = ''; trainingRows($('.rows', m)); };
  modalRerender(); app.appendChild(m);
  $('.x', m).onclick = () => { m.remove(); modalRerender = prev; render(); };
}

function openRestTimer() {
  const s = store.settings; let lo = s.restMin, hi = s.restMax, sound = s.restSound, enabled = s.restEnabled;
  const lab = v => { const m = Math.floor(v / 60), r = v % 60; return m === 0 ? `${r}s` : (r === 0 ? `${m}m` : `${m}m ${r}s`); };
  const inner = h(`<div style="display:flex;flex-direction:column"><div class="icon">⏱</div><h3>Rest Timer</h3><p>We'll adjust your rest time between these values, based on performance. We recommend 30s - 1m 30s based on your settings.</p><div class="lbl" style="text-align:center;font-size:18px;font-weight:600;margin-top:28px"></div><div class="range"><div class="track"></div><div class="fill"></div><input type="range" min="15" max="300" step="15" aria-label="Minimum rest"><input type="range" min="15" max="300" step="15" aria-label="Maximum rest"></div><div style="margin-top:30px"><div class="trow">Sound<button class="toggle ${sound ? 'on' : ''}" aria-label="Sound"><i></i></button></div><div class="trow" style="border-top:.5px solid var(--sep)">Enabled<button class="toggle ${enabled ? 'on' : ''}" aria-label="Enabled"><i></i></button></div></div><div class="opts" style="margin-top:20px"><button>Save</button></div></div>`);
  const [a, b] = inner.querySelectorAll('input'); a.value = lo; b.value = hi;
  const upd = () => { lo = Math.min(+a.value, hi - 15); hi = Math.max(+b.value, lo + 15); a.value = lo; b.value = hi; $('.lbl', inner).textContent = `${lab(lo)}  ${lab(hi)}`; const f = $('.fill', inner); f.style.left = ((lo - 15) / 285 * 100) + '%'; f.style.right = (100 - (hi - 15) / 285 * 100) + '%'; };
  a.oninput = b.oninput = upd; upd();
  const [ts, te] = inner.querySelectorAll('.toggle'); ts.onclick = () => { sound = !sound; ts.classList.toggle('on', sound); }; te.onclick = () => { enabled = !enabled; te.classList.toggle('on', enabled); };
  const close = bottomSheet(inner);
  $('.opts button', inner).onclick = () => { Object.assign(s, { restMin: lo, restMax: hi, restSound: sound, restEnabled: enabled }); store.emit(); close(); rerenderModal(); };
}
function openRandomness() {
  const s = store.settings; let v = s.randomness;
  const inner = h(`<div><div class="icon">🎲</div><h3>Randomness</h3><p>How much variety you want between workouts. 0% keeps the same exercises, 100% shuffles every time.</p><div class="v" style="text-align:center;font-size:30px;font-weight:700;color:var(--accent);margin-top:24px">${v}%</div><div style="padding:4px 28px 0"><input class="slider" type="range" min="0" max="100" step="10" value="${v}" aria-label="Randomness"></div><div class="opts" style="margin-top:30px"><button>Save</button></div></div>`);
  $('input', inner).oninput = e => { v = +e.target.value; $('.v', inner).textContent = v + '%'; };
  const close = bottomSheet(inner);
  $('.opts button', inner).onclick = () => { s.randomness = v; store.emit(); close(); rerenderModal(); };
}

// ---------- equipment
function openEquipment() {
  const sel = JSON.parse(JSON.stringify(store.settings.equipment));
  const m = h('<div class="modal" style="background:var(--bg)"><div class="topbar">Equipment<button class="x" aria-label="Close">✕</button></div><div class="scroll list" style="padding-top:8px"></div><div class="sticky"><button class="primary">DONE</button></div></div>');
  const list = $('.list', m);
  const draw = () => {
    list.innerHTML = '';
    for (const cat of EQUIPMENT) {
      const chosen = sel[cat.id] || [];
      const all = chosen.length === cat.items.length && cat.items.length > 1;
      const sum = chosen.length ? (all ? 'Everything' : cat.items.filter(i => chosen.includes(i)).join(', ')) : 'None';
      const r = h(`<button class="eq-row ${chosen.length ? '' : 'off'}"><span class="ic">${cat.icon}</span><span><div class="n">${cat.name}${cat.alwaysOn ? '' : ' ›'}</div><div class="s">${esc(sum)}</div></span><span class="check ${all ? 'on' : (chosen.length ? 'half' : '')}">${all ? '✓' : ''}</span></button>`);
      if (!cat.alwaysOn) r.onclick = () => openSub(cat);
      list.appendChild(r);
    }
    list.appendChild(h('<div class="spacer"></div>'));
  };
  const openSub = cat => {
    const sm = h(`<div class="modal" style="background:var(--bg)"><div class="topbar"><button class="back" aria-label="Back">‹</button>${cat.name}</div><div class="scroll list" style="padding-top:8px"></div><div class="sticky"><button class="primary">DONE</button></div></div>`);
    const l = $('.list', sm);
    const redraw = () => {
      l.innerHTML = '';
      for (const item of cat.items) {
        const on = (sel[cat.id] || []).includes(item);
        const r = h(`<button class="eq-row ${on ? '' : 'off'}" style="height:76px"><span class="ic">${cat.icon}</span><span class="n">${item}</span><span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span></button>`);
        r.onclick = () => { const arr = sel[cat.id] || (sel[cat.id] = []); on ? sel[cat.id] = arr.filter(x => x !== item) : arr.push(item); redraw(); };
        l.appendChild(r);
      }
      l.appendChild(h('<div class="spacer"></div>'));
    };
    redraw(); app.appendChild(sm);
    const back = () => { sm.remove(); draw(); };
    $('.back', sm).onclick = back; $('.primary', sm).onclick = back;
  };
  draw(); app.appendChild(m);
  $('.x', m).onclick = () => m.remove();
  $('.primary', m).onclick = () => { store.settings.equipment = sel; store.emit(); m.remove(); rerenderModal(); };
}

// ---------- add exercise / search
function openAddExercise(inSession, onDone, { focusSearch = false } = {}) {
  const initial = new Set(store.workout.map(w => w.exerciseId)); const sel = new Set(initial); let group = null, q = '';
  const m = h(`<div class="modal" style="background:var(--bg)"><div class="topbar"><button class="back" aria-label="Back">←</button>${focusSearch ? 'Search' : 'Add Exercise'}</div><div class="search">${ICONS.search}<input placeholder="Search exercises" autocomplete="off" aria-label="Search exercises"></div><div class="chips"></div><div class="scroll list" style="padding-top:10px"></div><div class="sticky hidden"><button class="primary"></button></div></div>`);
  const list = $('.list', m), chips = $('.chips', m), sticky = $('.sticky', m), btn = $('.primary', m);
  const additions = () => [...sel].filter(x => !initial.has(x)), removals = () => [...initial].filter(x => !sel.has(x));
  const updateBtn = () => {
    const a = additions().length, r = removals().length;
    sticky.classList.toggle('hidden', !a && !r);
    btn.textContent = r === 0 ? `Add ${a} exercise${a === 1 ? '' : 's'}` : (a === 0 ? `Remove ${r} exercise${r === 1 ? '' : 's'}` : `Add ${a}, Remove ${r}`);
  };
  const drawChips = () => {
    chips.innerHTML = '';
    for (const g of [null, ...GROUPS]) { const c = h(`<button class="chip ${group === g ? 'on' : ''}">${g || 'All'}</button>`); c.onclick = () => { group = g; drawChips(); drawList(); }; chips.appendChild(c); }
  };
  const drawList = () => {
    list.innerHTML = '';
    const rows = CATALOG.filter(d => (!group || d.groups.includes(group)) && (!q || d.name.toLowerCase().includes(q) || d.groups.some(g => g.toLowerCase().includes(q))));
    if (!rows.length) list.appendChild(h(`<div class="empty">🔍<b>No exercises match "${esc(q)}"</b>Try a muscle group like "chest" or part of a name.</div>`));
    for (const d of rows) {
      const on = sel.has(d.id);
      const r = h(`<button class="add-row ${on ? 'on' : ''}"><span class="thumb"></span><span class="name">${esc(d.name)}${NEW_IDS.has(d.id) ? '<i class="new">NEW</i>' : ''}<small>${d.groups.join(' · ')}</small></span><span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span></button>`);
      thumbInto($('.thumb', r), d.id, 144);
      r.onclick = () => { on ? sel.delete(d.id) : sel.add(d.id); drawList(); updateBtn(); };
      list.appendChild(r);
    }
    list.appendChild(h('<div class="spacer"></div>'));
  };
  const input = $('input', m);
  input.oninput = e => { q = e.target.value.trim().toLowerCase(); drawList(); };
  drawChips(); drawList(); updateBtn(); app.appendChild(m);
  if (focusSearch) setTimeout(() => input.focus(), 80);
  const close = () => { m.remove(); onDone && onDone(); if (!inSession) render(); };
  $('.back', m).onclick = close;
  btn.onclick = () => { if (inSession) { store.sessionAdd(additions()); store.sessionRemove(removals()); } else { store.addExercises(additions()); store.removeExercises(removals()); } close(); };
}

// ---------- session
async function openSession({ selectId } = {}) {
  const m = h('<div class="modal session"><div class="demo"><canvas aria-label="Exercise demonstration"></canvas><div class="btns"><button class="round" aria-label="Close">✕</button><button class="round" aria-label="Settings">⚙︎</button></div></div><div class="strip"></div><div class="sheet"><div class="handle"></div><div class="content"></div></div></div>');
  app.appendChild(m);
  const live = await acquireLive('session');
  $('canvas', m).replaceWith(live.canvas);
  let selectedId = null, restRemaining = 0, restTotal = 0, restTimer = null;
  const exercises = () => store.session ? store.session.exercises : [];
  const current = () => exercises().find(x => x.id === selectedId) || exercises()[0];
  const select = id => {
    selectedId = id; const cur = current(); if (!cur) return;
    live.show(cur.exerciseId); drawStrip(); drawCard();
    const el = m.querySelector(`.th[data-id="${id}"]`); if (el) el.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  };
  const drawStrip = () => {
    const st = $('.strip', m); st.innerHTML = '';
    for (const ex of exercises()) {
      const t = h(`<button class="th ${ex.id === current()?.id ? 'sel' : ''}" data-id="${ex.id}" aria-label="${esc(ex.name)}"><span class="thumb"></span>${isDone(ex) ? '<span class="done">✓</span>' : ''}</button>`);
      thumbInto($('.thumb', t), ex.exerciseId, 128); t.onclick = () => select(ex.id); st.appendChild(t);
    }
    const plus = h('<button class="plus" aria-label="Add exercise">+</button>'); plus.onclick = () => openAddExercise(true, () => { drawStrip(); drawCard(); }); st.appendChild(plus);
  };
  const timeStr = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const drawCard = () => {
    const c = $('.content', m); const cur = current(); c.innerHTML = '';
    if (!cur) return;
    const times = store.timesPerformed(cur.exerciseId), last = store.lastPerformance(cur.exerciseId);
    let changed;
    if (times === 0) changed = "This is the first time we are recommending this exercise, so we're starting with a conservative weight. Log your sets and we'll adjust from here.";
    else if (last && last.weight != null && cur.weight != null && cur.weight > last.weight) changed = `You handled ${last.weight} lbs last time, so we bumped you up to ${cur.weight} lbs.`;
    else if (last && last.weight != null) changed = `You've done this ${times} time${times === 1 ? '' : 's'}. Last time you logged ${last.weight} lbs × ${last.reps} reps.`;
    else changed = `You've done this ${times} time${times === 1 ? '' : 's'} before. Keep the form tight.`;
    c.appendChild(h(`<div class="learning">📊 ${times === 0 ? 'Learning' : 'Progressing'}</div>`));
    c.appendChild(h(`<h1>${esc(cur.name)}</h1>`));
    c.appendChild(h(`<div class="sum">${summary(cur)}</div>`));
    const sets = h('<div class="sets"></div>');
    for (let i = 0; i < Math.max(cur.sets, 1); i++) {
      const st = i < cur.completed.length ? 'done' : (i === cur.completed.length ? 'next' : '');
      const s = h(`<span class="set ${st}">${st === 'done' ? '✓' : ''}</span>`);
      if (i === cur.completed.length - 1) s.onclick = () => { store.undoSet(cur); drawStrip(); drawCard(); };
      sets.appendChild(s);
    }
    const edit = h('<button class="edit">Edit</button>'); edit.onclick = () => openExerciseSheet(cur, { onSaved: () => { if (!store.session || !store.session.exercises.length) { closeSession(); return; } if (!current()) selectedId = exercises()[0]?.id; drawStrip(); drawCard(); } }); sets.appendChild(edit); c.appendChild(sets);
    const log = h(`<button class="primary ${isDone(cur) ? 'dim' : ''}" style="margin-top:26px">✓ ${isDone(cur) ? 'DONE' : 'LOG SET'}</button>`); log.onclick = () => logSet(cur); c.appendChild(log);
    if (restRemaining > 0) {
      const r = h(`<div class="rest"><div class="r1">⏱ Rest<span class="time">${timeStr(restRemaining)}</span><button class="skip">Skip</button></div><div class="bar"><i style="width:${(restTotal - restRemaining) / Math.max(restTotal, 1) * 100}%"></i></div></div>`);
      $('.skip', r).onclick = () => endRest(); c.appendChild(r);
    }
    const cue = CUES[cur.exerciseId];
    if (cue) {
      c.appendChild(h('<h2>How To Do It</h2>'));
      c.appendChild(h(`<ol class="howto">${cue.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`));
      c.appendChild(h(`<div class="changed tip"><span class="s">!</span><span>${esc(cue.tip)}</span></div>`));
    }
    c.appendChild(h(`<h2>What's Changed</h2>`));
    c.appendChild(h(`<div class="changed"><span class="s">✦</span><span>${changed}</span></div>`));
    const past = store.history.map(s => [s, s.exercises.find(x => x.exerciseId === cur.exerciseId && x.completed.length)]).filter(x => x[1]);
    if (past.length) {
      c.appendChild(h('<h2>History</h2>'));
      for (const [s, ex] of past.slice(0, 6)) c.appendChild(h(`<div class="hist"><span class="d">${new Date(s.startedAt).toLocaleDateString()}</span><span>${ex.completed.map(x => x.weight != null ? `${x.weight}×${x.reps}` : x.reps).join('  ')}</span></div>`));
    }
    c.appendChild(h('<div style="height:40px"></div>'));
  };
  const advance = from => {
    const list = exercises(); const i = list.findIndex(x => x.id === from.id); if (i < 0) return;
    const after = [...list.slice(i + 1), ...list.slice(0, i)]; const next = after.find(x => !isDone(x)); if (next) select(next.id);
  };
  const startRest = seconds => {
    clearInterval(restTimer); restTotal = seconds; restRemaining = seconds;
    restTimer = setInterval(() => { restRemaining--; if (restRemaining <= 0) { clearInterval(restTimer); restRemaining = 0; if (store.settings.restSound) beep(); } drawCard(); }, 1000);
  };
  const endRest = () => { clearInterval(restTimer); restRemaining = 0; drawCard(); };
  const logSet = cur => {
    if (isDone(cur)) { advance(cur); return; }
    const finished = store.logSet(cur); navigator.vibrate && navigator.vibrate(20);
    if (exercises().every(isDone)) { showComplete(); return; }
    if (store.settings.restEnabled) startRest(finished ? store.settings.restMax : store.settings.restMin);
    drawStrip(); drawCard();
    if (finished || store.settings.circuit) setTimeout(() => advance(cur), 700);
  };
  const closeSession = () => { clearInterval(restTimer); parkLive(live); m.remove(); render(); };
  const exit = () => { store.finishSession(); closeSession(); };
  const refresh = () => { clearInterval(restTimer); store.discardSession(); store.generateWorkout(); store.startSession(); select(exercises()[0]?.id); };
  const showComplete = () => {
    const s = store.session; const ov = h(`<div class="overlay center" style="background:rgba(0,0,0,.75)"><div class="complete"><div class="big">✔</div><h3>Workout Complete</h3><div class="stats"><div><b>${store.totalSets(s)}</b><span>sets</span></div><div><b>${store.volume(s)}</b><span>lbs volume</span></div><div><b>${Math.round((Date.now() - s.startedAt) / 60000)}</b><span>min</span></div></div><button class="primary" style="margin-top:22px">Finish</button></div></div>`);
    $('.primary', ov).onclick = () => { ov.remove(); exit(); }; m.appendChild(ov);
  };
  const [xBtn, gearBtn] = m.querySelectorAll('.btns .round');
  xBtn.onclick = () => {
    const ov = h('<div class="overlay"><div class="dialog"><div class="handle"></div><h3>Workout in Progress</h3><p>What would you like to do?</p><div class="opts"><button>Exit</button><button class="red">Refresh</button><button>Cancel</button></div></div></div>');
    const [e, r, c] = ov.querySelectorAll('.opts button');
    e.onclick = () => { ov.remove(); exit(); }; r.onclick = () => { ov.remove(); refresh(); }; c.onclick = () => ov.remove();
    ov.onclick = ev => { if (ev.target === ov) ov.remove(); }; m.appendChild(ov);
  };
  gearBtn.onclick = () => openSettings();
  const first = (selectId && exercises().find(x => x.id === selectId)) || exercises().find(x => !isDone(x)) || exercises()[0];
  live.start(); requestAnimationFrame(() => { live._resize(); select(first?.id); });
  // a strip thumbnail tap or a "…" edit must not be swallowed by the demo canvas
  m.querySelector('.demo').addEventListener('touchstart', () => {}, { passive: true });
}
let audioCtx = null;
function beep() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.18); } catch (e) {}
}

// ---------- planning
function renderPlanning() {
  page.appendChild(header({ gear: false }));
  page.appendChild(h('<div class="section plain" style="margin-top:10px">Routine</div>'));
  const days = store.settings.routineDays;
  days.forEach((day, index) => {
    const active = index === store.settings.currentDay;
    const d = h(`<div class="day ${active ? 'active' : ''}"><div class="bar"></div><div class="body"><h3>Day ${index + 1}<button class="more" style="font-size:22px" aria-label="Day options">···</button></h3><div class="flow">${day.groups.map(g => `<span class="chipx ${active ? 'on' : 'dim'}">${g}</span>`).join('')}</div></div><span class="drag">≡</span></div>`);
    $('.more', d).onclick = ev => { ev.stopPropagation(); showMenu(ev.currentTarget, [
      ['Edit muscle groups', () => openDayEditor(day)],
      ['Train this today', () => { store.settings.currentDay = index; store.generateWorkout(); }],
      index > 0 ? ['Move up', () => { days.splice(index - 1, 0, days.splice(index, 1)[0]); store.emit(); }] : null,
      index < days.length - 1 ? ['Move down', () => { days.splice(index + 1, 0, days.splice(index, 1)[0]); store.emit(); }] : null,
      days.length > 1 ? ['Delete day', () => { days.splice(index, 1); if (store.settings.currentDay >= days.length) store.settings.currentDay = 0; store.emit(); }, 'red'] : null,
    ].filter(Boolean)); };
    d.onclick = () => openDayEditor(day);
    page.appendChild(d);
  });
  const add = h(`<button class="addday">+ Day ${days.length + 1}</button>`); add.onclick = () => openDayEditor(store.addDay()); page.appendChild(add);
  page.appendChild(h('<div class="section plain" style="margin-top:44px">Training</div>'));
  const rows = h('<div style="padding:6px 16px 0"></div>'); trainingRows(rows, { includeReset: true }); page.appendChild(rows);
  page.appendChild(h('<div class="section" style="margin-top:34px">Other Fitness Tools</div>'));
  const hw = h('<div style="padding:6px 16px 0"><button class="srow"><span class="ic">🏠</span><span>Home Workouts</span><span class="val" style="color:var(--text2)">›</span></button></div>'); $('button', hw).onclick = () => openHomeWorkouts(); page.appendChild(hw);
  page.appendChild(h('<div style="height:40px"></div>'));
}
function openDayEditor(day) {
  const sel = new Set(day.groups);
  const m = h(`<div class="modal mg"><button class="x" aria-label="Close">✕</button><h2>Which muscle groups does this day train?</h2><div class="scroll list"></div><div class="sticky"><button class="primary">DONE</button></div></div>`);
  const list = $('.list', m);
  const draw = () => {
    list.innerHTML = '';
    for (const g of GROUP_ORDER) {
      const on = sel.has(g);
      const r = h(`<button class="mg-row ${on ? 'on' : ''}"><span>${g}</span><span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span></button>`);
      r.onclick = () => { on ? sel.delete(g) : sel.add(g); draw(); };
      list.appendChild(r);
    }
    list.appendChild(h('<div class="spacer"></div>'));
  };
  draw(); app.appendChild(m);
  $('.x', m).onclick = () => { m.remove(); render(); };
  $('.primary', m).onclick = () => {
    const ordered = GROUP_ORDER.filter(g => sel.has(g)); const i = store.settings.routineDays.findIndex(d => d.id === day.id);
    if (ordered.length && i >= 0) { store.settings.routineDays[i].groups = ordered; if (i === store.settings.currentDay) store.generateWorkout(); else store.emit(); }
    m.remove(); render();
  };
}

// ---------- profile
let ptab = 0, activityRange = 30, strengthMode = 'week';
function renderProfile() {
  const hr = new Date().getHours(); const greet = hr < 12 ? 'Good morning,' : (hr < 17 ? 'Good afternoon,' : 'Good evening,');
  const head = h(`<div class="phead"><div class="avatar">👤</div><button class="greet">${greet}<br>${esc(store.profile.name)}</button><button class="hbtn gear" style="position:static;transform:none;margin-left:auto" aria-label="Settings">${ICONS.gear}</button></div>`);
  $('.greet', head).onclick = () => textSheet({ title: 'Your name', subtitle: 'Shown on your profile.', value: store.profile.name, onSubmit: n => { if (n) { store.profile.name = n; store.emit(); } } });
  $('.gear', head).onclick = () => openSettings(); page.appendChild(head);
  const tabs = h('<div class="ptabs"><button>Progress</button><button>History</button><button>Achievements</button></div>');
  [...tabs.children].forEach((b, i) => { b.classList.toggle('on', i === ptab); b.onclick = () => { ptab = i; render(); }; }); page.appendChild(tabs);
  const st = store.stats;
  if (ptab === 0) { page.appendChild(bodyActivityCard()); page.appendChild(strengthCard()); page.appendChild(friendsCard(st)); }
  else if (ptab === 1) {
    if (!store.history.length) page.appendChild(h('<div class="empty">🕓<b>No workouts yet</b>Finish a workout and it will show up here.</div>'));
    for (const s of store.history) page.appendChild(h(`<div class="hcard"><div class="r"><span>${new Date(s.startedAt).toLocaleString()}</span><span>${Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000)} min</span></div><h4>${esc(s.title)}</h4>${s.exercises.filter(x => x.completed.length).map(x => `<div class="ex"><span>${esc(x.name)}</span><span>${x.completed.length} sets${x.weight != null ? ` · ${x.weight} lbs` : ''}</span></div>`).join('')}</div>`));
  } else {
    const items = [['🚶', 'First Workout', st.workouts >= 1], ['🔥', '3 Day Streak', st.streak >= 3], ['✅', '50 Sets Logged', st.sets >= 50], ['⚖️', '10,000 lbs Moved', st.volume >= 10000], ['📅', 'Weekly Goal Hit', st.thisWeek >= store.settings.weeklyGoal], ['⭐', '10 Workouts', st.workouts >= 10]];
    page.appendChild(h(`<div class="grid2" style="margin-top:20px">${items.map(([i, t, on]) => `<div class="ach ${on ? 'on' : ''}"><div class="i">${i}</div><div class="t">${t}</div><div class="s">${on ? 'Unlocked' : 'Locked'}</div></div>`).join('')}</div>`));
  }
  page.appendChild(h('<div style="height:40px"></div>'));
}

function segmented(options, value, onChange) {
  const s = h('<div class="seg"></div>');
  for (const [label, v] of options) { const b = h(`<button class="${v === value ? 'on' : ''}">${label}</button>`); b.onclick = () => onChange(v); s.appendChild(b); }
  return s;
}

function bodyActivityCard() {
  const { counts, total } = store.setsByGroup(Date.now() - activityRange * 86400000);
  const pct = g => total ? Math.round((counts[g] || 0) / total * 100) : 0;
  const card = h(`<div class="pcard big"><div class="ptitle">Body Activity<span class="info" title="Share of the sets you logged that trained each muscle group">ⓘ</span></div></div>`);
  card.appendChild(segmented([['Last 30 days', 30], ['Last 7 days', 7]], activityRange, v => { activityRange = v; render(); }));
  const figs = h('<div class="hero small"><img alt="Front view"><img alt="Back view"></div>');
  const active = GROUPS.filter(g => pct(g) > 0).flatMap(g => GROUP_MUSCLES[g] || []);
  thumbs.anatomy(anatomySpec([...new Set(active)], false), 140, 280).then(u => figs.children[0].src = u);
  thumbs.anatomy(anatomySpec([...new Set(active)], true), 140, 280).then(u => figs.children[1].src = u);
  card.appendChild(figs);
  const grid = h('<div class="actgrid"></div>');
  for (const g of ['Chest', 'Back', 'Biceps', 'Glutes', 'Abs', 'Legs', 'Triceps', 'Shoulders', 'Calves']) {
    const p = pct(g);
    grid.appendChild(h(`<div class="act"><i style="height:${Math.max(6, p * 0.3)}px"></i><span>${g} ${p}%</span></div>`));
  }
  card.appendChild(grid);
  return card;
}

function strengthCard() {
  const s = store.series(strengthMode);
  const card = h(`<div class="pcard big"><div class="ptitle">Strength Progress<span class="info" title="Total weight lifted (weight × reps) per period">ⓘ</span></div><div class="sub">${strengthMode === 'week' ? 'Last 7 Days' : (strengthMode === 'month' ? 'Last 4 Weeks' : 'Last 12 Months')}</div></div>`);
  card.appendChild(segmented([['Week', 'week'], ['Month', 'month'], ['Year', 'year']], strengthMode, v => { strengthMode = v; render(); }));
  const W = 320, H = 230, padL = 44, padB = 34, padT = 14;
  const max = Math.max(100, ...s.values);
  const step = niceStep(max / 5); const top = Math.ceil(max / step) * step;
  const ticks = []; for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  const bw = (W - padL - 8) / s.values.length;
  const y = v => padT + (H - padT - padB) * (1 - v / top);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume per period">`;
  for (const t of ticks) svg += `<text x="${padL - 10}" y="${y(t) + 4}" text-anchor="end" class="tick">${fmtK(t)}</text>`;
  s.values.forEach((v, i) => {
    const x = padL + i * bw + bw * 0.28, w = bw * 0.44;
    const ghost = !s.hasData ? [8, 32, 50, 100, 30, 10, 70][i % 7] / 100 * top : 0;
    const val = s.hasData ? v : ghost;
    const hgt = Math.max(2, y(0) - y(val));
    svg += `<rect x="${x}" y="${y(val)}" width="${w}" height="${hgt}" rx="${w / 2}" class="${s.hasData ? 'bar' : 'bar ghost'}"/>`;
    svg += `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle" class="xl">${s.labels[i]}</text>`;
  });
  svg += '</svg>';
  const wrap = h(`<div class="chartwrap">${svg}${s.hasData ? '' : '<div class="chart-empty"><b>Log a workout</b><span>to see your strength progress</span></div>'}</div>`);
  card.appendChild(wrap);
  card.appendChild(h(`<div class="avgrow"><div><span>Average</span><b>${fmtK(Math.round(s.average))} lbs</b></div><div><span>Progress</span><b>${s.progress > 0 ? '+' : ''}${Math.round(s.progress)}%</b></div></div>`));
  return card;
}
const niceStep = x => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1)))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const fmtK = v => v >= 10000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v));

function friendsCard(st) {
  return h(`<div><div class="section" style="margin-top:34px">Friends</div><div class="pcard" style="margin-top:14px"><div style="font-size:22px;font-weight:600">Last 7 Days</div><div style="color:var(--text2);font-size:18px;margin-top:10px">Most Active</div><div class="rank"><span class="n">1.</span><div><b>You</b><span>${st.thisWeek} Workout${st.thisWeek === 1 ? '' : 's'}</span></div></div><div class="note">Friends need accounts, which this build doesn't have yet.</div></div></div>`);
}

// ---------- boot
(async () => {
  try {
    window.__fmStatus && window.__fmStatus('Loading the 3D body…');
    assets = await loadAssets('./assets/');
    window.__fmStatus && window.__fmStatus('Preparing the anatomy renderer…');
    thumbs = await ThumbnailRenderer.create(assets);
    $('#loading').remove();
    render();
    setTimeout(warmLive, 300);
  } catch (e) {
    $('#loading').innerHTML = `<div style="color:#ff6b6b;padding:24px;text-align:center;font:16px system-ui;max-width:360px">Could not load the 3D body.<br><small>${esc(String(e.message || e).slice(0, 220))}</small></div>`;
    console.error(e);
  }
})();
