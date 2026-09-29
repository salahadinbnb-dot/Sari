// v3 "tweener": ball, hands and gaze on top of the mocap tracks (src/play3.js).
// The dribble comes from the performer's own hands: every push (hand driving down) is found in the source clip,
// the ball rides under that palm, and between pushes it flies release -> floor -> next hand. The between-the-legs
// bounce is pinned between his feet. Then: pickup, rise, release, and a swish with backspin.
import * as THREE from 'three';
import { BALL_R, footLock, ballistic } from './game2.js';

const G = 9.81, HZ = 240;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIM = V(0, 3.05, 0);

export const PLAN3 = {
  simEnd: 6.4,
  tweener: 0,          // index of the push that goes between the legs
  gatherAt: 2.93,      // both hands take it off the last bounce
  gatherDur: 0.28,
  shotClip: 2.80,      // 06_15 clip time the ball leaves his fingertips
  flight: 1.26,        // release -> through the rim
};

// dribble pushes in a source clip between clip times a..b: hand going down fast enough, far enough
function findPushes(clip, a, b) {
  const out = [], dt = 1 / 240;
  for (const s of ['l', 'r']) {
    const h = (ct) => { const f = clamp(ct * clip.fps, 0, clip.n - 1), i = Math.floor(f), j = Math.min(i + 1, clip.n - 1), u = f - i;
      const arr = clip.pos[s + 'hand']; return arr[i * 3 + 1] + (arr[j * 3 + 1] - arr[i * 3 + 1]) * u; };
    const vy = (ct) => (h(ct + dt) - h(ct - dt)) / (2 * dt);
    let t = a;
    while (t < b) {
      if (vy(t) < -1.2) {
        let s0 = t; while (s0 > a && vy(s0 - dt) < -0.3) s0 -= dt;
        let e = t; while (e < b && vy(e + dt) < -0.3) e += dt;
        if (h(s0) - h(e) > 0.12) out.push({ hand: s.toUpperCase(), c0: s0, c1: e });
        t = e + dt;
      } else t += dt;
    }
  }
  out.sort((p, q) => p.c0 - q.c0);
  const clean = []; // a hand moving down while the other one is pushing isn't dribbling
  for (const p of out) { if (clean.length && p.c0 < clean[clean.length - 1].c1 && p.hand !== clean[clean.length - 1].hand) continue; clean.push(p); }
  return clean;
}

export class Game3 {
  constructor(tracks, rigs, clips) {
    this.tracks = tracks; this.rigs = rigs; this.clips = clips;
    this.buildTable();
    this.buildPushes();
    this.buildBall();
  }

  buildTable() {
    const rig = this.rigs.you, tr = this.tracks.you, d1 = this.tracks.d1, drig = this.rigs.d1;
    const n = Math.ceil(PLAN3.simEnd * HZ) + 1;
    const T = { n, hip: [], yaw: [], wL: [], wR: [], xL: [], xR: [], yL: [], yR: [], head: [], ankL: [], ankR: [], d1hip: [], d1yaw: [], d1shL: [], d1head: [] };
    const feet = { you: { L: [], R: [] }, d1: { L: [], R: [] } };
    const addFeet = (who, P) => { for (const s of ['L', 'R']) { const k = s.toLowerCase(); feet[who][s].push({ a: P.pos[k + 'tibia'].clone(), h: P.pos[k + 'hipjoint'].clone(), w: P.planted ? P.planted[s] : 0 }); } };
    const X = V(1, 0, 0), Y = V(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = i / HZ;
      const P = tr.at(t);
      rig.applyMocap(P, P.src, {});
      T.hip.push(rig.P.Root.clone()); T.yaw.push(P.yaw);
      T.wL.push(rig.P.L_Hand.clone()); T.wR.push(rig.P.R_Hand.clone());
      T.xL.push(X.clone().applyQuaternion(rig.W.L_Hand)); T.xR.push(X.clone().applyQuaternion(rig.W.R_Hand));
      T.yL.push(Y.clone().applyQuaternion(rig.W.L_Hand)); T.yR.push(Y.clone().applyQuaternion(rig.W.R_Hand));
      T.head.push(rig.P.Head.clone());
      T.ankL.push(P.pos.ltibia.clone()); T.ankR.push(P.pos.rtibia.clone());
      addFeet('you', P);
      const D = d1.at(t);
      drig.applyMocap(D, D.src, {});
      T.d1hip.push(D.pos.lhipjoint.clone().add(D.pos.rhipjoint).multiplyScalar(0.5)); T.d1yaw.push(D.yaw);
      T.d1shL.push(drig.P.L_UpperArm.clone()); T.d1head.push(drig.P.Head.clone());
      addFeet('d1', D);
    }
    this.T = T;
    const leg = (r) => r.len.thigh + r.len.calf, ly = leg(rig), ld = leg(drig);
    this.lock = { you: { L: footLock(feet.you.L, ly), R: footLock(feet.you.R, ly) }, d1: { L: footLock(feet.d1.L, ld), R: footLock(feet.d1.R, ld) } };
    const w = Math.round(0.1 * HZ);
    const raw = T.yaw.map(y => V(Math.sin(y), 0, Math.cos(y)));
    T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); return a.normalize(); });
  }
  tab(key, t) {
    const a = this.T[key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    return a[i].clone().lerp(a[j], u);
  }
  palm(side, t) {
    const w = this.tab('w' + side, t), x = this.tab('x' + side, t).normalize(), y = this.tab('y' + side, t).normalize();
    return { c: w.clone().addScaledVector(x, 0.085).addScaledVector(y, 0.018), x, y };
  }
  fwd(t) { return this.tab('fwd', t).normalize(); }

  // ---------- dribble schedule from the source clips ----------
  buildPushes() {
    const segs = this.tracks.you.segs, pushes = [];
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], clip = this.clips[sg.clip];
      const t0 = i === 0 ? 0 : segs[i].at + segs[i].blend * 0.5;          // hand over at mid-blend
      const t1 = i + 1 < segs.length ? segs[i + 1].at + segs[i + 1].blend * 0.5 : PLAN3.simEnd;
      const c0 = sg.from + (t0 - sg.at) * sg.rate, c1 = sg.from + (t1 - sg.at) * sg.rate;
      for (const p of findPushes(clip, c0 - 0.5, c1)) {
        const s0 = sg.at + (p.c0 - sg.from) / sg.rate, s1 = sg.at + (p.c1 - sg.from) / sg.rate;
        if (s1 >= t0 - 1e-3 && s0 < t1 && s1 < PLAN3.gatherAt - 0.05) pushes.push({ hand: p.hand, s0, s1 });
      }
    }
    // the first push of the combo segment goes between the legs
    const combo = segs[1].at;
    PLAN3.tweener = pushes.findIndex(p => p.s0 >= combo);
    this.pushes = pushes;
    // contact starts a little before each push (the hand meets the rising ball)
    for (let k = 0; k < pushes.length; k++) {
      const gap = k > 0 ? pushes[k].s0 - pushes[k - 1].s1 : 0.3;
      pushes[k].catch = pushes[k].s0 - clamp((gap - 0.2) * 0.5, 0.02, 0.1); // quick switches: hand meets it as it pushes
    }
    const sh = segs.find(s => s.shot);
    PLAN3.release = sh.at + (PLAN3.shotClip - sh.from) / sh.rate;
    PLAN3.rim = PLAN3.release + PLAN3.flight; PLAN3.netEnd = PLAN3.rim + 0.26;
  }
  onPalm(side, t) { // ball resting under a palm while that hand dribbles it
    const p = this.palm(side, t);
    return p.c.clone().addScaledVector(UP, -(BALL_R + 0.012)).addScaledVector(this.fwd(t), 0.015);
  }
  holdBall(t) { // both hands: between the palms, clear of the chest
    const L = this.palm('L', t).c, R = this.palm('R', t).c;
    const B = L.clone().add(R).multiplyScalar(0.5);
    const hip = this.tab('hip', t), f = this.fwd(t), ahead = B.clone().sub(hip).dot(f);
    if (ahead < 0.25) B.addScaledVector(f, 0.25 - ahead);
    return B;
  }
  buildBall() {
    const P = this.pushes;
    this.flights = [];
    for (let k = 0; k < P.length; k++) {
      const r = P[k].s1, B0 = this.onPalm(P[k].hand, r);
      const last = k + 1 >= P.length;
      const c = last ? PLAN3.gatherAt : P[k + 1].catch;
      const B1 = last ? this.gatherBall(c) : this.onPalm(P[k + 1].hand, c);
      const tb = r + 0.4 * (c - r);
      let F;
      if (k === PLAN3.tweener) { // between the legs: bounce midway between his ankles
        const a = this.tab('ankL', tb), b = this.tab('ankR', tb);
        F = a.add(b).multiplyScalar(0.5); F.y = BALL_R;
      } else F = V(B0.x + (B1.x - B0.x) * 0.4, BALL_R, B0.z + (B1.z - B0.z) * 0.4);
      this.flights.push({ r, tb, c, B0, F, B1, hand: P[k].hand, next: last ? 'both' : P[k + 1].hand });
    }
  }
  gatherBall(t) { // where both hands scoop it: low and in front, then it rises with the hands
    const f = this.fwd(t), hip = this.tab('hip', t);
    return hip.clone().addScaledVector(f, 0.38).addScaledVector(V(-f.z, 0, f.x), 0.08).setY(hip.y + 0.02);
  }

  // ball position/state and hand overrides at sim time t
  handsAndBall(t) {
    const P = this.pushes, ov = {};
    if (t < PLAN3.gatherAt) {
      // contact? (from catch to release of some push)
      for (let k = 0; k < P.length; k++) {
        if (t >= P[k].catch && t < P[k].s1) return { B: this.onPalm(P[k].hand, t), state: 'held', ov };
      }
      // before the first catch: resting under the left palm (he's already dribbling when we cut in)
      if (t < P[0].catch) return { B: this.onPalm(P[0].hand, t), state: 'held', ov };
      const fl = this.flights.find(f => t >= f.r && t < f.c);
      if (fl) return { B: t < fl.tb ? ballistic(fl.B0, fl.F, fl.r, fl.tb, t) : ballistic(fl.F, fl.B1, fl.tb, fl.c, t), state: 'dribble', ov };
      return { B: this.onPalm(P[P.length - 1].hand, t), state: 'held', ov };
    }
    if (t < PLAN3.release) {
      // gather: hands clamp the ball where it came up, then carry it into the natural shooting motion
      const g = smooth((t - PLAN3.gatherAt) / PLAN3.gatherDur);
      const B = this.gatherBall(PLAN3.gatherAt).lerp(this.holdBall(t), g);
      const n = this.palm('L', t).c.sub(this.palm('R', t).c); if (n.lengthSq() < 1e-4) n.copy(V(-this.fwd(t).z, 0, this.fwd(t).x)); n.normalize();
      const w = 1;
      for (const [side, sg] of [['L', 1], ['R', -1]]) {
        const nn = n.clone().multiplyScalar(sg), f = this.fwd(t);
        let dir = f.clone().multiplyScalar(0.6).addScaledVector(UP, 0.8); dir.addScaledVector(nn, -dir.dot(nn)).normalize();
        const contact = B.clone().addScaledVector(nn, BALL_R + 0.004);
        ov[side] = { pos: contact.addScaledVector(dir, -0.085).addScaledVector(nn, 0.018), palm: nn.clone().negate(), dir, curl: 0.35, w };
      }
      return { B, state: 'held', ov };
    }
    // just released: hands ease from the ball's sides into the natural follow-through
    const k = 1 - smooth((t - PLAN3.release) / 0.1);
    if (k > 0) { const g = this.handsAndBall(PLAN3.release - 1e-4).ov; for (const s of ['L', 'R']) if (g[s]) ov[s] = { ...g[s], w: k }; }
    return { ...this.shotBall(t), ov };
  }
  shotBall(t) {
    if (!this._rel) { this._rel = this.holdBall(PLAN3.release - 1e-4); this._rim = V(RIM.x + 0.01, RIM.y + 0.1, RIM.z + 0.02); }
    if (t < PLAN3.rim) return { B: ballistic(this._rel, this._rim, PLAN3.release, PLAN3.rim, t), state: 'shot' };
    if (t < PLAN3.netEnd) {
      const u = clamp((t - PLAN3.rim) / (PLAN3.netEnd - PLAN3.rim), 0, 1);
      return { B: V(0.01 * (1 - u), RIM.y + 0.1 - 0.64 * (u * u * 0.5 + u * 0.5), 0.02 + 0.06 * u), state: 'net', netU: u };
    }
    let tt = t - PLAN3.netEnd, py = RIM.y - 0.54, vy = -1.9, y = py, rem = tt;
    for (let i = 0; i < 12; i++) {
      const tHit = (vy + Math.sqrt(Math.max(vy * vy + 2 * G * (py - BALL_R), 0))) / G;
      if (rem < tHit) { y = py + vy * rem - 0.5 * G * rem * rem; break; }
      rem -= tHit; vy = -(vy - G * tHit) * 0.62; py = BALL_R;
      if (vy < 0.35) { y = BALL_R; break; }
    }
    const d = Math.min(tt, 1.6);
    return { B: V(0.01 + 0.35 * d - 0.07 * d * d, Math.max(BALL_R, y), 0.08 + 0.5 * d - 0.1 * d * d), state: 'drop' };
  }
  ball(t) {
    const r = this.handsAndBall(t);
    // orientation: rolls with its motion on the floor and in the dribble, backspin on the shot
    if (!this.qTrack) this.buildSpin();
    const q = this.qTrack[clamp(Math.round(t * HZ), 0, this.qTrack.length - 1)];
    return { pos: r.B, state: r.state, netU: r.netU, q };
  }
  buildSpin() {
    this.qTrack = [];
    const q = new THREE.Quaternion();
    let prev = null;
    for (let t = 0; t <= PLAN3.simEnd + 1e-6; t += 1 / HZ) {
      const r = this.handsAndBall(t);
      if (prev) {
        const d = r.B.clone().sub(prev); d.y = r.state === 'shot' ? d.y : 0;
        const len = Math.hypot(d.x, d.z);
        if (r.state === 'shot') { // backspin about the horizontal axis across the flight
          const fl = V(-this._rel.x, 0, -this._rel.z).normalize(), ax = V(fl.z, 0, -fl.x);
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, -2 * Math.PI * 2.2 / HZ));
        } else if (r.state !== 'held' && len > 1e-5) {
          const ax = new THREE.Vector3().crossVectors(UP, d).normalize();
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, len / BALL_R));
        }
      }
      this.qTrack.push(q.clone()); prev = r.B;
    }
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
    const d1 = this.tab('d1hip', t).add(V(0, 0.6, 0));
    const u = smooth((t - 2.75) / 0.35);
    const look = d1.lerp(RIM.clone(), u), lookW = 0.55 + 0.3 * u;
    return { T, opt: { handOverride: hb.ov, look, lookW, curl: 0.3 } };
  }
  d1Pose(t) {
    const T = this.applyLock('d1', this.tracks.d1.at(t), t);
    const b = this.handsAndBall(t).B;
    // late contest: the left hand comes up as he arrives, after the ball is already gone
    const w = smooth((t - (PLAN3.release - 0.1)) / 0.3) * (1 - smooth((t - (PLAN3.release + 0.75)) / 0.4));
    const opt = { look: b, lookW: 0.5, curl: 0.3 };
    if (w > 0) {
      const sh = this.tab('d1shL', t), you = this.tab('hip', t), to = V(you.x - sh.x, 0, you.z - sh.z).normalize();
      const pos = sh.clone().addScaledVector(UP, 0.56).addScaledVector(to, 0.2);
      opt.handOverride = { L: { pos, palm: to.clone(), dir: UP.clone().addScaledVector(to, 0.25).normalize(), pole: V(0, -1, 0).addScaledVector(to, -0.5).normalize(), curl: 0.1, w } };
    }
    return { T, opt };
  }
  frame(name, t) {
    const hip = name === 'you' ? this.tab('hip', t) : this.tab('d1hip', t);
    const yaw = name === 'you' ? Math.atan2(this.fwd(t).x, this.fwd(t).z) : this.tab('d1yaw', t);
    const f = V(Math.sin(yaw), 0, Math.cos(yaw));
    return { p: V(hip.x, 0, hip.z), hip, yaw, f, r: V(-f.z, 0, f.x), l: V(f.z, 0, -f.x) };
  }
}
