// v3 (tweener) video time map: live speed in, slow motion through the combo and the rise, a hold at the end.
export const FPS = 60;
export const SIM_END = 6.3;
export const SEGMENTS = [
  { from: 0.0, to: 1.3, rate: 1.0 },
  { from: 1.3, to: 2.95, rate: 0.62 },
  { from: 2.95, to: 3.85, rate: 0.5 },
  { from: 3.85, to: 5.15, rate: 0.8 },
  { from: 5.15, to: 6.2, rate: 1.0 },
  { freeze: 6.2, dur: 1.5, tag: 'end' },
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
