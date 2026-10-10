// v11 HUD (portrait): rep title, a view pill (REAL LIFE / BEHIND THE CURTAIN) with the slow-mo / freeze pill,
// coaching captions, and - behind the curtain only - the strip of what he's running: the move's parts as cards, one
// card per call at rep 1, fused into chunks as it wires (two at rep 3, one at rep 6), and live, a piece from
// somewhere else (the shot fake) slotted in. Cards light as he gets to them; a fused chunk lights all at once.
// Plus the intro, the night between rep 3 and rep 6, and the outro.
import { clamp, smooth } from './motion.js';
import { REP_TITLES } from './timeline11.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const NAMES = { legs: 'BETWEEN', cross: 'CROSS', back: 'BACK', hop0: 'HOP BACK', off: 'RISE', fake: 'SHOT FAKE' };
// per rep: groups of parts (one call each), each with its label
const CHUNKS = {
  rep1: [[null, ['legs']], [null, ['cross']], [null, ['back']], [null, ['hop0']], [null, ['off']]],
  rep3: [['SET-UP', ['legs', 'cross', 'back']], ['STEP-BACK', ['hop0', 'off']]],
  rep6: [['THE WHOLE MOVE', ['legs', 'cross', 'back', 'hop0', 'off']]],
  live: [['STEP-BACK', ['legs', 'cross', 'back', 'hop0']], ['OLD PIECE', ['fake'], 'new'], ['', ['off']]],
};
export const INTRO = `<div class="k">FILM ROOM</div><div class="h">BEHIND<br>THE CURTAIN</div>
  <div class="s">A sharp player learns a new move in six reps,<br>then makes it his.</div>
  <div class="two"><div><b class="w">REAL LIFE</b>What you'd see in the gym.</div><div><b class="c">BEHIND THE CURTAIN</b>What he's running, where his eyes are,<br>what he reads.</div></div>
  <div class="list"><div>1 · Thinking it</div><div>2 · Wiring it</div><div>3 · Owning it</div><div>4 · Making it his</div></div>`;

export class Hud11 {
  constructor(root, reps, frames, fps, cards) {
    this.root = root; this.reps = reps; this.frames = frames; this.fps = fps; this.cards = cards;
    root.innerHTML = '';
    this.top = el('div', 'top', '<div class="kick">BEHIND THE CURTAIN</div><div class="title"><span></span></div>'); root.appendChild(this.top);
    this.mode = el('div', 'mode', '<span class="view"></span><span class="sm"></span>'); root.appendChild(this.mode);
    this.cap = el('div', 'cap', '<div class="box"></div>'); root.appendChild(this.cap);
    this.strip = el('div', 'chunks', '<div class="row"><span class="lbl">WHAT HE\'S RUNNING</span><span class="calls"></span></div><div class="cards"></div>'); root.appendChild(this.strip);
    this.card = el('div', 'card'); root.appendChild(this.card);
    this.seg = {}; this.repStart = {};
    frames.forEach((f) => { const s = this.seg[f.seg] || (this.seg[f.seg] = { v0: f.vt, v1: f.vt }); s.v1 = f.vt + 1 / fps; if (!f.card && this.repStart[f.rep] === undefined) this.repStart[f.rep] = f.vt; });
  }
  setRep(name) {
    if (this.cur === name) return; this.cur = name;
    this.top.querySelector('.title span').textContent = REP_TITLES[name];
    const P = this.reps[name].plan, box = this.strip.querySelector('.cards'); box.innerHTML = '';
    const groups = CHUNKS[name];
    this.strip.querySelector('.calls').textContent = name === 'live' ? '2 CALLS AND A READ' : `${groups.length} CALL${groups.length > 1 ? 'S' : ''}`;
    this.groups = groups.map(([label, parts, kind]) => {
      const g = el('div', 'grp' + (parts.length > 1 ? ' fused' : '') + (kind ? ' ' + kind : ''), (label !== null ? `<div class="gl">${label}</div>` : '') + '<div class="parts"></div>');
      g.style.flex = String(parts.length);
      const pe = g.querySelector('.parts');
      for (const p of parts) pe.appendChild(el('div', 'part', NAMES[p]));
      box.appendChild(g);
      // a group is one call: it fires a beat before its first part
      return { e: g, t: P.parts[parts[0]] - 0.12 };
    });
  }
  update(fr, st) {
    const rep = this.reps[fr.rep], P = rep.plan;
    const S = this.seg[fr.seg], e = fr.vt - S.v0, r = S.v1 - fr.vt;
    this.setRep(fr.rep);
    if (fr.card) {
      const k = fr.card;
      if (this.cardKind !== k) { this.cardKind = k; this.card.innerHTML = this.cards[k]; this.card.className = 'card ' + k; }
      const o = k === 'intro' ? 1 - smooth((e - (S.v1 - S.v0 - 0.35)) / 0.35) : k === 'night' ? smooth(e / 0.35) * (1 - smooth((e - (S.v1 - S.v0 - 0.35)) / 0.35)) : smooth(e / 0.4);
      this.card.style.opacity = String(o);
      for (const x of [this.top, this.mode, this.cap, this.strip]) x.style.opacity = '0';
      if (k === 'intro') this.top.style.opacity = String(1 - o);
      return;
    }
    this.card.style.opacity = '0';
    const u = smooth((fr.vt - this.repStart[fr.rep]) / 0.35);
    this.top.style.opacity = String(u); this.top.style.transform = `translateY(${(1 - u) * -30}px)`;
    // the view: real life until the curtain is half open, then behind it
    const behind = fr.behind || (fr.curtain !== null && fr.curtain > 0.45);
    const view = this.mode.querySelector('.view');
    view.className = 'view ' + (behind ? 'bh' : 'rl'); view.textContent = behind ? 'BEHIND THE CURTAIN' : 'REAL LIFE';
    const sm = this.mode.querySelector('.sm');
    if (fr.freeze && fr.curtain === null && behind) { sm.className = 'sm fz'; sm.textContent = '❚❚  FREEZE'; sm.style.display = ''; }
    else if (!fr.freeze && fr.rate < 0.9) { sm.className = 'sm'; sm.textContent = `SLOW-MO  ${fr.rate.toFixed(2).replace(/0$/, '')}×`; sm.style.display = ''; }
    else sm.style.display = 'none';
    this.mode.style.opacity = '1';
    // caption
    if (fr.caption) {
      const text = fr.caption.replace(/\{(\w+)\.(\w+)\}/g, (m, r, k) => (this.reps[r] && this.reps[r].plan.vals && this.reps[r].plan.vals[k]) ?? m);
      const box = this.cap.querySelector('.box'); if (box.innerHTML !== text) box.innerHTML = text;
      this.cap.classList.toggle('bh', behind);
      const o = smooth(e / 0.18) * smooth(r / 0.14) * (fr.freeze ? 1 : 1 - smooth((st - (P.release - 0.3)) / 0.12));
      this.cap.style.opacity = String(o); this.cap.style.transform = fr.freeze ? `scale(${1.06 - 0.06 * smooth(e / 0.25)})` : 'none';
    } else this.cap.style.opacity = '0';
    // what he's running: behind the curtain only, coming in as it opens
    const so = fr.curtain !== null ? smooth((fr.curtain - 0.55) / 0.4) : (behind ? 1 : 0);
    this.strip.style.opacity = String(so);
    if (so > 0) for (const g of this.groups) {
      const on = fr.curtain !== null ? 0 : smooth((st - g.t) / 0.05);
      g.e.classList.toggle('on', on > 0.5);
      // the call that just fired glows hardest
      g.e.style.setProperty('--hot', String(on * (1 - smooth((st - g.t - 0.25) / 0.35))));
    }
  }
}
