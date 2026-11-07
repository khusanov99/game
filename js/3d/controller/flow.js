/* controller/flow.js — Screens and game flow: menu, pause, game over, revive, start. */
"use strict";
/* ---------- flow ---------- */
const rvBtn = document.createElement("button");
rvBtn.id = "rv";
rvBtn.type = "button";
rvBtn.style.cssText =
  "background:linear-gradient(90deg,#ffd84f,#ff9a3c);display:none";
$("go").parentNode.insertBefore(rvBtn, $("go"));
/* ---------- delivery scene UI (DOM card over the frozen run) ---------- */
const tkEl = document.createElement("div");
tkEl.id = "talk";
tkEl.style.cssText =
  "position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(92vw,440px);z-index:30;display:none;background:rgba(10,12,30,.9);border:1.5px solid rgba(127,230,255,.45);border-radius:18px;padding:14px 16px;color:#fff;font:600 14px Inter,'Hiragino Sans',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);cursor:pointer;user-select:none";
document.body.appendChild(tkEl);
function uiTalk(d) {
  const c = CU[d.c];
  tkEl.style.display = "block";
  tkEl.innerHTML =
    `<div style="display:flex;gap:12px;align-items:flex-start"><div style="font-size:38px;line-height:1">${c ? c.e : "📦"}</div><div style="flex:1;min-width:0"><div style="font:800 11px Orbitron,sans-serif;letter-spacing:1.5px;color:#7fe6ff;margin-bottom:5px">${c ? cuName(d.c) : ""}</div><div id="tkTxt" style="min-height:42px;line-height:1.4;color:#f3f5ff"></div></div></div>` +
    `<div id="tkRw" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)"></div>` +
    `<div id="tkGo" style="margin-top:10px;text-align:right;font:800 11px Orbitron,sans-serif;letter-spacing:1.5px;color:#7fe6ff;opacity:0">▶ ${d.must ? T("tkNext") : ""}</div>`;
}
function talkRewards(d) {
  const rw = $("tkRw");
  if (!rw || rw.dataset.on) return;
  rw.dataset.on = 1;
  rw.style.display = "block";
  rw.innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:20px;color:#ffd84f;letter-spacing:2px">${starStr(d.rt)}</span><span style="color:#ffd84f;font-weight:800">+${d.reward} 🪙</span>${d.add ? `<span style="color:#ffa8d4;font-weight:800">+${d.add} ♥</span>` : ""}</div>` +
    d.extra.map((x) => `<div style="margin-top:5px;color:#7ffcb0;font-weight:700;font-size:12px">${x}</div>`).join("");
  sfx.zumary();
}
function talkClose() {
  if (!talk) return;
  talk = null;
  tkEl.style.display = "none";
  paused = false;
  resumeCd = 1.2;
  invul = Math.max(invul, 2.2);
  lastT = 0;
}
function talkTick(dt) {
  const d = talk;
  if (!d) return;
  d.t += dt;
  const txt = d.pages[d.pi],
    el = $("tkTxt");
  if (!el) return;
  d.ci = Math.min(txt.length, d.ci + dt * 38);
  el.textContent = txt.slice(0, Math.floor(d.ci));
  const done = d.ci >= txt.length;
  if (done && d.pi === 0) talkRewards(d);
  const go = $("tkGo");
  if (go) go.style.opacity = done && (d.must || d.pi < d.pages.length - 1) ? 1 : 0;
  /* a regular delivery closes itself after a short beat; quests and story chapters wait for a tap */
  if (done) {
    d.hold = (d.hold || 0) + dt;
    if (!d.must && d.hold > 2.4) talkClose();
  }
}
function talkTap() {
  const d = talk;
  if (!d) return;
  const txt = d.pages[d.pi];
  if (d.ci < txt.length) {
    d.ci = txt.length;
    return;
  }
  d.hold = 0;
  if (d.pi < d.pages.length - 1) {
    d.pi++;
    d.ci = 0;
  } else talkClose();
}
tkEl.addEventListener("click", talkTap);
function showOv(title, sub, row, btn, canRevive) {
  rsBtn.style.display = "none";
  achBtn.style.display = "none";
  gfxBtn.style.display = "none";
  cityBtn.style.display = "none";
  jrBtn.style.display = "none";
  cuBtn.style.display = "none";
  dlBtn.style.display = "none";
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
  jrStart = 0;
  dailyOff();
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
  jrBtn.style.display = "block";
  dlBtn.style.display = "block";
  dlBtn.textContent = T("dlBtn") + (dailyToday() ? "  ✔" : "");
  cuBtn.style.display = "block";
  cuBtn.textContent = T("cuBtn") + "  " + cu.c.reduce((a, b) => a + b, 0) + "/" + CU.length * CU_AT.length;
  jrBtn.textContent = T("jrBtn") + "  " + jrCount() + "/" + QUEST.length;
  cityBtn.style.display = "block";
  cityBtn.textContent = T("cityBtn") + "  " + cityCount() + "/" + CITY.length;
  achBtn.style.display = "block";
  achBtn.textContent =
    T("achBtn") +
    "  " +
    ACHS.filter((a) => AU[a[0]]).length +
    "/" +
    ACHS.length;
  $("ov").classList.toggle("show", state === "ready");
}
function cityOv() {
  ovMode = "city";
  const n = cityCount(),
    rows = CITY.map((c, i) => {
      const ok = cityBuilt[i],
        can = wallet >= c.cost,
        nm = c.n[LG] || c.n.en,
        city = THEMES[i].name;
      return `<div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;font:600 11px Inter,sans-serif;padding:6px 0;color:${ok ? "#7ffcb0" : "#c8cdf0"}"><span><b>${ok ? "🏛 " : "🧱 "}${nm}</b><br><span style="font-weight:500;color:#8c93b8">${city}</span></span>${ok ? `<span>${T("cityDone")}</span>` : `<button type="button" data-b="${i}" style="width:auto;padding:8px 12px;font-size:11px;${can ? "" : "opacity:.45;"}background:linear-gradient(90deg,#ffd84f,#ff9a3c);color:#3a2200">${T("cityBuild")} · ${c.cost}</button>`}</div>`;
    }).join("");
  showOv(
    T("cityTitle"),
    T("cityHint") +
      "<br><b style='color:#ffd84f'>" +
      T("cityBonus").replace("{n}", n).replace("{p}", n * 5) +
      "</b>",
    `<div class="pill"><small>${T("coins")}</small><span class="coin"></span>${wallet}</div>` + rows,
    T("back2"),
    false,
  );
}
function jrOv() {
  ovMode = "jr";
  const rows = QUEST.map((q, i) => {
    const ok = jrUnlocked(i),
      b = jr.best[i];
    return `<div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;font:600 11px Inter,sans-serif;padding:6px 0;color:${ok ? "#c8cdf0" : "#6b7299"}"><span><b>${b > 0 ? "✔ " : ok ? "📍 " : "🔒 "}${cityName(i)}</b><br><span style="font-weight:500;color:#8c93b8">${ok ? questName(i) : T("jrLocked")}</span>${b > 0 ? `<br><span style="color:#ffd84f">${starStr(b)}</span>` : ""}</span>${ok ? `<button type="button" data-j="${i}" style="width:auto;padding:8px 12px;font-size:11px;background:linear-gradient(90deg,#7fe6ff,#5b8cff);color:#04122a">${T("jrGo")}</button>` : ""}</div>`;
  }).join("");
  showOv(T("jrTitle"), T("jrHint"), rows, T("back2"), false);
}
function cuOv() {
  ovMode = "cu";
  const rows = CU.map((c, i) => {
    const t = cu.t[i],
      n = cu.c[i],
      nx = CU_AT[n],
      hearts = "♥".repeat(Math.min(t, 15)),
      chs = c.ch
        .map((_, j) => (j < n ? `<div style="margin-top:4px;color:#e6e9ff">“${cuText(i, j)}”</div>` : `<div style="margin-top:4px;color:#6b7299">🔒 ${CU_AT[j]} ♥</div>`))
        .join("");
    return `<div style="width:100%;text-align:left;font:600 11px Inter,sans-serif;padding:7px 0;color:#c8cdf0"><div style="display:flex;justify-content:space-between"><b>${c.e} ${cuName(i)}</b><span style="color:#ffa8d4">${t}${nx ? " / " + nx : ""} ♥</span></div>${chs}</div>`;
  }).join("");
  showOv(T("cuTitle"), T("cuHint"), rows, T("back2"), false);
}
function dailyOv() {
  ovMode = "dl";
  const t = dailyToday(),
    ks = Object.keys(dl.days).sort().reverse().slice(0, 7),
    rows = ks
      .map((k) => `<div style="width:100%;display:flex;justify-content:space-between;gap:8px;font:600 11px Inter,sans-serif;padding:4px 0;color:${k === dKey() ? "#ffb35c" : "#c8cdf0"}"><span>${k}</span><span>📦 ${dl.days[k].deliv}</span><span>${dl.days[k].rate ? starStr(Math.round(dl.days[k].rate)) : ""}</span><b>${dl.days[k].score}</b></div>`)
      .join("");
  showOv(
    T("dlTitle"),
    "<b>" + dKey() + "</b><br>" + T("dlHint"),
    `<div class="pill"><small>${T("dlToday")}</small>${t ? t.score : "—"}</div><div class="pill"><small>🔥 ${T("dlStreak")}</small>${dailyStreak()}</div>` +
      `<div style="width:100%;text-align:left;margin-top:6px"><div style="font:700 9px Orbitron,sans-serif;letter-spacing:1.5px;color:#8c93b8;margin-bottom:4px">${T("dlBoard")}</div>${rows || `<div style="font:500 11px Inter,sans-serif;color:#6b7299">${T("dlNone")}</div>`}</div>`,
    T("dlGo"),
    false,
  );
  rsBtn.style.display = "block";
  rsBtn.textContent = "📋 " + T("dlShare");
  rvBtn.style.display = "block";
  rvBtn.textContent = T("back2");
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
  LT.best = Math.max(LT.best, Math.floor(pz - startZ));
  saveLT();
  checkAch();
  bustT = 0;
  sfx.bust();
  vib([80, 40, 120]);
  shakeT = 0.5;
  vy = 4;
  const nb = bank(),
    d = scoreNow(),
    dr = DAILY.on ? dailySave(d, CR.n, CR.n ? (CR.rsum || 0) / CR.n : 0) : null;
  if (dr && dr.bonus) {
    wallet += dr.bonus;
    store.set("zr_wallet", wallet);
  }
  setTimeout(() => {
    if (state !== "over") return;
    const extra =
      doneMsgs
        .map(
          (q) => `<br><b style="color:#7ffcb0">✔ ${T("missionDone")} +100</b>`,
        )
        .join("") +
      (lvlMsg ? `<br><b style="color:#ffd84f">${lvlMsg}</b>` : "") +
      (CR.n ? `<br><b style="color:#7ffcb0">📦 ${T("cDelivSum")}: ${CR.n}  (+${CR.earned})</b>` : "") +
      (LT.rateN ? `<br><b style="color:#ffd84f">${T("rating")}: ${starStr(Math.round(LT.rateSum / LT.rateN))}</b>` : "") +
      (dr ? `<br><b style="color:#ffb35c">📅 ${T("dlRun").replace("{b}", dr.best)}${dr.bonus ? " · " + T("dlBonus") : ""}</b>` : "");
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
  if (ovMode === "dl") return menu();
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
  else if (ovMode === "dl") {
    jrStart = 0;
    dailyArm();
    start();
  } else if (ovMode === "ach" || ovMode === "city" || ovMode === "jr" || ovMode === "cu") menu();
  else start();
});
rsBtn.addEventListener("click", () => {
  if (ovMode === "dl") {
    const txt = dailyShareText();
    try {
      navigator.clipboard.writeText(txt).then(
        () => (rsBtn.textContent = "✔ " + T("dlCopied")),
        () => (rsBtn.textContent = txt.replace(/\n/g, "  ")),
      );
    } catch (e) {
      rsBtn.textContent = txt.replace(/\n/g, "  ");
    }
    return;
  }
  paused = false;
  try {
    AC && AC.resume();
  } catch (e) {}
  start();
});
achBtn.addEventListener("click", achOv);
cityBtn.addEventListener("click", cityOv);
dlBtn.addEventListener("click", dailyOv);
jrBtn.addEventListener("click", jrOv);
cuBtn.addEventListener("click", cuOv);
$("oRow").addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-j]");
  if (!b || ovMode !== "jr") return;
  const i = +b.dataset.j;
  if (!jrUnlocked(i)) return;
  jrStart = i;
  start();
});
$("oRow").addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-b]");
  if (!b || ovMode !== "city") return;
  if (cityBuy(+b.dataset.b)) {
    sfx.zumary();
    cityOv();
  } else sfx.hit();
});
gfxBtn.addEventListener("click", () => {
  cycleGfx();
  gfxLabel();
});
