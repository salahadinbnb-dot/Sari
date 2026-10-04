"""Stick-figure contact sheet for a mocap clip: top-down path + posed frames from a side-ish view."""
import json, sys, os
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BONES = [('root','lhipjoint'),('lhipjoint','lfemur'),('lfemur','ltibia'),('ltibia','lfoot'),('lfoot','ltoes'),
         ('root','rhipjoint'),('rhipjoint','rfemur'),('rfemur','rtibia'),('rtibia','rfoot'),('rfoot','rtoes'),
         ('root','lowerback'),('lowerback','upperback'),('upperback','thorax'),('thorax','lowerneck'),('lowerneck','upperneck'),('upperneck','head'),
         ('thorax','lclavicle'),('lclavicle','lhumerus'),('lhumerus','lradius'),('lradius','lwrist'),('lwrist','lhand'),
         ('thorax','rclavicle'),('rclavicle','rhumerus'),('rhumerus','rradius'),('rradius','rwrist'),('rwrist','rhand')]

def load(c):
    d = json.load(open(os.path.join(ROOT, 'assets/mocap/json', c + '.json')))
    P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
    return d, P

def sheet(c, out, cols=8):
    d, P = load(c); n = d['n']
    idx = np.linspace(0, n - 1, cols).astype(int)
    fig = plt.figure(figsize=(cols * 2.2, 6.2))
    # top-down path
    ax = fig.add_subplot(2, 1, 1)
    r = P['root']
    ax.plot(r[:, 0], r[:, 2], 'k-', lw=1)
    for i in idx:
        lh, rh = P['lhipjoint'][i], P['rhipjoint'][i]
        ax.plot([lh[0], rh[0]], [lh[2], rh[2]], 'b-', lw=2)  # hips: blue=left->right line
        ax.plot(lh[0], lh[2], 'bo', ms=3); ax.plot(rh[0], rh[2], 'ro', ms=3)
        ax.plot(P['ltoes'][i][0], P['ltoes'][i][2], 'b^', ms=4); ax.plot(P['rtoes'][i][0], P['rtoes'][i][2], 'r^', ms=4)
        ax.text(r[i, 0], r[i, 2], f'{i/d["fps"]:.1f}', fontsize=7)
    ax.set_aspect('equal'); ax.set_title(f'{c}: top view (x right, z down), blue=L red=R', fontsize=9)
    # posed frames: view from +x side and front; use average facing
    for k, i in enumerate(idx):
        a = fig.add_subplot(2, cols, cols + k + 1)
        # project onto plane perpendicular to hip line (side view of the body)
        hipv = P['rhipjoint'][i] - P['lhipjoint'][i]; hipv[1] = 0; hipv /= np.linalg.norm(hipv) + 1e-9
        fwd = np.cross(hipv, [0, 1, 0])  # forward-ish
        for a0, b0 in BONES:
            p, q = P[a0][i] - P['root'][i], P[b0][i] - P['root'][i]
            col = 'b' if a0[0] == 'l' or b0[0] == 'l' and a0 != 'root' else ('r' if (a0[0] == 'r' and a0 != 'root') or b0[0] == 'r' and not b0.startswith('root') else 'k')
            # front view: x = along hip line, y = up
            a.plot([np.dot(p, hipv), np.dot(q, hipv)], [p[1] + P['root'][i][1], q[1] + P['root'][i][1]], color=col, lw=1.5)
        for h, cc in (('lhand', 'b'), ('rhand', 'r')):
            hp = P[h][i] - P['root'][i]; a.plot(np.dot(hp, hipv), hp[1] + P['root'][i][1], cc + 'o', ms=4)
        a.set_xlim(-0.9, 0.9); a.set_ylim(0, 2.0); a.set_aspect('equal'); a.set_xticks([]); a.set_yticks([])
        a.set_title(f't={i/d["fps"]:.2f}', fontsize=8)
    plt.tight_layout(); plt.savefig(out, dpi=70); plt.close()

if __name__ == '__main__':
    out = sys.argv[1]
    for c in sys.argv[2:]:
        sheet(c, out.replace('.png', f'_{c}.png'))
