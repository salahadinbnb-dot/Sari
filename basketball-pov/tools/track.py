"""Track one player's body through a video (MediaPipe Pose Landmarker, CPU).

usage: python3 tools/track.py <video> <out_prefix> [--hint x,y] [--t0 s] [--t1 s] [--model heavy|full]
  --hint x,y   where the player is in the first frame (0..1 image coords); default: the biggest person
Writes <out_prefix>.json (per frame: time, 2D image landmarks + visibility, 3D world landmarks in metres around the
hips), <out_prefix>_overlay.mp4 (the footage with the tracked skeleton drawn on it) and <out_prefix>_pose.mp4 (the
skeleton alone on black, the pose-reference format AI video tools take).
"""
import argparse, json, os, subprocess
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
import imageio_ffmpeg

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('out')
ap.add_argument('--hint', default=None); ap.add_argument('--t0', type=float, default=0); ap.add_argument('--t1', type=float, default=1e9)
ap.add_argument('--model', default='heavy')
a = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
opts = vision.PoseLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=os.path.join(ROOT, f'assets/track/pose_landmarker_{a.model}.task')),
    running_mode=vision.RunningMode.VIDEO, num_poses=4, min_pose_detection_confidence=0.4,
    min_pose_presence_confidence=0.4, min_tracking_confidence=0.5)
det = vision.PoseLandmarker.create_from_options(opts)

cap = cv2.VideoCapture(a.video)
fps = cap.get(cv2.CAP_PROP_FPS) or 30; W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
FF = imageio_ffmpeg.get_ffmpeg_exe()
def writer(path):
    return subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                             '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)
ov, po = writer(a.out + '_overlay.mp4'), writer(a.out + '_pose.mp4')

# OpenPose-style limb colours (BGR) over MediaPipe's 33 points
LIMBS = [((11, 12), (0, 170, 255)), ((11, 13), (0, 255, 170)), ((13, 15), (0, 255, 85)), ((12, 14), (0, 85, 255)), ((14, 16), (0, 0, 255)),
         ((11, 23), (255, 170, 0)), ((12, 24), (170, 255, 0)), ((23, 24), (255, 255, 0)), ((23, 25), (255, 85, 0)), ((25, 27), (255, 0, 0)),
         ((27, 31), (255, 0, 170)), ((24, 26), (85, 255, 0)), ((26, 28), (0, 255, 0)), ((28, 32), (170, 0, 255)), ((0, 11), (255, 0, 255)), ((0, 12), (255, 0, 255))]
def center(lm): return np.mean([[lm[i].x, lm[i].y] for i in (11, 12, 23, 24)], axis=0)
def size(lm): xs = [p.x for p in lm]; ys = [p.y for p in lm]; return (max(xs) - min(xs)) * (max(ys) - min(ys))

class OneEuro:
    # speed-adaptive low-pass (Casiez et al.): steady joints stop jittering, fast ones don't lag
    def __init__(self, fc=1.4, beta=0.6, dc=1.0): self.fc, self.beta, self.dc, self.x, self.dx, self.t = fc, beta, dc, None, None, None
    def a(self, fc, dt): r = 2 * np.pi * fc * dt; return r / (r + 1)
    def __call__(self, x, t):
        x = np.asarray(x, float)
        if self.x is None or t - self.t > 0.2: self.x, self.dx, self.t = x, np.zeros_like(x), t; return x
        dt = max(t - self.t, 1e-3); dx = (x - self.x) / dt; self.dx = self.dx + self.a(self.dc, dt) * (dx - self.dx)
        fc = self.fc + self.beta * np.abs(self.dx); al = self.a(1, dt) * 0 + (2 * np.pi * fc * dt) / (2 * np.pi * fc * dt + 1)
        self.x = self.x + al * (x - self.x); self.t = t; return self.x
filt = OneEuro()


def draw(canvas, pts, vis, th, glow):
    for (u, v), col in LIMBS:
        if vis[u] > 0.35 and vis[v] > 0.35:
            if glow:
                over = canvas.copy(); cv2.line(over, pts[u], pts[v], col, th * 4, cv2.LINE_AA); cv2.addWeighted(over, 0.25, canvas, 0.75, 0, canvas)
                cv2.line(canvas, pts[u], pts[v], (255, 255, 255), th + 2, cv2.LINE_AA)
            cv2.line(canvas, pts[u], pts[v], col, th, cv2.LINE_AA)
    for k in (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32):
        if vis[k] > 0.35: cv2.circle(canvas, pts[k], th + 3, (255, 255, 255), -1, cv2.LINE_AA); cv2.circle(canvas, pts[k], th + 3, (40, 40, 40), 1, cv2.LINE_AA)
    if vis[0] > 0.35:  # head ring around nose/ears
        r = int(max(8, 0.9 * np.hypot(pts[7][0] - pts[8][0], pts[7][1] - pts[8][1])))
        cv2.circle(canvas, pts[0], r, (255, 255, 255), max(1, th // 2 + 1), cv2.LINE_AA)


frames, target, i = [], None, 0
if a.hint: target = np.array([float(v) for v in a.hint.split(',')])
while True:
    ok, img = cap.read()
    if not ok: break
    t = i / fps; i += 1
    if t < a.t0 or t > a.t1: continue
    res = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(t * 1000))
    pick = None
    if res.pose_landmarks:
        cands = list(range(len(res.pose_landmarks)))
        if target is None: pick = max(cands, key=lambda k: size(res.pose_landmarks[k]))
        else:
            d = [np.linalg.norm(center(res.pose_landmarks[k]) - target) for k in cands]
            k = int(np.argmin(d)); pick = k if d[k] < 0.25 else None
    black = np.zeros_like(img)
    rec = {'t': round(t, 4), 'ok': pick is not None}
    if pick is not None:
        lm, wl = res.pose_landmarks[pick], res.pose_world_landmarks[pick]
        target = center(lm)
        rec['img'] = [[round(p.x, 5), round(p.y, 5), round(p.z, 5), round(p.visibility, 3)] for p in lm]
        rec['world'] = [[round(p.x, 5), round(p.y, 5), round(p.z, 5)] for p in wl]
        xy = filt(np.array([[p.x * W, p.y * H] for p in lm]), t)
        pts = [(int(x), int(y)) for x, y in xy]; vis = [p.visibility for p in lm]
        th = max(2, int(H / 260))
        draw(img, pts, vis, th, True); draw(black, pts, vis, th + 1, False)
        # player tag above the head
        hx, hy = pts[0]; top = int(min(y for (_, y), v in zip(pts, vis) if v > 0.35)) - 3 * th - 18
        cv2.rectangle(img, (hx - 46, top - 16), (hx + 46, top + 6), (20, 20, 20), -1); cv2.rectangle(img, (hx - 46, top - 16), (hx + 46, top + 6), (0, 200, 255), 1)
        cv2.putText(img, 'TRACKING', (hx - 40, top + 1), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    frames.append(rec)
    ov.stdin.write(img.tobytes()); po.stdin.write(black.tobytes())
for p in (ov, po): p.stdin.close(); p.wait()
json.dump({'fps': fps, 'width': W, 'height': H, 'frames': frames}, open(a.out + '.json', 'w'))
print('frames', len(frames), 'tracked', sum(f['ok'] for f in frames), 'fps', fps, f'{W}x{H}')
