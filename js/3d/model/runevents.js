/* model/runevents.js — Run events: every 400–700 m something different happens, so a run never settles into a loop. */
"use strict";
const EVDEF = {
  shower: { len: [170, 230], col: "#ffe27a", n: { uz: "TANGA YOMG'IRI!", en: "COIN SHOWER!", ja: "コインシャワー！" } },
  gauntlet: { len: [190, 250], col: "#ff8a6b", n: { uz: "TO'SIQLAR YO'LI!", en: "GAUNTLET!", ja: "障害物ゾーン！" } },
  rush: { len: [200, 260], col: "#53f7ff", n: { uz: "TEZLIK ZONASI!", en: "SPEED RUSH!", ja: "スピードラッシュ！" } },
  convoy: { len: [180, 240], col: "#ffb36b", n: { uz: "KONVOY! Bo'sh yo'lni top", en: "CONVOY! Find the gap", ja: "車列！隙間を探せ" } },
  lasers: { len: [170, 220], col: "#ff4d6d", n: { uz: "LEZER TO'RI!", en: "LASER GRID!", ja: "レーザーグリッド！" } },
  zigzag: { len: [170, 230], col: "#b28cff", n: { uz: "SLALOM!", en: "SLALOM!", ja: "スラローム！" } },
  night: { len: [220, 300], col: "#8aa4ff", n: { uz: "TUNGI YUGURISH!", en: "NIGHT RUN!", ja: "ナイトラン！" } },
};
const EVKEYS = Object.keys(EVDEF);
const RUNEV = { cur: null, z0: 0, z1: 0, on: false, next: 520, last: "", prev: "", hit: false, done: 0 };
let rushK = 0,
  nightK = 0;
function evReset() {
  RUNEV.cur = null;
  RUNEV.on = false;
  RUNEV.next = startZ + 520;
  RUNEV.last = RUNEV.prev = "";
  RUNEV.done = 0;
  rushK = nightK = 0;
}
const evAt = (z) => (RUNEV.cur && z >= RUNEV.z0 && z < RUNEV.z1 ? RUNEV.cur : null);
const evName = (k) => EVDEF[k].n[LG] || EVDEF[k].n.en;
function evBusy(a, b) {
  for (let z = a - 80; z <= b + 40; z += 30) if (secAt(z) || forkAt(z) || plazaOf(Math.floor(z / CH)) >= 0) return true;
  return false;
}
function evUpdate() {
  if (!RUNEV.cur) {
    if (pz < RUNEV.next) return;
    const pool = EVKEYS.filter((k) => k !== RUNEV.last && k !== RUNEV.prev),
      k = pick(pool),
      len = rnd(EVDEF[k].len[0], EVDEF[k].len[1]),
      z0 = pz + 150;
    if (evBusy(z0, z0 + len)) {
      RUNEV.next = pz + 60;
      return;
    }
    Object.assign(RUNEV, { cur: k, z0, z1: z0 + len, on: false, hit: false });
  } else if (!RUNEV.on) {
    if (pz >= RUNEV.z0 - 4) {
      RUNEV.on = true;
      floatText(evName(RUNEV.cur), EVDEF[RUNEV.cur].col);
      sfx.heli();
    }
  } else if (pz >= RUNEV.z1) {
    const ok = !RUNEV.hit;
    bonus += ok ? 200 : 100;
    floatText(ok ? T("evOk") : T("evEnd"), ok ? "#7ffcb0" : "#ffe27a");
    if (ok) {
      sfx.zumary();
      energy = Math.min(100, energy + 20);
    }
    RUNEV.done++;
    RUNEV.prev = RUNEV.last;
    RUNEV.last = RUNEV.cur;
    RUNEV.cur = null;
    RUNEV.on = false;
    RUNEV.next = pz + rnd(420, 700);
  }
}
/* patterns inside an event; returns [length used, extra gap] or null for "use the normal patterns" */
function evSpawn(k, z, L, o1, o2) {
  const q = Math.random(),
    sp = Math.max(10, speed * 0.55);
  if (k === "shower") {
    const ph = z * 0.07;
    for (let i = 0; i < 12; i++) {
      const a = Math.round(1 + Math.sin(i * 0.6 + ph)),
        b = Math.round(1 + Math.sin(i * 0.6 + ph + Math.PI));
      coin(a, z + i * 2.2);
      if (i % 2 === 0 && b !== a) coin(b, z + i * 2.2);
    }
    if (q < 0.5) coin(L, z + 13, 1.0, true);
    return [26, 1];
  }
  if (k === "gauntlet") {
    for (let r = 0; r < 2; r++) {
      const f = (Math.random() * 3) | 0,
        zz = z + 8 + r * sp;
      for (let l = 0; l < 3; l++) {
        if (l === f) continue;
        const t = Math.random();
        (t < 0.4 ? low : t < 0.75 ? gate : cone)(l, zz);
      }
      coinLine(f, zz - 5, 6, 1.6);
    }
    return [sp + 14, speed * 0.3];
  }
  if (k === "rush") {
    pad(L, z + 4);
    coinLine(o1, z + 2, 12);
    if (q < 0.4) cone(o2, z + 16);
    return [30, speed * 0.7];
  }
  if (k === "convoy") {
    const a = (Math.random() * 3) | 0,
      b = (a + 1 + ((Math.random() * 2) | 0)) % 3,
      f = 3 - a - b;
    car(a, z + 8, rnd(7, 10));
    car(b, z + 10, rnd(7, 10));
    coinLine(f, z + 2, 10);
    return [30, speed * 0.5];
  }
  if (k === "lasers") {
    laser(z + 8, true);
    coinLine(1, z + 2, 6, 1.4, 0.6);
    laser(z + 8 + sp, false);
    arc(1, z + sp + 2, 7, 1.2, 1.5);
    return [sp + 16, speed * 0.4];
  }
  if (k === "zigzag") {
    const seq = [0, 1, 2, 1, 0, 1, 2],
      st = (Math.random() * 3) | 0;
    for (let r = 0; r < 3; r++) {
      const open = seq[(st + r * 2) % 7],
        zz = z + 6 + r * sp * 0.75;
      for (let l = 0; l < 3; l++) if (l !== open) (r % 2 ? low : cone)(l, zz);
      coinLine(open, zz - 4, 5, 1.5);
    }
    return [sp * 1.6 + 8, speed * 0.3];
  }
  return null; // night: normal patterns in the dark
}
/* extra everyday patterns so single patterns do not repeat quickly */
function extraPattern(z, L, o1, o2) {
  const q = Math.random();
  if (q < 0.17) {
    const s = [0, 1, 2, 1];
    for (let i = 0; i < 14; i++) coin(s[i % 4], z + i * 2);
    gate(L, z + 32);
    return 36;
  } else if (q < 0.34) {
    gate(L, z + 8);
    low(L, z + 17);
    gate(L, z + 26);
    coinLine(o1, z, 12, 2.4);
    coinLine(o2, z + 4, 9, 2.4);
    return 34;
  } else if (q < 0.5) {
    ramp(L, z + 6);
    pit(L, z + 24);
    for (let i = 0; i < 9; i++) {
      const t = (i * 1.9) / 21;
      coin(L, z + 12 + i * 1.9, Math.max(1.0, 1.4 + 10.5 * t - 14 * t * t));
    }
    coinLine(o1, z + 2, 10);
    return 40;
  } else if (q < 0.65) {
    for (let i = 0; i < 4; i++) {
      coin(0, z + i * 2.2);
      coin(2, z + i * 2.2);
      coin(1, z + 8.8 + i * 2.2);
    }
    coin(1, z + 20, 1.0, true);
    return 26;
  } else if (q < 0.8) {
    cart(o1, z + 10);
    cart(o2, z + 18);
    coinLine(L, z + 2, 10);
    return 28;
  }
  low(L, z + 8);
  low(o1, z + 14);
  low(o2, z + 20);
  arc(L, z + 2, 6, 1.2, 1.2);
  coinLine(o1, z + 17, 4, 1.4);
  return 30;
}
