"""CMU ASF/AMC mocap -> per-frame joint positions + bone rotations (meters, Y-up), exported for the browser.

usage: python3 tools/mocap.py            # converts every assets/mocap/*.amc into assets/mocap/json/<clip>.json
"""
import json, os, re, sys, glob
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOC = os.path.join(ROOT, 'assets', 'mocap')
UNIT = 0.0254 / 0.45  # ASF length units -> meters


def rot(axis, deg):
    a = np.deg2rad(deg); c, s = np.cos(a), np.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler_xyz(rx, ry, rz):
    # CMU convention: M = Rz * Ry * Rx (static XYZ)
    return rot('z', rz) @ rot('y', ry) @ rot('x', rx)


def parse_asf(path):
    txt = open(path).read()
    bones = {'root': dict(name='root', direction=np.zeros(3), length=0.0, C=np.eye(3), dof=['rx', 'ry', 'rz'], children=[])}
    for blk in re.findall(r'begin(.*?)end', txt.split(':bonedata')[1].split(':hierarchy')[0], re.S):
        b = {}
        for line in blk.strip().splitlines():
            p = line.split()
            if not p: continue
            if p[0] == 'name': b['name'] = p[1]
            elif p[0] == 'direction': b['direction'] = np.array(list(map(float, p[1:4])))
            elif p[0] == 'length': b['length'] = float(p[1]) * UNIT
            elif p[0] == 'axis': b['C'] = euler_xyz(*map(float, p[1:4]))
            elif p[0] == 'dof': b['dof'] = p[1:]
        b.setdefault('dof', []); b['children'] = []
        bones[b['name']] = b
    hier = txt.split(':hierarchy')[1]
    for line in hier.splitlines():
        p = line.split()
        if not p or p[0] in ('begin', 'end'): continue
        for c in p[1:]:
            bones[p[0]]['children'].append(c); bones[c]['parent'] = p[0]
    return bones


def parse_amc(path):
    frames, cur = [], None
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or line.startswith(':'): continue
        if line.isdigit():
            cur = {}; frames.append(cur); continue
        p = line.split(); cur[p[0]] = list(map(float, p[1:]))
    return frames


def fk(bones, fr):
    pos, mat = {}, {}
    r = fr['root']
    pos['root'] = np.array(r[:3]) * UNIT
    mat['root'] = bones['root']['C'] @ euler_xyz(*r[3:6]) @ bones['root']['C'].T

    def go(name):
        b = bones[name]
        for c in b['children']:
            cb = bones[c]
            ang = {'rx': 0.0, 'ry': 0.0, 'rz': 0.0}
            vals = fr.get(c, [])
            for d, v in zip(cb['dof'], vals): ang[d] = v
            M = mat[name] @ cb['C'] @ euler_xyz(ang['rx'], ang['ry'], ang['rz']) @ cb['C'].T
            mat[c] = M
            pos[c] = pos[name] + cb['length'] * (M @ cb['direction'])
            go(c)
    go('root')
    return pos, mat


KEEP = ['root', 'lhipjoint', 'lfemur', 'ltibia', 'lfoot', 'ltoes', 'rhipjoint', 'rfemur', 'rtibia', 'rfoot', 'rtoes',
        'lowerback', 'upperback', 'thorax', 'lowerneck', 'upperneck', 'head',
        'lclavicle', 'lhumerus', 'lradius', 'lwrist', 'lhand', 'lfingers', 'lthumb',
        'rclavicle', 'rhumerus', 'rradius', 'rwrist', 'rhand', 'rfingers', 'rthumb']
MATS = ['root', 'lowerback', 'thorax', 'upperneck', 'head', 'lhand', 'rhand', 'lfoot', 'rfoot', 'lwrist', 'rwrist']


def convert(amc, asf, step=2):
    bones = parse_asf(asf)
    frames = parse_amc(amc)
    out = {'fps': 120 / step, 'n': 0, 'pos': {k: [] for k in KEEP}, 'mat': {k: [] for k in MATS}}
    for i in range(0, len(frames), step):
        pos, mat = fk(bones, frames[i])
        for k in KEEP: out['pos'][k].extend(np.round(pos[k], 4).tolist())
        for k in MATS: out['mat'][k].extend(np.round(mat[k].reshape(-1), 4).tolist())
        out['n'] += 1
    # rest-pose bone directions (global, T-pose) for reference
    out['rest'] = {k: np.round(bones[k]['direction'], 4).tolist() for k in KEEP if k != 'root'}
    out['len'] = {k: round(bones[k]['length'], 4) for k in KEEP if k != 'root'}
    return out


if __name__ == '__main__':
    os.makedirs(os.path.join(MOC, 'json'), exist_ok=True)
    clips = sys.argv[1:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(MOC, '*.amc')))
    for c in clips:
        subj = c.split('_')[0]
        d = convert(os.path.join(MOC, c + '.amc'), os.path.join(MOC, subj + '.asf'))
        json.dump(d, open(os.path.join(MOC, 'json', c + '.json'), 'w'), separators=(',', ':'))
        root = np.array(d['pos']['root']).reshape(-1, 3)
        dist = np.sum(np.linalg.norm(np.diff(root[:, [0, 2]], axis=0), axis=1))
        print(f'{c}: {d["n"]} frames @{d["fps"]:.0f}fps = {d["n"] / d["fps"]:.1f}s, root travel {dist:.1f} m, hip height {root[:, 1].mean():.2f} m')
