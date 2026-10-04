import json, sys, numpy as np
def info(c, step=0.1):
    d = json.load(open(f'assets/mocap/json/{c}.json'))
    P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
    fps = d['fps']; n = d['n']
    hip = (P['lhipjoint'] + P['rhipjoint']) / 2
    left = P['lhipjoint'] - P['rhipjoint']; left[:, 1] = 0; left /= np.linalg.norm(left, axis=1, keepdims=True)
    fwd = np.cross(left, [0, 1, 0])
    yaw = np.degrees(np.arctan2(fwd[:, 0], fwd[:, 2]))
    floor = min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min())
    rows = []
    k = max(1, int(step * fps))
    for i in range(0, n - k, k):
        v = (hip[i + k] - hip[i]) * fps / k; v[1] = 0
        sp = np.linalg.norm(v)
        rel = np.degrees(np.arctan2(np.dot(v, left[i]), np.dot(v, fwd[i]))) if sp > 0.15 else float('nan')
        rh = P['rhand'][i, 1] - floor; lh = P['lhand'][i, 1] - floor
        rows.append(f'{i/fps:4.1f} spd {sp:4.2f} dir {rel:6.0f} yaw {yaw[i]:6.0f} hipY {hip[i,1]-floor:.2f} rH {rh:.2f} lH {lh:.2f}')
    print(f'== {c} ({n/fps:.1f}s) dir: 0=fwd +90=left -90=right')
    print('\n'.join(rows))
for c in sys.argv[1:]: info(c)
