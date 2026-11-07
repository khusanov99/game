/* controller/input.js — Player actions plus touch, mouse, keyboard and gamepad input. */
"use strict";
/* ---------- actions & input (touch swipe, mouse drag, keyboard, gamepad, on-screen buttons) ---------- */
function moveLane(d) {
  if (state !== "play" || paused || resumeCd > 0) return;
  const nl = clamp(lane + d, 0, 2);
  if (nl !== lane) {
    lane = nl;
    sfx.move();
  }
}
const grounded = () => py < floorY + 0.08;
function dust(n) {
  burst(px, 0.15, pz, n || 6, "#d8cbb0", 2.4);
}
function jump() {
  if (state !== "play" || paused || resumeCd > 0 || jet > 0) return;
  if (grounded()) {
    vy = scoot > 0 ? 9.8 : 9.2;
    slideT = 0;
    S.jump++;
    sfx.jump();
    air2 = true;
    flipT = 0;
    trick = false;
    dust(5);
  } else if (air2) {
    // acrobatics: a second jump in the air = flip (spin on the scooter)
    air2 = false;
    vy = 8.4;
    slideT = 0;
    flipT = 0.001;
    flipSpin = scoot > 0;
    trick = true;
    sfx.flip();
    vib(12);
    burst(px, py + 0.8, pz, 14, "#9ffcff", 4);
    floatText(T(flipSpin ? "spin" : "flip"), "#9ffcff");
  }
}
function slide() {
  if (state !== "play" || paused || resumeCd > 0 || jet > 0) return;
  slideT = 0.75;
  if (py > floorY + 0.08) vy = Math.min(vy, -12);
  else {
    S.slide++;
    sfx.slide();
  }
}
function dashNow() {
  if (state !== "play" || paused || resumeCd > 0 || dash > 0) return;
  if (energy < 50) {
    floatText(T("dashNeed"), "#ff9aa8");
    return;
  }
  energy -= 50;
  dash = 0.5;
  invul = Math.max(invul, 0.2);
  S.dash++;
  LT.dashes++;
  sfx.dash();
  vib(25);
  shakeT = Math.max(shakeT, 0.12);
  burst(px, py + 0.9, pz, 18, "#53f7ff", 6);
  floatText(T("dash"), "#53f7ff");
  checkAch();
}
const rsBtn = document.createElement("button");
rsBtn.id = "rs";
rsBtn.type = "button";
rsBtn.style.cssText =
  "display:none;background:transparent;color:#aeb6e0;border:1px solid rgba(255,255,255,.18);font-size:12px;padding:12px";
$("go").after(rsBtn);
const achBtn = document.createElement("button");
achBtn.id = "achb";
achBtn.type = "button";
achBtn.style.cssText =
  "display:none;background:rgba(255,216,79,.1);color:#ffd84f;border:1px solid rgba(255,216,79,.35);font-size:12px;padding:12px";
$("go").after(achBtn);
const gfxBtn = document.createElement("button");
gfxBtn.id = "gfxb";
gfxBtn.type = "button";
gfxBtn.style.cssText =
  "display:none;background:rgba(83,247,255,.08);color:#7fe6ff;border:1px solid rgba(83,247,255,.3);font-size:12px;padding:12px";
$("go").after(gfxBtn);
const GFXN = {
  uz: ["AVTO", "YUQORI", "O'RTA", "PAST"],
  en: ["AUTO", "HIGH", "MEDIUM", "LOW"],
  ja: ["自動", "高", "中", "低"],
};
function gfxLabel() {
  const n = (GFXN[LG] || GFXN.en)[GFX_ORDER.indexOf(gfx)];
  gfxBtn.textContent =
    (LG === "uz" ? "GRAFIKA: " : LG === "ja" ? "画質: " : "GRAPHICS: ") + n;
}
let ovMode = "menu";
const ovOpen = () => !$("ov").classList.contains("hidden");
function setPause(on) {
  if (state !== "play" || paused === on) return;
  paused = on;
  resumeCd = 0;
  if (on) {
    showPause();
    try {
      AC && AC.suspend();
    } catch (e) {}
  } else {
    $("ov").classList.add("hidden");
    resumeCd = 1.5;
    lastT = 0;
    try {
      AC && AC.resume();
    } catch (e) {}
  }
}
const togglePause = () => {
  if (state === "play") setPause(!paused);
};
let pt = null;
addEventListener("pointerdown", (e) => {
  if (ovOpen() || (e.target.closest && e.target.closest("#pauseBtn,#dashBtn")))
    return;
  pt = { x: e.clientX, y: e.clientY, done: false };
  actx();
});
addEventListener("pointermove", (e) => {
  if (!pt || pt.done) return;
  const dx = e.clientX - pt.x,
    dy = e.clientY - pt.y,
    th = 22;
  if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) {
    moveLane(dx > 0 ? 1 : -1);
    pt.done = true;
  } else if (Math.abs(dy) > th) {
    dy < 0 ? jump() : slide();
    pt.done = true;
  }
});
addEventListener("pointerup", () => {
  pt = null;
});
addEventListener("pointercancel", () => {
  pt = null;
});
addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k))
    e.preventDefault();
  if (k === "Escape" || k === "p" || k === "P") {
    if (!e.repeat) togglePause();
    return;
  }
  if (k === "m" || k === "M") {
    muted = !muted;
    store.set("zr3d_mute", muted);
    return;
  }
  if (state !== "play" || paused) {
    if ((k === "Enter" || k === " ") && ovOpen() && !e.repeat) $("go").click();
    return;
  }
  if (e.repeat) return;
  if (k === "ArrowLeft" || k === "a" || k === "A") moveLane(-1);
  else if (k === "ArrowRight" || k === "d" || k === "D") moveLane(1);
  else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump();
  else if (k === "ArrowDown" || k === "s" || k === "S") slide();
  else if (
    k === "Shift" ||
    k === "z" ||
    k === "Z" ||
    k === "x" ||
    k === "X" ||
    k === "e" ||
    k === "E"
  )
    dashNow();
});
addEventListener("blur", () => {
  if (state === "play") setPause(true);
});
addEventListener("visibilitychange", () => {
  if (document.hidden && state === "play") setPause(true);
});
addEventListener("contextmenu", (e) => e.preventDefault());
const pauseBtn = $("pauseBtn"),
  dashBtn = $("dashBtn");
pauseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePause();
});
dashBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  actx();
  dashNow();
});
const PADS = { prev: [] };
function pollPad() {
  // gamepad: stick/d-pad = lanes, A/up = jump, B/down = slide, X/RB/RT = dash, Start = pause
  const gp = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!gp) return;
  for (const g of gp) {
    if (!g || !g.connected) continue;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed),
      ax = g.axes[0] || 0,
      ay = g.axes[1] || 0,
      pv = PADS.prev;
    const cur = [
      b(14) || ax < -0.6,
      b(15) || ax > 0.6,
      b(12) || b(0) || ay < -0.6,
      b(13) || b(1) || ay > 0.6,
      b(2) || b(5) || b(7),
      b(9),
    ];
    if (cur[0] && !pv[0]) moveLane(-1);
    if (cur[1] && !pv[1]) moveLane(1);
    if (cur[2] && !pv[2]) {
      if (ovOpen()) $("go").click();
      else jump();
    }
    if (cur[3] && !pv[3]) slide();
    if (cur[4] && !pv[4]) dashNow();
    if (cur[5] && !pv[5]) togglePause();
    PADS.prev = cur;
    break;
  }
}
