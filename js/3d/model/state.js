/* model/state.js — Mutable game state (position, speed, timers, power-ups, camera effects). */
"use strict";
/* ---------- game state ---------- */
const LX = [-2.2, 0, 2.2], SPEED0 = 15;
let state = "ready", pz = 0, px = 0, py = 0, vy = 0, lane = 1, speed = SPEED0, slideT = 0, tilt = 0, runPh = 0, coinsGot = 0, hits = 0, hitT = 0, invul = 0, shakeT = 0, bustT = 0, stumbleT = 0, gap = 11.5, camX = 0;
let objs = [], nextSpawn = 50, sparks = [], floaties = [], wallet = store.get("zr_wallet", 0), best = store.get("zr3d3_best", 0), coinHud = 0, paused = false, god = false, lastT = 0, skin = store.get("zr_skin", "default");
let bonus = 0, mult = 1, chain = 0, chainT = 0, mag = 0, shield = 0, turbo = 0, dbl = 0, jet = 0, padB = 0, nextLetter = 0, floorY = 0, lastFloor = 0, revived = false, heli = null, nextHeli = 650, lit = 0, rainA = 0, bankedCoins = 0, doneMsgs = [], lvlMsg = "";
let lastTheme = 0, showT = 0, camBlend = 0, SC = null, jetK = 0, dash = 0, energy = 60, scoot = 0, slow = 0, air2 = true, trick = false, flipT = 0, flipSpin = false, landT = 0, wingK = 0.15, fovK = 0, slowK = 0, camRoll = 0, camDip = 0, hitStop = 0, resumeCd = 0, INS = { t: 0, r: 0, b: 0, l: 0 };
const newStats = () => ({ dist: 0, jump: 0, slide: 0, close: 0, power: 0, letters: 0, ramp: 0, smash: 0, flip: 0, dash: 0, scoot: 0 });
let S = newStats(), B0 = newStats();
const look = () => (Rig.LOOKS[skin] || Rig.LOOKS.default);
const scoreNow = () => Math.floor(pz) + bonus;
