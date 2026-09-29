"""Detect dribble pushes (hand driving the ball down) in a clip: contact = [push start - lead, push end].
usage: python3 tools/pushes.py <clip> t0 t1"""
import json, sys, numpy as np
c = sys.argv[1]; t0, t1 = float(sys.argv[2]), float(sys.argv[3])
d = json.load(open(f'assets/mocap/json/{c}.json'))
P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
fps = d['fps']; fl = min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min())
hip = (P['lhipjoint'] + P['rhipjoint']) / 2
i0, i1 = int(t0 * fps), min(int(t1 * fps), d['n'] - 2)
out = []
for s in 'rl':
    h = P[s + 'hand'][:, 1] - fl
    vy = np.gradient(h) * fps
    i = i0
    while i < i1:
        if vy[i] < -1.2:  # in a push
            a = i
            while a > i0 and vy[a - 1] < -0.3: a -= 1          # push start
            b = i
            while b < i1 and vy[b + 1] < -0.3: b += 1          # push end (hand stops going down)
            drop = h[a] - h[b]
            if drop > 0.12:
                l = P['lhipjoint'][b] - P['rhipjoint'][b]; l[1] = 0; l /= np.linalg.norm(l); f = np.cross(l, [0, 1, 0])
                o = P[s + 'hand'][b] - hip[b]
                out.append((a / fps, b / fps, s.upper(), h[a], h[b], np.dot(o, f), np.dot(o, l), vy[a:b + 1].min()))
            i = b + 1
        else:
            i += 1
out.sort()
for a, b, s, ha, hb, fw, lat, vmin in out:
    print(f'{s} push {a:6.2f} -> {b:6.2f}  h {ha:.2f}->{hb:.2f}  vmin {vmin:5.1f}  release at fwd {fw:5.2f} lat {lat:5.2f}')
