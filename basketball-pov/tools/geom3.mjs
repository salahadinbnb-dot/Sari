// Numeric check of the tweener play: positions, facing vs rim, distance/bearing of D1.
import fs from 'node:fs';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS3, buildTracks3 } from '../src/play3.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS3) clips[c] = await loadClip(c);
const { you, d1 } = buildTracks3(clips, { you: 0.8617, d1: 0.8664 });
const step = +(process.argv[2] || 0.1), t1 = +(process.argv[3] || 6);
for (let t = 0; t <= t1 + 1e-9; t += step) {
  const Y = you.at(t), yh = you.hip(t), dh = d1.hip(t);
  const toRim = Math.atan2(-yh.x, -yh.z);
  let face = (Y.yaw - toRim) * 180 / Math.PI; face = ((face + 540) % 360) - 180;
  const dist = Math.hypot(dh.x - yh.x, dh.z - yh.z);
  let rel = (Math.atan2(dh.x - yh.x, dh.z - yh.z) - toRim) * 180 / Math.PI; rel = ((rel + 540) % 360) - 180;
  console.log(`${t.toFixed(2)} YOU (${yh.x.toFixed(2)},${yh.z.toFixed(2)}) rim ${Math.hypot(yh.x, yh.z).toFixed(2)}m face-vs-rim ${face.toFixed(0)} h${yh.y.toFixed(2)} | D1 (${dh.x.toFixed(2)},${dh.z.toFixed(2)}) dist ${dist.toFixed(2)} bearing ${rel.toFixed(0)}`);
}
