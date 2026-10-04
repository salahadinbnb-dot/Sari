// v9 HUD (portrait), from v8's - turned round: the defender is you, so his balance is the good news.: rep title, slow-mo / freeze pill, coaching captions, and the weight panel at the bottom - his
// state right now and a timing strip of his balance over the rep, revealed as it plays (red: he can contest, green:
// his weight is going the wrong way), with the moment you shot (or hit him) marked on it. Plus intro and outro cards.
import { clamp, smooth } from './motion.js';
import { REP_TITLES } from './timeline9.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const KIND = {
  closing: ['CLOSING OUT', 'Short steps, hand high'],
  chop: ['CHOP STEPS', 'Under control'],
  balanced: ['IN FRONT', 'Balanced: you can contest'],
  stay: ['FEET DOWN', 'Hand up - you didn\'t bite'],
  slide: ['SLIDING', 'Beat him to the spot'],
  mirror: ['MIRRORING', 'Chest in front, no reach'],
  contest: ['CONTEST', 'High hand, straight up'],
  help: ['IN THE GAP', 'Stop the ball'],
  recover: ['RECOVER', 'Short steps back out'],
  heels: ['ON YOUR HEELS', 'Weight going back'],
  lean: ['LEANING', 'Hips outside your feet'],
};
// good news for you (green), a warning (amber); anything else is red
const GOOD = new Set(['balanced', 'stay', 'slide', 'mirror', 'contest', 'help']), WARN = new Set(['closing', 'chop', 'recover']);
const RED = [255, 59, 78], GREEN = [47, 227, 119];
const mix = (u) => RED.map((r, i) => Math.round(r + (GREEN[i] - r) * u));

export class Hud9 {
  constructor(root, reps, frames, fps) {
    this.root = root; this.reps = reps; this.frames = frames; this.fps = fps;
    root.innerHTML = '';
    this.top = el('div', 'top', '<div class="kick">LOCKDOWN</div><div class="title"><span></span></div>'); root.appendChild(this.top);
    this.mode = el('div', 'mode', '<span></span>'); root.appendChild(this.mode);
    this.cap = el('div', 'cap', '<div class="box"></div>'); root.appendChild(this.cap);
    this.strip = el('div', 'strip', `<div class="row"><span class="state"><span class="lbl"></span><b class="pill"></b><span class="sub"></span></span><span class="legend"></span></div><div class="bar"><canvas width="960" height="34"></canvas><div class="mask"></div></div>`);
    root.appendChild(this.strip);
    this.hit = el('div', 'hit', '<div class="ring"></div><div class="ring r2"></div><span>CONTACT</span>'); root.appendChild(this.hit);
    this.card = el('div', 'card'); root.appendChild(this.card);
    // segment and rep spans in video time
    this.seg = {}; this.repStart = {};
    frames.forEach((f, i) => { const s = this.seg[f.seg] || (this.seg[f.seg] = { v0: f.vt, v1: f.vt }); s.v1 = f.vt + 1 / fps; if (!f.card && this.repStart[f.rep] === undefined) this.repStart[f.rep] = f.vt; });
    // per rep: strip range, colours, markers, and a debounced weight state for the panel
    this.R = {};
    for (const [name, rep] of Object.entries(reps)) {
      const P = rep.plan, a = Math.min(...frames.filter(f => f.rep === name && !f.card).map(f => f.st)), b = P.release + (P.contact ? 0.25 : 0.35);
      const cv = document.createElement('canvas'); cv.width = 960; cv.height = 34; const g = cv.getContext('2d');
      for (let x = 0; x < 960; x++) { const [r, gg, bb] = mix(1 - rep.balance(a + (x + 0.5) / 960 * (b - a)).open); g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(x, 0, 1, 34); }
      // closest-defender distance at the release, in feet, banded like NBA tracking (0-2 very tight, 2-4 tight,
      // 4-6 open, 6+ wide open)
      let sepLabel = '', band = null;
      if (!P.contact) {
        const a = rep.frame('you', P.release).p, d = rep.frame('d1', P.release).p, ft = a.distanceTo(d) / 0.3048;
        band = ft < 2 ? 'VERY TIGHT' : ft < 4 ? 'TIGHT' : ft < 6 ? 'OPEN' : 'WIDE OPEN';
        sepLabel = `CONTEST · ${ft.toFixed(1)} FT`;
        P.vals = { ...(P.vals || {}), sep: ft.toFixed(1) };
      }
      const marks = P.contact
        ? [{ t: P.contact.t, label: 'CONTACT' }, { t: P.release, label: 'LAYUP', minor: true }]
        : [{ t: P.release, label: sepLabel, band }];
      this.R[name] = { a, b, cv, marks, states: this.debounce(rep) };
    }
    this.marks = [];
  }
  // weight state with hysteresis so the panel doesn't flicker: opens above 0.6, closes below 0.4, holds at least 0.15 s
  debounce(rep) {
    const out = [], dt = 1 / 120; let st = null, since = -1;
    for (let t = 0; t <= rep.plan.simEnd + 1e-6; t += dt) {
      if (rep.plan.labels) { out.push(rep.balance(t).kind); continue; }
      const b = rep.balance(t), closedKind = rep.plan.contact ? 'set' : 'balanced';
      const openKind = rep.plan.read || (b.kind === closedKind ? (rep.plan.contact ? 'notset' : 'heels') : b.kind);
      if (!st) st = b.open > 0.5 ? openKind : closedKind;
      const isOpen = st !== closedKind;
      if (t - since > 0.15) {
        if (!isOpen && b.open > 0.6) { st = openKind; since = t; }
        else if (isOpen && b.open < 0.4) { st = closedKind; since = t; }
      }
      out.push(st);
    }
    return { dt, out };
  }
  stateAt(name, t) { const s = this.R[name].states; return s.out[clamp(Math.round(t / s.dt), 0, s.out.length - 1)]; }
  setRep(name) {
    if (this.cur === name) return; this.cur = name;
    const R = this.R[name], rep = this.reps[name], P = rep.plan;
    this.top.querySelector('.title span').textContent = REP_TITLES[name];
    const c = this.strip.querySelector('canvas'); c.getContext('2d').drawImage(R.cv, 0, 0);
    this.strip.querySelector('.lbl').textContent = 'YOU';
    this.strip.querySelector('.legend').innerHTML = '<span><i style="background:var(--green)"></i>IN FRONT</span><span><i style="background:var(--red)"></i>BEAT</span>';
    for (const m of this.marks) m.e.remove();
    const bar = this.strip.querySelector('.bar');
    this.marks = R.marks.map(m => {
      const e = el('div', 'mk' + (m.minor ? ' minor' : ''), `<span>${m.label}</span>`), x = (m.t - R.a) / (R.b - R.a) * 960;
      e.style.left = x + 'px';
      const open = rep.balance(m.t).open;
      const good = m.band ? (m.band === 'VERY TIGHT' || m.band === 'TIGHT') : open < 0.5;
      if (!m.minor) { const s = e.querySelector('span'); s.style.background = good ? 'var(--green)' : 'var(--red)'; s.style.color = good ? '#04150a' : '#fff'; if (m.band) e.classList.add('right'); }
      bar.appendChild(e); return { ...m, e };
    });
    if (!this.ph) { this.ph = el('div', 'ph'); bar.appendChild(this.ph); }
  }
  // fr: frame from the time map, st: sim time, hitAt: screen position of the contact point ({x, y, visible}) or null
  update(fr, st, hitAt = null) {
    const rep = this.reps[fr.rep], P = rep.plan, R = this.R[fr.rep];
    const S = this.seg[fr.seg], e = fr.vt - S.v0, r = S.v1 - fr.vt;
    this.setRep(fr.rep);
    // cards
    if (fr.card) {
      const k = fr.card;
      if (this.cardKind !== k) {
        this.cardKind = k;
        this.card.innerHTML = k === 'intro'
          ? `<div class="k">FILM ROOM</div><div class="h">LOCK<br>DOWN</div><div class="s">A good ball handler, and a good team</div>
             <div class="stat"><div class="n">0.22 s</div><div class="l">to react to anything he does -<br>so don't guess, and don't bite</div></div>
             <div class="list"><div>1 · Stay down</div><div>2 · Mirror the cross</div><div>3 · Help and recover</div></div>
             <div class="key">Ring on the floor = your feet · Arrow = where your weight is going<br><b class="g">Green</b>: in front, you can contest · <b class="r">Red</b>: beat</div>`
          : `<div class="big">Make him<br><em>see you</em><br>on every move.</div><div class="big" style="margin-top:56px">Hand up,<br><em>feet down.</em></div>
             <div class="src">Reaction time: Singh 2020, Int J Physiol Nutr Phys Educ 5(1):174-176 (45 basketball players, visual 225 ms)<br>Motion: CMU Graphics Lab Motion Capture Database</div>`;
      }
      const o = k === 'intro' ? 1 - smooth((e - (S.v1 - S.v0 - 0.35)) / 0.35) : smooth(e / 0.4);
      this.card.style.opacity = String(o);
      for (const x of [this.top, this.mode, this.cap, this.strip, this.hit]) x.style.opacity = '0';
      if (k === 'intro') { for (const x of [this.top, this.strip]) x.style.opacity = String(1 - o); }
      return;
    }
    this.card.style.opacity = '0';
    // title: slides in at the start of each rep
    const u = smooth((fr.vt - this.repStart[fr.rep]) / 0.35);
    this.top.style.opacity = String(u); this.top.style.transform = `translateY(${(1 - u) * -30}px)`;
    // slow-mo / freeze pill
    const ms = this.mode.querySelector('span');
    if (fr.freeze) { ms.className = 'fz'; ms.textContent = '❚❚  FREEZE'; this.mode.style.opacity = '1'; }
    else if (fr.rate < 0.6) { ms.className = ''; ms.textContent = `SLOW-MO  ${fr.rate.toFixed(2).replace(/0$/, '')}×`; this.mode.style.opacity = '1'; }
    else this.mode.style.opacity = '0';
    // his state right now, in the panel over the strip (held through the rim shots)
    const kind = this.stateAt(fr.rep, Math.min(st, P.contact ? P.contact.t : P.release)), [txt, sub] = KIND[kind];
    const warn = WARN.has(kind), good = GOOD.has(kind);
    const pill = this.strip.querySelector('.pill'); pill.textContent = txt; pill.classList.toggle('open', good); pill.classList.toggle('warn', warn);
    this.strip.querySelector('.sub').textContent = sub;
    // contact burst: two rings punching out from where his shoulder meets the defender's chest
    const hu = P.contact && hitAt && hitAt.visible && !fr.freeze ? (st - P.contact.t) / 0.4 : -1;
    if (hu >= 0 && hu <= 1) {
      Object.assign(this.hit.style, { left: hitAt.x + 'px', top: hitAt.y + 'px', opacity: String(1 - smooth((hu - 0.55) / 0.45)) });
      this.hit.querySelector('.ring').style.transform = `translate(-50%,-50%) scale(${0.35 + 1.1 * Math.sqrt(hu)})`;
      this.hit.querySelector('.r2').style.transform = `translate(-50%,-50%) scale(${0.2 + 0.8 * Math.sqrt(Math.max(0, hu - 0.12))})`;
      this.hit.querySelector('span').style.transform = `translate(-50%,0) scale(${1.25 - 0.25 * smooth(hu / 0.2)})`;
    } else this.hit.style.opacity = '0';
    // caption
    if (fr.caption) {
      const text = fr.caption.replace(/\{(\w+)\.(\w+)\}/g, (m, r, k) => (this.reps[r] && this.reps[r].plan.vals && this.reps[r].plan.vals[k]) ?? m);
      const box = this.cap.querySelector('.box'); if (box.innerHTML !== text) box.innerHTML = text;
      // live captions get out of the way of the ball going up
      const o = smooth(e / 0.18) * smooth(r / 0.14) * (fr.freeze ? 1 : 1 - smooth((st - (P.release - 0.14)) / 0.1));
      this.cap.style.opacity = String(o); this.cap.style.transform = fr.freeze ? `scale(${1.06 - 0.06 * smooth(e / 0.25)})` : 'none';
    } else this.cap.style.opacity = '0';
    // timing strip: revealed up to the playhead
    this.strip.style.opacity = '1';
    const x = clamp((st - R.a) / (R.b - R.a), 0, 1) * 960;
    const mask = this.strip.querySelector('.mask');
    Object.assign(mask.style, { position: 'absolute', top: '0', bottom: '0', left: x + 'px', right: '0', background: 'rgba(28,30,38,0.93)', borderRadius: '0 4px 4px 0' });
    this.ph.style.left = x + 'px'; this.ph.style.opacity = st > R.b + 0.05 ? '0.35' : '1';
    for (const m of this.marks) { const on = smooth((st - m.t) / 0.06); m.e.style.opacity = String(on); }
  }
}
