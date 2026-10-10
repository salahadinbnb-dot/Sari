// v9 "lockdown" sequence at 30 fps: title, the reps (live into his move, a freeze on what you did, slow motion through
// his shot and your contest, a cut to the rim for the miss), outro. Symbolic times ('@bite') are measured moments of
// each rep, resolved once the reps are built; {rep.key} in a caption is a measured number.
export const FPS = 30;
export const REP_TITLES = {
  staydown: '1 · STAY DOWN',
  mirror: '2 · MIRROR THE CROSS',
  help: '3 · HELP AND RECOVER',
};
export const SEQ = [
  { card: 'intro', rep: 'staydown', cam: 'duel', freeze: 0.1, dur: 3.4 },

  { rep: 'staydown', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'Same move that beat the slow guy\'s man.<br><b>Close out short, hands up.</b>' },
  { rep: 'staydown', cam: 'duel', freeze: '@bite', dur: 2.6, caption: 'He sells the shot. <b>Hand up,<br>feet down:</b> you didn\'t bite.' },
  { rep: 'staydown', cam: 'duel', from: '@bite', to: '@shot', rate: 0.55, caption: 'He breaks. <b>Slide with him</b> and beat<br>him to the spot. Make him shoot over you.' },
  { rep: 'staydown', cam: 'rim', from: '@shot', to: '@miss', rate: 0.8 },
  { rep: 'staydown', cam: 'rim', freeze: '@miss', dur: 2.2, caption: 'Contested at {staydown.sep} ft. <b>Miss.</b>' },

  { rep: 'mirror', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'He attacks. <b>Hold your ground</b><br>an arm\'s length off.' },
  { rep: 'mirror', cam: 'duel', freeze: '@bite', dur: 2.6, caption: 'Cross and back: <b>slide, don\'t lunge.</b><br>Chest in front, hands off the ball.' },
  { rep: 'mirror', cam: 'duel', from: '@bite', to: '@shot', rate: 0.45, caption: 'Nowhere to go: he has to rise<br><b>with you right there.</b>' },
  { rep: 'mirror', cam: 'rim', from: '@shot', to: '@miss', rate: 0.8 },
  { rep: 'mirror', cam: 'rim', freeze: '@miss', dur: 2.2, caption: 'Contested at {mirror.sep} ft. <b>Miss.</b>' },

  { rep: 'help', cam: 'team', from: 0.0, to: '@bite', rate: 0.75, caption: 'Your teammate gets beat.<br><b>You\'re the help.</b>' },
  { rep: 'help', cam: 'team', freeze: '@bite', dur: 2.6, caption: 'Sprint over and <b>stop the ball</b><br>before he gets to the rim.' },
  { rep: 'help', cam: 'team', from: '@bite', to: '@pass', rate: 0.5, caption: 'He kicks it to your man.<br><b>Go on the pass.</b>' },
  { rep: 'help', cam: 'duel', from: '@pass', to: '@shot', rate: 0.5, caption: 'Short steps the last stride, <b>hand high.</b><br>Don\'t fly by him.' },
  { rep: 'help', cam: 'rim', from: '@shot', to: '@miss', rate: 0.8 },
  { rep: 'help', cam: 'rim', freeze: '@miss', dur: 2.2, caption: 'Contested at {help.sep} ft. <b>Miss.</b><br>One stop, two of you.' },

  { card: 'outro', rep: 'help', cam: 'rim', freeze: '@miss', dur: 3.6 },
];

// resolve the measured moments: '@bite' (his move and your answer), '@pass' (just after the kick-out), '@shot' (just
// after the release), '@miss' (the ball off the rim)
export function buildTimeMap(reps, fps = FPS) {
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (typeof s[k] === 'string') {
    const P = reps[s.rep].plan;
    s[k] = { '@bite': P.marks.bite, '@pass': P.marks.pass + 0.3, '@shot': P.release + 0.12, '@miss': P.rim + 0.16 }[s[k]];
  }
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
