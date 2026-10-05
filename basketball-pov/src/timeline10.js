// v10 "shoot over him" sequence at 30 fps: title, the iso broken into its three beats (a freeze on each: the gather,
// the set, the rise over his hand) and the result, then the same iso without the stop, outro. Symbolic times ('@set')
// are measured moments of each rep; {rep.key} in a caption is a measured number.
export const FPS = 30;
export const REP_TITLES = { iso: '1 · GATHER, SET, RISE', drift: '2 · DON\'T DRIFT' };
export const SEQ = [
  { card: 'intro', rep: 'iso', cam: 'duel', freeze: 0.1, dur: 3.6 },

  { rep: 'iso', cam: 'duel', from: 0.0, to: 1.45, rate: 0.8, caption: 'Iso. He\'s set, a stride off,<br><b>and he won\'t bite.</b>' },
  { rep: 'iso', cam: 'duel', from: 1.45, to: '@gather', rate: 0.45, caption: 'One hard dribble at him.' },
  { rep: 'iso', cam: 'duel', freeze: '@gather', dur: 3.0, caption: '<b>GATHER:</b> take it on the way up, both hands,<br>into your shooting pocket. From here<br>you get <b>two steps</b>.' },
  { rep: 'iso', cam: 'duel', from: '@gather', to: '@set', rate: 0.35 },
  { rep: 'iso', cam: 'duel', freeze: '@set', dur: 3.0, caption: '<b>SET:</b> 1-2. Feet shoulder-width, toes at<br>the rim, knees bent. <b>Your momentum<br>stops here.</b>' },
  { rep: 'iso', cam: 'duel', from: '@set', to: '@rise', rate: 0.35, caption: 'Straight up, ball up the middle.' },
  { rep: 'iso', cam: 'duel', freeze: '@rise', dur: 3.6, show: 'heights', caption: '<b>RISE:</b> release at the top. He jumps when<br>he sees you go, about 0.2 s late:<br><b>the ball is already over his hand.</b>' },
  { rep: 'iso', cam: 'duel', from: '@rise', to: '@shot', rate: 0.5 },
  { rep: 'iso', cam: 'rim', from: '@shot', to: '@net', rate: 0.8 },
  { rep: 'iso', cam: 'rim', freeze: '@net', dur: 2.4, caption: '{iso.sep} ft, hand up, and it\'s good.<br>You landed {iso.drift} m from your takeoff:<br><b>straight up, straight down.</b>' },

  { rep: 'drift', cam: 'duel', from: 0.0, to: '@gather', rate: 0.75, caption: 'Same iso, off a hard drive.' },
  { rep: 'drift', cam: 'duel', from: '@gather', to: '@rise', rate: 0.4, caption: 'No stop: <b>you take off still<br>going forward.</b>' },
  { rep: 'drift', cam: 'duel', freeze: '@rise', dur: 3.0, caption: 'You float {drift.drift} m into him: <b>{drift.sep} ft</b><br>at the release, and the drive\'s speed<br><b>goes into the shot.</b>' },
  { rep: 'drift', cam: 'duel', from: '@rise', to: '@shot', rate: 0.5 },
  { rep: 'drift', cam: 'rim', from: '@shot', to: '@miss', rate: 0.8 },
  { rep: 'drift', cam: 'rim', freeze: '@miss', dur: 2.2, caption: 'Long. <b>Stop first, then rise.</b>' },

  { card: 'outro', rep: 'drift', cam: 'rim', freeze: '@miss', dur: 3.8 },
];

// resolve the measured moments: '@gather' (both hands on it, first foot down), '@set' (the dip on both feet), '@rise'
// (the release), '@shot' (just after it), '@net' (through the net), '@miss' (off the rim)
export function buildTimeMap(reps, fps = FPS) {
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (typeof s[k] === 'string') {
    const P = reps[s.rep].plan;
    s[k] = { '@gather': P.beats.gather, '@set': P.beats.set, '@rise': P.beats.rise, '@shot': P.release + 0.12, '@net': P.rim + 0.32, '@miss': P.rim + 0.16 }[s[k]];
  }
  const frames = []; let vt = 0;
  SEQ.forEach((s, k) => {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.freeze, vt: vt + i / fps, freeze: true, fu: i / n, card: s.card, caption: s.caption, rate: 0, show: s.show });
      vt += n / fps;
    } else {
      const n = Math.round((s.to - s.from) / s.rate * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate, caption: s.caption, su: i / n, show: s.show });
      vt += n / fps;
    }
  });
  return frames;
}
