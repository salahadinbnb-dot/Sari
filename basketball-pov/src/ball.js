import * as THREE from 'three';
import { BALL_R } from './world.js';
import { rng } from './arena.js';

export function makeBall(scene) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#c4581f'; g.fillRect(0, 0, W, H);
  const R = rng(99);
  // pebble grain
  for (let i = 0; i < 90000; i++) {
    const x = R() * W, y = R() * H, r = 1 + R() * 2.2;
    g.fillStyle = R() < 0.5 ? `rgba(90,30,5,${0.1 + R() * 0.12})` : `rgba(255,170,110,${0.06 + R() * 0.08})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // seams on the sphere (equirect): two great circles + two curved seams
  g.strokeStyle = '#1b120d'; g.lineWidth = 11; g.lineCap = 'round';
  const toUV = (v) => { const u = 0.5 + Math.atan2(v.z, v.x) / (2 * Math.PI); const vv = 0.5 - Math.asin(Math.max(-1, Math.min(1, v.y))) / Math.PI; return [u * W, vv * H]; };
  const drawCurve = (fn) => {
    let prev = null;
    for (let i = 0; i <= 720; i++) {
      const p = toUV(fn(i / 720 * Math.PI * 2));
      if (prev && Math.abs(p[0] - prev[0]) < W / 2) { g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); }
      prev = p;
    }
  };
  drawCurve(a => new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));       // equator
  drawCurve(a => new THREE.Vector3(0, Math.sin(a), Math.cos(a)));       // meridian x=0
  drawCurve(a => new THREE.Vector3(Math.sin(a), Math.cos(a), 0));       // meridian z=0
  const k = 0.62, rr = Math.sqrt(1 - k * k);
  drawCurve(a => new THREE.Vector3(k, rr * Math.cos(a), rr * Math.sin(a)));
  drawCurve(a => new THREE.Vector3(-k, rr * Math.cos(a), rr * Math.sin(a)));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0, envMapIntensity: 0.6 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
