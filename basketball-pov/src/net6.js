// v6 net: hangs from the (flexing) rim, sways, and is pushed open by the ball going through it - the ball is a sphere
// the strings can't pass, and a ball thrown down drags the bottom of the net with it and lets it snap back.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURT } from './arena.js';

const N = 12, ROWS = 6, LEN = 0.45;

export class NetFlex {
  constructor(scene) {
    this.mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.9 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // the hinge the rim turns about (see gym.js)
    this.hinge = new THREE.Vector3(0, COURT.rimY, COURT.boardZ + 0.01);
    this.update({ angle: 0, ball: null, sway: [0, 0], stretch: 0 });
  }
  // s = { angle: rim flex (rad, + = front down), ball: Vector3|null (centre), sway: [x, z] (m at the bottom),
  //       stretch: extra drop of the bottom rows (m), open: extra flare (0..1) }
  update(s) {
    const C = COURT, R = 0.12, pts = [];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.angle || 0);
    for (let r = 0; r <= ROWS; r++) {
      const v = r / ROWS, row = [];
      for (let i = 0; i < N * 2; i++) {
        const a = (i + (r % 2) * 0.5) / (N * 2) * Math.PI * 2;
        let rad = C.rimR * (1 - 0.42 * v * (1 - 0.35 * (s.open || 0)));
        let y = C.rimY - v * LEN - (s.stretch || 0) * v * v;
        const p = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
        // the top ring is on the rim; lower rows follow the rim's tilt less (they hang) and sway
        const qa = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), q, 1 - 0.55 * v);
        p.sub(this.hinge).applyQuaternion(qa).add(this.hinge);
        p.x += (s.sway ? s.sway[0] : 0) * v * v; p.z += (s.sway ? s.sway[1] : 0) * v * v;
        // the ball: strings can't pass through it - push them out to its surface (with a soft margin)
        if (s.ball && r > 0) {
          const d = p.clone().sub(s.ball), L = d.length(), m = R + 0.012;
          if (L < m + 0.05) { const k = L < m ? 1 : 1 - (L - m) / 0.05; p.addScaledVector(d.normalize(), (m - Math.min(L, m)) + 0.02 * k); }
        }
        row.push(p);
      }
      pts.push(row);
    }
    const geos = [];
    const seg = (p, q2) => {
      const len = p.distanceTo(q2);
      const cg = new THREE.CylinderGeometry(0.0035, 0.0035, len, 4, 1, true);
      const m = new THREE.Matrix4(), dir = q2.clone().sub(p).normalize();
      m.compose(p.clone().add(q2).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
      cg.applyMatrix4(m); geos.push(cg);
    };
    for (let r = 0; r < ROWS; r++) {
      const A = pts[r], B = pts[r + 1];
      for (let i = 0; i < N * 2; i += 2) { const j = (i + 1 + (r % 2 ? 0 : 0)) % (N * 2), k = (i + 2) % (N * 2); seg(A[i], B[j]); seg(A[k], B[j]); }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = mergeGeometries(geos);
  }
}
