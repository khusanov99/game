/* model/weather.js — Weather along the route: clear / rain / fog / snow / storm, picked per 800 m block. */
"use strict";
const WEATHER_BLK = 800;
function wHash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
/* target [rain, snow, fog] at distance z (0..1 each) */
function weatherTarget(z) {
  if (z < 500) return [0, 0, 0];
  const blk = Math.floor(z / WEATHER_BLK),
    h = wHash(blk),
    s = 0.75 + 0.25 * wHash(blk + 91);
  let w;
  if (h < 0.34) w = [0, 0, 0];
  else if (h < 0.52) w = [s, 0, 0.15];
  else if (h < 0.7) w = [0, 0, s];
  else if (h < 0.88) w = [0, s, 0.2];
  else w = [1, 0, 0.5];
  if (THEMES[themeAt(z)].night) w[0] = Math.max(w[0], 0.85); // Neon Tashkent stays rainy
  return w;
}
