// 3D floor telestration: glowing ribbons/arrows, rings, zones. Hidden from the floor reflection pass.
import * as THREE from 'three';

const Y = 0.014;
export class Overlays {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 5;
    scene.add(this.group);
    this.items = [];
  }
  clear() { for (const m of this.items) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); } this.items = []; }

  // polyline ribbon with optional arrowhead; progress 0..1 draws along the path
  ribbon(points, { color = 0xffffff, width = 0.16, progress = 1, opacity = 0.9, dashed = false, arrow = true, glow = 0.6 } = {}) {
    const pts = smoothPts(points.map(p => new THREE.Vector2(p[0], p[1])), 10);
    // cumulative length
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = L[L.length - 1];
    const head = arrow ? Math.min(0.55, total * 0.35) : 0;
    const shaft = total - head;
    const pos = [], uv = [], idx = [];
    const push = (x, z, u, v) => { pos.push(x, Y, z); uv.push(u, v); };
    let n = 0;
    for (let i = 0; i < pts.length; i++) {
      if (L[i] > shaft + 1e-6 && arrow) break;
      const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
      const d = b.clone().sub(a).normalize(); const nrm = new THREE.Vector2(-d.y, d.x);
      push(pts[i].x + nrm.x * width / 2, pts[i].y + nrm.y * width / 2, L[i] / total, 0);
      push(pts[i].x - nrm.x * width / 2, pts[i].y - nrm.y * width / 2, L[i] / total, 1);
      if (n > 0) { const k = n * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      n++;
    }
    if (arrow) {
      // arrowhead triangle at the end
      const e = pts[pts.length - 1];
      let j = pts.length - 1; while (j > 0 && L[pts.length - 1] - L[j] < head) j--;
      const bpt = pts[j];
      const d = e.clone().sub(bpt).normalize(); const nrm = new THREE.Vector2(-d.y, d.x);
      const base = e.clone().addScaledVector(d, -head);
      const k = n * 2;
      // connect shaft end to base
      push(base.x + nrm.x * width / 2, base.y + nrm.y * width / 2, shaft / total, 0);
      push(base.x - nrm.x * width / 2, base.y - nrm.y * width / 2, shaft / total, 1);
      if (n > 0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      push(base.x + nrm.x * width * 1.45, base.y + nrm.y * width * 1.45, shaft / total, -0.5);
      push(base.x - nrm.x * width * 1.45, base.y - nrm.y * width * 1.45, shaft / total, 1.5);
      push(e.x, e.y, 1, 0.5);
      idx.push(k + 2, k + 3, k + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(color) }, progress: { value: progress }, opacity: { value: opacity }, dashed: { value: dashed ? total / 0.32 : 0 }, glow: { value: glow } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float progress, opacity, dashed, glow; varying vec2 vUv;
        void main(){
          if (vUv.x > progress) discard;
          if (dashed > 0.0 && fract(vUv.x * dashed) > 0.55 && vUv.x < 0.985) discard;
          float d = abs(clamp(vUv.y, -0.5, 1.5) - 0.5);
          if (vUv.y < -0.01 || vUv.y > 1.01) d = 0.3;
          float core = 1.0 - smoothstep(0.1, 0.2, d);
          float body = 1.0 - smoothstep(0.3, 0.38, d);
          float outline = 1.0 - smoothstep(0.42, 0.5, d);
          vec3 c = mix(vec3(0.02, 0.03, 0.07), color, body);
          c = mix(c, mix(color, vec3(1.0), 0.5), core * glow);
          float a = opacity * max(outline * 0.6, body);
          gl_FragColor = vec4(c, a);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; mesh.frustumCulled = false;
    this.group.add(mesh); this.items.push(mesh);
    return mesh;
  }

  ring(x, z, { r = 0.55, color = 0x2f6bff, opacity = 0.9, width = 0.07, pulse = 0 } = {}) {
    const g = new THREE.RingGeometry(r - width * 2.5, r + width * 2.5, 72, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { color: { value: new THREE.Color(color) }, r: { value: r }, w: { value: width }, opacity: { value: opacity } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float r, w, opacity; varying vec3 vP;
        void main(){ float d = abs(length(vP.xz) - r); float core = 1.0 - smoothstep(w*0.35, w*0.6, d); float glow = exp(-d*d/(w*w*1.6));
          gl_FragColor = vec4(mix(color, vec3(1.0), core*0.55), opacity * max(core, glow*0.55)); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, Y + 0.001, z); mesh.renderOrder = 6; mesh.frustumCulled = false;
    this.group.add(mesh); this.items.push(mesh);
    return mesh;
  }

  disc(x, z, { r = 0.6, color = 0x2f6bff, opacity = 0.35 } = {}) {
    const g = new THREE.CircleGeometry(r, 64); g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { color: { value: new THREE.Color(color) }, r: { value: r }, opacity: { value: opacity } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float r, opacity; varying vec3 vP; void main(){ float d = length(vP.xz)/r; gl_FragColor = vec4(color, opacity * (1.0 - smoothstep(0.55, 1.0, d))); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, Y, z); mesh.renderOrder = 5; mesh.frustumCulled = false;
    this.group.add(mesh); this.items.push(mesh);
    return mesh;
  }

  // soft polygon zone
  zone(poly, { color = 0x22c55e, opacity = 0.25 } = {}) {
    const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1])));
    const g = new THREE.ShapeGeometry(shape, 12); g.rotateX(-Math.PI / 2);
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity }, bmin: { value: new THREE.Vector2(Math.min(...xs), Math.min(...zs)) }, bmax: { value: new THREE.Vector2(Math.max(...xs), Math.max(...zs)) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; uniform vec2 bmin, bmax; varying vec3 vP;
        void main(){ vec2 q = (vP.xz - bmin) / (bmax - bmin);
          float e = smoothstep(0.0, 0.08, q.x) * smoothstep(1.0, 0.92, q.x) * smoothstep(0.0, 0.06, q.y) * smoothstep(1.0, 0.94, q.y);
          float stripe = step(0.5, fract((vP.x + vP.z) * 1.6));
          gl_FragColor = vec4(color, opacity * e * (0.45 + 0.55 * stripe)); }`,
    });
    m.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(g, m); mesh.position.y = Y - 0.002; mesh.renderOrder = 4; mesh.frustumCulled = false;
    this.group.add(mesh); this.items.push(mesh);
    return mesh;
  }

  // vertical translucent "wall" (blocked path)
  wall(a, b, { h = 1.9, color = 0xff2a3d, opacity = 0.35 } = {}) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.PlaneGeometry(len, h);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
        void main(){ float stripe = step(0.5, fract((vUv.x*6.0 + vUv.y*3.0))); float fade = (1.0 - vUv.y) * 0.8 + 0.2; float edge = smoothstep(0.0,0.05,vUv.x)*smoothstep(1.0,0.95,vUv.x);
          gl_FragColor = vec4(color, opacity * fade * edge * (0.65 + 0.35*stripe)); }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    mesh.renderOrder = 7; mesh.frustumCulled = false;
    this.group.add(mesh); this.items.push(mesh);
    return mesh;
  }
}

function smoothPts(pts, sub) {
  if (pts.length < 3) {
    const out = []; for (let i = 0; i <= sub; i++) out.push(pts[0].clone().lerp(pts[pts.length - 1], i / sub)); return out;
  }
  const curve = new THREE.SplineCurve(pts);
  return curve.getSpacedPoints(Math.max(8, pts.length * sub));
}

// 2K-style player indicator texture (ring + facing notch)
export function makeIndicator(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const cx = 256, r = 196;
  g.clearRect(0, 0, 512, 512);
  const grad = g.createRadialGradient(cx, cx, r - 40, cx, cx, r + 40);
  grad.addColorStop(0, 'rgba(40,110,255,0)'); grad.addColorStop(0.5, 'rgba(40,110,255,0.55)'); grad.addColorStop(1, 'rgba(40,110,255,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(cx, cx, r + 40, 0, 7); g.fill();
  g.lineWidth = 16; g.strokeStyle = 'rgba(70,140,255,0.98)'; g.beginPath(); g.arc(cx, cx, r, 0.35 - Math.PI / 2, -0.35 - Math.PI / 2 + 2 * Math.PI); g.stroke();
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(cx, cx, r - 16, 0.4 - Math.PI / 2, -0.4 - Math.PI / 2 + 2 * Math.PI); g.stroke();
  // facing notch (pointing up in texture = forward)
  g.fillStyle = 'rgba(255,255,255,0.98)'; g.beginPath(); g.moveTo(cx, cx - r - 36); g.lineTo(cx - 34, cx - r + 14); g.lineTo(cx + 34, cx - r + 14); g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 6; mesh.frustumCulled = false;
  const holder = new THREE.Group(); holder.add(mesh);
  scene.add(holder);
  return holder;
}
