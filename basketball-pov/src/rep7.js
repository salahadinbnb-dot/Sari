// v7 rep engine: steals. The players go by role - bh the ball handler (dribbler or passer), df the defender (you),
// rc the receiver on the passing rep - each a real mocap take. The ball is dribbled off the ball handler's own
// hands (pushes found in the take), held and passed, poked loose by the defender's hand at the strike (then free:
// gravity, bounces on the floor, rolling) or caught in the passing lane.
//   cross - a good dribbler works the ball on his right side, out of your reach; it only comes into reach when he
//           crosses it over in front of him. Your right hand swipes up through it on the way up into his left.
//   trail - he's beaten you and is driving; run with him on the ball side and tip it forward from behind with your
//           inside hand as it comes up off the floor (his off arm guards the front, nothing guards the back).
//   lane  - off the ball: sag off the passing line so it looks open, leave on the passer's windup, catch it in front
//           of your man.
import * as THREE from 'three';
import { BALL_R, footLock } from './game2.js';

const G = 9.81, HZ = 240;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nlerp = (a, b, u) => a.clone().lerp(b, u).normalize();

// dribble pushes in a clip: the hand driving down hard (strong pushes only - a running arm swing isn't a dribble)
function findPushes(clip, a, b, minV) {
  const out = [], dt = 1 / 240;
  for (const s of ['l', 'r']) {
    const h = (ct) => { const f = clamp(ct * clip.fps, 0, clip.n - 1), i = Math.floor(f), j = Math.min(i + 1, clip.n - 1), u = f - i;
      const arr = clip.pos[s + 'hand']; return arr[i * 3 + 1] + (arr[j * 3 + 1] - arr[i * 3 + 1]) * u; };
    const vy = (ct) => (h(ct + dt) - h(ct - dt)) / (2 * dt);
    let t = a;
    while (t < b) {
      if (vy(t) < -1.2) {
        let s0 = t; while (s0 > a && vy(s0 - dt) < -0.3) s0 -= dt;
        let e = t, vmin = 0; while (e < b && vy(e + dt) < -0.3) { e += dt; vmin = Math.min(vmin, vy(e)); }
        if (h(s0) - h(e) > 0.12 && vmin < minV) out.push({ hand: s.toUpperCase(), c0: s0, c1: e });
        t = e + dt;
      } else t += dt;
    }
  }
  return out.sort((p, q) => p.c0 - q.c0);
}

export class Rep7 {
  // plan: { simEnd, kind, dribble?:[a,b], minPush?, strike?:{t, hand, pop, lead}, pass?:{pick, wind, rel, speed, f} }
  constructor(name, tracks, rigs, clips, plan) {
    this.name = name; this.tracks = tracks; this.rigs = rigs; this.clips = clips; this.plan = plan;
    this.roles = Object.keys(tracks);
    this.buildTable();
    this.buildPushes();
    this.buildFlights();
    if (!tracks.df) return; // (a probe: just the ball handler's dribble, to place the others)
    if (plan.strike) this.buildStrike();
    if (plan.pass) this.buildPass();
    this.buildExposure();
  }

  // ---------- tabulated poses (mocap applied to each rig, no overrides) ----------
  buildTable() {
    const P0 = this.plan, n = Math.ceil(P0.simEnd * HZ) + 1, X = V(1, 0, 0), Y = V(0, 1, 0);
    this.T = { n }; this.lock = {}; this.armLen = {}; this.len = {};
    for (const r of this.roles) {
      const rig = this.rigs[r], tr = this.tracks[r];
      const T = { hip: [], yaw: [], wL: [], wR: [], xL: [], xR: [], yL: [], yR: [], head: [], shL: [], shR: [], ankL: [], ankR: [], chest: [] };
      const feet = { L: [], R: [] };
      for (let i = 0; i < n; i++) {
        const t = i / HZ, P = tr.at(t);
        rig.applyMocap(P, P.src, {});
        T.hip.push(rig.P.Root.clone()); T.yaw.push(P.yaw);
        T.wL.push(rig.P.L_Hand.clone()); T.wR.push(rig.P.R_Hand.clone());
        T.xL.push(X.clone().applyQuaternion(rig.W.L_Hand)); T.xR.push(X.clone().applyQuaternion(rig.W.R_Hand));
        T.yL.push(Y.clone().applyQuaternion(rig.W.L_Hand)); T.yR.push(Y.clone().applyQuaternion(rig.W.R_Hand));
        T.head.push(rig.P.Head.clone()); T.shL.push(rig.P.L_UpperArm.clone()); T.shR.push(rig.P.R_UpperArm.clone());
        T.chest.push(rig.P.Spine2 ? rig.P.Spine2.clone() : rig.P.Head.clone().lerp(rig.P.Root, 0.5));
        T.ankL.push(P.pos.ltibia.clone()); T.ankR.push(P.pos.rtibia.clone());
        for (const s of ['L', 'R']) { const k = s.toLowerCase(); feet[s].push({ a: P.pos[k + 'tibia'].clone(), h: P.pos[k + 'hipjoint'].clone(), w: P.planted ? P.planted[s] : 0 }); }
      }
      // facing, smoothed a little (the hips wobble every step)
      const w = Math.round(0.1 * HZ), raw = T.yaw.map(y => V(Math.sin(y), 0, Math.cos(y)));
      T.fwd = raw.map((_, i) => { const a = V(); for (let j = -w; j <= w; j++) a.add(raw[clamp(i + j, 0, n - 1)]); return a.normalize(); });
      this.T[r] = T;
      const leg = rig.len.thigh + rig.len.calf;
      this.lock[r] = { L: footLock(feet.L, leg), R: footLock(feet.R, leg) };
      this.armLen[r] = rig.len.upper + rig.len.fore; this.len[r] = { upper: rig.len.upper, fore: rig.len.fore };
    }
  }
  tab(r, key, t) {
    const a = this.T[r][key], f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    if (typeof a[0] === 'number') return a[i] + (a[j] - a[i]) * u;
    return a[i].clone().lerp(a[j], u);
  }
  fwd(r, t) { return this.tab(r, 'fwd', t).normalize(); }
  right(r, t) { const f = this.fwd(r, t); return V(-f.z, 0, f.x); }
  // palm centre, finger direction (x) and the hand's y axis; the palm faces -y
  palm(r, side, t) {
    const w = this.tab(r, 'w' + side, t), x = this.tab(r, 'x' + side, t).normalize(), y = this.tab(r, 'y' + side, t).normalize();
    return { c: w.clone().addScaledVector(x, 0.085).addScaledVector(y, 0.018), x, y };
  }
  applyLock(r, P, t) {
    const f = clamp(t * HZ, 0, this.T.n - 1), i = Math.floor(f), j = Math.min(i + 1, this.T.n - 1), u = f - i;
    for (const s of ['L', 'R']) {
      const L = this.lock[r][s], o = L[i].clone().lerp(L[j], u), k = s.toLowerCase();
      for (const j2 of ['tibia', 'foot', 'toes']) P.pos[k + j2].add(o);
    }
    return P;
  }

  // ---------- the dribble ----------
  buildPushes() {
    const P0 = this.plan, out = [];
    if (P0.dribble) {
      const segs = this.tracks.bh.segs;
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i], clip = this.clips[sg.clip];
        const t0 = Math.max(P0.dribble[0] - 0.4, i === 0 ? -1 : sg.at), t1 = Math.min(P0.dribble[1], i + 1 < segs.length ? segs[i + 1].at : P0.simEnd);
        if (t1 <= t0) continue;
        const c0 = sg.from + (t0 - sg.at) * sg.rate, c1 = sg.from + (t1 - sg.at) * sg.rate;
        for (const p of findPushes(clip, Math.max(0, c0), c1, P0.minPush ?? -1.5)) {
          const s0 = sg.at + (p.c0 - sg.from) / sg.rate, s1 = sg.at + (p.c1 - sg.from) / sg.rate;
          if (s1 > P0.dribble[0] - 0.4 && s0 < P0.dribble[1]) out.push({ hand: p.hand, s0, s1 });
        }
      }
      // a push overlapping one of the other hand's is the arm swinging, not the ball: keep the harder (lower) one
      out.sort((a, b) => a.s0 - b.s0);
      for (let k = 0; k < out.length; k++) {
        const gap = k > 0 ? out[k].s0 - out[k - 1].s1 : 0.3;
        out[k].catch = out[k].s0 - clamp((gap - 0.2) * 0.5, 0.02, 0.1);
      }
    }
    this.pushes = out;
  }
  onPalm(side, t) { const p = this.palm('bh', side, t); return p.c.clone().addScaledVector(UP, -(BALL_R + 0.012)).addScaledVector(this.fwd('bh', t), 0.015); }
  // between pushes the ball goes from the hand down to the floor (40% of the way) and back up into the next hand
  buildFlights() {
    const P = this.pushes; this.flights = [];
    for (let k = 0; k + 1 < P.length; k++) {
      const r = P[k].s1, c = P[k + 1].catch, B0 = this.onPalm(P[k].hand, r), B1 = this.onPalm(P[k + 1].hand, c);
      const tb = r + 0.4 * (c - r), F = V(B0.x + (B1.x - B0.x) * 0.4, BALL_R, B0.z + (B1.z - B0.z) * 0.4);
      this.flights.push({ r, tb, c, B0, F, B1, cross: P[k].hand !== P[k + 1].hand, from: P[k].hand, to: P[k + 1].hand });
    }
  }
  // the ball while he has it: on the palm through a push and the catch before it, in the air between
  dribbleBall(t) {
    const P = this.pushes;
    for (let k = 0; k < P.length; k++) if (t >= P[k].catch && t <= P[k].s1) return { B: this.onPalm(P[k].hand, t), state: 'hand', hand: P[k].hand, k };
    const fl = this.flights.find(f => t > f.r && t < f.c);
    if (fl) {
      // down at a constant-ish speed (thrown), up decelerating (rebound); quadratic in each half keeps it smooth
      if (t < fl.tb) { const u = (t - fl.r) / (fl.tb - fl.r); return { B: fl.B0.clone().lerp(fl.F, u * (0.6 + 0.4 * u)), state: 'air', fl }; }
      const u = (t - fl.tb) / (fl.c - fl.tb); return { B: fl.F.clone().lerp(fl.B1, u * (1.55 - 0.55 * u)), state: 'air', fl };
    }
    // before the first push / after the last: in whichever hand had it
    const k = t < (P[0] ? P[0].catch : 0) ? 0 : P.length - 1;
    return { B: this.onPalm(P[k] ? P[k].hand : 'R', t), state: 'hand', hand: P[k] ? P[k].hand : 'R', k };
  }

  // ---------- the strike: the defender's hand meets the ball ----------
  // swipe up (a downward swipe gets called), with the hand on the ball's side, through the contact point at strike.t
  buildStrike() {
    const S = this.plan.strike, t = S.t, b = this.dribbleBall(t).B, b1 = this.dribbleBall(t + 1 / HZ).B, b0 = this.dribbleBall(t - 1 / HZ).B;
    const vb = b1.clone().sub(b0).multiplyScalar(HZ / 2);
    const sh = this.tab('df', S.hand === 'R' ? 'shR' : 'shL', t), f = this.fwd('df', t), r = this.right('df', t), side = S.hand === 'R' ? 1 : -1;
    // the swipe: from under and a little behind the ball (on his side of it), up and out through it
    const swipe = (S.swipe ? V(S.swipe.x, S.swipe.y, S.swipe.z) : UP.clone().multiplyScalar(0.8).addScaledVector(r, side * 0.45).addScaledVector(f, 0.15)).normalize();
    this.strike = { t, B: b, vb, swipe, sh, side, reach: sh.distanceTo(b) };
    // the ball after it: what's left of its own motion plus the pop off the hand, then gravity, bounces, a roll
    const pop = S.pop ?? 3.2, dirOut = S.out ? V(S.out.x, S.out.y, S.out.z).normalize() : swipe.clone().addScaledVector(UP, 0.2).normalize();
    let p = b.clone(), v = vb.multiplyScalar(S.keep ?? 0.25).addScaledVector(dirOut, pop);
    const pts = [], dt = 1 / HZ, n = Math.ceil((this.plan.simEnd - t) * HZ) + 2, bounces = [];
    for (let i = 0; i < n; i++) {
      pts.push(p.clone());
      v.y -= G * dt; p.addScaledVector(v, dt);
      if (p.y < BALL_R) {
        p.y = BALL_R;
        if (v.y < -0.4) { bounces.push({ t: t + (i + 1) * dt, speed: -v.y }); v.y = -v.y * 0.78; v.x *= 0.88; v.z *= 0.88; }
        else { v.y = 0; const sp = Math.hypot(v.x, v.z), dec = Math.min(sp, 1.1 * dt); if (sp > 1e-6) { v.x -= v.x / sp * dec; v.z -= v.z / sp * dec; } }
      }
    }
    this.loose = { t0: t, pts, bounces };
  }
  looseBall(t) { const L = this.loose, i = clamp(Math.round((t - L.t0) * HZ), 0, L.pts.length - 1); return L.pts[i].clone(); }
  // the striking hand's wrist target: ready low (palm up, in front of the knee), up through the ball, follow-through
  strikeHand(t) {
    const S = this.plan.strike, K = this.strike, lead = S.lead ?? 0.16, side = S.hand;
    const sh = this.tab('df', side === 'R' ? 'shR' : 'shL', t), f = this.fwd('df', t), r = this.right('df', t), sg = side === 'R' ? 1 : -1;
    // contact: palm on the underside of the ball, behind it in the swipe direction, fingers along the swipe
    const n = K.swipe.clone(), d = K.swipe.clone().addScaledVector(f, 0.6).addScaledVector(r, sg * 0.2).normalize();
    const contactW = (B) => B.clone().addScaledVector(n, -(BALL_R + 0.01)).addScaledVector(d, -0.07);
    const ready = sh.clone().addScaledVector(f, 0.32).addScaledVector(UP, -0.5).addScaledVector(r, sg * 0.12);
    let pos, dir = d.clone(), palm = n.clone(), w = 1;
    if (t < K.t - lead) {
      // getting the hand into the lane: low and still, from wherever the take had it
      w = smooth((t - (K.t - lead - 0.4)) / 0.3); pos = ready;
      palm = UP.clone().addScaledVector(f, 0.4).normalize(); dir = f.clone().addScaledVector(UP, -0.2).normalize();
    } else if (t <= K.t) {
      // the swipe: accelerating up from the ready spot into the ball (ease-in, fastest at contact)
      const u = (t - (K.t - lead)) / lead, e = u * u * (2 - u);
      pos = ready.clone().lerp(contactW(K.B), e);
      palm = nlerp(UP.clone().addScaledVector(f, 0.4).normalize(), n, e); dir = nlerp(f.clone().addScaledVector(UP, -0.2).normalize(), d, e);
    } else {
      // follow-through up and out with the ball, then the arm goes back to the take
      const u = smooth((t - K.t) / 0.14);
      pos = contactW(K.B).addScaledVector(K.swipe, 0.22 * u);
      w = 1 - smooth((t - K.t - 0.18) / 0.3);
    }
    return { pos, dir, palm, pole: r.clone().multiplyScalar(sg).addScaledVector(UP, -0.6).addScaledVector(f, -0.3).normalize(), curl: 0.12, w };
  }

  // ---------- the pass (lane) ----------
  // the passer picks up his dribble, both hands on it at his chest; the windup (he pulls it in and steps), then a
  // two-hand chest pass at the receiver's chest; the defender catches it on the line, in front of his man
  buildPass() {
    const S = this.plan.pass;
    const chestOf = (r, t) => { const h = this.tab(r, 'hip', t), f = this.fwd(r, t); return h.clone().addScaledVector(f, 0.34).setY(h.y + 0.42); };
    this.chestOf = chestOf;
    const from = chestOf('bh', S.rel).addScaledVector(this.fwd('bh', S.rel), 0.18);
    const d0 = from.distanceTo(chestOf('rc', S.rel));
    const to = chestOf('rc', S.rel + d0 / S.speed).addScaledVector(this.fwd('rc', S.rel + d0 / S.speed), 0.25);
    S.flight = from.distanceTo(to) / S.speed;
    this.passLine = { from, to, t0: S.rel, t1: S.rel + S.flight };
    // where and when the defender gets it: a fraction f of the way along
    S.tInt = S.rel + S.f * S.flight; this.passLine.I = this.passAt(S.tInt);
  }
  passAt(t) {
    const L = this.passLine, u = (t - L.t0) / (L.t1 - L.t0);
    return L.from.clone().lerp(L.to, u).add(V(0, 0.5 * G * (t - L.t0) * (L.t1 - t) * 0.3, 0));
  }
  holdAt(r, t) { // the ball held at the chest in both hands
    const h = this.tab(r, 'hip', t), f = this.fwd(r, t); return h.clone().addScaledVector(f, 0.36).setY(h.y + 0.36);
  }
  grip(r, B, t, w = 1) {
    const f = this.fwd(r, t), rt = V(-f.z, 0, f.x), ov = {};
    for (const [side, sg] of [['L', -1], ['R', 1]]) {
      const nn = rt.clone().multiplyScalar(sg);
      const dir = f.clone().multiplyScalar(0.55).addScaledVector(UP, 0.8).normalize();
      ov[side] = { pos: B.clone().addScaledVector(nn, BALL_R + 0.022).addScaledVector(dir, -0.085), palm: nn.clone().negate(), dir,
        pole: nn.clone().addScaledVector(UP, -0.7).addScaledVector(f, -0.2).normalize(), curl: 0.35, w };
    }
    return ov;
  }

  // ---------- the ball, all phases ----------
  ballState(t) {
    const P0 = this.plan;
    if (P0.strike && t >= this.strike.t) return { B: this.looseBall(t), state: 'loose' };
    if (P0.pass) {
      const S = P0.pass;
      if (t < S.pick) return this.dribbleBall(t);
      if (t < S.rel) {
        // pick-up: from the dribble into both hands at his chest; the windup pulls it in a touch and up
        const a = this.dribbleBall(S.pick).B, u = smooth((t - S.pick) / 0.16), hold = this.holdAt('bh', t);
        const wu = smooth((t - S.wind) / (S.rel - S.wind)), back = this.fwd('bh', t).multiplyScalar(-0.1 * Math.sin(Math.PI * Math.min(1, wu * 1.15)));
        return { B: a.lerp(hold.add(back).add(V(0, 0.04 * wu, 0)), u), state: 'held' };
      }
      if (t < S.tInt) return { B: this.passAt(t), state: 'pass' };
      return { B: this.caughtAt(t), state: 'caught' };
    }
    return this.dribbleBall(t);
  }
  caughtAt(t) { // in the defender's hands from the catch: at his hands' meeting point, then pulled in to his chest
    const S = this.plan.pass, u = smooth((t - S.tInt) / 0.25);
    return this.passLine.I.clone().lerp(this.holdAt('df', t), u);
  }

  // ---------- exposure: can you get a hand on it right now? ----------
  // in his hand (contact) = no; in the air but on his far side / out of your reach = no; in the air and within
  // reach of your near hand (shoulder to ball <= arm + hand + ball) = yes
  buildExposure() {
    const P0 = this.plan, n = this.T.n, reachMax = this.armLen.df + 0.1 + BALL_R, out = [];
    // (measured on the dribble as he'd have played it, so the window runs to where the ball would have reached his
    // hand even when the steal cuts it short)
    for (let i = 0; i < n; i++) {
      const t = i / HZ;
      const b = P0.pass ? this.ballState(t) : this.dribbleBall(t), B = b.B;
      const dL = this.tab('df', 'shL', t).distanceTo(B), dR = this.tab('df', 'shR', t).distanceTo(B), reach = Math.min(dL, dR);
      // (against a good dribbler a same-hand dribble stays on his side, his body and off arm between it and you:
      // covered; from behind - the trail - nothing covers it)
      // (and only on its way up off the floor: going down, a swipe is a swipe down - a foul)
      let state = 'hand';
      if (b.state === 'air') {
        if (!b.fl.cross && P0.kind === 'cross') state = 'side';
        else state = t > b.fl.tb && reach <= reachMax ? (b.fl.cross ? 'cross' : 'open') : 'away';
      } else if (b.state === 'pass') state = 'pass';
      out.push({ state, reach, near: dL < dR ? 'L' : 'R' });
    }
    this.expo = out;
    // the windows: runs of reachable samples
    const win = []; let a = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && (out[i].state === 'cross' || out[i].state === 'open');
      if (on && a < 0) a = i; if (!on && a >= 0) { win.push({ t0: a / HZ, t1: i / HZ, kind: out[a].state }); a = -1; }
    }
    this.windows = win;
  }
  exposure(t) { return this.expo[clamp(Math.round(t * HZ), 0, this.expo.length - 1)]; }

  // ---------- poses ----------
  pose(r, t) {
    const P = this.applyLock(r, this.tracks[r].at(t), t), P0 = this.plan, ball = this.ballState(t).B, opt = { look: ball, lookW: 0.5, curl: 0.3 };
    if (r === 'df') {
      opt.lookW = 0.65;
      if (P0.strike) { const h = this.strikeHand(t); if (h.w > 0) opt.handOverride = { [P0.strike.hand]: h }; }
      if (P0.pass) {
        const S = P0.pass, w = smooth((t - (S.tInt - 0.3)) / 0.2);
        if (w > 0) {
          // both hands up into the ball's path, then they take it in (the catch)
          const B = t < S.tInt ? this.passAt(S.tInt) : this.caughtAt(t);
          opt.handOverride = this.grip('df', B, t, w);
        }
      }
    }
    if (r === 'bh' && P0.pass) {
      const S = P0.pass;
      if (t >= S.pick - 0.05) {
        const b = this.ballState(Math.min(t, S.rel)).B, u = smooth((t - (S.pick - 0.05)) / 0.12);
        if (t < S.rel) opt.handOverride = this.grip('bh', b, t, u);
        else {
          // the push: arms out along the pass, thumbs turning down, held a beat
          const k = smooth((t - S.rel) / 0.12), w = 1 - smooth((t - S.rel - 0.35) / 0.35);
          const tgt = this.passLine.to.clone().sub(this.passLine.from).normalize();
          const ov = this.grip('bh', this.passLine.from.clone().addScaledVector(tgt, 0.22 * k), Math.min(t, S.rel + 0.01), w);
          for (const s of ['L', 'R']) { ov[s].dir = nlerp(ov[s].dir, tgt, k); }
          opt.handOverride = ov;
        }
      }
      opt.look = this.passLine.to.clone(); opt.lookW = 0.6;
    }
    if (r === 'rc' && P0.pass) {
      // a target: both hands up at his chest toward the passer, from just before the windup
      const S = P0.pass, w = smooth((t - (S.wind - 0.35)) / 0.25) * (1 - smooth((t - S.tInt - 0.15) / 0.3));
      if (w > 0) {
        const f = this.fwd('rc', t), toP = this.tab('bh', 'hip', t).sub(this.tab('rc', 'hip', t)).setY(0).normalize();
        const c = this.tab('rc', 'hip', t).addScaledVector(toP, 0.42).setY(this.tab('rc', 'hip', t).y + 0.42);
        opt.handOverride = this.grip('rc', c, t, w);
        for (const s of ['L', 'R']) opt.handOverride[s].palm = nlerp(opt.handOverride[s].palm, toP, 0.5);
        void f;
      }
      opt.look = this.tab('bh', 'head', t); opt.lookW = 0.6;
    }
    return { T: P, opt };
  }
  ball(t) {
    const r = this.ballState(t);
    if (!this.qTrack) this.buildSpin();
    return { pos: r.B, state: r.state, q: this.qTrack[clamp(Math.round(t * HZ), 0, this.qTrack.length - 1)] };
  }
  buildSpin() {
    this.qTrack = []; const q = new THREE.Quaternion(); let prev = null;
    for (let t = 0; t <= this.plan.simEnd + 1e-6; t += 1 / HZ) {
      const r = this.ballState(t);
      if (prev) {
        const d = r.B.clone().sub(prev); d.y = 0; const len = d.length();
        if (len > 1e-5 && r.state !== 'held' && r.state !== 'caught') {
          const ax = new THREE.Vector3().crossVectors(UP, d).normalize();
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, r.state === 'pass' ? -2 * Math.PI * 1.6 / HZ : len / BALL_R));
        }
      }
      this.qTrack.push(q.clone()); prev = r.B;
    }
  }
  frame(r, t) {
    const hip = this.tab(r, 'hip', t), f = this.fwd(r, t);
    return { p: V(hip.x, 0, hip.z), hip, yaw: Math.atan2(f.x, f.z), f, r: V(-f.z, 0, f.x) };
  }
}
