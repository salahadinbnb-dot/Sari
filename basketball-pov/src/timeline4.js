// v4 (skeleton gym) time map at 30 fps, like a phone clip: the play live, then a slow-motion replay of the moves
// from low in front, then the shot again from behind the shooter.
export const FPS = 30;
export const SHOTS = [
  { id: 'live', from: 0.3, to: 6.2, rate: 1.0 },
  { id: 'replay', from: 1.2, to: 2.95, rate: 0.42 },
  { id: 'rim', from: 2.95, to: 5.7, rate: 0.62 },
];
export function buildTimeMap(fps = FPS) {
  const frames = []; let vt = 0;
  SHOTS.forEach((s, k) => {
    const n = Math.round((s.to - s.from) / s.rate * fps);
    for (let i = 0; i < n; i++) frames.push({ st: s.from + (i / n) * (s.to - s.from), vt: vt + i / fps, rate: s.rate, shot: s.id, shotIdx: k, sv: i / fps });
    vt += n / fps;
  });
  return frames;
}
