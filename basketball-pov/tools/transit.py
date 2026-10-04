"""Find the best place to cut from one mocap clip into another (motion matching on a pose + velocity feature).

usage: python3 tools/transit.py A ta0 ta1 B tb0 tb1 [top]
Compares every frame of clip A in [ta0, ta1] with every frame of clip B in [tb0, tb1] in each pose's own body frame
(hip centre on the floor, facing from the hips), scaled by leg length so different performers compare. The feature:
feet, knees, hands, head and chest relative to the hips; their velocities; the hip's height and its velocity in the
body frame (forward, left, up) and turning rate. Prints the best pairs (lowest cost) and what each term contributes.
"""
import json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOINTS = ['ltibia', 'rtibia', 'ltoes', 'rtoes', 'lfemur', 'rfemur', 'lwrist', 'rwrist', 'head', 'thorax']
WPOS = np.array([1.5, 1.5, 1.0, 1.0, 1.0, 1.0, 0.6, 0.6, 0.6, 0.8])


def load(c):
    d = json.load(open(os.path.join(ROOT, 'assets/mocap/json', c + '.json')))
    P = {k: np.array(v, dtype=float).reshape(-1, 3) for k, v in d['pos'].items()}
    leg = np.linalg.norm(P['lhipjoint'][0] - P['lfemur'][0]) + np.linalg.norm(P['lfemur'][0] - P['ltibia'][0])
    return d['fps'], P, leg


def features(c):
    fps, P, leg = load(c)
    floor = min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min())
    hip = (P['lhipjoint'] + P['rhipjoint']) / 2
    L = P['lhipjoint'] - P['rhipjoint']; L[:, 1] = 0; L /= np.linalg.norm(L, axis=1, keepdims=True)
    F = np.cross(L, [0, 1, 0])
    yaw = np.unwrap(np.arctan2(F[:, 0], F[:, 2]))
    base = hip.copy(); base[:, 1] = floor
    def local(v):  # world vectors -> body frame (forward, left, up), / leg length
        return np.stack([(v * F).sum(1), (v * L).sum(1), v[:, 1]], 1) / leg
    pos = np.stack([local(P[j] - base) for j in JOINTS], 1)           # n x J x 3
    vel = np.gradient(pos, axis=0) * fps                                # body-frame joint velocity (per leg length)
    hv = local(np.gradient(hip, axis=0) * fps)                          # hip velocity in the body frame
    yr = np.gradient(yaw) * fps
    return dict(fps=fps, n=len(hip), pos=pos, vel=vel, hv=hv, yr=yr, hip=(hip[:, 1] - floor) / leg)


def cost(A, i, B, j):
    dp = ((A['pos'][i] - B['pos'][j]) ** 2).sum(1) @ WPOS
    dv = ((A['vel'][i] - B['vel'][j]) ** 2).sum(1) @ WPOS * 0.012
    dh = ((A['hv'][i] - B['hv'][j]) ** 2).sum() * 0.25 + (A['yr'][i] - B['yr'][j]) ** 2 * 0.02
    return dp, dv, dh


if __name__ == '__main__':
    a, ta0, ta1, b, tb0, tb1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], float(sys.argv[5]), float(sys.argv[6])
    top = int(sys.argv[7]) if len(sys.argv) > 7 else 8
    A, B = features(a), features(b)
    res = []
    for i in range(int(ta0 * A['fps']), min(A['n'], int(ta1 * A['fps']) + 1)):
        for j in range(int(tb0 * B['fps']), min(B['n'], int(tb1 * B['fps']) + 1)):
            dp, dv, dh = cost(A, i, B, j)
            res.append((dp + dv + dh, i / A['fps'], j / B['fps'], dp, dv, dh))
    res.sort()
    seen = []
    for r in res:
        if any(abs(r[1] - s[1]) < 0.06 and abs(r[2] - s[2]) < 0.06 for s in seen): continue
        seen.append(r)
        print(f'{a} {r[1]:.3f} -> {b} {r[2]:.3f}  cost {r[0]:.3f}  (pose {r[3]:.3f} vel {r[4]:.3f} root {r[5]:.3f})')
        if len(seen) >= top: break
