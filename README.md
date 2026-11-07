# ZUMARY Run

An endless runner and campaign game set in Uzbek cities (Tashkent, Samarkand, Bukhara, Khiva). It is plain HTML, CSS and JavaScript. It has no backend, no build step and no npm dependencies.

## Files

| File                 | Purpose                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | Page markup and script loading order                                                                                    |
| `style.css`          | Layout, mobile bottom-sheet menus, touch pad, settings                                                                  |
| `i18n.js`            | Uzbek / English / Japanese texts and language switching                                                                 |
| `art.js`             | Pre-rendered city scenery, parallax layers, ground, thumbnails                                                          |
| `chars.js`           | Built-in painted runner, guard, dog (fallback), coins, obstacles, icons                                                 |
| `sprites.js`         | Optional: use your own PNG pictures instead (used only if `rig.js` is missing)                                          |
| `rig.js`             | Skeleton-animated robots: hero robot, police robot, robot hound (IK legs, swinging arms, glowing parts, back-light rim) |
| `assets/characters/` | Character pictures: `hero_run1/run2/slide.png` (runner), `dog.png`, `guard.png` (officer)                               |
| `game.js`            | Game engine, input, physics, spawning, audio, UI, saving                                                                |

Script order matters: `i18n.js`, `art.js`, `chars.js`, `rig.js`, `sprites.js`, `game.js` (`index.html` already does this).
The only external resource is the Google Fonts stylesheet. If it is blocked, the game falls back to system fonts.

## Characters (skeleton-animated robots)

The hero robot, the police robot (with a flashing siren and a glowing stun baton) and the robot hound are drawn by `rig.js` from real bones: two-bone inverse-kinematics legs with the foot planted during the stance phase, swinging arms, bobbing hips, a jet pack with a flame, an energy scarf and a quadruped rotary gallop for the hound. Plates are shaded like polished metal with glowing eyes, cores and soles, and lit with a warm back-light. Every frame is drawn once into a small canvas at load (about 80–110 ms per character on a slow phone); during play the game only calls `drawImage`.

- Run cycle: 12 frames per stride. Poses: jump, fall, landing crouch, slide (duck) and hit.
- Shop skins recolor the hero robot's armour, plates and glow (`LOOKS` at the top of the robot section in `rig.js`).
- Characters are drawn larger on small and portrait screens (`PS` / `CPS` are set in `resize()` in `game.js`); hitboxes do not change.
- To change the look, edit `figure()` / `drawHead()` (robots) or `dogFig()` (hound) in `rig.js`.
- `assets/characters/` and `sprites.js` still hold the earlier picture-based characters. If `rig.js` is removed from `index.html`, the game uses those pictures instead (and the built-in painted characters if the pictures are missing).
- `guard.png` is a preview image with a stock-site watermark: replace it with a licensed copy before using it.

## Cinematic look and HUD

- Colour grade (warm sky, cool ground), vignette, bloom (desktop at the highest quality only), speed lines when fast or in turbo, soft ground shadows under everyone, warm rim light on the characters.
- GTA-style HUD: segmented health bar (one segment per life) and "wanted" stars that light up as the police close in (they flash red and blue on the last life).
- When the officer catches you the screen letterboxes and a big **BUSTED** appears (translated).
- The effects switch off in steps when the frame rate drops (quality levels) or with "Reduce effects".

## The "caught" scene

When the last life is lost the officer and the dog rush in and "bonk" the hero (DOPPOS! / BONK! / ボコッ！ in the three languages). The result screen appears after about 1.5 seconds (tap to skip).

## Run locally

```bash
cd zumary
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly also works. A local server is better because it matches how GitHub Pages serves the files.

## Deploy to GitHub Pages

1. Create a repository and put the six files (plus this README) in the repo root.
2. Push: `git add . && git commit -m "ZUMARY Run" && git push`
3. On GitHub, open Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)`.
4. After about a minute the game is live at `https://<user>.github.io/<repo>/`.

## Controls

- Jump: Space, ↑ or the JUMP button. Hold for a higher jump; a quick tap gives a short hop.
- Duck: ↓ or the DUCK button.
- Turbo: the TURBO button (touch).
- Pause: P. Mute: M.
- Settings: music and sound volume, graphics quality (auto/high/low), reduced effects, left-handed pad, vibration. All are saved in the browser.

## Input and engine notes

- The simulation runs at a fixed 120 Hz, and drawing happens once per `requestAnimationFrame`. Speed is independent of frame rate.
- A jump pressed up to 140 ms before landing is buffered. A jump up to 90 ms after leaving a platform edge or train still works (coyote time). Duplicate taps within 120 ms are ignored, so there are no accidental double jumps.
- Sprites and scenery are drawn once to offscreen canvases. Particles are pooled. Quality scales automatically when frames get slow.

## Testing performed (desktop Chromium, headless, Playwright)

- All 5 campaign levels were completed, and stars and unlocks were saved.
- Jumping was tested at low, medium and maximum speed, at several frame rates.
- Restart, pause and resume, fullscreen layout and settings were tested.
- Power-ups, hoverboard, mystery box, trains and the chaser were tested.
- All three languages were tested on every screen.
- A simulated 10-minute session and 60 restarts showed no memory or listener growth.
- Phone, tablet (portrait and landscape) and desktop viewports were checked for layout.

## Not verified

- No real Android or iPhone device was available, so real-device frame rate, touch feel and thermal behaviour were not measured. CPU throttling was only an approximation.
- Sound, vibration, native fullscreen and orientation lock cannot be checked in headless mode.
- The Japanese texts were written by the assistant. A native speaker should review them.
- The characters and scenery are drawn in code, not taken from photos or sprite artwork. They are stylised, not photo-real or GTA-grade 3D art.

## City Run 3D (city3d.html)

Subway-Surfers-style mode: the camera is behind the robot, running down an Uzbek city street (Tashkent → Samarkand → Bukhara → Khiva) on 3 lanes. Swipe or arrows/WASD to move, up to jump, down to slide (P pause, M mute). The old 2.5D `city.html` version has been removed.

Real 3D version (WebGL, own tiny engine — no libraries): perspective buildings with lighting and fog, 3D robot built from jointed parts, 3D coins, parked cars, lamps and trees. Falls back to the main game (index.html) if WebGL is missing. Uses facades.js (procedural Uzbek facade textures).

**City Run 3D — v2 (performance + features)**

- Performance: batched characters, preallocated buffers, time-sliced city generation (no hitches), dynamic-resolution governor (lowers/raises render resolution automatically to hold the frame rate), 4 quality tiers chosen from CPU cores / memory / GPU name. Software-GL headless run: ~3 ms JS per frame. Real iPhone/Android devices were NOT tested, so "never freezes on every phone" cannot be guaranteed — the governor is the safety net.
- 6 cities cycling every 700 m: Tashkent, Samarkand, Bukhara, Khiva, Fergana (mountains), Neon Tashkent (night + rain).
- Obstacles: low barriers, gates (slide), cones, pits, ramps, boost pads, carts, laser beams, buses, cars, moving traffic — ~14 spawn patterns.
- Power-ups: Magnet, Shield, Turbo (smash through), Double coins, Jetpack. Helicopter searchlight event, ZUMARY letter bonus, close-call combos, multiplier up to x6.
- Meta: daily missions (seeded by date), XP/levels, revive for 100 coins, procedural music, rain.

## Main game performance pass (v3)

Measured in headless Chromium with software rendering (no GPU), so absolute numbers are pessimistic and real devices were NOT measured.

- Desktop heat: real `shadowBlur` is now only used when the player picks ULTRA; desktop pixel budget cut (2.6M → 1.5M px); overlay `backdrop-filter` blur removed (it re-blurred the live canvas every frame). Software-render cost at the top level: 48 ms → 32 ms per frame; auto mode now starts at HIGH.
- Idle: menus/game-over redraw at ~30 fps, pause at ~4 fps, hidden tab does no work at all (measured: 60 → 8 draws / 2 s while paused).
- Adaptive quality: drops fast when slow, now also climbs back after ~3.5 s of headroom, never returning to a level that just failed (no oscillation). Manual levels: AUTO / ULTRA / HIGH / MEDIUM / LOW (Settings or the 🎨 button).
- FPS monitor: press F3 or open `index.html?fps=1` (fps, frame time, worst frame, slow frames, long tasks, quality level, canvas size, particles). `ZR.perf` exposes the same numbers.
- Soak test (simulated 30 min of play): JS heap 2.5 → 2.9 MB, draw time flat; 40 restarts left no leftover objects.
- Already present before: fixed 120 Hz simulation (refresh-rate independent), sprite caches, particle cap per level.
- Not measured: real CPU/GPU %, battery/thermal, loading time on real networks, touch latency on real devices.

## Evolution pass (v4) — what was done, and what was not

Done (2D main game, tested in headless Chromium only):

- **3D button** redesigned as a proper CTA card (opaque, wraps text, 58 px tall); checked at 320 / 390 px portrait and 844×390 landscape.
- **Settings** (settings.js): 6 collapsible sections, ~38 controls, all wired to real behaviour and saved (`zr_cfg`, `zr_gfx`): graphics preset (Auto/Ultra/High/Medium/Low/Custom) + render scale, FPS limit (only rates the device reports: 30/60/90/120/144/max), 10 effect toggles, adaptive quality, battery saver, low-memory mode, reduced background processing, auto optimisation, thermal-friendly mode, FPS counter, volumes, vibration, swipe sensitivity, camera effects, auto-pause, hints, fullscreen, UI scale, shake intensity, layout, left-handed, reduced motion, high contrast, colour-friendly UI (interface colours only), larger UI, simplified effects, reset.
- **Coin types**: gold, crystal, energy, ZUMARY coin — pre-rendered rotating sprites, distinct pickup effects/sounds, rare-coin mission + achievement.
- **World events** (endless + non-boss levels): energy storm (coins ×2), meteor shower (dodge telegraphed impacts, leaves crystals), city blackout (score ×1.5), magnet zone, speed zone (speed/score ×1.5). Event mission + achievement, XP bonus.
- Already existed and kept: power-ups (magnet, shield, turbo, ×2, slow-motion, hoverboard), combo multiplier, daily missions, XP, medals.
  Not done in this pass: redesign of the 2D cities and of the robot characters, secret paths / bonus zones, city-specific missions, billboards/drones/animated signs, and the new coin types and world events in the 3D mode (3D keeps its own coins/power-ups/helicopter event).

## v5 — 3D hero & feature pass (city3d.html)

- **New hero "ZUMA"** (procedural geometry, no textures): a Humo-bird robot with a turquoise ribbed dome and gold finial, ikat doppi band, glowing almond eyes, chapan coat, 8-point-star chest core, four-blade wings per side, ikat scarf chain, curled-toe boots.
- **Scooter**: run cycle stops, legs switch to a riding stance; absorbs one hit.
- **Pause / Resume**: button, P / Esc, Start on gamepad; whole simulation and audio stop; 3-2-1 countdown on resume; auto-pause on blur.
- **Moves**: double-jump flip/spin (trick bonus on landing), **Dash** (Shift/Z/X/E, button, X on gamepad; costs 50 energy, invulnerable, smashes obstacles).
- **Systems**: energy meter, coin-rush milestones (10/25/50/100), multiplier ×6, new power-ups (scooter, slow-mo), new missions (flip/dash/scoot), 10 achievements with rewards and an achievements screen, camera effects (dash FOV kick, landing dip, lane roll, slow-mo, hit-stop).
- **Devices**: touch swipes, keyboard (arrows/WASD/Space), gamepad, safe-area insets, UI scale clamp, landscape/portrait/tablet/desktop layouts.
- **Honest limits**: tested only in headless Chromium (SwiftShader) at several viewport sizes; no real iPhone/Android/gamepad hardware testing, so FPS on real devices is not guaranteed. Art is stylised procedural geometry, not artist-made.

## v6 — chasers, showcase, jetpack fix, MVC-style split (3D game)

- **Jetpack coins**: the camera rises while flying, the coin wave follows the lane you were in (smooth sine path), coins that already passed are no longer drawn through the camera, and pick-up radius is wider while flying.
- **New chasers**: **Alp**, a heavy crimson steppe warrior-bot (conical helmet, ram-horn pauldrons, cape, glowing lance), and **Bo'ri**, a robotic wolf (bronze collar, plume tail). They replace the old police robot and dog.
- **Pre-game showcase**: before START the hero idles on a Registan-star podium (breathing, blinking, waving) while a 16 s looping camera does a reveal, a full orbit and a pull-back; Alp and Bo'ri stalk in from the far end of the street. START blends the showcase camera into the gameplay camera (0.9 s, 1.2 s of grace).
- **Small gameplay additions**: +150 and a banner when you enter the next city, red danger vignette when the hunters are close.
- **Architecture** (`js/3d/`, classic scripts, no build step; load order is the order in `city3d.html`):
  - `core/` engine: util, i18n, gl, math, shaders, geometry, textures, draw
  - `model/` data and rules: themes, state, progress (missions/XP), world (spawning), achievements, events, update (simulation step)
  - `view/` rendering: city-builder, character-batch, chaser, hero, environment, showcase, render, hud
  - `controller/` input and flow: audio, input (touch / mouse / keyboard / gamepad), flow (screens), loop, main (boot), api (`ZR3D` test hooks)
  - Honest note: the files share one global lexical scope (a pragmatic split of the former single closure), so this is an MVC-_inspired_ separation by responsibility, not isolated modules with explicit imports. Turning it into ES modules with an explicit state object would be the next step.
- **Limits**: still tested only in headless Chromium (SwiftShader); no real phone / tablet / gamepad run; art is procedural geometry.

## v7 — new robot cast (2D + 3D)

- **ZUMA, the duck-bot** (hero, both versions): a small chibi duck robot (~1.6 units tall in 3D, ~50 px in 2D): glossy yellow shell, dark face screen with LED eyes (round, blink, happy `^ ^`, `X` when hit), small orange bill that opens when dashing, blush LEDs, stub wings that flap, ribbed turquoise doppi with a gold finial, ikat belt, 8-pointed-star chest core, ikat scarf and a tiny jet pack. Skins recolour the shell (yellow / rose / mint / gold). Poses: run waddle, jump, double-jump flip, belly slide, hit, dash, scooter, idle + wave.
- **Burgut** (chaser): compact hawk-bot, dark steel + crimson, hooked bronze beak, red LED visor, crest with a police beacon, folded blade-wings, talon feet, shock lance.
- **Bo'ri** (the dog): a small robotic wolf pup with big ears, bronze collar, plume tail and red LED eyes.
- Scale: hero and Burgut share the same height; Bo'ri is about half of it. 3D hit-box was tightened to match (standing 1.62, sliding 0.7) and the gameplay camera moved slightly closer.
- Where: 3D in `js/3d/view/hero.js` and `js/3d/view/chaser.js`; 2D side view and back view in `rig.js` (same API and frame indices as before, so `game.js` is unchanged). The old painted fallbacks in `chars.js` / `sprites.js` are only used if `Rig` fails to load and still show the previous look.
- Performance: the 3D hero is ~60 batched primitives (down from ~150); the busiest 3D frame measured ~8.8k of 16k character vertices. 2D robots are still pre-rendered once into small canvases.
- Still only checked in headless Chromium; not on a real phone. The main-game chaser sprite was verified in the sprite sheet but I did not capture it in a live chase frame.

## v8 — concept-art cast

- 3D: the hero is now a glossy white/blue duck-bot (black visor with cyan smile LEDs, headphone discs, crest, orange bill, crown chest emblem, blue cape, blue sneakers; accent colour follows the chosen skin). Chasers are a wheeled box-bot, a rolling ball-bot and a winged drone (white shells, red angry LED eyes). Procedural geometry, not artist-made.
- 2D (`rig.js`): palettes retinted to match (white/blue hero, white/red chasers). The 2D chasers keep the earlier hawk/wolf silhouettes; only the 3D game has the box/ball/drone shapes. Tested in headless Chromium only.

## v8b — 3D models baked into the 2D game

The 2D game keeps its gameplay, camera and controls, but its hero and chasers are now renders of the real 3D models: `tools/bake.py` renders `js/3d/view/hero.js` and `chaser.js` from the side (3/4 turned toward the camera) with the 3D engine and writes `assets/baked/*.png` (hero in 4 skins, box-bot guard, ball-bot dog). `rig.js` loads them and falls back to the procedural figures until they arrive (or if a file is missing). Re-run `python3 tools/bake.py` after changing a model. Obstacles, coins and scenery in the 2D game are still the original 2D art.

## City Run 3D — performance notes

- **FPS monitor:** open `city3d.html?fps=1` (or press F3). Shows fps, frame times, quality tier, resolution, draw calls, device class and GPU name.
- **Graphics setting:** menu / pause → "GRAPHICS: AUTO / HIGH / MEDIUM / LOW" (saved). AUTO picks a start tier by device (desktop, iPhone/iPad, Android, low-end Android) and adapts the render resolution; the governor measures against the screen's own refresh rate, so a 30 Hz power-saver screen is not treated as "slow", and it gives quality back when the device keeps up.
- **Pixel budget per device:** desktop 2.6 MP, iPhone/iPad 1.5 MP, Android 0.95 MP, low-end Android 0.6 MP. Texture size is capped at 512 px on touch / low-end devices.
- **Pooling:** the matrix pool (700) and the spark pool; obstacle list is compacted in place.
- **Not done:** GPU texture compression (ASTC/ETC2/S3TC). All textures are generated at runtime from canvas, so there is nothing to pre-compress; mip-maps, anisotropy and size caps are used instead.
- Only tested in headless Chromium (software GPU). Not verified on real iPhone/Android.
