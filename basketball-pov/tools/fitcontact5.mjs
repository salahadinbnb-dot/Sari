// Solve the v5 contact rep: shift the finisher so his release lands ~1 m off the rim on the right side; turn the
// help defender's run so he faces the finisher at the contact, then shift him so he arrives at the finisher's
// left shoulder at that moment.
import fs from 'node:fs';
import * as THREE from 'three';
import { setClipSource, loadClip } from '../src/mocap.js';
import { CLIPS5, REPS, buildRep, CONTACT_FIT } from '../src/play5.js';
setClipSource(async (n) => JSON.parse(fs.readFileSync(new URL(`../assets/mocap/json/${n}.json`, import.meta.url))));
const clips = {}; for (const c of CLIPS5) clips[c] = await loadClip(c);
const legs = { you: 0.8617, d1: 0.8664 };
const F = JSON.parse(JSON.stringify(CONTACT_FIT));
const REL = 1.0 + (3.36 - 2.55), TC = REPS.contact.plan.contact.t;
const want = { x: 0.62, z: 0.78 };
for (let it = 0; it < 5; it++) {
  const hr = buildRep('contact', clips, legs, F).you.hip(REL);
  F.you.x += want.x - hr.x; F.you.z += want.z - hr.z; F.aim.x += (want.x - hr.x) * 0.5; F.aim.z += (want.z - hr.z) * 0.5;
}
let R = buildRep('contact', clips, legs, F);
const hc = R.you.hip(TC), h2 = R.you.hip(TC + 0.05), f = new THREE.Vector3(h2.x - hc.x, 0, h2.z - hc.z).normalize();
const left = new THREE.Vector3(f.z, 0, -f.x);
const goal = new THREE.Vector3(hc.x, 0, hc.z).addScaledVector(left, 0.46).addScaledVector(f, 0.12);
const wantYaw = Math.atan2(hc.x - goal.x, hc.z - goal.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
for (let it = 0; it < 6; it++) {
  R = buildRep('contact', clips, legs, F);
  F.runYaw += wrap(wantYaw - R.d1.at(TC).yaw);
  const dh = buildRep('contact', clips, legs, F).d1.hip(TC); F.d1.x += goal.x - dh.x; F.d1.z += goal.z - dh.z;
  F.d1Yaw = Math.atan2(R.you.hip(0.6).x - F.d1.x, R.you.hip(0.6).z - F.d1.z);  // at the start he watches the ball
}
R = buildRep('contact', clips, legs, F);
const dh = R.d1.hip(TC);
console.log('you@rel', R.you.hip(REL).x.toFixed(2), R.you.hip(REL).z.toFixed(2), 'd1@contact', dh.x.toFixed(2), dh.z.toFixed(2), 'goal', goal.x.toFixed(2), goal.z.toFixed(2),
  'yaw err', (wrap(wantYaw - R.d1.at(TC).yaw) * 180 / Math.PI).toFixed(1), 'start', F.d1.x.toFixed(2), F.d1.z.toFixed(2));
console.log(JSON.stringify(F, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
