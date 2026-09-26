// Equipment: hand-held props, machines, cables and bands. Port of FitnessMotion/Motion/Props.swift.
import * as THREE from '../vendor/three.module.min.js';
import { orthonormalized, qFromBasis, Vec as V, deg, Side } from './skeleton.js?v=7';

const mat = (color, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const Materials = {
  metalDark: mat(0x242426, 0.45, 0.6), metalFrame: mat(0x9ea0a6, 0.5, 0.5), rubber: mat(0x1a1a1c, 0.9),
  padding: mat(0x1c1c1e, 0.8), cable: mat(0x333336, 0.6), band: mat(0x8c1f1f, 0.7), ball: mat(0x384c8c, 0.6),
};

const qz90 = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2);
const qxd = d => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), deg(d));
const qyd = d => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), deg(d));
const qzd = d => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), deg(d));

export const Geo = {
  box(w, h, l, material, p, rotation) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material);
    m.position.copy(p); if (rotation) m.quaternion.copy(rotation); return m;
  },
  cylinder(radius, height, material, p, rotation) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material);
    m.position.copy(p); if (rotation) m.quaternion.copy(rotation); return m;
  },
  sphere(radius, material, p) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), material); m.position.copy(p); return m;
  },
  torus(ring, pipe, material, p, rotation) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(ring, pipe, 10, 24), material);
    m.position.copy(p); if (rotation) m.quaternion.copy(rotation); return m;
  },
  segment(radius, material) { return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material); },
  place(n, a, b) {
    const d = b.clone().sub(a); const len = Math.max(d.length(), 1e-4);
    n.position.copy(a).add(b).multiplyScalar(0.5);
    n.scale.set(1, len, 1);
    n.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len));
  },
  dumbbell(handleLength = 0.15, plateRadius = 0.065) {
    const n = new THREE.Group();
    n.add(Geo.cylinder(0.017, handleLength + 0.16, Materials.metalDark, V(0, 0, 0), qz90));
    for (const s of [-1, 1]) {
      n.add(Geo.cylinder(plateRadius, 0.032, Materials.metalDark, V(s * (handleLength / 2 + 0.02), 0, 0), qz90));
      n.add(Geo.cylinder(plateRadius * 0.85, 0.03, Materials.metalDark, V(s * (handleLength / 2 + 0.055), 0, 0), qz90));
    }
    return n;
  },
};

class PropNode {
  constructor() { this.node = new THREE.Group(); this.attached = []; }
  update(ctx) {}
  remove() { this.node.removeFromParent(); for (const a of this.attached) a.removeFromParent(); }
}

class HeldProp extends PropNode {
  constructor(build, sides) { super(); this.build = build; this.sides = sides; this.built = false; }
  update(ctx) {
    if (this.built) return; this.built = true;
    for (const s of this.sides) { const n = this.build(); ctx.attach(n, s); this.attached.push(n); }
  }
}

class TwoHandedProp extends PropNode {
  update(ctx) {
    const l = ctx.grip('L'), r = ctx.grip('R');
    this.node.position.copy(l).add(r).multiplyScalar(0.5);
    let x = l.clone().sub(r); if (x.length() < 1e-4) x = V(1, 0, 0); x.normalize();
    const palm = ctx.hand('L').palm;
    const z = orthonormalized(palm, x, V(0, 0, 1));
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    this.node.quaternion.copy(qFromBasis(x, y, z));
  }
}

function barbellNode(width) {
  const n = new THREE.Group();
  n.add(Geo.cylinder(0.015, width, Materials.metalFrame, V(0, 0, 0), qz90));
  for (const s of [-1, 1]) {
    n.add(Geo.cylinder(0.17, 0.035, Materials.metalDark, V(s * (width / 2 - 0.12), 0, 0), qz90));
    n.add(Geo.cylinder(0.15, 0.03, Materials.metalDark, V(s * (width / 2 - 0.08), 0, 0), qz90));
  }
  return n;
}

const Furniture = {
  bench(backAngle) {
    const n = new THREE.Group(); const pad = Materials.padding, frame = Materials.metalFrame;
    n.add(Geo.box(0.34, 0.07, 0.42, pad, V(0, 0.415, 0.06)));
    if (backAngle > 5) {
      const h = 0.62, ang = deg(backAngle);
      n.add(Geo.box(0.34, h, 0.07, pad, V(0, 0.45 + (h / 2) * Math.sin(ang), -0.17 - (h / 2) * Math.cos(ang)), qxd(90 - backAngle)));
    }
    n.add(Geo.box(0.06, 0.38, 0.06, frame, V(0, 0.19, 0.16)));
    n.add(Geo.box(0.06, 0.38, 0.06, frame, V(0, 0.19, -0.10)));
    n.add(Geo.box(0.46, 0.05, 0.06, frame, V(0, 0.025, 0.24)));
    n.add(Geo.box(0.46, 0.05, 0.06, frame, V(0, 0.025, -0.22)));
    n.add(Geo.box(0.06, 0.05, 0.5, frame, V(0, 0.025, 0.0)));
    return n;
  },
  latPulldown() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding, dark = Materials.metalDark; const zPost = 0.62;
    for (const x of [-0.32, 0.32]) { n.add(Geo.box(0.07, 2.25, 0.07, frame, V(x, 1.125, zPost))); n.add(Geo.box(0.07, 0.06, 1.1, frame, V(x, 0.03, zPost - 0.2))); }
    n.add(Geo.box(0.80, 0.08, 0.08, frame, V(0, 2.22, zPost)));
    n.add(Geo.box(0.09, 0.08, 0.75, frame, V(0, 2.22, zPost - 0.35)));
    n.add(Geo.cylinder(0.07, 0.05, dark, V(0, 2.14, 0.05), qz90));
    n.add(Geo.box(0.36, 0.95, 0.22, dark, V(0, 0.55, zPost + 0.02)));
    for (const x of [-0.12, 0.12]) n.add(Geo.cylinder(0.012, 2.0, frame, V(x, 1.1, zPost + 0.02)));
    n.add(Geo.box(0.36, 0.07, 0.36, pad, V(0, 0.415, 0.05)));
    n.add(Geo.box(0.08, 0.38, 0.08, frame, V(0, 0.19, 0.05)));
    n.add(Geo.box(0.08, 0.06, 0.55, frame, V(0, 0.03, 0.25)));
    n.add(Geo.box(0.06, 0.55, 0.06, frame, V(0.28, 0.5, 0.3)));
    n.add(Geo.cylinder(0.06, 0.5, pad, V(0.0, 0.80, 0.30), qz90));
    return n;
  },
  cableRow() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding, dark = Materials.metalDark;
    n.add(Geo.box(0.40, 0.06, 0.40, pad, V(0, 0.30, 0.0)));
    n.add(Geo.box(0.34, 0.26, 0.34, frame, V(0, 0.14, 0.0)));
    n.add(Geo.box(0.16, 0.06, 1.4, frame, V(0, 0.03, 0.55)));
    n.add(Geo.box(0.50, 0.34, 0.05, dark, V(0, 0.22, 0.92), qxd(-20)));
    n.add(Geo.box(0.08, 1.3, 0.08, frame, V(0, 0.65, 1.28)));
    n.add(Geo.box(0.34, 0.9, 0.2, dark, V(0, 0.5, 1.5)));
    n.add(Geo.cylinder(0.06, 0.04, dark, V(0, 0.36, 1.2), qz90));
    return n;
  },
  cableColumn(p, pulleyHeight) {
    const n = new THREE.Group(); const frame = Materials.metalFrame, dark = Materials.metalDark;
    n.add(Geo.box(0.12, 2.3, 0.12, frame, V(p.x, 1.15, p.z)));
    n.add(Geo.box(0.7, 0.05, 0.5, frame, V(p.x, 0.025, p.z)));
    n.add(Geo.box(0.34, 1.0, 0.2, dark, V(p.x, 0.55, p.z + 0.2)));
    n.add(Geo.cylinder(0.06, 0.05, dark, V(p.x, pulleyHeight, p.z - 0.08), qz90));
    return n;
  },
  parallelBars() {
    const n = new THREE.Group(); const frame = Materials.metalFrame;
    for (const x of [-0.29, 0.29]) {
      n.add(Geo.cylinder(0.02, 1.1, frame, V(x, 1.10, 0), qxd(90)));
      for (const z of [-0.45, 0.45]) n.add(Geo.box(0.06, 1.1, 0.06, frame, V(x, 0.55, z)));
      n.add(Geo.box(0.5, 0.05, 0.08, frame, V(x, 0.025, 0.45)));
      n.add(Geo.box(0.5, 0.05, 0.08, frame, V(x, 0.025, -0.45)));
    }
    return n;
  },
  assistMachine(pullUp) {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding, dark = Materials.metalDark;
    for (const x of [-0.42, 0.42]) { n.add(Geo.box(0.07, 2.3, 0.07, frame, V(x, 1.15, -0.25))); n.add(Geo.box(0.07, 0.06, 0.9, frame, V(x, 0.03, -0.05))); }
    n.add(Geo.box(0.9, 0.08, 0.08, frame, V(0, 2.28, -0.25)));
    n.add(Geo.box(0.34, 0.9, 0.2, dark, V(0, 0.5, -0.45)));
    n.add(Geo.box(0.44, 0.08, 0.34, pad, V(0, 0.50, 0.02)));
    n.add(Geo.box(0.10, 0.45, 0.10, frame, V(0, 0.25, -0.05)));
    if (pullUp) {
      n.add(Geo.cylinder(0.02, 0.95, frame, V(0, 2.05, 0.0), qz90));
      for (const x of [-0.35, 0.35]) n.add(Geo.box(0.05, 0.05, 0.3, frame, V(x, 2.05, -0.12)));
    } else {
      for (const x of [-0.30, 0.30]) {
        n.add(Geo.cylinder(0.02, 0.45, frame, V(x, 1.02, 0.02), qxd(90)));
        n.add(Geo.box(0.05, 0.05, 0.3, frame, V(x, 1.02, -0.22)));
        n.add(Geo.box(0.05, 0.9, 0.05, frame, V(x, 1.5, -0.3)));
      }
    }
    return n;
  },
  preacherBench() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding;
    n.add(Geo.box(0.34, 0.07, 0.34, pad, V(0, 0.415, 0.0)));
    n.add(Geo.box(0.08, 0.38, 0.08, frame, V(0, 0.19, 0.0)));
    n.add(Geo.box(0.5, 0.05, 0.9, frame, V(0, 0.025, 0.2)));
    n.add(Geo.box(0.6, 0.42, 0.08, pad, V(0, 0.92, 0.36), qxd(-32)));
    n.add(Geo.box(0.08, 0.7, 0.08, frame, V(0, 0.4, 0.42)));
    return n;
  },
  backExtensionMachine() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding, dark = Materials.metalDark;
    n.add(Geo.box(0.36, 0.07, 0.36, pad, V(0, 0.415, 0.02)));
    n.add(Geo.box(0.08, 0.38, 0.08, frame, V(0, 0.19, 0.0)));
    n.add(Geo.box(0.6, 0.05, 0.9, frame, V(0, 0.025, -0.1)));
    n.add(Geo.box(0.34, 0.9, 0.2, dark, V(0, 0.5, -0.55)));
    n.add(Geo.cylinder(0.07, 0.36, pad, V(0, 0.62, 0.30), qz90));
    n.add(Geo.box(0.06, 0.4, 0.06, frame, V(0.24, 0.5, 0.2)));
    return n;
  },
  crunchMachine() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, pad = Materials.padding, dark = Materials.metalDark;
    n.add(Geo.box(0.36, 0.07, 0.36, pad, V(0, 0.415, 0.02)));
    n.add(Geo.box(0.08, 0.38, 0.08, frame, V(0, 0.19, 0.0)));
    n.add(Geo.box(0.34, 0.6, 0.07, pad, V(0, 0.75, -0.2)));
    n.add(Geo.box(0.6, 0.05, 0.9, frame, V(0, 0.025, -0.1)));
    n.add(Geo.box(0.34, 0.9, 0.2, dark, V(0, 0.5, -0.6)));
    n.add(Geo.cylinder(0.06, 0.4, pad, V(0, 0.78, 0.30), qz90));
    return n;
  },
  stepmill() {
    const n = new THREE.Group(); const frame = Materials.metalFrame, dark = Materials.metalDark;
    for (let i = 0; i < 7; i++) n.add(Geo.box(0.6, 0.04, 0.24, dark, V(0, 0.18 + i * 0.17, 0.05 + i * 0.22)));
    n.add(Geo.box(0.7, 0.12, 0.5, dark, V(0, 0.06, -0.15)));
    for (const x of [-0.36, 0.36]) {
      n.add(Geo.box(0.05, 1.3, 0.05, frame, V(x, 0.65, -0.3)));
      n.add(Geo.cylinder(0.02, 1.5, frame, V(x, 1.15, 0.35), qxd(-52)));
      n.add(Geo.box(0.05, 0.8, 0.05, frame, V(x, 1.3, 1.0)));
    }
    return n;
  },
  mat() { const n = new THREE.Group(); n.add(Geo.box(0.7, 0.015, 1.9, Materials.rubber, V(0, 0.0075, 0))); return n; },
  // full-length bench for lying work: pad runs from the hips (z≈0.2) back under the head (−Z)
  flatBench(incline = 0) {
    const n = new THREE.Group(); const pad = Materials.padding, frame = Materials.metalFrame;
    n.add(Geo.box(0.30, 0.07, 0.38, pad, V(0, 0.415, 0.04)));
    if (incline > 3) {
      const len = 0.85, a = deg(incline);
      n.add(Geo.box(0.30, 0.07, len, pad, V(0, 0.45 + (len / 2) * Math.sin(a), -0.15 - (len / 2) * Math.cos(a)), qxd(incline)));
      n.add(Geo.box(0.06, 0.45 + len * Math.sin(a) * 0.6, 0.06, frame, V(0, (0.45 + len * Math.sin(a) * 0.6) / 2, -0.15 - len * Math.cos(a) * 0.7)));
    } else {
      n.add(Geo.box(0.30, 0.07, 0.80, pad, V(0, 0.415, -0.55)));
    }
    for (const z of [0.12, -0.80]) {
      n.add(Geo.box(0.06, 0.38, 0.06, frame, V(0, 0.19, z)));
      n.add(Geo.box(0.46, 0.05, 0.06, frame, V(0, 0.025, z)));
    }
    n.add(Geo.box(0.06, 0.05, 0.95, frame, V(0, 0.025, -0.34)));
    return n;
  },
  pullUpBar() {
    const n = new THREE.Group(); const frame = Materials.metalFrame;
    for (const x of [-0.55, 0.55]) { n.add(Geo.box(0.07, 2.35, 0.07, frame, V(x, 1.175, -0.05))); n.add(Geo.box(0.07, 0.06, 0.9, frame, V(x, 0.03, -0.05))); }
    n.add(Geo.cylinder(0.018, 1.17, frame, V(0, 2.28, -0.05), qz90));
    return n;
  },
  squatRack() {
    const n = new THREE.Group(); const frame = Materials.metalFrame;
    for (const x of [-0.65, 0.65]) { n.add(Geo.box(0.07, 2.2, 0.07, frame, V(x, 1.1, -0.6))); n.add(Geo.box(0.07, 0.06, 0.8, frame, V(x, 0.03, -0.5))); }
    n.add(Geo.box(1.4, 0.07, 0.07, frame, V(0, 2.2, -0.6)));
    return n;
  },
};

class StaticProp extends PropNode { constructor(n) { super(); this.node.add(n); } }

class CableProp extends PropNode {
  constructor(anchor, attachment, furniture, side) {
    super();
    this.anchor = anchor; this.attachment = attachment; this.side = side;
    this.cable = Geo.segment(0.008, Materials.cable); this.cable2 = Geo.segment(0.008, Materials.cable); this.handle = new THREE.Group();
    if (furniture) this.node.add(furniture);
    this.node.add(this.cable); this.node.add(this.handle);
    const rot = qz90;
    switch (attachment) {
      case 'straightBar': this.handle.add(Geo.cylinder(0.014, 0.9, Materials.metalFrame, V(0, 0, 0), rot)); break;
      case 'vBar':
        this.handle.add(Geo.cylinder(0.014, 0.16, Materials.metalFrame, V(0.07, 0, 0), qxd(90)));
        this.handle.add(Geo.cylinder(0.014, 0.16, Materials.metalFrame, V(-0.07, 0, 0), qxd(90)));
        this.handle.add(Geo.box(0.16, 0.03, 0.03, Materials.metalFrame, V(0, 0, -0.08)));
        break;
      case 'rope':
        this.node.add(this.cable2);
        for (const x of [-0.06, 0.06]) this.handle.add(Geo.cylinder(0.02, 0.2, Materials.rubber, V(x, 0, 0), qzd(x < 0 ? 20 : -20)));
        break;
      case 'singleHandle': this.handle.add(Geo.cylinder(0.014, 0.12, Materials.metalFrame, V(0, 0, 0), rot)); break;
      case 'dualHandles': this.node.add(this.cable2); break;
    }
  }
  update(ctx) {
    const a = this.anchor;
    switch (this.attachment) {
      case 'singleHandle': { const g = ctx.grip(this.side); this.handle.position.copy(g); Geo.place(this.cable, a, g); break; }
      case 'dualHandles': Geo.place(this.cable, a, ctx.grip('L')); Geo.place(this.cable2, a, ctx.grip('R')); break;
      case 'rope': {
        const gl = ctx.grip('L'), gr = ctx.grip('R');
        const mid = gl.clone().add(gr).multiplyScalar(0.5);
        const towards = a.clone().sub(mid).normalize();
        const knot = mid.clone().add(towards.clone().multiplyScalar(0.18));
        Geo.place(this.cable, a, knot);
        Geo.place(this.cable2, knot, knot.clone().add(V(0.001, 0, 0)));
        this.handle.position.copy(mid);
        const x = gl.clone().sub(gr).normalize();
        const y = orthonormalized(towards, x, V(0, 1, 0));
        const z = new THREE.Vector3().crossVectors(x, y).normalize();
        this.handle.quaternion.copy(qFromBasis(x, y, z));
        break;
      }
      default: {
        const l = ctx.grip('L'), r = ctx.grip('R');
        const mid = l.clone().add(r).multiplyScalar(0.5);
        this.handle.position.copy(mid);
        const x = l.clone().sub(r).normalize();
        const towards = a.clone().sub(mid).normalize();
        const z = orthonormalized(towards.clone().negate(), x, V(0, 0, 1));
        const y = new THREE.Vector3().crossVectors(z, x).normalize();
        this.handle.quaternion.copy(qFromBasis(x, y, z));
        Geo.place(this.cable, a, mid);
      }
    }
  }
}

class BandProp extends PropNode {
  constructor(anchor, hands) {
    super(); this.anchor = anchor; this.hands = hands; this.segments = [];
    for (const _ of hands) { const s = Geo.segment(0.012, Materials.band); this.segments.push(s); this.node.add(s); }
    this.node.add(Geo.sphere(0.03, Materials.rubber, anchor));
  }
  update(ctx) { this.hands.forEach((h, i) => Geo.place(this.segments[i], this.anchor, ctx.grip(h))); }
}

class BattleRopesProp extends PropNode {
  constructor(anchor) {
    super(); this.anchor = anchor; this.ropes = []; this.n = 12;
    for (let r = 0; r < 2; r++) {
      const segs = [];
      for (let i = 0; i < this.n; i++) { const s = Geo.segment(0.022, Materials.rubber); this.node.add(s); segs.push(s); }
      this.ropes.push(segs);
    }
    this.node.add(Geo.box(0.3, 0.12, 0.12, Materials.metalDark, anchor));
  }
  update(ctx) {
    ['L', 'R'].forEach((h, r) => {
      const sign = h === 'L' ? 1 : -1;
      const start = ctx.grip(h); const end = this.anchor.clone().add(V(sign * 0.12, 0, 0));
      let prev = start;
      for (let i = 0; i < this.n; i++) {
        const f = (i + 1) / this.n;
        const p = start.clone().lerp(end, f);
        const wave = Math.sin(ctx.time * 7.0 + f * 9.0 + (h === 'L' ? 0 : Math.PI)) * 0.16 * Math.sin(f * Math.PI);
        p.y = Math.max(0.04, p.y + wave - f * 0.25 * (1 - f));
        Geo.place(this.ropes[r][i], prev, p);
        prev = p;
      }
    });
  }
}

export function makeProp(d) {
  switch (d.kind) {
    case 'dumbbells': return new HeldProp(() => Geo.dumbbell(), d.sides);
    case 'barbell': { const p = new TwoHandedProp(); p.node.add(barbellNode(d.width)); return p; }
    case 'abWheel': {
      const p = new TwoHandedProp();
      p.node.add(Geo.cylinder(0.012, 0.42, Materials.metalFrame, V(0, 0, 0), qz90));
      p.node.add(Geo.cylinder(0.10, 0.05, Materials.rubber, V(0, 0, 0), qz90));
      return p;
    }
    case 'bench': return new StaticProp(Furniture.bench(d.backAngle));
    case 'latPulldown': return new CableProp(V(0, 2.14, 0.05), 'straightBar', Furniture.latPulldown());
    case 'cableRow': return new CableProp(V(0, 0.36, 1.2), 'vBar', Furniture.cableRow());
    case 'cableColumn': return new CableProp(V(d.position.x, d.pulleyHeight, d.position.z - 0.08), d.attachment, Furniture.cableColumn(d.position, d.pulleyHeight), d.side);
    case 'kettlebell': return new HeldProp(() => {
      const kb = new THREE.Group();
      kb.add(Geo.torus(0.055, 0.012, Materials.metalDark, V(0, 0, 0), qyd(90)));
      kb.add(Geo.sphere(0.085, Materials.metalDark, V(0, -0.115, 0)));
      return kb;
    }, [d.side]);
    case 'ball': return new StaticProp(Geo.sphere(d.radius, Materials.ball, d.position));
    case 'band': return new BandProp(d.anchor, d.hands);
    case 'parallelBars': return new StaticProp(Furniture.parallelBars());
    case 'assistMachine': return new StaticProp(Furniture.assistMachine(d.pullUp));
    case 'preacherBench': return new StaticProp(Furniture.preacherBench());
    case 'backExtensionMachine': return new StaticProp(Furniture.backExtensionMachine());
    case 'crunchMachine': return new StaticProp(Furniture.crunchMachine());
    case 'stepmill': return new StaticProp(Furniture.stepmill());
    case 'battleRopes': return new BattleRopesProp(d.anchor);
    case 'mat': return new StaticProp(Furniture.mat());
    case 'squatRack': return new StaticProp(Furniture.squatRack());
    case 'flatBench': return new StaticProp(Furniture.flatBench(d.incline || 0));
    case 'pullUpBar': return new StaticProp(Furniture.pullUpBar());
    default: return new PropNode();
  }
}
