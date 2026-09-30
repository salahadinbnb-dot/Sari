# 2K-style basketball clips

2K-style gameplay clips and breakdowns, rendered from three.js and driven by real motion capture.

- **v4 (latest): skeletons hooping in a practice gym, shot like a phone clip.** [`out/skeleton_gym.mp4`](out/skeleton_gym.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v3: tweener, cross, cross, step-back three, from the side. [`out/tweener.mp4`](out/tweener.mp4) (1920×1080, 60 fps, H.264 + AAC)
  - Skeleton version: [`out/tweener_skeleton.mp4`](out/tweener_skeleton.mp4). It's the same play and motion, with the players drawn as their skeletons instead of the 3D models (`src/index3.html?skel`).
- v2: 1-on-1 against a square defender, shot from behind the ball handler. [`out/1v1_pov.mp4`](out/1v1_pov.mp4) (1920×1080, 60 fps, H.264 + AAC)
- v1: ball-screen version with procedural animation. [`out/ball_screen_pov.mp4`](out/ball_screen_pov.mp4) (1080p, 30 fps)

## Motion from real video

`tools/track.py` tracks one player's body through any video clip, running MediaPipe Pose Landmarker on the CPU. The joints are smoothed with a One-Euro filter, and the tracker stays on the chosen player (`--hint x,y`, or the biggest person by default).

```bash
python3 tools/track.py clip.mp4 out/track/clip [--hint 0.5,0.6] [--t0 2.0 --t1 9.0]
```

It writes three files:

- `clip_overlay.mp4`: the footage with the tracked skeleton drawn on it.
- `clip_pose.mp4`: the skeleton alone on black, the pose-reference format that AI video tools take.
- `clip.json`: per-frame 2D image landmarks with visibility, plus 3D world landmarks in metres around the hips.

## v4: what it shows

The same play as v3 (between the legs, cross, cross, step-back three over a defender who slides with every move and
still loses), played by two anatomical skeletons in sneakers in a dark practice gym, filmed like a phone video.

| Shot | On screen |
|---|---|
| Live, 0:00 | Handheld from the sideline. The whole possession plays in real time, and the phone chases the ball up to the rim. |
| Replay, 0:06 | Slow motion from low in front: the between-the-legs, both crosses and the step-back at knee height. |
| Shot, 0:10 | Slow motion from behind the shooter: his back and the rim above, the late closeout, the swish. |

## How v4 is made

- **Skeletons:** `tools/bones.py` takes the bone meshes of the OpenSim full-body model (Rajagopal et al. 2016). It poses them in the model's default stance, splits the torso into single vertebrae, ribs, sternum, shoulder blades and collarbones, and smooths the coarse long bones.
  - `src/boneskel.js` maps every piece onto the Rocketbox rig's bind pose. It lines up joint centres and the axis the rig's IK aims (knees and elbows along their poles, the hand by its thumb side), then skins each piece to the bone that carries it.
  - The same solved mocap pose that drives the 3D players drives the skeletons. The spine bends vertebra by vertebra and each rib follows its own vertebra.
  - The sneakers are the players' own, cut out of the skinned model by their foot weights (`makeShoes`).
  - `src/index3.html?bones` puts the same skeletons into the v3 arena.
- **Gym:** `src/gym.js`. A maple floor with black lines, scuffs and soft lamp glare in its reflection, black block walls with mats, steel trusses, round LED high-bays, a glass backboard on a padded stanchion, an exit sign, a scoreboard and a ball rack.
- **Phone camera:** `src/camera4.js` and `src/timeline4.js`. Portrait at 30 fps, handheld shake in sim time (so it slows down in the replays), and one smoothed path per shot.
- **Motion blur and anti-aliasing:** `src/main4.js`. Each frame averages 4 sub-frames across a 180° shutter, rendered in linear HDR with a sub-pixel jitter each. Then tone mapping, grain and a light vignette.
- **Audio:** `tools/audio_gym.py`. Gym room tone, dribbles with the gym's slap-back, squeaks, the gather, the release and the swish. Hits in the slow-motion shots are pitched down and stretched. Each cut gets a swoosh.

## v3: what it shows

A right-wing isolation with the clock running out and your team down two.

| Beat | On screen |
|---|---|
| Size-up | You walk it in with the left hand. He's in his stance, an arm's length off. |
| Between the legs | Left to right through the legs. He slides with it. |
| Cross | Right to left. He slides with that too and stays in front. |
| Cross + step-back | Back to the right. He's still going the other way, and you step back into the space. |
| Pull-up | The camera swings square to the shot. He plants and sprints at you, about 2 m away and still coming when it leaves your hand. The meter hits green. |
| Buzzer | The horn goes with the ball in the air. Swish, 100–99, **GAME WINNER**. |

## How v3 is made

- **Moves:** `src/play3.js` sequences the mocap clips.
  - You: a left-hand dribble walk (06_04), then a free-style dribbling take (06_13). Its between-the-legs, two crosses and step-back were found with `tools/moves.py` and `tools/pushes.py`. Then a dribble pull-up (06_15), then a stand and back-off after the shot (124_05).
  - Him: a stance (78_30), a zig-zag slide (78_28) fitted to your moves with `tools/fitd1.mjs`, a sprint closeout (78_27), then a live stance while the ball is in the air (78_22).
  - `tools/geom3.mjs` prints the spacing, bearing and facing over time.
- **Ball:** `src/game3.js`. The dribble follows the captured hands. Every push is detected from the hand's downward speed, and the ball rides under the palm while in contact. Between pushes it's ballistic, and the tweener bounce lands between the ankles. The release goes where the shooter faced at the gather, with backspin on the way to the rim.
- **Camera:** `src/camera3.js`. A sideline camera that's a quarter behind the ball handler for the dribble moves. It swings square to the shot line for the step-back and the shot, so the separation opens across the screen, then widens to hold the shooter, the arc and the rim.
- **Skeleton view:** `src/skeleton.js`. With `?skel` on the page, the players' skinned models are hidden and each rig's solved joints are drawn as bones and joints: spine, pelvis, limbs, fingers and a head with a facing marker. It shows the exact motion the models play.
- **HUD:** `src/hud3.js`. The scorebug with a running clock, move callouts, the shot meter, the separation readout and the end banner.
- **Audio:** the same synth as v2, plus the game horn and a crowd build while the shot is in the air.

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
pip install pillow numpy scipy imageio-ffmpeg trimesh networkx mediapipe
npm run assets      # Rocketbox models + uniforms, CMU mocap clips
npm run preview:v4  # quick 540x960 check of v4
npm run render:v4   # final 1080x1920 v4 with audio -> out/skeleton_gym.mp4
npm run preview:v3  # quick 540p check of v3
npm run render:v3   # final 1080p60 v3 with audio -> out/tweener.mp4
npm run render:v3:skel  # the same with skeletons -> out/tweener_skeleton.mp4
npm run preview     # quick 540p check of v2
npm run render      # final 1080p60 v2 with audio -> out/1v1_pov.mp4
npm run render:v1   # the original ball-screen version
```

Useful dev tools:

- `PAGE=src/index3.html node tools/still.mjs <prefix> <frame...>` renders single frames (any page).
- `node tools/geom3.mjs [step] [end]` prints v3 spacing, and `node tools/fitd1.mjs` re-fits the defender's slide.
- `python3 tools/moves.py <clip>` lists the hand switches (tweener, crossover, behind-the-back) in a dribbling clip.
- `node tools/clipview.mjs <clip> <prefix> <viewDeg>` renders a contact sheet of any mocap clip on our player.
- `python3 tools/clipinfo.py <clip>` prints a clip's speed, direction and hand-height timeline.

## Credits

- CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), created with funding from NSF EIA-0196217
- Microsoft Rocketbox Avatar Library (MIT) for the character models and textures (and v4's sneakers)
- OpenSim full-body musculoskeletal model: Rajagopal, A., Dembia, C.L., DeMers, M.S., Delp, D.D., Hicks, J.L., Delp, S.L. (2016), "Full-body musculoskeletal model for muscle-driven simulation of human gait", IEEE TBME. Bone geometry from opensim-org/opensim-models, fetched at build time.
- three.js (MIT)
- Barlow, Barlow Condensed and Graduate fonts (SIL Open Font License, see `src/fonts/LICENSES-OFL.txt`)
