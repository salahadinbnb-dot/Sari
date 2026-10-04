// v5 floor balance meter, drawn on the maple under the defender: his base (a ring around his feet) and an arrow from
// his centre of mass to where his momentum is taking it (the extrapolated CoM). Red while that point stays inside
// his feet (he can still contest), green once it leaves them (on his heels, leaning, or not set).
import * as THREE from 'three';

const RED = new THREE.Color(1.0, 0.16, 0.2), GREEN = new THREE.Color(0.16, 1.0, 0.42);
const Y = 0.007;

function hull(pts) {
  const p = pts.map(v => [v.x, v.z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// rounded outline: offset the hull outward and round each corner with a few arc points
function rounded(h, r, steps = 6) {
  const out = [], n = h.length;
  for (let i = 0; i < n; i++) {
    const a = h[(i + n - 1) % n], b = h[i], c = h[(i + 1) % n];
    const n0 = norm([b[1] - a[1], -(b[0] - a[0])]), n1 = norm([c[1] - b[1], -(c[0] - b[0])]);
    let a0 = Math.atan2(n0[1], n0[0]), a1 = Math.atan2(n1[1], n1[0]);
    while (a1 < a0) a1 += 2 * Math.PI;
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    for (let k = 0; k <= steps; k++) { const t = a0 + (a1 - a0) * k / steps; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); }
  }
  return out;
}
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

export class FloorMeter {
  constructor(scene, opts = {}) {
    this.invert = !!opts.invert;
    this.group = new THREE.Group(); this.group.renderOrder = 5; scene.add(this.group);
    const mat = (opacity) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    this.mFill = mat(0.24); this.mLine = mat(1); this.mDot = mat(1); this.mGlow = mat(0.4); this.mGlow.blending = THREE.AdditiveBlending;
    const mesh = (m) => { const o = new THREE.Mesh(new THREE.BufferGeometry(), m); o.frustumCulled = false; o.renderOrder = 5; this.group.add(o); return o; };
    this.fill = mesh(this.mFill); this.line = mesh(this.mLine); this.arrow = mesh(this.mDot); this.glow = mesh(this.mGlow);
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.065, 32), this.mDot); this.dot.rotation.x = -Math.PI / 2;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 48), this.mDot); this.ring.rotation.x = -Math.PI / 2;
    for (const o of [this.dot, this.ring]) { o.renderOrder = 6; o.frustumCulled = false; this.group.add(o); }
  }
  setColor(open, alpha) {
    // (invert: the defender is you, so his balance is the good news - green while he's set, red once he's beat)
    const c = RED.clone().lerp(GREEN, this.invert ? 1 - open : open).multiplyScalar(1.7);
    for (const m of [this.mFill, this.mLine, this.mDot, this.mGlow]) m.color.copy(c);
    this.mFill.opacity = 0.24 * alpha; this.mLine.opacity = alpha; this.mDot.opacity = alpha; this.mGlow.opacity = 0.4 * alpha;
  }
  update(b, alpha = 1) {
    this.group.visible = alpha > 0.01;
    if (!this.group.visible) return;
    this.setColor(b.open, alpha);
    const ring = rounded(hull(b.base), 0.06), n = ring.length;
    const cx = ring.reduce((s, p) => s + p[0], 0) / n, cz = ring.reduce((s, p) => s + p[1], 0) / n;
    // fill (fan) and outline (ribbon)
    const fp = [cx, Y, cz], fi = [];
    ring.forEach((p, i) => { fp.push(p[0], Y, p[1]); fi.push(0, 1 + i, 1 + (i + 1) % n); });
    this.setGeo(this.fill, fp, fi);
    this.setGeo(this.line, ...this.ribbon(ring, 0.036, true));
    this.setGeo(this.glow, ...this.ribbon(ring, 0.12, true));
    // arrow: centre of mass -> where his momentum carries it
    const c = b.c, d = [b.x.x - c.x, b.x.z - c.z], L0 = Math.hypot(d[0], d[1]), L = Math.min(L0, 0.9);
    const x = L0 > L ? { x: c.x + d[0] * L / L0, z: c.z + d[1] * L / L0 } : b.x;
    this.dot.position.set(x.x, Y + 0.001, x.z); this.ring.position.set(x.x, Y + 0.001, x.z);
    if (L > 0.27) {
      const u = [d[0] / L, d[1] / L], s = [-u[1], u[0]], head = 0.11, w = 0.032, e = [x.x - u[0] * 0.13, x.z - u[1] * 0.13];
      const tip = [e[0], e[1]], back = [tip[0] - u[0] * head, tip[1] - u[1] * head];
      const P = [c.x + s[0] * w / 2, c.z + s[1] * w / 2, c.x - s[0] * w / 2, c.z - s[1] * w / 2, back[0] - s[0] * w / 2, back[1] - s[1] * w / 2, back[0] + s[0] * w / 2, back[1] + s[1] * w / 2,
        back[0] + s[0] * head * 0.6, back[1] + s[1] * head * 0.6, back[0] - s[0] * head * 0.6, back[1] - s[1] * head * 0.6, tip[0], tip[1]];
      const pos = []; for (let i = 0; i < P.length; i += 2) pos.push(P[i], Y + 0.0005, P[i + 1]);
      this.setGeo(this.arrow, pos, [0, 1, 2, 0, 2, 3, 4, 5, 6]);
      this.arrow.visible = true;
    } else this.arrow.visible = false;
  }
  ribbon(pts, w, closed) {
    const n = pts.length, pos = [], idx = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
      const t = norm([c[0] - a[0], c[1] - a[1]]), nn = [t[1], -t[0]];
      pos.push(b[0] + nn[0] * w / 2, Y, b[1] + nn[1] * w / 2, b[0] - nn[0] * w / 2, Y, b[1] - nn[1] * w / 2);
    }
    for (let i = 0; i < (closed ? n : n - 1); i++) { const j = (i + 1) % n; idx.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j); }
    return [pos, idx];
  }
  setGeo(mesh, pos, idx) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    mesh.geometry.dispose(); mesh.geometry = g;
  }
}
