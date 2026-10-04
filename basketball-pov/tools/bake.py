"""Bake per-texel bind-pose position / normal / dominant bone for each material atlas."""
import json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
S = 2048


def bake(model):
    d = json.load(open(os.path.join(RAW, f'm{model}', 'mesh.json')))
    pos = np.array(d['pos'], np.float32).reshape(-1, 3)
    nrm = np.array(d['nrm'], np.float32).reshape(-1, 3)
    uv = np.array(d['uv'], np.float32).reshape(-1, 2)
    si = np.array(d['si'], np.int32).reshape(-1, 4)
    sw = np.array(d['sw'], np.float32).reshape(-1, 4)
    dom = si[np.arange(len(si)), sw.argmax(1)]
    out = {}
    for mi, mname in enumerate(d['mats']):
        P = np.zeros((S, S, 3), np.float32); N = np.zeros((S, S, 3), np.float32)
        B = np.full((S, S), -1, np.int16); M = np.zeros((S, S), bool)
        for g in d['groups']:
            if g['materialIndex'] != mi: continue
            for t in range(g['start'], g['start'] + g['count'], 3):
                ids = [t, t + 1, t + 2]
                tu = uv[ids] % 1.0 if False else uv[ids]
                px = tu[:, 0] * S - 0.5; py = (1 - tu[:, 1]) * S - 0.5
                x0, x1 = int(np.floor(px.min())), int(np.ceil(px.max()))
                y0, y1 = int(np.floor(py.min())), int(np.ceil(py.max()))
                x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, S - 1); y1 = min(y1, S - 1)
                if x1 < x0 or y1 < y0: continue
                xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
                # barycentric
                (ax, bx, cx), (ay, by, cy) = px, py
                den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
                if abs(den) < 1e-9: continue
                l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
                l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
                l3 = 1 - l1 - l2
                eps = -0.02
                inside = (l1 >= eps) & (l2 >= eps) & (l3 >= eps)
                if not inside.any(): continue
                yy, xx = ys[inside], xs[inside]
                w = np.stack([l1[inside], l2[inside], l3[inside]], -1)
                P[yy, xx] = w @ pos[ids]
                N[yy, xx] = w @ nrm[ids]
                bw = dom[ids][w.argmax(1)]
                B[yy, xx] = bw
                M[yy, xx] = True
        out[mname] = dict(P=P, N=N, B=B, M=M)
        print(model, mname, 'coverage', M.mean().round(3))
    np.savez_compressed(os.path.join(RAW, f'm{model}', 'bake.npz'), bones=np.array(d['bones']),
                        **{f'{k}_{m}': v[k] for m, v in out.items() for k in v})


if __name__ == '__main__':
    for m in sys.argv[1:] or ['04', '03', '02']:
        bake(m)
