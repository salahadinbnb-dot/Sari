// v11 "behind the curtain" sequence at 30 fps: title; each rep once as it looks in the gym (real life), then the
// picture splits down the middle and slides apart like a curtain onto the same rep from the start, dark, in slow
// motion, with what he's running drawn over it (behind the curtain); a card for the night between rep 3 and rep 6;
// outro. Times are sim seconds of each rep; '@...' marks resolve per rep in buildTimeMap.
export const FPS = 30;
export const REP_TITLES = { rep1: '1 · THINKING IT', rep3: '2 · WIRING IT', rep6: '3 · OWNING IT', live: '4 · MAKING IT HIS' };
export const SEQ = [
  { card: 'intro', rep: 'rep1', cam: 'duel', freeze: 0.1, dur: 3.8 },

  { rep: 'rep1', cam: 'duel', from: 0.0, to: '@shot', rate: 1, caption: 'Rep 1 of a new move.' },
  { rep: 'rep1', cam: 'rim', from: '@shot', to: '@miss', rate: 1 },
  { rep: 'rep1', cam: 'rim', freeze: '@miss', dur: 0.9, caption: 'Short.' },
  { rep: 'rep1', cam: 'duel', freeze: 0.25, dur: 1.1, curtain: true },
  { rep: 'rep1', cam: 'duel', from: 0.25, to: '@cross', rate: 0.5, behind: true },
  { rep: 'rep1', cam: 'duel', freeze: '@cross', dur: 3.4, behind: true, caption: 'He\'s talking himself through it:<br><b>five steps, five separate calls.</b><br>And his eyes are on the ball.' },
  { rep: 'rep1', cam: 'duel', from: '@cross', to: '@rel', rate: 0.5, behind: true },
  { rep: 'rep1', cam: 'duel', freeze: '@rel', dur: 3.0, behind: true, caption: 'The hop back takes <b>{rep1.hop} s</b>.<br>His man gets back: {rep1.sep} ft,<br><b>and it comes up short.</b>' },

  { rep: 'rep3', cam: 'duel', from: 0.0, to: '@shot', rate: 1, caption: 'Rep 3.' },
  { rep: 'rep3', cam: 'rim', from: '@shot', to: '@net', rate: 1 },
  { rep: 'rep3', cam: 'duel', freeze: 0.25, dur: 1.1, curtain: true },
  { rep: 'rep3', cam: 'duel', from: 0.25, to: '@hop1', rate: 0.5, behind: true, show: 'ghost' },
  { rep: 'rep3', cam: 'duel', freeze: '@hop1', dur: 3.6, behind: true, show: 'ghost', caption: 'He fixes <b>one thing</b> a rep: the hop,<br>{rep1.hop} s → {rep3.hop} s. Dashed is where rep 1<br>was by now. <b>Two chunks</b>, not five.' },
  { rep: 'rep3', cam: 'duel', from: '@hop1', to: '@rel', rate: 0.5, behind: true },

  { card: 'night', rep: 'rep6', cam: 'duel', freeze: 0.1, dur: 3.4 },

  { rep: 'rep6', cam: 'duel', from: 0.0, to: '@shot', rate: 1, caption: 'Rep 6.' },
  { rep: 'rep6', cam: 'rim', from: '@shot', to: '@net', rate: 1 },
  { rep: 'rep6', cam: 'duel', freeze: 0.25, dur: 1.1, curtain: true },
  { rep: 'rep6', cam: 'duel', freeze: 0.3, dur: 3.4, behind: true, caption: '<b>One chunk.</b> One call fires the whole move,<br>so there\'s nothing to think through, and<br>his eyes come up: <b>onto his man\'s hips.</b>' },
  { rep: 'rep6', cam: 'duel', from: 0.3, to: '@rel', rate: 0.5, behind: true },
  { rep: 'rep6', cam: 'duel', freeze: '@rel', dur: 2.6, behind: true, caption: 'A {rep6.hop} s hop. He\'s gone before<br>his man is back: <b>{rep6.sep} ft.</b>' },

  { rep: 'live', cam: 'duel', from: 0.0, to: '@shot', rate: 1, caption: 'Live.' },
  { rep: 'live', cam: 'rim', from: '@shot', to: '@net', rate: 1 },
  { rep: 'live', cam: 'duel', freeze: 0.25, dur: 1.1, curtain: true },
  { rep: 'live', cam: 'duel', from: 0.25, to: '@hop0', rate: 0.5, behind: true },
  { rep: 'live', cam: 'duel', from: '@hop0', to: '@read', rate: 0.5, behind: true, show: 'read' },
  { rep: 'live', cam: 'duel', freeze: '@read', dur: 3.4, behind: true, show: 'read', caption: 'His man has learned it too: he barely<br>bites on the cross, and <b>he\'s running at<br>the step-back.</b> Read: his weight\'s coming.' },
  { rep: 'live', cam: 'duel', from: '@read', to: '@fake0', rate: 0.5, behind: true, show: 'read' },
  { rep: 'live', cam: 'duel', freeze: '@fake0', dur: 3.6, behind: true, show: 'options', caption: 'So he flips it: <b>sell the step-back shot</b>.<br>A piece he already owns, the shot fake,<br>in a new place.' },
  { rep: 'live', cam: 'duel', from: '@fake0', to: '@rel', rate: 0.5, behind: true },
  { rep: 'live', cam: 'duel', freeze: '@rel', dur: 3.0, behind: true, caption: 'He\'s still coming down<br>when you go up.<br><b>A new move, made of old pieces.</b>' },

  { card: 'outro', rep: 'live', cam: 'rim', freeze: '@net', dur: 4.4 },
];

// '@shot' (just after the release), '@net' (through the net), '@miss' (off the rim), '@rel' (the release), and the
// move's parts: '@legs', '@cross', '@back', '@hop0'/'@hop1' (the hop back), '@fake' (top of the shot fake), '@fake0'
// (the ball starting up into it)
export function buildTimeMap(reps, fps = FPS) {
  const frames = []; let vt = 0;
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (typeof s[k] === 'string') {
    const P = reps[s.rep].plan, Q = P.parts;
    const at = { '@shot': P.release + 0.12, '@net': P.rim + 0.32, '@miss': P.rim + 0.16, '@rel': P.release - 0.01,
      '@legs': Q.legs, '@cross': Q.cross + 0.02, '@back': Q.back, '@hop0': Q.hop0 + 0.06, '@hop1': Q.hop1, '@fake': Q.fake, '@fake0': Q.fake - 0.3, '@read': Q.hop1 - 0.04 }[s[k]];
    if (at === undefined) throw new Error(`timeline: no ${s[k]} for ${s.rep}`);
    s[k] = at;
  }
  SEQ.forEach((s, k) => {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.freeze, vt: vt + i / fps, freeze: true, fu: i / n, card: s.card, caption: s.caption, rate: 0, behind: !!s.behind, curtain: s.curtain ? i / n : null, show: s.show });
      vt += n / fps;
    } else {
      const n = Math.round((s.to - s.from) / s.rate * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.from + i / fps * s.rate, vt: vt + i / fps, freeze: false, fu: i / n, caption: s.caption, rate: s.rate, behind: !!s.behind, curtain: null, show: s.show });
      vt += n / fps;
    }
  });
  return frames;
}
