/* controller/flow.js — Screens and game flow: menu, pause, game over, revive, start. */
"use strict";
/* ---------- flow ---------- */
const rvBtn = document.createElement("button");
rvBtn.id = "rv";
rvBtn.type = "button";
rvBtn.style.cssText =
  "background:linear-gradient(90deg,#ffd84f,#ff9a3c);display:none";
$("go").parentNode.insertBefore(rvBtn, $("go"));
function showOv(title, sub, row, btn, canRevive) {
  rsBtn.style.display = "none";
  achBtn.style.display = "none";
  gfxBtn.style.display = "none";
  $("oTitle").textContent = title;
  $("oSub").innerHTML = sub;
  $("oRow").innerHTML = row;
  $("go").textContent = btn;
  $("back").textContent = T("back");
  rvBtn.style.display = canRevive ? "block" : "none";
  rvBtn.textContent = "▶ " + T("revive");
  $("ov").classList.remove("hidden");
  $("ov").classList.remove("show");
}
function missionHtml() {
  const m = loadMissions();
  return `<div style="width:100%;text-align:left;font:600 11px Inter,sans-serif;color:#c8cdf0;margin-top:4px"><div style="font:700 9px Orbitron,sans-serif;letter-spacing:1.5px;color:#8c93b8;margin-bottom:4px">${T("missions")}</div>${m.l.map((q) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;opacity:${q.done ? 0.55 : 1}"><span>${q.done ? "✔ " : "◻ "}${missionText(q)}</span><span style="color:#ffd84f">${q.done ? "OK" : q.p + "/" + q.t}</span></div>`).join("")}</div>`;
}
function menu() {
  ovMode = "menu";
  showOv(
    T("title"),
    T("sub"),
    `<div class="pill"><small>${T("best")}</small>${best}</div><div class="pill"><small>${T("level")}</small>${lvlOf(XP)}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>${wallet}</div>` +
      missionHtml(),
    T("play"),
    false,
  );
  gfxBtn.style.display = "block";
  gfxLabel();
  achBtn.style.display = "block";
  achBtn.textContent =
    T("achBtn") +
    "  " +
    ACHS.filter((a) => AU[a[0]]).length +
    "/" +
    ACHS.length;
  $("ov").classList.toggle("show", state === "ready");
}
function achOv() {
  ovMode = "ach";
  showOv(
    T("achTitle"),
    ACHS.filter((a) => AU[a[0]]).length + " / " + ACHS.length,
    ACHS.map(
      ([id, , r]) =>
        `<div style="width:100%;display:flex;justify-content:space-between;gap:8px;text-align:left;font:600 11px Inter,sans-serif;padding:5px 0;color:${AU[id] ? "#ffd84f" : "#7c84ab"}"><span>${AU[id] ? "🏅" : "🔒"} <b>${T("ach_" + id + "_n")}</b><br><span style="font-weight:500;color:#aeb6e0">${T("ach_" + id + "_d")}</span></span><span>+${r}</span></div>`,
    ).join(""),
    T("back2"),
    false,
  );
}
function showPause() {
  ovMode = "pause";
  showOv(
    T("paused"),
    T("pauseHint"),
    `<div class="pill"><small>${T("score")}</small>${scoreNow()}</div><div class="pill"><small>${T("m").toUpperCase()}</small>${Math.floor(pz)}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>${coinsGot}</div>`,
    T("resume"),
    false,
  );
  rsBtn.style.display = "block";
  rsBtn.textContent = T("restart");
  gfxBtn.style.display = "block";
  gfxLabel();
}
function start() {
  actx();
  try {
    AC && AC.resume();
  } catch (e) {}
  const fromShow = state === "ready" && SC;
  reset();
  if (fromShow) {
    camBlend = 1;
    invul = Math.max(invul, 1.2);
  }
  state = "play";
  paused = false;
  ovMode = "play";
  $("ov").classList.add("hidden");
  lastT = 0;
}
function endGame() {
  if (state !== "play") return;
  state = "over";
  ovMode = "over";
  LT.runs++;
  LT.best = Math.max(LT.best, Math.floor(pz));
  saveLT();
  checkAch();
  bustT = 0;
  sfx.bust();
  vib([80, 40, 120]);
  shakeT = 0.5;
  vy = 4;
  const nb = bank(),
    d = scoreNow();
  setTimeout(() => {
    if (state !== "over") return;
    const extra =
      doneMsgs
        .map(
          (q) => `<br><b style="color:#7ffcb0">✔ ${T("missionDone")} +100</b>`,
        )
        .join("") +
      (lvlMsg ? `<br><b style="color:#ffd84f">${lvlMsg}</b>` : "");
    showOv(
      T("busted"),
      T("caught") +
        (nb ? "<br><b style='color:#ffd84f'>" + T("newbest") + "</b>" : "") +
        extra,
      `<div class="pill"><small>${T("score")}</small>${d}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>+${coinsGot}</div><div class="pill"><small>${T("best")}</small>${best}</div>`,
      T("again"),
      !revived && wallet >= 100,
    );
  }, 1500);
}
rvBtn.addEventListener("click", () => {
  if (state !== "over" || revived || wallet < 100) return;
  wallet -= 100;
  store.set("zr_wallet", wallet);
  revived = true;
  state = "play";
  hits = 0;
  hitT = 0;
  invul = 3;
  gap = 11.5;
  bustT = 0;
  shakeT = 0;
  vy = 0;
  py = 0;
  shield = 4;
  lastT = 0;
  paused = false;
  for (const o of objs)
    if (o.k !== "coin" && o.z > pz - 6 && o.z < pz + 30) o.dead = true;
  $("ov").classList.add("hidden");
});
$("go").addEventListener("click", () => {
  if (ovMode === "pause") setPause(false);
  else if (ovMode === "ach") menu();
  else start();
});
rsBtn.addEventListener("click", () => {
  paused = false;
  try {
    AC && AC.resume();
  } catch (e) {}
  start();
});
achBtn.addEventListener("click", achOv);
gfxBtn.addEventListener("click", () => {
  cycleGfx();
  gfxLabel();
});
