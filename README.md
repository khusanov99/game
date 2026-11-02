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
| `sprites.js` | Loads real PNG characters (runner, guard, dog) when you provide them |
| `assets/characters/` | Character pictures: `hero_run1/run2/slide.png` (runner), `dog.png`, `guard.png` (officer) |
| `game.js` | Game engine, input, physics, spawning, audio, UI, saving |

Script order matters: `i18n.js`, `art.js`, `chars.js`, `sprites.js`, `game.js`.
The only external resource is the Google Fonts stylesheet. If it is blocked, the game falls back to system fonts.

## Characters (real pictures)

The game uses the ZUMARY hero, the dog and the police officer as pictures (`assets/characters/`).
`sprites.js` slices and scales them once at load. The hero uses 3 poses (running stride 1 and 2, slide); the dog and the officer are single pictures animated by code (gallop / run).

- Skins in the shop recolor only the painted fallback character; the hero picture is the same for every skin.
- To change a character: replace the PNG (transparent background, facing right) and adjust its entry in `CONFIG` at the top of `sprites.js` (height on screen, which picture is which pose, `motion` for animating a still picture).
- If a picture is missing, the built-in painted character is used, so the game never breaks.
- `guard.png` is a preview image with a stock-site watermark: replace it with a licensed, watermark-free copy before publishing.

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
- The art is drawn in code, not taken from photos or sprite artwork.
