"""Classify hand switches in a dribbling clip (tweener / crossover / behind-back) and the body turn around them.
usage: python3 tools/moves.py <clip>"""
import json, sys, numpy as np
c = sys.argv[1]
d = json.load(open(f'assets/mocap/json/{c}.json'))
P = {k: np.array(v).reshape(-1, 3) for k, v in d['pos'].items()}
fps = d['fps']; n = d['n']; fl = min(P['ltoes'][:, 1].min(), P['rtoes'][:, 1].min())
hip = (P['lhipjoint'] + P['rhipjoint']) / 2
def fr(i):
    l = P['lhipjoint'][i] - P['rhipjoint'][i]; l[1] = 0; l /= np.linalg.norm(l); return np.cross(l, [0, 1, 0]), l
def yaw(i): f, _ = fr(i); return np.degrees(np.arctan2(f[0], f[2]))
pushes = []
for s in 'rl':
    h = P[s + 'hand'][:, 1] - fl; vy = np.gradient(h) * fps
    i = 0
    while i < n - 2:
        if vy[i] < -1.2:
            a = i
            while a > 0 and vy[a - 1] < -0.3: a -= 1
            b = i
            while b < n - 2 and vy[b + 1] < -0.3: b += 1
            if h[a] - h[b] > 0.12:
                f, l = fr(b); o = P[s + 'hand'][b] - hip[b]
                stag = np.dot(P['lfoot'][b] - P['rfoot'][b], f)
                pushes.append(dict(a=a / fps, b=b / fps, s=s.upper(), fw=np.dot(o, f), lat=np.dot(o, l), stag=stag, bi=b))
            i = b + 1
        else: i += 1
pushes.sort(key=lambda p: p['a'])
# drop pushes that overlap an earlier push of the other hand (that hand was just moving)
clean = []
for p in pushes:
    if clean and p['a'] < clean[-1]['b'] and p['s'] != clean[-1]['s']: continue
    clean.append(p)
for k in range(len(clean) - 1):
    p, q = clean[k], clean[k + 1]
    if p['s'] == q['s']: continue
    kind = 'crossover'
    if abs(p['lat']) < 0.14 and abs(p['stag']) > 0.35: kind = 'TWEENER'
    elif p['fw'] < 0.0: kind = 'behind-back?'
    turn = yaw(q['bi']) - yaw(p['bi']); turn = (turn + 180) % 360 - 180
    print(f"{p['b']:6.2f} {p['s']}->{q['s']} {kind:12s} rel fwd {p['fw']:5.2f} lat {p['lat']:5.2f} stagger {p['stag']:5.2f} | next push {q['a']:.2f}  body turn to next release {turn:5.0f} deg")
