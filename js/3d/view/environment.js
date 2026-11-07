/* view/environment.js — Environment blending (sky, fog, lights) between themes. */
"use strict";
/* ---------- render ---------- */
function hexMix(a, b, t) {
  const A = hex(a),
    B2 = hex(b);
  return [lerp(A[0], B2[0], t), lerp(A[1], B2[1], t), lerp(A[2], B2[2], t)];
}
const maxc = (a, b) => [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.max(a[2], b[2]),
  ],
  mixa = (a, b, t) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
let envTheme = 0,
  envT = 0;
function setEnvironment() {
  const n = THEMES.length,
    th = themeAt(pz),
    nx = (th + 1) % n,
    into = ((pz % THEME_LEN) + THEME_LEN) % THEME_LEN,
    t = clamp((into - (THEME_LEN - 120)) / 120, 0, 1),
    A = THEMES[th],
    Bt = THEMES[nx];
  envTheme = t > 0.5 ? nx : th;
  const mix = (k) => hexMix(A[k], Bt[k], t);
  FOGC = mix("fog");
  SKY.cur = {
    top: mix("top"),
    mid: mix("mid"),
    low: mix("low"),
    sun: mix("sun"),
  };
  SKYC = maxc(mulc(hexMix(A.top, Bt.top, t), 1.35), mixa(A.amb, Bt.amb, t));
  GNDC = maxc(mulc(FOGC, 0.62), mulc(mixa(A.amb, Bt.amb, t), 0.8));
  SUNC = mulc(SKY.cur.sun, 1.35 * lerp(A.sunK, Bt.sunK, t));
  SUN = (() => {
    const v = [0.38, 0.22, 0.9],
      l = Math.hypot(...v);
    return v.map((x) => x / l);
  })();
  {
    /* weather: smooth blend; nothing falls inside enclosed sections */
    const wt = weatherTarget(pz),
      open = 1 - metroAmt(pz),
      now = performance.now(),
      kk = 1 - Math.exp(-Math.min(0.25, (now - envT) / 1000) / 2.2);
    envT = now;
    rainA = lerp(rainA, wt[0] * open, kk);
    snowA = lerp(snowA, wt[1] * open, kk);
    fogA = lerp(fogA, wt[2] * (0.4 + 0.6 * open), kk);
    const oc = clamp(Math.max(rainA * 0.75, snowA * 0.6, fogA * 0.9), 0, 1),
      lum = (FOGC[0] + FOGC[1] + FOGC[2]) / 3,
      grey = mulc([0.8, 0.82, 0.86], clamp(lum * 1.5, 0.22, 1));
    if (oc > 0.01) {
      const gk = oc * 0.65;
      FOGC = mixa(FOGC, grey, clamp(fogA * 0.8 + rainA * 0.3 + snowA * 0.4, 0, 0.85));
      SKY.cur = {
        top: mixa(SKY.cur.top, mulc(grey, 0.75), gk),
        mid: mixa(SKY.cur.mid, mulc(grey, 0.9), gk),
        low: mixa(SKY.cur.low, grey, gk),
        sun: SKY.cur.sun,
      };
      SKYC = mixa(SKYC, mulc(grey, 0.8), gk * 0.7);
      GNDC = mixa(GNDC, mulc(grey, 0.5), gk * 0.5);
      SUNC = mulc(SUNC, 1 - 0.55 * oc);
    }
  }
  const mk = metroAmt(pz); // enclosed sections: dark, warm, lit by lamps
  if (mk > 0) {
    const tim = (secAt(pz + 40) || secAt(pz - 40)) === 2;
    FOGC = mixa(FOGC, tim ? [0.1, 0.06, 0.04] : [0.06, 0.05, 0.08], mk);
    SKYC = mixa(SKYC, tim ? [0.3, 0.22, 0.17] : [0.2, 0.19, 0.25], mk);
    GNDC = mixa(GNDC, tim ? [0.2, 0.14, 0.1] : [0.14, 0.13, 0.16], mk);
    SUNC = mulc(SUNC, 1 - 0.6 * mk);
  }
}
const SPHM_B = BUBBLE;
