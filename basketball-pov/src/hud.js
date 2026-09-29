// DOM HUD: scorebug, step tracker, captions, freeze verdicts, player tags, title/end cards.
import * as THREE from 'three';
import * as S1 from './script.js';
import { clamp, smooth } from './motion.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const fmtClock = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60); const r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; };

// cfg lets the 1v1 (v2) script reuse this HUD; defaults are the original ball-screen script.
const V1 = {
  STEPS: S1.STEPS, CAPTIONS: S1.CAPTIONS, VERDICTS: S1.VERDICTS, TAGS: S1.TAGS,
  FREEZE_STEP: { notbeaten: 2, opening: 4, help: 5, setup: 0 },
  TITLE: `<div class="kick">ONE POSSESSION</div><div class="big">YOU vs. THE<br>SQUARE DEFENDER</div><div class="sub">Behind-the-player POV · read it like the pros</div>`,
  END: `<div class="big">YOUR DRIVE IS A <span>TEST</span>,<br>NOT A COMMITMENT.</div><div class="sub">Square defender? &nbsp;Test → Checkpoint → Screen → Read the help.</div>`,
  SCORE_AT: 11.62, END_AT: 11.95, SHOT_RESET_AT: 11.6, LABELS: ['space', 'arm', 'check', 'set', 'gap', 'ghost'],
};

export class Hud {
  constructor(root, cfg = V1) {
    this.cfg = cfg = { ...V1, ...cfg };
    const { STEPS, TAGS } = cfg;
    this.root = root;
    root.innerHTML = '';
    // vignette for freezes
    this.vig = el('div', 'vig'); root.appendChild(this.vig);
    // scorebug
    this.bug = el('div', 'bug', `
      <div class="tm home"><span class="bar"></span><span class="ab">STORM</span><span class="sc" id="scH">98</span></div>
      <div class="tm away"><span class="bar"></span><span class="ab">BLAZE</span><span class="sc" id="scA">99</span></div>
      <div class="clk"><span class="q">4TH</span><span id="gclk">0:31.0</span></div>
      <div class="shot"><span id="sclk">19</span></div>`);
    root.appendChild(this.bug);
    // steps tracker
    this.steps = el('div', 'steps', STEPS.map((s, i) => `<div class="st" data-i="${i + 1}"><span class="n">${i + 1}</span><span class="t">${s}</span></div>`).join(''));
    root.appendChild(this.steps);
    // caption panel
    this.cap = el('div', 'cap', `<div class="row"><div class="badge"><span></span></div><div class="title"></div></div><div class="text"></div>`);
    root.appendChild(this.cap);
    // verdict
    this.ver = el('div', 'ver', `<div class="freeze"><i></i><i></i> FREEZE</div><div class="word"></div><div class="l1"></div><div class="l2"></div>`);
    root.appendChild(this.ver);
    // tags container
    this.tagsEl = el('div', 'tags'); root.appendChild(this.tagsEl);
    this.tagEls = TAGS.map(() => { const t = el('div', 'tag', '<span></span>'); this.tagsEl.appendChild(t); return t; });
    this.svg = document.getElementById('tele');
    this.lines = TAGS.map(() => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = '<line stroke-width="3" /><circle r="6" /><circle r="11" fill="none" stroke-width="2" />';
      this.svg.appendChild(g); return g;
    });
    // floor labels
    this.labels = {};
    for (const k of cfg.LABELS) { const l = el('div', 'flabel ' + k); this.tagsEl.appendChild(l); this.labels[k] = l; }
    // title + end card
    this.title = el('div', 'titlecard', cfg.TITLE);
    root.appendChild(this.title);
    this.end = el('div', 'endcard', cfg.END);
    root.appendChild(this.end);
    this.scH = this.bug.querySelector('#scH'); this.gclk = this.bug.querySelector('#gclk'); this.sclk = this.bug.querySelector('#sclk');
  }

  update(fr, st, W, camera, projFn, headPos) {
    const { CAPTIONS, VERDICTS, TAGS, FREEZE_STEP, SCORE_AT, END_AT } = this.cfg;
    const SHOT_RESET_AT = this.cfg.SHOT_RESET_AT ?? SCORE_AT;
    const freeze = fr.freeze || null;
    const fu = fr.fu || 0;
    // clocks run with sim time only
    this.gclk.textContent = fmtClock(31.0 - st) + '.' + Math.floor(((31.0 - st) % 1) * 10);
    const shot = Math.max(0, Math.ceil(21 - st));
    this.sclk.textContent = st > SHOT_RESET_AT ? '24' : String(shot);
    this.scH.textContent = st > SCORE_AT ? '100' : '98';
    this.bug.classList.toggle('scored', st > SCORE_AT && st < SCORE_AT + 1.0);
    // intro/title
    const introOn = freeze === 'intro';
    this.title.style.opacity = introOn ? String(clamp(fu * 5, 0, 1) * clamp((1 - fu) * 4, 0, 1)) : '0';
    this.title.style.transform = `translateX(${introOn ? (1 - smooth(fu * 3)) * -60 : -60}px) skewX(-8deg)`;
    // end card
    const endU = clamp((st - END_AT) / 0.5, 0, 1);
    this.end.style.opacity = String(endU);
    this.end.style.transform = `translateY(${(1 - endU) * 30}px)`;
    // steps
    const cap = CAPTIONS.find(c => st >= c.from && st < c.to) || null;
    const stepNow = freeze && FREEZE_STEP[freeze] !== undefined ? FREEZE_STEP[freeze] : (cap ? cap.step : (st >= END_AT ? 6 : 0));
    this.steps.style.opacity = introOn || endU > 0.5 ? '0' : '1';
    this.steps.querySelectorAll('.st').forEach(e => { const i = +e.dataset.i; e.classList.toggle('on', i === stepNow); e.classList.toggle('done', i < stepNow); });
    // caption
    const showCap = !introOn && cap && endU === 0 && !((freeze === 'notbeaten' || freeze === 'closeout') && fu > 0.1);
    this.cap.style.opacity = showCap ? '1' : '0';
    if (cap) {
      const since = st - cap.from;
      this.cap.querySelector('.badge span').textContent = cap.step ? `STEP ${cap.step}` : 'SETUP';
      this.cap.querySelector('.title').textContent = cap.title;
      this.cap.querySelector('.text').innerHTML = cap.text;
      this.cap.querySelector('.text').style.opacity = String(clamp(since / 0.25, 0, 1));
      this.cap.style.transform = `translateY(${showCap ? (1 - smooth(since / 0.2)) * 12 : 12}px)`;
    }
    // verdict
    const V = freeze && VERDICTS[freeze];
    this.ver.className = 'ver ' + (V ? V.color + ' at-' + freeze : '');
    if (V) {
      const inU = smooth(fu / 0.12), outU = 1 - smooth((fu - 0.9) / 0.1);
      this.ver.style.opacity = String(inU * outU);
      this.ver.querySelector('.word').textContent = V.word;
      this.ver.querySelector('.word').style.transform = `skewX(-9deg) scale(${1.25 - 0.25 * smooth(fu / 0.1)})`;
      this.ver.querySelector('.l1').innerHTML = V.line1;
      this.ver.querySelector('.l2').innerHTML = V.line2;
      this.ver.querySelector('.l1').style.opacity = String(smooth((fu - 0.1) / 0.1));
      this.ver.querySelector('.l2').style.opacity = String(smooth((fu - 0.38) / 0.1));
    } else this.ver.style.opacity = '0';
    this.vig.style.opacity = endU > 0 ? String(endU * 0.85) : freeze && freeze !== 'intro' ? String((freeze === 'setup' ? 0.45 : 1) * Math.min(smooth(fu / 0.08), 1 - smooth((fu - 0.92) / 0.08))) : '0';
    // player tags
    const COL = { red: '#ff3347', amber: '#ffb21e', blue: '#2f6bff', green: '#23d56b' };
    TAGS.forEach(([n, text, color, a, b, dx, dy], i) => {
      const e = this.tagEls[i], g = this.lines[i];
      const on = st >= a && st < b && !introOn && endU === 0 && !(freeze && VERDICTS[freeze]);
      if (!on) { e.style.opacity = '0'; g.style.opacity = '0'; return; }
      const hp = headPos(n);
      const p = projFn(new THREE.Vector3(hp.x, hp.y + 0.14, hp.z));
      e.className = 'tag ' + color;
      e.querySelector('span').textContent = text;
      const k = Math.min(clamp((st - a) / 0.25, 0, 1), clamp((b - st) / 0.2, 0, 1));
      const op = p.visible ? k : 0;
      const lx = p.x + dx, ly = p.y + dy;
      e.style.opacity = String(op); e.style.left = lx + 'px'; e.style.top = ly + 'px';
      g.style.opacity = String(op);
      const [ln, c1, c2] = g.children;
      ln.setAttribute('x1', lx); ln.setAttribute('y1', ly); ln.setAttribute('x2', p.x); ln.setAttribute('y2', p.y);
      ln.setAttribute('stroke', COL[color]);
      c1.setAttribute('cx', p.x); c1.setAttribute('cy', p.y); c1.setAttribute('fill', COL[color]);
      c2.setAttribute('cx', p.x); c2.setAttribute('cy', p.y); c2.setAttribute('stroke', COL[color]);
    });
    return stepNow;
  }

  // floor labels positioned by projected world points
  floorLabel(key, text, world, projFn, opacity) {
    const e = this.labels[key];
    if (!world || opacity <= 0) { e.style.opacity = '0'; return; }
    const p = projFn(world);
    e.textContent = text; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.style.opacity = p.visible ? String(opacity) : '0';
  }
}
