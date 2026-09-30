// v4 practice gym (the phone-video look): maple floor with black lines, black block walls, a black ceiling with
// steel trusses and round LED high-bays, and a glass backboard on a dark padded stanchion. The floor, its
// reflections and the net come from the arena module.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { COURT, rng, FX, Z0, FSIZE, TEX, woodCanvas, floorMaterial, makeTextTexture, Net } from './arena.js';

const PX = TEX / FSIZE;
const toPx = (x, z) => [(x + FX) * PX, (z - Z0) * PX];
export const GYM = { wallX: 9.6, backZ: -6.2, farZ: 16.4, ceilY: 9.2, lampY: 7.4 };

function paintGymCourt(g) {
  const C = COURT, line = 0.05 * PX;
  // a slightly darker, more worn stain outside the playing lines
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#d9cbb8';
  const [ax0, az0] = toPx(-FX, Z0), [bx0, bz0] = toPx(FX, Z0 + FSIZE), [cx0, cz0] = toPx(-C.sideX, C.baselineZ), [cx1, cz1] = toPx(C.sideX, C.halfZ);
  g.beginPath(); g.rect(ax0, az0, bx0 - ax0, bz0 - az0); g.rect(cx1, cz0, cx0 - cx1, cz1 - cz0); g.fill('evenodd'); g.restore();
  g.strokeStyle = 'rgba(14,14,16,0.93)'; g.lineWidth = line;
  const seg = (x0, z0, x1, z1) => { const a = toPx(x0, z0), b = toPx(x1, z1); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
  const arc = (cx, cz, r, a0, a1, dash) => { const c = toPx(cx, cz); g.save(); if (dash) g.setLineDash(dash); g.beginPath(); g.arc(c[0], c[1], r * PX, a0, a1); g.stroke(); g.restore(); };
  seg(-C.sideX, C.baselineZ, C.sideX, C.baselineZ); seg(-C.sideX, C.baselineZ, -C.sideX, C.halfZ); seg(C.sideX, C.baselineZ, C.sideX, C.halfZ);
  seg(-C.sideX, C.halfZ, C.sideX, C.halfZ);
  seg(-C.laneHalfW, C.baselineZ, -C.laneHalfW, C.ftZ); seg(C.laneHalfW, C.baselineZ, C.laneHalfW, C.ftZ); seg(-C.laneHalfW, C.ftZ, C.laneHalfW, C.ftZ);
  for (const s of [-1, 1]) for (const d of [2.13, 3.05, 3.96]) seg(s * C.laneHalfW, C.baselineZ + d, s * (C.laneHalfW + 0.15), C.baselineZ + d);
  arc(0, C.ftZ, C.ftR, 0, Math.PI, null); arc(0, C.ftZ, C.ftR, Math.PI, 2 * Math.PI, [0.38 * PX, 0.32 * PX]);
  arc(0, 0, C.raR, 0, Math.PI, null);
  const zc = Math.sqrt(C.threeR ** 2 - C.cornerX ** 2);
  seg(-C.cornerX, C.baselineZ, -C.cornerX, zc); seg(C.cornerX, C.baselineZ, C.cornerX, zc);
  const a0 = Math.atan2(zc, C.cornerX); arc(0, 0, C.threeR, a0, Math.PI - a0, null);
  arc(0, C.halfZ, 1.83, Math.PI, 2 * Math.PI, null);
  // scuffs and rubber marks from years of runs
  const R = rng(31);
  for (let i = 0; i < 900; i++) {
    const x = (R() * 2 - 1) * 8, z = -1 + R() * 16, [px, pz] = toPx(x, z);
    g.strokeStyle = `rgba(30,24,20,${0.03 + R() * 0.07})`; g.lineWidth = 1 + R() * 3;
    const a = R() * Math.PI * 2, l = (0.05 + R() * 0.3) * PX; g.beginPath(); g.moveTo(px, pz); g.quadraticCurveTo(px + Math.cos(a) * l * 0.6 + (R() - 0.5) * 20, pz + Math.sin(a) * l * 0.6, px + Math.cos(a) * l, pz + Math.sin(a) * l); g.stroke();
  }
}

// painted concrete block: near-black with mortar joints and a little sheen variation
function blockTexture(seed, w = 2048, h = 1024) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const R = rng(seed);
  g.fillStyle = '#18191c'; g.fillRect(0, 0, w, h);
  const bw = w / 10, bh = h / 10;
  for (let r = 0; r < 10; r++) for (let k = -1; k < 11; k++) {
    const x = k * bw + (r % 2) * bw / 2, y = r * bh, v = 22 + R() * 7;
    g.fillStyle = `rgb(${v},${v + 1},${v + 3})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.025})`; g.fillRect(x + R() * bw, y + R() * bh, 2 + R() * 6, 2 + R() * 6); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function buildGymHoop(scene) {
  const C = COURT, g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xd9481a, roughness: 0.4, metalness: 0.55 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(C.rimR + 0.009, 0.0095, 12, 64), orange);
  rim.rotation.x = Math.PI / 2; rim.position.set(0, C.rimY, 0); rim.castShadow = true; g.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), orange); bracket.position.set(0, C.rimY - 0.02, C.boardZ + 0.08); g.add(bracket);
  const bw = 1.83, bh = 1.07, by = 2.9 + bh / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.025), new THREE.MeshPhysicalMaterial({
    color: 0xdfe9ef, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 1.4, depthWrite: false }));
  glass.position.set(0, by, C.boardZ - 0.0125); g.add(glass);
  const mark = makeTextTexture(1024, 600, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#f4f4f4'; x.lineWidth = 0.05 * w / bw;
    const s = w / bw; x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
    const iw = 0.61 * s, ih = 0.457 * s; x.strokeRect(w / 2 - iw / 2, h - (0.15 * s) - ih, iw, ih);
  });
  const markMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: mark, transparent: true, roughness: 0.4, depthWrite: false }));
  markMesh.position.set(0, by, C.boardZ + 0.002); g.add(markMesh);
  const black = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.55, metalness: 0.35 });
  const frame = [[bw + 0.06, 0.05, 0, bh / 2 + 0.01], [bw + 0.06, 0.05, 0, -bh / 2 - 0.01], [0.05, bh, bw / 2 + 0.01, 0], [0.05, bh, -bw / 2 - 0.01, 0]];
  for (const [w, h, x, y] of frame) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), black); m.position.set(x, by + y, C.boardZ - 0.02); g.add(m); }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, 0.09, 0.1), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85 }));
  pad.position.set(0, 2.9 - 0.04, C.boardZ - 0.03); g.add(pad);
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.9), black); arm1.position.set(0, 3.25, C.boardZ - 1.5); arm1.castShadow = true; g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), black); arm2.position.set(0, 3.9, C.boardZ - 1.9); arm2.rotation.x = -0.35; arm2.castShadow = true; g.add(arm2);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.2, 0.34), black); post.position.set(0, 1.9, C.boardZ - 3.0); post.castShadow = true; g.add(post);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 2.3), padMat); base.position.set(0, 0.475, C.boardZ - 3.45); base.castShadow = true; g.add(base);
  const padUp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.0, 0.46), padMat); padUp.position.set(0, 1.9, C.boardZ - 3.05); g.add(padUp);
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(g);
}

function buildRoom(scene) {
  const { wallX, backZ, farZ, ceilY, lampY } = GYM;
  const wallTex = blockTexture(5);
  const wallMat = (len, hgt) => { const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(len / 4.0, hgt / 2.0); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 }); };
  const W = [[new THREE.PlaneGeometry(farZ - backZ, ceilY), [wallX, ceilY / 2, (farZ + backZ) / 2], [0, -Math.PI / 2, 0], farZ - backZ],
    [new THREE.PlaneGeometry(farZ - backZ, ceilY), [-wallX, ceilY / 2, (farZ + backZ) / 2], [0, Math.PI / 2, 0], farZ - backZ],
    [new THREE.PlaneGeometry(2 * wallX, ceilY), [0, ceilY / 2, backZ], [0, 0, 0], 2 * wallX],
    [new THREE.PlaneGeometry(2 * wallX, ceilY), [0, ceilY / 2, farZ], [0, Math.PI, 0], 2 * wallX]];
  for (const [geo, p, r, len] of W) { const m = new THREE.Mesh(geo, wallMat(len, ceilY)); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; scene.add(m); }
  // wall padding under the hoop and along the side walls (waist-high mats)
  const matPad = new THREE.MeshStandardMaterial({ color: 0x0e1a33, roughness: 0.85 });
  for (let i = -3; i <= 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 0.08), matPad); p.position.set(i * 1.85, 0.95 + 0.05, backZ + 0.05); p.receiveShadow = true; scene.add(p); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * wallX, farZ - backZ), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY, (farZ + backZ) / 2); scene.add(ceil);
  // steel trusses across the width
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.6 });
  for (let z = backZ + 2.2; z < farZ; z += 4.2) {
    for (const y of [ceilY - 0.25, ceilY - 1.15]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 * wallX, 0.1, 0.1), steel); b.position.set(0, y, z); scene.add(b); }
    for (let x = -wallX + 0.6; x < wallX; x += 1.2) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.28, 0.05), steel); d.position.set(x, ceilY - 0.7, z); d.rotation.z = ((Math.round(x / 1.2) & 1) ? 0.72 : -0.72); scene.add(d);
    }
  }
  // round LED high-bays hanging in a grid
  const lampBody = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.4, metalness: 0.7 });
  const lampFace = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 6.4, 6.2), toneMapped: true });
  const lamps = [];
  for (let x = -6; x <= 6.01; x += 4) for (let z = -2.5; z < farZ - 1; z += 4.2) {
    const L = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 32), lampBody); L.add(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40), lampFace); face.rotation.x = Math.PI / 2; face.position.y = -0.112; L.add(face);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ceilY - lampY - 0.1, 6), lampBody); cord.position.y = (ceilY - lampY) / 2; L.add(cord);
    L.position.set(x, lampY, z); scene.add(L); lamps.push(L.position.clone());
  }
  // a few real-gym details: exit sign, a dark wall scoreboard, a ball rack by the side wall
  const exitTex = makeTextTexture(512, 192, (x, w, h) => { x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, w, h); x.fillStyle = '#39ff6a'; x.font = '800 130px Arial'; x.textAlign = 'center'; x.fillText('EXIT', w / 2, 145); });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: exitTex, toneMapped: false, color: 0xaaaaaa }));
  exit.position.set(-wallX + 0.02, 3.1, 11.0); exit.rotation.y = Math.PI / 2; scene.add(exit);
  const sbTex = makeTextTexture(1024, 512, (x, w, h) => {
    x.fillStyle = '#060606'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a0d0d'; x.font = '800 200px Arial'; x.textAlign = 'center';
    x.fillText('00', w * 0.22, 300); x.fillText('00', w * 0.78, 300); x.fillStyle = '#6a5a0a'; x.font = '800 120px Arial'; x.fillText('0:00', w / 2, 440);
    x.fillStyle = '#d8d8d8'; x.font = '700 70px Arial'; x.fillText('HOME', w * 0.22, 90); x.fillText('GUEST', w * 0.78, 90);
  });
  const sb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.18), [0, 0, 0, 0, 0, 0].map((_, i) => i === 4 ? new THREE.MeshStandardMaterial({ map: sbTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: sbTex, emissiveIntensity: 0.35 }) : new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6 })));
  sb.position.set(-wallX + 0.1, 5.6, 5.5); sb.rotation.y = Math.PI / 2; scene.add(sb);
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.5, metalness: 0.6 });
  const rack = new THREE.Group();
  for (const y of [0.35, 0.8]) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.5), rackMat); r.position.y = y; rack.add(r); }
  for (const x of [-0.78, 0.78]) for (const z of [-0.23, 0.23]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), rackMat); p.position.set(x, 0.45, z); rack.add(p); }
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xb4531f, roughness: 0.75 });
  for (const y of [0.49, 0.94]) for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), ballMat); b.position.set(-0.64 + i * 0.255, y, 0); b.castShadow = true; rack.add(b); }
  rack.position.set(-wallX + 0.5, 0, 9.5); rack.rotation.y = Math.PI / 2; rack.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); scene.add(rack);
  return { lamps };
}

export function buildGym(renderer, scene) {
  scene.background = new THREE.Color(0x040405);
  scene.fog = new THREE.Fog(0x040405, 24, 46);
  const wc = woodCanvas(); paintGymCourt(wc.getContext('2d'));
  const tex = new THREE.CanvasTexture(wc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floorGeo = new THREE.PlaneGeometry(FSIZE, FSIZE);
  const reflector = new Reflector(floorGeo, { textureWidth: Math.round(renderer.domElement.width / 2), textureHeight: Math.round(renderer.domElement.height / 2), multisample: 0 });
  reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0, Z0 + FSIZE / 2); reflector.material.visible = false;
  reflector.textureMatrixRef = reflector.material.uniforms.textureMatrix.value;
  const floor = new THREE.Mesh(floorGeo, floorMaterial(tex, reflector, { blur: 0.011, clamp: 1.1, strength: 0.3 })); floor.rotation.x = -Math.PI / 2; floor.position.copy(reflector.position); floor.receiveShadow = true;
  scene.add(floor, reflector);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.7 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.004; scene.add(outer);
  buildGymHoop(scene);
  const net = new Net(scene);
  const room = buildRoom(scene);
  return { floor, reflector, net, lamps: room.lamps };
}

// Environment for reflections: a dark box with bright round lamps overhead.
export function gymEnvironment() {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, side: THREE.BackSide }));
  box.position.y = 8; env.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x4a3524 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; env.add(floor);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 9.8, 9.4) });
  for (let x = -8; x <= 8; x += 4) for (let z = -8; z <= 12; z += 4.2) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), lampMat); d.rotation.x = Math.PI / 2; d.position.set(x, 9, z); env.add(d); }
  return env;
}
