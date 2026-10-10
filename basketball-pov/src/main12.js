// v12 "read the room": one guy walks up to three people mid-conversation, twice - checked out (on his phone, his
// mind somewhere else, talking on autopilot, missing every cue) and locked in (reading faces first, catching that
// she got cut off, bringing her in, linking two things he knows into something new) - then the loop getting quicker
// with practice. Split screen: what he does on top, what his brain does underneath at the same moment (a simplified
// side view; deep regions dashed). 2D canvas, 1080x1920 at 30 fps.
const W = 1080, H = 1920, FPS = 30;
const cv = document.getElementById('cv'), g = cv.getContext('2d');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const env = (t, t0, t1, r = 0.2) => smooth((t - t0) / r) * (1 - smooth((t - t1) / r));
const TOP = 936, BR = { x: 140, y: 1072, w: 800, h: 560 };

// ---------------------------------------------------------------- the story, in seconds of video
const O = 3.8, FL = 17.0, I = 18.4, F = 33.0, END = 46.0, OUT = 41.5;
const PARTS = [[O, FL, 'out', '1 · CHECKED OUT'], [I, F, 'in', '2 · LOCKED IN'], [F, OUT, 'fast', '3 · FASTER EVERY TIME']];

// people: keyframes [t, props]; numbers ease between keyframes, anything missing carries over
const LOOK = {
  him: { skin: '#8d5a3b', hair: '#17110d', shirt: '#22a6b3', pants: '#2b3140', style: 'short' },
  A: { skin: '#f1c27d', hair: '#6b3e26', shirt: '#ef8b3c', pants: '#27304a', style: 'wavy' },
  B: { skin: '#c68642', hair: '#121212', shirt: '#7d5cf0', pants: '#2a2a33', style: 'cap', cap: '#e8e8ee' },
  C: { skin: '#e0ac69', hair: '#2a1a12', shirt: '#36b97a', pants: '#2b2b3d', style: 'bun' },
};
const BASE = { x: 0, sc: 1, face: 0, gx: 0, gy: 0, brow: 0, smile: 0.2, talk: 0, lid: 0, cross: 0, gesture: 0, open: 0, phone: 0, down: 0, laugh: 0 };
const K = { him: [], A: [], B: [], C: [] };
const key = (who, t, p) => K[who].push([t, p]);
// the room, both times: A telling a story to B and C
function room(t0) {
  key('A', t0, { x: 470, face: 0.55, smile: 0.3, gesture: 1 }); key('B', t0, { x: 690, sc: 0.95, face: -0.6, smile: 0.1 }); key('C', t0, { x: 895, face: -0.75, smile: 0.15 });
}
// 1 - checked out
room(O);
key('him', O, { x: -170, face: 1, phone: 1, down: 1, gy: 1, gx: 0.2, smile: 0 });
key('him', O + 2.2, { x: 215 });
key('C', O + 2.4, { brow: 0.6 }); key('A', O + 2.5, { gesture: 0 });
key('him', O + 3.0, { phone: 1, down: 1, gy: 1 }); key('him', O + 3.3, { phone: 0, down: 0, gy: 0, gx: 0.6, gesture: 1, smile: 0.3 });
key('C', O + 3.4, { brow: 0.6, smile: 0.1 }); key('C', O + 3.7, { brow: -0.5, smile: -0.3 });
key('A', O + 3.3, { gx: -0.8, face: -0.2 });
key('B', O + 5.6, { face: -0.6, gx: -0.6, gy: 0 }); key('B', O + 5.9, { gx: 0.3, gy: -1, lid: 0.35, smile: -0.2, face: 0.1 });
key('C', O + 5.8, { cross: 0 }); key('C', O + 6.2, { cross: 1, smile: -0.45, gx: -0.4 });
key('A', O + 6.3, { gesture: 0, face: 0.4, gx: 0.6 }); key('B', O + 7.2, { gy: 0, gx: 0.5, lid: 0.2, face: 0.5 });
key('him', O + 8.4, { gesture: 1, smile: 0.3 }); key('him', O + 8.8, { gesture: 0, smile: 0 });
key('A', O + 9.0, { x: 470, face: 0.6 }); key('A', O + 10.2, { x: 575, face: 0.8, smile: 0.3, gx: 0.8 });
key('B', O + 9.0, { x: 690 }); key('B', O + 10.2, { x: 720, face: -0.3, lid: 0, smile: 0.25, gx: -0.4, gy: 0 });
key('C', O + 9.0, { x: 895 }); key('C', O + 10.2, { x: 860, cross: 0, smile: 0.35, brow: 0.2, gx: -0.8, face: -0.8 });
key('him', O + 10.2, { phone: 0, down: 0, gy: 0 }); key('him', O + 10.8, { phone: 1, down: 1, gy: 1, gx: 0.2 });
// 2 - locked in
room(I);
key('him', I, { x: -170, face: 1, phone: 0, down: 0, gy: 0, gx: 0.5, smile: 0.15, gesture: 0, cross: 0, open: 0 });
key('him', I + 0.6, { gx: 0.5 }); key('him', I + 2.2, { x: 215 });
// (his eyes go face to face: A, B, C)
key('him', I + 0.8, { gx: 0.6, gy: 0 }); key('him', I + 1.3, { gx: 0.85 }); key('him', I + 1.8, { gx: 1 }); key('him', I + 2.4, { gx: 0.6 });
key('C', I + 2.3, { brow: 0.6 }); key('A', I + 2.8, { gesture: 1, gx: 0.4 });
key('C', I + 3.0, { brow: 0.6, smile: 0.1 }); key('C', I + 3.4, { brow: -0.4, smile: -0.25 });
key('him', I + 3.0, { gx: 1 }); key('him', I + 4.8, { gx: 1, open: 0 }); key('him', I + 5.2, { open: 1, smile: 0.35, brow: 0.3 });
key('A', I + 4.6, { gesture: 1, gx: 0.4 }); key('A', I + 5.2, { gesture: 0, gx: -0.6, face: -0.1 });
key('him', I + 6.6, { open: 1 }); key('him', I + 7.0, { open: 0, smile: 0.4 });
key('C', I + 6.6, { brow: -0.4, smile: -0.2 }); key('C', I + 6.9, { brow: 0.4, smile: 0.6, gesture: 1, gx: -0.4 });
key('A', I + 6.8, { face: 0.6, gx: 0.8, smile: 0.4 }); key('B', I + 6.8, { face: 0.3, gx: 0.8, smile: 0.3 });
key('C', I + 8.4, { gesture: 1 }); key('C', I + 8.8, { gesture: 0 });
// (B drifts off to his phone; he catches it and links her story to B's thing)
key('B', I + 8.0, { phone: 0, lid: 0 }); key('B', I + 8.5, { phone: 1, down: 1, gy: 1, lid: 0.3, smile: 0, face: 0.1 });
key('him', I + 8.8, { gx: 1 }); key('him', I + 9.1, { gx: 0.85, gy: 0.3 });
key('him', I + 10.0, { open: 0, gesture: 0 }); key('him', I + 10.3, { gesture: 1, smile: 0.45, brow: 0.4 });
key('B', I + 10.9, { phone: 1, down: 1 }); key('B', I + 11.3, { phone: 0, down: 0, gy: 0, gx: -0.8, lid: 0, smile: 0.6, brow: 0.5, face: -0.4 });
key('him', I + 12.0, { gesture: 1 }); key('him', I + 12.4, { gesture: 0, laugh: 1, smile: 0.7 });
key('A', I + 11.6, { laugh: 0 }); key('A', I + 12.0, { laugh: 1, smile: 0.8 }); key('B', I + 11.8, { laugh: 1, smile: 0.8 }); key('C', I + 11.8, { laugh: 1, smile: 0.8 });
key('A', I + 13.4, { laugh: 0, smile: 0.5 }); key('B', I + 13.4, { laugh: 0, smile: 0.5 }); key('C', I + 13.4, { laugh: 0, smile: 0.55 }); key('him', I + 13.4, { laugh: 0, smile: 0.5 });
// 3 - quicker every time: the same cue (she gets talked over), three times, each catch quicker
const REPS = [{ t: F + 0.6, d: 2.0, n: '1ST TIME' }, { t: F + 3.4, d: 1.0, n: '10TH TIME' }, { t: F + 5.6, d: 0.5, n: '50TH TIME' }];
room(F);
key('him', F, { x: 215, face: 1, phone: 0, down: 0, gx: 0.8, smile: 0.3, gesture: 0, open: 0, laugh: 0, brow: 0 });
key('B', F, { phone: 0, down: 0, gy: 0, lid: 0, laugh: 0 }); key('C', F, { laugh: 0, gesture: 0, cross: 0 }); key('A', F, { laugh: 0 });
for (const r of REPS) {
  key('C', r.t, { brow: 0.5, smile: 0.1 }); key('C', r.t + 0.25, { brow: -0.4, smile: -0.25 });
  key('A', r.t, { gesture: 1 }); key('A', r.t + r.d, { gesture: 1 }); key('A', r.t + r.d + 0.25, { gesture: 0 });
  key('him', r.t, { gx: 0.8, open: 0 }); key('him', r.t + 0.15, { gx: 1 }); key('him', r.t + r.d - 0.2, { open: 0 }); key('him', r.t + r.d, { open: 1, smile: 0.4 });
  key('C', r.t + r.d + 0.1, { brow: -0.4, smile: -0.2 }); key('C', r.t + r.d + 0.35, { brow: 0.4, smile: 0.6 });
  key('him', r.t + r.d + 0.6, { open: 0 });
}
for (const w of Object.keys(K)) for (const t of [FL - 0.02, F - 0.05, OUT - 0.02]) key(w, t, {});
for (const k of Object.values(K)) k.sort((a, b) => a[0] - b[0]);
function state(who, t) {
  const ks = K[who], s = { ...BASE }; let prev = null, next = null;
  const cur = { ...BASE }; const filled = [];
  for (const [kt, p] of ks) { Object.assign(cur, p); filled.push([kt, { ...cur }]); }
  for (const f of filled) { if (f[0] <= t) prev = f; else { next = f; break; } }
  if (!prev) return { ...(next ? next[1] : s) };
  if (!next) return { ...prev[1] };
  const u = smooth((t - prev[0]) / Math.max(0.001, next[0] - prev[0]));
  for (const k of Object.keys(prev[1])) s[k] = typeof prev[1][k] === 'number' ? lerp(prev[1][k], next[1][k], u) : prev[1][k];
  return s;
}
// speech bubbles
const SAY = [
  ['A', O + 0.3, O + 2.4, '…so we get there, and it\'s closed.'],
  ['C', O + 2.6, O + 3.5, 'Wait, I was gonna say—'],
  ['him', O + 3.3, O + 5.6, 'Bro. So me and my boy last night…'],
  ['A', O + 5.65, O + 6.15, 'Anyway…'],
  ['him', O + 6.2, O + 8.6, '…and then he goes, watch this…'],
  ['A', I + 0.2, I + 2.3, '…so we get there, and it\'s closed.'],
  ['C', I + 2.4, I + 2.95, 'Wait, I was gonna say—'],
  ['A', I + 2.95, I + 4.6, '—and THEN the guy says—'],
  ['him', I + 5.2, I + 6.7, 'Hold on. What were you gonna say?'],
  ['C', I + 6.9, I + 8.6, 'Okay so, I was gonna say we just cook it ourselves!'],
  ['him', I + 10.3, I + 12.1, 'Wait, you cook? You could\'ve run that kitchen.'],
  ...REPS.map(r => ['him', r.t + r.d, r.t + r.d + 0.55 + 0.2 * r.d, 'What were you saying?']),
];
// talking without a bubble: A going on over her in the quick reps
const TALK = REPS.map(r => ['A', r.t - 0.5, r.t + r.d]);
// his attention, locked in: [t0, t1, who]
const EYES = [[I + 0.8, I + 1.25, 'A'], [I + 1.3, I + 1.75, 'B'], [I + 1.8, I + 2.4, 'C'], [I + 3.0, I + 5.0, 'C'], [I + 7.0, I + 8.6, 'C'], [I + 8.8, I + 10.2, 'B'],
  ...REPS.map(r => [r.t + 0.1, r.t + r.d, 'C'])];

// ---------------------------------------------------------------- the brain (simplified, side view, front to the left)
const OUTLINE = [[0.02, 0.48], [0.05, 0.3], [0.13, 0.15], [0.27, 0.05], [0.45, 0.01], [0.62, 0.03], [0.78, 0.1], [0.9, 0.22], [0.97, 0.37], [0.99, 0.5], [0.95, 0.6], [0.88, 0.66],
  [0.93, 0.72], [0.92, 0.84], [0.84, 0.9], [0.72, 0.88], [0.66, 0.82], [0.62, 0.86], [0.6, 0.99], [0.54, 0.99], [0.53, 0.84], [0.45, 0.8], [0.33, 0.78], [0.25, 0.72], [0.24, 0.64], [0.18, 0.66], [0.09, 0.62], [0.04, 0.56]];
const R = {
  see: { p: [0.92, 0.48], label: 'SEEING', col: '62,230,255', lx: 1, ly: -1 },
  face: { p: [0.66, 0.76], label: 'FACES', col: '62,230,255', lx: 1, ly: 1 },
  emo: { p: [0.33, 0.66], label: 'EMOTION', col: '255,107,94', deep: true, lx: -1, ly: 1 },
  tpj: { p: [0.7, 0.4], label: 'WHAT ARE THEY THINKING?', col: '190,150,255', lx: 1, ly: -1 },
  mind: { p: [0.1, 0.42], label: 'READING MINDS', col: '190,150,255', deep: true, lx: -1, ly: -1 },
  plan: { p: [0.22, 0.25], label: 'PLANNING', col: '230,240,255', lx: -1, ly: -1 },
  speech: { p: [0.25, 0.53], label: 'SPEECH', col: '230,240,255', lx: -1, ly: 1 },
  off: { p: [0.36, 0.32], label: 'SOMETHING\'S OFF', col: '255,77,94', deep: true, lx: 1, ly: -1 },
  auto: { p: [0.45, 0.45], label: 'AUTOPILOT (HABIT)', col: '255,150,80', deep: true, lx: 1, ly: 1 },
  reward: { p: [0.37, 0.52], label: 'THAT LANDED (REWARD)', col: '255,194,58', deep: true, lx: 1, ly: 1 },
  mem: { p: [0.5, 0.65], label: 'MEMORY', col: '120,220,170', deep: true, lx: 1, ly: -1 },
  dmn: { p: [0.66, 0.24], label: 'MIND ELSEWHERE', col: '150,160,190', deep: true, lx: 1, ly: -1 },
};
const bp = (n) => ({ x: BR.x + R[n].p[0] * BR.w, y: BR.y + R[n].p[1] * BR.h });
// activity: [region, t0, t1, level]
const ACT = [
  ['dmn', O + 0.3, O + 3.2, 1], ['see', O + 0.3, O + 9.0, 0.25],
  ['auto', O + 3.1, O + 8.8, 1], ['speech', O + 3.2, O + 8.8, 1],
  ['face', O + 6.1, O + 6.7, 0.35], ['off', O + 6.5, O + 7.3, 1],
  ['dmn', O + 9.6, FL + 0.3, 1],
  ['see', I + 0.3, I + 14.4, 0.8], ['face', I + 0.8, I + 2.5, 0.75], ['emo', I + 1.8, I + 2.6, 0.55],
  ['face', I + 3.0, I + 3.8, 1], ['emo', I + 3.2, I + 4.2, 1], ['tpj', I + 3.6, I + 5.2, 1], ['mind', I + 4.0, I + 5.4, 1],
  ['plan', I + 4.5, I + 5.6, 1], ['speech', I + 5.0, I + 6.7, 1],
  ['face', I + 7.0, I + 7.6, 0.9], ['reward', I + 7.2, I + 9.0, 1],
  ['face', I + 8.8, I + 9.4, 0.8], ['tpj', I + 9.0, I + 9.8, 0.8], ['mem', I + 9.3, I + 10.6, 1], ['plan', I + 9.9, I + 10.5, 1], ['speech', I + 10.2, I + 12.1, 1],
  ['reward', I + 11.9, I + 13.8, 1],
  ['see', F + 0.2, OUT, 0.8],
  ...REPS.flatMap(r => { const s = r.d / 2.0; return [['face', r.t + 0.1, r.t + 0.1 + 0.5 * s, 1], ['emo', r.t + 0.1 + 0.15 * s, r.t + 0.1 + 0.6 * s, 0.8], ['tpj', r.t + 0.1 + 0.3 * s, r.t + 0.1 + 0.95 * s, 1], ['mind', r.t + 0.1 + 0.55 * s, r.t + 0.1 + 1.25 * s, 1], ['plan', r.t + 0.1 + 0.8 * s, r.t + r.d, 1], ['speech', r.t + r.d - 0.05, r.t + r.d + 0.6, 1], ['reward', r.t + r.d + 0.35, r.t + r.d + 1.0, 0.9]]; }),
];
// signals: [from, to, t0, dur, die (fraction where it fizzles, or 1)]
const SIG = [
  ['auto', 'speech', O + 3.15, 0.45, 1], ['auto', 'speech', O + 4.4, 0.45, 1], ['auto', 'speech', O + 6.0, 0.45, 1], ['auto', 'speech', O + 7.6, 0.45, 1],
  ['see', 'face', O + 5.9, 0.35, 1], ['face', 'off', O + 6.25, 0.4, 1], ['off', 'plan', O + 6.8, 0.7, 0.4],
  ['see', 'face', I + 0.75, 0.3, 1], ['see', 'face', I + 1.25, 0.3, 1], ['see', 'face', I + 1.75, 0.3, 1], ['face', 'emo', I + 1.95, 0.35, 1],
  ['see', 'face', I + 2.9, 0.3, 1], ['face', 'emo', I + 3.15, 0.35, 1], ['emo', 'tpj', I + 3.45, 0.4, 1], ['tpj', 'mind', I + 3.85, 0.45, 1], ['mind', 'plan', I + 4.35, 0.35, 1], ['plan', 'speech', I + 4.75, 0.3, 1],
  ['see', 'face', I + 6.9, 0.3, 1], ['face', 'reward', I + 7.15, 0.4, 1],
  ['see', 'face', I + 8.75, 0.3, 1], ['face', 'tpj', I + 9.0, 0.35, 1], ['tpj', 'mem', I + 9.3, 0.35, 1], ['mem', 'plan', I + 9.75, 0.3, 1], ['plan', 'speech', I + 10.0, 0.25, 1],
  ['see', 'face', I + 11.7, 0.3, 1], ['face', 'reward', I + 11.95, 0.35, 1],
  ...REPS.flatMap(r => { const s = r.d / 2.0, c = ['see', 'face', 'emo', 'tpj', 'mind', 'plan', 'speech'], out = []; for (let i = 0; i < c.length - 1; i++) out.push([c[i], c[i + 1], r.t + 0.05 + i * (r.d - 0.1) / (c.length - 1), (r.d - 0.1) / (c.length - 1), 1]); return out; }),
];
// two things he already knew, linked into something new
const LINK = { t0: I + 9.4, t1: I + 12.4, a: 'HER STORY: THE PLACE WAS CLOSED', b: 'THE GUY ON HIS PHONE COOKS', at: I + 9.9 };
// the loop clock
const LOOP = [
  { t0: O + 7.4, t1: FL, text: 'NOTICE → READ → ADJUST', val: 'NEVER CLOSED', col: '255,77,94' },
  { t0: I + 3.0, t1: I + 9.0, text: 'NOTICE → READ → ADJUST', run: [I + 3.0, I + 5.0], col: '62,230,255' },
  { t0: I + 9.0, t1: F, text: 'LOOP 2: NOTICE → ADJUST', run: [I + 8.8, I + 10.0], col: '62,230,255', prev: '(LOOP 1: 2.0 s)' },
  ...REPS.map((r, i) => ({ t0: r.t, t1: i < 2 ? REPS[i + 1].t - 0.3 : OUT, text: r.n, run: [r.t, r.t + r.d], col: '255,194,58' })),
];
const CAPS = [
  [O + 0.4, O + 4.4, 'Checked out. He\'s in the room,<br>but <b>his mind is somewhere else.</b>'],
  [O + 4.6, O + 8.6, 'He talks on <s>autopilot</s>: habit straight<br>to speech. Nothing is reading the room.'],
  [O + 8.8, O + 12.6, 'His brain flags it, <s>something\'s off</s>,<br>and he lets it go. <b>No update.</b>'],
  [O + 12.8, FL - 0.1, 'The loop never closes,<br>so there\'s <b>nothing to learn from.</b>'],
  [I + 0.3, I + 3.4, 'Locked in. He reads the faces<br><b>before he says a word.</b>'],
  [I + 3.6, I + 6.6, 'Face → feeling → <em>what she\'s thinking</em>:<br><b>she had something to say.</b>'],
  [I + 6.8, I + 9.6, 'It lands. <b>That</b> is the feedback<br>his brain learns from.'],
  [I + 9.8, I + 12.8, 'Creative: he links two things he already<br>knew into <b>a move nobody else saw.</b>'],
  [I + 12.9, F - 0.1, 'Second loop: <b>quicker.</b><br>That\'s catching on.'],
  [F + 0.3, OUT - 0.1, 'Every loop that closes makes the next one<br>quicker, <b>until it runs on its own</b><br>and his attention is free to create.'],
];

// ---------------------------------------------------------------- drawing: the room
function roomBg(t) {
  const sky = g.createLinearGradient(0, 0, 0, TOP); sky.addColorStop(0, '#1b1724'); sky.addColorStop(1, '#2b2130');
  g.fillStyle = sky; g.fillRect(0, 0, W, TOP);
  // window with the city at night
  g.fillStyle = '#0d1424'; g.fillRect(600, 170, 380, 330);
  for (let i = 0; i < 26; i++) { const x = 612 + ((i * 97) % 350), h = 60 + ((i * 53) % 150); g.fillStyle = '#141d33'; g.fillRect(x, 500 - h, 30, h); for (let j = 0; j < 5; j++) if ((i * 7 + j * 3) % 4 === 0) { g.fillStyle = 'rgba(255,214,140,0.55)'; g.fillRect(x + 6 + (j % 2) * 12, 500 - h + 10 + j * 14, 6, 6); } }
  g.strokeStyle = '#3a2f3e'; g.lineWidth = 12; g.strokeRect(600, 170, 380, 330); g.beginPath(); g.moveTo(790, 170); g.lineTo(790, 500); g.stroke();
  // lamp glow on the left
  const lg = g.createRadialGradient(120, 300, 10, 120, 300, 420); lg.addColorStop(0, 'rgba(255,190,120,0.35)'); lg.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = lg; g.fillRect(0, 0, W, TOP);
  g.fillStyle = '#3b2c2a'; g.fillRect(112, 300, 16, 520); g.fillStyle = '#e8c79a'; g.beginPath(); g.moveTo(70, 300); g.lineTo(170, 300); g.lineTo(150, 240); g.lineTo(90, 240); g.closePath(); g.fill();
  // floor
  const fl = g.createLinearGradient(0, 810, 0, TOP); fl.addColorStop(0, '#2a1f24'); fl.addColorStop(1, '#17111a');
  g.fillStyle = fl; g.fillRect(0, 810, W, TOP - 810);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 808, W, 4);
}
function ik(sx, sy, hx, hy, l1, l2, bendSign) {
  const dx = hx - sx, dy = hy - sy, d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 1), a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = Math.acos(c) * bendSign;
  return { ex: sx + Math.cos(a + b) * l1, ey: sy + Math.sin(a + b) * l1, hx: sx + Math.cos(a) * d, hy: sy + Math.sin(a) * d };
}
function person(who, s, t) {
  const L = LOOK[who], f = clamp(s.face, -1, 1), sc = s.sc * 1.1, X = s.x, G = 900 - (1 - s.sc) * 60;
  const P = (x, y) => [X + x * sc, G + y * sc];
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(X, G + 6, 90 * sc, 16 * sc, 0, 0, Math.PI * 2); g.fill();
  // legs (a walk when he moves)
  const ph = X * 0.045, vx = Math.abs(state(who, t + 0.05).x - state(who, t - 0.05).x) * 10, sw = clamp(vx / 150, 0, 1);
  for (const sd of [-1, 1]) {
    const [hx, hy] = P(sd * 24, -250), [fx, fy] = P(sd * 26 + Math.sin(ph + (sd > 0 ? Math.PI : 0)) * 46 * sw, -Math.max(0, Math.cos(ph + (sd > 0 ? Math.PI : 0))) * 22 * sw);
    g.strokeStyle = L.pants; g.lineWidth = 46 * sc; g.beginPath(); g.moveTo(hx, hy); g.lineTo(fx, fy - 12 * sc); g.stroke();
    g.fillStyle = '#ececf2'; g.beginPath(); g.ellipse(fx + f * 14 * sc, fy - 8 * sc, 30 * sc, 13 * sc, 0, 0, Math.PI * 2); g.fill();
  }
  // torso
  const [tx, ty] = P(0, -335);
  g.fillStyle = L.shirt; g.beginPath();
  const tw = 128, bw = 112;
  g.moveTo(...P(-tw / 2, -415)); g.quadraticCurveTo(...P(0, -432), ...P(tw / 2, -415)); g.lineTo(...P(bw / 2, -245)); g.quadraticCurveTo(...P(0, -238), ...P(-bw / 2, -245)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(...P(f * 20, -428)); g.lineTo(...P(bw / 2 * Math.sign(f || 1), -245)); g.lineTo(...P(tw / 2 * Math.sign(f || 1), -415)); g.closePath(); if (Math.abs(f) > 0.2) g.fill();
  // arms: hand targets per pose, blended, then a two-bone reach from the shoulder
  const hands = {};
  for (const sd of [-1, 1]) {
    let hx = sd * 72, hy = -218, w = 1;
    const add = (x, y, k) => { if (k <= 0) return; hx = lerp(hx, x, k); hy = lerp(hy, y, k); };
    add(sd * -32, -330, s.cross);
    add(f * 26 + sd * 14, -345, s.phone);
    if (sd === Math.sign(f || 1)) { add(f * 112 + sd * 6, -362, s.gesture); add(f * 170, -338, s.open); }
    if (s.laugh > 0 && sd !== Math.sign(f || 1)) add(sd * -10, -300, s.laugh * 0.8);
    hands[sd] = { hx, hy };
    const [sx, sy] = P(sd * 60, -405), [Hx, Hy] = P(hx, hy), j = ik(sx, sy, Hx, Hy, 98 * sc, 92 * sc, sd > 0 ? -1 : 1);
    g.strokeStyle = L.shirt; g.lineWidth = 34 * sc; g.beginPath(); g.moveTo(sx, sy); g.lineTo(j.ex, j.ey); g.stroke();
    g.strokeStyle = L.skin; g.lineWidth = 26 * sc; g.beginPath(); g.moveTo(j.ex, j.ey); g.lineTo(j.hx, j.hy); g.stroke();
    g.fillStyle = L.skin; g.beginPath(); g.arc(j.hx, j.hy, 15 * sc, 0, Math.PI * 2); g.fill();
  }
  if (s.phone > 0.5) { const [px, py] = P(f * 26, -360); g.save(); g.translate(px, py); g.rotate(-0.15 * Math.sign(f || 1)); g.fillStyle = '#111'; g.fillRect(-14 * sc, -24 * sc, 28 * sc, 48 * sc); g.fillStyle = 'rgba(120,190,255,0.85)'; g.fillRect(-11 * sc, -20 * sc, 22 * sc, 38 * sc); g.restore(); }
  // neck + head
  const down = s.down, hxo = f * 8 + down * f * 6, [nx, ny] = P(f * 4, -432);
  g.fillStyle = L.skin; g.fillRect(nx - 16 * sc, ny - 24 * sc, 32 * sc, 30 * sc);
  const [cx, cy] = P(hxo, -500 + down * 14 - s.laugh * Math.abs(Math.sin(t * 9)) * 4), r = 62 * sc;
  g.fillStyle = L.skin; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  hair(L, cx, cy, r, f, sc);
  // face
  const fx = cx + f * 16 * sc, ey = cy - 4 * sc + down * 6 * sc;
  for (const sd of [-1, 1]) {
    const ex = fx + sd * 21 * sc - f * Math.abs(f) * (sd === Math.sign(f) ? 0 : 4) * sc;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 11 * sc, 12.5 * sc, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(ex + clamp(s.gx, -1, 1) * 5 * sc, ey + clamp(s.gy, -1, 1) * 6 * sc, 6 * sc, 0, Math.PI * 2); g.fill();
    const lid = Math.max(s.lid, s.laugh * 0.45);
    if (lid > 0.02) { g.fillStyle = L.skin; g.beginPath(); g.ellipse(ex, ey - 12.5 * sc * (1 - lid * 1.4), 13 * sc, 12.5 * sc * lid * 1.2, 0, Math.PI, 0); g.fill(); g.fillRect(ex - 13 * sc, ey - 14 * sc, 26 * sc, 13 * sc * lid); }
    // brows: down at the middle when he's annoyed, up when he's open
    // (the inner end drops when he frowns, the whole brow lifts when he's open)
    const bl = ey - 22 * sc - Math.max(0, s.brow) * 6 * sc, drop = Math.max(0, -s.brow) * 7 * sc;
    const inner = sd < 0 ? ex + 11 * sc : ex - 11 * sc, outer = sd < 0 ? ex - 11 * sc : ex + 11 * sc;
    g.strokeStyle = L.hair; g.lineWidth = 5 * sc; g.beginPath(); g.moveTo(outer, bl - drop * 0.3); g.lineTo(inner, bl + drop); g.stroke();
  }
  const mx = fx, my = cy + 30 * sc + down * 4 * sc;
  if (s.talk > 0.5 || s.laugh > 0.5) {
    const o = s.laugh > 0.5 ? 0.7 + 0.3 * Math.abs(Math.sin(t * 9)) : 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + 1.3)) * Math.abs(Math.sin(t * 5.3));
    g.fillStyle = '#5a1f22'; g.beginPath(); g.ellipse(mx, my, 13 * sc, (3 + 10 * o) * sc, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.strokeStyle = '#5a2a22'; g.lineWidth = 5 * sc; g.beginPath(); g.moveTo(mx - 15 * sc, my - s.smile * 4 * sc); g.quadraticCurveTo(mx, my + s.smile * 12 * sc, mx + 15 * sc, my - s.smile * 4 * sc); g.stroke();
  }
  g.restore();
  return { head: { x: cx, y: cy, r }, eyes: { x: fx, y: ey } };
}
function hair(L, cx, cy, r, f, sc) {
  g.fillStyle = L.hair;
  if (L.style === 'short') { g.beginPath(); g.arc(cx, cy - 6 * sc, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(cx + r * 0.6, cy - r * 0.55, cx, cy - r * 0.6); g.quadraticCurveTo(cx - r * 0.6, cy - r * 0.55, cx - r * 1.0, cy - 8 * sc); g.fill(); }
  else if (L.style === 'wavy') { g.beginPath(); g.arc(cx, cy - 4 * sc, r * 1.08, Math.PI * 0.95, Math.PI * 2.05); for (let i = 0; i <= 6; i++) g.lineTo(cx + r * 1.05 - i * r * 0.35, cy - r * 0.45 + (i % 2) * 12 * sc); g.fill(); }
  else if (L.style === 'cap') { g.beginPath(); g.arc(cx, cy - 10 * sc, r * 1.02, Math.PI, Math.PI * 2); g.closePath(); g.fillStyle = L.cap; g.fill(); g.fillStyle = L.cap; g.beginPath(); g.ellipse(cx + f * r * 0.9 + (f >= 0 ? 10 : -10) * sc, cy - 12 * sc, r * 0.65, 9 * sc, 0, 0, Math.PI * 2); g.fill(); }
  else if (L.style === 'bun') { g.beginPath(); g.arc(cx, cy - 4 * sc, r * 1.05, Math.PI * 0.9, Math.PI * 2.1); g.quadraticCurveTo(cx + r * 0.2, cy - r * 0.35, cx - r * 1.03, cy + 4 * sc); g.fill(); g.beginPath(); g.arc(cx - f * 18 * sc, cy - r * 1.1, r * 0.38, 0, Math.PI * 2); g.fill(); }
}
function bubble(x, y, text, side, a, who) {
  g.save(); g.globalAlpha = a; g.font = '600 31px B';
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (g.measureText(tryL).width > 360 && cur) { lines.push(cur); cur = w; } else cur = tryL; }
  if (cur) lines.push(cur);
  const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 40, bh = lines.length * 38 + 26;
  let bx = side > 0 ? x + 20 : x - 20 - bw; bx = clamp(bx, 16, W - 16 - bw); const by = y - bh - 30;
  const sc = 0.85 + 0.15 * smooth(a * 1.5);
  g.translate(x, y); g.scale(sc, sc); g.translate(-x, -y);
  g.fillStyle = who === 'him' ? '#e9fbff' : '#ffffff'; g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18;
  g.beginPath(); g.roundRect(bx, by, bw, bh, 18); g.fill(); g.shadowBlur = 0;
  g.beginPath(); g.moveTo(clamp(x, bx + 24, bx + bw - 24) - 14, by + bh - 2); g.lineTo(x, y - 6); g.lineTo(clamp(x, bx + 24, bx + bw - 24) + 14, by + bh - 2); g.closePath(); g.fill();
  g.fillStyle = '#0b0e16'; g.textBaseline = 'top'; lines.forEach((l, i) => g.fillText(l, bx + 20, by + 14 + i * 38));
  g.restore();
}
function chip(x, y, text, rgb, ink = '#021a20', size = 26, align = 'center', a = 1) {
  g.save(); g.globalAlpha = a; g.font = `900 ${size}px BC`; const w = g.measureText(text).width + 24, h = size + 12;
  const x0 = clamp(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, 14, W - 14 - w);
  g.shadowColor = `rgba(${rgb},0.6)`; g.shadowBlur = 18; g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.roundRect(x0, y - h / 2, w, h, 4); g.fill();
  g.shadowBlur = 0; g.fillStyle = ink; g.textBaseline = 'middle'; g.fillText(text, x0 + 12, y + 2); g.restore();
  return w;
}

// ---------------------------------------------------------------- drawing: the brain
function spline(pts, close = true) {
  const n = pts.length; g.beginPath();
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) g.moveTo(p1[0], p1[1]);
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (close) g.closePath();
}
const toB = ([x, y]) => [BR.x + x * BR.w, BR.y + y * BR.h];
function brainBg(t) {
  const bg = g.createLinearGradient(0, TOP, 0, H); bg.addColorStop(0, '#060b16'); bg.addColorStop(1, '#03060c');
  g.fillStyle = bg; g.fillRect(0, TOP, W, H - TOP);
  g.strokeStyle = 'rgba(62,230,255,0.05)'; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x, TOP + 56); g.lineTo(x, H); g.stroke(); }
  for (let y = TOP + 56; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // the brain: soft fill, outline, lobes and folds
  const pts = OUTLINE.map(toB);
  spline(pts); const fill = g.createRadialGradient(BR.x + BR.w * 0.45, BR.y + BR.h * 0.4, 40, BR.x + BR.w * 0.5, BR.y + BR.h * 0.5, BR.w * 0.6);
  fill.addColorStop(0, 'rgba(40,62,96,0.55)'); fill.addColorStop(1, 'rgba(16,26,46,0.6)'); g.fillStyle = fill; g.fill();
  g.strokeStyle = 'rgba(150,200,255,0.55)'; g.lineWidth = 3; g.stroke();
  g.save(); spline(pts); g.clip();
  g.strokeStyle = 'rgba(150,200,255,0.16)'; g.lineWidth = 2.2;
  for (let k = 0; k < 22; k++) {
    const sx = 0.06 + ((k * 0.137) % 0.86), sy = 0.08 + ((k * 0.291) % 0.6); g.beginPath();
    for (let i = 0; i <= 10; i++) { const u = i / 10, [x, y] = toB([sx + u * 0.12, sy + Math.sin(u * 9 + k) * 0.03 + u * 0.05 * ((k % 3) - 1)]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(150,200,255,0.35)'; g.lineWidth = 3;
  spline([[0.26, 0.63], [0.36, 0.58], [0.47, 0.55], [0.58, 0.5]].map(toB), false); g.stroke(); // lateral fissure
  spline([[0.5, 0.02], [0.47, 0.18], [0.45, 0.32], [0.43, 0.48]].map(toB), false); g.stroke(); // central sulcus
  g.strokeStyle = 'rgba(150,200,255,0.18)';
  for (let k = 0; k < 5; k++) { spline([[0.68, 0.74 + k * 0.03], [0.78, 0.71 + k * 0.035], [0.9, 0.75 + k * 0.02]].map(toB), false); g.stroke(); } // cerebellum
  g.restore();
}
function act(n, t) { let a = 0; for (const [r, t0, t1, l] of ACT) if (r === n) a = Math.max(a, l * env(t, t0, t1, 0.18)); return a; }
function sigPath(a, b) { const A = bp(a), B = bp(b), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1; return { A, B, C: { x: mx - dy / L * L * 0.18, y: my + dx / L * L * 0.18 } }; }
const qb = (P, u) => ({ x: (1 - u) * (1 - u) * P.A.x + 2 * (1 - u) * u * P.C.x + u * u * P.B.x, y: (1 - u) * (1 - u) * P.A.y + 2 * (1 - u) * u * P.C.y + u * u * P.B.y });
function brain(t) {
  brainBg(t);
  // the practiced path, live: thicker every time it runs
  const fastK = t > F ? REPS.filter(r => t > r.t).length : 0;
  if (fastK) {
    const c = ['see', 'face', 'emo', 'tpj', 'mind', 'plan', 'speech'];
    g.save(); g.strokeStyle = `rgba(255,194,58,${0.18 + 0.16 * fastK})`; g.lineWidth = 3 + 5 * fastK; g.shadowColor = 'rgba(255,194,58,0.6)'; g.shadowBlur = 10 + 8 * fastK;
    for (let i = 0; i < c.length - 1; i++) { const P = sigPath(c[i], c[i + 1]); g.beginPath(); g.moveTo(P.A.x, P.A.y); g.quadraticCurveTo(P.C.x, P.C.y, P.B.x, P.B.y); g.stroke(); }
    g.restore();
  }
  // regions
  for (const [n, r] of Object.entries(R)) {
    const a = act(n, t), { x, y } = bp(n), rad = 26 + 26 * a;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad * 2.2); gr.addColorStop(0, `rgba(${r.col},${0.15 + 0.85 * a})`); gr.addColorStop(0.45, `rgba(${r.col},${0.05 + 0.45 * a})`); gr.addColorStop(1, `rgba(${r.col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 2.2, 0, Math.PI * 2); g.fill();
    g.save(); g.strokeStyle = `rgba(${r.col},${0.25 + 0.75 * a})`; g.lineWidth = 3; if (r.deep) g.setLineDash([8, 7]); g.beginPath(); g.arc(x, y, 20 + 8 * a, 0, Math.PI * 2); g.stroke(); g.restore();
    if (a > 0.08) {
      const lx = x + r.lx * 70, ly = y + r.ly * 64;
      g.save(); g.globalAlpha = smooth(a * 2); g.strokeStyle = `rgba(${r.col},0.8)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x + r.lx * 24, y + r.ly * 20); g.lineTo(lx, ly); g.stroke(); g.restore();
      chip(lx, ly, r.label + (r.deep ? ' ·' : ''), r.col, '#0a0d14', 26, r.lx > 0 ? 'left' : 'right', smooth(a * 2));
    }
  }
  // signals
  for (const [a, b, t0, d, die] of SIG) {
    const u = (t - t0) / d; if (u < 0 || u > 1.3) continue;
    const P = sigPath(a, b), col = R[b].col, end = Math.min(u, die), fade = die < 1 ? 1 - smooth((u - die * 0.7) / (die * 0.5)) : 1 - smooth((u - 1) / 0.3);
    g.save(); g.strokeStyle = `rgba(${col},${0.85 * fade})`; g.lineWidth = 6; g.lineCap = 'round'; g.shadowColor = `rgba(${col},${fade})`; g.shadowBlur = 16;
    g.beginPath(); for (let i = 0; i <= 16; i++) { const v = Math.max(0, end - 0.35) + (end - Math.max(0, end - 0.35)) * i / 16, p = qb(P, v); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke();
    const h = qb(P, end); g.fillStyle = `rgba(255,255,255,${fade})`; g.beginPath(); g.arc(h.x, h.y, 9, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // two things he knew, linked
  const la = env(t, LINK.t0, LINK.t1, 0.3);
  if (la > 0) {
    const m = bp('mem'), A = { x: m.x - 200, y: m.y + 130 }, B = { x: m.x + 210, y: m.y + 130 }, lk = smooth((t - LINK.at) / 0.5);
    g.save(); g.globalAlpha = la;
    g.strokeStyle = 'rgba(120,220,170,0.5)'; g.lineWidth = 2; g.setLineDash([6, 6]); for (const P of [A, B]) { g.beginPath(); g.moveTo(m.x, m.y + 20); g.lineTo(P.x, P.y); g.stroke(); } g.setLineDash([]);
    if (lk > 0) { g.strokeStyle = `rgba(255,194,58,${lk})`; g.lineWidth = 7; g.shadowColor = 'rgba(255,194,58,0.9)'; g.shadowBlur = 20; g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(m.x, m.y + 200, A.x + (B.x - A.x) * lk, A.y + (B.y - A.y) * lk + Math.sin(lk * Math.PI) * 50); g.stroke(); }
    g.restore();
    chip(A.x, A.y, LINK.a, '120,220,170', '#03140c', 24, 'center', la); chip(B.x, B.y, LINK.b, '120,220,170', '#03140c', 24, 'center', la);
    if (lk > 0.6) chip(m.x, m.y + 205, 'NEW LINK', '255,194,58', '#1a1200', 28, 'center', la * smooth((lk - 0.6) / 0.3));
  }
  // the loop clock
  for (const L of LOOP) {
    const a = env(t, L.t0, L.t1, 0.25); if (a <= 0) continue;
    let val = L.val;
    if (L.run) { const s = clamp(t - L.run[0], 0, L.run[1] - L.run[0]); val = `${s.toFixed(1)} s${t >= L.run[1] ? '  ✓' : ''}`; }
    const w = chip(W - 40, TOP + 100, `${L.text}:  ${val}`, L.col, '#04070c', 30, 'right', a);
    if (L.prev) chip(W - 40, TOP + 150, L.prev, '120,140,170', '#04070c', 24, 'right', a);
  }
  g.save(); g.font = '700 22px BC'; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText('SIMPLIFIED · DASHED = DEEP INSIDE', 40, TOP + 102); g.restore();
}

// ---------------------------------------------------------------- the frame
const hud = document.getElementById('hud');
hud.innerHTML = `<div class="warm">a<b>b</b><i>c</i><u>d</u></div>
  <div class="top"><div class="kick">READ THE ROOM</div><div class="title"><span></span></div></div>
  <div class="div"><span class="a">▲ WHAT HE DOES</span><span class="b">WHAT HIS BRAIN DOES ▼</span></div>
  <div class="cap"><div class="box"></div></div><div class="card"></div>`;
const $ = (s) => hud.querySelector(s);
const CARD = {
  intro: `<div class="k">BEHIND THE CURTAIN</div><div class="h">READ<br>THE ROOM</div><div class="s">Same guy, same room, twice.</div>
    <div class="two"><div><b class="w">TOP</b>what he does</div><div><b class="c">BOTTOM</b>what his brain does, at the same moment</div></div>
    <div class="list"><div class="o">1 · Checked out</div><div class="i">2 · Locked in</div><div>3 · Faster every time</div></div>`,
  flip: `<div class="k">REWIND</div><div class="h">SAME ROOM.<br><span style="color:var(--cyan)">LOCKED IN.</span></div>`,
  outro: `<div class="big"><em>Notice.</em></div><div class="big" style="margin-top:24px">Read.</div><div class="big" style="margin-top:24px">Adjust.</div><div class="big" style="margin-top:24px">Then get<br><em>creative.</em></div>
    <div class="src">The brain is simplified: real social thinking spreads across many areas at once. Reading others' minds: mPFC and TPJ, Schurz et al. 2014 ·
    Faces: fusiform face area, Kanwisher et al. 1997 · Social reward in the striatum: Izuma et al. 2008 · Conflict and error signals: anterior cingulate, Botvinick et al. 2004 ·
    Habits: basal ganglia, Graybiel 2008 · Mind wandering and the default network: Mason et al. 2007 · Stages of skill learning: Fitts & Posner 1967</div>`,
};
function cardAt(t) {
  if (t < O) return ['intro', 1 - smooth((t - (O - 0.35)) / 0.35)];
  if (t >= FL && t < I) return ['flip', smooth((t - FL) / 0.25) * (1 - smooth((t - (I - 0.25)) / 0.25))];
  if (t >= OUT) return ['outro', smooth((t - OUT) / 0.5)];
  return [null, 0];
}
let cardKind = null;
window.renderFrame = (i) => {
  const t0p = performance.now(), t = i / FPS;
  // the scene (during the intro and outro too, under the card)
  const st = t < O ? O + 0.4 : t >= OUT ? OUT - 0.01 : (t >= FL && t < I) ? FL - 0.01 : t;
  roomBg(st);
  const S = Object.fromEntries(Object.keys(K).map(w => [w, state(w, st)]));
  // talking: anyone with a bubble up
  for (const [w, a, b] of [...SAY, ...TALK]) if (st >= a && st < b) S[w].talk = 1;
  const order = ['B', 'A', 'C', 'him'], at = {};
  for (const w of order) at[w] = person(w, S[w], st);
  // his attention, locked in
  for (const [a, b, w] of EYES) {
    const k = env(st, a, b, 0.12); if (k <= 0) continue;
    const E = at.him.eyes, Hd = at[w].head;
    g.save(); g.globalAlpha = k; g.strokeStyle = 'rgba(62,230,255,0.9)'; g.lineWidth = 4; g.setLineDash([12, 10]); g.shadowColor = 'rgba(62,230,255,0.9)'; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(E.x + 20, E.y); g.lineTo(Hd.x, Hd.y); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(Hd.x, Hd.y, Hd.r + 12, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  // bubbles
  for (const [w, a, b, text] of SAY) { const k = env(st, a, b, 0.12); if (k <= 0) continue; const Hd = at[w].head; bubble(Hd.x + (w === 'C' ? -20 : 20), Hd.y - Hd.r - 6, text, w === 'C' || (w === 'B') ? -1 : 1, k, w); }
  // the reps, quicker every time
  for (const [j, r] of REPS.entries()) { const nx = REPS[j + 1] ? REPS[j + 1].t - 0.35 : OUT; const k = env(st, r.t - 0.3, Math.min(r.t + r.d + 1.0, nx), 0.15); if (k > 0) chip(W - 40, 205, r.n, '255,194,58', '#1a1200', 34, 'right', k); }
  brain(st);
  // HUD
  const part = PARTS.find(p => st >= p[0] && st < p[1]) || PARTS[0];
  const ti = $('.top .title'); ti.className = 'title ' + (part[2] === 'out' ? 'out' : part[2] === 'in' ? 'in' : '');
  const span = ti.querySelector('span'); if (span.textContent !== part[3]) span.textContent = part[3];
  const cap = CAPS.find(c => st >= c[0] && st < c[1]), box = $('.cap .box');
  if (cap) { if (box.innerHTML !== cap[2]) box.innerHTML = cap[2]; $('.cap').style.opacity = String(env(st, cap[0], cap[1], 0.2)); } else $('.cap').style.opacity = '0';
  const [ck, co] = cardAt(t), card = $('.card');
  if (ck) { if (cardKind !== ck) { cardKind = ck; card.innerHTML = CARD[ck]; card.className = 'card ' + ck; } card.style.opacity = String(co); } else card.style.opacity = '0';
  $('.top').style.opacity = String(ck === 'intro' || ck === 'outro' ? 1 - co : 1);
  return performance.now() - t0p;
};
// sounds: bubbles pop, signals blip (higher toward the front), the alarm buzzes, a landing chimes, the rewind whooshes
window.events = () => {
  const ev = { duration: END, pops: [], blips: [], buzz: [], chimes: [], whoosh: [{ t: FL }, { t: I }], room: [[O, FL], [I, OUT]] };
  for (const [, a] of SAY) ev.pops.push({ t: a });
  for (const [, b, t0] of SIG) ev.blips.push({ t: t0, pitch: 1.6 - R[b].p[0] });
  for (const [r, t0] of ACT) { if (r === 'off') ev.buzz.push({ t: t0 }); if (r === 'reward') ev.chimes.push({ t: t0 }); }
  return ev;
};
window.__frames = Math.round(END * FPS); window.__fps = FPS;
document.fonts.ready.then(async () => {
  await Promise.all(['600 31px B', '700 30px B', '900 30px BC', '700 22px BC', '800 26px BC'].map(f => document.fonts.load(f)));
  window.renderFrame(0); window.__ready = true;
});
