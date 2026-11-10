/* controller/settings-ui.js — Settings screen (sound volume, vibration, graphics) and the first-run controls hint. */
"use strict";
const SET_UI = {
  btn: { uz: "⚙ SOZLAMALAR", en: "⚙ SETTINGS", ja: "⚙ 設定" },
  title: { uz: "SOZLAMALAR", en: "SETTINGS", ja: "設定" },
  vol: { uz: "OVOZ", en: "SOUND", ja: "音量" },
  vib: { uz: "TEBRANISH", en: "VIBRATION", ja: "振動" },
  on: { uz: "YOQILGAN", en: "ON", ja: "オン" },
  off: { uz: "O'CHIRILGAN", en: "OFF", ja: "オフ" },
  gfx: { uz: "GRAFIKA", en: "GRAPHICS", ja: "画質" },
  ana: { uz: "ANONIM STATISTIKA", en: "ANONYMOUS STATS", ja: "匿名の統計" },
  tut: { uz: "Qanday o'ynaladi", en: "How to play", ja: "遊び方" },
  tutM: { uz: "Yon tomonga suring: yo'lakni almashtirish", en: "Swipe sideways: change lane", ja: "横にスワイプ：レーン移動" },
  tutJ: { uz: "Tepaga suring: sakrash", en: "Swipe up: jump", ja: "上にスワイプ：ジャンプ" },
  tutS: { uz: "Pastga suring: sirpanish", en: "Swipe down: slide", ja: "下にスワイプ：スライド" },
};
const sT = (k) => (SET_UI[k] || {})[LG] || (SET_UI[k] || {}).en || k;
const setBtn = document.createElement("button");
setBtn.id = "setb";
setBtn.type = "button";
setBtn.style.cssText = "display:none;background:rgba(200,205,240,.08);color:#c8cdf0;border:1px solid rgba(200,205,240,.3);font-size:12px;padding:12px";
$("go").after(setBtn);
const VOLS = [0, 0.35, 0.7, 1];
function setOv() {
  ovMode = "set";
  const chip = (on, attr, txt) =>
    `<button ${attr} style="display:inline-block;width:auto;margin:0;padding:10px 12px;border-radius:12px;font:800 11px Orbitron,sans-serif;${on ? "background:#7fe6ff;color:#06121d" : "background:rgba(255,255,255,.08);color:#c8cdf0"}">${txt}</button>`;
  const row = (label, chips) =>
    `<div style="width:100%;margin:6px 0"><div style="font:700 9px Orbitron,sans-serif;letter-spacing:1.5px;color:#8c93b8;margin-bottom:6px;text-align:left">${label}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div></div>`;
  showOv(
    sT("title"),
    "",
    row(sT("vol"), VOLS.map((v) => chip(Math.abs(VOL - v) < 0.01, `data-v="${v}"`, Math.round(v * 100) + "%")).join("")) +
      row(sT("vib"), chip(VIBON, 'data-vb="1"', sT("on")) + chip(!VIBON, 'data-vb="0"', sT("off"))) +
      row(sT("ana"), chip(anaOn, 'data-an="1"', sT("on")) + chip(!anaOn, 'data-an="0"', sT("off"))),
    T("back2"),
    false,
  );
  gfxBtn.style.display = "block";
  gfxLabel();
}
setBtn.addEventListener("click", setOv);
$("oRow").addEventListener("click", (e) => {
  if (ovMode !== "set") return;
  const b = e.target.closest && e.target.closest("[data-v],[data-vb],[data-an]");
  if (!b) return;
  if (b.dataset.an !== undefined) {
    anaOn = b.dataset.an === "1";
    store.set("zr3d_ana", anaOn);
    return setOv();
  }
  if (b.dataset.v !== undefined) {
    setVol(+b.dataset.v);
    sfx.coin();
  } else {
    VIBON = b.dataset.vb === "1";
    store.set("zr3d_vib", VIBON);
    if (VIBON) vib(40);
  }
  setOv();
});
/* first-run hint: three arrows over the road until the player has changed lane, jumped and slid (or after 12 s) */
const tutEl = document.createElement("div");
tutEl.style.cssText =
  "position:fixed;left:50%;top:46%;transform:translateX(-50%);z-index:20;display:none;pointer-events:none;text-align:center;font:700 13px Inter,'Hiragino Sans',sans-serif;color:#fff;background:rgba(10,12,30,.78);border:1.5px solid rgba(127,230,255,.45);border-radius:16px;padding:12px 16px;width:min(86vw,320px);line-height:1.8";
document.body.appendChild(tutEl);
let tutOn = false,
  tutDone = store.get("zr3d_tut", false),
  tutSeen = {},
  tutT = 0;
function tutStart() {
  if (tutDone || tutOn) return;
  tutOn = true;
  tutSeen = {};
  tutT = 0;
  tutRender();
  tutEl.style.display = "block";
}
function tutRender() {
  const r = (k, a, t) => `<div style="opacity:${tutSeen[k] ? 0.35 : 1};text-decoration:${tutSeen[k] ? "line-through" : "none"}">${a} ${t}</div>`;
  tutEl.innerHTML = `<div style="font:800 11px Orbitron,sans-serif;letter-spacing:1.5px;color:#7fe6ff;margin-bottom:4px">${sT("tut")}</div>` + r("m", "↔", sT("tutM")) + r("j", "⬆", sT("tutJ")) + r("s", "⬇", sT("tutS"));
}
function tutEnd() {
  tutOn = false;
  tutDone = true;
  if (tutSeen.m && tutSeen.j && tutSeen.s) track("tutorial", {});
  store.set("zr3d_tut", true);
  tutEl.style.display = "none";
}
function tutDo(k) {
  if (!tutOn || tutSeen[k]) return;
  tutSeen[k] = true;
  tutRender();
  if (tutSeen.m && tutSeen.j && tutSeen.s) setTimeout(tutEnd, 700);
}
function tutTick(dt) {
  if (!tutOn) return;
  tutT += dt;
  if (tutT > 14 || state !== "play") tutEnd();
}
/* game-over screen: every menu shortcut first returns to the start screen, then opens its section (wired here because these buttons are created in later scripts) */
for (const [b, , fn] of overBtns())
  b.addEventListener(
    "click",
    (e) => {
      if (state !== "over") return;
      e.stopImmediatePropagation();
      toMenu(fn);
    },
    true,
  );
