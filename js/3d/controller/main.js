/* controller/main.js — Boot: resize handling, quality tier selection and first frame. */
"use strict";
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 200));
applyGfx(); // starting tier: the saved graphics setting, or the device class
resize();
reset();
coinTexs();
if (!CVER) initCoinBuf();
rt0();
menu();
requestAnimationFrame(frame);
function rt0() {
  for (const c of [0, 1]) ROADS[c] = ROADS[c] || mkRoadTex(c);
  sidewalkTex();
  minaretTex();
  for (const t of POWS) powTex(t);
  for (let i = 0; i < 6; i++) letTex(i);
}
