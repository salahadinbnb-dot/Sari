// Solve where to start the mocap layup (and at what yaw) so the rim sits where the performer is looking at release.
import fs from 'node:fs';
import * as THREE from 'three';
import { setClipSource, loadClip, sampleClip, facingYaw, hipCenter } from '../src/mocap.js';
import { CLIPS, youSegs } from '../src/play1v1.js';
import { Track, calibrate } from '../src/animator.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS) clips[c] = await loadClip(c);
const leg = 0.7957 * 1.96 / 1.81;
const FROM = +(process.env.FROM || 2.45), REL = +(process.env.REL || 3.38), ANG = +(process.env.ANG || 71), DIST = +(process.env.DIST || 0.67);
const lay = clips['124_06']; calibrate(lay, leg);
const s0 = sampleClip(lay, FROM), sR = sampleClip(lay, REL), sT = sampleClip(lay, 3.0);
const srcHip = hipCenter(s0); srcHip.y = 0; const srcYaw = facingYaw(s0);
// travel dir (clip), imagined rim = head at release + DIST at ANG deg left of travel
const tr = hipCenter(sT).sub(hipCenter(s0)); tr.y = 0; tr.normalize();
const trYaw = Math.atan2(tr.x, tr.z) + ANG * Math.PI / 180;
const head = (process.env.REF === 'head' ? sR.pos.head.clone() : hipCenter(sR)); head.y = 0;
const rimC = head.clone().add(new THREE.Vector3(Math.sin(trYaw), 0, Math.cos(trYaw)).multiplyScalar(DIST / lay.cal.scale));
const rho = rimC.clone().sub(srcHip).length() * lay.cal.scale;
const angC = Math.atan2(rimC.x - srcHip.x, rimC.z - srcHip.z) - srcYaw; // rim bearing relative to facing (clip)
console.log('rho', rho.toFixed(3), 'rim bearing rel facing (deg)', (angC * 180 / Math.PI).toFixed(1));
// previous segments only
const segs = youSegs().filter(s => s.clip !== '124_06').map(s => ({ ...s }));
const kwRim = (p) => Math.atan2(-p.x, -p.z);
for (const s of segs) if (typeof s.yawAbs === 'string') s.yawAbs = s.yawAbs === 'rim' ? kwRim : (p) => Math.atan2(1.55 - p.x, 0.7 - p.z);
const you = new Track(clips, segs, leg);
let best = null;
for (let at = 7.9; at <= 8.7; at += 0.005) {
  const h = you.hip(at); const d = Math.hypot(h.x, h.z);
  if (!best || Math.abs(d - rho) < Math.abs(best.d - rho)) best = { at, d, h };
}
const toRim = Math.atan2(-best.h.x, -best.h.z);
const worldYaw = toRim - angC; // facing so that the rim lands at the right bearing
const yawTo = Math.atan2(-best.h.x, -best.h.z);
console.log(`start at ${best.at.toFixed(3)} hip (${best.h.x.toFixed(2)},${best.h.z.toFixed(2)}) |hip|=${best.d.toFixed(3)} worldYaw ${(worldYaw * 180 / Math.PI).toFixed(1)}  => offset from yawTo(rim) ${((worldYaw - yawTo) * 180 / Math.PI).toFixed(1)} deg`);
