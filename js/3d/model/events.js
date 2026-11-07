/* model/events.js — Gameplay events: hits, pickups, combos, floating text, particles. */
"use strict";
/* ---------- gameplay events ---------- */
const POWTXT = {
  mag: "pow_mag",
  shield: "pow_shield",
  turbo: "pow_turbo",
  dbl: "pow_dbl",
  jet: "pow_jet",
  scoot: "pow_scoot",
  slow: "pow_slow",
};
function floatText(text, c) {
  floaties.push({ text, c, l: 1.4 });
  if (floaties.length > 4) floaties.shift();
}
const SPARK_POOL = []; // recycled spark objects
function burst(x, y, z, n, c, sp) {
  for (let i = 0; i < n && sparks.length < 90; i++) {
    const s = SPARK_POOL.pop() || {};
    s.x = x;
    s.y = y;
    s.z = z;
    s.vx = rnd(-sp, sp);
    s.vy = rnd(0, sp * 1.4);
    s.vz = rnd(-sp * 0.5, sp * 0.5);
    s.l = rnd(0.4, 0.8);
    s.c = c;
    sparks.push(s);
  }
}
function smash(o) {
  if (o.dead) return;
  o.dead = true;
  S.smash++;
  LT.smash++;
  bonus += 30;
  burst(o.x, 1, o.z, 14, "#ffb36b", 5);
  sfx.smash();
  shakeT = Math.max(shakeT, 0.15);
}
function hurt(o) {
  if (turbo > 0 || dash > 0) {
    if (o) smash(o);
    return;
  }
  if (jet > 0 || invul > 0 || god) return;
  if (shield > 0) {
    shield = 0;
    invul = 1.2;
    shakeT = 0.25;
    sfx.shield();
    burst(px, 1, pz, 16, "#7fd4ff", 5);
    floatText(T("shieldBreak"), "#7fd4ff");
    if (o) o.dead = true;
    return;
  }
  if (scoot > 0) {
    scoot = 0;
    invul = 1.3;
    shakeT = 0.3;
    hitStop = 0.07;
    trick = false;
    sfx.hit();
    vib(40);
    burst(px, 0.6, pz, 22, "#2ee6c8", 6);
    floatText(T("scootBreak"), "#2ee6c8");
    if (o) o.dead = true;
    return;
  }
  hitStop = 0.08;
  trick = false;
  hits++;
  hitT = 8;
  heat = Math.min(95, heat + 25);
  invul = 1.4;
  shakeT = 0.45;
  sfx.hit();
  vib(60);
  stumbleT = 0.5;
  burst(px, 1, pz, 12, "#ffb36b", 4);
  chain = 0;
  mult = 1;
  chainT = 0;
  if (o && o.k !== "bus" && o.k !== "car") o.dead = true;
  if (hits >= 2) {
    endGame();
    return;
  }
  speed = Math.max(SPEED0, speed * 0.78);
  gap = 4.6;
  floatText(T("stumble"), "#ff6b84");
}
function pickCoin(o) {
  o.got = true;
  const v = o.gem ? 5 : 1,
    m = dbl > 0 ? 2 : 1;
  coinsGot += v * m;
  LT.coins += v * m;
  heat = Math.max(0, heat - (o.gem ? 3 : 0.7));
  coinFrac += v * m * (cityMul() - 1); // rebuilt city: permanent coin bonus
  while (coinFrac >= 1) {
    coinFrac--;
    coinsGot++;
    LT.coins++;
  }
  const c0 = chain,
    m0 = mult;
  chain = chainT > 0 ? chain + 1 : 1;
  chainT = 1.5;
  mult = Math.min(6, 1 + Math.floor(chain / 8));
  bonus += (o.gem ? 50 : 10) * mult * m;
  coinHud = 0.25;
  energy = Math.min(100, energy + (o.gem ? 8 : 2.5));
  sfx.coin();
  burst(o.x, o.y, o.z, 3, o.gem ? "#9ffcff" : "#ffe27a", 2);
  if (chain > LT.chain) LT.chain = chain;
  if (mult > m0) {
    floatText("×" + mult + "  " + T("multUp"), "#ff8a3c");
    sfx.pow();
  }
  const RUSH = { 10: 5, 25: 15, 50: 40, 100: 100 },
    rw = RUSH[chain];
  if (rw && c0 === chain - 1) {
    coinsGot += rw;
    LT.coins += rw;
    bonus += rw * 20;
    energy = Math.min(100, energy + 20);
    floatText(T("coinRush") + " +" + rw, "#ffe27a");
    burst(px, py + 1, pz, 26, "#ffe27a", 6);
    sfx.zumary();
    camDip = -0.25;
  }
  checkAch();
}
function givePow(t) {
  S.power++;
  sfx.pow();
  vib(20);
  floatText(T(POWTXT[t]), POWCOL[t]);
  if (t === "mag") mag = 9;
  else if (t === "shield") shield = 16;
  else if (t === "scoot") {
    scoot = 12;
    S.scoot++;
    LT.scoot++;
    trick = false;
    burst(px, 0.6, pz, 20, "#2ee6c8", 5);
    checkAch();
  } else if (t === "slow") slow = 6;
  else if (t === "turbo") {
    turbo = 5;
    invul = Math.max(invul, 0.3);
  } else if (t === "dbl") dbl = 15;
  else {
    jet = 7;
    vy = 0;
    const cx = clamp(px, -1.2, 1.2);
    for (let i = 0; i < 60; i++)
      objs.push({
        k: "coin",
        x: clamp(cx + Math.sin(i * 0.28) * 1.7, -2.2, 2.2),
        z: pz + 14 + i * 2.4,
        y: 3.7 + Math.sin(i * 0.5) * 0.35,
        gem: i % 12 === 11,
        ph: Math.random() * 6,
        len: 0,
      });
  }
}
function pickLetter(o) {
  o.got = true;
  sfx.letter();
  if (o.n === nextLetter) {
    nextLetter++;
    floatText("ZUMARY".slice(0, nextLetter), "#ffd84f");
    if (nextLetter >= 6) {
      nextLetter = 0;
      S.letters++;
      LT.letters++;
      checkAch();
      coinsGot += 500;
      bonus += 1000;
      turbo = 6;
      sfx.zumary();
      floatText(T("zumary"), "#ffd84f");
    }
  }
}
function closeCall() {
  S.close++;
  LT.close++;
  energy = Math.min(100, energy + 15);
  checkAch();
  bonus += 25 * mult;
  chain += 2;
  chainT = 1.5;
  sfx.close();
  floatText(T("close"), "#7ffcff");
}
function collide(o, dx, top) {
  switch (o.k) {
    case "low":
      return dx < 0.95 && py < 0.82;
    case "cone":
      return dx < 0.85 && py < 0.78;
    case "gate":
      return dx < 0.95 && top > 1.25 && py < 2.2;
    case "car":
      return dx < 0.95 && py < 1.5;
    case "bus":
      return dx < 1.0 && py < 2.9;
    case "cart":
      return dx < 1.15 && py < 1.3;
    case "pit":
      return dx < 0.95 && py < 0.3;
    case "laser":
      return o.hi ? top > 1.2 && py < 2.4 : py < 0.75;
  }
  return false;
}
