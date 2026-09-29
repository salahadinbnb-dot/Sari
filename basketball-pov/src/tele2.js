// v2 floor telestration for the 1v1 (what gets drawn on the court, and when).
import * as THREE from 'three';
import { clamp, smooth } from './motion.js';
import { PLAN } from './game2.js';

const C = { white: 0xffffff, red: 0xff2d44, green: 0x22e06f, blue: 0x3d9bff, amber: 0xffb21e, gold: 0xffd23f };
const win = (st, a, b, fi = 0.2, fo = 0.2) => clamp(Math.min((st - a) / fi, (b - st) / fo), 0, 1);
const LABELS = ['space', 'arm', 'check', 'go', 'ghost', 'finish'];

export function buildTele2(O, hud, fr, st, game, proj) {
  const fz = fr.freeze, fu = fr.fu || 0;
  const V = (x, z, y = 0.05) => new THREE.Vector3(x, y, z);
  const P = (n, t = st) => game.frame(n, t).p;
  const path = (n, a, b, step = 0.04) => { const pts = []; for (let t = a; t <= b + 1e-6; t += step) { const p = P(n, t); pts.push([p.x, p.z]); } return pts; };
  const shown = {};
  const label = (k, text, pos, op) => { shown[k] = 1; hud.floorLabel(k, text, pos, proj, op); };

  if (fz !== 'intro') {
    // ring under D1 while he's tagged
    if (!fz) {
      const d1r = Math.max(win(st, 0.05, 3.34, 0.25, 0.2), win(st, 4.4, 5.62, 0.25, 0.2));
      if (d1r > 0) { const p = P('d1'); O.ring(p.x, p.z, { r: 0.46, color: C.red, opacity: 0.8 * d1r, width: 0.05 }); }
    }
    // 1) the space to his right
    const sp = fz === 'setup' ? smooth(fu / 0.2) : (fz ? 0 : win(st, 0.3, 2.95, 0.4, 0.3));
    if (sp > 0) {
      O.zone([[1.2, 9.5], [4.9, 9.5], [4.9, 5.3], [1.35, 5.9]], { color: C.green, opacity: 0.3 * sp });
      label('space', 'SPACE', V(3.2, 7.5, 0.02), sp);
    }
    // 2) arm's length
    const al = fz === 'setup' ? smooth((fu - 0.15) / 0.2) : (fz ? 0 : win(st, 0.6, 2.5, 0.25, 0.25));
    if (al > 0) {
      const a = P('you'), b = P('d1');
      O.ribbon([[a.x, a.z], [b.x, b.z]], { color: C.white, width: 0.06, arrow: false, opacity: 0.9 * al });
      label('arm', "↔ ARM'S LENGTH", V((a.x + b.x) / 2 - 1.1, (a.z + b.z) / 2 + 0.2, 1.05), al);
    }
    // 3) the test: his path into the space beside D1
    if ((!fz && st >= 2.84 && st < 3.42) || fz === 'notbeaten') {
      const prog = fz ? 1 : smooth((st - 2.84) / 0.3);
      O.ribbon(path('you', 2.8, 3.42), { color: C.blue, width: 0.18, progress: prog, opacity: fz ? 0.5 : 0.95 });
    }
    // freeze: NOT BEATEN
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
      const g = smooth((fu - 0.4) / 0.12);
      if (g > 0) {
        const left = new THREE.Vector3(dir.z, 0, -dir.x);
        const gp = a.clone().addScaledVector(left, 0.7).addScaledVector(dir, -0.35);
        O.ring(gp.x, gp.z, { r: 0.42, color: C.green, opacity: 0.95 * g, width: 0.05 });
        O.disc(gp.x, gp.z, { r: 0.45, color: C.green, opacity: 0.28 * g });
        label('ghost', 'OPENING = HIM HERE', V(gp.x, gp.z).addScaledVector(left, 0.95).addScaledVector(dir, 0.2), g);
      }
    }
    // 4) checkpoint: where the test died, and the diagonal back-out
    const ck = fz ? 0 : win(st, 3.36, 4.5, 0.2, 0.3);
    if (ck > 0) {
      const c = P('you', 3.45);
      O.ring(c.x, c.z, { r: 0.5, color: C.amber, opacity: 0.95 * ck });
      label('check', 'CHECKPOINT', V(c.x + 0.95, c.z - 0.7), ck);
      if (st > 3.45) O.ribbon(path('you', 3.45, 4.35), { color: C.blue, width: 0.16, progress: smooth((st - 3.45) / 0.7), opacity: 0.95 * ck });
    }
    // 5) the closeout: his momentum vs. your attack
    if (fz === 'closeout') {
      const e = smooth(fu / 0.15);
      const d = P('d1');
      O.ribbon(path('d1', 5.6, 6.5), { color: C.amber, width: 0.22, progress: e, opacity: 0.95 });
      O.ring(d.x, d.z, { r: 0.5, color: C.amber, opacity: 0.9 * e });
      const g = smooth((fu - 0.38) / 0.15);
      if (g > 0) {
        O.ribbon(path('you', 5.95, 7.3), { color: C.blue, width: 0.22, progress: g, opacity: 0.95 });
        const m = P('you', 7.3);
        label('go', 'GO WHILE HE’S MOVING', V(m.x - 0.1, m.z - 0.6), g);
      }
    } else if (!fz && st >= 5.9 && st < 6.95) {
      O.ribbon(path('you', 5.95, 7.3), { color: C.blue, width: 0.2, progress: smooth((st - 5.95) / 0.45), opacity: 0.85 * win(st, 5.9, 6.95, 0.05, 0.2) });
    }
    // 6) opening: the lane is yours
    if (fz === 'opening') {
      const e = smooth(fu / 0.15);
      const d = P('d1');
      O.ribbon(path('you', 6.88, 8.9), { color: C.green, width: 0.24, progress: e, opacity: 0.95 });
      O.ring(d.x, d.z, { r: 0.5, color: C.red, opacity: 0.9 * e });
    }
    // 7) finish on the right side of the rim
    const fi = fz ? 0 : win(st, 7.5, PLAN.release + 0.05, 0.35, 0.3);
    if (fi > 0) {
      const s = P('you', PLAN.release - 0.2);
      O.ring(s.x, s.z, { r: 0.42, color: C.green, opacity: 0.9 * fi, width: 0.06 });
      O.disc(s.x, s.z, { r: 0.45, color: C.green, opacity: 0.22 * fi });
      label('finish', 'RIGHT SIDE', V(s.x + 0.95, s.z + 0.35), fi);
    }
  }
  for (const k of LABELS) if (!shown[k]) hud.floorLabel(k, '', null, proj, 0);
}
