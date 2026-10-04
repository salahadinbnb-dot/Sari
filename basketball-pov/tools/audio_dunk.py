"""Sound for the v6 dunk clip (48 kHz stereo WAV), in the same empty practice gym as v4/v5.

Room tone, sneakers on the maple for every step of the approach (the plant louder, with a squeak), a whoosh as he
leaves the floor, the fingers slapping the rim on the touch, and for the dunk: the throw-down - the rim's clang, the
breakaway hinge's spring, the backboard and stanchion shaking - the net, and the ball bouncing after. Slow-motion
hits are stretched and pitched down; freezes get an accent; cuts a soft swoosh.
usage: python3 tools/audio_dunk.py out/events6.json out/audio6.wav
"""
import json, sys, wave
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(23)
ev = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = ev['duration']
N = int(DUR * SR) + SR // 2


def db(x): return 10 ** (x / 20)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)
def norm(x): return x / (np.max(np.abs(x)) + 1e-12)


def gym_ir(rt=2.1, length=2.8):
    n = int(length * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
    ir = lp(ir, 6500) * (0.55 + 0.45 * np.exp(-t / 0.4))
    ir[: int(0.018 * SR)] *= np.linspace(0, 1, int(0.018 * SR))
    for d, g in [(0.021, 0.5), (0.034, 0.35), (0.057, 0.3), (0.089, 0.22), (0.131, 0.16)]:
        ir[int(d * SR)] += g * np.sqrt(np.sum(ir ** 2)) * 3
    return ir / np.sqrt(np.sum(ir ** 2))


IR = gym_ir()
def verb(x, wet): y = signal.fftconvolve(x, IR)[: len(x) + int(1.2 * SR)]; x2 = np.pad(x, (0, len(y) - len(x))); return x2 * (1 - wet) + y * wet
def slow(x, rate): return x if rate >= 0.99 else signal.resample(x, int(len(x) / rate ** 0.5))


def place(buf, clip, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(clip) <= 0: return
    j = min(buf.shape[1], i + len(clip)); s = max(0, -i)
    L = np.cos((pan + 1) * np.pi / 4); R = np.sin((pan + 1) * np.pi / 4)
    buf[0, i + s:j] += clip[s:j - i] * gain * L * 1.41; buf[1, i + s:j] += clip[s:j - i] * gain * R * 1.41


def step(hard=0.5):
    """Sneaker on hardwood: a soft heel thud and the rubber's short scuff; harder = more low end."""
    n = int(0.25 * SR); t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (85 + 40 * np.exp(-t / 0.01)) * t) * np.exp(-t / (0.02 + 0.02 * hard))
    scuff = bp(rng.standard_normal(n), 900, 4200) * np.exp(-t / 0.012) * (0.5 - 0.25 * hard)
    board = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03) * 0.25
    return norm(thud + scuff + board)


def squeak():
    dur = rng.uniform(0.09, 0.16); n = int(dur * SR); t = np.arange(n) / SR
    f0 = rng.uniform(1900, 2600); f1 = f0 * rng.uniform(1.05, 1.25)
    f = f0 + (f1 - f0) * (t / dur) + 70 * np.sin(2 * np.pi * rng.uniform(35, 60) * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(h * ph) / h * (0.8 ** h) for h in range(1, 6))
    e = np.minimum(t / 0.008, 1) * np.exp(-np.maximum(t - dur * 0.55, 0) / 0.02)
    return norm(bp(saw * e, 1300, 7500))


def whoosh(dur=0.6):
    """Air past the body as he leaves the floor: band noise sweeping up."""
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); y = np.zeros(n)
    for k in range(8):
        f = 250 * (14 ** (k / 7)); w = np.exp(-((t / dur - k / 8) ** 2) / 0.03)
        y += bp(x, f * 0.8, min(f * 1.3, SR / 2 - 100)) * w
    return norm(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2)


def rim_partials(t, amp=1.0, decay=1.0):
    """A basketball rim's clang: inharmonic steel partials with long, uneven decays."""
    x = np.zeros_like(t)
    for f, a, d in [(462, 1.0, 0.35), (1131, 0.6, 0.22), (1895, 0.42, 0.16), (2760, 0.3, 0.1), (3990, 0.18, 0.06)]:
        x += a * np.sin(2 * np.pi * f * t * (1 + 0.002 * np.sin(2 * np.pi * 5 * t))) * np.exp(-t / (d * decay))
    return x * amp


def rim_touch():
    """Fingers slapping the front of the rim: a skin slap and a light ring of the steel; the net rustles."""
    n = int(1.2 * SR); t = np.arange(n) / SR
    slap = bp(rng.standard_normal(n), 600, 3500) * np.exp(-t / 0.012)
    ring = rim_partials(t, 0.35, 0.6)
    net = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-((t - 0.12) / 0.12) ** 2) * 0.12
    return norm(slap + ring + net)


def slam():
    """The throw-down: ball and hand hammer the rim (clang), the breakaway hinge springs (a low boing that wobbles),
    the stanchion and the glass shake (a deep thud and a rattle), the net snaps."""
    n = int(2.4 * SR); t = np.arange(n) / SR
    hit = bp(rng.standard_normal(n), 300, 5000) * np.exp(-t / 0.008) * 1.2
    clang = rim_partials(t, 1.0, 1.4)
    f = 170 * (1 + 0.06 * np.sin(2 * np.pi * 6.5 * t) * np.exp(-t / 0.4))
    spring = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45) * 0.55
    boom = np.sin(2 * np.pi * (58 + 30 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.18) * 0.9
    rattle = hp(rng.standard_normal(n), 3000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 26 * t))) * np.exp(-t / 0.22) * 0.2
    net = bp(rng.standard_normal(n), 1800, 9000) * np.exp(-((t - 0.05) / 0.09) ** 2) * 0.35
    return norm(hit + clang + spring + boom + rattle + net)


def sub_hit():
    """A low cinematic hit under the slow-motion slam."""
    n = int(1.4 * SR); t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * (38 + 40 * np.exp(-t / 0.06)) * t) * np.exp(-t / 0.5))


def bounce(pitch=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = (135 + 50 * np.exp(-t / 0.01)) * pitch
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    ring = np.sin(2 * np.pi * 540 * pitch * t) * np.exp(-t / 0.05) * 0.35 + np.sin(2 * np.pi * 1210 * pitch * t) * np.exp(-t / 0.02) * 0.14
    floor = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.05) * 0.6
    click = hp(rng.standard_normal(n), 1600) * np.exp(-t / 0.002) * 0.6
    return norm(thump + ring + floor + click)


def swish():
    n = int(0.6 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1800, 9500) * (1 - np.exp(-t / 0.01)) * np.exp(-t / 0.1)
    return norm(x + bp(rng.standard_normal(n), 400, 1200) * np.exp(-t / 0.05) * 0.25)


def swoosh(dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); y = np.zeros(n); lo, hi = 300, 5000
    for k in range(8):
        f = lo * (hi / lo) ** (k / 7); w = np.exp(-((t / dur - k / 7) ** 2) / 0.02)
        y += bp(x, f * 0.8, min(f * 1.25, SR / 2 - 100)) * w
    return norm(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5)


def freeze():
    n = int(0.32 * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); y = np.zeros(n)
    for k in range(6):
        f = 3600 * (0.45 ** (k / 5)); w = np.exp(-((t / 0.26 - k / 5) ** 2) / 0.03)
        y += bp(x, f * 0.75, f * 1.3) * w
    y *= np.minimum(t / 0.03, 1) * (t < 0.27)
    y += np.sin(2 * np.pi * 70 * t) * np.exp(-np.maximum(t - 0.25, 0) / 0.06) * (t > 0.25) * 0.8
    return norm(y)


mix = np.zeros((2, N + int(2.5 * SR)))
t_all = np.arange(mix.shape[1]) / SR
hum = lp(np.cumsum(rng.standard_normal(mix.shape[1])) * 0.02, 160); hum /= np.sqrt(np.mean(hum ** 2)) + 1e-9
hiss = hp(rng.standard_normal(mix.shape[1]), 3000) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.13 * t_all))
tone = hum * db(-40) + hiss * db(-60) + np.sin(2 * np.pi * 60 * t_all) * db(-58)
mix[0] += tone; mix[1] += np.roll(tone, 373) * 0.95

for s in ev['steps']:
    r = s.get('rate', 1)
    hard = 1.0 if s.get('plant') else s.get('gain', 0.5)
    place(mix, verb(slow(step(hard), r), 0.4), s['t'], db(-14) * (0.6 + 0.4 * hard), pan=rng.uniform(-0.2, 0.2))
    if s.get('plant') or hard > 0.8: place(mix, verb(slow(squeak(), r), 0.45), s['t'] + 0.02, db(-20), pan=rng.uniform(-0.3, 0.3))
for w in ev.get('whoosh', []):
    place(mix, verb(slow(whoosh(), w.get('rate', 1)), 0.2), w['t'] - 0.1, db(-26))
for r in ev.get('rimTouch', []):
    place(mix, verb(slow(rim_touch(), r.get('rate', 1)), 0.45), r['t'], db(-10), pan=0.1)
for s in ev.get('slam', []):
    rr = s.get('rate', 1)
    place(mix, verb(slow(slam(), rr), 0.45), s['t'], db(-4), pan=0.05)
    if rr < 0.6: place(mix, sub_hit(), s['t'], db(-8))
for s in ev.get('swish', []):
    place(mix, verb(slow(swish(), s.get('rate', 1)), 0.35), s['t'], db(-14), pan=-0.05)
for b in ev['bounces']:
    place(mix, verb(slow(bounce(rng.uniform(0.96, 1.04)), b.get('rate', 1)), 0.42), b['t'] - 0.002, db(-8) * b.get('gain', 1), pan=rng.uniform(-0.15, 0.15))
for c in ev.get('cuts', []):
    place(mix, swoosh(), c['t'] - 0.25, db(-24))
for f in ev.get('freezes', []):
    place(mix, freeze(), f['t'] - 0.27, db(-24))

mix = mix[:, : int(DUR * SR)]
peak = np.max(np.abs(mix)); mix *= db(-2.0) / (peak + 1e-9)
fade = int(0.3 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade); mix[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes())
print('wrote', OUT, 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix)) + 1e-9), 1), 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 1))
