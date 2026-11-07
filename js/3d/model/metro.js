/* model/metro.js — Special sections, one per 700 m city block, at a different spot every run (chunk-aligned, 300 m):
   1 Tashkent Metro tunnel · 2 Bukhara covered bazaar (tim) · 3 Khiva wall-top run · 4 Fergana canals & cotton fields */
"use strict";
const SEC_OF_THEME = [1, 0, 2, 3, 4, 0],
  SEC_NAME = ["", "METRO", "BOZOR TIMI", "ICHAN QAL'A", "PAXTA MAYDONI"],
  SEC_CH = 5;
function secStart(k) {
  const h = Math.sin((k * 37.7 + (RUNSEED % 9973) * 0.113) * 12.9898) * 43758.5453,
    off = 60 + 140 * (h - Math.floor(h));
  return Math.ceil((k * THEME_LEN + off) / CH); // first chunk of the block's section
}
function secChunk(ci) {
  const k = Math.floor((ci * CH + CH / 2) / THEME_LEN),
    s = secStart(k);
  if (ci < s || ci >= s + SEC_CH) return 0;
  return SEC_OF_THEME[themeAt(k * THEME_LEN + 1)] || 0;
}
const secAt = (z) => secChunk(Math.floor(z / CH)),
  metroAt = (z) => secAt(z) === 1,
  metroChunk = secChunk;
/* 0..1 darkness while the camera is in (or entering) an enclosed section (metro tunnel / bazaar tim) */
function metroAmt(z) {
  const k = Math.floor(z / THEME_LEN),
    t = SEC_OF_THEME[themeAt(k * THEME_LEN + 1)];
  if (t !== 1 && t !== 2) return 0;
  const zs = secStart(k) * CH,
    ze = zs + SEC_CH * CH;
  return Math.min(clamp((z - (zs - 28)) / 34, 0, 1), clamp((ze + 22 - z) / 30, 0, 1));
}
