// v7 "get your hands on it" sequence at 30 fps. Symbolic times ('@strike') are measured moments of each rep,
// resolved once the reps are built.
export const FPS = 30;
export const REP_TITLES = { cross: '1 · ON THE BALL', trail: '2 · HE BEAT YOU', lane: '3 · OFF THE BALL' };
export const SEQ = [
  { card: 'intro', rep: 'cross', cam: 'over', freeze: 0.2, dur: 3.4 },

  { rep: 'cross', cam: 'over', from: 0.0, to: '@prot', rate: 0.75, caption: 'A good dribbler keeps it on his side,<br><b>his body between it and you.</b>' },
  { rep: 'cross', cam: 'over', freeze: '@prot', dur: 2.6, caption: 'Reach now: he\'s by you, or it\'s a foul.<br><b>His hand is on it {cross.hand}% of the time,</b><br>his body covers the rest.' },
  { rep: 'cross', cam: 'over', from: '@prot', to: '@strike', rate: 0.3, caption: 'It only comes to you <b>when he crosses it<br>in front of him.</b>' },
  { rep: 'cross', cam: 'over', freeze: '@strike', dur: 3.4, caption: 'In reach for <b>{cross.win} s</b>. Reacting takes ~0.22 s:<br><b>be there before he crosses.</b> Swipe up,<br>with the hand on the side it\'s going.' },
  { rep: 'cross', cam: 'over', from: '@strike', to: 1.95, rate: 0.45 },

  { rep: 'trail', cam: 'chase', from: 0.6, to: 0.95, rate: 0.6 },
  { rep: 'trail', cam: 'chase', freeze: 0.95, dur: 2.4, caption: 'He got a step on you. <b>Don\'t reach across<br>him:</b> that\'s a foul, or a free lane.' },
  { rep: 'trail', cam: 'chase', from: 0.95, to: '@strike', rate: 0.32, caption: 'Run with him on the ball side. His off arm<br>covers the front. <b>Nothing covers the back.</b>' },
  { rep: 'trail', cam: 'chase', freeze: '@strike', dur: 3.0, caption: '<b>Tip it forward</b> as it comes up off the floor,<br>with your inside hand.' },
  { rep: 'trail', cam: 'chase', from: '@strike', to: 1.78, rate: 0.5 },

  { rep: 'lane', cam: 'high', from: 0.0, to: '@wind', rate: 0.8, caption: '64% of NBA steals come off passes.<br><b>Sag a step off the line:</b> make it look open.' },
  { rep: 'lane', cam: 'high', freeze: '@wind', dur: 2.8, caption: '<b>Leave on his windup,</b> not the throw:<br>the ball needs {lane.flight} s to get there.' },
  { rep: 'lane', cam: 'high', from: '@wind', to: '@int', rate: 0.35 },
  { rep: 'lane', cam: 'high', freeze: '@int', dur: 2.8, caption: 'Caught in front of your man. <b>You needed<br>{lane.you} s, the ball {lane.flight} s:</b> leave on the<br>throw and you\'re {lane.lead} s late.' },
  { rep: 'lane', cam: 'high', from: '@int', to: 2.7, rate: 0.6 },

  { card: 'outro', rep: 'lane', cam: 'high', freeze: 2.7, dur: 3.4 },
];

export function buildTimeMap(reps, fps = FPS) {
  // resolve the measured moments: '@strike' (hand meets ball), '@prot' (a protected dribble before the cross: his
  // last push with the right hand), '@int' (the interception), '@rel' (the pass leaves), '@wind' (the windup)
  for (const s of SEQ) for (const k of ['from', 'to', 'freeze']) if (typeof s[k] === 'string') {
    const rep = reps[s.rep], P = rep.plan;
    const pk = rep.pushes.filter(p => P.strike ? p.s1 < rep.strike.t : true);
    s[k] = { '@strike': P.strike && rep.strike.t, '@prot': pk.length ? (pk[pk.length - 1].s0 + pk[pk.length - 1].s1) / 2 : 0.5,
      '@int': P.pass && P.pass.tInt, '@rel': P.pass && P.pass.rel, '@wind': P.pass && P.pass.wind }[s[k]];
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
