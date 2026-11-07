/* model/metro.js — Special sections, one per 700 m city block, at a different spot every run (chunk-aligned, 300 m):
   1 Tashkent Metro tunnel · 2 Bukhara covered bazaar (tim) · 3 Khiva wall-top run · 4 Fergana canals & cotton fields */
"use strict";
const SEC_OF_THEME = [0, 0, 2, 3, 4, 0],
  SEC_NAME = ["", "METRO", "BOZOR TIMI", "ICHAN QAL'A", "PAXTA MAYDONI"],
  SEC_CH = 5,
  LAP_CH = Math.round((6 * 700) / 60), // 70 chunks per lap of six cities
  MET_CH = 34, // the metro line: 34 chunks = 2040 m, ten stations of ~200 m
  MET_ST = 10;
/* first chunk of the metro line in a lap: a different spot every run, never at the very start */
function metStart(lap) {
  const h = Math.sin((lap * 53.1 + (RUNSEED % 9973) * 0.071) * 12.9898) * 43758.5453,
    f = h - Math.floor(h);
  return lap * LAP_CH + 6 + Math.floor(f * (LAP_CH - MET_CH - 10));
}
function secStart(k) {
  const h = Math.sin((k * 37.7 + (RUNSEED % 9973) * 0.113) * 12.9898) * 43758.5453,
    off = 60 + 140 * (h - Math.floor(h));
  return Math.ceil((k * THEME_LEN + off) / CH); // first chunk of the block's section
}
function secChunk(ci) {
  const ms = metStart(Math.floor(ci / LAP_CH));
  if (ci >= ms && ci < ms + MET_CH) return 1;
  const k = Math.floor((ci * CH + CH / 2) / THEME_LEN),
    s = secStart(k);
  if (ci < s || ci >= s + SEC_CH) return 0;
  return SEC_OF_THEME[themeAt(k * THEME_LEN + 1)] || 0;
}
/* which of the ten real Tashkent stations this chunk is: Tashkent hosts the first five, Neon Tashkent the other five */
function stationOf(ci) {
  const j = ci - metStart(Math.floor(ci / LAP_CH));
  return clamp(Math.floor(j / (MET_CH / MET_ST)), 0, MET_ST - 1);
}
const secAt = (z) => secChunk(Math.floor(z / CH)),
  metroAt = (z) => secAt(z) === 1,
  metroChunk = secChunk;
/* 0..1 darkness while the camera is in (or entering) an enclosed section (metro tunnel / bazaar tim) */
function metroAmt(z) {
  const zl = metStart(Math.floor(z / (LAP_CH * CH))) * CH,
    zm = zl + MET_CH * CH,
    am = Math.min(clamp((z - (zl - 28)) / 34, 0, 1), clamp((zm + 22 - z) / 30, 0, 1));
  if (am > 0) return am;
  const k = Math.floor(z / THEME_LEN),
    t = SEC_OF_THEME[themeAt(k * THEME_LEN + 1)];
  if (t !== 2) return 0;
  const zs = secStart(k) * CH,
    ze = zs + SEC_CH * CH;
  return Math.min(clamp((z - (zs - 28)) / 34, 0, 1), clamp((ze + 22 - z) / 30, 0, 1));
}
