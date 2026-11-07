/* model/courier.js — Courier orders, police heat (chase) and city rebuilding (landmarks, permanent coin bonus). */
"use strict";
/* ---------- city rebuilding (permanent) ---------- */
const CITY = [
  { cost: 400, n: { uz: "Teleminora", en: "TV Tower", ja: "テレビ塔" } },
  { cost: 700, n: { uz: "Registon", en: "Registan", ja: "レギスタン" } },
  { cost: 900, n: { uz: "Minorai Kalon", en: "Kalon Minaret", ja: "カロン・ミナレット" } },
  { cost: 1100, n: { uz: "Kalta Minor", en: "Kalta Minor", ja: "カルタ・ミノル" } },
  { cost: 1300, n: { uz: "Ipak saroyi", en: "Silk Palace", ja: "シルク宮殿" } },
  { cost: 1500, n: { uz: "Neon minora", en: "Neon Tower", ja: "ネオンタワー" } },
];
let cityBuilt = store.get("zr3d_city", []);
if (!Array.isArray(cityBuilt) || cityBuilt.length !== CITY.length) cityBuilt = CITY.map(() => 0);
const cityCount = () => cityBuilt.reduce((a, b) => a + (b ? 1 : 0), 0),
  cityMul = () => 1 + 0.05 * cityCount();
function cityBuy(i) {
  if (cityBuilt[i] || wallet < CITY[i].cost) return false;
  wallet -= CITY[i].cost;
  cityBuilt[i] = 1;
  store.set("zr_wallet", wallet);
  store.set("zr3d_city", cityBuilt);
  return true;
}
/* the chunk (60 m) that holds theme-local z = 640 becomes a plaza with the landmark once it is built */
function plazaOf(ci) {
  const zc = ci * CH + CH / 2,
    k = Math.floor(zc / THEME_LEN);
  if (ci !== Math.floor((k * THEME_LEN + 640) / CH)) return -1;
  const th = ((k % THEMES.length) + THEMES.length) % THEMES.length;
  return cityBuilt[th] ? th : -1;
}
/* ---------- courier ---------- */
let CR = { st: "find", at: 120, n: 0, streak: 0, tLeft: 0, tMax: 1, earned: 0, drop: null, pkg: null },
  heat = 0,
  coinFrac = 0;
function courReset() {
  CR = { st: "find", at: 120, n: 0, streak: 0, tLeft: 0, tMax: 1, earned: 0, drop: null, pkg: null };
  heat = 0;
  coinFrac = 0;
}
const NOBLOCK = { coin: 1, pow: 1, let: 1, pkg: 1, drop: 1, pad: 1, ramp: 1 };
/* keep the pickup / drop-off lane free of obstacles */
function courClear() {
  for (const t of [CR.pkg, CR.drop])
    if (t && !t.got)
      for (const o of objs)
        if (!o.dead && !NOBLOCK[o.k] && Math.abs(o.x - t.x) < 1.3 && o.z - 1 < t.z + 5 && o.z + (o.len || 0) > t.z - 6) o.dead = true;
}
function courTouch(o) {
  o.got = true;
  if (o.k === "pkg") {
    const dist = 230 + rnd(0, 90),
      l = (Math.random() * 3) | 0;
    CR.st = "carry";
    CR.pkg = null;
    CR.tMax = CR.tLeft = (dist / Math.max(speed, SPEED0)) * 1.15 + 4;
    CR.drop = { k: "drop", x: LX[l], z: pz + dist, len: 3 };
    objs.push(CR.drop);
    courClear();
    floatText(T("cPick"), "#ffd84f");
    sfx.pow();
    burst(o.x, o.y, o.z, 14, "#ffd84f", 4);
    return;
  }
  const late = CR.tLeft < 0,
    base = 18 + Math.min(CR.streak, 6) * 4,
    reward = late ? Math.round(base / 2) : base + Math.round(clamp(CR.tLeft / CR.tMax, 0, 1) * 20);
  coinsGot += reward;
  LT.coins += reward;
  bonus += reward * 15;
  S.deliv++;
  LT.deliv = (LT.deliv || 0) + 1;
  CR.n++;
  CR.earned += reward;
  CR.streak = late ? 0 : CR.streak + 1;
  heat = Math.max(0, heat - 20);
  energy = Math.min(100, energy + 15);
  floatText((late ? T("cLate") : T("cDeliv")) + " +" + reward, late ? "#ffb36b" : "#7ffcb0");
  sfx.zumary();
  burst(o.x, 1.5, o.z, 24, "#7ffcb0", 6);
  CR.st = "find";
  CR.drop = null;
  CR.at = pz + 110;
}
function courUpdate(dt) {
  if (CR.st === "find") {
    if (!CR.pkg && pz + 120 >= CR.at) {
      CR.pkg = { k: "pkg", x: LX[(Math.random() * 3) | 0], z: Math.max(CR.at, pz + 120), y: 1.1, len: 0 };
      objs.push(CR.pkg);
      courClear();
    } else if (CR.pkg && !CR.pkg.got && CR.pkg.z < pz - 3) {
      CR.pkg = null;
      CR.at = pz + 140;
      floatText(T("cMissPkg"), "#ff9a9a");
    }
  } else {
    CR.tLeft -= dt;
    if (CR.drop && !CR.drop.got && CR.drop.z < pz - 3) {
      CR.drop = null;
      CR.st = "find";
      CR.at = pz + 130;
      CR.streak = 0;
      floatText(T("cMiss"), "#ff6b84");
    }
  }
  /* police heat: rises over distance, coins and deliveries cool it; at 100 the patrol catches up (a hit) */
  if (pz > 250) {
    heat += dt * (1.6 + clamp(pz / 2600, 0, 1) * 1.2) * (jet > 0 || invul > 1 ? 0.3 : 1);
    if (heat >= 100) {
      heat = 62;
      floatText(T("cCaught"), "#ff6b84");
      hurt(null);
    }
  }
}
