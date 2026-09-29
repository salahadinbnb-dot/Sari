// v2 (1v1) video time map: sim-time segments, slow motion and freeze frames.
export const FPS = 60;
export const SIM_END = 11.2;
export const RIM = { x: 0, z: 0, y: 3.05 };

// freeze: {freeze: simTime, dur: videoSeconds, tag}; play: {from, to, rate}
export const SEGMENTS = [
  { freeze: 0.0, dur: 1.7, tag: 'intro' },
  { from: 0.0, to: 1.15, rate: 1.0 },
  { freeze: 1.15, dur: 2.0, tag: 'setup' },
  { from: 1.15, to: 2.8, rate: 1.0 },
  { from: 2.8, to: 3.22, rate: 0.6 },
  { freeze: 3.22, dur: 3.4, tag: 'notbeaten' },
  { from: 3.22, to: 4.35, rate: 1.0 },
  { from: 4.35, to: 5.6, rate: 1.0 },
  { from: 5.6, to: 5.92, rate: 0.7 },
  { freeze: 5.92, dur: 2.7, tag: 'closeout' },
  { from: 5.92, to: 6.88, rate: 0.6 },
  { freeze: 6.88, dur: 2.6, tag: 'opening' },
  { from: 6.88, to: 8.45, rate: 1.0 },
  { from: 8.45, to: 10.0, rate: 0.55 },
  { from: 10.0, to: 10.95, rate: 0.85 },
  { freeze: 10.95, dur: 1.6, tag: 'end' },
];

export function buildTimeMap(fps = FPS) {
  const frames = [];
  let vt = 0;
  for (const s of SEGMENTS) {
    if (s.freeze !== undefined) {
      const n = Math.round(s.dur * fps);
      for (let i = 0; i < n; i++) frames.push({ st: s.freeze, vt: vt + i / fps, freeze: s.tag, fu: i / n, fdur: s.dur });
      vt += n / fps;
    } else {
      const n = Math.round((s.to - s.from) / s.rate * fps);
      for (let i = 0; i < n; i++) frames.push({ st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate });
      vt += n / fps;
    }
  }
  return frames;
}
