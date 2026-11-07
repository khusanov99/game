/* controller/main.js — Boot: resize handling, quality tier selection and first frame. */
"use strict";
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 200));
(() => {
  // starting tier from what the browser tells us about the device
  let r = "";
  try {
    const e = gl.getExtension("WEBGL_debug_renderer_info");
    r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "";
  } catch (x) {}
  const cores = navigator.hardwareConcurrency || 4,
    mem = navigator.deviceMemory || 4;
  let t = cores <= 4 || mem <= 3 ? 1 : 0;
  if (/mali-4|adreno \(tm\) [23]\d\d|powervr sgx/i.test(r)) t = 2;
  if (/swiftshader|llvmpipe|software/i.test(r)) t = 3;
  setRes([1, 0.8, 0.62, 0.5][t]);
})();
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
