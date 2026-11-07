/* model/metro.js — Special sections, one per city lap-block (z mod 4200, each theme 700 m, section at 240..540):
   1 Tashkent Metro tunnel · 2 Bukhara covered bazaar (tim) · 3 Khiva wall-top run · 4 Fergana canals & cotton fields */
"use strict";
const METRO_Z0 = 240,
  METRO_Z1 = 540,
  METRO_CYC = THEME_LEN * THEMES.length,
  SEC_OF_THEME = [1, 0, 2, 3, 4, 0],
  SEC_NAME = ["", "METRO", "BOZOR TIMI", "ICHAN QAL'A", "PAXTA MAYDONI"];
const metroPos = (z) => ((z % METRO_CYC) + METRO_CYC) % METRO_CYC;
/* section type at distance z (0 = none) */
function secAt(z) {
  const p = metroPos(z),
    c = p % THEME_LEN;
  if (c < METRO_Z0 || c >= METRO_Z1) return 0;
  return SEC_OF_THEME[Math.floor(p / THEME_LEN)] || 0;
}
const metroAt = (z) => secAt(z) === 1,
  secChunk = (ci) => secAt(ci * CH + CH / 2),
  metroChunk = secChunk;
/* 0..1 darkness while the camera is in (or entering) an enclosed section (metro tunnel / bazaar tim) */
function metroAmt(z) {
  const t = secAt(z + 40) || secAt(z - 40);
  if (t !== 1 && t !== 2) return 0;
  const c = metroPos(z) % THEME_LEN,
    up = clamp((c - (METRO_Z0 - 28)) / 34, 0, 1),
    dn = clamp((METRO_Z1 + 22 - c) / 30, 0, 1);
  return Math.min(up, dn);
}
