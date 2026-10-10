// v12's brain: a real one, rendered like an anatomy app - opaque, glossy, pink. The cerebral cortex is FreeSurfer's
// fsaverage pial surface (shaded by its sulcal depth: gyri light, sulci dark), the cerebellum (with its folia) and
// the brainstem come from the MNI152 template (see tools/brain_mesh.py). Coordinates are MNI-style millimetres
// (x right, y front, z up). Activity glows on the tissue at the area's real place: tightly on the surface for areas
// on the outside, and softer and wider for areas on the inner wall or deep inside, like light through the tissue.
import * as THREE from 'three';

const VS = `attribute float sulc; attribute vec3 glow;
  varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vG; varying vec3 vP;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
    vS = sulc; vG = glow; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FS = `uniform vec3 gyrus, sulcus, stemCol; uniform float folia; uniform vec3 L1, L2, L3;
  varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vG; varying vec3 vP;
  void main(){
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    float s = smoothstep(-0.8, 1.1, vS);
    vec3 gy = gyrus, su = sulcus;
    if (folia > 0.0) {
      // the cerebellum: fine folia running across it; the brainstem pale
      float f = sin((vP.z * 1.0 + vP.y * 0.55 + vP.x * 0.08) * 1.9);
      s = 0.25 + 0.55 * smoothstep(0.2, 1.0, f);
      float stem = (1.0 - smoothstep(9.0, 17.0, abs(vP.x))) * smoothstep(-50.0, -40.0, vP.y) + (1.0 - smoothstep(-58.0, -50.0, vP.z)) * (1.0 - smoothstep(9.0, 16.0, abs(vP.x)));
      stem = clamp(stem, 0.0, 1.0);
      gy = mix(gy, stemCol, stem); su = mix(su, stemCol * 0.85, stem); s = mix(s, 0.2, stem);
    }
    vec3 base = mix(gy, su, s);
    float wrap = 0.25;
    float d = max((dot(n, L1) + wrap) / (1.0 + wrap), 0.0) * 0.9 + max(dot(n, L2), 0.0) * 0.18 + max(dot(n, L3), 0.0) * 0.06 + 0.06;
    // wet, glossy tissue: a sharp highlight on the gyri, a broad sheen
    vec3 H = normalize(L1 + vV); float sp = pow(max(dot(n, H), 0.0), 48.0) * 0.3 * (1.0 - s * 0.8) + pow(max(dot(n, H), 0.0), 10.0) * 0.05;
    float fr = pow(1.0 - max(dot(n, vV), 0.0), 3.0);
    vec3 c = base * d + vec3(1.0, 0.94, 0.92) * sp + base * fr * 0.22;
    // activity: the tissue takes on the area's colour and lights up
    float gm = max(vG.r, max(vG.g, vG.b)), k = clamp(gm, 0.0, 1.0); vec3 gc = vG / max(gm, 1e-4);
    c = mix(c, gc * (0.7 + 0.3 * d), k * 0.7) + gc * k * k * 0.35;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;
const L1 = new THREE.Vector3(-0.55, 0.45, 0.72).normalize(), L2 = new THREE.Vector3(0.4, -0.5, 0.3).normalize(), L3 = new THREE.Vector3(-0.2, -0.3, -0.9).normalize();
const mat = (o) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
  uniforms: { gyrus: { value: new THREE.Color(o.gyrus) }, sulcus: { value: new THREE.Color(o.sulcus) }, stemCol: { value: new THREE.Color(0xf0e2cc) }, folia: { value: o.folia ?? 0 }, L1: { value: L1 }, L2: { value: L2 }, L3: { value: L3 } } });

// where things are (MNI mm) and how far their light spreads on the tissue (sd, mm): outside areas tight; areas on
// the inner wall or deep inside soft and wide, seen through the tissue
export const SPOTS = {
  see: { at: [[-14, -99, 2]], sd: 9, col: [0.25, 0.9, 1.0] },
  face: { at: [[-41, -54, -19]], sd: 9, col: [0.25, 0.9, 1.0] },
  tpj: { at: [[-50, -56, 23]], sd: 9, col: [0.75, 0.55, 1.0] },
  plan: { at: [[-42, 32, 30]], sd: 9, col: [0.95, 0.97, 1.0] },
  speech: { at: [[-50, 16, 7]], sd: 9, col: [0.95, 0.97, 1.0] },
  mind: { at: [[-6, 50, 16]], sd: 16, col: [0.75, 0.55, 1.0], inner: true },
  dmn: { at: [[-6, -56, 34]], sd: 16, col: [0.75, 0.55, 1.0], inner: true },
  off: { at: [[-6, 24, 28]], sd: 16, col: [1.0, 0.25, 0.32], inner: true },
  emo: { at: [[-23, -4, -18]], sd: 19, col: [1.0, 0.42, 0.37], inner: true },
  reward: { at: [[-11, 12, -8]], sd: 19, col: [1.0, 0.76, 0.23], inner: true },
  mem: { at: [[-27, -24, -14]], sd: 19, col: [0.47, 0.9, 0.67], inner: true },
};

export async function makeBrain(canvas, W, H) {
  const meta = await (await fetch('../assets/brain/brain.json')).json(), bin = await (await fetch('../assets/brain/brain.bin')).arrayBuffer();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x0b111b, 1);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(21, W / H, 50, 3000); camera.up.set(0, 0, 1);
  const geo = (name, withSulc) => {
    const m = meta[name], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, m.pos, m.nv * 3), 3));
    g.setAttribute('sulc', new THREE.BufferAttribute(withSulc ? new Float32Array(bin, m.sulc, m.nv) : new Float32Array(m.nv), 1));
    g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(m.nv * 3), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, m.idx, m.nf * 3), 1)); g.computeVertexNormals(); return g;
  };
  const tissue = { gyrus: 0xeea39c, sulcus: 0x9c4a55 };
  const cortexL = new THREE.Mesh(geo('cortexL', true), mat(tissue)), cortexR = new THREE.Mesh(geo('cortexR', true), mat(tissue));
  const cereb = new THREE.Mesh(geo('cerebellum', false), mat({ gyrus: 0xeca09a, sulcus: 0xa0505a, folia: 1 }));
  scene.add(cortexL, cortexR, cereb);
  // each spot's footprint on the surface: vertices within 3 sd, weighted (a spot on the inner wall or deep inside also
  // lights the outside of the near hemisphere, softly and widely - how it shows through)
  const foot = {};
  for (const [name, sp] of Object.entries(SPOTS)) {
    foot[name] = [];
    for (const mesh of [cortexL, cortexR, cereb]) {
      const P = mesh.geometry.attributes.position.array, idx = [], w = [], sd2 = sp.sd * sp.sd;
      for (let i = 0; i < P.length / 3; i++) {
        let best = 0;
        for (const c of sp.at) { const dx = P[3 * i] - c[0], dy = P[3 * i + 1] - c[1], dz = P[3 * i + 2] - c[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < 9 * sd2) best = Math.max(best, Math.exp(-d2 / (2 * sd2))); }
        if (best > 0.01) { idx.push(i); w.push(best); }
      }
      if (idx.length) foot[name].push({ mesh, idx: Uint32Array.from(idx), w: Float32Array.from(w) });
    }
  }
  // where a spot shows: the strongest point of its light on the side of the left hemisphere that faces us (the
  // footprint is scaled so it's at full strength there - softer for areas seen through the tissue)
  const shows = {};
  for (const [name, f] of Object.entries(foot)) {
    let best = null, bw = 0;
    for (const { mesh, idx, w } of f) {
      if (mesh !== cortexL) continue;
      const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
      for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (w[k] > bw && N[3 * i] < -0.3) { bw = w[k]; best = new THREE.Vector3(P[3 * i], P[3 * i + 1], P[3 * i + 2]); } }
    }
    const c = SPOTS[name].at[0]; shows[name] = best || new THREE.Vector3(c[0], c[1], c[2]);
    const gain = Math.min(3, (SPOTS[name].inner ? 0.85 : 1) / Math.max(bw, 1e-3));
    for (const e of f) for (let k = 0; k < e.w.length; k++) e.w[k] = Math.min(1, e.w[k] * gain);
  }
  // the areas' colours, in the light's (linear) terms
  const LIN = Object.fromEntries(Object.entries(SPOTS).map(([n, sp]) => [n, sp.col.map(c => Math.pow(c, 2.2))]));
  const target = new THREE.Vector3(0, -17, -26), v = new THREE.Vector3();
  function place(t) {
    // from the left, turned a little toward the front, a touch above; swaying gently
    const az = 0.08 + 0.04 * Math.sin(t * 0.35), pitch = 0.07 + 0.02 * Math.sin(t * 0.27 + 1), dist = 565;
    camera.position.set(target.x - dist * Math.cos(pitch) * Math.cos(az), target.y + dist * Math.cos(pitch) * Math.sin(az), target.z + dist * Math.sin(pitch));
    camera.lookAt(target); camera.updateMatrixWorld();
  }
  return {
    // acts: { name: level 0..1 }
    render(t, acts) {
      place(t);
      for (const m of [cortexL, cortexR, cereb]) m.geometry.attributes.glow.array.fill(0);
      for (const [name, a] of Object.entries(acts)) {
        if (!(a > 0.003) || !foot[name]) continue;
        const col = LIN[name];
        for (const f of foot[name]) { const G = f.mesh.geometry.attributes.glow.array; for (let k = 0; k < f.idx.length; k++) { const i = f.idx[k], w = f.w[k] * a; G[3 * i] += col[0] * w; G[3 * i + 1] += col[1] * w; G[3 * i + 2] += col[2] * w; } }
      }
      for (const m of [cortexL, cortexR, cereb]) m.geometry.attributes.glow.needsUpdate = true;
      renderer.render(scene, camera);
    },
    // a named spot's place on the canvas (pixels): where it shows on the near surface
    project(name) { v.copy(shows[name]).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; },
  };
}
