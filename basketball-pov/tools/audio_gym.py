"""Sound for the v4 gym clip (48 kHz stereo WAV): an empty practice gym, not an arena.

Room tone (air handling hum and hiss), every dribble with the long slap-back of a gym, sneaker squeaks, the gather,
the release, the swish and the bounces after it; for the v5 film-room clip also the ball off the glass, a body
collision, the referee's whistle and a freeze-frame accent (each only if the events file lists them). Shots played in slow motion get their hits pitched down and
stretched like slow-mo footage, and each cut gets a soft swoosh.
usage: python3 tools/audio_gym.py out/events4.json out/audio4.wav   (v5: out/events5.json out/audio5.wav)
"""
import json, sys, wave
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(11)
ev = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = ev['duration']
N = int(DUR * SR) + SR // 2


def db(x): return 10 ** (x / 20)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def gym_ir(rt=2.1, length=2.8):
    """Big hard room: a few strong early reflections off the floor and walls, then a long, slightly bright tail."""
    n = int(length * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
    ir = lp(ir, 6500) * (0.55 + 0.45 * np.exp(-t / 0.4))
    ir[: int(0.018 * SR)] *= np.linspace(0, 1, int(0.018 * SR))
    for d, g in [(0.021, 0.5), (0.034, 0.35), (0.057, 0.3), (0.089, 0.22), (0.131, 0.16)]:
        ir[int(d * SR)] += g * np.sqrt(np.sum(ir ** 2)) * 3
    return ir / np.sqrt(np.sum(ir ** 2))


IR = gym_ir()
def verb(x, wet): y = signal.fftconvolve(x, IR)[: len(x) + int(1.2 * SR)]; x2 = np.pad(x, (0, len(y) - len(x))); return x2 * (1 - wet) + y * wet


def slow(x, rate):
    """Slow-motion: stretch and pitch down (resample) by the playback rate's square root, like high-fps footage."""
    if rate >= 0.99: return x
    f = rate ** 0.5
    return signal.resample(x, int(len(x) / f))


def place(buf, clip, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(clip) <= 0: return
    j = min(buf.shape[1], i + len(clip)); s = max(0, -i)
    L = np.cos((pan + 1) * np.pi / 4); R = np.sin((pan + 1) * np.pi / 4)
    buf[0, i + s:j] += clip[s:j - i] * gain * L * 1.41; buf[1, i + s:j] += clip[s:j - i] * gain * R * 1.41


def bounce(pitch=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = (135 + 50 * np.exp(-t / 0.01)) * pitch
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    ring = np.sin(2 * np.pi * 540 * pitch * t) * np.exp(-t / 0.05) * 0.35 + np.sin(2 * np.pi * 1210 * pitch * t) * np.exp(-t / 0.02) * 0.14
    floor = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.05) * 0.6
    click = hp(rng.standard_normal(n), 1600) * np.exp(-t / 0.002) * 0.6
    x = thump + ring + floor + click
    return x / np.max(np.abs(x))


def squeak():
    dur = rng.uniform(0.08, 0.15); n = int(dur * SR); t = np.arange(n) / SR
    f0 = rng.uniform(1800, 2600); f1 = f0 * rng.uniform(1.05, 1.25)
    f = f0 + (f1 - f0) * (t / dur) + 70 * np.sin(2 * np.pi * rng.uniform(35, 60) * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(h * ph) / h * (0.8 ** h) for h in range(1, 6))
    e = np.minimum(t / 0.008, 1) * np.exp(-np.maximum(t - dur * 0.55, 0) / 0.02)
    x = bp(saw * e, 1300, 7500)
    return x / np.max(np.abs(x))


def slap():
    n = int(0.22 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 700, 3800) * np.exp(-t / 0.014) + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.025) * 0.6
    return x / np.max(np.abs(x))


def whff():
    n = int(0.25 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 380, 1700) * (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.05)
    return x / np.max(np.abs(x))


def swish():
    n = int(0.75 * SR); t = np.arange(n) / SR
    fl = np.clip(0.7 + 0.3 * np.abs(lp(rng.standard_normal(n), 40, 1)) * 4, 0, 1.4)
    x = bp(rng.standard_normal(n), 1800, 9500) * (1 - np.exp(-t / 0.015)) * np.exp(-t / 0.14) * fl
    x += bp(rng.standard_normal(n), 400, 1200) * np.exp(-t / 0.05) * 0.25
    return x / np.max(np.abs(x))


def swoosh(dur=0.45):
    """Soft edit swoosh: band-passed noise sweeping up then fading."""
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    y = np.zeros(n); lo, hi = 300, 5000
    for k in range(8):  # sweep by crossfading fixed bands
        f = lo * (hi / lo) ** (k / 7); w = np.exp(-((t / dur - k / 7) ** 2) / 0.02)
        y += bp(x, f * 0.8, min(f * 1.25, SR / 2 - 100)) * w
    y *= np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return y / np.max(np.abs(y))


def bank():
    """Ball off the glass: a dull knock with the board's bright ring, then the rim's clank as it drops in."""
    n = int(0.5 * SR); t = np.arange(n) / SR
    knock = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.018) + 0.5 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.03)
    glass = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(1340, 0.35, 0.05), (2210, 0.22, 0.035), (3570, 0.12, 0.02)])
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.0015) * 0.5
    x = knock + glass + click
    return x / np.max(np.abs(x))


def thud():
    """Bodies colliding: a low chest thump, the air knocked out, a scuff of rubber."""
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 62 + 70 * np.exp(-t / 0.02)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    x += bp(rng.standard_normal(n), 180, 900) * np.exp(-t / 0.035) * 0.6
    x += bp(rng.standard_normal(n), 500, 2500) * np.exp(-((t - 0.05) / 0.06) ** 2) * 0.18
    return x / np.max(np.abs(x))


def whistle(dur=0.55):
    """Referee's pea whistle: a bright tone fluttered by the pea, hard attack, quick release."""
    n = int(dur * SR); t = np.arange(n) / SR
    trill = 0.5 + 0.5 * np.sin(2 * np.pi * 31 * t + 2 * np.sin(2 * np.pi * 7 * t))
    f = 2870 + 60 * np.sin(2 * np.pi * 31 * t) + 25 * rng.standard_normal(n).cumsum() / np.sqrt(SR)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)) * (0.55 + 0.45 * trill)
    x += bp(rng.standard_normal(n), 2000, 6000) * 0.08
    e = np.minimum(t / 0.012, 1) * np.minimum(np.maximum(dur - t, 0) / 0.06, 1)
    return x * e / np.max(np.abs(x * e))


def freeze():
    """Freeze-frame accent: a short downward air sweep that stops dead, with a soft low hit."""
    n = int(0.32 * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); y = np.zeros(n)
    for k in range(6):
        f = 3600 * (0.45 ** (k / 5)); w = np.exp(-((t / 0.26 - k / 5) ** 2) / 0.03)
        y += bp(x, f * 0.75, f * 1.3) * w
    y *= np.minimum(t / 0.03, 1) * (t < 0.27)
    y += np.sin(2 * np.pi * 70 * t) * np.exp(-np.maximum(t - 0.25, 0) / 0.06) * (t > 0.25) * 0.8
    return y / np.max(np.abs(y))


mix = np.zeros((2, N + int(1.5 * SR)))
# room tone: air handling rumble + hiss, gently moving
t_all = np.arange(mix.shape[1]) / SR
hum = lp(np.cumsum(rng.standard_normal(mix.shape[1])) * 0.02, 160); hum /= np.sqrt(np.mean(hum ** 2)) + 1e-9
hiss = hp(rng.standard_normal(mix.shape[1]), 3000) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.13 * t_all))
tone = hum * db(-40) + hiss * db(-60) + np.sin(2 * np.pi * 60 * t_all) * db(-58)
mix[0] += tone; mix[1] += np.roll(tone, 373) * 0.95

for b in ev['bounces']:
    r = b.get('rate', 1)
    place(mix, verb(slow(bounce(rng.uniform(0.96, 1.04)), r), 0.42), b['t'] - 0.002, db(-9) * b.get('gain', 1), pan=rng.uniform(-0.15, 0.15))
for s in ev['squeaks']:
    place(mix, verb(slow(squeak(), s.get('rate', 1)), 0.45), s['t'], db(-21) * s.get('gain', 1), pan=rng.uniform(-0.3, 0.3))
for c in ev['catches']:
    place(mix, verb(slow(slap(), c.get('rate', 1)), 0.35), c['t'], db(-14) * c.get('gain', 1))
for c in ev['releases']:
    place(mix, verb(slow(whff(), c.get('rate', 1)), 0.3), c['t'], db(-22) * c.get('gain', 1))
for s in ev['swish']:
    place(mix, verb(slow(swish(), s.get('rate', 1)), 0.35), s['t'], db(-10), pan=-0.05)
for c in ev.get('cuts', []):
    place(mix, swoosh(), c['t'] - 0.25, db(-24))
for b in ev.get('board', []):
    place(mix, verb(slow(bank(), b.get('rate', 1)), 0.4), b['t'], db(-11), pan=0.05)
for c in ev.get('thuds', []):
    place(mix, verb(slow(thud(), c.get('rate', 1)), 0.3), c['t'], db(-11))
    place(mix, verb(slow(squeak(), c.get('rate', 1)), 0.45), c['t'] + 0.03, db(-18), pan=0.2)
for w in ev.get('whistles', []):
    place(mix, verb(whistle(), 0.5), w['t'], db(-15), pan=-0.25)
for f in ev.get('freezes', []):
    place(mix, freeze(), f['t'] - 0.27, db(-24))

mix = mix[:, : int(DUR * SR)]
peak = np.max(np.abs(mix)); mix *= db(-2.0) / (peak + 1e-9)
fade = int(0.3 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade); mix[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes())
print('wrote', OUT, 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix)) + 1e-9), 1), 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 1))
