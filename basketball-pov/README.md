# 2K-style basketball clips

2K-style gameplay clips and breakdowns, rendered from three.js and driven by real motion capture.

- **v10 (latest): film room, "Shoot Over Him".** An iso pull-up into a good contest, in three beats: gather the ball into both hands, set your feet with a 1-2, then rise straight up and release over his hand. Then the same iso pulled up without stopping, drifting into him. [`out/shoot_over_him.mp4`](out/shoot_over_him.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v9: film room, "Lockdown". You're the defender this time: staying down on the fake, mirroring a good ball handler's cross, and helping and recovering as a team, each ending in a contested miss. [`out/lockdown.mp4`](out/lockdown.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v8: film room, "Make Him Move". How a shooter who isn't fast or strong beats a quicker defender: head fake, shoulder fake, hesi pull-up, step-back, each into a pull-up over him, with the skeletons in the gym. [`out/make_him_move.mp4`](out/make_him_move.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v7: film room, "Get Your Hands On It". Steals against a good dribbler, when he's beaten you, and off the ball, with the skeletons in the gym. [`out/hands_on_it.mp4`](out/hands_on_it.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v6: film room, "Get Up". How to approach the rim, a rim touch, then a tomahawk dunk, with the skeleton in the gym. [`out/get_up.mp4`](out/get_up.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v5: film room, "Read his weight". When to shoot, when not to, and how to finish through contact, with the skeletons in the gym. [`out/read_his_weight.mp4`](out/read_his_weight.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
- v4: skeletons hooping in a practice gym, shot like a phone clip. [`out/skeleton_gym.mp4`](out/skeleton_gym.mp4) (1080×1920 portrait, 30 fps, H.264 + AAC)
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

## v10: what it shows

Two reps of an isolation pull-up with a hand in your face. The floor ring and arrow are under you: green while you're
over your feet, red while your momentum is still carrying you. The footprints mark your 1-2, and on the release freeze
tags mark the ball and his highest fingertip. The strip marks the shot and the closest-defender distance at the
release.

| Rep | What it shows |
|---|---|
| 1 · Gather, set, rise | He's set a stride and a half off and won't bite on anything. One hard dribble at him. The ball comes up into both hands on the way up as your first foot lands (the gather), then the 1-2 into a square stance, knees bent, toes at the rim, and your momentum stops there. Straight up and release at the top: he jumps when he sees you go, about 0.2 s late, so at the release the ball is at 2.71 m and his hand at 2.46 m. 2.7 ft, and it's good. You land 0.14 m from your takeoff. |
| 2 · Don't drift | The same iso off a hard drive, pulled up without stopping. You brake from 3.9 m/s through the 1-2 but never stop, take off still going forward and float 0.76 m into him (1.9 ft at the release). The drive's speed goes into the shot, and it comes off the back rim. |

The numbers come from:

- **NBA.com tracking, 2024-25 regular season:** pull-up 2s by closest defender, 39.7% at 2-4 ft and 48.0% at 6+ ft (35.9% inside 2 ft). Pull-up 3s go from 27.5% to 36.3%.
- **NBA Official Rules:** Rule 4 Section III defines the gather, and Rule 10 Section XIII gives a player who gathers while dribbling two steps.
- **Li et al. 2024** (Applied Sciences 14(20):9582): 14 male college players got the ball out quicker and released it higher when guarded.
- **Reaction time:** Singh 2020 (Int J Physiol Nutr Phys Educ 5(1):174-176), visual reaction time of 0.22 s in 45 basketball players. He leaves the floor 0.2 s after you do.
- **Measured in the scene:** the ball and fingertip heights at the release, the closest-defender distance, and how far you landed from your takeoff.

## How v10 is made

- **Engine:** the v5/v8/v9 page and rep engine, plus a read of your base for the floor meter and strip, footprints for the 1-2, height tags on the release freeze, and a long miss off the back rim. The base read has three parts. On the way in, it's how fast you're still going. At the push-off, it's whether your balance point (the extrapolated centre of mass) is back inside your feet. In the air, it's how fast you're floating.
- **Motion:** 124_05 for both shots: its triple threat, one-dribble pull-up and jump, with the 60° turn of its catch taken out so you face him the whole way. 78_32's drive leads into the drift: you brake through 124_05's 1-2 without stopping, and the jump still carries 1.3 m/s forward. His contest is 78_30's stance into 124_05's jump, a reaction time after yours.
- **Files:** `src/play10.js`, `src/hud10.js`, `src/hud10.css`, `src/timeline10.js`, `src/main10.js`.

## v9: what it shows

The other side of v8, in three reps. The floor ring and arrow are under you now, green while you're balanced and in
front, red once you're beat; the strip marks the contest and how far your hand was from the shooter.

| Rep | What it shows |
|---|---|
| 1 · Stay down | The same head fake that beat the slow guy's man. You close out short and stop, hands up and feet down, so the fake gets nothing. He breaks; you slide with him, beat him to the spot and contest the pull-up at 3.5 ft. Miss. |
| 2 · Mirror the cross | He attacks with a cross. You hold a cushion, slide with the cross instead of lunging at it, chest in front, and he has to rise with you right there: 2.8 ft. Miss. |
| 3 · Help and recover | A driver beats your teammate. You sprint over from the gap and stop the ball; he jump-stops and kicks it out to your man. You go on the pass, short steps the last stride, hand high: 2.4 ft. Miss. |

## How v9 is made

- **Engine:** the v5/v8 page and rep engine, plus a miss off the front of the rim (reflected off the ring, then gravity, floor bounces and a roll), a rep that hands its ball off with a pass (`passOut`), and a fixed high team camera. The floor meter's colours are inverted, since its player is you.
- **Team rep:** two reps share your track. The first has the driver's ball (78_32's drive, 124_05's jump stop) until his pass; the second takes it from his hands to your man (124_05's catch and shoot, its turn trimmed to the pass angle). Your beaten teammate (78_25) and the driver are extra players.
- **Motion:** 78_22 and 124_05 for the head fake; 06_13 and 124_05 for the cross; 78_25, 78_26 and 78_30 for your closeouts, help and slides, each slide sized to the ground you need to cover.
- **Files:** `src/play9.js`, `src/hud9.js`, `src/hud9.css`, `src/timeline9.js`, `src/main9.js`.

## v8: what it shows

A film-room breakdown in four reps of beating a quicker man without speed: make him move first, then rise. The floor
ring and arrow under the defender show his base and where his weight is going; the strip along the bottom turns green
while it's going the wrong way, with the shot marked and the closest-defender distance at the release.

| Rep | What it shows |
|---|---|
| 1 · Head fake | He closes out hard. You sell the shot (ball to the forehead, eyes on the rim) and he leaves his feet. He's in the air 0.6 s and can't change direction, so one hard dribble takes you by him; stop and rise, 4.8 ft open. |
| 2 · Shoulder fake | He's quicker. You jab and dip your shoulder left, he slides 0.9 m that way, and you go right. He has to stop, re-plant and come back: the shot goes up 6.7 ft open. |
| 3 · Hesi pull-up | He runs with you, a half step ahead. You stop on a dime. He needs about 0.22 s just to see it, which at your 3.2 m/s is 0.7 m before he even brakes, and he goes on by: 5.0 ft. |
| 4 · Step-back | You attack, he sits down and slides to cut off the cross. You snatch it back and hop back while he's still sliding the other way: 6.0 ft. |

The numbers come from:

- **Reaction time:** Singh 2020 (Int J Physiol Nutr Phys Educ 5(1):174-176). 45 basketball players: visual reaction time 225 ms, and no relationship between reaction time and sprint speed - a faster defender doesn't react sooner.
- **Measured in the scene:** air time, how far he went the wrong way, your speed into the stop and the closest-defender distance at each release are all measured from the motion.

## How v8 is made

- **Engine:** the v5 page and rep engine (`src/rep5.js`, `src/camera5.js`, `src/meter5.js`), extended for fakes: the ball rides both hands through a shot fake (`holdHands`), the eyes stay on the rim through it (`lookRim`), a forced dribble hand (`pushHand`), several contest windows, and a jump that carries the closeout's momentum through the air (`compress.carry` in `src/animator.js`).
- **Motion:** whole real takes (CMU mocap), every pull-up the same 124_05 jump shot.
  - Head fake: 78_22 (fake shot, break right), the rip-through played quick. The defender is 78_25's closeout, 124_05's jump flying at you, then two slides of 78_30.
  - Shoulder fake: 78_20 (feint left, move right), played a touch slow. The defender bites with 78_30's slide and has to come back.
  - Hesi: 78_32's drive at 0.72x into the pull-up. The defender is 78_25's sprint alongside, its own stop starting a reaction time after yours.
  - Step-back: 06_13's attack, cross and hop back (the hop played 1.6x). The defender is 78_30's slide off the cross.
- **Overlays and edit:** `src/play8.js` (the reps and the measured numbers), `src/hud8.js` and `src/hud8.css`, `src/timeline8.js`, `src/main8.js`.

## v7: what it shows

A film-room breakdown of steals, in three reps. A ring on the ball is red while he has it covered (in his hand, or on
his side with his body in the way) and green while it's actually in your reach. A strip along the bottom shows the
whole dribble that way, with the steal marked.

| Rep | What it shows |
|---|---|
| 1 · On the ball | A good dribbler works the ball on his right side. Reaching there gets you beaten or called for a foul, because his hand is on the ball 54% of the time and his body covers the rest. It only comes into reach when he crosses it over in front of him, for 0.11 s on its way up into his other hand. You swipe up through it with the hand on the side it's going, and go after it. |
| 2 · He beat you | He's got a step on you on a drive. Don't reach across him. Run with him on the ball side: his off arm covers the front, nothing covers the back. Tip it forward with your inside hand as it comes up off the floor. |
| 3 · Off the ball | The passer picks up his dribble and throws to the wing. You've sagged a step off the passing line so it looks open, you leave on his windup and catch it in front of your man. A race at the bottom: you need 0.63 s, the ball 0.39 s, so leaving on the throw is 0.24 s late. |

The numbers come from:

- **Steal types:** Squared Statistics, "Analyzing steals in the 2016-17 NBA season". Of 18,950 steals, 12,154 came off passes (off-ball) and 6,586 off the dribble (on-ball).
- **Reaction time:** Singh 2020 (Int J Physiol Nutr Phys Educ 5(1):174-176). The mean visual reaction time of 45 basketball players was 0.225 s. That's longer than the 0.11 s the crossover is in reach, so you have to be there before he crosses.
- **Technique:** swipe up (a downward swipe is the one that gets called), only from the ball side when you trail (reaching across is a foul), and tip it ahead.
- **Measured in the scene:** the in-reach window, the hand-on-ball share and the race are measured from the motion. In reach means the ball is in the air, on its way up, and within arm plus hand plus ball of your nearer shoulder.

## How v7 is made

- **Motion:** whole real takes (CMU mocap), placed off the moment of the steal so the reach is real.
  - On the ball: the dribbler is 06_13 (low, fast freestyle dribbling, about 25 real crossovers). The rep takes the stretch at 34.85 s, with right-hand dribbles and then a crossover 0.5 m in front of his hips. The defender is a stance (78_24) into 78_30's slide and stop, then 78_27's push-off to chase the loose ball.
  - He beat you: the drive is 78_32 (a straight drive from a stop, right hand, about 4 m/s). The defender is 78_25's sprint, half a step behind on the ball side.
  - Off the ball: the passer is 06_13's opening (dribbling in place). The receiver is 78_24's stance, kept alive. The defender holds his stance and then bursts with 78_27's push-off on the windup.
- **Placement:** `src/play7.js` finds the strike from the dribbler's own pushes (on the way up after the cross, or after his second dribble on the drive). It then places the defender so his shoulder is a set distance from the ball at that moment, facing the dribbler (or running with him). For the pass, the catch point is two-thirds of the way along the line, and he's anchored there at the catch time.
- **Ball and hands:** `src/rep7.js`.
  - The dribble comes off the handler's hands: pushes are found in the take and the flights run between them, down to the floor and up into the next hand.
  - The defender's swipe: ready low with the palm up, accelerating up into the ball, then a follow-through.
  - After the poke the ball is free: gravity, bounces on the floor (restitution 0.78) and a roll.
  - The pass: a two-hand pick-up and windup, a chest pass at 7.5 m/s with a slight arc, and a two-hand catch on the line.
- **Overlays and edit:** `src/hud7.js` and `src/hud7.css` (ring, ball strip, race, captions, cards), `src/camera7.js` (over your shoulder on the ball, chasing the drive, up behind the passer), `src/timeline7.js` (the edit).
- **Sound:** `tools/audio_gym.py`, the v5 gym sound plus a hand-on-ball poke.

## v6: what it shows

A film-room breakdown of the approach and the dunk, in two reps. Each plays near full speed, then freezes and slows
down on the parts that matter, and measures them.

| Rep | What it shows |
|---|---|
| 1 · Approach + rim touch | A walk-in that builds to a run (fastest steps last), a big step that drops the hips, a two-foot plant with the feet landing ahead of the hips, the arms swung back and punched up, and one hand on the front of the rim. |
| 2 · Dunk it | The same approach faster, with the ball in one hand. Both hands take it on the big step, it goes up with the jump, gets cocked back behind his head at the top, and is thrown down. He hangs on the rim for a moment. Then a replay from his left. |

On screen:

- **The numbers** along the bottom:
  - speed (live, then the speed into the plant and the top speed);
  - how far the hips drop on the big step and the plant;
  - the plant angle (hips to heel against the floor at the first foot's touchdown);
  - hang time, then the vertical it means (h = g·t²/8).
- **Reach gauge** on the right edge, from 8 ft to 12 ft with the rim at 10 ft. It marks the highest point of his fingertips, or of the ball.
- **On the picture:**
  - a footprint where each step lands, with its speed;
  - the hip drop bracket;
  - the plant angle drawn from his hips to his heel.
- **The hoop reacts.** The rim sits on a breakaway hinge: it shivers when he slaps it, and on the dunk it bends under his hand, then springs back and rings. The stanchion rocks a little, the net is pushed open by the ball and snaps back, and the camera jolts on the slam.

The numbers come from:

- **The approach:** Liu & Zaferiou 2025 (Front Sports Act Living). 21 basketball players did two-foot running jumps, tapping the hoop or dunking.
  - Forward speed at the first contact of the plant predicted jump height best: r = 0.92 without the ball, 0.91 with it (mean 3.8 m/s).
  - A plant angle further ahead went with higher jumps (r = -0.74; mean 59°).
- **The arms:** Lees, Vanrenterghem & De Clercq 2004 (J Biomech). An arm swing added 0.086 m (3.4 in) to a maximal standing jump.
- **Reach:** NBA Draft Combine, 2000-2026. Standing reach is about 1.33 × barefoot height, so a 6'5" player (the skeleton) reaches about 8'7" and needs 17 in to touch a 10-ft rim.
- **Dunkers:** Tong & Wang 2024 (PLoS One). NBA dunk-contest finalists' combine max vertical was 102.4 cm (40.3 in).

## How v6 is made

- **Motion:** two real takes (CMU mocap), cut together where the poses match (`tools/transit.py`, cost 0.87): a walk into a run (127_04) and the lay-up approach from 124_06, a long bound, a quick plant and a two-foot takeoff. The performer's own jump is 0.65 s in the air (about 20 in).
  - **Jump boost** (`boost` in `src/animator.js`).
    - A flight k times as high lasts √k times as long at the same g. So the airborne part of the take plays √k times slower, and its rise over the takeoff-to-landing line is scaled by k.
    - Just before toe-off the hips are taken a little lower and brought up faster, with the feet still planted, so the takeoff speed is √k times the performer's and the flight starts without a kink.
    - Rep 1 uses k = 1.2; rep 2 uses k = 2.1 and plays its run-up 1.18× faster.
  - The air turn of the lay-up is taken out so he stays square to the rim.
- **Placement:** `src/play6.js` places the approach so that at the top of the jump the rim is a set distance in front of his right shoulder, facing it; the jump's own drift and turn come from the take. He comes in from the left wing at about 45°.
- **Arms, ball and rim:** `src/rep6.js`.
  - Rep 1: the arms swing back on the plant and up through the takeoff (keyed to the take's footwork), and the right hand goes to the front of the rim.
  - Rep 2:
    - The ball rides the right palm by his hip, goes into both hands on the big step, and follows the performer's two-hand gather and rise.
    - Then it goes on to a keyed path: overhead, cocked behind the head, over the rim, and down. After that the ball flies on its own: through the net, which slows it, and onto the floor.
    - The hand grabs the front of the rim, which is bent down by it, until his arm runs out of reach.
  - The approach numbers are measured from the motion: footfalls from the feet, speed from the hips, the plant angle at the heel strike.
- **Net:** `src/net6.js`. It hangs from the flexing rim, sways, and can't pass through the ball.
- **Overlays and edit:**
  - `src/hud6.js` and `src/hud6.css`: numbers, reach gauge, drawings, captions and cards.
  - `src/marks6.js`: footprints.
  - `src/camera6.js`: a side view of the run-up, low behind the baseline for the rise, and the replay.
  - `src/timeline6.js`: the edit.
- **Sound:** `tools/audio_dunk.py`. Steps on the maple, the plant's squeak, a whoosh off the floor, fingers on the rim, and the slam (rim clang, hinge spring, stanchion thud, glass rattle, net).
- `node tools/geom6.mjs <rep>` prints the hip path, speed, facing and the apex.

## v5: what it shows

A film-room breakdown on reading the defender's weight. Each rep plays near full speed into the read, freezes on the
coaching point, plays the rise in slow motion and cuts to the rim for the result.

| Rep | The read |
|---|---|
| 1 · Contested make | A kick-out to the wing. The help defender sprints out, chops his feet, arrives balanced and goes up with both hands. The catch-and-shoot goes in over him, but it's a tight look (2.5 ft at the release). |
| 2 · On his heels | A hard first step. He drops back to stay in front, so his weight is going away. Rise while he's still backing up (6.4 ft, wide open). |
| 3 · On the lean | A double crossover. He slides hard with the second one. Stop and rise while his momentum carries him sideways (5.9 ft, open). |
| 4 · Contact finish | A drive against a help defender who is still sliding over. Shoulder into his chest before you go up, ball high on the far side, and finish off the glass. He goes up late with both hands: block on him, and-one. |

On screen:

- **Floor meter** under the defender: a ring around his feet, and an arrow from his centre of mass to where his momentum is taking it. It's red while that point stays inside his feet (he can still contest), and green once it leaves them (on his heels, leaning, or not set).
- **Weight panel** at the bottom: his state right now, and a timing strip of his balance over the rep. The strip is revealed as the rep plays, with the shot marked on it, including the closest-defender distance at the release in NBA tracking bands (0-2 ft very tight, 2-4 tight, 4-6 open, 6+ wide open).
- Freeze frames with the coaching point, a slow-motion tag, rep titles, and a burst where the shoulder meets his chest.

The numbers come from:

- **Shooting percentages:** NBA.com player tracking, 2024-25 regular season, league totals. Pull-up 3s: 27.5% tight, 36.3% wide open. Catch-and-shoot 3s: 31.8% tight, 39.1% wide open.
- **The help-defense rule:** NBA Official Playing Rules 2025-26, Comments on the Rules II.C. A defender may not move into the shooter's path once he has started his upward motion, and on a drive that motion starts at the gather. The restricted area is 4 ft.
- **Reaction and change-of-direction times:** Vater 2024 (Sci Rep) and Dos'Santos et al. 2018 (Sports Med).

## How v5 is made

- **Motion:** every rep is built from whole real takes (CMU mocap), not drills spliced at fixed times.
  - `python3 tools/transit.py A ta0 ta1 B tb0 tb1` finds where two takes can be cut together. It compares pose, joint velocities and body-frame hip motion in each pose's own frame, scaled by leg length.
  - Cuts are inertialized (`inert` in `src/animator.js`): the new take plays from its first frame, and only the pose and velocity difference dies away, so nothing is averaged and the footwork stays the performer's.
  - Air turns are taken out while the feet are off the floor, and the jump shot's sideways drift in the air is cut to a third (`compress`), so the jumps go up, not across.
  - The takes used:
    - Shooter: the jump shot 124_05, the layup 124_06, the crossover dribble 06_14 and the drive 78_32.
    - Defender: the closeout-and-stop 78_25, the retreat 78_28, the slides 78_30 and the help slide-and-stop 78_26. When he contests at the rim or on the closeout he gets off the floor: the jump of 124_05, cut in where the poses match.
- **Placement:** `src/play5.js` anchors a moment of each take to the floor (`anchoredTrack`), so spacing is set where it matters (the stop of the closeout, the takeoff, the contact) and everything else follows from the real motion.
  - The defender's spot and facing were fitted so the retreat goes straight back and the slides run across the shooter's front.
  - `node tools/geom5.mjs <rep>` prints spacing, body clearance (capsules; negative means the bodies overlap) and the defender's balance.
- **Hands, ball and contact:** `src/rep5.js`.
  - The jump shot's arms are procedural on top of the performer's legs and body. From the dip at his waist the ball comes straight up the front of him into a set point above his right eye. The shooting hand turns under the ball on the way.
  - At the set the upper arm is just below level and turned in toward his chest, and the forearm is straight up. The set is built off his chest (the take has his shoulders turned about 25° off the rim line), so the elbow stays under the ball instead of flaring out.
  - The elbow's IK pole is the point under the wrist the whole way, so it rides under the ball on the rise and points at the rim on the release. The guide hand rides the ball's left side, its elbow a little out, and comes off just before the release.
  - The arm extends about 62° toward the rim, the wrist snaps, and the follow-through is held until he lands.
  - The defender's contest hands go straight up (verticality) and are kept off the ball.
  - The pass and the catch, the dribbles (found in the performer's hands) and the layup off the glass are handled here too.
  - The contact is a collision: whatever part of the help defender's slide would carry him through the finisher is taken out along the line of contact, plus a shove that rocks him back.
- **Balance:** the defender's centre of mass from his hips, thorax, head and thighs, and the extrapolated centre of mass (XcoM = CoM + v/ω₀, ω₀ = √(g/l)), measured against his feet. A closeout is read by phase: sprinting, chop steps, then balanced. A help defender is set once he has stopped moving.
- **Overlays and edit:** `src/meter5.js` (floor meter), `src/hud5.js` and `src/hud5.css` (titles, captions, weight panel, contact burst, cards), `src/timeline5.js` (the edit), `src/camera5.js` (cameras).
  - The duel camera keeps its side for the whole rep, so it never swings across the players.
  - The finish is filmed from the baseline.
- **Rendering:** `src/main5.js`, with the same skeletons, gym and motion blur as v4 (2 sub-frames). A freeze is rendered once and only re-graded for its other frames.
- **Audio:** `tools/audio_gym.py`, with the glass, the body contact, the whistle and a freeze accent.

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
npm run preview:v10 # quick 540x960 check of v10
npm run render:v10  # final 1080x1920 v10 with audio -> out/shoot_over_him.mp4
npm run preview:v9  # quick 540x960 check of v9
npm run render:v9   # final 1080x1920 v9 with audio -> out/lockdown.mp4
npm run preview:v8  # quick 540x960 check of v8
npm run render:v8   # final 1080x1920 v8 with audio -> out/make_him_move.mp4
npm run preview:v7  # quick 540x960 check of v7
npm run render:v7   # final 1080x1920 v7 with audio -> out/hands_on_it.mp4
npm run preview:v6  # quick 540x960 check of v6
npm run render:v6   # final 1080x1920 v6 with audio -> out/get_up.mp4
npm run preview:v5  # quick 540x960 check of v5
npm run render:v5   # final 1080x1920 v5 with audio -> out/read_his_weight.mp4
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
