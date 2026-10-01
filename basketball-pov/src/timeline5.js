// v5 "read his weight" sequence at 30 fps: title, four reps (live at ~0.75x into the read, a freeze with the
// coaching point, slow motion through the rise, a cut to the rim for the result, a closing freeze), outro.
export const FPS = 30;
export const REP_TITLES = {
  contested: '1 · CONTESTED MAKE',
  heels: '2 · ON HIS HEELS',
  lean: '3 · ON THE LEAN',
  contact: '4 · CONTACT FINISH',
};
export const SEQ = [
  { card: 'intro', rep: 'contested', cam: 'duel', freeze: 0.25, dur: 2.2 },

  { rep: 'contested', cam: 'duel', from: 0.25, to: 1.55, rate: 0.8 },
  { rep: 'contested', cam: 'duel', freeze: 1.55, dur: 1.7, caption: "He's balanced, weight on his toes.<br>He can still contest." },
  { rep: 'contested', cam: 'duel', from: 1.55, to: 2.25, rate: 0.45 },
  // rim freezes land with the ball half way through the net (rim time + 0.12)
  { rep: 'contested', cam: 'rim', from: 2.25, to: 3.24, rate: 0.8 },
  { rep: 'contested', cam: 'rim', freeze: 3.24, dur: 1.5, caption: 'It went in.<br><b>Still the wrong time to shoot.</b>' },

  { rep: 'heels', cam: 'duel', from: 0.3, to: 1.32, rate: 0.75 },
  { rep: 'heels', cam: 'duel', freeze: 1.32, dur: 1.8, caption: 'Drive him back. His weight is<br>still going away from you.' },
  { rep: 'heels', cam: 'duel', from: 1.32, to: 1.95, rate: 0.42, caption: '<b>Rise right there.</b>' },
  { rep: 'heels', cam: 'rim', from: 1.95, to: 2.89, rate: 0.8 },
  { rep: 'heels', cam: 'rim', freeze: 2.89, dur: 1.4, caption: "He can't jump back toward you.<br><b>Clean look.</b>" },

  { rep: 'lean', cam: 'duel', from: 0.3, to: 1.12, rate: 0.75 },
  { rep: 'lean', cam: 'duel', freeze: 1.12, dur: 1.8, caption: 'Jab. He bites:<br>hips outside his feet.' },
  { rep: 'lean', cam: 'duel', from: 1.12, to: 1.8, rate: 0.42, caption: '<b>Rise before he re-plants.</b>' },
  { rep: 'lean', cam: 'rim', from: 1.8, to: 2.77, rate: 0.8 },
  { rep: 'lean', cam: 'rim', freeze: 2.77, dur: 1.2, caption: '<b>By the time he recovers, it\'s gone.</b>' },

  { rep: 'contact', cam: 'finish', from: 0.2, to: 1.38, rate: 0.75 },
  { rep: 'contact', cam: 'finish', freeze: 1.38, dur: 1.8, caption: "He's still sliding, not set.<br><b>Hit him first.</b>" },
  { rep: 'contact', cam: 'finish', from: 1.38, to: 2.0, rate: 0.4, caption: 'Absorb it. Ball high,<br>away from him.' },
  { rep: 'contact', cam: 'finish', from: 2.0, to: 2.43, rate: 0.6 },
  { rep: 'contact', cam: 'finish', freeze: 2.43, dur: 1.5, caption: '<b>Off the glass. And-one.</b>' },

  { card: 'outro', rep: 'contact', cam: 'finish', freeze: 2.43, dur: 2.4 },
];

export function buildTimeMap(fps = FPS) {
  const frames = []; let vt = 0;
  SEQ.forEach((s, k) => {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.freeze, vt: vt + i / fps, freeze: true, fu: i / n, card: s.card, caption: s.caption, rate: 0 });
      vt += n / fps;
    } else {
      const n = Math.round((s.to - s.from) / s.rate * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate, caption: s.caption, su: i / n });
      vt += n / fps;
    }
  });
  return frames;
}
