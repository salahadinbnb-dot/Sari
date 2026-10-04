// Numeric check of a v6 rep: hip path, speed, facing, the right shoulder and wrist, and the apex.
// usage: node tools/geom6.mjs <rep> [step] [t0] [t1]
import fs from 'node:fs';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS6, REPS6, RIM } from '../src/play6.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS6) clips[c] = await loadClip(c);
const name = process.argv[2] || 'touch', step = +(process.argv[3] || 0.1), t0 = +(process.argv[4] || 0), t1 = +(process.argv[5] || REPS6[name].simEnd);
const { you } = REPS6[name].build(clips, { you: 0.8617 * 2.125 / 1.96 });
let apex = { y: -1 };
for (let t = 0; t <= REPS6[name].simEnd; t += 1 / 240) { const h = you.hip(t); if (h.y > apex.y) apex = { y: h.y, t }; }
const f = (v) => `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`;
for (let t = t0; t <= t1 + 1e-9; t += step) {
  const T = you.at(t), h = you.hip(t), h2 = you.hip(t + 0.01), sp = Math.hypot(h2.x - h.x, h2.z - h.z) / 0.01, vy = (h2.y - h.y) / 0.01;
  const yaw = T.yaw * 180 / Math.PI, toRim = Math.atan2(RIM.x - h.x, RIM.z - h.z) * 180 / Math.PI;
  let face = yaw - toRim; face = ((face + 540) % 360) - 180;
  const lo = Math.min(T.pos.ltoes.y, T.pos.rtoes.y);
  console.log(`${t.toFixed(2)} hip${f(h)} spd${sp.toFixed(1)} vy${vy.toFixed(1)} face${face.toFixed(0).padStart(4)} toes${lo.toFixed(2)} shR${f(T.pos.rclavicle)} wrR${f(T.pos.rradius)} dRim${Math.hypot(h.x - RIM.x, h.z - RIM.z).toFixed(2)}`);
}
console.log('apex', apex.t.toFixed(3), 'hip', apex.y.toFixed(3), 'toeOff', you.tOff.toFixed(3), 'land', you.tLand.toFixed(3));
