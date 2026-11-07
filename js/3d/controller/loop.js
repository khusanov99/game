/* controller/loop.js — DOM sync, dynamic-resolution governor and the main frame loop. */
"use strict";
const UIS = { show: null, e: -1, rdy: null };
function syncUi() {
  // touch only the DOM when something actually changed
  const show = state === "play" && !paused && !ovOpen();
  if (show !== UIS.show) {
    UIS.show = show;
    pauseBtn.classList.toggle("on", show);
    dashBtn.classList.toggle("on", show);
  }
  const e = Math.round(energy);
  if (e !== UIS.e) {
    UIS.e = e;
    dashBtn.style.setProperty("--e", e);
  }
  const rdy = energy >= 50;
  if (rdy !== UIS.rdy) {
    UIS.rdy = rdy;
    dashBtn.classList.toggle("rdy", rdy);
  }
}
/* ---- graphics: user setting + dynamic-resolution governor ---- */
const GFXV = { high: 1, med: 0.72, low: 0.55 },
  GFX_ORDER = ["auto", "high", "med", "low"];
let gfx = store.get("zr3_gfx", "auto");
if (gfx !== "auto" && !GFXV[gfx]) gfx = "auto";
/* starting resolution from what the browser tells us about the device */
function deviceTier() {
  let r = "";
  try {
    const e = gl.getExtension("WEBGL_debug_renderer_info");
    r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "";
  } catch (x) {}
  let t = DEV.cores <= 4 || DEV.mem <= 3 ? 1 : 0;
  if (DEV.ios && DEV.mem >= 4) t = 0;
  if (DEV.low) t = 2;
  if (/mali-4|adreno \(tm\) [23]\d\d|powervr sgx/i.test(r)) t = 2;
  if (/swiftshader|llvmpipe|software/i.test(r)) t = 3;
  return [1, 0.8, 0.62, 0.5][t];
}
let tier0 = 1;
function applyGfx() {
  gGrace = 90;
  tier0 = deviceTier();
  setRes(GFXV[gfx] || tier0);
}
function cycleGfx() {
  gfx = GFX_ORDER[(GFX_ORDER.indexOf(gfx) + 1) % GFX_ORDER.length];
  store.set("zr3_gfx", gfx);
  applyGfx();
}
let gAcc = 0,
  gN = 0,
  gGrace = 90, // frames ignored after start / a change: shader compile and chunk builds must not look like a slow phone
  fMin = 1e9,
  fWin = 0,
  hzMs = 16.7, // the screen's own frame interval (30 Hz power-saver = 33 ms is NOT "slow")
  now = 0,
  lastChg = 0,
  lastDown = 0;
function setRes(v) {
  resScale = v;
  qual = v > 0.85 ? 0 : v > 0.7 ? 1 : v > 0.58 ? 2 : 3;
  FAR = FARS[qual];
  resize();
}
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastT) {
    lastT = ts;
    return;
  }
  let dt = (ts - lastT) / 1000;
  lastT = ts;
  if (dt > 0.1) dt = 0.1;
  const ms = dt * 1000;
  if (typeof perfTick === "function") perfTick(ms);
  if (ms > 4 && ms < fMin) fMin = ms;
  if (++fWin >= 300) {
    hzMs = clamp(fMin, 6, 34);
    fMin = 1e9;
    fWin = 0;
  }
  if (state === "play" && !paused && gfx === "auto") {
    if (gGrace > 0) gGrace--;
    else {
      gAcc += Math.min(ms, 50); // one random hitch must not count
      gN++;
    }
    if (gN >= 20) {
      const avg = gAcc / gN,
        slowT = Math.max(22, hzMs * 1.3);
      gAcc = 0;
      gN = 0;
      now = performance.now();
      if (avg > slowT && resScale > 0.5 && now - lastChg > 900) {
        setRes(Math.max(0.5, resScale * (avg > slowT * 1.5 ? 0.78 : 0.9)));
        gGrace = 20;
        lastChg = now;
        lastDown = now;
      } else if (
        avg < hzMs * 1.15 &&
        resScale < tier0 + 0.2 &&
        resScale < 1 &&
        now - lastDown > 6000 &&
        now - lastChg > 1500
      ) {
        setRes(Math.min(1, resScale * 1.06)); // device keeps up with its own refresh rate: give quality back
        gGrace = 20;
        lastChg = now;
      }
    }
  }
  if (state === "ready") showT += dt;
  if (camBlend > 0) {
    camBlend = Math.max(0, camBlend - dt / 0.9);
    if (camBlend <= 0) SC = null;
  }
  pollPad();
  if (slow > 0) slow -= dt;
  if (talk) {
    talkTick(dt);
    sparksTick(dt);
  }
  if (resumeCd > 0) resumeCd -= dt;
  if (!paused && resumeCd <= 0) update(dt * (slow > 0 ? 0.62 : 1));
  syncUi();
  render();
}
