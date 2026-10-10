// v6 rep engine, on top of one approach-and-jump track:
//  - the arms: no ball, a two-arm swing into the jump (back on the plant, up through the takeoff) and one hand to the
//    rim at the top; with the ball, carried in the right hand, taken in both on the big step, up with the jump, cocked
//    back behind the head and thrown down through the rim, then the hand grabs the rim
//  - the rim on its breakaway hinge (flexes under the hand, springs back and rings), the backboard and the net
//  - the ball after the dunk (through the net, onto the floor, bouncing)
//  - the numbers: approach speed, how far the hips drop on the plant, hang time and the vertical it means
//    (h = g T^2 / 8), and the reach
import * as THREE from 'three';
import { BALL_R, footLock } from './game2.js';
import { RIM as R0 } from './play6.js';

const G = 9.81, HZ = 240;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const RIM = V(R0.x, R0.y, R0.z);
export const HINGE = V(0, 3.05, -0.37);
export const RIM_R = 0.2286;

// cubic Hermite through keys [[t, value], ...] (value: number or Vector3), Catmull-Rom tangents, held at the ends
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return clone(keys[0][1]);
  if (t >= keys[n - 1][0]) return clone(keys[n - 1][1]);
  let i = 0; while (keys[i + 1][0] < t) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h;
  const tan = (j) => { const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)]; if (j === 0 || j === n - 1) return zero(p0); return scale(sub(b[1], a[1]), 1 / (b[0] - a[0])); };
  const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return add(add(scale(p0, h00), scale(m0, h10 * h)), add(scale(p1, h01), scale(m1, h11 * h)));
}
const isV = (a) => typeof a !== 'number';
const clone = (a) => isV(a) ? a.clone() : a;
const zero = (a) => isV(a) ? V() : 0;
const add = (a, b) => isV(a) ? a.clone().add(b) : a + b;
const sub = (a, b) => isV(a) ? a.clone().sub(b) : a - b;
const scale = (a, s) => isV(a) ? a.clone().multiplyScalar(s) : a * s;
const ortho = (dir, palm) => { const d = dir.clone().normalize(), p = palm.clone().addScaledVector(d, -palm.dot(d)).normalize(); return [d, p]; };

export class Rep6 {
  constructor(name, tracks, rig, clips, plan) {
    this.name = name; this.tr = tracks.you; this.rig = rig; this.clips = clips; this.plan = plan;
    const tr = this.tr;
    this.k = { bound: tr.simOf(2.78), plant: tr.simOf(2.88), off: tr.tOff, land: tr.tLand, apex: tr.apex.t, end: plan.simEnd };
    this.buildTable();
    this.buildMetrics();
    this.buildFootfalls();
    this.plantAngle();
    if (plan.kind === 'touch') this.planTouch(); else this.planDunk();
    this.buildBall();
  }
  // natural (mocap) samples: hip, facing, shoulders, head, hands, ankles; then foot locks
  buildTable() {
    const rig = this.rig, tr = this.tr, n = Math.ceil(this.k.end * HZ) + 1;
    const T = { n, hip: [], yaw: [], shL: [], shR: [], head: [], wL: [], wR: [], ankL: [], ankR: [], toeY: [] };
    const feet = { L: [], R: [] };
    for (let i = 0; i < n; i++) {
      const t = i / HZ, P = tr.at(t);
      rig.applyMocap(P, P.src, {});
      T.hip.push(P.pos.lhipjoint.clone().add(P.pos.rhipjoint).multiplyScalar(0.5)); T.yaw.push(P.yaw);
      T.shL.push(rig.P.L_UpperArm.clone()); T.shR.push(rig.P.R_UpperArm.clone()); T.head.push(rig.P.Head.clone());
      T.wL.push(rig.P.L_Hand.clone()); T.wR.push(rig.P.R_Hand.clone());
      T.ankL.push(P.pos.ltibia.clone()); T.ankR.push(P.pos.rtibia.clone()); T.toeY.push(Math.min(P.pos.ltoes.y, P.pos.rtoes.y));
      T.lowL = T.lowL || []; T.lowR = T.lowR || []; T.toeL = T.toeL || []; T.toeR = T.toeR || [];
      T.toeL.push(P.pos.ltoes.clone()); T.toeR.push(P.pos.rtoes.clone());
      T.lowL.push(Math.min(P.pos.ltibia.y - 0.075, P.pos.ltoes.y, P.pos.lfoot.y - 0.02)); T.lowR.push(Math.min(P.pos.rtibia.y - 0.075, P.pos.rtoes.y, P.pos.rfoot.y - 0.02));
      for (const s of ['L', 'R']) { const k = s.toLowerCase(); feet[s].push({ a: P.pos[k + 'tibia'].clone(), h: P.pos[k + 'hipjoint'].clone(), w: P.planted ? P.planted[s] : 0 }); }
    }
    this.T = T; this.feet = feet;
    const leg = rig.len.thigh + rig.len.calf;
    this.lock = { L: footLock(feet.L, leg), R: footLock(feet.R, leg) };
    this.armLen = rig.len.upper + rig.len.fore;
    const w = Math.round(0.1 * HZ), raw = T.yaw.map(y => V(Math.sin(y), 0, Math.cos(y)));
    T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); return a.normalize(); });
  }
  tab(key, t) {
    const a = this.T[key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    return a[i].clone().lerp(a[j], u);
  }
  fwd(t) { return this.tab('fwd', t).normalize(); }
  frame(t) { const f = this.fwd(t); return { f, r: V(-f.z, 0, f.x), u: UP.clone() }; }
  applyLock(T, t) {
    const f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    for (const s of ['L', 'R']) {
      const L = this.lock[s], o = L[i].clone().lerp(L[j], u), k = s.toLowerCase();
      for (const j2 of ['tibia', 'foot', 'toes']) T.pos[k + j2].add(o);
    }
    return T;
  }

  // footfalls (touchdowns of either foot): position on the floor (locked), time, which foot; the big step and the plant
  buildFootfalls() {
    // a touchdown: the lowest point of the foot (heel, ball or toe) comes down to the floor, with hysteresis; a stance
    // has to last a few frames to count
    const T = this.T, out = [];
    for (const s of ['L', 'R']) {
      const low = T['low' + s], toe = T['toe' + s];
      const spd = (i) => { const a = toe[Math.max(0, i - 3)], b = toe[Math.min(T.n - 1, i + 3)]; return Math.hypot(b.x - a.x, b.z - a.z) / ((Math.min(T.n - 1, i + 3) - Math.max(0, i - 3)) / HZ); };
      const st = (i) => low[i] < 0.075 && spd(i) < 0.9;
      let down = st(0), t0 = down ? 0 : -1;
      const push = (i0) => { const a = (s === 'L' ? T.ankL : T.ankR)[i0].clone().add(this.lock[s][i0]); out.push({ t: i0 / HZ, s, p: V(a.x, 0, a.z), i: i0 }); };
      for (let i = 1; i < T.n; i++) {
        if (!down && st(i)) { down = true; t0 = i; }
        else if (down && (low[i] > 0.1 || spd(i) > 1.6)) { down = false; if (t0 > 0 && i - t0 > 0.05 * HZ) push(t0); t0 = -1; }
      }
      if (down && t0 > 0) push(t0);
    }
    out.sort((a, b) => a.t - b.t);
    // the first contact of the walk is him standing; tag the big step and the plant (nearest to the clip's beats)
    const near = (t) => out.reduce((b, f) => Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b, out[0]);
    const big = near(this.k.bound), plant = out[out.indexOf(big) + 1];
    big.big = true; plant.plant = true;
    for (const f of out) { f.speed = this.speed[f.i]; f.gain = f.plant || f.big ? 1 : clamp(0.35 + f.speed / 6, 0.35, 0.85); f.yaw = this.T.yaw[f.i]; }
    this.footfalls = out.filter(f => f.t > 0.05 && f.t < this.k.off + 0.05 || (f.t > this.k.land - 0.05 && f.t < this.k.land + 0.4));
  }
  // the plant angle (Liu & Zaferiou 2025): at the first foot's touchdown of the plant, the line from his centre of mass
  // (hips, a little up) to that heel against the floor - the further ahead the feet land, the smaller it is
  plantAngle() {
    const f0 = this.footfalls.find(f => f.big), s = f0.s, low = this.T['low' + s];
    // the heel strike: back from the foot-flat touchdown to where the foot first meets the floor
    let i = f0.i; while (i > 0 && low[i - 1] < 0.075) i--;
    const t = i / HZ;
    const ank = (s === 'L' ? this.T.ankL : this.T.ankR)[i].clone().add(this.lock[s][i]), fw = this.fwd(t);
    const heel = ank.clone().addScaledVector(fw, -0.06); heel.y = 0.02;
    const com = this.T.hip[i].clone().add(V(0, 0.06, 0)), d = com.clone().sub(heel), ahead = -(d.x * fw.x + d.z * fw.z);
    this.M.angle = Math.atan2(d.y, ahead) * 180 / Math.PI; this.M.heel = heel; this.M.vPlant = this.speed[i]; this.M.tPlant0 = t;
  }
  // ---------- the numbers ----------
  buildMetrics() {
    const T = this.T, k = this.k, sp = [];
    for (let i = 0; i < T.n; i++) { const a = T.hip[Math.max(0, i - 6)], b = T.hip[Math.min(T.n - 1, i + 6)]; sp.push(Math.hypot(b.x - a.x, b.z - a.z) / ((Math.min(T.n - 1, i + 6) - Math.max(0, i - 6)) / HZ)); }
    this.speed = sp;
    // top approach speed (before the plant), the running hip height and the lowest hip on the plant
    const iPlant = Math.round(k.plant * HZ), iOff = Math.round(k.off * HZ);
    let vmax = 0, tv = 0; for (let i = 0; i < iPlant; i++) if (sp[i] > vmax) { vmax = sp[i]; tv = i / HZ; }
    let run = 0, m = 0; for (let i = Math.round((k.bound - 0.6) * HZ); i < Math.round((k.bound - 0.15) * HZ); i++) { run += T.hip[i].y; m++; } run /= m;
    let low = 9, tLow = 0; for (let i = Math.round(k.bound * HZ); i < iOff; i++) if (T.hip[i].y < low) { low = T.hip[i].y; tLow = i / HZ; }
    const hang = k.land - k.off;
    this.M = { vmax, tv, run, low, tLow, drop: run - low, hang, vert: G * hang * hang / 8, vOff: (T.hip[iOff + 2].y - T.hip[iOff - 2].y) / (4 / HZ) };
  }

  // ---------- touch: a two-arm swing into the jump and a hand on the rim ----------
  planTouch() {
    const k = this.k, ap = k.apex;
    this.touch = { t0: ap - 0.16, t: ap - 0.015, t1: ap + 0.05 };
    // the arm angle in his sagittal plane (deg): 0 hanging, 90 forward, 180 straight up, negative = behind him
    this.swing = {
      R: [[k.bound + 0.02, -20], [k.plant + 0.02, -58], [(k.plant + k.off) / 2 + 0.01, -5], [k.off, 105], [k.off + 0.13, 158], [ap + 0.12, 150], [ap + 0.3, 115], [k.land, 55], [k.land + 0.3, 25]],
      L: [[k.bound + 0.02, -15], [k.plant + 0.02, -55], [(k.plant + k.off) / 2 + 0.01, -5], [k.off, 100], [k.off + 0.13, 150], [ap, 140], [ap + 0.25, 100], [k.land, 50], [k.land + 0.3, 22]],
    };
  }
  // the touch target: the front of the rim, a hand's width to his right of centre, fingertips just over the top
  touchPoint() {
    if (!this._tp) {
      const t = this.touch.t, S = this.tab('shR', t), to = V(RIM.x - S.x, 0, RIM.z - S.z).normalize(), r = V(-to.z, 0, to.x);
      this._tp = RIM.clone().addScaledVector(to, -RIM_R + 0.03).addScaledVector(r, 0.06).add(V(0, 0.04, 0));
      this._tpTo = to;
    }
    return this._tp;
  }
  swingHand(side, t) {
    const { f, r } = this.frame(t), S = this.tab(side === 'L' ? 'shL' : 'shR', t), out = side === 'L' ? r.clone().negate() : r.clone();
    const th = spline(this.swing[side], t) * Math.PI / 180;
    const d = UP.clone().multiplyScalar(-Math.cos(th)).addScaledVector(f, Math.sin(th)).addScaledVector(out, 0.2).normalize();
    const reach = this.armLen * (0.9 + 0.07 * Math.abs(Math.cos(th)));
    const pole = f.clone().multiplyScalar(-Math.cos(th)).addScaledVector(UP, -Math.sin(th)).addScaledVector(out, 0.35).normalize();
    const [dir, palm] = ortho(d, out.clone().negate().addScaledVector(f, 0.2));
    return { pos: S.clone().addScaledVector(d, reach), dir, palm, pole, curl: 0.35 };
  }
  armsTouch(t) {
    const k = this.k, w = smooth((t - (k.bound + 0.02)) / 0.1) * (1 - smooth((t - (k.land + 0.1)) / 0.35));
    if (w <= 0) return {};
    const ov = { L: { ...this.swingHand('L', t), w }, R: { ...this.swingHand('R', t), w } };
    const tc = this.touch, P = this.touchPoint();
    const a = smooth((t - tc.t0) / (tc.t - tc.t0)) * (1 - smooth((t - tc.t1) / 0.12));
    if (a > 0) {
      const S = this.tab('shR', t), to = this._tpTo;
      // fingers up and forward over the rim, palm to the rim; the wrist a hand's length short of the fingertips
      const [dir, palm] = ortho(P.clone().sub(S).normalize().addScaledVector(to, 0.25), to.clone().addScaledVector(UP, 0.2));
      const W = P.clone().addScaledVector(dir, -0.17), sw = ov.R;
      ov.R = { pos: sw.pos.clone().lerp(W, a), dir: sw.dir.clone().lerp(dir, a).normalize(), palm: sw.palm.clone().lerp(palm, a).normalize(), pole: sw.pole.clone().lerp(to.clone().addScaledVector(r(to), 0.6).addScaledVector(UP, -0.4).normalize(), a).normalize(), curl: 0.25, w };
    }
    return ov;
  }

  // ---------- the dunk ----------
  planDunk() {
    const k = this.k, ap = k.apex;
    // gather on the big step, two hands up with the jump, right hand takes it and cocks it back behind his head at
    // the top, throws it down through the rim, grabs the rim, lets go as he drops
    this.d = { gather0: k.bound - 0.06, gather1: k.bound + 0.06, take: k.off + 0.06, over: k.off + 0.2, cock: ap - 0.07, slam: ap + 0.05, rel: ap + 0.075, grab: ap + 0.12 };
    this.d.let = this.d.grab + 0.24;
  }
  carry(t) { // ball on the right palm by his hip, arm swinging less than it would
    const { f, r } = this.frame(t), hip = this.tab('hip', t), W = this.tab('wR', t);
    const want = hip.clone().addScaledVector(f, 0.1).addScaledVector(r, 0.24).add(V(0, 0.02, 0));
    const pos = W.clone().lerp(want, 0.65);
    const [dir, palm] = ortho(f.clone().addScaledVector(UP, -0.25), UP.clone().addScaledVector(r, -0.55));
    return { pos, dir, palm, pole: r.clone().addScaledVector(f, -0.6).normalize(), curl: 0.45 };
  }
  ballOnHand(h) { return h.pos.clone().addScaledVector(h.dir, 0.085).addScaledVector(h.palm, BALL_R + 0.012); }
  handFor(B, dir, palm) { return B.clone().addScaledVector(palm, -(BALL_R + 0.012)).addScaledVector(dir, -0.085); }
  // the natural two-hand hold: between the mocap palms, a little in front
  hold(t) {
    const { f } = this.frame(t), L = this.tab('wL', t), R = this.tab('wR', t), B = L.clone().add(R).multiplyScalar(0.5).addScaledVector(f, 0.1);
    const hip = this.tab('hip', t), ahead = B.clone().sub(hip).dot(f); if (ahead < 0.24) B.addScaledVector(f, 0.24 - ahead);
    return B;
  }
  grip(B, t, w = 1) { // both hands on the sides of the ball
    const { f, r } = this.frame(t), ov = {};
    for (const [side, sg] of [['L', -1], ['R', 1]]) {
      const nn = r.clone().multiplyScalar(sg), dir = f.clone().multiplyScalar(0.55).addScaledVector(UP, 0.8).addScaledVector(nn, 0).normalize();
      const [d, p] = ortho(dir, nn.clone().negate());
      ov[side] = { pos: B.clone().addScaledVector(nn, BALL_R + 0.022).addScaledVector(d, -0.08), dir: d, palm: p, pole: nn.clone().addScaledVector(UP, -0.6).normalize(), curl: 0.35, w };
    }
    return ov;
  }
  // the right hand's ball path from the take to the throw-down, in his frame at the top (f to the rim)
  slamKeys() {
    if (this._sk) return this._sk;
    const d = this.d, k = this.k, S = this.tab('shR', d.cock), f0 = V(RIM.x - S.x, 0, RIM.z - S.z).normalize(), r0 = V(-f0.z, 0, f0.x);
    const at = (t, a, b, c) => this.tab('shR', t).addScaledVector(UP, a).addScaledVector(f0, b).addScaledVector(r0, c);
    const B0 = this.hold(d.take);
    const keys = [[d.take, B0], [d.over, at(d.over, 0.7, 0.14, -0.06)], [d.cock, at(d.cock, 0.64, -0.27, 0.04)], [d.slam, RIM.clone().add(V(0, 0.22, 0)).addScaledVector(f0, -0.05)], [d.rel, RIM.clone().add(V(0, 0.07, 0))]];
    // hand orientation keys: fingers (dir) and palm normal, in the same frame
    const D = (a, b, c) => f0.clone().multiplyScalar(a).addScaledVector(UP, b).addScaledVector(r0, c).normalize();
    const ori = [[d.take, D(0.3, 0.9, 0.2), D(-0.2, 0.1, -1)], [d.over, D(0.25, 1, 0), D(0.9, -0.1, 0)], [d.cock, D(-0.55, 0.8, 0), D(0.82, 0.55, 0)], [d.slam, D(0.85, 0.5, 0), D(0.5, -0.85, 0)], [d.rel, D(0.6, -0.8, 0), D(-0.8, -0.6, 0)]];
    this._sk = { keys, ori, f0, r0 };
    return this._sk;
  }
  slamHand(t) {
    const sk = this.slamKeys(), B = spline(sk.keys, t);
    const o = sk.ori; let i = 0; while (i + 1 < o.length - 1 && o[i + 1][0] < t) i++;
    const u = smooth((t - o[i][0]) / (o[i + 1][0] - o[i][0]));
    const [dir, palm] = ortho(o[i][1].clone().lerp(o[i + 1][1], u), o[i][2].clone().lerp(o[i + 1][2], u));
    return { B, hand: { pos: this.handFor(B, dir, palm), dir, palm, pole: sk.r0.clone().addScaledVector(sk.f0, -0.5).addScaledVector(UP, -0.3).normalize(), curl: 0.5 } };
  }
  // the grip on the rim: fingers over the front of the (flexed) rim, palm down
  rimGrip(t) {
    const sk = this.slamKeys(), th = this.rimAngle(t), q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), th);
    const front = RIM.clone().addScaledVector(sk.f0, -RIM_R).addScaledVector(sk.r0, 0.04).sub(HINGE).applyQuaternion(q).add(HINGE);
    const [dir, palm] = ortho(sk.f0.clone().addScaledVector(UP, -0.35), UP.clone().negate().addScaledVector(sk.f0, 0.25));
    return { pos: front.clone().addScaledVector(dir, -0.07).add(V(0, 0.03, 0)), dir, palm, pole: sk.r0.clone().addScaledVector(UP, -0.5).normalize(), curl: 0.85 };
  }
  armsDunk(t) {
    const d = this.d, k = this.k, ov = {};
    if (t < d.gather0) { ov.R = { ...this.carry(t), w: 1 }; return { ov, B: this.ballOnHand(ov.R) }; }
    if (t < d.take) {
      const u = smooth((t - d.gather0) / (d.gather1 - d.gather0)), c = this.carry(Math.min(t, d.gather1)), B = this.ballOnHand(c).lerp(this.hold(t), u);
      const g = this.grip(B, t, 1); if (u < 1) { g.R = { ...c, pos: c.pos.clone().lerp(g.R.pos, u), dir: c.dir.clone().lerp(g.R.dir, u).normalize(), palm: c.palm.clone().lerp(g.R.palm, u).normalize(), w: 1 }; g.L.w = u; }
      return { ov: g, B };
    }
    if (t < d.rel) {
      const s = this.slamHand(t), lw = 1 - smooth((t - d.take) / 0.12);
      const g = this.grip(s.B, t, lw);
      ov.R = { ...s.hand, w: 1 };
      // the off arm: off the ball, up and out in front for balance, then sweeping down as he throws it
      const S = this.tab('shL', t), { f, r } = this.frame(t), sk = this.slamKeys();
      const up = S.clone().addScaledVector(UP, this.armLen * 0.8).addScaledVector(sk.f0, 0.3).addScaledVector(sk.r0, -0.22);
      const down = S.clone().addScaledVector(UP, this.armLen * 0.15).addScaledVector(sk.f0, 0.45).addScaledVector(sk.r0, -0.45);
      const ua = smooth((t - d.slam + 0.02) / 0.12), L = up.clone().lerp(down, ua);
      const [dl, pl] = ortho(L.clone().sub(S), r.clone());
      ov.L = lw > 0.5 ? g.L : { pos: L, dir: dl, palm: pl, pole: r.clone().negate().addScaledVector(UP, -0.5).normalize(), curl: 0.3, w: 1 };
      if (lw > 0) ov.L = { ...g.L, pos: g.L.pos.clone().lerp(L, 1 - lw), w: 1 };
      return { ov, B: s.B };
    }
    // after the release: the hand to the rim, holds, lets go as he drops; arms back to his own for the landing
    const S = this.tab('shR', t), grip = this.rimGrip(t), reach = grip.pos.distanceTo(S);
    const on = smooth((t - d.rel) / (d.grab - d.rel)) * (1 - smooth((t - d.let) / 0.08));
    const s = this.slamHand(d.rel - 1e-4).hand;
    const wNat = 1 - smooth((t - (k.land - 0.05)) / 0.3);
    const free = { pos: S.clone().addScaledVector(UP, this.armLen * 0.6).addScaledVector(this.slamKeys().f0, 0.35), dir: s.dir, palm: s.palm, pole: s.pole, curl: 0.3 };
    const R = on > 0 ? grip : free, a = Math.max(on, 0);
    ov.R = { pos: free.pos.clone().lerp(R.pos, a), dir: free.dir.clone().lerp(R.dir, a).normalize(), palm: free.palm.clone().lerp(R.palm, a).normalize(), pole: R.pole, curl: 0.3 + 0.55 * a, w: Math.max(wNat, a) };
    const SL = this.tab('shL', t), sk = this.slamKeys(), L = SL.clone().addScaledVector(UP, this.armLen * 0.15).addScaledVector(sk.f0, 0.45).addScaledVector(sk.r0, -0.45);
    const [dl, pl] = ortho(L.clone().sub(SL), sk.r0.clone());
    ov.L = { pos: L, dir: dl, palm: pl, pole: sk.r0.clone().negate().addScaledVector(UP, -0.5).normalize(), curl: 0.3, w: wNat };
    this._reach = reach;
    return { ov, B: null };
  }

  // ---------- rim, net, board ----------
  // flex angle of the rim (rad, + = front down): a shiver from the touch; for the dunk, pulled down while he hangs on,
  // then it springs back and rings (damped, ~6.5 Hz)
  rimAngle(t) {
    if (this.plan.kind === 'touch') { const tau = t - this.touch.t; return tau > 0 ? 0.014 * Math.exp(-5 * tau) * Math.sin(2 * Math.PI * 9 * tau) : 0; }
    const d = this.d, hold = 0.2;
    if (t < d.grab) { const tau = t - d.rel; return tau > 0 ? 0.03 * Math.sin(Math.PI * clamp(tau / (d.grab - d.rel), 0, 1) * 0.5) : 0; }
    if (t < d.let) return 0.03 + (hold - 0.03) * smooth((t - d.grab) / 0.08);
    const tau = t - d.let, w = 2 * Math.PI * 6.5, z = 0.12;
    return hold * Math.exp(-z * w * tau) * Math.cos(w * Math.sqrt(1 - z * z) * tau);
  }
  boardShake(t) { // the stanchion arm rocks a little (rad, about x at the base)
    const t0 = this.plan.kind === 'touch' ? this.touch.t : this.d.grab, tau = t - t0, A = this.plan.kind === 'touch' ? 0.0006 : 0.006;
    return tau > 0 ? A * Math.exp(-2.2 * tau) * Math.sin(2 * Math.PI * 2.6 * tau) : 0;
  }
  netState(t) {
    const t0 = this.plan.kind === 'touch' ? this.touch.t : this.d.rel, tau = t - t0;
    const sw = tau > 0 ? 0.05 * (this.plan.kind === 'touch' ? 0.5 : 1.3) * Math.exp(-2.5 * tau) * Math.sin(2 * Math.PI * 2.1 * tau) : 0;
    const f = this.plan.kind === 'touch' ? this._tpTo || V(0, 0, -1) : this.slamKeys().f0;
    const b = this.ballAt(t);
    const st = this.plan.kind === 'dunk' && tau > 0 ? 0.11 * Math.exp(-7 * Math.max(0, tau - 0.06)) * smooth(tau / 0.06) : 0;
    return { angle: this.rimAngle(t), sway: [f.x * sw, f.z * sw], ball: b && b.y < RIM.y + 0.2 && b.y > RIM.y - 0.7 ? b : null, stretch: st };
  }

  // ---------- the ball after the throw-down ----------
  buildBall() {
    if (this.plan.kind !== 'dunk') { this.flight = null; return; }
    const d = this.d, p0 = this.slamHand(d.rel - 1e-4).B, p1 = this.slamHand(d.rel - 0.012).B;
    const v = p0.clone().sub(p1).multiplyScalar(1 / 0.012 * 0.95);
    // straight down through the rim and the net (the net takes a little off it), then the floor
    const pts = [], dt = 1 / HZ; let p = p0.clone(), vel = v.clone(); const bounces = [];
    for (let t = d.rel; t < this.k.end + 1; t += dt) {
      vel.y -= G * dt;
      if (p.y < RIM.y && p.y > RIM.y - 0.45) { vel.multiplyScalar(1 - 1.6 * dt); vel.x *= 1 - 6 * dt; vel.z *= 1 - 6 * dt; }
      p.addScaledVector(vel, dt);
      if (p.y < BALL_R && vel.y < 0) { p.y = BALL_R; bounces.push({ t, v: -vel.y }); vel.y = -vel.y * 0.76; vel.x *= 0.85; vel.z *= 0.85; }
      pts.push(p.clone());
    }
    this.flight = { t0: d.rel, pts, bounces };
  }
  // the ball turns with the hand while it's held; thrown down with backspin; rolls off its bounces
  ballQ(t) {
    if (this.plan.kind !== 'dunk') return new THREE.Quaternion();
    const handQ = (h) => { const z = new THREE.Vector3().crossVectors(h.dir, h.palm); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(h.dir, h.palm, z)); };
    const d = this.d;
    if (t < d.rel) { const a = this.armsDunk(t).ov.R; return handQ(a); }
    const q0 = handQ(this.armsDunk(d.rel - 1e-4).ov.R), ax = this.slamKeys().r0;
    const b0 = this.flight.bounces.length ? this.flight.bounces[0].t : 1e9;
    const spin = new THREE.Quaternion().setFromAxisAngle(ax, -14 * (Math.min(t, b0) - d.rel));
    const q = spin.multiply(q0);
    if (t > b0) q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, -4 * (t - b0)));
    return q;
  }
  ballAt(t) {
    if (this.plan.kind !== 'dunk') return null;
    if (t < this.d.rel) return this.armsDunk(t).B;
    const f = this.flight, i = clamp(Math.round((t - f.t0) * HZ), 0, f.pts.length - 1);
    return f.pts[i].clone();
  }

  // ---------- poses ----------
  youPose(t) {
    const P = this.tr.at(t), T = this.applyLock(P, t);
    const ov = this.plan.kind === 'touch' ? this.armsTouch(t) : this.armsDunk(t).ov;
    const look = RIM.clone().add(V(0, -0.1, 0)), lookW = 0.35 + 0.35 * smooth((t - (this.k.bound - 0.3)) / 0.4) * (1 - smooth((t - this.k.land) / 0.4));
    return { T, opt: { handOverride: ov, look, lookW, curl: 0.3 } };
  }
}
const r = (f) => V(-f.z, 0, f.x);
