// v3 HUD, 2K-style: bottom scorebug with a running clock, move callouts, shot meter, end banner.
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const CLOCK0 = 4.4; // game clock at sim 0 (buzzer while the ball is in the air)

export class Hud3 {
  constructor(root, plan, callouts) {
    this.root = root; this.plan = plan; this.callouts = callouts;
    root.innerHTML = '';
    this.vig = el('div', 'vig'); root.appendChild(this.vig);
    this.bug = el('div', 'bug3', `
      <div class="tm home"><span class="bar"></span><span class="ab">STORM</span><span class="sc">97</span></div>
      <div class="mid"><span class="q">4TH</span><span class="clk">0:04.4</span></div>
      <div class="tm away"><span class="sc">99</span><span class="ab">BLAZE</span><span class="bar"></span></div>
      <div class="shot">4</div>`);
    root.appendChild(this.bug);
    this.sc = this.bug.querySelector('.home .sc'); this.clk = this.bug.querySelector('.clk'); this.shot = this.bug.querySelector('.shot');
    this.calls = callouts.map(c => { const e = el('div', 'call', `<span>${c.text}</span>`); root.appendChild(e); return e; });
    this.meter = el('div', 'meter3', '<div class="fill"></div><div class="tick"></div>'); root.appendChild(this.meter);
    this.meterTxt = el('div', 'meterTxt', 'EXCELLENT'); root.appendChild(this.meterTxt);
    this.sep = el('div', 'sep3', ''); root.appendChild(this.sep);
    this.banner = el('div', 'banner3', '<div class="big">GAME WINNER</div><div class="sub">Tweener · cross · cross · step-back three</div>'); root.appendChild(this.banner);
  }
  update(fr, st, proj, anchors) {
    const P = this.plan;
    const clock = Math.max(0, CLOCK0 - st);
    this.clk.textContent = `0:${String(Math.floor(clock)).padStart(2, '0')}.${Math.floor((clock % 1) * 10)}`;
    this.shot.textContent = clock > 0 ? String(Math.ceil(clock)) : '';
    this.shot.style.opacity = clock > 0 ? '1' : '0';
    this.clk.classList.toggle('zero', clock <= 0);
    const made = st >= P.rim + 0.05;
    this.sc.textContent = made ? '100' : '97';
    this.bug.classList.toggle('scored', made);
    // move callouts near his head
    const head = proj(anchors.youHead.clone().add(new THREE.Vector3(0, 0.35, 0)));
    this.callouts.forEach((c, i) => {
      const e = this.calls[i], u = (st - c.t) / c.dur;
      const on = u >= 0 && u <= 1 && head.visible;
      e.style.opacity = on ? String(Math.min(smooth(u / 0.12), 1 - smooth((u - 0.75) / 0.25))) : '0';
      if (on) { e.style.left = (head.x + c.dx) + 'px'; e.style.top = (head.y - 30 - 26 * smooth(u / 0.3) + c.dy) + 'px'; e.style.transform = `translate(-50%,-50%) skewX(-10deg) scale(${1.15 - 0.15 * smooth(u / 0.15)})`; }
    });
    // shot meter: fills from the pickup to the release, green on the release
    const m0 = P.gatherAt + 0.12, m1 = P.release;
    const mu = clamp((st - m0) / (m1 - m0), 0, 1);
    const mOn = st > m0 - 0.05 && st < P.release + 0.55;
    const side = proj(anchors.youHead.clone().add(anchors.youRight.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0, -0.15, 0)));
    this.meter.style.opacity = mOn ? String(Math.min(smooth((st - m0 + 0.05) / 0.1), 1 - smooth((st - P.release - 0.35) / 0.2))) : '0';
    this.meter.style.left = side.x + 'px'; this.meter.style.top = side.y + 'px';
    this.meter.querySelector('.fill').style.height = (mu * 100) + '%';
    this.meter.classList.toggle('green', st >= P.release);
    const g = st >= P.release ? smooth((st - P.release) / 0.08) * (1 - smooth((st - P.release - 0.55) / 0.2)) : 0;
    this.meterTxt.style.opacity = String(g);
    this.meterTxt.style.left = side.x + 'px'; this.meterTxt.style.top = (side.y - 120) + 'px';
    // separation at the release
    const sOn = st > P.release - 0.1 && st < P.release + 0.9;
    this.sep.innerHTML = `<b>${anchors.separation.toFixed(1)} m</b> SEPARATION`;
    this.sep.style.opacity = sOn ? String(Math.min(smooth((st - P.release + 0.1) / 0.12), 1 - smooth((st - P.release - 0.7) / 0.2))) : '0';
    const d1 = proj(anchors.d1Head.clone().add(new THREE.Vector3(0, 0.45, 0)));
    this.sep.style.left = d1.x + 'px'; this.sep.style.top = d1.y + 'px';
    // end banner
    const b = smooth((st - (P.rim + 0.25)) / 0.3) + (fr.freeze === 'end' ? 1 : 0);
    this.banner.style.opacity = String(clamp(b, 0, 1));
    this.banner.style.transform = `translate(-50%,0) scale(${1.08 - 0.08 * clamp(b, 0, 1)})`;
    this.vig.style.opacity = fr.freeze === 'end' ? String(0.7 * smooth(fr.fu / 0.2)) : '0';
  }
}
