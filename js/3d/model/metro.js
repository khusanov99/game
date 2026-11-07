/* model/metro.js — The Tashkent Metro stretch: a tunnel inside the Tashkent theme (z = 240..540 of every 4200 m lap). */
"use strict";
const METRO_Z0 = 240,
  METRO_Z1 = 540,
  METRO_CYC = THEME_LEN * THEMES.length;
const metroPos = (z) => ((z % METRO_CYC) + METRO_CYC) % METRO_CYC;
const metroAt = (z) => {
  const c = metroPos(z);
  return c >= METRO_Z0 && c < METRO_Z1;
};
const metroChunk = (ci) => metroAt(ci * CH + CH / 2);
/* 0..1 darkness while the camera is in (or entering) the tunnel */
function metroAmt(z) {
  const c = metroPos(z),
    up = clamp((c - (METRO_Z0 - 28)) / 34, 0, 1),
    dn = clamp(((METRO_Z1 + 22) - c) / 30, 0, 1);
  return Math.min(up, dn);
}
