/* model/daily.js — Daily run: one seed per calendar day (same city order, metro position, weather, obstacle patterns and parcel lanes
   for everybody), a per-day best, a streak and a shareable result. Scores are kept on this device. */
"use strict";
const DAILY = { on: false, seed: 0, rng: null, key: "" };
const dKey = (d) => {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailyArm() {
  DAILY.on = true;
  DAILY.key = dKey();
  let h = 2166136261;
  for (const c of "zumary-" + DAILY.key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  DAILY.seed = (h >>> 0) % 1000000000;
}
const dailyOff = () => (DAILY.on = false);
/* the random numbers that shape the route come from the day's generator; everything else (particles, visuals) stays free */
const RNG = () => (DAILY.on && DAILY.rng ? DAILY.rng() : Math.random());
function sr(fn) {
  if (!DAILY.on || !DAILY.rng) return fn();
  const o = Math.random;
  Math.random = DAILY.rng;
  try {
    return fn();
  } finally {
    Math.random = o;
  }
}
let dl = store.get("zr3d_daily", null);
if (!dl || typeof dl.days !== "object") dl = { days: {} };
const dailyToday = () => dl.days[dKey()] || null;
function dailyStreak() {
  let n = 0;
  const d = new Date();
  if (!dl.days[dKey(d)]) d.setDate(d.getDate() - 1);
  while (dl.days[dKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
/* called when a daily run ends; returns {best, isBest, bonus} */
function dailySave(score, deliv, rate) {
  const k = DAILY.key || dKey(),
    old = dl.days[k],
    isBest = !old || score > old.score,
    bonus = !old && deliv >= 1 ? 300 : 0;
  dl.days[k] = { score: Math.max(score, old ? old.score : 0), deliv: Math.max(deliv, old ? old.deliv : 0), rate: isBest ? rate : old.rate, runs: (old ? old.runs : 0) + 1, gift: !!(bonus || (old && old.gift)) };
  const keys = Object.keys(dl.days).sort();
  while (keys.length > 30) delete dl.days[keys.shift()];
  store.set("zr3d_daily", dl);
  return { best: dl.days[k].score, isBest, bonus };
}
function dailyShareText() {
  const t = dailyToday() || { score: 0, deliv: 0, rate: 0 };
  return "ZUMARY Run 📅 " + dKey() + "\n🏁 " + t.score + "  📦 " + t.deliv + (t.rate ? "  " + starStr(Math.round(t.rate)) : "") + "\n🔥 " + dailyStreak();
}
