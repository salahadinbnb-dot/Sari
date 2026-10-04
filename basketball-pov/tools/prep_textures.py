"""Builds per-player texture sets (uniform recolor, numbers, skin tone) from the Rocketbox athletes.

Output: assets/players/<name>/{body_color.jpg, head_color.jpg, body_rough.jpg, head_rough.jpg[, opacity_color.png]}
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'assets', 'players')
FONTS = os.path.join(ROOT, 'src', 'fonts')


def load(model, name):
    ext = 'png' if 'normal' in name or 'opacity' in name else 'jpg'
    return np.asarray(Image.open(os.path.join(RAW, f'm{model}', f'{name}.{ext}')).convert('RGBA' if 'opacity' in name else 'RGB')).astype(np.float32) / 255.0


def save_rgb(arr, path, q=92):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q)


def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return h, s, mx


def luma(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def rough_from_spec(spec, lo=0.38, hi=0.92):
    s = luma(spec)
    return np.clip(hi - (hi - lo) * s * 1.4, lo, hi)


def skin_mask(col):
    h, s, v = rgb_to_hsv(col)
    return ((h < 45) | (h > 340)) & (s > 0.18) & (s < 0.75) & (v > 0.18)


def tone_skin(col, mask, target, strength=1.0):
    """Remap masked skin pixels to a target skin albedo keeping relative detail."""
    L = luma(col)
    m = mask.astype(np.float32)
    mean = (L * m).sum() / max(m.sum(), 1)
    rel = (L / (mean + 1e-6))[..., None]
    rel = rel ** 1.15
    # keep a hint of original chroma variation (redness in lips/knuckles)
    chroma = col / (L[..., None] + 1e-6)
    tgt = hexrgb(target)
    tL = luma(tgt[None, None, :])[0, 0]
    tchroma = tgt / tL
    newchroma = tchroma * 0.8 + chroma * 0.2 * (tchroma.mean() / (chroma.mean() + 1e-6))
    new = rel * tL * newchroma
    w = (m * strength)[..., None]
    return col * (1 - w) + new * w


def feather(mask, r=2):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im).astype(np.float32) / 255


def text_layer(size, text, font, fill, box, rotate=0, stroke=0, stroke_fill=None, tracking=0):
    """Render text centered in box=(cx,cy,maxw,maxh) on an RGBA layer of full atlas size."""
    W, H = size
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx, cy, mw, mh = box
    # find font size to fit
    fs = int(mh * 1.3)
    while fs > 8:
        f = ImageFont.truetype(font, fs)
        tmp = Image.new('RGBA', (int(mw * 3), int(mh * 3)), (0, 0, 0, 0))
        d = ImageDraw.Draw(tmp)
        if tracking:
            x = 0
            for ch in text:
                d.text((x + stroke, stroke), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
                x += d.textlength(ch, font=f) + tracking * fs
        else:
            d.text((stroke, stroke), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        bb = tmp.getbbox()
        if bb and (bb[2] - bb[0]) <= mw and (bb[3] - bb[1]) <= mh:
            break
        fs -= 4
    glyph = tmp.crop(bb)
    if rotate:
        glyph = glyph.rotate(rotate, expand=True)
    layer.paste(glyph, (int(cx - glyph.width / 2), int(cy - glyph.height / 2)), glyph)
    return np.asarray(layer).astype(np.float32) / 255


def composite(col, layer, shade=None):
    a = layer[..., 3:4]
    c = layer[..., :3]
    if shade is not None:
        c = c * shade[..., None]
    return col * (1 - a) + c * a


os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------------------
from scipy import ndimage

BONE_GROUPS = {
    'torso': ['Spine1', 'Spine2', 'Neck', 'Clavicle'], 'pelvis': ['Pelvis', 'Spine'],
    'thigh': ['Thigh'], 'calf': ['Calf'], 'foot': ['Foot', 'Toe'],
    'upper': ['UpperArm'], 'fore': ['Forearm'], 'hand': ['Hand', 'Finger'], 'head': ['Head', 'Eye', 'Jaw', 'Lip', 'Mouth', 'Nose', 'Brow', 'brow', 'Cheek', 'Masseter', 'Caninus', 'Tongue', 'Eyebrow'],
}


def bone_group_ids(bones):
    gid = []
    for b in bones:
        n = b.replace('Bip01_', '').replace('Bip01', 'Root')
        g = 'pelvis'
        for k, keys in BONE_GROUPS.items():
            if any(key in n for key in keys): g = k
        if n in ('Spine', 'Pelvis', 'Root'): g = 'pelvis'
        gid.append(g)
    return gid


def classify_body(model, code, col):
    z = np.load(os.path.join(RAW, f'm{model}', 'bake.npz'))
    M = z[f'M_{code}_body']; B = z[f'B_{code}_body']; P = z[f'P_{code}_body']; N = z[f'N_{code}_body']
    groups = bone_group_ids(list(z['bones']))
    G = np.full(B.shape, '', dtype=object)
    gnames = np.array(groups + [''], dtype=object)
    G = gnames[np.where(B >= 0, B, len(groups))]
    skin = skin_mask(col) & M
    lab, n = ndimage.label(M)
    cls = np.full(M.shape, 'none', dtype=object)
    for i in range(1, n + 1):
        isl = lab == i
        cnt = isl.sum()
        if cnt < 30: continue
        gs, counts = np.unique(G[isl], return_counts=True)
        maj = gs[counts.argmax()]
        my = P[isl][:, 1].mean()
        skinfrac = skin[isl].mean()
        if maj in ('torso',) or (maj == 'pelvis' and my > 1.0):
            c = 'shirt'
        elif maj == 'upper':
            c = 'sleeve' if skinfrac < 0.5 else 'arm'
        elif maj in ('fore', 'hand'):
            c = 'arm'
        elif maj in ('thigh', 'pelvis'):
            c = 'shorts'
        elif maj == 'calf':
            c = 'calf'
        elif maj == 'foot':
            c = 'shoe' if my < 0.14 or skinfrac < 0.3 else 'calf'
        else:
            c = 'other'
        cls[isl] = c
    return dict(M=M, P=P, N=N, G=G, skin=skin, cls=cls)


def decal_rgba(text, font, h_m, color, outline=None, outline_px=0, ppm=1400, tracking=0.0, wide=1.0):
    """Returns RGBA float array and its size in meters (w,h) for text rendered at h_m meters tall."""
    fs = int(h_m * ppm * 1.25)
    f = ImageFont.truetype(font, fs)
    pad = outline_px * 2 + 10
    tmp = Image.new('RGBA', (int(fs * (len(text) + 1) * 1.1) + pad * 2, int(fs * 1.6) + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    x = pad
    for ch in text:
        if outline:
            d.text((x, pad), ch, font=f, fill=outline, stroke_width=outline_px, stroke_fill=outline)
        d.text((x, pad), ch, font=f, fill=color)
        x += d.textlength(ch, font=f) + tracking * fs
    bb = tmp.getbbox(); g = tmp.crop(bb)
    # scale to requested height
    th = int(h_m * ppm); tw = max(1, int(g.width * th / g.height * wide))
    g = g.resize((tw, th), Image.LANCZOS)
    return np.asarray(g).astype(np.float32) / 255, (tw / ppm, th / ppm)


def apply_decal(col, sel, P, dec, size, center, side, shade=None):
    """Project decal onto texels (sel) by bind-pose position. side: 'back' (viewer right = -x) or 'front'."""
    arr, (w, h) = dec
    cx, cy = center
    px = P[..., 0]; py = P[..., 1]
    u = ((-px if side == 'back' else px) - cx) / w + 0.5
    v = (cy - py) / h + 0.5
    inside = sel & (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    H_, W_ = arr.shape[:2]
    ui = np.clip((u[inside] * W_).astype(int), 0, W_ - 1); vi = np.clip((v[inside] * H_).astype(int), 0, H_ - 1)
    rgba = arr[vi, ui]
    a = rgba[:, 3:4]
    c = rgba[:, :3]
    if shade is not None:
        c = c * shade[inside][:, None]
    col[inside] = col[inside] * (1 - a) + c * a
    return col


def relshade(col, sel, lo=0.72, hi=1.18):
    L = luma(col)
    m = L[sel].mean() if sel.any() else 1
    return np.clip(L / (m + 1e-6), lo, hi)


def build_player(name, model, code, cfg):
    out = os.path.join(OUT, name); os.makedirs(out, exist_ok=True)
    col = load(model, 'body_color').copy()
    info = classify_body(model, code, col)
    M, P, N, skin, cls = info['M'], info['P'], info['N'], info['skin'], info['cls']
    h, s, v = rgb_to_hsv(col)
    L = luma(col)
    team = cfg['team']
    main, accent, trim = hexrgb(team['main']), hexrgb(team['accent']), hexrgb(team['trim'])
    shirt = ((cls == 'shirt') | (cls == 'sleeve')) & M
    if model == '04':
        shirt &= ~skin
    else:
        # sleeved kits have no bare skin inside the shirt islands; pinkish logo edges must not count as skin
        shirt = ndimage.binary_dilation(shirt, iterations=3) & ((cls == 'shirt') | (cls == 'sleeve') | ~M)
    newc = col.copy()
    if model == '04':
        # tank top: whole body -> main, side panels (facing sideways) -> accent, darkest piping -> trim
        blue = shirt & (h > 185) & (h < 255) & (s > 0.2)
        dark = blue & (v < 0.40); light = blue & (v >= 0.40); tr = blue & (v < 0.225)
        sh_d = relshade(col, dark, 0.86, 1.1); sh_l = relshade(col, light, 0.86, 1.1)
        shade = np.where(dark, sh_d, sh_l)
        sidep = blue & (np.abs(N[..., 0]) > 0.72)
        newc[blue] = main * shade[blue][:, None]
        newc[sidep] = accent * shade[sidep][:, None]
        trz = tr & (P[..., 1] > 1.38)
        newc[trz] = trim
        rest = shirt & ~blue
        newc[rest & (P[..., 1] > 1.38)] = trim
        newc[rest & (P[..., 1] <= 1.38)] = main * 0.97
    else:
        # soccer shirt: flatten stripes/logos -> main; orange trim (collar, cuffs, side seams) -> trim color
        orange = shirt & (((h < 30) | (h > 345)) & (s > 0.55) & (v > 0.35))
        trimzone = (P[..., 1] > 1.42) | (cls == 'sleeve') | (np.abs(N[..., 0]) > 0.6)
        otrim = orange & trimzone
        base = shirt & ~otrim
        noise = 0.975 + 0.025 * np.random.default_rng(3).random(L.shape).astype(np.float32)
        newc[base] = main * noise[base][:, None]
        newc[otrim] = trim
    # shorts
    shorts = (cls == 'shorts') & ~skin & M
    if model == '04':
        sh = relshade(col, shorts, 0.8, 1.12)
        newc[shorts] = hexrgb(team['shorts']) * sh[shorts][:, None]
    else:
        Lb = np.asarray(Image.fromarray((L * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))).astype(np.float32) / 255
        newc[shorts] = hexrgb(team['shorts']) * np.clip(0.95 + 0.0 * Lb[shorts], 0.9, 1.05)[:, None]
    # shorts side stripe (outer thigh)
    side = shorts & (np.abs(N[..., 0]) > 0.8) & (P[..., 0] * N[..., 0] > 0)
    newc[side] = hexrgb(team['stripe'])
    # socks
    socks = (cls == 'calf') & ~skin & M
    newc[socks] = hexrgb(team.get('socks', '#f2f2f2')) * np.clip(relshade(col, socks, 0.85, 1.1)[socks], 0.85, 1.1)[:, None] if model == '04' else hexrgb(team.get('socks', '#f2f2f2')) * 0.95
    # skin tone
    if cfg.get('skin'):
        clothes = shirt | shorts | socks
        skin_all = skin_mask(col) & ~clothes
        newc = tone_skin(newc, skin_all, cfg['skin'], 1.0)
    # decals
    shade_all = relshade(newc, shirt, 0.85, 1.1)
    font_num = os.path.join(FONTS, team.get('numfont', 'Graduate-Regular.ttf'))
    font_name = os.path.join(FONTS, 'BarlowCondensed-ExtraBold.ttf')
    num = str(cfg['number'])
    back = shirt & (N[..., 2] < -0.2)
    front = shirt & (N[..., 2] > 0.2)
    ncol = tuple(int(c * 255) for c in hexrgb(team['num'])) + (255,)
    ocol = tuple(int(c * 255) for c in hexrgb(team['numOutline'])) + (255,)
    y0 = cfg.get('yBack', 1.215)
    two = len(num) > 1
    newc = apply_decal(newc, back, P, decal_rgba(num, font_num, 0.22 if two else 0.25, ncol, ocol, 14, wide=0.78 if two else 1.0), None, (0.0, y0), 'back', shade_all)
    if cfg.get('name'):
        newc = apply_decal(newc, back, P, decal_rgba(cfg['name'], font_name, 0.055, ncol, None, 0, tracking=0.12), None, (0.0, y0 + 0.185), 'back', shade_all)
    newc = apply_decal(newc, front, P, decal_rgba(num, font_num, 0.12, ncol, ocol, 10, wide=0.85 if two else 1.0), None, (0.0, y0 + 0.02), 'front', shade_all)
    if team.get('word'):
        newc = apply_decal(newc, front, P, decal_rgba(team['word'], font_name, 0.058, ncol, ocol, 5, tracking=0.06), None, (0.0, y0 + 0.115), 'front', shade_all)
    save_rgb(newc, os.path.join(out, 'body_color.jpg'))
    if model != '04':
        nm = load(model, 'body_normal')
        zone = shirt & (P[..., 1] > 1.02) & (P[..., 1] < 1.43) & (np.abs(P[..., 0]) < 0.19) & (np.abs(N[..., 2]) > 0.25)
        blur = np.asarray(Image.fromarray((nm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(np.float32) / 255
        flat = np.array([0.5, 0.5, 1.0], np.float32)
        blur = blur * 0.15 + flat * 0.85
        w = feather(zone.astype(np.float32), 6)[..., None]
        nm = nm * (1 - w) + blur * w
        save_rgb(nm, os.path.join(out, 'body_normal.jpg'), 95)

    # roughness
    spec = load(model, 'body_specular')
    rough = rough_from_spec(spec)
    rough[shirt | shorts] = 0.84 + 0.04 * np.random.default_rng(5).random((shirt | shorts).sum()).astype(np.float32)
    save_rgb(np.repeat(rough[..., None], 3, -1), os.path.join(out, 'body_rough.jpg'), 88)
    # head
    hc = load(model, 'head_color').copy()
    z = np.load(os.path.join(RAW, f'm{model}', 'bake.npz'))
    Mh = z[f'M_{code}_head']; Ph = z[f'P_{code}_head']
    Lh = luma(hc)
    hair = Mh & (Lh < 0.3) & (Ph[..., 1] > 1.55)
    hs, hsat, hv = rgb_to_hsv(hc)
    eyes = Mh & ((hsat < 0.15) & (hv > 0.55))
    skin_h = skin_mask(hc) & ~hair
    if cfg.get('skin'):
        hc = tone_skin(hc, skin_h, cfg['skin'], 1.0)
    if cfg.get('hair'):
        hw = feather(hair.astype(np.float32), 1.5)[..., None]
        tgt = hexrgb(cfg['hair'])
        hc = hc * (1 - hw) + (tgt * (Lh / 0.22)[..., None] ** 0.8) * hw
    save_rgb(hc, os.path.join(out, 'head_color.jpg'))
    hspec = load(model, 'head_specular')
    save_rgb(np.repeat(rough_from_spec(hspec, 0.42, 0.9)[..., None], 3, -1), os.path.join(out, 'head_rough.jpg'), 88)
    if os.path.exists(os.path.join(RAW, f'm{model}', 'opacity_color.png')):
        op = Image.open(os.path.join(RAW, f'm{model}', 'opacity_color.png')).convert('RGBA')
        a = np.asarray(op).astype(np.float32) / 255
        if cfg.get('hair'):
            tgt = hexrgb(cfg['hair']); Lo = luma(a[..., :3])
            a[..., :3] = tgt * (Lo / 0.2)[..., None] ** 0.8
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(os.path.join(out, 'opacity_color.png'))
    print('built', name)


HOME = dict(main='#f4f4f1', accent='#1d4fc4', trim='#0e1c47', shorts='#f1f1ee', stripe='#1d4fc4', socks='#f4f4f4',
            num='#13245a', numOutline='#2b62e0', word='STORM')
AWAY = dict(main='#b3122c', accent='#8d0b20', trim='#ffffff', shorts='#b3122c', stripe='#ffffff', socks='#f2f2f2',
            num='#ffffff', numOutline='#15161a', word='BLAZE')

PLAYERS = {
    'you':      ('04', 'm026', dict(team=HOME, number=3, name='YOU')),
    'screener': ('04', 'm026', dict(team=HOME, number=34, name='', skin='#5a3726', hair='#141111')),
    'wing':     ('04', 'm026', dict(team=HOME, number=11, name='', skin='#8a5a3c', hair='#18130f')),
    'd1':       ('03', 'm300', dict(team=AWAY, number=5, name='')),
    'd2':       ('02', 'm301', dict(team=AWAY, number=21, name='', skin='#4d2f22', hair='#121010')),
    'd3':       ('02', 'm301', dict(team=AWAY, number=8, name='', skin='#b07a55', hair='#241a13')),
}

if __name__ == '__main__':
    which = sys.argv[1:] or list(PLAYERS)
    for n in which:
        m, code, cfg = PLAYERS[n]
        build_player(n, m, code, cfg)
