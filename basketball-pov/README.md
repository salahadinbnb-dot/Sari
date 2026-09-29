# Ball-screen read: behind-the-player POV

A ~28-second, 2K-style breakdown of one possession against a defender who's already square, shot from behind the ball handler.

**Watch:** [`out/ball_screen_pov.mp4`](out/ball_screen_pov.mp4) (1920×1080, 30 fps, H.264 + AAC)

## What it shows

| Step | On screen |
|---|---|
| Setup | You catch at the top. Your defender is square and an arm's length away, with help at the rim and space to your right. |
| 1 · Read | No cushion to shoot and no closeout to attack. Your jab gets no reaction. |
| 2 · Test | A right-hand dribble into the space beside him. **Freeze: NOT BEATEN.** His chest is still in your path. A ring marks where he'd need to be for an opening. |
| 3 · Checkpoint | Two dribbles, no ground gained. Back out diagonally with the dribble alive. |
| 4 · Screen | Wait until the screener is set, then go shoulder to shoulder. A wide loop leaves a gap. **Freeze: OPENING.** He's chasing, behind your left side. |
| 5 · Read the help | **Freeze: HELP STEPS UP.** You bounce-pass to the roller he left, and the roller finishes. |
| End | "Your drive is a test, not a commitment." |

## How it's made

- **Players:** Microsoft Rocketbox rigged athletes (MIT). The kits are repainted in `tools/prep_textures.py` into STORM (home white) and BLAZE (away red) uniforms, with numbers projected onto the body in 3D space. Skin tones vary by player.
- **Animation:** all procedural. It uses 2-bone IK on the Biped rig, a footstep planner for runs, defensive slides and backpedals (planted feet don't slide), dribbles synced to ball physics, the screen, the roll, a bounce pass and a layup (`src/motion.js`, `src/world.js`, `src/timeline.js`).
- **Scene:** three.js with a procedural hardwood court (NBA dimensions), glossy floor reflections, a glass backboard, a swishing net and an arena crowd.
- **Presentation:** a camera behind the ball handler, freeze-frame analysis cams, a scorebug with game and shot clocks, a step tracker, captions, player tags with leader lines, and floor telestration.
- **Audio:** synthesized in `tools/audio.py`. It has crowd ambience that muffles during freezes and swells on the make, ball bounces synced to every dribble, catches, the net swish, squeaks and freeze hits.
- **Render:** headless Chromium (software WebGL) captures each frame deterministically and pipes it to ffmpeg (`tools/render.mjs`).

## Rebuild

```bash
npm install
pip install pillow numpy scipy imageio-ffmpeg
npm run assets      # downloads Rocketbox models, bakes UV maps, builds the uniforms
npm run preview     # quick 540p check
npm run render      # final 1080p video with audio -> out/ball_screen_pov.mp4
```

Useful dev tools: `node tools/still.mjs <prefix> <frame...>` renders single frames, and `node tools/diag.mjs` checks every frame for pops and IK misses.

## Credits

- Microsoft Rocketbox Avatar Library (MIT) for the character models and textures
- three.js (MIT)
- Barlow, Barlow Condensed and Graduate fonts (SIL Open Font License, see `src/fonts/LICENSES-OFL.txt`)
