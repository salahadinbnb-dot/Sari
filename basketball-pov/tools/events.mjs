// Export sound-event times (in video seconds) from the timeline for the audio mix.
import fs from 'node:fs';
import { TL, buildTimeMap } from '../src/timeline.js';

const FPS = 30;
const frames = buildTimeMap(FPS);
const dur = frames.length / FPS;

// map a sim time to video time (first occurrence in a moving segment)
function vtOf(st) {
  for (let i = 0; i + 1 < frames.length; i++) {
    const a = frames[i], b = frames[i + 1];
    if (a.freeze || b.freeze) continue;
    if (a.st <= st && st < b.st) return a.vt + (st - a.st) / (b.st - a.st) / FPS;
  }
  return null;
}
const rateAt = (st) => { const f = frames.find(x => !x.freeze && x.st >= st); return f ? f.rate : 1; };

const ev = { duration: dur, bounces: [], catches: [], swish: [], score: [], freezes: [], squeaks: [], steps: [], releases: [] };
const drib = TL.ball.find(e => e.state === 'dribble');
for (const b of drib.bounces) ev.bounces.push({ t: vtOf(b), gain: 1.0, rate: rateAt(b) });
const bp = TL.ball.find(e => e.state === 'flight' && e.bounceAt);
ev.bounces.push({ t: vtOf(bp.t + (bp.to.t - bp.t) * bp.bounceAt), gain: 0.9, rate: rateAt(10.3) });
// ball drop after the make: replicate the drop physics
{
  const drop = TL.ball.find(e => e.state === 'drop');
  let py = 3.05 - 0.52, pvy = -1.8, t = drop.t; const G = 9.81, R = 0.12;
  for (let k = 0; k < 5; k++) {
    const disc = pvy * pvy + 2 * G * (py - R);
    const tHit = (pvy + Math.sqrt(disc)) / G;
    t += tHit; const vHit = pvy - G * tHit; pvy = -vHit * 0.62; py = R;
    if (t > TL.simEnd - 0.05 || pvy < 0.35) break;
    const v = vtOf(t); if (v !== null) ev.bounces.push({ t: v, gain: 0.8 * Math.min(1, Math.abs(vHit) / 6), rate: rateAt(t) });
  }
}
ev.catches.push({ t: vtOf(0.86), gain: 0.8 }, { t: vtOf(10.47), gain: 0.9 });
ev.releases.push({ t: vtOf(0.27), gain: 0.5 }, { t: vtOf(10.03), gain: 0.55 });
ev.swish.push({ t: vtOf(11.56), gain: 1.0 });
ev.score.push({ t: vtOf(11.62) });
for (const t of [2.86, 5.7, 5.74, 8.62, 9.12, 10.06]) { const v = vtOf(t); if (v !== null) ev.squeaks.push({ t: v, gain: 0.7 }); }
// freezes
let vt = 0;
for (const s of TL.segments) {
  if (s.freeze !== undefined) { ev.freezes.push({ t: vt, dur: s.dur, tag: s.tag }); vt += Math.round(s.dur * FPS) / FPS; }
  else vt += Math.round((s.to - s.from) / s.rate * FPS) / FPS;
}
// step caption changes (for a soft UI tick)
for (const t of [1.25, 4.3, 5.47, 7.12, 8.6, 9.5]) { const v = vtOf(t); if (v !== null) ev.steps.push({ t: v }); }
fs.writeFileSync(new URL('../out/events.json', import.meta.url), JSON.stringify(ev, null, 1));
console.log(JSON.stringify({ duration: dur, bounces: ev.bounces.length, freezes: ev.freezes }, null, 0));
