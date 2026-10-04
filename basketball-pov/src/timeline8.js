// v8 "make him move" sequence at 30 fps: title, four reps (live into the move, a freeze on his reaction, slow motion
// through the move and the rise, a cut to the rim for the result, a closing freeze), outro. Symbolic times ('@fake')
// are measured moments of each rep, resolved once the reps are built; {rep.key} in a caption is a measured number.
export const FPS = 30;
export const REP_TITLES = {
  headfake: '1 · HEAD FAKE',
  jab: '2 · SHOULDER FAKE',
  hesi: '3 · HESI PULL-UP',
  stepback: '4 · STEP-BACK',
};
export const SEQ = [
  { card: 'intro', rep: 'headfake', cam: 'duel', freeze: 0.1, dur: 3.4 },

  { rep: 'headfake', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'He closes out hard. <b>Let him come.</b>' },
  { rep: 'headfake', cam: 'duel', freeze: '@bite', dur: 2.6, caption: 'Sell the shot: ball to your forehead,<br><b>eyes on the rim.</b> He leaves his feet.' },
  { rep: 'headfake', cam: 'duel', from: '@bite', to: '@gather', rate: 0.45, caption: 'He\'s in the air {headfake.air} s: he can\'t change<br>direction. <b>One hard dribble by him.</b>' },
  { rep: 'headfake', cam: 'duel', from: '@gather', to: '@shot', rate: 0.45, caption: '<b>Stop and rise.</b>' },
  { rep: 'headfake', cam: 'rim', from: '@shot', to: '@net', rate: 0.8 },
  { rep: 'headfake', cam: 'rim', freeze: '@net', dur: 2.2, caption: '{headfake.sep} ft of space. <b>You didn\'t outrun<br>him: you made him jump.</b>' },

  { rep: 'jab', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'He\'s quicker than you.<br><b>Make him guess first.</b>' },
  { rep: 'jab', cam: 'duel', freeze: '@bite', dur: 2.6, caption: 'Jab and dip your shoulder left:<br><b>his weight goes with it.</b>' },
  { rep: 'jab', cam: 'duel', from: '@bite', to: '@shot', rate: 0.45, caption: 'Go the other way. He has to stop,<br>re-plant and come back. <b>Rise.</b>' },
  { rep: 'jab', cam: 'rim', from: '@shot', to: '@net', rate: 0.8 },
  { rep: 'jab', cam: 'rim', freeze: '@net', dur: 2.2, caption: '{jab.sep} ft. He went {jab.wrong} m the wrong way:<br><b>quicker than you, and still late.</b>' },

  { rep: 'hesi', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'He\'s quicker: he runs with you,<br><b>a half step ahead.</b>' },
  { rep: 'hesi', cam: 'duel', freeze: '@bite', dur: 3.0, caption: '<b>Hesi: stop on a dime.</b> He needs ~0.22 s<br>just to see it: at your speed that\'s<br><b>{hesi.react} m before he even brakes.</b>' },
  { rep: 'hesi', cam: 'duel', from: '@bite', to: '@shot', rate: 0.45, caption: 'He goes on by. <b>Rise.</b>' },
  { rep: 'hesi', cam: 'rim', from: '@shot', to: '@net', rate: 0.8 },
  { rep: 'hesi', cam: 'rim', freeze: '@net', dur: 2.2, caption: '{hesi.sep} ft. <b>You stopped first:</b><br>that\'s all it took.' },

  { rep: 'stepback', cam: 'duel', from: 0.0, to: '@bite', rate: 0.75, caption: 'Attack him. <b>He sits down<br>to cut off the drive.</b>' },
  { rep: 'stepback', cam: 'duel', freeze: '@bite', dur: 2.6, caption: 'Cross: he jumps to cut it off.<br><b>His weight is going sideways.</b>' },
  { rep: 'stepback', cam: 'duel', from: '@bite', to: '@shot', rate: 0.45, caption: '<b>Snatch it back and hop back.</b><br>He\'s still sliding the other way.' },
  { rep: 'stepback', cam: 'rim', from: '@shot', to: '@net', rate: 0.8 },
  { rep: 'stepback', cam: 'rim', freeze: '@net', dur: 2.2, caption: '{stepback.sep} ft. <b>Shoot it over him<br>before he re-plants.</b>' },

  { card: 'outro', rep: 'stepback', cam: 'rim', freeze: '@net', dur: 3.6 },
];

// resolve the measured moments: '@bite' (his reaction shows), '@gather' (ball in both
// hands for the shot), '@shot' (just after the release), '@net' (the ball through the net)
export function buildTimeMap(reps, fps = FPS) {
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (typeof s[k] === 'string') {
    const P = reps[s.rep].plan;
    s[k] = { '@bite': P.marks.bite, '@gather': P.gatherAt, '@shot': P.release + 0.12, '@net': P.rim + 0.32 }[s[k]];
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
