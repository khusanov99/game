/* view/environment.js — Environment blending (sky, fog, lights) between themes. */
"use strict";
/* ---------- render ---------- */
function hexMix(a, b, t) { const A = hex(a), B2 = hex(b); return [lerp(A[0], B2[0], t), lerp(A[1], B2[1], t), lerp(A[2], B2[2], t)]; }
const maxc = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], mixa = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
let envTheme = 0;
function setEnvironment() {
  const n = THEMES.length, th = themeAt(pz), nx = (th + 1) % n, into = ((pz % THEME_LEN) + THEME_LEN) % THEME_LEN, t = clamp((into - (THEME_LEN - 120)) / 120, 0, 1), A = THEMES[th], Bt = THEMES[nx]; envTheme = t > 0.5 ? nx : th;
  const mix = (k) => hexMix(A[k], Bt[k], t); FOGC = mix("fog"); SKY.cur = { top: mix("top"), mid: mix("mid"), low: mix("low"), sun: mix("sun") };
  SKYC = maxc(mulc(hexMix(A.top, Bt.top, t), 1.35), mixa(A.amb, Bt.amb, t)); GNDC = maxc(mulc(FOGC, 0.62), mulc(mixa(A.amb, Bt.amb, t), 0.8)); SUNC = mulc(SKY.cur.sun, 1.35 * lerp(A.sunK, Bt.sunK, t));
  SUN = (() => { const v = [0.38, 0.22, 0.9], l = Math.hypot(...v); return v.map((x) => x / l); })();
  rainA = lerp(rainA, THEMES[envTheme].rain ? 1 : 0, 0.02);
}
const SPHM_B = BUBBLE;
