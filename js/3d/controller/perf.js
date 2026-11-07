/* controller/perf.js — FPS monitor (F3 or ?fps=1): fps, frame times, quality tier, resolution, draw calls. */
"use strict";
const PF = { el: null, on: false, n: 0, t0: 0, sum: 0, wst: 0, slow: 0, txt: "" };
let GPUNAME = "";
try {
  const e = gl.getExtension("WEBGL_debug_renderer_info");
  GPUNAME = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : "";
} catch (x) {}
function togglePerf() {
  PF.on = !PF.on;
  if (!PF.el) {
    PF.el = document.createElement("pre");
    PF.el.style.cssText =
      "position:fixed;left:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px));z-index:50;margin:0;padding:5px 7px;font:10px/1.35 ui-monospace,Menlo,monospace;color:#7ffcb0;background:rgba(0,0,0,.62);border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(PF.el);
  }
  PF.el.style.display = PF.on ? "block" : "none";
  PF.n = PF.sum = PF.wst = PF.slow = 0;
  PF.t0 = performance.now();
}
function perfTick(ms) {
  if (!PF.on) return;
  PF.n++;
  PF.sum += ms;
  if (ms > PF.wst) PF.wst = ms;
  if (ms > 33.4 && state === "play") PF.slow++;
  const t = performance.now();
  if (t - PF.t0 < 1000) return;
  const fps = Math.round((PF.n * 1000) / (t - PF.t0));
  PF.el.textContent =
    `${fps} fps  avg ${(PF.sum / PF.n).toFixed(1)}ms  worst ${PF.wst.toFixed(0)}ms  slow ${PF.slow}\n` +
    `Q${qual} gfx ${gfx}  res ${resScale.toFixed(2)}  dpr ${DPR.toFixed(2)}  ${cv.width}x${cv.height}\n` +
    `draws ${DC}  objs ${objs.length}  sparks ${sparks.length}  hz ${(1000 / hzMs).toFixed(0)}\n` +
    `${DEV.ios ? "iOS" : DEV.android ? "Android" : COARSE ? "touch" : "desktop"}${DEV.low ? " (low-end)" : ""}  ${GPUNAME.slice(0, 44)}`;
  PF.n = PF.sum = PF.wst = PF.slow = 0;
  PF.t0 = t;
}
addEventListener("keydown", (e) => {
  if (e.key === "F3") {
    e.preventDefault();
    togglePerf();
  }
});
if (/[?&]fps\b/.test(location.search)) setTimeout(togglePerf, 0);
