// v6 floor marks: a footprint where each step of the approach lands (white; the big step amber, the plant green),
// appearing as the foot comes down, so the run-up's rhythm is drawn on the floor; and a ring on the takeoff spot.
import * as THREE from 'three';
import { smooth } from './motion.js';

const Y = 0.006;
const COL = { step: new THREE.Color(1.6, 1.6, 1.6), big: new THREE.Color(1.9, 1.35, 0.25), plant: new THREE.Color(0.3, 1.9, 0.75) };

function soleShape() { // a sneaker sole, toe along +x, 30 cm x 11 cm
  const s = new THREE.Shape(), L = 0.3, W = 0.11;
  s.moveTo(-L / 2 + 0.03, -W * 0.36);
  s.bezierCurveTo(-L / 2 - 0.01, -W * 0.36, -L / 2 - 0.01, W * 0.36, -L / 2 + 0.03, W * 0.36);
  s.bezierCurveTo(-0.02, W * 0.42, 0.02, W * 0.52, L / 2 - 0.05, W * 0.5);
  s.bezierCurveTo(L / 2 + 0.01, W * 0.48, L / 2 + 0.01, -W * 0.44, L / 2 - 0.05, -W * 0.5);
  s.bezierCurveTo(0.02, -W * 0.52, -0.02, -W * 0.4, -L / 2 + 0.03, -W * 0.36);
  return s;
}

export class Marks6 {
  constructor(scene, reps) {
    this.group = new THREE.Group(); this.group.renderOrder = 5; scene.add(this.group); this.per = {};
    const outline = new THREE.ShapeGeometry(soleShape(), 12), inner = outline.clone().scale(0.78, 0.66, 1);
    for (const [name, rep] of Object.entries(reps)) {
      const g = new THREE.Group(); this.group.add(g); const items = [];
      for (const f of rep.footfalls) {
        if (f.t > rep.k.off) continue;
        const kind = f.plant ? 'plant' : f.big ? 'big' : 'step';
        const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COL[kind], transparent: true, opacity: op, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide })); m.renderOrder = 5; m.frustumCulled = false; return m; };
        const o = new THREE.Group(), a = mk(outline, 0.85), b = mk(inner, 0.2); b.position.z = 0.0005;
        o.add(a, b); o.rotation.order = 'YXZ'; o.rotation.y = f.yaw - Math.PI / 2; o.rotation.x = -Math.PI / 2;
        o.position.set(f.p.x, Y, f.p.z); g.add(o);
        items.push({ f, o, mats: [a.material, b.material], base: [0.85, 0.2] });
      }
      // the takeoff spot: a ring under his hips at toe-off
      const toff = rep.tab('hip', rep.k.off), ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 48), new THREE.MeshBasicMaterial({ color: COL.plant, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(toff.x, Y + 0.0005, toff.z); ring.renderOrder = 6; g.add(ring);
      this.per[name] = { g, items, ring };
    }
  }
  update(rep, st, mode) {
    for (const [name, P] of Object.entries(this.per)) P.g.visible = name === rep.name && mode !== 'replay';
    const P = this.per[rep.name]; if (!P) return;
    const fade = 1 - smooth((st - (rep.k.land + 0.5)) / 0.5);
    for (const it of P.items) { const a = smooth((st - it.f.t) / 0.06) * fade; it.mats.forEach((m, i) => { m.opacity = it.base[i] * a; }); it.o.visible = a > 0.01; }
    const ra = smooth((st - rep.k.off) / 0.1) * fade; P.ring.material.opacity = 0.9 * ra; P.ring.visible = ra > 0.01;
    P.ring.scale.setScalar(1 + 0.6 * smooth((st - rep.k.off) / 0.35));
  }
}
