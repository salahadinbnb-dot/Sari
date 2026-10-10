// Grid-search D1's zigzag so he stays ~1.05 m in front of YOU through the first cross, then gets caught on the second.
import fs from 'node:fs';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS3, buildTracks3, D1_FIT } from '../src/play3.js';
import { Track } from '../src/animator.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS3) clips[c] = await loadClip(c);
const legs = { you: 0.8617, d1: 0.8664 };
const base = buildTracks3(clips, legs);
const youAt = (t) => { const h = base.you.hip(t); return { x: h.x, z: h.z }; };
const Y = []; for (let t = 0; t <= 3.0; t += 0.05) Y.push(youAt(t));
const { d1Segs3 } = await import('../src/play3.js');
let best = null;
for (const rate of [0.75, 0.85, 0.95, 1.05])
  for (const travel of [100, 115, 130, 145, 160])
    for (const dist of [1.0, 1.15, 1.3])
      for (const bear of [-20, -10, 0, 10, 20])
        for (const ref of [0.9, 1.1]) {
          const F = { ...D1_FIT, rate, travel, dist, bear, ref };
          let d1;
          try { d1 = new Track(clips, d1Segs3(youAt, F), legs.d1); } catch (e) { continue; }
          let cost = 0, late = 0;
          for (let i = 0; i < Y.length; i++) {
            const t = i * 0.05; if (t < 1.0 || t > 2.95) continue;
            const h = d1.hip(t), y = Y[i];
            const dist2 = Math.hypot(h.x - y.x, h.z - y.z);
            const toRim = Math.atan2(-y.x, -y.z); let b = (Math.atan2(h.x - y.x, h.z - y.z) - toRim) * 180 / Math.PI; b = ((b + 540) % 360) - 180;
            if (t <= 2.35) cost += (dist2 - 1.05) ** 2 * 4 + (b / 45) ** 2;
            else late += Math.max(0, 40 - Math.abs(b)) / 40 + Math.max(0, 1.4 - dist2); // after the 2nd cross he should be off to the side / behind
            if (dist2 < 0.55) cost += 5;
          }
          const c = cost + late * 0.5;
          if (!best || c < best.c) best = { c, F };
        }
console.log(JSON.stringify(best));
