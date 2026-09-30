// Skeleton view: draws a player as a mocap-style skeleton (bones + joints) from the solved rig instead of the skinned
// model. It is the same motion the model plays, shown bare. Instanced so each player costs two draw calls.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
const SPINE = 0.034, LIMB = 0.029, FOOT = 0.022, FINGER = 0.008;
const side = (s) => [
  [`${s}_Thigh`, `${s}_Calf`, LIMB + 0.003], [`${s}_Calf`, `${s}_Foot`, LIMB], [`${s}_Foot`, `${s}_Toe0`, FOOT], [`${s}_Toe0`, `${s}_ToeTip`, FOOT - 0.004],
  ['Neck', `${s}_Clavicle`, LIMB - 0.004], [`${s}_Clavicle`, `${s}_UpperArm`, LIMB - 0.004], [`${s}_UpperArm`, `${s}_Forearm`, LIMB], [`${s}_Forearm`, `${s}_Hand`, LIMB - 0.004],
  ...[0, 1, 2, 3, 4].flatMap(f => [[`${s}_Hand`, `${s}_Finger${f}`, FINGER + 0.002], [`${s}_Finger${f}`, `${s}_Finger${f}1`, FINGER],
    [`${s}_Finger${f}1`, `${s}_Finger${f}2`, FINGER], [`${s}_Finger${f}2`, `${s}_Finger${f}Tip`, FINGER - 0.001]]),
];
const BONES = [
  ['Root', 'Spine', SPINE], ['Spine', 'Spine1', SPINE], ['Spine1', 'Spine2', SPINE], ['Spine2', 'Neck', SPINE - 0.004], ['Neck', 'Head', SPINE - 0.006],
  ['Root', 'L_Thigh', LIMB], ['Root', 'R_Thigh', LIMB], ['L_Thigh', 'R_Thigh', 0.012],
  ...side('L'), ...side('R'),
];
const JOINTS = [
  ['Root', 0.045], ['Spine1', 0.036], ['Neck', 0.034],
  ...['L', 'R'].flatMap(s => [[`${s}_Thigh`, 0.042], [`${s}_Calf`, 0.04], [`${s}_Foot`, 0.035], [`${s}_Toe0`, 0.024], [`${s}_UpperArm`, 0.04],
    [`${s}_Forearm`, 0.035], [`${s}_Hand`, 0.028]]),
];

export function makeSkeleton(scene, style) {
  const mBone = new THREE.MeshStandardMaterial({ color: style.bone, roughness: 0.4, metalness: 0.05, emissive: style.glow, emissiveIntensity: 0.18 });
  const mJoint = new THREE.MeshStandardMaterial({ color: style.joint, roughness: 0.3, metalness: 0.1, emissive: style.glow, emissiveIntensity: 0.55 });
  const bones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1), mBone, BONES.length);
  const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), mJoint, JOINTS.length + 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mJoint);
  for (const m of [bones, joints, head]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
  const P = {}, M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), d = new THREE.Vector3();
  const at = (name) => P[name] || (P[name] = new THREE.Vector3());

  return {
    update(rig) {
      rig.root.updateMatrixWorld(true);
      for (const [n, b] of Object.entries(rig.b)) if (!/^(L|R|M)[A-Z]/.test(n) || /_/.test(n)) b.getWorldPosition(at(n));
      // tips the rig has no bones for: toes and fingertips carry on along their last segment
      for (const sd of ['L', 'R']) {
        at(`${sd}_ToeTip`).copy(P[`${sd}_Toe0`]).lerp(P[`${sd}_Foot`], -0.45);
        for (const f of [0, 1, 2, 3, 4]) at(`${sd}_Finger${f}Tip`).copy(P[`${sd}_Finger${f}2`]).lerp(P[`${sd}_Finger${f}1`], -0.85);
      }
      BONES.forEach(([a, b, r], i) => {
        const A = P[a], B = P[b]; d.subVectors(B, A); const len = d.length();
        if (len < 1e-4) { M.makeScale(0, 0, 0); bones.setMatrixAt(i, M); return; }
        q.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
        M.compose(s.addVectors(A, B).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
        bones.setMatrixAt(i, M);
      });
      JOINTS.forEach(([n, r], i) => { M.compose(P[n], q.identity(), new THREE.Vector3(r, r, r)); joints.setMatrixAt(i, M); });
      // head: a skull on the end of the neck, plus a small marker for the way the face points
      const up = d.subVectors(P.Head, P.Neck).normalize();
      const c = P.Head.clone().addScaledVector(up, 0.095);
      head.position.copy(c); head.scale.set(0.1, 0.112, 0.1); head.quaternion.setFromUnitVectors(UP, up);
      rig.b.Head.getWorldQuaternion(q); q.multiply(rig.restModel.Head.clone().invert());
      const nose = c.clone().addScaledVector(FWD.clone().applyQuaternion(q), 0.1);
      M.compose(nose, q.identity(), new THREE.Vector3(0.024, 0.024, 0.024)); joints.setMatrixAt(JOINTS.length, M);
      bones.instanceMatrix.needsUpdate = true; joints.instanceMatrix.needsUpdate = true;
    },
  };
}
