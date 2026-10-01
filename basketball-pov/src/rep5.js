// v5 rep engine: ball, hands, defender arms, contact and the defender's balance on top of one rep's mocap tracks.
// Generalised from game3.js: a plan says when the ball is held (triple threat), dribbled (pushes found in the
// source hands), gathered, shot (jumper -> swish) or laid up (off the glass). The defender's balance is the
// extrapolated centre of mass (XcoM = CoM + v / w0, the point his momentum carries him to) against his feet: when it
// leaves the base behind his heels or outside his feet he can't contest until he re-plants.
import * as THREE from 'three';
import { BALL_R, footLock, ballistic } from './game2.js';

const G = 9.81, HZ = 240, W0 = Math.sqrt(G / 0.95);
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const RIM = V(0, 3.05, 0);
const BOARD_Z = -0.38;

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
  const clean = [];
  for (const p of out) { if (clean.length && p.c0 < clean[clean.length - 1].c1 && p.hand !== clean[clean.length - 1].hand) continue; clean.push(p); }
  return clean;
}
// a bump that peaks at tau0 and dies away (critically damped response to a shove)
const bump = (tau, tau0) => tau <= 0 ? 0 : (tau / tau0) * Math.exp(1 - tau / tau0);

export class Rep {
  // plan: { simEnd, hold:[a,b]?, dribble:[a,b]?, gatherAt, gatherDur, shotClip?, flight?, layup?:{releaseClip, side},
  //         contest?:{from, to, side, high}, contact?:{t, push, you} }
  constructor(name, tracks, rigs, clips, plan) {
    this.name = name; this.tracks = tracks; this.rigs = rigs; this.clips = clips; this.plan = plan;
    const c = plan.contact;
    if (c && !c.dir) { const a = tracks.you.hip(c.t), b = tracks.d1.hip(c.t); c.dir = V(b.x - a.x, 0, b.z - a.z).normalize(); }
    this.buildTable();
    this.buildPushes();
    this.buildBall();
    this.buildBalance();
    this.buildTakeoff();
  }
  buildTable() {
    const rig = this.rigs.you, tr = this.tracks.you, d1 = this.tracks.d1, drig = this.rigs.d1, P0 = this.plan;
    const n = Math.ceil(P0.simEnd * HZ) + 1;
    const T = { n, hip: [], yaw: [], wL: [], wR: [], xL: [], xR: [], yL: [], yR: [], head: [], ankL: [], ankR: [], d1hip: [], d1yaw: [], d1shL: [], d1shR: [], d1head: [], d1com: [], d1feet: [] };
    const feet = { you: { L: [], R: [] }, d1: { L: [], R: [] } };
    const addFeet = (who, P) => { for (const s of ['L', 'R']) { const k = s.toLowerCase(); feet[who][s].push({ a: P.pos[k + 'tibia'].clone(), h: P.pos[k + 'hipjoint'].clone(), w: P.planted ? P.planted[s] : 0 }); } };
    const X = V(1, 0, 0), Y = V(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = i / HZ;
      const P = tr.at(t); this.contactOffset('you', P, t);
      rig.applyMocap(P, P.src, {});
      T.hip.push(rig.P.Root.clone()); T.yaw.push(P.yaw);
      T.wL.push(rig.P.L_Hand.clone()); T.wR.push(rig.P.R_Hand.clone());
      T.xL.push(X.clone().applyQuaternion(rig.W.L_Hand)); T.xR.push(X.clone().applyQuaternion(rig.W.R_Hand));
      T.yL.push(Y.clone().applyQuaternion(rig.W.L_Hand)); T.yR.push(Y.clone().applyQuaternion(rig.W.R_Hand));
      T.head.push(rig.P.Head.clone()); T.ankL.push(P.pos.ltibia.clone()); T.ankR.push(P.pos.rtibia.clone());
      addFeet('you', P);
      const D = d1.at(t); this.contactOffset('d1', D, t);
      drig.applyMocap(D, D.src, {});
      const dh = D.pos.lhipjoint.clone().add(D.pos.rhipjoint).multiplyScalar(0.5);
      T.d1hip.push(dh); T.d1yaw.push(D.yaw);
      T.d1shL.push(drig.P.L_UpperArm.clone()); T.d1shR.push(drig.P.R_UpperArm.clone()); T.d1head.push(drig.P.Head.clone());
      T.d1com.push(dh.clone().multiplyScalar(0.45).addScaledVector(D.pos.thorax, 0.3).addScaledVector(D.pos.head, 0.08)
        .addScaledVector(D.pos.lfemur, 0.085).addScaledVector(D.pos.rfemur, 0.085));
      T.d1feet.push([D.pos.ltibia.clone(), D.pos.rtibia.clone(), D.pos.ltoes.clone(), D.pos.rtoes.clone()]);
      addFeet('d1', D);
    }
    this.T = T;
    const leg = (r) => r.len.thigh + r.len.calf;
    this.lock = { you: { L: footLock(feet.you.L, leg(rig)), R: footLock(feet.you.R, leg(rig)) }, d1: { L: footLock(feet.d1.L, leg(drig)), R: footLock(feet.d1.R, leg(drig)) } };
    const w = Math.round(0.1 * HZ), raw = T.yaw.map(y => V(Math.sin(y), 0, Math.cos(y)));
    T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); return a.normalize(); });
  }
  // shove at the rim: the defender's upper body goes back along the line of the drive, the finisher absorbs a little
  contactOffset(who, P, t) {
    const c = this.plan.contact; if (!c) return;
    const tau = t - c.t; if (tau <= 0) return;
    const dir = c.dir.clone().normalize();
    const amt = who === 'd1' ? c.push * bump(tau, 0.16) + c.push * 0.45 * smooth(tau / 0.35) : -(c.you || 0.06) * bump(tau, 0.1);
    if (!amt) return;
    for (const [k, v] of Object.entries(P.pos)) {
      if (/tibia|foot|toes/.test(k)) continue;
      const w = /femur/.test(k) ? 0.5 : 1;
      v.addScaledVector(dir, amt * w);
      if (who === 'd1') v.y -= 0.05 * bump(tau, 0.2) * w;
    }
  }
  tab(key, t) {
    const a = this.T[key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    if (Array.isArray(a[0])) return a[u < 0.5 ? i : j].map(v => v.clone());
    return a[i].clone().lerp(a[j], u);
  }
  palm(side, t) {
    const w = this.tab('w' + side, t), x = this.tab('x' + side, t).normalize(), y = this.tab('y' + side, t).normalize();
    return { c: w.clone().addScaledVector(x, 0.085).addScaledVector(y, 0.018), x, y };
  }
  fwd(t) { return this.tab('fwd', t).normalize(); }
  applyLock(who, T, t) {
    const f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    for (const s of ['L', 'R']) {
      const L = this.lock[who][s], o = L[i].clone().lerp(L[j], u), k = s.toLowerCase();
      for (const j2 of ['tibia', 'foot', 'toes']) T.pos[k + j2].add(o);
    }
    return T;
  }

  // ---------- ball schedule ----------
  buildPushes() {
    const P0 = this.plan, pushes = [];
    if (P0.dribble) {
      const segs = this.tracks.you.segs;
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i], clip = this.clips[sg.clip];
        const t0 = Math.max(P0.dribble[0], i === 0 ? 0 : sg.at + sg.blend * 0.5);
        const t1 = Math.min(P0.dribble[1], i + 1 < segs.length ? segs[i + 1].at + segs[i + 1].blend * 0.5 : P0.simEnd);
        if (t1 <= t0) continue;
        const c0 = sg.from + (t0 - sg.at) * sg.rate, c1 = sg.from + (t1 - sg.at) * sg.rate;
        for (const p of findPushes(clip, c0 - 0.4, c1)) {
          const s0 = sg.at + (p.c0 - sg.from) / sg.rate, s1 = sg.at + (p.c1 - sg.from) / sg.rate;
          if (s1 >= t0 && s0 < t1 && s1 < P0.gatherAt - 0.05) pushes.push({ hand: p.hand, s0, s1 });
        }
      }
      for (let k = 0; k < pushes.length; k++) {
        const gap = k > 0 ? pushes[k].s0 - pushes[k - 1].s1 : 0.3;
        pushes[k].catch = pushes[k].s0 - clamp((gap - 0.2) * 0.5, 0.02, 0.1);
      }
    }
    this.pushes = pushes;
    const sh = this.tracks.you.segs.find(s => s.shot);
    if (P0.shotClip !== undefined) { P0.release = sh.at + (P0.shotClip - sh.from) / sh.rate; P0.rim = P0.release + P0.flight; P0.netEnd = P0.rim + 0.26; }
    if (P0.layup) {
      P0.release = sh.at + (P0.layup.releaseClip - sh.from) / sh.rate;
      P0.board = P0.release + 0.3; P0.rim = P0.board + 0.2; P0.netEnd = P0.rim + 0.24;
    }
  }
  // first moment after the gather with both feet off the floor
  buildTakeoff() {
    // ankle heights while he's planted at the gather are the floor reference (clips sit at slightly different heights)
    const T = this.T, P0 = this.plan, i0 = Math.round(P0.gatherAt * HZ), win = (a) => Math.min(...a.slice(Math.max(0, i0 - 24), i0 + 48).map(v => v.y));
    const fl = win(T.ankL), fr = win(T.ankR);
    for (let i = i0; i < T.n; i++) if (T.ankL[i].y > fl + 0.05 && T.ankR[i].y > fr + 0.05) { P0.takeoff = i / HZ; break; }
    if (P0.takeoff === undefined || P0.takeoff > P0.release) P0.takeoff = P0.release - 0.25;
  }
  onPalm(side, t) { const p = this.palm(side, t); return p.c.clone().addScaledVector(UP, -(BALL_R + 0.012)).addScaledVector(this.fwd(t), 0.015); }
  holdBall(t) {
    const L = this.palm('L', t).c, R = this.palm('R', t).c, B = L.clone().add(R).multiplyScalar(0.5);
    const hip = this.tab('hip', t), f = this.fwd(t), ahead = B.clone().sub(hip).dot(f);
    if (ahead < 0.25) B.addScaledVector(f, 0.25 - ahead);
    return B;
  }
  // triple threat: tucked at the right hip, both hands on it
  hipBall(t) {
    const f = this.fwd(t), r = V(-f.z, 0, f.x), hip = this.tab('hip', t);
    return hip.clone().addScaledVector(f, 0.3).addScaledVector(r, -0.16).setY(hip.y + 0.08);
  }
  gatherBall(t) { const f = this.fwd(t), hip = this.tab('hip', t); return hip.clone().addScaledVector(f, 0.38).addScaledVector(V(-f.z, 0, f.x), 0.08).setY(hip.y + 0.02); }
  buildBall() {
    const P = this.pushes, P0 = this.plan; this.flights = [];
    for (let k = 0; k < P.length; k++) {
      const r = P[k].s1, B0 = this.onPalm(P[k].hand, r), last = k + 1 >= P.length;
      const c = last ? P0.gatherAt : P[k + 1].catch, B1 = last ? this.gatherBall(c) : this.onPalm(P[k + 1].hand, c);
      const tb = r + 0.4 * (c - r), F = V(B0.x + (B1.x - B0.x) * 0.4, BALL_R, B0.z + (B1.z - B0.z) * 0.4);
      this.flights.push({ r, tb, c, B0, F, B1 });
    }
  }
  // both hands on the ball's sides at B (fingers up and forward)
  grip(B, t, w = 1) {
    const ov = {}, f = this.fwd(t);
    const n = this.palm('L', t).c.sub(this.palm('R', t).c); if (n.lengthSq() < 1e-4) n.copy(V(-f.z, 0, f.x)); n.normalize();
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const nn = n.clone().multiplyScalar(sg);
      let dir = f.clone().multiplyScalar(0.6).addScaledVector(UP, 0.8); dir.addScaledVector(nn, -dir.dot(nn)).normalize();
      const contact = B.clone().addScaledVector(nn, BALL_R + 0.004);
      ov[side] = { pos: contact.addScaledVector(dir, -0.085).addScaledVector(nn, 0.018), palm: nn.clone().negate(), dir, curl: 0.35, w };
    }
    return ov;
  }
  handsAndBall(t) {
    const P0 = this.plan, P = this.pushes;
    const hold0 = P0.hold ? P0.hold[1] : -1;
    if (P0.hold && t < hold0) { const B = this.hipBall(t); return { B, state: 'held', ov: this.grip(B, t, 0.9) }; }
    if (P.length && t < P0.gatherAt) {
      for (let k = 0; k < P.length; k++) if (t >= P[k].catch && t < P[k].s1) return { B: this.onPalm(P[k].hand, t), state: 'held', ov: {} };
      if (t < P[0].catch) { // from the hip into the first push
        const u = smooth((t - hold0) / Math.max(P[0].catch - hold0, 0.05));
        return { B: this.hipBall(t).lerp(this.onPalm(P[0].hand, t), u), state: 'held', ov: u < 1 ? this.grip(this.hipBall(t), t, 0.9 * (1 - u)) : {} };
      }
      const fl = this.flights.find(f => t >= f.r && t < f.c);
      if (fl) return { B: t < fl.tb ? ballistic(fl.B0, fl.F, fl.r, fl.tb, t) : ballistic(fl.F, fl.B1, fl.tb, fl.c, t), state: 'dribble', ov: {} };
    }
    if (t < P0.release) {
      // from the hip (or the last bounce) up into the shooting pocket, both hands on it
      const from = P.length ? this.gatherBall(P0.gatherAt) : this.hipBall(Math.max(hold0, 0));
      const g = smooth((t - P0.gatherAt) / P0.gatherDur);
      const B = (t < P0.gatherAt ? this.hipBall(t) : from.clone()).lerp(this.holdBall(t), g);
      if (P0.layup && t > P0.layup.oneHand) { // last beat: the off hand comes away, the finishing hand carries it up
        const u = smooth((t - P0.layup.oneHand) / 0.12), s = P0.layup.side, pl = this.palm(s, t);
        B.lerp(pl.c.clone().addScaledVector(pl.y, -(BALL_R + 0.01)), u);
        const ov = this.grip(B, t, 1); ov[s === 'R' ? 'L' : 'R'].w = 1 - u; ov[s].w = 1;
        return { B, state: 'held', ov };
      }
      return { B, state: 'held', ov: this.grip(B, t, 1) };
    }
    const k = 1 - smooth((t - P0.release) / 0.1), ov = {};
    if (k > 0) { const g = this.handsAndBall(P0.release - 1e-4).ov; for (const s of ['L', 'R']) if (g[s]) ov[s] = { ...g[s], w: g[s].w * k }; }
    return { ...(P0.layup ? this.layupBall(t) : this.shotBall(t)), ov };
  }
  dropAfter(t) {
    let tt = t - this.plan.netEnd, py = RIM.y - 0.54, vy = -1.9, y = py, rem = tt;
    for (let i = 0; i < 12; i++) {
      const tHit = (vy + Math.sqrt(Math.max(vy * vy + 2 * G * (py - BALL_R), 0))) / G;
      if (rem < tHit) { y = py + vy * rem - 0.5 * G * rem * rem; break; }
      rem -= tHit; vy = -(vy - G * tHit) * 0.62; py = BALL_R;
      if (vy < 0.35) { y = BALL_R; break; }
    }
    const d = Math.min(tt, 1.6), drift = this.dropDir || V(0.3, 0, 0.45);
    return { B: V(0.01 + drift.x * d - 0.07 * d * d, Math.max(BALL_R, y), 0.08 + drift.z * d - 0.1 * d * d), state: 'drop' };
  }
  shotBall(t) {
    const P0 = this.plan;
    if (!this._rel) { this._rel = this.holdBall(P0.release - 1e-4); this._rim = V(RIM.x + 0.01, RIM.y + 0.1, RIM.z + 0.02); }
    if (t < P0.rim) return { B: ballistic(this._rel, this._rim, P0.release, P0.rim, t), state: 'shot' };
    if (t < P0.netEnd) { const u = clamp((t - P0.rim) / (P0.netEnd - P0.rim), 0, 1); return { B: V(0.01 * (1 - u), RIM.y + 0.1 - 0.64 * (u * u * 0.5 + u * 0.5), 0.02 + 0.06 * u), state: 'net', netU: u }; }
    return this.dropAfter(t);
  }
  layupBall(t) {
    const P0 = this.plan;
    if (!this._rel) {
      const s = P0.layup.side, pl = this.palm(s, P0.release - 1e-4);
      this._rel = pl.c.clone().addScaledVector(pl.y, -(BALL_R + 0.01));
      this._board = V(Math.sign(this._rel.x || 1) * 0.17, 3.37, BOARD_Z + BALL_R + 0.005);
      this._rim = V(0.02, RIM.y + 0.08, 0.02);
    }
    if (t < P0.board) return { B: ballistic(this._rel, this._board, P0.release, P0.board, t), state: 'shot' };
    if (t < P0.rim) return { B: ballistic(this._board, this._rim, P0.board, P0.rim, t), state: 'shot' };
    if (t < P0.netEnd) { const u = clamp((t - P0.rim) / (P0.netEnd - P0.rim), 0, 1); return { B: V(0.02 * (1 - u), RIM.y + 0.08 - 0.62 * (u * u * 0.5 + u * 0.5), 0.02 + 0.05 * u), state: 'net', netU: u }; }
    return this.dropAfter(t);
  }
  ball(t) {
    const r = this.handsAndBall(t);
    if (!this.qTrack) this.buildSpin();
    return { pos: r.B, state: r.state, netU: r.netU, q: this.qTrack[clamp(Math.round(t * HZ), 0, this.qTrack.length - 1)] };
  }
  buildSpin() {
    this.qTrack = []; const q = new THREE.Quaternion(); let prev = null;
    for (let t = 0; t <= this.plan.simEnd + 1e-6; t += 1 / HZ) {
      const r = this.handsAndBall(t);
      if (prev) {
        const d = r.B.clone().sub(prev); d.y = r.state === 'shot' ? d.y : 0;
        const len = Math.hypot(d.x, d.z);
        if (r.state === 'shot') { const fl = V(-this._rel.x, 0, -this._rel.z).normalize(), ax = V(fl.z, 0, -fl.x); q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, -2 * Math.PI * 2.2 / HZ)); }
        else if (r.state !== 'held' && len > 1e-5) { const ax = new THREE.Vector3().crossVectors(UP, d).normalize(); q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, len / BALL_R)); }
      }
      this.qTrack.push(q.clone()); prev = r.B;
    }
  }

  // ---------- the defender's balance ----------
  // per sample: XcoM on the floor, the base (feet), and how far XcoM sits behind his heels / outside his feet,
  // measured against the line to the ball handler
  buildBalance() {
    const T = this.T, n = T.n, dt = 1 / HZ, out = [];
    for (let i = 0; i < n; i++) {
      const c = T.d1com[i], cp = T.d1com[Math.max(0, i - 2)], cn = T.d1com[Math.min(n - 1, i + 2)];
      const v = cn.clone().sub(cp).multiplyScalar(1 / ((Math.min(n - 1, i + 2) - Math.max(0, i - 2)) * dt)); v.y = 0;
      const x = c.clone().addScaledVector(v, 1 / W0); x.y = 0;
      const toYou = T.hip[i].clone().sub(T.d1hip[i]); toYou.y = 0; toYou.normalize();
      const side = V(-toYou.z, 0, toYou.x);
      // base: ankles, toes, and heels a third of a foot behind the ankles
      const [la, ra, lt, rt] = T.d1feet[i].map(p => V(p.x, 0, p.z));
      const feet = [la, ra, lt, rt, la.clone().addScaledVector(la.clone().sub(lt), 0.3), ra.clone().addScaledVector(ra.clone().sub(rt), 0.3)];
      // XcoM behind every foot point (away from the shooter) = on his heels; outside all of them sideways = leaning
      const along = feet.map(p => p.clone().sub(x).dot(toYou)), across = feet.map(p => p.clone().sub(x).dot(side));
      const behind = Math.max(0, Math.min(...along));
      const outside = Math.max(...across) < 0 ? -Math.max(...across) : (Math.min(...across) > 0 ? Math.min(...across) : 0);
      // momentum that isn't bringing him toward the shooter: he can't contest until he re-plants and reverses it
      const vIn = Math.max(0, v.dot(toYou)), away = v.clone().addScaledVector(toYou, -vIn).length();
      const lat = Math.abs(v.dot(side)), back = Math.max(0, -v.dot(toYou));
      // which way it's going wrong: the XcoM's offset from the middle of his feet, back (heels) or sideways (lean)
      const mid = feet.reduce((s, p) => s.add(p), V()).multiplyScalar(1 / feet.length), o = x.clone().sub(mid);
      out.push({ x, c: V(c.x, 0, c.z), v, toYou, side, behind, outside, away, lat, back, speed: v.length(), base: feet, oBack: Math.max(0, -o.dot(toYou)), oSide: Math.abs(o.dot(side)) });
    }
    // smooth the scalars a little so the meter doesn't flicker
    const k = Math.round(0.04 * HZ);
    for (const key of ['behind', 'outside', 'away', 'lat', 'back', 'speed', 'oBack', 'oSide']) {
      const raw = out.map(o => o[key]);
      out.forEach((o, i) => { let s = 0, m = 0; for (let j = -k; j <= k; j++) { const q = raw[clamp(i + j, 0, n - 1)]; s += q; m++; } o[key] = s / m; });
    }
    this.bal = out;
  }
  // open: 0 = balanced and squared up (he can contest), 1 = his weight is going the wrong way (shoot / go now)
  // (help defender at the rim: what matters is whether he's set - feet still, not moving - when you get there)
  balance(t) {
    const b = this.bal[clamp(Math.round(t * HZ), 0, this.bal.length - 1)];
    if (this.plan.contact) { const open = smooth((b.speed - 0.35) / 0.5); return { ...b, heels: 0, lean: 0, open, kind: open < 0.5 ? 'set' : 'notset' }; }
    const heels = Math.max(smooth((b.behind - 0.02) / 0.08), smooth((b.back - 0.3) / 0.4));
    const lean = Math.max(smooth((b.outside - 0.03) / 0.08), smooth((b.lat - 0.35) / 0.4));
    const open = Math.max(heels, lean, smooth((b.away - 0.35) / 0.4));
    return { ...b, heels, lean, open, kind: open < 0.5 ? 'balanced' : (b.oSide > b.oBack ? 'lean' : 'heels') };
  }

  // ---------- poses ----------
  youPose(t) {
    const P = this.tracks.you.at(t); this.contactOffset('you', P, t);
    const T = this.applyLock('you', P, t), hb = this.handsAndBall(t);
    const d1 = this.tab('d1hip', t).add(V(0, 0.6, 0));
    const u = this.plan.release !== undefined ? smooth((t - (this.plan.release - 0.6)) / 0.35) : 0;
    return { T, opt: { handOverride: hb.ov, look: d1.lerp(RIM.clone(), u), lookW: 0.55 + 0.3 * u, curl: 0.3 } };
  }
  d1Pose(t) {
    const P = this.tracks.d1.at(t); this.contactOffset('d1', P, t);
    const T = this.applyLock('d1', P, t), b = this.handsAndBall(t).B, opt = { look: b, lookW: 0.5, curl: 0.3 }, c = this.plan.contest;
    if (c) {
      const w = smooth((t - c.from) / 0.25) * (1 - smooth((t - c.to) / 0.4));
      if (w > 0) {
        opt.handOverride = {};
        for (const s of c.both ? ['L', 'R'] : [c.side || 'L']) {
          const sh = this.tab(s === 'L' ? 'd1shL' : 'd1shR', t), you = this.tab('hip', t), to = V(you.x - sh.x, 0, you.z - sh.z).normalize();
          const pos = sh.clone().addScaledVector(UP, c.high ?? 0.56).addScaledVector(to, c.reach ?? 0.2);
          opt.handOverride[s] = { pos, palm: to.clone(), dir: UP.clone().addScaledVector(to, 0.25).normalize(), pole: V(0, -1, 0).addScaledVector(to, -0.5).normalize(), curl: 0.1, w };
        }
      }
    }
    return { T, opt };
  }
  frame(name, t) {
    const hip = name === 'you' ? this.tab('hip', t) : this.tab('d1hip', t);
    const yaw = name === 'you' ? Math.atan2(this.fwd(t).x, this.fwd(t).z) : this.tab('d1yaw', t);
    const f = V(Math.sin(yaw), 0, Math.cos(yaw));
    return { p: V(hip.x, 0, hip.z), hip, yaw, f, r: V(-f.z, 0, f.x) };
  }
}
