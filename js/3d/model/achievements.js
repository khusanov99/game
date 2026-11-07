/* model/achievements.js — Lifetime statistics and the achievement list. */
"use strict";
/* ---------- achievements, lifetime stats ---------- */
const LT = Object.assign(
    {
      runs: 0,
      best: 0,
      flips: 0,
      dashes: 0,
      coins: 0,
      chain: 0,
      scoot: 0,
      close: 0,
      letters: 0,
      smash: 0,
      deliv: 0,
    },
    store.get("zr3d_lt", {}),
  ),
  AU = store.get("zr3d_ach", {});
const ACHS = [
  ["first", () => LT.runs >= 1, 20],
  ["marathon", () => LT.best >= 2000, 100],
  ["flip", () => LT.flips >= 25, 60],
  ["dash", () => LT.dashes >= 20, 60],
  ["coin", () => LT.coins >= 1000, 100],
  ["combo", () => LT.chain >= 40, 80],
  ["scoot", () => LT.scoot >= 5, 50],
  ["close", () => LT.close >= 30, 70],
  ["zumary", () => LT.letters >= 1, 120],
  ["smash", () => LT.smash >= 30, 70],
];
function checkAch() {
  let any = false;
  for (const [id, ok, r] of ACHS)
    if (!AU[id] && ok()) {
      AU[id] = 1;
      wallet += r;
      any = true;
      floatText("🏅 " + T("ach_" + id + "_n") + "  +" + r, "#ffd84f");
      sfx.zumary();
      vib([30, 30, 60]);
    }
  if (any) {
    store.set("zr3d_ach", AU);
    store.set("zr_wallet", wallet);
    store.set("zr3d_lt", LT);
  }
}
const saveLT = () => store.set("zr3d_lt", LT);
