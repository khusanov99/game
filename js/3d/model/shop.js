/* model/shop.js — Courier shop: delivery-bag designs, outfit colours, headwear and rides, bought with coins.
   Owned items and the equipped loadout are saved; PVW is the "try before you buy" override used by the 3D shop view. */
"use strict";
const SHOP_TABS = ["bag", "outfit", "hat", "ride"],
  SHOP_TN = {
    bag: { uz: "SUMKA", en: "BAG", ja: "バッグ" },
    outfit: { uz: "KIYIM", en: "OUTFIT", ja: "ウェア" },
    hat: { uz: "BOSH KIYIM", en: "HEADWEAR", ja: "帽子" },
    ride: { uz: "TRANSPORT", en: "RIDE", ja: "乗り物" },
  },
  SHOP_UI = {
    title: { uz: "🛍 DO'KON", en: "🛍 SHOP", ja: "🛍 ショップ" },
    btn: { uz: "🛍 DO'KON", en: "🛍 SHOP", ja: "🛍 ショップ" },
    buy: { uz: "SOTIB OLISH", en: "BUY", ja: "購入" },
    equip: { uz: "TANLASH", en: "EQUIP", ja: "装備" },
    on: { uz: "✔ KIYILGAN", en: "✔ EQUIPPED", ja: "✔ 装備中" },
    need: { uz: "TANGA YETMAYDI", en: "NOT ENOUGH COINS", ja: "コイン不足" },
    free: { uz: "BEPUL", en: "FREE", ja: "無料" },
    back: { uz: "◀ ORQAGA", en: "◀ BACK", ja: "◀ 戻る" },
    drag: { uz: "Aylantirish uchun suring", en: "Drag to rotate", ja: "ドラッグで回転" },
    rideNote: {
      uz: "Transport «Skuter» kuchaytirgichi vaqtida chiqadi",
      en: "Your ride shows up during the Scooter power-up",
      ja: "スクーターのパワーアップ中に登場します",
    },
  },
  SHOP = {
    bag: [
      { id: "classic", cost: 0, a: [1, 0.5, 0.1], b: [0.78, 0.3, 0.05], c: [1, 0.85, 0.5], n: { uz: "Klassik to'q sariq", en: "Classic Orange", ja: "クラシック" } },
      { id: "ikat", cost: 150, a: [0.08, 0.62, 0.72], b: [0.04, 0.38, 0.5], c: [1, 0.85, 0.3], n: { uz: "Toshkent ikat", en: "Tashkent Ikat", ja: "タシケント絣" } },
      { id: "sakura", cost: 200, a: [1, 0.56, 0.76], b: [0.86, 0.3, 0.56], c: [1, 1, 1], n: { uz: "Sakura", en: "Sakura", ja: "さくら" } },
      { id: "night", cost: 250, a: [0.1, 0.12, 0.22], b: [0.04, 0.05, 0.12], c: [0.2, 0.9, 1], n: { uz: "Tungi metro", en: "Night Metro", ja: "夜のメトロ" } },
      { id: "neon", cost: 300, a: [0.72, 0.25, 1], b: [0.42, 0.1, 0.8], c: [0.3, 1, 0.9], n: { uz: "Neon", en: "Neon", ja: "ネオン" } },
      { id: "gold", cost: 500, a: [1, 0.8, 0.25], b: [0.72, 0.5, 0.08], c: [1, 1, 0.9], n: { uz: "Oltin Registon", en: "Golden Registan", ja: "ゴールド" } },
    ],
    outfit: [
      { id: "default", cost: 0, sw: "#1f6bff", n: { uz: "Moviy kuryer", en: "Blue Courier", ja: "ブルー" } },
      { id: "rose", cost: 200, sw: "#ff4fa8", n: { uz: "Pushti kuryer", en: "Rose Courier", ja: "ローズ" } },
      { id: "mint", cost: 200, sw: "#17c28c", n: { uz: "Yashil kuryer", en: "Mint Courier", ja: "ミント" } },
      { id: "gold", cost: 400, sw: "#ff9a14", n: { uz: "Oltin kuryer", en: "Gold Courier", ja: "ゴールド" } },
    ],
    hat: [
      { id: "none", cost: 0, e: "🦆", n: { uz: "Boshi ochiq", en: "No hat", ja: "なし" } },
      { id: "cap", cost: 120, e: "🧢", n: { uz: "Kuryer kepkasi", en: "Courier Cap", ja: "キャップ" } },
      { id: "doppi", cost: 220, e: "🎓", n: { uz: "Do'ppi", en: "Doppi", ja: "ドッピ" } },
      { id: "helmet", cost: 280, e: "⛑", n: { uz: "Xavfsizlik shlemi", en: "Safety Helmet", ja: "ヘルメット" } },
      { id: "crown", cost: 700, e: "👑", n: { uz: "Oltin toj", en: "Golden Crown", ja: "王冠" } },
    ],
    ride: [
      { id: "scooter", cost: 0, e: "🛴", n: { uz: "Klassik skuter", en: "Classic Scooter", ja: "スクーター" } },
      { id: "scoot2", cost: 300, e: "🛴", n: { uz: "Neon skuter", en: "Neon Scooter", ja: "ネオンスクーター" } },
      { id: "bike", cost: 400, e: "🚲", n: { uz: "Velosiped", en: "Bicycle", ja: "自転車" } },
      { id: "bike2", cost: 800, e: "🚲", n: { uz: "Oltin velosiped", en: "Golden Bicycle", ja: "ゴールド自転車" } },
      { id: "car", cost: 1200, e: "🚗", n: { uz: "Oq sedan", en: "White Sedan", ja: "白いセダン" } },
      { id: "van", cost: 1500, e: "🚐", n: { uz: "Yetkazib berish miniveni", en: "Delivery Mini Van", ja: "配達ミニバン" } },
    ],
  };
const shT = (k) => (SHOP_UI[k] || {})[LG] || (SHOP_UI[k] || {}).en || k,
  shN = (it) => it.n[LG] || it.n.en;
let shOwn = (() => {
    const o = store.get("zr_shop", null);
    return o && typeof o === "object" ? o : {};
  })(),
  shEq = (() => {
    const e = store.get("zr_eq", null) || {};
    return { bag: e.bag || "classic", outfit: store.get("zr_skin", "default"), hat: e.hat || "none", ride: e.ride || "scooter" };
  })(),
  PVW = null;
function shItem(tab, id) {
  return SHOP[tab].find((x) => x.id === id) || SHOP[tab][0];
}
const shOwned = (tab, id) => shItem(tab, id).cost === 0 || (shOwn[tab] || []).includes(id) || (tab === "outfit" && id === shEq.outfit);
/* what the hero wears right now: the shop's preview first, then the equipped loadout */
const ldv = (tab) => (PVW && PVW[tab]) || shEq[tab];
function shSave() {
  store.set("zr_shop", shOwn);
  store.set("zr_eq", { bag: shEq.bag, hat: shEq.hat, ride: shEq.ride });
  store.set("zr_skin", shEq.outfit);
}
function shBuy(tab, id) {
  const it = shItem(tab, id);
  if (shOwned(tab, id)) return true;
  if (wallet < it.cost) return false;
  wallet -= it.cost;
  store.set("zr_wallet", wallet);
  (shOwn[tab] = shOwn[tab] || []).push(id);
  shSave();
  return true;
}
function shEquip(tab, id) {
  if (!shOwned(tab, id)) return false;
  shEq[tab] = id;
  if (tab === "outfit") skin = id;
  shSave();
  return true;
}
