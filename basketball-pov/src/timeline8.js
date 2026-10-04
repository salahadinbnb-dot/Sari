// v8 "make him move" sequence at 30 fps: title, the reps (live into the move, a freeze on his reaction, slow motion
// through the stop and the rise, a cut to the rim for the result), outro.
export const FPS = 30;
export const REP_TITLES = {
  headfake: '1 · HEAD FAKE',
  jab: '2 · SHOULDER FAKE',
};
export const SEQ = [
  { card: 'intro', rep: 'headfake', cam: 'duel', freeze: 0.2, dur: 3.0 },

  { rep: 'headfake', cam: 'duel', from: 0.0, to: 0.95, rate: 0.75 },
  { rep: 'headfake', cam: 'duel', freeze: 0.95, dur: 2.4, caption: 'Sell it: ball to your forehead,<br><b>eyes on the rim.</b> He leaves his feet.' },
  { rep: 'headfake', cam: 'duel', from: 0.95, to: 3.4, rate: 0.5 },
  { rep: 'headfake', cam: 'rim', from: 3.4, to: 4.3, rate: 0.8 },

  { rep: 'jab', cam: 'duel', from: 0.0, to: 3.0, rate: 0.5 },
  { card: 'outro', rep: 'headfake', cam: 'rim', freeze: 4.3, dur: 3.0 },
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
