/* controller/loop.js — DOM sync, dynamic-resolution governor and the main frame loop. */
"use strict";
const UIS = { show: null, e: -1, rdy: null };
function syncUi() {                                      // touch only the DOM when something actually changed
  const show = state === "play" && !paused && !ovOpen();
  if (show !== UIS.show) { UIS.show = show; pauseBtn.classList.toggle("on", show); dashBtn.classList.toggle("on", show); }
  const e = Math.round(energy); if (e !== UIS.e) { UIS.e = e; dashBtn.style.setProperty("--e", e); }
  const rdy = energy >= 50; if (rdy !== UIS.rdy) { UIS.rdy = rdy; dashBtn.classList.toggle("rdy", rdy); }
}
let gAcc = 0, gN = 0, now = 0, lastChg = 0, lastDown = 0;
function setRes(v) { resScale = v; qual = v > 0.85 ? 0 : v > 0.7 ? 1 : v > 0.58 ? 2 : 3; FAR = FARS[qual]; resize(); }
function frame(ts) {
  requestAnimationFrame(frame); if (!lastT) { lastT = ts; return; }
  let dt = (ts - lastT) / 1000; lastT = ts; if (dt > 0.1) dt = 0.1; const ms = dt * 1000;
  if (state === "play" && !paused) {                     // dynamic-resolution governor: keeps the frame rate up on any phone
    gAcc += ms; gN++; if (gN >= 20) {
      const avg = gAcc / gN; gAcc = 0; gN = 0; now = performance.now();
      if (avg > 22 && resScale > 0.45 && now - lastChg > 900) { setRes(Math.max(0.45, resScale * (avg > 34 ? 0.78 : 0.9))); lastChg = now; lastDown = now; }
      else if (avg < 14 && resScale < 1 && now - lastDown > 5000 && now - lastChg > 1500) { setRes(Math.min(1, resScale * 1.06)); lastChg = now; }
    }
  }
  if (state === "ready") showT += dt; if (camBlend > 0) { camBlend = Math.max(0, camBlend - dt / 0.9); if (camBlend <= 0) SC = null; }
  pollPad(); if (slow > 0) slow -= dt; if (resumeCd > 0) resumeCd -= dt;
  if (!paused && resumeCd <= 0) update(dt * (slow > 0 ? 0.62 : 1));
  syncUi(); render();
}
