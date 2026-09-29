// 1v1 possession built from CMU basketball mocap. Court: rim at (0,0), offense attacks -z; YOU's right = +x.
import * as THREE from 'three';
import { Track } from './animator.js';

const PI = Math.PI;
export const CLIPS = ['78_22', '78_20', '78_30', '78_25', '78_12', '78_32', '06_06', '06_15'];
export const START = { you: { x: 0.25, z: 8.35 }, d1: { x: 0.25, z: 7.38 } };

// YOU: triple threat -> ball show/jab -> test right (2 dribbles) -> plant, back out dribbling ->
//      live dribble, read -> he closes out -> rip & go right past him -> drive to the rim.
export function youSegs() {
  const deg = PI / 180;
  return [
    { clip: '78_22', from: 0.0, at: 0.0, rate: 0.5, place: { x: START.you.x, z: START.you.z, yaw: PI } },
    { clip: '78_20', from: 0.0, at: 2.35, blend: 0.4, yawAbs: (p) => yawTo(p, RIM) - 38 * deg },   // show ball, jab, go right
    { clip: '06_06', from: 0.3, at: 3.3, blend: 0.45, yawAbs: (p) => yawTo(p, RIM) - 24 * deg },  // plant -> back out (back-left)
    { clip: '06_15', from: 0.15, at: 4.25, blend: 0.5, yawAbs: 'rim' },                           // live dribble, read
    { clip: '78_22', from: 3.2, at: 6.0, blend: 0.3, yawAbs: (p) => yawTo(p, RIM) + 27 * deg },   // rip & go right
    { clip: '78_20', from: 1.02, at: 7.75, blend: 0.3, yawAbs: 'lane' },                          // downhill to the rim
  ];
}

export function d1Segs() {
  const deg = PI / 180;
  return [
    { clip: '78_30', from: 3.93, at: 0.0, idle: { amp: 0.16, period: 1.9 }, place: { x: START.d1.x, z: START.d1.z, yaw: 0 } },
    { clip: '78_30', from: 4.12, at: 2.7, blend: 0.22, turn: 16 * deg },            // slide to his left (and a bit back)
    { clip: '78_30', from: 3.93, at: 3.5, blend: 0.4, idle: { amp: 0.16, period: 1.9 }, yawAbs: 'face' },
    { clip: '78_25', from: 1.45, at: 5.6, blend: 0.35, yawAbs: 'closeout' },      // closes out: runs at him, chops to a stop
    { clip: '78_32', from: 0.25, at: 6.95, blend: 0.5, yawAbs: 'chase' },          // beaten: turns and chases
    { clip: '78_25', from: 1.62, at: 8.25, blend: 0.4, yawAbs: 'rimside' },        // pulls up behind the play
  ];
}

const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
export const RIM = { x: 0, z: 0 };
export const LANE_TARGET = { x: 1.55, z: 0.7 }; // right side of the rim (aim point for the run clip)

export function buildTracks(clips, legs) {
  const ys = youSegs().map(s => ({ ...s, yawAbs: kw(s.yawAbs, null) }));
  const you = new Track(clips, ys, legs.you);
  const youAt = (t) => { const h = you.hip(t); return { x: h.x, z: h.z }; };
  const ds = d1Segs().map(s => ({ ...s, yawAbs: kw(s.yawAbs, youAt) }));
  const d1 = new Track(clips, ds, legs.d1);
  return { you, d1 };
}

function kw(k, youAt) {
  if (k === undefined || typeof k === 'number' || typeof k === 'function') return k;
  const deg = Math.PI / 180;
  if (k === 'rim') return (p) => yawTo(p, RIM);
  if (k === 'lane') return (p) => yawTo(p, LANE_TARGET);
  // 78_25 moves ~45deg to the left of where the body faces: aim the motion at YOU
  if (k === 'you') return (p, t) => yawTo(p, youAt(t + 0.5)) - 45 * deg;
  if (k === 'chase') return (p, t) => { const y = youAt(t + 1.25); return yawTo(p, { x: y.x - 0.5, z: y.z + 0.3 }); };
  if (k === 'face') return (p, t) => yawTo(p, youAt(t));
  if (k === 'rimside') return (p) => yawTo(p, { x: 0.6, z: 0.4 }) - 46 * deg;
  if (k === 'closeout') return (p, t) => {
    // aim a stride short of YOU and a little to his left (the side he isn't going)
    const y = youAt(t + 0.4); const toRim = Math.atan2(-y.x, -y.z);
    const aim = { x: y.x + Math.sin(toRim) * 1.5 + Math.cos(toRim) * -0.55, z: y.z + Math.cos(toRim) * 1.5 - Math.sin(toRim) * -0.55 };
    return yawTo(p, aim) - 46 * deg;
  };
  throw new Error('yaw keyword ' + k);
}
