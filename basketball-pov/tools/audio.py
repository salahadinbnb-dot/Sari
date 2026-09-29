"""Synthesize the arena sound bed + synced SFX for the video (48 kHz stereo WAV).

Crowd murmur (muffled during freeze frames, swells on the make), ball bounces on every dribble,
catch slaps, net swish, sneaker squeaks, freeze-frame hits/whooshes, subtle UI ticks.
"""
import json, os, sys, wave
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(7)
EVENTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'events.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'out', 'audio.wav')
ev = json.load(open(EVENTS))
DUR = ev['duration']
N = int(DUR * SR) + SR // 2
t_all = np.arange(N) / SR


def db(x): return 10 ** (x / 20)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def env_smooth(x, cutoff):
    return lp(x, cutoff, 1)


def place(buf, clip, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(clip) <= 0: return
    j = min(buf.shape[1], i + len(clip))
    s = max(0, -i)
    L = np.cos((pan + 1) * np.pi / 4); R = np.sin((pan + 1) * np.pi / 4)
    buf[0, i + s:j] += clip[s:j - i] * gain * L * 1.41
    buf[1, i + s:j] += clip[s:j - i] * gain * R * 1.41


def reverb_ir(rt=1.6, length=2.2, bright=4000):
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
    ir = lp(ir, bright)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


IR = reverb_ir()


def verb(x, wet=0.25):
    y = signal.fftconvolve(x, IR)[: len(x)]
    return x * (1 - wet) + y * wet


# ---------------- crowd bed ----------------
def babble(n, voices, flo, fhi, rate=(3.0, 6.5)):
    out = np.zeros(n)
    for _ in range(voices):
        fc = np.exp(rng.uniform(np.log(flo), np.log(fhi)))
        v = bp(rng.standard_normal(n), fc * 0.7, min(fc * 1.45, SR / 2 - 100))
        r = rng.uniform(*rate)
        e = np.abs(env_smooth(rng.standard_normal(n), r)) ** 1.4
        slow = 0.55 + 0.45 * np.abs(env_smooth(rng.standard_normal(n), 0.25)) * 3
        out += v * e * slow
    return out / (np.sqrt(np.mean(out ** 2)) + 1e-9)


print('crowd...')
crowd = babble(N, 46, 220, 2400)
air = lp(np.cumsum(rng.standard_normal(N)) * 0.02, 380)  # brown-ish rumble
air = air / (np.sqrt(np.mean(air ** 2)) + 1e-9)
crowd = crowd * 0.85 + air * 0.35
crowd = verb(crowd, 0.55)
crowd /= np.sqrt(np.mean(crowd ** 2)) + 1e-9
# cheer layer on the make
cheer = babble(N, 36, 600, 4200, rate=(5, 9))
cheer = verb(cheer, 0.5); cheer /= np.sqrt(np.mean(cheer ** 2)) + 1e-9
swell = np.zeros(N)
for s in ev['score']:
    tt = t_all - s['t']
    swell += np.where(tt > 0, (1 - np.exp(-tt / 0.18)) * np.exp(-np.maximum(tt - 0.6, 0) / 2.6), 0)
# freeze muffle: crossfade to a low-passed, quieter crowd while time is stopped
fz = np.zeros(N)
for f in ev['freezes']:
    if f['tag'] == 'end': continue  # the crowd keeps going over the end card
    a, b = f['t'], f['t'] + f['dur']
    fz += np.clip(np.minimum((t_all - a) / 0.12, (b - t_all) / 0.15), 0, 1)
fz = np.clip(fz, 0, 1)
crowd_m = lp(crowd, 520, 3) * db(-3)
crowd_mix = crowd * (1 - fz) + crowd_m * fz
crowd_mix = crowd_mix * db(-31) + cheer * swell * db(-24) + crowd * swell * db(-30)
# stereo decorrelation
crowdL = crowd_mix
crowdR = np.roll(crowd_mix, int(0.011 * SR)) * 0.9 + babble(N, 10, 300, 2000) * db(-40)

mix = np.zeros((2, N))
mix[0] += crowdL; mix[1] += crowdR


# ---------------- SFX ----------------
def bounce_clip(pitch=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = (140 + 45 * np.exp(-t / 0.01)) * pitch
    ph = 2 * np.pi * np.cumsum(f) / SR
    thump = np.sin(ph) * np.exp(-t / 0.032)
    ring = np.sin(2 * np.pi * 520 * pitch * t) * np.exp(-t / 0.045) * 0.32 + np.sin(2 * np.pi * 1190 * pitch * t) * np.exp(-t / 0.018) * 0.12
    floor = np.sin(2 * np.pi * 72 * t) * np.exp(-t / 0.055) * 0.55
    click = hp(rng.standard_normal(n), 1500) * np.exp(-t / 0.0022) * 0.55
    x = thump + ring + floor + click
    # early reflections off the floor/stands
    y = x.copy()
    for d, g in [(0.021, 0.28), (0.043, 0.18), (0.071, 0.11), (0.097, 0.07)]:
        k = int(d * SR); y[k:] += lp(x[:-k], 2500) * g
    return y / np.max(np.abs(y))


def slap_clip():
    n = int(0.25 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 700, 3600) * np.exp(-t / 0.016) + np.sin(2 * np.pi * 175 * t) * np.exp(-t / 0.028) * 0.6
    return x / np.max(np.abs(x))


def whff_clip():
    n = int(0.22 * SR); t = np.arange(n) / SR
    e = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.05)
    x = bp(rng.standard_normal(n), 350, 1600) * e
    return x / np.max(np.abs(x))


def swish_clip():
    n = int(0.7 * SR); t = np.arange(n) / SR
    e = (1 - np.exp(-t / 0.015)) * np.exp(-t / 0.13)
    flutter = 0.7 + 0.3 * np.abs(env_smooth(rng.standard_normal(n), 40)) * 4
    x = bp(rng.standard_normal(n), 1800, 9500) * e * np.clip(flutter, 0, 1.4)
    x += bp(rng.standard_normal(n), 400, 1200) * np.exp(-t / 0.05) * 0.25
    return x / np.max(np.abs(x))


def squeak_clip():
    dur = rng.uniform(0.08, 0.14); n = int(dur * SR); t = np.arange(n) / SR
    f0 = rng.uniform(1900, 2500); f1 = f0 * rng.uniform(1.05, 1.22)
    f = f0 + (f1 - f0) * (t / dur) + 60 * np.sin(2 * np.pi * rng.uniform(35, 55) * t)
    f *= 1 + 0.02 * env_smooth(rng.standard_normal(n), 400) * 10
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = np.zeros(n)
    for h in range(1, 6): saw += np.sin(h * ph) / h * (0.8 ** h)
    e = np.minimum(t / 0.008, 1) * np.exp(-np.maximum(t - dur * 0.55, 0) / 0.02)
    x = bp(saw * e, 1400, 7000)
    return x / np.max(np.abs(x))


def sweep_noise(dur, f_start, f_end, q=3.0):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = np.zeros(n)
    # time-varying 2-pole resonator
    y1 = y2 = 0.0
    for i in range(n):
        fr = f_start * (f_end / f_start) ** (i / n)
        w = 2 * np.pi * fr / SR
        r = np.exp(-w / (2 * q))
        a1 = 2 * r * np.cos(w); a2 = -r * r
        yy = (1 - r) * x[i] + a1 * y1 + a2 * y2
        y[i] = yy; y2 = y1; y1 = yy
    return y / (np.max(np.abs(y)) + 1e-9)


def impact_clip():
    n = int(1.4 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (52 + 30 * np.exp(-t / 0.04)) * t) * np.exp(-t / 0.3)
    shimmer = (np.sin(2 * np.pi * 2350 * t) + 0.6 * np.sin(2 * np.pi * 3525 * t)) * np.exp(-t / 0.45) * 0.08
    click = hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.004) * 0.4
    x = boom + shimmer + click
    x = verb(x, 0.35)
    return x / np.max(np.abs(x))


def board_clip():
    # glass/backboard kiss: dull wooden thump + short metallic rattle from the rim assembly
    n = int(0.5 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (118 + 60 * np.exp(-t / 0.008)) * t) * np.exp(-t / 0.05)
    body = bp(rng.standard_normal(n), 250, 1100) * np.exp(-t / 0.03) * 0.5
    rattle = (np.sin(2 * np.pi * 1630 * t) + 0.7 * np.sin(2 * np.pi * 2410 * t)) * np.exp(-t / 0.09) * 0.07
    x = thump + body + rattle
    return x / np.max(np.abs(x))


def tick_clip():
    n = int(0.09 * SR); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 1500 * t) + 0.5 * np.sin(2 * np.pi * 2250 * t)) * np.exp(-t / 0.018)
    return x / np.max(np.abs(x))


print('sfx...')
for b in ev['bounces']:
    c = verb(bounce_clip(rng.uniform(0.95, 1.05)), 0.2)
    place(mix, c, b['t'] - 0.002, db(-11) * b.get('gain', 1) * rng.uniform(0.85, 1.0), pan=0.12)
for c in ev['catches']:
    place(mix, verb(slap_clip(), 0.2), c['t'], db(-15) * c['gain'], pan=0.0)
for c in ev['releases']:
    place(mix, whff_clip(), c['t'], db(-26) * c['gain'])
for b in ev.get('board', []):
    place(mix, verb(board_clip(), 0.3), b['t'], db(-17) * b.get('gain', 1), pan=-0.05)
for s in ev['swish']:
    place(mix, verb(swish_clip(), 0.25), s['t'], db(-13), pan=-0.05)
for s in ev['squeaks']:
    place(mix, verb(squeak_clip(), 0.3), s['t'], db(-27) * s['gain'], pan=rng.uniform(-0.3, 0.3))
imp = impact_clip()
for f in ev['freezes']:
    if f['tag'] == 'intro':
        place(mix, imp, 0.02, db(-12))
        continue
    if f['tag'] == 'end':
        continue
    wi = sweep_noise(0.32, 350, 3200)
    wi *= np.linspace(0, 1, len(wi)) ** 2
    place(mix, wi, f['t'] - 0.3, db(-19))
    place(mix, imp, f['t'], db(-11) if f['tag'] != 'setup' else db(-17))
    wo = sweep_noise(0.26, 3000, 380)
    wo *= np.linspace(1, 0, len(wo)) ** 1.5
    place(mix, wo, f['t'] + f['dur'] - 0.04, db(-21))
for s in ev['steps']:
    place(mix, tick_clip(), s['t'], db(-28))

# master: gentle glue + limiter
mix = mix[:, : int(DUR * SR)]
rms = np.sqrt(np.mean(mix ** 2))
mix *= db(-19) / (rms + 1e-9)
peak = np.max(np.abs(mix))
mix = np.tanh(mix / db(-1.2)) * db(-1.2) if peak > db(-1.2) else mix
fade = int(0.35 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
mix[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
out = OUT
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes())
print('wrote', out, 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix)) + 1e-9), 1), 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 1))
