// Anatomical skeleton on the mocap rig. The bone meshes come from the OpenSim full-body model (tools/bones.py, in its
// default stance: x forward, y up, z right, metres). Each piece is placed onto the Rocketbox rig's bind pose by
// lining up joint centres and the axis the rig's IK aims (knee/elbow poles, the thumb side of the hand), then
// skinned rigidly to the rig bone that carries it, so the same solved pose that drives the 3D players drives this.
// The spine bends vertebra by vertebra and each rib follows its own vertebra.
import * as THREE from 'three';

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const nameOf = (b) => b.name.replace('Bip01_', '').replace('Bip01', 'Root');
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export async function loadBones(base) {
  const meta = await (await fetch(base + '/bones.json')).json();
  const buf = await (await fetch(base + '/bones.bin')).arrayBuffer();
  return { meta, V: new Float32Array(buf, 0, meta.verts * 6), F: new Uint32Array(buf, meta.verts * 24, meta.tris * 3) };
}

// frame: long axis a (unit), reference r made perpendicular -> 3x3 basis as Matrix4
function basis(a, r) {
  const e1 = a.clone().normalize(), e2 = r.clone().addScaledVector(e1, -r.dot(e1)).normalize(), e3 = new THREE.Vector3().crossVectors(e1, e2);
  return new THREE.Matrix4().makeBasis(e1, e2, e3);
}
// affine map taking OpenSim segment (P0 -> P1, reference rOS) onto rig segment (Q0 -> Q1, reference rB)
function segMap(P0, P1, rOS, Q0, Q1, rB, scale) {
  const E = basis(P1.clone().sub(P0), rOS), F = basis(Q1.clone().sub(Q0), rB);
  const R = F.multiply(E.transpose());
  const s = scale ?? Q1.distanceTo(Q0) / P1.distanceTo(P0);
  return new THREE.Matrix4().makeTranslation(Q0.x, Q0.y, Q0.z).multiply(R).multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-P0.x, -P0.y, -P0.z));
}

// opts: { feet: false } drops the foot bones (hidden in shoes)
export function makeBoneSkeleton(data, playerMesh, opts = {}) {
  const { meta, V, F } = data, sk = playerMesh.skeleton;
  const idx = {}; sk.bones.forEach((b, i) => { idx[nameOf(b)] = i; });
  const bw = {}; for (const n of Object.keys(idx)) bw[n] = sk.boneInverses[idx[n]].clone().invert();
  const J = (n) => new THREE.Vector3().setFromMatrixPosition(bw[n]);
  const ax = (n, k) => new THREE.Vector3().setFromMatrixColumn(bw[n], k).normalize();
  const jt = meta.joints, lm = meta.landmarks;

  // whole-body orientation: OpenSim (fwd, up, right) -> bind (fwd, up, right)
  const up = J('Head').sub(J('Pelvis')).normalize(), right = J('R_Thigh').sub(J('L_Thigh')).normalize();
  const fwd = new THREE.Vector3().crossVectors(up, right).normalize(); right.crossVectors(fwd, up).normalize();
  const R0 = new THREE.Matrix4().makeBasis(fwd, up, right);
  // torso: vertical anchors hips -> shoulders -> skull base; shapes keep one scale
  const hipOS = V3(jt.hip_r).add(V3(jt.hip_l)).multiplyScalar(0.5), hipB = J('R_Thigh').add(J('L_Thigh')).multiplyScalar(0.5);
  const shOS = V3(jt.acromial_r).add(V3(jt.acromial_l)).multiplyScalar(0.5), shB = J('R_UpperArm').add(J('L_UpperArm')).multiplyScalar(0.5);
  const skOS = V3(lm.skull_base), skB = J('Head');
  const sT = (shB.y - hipB.y) / (shOS.y - hipOS.y);
  const yMap = (y) => y <= shOS.y ? hipB.y + (y - hipOS.y) * sT : shB.y + (y - shOS.y) * (skB.y - shB.y) / (skOS.y - shOS.y);
  const torsoPoint = (p) => { // OpenSim torso point -> bind point (horizontal about the hips, vertical piecewise)
    const d = p.clone().sub(hipOS).multiplyScalar(sT).applyMatrix4(R0); const q = hipB.clone().add(d); q.y = yMap(p.y); return q;
  };
  const rigid = (c, target) => new THREE.Matrix4().makeTranslation(target.x, target.y, target.z).multiply(R0)
    .multiply(new THREE.Matrix4().makeScale(sT, sT, sT)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));

  // spine weights by bind height: each bone owns the stretch above its joint, blended across the joints
  const chain = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].map(n => [n, J(n).y]);
  const blend = 0.035 * (J('Head').y - J('Pelvis').y) / 0.7;
  const spineW = (y) => {
    const w = {}; let prev = chain[0][0]; w[prev] = 1;
    for (let k = 1; k < chain.length; k++) {
      const [n, h] = chain[k], u = smooth((y - (h - blend)) / (2 * blend));
      if (u <= 0) break;
      for (const key of Object.keys(w)) w[key] *= 1 - u;
      w[n] = (w[n] || 0) + u; prev = n;
    }
    return w;
  };

  // limb segment maps (right side; the left mirrors the names)
  const seg = {};
  for (const S of ['R', 'L']) {
    const s = S.toLowerCase();
    const hip = V3(jt['hip_' + s]), knee = V3(jt['walker_knee_' + s]), ankle = V3(jt['ankle_' + s]), mtp = V3(jt['mtp_' + s]);
    const sh = V3(jt['acromial_' + s]), el = V3(jt['elbow_' + s]), wr = V3(jt['radius_hand_' + s]);
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), back = new THREE.Vector3(-1, 0, 0);
    seg[S] = {
      femur: segMap(hip, knee, X, J(S + '_Thigh'), J(S + '_Calf'), ax(S + '_Thigh', 1)),
      shank: segMap(knee, ankle, X, J(S + '_Calf'), J(S + '_Foot'), ax(S + '_Calf', 1)),
      foot: segMap(ankle, mtp, Y, J(S + '_Foot'), J(S + '_Toe0'), up),
      humerus: segMap(sh, el, back, J(S + '_UpperArm'), J(S + '_Forearm'), ax(S + '_UpperArm', 1)),
      forearm: segMap(el, wr, back, J(S + '_Forearm'), J(S + '_Hand'), ax(S + '_Forearm', 1)),
      hand: (() => { // wrist -> middle knuckle, thumb side as the reference
        const P1 = V3(lm['mcp3_' + s]), th = V3(lm['thumb_' + s]).sub(wr), Q1 = J(S + '_Finger2'), thB = J(S + '_Finger0').sub(J(S + '_Hand'));
        return segMap(wr, P1, th, J(S + '_Hand'), Q1, thB);
      })(),
    };
  }
  // pelvis: hips onto the rig's hip joints (wider apart than the source), otherwise the torso scale
  const lat = J('R_Thigh').distanceTo(J('L_Thigh')) / V3(jt.hip_r).distanceTo(V3(jt.hip_l));
  const pelvisM = new THREE.Matrix4().makeTranslation(hipB.x, hipB.y, hipB.z).multiply(R0).multiply(new THREE.Matrix4().makeScale(sT, sT, lat))
    .multiply(new THREE.Matrix4().makeTranslation(-hipOS.x, -hipOS.y, -hipOS.z));

  // assemble
  const pos = [], nrm = [], si = [], sw = [], ind = [];
  let vbase = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const b of meta.bones) {
    if (opts.feet === false && (b.part === 'foot' || b.part === 'toes')) continue;
    const S = b.side === 'l' ? 'L' : 'R';
    let M, W = null, perVertex = null;
    const c = V3(b.centroid);
    switch (b.part) {
      case 'femur': M = seg[S].femur; W = { [S + '_Thigh']: 1 }; break;
      case 'tibia': case 'fibula': case 'patella': M = seg[S].shank; W = { [S + '_Calf']: 1 }; break;
      case 'talus': case 'foot': M = seg[S].foot; W = { [S + '_Foot']: 1 }; break;
      case 'toes': M = seg[S].foot; W = { [S + '_Toe0']: 1 }; break;
      case 'humerus': M = seg[S].humerus; W = { [S + '_UpperArm']: 1 }; break;
      case 'ulna': case 'radius': M = seg[S].forearm; W = { [S + '_Forearm']: 1 }; break;
      case 'hand': M = seg[S].hand; W = { [S + '_Hand']: 1 }; break;
      case 'pelvis': case 'sacrum': M = pelvisM; W = { Spine: 1 }; break;
      case 'skull': case 'jaw': M = rigid(skOS, skB.clone().add(new THREE.Vector3(0, 0, 0))); W = { Head: 1 }; break;
      case 'scapula': case 'clavicle': M = rigid(c, torsoPoint(c)); W = { [S + '_Clavicle']: 1 }; break;
      case 'vertebra': case 'disc': { const t = torsoPoint(c); M = rigid(c, t); W = spineW(t.y); break; }
      case 'rib': { M = rigid(c, torsoPoint(c)); W = spineW(torsoPoint(V3(b.anchor)).y); break; }
      case 'sternum': M = rigid(c, torsoPoint(c)); perVertex = true; break;
      default: continue;
    }
    nm.getNormalMatrix(M);
    for (let i = 0; i < b.verts; i++) {
      const o = (b.vOff + i) * 6;
      v.set(V[o], V[o + 1], V[o + 2]).applyMatrix4(M); n.set(V[o + 3], V[o + 4], V[o + 5]).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z); nrm.push(n.x, n.y, n.z);
      const w = perVertex ? spineW(v.y) : W;
      const e = Object.entries(w).filter(([, x]) => x > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = e.reduce((a, [, x]) => a + x, 0);
      for (let k = 0; k < 4; k++) { si.push(e[k] ? idx[e[k][0]] : 0); sw.push(e[k] ? e[k][1] / tot : 0); }
    }
    for (let i = 0; i < b.tris * 3; i++) ind.push(F[b.iOff + i] + vbase);
    vbase += b.verts;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(ind);
  // bind-world -> the player mesh's local space (bindMatrixInverse is re-derived from matrixWorld every frame in
  // attached mode, so invert the bind matrix itself)
  g.applyMatrix4(playerMesh.bindMatrix.clone().invert());
  const mat = opts.material || new THREE.MeshStandardMaterial({ color: 0xe6dac4, roughness: 0.6, metalness: 0 });
  const mesh = new THREE.SkinnedMesh(g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.position.copy(playerMesh.position); mesh.quaternion.copy(playerMesh.quaternion); mesh.scale.copy(playerMesh.scale);
  playerMesh.parent.add(mesh);
  mesh.bind(sk, playerMesh.bindMatrix);
  return mesh;
}

// The player's own sneakers: the triangles of the skinned model that ride on the foot bones.
export function makeShoes(playerMesh) {
  const g = playerMesh.geometry, sk = playerMesh.skeleton;
  const foot = new Set(sk.bones.map((b, i) => /_(Foot|Toe0)/.test(b.name) ? i : -1).filter(i => i >= 0));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const onFoot = (i) => { let w = 0; for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w += sw.getComponent(i, k); return w; };
  const index = g.index ? g.index.array : Array.from({ length: g.attributes.position.count }, (_, i) => i);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
  const out = [], outGroups = [];
  for (const gr of groups) {
    const start = out.length;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      if (onFoot(a) > 0.5 && onFoot(b) > 0.5 && onFoot(c) > 0.5) out.push(a, b, c);
    }
    if (out.length > start) outGroups.push({ start, count: out.length - start, materialIndex: gr.materialIndex });
  }
  const sg = g.clone(); sg.setIndex(out); sg.clearGroups(); for (const gr of outGroups) sg.addGroup(gr.start, gr.count, gr.materialIndex);
  const mats = Array.isArray(playerMesh.material) ? playerMesh.material.map(m => { const c = m.clone(); c.side = THREE.DoubleSide; return c; })
    : (() => { const c = playerMesh.material.clone(); c.side = THREE.DoubleSide; return c; })();
  const mesh = new THREE.SkinnedMesh(sg, mats);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.position.copy(playerMesh.position); mesh.quaternion.copy(playerMesh.quaternion); mesh.scale.copy(playerMesh.scale);
  playerMesh.parent.add(mesh);
  mesh.bind(sk, playerMesh.bindMatrix);
  return mesh;
}
