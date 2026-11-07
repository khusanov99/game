/* model/progress.js — Daily missions, XP and player level. */
"use strict";
/* ---------- daily missions + player level ---------- */
const MPOOL = [
  ["flip", [5, 12]],
  ["dash", [4, 8]],
  ["scoot", [1, 2]],
  ["dist", [1200, 2500]],
  ["jump", [18, 35]],
  ["slide", [14, 28]],
  ["close", [6, 12]],
  ["power", [3, 5]],
  ["letters", [1, 1]],
  ["ramp", [2, 4]],
  ["smash", [4, 8]],
  ["coinsRun", [120, 250]],
  ["deliv", [2, 4]],
];
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function loadMissions() {
  let m = store.get("zr3d_m", null),
    dk = dayKey();
  if (!m || m.d !== dk || !Array.isArray(m.l)) {
    let h = 7;
    for (const ch of dk) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const r = mulberry(h),
      pool = MPOOL.slice(),
      l = [];
    for (let i = 0; i < 3; i++) {
      const [id, ts] = pool.splice(Math.floor(r() * pool.length), 1)[0];
      l.push({ id, t: ts[Math.floor(r() * ts.length)], p: 0, done: false });
    }
    m = { d: dk, l };
    store.set("zr3d_m", m);
  }
  return m;
}
const lvlOf = (xp) => Math.floor(Math.sqrt(xp / 120)) + 1;
let XP = store.get("zr3d_xp", 0);
function bank() {
  // write this run's results into wallet, missions and XP (safe to call more than once: deltas only)
  const dC = coinsGot - bankedCoins;
  bankedCoins = coinsGot;
  wallet += dC;
  const m = loadMissions();
  doneMsgs = [];
  for (const q of m.l) {
    if (q.done) continue;
    const dv =
      q.id === "coinsRun"
        ? Math.max(0, coinsGot - (B0.coinsRunBase || 0))
        : (S[q.id] || 0) - (B0[q.id] || 0);
    q.p =
      q.id === "coinsRun"
        ? Math.max(q.p, Math.min(q.t, coinsGot))
        : q.p + Math.max(0, dv);
    if (q.p >= q.t) {
      q.done = true;
      q.p = q.t;
      wallet += 100;
      doneMsgs.push(q);
    }
  }
  for (const k of Object.keys(S)) B0[k] = S[k];
  store.set("zr3d_m", m);
  const before = lvlOf(XP);
  XP += Math.floor(scoreNow() / 30) - (B0.xpGiven || 0);
  B0.xpGiven = Math.floor(scoreNow() / 30);
  store.set("zr3d_xp", XP);
  const after = lvlOf(XP);
  lvlMsg = "";
  if (after > before) {
    wallet += 50 * after;
    lvlMsg = T("lvlUp") + " " + after + "  +" + 50 * after;
  }
  store.set("zr_wallet", wallet);
  const sc = scoreNow();
  if (sc > best) {
    best = sc;
    store.set("zr3d3_best", best);
    return true;
  }
  return false;
}
const missionText = (q) => T("m_" + q.id).replace("{n}", q.t);

function reset() {
  startZ = jrStart * THEME_LEN;
  pz = startZ;
  px = 0;
  py = 0;
  vy = 0;
  lane = 1;
  speed = SPEED0 + Math.min(8, jrStart * 1.6);
  slideT = 0;
  tilt = 0;
  coinsGot = 0;
  hits = 0;
  hitT = 0;
  invul = 0;
  bustT = 0;
  stumbleT = 0;
  gap = 11.5;
  camX = 0;
  objs = [];
  while (sparks.length) SPARK_POOL.push(sparks.pop());
  floaties = [];
  nextSpawn = startZ + 55;
  RUNSEED = DAILY.on ? DAILY.seed : (Math.random() * 1e9) | 0;
  if (DAILY.on) DAILY.rng = mulberry32(DAILY.seed);
  courReset();
  evReset();
  coinHud = 0;
  bonus = 0;
  mult = 1;
  chain = 0;
  chainT = 0;
  mag = shield = turbo = dbl = jet = padB = 0;
  jetK = 0;
  lastTheme = themeAt(startZ);
  dash = 0;
  energy = 60;
  scoot = 0;
  slow = 0;
  air2 = true;
  trick = false;
  flipT = 0;
  flipSpin = false;
  landT = 0;
  wingK = 0.15;
  fovK = slowK = 0;
  camRoll = camDip = 0;
  hitStop = 0;
  resumeCd = 0;
  nextLetter = 0;
  floorY = lastFloor = 0;
  revived = false;
  heli = null;
  nextHeli = startZ + 650;
  lit = 0;
  bankedCoins = 0;
  S = newStats();
  B0 = newStats();
  B0.coinsRunBase = 0;
  B0.xpGiven = 0;
  resetCity(startZ);
  ensureCity(startZ, 1e9);
}
