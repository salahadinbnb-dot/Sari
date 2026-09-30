// Court + hoop + arena. Units: meters. Basket (rim center) at x=0,z=0; court runs toward +z.
// Offensive player faces -z, so +x is "his right".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const COURT = {
  rimY: 3.05, rimR: 0.2286, baselineZ: -1.6, halfZ: 12.73, sideX: 7.62,
  laneHalfW: 2.44, ftZ: 4.19, ftR: 1.83, threeR: 7.24, cornerX: 6.71, raR: 1.22,
  boardZ: -0.38,
};

// Seeded RNG so every frame/worker builds the identical arena.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Floor canvas covers x in [-FX, FX], z in [Z0, Z0 + 2*FX]
export const FX = 11, Z0 = -5.5, FSIZE = 22, TEX = 4096;
const PX = TEX / FSIZE;
const toPx = (x, z) => [(x + FX) * PX, (z - Z0) * PX];

export function woodCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const g = c.getContext('2d');
  const R = rng(7);
  g.fillStyle = '#c8955c'; g.fillRect(0, 0, TEX, TEX);
  const plankW = 0.057 * PX;
  for (let x = 0; x < TEX; x += plankW) {
    let y = -R() * 400;
    while (y < TEX) {
      const len = (0.7 + R() * 1.8) * PX;
      const t = R();
      const r = 205 + t * 28 + (R() - 0.5) * 10, gg = 152 + t * 24 + (R() - 0.5) * 8, b = 92 + t * 20;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(x, y, plankW, len);
      // grain streaks
      for (let k = 0; k < 7; k++) {
        const gx = x + R() * plankW;
        g.strokeStyle = `rgba(${R() < 0.5 ? '120,70,30' : '255,230,190'},${0.05 + R() * 0.08})`;
        g.lineWidth = 0.6 + R() * 1.2;
        g.beginPath(); g.moveTo(gx, y);
        let yy = y; let xx = gx;
        while (yy < y + len) { yy += 30 + R() * 60; xx += (R() - 0.5) * 1.5; g.lineTo(Math.min(Math.max(xx, x), x + plankW), Math.min(yy, y + len)); }
        g.stroke();
      }
      // knot-ish darker spots, rare
      if (R() < 0.04) { g.fillStyle = 'rgba(110,60,25,0.18)'; g.beginPath(); g.ellipse(x + plankW / 2, y + R() * len, plankW * 0.3, plankW * 1.2, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(80,45,20,0.55)'; g.fillRect(x, y, plankW, 1.2); // end seam
      y += len;
    }
    g.fillStyle = 'rgba(90,50,22,0.35)'; g.fillRect(x, 0, 1, TEX); // side seam
  }
  return c;
}

function paintCourt(g) {
  const C = COURT;
  const line = 0.0508 * PX;
  // out-of-bounds apron: dark navy stain
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#30405e';
  const [ax0, az0] = toPx(-FX, Z0), [bx0, bz0] = toPx(FX, Z0 + FSIZE);
  g.beginPath(); g.rect(ax0, az0, bx0 - ax0, bz0 - az0);
  const [cx0, cz0] = toPx(-C.sideX, C.baselineZ), [cx1, cz1] = toPx(C.sideX, C.halfZ);
  g.rect(cx1, cz0, cx0 - cx1, cz1 - cz0); // reverse winding hole
  g.fill('evenodd');
  // painted lane
  g.fillStyle = '#5f7fd6';
  const [lx0, lz0] = toPx(-C.laneHalfW, C.baselineZ), [lx1, lz1] = toPx(C.laneHalfW, C.ftZ);
  g.fillRect(lx0, lz0, lx1 - lx0, lz1 - lz0);
  g.fillStyle = '#2d4fb0';
  g.fillRect(lx0 + 0.25 * PX, lz0, lx1 - lx0 - 0.5 * PX, lz1 - lz0 - 0.25 * PX);
  g.restore();

  g.strokeStyle = 'rgba(250,250,245,0.95)'; g.fillStyle = 'rgba(250,250,245,0.95)';
  g.lineWidth = line;
  const seg = (x0, z0, x1, z1) => { const a = toPx(x0, z0), b = toPx(x1, z1); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
  const arc = (cx, cz, r, a0, a1, dash) => { const c = toPx(cx, cz); g.save(); if (dash) g.setLineDash(dash); g.beginPath(); g.arc(c[0], c[1], r * PX, a0, a1); g.stroke(); g.restore(); };
  // boundary
  seg(-C.sideX, C.baselineZ, C.sideX, C.baselineZ);
  seg(-C.sideX, C.baselineZ, -C.sideX, C.halfZ);
  seg(C.sideX, C.baselineZ, C.sideX, C.halfZ);
  seg(-C.sideX, C.halfZ, C.sideX, C.halfZ);
  // lane
  seg(-C.laneHalfW, C.baselineZ, -C.laneHalfW, C.ftZ);
  seg(C.laneHalfW, C.baselineZ, C.laneHalfW, C.ftZ);
  seg(-C.laneHalfW, C.ftZ, C.laneHalfW, C.ftZ);
  // lane hash marks
  for (const s of [-1, 1]) {
    for (const d of [2.13, 3.05, 3.96]) { seg(s * C.laneHalfW, C.baselineZ + d, s * (C.laneHalfW + 0.15), C.baselineZ + d); }
    const a = toPx(s * C.laneHalfW, C.baselineZ + 2.13 - 0.3); g.fillRect(s > 0 ? a[0] : a[0] - 0.15 * PX, a[1], 0.15 * PX, 0.3 * PX);
  }
  // free throw circle: outer half solid, inner half dashed
  arc(0, C.ftZ, C.ftR, 0, Math.PI, null);
  arc(0, C.ftZ, C.ftR, Math.PI, 2 * Math.PI, [0.38 * PX, 0.32 * PX]);
  // restricted area
  arc(0, 0, C.raR, 0, Math.PI, null);
  seg(-C.raR, 0, -C.raR, C.boardZ); seg(C.raR, 0, C.raR, C.boardZ);
  // three point line
  const zc = Math.sqrt(C.threeR ** 2 - C.cornerX ** 2);
  seg(-C.cornerX, C.baselineZ, -C.cornerX, zc); seg(C.cornerX, C.baselineZ, C.cornerX, zc);
  const a0 = Math.atan2(zc, C.cornerX);
  arc(0, 0, C.threeR, a0, Math.PI - a0, null);
  // half-court circle
  arc(0, C.halfZ, 1.83, Math.PI, 2 * Math.PI, null);
  // baseline text band
  g.save(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `800 ${0.45 * PX}px BC, Arial`; g.textAlign = 'center';
  const t = toPx(0, C.baselineZ - 0.75); g.translate(t[0], t[1]); g.fillText('R E A D   T H E   D E F E N S E', 0, 0.16 * PX); g.restore();
}

export function floorMaterial(tex, reflector, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tReflect = { value: reflector.getRenderTarget().texture };
    sh.uniforms.reflectMatrix = { value: reflector.textureMatrixRef };
    sh.uniforms.reflectStrength = { value: o.strength ?? 0.34 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 reflectMatrix;\nvarying vec4 vReflUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReflUv = reflectMatrix * vec4(position, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tReflect;\nuniform float reflectStrength;\nvarying vec4 vReflUv;')
      .replace('#include <opaque_fragment>', `
        vec2 ruv = vReflUv.xy / vReflUv.w;
        vec3 refl = vec3(0.0);
        float bl = ${(o.blur ?? 0.0045).toFixed(4)};
        refl += texture2D(tReflect, ruv).rgb * 0.28;
        refl += texture2D(tReflect, ruv + vec2(bl, 0.0)).rgb * 0.12;
        refl += texture2D(tReflect, ruv - vec2(bl, 0.0)).rgb * 0.12;
        refl += texture2D(tReflect, ruv + vec2(0.0, bl * 1.6)).rgb * 0.12;
        refl += texture2D(tReflect, ruv - vec2(0.0, bl * 1.6)).rgb * 0.12;
        refl += texture2D(tReflect, ruv + vec2(bl, bl) * 1.7).rgb * 0.06;
        refl += texture2D(tReflect, ruv - vec2(bl, bl) * 1.7).rgb * 0.06;
        refl += texture2D(tReflect, ruv + vec2(bl, -bl) * 1.7).rgb * 0.06;
        refl += texture2D(tReflect, ruv - vec2(bl, -bl) * 1.7).rgb * 0.06;
        refl = min(refl, vec3(${(o.clamp ?? 1000).toFixed(2)}));
        vec3 vdir = normalize(vViewPosition);
        float fres = 0.55 + 0.45 * pow(1.0 - abs(dot(normalize(normal), -vdir)), 3.0);
        outgoingLight = outgoingLight * (1.0 - 0.18 * fres * reflectStrength) + refl * reflectStrength * fres;
        #include <opaque_fragment>`);
  };
  return mat;
}

export function makeTextTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function buildHoop(scene) {
  const C = COURT;
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xe5531b, roughness: 0.35, metalness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(C.rimR + 0.009, 0.0095, 12, 64), orange);
  rim.rotation.x = Math.PI / 2; rim.position.set(0, C.rimY, 0); rim.castShadow = true; g.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), orange);
  bracket.position.set(0, C.rimY - 0.02, C.boardZ + 0.08); bracket.castShadow = true; g.add(bracket);
  // backboard glass
  const bw = 1.83, bh = 1.07, by = 2.9 + bh / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.025), new THREE.MeshPhysicalMaterial({
    color: 0xdfe9ef, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.2, depthWrite: false }));
  glass.position.set(0, by, C.boardZ - 0.0125); g.add(glass);
  // board markings as a transparent texture plane
  const mark = makeTextTexture(1024, 600, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#ffffff'; x.lineWidth = 0.05 * w / bw;
    const s = w / bw; x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
    const iw = 0.61 * s, ih = 0.457 * s; x.strokeRect(w / 2 - iw / 2, h - (0.15 * s) - ih, iw, ih);
  });
  const markMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: mark, transparent: true, roughness: 0.4, depthWrite: false }));
  markMesh.position.set(0, by, C.boardZ + 0.002); g.add(markMesh);
  // frame + padding
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.6, metalness: 0.2 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.04, 0.06, 0.07), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 }));
  pad.position.set(0, 2.9 - 0.02, C.boardZ - 0.02); g.add(pad);
  // support arm to stanchion
  const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5, metalness: 0.5 });
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.9), armMat); arm1.position.set(0, 3.25, C.boardZ - 1.5); arm1.castShadow = true; g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), armMat); arm2.position.set(0, 3.9, C.boardZ - 1.9); arm2.rotation.x = -0.35; arm2.castShadow = true; g.add(arm2);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.2, 0.34), armMat); post.position.set(0, 1.9, C.boardZ - 3.0); post.castShadow = true; g.add(post);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 2.3), baseMat); base.position.set(0, 0.475, C.boardZ - 3.45); base.castShadow = true; base.receiveShadow = true; g.add(base);
  const padUp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.0, 0.46), baseMat); padUp.position.set(0, 1.9, C.boardZ - 3.05); g.add(padUp);
  // LED strip on stanchion base
  const baseLed = makeTextTexture(1024, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0a1a4a'); gr.addColorStop(1, '#1b3fa0'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.font = '800 130px BC, Arial'; x.textAlign = 'center'; x.fillText('TEST  ·  READ', w / 2, 170);
  });
  const baseFront = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.36), new THREE.MeshBasicMaterial({ map: baseLed, toneMapped: false }));
  baseFront.position.set(0, 0.55, C.boardZ - 3.45 + 1.151); g.add(baseFront);
  g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
  scene.add(g);
  return g;
}

// Net: rebuilt per frame so it can swish.
export class Net {
  constructor(scene) {
    this.mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.9 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.update(0, 0);
  }
  // swish: 0..1 progress of ball passing through, amp: strength
  update(swish, amp) {
    const C = COURT, N = 12, rows = 5, L = 0.44;
    const pts = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const row = [];
      for (let i = 0; i < N * 2; i++) {
        const a = (i + (r % 2) * 0.5) / (N * 2) * Math.PI * 2 * 1.0;
        let rad = C.rimR * (1 - 0.42 * v) ;
        let y = C.rimY - v * L;
        // swish bulge travelling down
        const d = v - swish * 1.3 + 0.15;
        const bulge = amp * Math.exp(-d * d / 0.03);
        rad += bulge * 0.06; y -= bulge * 0.05 * v;
        row.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      pts.push(row);
    }
    const geos = [];
    const seg = (p, q) => {
      const len = p.distanceTo(q);
      const cg = new THREE.CylinderGeometry(0.0035, 0.0035, len, 4, 1, true);
      const m = new THREE.Matrix4();
      const dir = q.clone().sub(p).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.compose(p.clone().add(q).multiplyScalar(0.5), quat, new THREE.Vector3(1, 1, 1));
      cg.applyMatrix4(m); geos.push(cg);
    };
    for (let r = 0; r < rows; r++) {
      const A = pts[r], B = pts[r + 1];
      for (let i = 0; i < N * 2; i += 2) {
        const j = (i + 1) % (N * 2), k = (i + 2) % (N * 2);
        // diamond lattice
        seg(A[i], B[j]); seg(A[k], B[j]);
      }
    }
    const merged = mergeGeometries(geos);
    this.mesh.geometry.dispose();
    this.mesh.geometry = merged;
  }
}

function crowdTexture(seed, wM, rows, seatW) {
  const R = rng(seed);
  const pxPerM = 150;
  const W = Math.min(8192, Math.round(wM * pxPerM)), rowH = 86, H = rows * rowH + 40;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07080c'); bg.addColorStop(1, '#15171d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const shirts = ['#f2f2f2', '#1d3a8a', '#2c5bd6', '#d0d0d0', '#222428', '#8a1c1c', '#2d6ad6', '#e9e9e9', '#3b3b3b', '#c9a227', '#4a4f5a', '#b3122c', '#101216', '#f4d35e'];
  const skins = ['#5a3417', '#8d5524', '#a86b3c', '#c68642', '#e0ac69', '#f1c27d', '#3f2412'];
  const hairs = ['#111111', '#1b1410', '#2a1d14', '#3b2a1c', '#6b4f33', '#0c0c0c', '#8c8c8c'];
  const sw = seatW * pxPerM;
  // rows: index 0 = top of texture (back row), last = front row
  for (let r = 0; r < rows; r++) {
    const y = 20 + r * rowH;
    const dim = 0.42 + 0.58 * (r / (rows - 1)); // back rows darker
    // seat backs
    g.fillStyle = `rgba(28,40,78,${0.9})`; g.fillRect(0, y + rowH * 0.62, W, rowH * 0.3);
    for (let x = R() * sw * 0.5; x < W; x += sw * (0.92 + R() * 0.16)) {
      if (R() < 0.07) continue; // empty seat
      const standing = R() < 0.06;
      const scale = 0.85 + R() * 0.3;
      const cx = x + (R() - 0.5) * 8, base = y + rowH * 0.95;
      const bodyH = (standing ? 78 : 50) * scale, bodyW = 44 * scale;
      const shirt = shirts[Math.floor(R() * shirts.length)];
      g.save();
      const D = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${((n >> 16) & 255) * dim | 0},${((n >> 8) & 255) * dim | 0},${(n & 255) * dim | 0})`; };
      g.fillStyle = D(shirt);
      g.beginPath();
      g.moveTo(cx - bodyW / 2, base); g.lineTo(cx - bodyW / 2 + 3, base - bodyH + 10);
      g.quadraticCurveTo(cx, base - bodyH - 4, cx + bodyW / 2 - 3, base - bodyH + 10); g.lineTo(cx + bodyW / 2, base); g.closePath(); g.fill();
      // arms raised occasionally
      if (R() < 0.08) { g.strokeStyle = D(skins[Math.floor(R() * skins.length)]); g.lineWidth = 7 * scale; g.beginPath(); g.moveTo(cx - bodyW / 2 + 4, base - bodyH + 14); g.lineTo(cx - bodyW / 2 - 6, base - bodyH - 34 * scale); g.stroke(); }
      const hr = 12.5 * scale, hy = base - bodyH - hr + 4;
      g.fillStyle = D(skins[Math.floor(R() * skins.length)]);
      g.beginPath(); g.ellipse(cx, hy, hr * 0.86, hr, 0, 0, 7); g.fill();
      g.fillStyle = D(hairs[Math.floor(R() * hairs.length)]);
      g.beginPath(); g.ellipse(cx, hy - hr * 0.35, hr * 0.9, hr * 0.7, 0, Math.PI, 2 * Math.PI); g.fill();
      if (R() < 0.12) { g.fillStyle = D(shirts[Math.floor(R() * shirts.length)]); g.fillRect(cx - hr, hy - hr * 0.9, hr * 2, hr * 0.5); }
      g.restore();
    }
  }
  // soft blur for depth + subtle haze
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const g2 = c2.getContext('2d'); g2.filter = 'blur(4.5px) saturate(0.75)'; g2.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function buildCrowd(scene) {
  const standMat = new THREE.MeshBasicMaterial({ color: 0x0c0e13 });
  const section = (seed, width, center, yaw, rows, frontDist) => {
    const depth = rows * 0.9, rise = rows * 0.42;
    const len = Math.hypot(depth, rise);
    const tex = crowdTexture(seed, width, rows, 0.56);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x7c7c80 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
    const grp = new THREE.Group();
    plane.position.set(0, 0.55 + rise / 2, -frontDist - depth / 2);
    plane.rotation.x = -Math.atan2(depth, rise);
    grp.add(plane);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.7), standMat);
    wall.position.set(0, 0.35, -frontDist); grp.add(wall);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width + 20, 30), standMat);
    back.position.set(0, 10, -frontDist - depth - 0.5); grp.add(back);
    grp.position.copy(center); grp.rotation.y = yaw;
    scene.add(grp);
  };
  section(11, 34, new THREE.Vector3(0, 0, -1.6), 0, 20, 4.6);
  section(12, 30, new THREE.Vector3(-7.62, 0, 6), Math.PI / 2, 20, 3.0);
  section(13, 30, new THREE.Vector3(7.62, 0, 6), -Math.PI / 2, 20, 3.0);
}

function buildLedBoards(scene, words = ['TEST THE DRIVE', 'CHECKPOINT', 'USE THE SCREEN', 'READ THE HELP', 'HOOPS IQ']) {
  const tex = makeTextTexture(4096, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1d52'); gr.addColorStop(1, '#07102e'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.font = '800 118px BC, Arial'; x.textBaseline = 'middle';
    let px = 60, i = 0;
    while (px < w) { const t = words[i++ % words.length]; x.fillStyle = i % 2 ? '#ffffff' : '#f6c343'; x.fillText(t, px, h / 2 + 6); px += x.measureText(t).width + 160; x.fillStyle = '#3d6bff'; x.fillRect(px - 100, h / 2 - 12, 24, 24); }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(1, 1);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.95), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0x9a9a9a }));
  led.position.set(0, 0.5, -5.0); scene.add(led);
  const back = new THREE.Mesh(new THREE.BoxGeometry(24.2, 1.05, 0.25), new THREE.MeshStandardMaterial({ color: 0x0b0d12 }));
  back.position.set(0, 0.52, -5.14); scene.add(back);
}

export function buildArena(renderer, scene, opts = {}) {
  scene.background = new THREE.Color(0x07080b);
  scene.fog = new THREE.Fog(0x07080b, 20, 42);
  // floor
  const wc = woodCanvas();
  paintCourt(wc.getContext('2d'));
  const tex = new THREE.CanvasTexture(wc);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const floorGeo = new THREE.PlaneGeometry(FSIZE, FSIZE);
  const reflector = new Reflector(floorGeo, { textureWidth: Math.round(renderer.domElement.width / 2), textureHeight: Math.round(renderer.domElement.height / 2), multisample: 0 });
  reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0, Z0 + FSIZE / 2);
  reflector.material.visible = false; // we only use its render target + matrix
  // expose texture matrix (Reflector keeps it in its material uniforms)
  reflector.textureMatrixRef = reflector.material.uniforms.textureMatrix.value;
  const floor = new THREE.Mesh(floorGeo, floorMaterial(tex, reflector));
  floor.rotation.x = -Math.PI / 2; floor.position.copy(reflector.position);
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(reflector);
  // dark surround floor beyond canvas
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.8 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.005; scene.add(outer);
  buildHoop(scene);
  const net = new Net(scene);
  if (!new URLSearchParams(location.search).has('nocrowd')) buildCrowd(scene);
  buildLedBoards(scene, opts.ledWords);
  return { floor, reflector, net };
}

// Dark arena environment for reflections: dim bowl, bright ceiling light banks, LED ribbon.
export function arenaEnvironment() {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y; vec3 top = vec3(0.05,0.055,0.07); vec3 mid = vec3(0.11,0.1,0.1); vec3 bot = vec3(0.16,0.12,0.08);
      vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, y)) : mix(mid, bot, smoothstep(0.0, -0.4, -y) ); gl_FragColor = vec4(c, 1.0); }`,
  }));
  env.add(sky);
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.6, 8) });
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), lightMat);
    p.position.set(i * 7, 22, j * 9 + 4); p.rotation.x = Math.PI / 2; env.add(p);
  }
  const led = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 1.2, 64, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.4, 1.2), side: THREE.BackSide }));
  led.position.y = 9; env.add(led);
  return env;
}
