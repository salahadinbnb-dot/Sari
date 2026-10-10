"""Sound for v12 "read the room" (48 kHz stereo WAV): a quiet room with a group talking under it, a soft pop for
each speech bubble, a short tone for each signal in the brain (higher toward the front of the brain), a low buzz
when something's off, a bell when something lands, and a whoosh for the rewind.
usage: python3 tools/audio_room.py out/events12.json out/audio12.wav
"""
import json, sys, wave
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(12)
ev = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = ev['duration']
N = int(DUR * SR) + SR


def db(x): return 10 ** (x / 20)
def bp(x, lo, hi): return signal.sosfilt(signal.butter(2, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f): return signal.sosfilt(signal.butter(2, f, btype='low', fs=SR, output='sos'), x)


def place(buf, clip, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(clip) <= 0: return
    a, b = max(0, i), min(buf.shape[1], i + len(clip))
    c = clip[a - i:b - i] * gain
    buf[0, a:b] += c * np.sqrt(0.5 * (1 - pan)); buf[1, a:b] += c * np.sqrt(0.5 * (1 + pan))


def verb(x, wet=0.25, rt=0.6):
    n = int(rt * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (rt * SR / 6.9)); ir = lp(ir, 5000); ir /= np.sqrt(np.sum(ir ** 2))
    y = signal.fftconvolve(x, ir)[: len(x) + n]; x2 = np.pad(x, (0, len(y) - len(x))); return x2 * (1 - wet) + y * wet * 0.5


def pop():
    t = np.arange(int(0.07 * SR)) / SR; f = 900 * np.exp(-t * 18) + 380
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 55)


def blip(pitch):
    t = np.arange(int(0.11 * SR)) / SR; f = 440 * 2 ** (pitch * 1.2)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.minimum(t / 0.004, 1) * np.exp(-t * 30)


def buzz():
    t = np.arange(int(0.45 * SR)) / SR
    x = signal.sawtooth(2 * np.pi * 110 * t) + signal.sawtooth(2 * np.pi * 116.5 * t)
    return lp(x, 900) * np.minimum(t / 0.02, 1) * np.exp(-t * 5)


def chime():
    out = np.zeros(int(1.6 * SR))
    for k, (f, d) in enumerate([(523.25, 0), (659.25, 0.07), (783.99, 0.14), (1046.5, 0.21)]):
        t = np.arange(len(out) - int(d * SR)) / SR
        out[int(d * SR):] += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 6)) * np.exp(-t * 2.6) * 0.5
    return out


def whoosh(dur=0.9):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    y = np.zeros(n)
    for k in range(0, n, 512):
        f = 300 + 2600 * np.sin(np.pi * min(1, k / n)) ** 2
        seg = x[k:k + 512]; y[k:k + 512] = bp(seg, f * 0.7, f * 1.3) if len(seg) > 30 else 0
    return y * np.sin(np.pi * t / dur) ** 2


mix = np.zeros((2, N))
# room tone everywhere; the group's murmur while we're in the room
t_all = np.arange(N) / SR
air = lp(rng.standard_normal(N), 400); air /= np.sqrt(np.mean(air ** 2)) + 1e-9
mix += air * db(-55)
mur = bp(rng.standard_normal(N), 220, 950)
syl = lp(np.abs(rng.standard_normal(N)), 5.0); syl /= syl.max() + 1e-9
mur *= 0.35 + 0.65 * syl; mur /= np.sqrt(np.mean(mur ** 2)) + 1e-9
inroom = np.zeros(N)
for a, b in ev.get('room', []):
    inroom += np.clip((t_all - a) / 0.4, 0, 1) * np.clip((b - t_all) / 0.4, 0, 1)
mix[0] += mur * inroom * db(-47); mix[1] += np.roll(mur, 911) * inroom * db(-47)

for p in ev['pops']: place(mix, verb(pop(), 0.2), p['t'], db(-20), pan=rng.uniform(-0.3, 0.3))
for b in ev['blips']: place(mix, verb(blip(b['pitch']), 0.35), b['t'], db(-27), pan=0.3 * (b['pitch'] - 1.1))
for b in ev['buzz']: place(mix, verb(buzz(), 0.3), b['t'], db(-17))
for c in ev['chimes']: place(mix, verb(chime(), 0.35, 1.2), c['t'], db(-17))
for w in ev['whoosh']: place(mix, whoosh(), w['t'] - 0.35, db(-17))

mix = mix[:, : int(DUR * SR)]
peak = np.max(np.abs(mix)); mix *= db(-2.0) / (peak + 1e-9)
fade = int(0.4 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade); mix[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes())
print('wrote', OUT, 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix)) + 1e-9), 1), 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 1))
