// v6 "get up" sequence at 30 fps: title card; rep 1, the approach broken down (speed, the big step, the plant, the
// arms) into a rim touch from under the rim; rep 2, the same approach faster with the ball into the dunk, frozen at
// the top, the throw-down in slow motion, a replay; closing card. Captions can quote measured numbers ({touch.drop}).
export const FPS = 30;
export const REP_TITLES = { touch: '1 · APPROACH + RIM TOUCH', dunk: '2 · DUNK IT' };
// key moments (sim s), from the reps: touch - big step 1.947, low point 2.10, takeoff 2.272, touch 2.624, landing 2.999;
// dunk - big step 1.65, takeoff 1.925, ball cocked 2.32, release 2.465, grab 2.51, landing 2.845
export const SEQ = [
  { card: 'intro', rep: 'touch', cam: 'side', freeze: 0.25, dur: 3.0 },

  { rep: 'touch', cam: 'side', from: 0.25, to: 1.55, rate: 0.8, caption: 'Walk in, then build it:<br><b>your fastest steps are the last ones.</b>' },
  { rep: 'touch', cam: 'side', from: 1.55, to: '@plant0', rate: 0.4 },
  { rep: 'touch', cam: 'side', freeze: '@plant0', dur: 3.0, caption: 'Forget "long step, short step."<br><b>Speed into the plant</b> predicted jump height<br>best in a study of 21 players (r = 0.92).' },
  { rep: 'touch', cam: 'side', freeze: '@plant0', dur: 3.0, show: 'angle', caption: 'Feet land <b>ahead of the hips</b> ({touch.angle}°).<br>The further ahead, the higher they jumped:<br>it stops the run and turns it up.' },
  { rep: 'touch', cam: 'side', from: '@plant0', to: 2.10, rate: 0.35, show: 'hips', caption: 'The big step loads you:<br><b>hips drop {touch.drop} in.</b>' },
  { rep: 'touch', cam: 'side', freeze: 2.10, dur: 2.6, show: 'hips', caption: 'Arms are back. <b>Punch them up:</b><br>in a standing jump they add 3.4 in.' },
  { rep: 'touch', cam: 'side', from: 2.10, to: 2.30, rate: 0.35 },
  { rep: 'touch', cam: 'rim', from: 2.30, to: '@touch', rate: 0.45 },
  { rep: 'touch', cam: 'rim', freeze: '@touch', dur: 2.8, caption: '<b>Rim touched.</b> At 6\'5" with an 8\'7" reach<br>it takes 17 in. This jump: {touch.vert} in.' },
  { rep: 'touch', cam: 'rim', from: '@touch', to: 2.86, rate: 0.7 },

  { rep: 'dunk', cam: 'side', from: 0.25, to: 1.45, rate: 0.85, caption: 'Now the ball. Same approach, faster:<br><b>top speed {dunk.top} m/s ({dunk.topmph} mph).</b>' },
  { rep: 'dunk', cam: 'side', from: 1.45, to: 1.95, rate: 0.4, caption: 'Both hands on it on the big step.<br><b>The ball goes up with the jump,</b> not after.' },
  { rep: 'dunk', cam: 'rim', from: 1.95, to: '@cock', rate: 0.45 },
  { rep: 'dunk', cam: 'rim', freeze: '@cock', dur: 2.8, caption: 'Top of the jump, ball cocked back:<br><b>{dunk.clear} in clear of the rim.</b>' },
  { rep: 'dunk', cam: 'rim', from: '@cock', to: 2.62, rate: 0.3 },
  { rep: 'dunk', cam: 'rim', from: 2.62, to: 2.85, rate: 0.9 },
  { rep: 'dunk', cam: 'replay', from: 1.75, to: 2.58, rate: 0.35, replay: true },
  { rep: 'dunk', cam: 'replay', freeze: 2.58, dur: 2.8, caption: 'Hang time {dunk.hang} s = <b>a {dunk.vert}-in jump.</b><br>Dunk-contest finalists averaged<br>40 in at the NBA combine.' },

  { card: 'outro', rep: 'dunk', cam: 'replay', freeze: 2.58, dur: 3.2 },
];

// '@plant0' (heel strike of the big step), '@touch' (hand on the rim), '@cock' (ball cocked back) are measured
// moments of each rep: resolve them into sim times once the reps are built
export function resolveSeq(reps) {
  const at = (rep, v) => typeof v !== 'string' ? v : { '@plant0': rep.M.tPlant0, '@touch': rep.touch && rep.touch.t, '@cock': rep.d && rep.d.cock }[v];
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (s[k] !== undefined) s[k] = at(reps[s.rep], s[k]);
}
export function buildTimeMap(fps = FPS) {
  const frames = []; let vt = 0;
  SEQ.forEach((s, k) => {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.freeze, vt: vt + i / fps, freeze: true, fu: i / n, card: s.card, caption: s.caption, rate: 0, show: s.show });
      vt += n / fps;
    } else {
      const n = Math.round((s.to - s.from) / s.rate * fps);
      for (let i = 0; i < n; i++) frames.push({ seg: k, rep: s.rep, cam: s.cam, st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate, caption: s.caption, su: i / n, replay: s.replay, show: s.show });
      vt += n / fps;
    }
  });
  return frames;
}
