// v5 rep engine: ball, hands, the defender's arms, contact and the defender's balance on top of one rep's mocap
// tracks. A plan says when the ball arrives (a pass), is held, dribbled (pushes found in the source hands), gathered,
// shot (a jumper that rides the shooting hand from the set point, guide hand on the side, held follow-through) or
// laid up (off the glass). The defender's balance is the extrapolated centre of mass (XcoM = CoM + v / w0, the point
// his momentum carries him to) against his feet: when it leaves his base behind his heels or outside his feet he
// can't contest until he re-plants.
import * as THREE from 'three';
import { BALL_R, footLock, ballistic } from './game2.js';

const G = 9.81, HZ = 240, W0 = Math.sqrt(G / 0.95);
// the jump shot's rise: from the dip at his waist to the set point (s)
const RISE = 0.25;
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
  // plan: { simEnd, pass?:{from, t0, t1}, hold?:[a,b], dribble?:[a,b], gatherAt, gatherDur, shotClip?, flight?,
  //         layup?:{releaseClip, side, oneHand}, contest?:{from, rise, to, side|both, reach}, contact?:{t, push, you},
  //         labels?:[{t, kind, open}], read? }
  constructor(name, tracks, rigs, clips, plan) {
    this.name = name; this.tracks = tracks; this.rigs = rigs; this.clips = clips; this.plan = plan;
    this.prepContact();
    this.buildTable();
    this.buildPushes();
    this.buildBall();
    this.buildBalance();
    this.buildTakeoff();
  }
  buildTable() {
    const rig = this.rigs.you, tr = this.tracks.you, d1 = this.tracks.d1, drig = this.rigs.d1, P0 = this.plan;
    const n = Math.ceil(P0.simEnd * HZ) + 1;
    const T = { n, hip: [], yaw: [], wL: [], wR: [], xL: [], xR: [], yL: [], yR: [], head: [], shL: [], shR: [], elbL: [], elbR: [], ankL: [], ankR: [], d1hip: [], d1yaw: [], d1shL: [], d1shR: [], d1head: [], d1com: [], d1feet: [] };
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
      T.head.push(rig.P.Head.clone()); T.shL.push(rig.P.L_UpperArm.clone()); T.shR.push(rig.P.R_UpperArm.clone());
      T.elbL.push(rig.P.L_Forearm.clone()); T.elbR.push(rig.P.R_Forearm.clone());
      T.ankL.push(P.pos.ltibia.clone()); T.ankR.push(P.pos.rtibia.clone());
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
    this.armLen = { you: rig.len.upper + rig.len.fore, d1: drig.len.upper + drig.len.fore };
    this.lock = { you: { L: footLock(feet.you.L, leg(rig)), R: footLock(feet.you.R, leg(rig)) }, d1: { L: footLock(feet.d1.L, leg(drig)), R: footLock(feet.d1.R, leg(drig)) } };
    const w = Math.round(0.1 * HZ), raw = T.yaw.map(y => V(Math.sin(y), 0, Math.cos(y)));
    T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); return a.normalize(); });
  }
  // The contact at the rim as a collision, not an overlap: from the moment the shoulder meets his chest the help
  // defender can't keep sliding into the finisher - whatever of his slide would carry him through is taken out along
  // the line of contact - and on top of that the shove rocks him back a step; the finisher gives a few centimetres.
  prepContact() {
    const c = this.plan.contact; if (!c) return;
    const Y = (t) => this.tracks.you.hip(t), D = (t) => this.tracks.d1.hip(t), a = Y(c.t), b = D(c.t);
    c.dir = V(b.x - a.x, 0, b.z - a.z); const s0 = c.dir.length(); c.dir.normalize();
    const n = Math.ceil((this.plan.simEnd - c.t) * HZ) + 2, pen = [];
    for (let i = 0; i < n; i++) { const t = c.t + i / HZ, y = Y(t), d = D(t); pen.push(Math.max(0, s0 - ((d.x - y.x) * c.dir.x + (d.z - y.z) * c.dir.z))); }
    const k = Math.round(0.03 * HZ);
    this._pen = pen.map((_, i) => { let s = 0, m = 0; for (let j = -k; j <= k; j++) { s += pen[clamp(i + j, 0, n - 1)]; m++; } return s / m; });
  }
  contactOffset(who, P, t) {
    const c = this.plan.contact; if (!c) return;
    const tau = t - c.t; if (tau <= 0) return;
    const pen = this._pen[clamp(Math.round(tau * HZ), 0, this._pen.length - 1)];
    const amt = who === 'd1' ? pen + c.push * bump(tau, 0.18) : -(c.you || 0.06) * bump(tau, 0.11);
    if (!amt) return;
    for (const [k, v] of Object.entries(P.pos)) {
      if (who === 'you' && /tibia|foot|toes/.test(k)) continue;
      v.addScaledVector(c.dir, amt);
      if (who === 'd1' && !/tibia|foot|toes/.test(k)) v.y -= 0.05 * bump(tau, 0.22);
    }
  }
  tab(key, t) {
    const a = this.T[key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    if (Array.isArray(a[0])) return a[u < 0.5 ? i : j].map(v => v.clone());
    return a[i].clone().lerp(a[j], u);
  }
  // palm centre, finger direction (x) and the hand's y axis; the palm faces -y
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
        const t0 = Math.max(P0.dribble[0], i === 0 ? 0 : sg.at + (sg.inert ? 0.05 : sg.blend * 0.5));
        const t1 = Math.min(P0.dribble[1], i + 1 < segs.length ? segs[i + 1].at + (segs[i + 1].inert ? 0 : segs[i + 1].blend * 0.5) : P0.simEnd);
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
    if (P0.shotClip !== undefined) {
      P0.release = sh.at + (P0.shotClip - sh.from) / sh.rate; P0.rim = P0.release + P0.flight; P0.netEnd = P0.rim + 0.26;
      P0.setAt = P0.release - 0.26;
    }
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
    // landing: first moment after the release with a foot back on the floor
    for (let i = Math.round(P0.release * HZ); i < T.n; i++) if (T.ankL[i].y < fl + 0.03 || T.ankR[i].y < fr + 0.03) { P0.land = i / HZ; break; }
    if (P0.land === undefined) P0.land = P0.release + 0.35;
  }
  onPalm(side, t) { const p = this.palm(side, t); return p.c.clone().addScaledVector(UP, -(BALL_R + 0.012)).addScaledVector(this.fwd(t), 0.015); }
  // both hands on it: between the palms, kept in front of the body
  holdBall(t) {
    const L = this.palm('L', t).c, R = this.palm('R', t).c, B = L.clone().add(R).multiplyScalar(0.5);
    const hip = this.tab('hip', t), f = this.fwd(t), ahead = B.clone().sub(hip).dot(f);
    if (ahead < 0.22) B.addScaledVector(f, 0.22 - ahead);
    return B;
  }
  // on the shooting hand: sitting on the finger pads of the right palm (the palm faces -y)
  shootingHandBall(t) { const p = this.palm('R', t); return p.c.clone().addScaledVector(p.y, -(BALL_R + 0.012)).addScaledVector(p.x, 0.02); }
  // triple threat: tucked at the right hip, both hands on it
  hipBall(t) {
    const f = this.fwd(t), r = V(-f.z, 0, f.x), hip = this.tab('hip', t);
    return hip.clone().addScaledVector(f, 0.3).addScaledVector(r, -0.16).setY(hip.y + 0.08);
  }
  gatherBall(t) { const f = this.fwd(t), hip = this.tab('hip', t); return hip.clone().addScaledVector(f, 0.38).addScaledVector(V(-f.z, 0, f.x), 0.08).setY(hip.y + 0.02); }
  catchPoint() {
    if (!this._catch) { const t1 = this.plan.pass.t1, B = this.holdBall(t1); this._catch = B; }
    return this._catch;
  }
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
    const n = this.palm('L', t).c.sub(this.palm('R', t).c); if (n.lengthSq() < 1e-4) n.copy(V(f.z, 0, -f.x)); n.normalize();
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const nn = n.clone().multiplyScalar(sg);
      let dir = f.clone().multiplyScalar(0.6).addScaledVector(UP, 0.8); dir.addScaledVector(nn, -dir.dot(nn)).normalize();
      const contact = B.clone().addScaledVector(nn, BALL_R + 0.004);
      ov[side] = { pos: contact.addScaledVector(dir, -0.085).addScaledVector(nn, 0.018), palm: nn.clone().negate(), dir, curl: 0.35, w };
    }
    return ov;
  }
  // guide hand: on the left side of the ball, fingers up, palm toward the ball
  guide(B, t, w) {
    const f = this.fwd(t), side = V(f.z, 0, -f.x); // left of the shooter
    const dir = UP.clone().multiplyScalar(0.9).addScaledVector(f, 0.3).normalize();
    const contact = B.clone().addScaledVector(side, BALL_R + 0.006);
    return { pos: contact.addScaledVector(dir, -0.08).addScaledVector(side, 0.018), palm: side.clone().negate(), dir, curl: 0.3, w };
  }
  // The jump shot, in the shooter's frame (f toward the rim, r to his right) off his right shoulder S. From the dip at
  // his waist the ball comes straight up the front of him, the shooting hand turning under it, into the set point
  // above his right eye: upper arm just below level and turned in, forearm straight up, so the elbow sits under the
  // ball and points at the rim instead of flaring out. Then the arm extends up at the rim (62 deg) and the wrist snaps
  // through. The guide hand rides the ball's left side, its elbow a little out, and comes off just before the release.
  shotFrame() {
    if (!this._sf) { const h = this.tab('hip', this.plan.release), f = V(RIM.x - h.x, 0, RIM.z - h.z).normalize(); this._sf = { f, r: V(-f.z, 0, f.x) }; }
    return this._sf;
  }
  // the ball before the shot takes over: from the gather into the two-hand hold
  heldBall(t) {
    const P0 = this.plan, P = this.pushes, hold0 = P0.hold ? P0.hold[1] : -1;
    const from = P0.pass ? this.catchPoint() : (P.length ? this.gatherBall(P0.gatherAt) : this.hipBall(Math.max(hold0, 0)));
    const g = smooth((t - P0.gatherAt) / P0.gatherDur);
    return (t < P0.gatherAt ? this.hipBall(t) : from.clone()).lerp(this.holdBall(t), g);
  }
  // where the two-hand hold has the ball and both arms at the dip, so the shot starts exactly from there
  dip() {
    if (!this._dip) {
      const P0 = this.plan, t = P0.setAt - RISE, i = Math.round(t * HZ), T = this.T, S = this.tab('shR', t), SL = this.tab('shL', t);
      const B = this.heldBall(t), g = this.grip(B, t, 1);
      // the performer's own elbow directions there (off the shoulder->wrist line)
      const nat = (Sx, E, Wx) => { const a = Wx.clone().sub(Sx).normalize(), p = E.clone().sub(Sx); return p.addScaledVector(a, -p.dot(a)).normalize(); };
      this._dip = { t, b: B.clone().sub(S), R: g.R, L: { ...g.L, off: g.L.pos.clone().sub(B) },
        poleR: nat(S, T.elbR[i], T.wR[i]), poleL: nat(SL, T.elbL[i], T.wL[i]) };
    }
    return this._dip;
  }
  shotArm(t) {
    const P0 = this.plan, { f, r } = this.shotFrame(), rig = this.rigs.you, L1 = rig.len.upper, L2 = rig.len.fore;
    const S = this.tab('shR', t), SL = this.tab('shL', t), H = this.tab('head', t);
    // his chest (tf ahead of it, tr to his right) decides what reads as square, so the set is built off it; the
    // release goes at the rim
    const tr = S.clone().sub(SL).setY(0).normalize(), tf = V(tr.z, 0, -tr.x), left = tr.clone().negate();
    const D = (a, b, c) => f.clone().multiplyScalar(a).addScaledVector(UP, b).addScaledVector(r, c).normalize();
    const Tc = (a, b, c) => tf.clone().multiplyScalar(a).addScaledVector(UP, b).addScaledVector(tr, c).normalize();
    const ang = (F, up, inn) => { const e = up * Math.PI / 180, i = inn * Math.PI / 180; return F(Math.cos(e) * Math.cos(i), Math.sin(e), -Math.cos(e) * Math.sin(i)); };
    const nlerp = (p, q, u) => p.clone().lerp(q, u).normalize();
    const ballOf = (W, d, n) => W.clone().addScaledVector(d, 0.085).addScaledVector(n, BALL_R + 0.012);
    const wristOf = (B, d, n) => B.clone().addScaledVector(n, -(BALL_R + 0.012)).addScaledVector(d, -0.085);
    // set point: elbow out in front of his chest (upper arm 10 deg below level, 25 deg in), wrist straight above it,
    // cocked back, palm up under the ball, which sits over his right eye
    const set = { d: Tc(-0.7, 0.55, 0.12), n: Tc(0.35, 0.92, 0) };
    set.W = S.clone().addScaledVector(ang(Tc, -10, 25), L1).addScaledVector(UP, L2 * 0.99);
    set.B = ballOf(set.W, set.d, set.n);
    // release: arm up at the rim; follow-through: fingers down at the rim
    const rel = { d: D(0.78, 0.62, 0), n: D(0.62, -0.78, 0) };
    rel.W = S.clone().addScaledVector(ang(D, 62, 5), (L1 + L2) * 0.97);
    const fol = { d: D(0.5, -0.86, 0), n: D(-0.86, -0.5, 0) };
    // the shooting elbow goes under the wrist (a hair in toward his chest), wherever the hand is: down under the
    // ball on the way up, straight under it at the set, pointing at the rim on the release
    const under = (W) => W.clone().addScaledVector(UP, -L2).addScaledVector(tr, -0.04).sub(S);
    // guide hand on the ball's left side, fingers up; off it, up beside the ball
    const gOn = (B) => ({ pos: B.clone().addScaledVector(left, BALL_R + 0.024).addScaledVector(UP, -0.075).addScaledVector(tf, -0.01), dir: Tc(0.38, 0.92, 0), palm: tr.clone() });
    const gOff = { pos: SL.clone().addScaledVector(UP, (L1 + L2) * 0.78).addScaledVector(tf, 0.2).addScaledVector(left, 0.06), dir: Tc(0.3, 0.95, 0), palm: tr.clone() };
    // its elbow: under the hand and a little out to the left
    const gPole = (pos) => pos.clone().addScaledVector(UP, -L2 * 0.9).addScaledVector(left, 0.1).sub(SL);
    let B, d, n, pole, G;
    if (t < P0.setAt) {
      // the rise: straight up the front of him from the dip into the set (bowed out a touch to clear his face)
      const k = this.dip(), s = smooth((t - k.t) / RISE), s2 = smooth((t - k.t) / (RISE * 0.7));
      B = S.clone().add(k.b.clone().lerp(set.B.clone().sub(S), s)).addScaledVector(f, 0.05 * Math.sin(Math.PI * s));
      d = nlerp(k.R.dir, set.d, s2); n = nlerp(k.R.palm, set.n, s2);
      // elbow: from where the performer had it to under the hand
      pole = nlerp(k.poleR, under(wristOf(B, d, n)).normalize(), s2);
      const g = gOn(B), gp = B.clone().add(k.L.off.clone().lerp(g.pos.clone().sub(B), s2));
      G = { pos: gp, dir: nlerp(k.L.dir, g.dir, s2), palm: nlerp(k.L.palm, g.palm, s2), pole: nlerp(k.poleL, gPole(gp).normalize(), s2) };
    } else if (t <= P0.release) {
      const u = Math.pow(smooth((t - P0.setAt) / (P0.release - P0.setAt)), 1.4);
      const W = set.W.clone().lerp(rel.W, u); d = nlerp(set.d, rel.d, u); n = nlerp(set.n, rel.n, u); pole = under(W);
      B = ballOf(W, d, n);
    } else {
      const u = smooth((t - P0.release) / 0.09);
      d = nlerp(rel.d, fol.d, u); n = nlerp(rel.n, fol.n, u); pole = under(rel.W);
      B = ballOf(rel.W, d, n);
    }
    // keep the ball off his head (skull ~11 cm round about 9 cm above the head joint)
    const C = H.clone().addScaledVector(UP, 0.09).addScaledVector(f, 0.03), v = B.clone().sub(C), gap = v.length(), need = BALL_R + 0.115;
    if (gap < need) B.addScaledVector(v.normalize(), need - gap);
    if (!G) {
      const u = smooth((t - (P0.release - 0.07)) / 0.1), g = gOn(B), gp = g.pos.lerp(gOff.pos, u);
      G = { pos: gp, dir: nlerp(g.dir, gOff.dir, u), palm: tr.clone(), pole: gPole(gp).normalize() };
    }
    return { B, R: { pos: wristOf(B, d, n), dir: d, palm: n.clone(), pole, curl: 0.18, w: 1 }, L: { ...G, curl: 0.28, w: 1 } };
  }
  handsAndBall(t) {
    const P0 = this.plan, P = this.pushes;
    // the pass: in the air until the catch; hands up as a target, then they take it in
    if (P0.pass && t < P0.pass.t1) {
      const C = this.catchPoint(), from = V(P0.pass.from.x, P0.pass.from.y, P0.pass.from.z);
      const B = t <= P0.pass.t0 ? from : ballistic(from, C, P0.pass.t0, P0.pass.t1, t);
      const toBall = from.clone().sub(C).setY(0).normalize();
      const reach = smooth((t - (P0.pass.t1 - 0.5)) / 0.32);
      const ov = this.grip(C.clone().addScaledVector(toBall, 0.07 * reach), t, 0.85 * reach);
      return { B, state: 'pass', ov };
    }
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
      // into the hands at the gather (from the catch, the hip or the last bounce), then up with them
      const B = this.heldBall(t);
      if (P0.layup && t > P0.layup.oneHand) { // last beat: the off hand comes away, the finishing hand carries it up
        const u = smooth((t - P0.layup.oneHand) / 0.12), s = P0.layup.side, pl = this.palm(s, t);
        B.lerp(pl.c.clone().addScaledVector(pl.y, -(BALL_R + 0.01)), u);
        const ov = this.grip(B, t, 1); ov[s === 'R' ? 'L' : 'R'].w = 1 - u; ov[s].w = 1;
        return { B, state: 'held', ov };
      }
      if (P0.setAt !== undefined && t > P0.setAt - RISE) {
        // the shot: from the dip up on the shooting hand into the set, guide hand on its side
        const sp = this.shotArm(t), wg = P0.pass ? 0.85 : 1, w = wg + (1 - wg) * smooth((t - (P0.setAt - RISE)) / (RISE * 0.7));
        return { B: sp.B, state: 'held', ov: { R: { ...sp.R, w }, L: { ...sp.L, w } } };
      }
      return { B, state: 'held', ov: this.grip(B, t, P0.pass ? 0.85 : 1) };
    }
    const ov = {};
    if (P0.layup) {
      const k = 1 - smooth((t - P0.release) / 0.1);
      if (k > 0) { const g = this.handsAndBall(P0.release - 1e-4).ov; for (const s of ['L', 'R']) if (g[s]) ov[s] = { ...g[s], w: g[s].w * k }; }
    } else {
      // follow-through: arm still extended at the rim, wrist snapped down, guide hand up at the side, held until he
      // lands, then the arms come down with the performer's own
      const w = 1 - smooth((t - P0.land - 0.05) / 0.35);
      if (w > 0) { const sp = this.shotArm(t); ov.R = { ...sp.R, w }; ov.L = { ...sp.L, w }; }
    }
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
    if (!this._rel) { this._rel = this.shotArm(P0.release - 1e-4).B; this._rim = V(RIM.x + 0.01, RIM.y + 0.1, RIM.z + 0.02); }
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
        else if (r.state === 'pass' && len > 1e-5) { const ax = new THREE.Vector3().crossVectors(UP, d).normalize(); q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, -2 * Math.PI * 1.5 / HZ)); }
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
  // open: 0 = balanced and squared up (he can contest), 1 = his weight is going the wrong way (shoot / go now).
  // A closeout is read by phase (labels): sprinting, then chopping his feet, then set with a hand up. The help
  // defender at the rim: what matters is whether he's set - feet still - when you get there.
  balance(t) {
    const b = this.bal[clamp(Math.round(t * HZ), 0, this.bal.length - 1)], L = this.plan.labels;
    if (L) {
      let k = 0; while (k + 1 < L.length && L[k + 1].t <= t) k++;
      const a = L[k], nx = L[k + 1], u = nx ? smooth((t - (nx.t - 0.12)) / 0.12) : 0;
      return { ...b, heels: 0, lean: 0, open: a.open + ((nx ? nx.open : a.open) - a.open) * u, kind: a.kind };
    }
    // (read at the contact and held after it: that's when the call is made)
    if (this.plan.contact) { const bc = this.bal[clamp(Math.round(Math.min(t, this.plan.contact.t) * HZ), 0, this.bal.length - 1)];
      const open = smooth((bc.speed - 0.35) / 0.5); return { ...b, heels: 0, lean: 0, open, kind: open < 0.5 ? 'set' : 'notset' }; }
    const heels = Math.max(smooth((b.behind - 0.02) / 0.08), smooth((b.back - 0.3) / 0.4));
    const lean = Math.max(smooth((b.outside - 0.03) / 0.08), smooth((b.lat - 0.35) / 0.4));
    const open = Math.max(heels, lean, smooth((b.away - 0.35) / 0.4));
    return { ...b, heels, lean, open, kind: open < 0.5 ? 'balanced' : (b.oSide > b.oBack ? 'lean' : 'heels') };
  }

  // ---------- poses ----------
  youPose(t) {
    const P = this.tracks.you.at(t); this.contactOffset('you', P, t);
    const T = this.applyLock('you', P, t), hb = this.handsAndBall(t);
    const d1 = this.tab('d1hip', t).add(V(0, 0.6, 0)), P0 = this.plan;
    const target = P0.pass && t < P0.pass.t1 + 0.1 ? hb.B.clone() : d1;
    const u = P0.release !== undefined ? smooth((t - (P0.release - 0.6)) / 0.35) : 0;
    return { T, opt: { handOverride: hb.ov, look: target.lerp(RIM.clone(), u), lookW: 0.55 + 0.3 * u, curl: 0.3 } };
  }
  // the contest: the near hand goes straight up (verticality), palm to the shooter, a touch toward him - never into
  // the ball; the other arm stays down for balance
  d1Pose(t) {
    const P = this.tracks.d1.at(t); this.contactOffset('d1', P, t);
    const T = this.applyLock('d1', P, t), b = this.handsAndBall(t).B, opt = { look: b, lookW: 0.55, curl: 0.3 }, c = this.plan.contest;
    if (c) {
      const w = smooth((t - c.from) / (c.rise ?? 0.25)) * (1 - smooth((t - c.to) / 0.4));
      if (w > 0) {
        opt.handOverride = {};
        for (const s of c.both ? ['L', 'R'] : [c.side || 'L']) {
          const sh = this.tab(s === 'L' ? 'd1shL' : 'd1shR', t), you = this.tab('hip', t), to = V(you.x - sh.x, 0, you.z - sh.z).normalize();
          const out = V(-to.z, 0, to.x).multiplyScalar(s === 'L' ? -1 : 1);
          const pos = sh.clone().addScaledVector(UP, this.armLen.d1 * 0.93).addScaledVector(to, c.reach ?? 0.1).addScaledVector(out, 0.04);
          const hand = pos.clone().addScaledVector(UP, 0.1), gap = hand.distanceTo(b);
          if (gap < 0.3) { const away = hand.clone().sub(b).setY(0); if (away.lengthSq() < 1e-6) away.copy(to).negate(); pos.addScaledVector(away.normalize(), 0.3 - gap); }
          opt.handOverride[s] = { pos, palm: to.clone(), dir: UP.clone().addScaledVector(to, 0.12).normalize(), pole: out.clone().addScaledVector(to, -0.4).addScaledVector(UP, -0.3).normalize(), curl: 0.08, w };
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
