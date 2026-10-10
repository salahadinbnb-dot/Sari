// Evaluates the timeline at any sim time: body frames, feet, ball, and full rig poses.
import * as THREE from 'three';
import { planFeet, footAt, fwdOf, leftOf, yawOf, clamp, lerp, smooth, smoother, angDiff } from './motion.js';
import { TL, RIM } from './timeline.js';

const UP = new THREE.Vector3(0, 1, 0);
export const BALL_R = 0.12;
const G = 9.81;

export class World {
  constructor(specs) {
    this.specs = specs; // name -> {scale}
    this.names = Object.keys(TL.players);
    for (const n of this.names) this[n] = TL.players[n];
    this.cache = new Map();
    // plan feet (yaw functions may reference other players' paths + ball; ball held anchors need yaw -> fine)
    this.plans = {};
    for (const n of this.names) {
      const P = TL.players[n];
      const s = specs[n].scale;
      this.plans[n] = planFeet({
        scale: s, path: P.path, yaw: (t) => this.yaw(n, t), stance: P.stance, gait: P.gait,
        footOverride: P.footOverride ? (side, t) => P.footOverride(side, t) : null,
      }, 0, TL.simEnd);
    }
    this.buildBallTrack();
  }
  scale(n) { return this.specs[n].scale; }
  yaw(n, t) {
    const key = n + ':' + t.toFixed(4);
    if (this.cache.has(key)) return this.cache.get(key);
    const y = TL.players[n].yaw(t, this);
    this.cache.set(key, y);
    return y;
  }
  pos(n, t, h = 0) { const p = TL.players[n].path.at(t); return { x: p.x, y: h, z: p.z }; }
  faceYaw(a, b, t) { const pa = TL.players[a].path.at(t), pb = TL.players[b].path.at(t); return yawOf(pb.x - pa.x, pb.z - pa.z); }

  // body frame (root on floor, orientation, hip height after reach limits)
  frame(n, t) {
    const key = 'F' + n + ':' + t.toFixed(4);
    if (this.cache.has(key)) return this.cache.get(key);
    const P = TL.players[n], s = this.scale(n);
    const p = P.path.at(t), v = P.path.vel(t);
    const yaw = this.yaw(n, t);
    const f = fwdOf(yaw), l = leftOf(yaw), r = l.clone().negate();
    const st = P.stance(t);
    const speed = Math.hypot(v.x, v.z);
    const root = new THREE.Vector3(p.x, 0, p.z);
    // feet
    const feet = {};
    for (const side of ['L', 'R']) {
      let ov = null;
      if (P.footOverride) {
        const o = P.footOverride(side, t);
        if (o && o.kind === 'jab') ov = this.jabFoot(n, side, t, o);
      }
      feet[side] = footAt(this.plans[n], side, t, ov);
    }
    // jump
    let jumpH = 0;
    if (P.jump && t > P.jump.t0 && t < P.jump.t1) {
      const u = (t - P.jump.t0) / (P.jump.t1 - P.jump.t0);
      jumpH = P.jump.h * Math.sin(Math.PI * u);
      for (const side of ['L', 'R']) { feet[side] = { ...feet[side], pos: feet[side].pos.clone().add(new THREE.Vector3(0, jumpH * 0.92, 0)), pitch: 0.5 * Math.sin(Math.PI * u) }; }
    }
    // hip height
    const restHip = 0.9 * s;
    let hipY = restHip * st.hipF;
    // bob from gait
    const swingU = [feet.L, feet.R].filter(q => q.swinging).map(q => q.u);
    if (swingU.length === 1 && speed > 0.4) {
      const run = speed > 3.0;
      hipY += (run ? -0.022 : 0.012) * s * Math.sin(Math.PI * swingU[0]) + (run ? 0.012 * s : 0);
    }
    if (swingU.length === 2) hipY += 0.02 * s;
    // speed lowers hips slightly when running hard
    hipY -= clamp(speed - 2.5, 0, 3) * 0.012 * s;
    let hipOff = new THREE.Vector3();
    if (P.footOverride) { const o = P.footOverride('R', t); if (o && o.kind === 'jab') { const a = this.jabAmt(t, o); hipOff.addScaledVector(f, 0.09 * a * s).addScaledVector(r, 0.04 * a * s); hipY -= 0.05 * a * s; } }
    // reach limit (smooth): each grounded foot caps the hip height; soft-min keeps it continuous
    const L = 0.8 * s * 0.985;
    const caps = [];
    for (const side of ['L', 'R']) {
      const F = feet[side];
      const sg = side === 'L' ? 1 : -1;
      const hj = root.clone().add(hipOff).addScaledVector(l, sg * 0.092 * s);
      const dh = Math.min(Math.hypot(F.pos.x - hj.x, F.pos.z - hj.z), L * 0.97);
      const maxV = Math.sqrt(L * L - dh * dh) + F.pos.y;
      const lift = F.pos.y - 0.098 * s - jumpH * 0.92;
      const ground = 1 - smooth((lift - 0.03 * s) / (0.1 * s));
      caps.push(maxV + (1 - ground) * 0.6);
    }
    const k = 0.025;
    const softmin = (a, b) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
    hipY = softmin(hipY, softmin(caps[0] - 0.005, caps[1] - 0.005));
    hipY += jumpH;
    const fr = { n, t, s, p: root, v, speed, yaw, f, l, r, st, hipY, hipOff, feet, jumpH };
    this.cache.set(key, fr);
    return fr;
  }
  jabAmt(t, o) {
    if (t < o.t0 || t > o.back) return 0;
    if (t < o.out) return smooth((t - o.t0) / (o.out - o.t0));
    if (t < o.hold) return 1;
    return 1 - smooth((t - o.hold) / (o.back - o.hold));
  }
  jabFoot(n, side, t, o) {
    const base = footAt(this.plans[n], side, o.t0 - 0.01, null);
    const yaw = this.yaw(n, t), f = fwdOf(yaw), l = leftOf(yaw), s = this.scale(n);
    const a = this.jabAmt(t, o);
    const pos = base.pos.clone().addScaledVector(f, o.fwd * s * a).addScaledVector(l, -o.right * s * a);
    const moving = (t < o.out && t > o.t0) || (t > o.hold && t < o.back);
    const u = t < o.out ? (t - o.t0) / (o.out - o.t0) : (t - o.hold) / (o.back - o.hold);
    if (moving) pos.y += 0.05 * s * Math.sin(Math.PI * clamp(u, 0, 1));
    return { pos, yaw: base.yaw + 0.1 * a, pitch: moving ? 0.15 : 0, toeBend: 0, swinging: moving, u };
  }

  // ---------- anchors ----------
  anchor(n, name, t) {
    const F = this.frame(n, t), s = F.s;
    const c = F.p.clone().add(F.hipOff);
    const Y = (h) => new THREE.Vector3(0, F.hipY + h * s, 0);
    switch (name) {
      case 'chest': return c.addScaledVector(F.f, 0.33 * s).add(Y(0.36));
      case 'catch': return c.addScaledVector(F.f, 0.4 * s).addScaledVector(F.l, 0.04 * s).add(Y(0.3));
      case 'pocket': return c.addScaledVector(F.f, 0.2 * s).addScaledVector(F.r, 0.2 * s).add(Y(0.04));
      case 'gather': return c.addScaledVector(F.f, 0.28 * s).addScaledVector(F.r, 0.06 * s).add(Y(0.3));
      case 'layup': return c.addScaledVector(F.f, 0.3 * s).addScaledVector(F.r, 0.12 * s).add(Y(0.98));
      case 'top': return c.addScaledVector(F.f, 0.16 * s).addScaledVector(F.r, 0.31 * s).add(Y(0.03));
    }
    throw new Error('anchor ' + name);
  }
  floorPoint(n, t) {
    const F = this.frame(n, t), s = F.s;
    return F.p.clone().addScaledVector(F.r, 0.34 * s).addScaledVector(F.f, 0.2 * s + 0.1 * F.speed).setY(BALL_R);
  }

  // ---------- ball ----------
  ballRaw(t) {
    const ev = TL.ball;
    let i = 0; while (i + 1 < ev.length && ev[i + 1].t <= t) i++;
    const e = ev[i];
    if (e.state === 'held') {
      let pos = this.anchor(e.who, e.anchor, t);
      if (e.blend && t < e.t + e.blend && i > 0) {
        const prev = this.ballRawAt(ev[i - 1], i - 1, e.t);
        pos = prev.clone().lerp(pos, smoother((t - e.t) / e.blend));
      }
      return { pos, holder: e.who, state: 'held' };
    }
    if (e.state === 'flight') {
      const t0 = e.t, t1 = e.to.t;
      const p0 = this.ballRawAt(ev[i - 1], i - 1, t0);
      const p1 = this.anchor(e.to.who, e.to.anchor, t1);
      const u = clamp((t - t0) / (t1 - t0), 0, 1);
      if (e.bounceAt) {
        const tb = t0 + (t1 - t0) * e.bounceAt;
        const pb = p0.clone().lerp(p1, e.bounceAt).setY(BALL_R);
        if (t < tb) return { pos: ballistic(p0, pb, t0, tb, t), state: 'flight' };
        return { pos: ballistic(pb, p1, tb, t1, t), state: 'flight' };
      }
      const pos = p0.clone().lerp(p1, u);
      pos.y += 4 * e.arc * u * (1 - u);
      return { pos, state: 'flight' };
    }
    if (e.state === 'dribble') {
      const tops = [e.t];
      const bs = e.bounces;
      for (let k = 0; k + 1 < bs.length; k++) tops.push((bs[k] + bs[k + 1]) / 2);
      tops.push(e.end);
      if (t <= e.t) return { pos: this.anchor(e.who, 'top', t), holder: e.who, state: 'dribble' };
      for (let k = 0; k < bs.length; k++) {
        const ta = tops[k], tb = bs[k], tc = tops[k + 1];
        if (t <= tc) {
          const pa = k === 0 ? this.ballRawAt(ev[i - 1], i - 1, ta) : this.anchor(e.who, 'top', ta);
          const pb = this.floorPoint(e.who, tb);
          const pc = this.anchor(e.who, 'top', tc);
          const pos = t < tb ? ballistic(pa, pb, ta, tb, t, true) : ballistic(pb, pc, tb, tc, t);
          return { pos, holder: e.who, state: 'dribble', inHand: t < ta + 0.07 || t > tc - 0.06 };
        }
      }
      return { pos: this.anchor(e.who, 'top', t), holder: e.who, state: 'dribble' };
    }
    if (e.state === 'shot') {
      const p0 = this.ballRawAt(ev[i - 1], i - 1, e.t);
      const p1 = new THREE.Vector3(RIM.x + 0.02, RIM.y + 0.1, RIM.z + 0.03);
      const u = clamp((t - e.t) / (e.t1 - e.t), 0, 1);
      const pos = p0.clone().lerp(p1, u); pos.y += 4 * 0.42 * u * (1 - u);
      return { pos, state: 'shot' };
    }
    if (e.state === 'net') {
      const u = clamp((t - e.t) / (e.t1 - e.t), 0, 1);
      const pos = new THREE.Vector3(RIM.x + 0.02 * (1 - u), RIM.y + 0.1 - 0.62 * (u * u * 0.5 + u * 0.5), RIM.z + 0.03 * (1 - u) + 0.05 * u);
      return { pos, state: 'net', netU: u };
    }
    if (e.state === 'drop') {
      // falls from under the net, bounces with restitution
      const y0 = RIM.y - 0.52, vx = 0.0, vz = 0.9;
      let tt = t - e.t, y = y0, vy = -1.8, x = RIM.x, z = RIM.z + 0.08;
      let rem = tt;
      let py = y0, pvy = vy;
      while (true) {
        const disc = pvy * pvy + 2 * G * (py - BALL_R);
        const tHit = (pvy + Math.sqrt(Math.max(disc, 0))) / G;
        if (rem < tHit || Math.abs(pvy) < 0.3 && py <= BALL_R + 1e-3) { y = Math.max(BALL_R, py + pvy * rem - 0.5 * G * rem * rem); break; }
        rem -= tHit; const vHit = pvy - G * tHit; pvy = -vHit * 0.62; py = BALL_R;
        if (pvy < 0.35) { y = BALL_R; break; }
      }
      return { pos: new THREE.Vector3(x + vx * tt, y, z + vz * Math.min(tt, 1.2) - 0.25 * Math.max(0, Math.min(tt, 1.2)) ** 2), state: 'drop' };
    }
    return { pos: new THREE.Vector3(0, BALL_R, 0), state: 'none' };
  }
  ballRawAt(e, i, t) {
    // position at time t evaluated as if event i were active (used for continuity)
    if (e.state === 'held') {
      let pos = this.anchor(e.who, e.anchor, t);
      if (e.blend && t < e.t + e.blend && i > 0) pos = this.ballRawAt(TL.ball[i - 1], i - 1, e.t).lerp(pos, smoother((t - e.t) / e.blend));
      return pos;
    }
    if (e.state === 'dribble') return this.anchor(e.who, 'top', t);
    return this.ballRaw(t).pos;
  }
  buildBallTrack() {
    const dt = 1 / 240;
    this.ballTrack = [];
    let ang = 0; let axis = new THREE.Vector3(1, 0, 0); let prev = this.ballRaw(0).pos;
    const q = new THREE.Quaternion();
    for (let t = 0; t <= TL.simEnd + 1e-6; t += dt) {
      const b = this.ballRaw(t);
      const d = b.pos.clone().sub(prev);
      const len = d.length();
      if (len > 1e-5 && b.state !== 'held') {
        const ax = new THREE.Vector3().crossVectors(UP, d).normalize();
        if (ax.lengthSq() > 0.5) { q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, len / BALL_R)); }
      }
      this.ballTrack.push({ t, pos: b.pos.clone(), q: q.clone(), state: b.state, holder: b.holder, inHand: b.inHand, netU: b.netU });
      prev = b.pos;
    }
  }
  ball(t) {
    const i = clamp(Math.round(t * 240), 0, this.ballTrack.length - 1);
    const b = this.ballRaw(t);
    return { ...this.ballTrack[i], pos: b.pos, state: b.state, holder: b.holder, inHand: b.inHand, netU: b.netU };
  }
  ballPos(t) { return this.ballRaw(t).pos; }

  // ---------- full pose for the rig ----------
  pose(n, t) {
    const P = TL.players[n];
    const F = this.frame(n, t);
    const s = F.s;
    const feet = {};
    for (const side of ['L', 'R']) {
      const q = F.feet[side];
      feet[side] = { pos: q.pos, yaw: q.yaw, pitch: q.pitch || 0, toeBend: q.toeBend || 0, kneePole: fwdOf(q.yaw).add(fwdOf(F.yaw)).normalize() };
    }
    const lean = F.st.lean + clamp(F.speed * 0.035, 0, 0.16);
    const hands = this.hands(n, t, F);
    const lk = P.look ? P.look(t, this) : null;
    const look = lk ? new THREE.Vector3(lk.x, lk.y ?? 1.5, lk.z) : null;
    // pelvis twist toward forward foot when running
    const d = feet.R.pos.clone().sub(feet.L.pos).dot(F.f) / (0.8 * s);
    const twist = F.speed > 1.2 ? clamp(d, -1, 1) * 0.16 : 0;
    return {
      pos: F.p, yaw: F.yaw, hipY: F.hipY, hipOffset: F.hipOff,
      chestLean: lean, chestTwist: -twist * 0.9, pelvisTwist: twist,
      feet, hands, lookAt: look,
    };
  }

  actionAt(n, t) {
    const acts = TL.players[n].actions;
    let i = 0; while (i + 1 < acts.length && acts[i + 1][0] <= t) i++;
    return { cur: acts[i][1], t0: acts[i][0], bl: acts[i][2], prev: i > 0 ? acts[i - 1][1] : null, next: acts[i + 1] ? acts[i + 1] : null };
  }

  hands(n, t, F) {
    const A = this.actionAt(n, t);
    let H = this.handsFor(A.cur, n, t, F);
    // blend from previous action
    const bl = A.bl ?? 0.26;
    if (A.prev && t - A.t0 < bl) {
      const Hp = this.handsFor(A.prev, n, t, F);
      const u = smooth((t - A.t0) / bl);
      H = { L: blendHand(Hp.L, H.L, u), R: blendHand(Hp.R, H.R, u) };
    }
    return H;
  }

  handsFor(action, n, t, F) {
    const s = F.s, f = F.f, l = F.l, r = F.r;
    const c = F.p.clone().add(F.hipOff);
    const at = (fw, side, h) => c.clone().addScaledVector(f, fw * s).addScaledVector(l, side * s).add(new THREE.Vector3(0, F.hipY + h * s, 0));
    const down = new THREE.Vector3(0, -1, 0);
    const hand = (pos, pole, palm, dir, curl = 0.3) => ({ pos, pole: pole.normalize(), palm: palm.normalize(), dir: dir.normalize(), curl });
    const onBall = (bp, nrm, fingerDir) => {
      nrm = nrm.normalize();
      const contact = bp.clone().addScaledVector(nrm, BALL_R + 0.012);
      const dir = fingerDir.clone().addScaledVector(nrm, -fingerDir.dot(nrm)).normalize();
      return { pos: contact.addScaledVector(dir, -0.075 * s).addScaledVector(nrm, 0.01), palm: nrm.clone().negate(), dir };
    };
    switch (action) {
      case 'relax': return {
        L: hand(at(0.06, 0.25, -0.12), f.clone().negate().add(l.clone().multiplyScalar(0.3)), l.clone().negate(), down.clone().add(f.clone().multiplyScalar(0.2)), 0.35),
        R: hand(at(0.06, -0.25, -0.12), f.clone().negate().add(r.clone().multiplyScalar(0.3)), r.clone().negate(), down.clone().add(f.clone().multiplyScalar(0.2)), 0.35),
      };
      case 'ready': return {
        L: hand(at(0.26, 0.26, 0.06), f.clone().negate().add(l).add(down), f.clone().add(r.clone().multiplyScalar(0.6)), f.clone().add(down.clone().multiplyScalar(0.4)), 0.25),
        R: hand(at(0.26, -0.26, 0.06), f.clone().negate().add(r).add(down), f.clone().add(l.clone().multiplyScalar(0.6)), f.clone().add(down.clone().multiplyScalar(0.4)), 0.25),
      };
      case 'runArms': {
        const d = clamp(F.feet.R.pos.clone().sub(F.feet.L.pos).dot(f) / (0.75 * s), -1, 1);
        const mk = (side, k) => {
          const sw = side === 'L' ? d : -d;
          return hand(at(0.04 + 0.3 * sw * k, (side === 'L' ? 1 : -1) * 0.27, 0.12 + 0.16 * Math.max(0, sw) * k),
            f.clone().negate().add(down.clone().multiplyScalar(0.8)).add((side === 'L' ? l : r).clone().multiplyScalar(0.3)),
            side === 'L' ? r.clone() : l.clone(), f.clone().add(new THREE.Vector3(0, 0.6, 0)), 0.55);
        };
        const k = clamp(F.speed / 3.5, 0.2, 1);
        return { L: mk('L', k), R: mk('R', k) };
      }
      case 'hold': case 'catch': case 'layup': {
        const b = this.ballPos(t);
        let target = b;
        if (action === 'catch') {
          const fb = this.ballRaw(t);
          const catchPt = this.anchor(n, 'catch', t);
          const dist = b.distanceTo(catchPt);
          const reach = clamp(1 - dist / 2.2, 0, 1);
          target = catchPt.clone().lerp(b, reach * 0.8);
          if (fb.state === 'held' && fb.holder === n) target = b;
        }
        const Lh = onBall(target, l.clone().multiplyScalar(0.92).add(f.clone().multiplyScalar(-0.25)).add(new THREE.Vector3(0, 0.18, 0)), new THREE.Vector3(0, 1, 0).add(f.clone().multiplyScalar(0.7)));
        const Rh = onBall(target, r.clone().multiplyScalar(0.75).add(f.clone().multiplyScalar(-0.45)).add(new THREE.Vector3(0, 0.45, 0)), new THREE.Vector3(0, 1, 0).add(f.clone().multiplyScalar(0.6)));
        return {
          L: { ...Lh, pole: down.clone().add(l).add(f.clone().multiplyScalar(-0.6)).normalize(), curl: 0.28 },
          R: { ...Rh, pole: down.clone().add(r).add(f.clone().multiplyScalar(-0.6)).normalize(), curl: 0.28 },
        };
      }
      case 'chestPass': {
        const u = clamp((t - 0.26) / 0.22, 0, 1);
        const tgt = TL.players.you.path.at(t);
        const dir = new THREE.Vector3(tgt.x - F.p.x, 0, tgt.z - F.p.z).normalize();
        const ext = at(0.3 + 0.28 * u, 0, 0.36);
        return {
          L: hand(ext.clone().addScaledVector(l, 0.1 * s), down.clone().add(l).add(f.clone().multiplyScalar(-0.5)), dir.clone().add(down.clone().multiplyScalar(0.2)), dir.clone().add(l.clone().multiplyScalar(0.3)), 0.2),
          R: hand(ext.clone().addScaledVector(r, 0.1 * s), down.clone().add(r).add(f.clone().multiplyScalar(-0.5)), dir.clone().add(down.clone().multiplyScalar(0.2)), dir.clone().add(r.clone().multiplyScalar(0.3)), 0.2),
        };
      }
      case 'dribble': {
        const b = this.ball(t);
        const bp = b.pos;
        const yMin = F.hipY - 0.1 * s;
        const hb = bp.clone(); hb.y = Math.max(bp.y, yMin);
        const oh = onBall(hb, new THREE.Vector3(0, 1, 0).add(f.clone().multiplyScalar(-0.3)).add(r.clone().multiplyScalar(0.12)), f.clone().add(new THREE.Vector3(0, -0.15, 0)));
        const R = { ...oh, pole: f.clone().multiplyScalar(-1).add(r.clone().multiplyScalar(0.8)).add(down.clone().multiplyScalar(0.3)).normalize(), curl: 0.18 };
        const L = hand(at(0.34, 0.2, 0.3), down.clone().add(l.clone().multiplyScalar(0.8)).add(f.clone().multiplyScalar(-0.3)), f.clone().add(l.clone().multiplyScalar(0.4)), l.clone().multiplyScalar(0.35).add(f.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, 0.55, 0)), 0.35);
        return { L, R };
      }
      case 'pass': {
        const u = clamp((t - 10.02) / 0.16, 0, 1);
        const tgt = TL.players.screener.path.at(10.4);
        const dir = new THREE.Vector3(tgt.x - F.p.x, 0, tgt.z - F.p.z).normalize();
        const b = this.ballPos(t);
        const start = this.anchor(n, 'top', 10.02);
        const endp = at(0.0, 0, 0).setY(F.hipY - 0.05 * s).addScaledVector(dir, 0.62 * s).addScaledVector(r, 0.12 * s);
        const wp = start.clone().lerp(endp, smooth(u)); wp.y += 0.06 * s;
        const R = hand(wp, r.clone().add(down).add(f.clone().multiplyScalar(-0.4)), dir.clone().add(down.clone().multiplyScalar(0.5)), dir.clone().add(down.clone().multiplyScalar(0.35)), 0.12);
        const L = hand(at(0.32, 0.2, 0.28), down.clone().add(l.clone().multiplyScalar(0.8)).add(f.clone().multiplyScalar(-0.3)), f.clone().add(l.clone().multiplyScalar(0.4)), l.clone().multiplyScalar(0.35).add(f.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, 0.55, 0)), 0.35);
        return { L, R };
      }
      case 'follow': return {
        L: hand(at(0.26, 0.26, 0.12), f.clone().negate().add(l).add(down), f.clone().add(r.clone().multiplyScalar(0.6)), f.clone(), 0.25),
        R: hand(at(0.42, -0.16, 0.05), f.clone().negate().add(r).add(down), f.clone().add(down), f.clone().add(down.clone().multiplyScalar(0.5)), 0.2),
      };
      case 'defend': {
        // hand nearest the ball stays low to trace it, the other is up; blend continuously with ball side
        const bp = this.ballPos(t);
        const lat = new THREE.Vector3(bp.x - F.p.x, 0, bp.z - F.p.z).dot(l);
        const w = smooth((lat + 0.7) / 1.4); // 1 => ball on my left
        const mk = (sd, low) => {
          const sg = sd === 'L' ? 1 : -1;
          const S = sd === 'L' ? l : r;
          const lo = hand(at(0.44, sg * 0.34, 0.02), down.clone().add(S.clone().multiplyScalar(0.8)).add(f.clone().multiplyScalar(-0.4)), f.clone().add(new THREE.Vector3(0, 0.5, 0)), f.clone().multiplyScalar(0.7).add(S.clone().multiplyScalar(0.4)).add(down.clone().multiplyScalar(0.2)), 0.2);
          const hi = hand(at(0.3, sg * 0.42, 0.62), down.clone().add(S.clone().multiplyScalar(0.9)).add(f.clone().multiplyScalar(-0.3)), f.clone(), new THREE.Vector3(0, 1, 0).add(S.clone().multiplyScalar(0.25)), 0.15);
          return blendHand(hi, lo, low);
        };
        return { L: mk('L', w), R: mk('R', 1 - w) };
      }
      case 'finish': {
        const rel = this.anchor(n, 'layup', 11.22);
        const u = smooth((t - 11.22) / 0.35);
        const up = new THREE.Vector3(0, 1, 0);
        const Lp = rel.clone().addScaledVector(l, 0.13 * s).addScaledVector(up, 0.08 * s - 0.25 * u * s);
        const Rp = rel.clone().addScaledVector(r, 0.1 * s).addScaledVector(up, 0.12 * s - 0.2 * u * s).addScaledVector(f, 0.06 * s);
        return {
          L: hand(Lp, down.clone().add(l).add(f.clone().multiplyScalar(-0.3)), f.clone().add(up.clone().multiplyScalar(0.3)), up.clone().add(f.clone().multiplyScalar(0.4)), 0.15),
          R: hand(Rp, down.clone().add(r).add(f.clone().multiplyScalar(-0.3)), f.clone().add(down.clone().multiplyScalar(0.4)), up.clone().add(f.clone().multiplyScalar(0.9)), 0.1),
        };
      }
      case 'contest': return {
        L: hand(at(0.22, 0.17, 1.02), down.clone().add(l).add(f.clone().multiplyScalar(-0.3)), f.clone(), new THREE.Vector3(0, 1, 0), 0.12),
        R: hand(at(0.22, -0.17, 1.02), down.clone().add(r).add(f.clone().multiplyScalar(-0.3)), f.clone(), new THREE.Vector3(0, 1, 0), 0.12),
      };
      case 'help': return {
        L: hand(at(0.36, 0.5, 0.36), down.clone().add(f.clone().multiplyScalar(-0.7)).add(l.clone().multiplyScalar(0.3)), f.clone().add(l.clone().multiplyScalar(0.3)), l.clone().multiplyScalar(0.7).add(f.clone().multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.25, 0)), 0.2),
        R: hand(at(0.36, -0.5, 0.36), down.clone().add(f.clone().multiplyScalar(-0.7)).add(r.clone().multiplyScalar(0.3)), f.clone().add(r.clone().multiplyScalar(0.3)), r.clone().multiplyScalar(0.7).add(f.clone().multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.25, 0)), 0.2),
      };
      case 'screen': return {
        L: hand(at(0.2, -0.1, 0.36), down.clone().add(l.clone().multiplyScalar(0.9)), f.clone().negate(), r.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.55),
        R: hand(at(0.25, 0.1, 0.3), down.clone().add(r.clone().multiplyScalar(0.9)), f.clone().negate(), l.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.55),
      };
      case 'target': {
        const run = this.handsFor('runArms', n, t, F);
        const up = hand(at(0.34, 0.2, 0.62), down.clone().add(l.clone().multiplyScalar(0.8)), f.clone(), new THREE.Vector3(0, 1, 0).add(f.clone().multiplyScalar(0.2)), 0.15);
        const upR = hand(at(0.34, -0.2, 0.62), down.clone().add(r.clone().multiplyScalar(0.8)), f.clone(), new THREE.Vector3(0, 1, 0).add(f.clone().multiplyScalar(0.2)), 0.15);
        const k = clamp((t - 9.3) / 0.4, 0, 1);
        return { L: blendHand(run.L, up, k), R: blendHand(run.R, upR, k) };
      }
    }
    return this.handsFor('relax', n, t, F);
  }
}

function blendHand(a, b, u) {
  return {
    pos: a.pos.clone().lerp(b.pos, u), pole: a.pole.clone().lerp(b.pole, u).normalize(),
    palm: a.palm.clone().lerp(b.palm, u).normalize(), dir: a.dir.clone().lerp(b.dir, u).normalize(), curl: lerp(a.curl, b.curl, u),
  };
}

// ballistic arc from p0 (t0) to p1 (t1); if pushed, starts with downward velocity (dribble push)
function ballistic(p0, p1, t0, t1, t, pushed = false) {
  const T = Math.max(t1 - t0, 1e-3), tau = clamp(t - t0, 0, T);
  const u = tau / T;
  const x = lerp(p0.x, p1.x, u), z = lerp(p0.z, p1.z, u);
  const vy0 = (p1.y - p0.y + 0.5 * G * T * T) / T;
  const y = p0.y + vy0 * tau - 0.5 * G * tau * tau;
  return new THREE.Vector3(x, y, z);
}
