# Behind-the-player POV breakdowns

2K-style breakdowns of one possession against a defender who's already square, shot from behind the ball handler.

- **v2 (current): 1-on-1, real motion capture.** [`out/1v1_pov.mp4`](out/1v1_pov.mp4) (1920×1080, 60 fps, H.264 + AAC)
- v1: ball-screen version with procedural animation. [`out/ball_screen_pov.mp4`](out/ball_screen_pov.mp4) (1080p, 30 fps)

## v2: what it shows

| Step | On screen |
|---|---|
| Setup | You catch at the top. He's square, an arm's length away, and there's space to your right. |
| 1 · Read | Sagging means shoot, closing out means attack, balanced means neither yet. Your ball fake gets no reaction. |
| 2 · Test | A right-hand drive into the space beside him. He slides with you. **Freeze: NOT BEATEN.** His chest is still in your path. A ring marks where he'd need to be for an opening. |
| 3 · Checkpoint | No ground gained, so you back out diagonally with the dribble alive. He recovers square. |
| 4 · Attack the closeout | He sprints at you. **Freeze: HE'S CLOSING OUT.** All that momentum means he can't change direction. You go right while he's still coming. **Freeze: OPENING.** His torso is behind your left shoulder. |
| 5 · Finish | Nobody's home, so you collect close enough to finish: a layup off the glass on the right side. |
| End | "Your drive is a test, not a commitment." |

## How v2 is made

- **Motion:** real motion capture from the CMU Graphics Lab database, retargeted onto the Rocketbox rigs (`tools/mocap.py`, `src/mocap.js`, `src/player.js` `applyMocap`).
  - Clips: basketball moves (78), dribbling (06), a running layup (124).
  - Legs and arms are driven through IK from the captured joint positions. Spine and head come from the captured rotations.
  - Crossfades happen in each body's own frame (`src/animator.js`).
  - Starts and stops are spliced from a clip's own acceleration into its own deceleration, at the frame pairs where speed and foot placement match best (`tools/splice.py`).
  - Planted feet are locked, and only slip when the leg can't reach (`src/game2.js`).
- **Choreography:** `src/play1v1.js` sequences the clips for both players. `tools/geom.mjs` prints spacing, distance and the defender's bearing (behind your left shoulder = opening). `tools/layupfit.mjs` solves where the layup starts so the rim sits where the performer was looking at release.
- **Ball and hands:** `src/game2.js`.
  - Triple threat and the ball fake are held in both hands, which grip the real mocap hand positions.
  - The right-hand dribble follows ball physics, with the hand riding the ball at the top of each bounce.
  - The layup has a gather, the left hand coming off, a one-hand release, a kiss off the glass and the swish.
- **Presentation:** the behind-the-player camera, freeze-frame cams, captions, step tracker, tags and floor telestration (`src/camera2.js`, `src/script2.js`, `src/tele2.js`, `src/hud.js`).
- **Audio:** synthesized, with bounces synced to every dribble (`tools/events2.mjs`, `tools/audio.py`).

## Rebuild

```bash
npm install
pip install pillow numpy scipy imageio-ffmpeg
npm run assets      # Rocketbox models + uniforms, CMU mocap clips
npm run preview     # quick 540p check of v2
npm run render      # final 1080p60 video with audio -> out/1v1_pov.mp4
npm run render:v1   # the original ball-screen version
```

Useful dev tools:

- `PAGE=src/index2.html node tools/still.mjs <prefix> <frame...>` renders single frames.
- `node tools/clipview.mjs <clip> <prefix> <viewDeg>` renders a contact sheet of any mocap clip on our player.
- `python3 tools/clipinfo.py <clip>` prints a clip's speed, direction and hand-height timeline.

## Credits

- CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), created with funding from NSF EIA-0196217
- Microsoft Rocketbox Avatar Library (MIT) for the character models and textures
- three.js (MIT)
- Barlow, Barlow Condensed and Graduate fonts (SIL Open Font License, see `src/fonts/LICENSES-OFL.txt`)
