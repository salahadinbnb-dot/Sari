"""Find the best frame pair to splice clip time ranges A -> B (matching speed and body-relative foot placement).
usage: python3 tools/splice.py <clip> a0 a1 b0 b1 [clipB]"""
import json, sys, numpy as np
c = sys.argv[1]; a0, a1, b0, b1 = map(float, sys.argv[2:6]); cb = sys.argv[6] if len(sys.argv) > 6 else c
def load(c):
    d = json.load(open(f'assets/mocap/json/{c}.json'))
    P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
    leg = np.linalg.norm(P['lhipjoint'][0] - P['lfemur'][0]) + np.linalg.norm(P['lfemur'][0] - P['ltibia'][0])
    return P, d['fps'], min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min()), (P['lhipjoint'] + P['rhipjoint']) / 2, 0.8617 / leg
def frame(i, C):
    P, fps, fl, hip, sc = C
    l = P['lhipjoint'][i] - P['rhipjoint'][i]; l[1] = 0; l /= np.linalg.norm(l); f = np.cross(l, [0, 1, 0])
    v = (hip[min(i + 3, len(hip) - 1)] - hip[max(i - 3, 0)]) * fps / 6; v[1] = 0
    feat = []
    for s in 'lr':
        o = P[s + 'tibia'][i] - hip[i]
        feat += [np.dot(o, f), np.dot(o, l), P[s + 'tibia'][i][1] - fl]
    return np.array([np.dot(v, f), np.dot(v, l)]) * sc, np.array(feat) * sc
CA, CB = load(c), load(cb)
best = []
for i in range(int(a0 * CA[1]), int(a1 * CA[1]) + 1):
    vi, fi = frame(i, CA)
    for j in range(int(b0 * CB[1]), int(b1 * CB[1]) + 1):
        vj, fj = frame(j, CB)
        cost = np.linalg.norm(vi - vj) * 0.25 + np.linalg.norm(fi - fj)
        best.append((cost, i / CA[1], j / CB[1], np.linalg.norm(vi), np.linalg.norm(vj)))
best.sort()
for b in best[:8]: print(f'cost {b[0]:.3f}  A {b[1]:.3f} -> B {b[2]:.3f}   speed {b[3]:.2f} -> {b[4]:.2f}')
