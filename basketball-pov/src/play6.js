// v6 "get up": the approach and the dunk, from two real takes (CMU mocap) cut together where the poses match
// (tools/transit.py): a walk into a run (127_04) and a basketball lay-up approach - a long bound, a quick plant and
// a two-foot takeoff (124_06). The flight is the performer's own, made higher with Track's `boost` (a ballistic
// flight k times as high lasts sqrt(k) times as long at the same g).
// Court: rim at (0, 3.05, 0), backboard at z = -0.38, the court runs to +z.
import * as THREE from 'three';
import { anchoredTrack } from './play5.js';

export const RIM = { x: 0, y: 3.05, z: 0 };
export const CLIPS6 = ['127_04', '124_06'];
// 124_06 in clip time: the cut-in (mid-run), the bound lands (left foot), the plant (right foot), toe-off, touchdown
export const LAY = { cut: 2.60, bound: 2.78, plant: 2.88, toeOff: 3.105, land: 3.755 };
const RUN = { clip: '127_04', match: 3.217 };   // where the run matches LAY.cut (transit cost 0.87)

// one approach: walk in from `from` (127_04 clip time), run, bound, plant, jump with the flight boosted k times;
// anchored so the hip is at `spot` facing `yaw` at toe-off
// (o.rate plays the run-up and the plant faster: a quicker approach; the flight is the boost's)
export function approach(clips, leg, o) {
  const r = o.rate ?? 1, at1 = (RUN.match - o.from) / r;
  const jump = { clip: '124_06', from: LAY.cut, at: at1, rate: r, inert: 0.25 / r, jump: true,
    boost: { from: LAY.toeOff, to: LAY.land, k: o.k, pre: 0.08, hk: o.hk ?? 1 } };
  if (o.unwind) jump.unwind = { from: LAY.toeOff - 0.04, to: LAY.land, ramp: 0.12, k: o.unwind };
  const segs = [{ clip: RUN.clip, from: o.from, at: 0, rate: r }, jump];
  const tOff = at1 + (LAY.toeOff - LAY.cut) / r;
  const tr = anchoredTrack(clips, segs, leg, tOff, { x: o.spot.x, z: o.spot.z, yaw: o.yaw });
  const s = Math.sqrt(o.k);
  tr.tOff = tOff; tr.tLand = tOff + (LAY.land - LAY.toeOff) * s;
  // sim time of a 124_06 clip time (through the boost's time warp)
  tr.simOf = (ct) => ct <= LAY.toeOff ? at1 + (ct - LAY.cut) / r : ct <= LAY.land ? tOff + (ct - LAY.toeOff) * s : tr.tLand + (ct - LAY.land) / r;
  return tr;
}
export function apexOf(tr) {
  let best = { y: -1, t: tr.tOff };
  for (let t = tr.tOff; t <= tr.tLand; t += 1 / 480) { const h = tr.hip(t); if (h.y > best.y) best = { y: h.y, t }; }
  return best;
}

// Place an approach so that at the reference moment (the apex + dt) the rim is `reach` m in front of his right
// shoulder (horizontally, along his facing), with him facing `faceRef` (world yaw) then. The jump's own geometry
// (drift, air turn) comes from a trial placed at the origin.
export function placeForRim(clips, leg, o) {
  const tr0 = approach(clips, leg, { ...o, spot: { x: 0, z: 0 }, yaw: 0 });
  const ap = apexOf(tr0), tRef = ap.t + (o.dt || 0), T = tr0.at(tRef), S = T.pos.rclavicle;
  const loc = new THREE.Vector3(S.x + Math.sin(T.yaw) * o.reach, 0, S.z + Math.cos(T.yaw) * o.reach);
  const psi = o.faceRef - T.yaw;
  const w = loc.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), psi);
  const tr = approach(clips, leg, { ...o, spot: { x: RIM.x - w.x, z: RIM.z - w.z }, yaw: psi });
  tr.tRef = tRef; tr.apex = apexOf(tr);
  return tr;
}

export const REPS6 = {
  // 1 - the approach, and a rim touch: no ball, get a hand on it
  touch: { simEnd: 4.2, k: 1.2, plan: { kind: 'touch' },
    build(clips, legs) { return { you: placeForRim(clips, legs.you, { from: 1.45, k: this.k, reach: 0.4, faceRef: Math.PI + 0.35, dt: -0.01, unwind: 1 }) }; } },
  // 2 - the dunk: same approach all-out, ball cocked back behind the head at the top, thrown down
  dunk: { simEnd: 4.4, k: 2.1, plan: { kind: 'dunk' },
    build(clips, legs) { return { you: placeForRim(clips, legs.you, { from: 1.45, k: this.k, rate: 1.18, reach: 0.42, faceRef: Math.PI + 0.35, dt: 0.02, unwind: 1 }) }; } },
};
