// Numeric check of the 1v1 choreography: positions, distances, facing over time.
import fs from 'node:fs';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS, buildTracks } from '../src/play1v1.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS) clips[c] = await loadClip(c);
const legs = { you: 0.7957 * 1.96 / 1.81, d1: 0.7957 * 1.97 / 1.81 };
const { you, d1 } = buildTracks(clips, legs);
const step = +(process.argv[2] || 0.2), t1 = +(process.argv[3] || 10);
for (let t = 0; t <= t1 + 1e-9; t += step) {
  const Y = you.at(t), D = d1.at(t);
  const yh = you.hip(t), dh = d1.hip(t);
  const dist = Math.hypot(dh.x - yh.x, dh.z - yh.z);
  // bearing of D1 from YOU relative to YOU->rim line (deg, + = D1 to YOU's left)
  const toRim = Math.atan2(-yh.x, -yh.z), toD = Math.atan2(dh.x - yh.x, dh.z - yh.z);
  let rel = (toD - toRim) * 180 / Math.PI; while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
  console.log(`${t.toFixed(2)}  YOU (${yh.x.toFixed(2)},${yh.z.toFixed(2)}) y${(Y.yaw*180/Math.PI).toFixed(0)} h${yh.y.toFixed(2)} | D1 (${dh.x.toFixed(2)},${dh.z.toFixed(2)}) y${(D.yaw*180/Math.PI).toFixed(0)} | dist ${dist.toFixed(2)} bearing ${rel.toFixed(0)}`);
}
