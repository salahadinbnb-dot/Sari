// v7 HUD (portrait): rep title, slow-mo / freeze pill, coaching captions; a ring on the ball - red while he has it
// covered (in his hand, or out of your reach), green the moment it's in reach - and the ball strip at the bottom: the
// rep's dribble as a timeline of those states, revealed as it plays, with the steal marked. On the passing rep, a
// race instead: the pass against you. Plus intro and outro cards. Captions can quote measured numbers ({cross.win}).
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';
import { REP_TITLES } from './timeline7.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const COL = { hand: '#b8233a', side: '#b8233a', away: '#6b2a36', cross: '#2fe377', open: '#2fe377', pass: '#ffc23a' };
const STATE = { hand: ['IN HIS HAND', 'covered'], side: ['ON HIS SIDE', 'his body in the way'], away: ['OUT OF REACH', 'not yet'], cross: ['IN REACH', 'crossing in front of him'], open: ['IN REACH', 'in the air, nothing covering it'] };

export class Hud7 {
  constructor(root, reps, frames, fps) {
    this.root = root; this.reps = reps; this.frames = frames; this.fps = fps;
    root.innerHTML = '';
    this.svg = el('div', 'ov', '<svg width="1080" height="1920" viewBox="0 0 1080 1920"></svg>'); root.appendChild(this.svg); this.S = this.svg.firstChild;
    this.top = el('div', 'top', '<div class="kick">GET YOUR HANDS ON IT</div><div class="title"><span></span></div>'); root.appendChild(this.top);
    this.mode = el('div', 'mode', '<span></span>'); root.appendChild(this.mode);
    this.cap = el('div', 'cap', '<div class="box"></div>'); root.appendChild(this.cap);
    this.strip = el('div', 'strip', `<div class="row"><span class="state"><span class="lbl">THE BALL</span><b class="pill"></b><span class="sub"></span></span><span class="num"></span></div><div class="bar"><canvas width="960" height="34"></canvas><div class="mask"></div></div>`);
    root.appendChild(this.strip);
    this.race = el('div', 'race'); root.appendChild(this.race);
    this.card = el('div', 'card'); root.appendChild(this.card);
    this.seg = {}; this.repStart = {};
    frames.forEach((f) => { const s = this.seg[f.seg] || (this.seg[f.seg] = { v0: f.vt, v1: f.vt }); s.v1 = f.vt + 1 / fps; if (!f.card && this.repStart[f.rep] === undefined) this.repStart[f.rep] = f.vt; });
    // per rep: the measured numbers and the strip
    this.vals = {}; this.R = {};
    for (const [name, rep] of Object.entries(reps)) {
      const P = rep.plan, v = {};
      if (P.strike) {
        const ts = rep.strike.t, w = rep.windows.filter(x => x.t0 <= ts + 1e-3 && x.t1 >= ts - 1e-3)[0] || rep.windows.filter(x => x.t0 < ts).slice(-1)[0];
        v.win = w ? (w.t1 - w.t0).toFixed(2) : '-';
        // before the cross: share of the time the ball is covered (in his hand or out of reach)
        // before the cross: the share of the time his hand is actually on the ball (the dribble's contact phases)
        let hand = 0, all = 0; for (let t = 0; t < (w ? w.t0 : ts); t += 1 / 120) { all++; if (rep.exposure(t).state === 'hand') hand++; }
        v.hand = all ? Math.round(100 * hand / all) : 0;
        const a = Math.max(0, Math.min(...frames.filter(f => f.rep === name && !f.card).map(f => f.st))), b = ts + 0.12;
        const cv = document.createElement('canvas'); cv.width = 960; cv.height = 34; const g = cv.getContext('2d');
        for (let x = 0; x < 960; x++) { g.fillStyle = COL[rep.exposure(a + (x + 0.5) / 960 * (b - a)).state] || '#444'; g.fillRect(x, 0, 1, 34); }
        this.R[name] = { a, b, cv, ts };
      }
      if (P.pass) {
        const S = P.pass;
        v.flight = (S.tInt - S.rel).toFixed(2); v.lead = (S.rel - S.wind).toFixed(2); v.you = (S.tInt - S.wind).toFixed(2);
      }
      this.vals[name] = v;
    }
  }
  fill(s) { return s.replace(/\{(\w+)\.(\w+)\}/g, (_, r, k) => (this.vals[r] || {})[k] ?? ''); }
  setRep(name) {
    if (this.cur === name) return; this.cur = name;
    this.top.querySelector('.title span').textContent = REP_TITLES[name];
    const R = this.R[name];
    if (R) {
      this.strip.querySelector('canvas').getContext('2d').drawImage(R.cv, 0, 0);
      const bar = this.strip.querySelector('.bar');
      if (this.mk) this.mk.remove();
      this.mk = el('div', 'mk', '<span>STEAL</span>'); this.mk.style.left = ((R.ts - R.a) / (R.b - R.a) * 960) + 'px'; bar.appendChild(this.mk);
      if (!this.ph) { this.ph = el('div', 'ph'); bar.appendChild(this.ph); }
      this.strip.querySelector('.num').innerHTML = `<b>${this.vals[name].win} s</b> IN REACH`;
    }
  }
  proj(p, cam) { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * 1080, y: (1 - v.y) / 2 * 1920, ok: v.z < 1 && v.z > -1 }; }
  // fr: frame from the time map, st: sim time, cam: the camera the picture was drawn with
  update(fr, st, cam) {
    const rep = this.reps[fr.rep], P = rep.plan, S = this.seg[fr.seg], e = fr.vt - S.v0, r = S.v1 - fr.vt;
    this.setRep(fr.rep);
    if (fr.card) return this.cardUpdate(fr, e, S);
    this.card.style.opacity = '0'; this.svg.style.opacity = '1';
    const u = smooth((fr.vt - this.repStart[fr.rep]) / 0.35);
    this.top.style.opacity = String(u); this.top.style.transform = `translateY(${(1 - u) * -30}px)`;
    const ms = this.mode.querySelector('span');
    if (fr.freeze) { ms.className = 'fz'; ms.textContent = '❚❚  FREEZE'; this.mode.style.opacity = '1'; }
    else if (fr.rate < 0.6) { ms.className = ''; ms.textContent = `SLOW-MO  ${fr.rate.toFixed(2).replace(/0$/, '')}×`; this.mode.style.opacity = '1'; }
    else this.mode.style.opacity = '0';
    if (fr.caption) {
      const box = this.cap.querySelector('.box'), html = this.fill(fr.caption); if (box.innerHTML !== html) box.innerHTML = html;
      this.cap.style.opacity = String(smooth(e / 0.18) * smooth(r / 0.14)); this.cap.style.transform = fr.freeze ? `scale(${1.06 - 0.06 * smooth(e / 0.25)})` : 'none';
    } else this.cap.style.opacity = '0';
    // the ball strip (on-ball reps): revealed to the playhead; the state now in the pill
    const R = this.R[fr.rep];
    if (R) {
      this.strip.style.opacity = '1'; this.race.style.opacity = '0';
      const x = clamp((st - R.a) / (R.b - R.a), 0, 1) * 960, mask = this.strip.querySelector('.mask');
      Object.assign(mask.style, { position: 'absolute', top: '0', bottom: '0', left: x + 'px', right: '0', background: 'rgba(28,30,38,0.93)', borderRadius: '0 4px 4px 0' });
      this.ph.style.left = x + 'px';
      this.mk.style.opacity = String(smooth((st - R.ts) / 0.05));
      const ex = st < R.ts ? rep.exposure(st) : null, pill = this.strip.querySelector('.pill');
      if (ex) { const [a, b] = STATE[ex.state] || STATE.hand; pill.textContent = a; pill.className = 'pill ' + ex.state; this.strip.querySelector('.sub').textContent = b; }
      else { pill.textContent = 'STOLEN'; pill.className = 'pill cross'; this.strip.querySelector('.sub').textContent = P.kind === 'trail' ? 'tipped forward from behind' : 'swiped up, on its way to his hand'; }
    } else this.strip.style.opacity = '0';
    if (P.pass) this.raceUpdate(fr, st, rep); else this.race.style.opacity = '0';
    this.drawRing(fr, st, cam, rep);
  }
  // ring on the ball: red (covered) / green (in reach), with a flash at the steal
  drawRing(fr, st, cam, rep) {
    let h = '';
    const P = rep.plan, b = rep.ball(st), B = b.pos, c = this.proj(B, cam);
    const end = P.strike ? rep.strike.t : (P.pass ? P.pass.tInt : 0);
    if (cam && c.ok && st <= end + 0.35) {
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), edge = this.proj(B.clone().addScaledVector(right, 0.12), cam);
      const rad = Math.max(16, Math.hypot(edge.x - c.x, edge.y - c.y)) + 14;
      if (st < end - 1e-3) {
        const ex = rep.exposure(st), on = ex.state === 'cross' || ex.state === 'open' || ex.state === 'pass', col = ex.state === 'pass' ? '#ffc23a' : (on ? '#2fe377' : '#ff3b4e');
        h += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="none" stroke="${col}" stroke-width="7" opacity="0.95" style="filter:drop-shadow(0 0 10px ${col})"/>`;
      } else {
        // the steal: a burst that grows and fades
        const k = Math.max(0, st - end) / 0.35, R2 = rad * (1 + 2.2 * Math.sqrt(k));
        h += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${R2.toFixed(1)}" fill="none" stroke="#2fe377" stroke-width="${(9 * (1 - k) + 2).toFixed(1)}" opacity="${(1 - k).toFixed(2)}"/>`;
      }
    }
    if (P.pass && cam && st <= P.pass.tInt + 0.3) {
      const L = rep.passLine, S = P.pass, fade = 1 - smooth((st - P.pass.tInt) / 0.3);
      const a = this.proj(L.from.clone().setY(0.02), cam), z = this.proj(L.to.clone().setY(0.02), cam);
      if (a.ok && z.ok) h += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${z.x.toFixed(1)}" y2="${z.y.toFixed(1)}" stroke="#ffc23a" stroke-width="9" stroke-dasharray="22 14" opacity="${(0.95 * fade).toFixed(2)}" style="filter:drop-shadow(0 0 6px rgba(0,0,0,0.8))"/>`;
      // your path: from where you sat at the windup to the catch
      const d0 = rep.holdAt('df', S.wind).setY(0.02), I = L.I.clone().setY(0.02), p0 = this.proj(d0, cam), p1 = this.proj(I, cam);
      if (p0.ok && p1.ok && st >= S.wind - 0.3) {
        const k = smooth((st - (S.wind - 0.3)) / 0.25) * fade, dx = p1.x - p0.x, dy = p1.y - p0.y, ln = Math.hypot(dx, dy) || 1, ux = dx / ln, uy = dy / ln;
        h += `<line x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${(p1.x - ux * 26).toFixed(1)}" y2="${(p1.y - uy * 26).toFixed(1)}" stroke="#2fe377" stroke-width="7" opacity="${k.toFixed(2)}"/>`;
        h += `<polygon points="${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${(p1.x - ux * 34 - uy * 18).toFixed(1)},${(p1.y - uy * 34 + ux * 18).toFixed(1)} ${(p1.x - ux * 34 + uy * 18).toFixed(1)},${(p1.y - uy * 34 - ux * 18).toFixed(1)}" fill="#2fe377" opacity="${k.toFixed(2)}"/>`;
      }
    }
    this.S.innerHTML = h;
  }
  // the race (passing rep, from the windup): you from your stance against the ball from his hands, on one clock
  raceUpdate(fr, st, rep) {
    const S = rep.plan.pass, a = S.wind - 0.05, b = S.tInt + 0.12, X = (t) => clamp((t - a) / (b - a), 0, 1) * 100;
    const on = smooth((st - (S.wind - 0.25)) / 0.2);
    this.race.style.opacity = String(on);
    if (on <= 0) return;
    if (!this.raceBuilt) {
      this.raceBuilt = true;
      this.race.innerHTML = `<div class="hd">FROM HIS WINDUP</div>
        <div class="ln you"><span class="who">YOU</span><span class="trk"><i class="fill" style="background:var(--green)"></i></span><span class="t"></span></div>
        <div class="ln ball"><span class="who">BALL</span><span class="trk"><i class="fill" style="background:var(--amber)"></i></span><span class="t"></span></div>`;
    }
    const you = this.race.querySelector('.you'), ball = this.race.querySelector('.ball');
    const yEnd = Math.min(st, S.tInt), bEnd = Math.min(st, S.tInt);
    Object.assign(you.querySelector('.fill').style, { left: X(S.wind) + '%', width: Math.max(0, X(yEnd) - X(S.wind)) + '%' });
    Object.assign(ball.querySelector('.fill').style, { left: X(S.rel) + '%', width: Math.max(0, X(bEnd) - X(S.rel)) + '%', opacity: st >= S.rel ? '1' : '0' });
    you.querySelector('.t').textContent = st > S.wind ? (Math.min(st, S.tInt) - S.wind).toFixed(2) + ' s' : '';
    ball.querySelector('.t').textContent = st > S.rel ? (Math.min(st, S.tInt) - S.rel).toFixed(2) + ' s' : (st > S.wind - 0.01 ? 'in his hands' : '');
  }
  cardUpdate(fr, e, S) {
    const k = fr.card;
    if (this.cardKind !== k) {
      this.cardKind = k;
      this.card.innerHTML = k === 'intro'
        ? `<div class="k">FILM ROOM</div><div class="h">GET YOUR<br>HANDS ON IT</div><div class="s">Steals against a good dribbler, and off the ball</div>
           <div class="stat"><div class="n g">64%</div><div class="l">of NBA steals come off passes, not<br>the dribble (12,154 of 18,950 in 2016-17)</div></div>
           <div class="list"><div>1 · On the ball</div><div>2 · He beat you</div><div>3 · Off the ball</div></div>
           <div class="key">Ring on the ball: <b class="r">red</b> = he has it covered · <b class="g">green</b> = in your reach</div>`
        : `<div class="big">Don't reach at<br>a covered ball.</div><div class="big sm">Take it when it crosses.<br>Beaten: from behind, ball side.<br>Off the ball: leave on the windup.</div>
           <div class="src">Steal types: Squared Statistics, "Analyzing steals in the 2016-17 NBA season" · Reaction time: Singh 2020<br>(Int J Physiol Nutr Phys Educ), 45 basketball players, visual 0.225 s · Motion: CMU Graphics Lab mocap</div>`;
    }
    const o = k === 'intro' ? 1 - smooth((e - (S.v1 - S.v0 - 0.35)) / 0.35) : smooth(e / 0.4);
    this.card.style.opacity = String(o);
    for (const x of [this.top, this.mode, this.cap, this.strip, this.race, this.svg]) x.style.opacity = '0';
  }
}
