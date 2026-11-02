# ZUMARY Run

An endless runner and campaign game set in Uzbek cities (Tashkent, Samarkand, Bukhara, Khiva). It is plain HTML, CSS and JavaScript. It has no backend, no build step and no npm dependencies.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup and script loading order |
| `style.css` | Layout, mobile bottom-sheet menus, touch pad, settings |
| `i18n.js` | Uzbek / English / Japanese texts and language switching |
| `art.js` | Pre-rendered city scenery, parallax layers, ground, thumbnails |
| `chars.js` | Built-in painted runner, guard, dog (fallback), coins, obstacles, icons |
| `sprites.js` | Optional: use your own PNG pictures instead (used only if `rig.js` is missing) |
| `rig.js` | Skeleton-animated robots: hero robot, police robot, robot hound (IK legs, swinging arms, glowing parts, back-light rim) |
| `assets/characters/` | Character pictures: `hero_run1/run2/slide.png` (runner), `dog.png`, `guard.png` (officer) |
| `game.js` | Game engine, input, physics, spawning, audio, UI, saving |

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


## City Run (city.html)
Subway-Surfers-style mode: the camera is behind the robot, running down the middle of an Uzbek city street (Tashkent → Samarkand → Bukhara → Khiva) on 3 lanes. Swipe left/right to change lane, up to jump, down to slide (keys: arrows / WASD, P pause, M mute). Collect spinning patterned coins (gold gems = 5). Two hits and the police robot + hound catch you. Coins go to the same wallet as the main game. Pseudo-3D on plain Canvas 2D, no libraries. Not tested on real phones — only headless Chromium.
