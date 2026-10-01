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
  { card: 'intro', rep: 'contested', cam: 'duel', freeze: 0.3, dur: 2.2 },

  { rep: 'contested', cam: 'duel', from: 0.0, to: 1.08, rate: 0.75 },
  { rep: 'contested', cam: 'duel', freeze: 1.08, dur: 2.4, caption: "Sprint, then chop steps: hips down,<br>hand up, feet under him. <b>He arrived balanced.</b>" },
  { rep: 'contested', cam: 'duel', from: 1.08, to: 1.85, rate: 0.45, caption: "You rise into a hand that's<br>already there." },
  { rep: 'contested', cam: 'rim', from: 1.85, to: 2.78, rate: 0.8 },
  { rep: 'contested', cam: 'rim', freeze: 2.78, dur: 2.2, caption: "It went in. Still a tight look:<br><b>NBA catch-and-shoot 3s: 31.8% tight,<br>39.1% wide open</b> (2024-25)." },

  { rep: 'heels', cam: 'duel', from: 0.0, to: 0.78, rate: 0.75 },
  { rep: 'heels', cam: 'duel', freeze: 0.78, dur: 2.4, caption: "Hard first step. He drops back to stay<br>in front: <b>his weight is going away from you.</b>" },
  { rep: 'heels', cam: 'duel', from: 0.78, to: 1.45, rate: 0.42, caption: "<b>Rise now</b>, while he's still backing up." },
  { rep: 'heels', cam: 'rim', from: 1.45, to: 2.52, rate: 0.8 },
  { rep: 'heels', cam: 'rim', freeze: 2.52, dur: 2.0, caption: "To contest he has to stop, re-plant<br>and come forward. <b>Too late.</b><br>NBA pull-up 3s: 36.3% wide open, 27.5% tight." },

  { rep: 'lean', cam: 'duel', from: 0.0, to: 1.45, rate: 0.75 },
  { rep: 'lean', cam: 'duel', freeze: 1.45, dur: 2.4, caption: "Second cross. He slides hard to cut it off:<br><b>hips past his feet, weight going sideways.</b>" },
  { rep: 'lean', cam: 'duel', from: 1.45, to: 2.2, rate: 0.42, caption: "<b>Stop and rise into the gap</b><br>before he can plant and push back." },
  { rep: 'lean', cam: 'rim', from: 2.2, to: 3.3, rate: 0.8 },
  { rep: 'lean', cam: 'rim', freeze: 3.3, dur: 2.0, caption: "Even good defenders need about half<br>a second to answer a move.<br><b>Shoot inside that window.</b>" },

  { rep: 'contact', cam: 'finish', from: 0.0, to: 1.3, rate: 0.75 },
  { rep: 'contact', cam: 'finish', freeze: 1.3, dur: 2.6, caption: "He's still sliding over. A defender can't<br>move into your path <b>once your upward<br>motion starts</b>, and on a drive that's the gather." },
  { rep: 'contact', cam: 'finish', from: 1.3, to: 1.95, rate: 0.4, caption: "<b>Initiate before you elevate:</b> shoulder<br>into his chest, ball high, on the far side." },
  { rep: 'contact', cam: 'finish', from: 1.95, to: 2.4, rate: 0.6 },
  { rep: 'contact', cam: 'finish', freeze: 2.4, dur: 2.2, caption: "Off the glass. <b>Block on him, and-one.</b><br>Set outside the 4-ft arc first? That's a charge." },

  { card: 'outro', rep: 'contact', cam: 'finish', freeze: 2.4, dur: 2.6 },
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
