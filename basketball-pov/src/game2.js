// Ball, hands and gaze for the 1v1, layered on top of the mocap tracks (src/play1v1.js).
// YOU's natural (mocap) arms are sampled once at 240 Hz; the ball is then scripted against them:
// two-hand grip -> push -> physics-synced right-hand dribble -> gather -> one-hand layup -> bank shot.
import * as THREE from 'three';
import { LAYUP } from './play1v1.js';

export const BALL_R = 0.12;
const G = 9.81, HZ = 240;
const UP = new THREE.Vector3(0, 1, 0);
const RIM = new THREE.Vector3(0, 3.05, 0);
const BOARD_Z = -0.38;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// cubic Hermite for vectors: s in [0,1] over duration T
function herm(p0, v0, p1, v1, T, s) {
  const s2 = s * s, s3 = s2 * s;
  const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * T, c = -2 * s3 + 3 * s2, d = (s3 - s2) * T;
  return p0.clone().multiplyScalar(a).addScaledVector(v0, b).addScaledVector(p1, c).addScaledVector(v1, d);
}
const herm1 = (p0, v0, p1, v1, T, s) => {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * T * v0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * T * v1;
};
// ballistic point between p0 (t0) and p1 (t1): linear in xz, gravity in y
export function ballistic(p0, p1, t0, t1, t) {
  const T = Math.max(t1 - t0, 1e-3), tau = clamp(t - t0, 0, T), u = tau / T;
  const vy0 = (p1.y - p0.y + 0.5 * G * T * T) / T;
  return V(p0.x + (p1.x - p0.x) * u, p0.y + vy0 * tau - 0.5 * G * tau * tau, p0.z + (p1.z - p0.z) * u);
}

// What the ball does, in sim seconds. Layup beats are the mocap performer's own (clip time -> sim time).
const L = (ct) => LAYUP.at + (ct - LAYUP.from);
export const PLAN = {
  simEnd: 11.2,
  tripleThreatEnd: [2.3, 2.5],                                     // ball leaves the right hip for the ball fake
  pushLead: 0.2,                                                   // right hand takes the ball off the hold
  releases: [2.94, 3.44, 3.98, 4.52, 5.06, 5.58, 6.12, 6.64, 7.16, 7.68, 8.2],
  contact: 0.2,                                                    // hand-on-ball time before each release
  lastCatch: L(2.62),                                              // gather
  gatherDone: L(2.86),                                             // ball in both hands
  leftOff: [L(3.12), L(3.22)],                                     // left hand comes off, ball rides the right palm
  release: L(3.38),                                                // off the fingertips
};
PLAN.board = PLAN.release + 0.26; PLAN.rim = PLAN.board + 0.22; PLAN.netEnd = PLAN.rim + 0.24;

// Foot-skate cleanup: while a foot is planted (per the source clip), hold it where it touched down; after lift-off
// the accumulated offset eases out during the swing. The hold is released (the foot slips) only when keeping it
// would stretch the leg past ~96% of its length, or drift further than maxOff.
export function footLock(samples, legLen, maxOff = 0.45, release = 0.14) {
  const n = samples.length, off = new Array(n);
  let anchor = null, last = V(), rel = -1e9;
  const reachOK = (o, s) => V(s.a.x + o.x, s.a.y, s.a.z + o.z).distanceTo(s.h) <= legLen * 0.965;
  for (let i = 0; i < n; i++) {
    const sm = samples[i], { a, w } = sm;
    // planted per the clip, and held (hysteresis) until the foot actually leaves the floor
    const down = (w > 0.5 && a.y < 0.19) || (anchor && a.y < 0.135);
    if (down) {
      if (!anchor) { // touch down where the foot is currently drawn (keeps the offset continuous)
        const k = (i - rel) / (release * HZ), carry = k < 1 ? last.clone().multiplyScalar(1 - smooth(k)) : V();
        anchor = V(a.x + carry.x, 0, a.z + carry.z);
      }
      const o = V(anchor.x - a.x, 0, anchor.z - a.z);
      if (o.length() > maxOff) o.multiplyScalar(maxOff / o.length());
      if (!reachOK(o, sm)) { // slip just enough for the leg to reach
        let lo = 0, hi = 1;
        for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (reachOK(o.clone().multiplyScalar(m), sm)) lo = m; else hi = m; }
        o.multiplyScalar(lo);
      }
      anchor.set(a.x + o.x, 0, a.z + o.z);
      off[i] = o; last = o; rel = i;
    } else {
      anchor = null;
      const k = (i - rel) / (release * HZ);
      off[i] = k < 1 ? last.clone().multiplyScalar(1 - smooth(k)) : V();
    }
  }
  return off;
}

export class Game {
  // tracks: {you, d1} (animator Track), rigs: {you, d1} (player Rig)
  constructor(tracks, rigs) {
    this.tracks = tracks; this.rigs = rigs;
    this.buildTable();
    this.buildDribble();
    this.buildBallTrack();
  }

  // ---------- natural (mocap-only) samples of YOU ----------
  buildTable() {
    const rig = this.rigs.you, tr = this.tracks.you, d1 = this.tracks.d1;
    const n = Math.ceil(PLAN.simEnd * HZ) + 1;
    const T = { n, hip: [], yaw: [], shL: [], shR: [], wL: [], wR: [], xL: [], xR: [], yL: [], yR: [], head: [], d1hip: [], d1yaw: [] };
    const feet = { you: { L: [], R: [] }, d1: { L: [], R: [] } };
    const addFeet = (who, P) => { for (const s of ['L', 'R']) { const k = s.toLowerCase(); feet[who][s].push({ a: P.pos[k + 'tibia'].clone(), h: P.pos[k + 'hipjoint'].clone(), w: P.planted ? P.planted[s] : 0 }); } };
    const X = V(1, 0, 0), Y = V(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = i / HZ;
      const P = tr.at(t);
      rig.applyMocap(P, P.src, {});
      T.hip.push(rig.P.Root.clone()); T.yaw.push(P.yaw);
      T.shL.push(rig.P.L_UpperArm.clone()); T.shR.push(rig.P.R_UpperArm.clone());
      T.wL.push(rig.P.L_Hand.clone()); T.wR.push(rig.P.R_Hand.clone());
      T.xL.push(X.clone().applyQuaternion(rig.W.L_Hand)); T.xR.push(X.clone().applyQuaternion(rig.W.R_Hand));
      T.yL.push(Y.clone().applyQuaternion(rig.W.L_Hand)); T.yR.push(Y.clone().applyQuaternion(rig.W.R_Hand));
      T.head.push(rig.P.Head.clone());
      addFeet('you', P);
      const D = d1.at(t);
      addFeet('d1', D);
      T.d1hip.push(D.pos.lhipjoint.clone().add(D.pos.rhipjoint).multiplyScalar(0.5)); T.d1yaw.push(D.yaw);
    }
    this.T = T;
    const leg = (r) => r.len.thigh + r.len.calf, ly = leg(this.rigs.you), ld = leg(this.rigs.d1);
    this.lock = { you: { L: footLock(feet.you.L, ly), R: footLock(feet.you.R, ly) }, d1: { L: footLock(feet.d1.L, ld), R: footLock(feet.d1.R, ld) } };
    // chest-forward (from the shoulder line), smoothed over +-0.12 s
    const raw = T.shL.map((l, i) => { const left = l.clone().sub(T.shR[i]); left.y = 0; return left.normalize().cross(UP).normalize(); });
    const w = Math.round(0.12 * HZ);
    T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); a.y = 0; return a.normalize(); });
    // hip velocity (xz), smoothed
    T.vel = T.hip.map((_, i) => { const a = T.hip[clamp(i + 12, 0, n - 1)], b = T.hip[clamp(i - 12, 0, n - 1)]; const v = a.clone().sub(b).multiplyScalar(HZ / 24); v.y = 0; return v; });
  }
  tab(key, t) {
    const a = this.T[key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    return a[i].clone().lerp(a[j], u);
  }
  palm(side, t) { // natural palm centre and axes
    const w = this.tab('w' + side, t), x = this.tab('x' + side, t).normalize(), y = this.tab('y' + side, t).normalize();
    return { c: w.clone().addScaledVector(x, 0.085).addScaledVector(y, 0.018), x, y };
  }
  fwd(t) { return this.tab('fwd', t).normalize(); }

  // ---------- dribble ----------
  // contact anchor: ball centre (xz) beside/ahead of the right shoulder, and the heights the hand can reach from there
  anchor(t) {
    const S = this.tab('shR', t), f = this.fwd(t), r = V(-f.z, 0, f.x), v = this.tab('vel', t);
    const xz = S.clone().addScaledVector(r, 0.15).addScaledVector(f, 0.13).addScaledVector(v, 0.075); xz.y = 0;
    const wr = xz.clone().addScaledVector(f, -0.085).sub(V(S.x, 0, S.z)); wr.y = 0;
    const drop = Math.sqrt(Math.max(0.03, 0.55 * 0.55 - wr.lengthSq()));
    const yR = S.y - 0.145 - drop;
    return { xz, yR, yT: yR + 0.17, yC: yR + 0.08, f, r };
  }
  buildDribble() {
    const P = PLAN, R = BALL_R, rel = P.releases, n = rel.length;
    const catches = rel.map((r, k) => r - (k === 0 ? P.pushLead : P.contact));
    catches.push(P.lastCatch);
    this.catches = catches;
    this.cycles = [];
    for (let k = 0; k < n; k++) {
      const r = rel[k], c = catches[k + 1], Tt = c - r;
      const A = this.anchor(r), B = this.anchor(c);
      const td = 0.38 * Tt, tu = Tt - td;
      const vR = (R - A.yR + 0.5 * G * td * td) / td;          // pushed down hard enough to hit the floor at td
      const vB = (B.yC - R + 0.5 * G * tu * tu) / tu;           // rebound that meets the hand at the catch
      this.cycles.push({ r, c, Tt, td, tu, vR, vB, vC: vB - G * tu, pR: V(A.xz.x, A.yR, A.xz.z), pC: V(B.xz.x, B.yC, B.xz.z) });
    }
  }
  // ball centre while the right hand is on it (contact k runs catches[k] -> releases[k]; k === n is the final gather catch)
  contactBall(k, t) {
    const P = PLAN, n = P.releases.length, c = this.catches[k];
    const A = this.anchor(t);
    let y;
    if (k === 0) { // push off the hold: from the top of the stroke straight down into the release
      const cy = this.cycles[0];
      y = herm1(this.anchor(c).yT, 0, cy.pR.y, cy.vR, P.releases[0] - c, clamp((t - c) / (P.releases[0] - c), 0, 1));
    } else {
      const prev = this.cycles[k - 1];
      if (k === n) { // final catch: absorb up to the top of the stroke and stay there
        const m = c + 0.12;
        y = t < m ? herm1(prev.pC.y, prev.vC, this.anchor(m).yT, 0, 0.12, (t - c) / 0.12) : A.yT;
      } else {
        const r = P.releases[k], cy = this.cycles[k], m = c + 0.42 * (r - c);
        const yT = this.anchor(m).yT;
        y = t < m ? herm1(prev.pC.y, prev.vC, yT, 0, m - c, (t - c) / (m - c)) : herm1(yT, 0, cy.pR.y, cy.vR, r - m, (t - m) / (r - m));
      }
    }
    return V(A.xz.x, y, A.xz.z);
  }
  flightBall(k, t) {
    const cy = this.cycles[k], tau = t - cy.r;
    const u = clamp(tau / cy.Tt, 0, 1);
    const x = cy.pR.x + (cy.pC.x - cy.pR.x) * u, z = cy.pR.z + (cy.pC.z - cy.pR.z) * u;
    let y;
    if (tau < cy.td) y = cy.pR.y + cy.vR * tau - 0.5 * G * tau * tau;
    else { const s = tau - cy.td; y = BALL_R + cy.vB * s - 0.5 * G * s * s; }
    return V(x, Math.max(BALL_R, y), z);
  }
  // right hand resting on top of the ball (palm on the top-back-outside, fingers forward and a bit down)
  onTop(B, t) {
    const f = this.fwd(t), r = V(-f.z, 0, f.x);
    const nrm = UP.clone().addScaledVector(f, -0.35).addScaledVector(r, 0.1).normalize();
    const dir = f.clone().addScaledVector(UP, -0.3).normalize();
    const contact = B.clone().addScaledVector(nrm, BALL_R + 0.004);
    return { pos: contact.addScaledVector(dir, -0.085).addScaledVector(nrm, 0.018), palm: nrm.clone().negate(), dir, curl: 0.18, nrm };
  }
  // both hands on the ball: contacts along the palm-to-palm axis
  gripHands(B, t, axisLR) {
    const out = {}, f = this.fwd(t);
    // fingers forward-up along the ball's side: a body-relative reference (the mocap hand can turn edge-on and flip)
    const ref = f.clone().multiplyScalar(0.75).addScaledVector(UP, 0.65).normalize();
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const n = axisLR.clone().multiplyScalar(sg); // outward normal at this hand's contact
      let dir = ref.clone().addScaledVector(n, -ref.dot(n));
      if (dir.lengthSq() < 1e-4) dir = f.clone().addScaledVector(n, -f.dot(n));
      dir.normalize();
      const contact = B.clone().addScaledVector(n, BALL_R + 0.004);
      out[side] = { pos: contact.addScaledVector(dir, -0.085).addScaledVector(n, 0.018), palm: n.clone().negate(), dir, curl: 0.38, nrm: n };
    }
    return out;
  }
  gripAxis(t) { // unit vector from the right palm to the left palm
    const a = this.palm('L', t).c.sub(this.palm('R', t).c);
    if (a.lengthSq() < 1e-4) { const f = this.fwd(t); return V(f.z, 0, -f.x); }
    return a.normalize();
  }
  // ball held in two hands: symmetric between the palms, kept clear of the belly
  holdBall(t, rightAnchored = 0) {
    const L = this.palm('L', t).c, R = this.palm('R', t).c, ax = this.gripAxis(t);
    const mid = L.clone().add(R).multiplyScalar(0.5);
    const anch = R.clone().addScaledVector(ax, BALL_R + 0.022);
    const B = mid.lerp(anch, rightAnchored);
    const hip = this.tab('hip', t), f = this.fwd(t);
    // triple threat on the right hip, and the ball fake shown on the right: both stay visible from the camera
    // behind his right shoulder (the performer held the ball centre-left)
    if (t < PLAN.releases[0]) {
      const side = 0.3 + 0.16 * smooth((t - PLAN.tripleThreatEnd[0]) / (PLAN.tripleThreatEnd[1] - PLAN.tripleThreatEnd[0]));
      B.addScaledVector(V(-f.z, 0, f.x), side).addScaledVector(UP, -0.04 * (1 - smooth((t - 2.3) / 0.2)));
      const over = B.y - (hip.y + 0.3); if (over > 0) B.y -= over * 0.55; // keep the fake at chest height, out of his face
    }
    const ahead = B.clone().sub(hip).dot(f), low = 1 - smooth((B.y - hip.y - 0.3) / 0.25); // only below the chest
    if (ahead < 0.27) B.addScaledVector(f, (0.27 - ahead) * low);
    if (ahead > 0.36 && t < PLAN.releases[0]) B.addScaledVector(f, -(ahead - 0.36) * 0.85); // keep the ball fake out of his face
    return B;
  }
  layupBall(t) { // after the left hand leaves: ball sits in the right palm
    const p = this.palm('R', t);
    const u = smooth((t - PLAN.leftOff[0]) / (PLAN.leftOff[1] - PLAN.leftOff[0]));
    const n = this.gripAxis(t).lerp(p.y, u).normalize();
    return p.c.clone().addScaledVector(n, BALL_R + 0.02);
  }

  // Ball + hand overrides for YOU at sim time t
  handsAndBall(t) {
    const P = PLAN, rel = P.releases, n = rel.length, c0 = this.catches[0];
    const ov = {};
    let B, state = 'held';
    if (t < c0) { // ---- hold / ball show
      B = this.holdBall(t);
      const g = this.gripHands(B, t, this.gripAxis(t));
      ov.L = { ...g.L, w: 1 }; ov.R = { ...g.R, w: 1 };
    } else if (t < rel[0]) { // ---- push into the first dribble
      const u = smooth((t - c0) / (rel[0] - c0));
      const Hb = this.holdBall(t), Cb = this.contactBall(0, t);
      B = Hb.clone().lerp(Cb, u);
      const ax = this.gripAxis(t);
      const g = this.gripHands(B, t, ax), top = this.onTop(B, t);
      const nrm = g.R.nrm.clone().lerp(top.nrm, u).normalize(), dir = g.R.dir.clone().lerp(top.dir, u).normalize();
      ov.R = { pos: B.clone().addScaledVector(nrm, BALL_R + 0.004).addScaledVector(dir, -0.085).addScaledVector(nrm, 0.018), palm: nrm.clone().negate(), dir, curl: 0.3 - 0.12 * u, w: 1 };
      ov.L = { ...g.L, w: 1 - smooth((t - c0 - 0.04) / 0.26) };
    } else if (t < P.lastCatch) { // ---- dribble
      let j = 1; while (j < n && !(t >= this.catches[j] && t < rel[j])) j++;
      if (j < n) { B = this.contactBall(j, t); state = 'held'; }
      else { let k = n - 1; while (k > 0 && rel[k] > t) k--; B = this.flightBall(k, t); state = 'dribble'; }
      ov.R = { ...this.dribbleHand(t), w: 1 };
      const lu = smooth((t - c0 - 0.04) / 0.26);
      if (lu < 1) { const g = this.gripHands(B, t, this.gripAxis(t)); ov.L = { ...g.L, w: 1 - lu }; }
    } else if (t < P.release) { // ---- gather, rise, one hand
      const C = this.contactBall(n, t);
      const gu = smooth((t - P.lastCatch) / (P.gatherDone - P.lastCatch));
      const ax = this.gripAxis(t);
      const H = this.holdBall(t, 1 - smooth((t - P.gatherDone) / 0.12));
      B = C.clone().lerp(H, gu);
      const lo = smooth((t - P.leftOff[0]) / (P.leftOff[1] - P.leftOff[0]));
      if (lo > 0) B.lerp(this.layupBall(t), lo);
      const g = this.gripHands(B, t, ax), top = this.onTop(B, t);
      const nrm = top.nrm.clone().lerp(g.R.nrm, gu).normalize(), dir = top.dir.clone().lerp(g.R.dir, gu).normalize();
      ov.R = { pos: B.clone().addScaledVector(nrm, BALL_R + 0.004).addScaledVector(dir, -0.085).addScaledVector(nrm, 0.018), palm: nrm.clone().negate(), dir, curl: 0.18 + 0.2 * gu, w: 1 - lo };
      ov.L = { ...g.L, w: smooth((t - P.lastCatch - 0.12) / (P.gatherDone - P.lastCatch - 0.1)) * (1 - lo) };
    } else {
      B = this.shotBall(t).pos; state = 'shot';
    }
    return { B, ov, state };
  }
  // procedural right wrist during the dribble: on the ball in contact, a follow-through/return arc in between
  dribbleHand(t) {
    const P = PLAN, rel = P.releases, n = rel.length;
    let k = -1; while (k + 1 < n && rel[k + 1] <= t) k++;
    const inC = (j) => j < n ? t >= this.catches[j] && t < rel[j] : t >= this.catches[n];
    for (let j = 0; j <= n; j++) if (inC(j)) return this.onTop(this.contactBall(j, t), t);
    // in flight k: Hermite from the release pose to the catch pose
    const cy = this.cycles[k];
    const e = 0.004;
    const w0 = this.onTop(this.contactBall(k, cy.r - 1e-6), cy.r), w0b = this.onTop(this.contactBall(k, cy.r - e), cy.r - e);
    const k1 = k + 1;
    const w1 = this.onTop(this.contactBall(k1, cy.c), cy.c), w1b = this.onTop(this.contactBall(k1, cy.c + e), cy.c + e);
    const v0 = w0.pos.clone().sub(w0b.pos).multiplyScalar(0.8 / e), v1 = w1b.pos.clone().sub(w1.pos).multiplyScalar(0.55 / e);
    const s = clamp((t - cy.r) / cy.Tt, 0, 1);
    const top = this.onTop(V(), t);
    return { pos: herm(w0.pos, v0, w1.pos, v1, cy.Tt, s), palm: top.palm, dir: top.dir, curl: 0.2 };
  }

  // ---------- shot: off the glass and in ----------
  shotBall(t) {
    const P = PLAN;
    if (!this._rel) {
      this._rel = this.handsAndBall(P.release - 1e-4).B;
      this._board = V(0.17, 3.37, BOARD_Z + BALL_R + 0.005);
      this._rim = V(0.0, RIM.y + 0.1, 0.02);
    }
    if (t < P.board) return { pos: ballistic(this._rel, this._board, P.release, P.board, t), state: 'shot' };
    if (t < P.rim) return { pos: ballistic(this._board, this._rim, P.board, P.rim, t), state: 'shot' };
    if (t < P.netEnd) {
      const u = clamp((t - P.rim) / (P.netEnd - P.rim), 0, 1);
      return { pos: V(0.02 * (1 - u), RIM.y + 0.1 - 0.62 * (u * u * 0.5 + u * 0.5), 0.02 + 0.05 * u), state: 'net', netU: u };
    }
    // drop and bounce toward the right corner of the lane
    let tt = t - P.netEnd, py = RIM.y - 0.52, vy = -1.8, y = py;
    let rem = tt;
    for (let i = 0; i < 12; i++) {
      const disc = vy * vy + 2 * G * (py - BALL_R);
      const tHit = (vy + Math.sqrt(Math.max(disc, 0))) / G;
      if (rem < tHit) { y = py + vy * rem - 0.5 * G * rem * rem; break; }
      rem -= tHit; const vHit = vy - G * tHit; vy = -vHit * 0.62; py = BALL_R;
      if (vy < 0.35) { y = BALL_R; break; }
    }
    const d = Math.min(tt, 1.6);
    return { pos: V(0.02 + 0.28 * d - 0.05 * d * d, Math.max(BALL_R, y), 0.07 + 0.55 * d - 0.12 * d * d), state: 'drop' };
  }

  buildBallTrack() {
    const dt = 1 / HZ;
    this.ballTrack = [];
    const q = new THREE.Quaternion();
    let prev = null;
    for (let t = 0; t <= PLAN.simEnd + 1e-6; t += dt) {
      const b = this.ballRaw(t);
      if (prev && b.state !== 'held') {
        const d = b.pos.clone().sub(prev); const len = d.length();
        const ax = new THREE.Vector3().crossVectors(UP, d);
        if (len > 1e-5 && ax.lengthSq() > 1e-10) q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax.normalize(), len / BALL_R));
      }
      this.ballTrack.push(q.clone());
      prev = b.pos;
    }
  }
  ballRaw(t) {
    if (t >= PLAN.release) return this.shotBall(t);
    const r = this.handsAndBall(t);
    return { pos: r.B, state: r.state };
  }
  ball(t) {
    const b = this.ballRaw(t);
    return { ...b, q: this.ballTrack[clamp(Math.round(t * HZ), 0, this.ballTrack.length - 1)] };
  }

  // ---------- gaze ----------
  lookYou(t) {
    const d1 = this.tab('d1hip', t).add(V(0, 0.55, 0));
    const rim = RIM.clone();
    const ball = t >= PLAN.release ? this.shotBall(t).pos : null;
    // [time, target, weight]
    const keys = [[0, d1, 0.55], [3.35, d1, 0.8], [5.95, d1, 0.8], [6.35, rim, 0.6], [LAYUP.at - 0.1, rim, 0.6], [LAYUP.at + 0.15, rim, 0.9], [PLAN.release + 0.05, rim, 0.9]];
    if (ball) keys.push([PLAN.release + 0.35, ball, 0.75]);
    let i = 0; while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const u = b === a ? 0 : smooth((t - a[0]) / (b[0] - a[0]));
    return { look: a[1].clone().lerp(b[1], u), lookW: a[2] + (b[2] - a[2]) * u };
  }

  // ---------- per-frame poses ----------
  applyLock(who, T, t) {
    const f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    for (const s of ['L', 'R']) {
      const L = this.lock[who][s], o = L[i].clone().lerp(L[j], u), k = s.toLowerCase();
      for (const j2 of ['tibia', 'foot', 'toes']) T.pos[k + j2].add(o);
    }
    return T;
  }
  youPose(t) {
    const T = this.applyLock('you', this.tracks.you.at(t), t);
    const hb = this.handsAndBall(t);
    const lk = this.lookYou(t);
    return { T, opt: { handOverride: hb.ov, look: lk.look, lookW: lk.lookW, curl: 0.35 } };
  }
  d1Pose(t) {
    const T = this.applyLock('d1', this.tracks.d1.at(t), t);
    const b = this.ballRaw(t).pos;
    return { T, opt: { look: b, lookW: 0.45, curl: 0.35 } };
  }
  // body frame for camera / overlays: floor point under the hips + smoothed facing
  frame(name, t) {
    const hip = name === 'you' ? this.tab('hip', t) : this.tab('d1hip', t);
    const yaw = name === 'you' ? Math.atan2(this.fwd(t).x, this.fwd(t).z) : this.tab('d1yaw', t);
    const f = V(Math.sin(yaw), 0, Math.cos(yaw));
    return { p: V(hip.x, 0, hip.z), hip, yaw, f, r: V(-f.z, 0, f.x), l: V(f.z, 0, -f.x) };
  }
}
