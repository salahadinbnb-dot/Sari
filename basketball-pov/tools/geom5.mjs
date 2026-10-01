// Numeric check of a v5 rep: positions, spacing, the shooter's facing vs the rim, and the defender's balance
// (extrapolated centre of mass behind his heels / outside his feet, relative to the line to the shooter).
// usage: node tools/geom5.mjs <rep> [step] [t1]
import fs from 'node:fs';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS5, REPS, buildRep } from '../src/play5.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS5) clips[c] = await loadClip(c);
const name = process.argv[2] || 'heels', step = +(process.argv[3] || 0.1), t1 = +(process.argv[4] || REPS[name].simEnd);
const { you, d1 } = buildRep(name, clips, { you: 0.8617, d1: 0.8664 });
const W0 = Math.sqrt(9.81 / 0.95);
const com = (T) => { const p = T.pos, h = p.lhipjoint.clone().add(p.rhipjoint).multiplyScalar(0.5);
  return h.multiplyScalar(0.45).addScaledVector(p.thorax, 0.3).addScaledVector(p.head, 0.08).addScaledVector(p.lfemur, 0.085).addScaledVector(p.rfemur, 0.085); };
for (let t = 0; t <= t1 + 1e-9; t += step) {
  const Y = you.at(t), D = d1.at(t), yh = you.hip(t), dh = d1.hip(t);
  const c = com(D), c0 = com(d1.at(Math.max(0, t - 0.02))), c1 = com(d1.at(t + 0.02));
  const v = c1.clone().sub(c0).multiplyScalar(1 / (t < 0.02 ? 0.02 + t : 0.04)); v.y = 0;
  const x = c.clone().addScaledVector(v, 1 / W0); x.y = 0;
  const to = { x: yh.x - dh.x, z: yh.z - dh.z }, L = Math.hypot(to.x, to.z); to.x /= L; to.z /= L;
  const side = { x: -to.z, z: to.x };
  const pts = ['ltibia', 'rtibia', 'ltoes', 'rtoes'].map(k => D.pos[k]);
  pts.push(D.pos.ltibia.clone().addScaledVector(D.pos.ltibia.clone().sub(D.pos.ltoes), 0.3), D.pos.rtibia.clone().addScaledVector(D.pos.rtibia.clone().sub(D.pos.rtoes), 0.3));
  const along = pts.map(p => (p.x - x.x) * to.x + (p.z - x.z) * to.z), across = pts.map(p => (p.x - x.x) * side.x + (p.z - x.z) * side.z);
  const behind = Math.max(0, Math.min(...along)), outside = Math.max(...across) < 0 ? -Math.max(...across) : (Math.min(...across) > 0 ? Math.min(...across) : 0);
  let face = (Y.yaw - Math.atan2(-yh.x, -yh.z)) * 180 / Math.PI; face = ((face + 540) % 360) - 180;
  console.log(`${t.toFixed(2)} you(${yh.x.toFixed(2)},${yh.z.toFixed(2)}) h${yh.y.toFixed(2)} face${face.toFixed(0).padStart(4)} rim${Math.hypot(yh.x, yh.z).toFixed(2)} | d1(${dh.x.toFixed(2)},${dh.z.toFixed(2)}) d${L.toFixed(2)} spd${Math.hypot(v.x, v.z).toFixed(1)} behind${behind.toFixed(2)} out${outside.toFixed(2)}${behind > 0.04 ? ' HEELS' : ''}${outside > 0.05 ? ' LEAN' : ''}`);
}
