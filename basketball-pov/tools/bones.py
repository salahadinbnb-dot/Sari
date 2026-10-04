"""Anatomical skeleton for the v4 clip: bone meshes from the OpenSim full-body model (Rajagopal et al. 2016,
opensim-org/opensim-models), posed in the model's default stance and exported for src/boneskel.js.

usage: python3 tools/bones.py <opensim-models dir> <out dir>
Writes <out>/bones.bin (float32 positions+normals, uint32 indices) and <out>/bones.json (per-bone offsets, the body
each bone belongs to, and the default-pose joint centres). Coordinates: OpenSim ground frame (x forward, y up,
z right), metres. Long bones are low-poly in the source, so every mesh is repaired and Loop-subdivided to smooth it.
"""
import json, os, sys
import xml.etree.ElementTree as ET
import numpy as np
import trimesh

SRC, OUT = sys.argv[1], sys.argv[2]
OSIM = os.path.join(SRC, 'Models/Rajagopal/Rajagopal2016.osim')
GEOM = [os.path.join(SRC, 'Models/Rajagopal/Geometry'), os.path.join(SRC, 'Geometry')]


def rot_xyz(a, b, c):  # OpenSim offset-frame orientation: X-Y-Z body-fixed Euler angles
    ca, sa, cb, sb, cc, sc = np.cos(a), np.sin(a), np.cos(b), np.sin(b), np.cos(c), np.sin(c)
    X = np.array([[1, 0, 0], [0, ca, -sa], [0, sa, ca]]); Y = np.array([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]])
    Z = np.array([[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]])
    return X @ Y @ Z


def axis_angle(ax, ang):
    ax = np.asarray(ax, float); ax = ax / np.linalg.norm(ax); K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K


def tf(R=np.eye(3), p=(0, 0, 0)):
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = p; return M


def fnum(el, tag): return np.array([float(v) for v in el.find(tag).text.split()])


def evalf(fn, q):
    """OpenSim function value at q (the few kinds the full-body model uses)."""
    if fn is None or len(fn) == 0: return q
    f = list(fn)[0]
    if f.tag == 'LinearFunction': a, b = fnum(f, 'coefficients'); return a * q + b
    if f.tag == 'Constant': return float(f.find('value').text)
    if f.tag in ('SimmSpline', 'NaturalCubicSpline', 'PiecewiseLinearFunction'): return float(np.interp(q, fnum(f, 'x'), fnum(f, 'y')))
    if f.tag == 'MultiplierFunction': return float(f.find('scale').text) * evalf(f.find('function'), q)
    if f.tag == 'PolynomialFunction': return float(np.polyval(fnum(f, 'coefficients'), q))
    raise ValueError(f.tag)


model = ET.parse(OSIM).getroot().find('Model')
coord = {c.get('name'): float(c.find('default_value').text) for c in model.iter('Coordinate')}


def joint_motion(j):
    """Transform of the child offset frame relative to the parent offset frame at default coordinates."""
    M = np.eye(4)
    if j.tag == 'CustomJoint':
        R = np.eye(3); p = np.zeros(3)
        for ta in j.find('SpatialTransform'):
            names = (ta.find('coordinates').text or '').split()
            q = coord[names[0]] if names else 0.0
            v = evalf(ta.find('function'), q) if names or ta.find('function') is not None else 0.0
            ax = fnum(ta, 'axis')
            if ta.get('name').startswith('rotation'): R = R @ axis_angle(ax, v)
            else: p = p + ax / np.linalg.norm(ax) * v
        M = tf(R, p)
    elif j.tag in ('PinJoint', 'UniversalJoint'):
        names = [c.get('name') for c in j.iter('Coordinate')]
        if j.tag == 'PinJoint' and names: M = tf(axis_angle([0, 0, 1], coord[names[0]]))
        if j.tag == 'UniversalJoint' and len(names) == 2: M = tf(axis_angle([1, 0, 0], coord[names[0]]) @ axis_angle([0, 1, 0], coord[names[1]]))
    return M


def offset(frame):
    return tf(rot_xyz(*fnum(frame, 'orientation')), fnum(frame, 'translation'))


world = {'ground': np.eye(4)}; joints = {}
pending = list(model.find('JointSet').find('objects'))
while pending:
    for j in list(pending):
        fr = {f.get('name'): f for f in j.find('frames')}
        pf, cf = fr[j.find('socket_parent_frame').text], fr[j.find('socket_child_frame').text]
        parent, child = pf.find('socket_parent').text.split('/')[-1], cf.find('socket_parent').text.split('/')[-1]
        if parent not in world: continue
        Jp = world[parent] @ offset(pf)                         # joint frame on the parent
        world[child] = Jp @ joint_motion(j) @ np.linalg.inv(offset(cf))
        joints[j.get('name')] = (Jp @ joint_motion(j))[:3, 3].tolist()
        pending.remove(j)


def read_vtp(path):
    root = ET.parse(path).getroot(); piece = root.find('PolyData').find('Piece')
    pts = np.array(piece.find('Points').find('DataArray').text.split(), float).reshape(-1, 3)
    arr = {d.get('Name'): np.array(d.text.split(), int) for d in piece.find('Polys').findall('DataArray')}
    con, offs = arr['connectivity'], arr['offsets']
    tris, s = [], 0
    for e in offs:
        poly = con[s:e]; s = e
        for k in range(1, len(poly) - 1): tris.append([poly[0], poly[k], poly[k + 1]])
    return pts, np.array(tris, int)


def find(name):
    for g in GEOM:
        p = os.path.join(g, name)
        if os.path.exists(p): return p
    raise FileNotFoundError(name)


# a higher-resolution version of the right femur that shares its body frame (bounds match within 3 mm)
BETTER = {'r_femur.vtp': 'femur_r.vtp'}
bones, blob, idx = [], [], []
off = 0


def label_torso(name, c, v):
    """Name a connected piece of the OpenSim torso meshes."""
    n = len(v); ctr = v.mean(0); ext = v.max(0) - v.min(0)
    if name == 'hat_skull': return 'skull'
    if name == 'hat_jaw': return 'jaw'
    if name == 'hat_spine': return 'disc' if ext[1] < 0.016 and n < 40 else 'vertebra'
    if n >= 600: return 'scapula' if abs(ctr[2]) > 0.08 else 'sternum'
    if 200 <= n < 400 and ctr[1] > 1.39: return 'clavicle'
    return 'rib'


def emit(name, body, part, m, extra=None):
    global off
    v = np.asarray(m.vertices, np.float32); nrm = np.asarray(m.vertex_normals, np.float32); f = np.asarray(m.faces, np.uint32)
    ctr = v.mean(0)
    rec = {'name': name, 'body': body, 'part': part, 'side': 'r' if ctr[2] > 0.02 else ('l' if ctr[2] < -0.02 else 'c'),
           'centroid': np.round(ctr, 5).tolist(), 'verts': int(len(v)), 'tris': int(len(f)), 'vOff': off}
    if extra: rec.update(extra)
    bones.append(rec); blob.append(np.hstack([v, nrm]).astype(np.float32)); idx.append(f); off += len(v)


def smooth(m, npts, most=2):
    size = float(np.linalg.norm(m.extents))
    sub = 0 if size < 0.1 or npts >= 1000 else min(most, 2 if npts < 150 else 1)
    if size < 0.1 and npts < 120: sub = 1
    for _ in range(sub):
        try: m = m.subdivide_loop(1)
        except ValueError:  # non-manifold spots: plain split + volume-keeping smoothing instead
            m = m.subdivide(); trimesh.smoothing.filter_taubin(m, iterations=8)
    return m


PART = {'pelvis': 'pelvis', 'femur': 'femur', 'tibia': 'tibia', 'fibula': 'fibula', 'patella': 'patella', 'talus': 'talus',
        'bofoot': 'toes', 'foot': 'foot', 'humerus': 'humerus', 'ulna': 'ulna', 'radius': 'radius', 'sacrum': 'sacrum'}
landmarks = {}
for body in model.find('BodySet').find('objects').findall('Body'):
    bn = body.get('name'); M = world[bn]
    for mesh in body.iter('Mesh'):
        src = mesh.find('mesh_file').text; fname = BETTER.get(src, src)
        pts, tris = read_vtp(find(fname))
        pts = pts * fnum(mesh, 'scale_factors')
        pw = (M[:3, :3] @ pts.T).T + M[:3, 3]
        m = trimesh.Trimesh(pw, tris, process=True)
        m.merge_vertices(); m.update_faces(m.nondegenerate_faces()); m.remove_unreferenced_vertices()
        base = src.replace('.vtp', '')
        if bn == 'torso':
            for c in m.split(only_watertight=False):
                if len(c.vertices) < 10: continue
                v = np.asarray(c.vertices); part = label_torso(base, c, v)
                trimesh.repair.fix_winding(c); trimesh.repair.fix_inversion(c)
                extra = None
                if part == 'rib':  # where it meets the spine: its most posterior tenth
                    k = max(3, len(v) // 10); back = v[np.argsort(v[:, 0])[:k]]
                    extra = {'anchor': np.round(back.mean(0), 5).tolist()}
                emit(base, bn, part, smooth(c, len(c.vertices), 1) if part in ('rib', 'clavicle') else c, extra)
            continue
        trimesh.repair.fix_winding(m); trimesh.repair.fix_inversion(m)
        if bn.startswith('hand'):
            part = 'hand'
            if base.startswith('metacarpal1'): landmarks['thumb_' + bn[-1]] = m.vertices[np.argmax(m.vertices[:, 1] * -1)].tolist()
            if base.startswith('metacarpal3'): landmarks['mcp3_' + bn[-1]] = m.vertices[np.argmin(m.vertices[:, 1])].tolist()
        else:
            key = next((k for k in PART if k in base), None); part = PART[key]
        emit(base, bn, part, smooth(m, len(pts)))
# the top of the atlas (C1): where the skull sits on the spine
verts_c = [b for b in bones if b['part'] == 'vertebra']
top = max(verts_c, key=lambda b: b['centroid'][1])
tv = np.vstack(blob)[top['vOff']:top['vOff'] + top['verts'], :3]
landmarks['skull_base'] = [float(tv[:, 0].mean()), float(tv[:, 1].max()), 0.0]
os.makedirs(OUT, exist_ok=True)
V = np.vstack(blob); F = np.vstack(idx)
tri_off = 0
for b in bones: b['iOff'] = tri_off * 3; tri_off += b['tris']
with open(os.path.join(OUT, 'bones.bin'), 'wb') as fh:
    fh.write(V.astype(np.float32).tobytes()); fh.write(F.astype(np.uint32).tobytes())
bodies = {k: np.round(v, 6).tolist() for k, v in world.items()}
json.dump({'verts': int(len(V)), 'tris': int(len(F)), 'bones': bones, 'joints': joints, 'bodies': bodies, 'landmarks': landmarks},
          open(os.path.join(OUT, 'bones.json'), 'w'))
print('bones', len(bones), 'verts', len(V), 'tris', len(F))
for k in ['hip_r', 'walker_knee_r', 'ankle_r', 'mtp_r', 'back', 'acromial_r', 'elbow_r', 'radius_hand_r']:
    print(k, np.round(joints[k], 3))
