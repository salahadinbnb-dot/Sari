// Floor telestration schedule (what gets drawn on the court, when).
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';

const C = { white: 0xffffff, red: 0xff2d44, green: 0x22e06f, blue: 0x3d9bff, amber: 0xffb21e, gold: 0xffd23f };
const win = (st, a, b, fi = 0.2, fo = 0.2) => clamp(Math.min((st - a) / fi, (b - st) / fo), 0, 1);

export function buildTelestration(O, hud, fr, st, W, proj) {
  const fz = fr.freeze, fu = fr.fu || 0;
  const V = (x, z, y = 0.05) => new THREE.Vector3(x, y, z);
  const P = (n) => W.frame(n, st).p;
  const labels = { space: 0, arm: 0, check: 0, set: 0, gap: 0, ghost: 0 };

  if (fz === 'intro') { hideLabels(hud, proj); return; }
  // rings under tagged players while their tag is up (not during freezes, which draw their own)
  if (!fz) {
    const d1r = win(st, 0.05, 5.47, 0.25, 0.2), scr = win(st, 6.1, 9.2, 0.25, 0.25), d2r = win(st, 0.05, 4.3, 0.25, 0.25);
    if (d1r > 0) { const p = P('d1'); O.ring(p.x, p.z, { r: 0.46, color: C.red, opacity: 0.8 * d1r, width: 0.05 }); }
    if (d2r > 0) { const p = P('d2'); O.ring(p.x, p.z, { r: 0.46, color: C.amber, opacity: 0.75 * d2r, width: 0.05 }); }
    if (scr > 0 && st < 8.28) { const p = P('screener'); O.ring(p.x, p.z, { r: 0.46, color: C.white, opacity: 0.8 * scr, width: 0.05 }); }
  }

  // 1) space to your right
  const sp = win(st, 0.35, 4.45, 0.4, 0.3);
  if (sp > 0) {
    O.zone([[1.95, 9.3], [6.6, 9.3], [6.6, 3.2], [2.5, 3.2]], { color: C.green, opacity: 0.34 * sp });
    labels.space = sp; hud.floorLabel('space', 'SPACE', V(3.9, 6.3, 0.02), proj, sp);
  }
  // 2) arm's length
  const al = win(st, 0.7, 2.7, 0.25, 0.25);
  if (al > 0) {
    const a = P('you'), b = P('d1');
    O.ribbon([[a.x, a.z], [b.x, b.z]], { color: C.white, width: 0.06, arrow: false, opacity: 0.9 * al });
    labels.arm = al; hud.floorLabel('arm', "↔ ARM'S LENGTH", V((a.x + b.x) / 2 + 1.05, (a.z + b.z) / 2 + 0.2, 1.05), proj, al);
  }
  // 3) drive test arrow
  const dt = st >= 4.2 && st < 5.5 ? 1 : 0;
  if (dt || fz === 'notbeaten') {
    const prog = fz === 'notbeaten' ? 1 : smooth((st - 4.2) / 0.35);
    O.ribbon([[0.35, 8.28], [1.3, 7.92], [2.2, 7.46], [2.8, 7.2]], { color: C.blue, width: 0.2, progress: prog, opacity: fz === 'notbeaten' ? 0.5 : 0.95 });
  }
  // freeze: not beaten
  if (fz === 'notbeaten') {
    const e = smooth(fu / 0.15);
    const a = P('you'), b = P('d1');
    const dir = new THREE.Vector3(-a.x, 0, -a.z).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    O.ribbon([[a.x + dir.x * 0.3, a.z + dir.z * 0.3], [b.x - dir.x * 0.15, b.z - dir.z * 0.15]], { color: C.red, width: 0.22, progress: e, opacity: 0.95 });
    O.ribbon([[b.x + dir.x * 0.4, b.z + dir.z * 0.4], [0.35, 0.6]], { color: C.red, width: 0.12, dashed: true, arrow: true, opacity: 0.45 * e });
    const w0 = b.clone().addScaledVector(perp, 0.62).addScaledVector(dir, -0.18), w1 = b.clone().addScaledVector(perp, -0.62).addScaledVector(dir, -0.18);
    O.wall([w0.x, w0.z], [w1.x, w1.z], { h: 1.75, color: C.red, opacity: 0.32 * e });
    O.ring(b.x, b.z, { r: 0.5, color: C.red, opacity: 0.9 * e });
    // where he'd need to be for an opening: beside/behind your left shoulder
    const g = smooth((fu - 0.4) / 0.12);
    if (g > 0) {
      const left = new THREE.Vector3(dir.z, 0, -dir.x);
      const gp = a.clone().addScaledVector(left, 0.7).addScaledVector(dir, -0.35);
      O.ring(gp.x, gp.z, { r: 0.42, color: C.green, opacity: 0.95 * g, width: 0.05 });
      O.disc(gp.x, gp.z, { r: 0.45, color: C.green, opacity: 0.28 * g });
      hud.floorLabel('ghost', 'OPENING = HIM HERE', V(gp.x, gp.z, 0.05).addScaledVector(left, 0.95).addScaledVector(dir, 0.2), proj, g); labels.ghost = g;
    }
  }
  // 4) checkpoint + retreat
  const ck = win(st, 5.7, 7.2, 0.2, 0.3);
  if (ck > 0 && !fz) {
    O.ring(2.42, 7.38, { r: 0.5, color: C.amber, opacity: 0.95 * ck });
    labels.check = ck; hud.floorLabel('check', 'CHECKPOINT', V(2.42, 7.38, 0.05).add(new THREE.Vector3(0.9, 0, -0.75)), proj, ck);
    const rp = smooth((st - 5.9) / 0.5);
    if (st > 5.9) O.ribbon([[2.42, 7.38], [1.95, 8.05], [1.42, 8.66]], { color: C.blue, width: 0.18, progress: rp, opacity: 0.95 * ck });
  }
  // 5) screener route + set
  const sr = win(st, 6.0, 8.45, 0.2, 0.3);
  if (sr > 0) O.ribbon([[-2.15, 0.95], [-1.1, 3.3], [0.95, 6.4], [1.9, 7.78]], { color: C.white, width: 0.15, dashed: true, progress: smooth((st - 6.0) / 0.7), opacity: 0.95 * sr });
  const se = win(st, 8.28, 9.12, 0.15, 0.25);
  if (se > 0) {
    O.ring(1.93, 7.83, { r: 0.5, color: C.green, opacity: 0.95 * se });
    labels.set = se; hud.floorLabel('set', 'SET ✓', V(1.93, 7.83, 0.05).add(new THREE.Vector3(-0.95, 0, 0.35)), proj, se);
  }
  // 6) tight path off the screen (+ the wide loop that leaves a gap)
  const tp = (st >= 8.5 && st < 9.55) || fz === 'opening' ? 1 : 0;
  if (tp) {
    O.ribbon([[1.4, 8.72], [2.02, 8.55], [2.6, 7.97], [2.93, 6.95], [2.8, 5.8]], { color: C.blue, width: 0.2, progress: fz ? 1 : smooth((st - 8.5) / 0.35), opacity: fz ? 0.45 : 0.95 });
    const gw = win(st, 8.55, 9.2, 0.15, 0.2);
    if (gw > 0 && !fz) {
      O.ribbon([[2.0, 8.62], [3.15, 8.45], [3.75, 7.35], [3.6, 6.05]], { color: C.red, width: 0.12, dashed: true, opacity: 0.75 * gw });
      labels.gap = gw; hud.floorLabel('gap', 'WIDE LOOP = GAP', V(4.25, 7.6, 0.05), proj, gw);
    }
  }
  // freeze: opening
  if (fz === 'opening') {
    const e = smooth(fu / 0.15);
    const a = P('you'), d = P('d1');
    O.ribbon([[a.x - 0.05, a.z - 0.4], [2.2, 3.6], [0.75, 0.95]], { color: C.green, width: 0.24, progress: e, opacity: 0.95 });
    O.ring(d.x, d.z, { r: 0.5, color: C.red, opacity: 0.9 * e });
  }
  // freeze: help steps up (+ lingering lanes during the pass)
  const hl = fz === 'help' ? smooth(fu / 0.15) : (st > 9.98 && st < 10.7 ? win(st, 9.98, 10.7, 0.01, 0.3) : 0);
  if (hl > 0) {
    const d2 = P('d2'), sc = P('screener'), a = P('you');
    O.ribbon([[0.78, 5.12], [1.35, 4.5], [d2.x, d2.z]], { color: C.red, width: 0.16, opacity: 0.95 * hl });
    O.ring(d2.x, d2.z, { r: 0.5, color: C.amber, opacity: 0.9 * hl });
    O.ring(sc.x, sc.z, { r: 0.5, color: C.blue, opacity: 0.9 * hl });
    const g = fz === 'help' ? smooth((fu - 0.3) / 0.15) : 1;
    if (g > 0) {
      O.ribbon([[sc.x, sc.z], [0.26, 3.8], [0.16, 3.1], [0.08, 2.0]], { color: C.blue, width: 0.17, progress: g, opacity: 0.95 * hl });
      const p2 = fz === 'help' ? smooth((fu - 0.45) / 0.15) : 1;
      if (p2 > 0) O.ribbon([[a.x - 0.2, a.z - 0.1], [1.2, 3.85], [0.2, 3.15]], { color: C.gold, width: 0.14, dashed: true, progress: p2, opacity: 0.98 * hl });
    }
  }
  for (const k of Object.keys(labels)) if (!labels[k]) hud.floorLabel(k, '', null, proj, 0);
}

function hideLabels(hud, proj) { for (const k of ['space', 'arm', 'check', 'set', 'gap', 'ghost']) hud.floorLabel(k, '', null, proj, 0); }
