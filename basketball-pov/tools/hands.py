"""Hand/feet timeline of a clip (body frame): find dribble contacts, hand switches, stance.
usage: python3 tools/hands.py <clip> t0 t1 [step]"""
import json, sys, numpy as np
c = sys.argv[1]; t0, t1 = float(sys.argv[2]), float(sys.argv[3]); step = float(sys.argv[4]) if len(sys.argv) > 4 else 1 / 30
d = json.load(open(f'assets/mocap/json/{c}.json'))
P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
fps = d['fps']; fl = min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min())
hip = (P['lhipjoint'] + P['rhipjoint']) / 2
def fr(i):
    l = P['lhipjoint'][i] - P['rhipjoint'][i]; l[1] = 0; l /= np.linalg.norm(l); f = np.cross(l, [0, 1, 0]); return f, l
print(f'{c}: t | R hand fwd/lat/h vy | L hand fwd/lat/h vy | feet L-R fwd, L lat, R lat | hip v fwd/lat, yaw')
yaw0 = None
t = t0
while t <= t1 + 1e-9:
    i = int(round(t * fps)); j = min(i + 1, len(hip) - 1); k = max(i - 1, 0)
    f, l = fr(i)
    out = f'{t:6.2f}'
    for s in 'rl':
        o = P[s + 'hand'][i] - hip[i]; vy = (P[s + 'hand'][j][1] - P[s + 'hand'][k][1]) * fps / max(j - k, 1)
        out += f' | {s.upper()} {np.dot(o, f):5.2f} {np.dot(o, l):5.2f} {P[s + "hand"][i][1] - fl:4.2f} {vy:5.1f}'
    fa = P['lfoot'][i] - hip[i]; fb = P['rfoot'][i] - hip[i]
    v = (hip[j] - hip[k]) * fps / max(j - k, 1)
    yaw = np.degrees(np.arctan2(f[0], f[2]))
    if yaw0 is None: yaw0 = yaw
    out += f' | ft {np.dot(fa - fb, f):5.2f} {np.dot(fa, l):5.2f} {np.dot(fb, l):5.2f} | v {np.dot(v, f):5.2f} {np.dot(v, l):5.2f} yaw {((yaw - yaw0 + 180) % 360) - 180:5.0f}'
    print(out)
    t += step
