/* controller/shop-ui.js — Shop screen: the 3D hero stays on its podium (camera sways round it, drag to turn it) and a bottom sheet
   lists the items of the chosen tab. Tapping an item previews it on the hero at once; buy / equip with the big button. */
"use strict";
const shopBtn = document.createElement("button");
shopBtn.id = "shopb";
shopBtn.type = "button";
shopBtn.style.cssText = "display:none;background:rgba(255,216,79,.12);color:#ffd84f;border:1px solid rgba(255,216,79,.45);font-size:12px;padding:12px";
$("go").after(shopBtn);
const shEl = document.createElement("div");
shEl.id = "shop";
shEl.style.cssText = "position:fixed;inset:0;z-index:25;display:none;pointer-events:none;font:600 12px Inter,'Hiragino Sans',sans-serif;color:#fff;user-select:none;-webkit-user-select:none";
document.body.appendChild(shEl);
let shSel = null; // item id selected (previewed) in the current tab
const btnCss = "display:inline-block;width:auto;margin:0;";
function shRender() {
  const items = SHOP[shTab],
    cur = shSel || ldv(shTab),
    it = shItem(shTab, cur),
    owned = shOwned(shTab, it.id),
    eqd = shEq[shTab] === it.id,
    afford = wallet >= it.cost;
  const tabs = SHOP_TABS.map(
    (t) =>
      `<button data-t="${t}" style="${btnCss}padding:9px 11px;border-radius:12px;font:800 10px Orbitron,sans-serif;letter-spacing:1px;pointer-events:auto;${t === shTab ? "background:#ffd84f;color:#1a1200" : "background:rgba(255,255,255,.08);color:#c8cdf0"}">${SHOP_TN[t][LG] || SHOP_TN[t].en}</button>`,
  ).join("");
  const cards = items
    .map((x) => {
      const on = x.id === it.id,
        ow = shOwned(shTab, x.id),
        ic =
          shTab === "bag" || shTab === "outfit"
            ? `<span style="display:block;width:38px;height:38px;border-radius:${shTab === "bag" ? "9px" : "50%"};margin:0 auto 4px;background:${shTab === "bag" ? `linear-gradient(160deg,rgb(${x.a.map((v) => Math.round(v * 255))}) 55%,rgb(${x.b.map((v) => Math.round(v * 255))}))` : x.sw};border:2px solid rgba(255,255,255,.5)"></span>`
            : `<span style="display:block;font-size:30px;line-height:38px;margin-bottom:4px">${x.e}</span>`;
      return `<div data-i="${x.id}" style="flex:0 0 auto;width:92px;padding:8px 6px;border-radius:14px;text-align:center;cursor:pointer;pointer-events:auto;background:${on ? "rgba(255,216,79,.16)" : "rgba(255,255,255,.06)"};border:1.5px solid ${on ? "#ffd84f" : "rgba(255,255,255,.12)"}">${ic}<div style="font:700 10px Inter,sans-serif;line-height:1.2;min-height:24px">${shN(x)}</div><div style="font:800 10px Orbitron,sans-serif;margin-top:3px;color:${shEq[shTab] === x.id ? "#7ffcb0" : ow ? "#8c93b8" : "#ffd84f"}">${shEq[shTab] === x.id ? "✔" : ow ? (x.cost ? "✓" : shT("free")) : "🪙 " + x.cost}</div></div>`;
    })
    .join("");
  const label = eqd ? shT("on") : owned ? shT("equip") : afford ? shT("buy") + "  🪙 " + it.cost : shT("need") + "  🪙 " + it.cost,
    bcol = eqd ? "background:rgba(127,252,176,.2);color:#7ffcb0" : owned || afford ? "background:linear-gradient(90deg,#ffd84f,#ff9a3c);color:#1a1200" : "background:rgba(255,255,255,.1);color:#8c93b8";
  shEl.innerHTML =
    `<div style="position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px))"><button data-x="back" style="${btnCss}pointer-events:auto;padding:10px 14px;border-radius:12px;font:800 11px Orbitron,sans-serif;background:rgba(10,12,30,.7);color:#fff;border:1px solid rgba(255,255,255,.25)">${shT("back")}</button><div style="font:800 13px Orbitron,sans-serif;letter-spacing:2px;text-shadow:0 2px 8px #000">${shT("title")}</div><div class="pill" style="pointer-events:none;padding:7px 12px"><span class="coin"></span> ${wallet}</div></div>` +
    `<div data-drag="1" style="position:absolute;left:0;right:0;top:56px;bottom:230px;pointer-events:auto;touch-action:none"></div>` +
    `<div style="position:absolute;left:50%;transform:translateX(-50%);bottom:max(10px,env(safe-area-inset-bottom,0px));width:min(calc(100vw - 16px),560px);box-sizing:border-box;padding:12px;border-radius:20px;pointer-events:auto;background:rgba(10,12,30,.9);border:1.5px solid rgba(255,216,79,.35);box-shadow:0 8px 30px rgba(0,0,0,.5)">` +
    `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px">${tabs}</div>` +
    `<div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px">${cards}</div>` +
    `<div style="font:700 13px Inter,sans-serif;margin:2px 0 8px;text-align:center">${shN(it)}</div>` +
    `<button data-x="act" style="margin:0;padding:13px;${bcol};font-size:13px">${label}</button>` +
    `<div style="text-align:center;font:500 10px Inter,sans-serif;color:#8c93b8;margin-top:7px">${shTab === "ride" ? shT("rideNote") : shT("drag")}</div></div>`;
}
function shopOpen() {
  ovMode = "shop";
  track("shop", {});
  shOn = true;
  shTab = "bag";
  shSel = null;
  PVW = Object.assign({}, shEq);
  shDrag = 0;
  $("ov").classList.add("hidden");
  shEl.style.display = "block";
  shRender();
}
function shopClose() {
  shOn = false;
  PVW = null;
  shEl.style.display = "none";
  menu();
}
shopBtn.addEventListener("click", shopOpen);
let shPt = null;
shEl.addEventListener("pointerdown", (e) => {
  if (e.target.closest && e.target.closest("[data-drag]")) shPt = { x: e.clientX, d: shDrag };
});
addEventListener("pointermove", (e) => {
  if (shPt) shDrag = shPt.d + (e.clientX - shPt.x) * 0.012;
});
addEventListener("pointerup", () => (shPt = null));
shEl.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-t],[data-i],[data-x]");
  if (!t) return;
  if (t.dataset.t) {
    shTab = t.dataset.t;
    shSel = null;
    shDrag = 0;
    shRender();
  } else if (t.dataset.i) {
    shSel = t.dataset.i;
    PVW[shTab] = shSel;
    shRender();
  } else if (t.dataset.x === "back") shopClose();
  else if (t.dataset.x === "act") {
    const id = shSel || ldv(shTab);
    if (shEq[shTab] === id) return;
    if (!shOwned(shTab, id) && !shBuy(shTab, id)) {
      sfx.hit();
      return;
    }
    shEquip(shTab, id);
    sfx.zumary();
    shRender();
  }
});
