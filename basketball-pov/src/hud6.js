// v6 HUD (portrait): rep title, slow-mo / freeze / replay pill, coaching captions, the numbers panel (approach speed,
// how far the hips drop, the plant angle, hang time and the vertical it means), a reach gauge against the 10-ft rim,
// overlays drawn on the picture (step speeds on the floor, the hip-drop bracket, the plant angle), and the cards.
// Captions can quote the measured numbers: {touch.drop}, {dunk.vert}, ...
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';
import { REP_TITLES } from './timeline6.js';
import { RIM } from './rep6.js';

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const IN = 39.3701, MPH = 2.23694;
const ftin = (m) => { const i = Math.round(m * IN); return `${Math.floor(i / 12)}'${i % 12}"`; };
const G0 = 2.44, G1 = 3.66, GT = 330, GB = 1290; // gauge: 8'0" .. 12'0" from y=GB up to y=GT

export class Hud6 {
  constructor(root, reps, frames, fps) {
    this.root = root; this.reps = reps; this.frames = frames; this.fps = fps; this.flash = 0;
    root.innerHTML = '';
    this.svg = el('div', 'ov', '<svg width="1080" height="1920" viewBox="0 0 1080 1920"></svg>'); root.appendChild(this.svg); this.S = this.svg.firstChild;
    this.top = el('div', 'top', '<div class="kick">GET UP</div><div class="title"><span></span></div>'); root.appendChild(this.top);
    this.mode = el('div', 'mode', '<span></span>'); root.appendChild(this.mode);
    this.cap = el('div', 'cap', '<div class="box"></div>'); root.appendChild(this.cap);
    this.gauge = el('div', 'gauge'); root.appendChild(this.gauge); this.buildGauge();
    this.nums = el('div', 'nums', ['speed', 'hips', 'plant', 'jump'].map(k => `<div class="tile ${k}"><div class="l"></div><div class="v"></div><div class="s"></div></div>`).join('')); root.appendChild(this.nums);
    this.card = el('div', 'card'); root.appendChild(this.card);
    this.seg = {}; this.repStart = {};
    frames.forEach((f) => { const s = this.seg[f.seg] || (this.seg[f.seg] = { v0: f.vt, v1: f.vt }); s.v1 = f.vt + 1 / fps; if (!f.card && this.repStart[f.rep] === undefined) this.repStart[f.rep] = f.vt; });
    // the numbers each rep can quote
    this.vals = {};
    for (const [name, rep] of Object.entries(reps)) {
      const M = rep.M;
      this.vals[name] = { top: M.vmax.toFixed(1), topmph: (M.vmax * MPH).toFixed(1), plantv: M.vPlant.toFixed(1), drop: (M.drop * IN).toFixed(1), angle: Math.round(M.angle), vert: Math.round(M.vert * IN), hang: M.hang.toFixed(2),
        clear: rep.plan.kind === 'dunk' ? Math.round((rep.ballAt(rep.d.cock).y - 0.12 - RIM.y) * IN) : 0,
        hand: rep.plan.kind === 'dunk' ? Math.round((rep.ballAt(rep.d.cock).y + 0.12 - RIM.y) * IN) : 0 };
    }
  }
  fill(s) { return s.replace(/\{(\w+)\.(\w+)\}/g, (_, r, k) => this.vals[r][k]); }
  buildGauge() {
    const y = (m) => GB - (m - G0) / (G1 - G0) * (GB - GT);
    let h = '<div class="rail"></div>';
    for (let i = 0; i <= 48; i += 3) { const m = G0 + i * 0.0254, big = i % 12 === 0; h += `<div class="tick${big ? ' big' : ''}" style="top:${y(m)}px"></div>`; if (big) h += `<div class="ft" style="top:${y(m)}px">${8 + i / 12}'</div>`; }
    h += `<div class="rimline" style="top:${y(3.048)}px"><span>RIM 10'</span></div><div class="mark"><span></span></div><div class="glow"></div>`;
    this.gauge.innerHTML = h; this.gy = y;
  }
  setRep(name) {
    if (this.cur === name) return; this.cur = name;
    this.top.querySelector('.title span').textContent = REP_TITLES[name];
    this.best = 0;
  }
  proj(p, cam) { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * 1080, y: (1 - v.y) / 2 * 1920, ok: v.z < 1 && v.z > -1 }; }
  // fr: frame from the time map, st: sim time, cam: the camera the picture was drawn with, reach: highest point now
  update(fr, st, cam, reach = 0) {
    const rep = this.reps[fr.rep], k = rep.k, M = rep.M, S = this.seg[fr.seg], e = fr.vt - S.v0, r = S.v1 - fr.vt;
    this.setRep(fr.rep);
    this.flash = rep.plan.kind === 'dunk' && !fr.freeze && fr.cam !== 'side' ? (fr.replay ? 0.18 : 0.4) * Math.exp(-Math.max(0, st - rep.d.rel) / 0.05) * (st >= rep.d.rel ? 1 : 0) : 0;
    if (fr.card) return this.cardUpdate(fr, e, S);
    this.card.style.opacity = '0'; this.svg.style.opacity = '1';
    const u = smooth((fr.vt - this.repStart[fr.rep]) / 0.35);
    this.top.style.opacity = String(u); this.top.style.transform = `translateY(${(1 - u) * -30}px)`;
    const ms = this.mode.querySelector('span');
    if (fr.freeze) { ms.className = 'fz'; ms.textContent = '❚❚  FREEZE'; this.mode.style.opacity = '1'; }
    else if (fr.replay) { ms.className = 'rp'; ms.textContent = `REPLAY  ${fr.rate.toFixed(2).replace(/0$/, '')}×`; this.mode.style.opacity = '1'; }
    else if (fr.rate < 0.6) { ms.className = ''; ms.textContent = `SLOW-MO  ${fr.rate.toFixed(2).replace(/0$/, '')}×`; this.mode.style.opacity = '1'; }
    else this.mode.style.opacity = '0';
    // caption
    if (fr.caption) {
      const box = this.cap.querySelector('.box'), html = this.fill(fr.caption); if (box.innerHTML !== html) box.innerHTML = html;
      this.cap.style.opacity = String(smooth(e / 0.18) * smooth(r / 0.14)); this.cap.style.transform = fr.freeze ? `scale(${1.06 - 0.06 * smooth(e / 0.25)})` : 'none';
    } else this.cap.style.opacity = '0';
    // numbers
    const T = (cls) => this.nums.querySelector('.' + cls);
    const set = (cls, l, v, s, on) => { const t = T(cls); t.querySelector('.l').textContent = l; t.querySelector('.v').innerHTML = v; t.querySelector('.s').textContent = s; t.style.opacity = String(on); t.classList.toggle('hot', on > 0.99 && fr.freeze); };
    const iS = clamp(Math.round(st * 240), 0, rep.speed.length - 1), live = rep.speed[iS];
    if (st < M.tPlant0) set('speed', 'SPEED', `${live.toFixed(1)}<small>m/s</small>`, `${(live * MPH).toFixed(1)} mph`, 1);
    else set('speed', 'INTO THE PLANT', `${M.vPlant.toFixed(1)}<small>m/s</small>`, `top ${M.vmax.toFixed(1)} m/s · ${(M.vmax * MPH).toFixed(1)} mph`, 1);
    set('hips', 'HIPS DROP', `${(M.drop * IN).toFixed(1)}<small>in</small>`, 'big step + plant', smooth((st - M.tLow) / 0.08));
    set('plant', 'PLANT ANGLE', `${Math.round(M.angle)}°`, 'hips to heel', smooth((st - M.tPlant0) / 0.08));
    const air = clamp(st - k.off, 0, k.land - k.off), inAir = st > k.off && st < k.land;
    if (st < k.land) set('jump', 'HANG TIME', `${air.toFixed(2)}<small>s</small>`, inAir ? 'in the air' : '', smooth((st - k.off) / 0.05));
    else set('jump', 'VERTICAL', `${Math.round(M.vert * IN)}<small>in</small>`, `hang ${M.hang.toFixed(2)} s · h = g·t²/8`, 1);
    this.nums.style.opacity = '1';
    // reach gauge: from just before takeoff to after landing
    const ga = smooth((st - (k.off - 0.05)) / 0.15) * (1 - smooth((st - (k.land + 0.4)) / 0.3));
    this.gauge.style.opacity = String(ga);
    this.best = rep.reachAt(st);
    const mk = this.gauge.querySelector('.mark'), yy = this.gy(clamp(this.best, G0, G1));
    mk.style.opacity = String(smooth((this.best - (G0 - 0.05)) / 0.08));
    mk.style.top = yy + 'px'; mk.querySelector('span').textContent = (rep.plan.kind === 'dunk' ? 'BALL ' : 'REACH ') + ftin(this.best);
    mk.classList.toggle('over', this.best > 3.048);
    const gl = this.gauge.querySelector('.glow'); gl.style.top = yy + 'px'; gl.style.height = Math.max(0, GB - yy) + 'px';
    // overlays on the picture
    this.drawOverlays(fr, st, cam);
  }
  drawOverlays(fr, st, cam) {
    const rep = this.reps[fr.rep], k = rep.k, M = rep.M, show = fr.show || ''; let h = '';
    if (cam && fr.cam === 'side') {
      // step speeds under the footprints
      const fade = 1 - smooth((st - (k.off + 0.15)) / 0.3);
      for (const f of rep.footfalls) {
        if (f.t > k.off || st < f.t || fade <= 0) continue;
        const p = this.proj(f.p, cam); if (!p.ok) continue;
        const a = smooth((st - f.t) / 0.08) * fade, cls = f.plant ? 'plant' : f.big ? 'big' : '';
        const txt = f.plant ? 'PLANT' : f.big ? 'BIG STEP' : `${f.speed.toFixed(1)} m/s`;
        h += `<g opacity="${a.toFixed(3)}" class="${cls}"><text x="${p.x.toFixed(1)}" y="${(p.y + (f.plant ? 104 : 52)).toFixed(1)}" class="stp">${txt}</text></g>`;
      }
      // the hip drop: his running hip height vs now, on his hip (from the big step until takeoff)
      const hd = show.includes('hips') ? smooth((st - (M.tPlant0 - 0.02)) / 0.06) * (1 - smooth((st - (k.off - 0.02)) / 0.1)) : 0;
      if (hd > 0.01) {
        const hip = rep.tab('hip', Math.min(st, M.tLow)), f = rep.frame(st).f, run = hip.clone(); run.y = M.run;
        const a0 = this.proj(run.clone().addScaledVector(f, -0.35), cam), a1 = this.proj(run.clone().addScaledVector(f, 0.35), cam);
        const b = this.proj(hip, cam), b0 = this.proj(hip.clone().addScaledVector(f, -0.25), cam), b1 = this.proj(hip.clone().addScaledVector(f, 0.25), cam);
        const dropNow = Math.max(0, M.run - rep.tab('hip', Math.min(st, M.tLow)).y) * IN;
        h += `<g opacity="${hd.toFixed(3)}"><line x1="${a0.x}" y1="${a0.y}" x2="${a1.x}" y2="${a1.y}" class="dash"/><line x1="${b0.x}" y1="${b0.y}" x2="${b1.x}" y2="${b1.y}" class="hipl"/>
          <line x1="${b1.x + 14}" y1="${a1.y}" x2="${b1.x + 14}" y2="${b1.y}" class="brk"/><text x="${b1.x + 26}" y="${(a1.y + b1.y) / 2 + 12}" class="lbl">↓ ${dropNow.toFixed(1)} in</text></g>`;
      }
      // the plant angle: hips to the front heel at the first contact of the plant, against the floor
      const pa = !show.includes('angle') ? 0 : fr.freeze ? smooth((fr.vt - this.seg[fr.seg].v0) / 0.3) : smooth((st - (M.tPlant0 - 0.04)) / 0.04) * (1 - smooth((st - (M.tPlant0 + 0.08)) / 0.06));
      if (pa > 0.01) {
        const t0 = M.tPlant0, hip = rep.tab('hip', t0).add(new THREE.Vector3(0, 0.06, 0)), heel = rep.M.heel, f = rep.frame(t0).f;
        const P = this.proj(hip, cam), Hh = this.proj(heel, cam), Fl = this.proj(heel.clone().addScaledVector(f, -0.7), cam);
        const a1 = Math.atan2(P.y - Hh.y, P.x - Hh.x), a0 = Math.atan2(Fl.y - Hh.y, Fl.x - Hh.x), R = 70;
        let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const arc = `M ${Hh.x + R * Math.cos(a0)} ${Hh.y + R * Math.sin(a0)} A ${R} ${R} 0 0 ${da > 0 ? 1 : 0} ${Hh.x + R * Math.cos(a1)} ${Hh.y + R * Math.sin(a1)}`;
        const am = a0 + da / 2;
        h += `<g opacity="${pa.toFixed(3)}"><line x1="${P.x}" y1="${P.y}" x2="${Hh.x}" y2="${Hh.y}" class="ang"/><line x1="${Hh.x}" y1="${Hh.y}" x2="${Fl.x}" y2="${Fl.y}" class="flr"/>
          <path d="${arc}" class="arc"/><circle cx="${P.x}" cy="${P.y}" r="9" class="dot"/><text x="${Hh.x + (R + 44) * Math.cos(am)}" y="${Hh.y + (R + 44) * Math.sin(am) + 14}" class="deg">${Math.round(M.angle)}°</text></g>`;
      }
    }
    if (this.S.innerHTML !== h) this.S.innerHTML = h;
  }
  cardUpdate(fr, e, S) {
    const k = fr.card;
    if (this.cardKind !== k) {
      this.cardKind = k;
      this.card.innerHTML = k === 'intro'
        ? `<div class="k">FILM ROOM</div><div class="h">GET UP</div><div class="s">How to actually dunk</div>
           <div class="stat"><div class="n">10'0"</div><div class="l">the rim</div><div class="n">1.33×</div><div class="l">your standing reach vs your height<br>(NBA Draft Combine, 1,811 players)</div><div class="n">17 in</div><div class="l">to touch it at 6'5" (8'7" reach)</div></div>
           <div class="list"><div>1 · The approach → touch the rim</div><div>2 · Dunk it</div></div>`
        : `<div class="big">Speed <em>into</em><br>the plant.</div><div class="big sm">Feet ahead of your hips.<br>Arms back, then up.<br>Ball up <em>with</em> the jump.</div>
           <div class="src">Two-foot running jumps: Liu & Zaferiou 2025 (Front Sports Act Living), 21 players · Arm swing: Lees et al. 2004 (J Biomech) ·<br>Reach: NBA Draft Combine 2000-26 · Dunk contest: Tong & Wang 2024 (PLoS One) · Vertical from hang time: h = g·t²/8</div>`;
    }
    const o = k === 'intro' ? 1 - smooth((e - (S.v1 - S.v0 - 0.35)) / 0.35) : smooth(e / 0.4);
    this.card.style.opacity = String(o);
    for (const x of [this.top, this.mode, this.cap, this.gauge, this.svg]) x.style.opacity = '0';
    this.nums.style.opacity = k === 'intro' ? String(1 - o) : '0';
    if (k === 'outro') { this.gauge.style.opacity = '0'; }
    this.S.innerHTML = '';
  }
}
