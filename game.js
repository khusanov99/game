/* =====================================================
   ZUMARY RUN — mobile-first build
   • responsive world (uniform scale, never stretched)
   • adaptive quality (auto-lowers effects on slow phones)
   • touch pad, swipe-duck, haptics, full screen
===================================================== */
const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  wrap = $("wrap"),
  shell = $("shell"),
  ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

/* ============ WORLD SIZE (responsive) ============ */
let W = 900, H = 350, groundY = 292, S = 1, UI = 1, DPR = 1;
let PS = 1.55, CPS = 1.5;
const COARSE = window.matchMedia("(pointer:coarse)").matches;

/* ============ QUALITY ============ */
const FX = { particles: true, blur: true, bloom: !COARSE, shake: 1, cam: true, light: true, shadow: true, env: true, coinGlow: true, charFx: true, bg: true, hints: true };   // filled by settings.js
let RS = 1, FLOOR = 0, SWIPE = 30, FPSCAP = 0;                  // render scale, quality floor, swipe distance, fps cap (0 = auto, -1 = device maximum)
const Q = { level: 0, shadow: !COARSE, flat: false, dpr: 2, maxP: 140 };
const PIXEL_BUDGET = COARSE ? [560000, 400000, 280000, 190000] : [1500000, 1100000, 800000, 500000];   // canvas pixels per quality level
function setQuality(l) {
  l = Math.max(l, FLOOR);
  Q.level = l;
  Q.shadow = gfx === "ultra" && !COARSE && FX.shadow;      // real shadowBlur is very expensive: only when the player explicitly picks ULTRA on desktop
  Q.flat = l >= 2;
  Q.dpr = [2, 1.5, 1, 0.75][Math.min(l, 3)];
  Q.maxP = [140, 70, 40, 24][Math.min(l, 3)] >> (CFG.lowmem ? 1 : 0);
  skyKey = ""; gndKey = "";
  buildWeather();
  resize();
}
const glow = (c, b) => { if (Q.shadow) { ctx.shadowColor = c; ctx.shadowBlur = b; } };
const noGlow = () => { if (Q.shadow) ctx.shadowBlur = 0; };
const grad = (x0, y0, x1, y1, c0, c1) => {
  if (Q.flat) return c0;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
};
const GLOWS = {};
function glowSprite(c) {                // pre-rendered soft glow: one cheap drawImage instead of shadowBlur
  if (!GLOWS[c]) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, c + "cc"); gr.addColorStop(0.4, c + "55"); gr.addColorStop(1, c + "00");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWS[c] = cv;
  }
  return GLOWS[c];
}
const halo = (x, y, w, h, r, c) => {
  if (Q.shadow || Q.flat || !FX.bloom) return;
  const d = Math.max(w, h) * 2.3, cx = x + w / 2, cy = y + h / 2;
  ctx.globalAlpha = 0.55; ctx.drawImage(glowSprite(c), cx - d / 2, cy - d / 2, d, d); ctx.globalAlpha = 1;
};
let hazPat = null;
function hazardPattern() {
  if (!hazPat) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const g = cv.getContext("2d"), im = g.createImageData(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4, dark = (x + y) % 16 < 8;
      im.data[i] = dark ? 23 : 255; im.data[i + 1] = dark ? 23 : 194; im.data[i + 2] = dark ? 31 : 26; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); hazPat = ctx.createPattern(cv, "repeat");
  }
  return hazPat;
}

function resize() {
  const cw = Math.max(200, wrap.clientWidth), ch = Math.max(140, wrap.clientHeight);
  const oldG = groundY;
  let s = ch / 350, w = cw / s;
  if (w < 560) { s = cw / 560; w = 560; }
  else if (w > 1100) { s = cw / 1100; w = 1100; }
  S = s; W = w; H = ch / s; groundY = H - 58; UI = Math.max(1, 0.95 / s);
  { const sf = Math.min(1.4, Math.max(1, UI * 0.9 + 0.1)); PS = 1.55 * sf; CPS = 1.5 * sf; }
  DPR = Math.min(window.devicePixelRatio || 1, Q.dpr, CFG.lowmem ? 1 : 9) * RS;
  const want = cw * ch * DPR * DPR, budget = PIXEL_BUDGET[Math.min(Q.level, 3)];   // hard cap on pixels drawn per frame (fill-rate is what freezes phones)
  if (want > budget) DPR = Math.max(0.5, DPR * Math.sqrt(budget / want));
  const nw = Math.round(cw * DPR), nh = Math.round(ch * DPR);
  if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; }
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (COARSE) ctx.imageSmoothingQuality = "low";
  player.x = Math.round(Math.min(190, Math.max(125, W * 0.19)));
  const dy = groundY - oldG;
  if (dy && obstacles) {
    obstacles.forEach((o) => { o.y += dy; if (o.by !== undefined) o.by += dy; });
    items.forEach((i) => (i.y += dy));
    player.y += dy;
    skyKey = "";
  }
}

/* ============ STORAGE / CONFIG ============ */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const rnd = (a, b) => Math.random() * (b - a) + a;
const fmt = (v) => String(Math.floor(v)).padStart(6, "0");

const DIFF = {
  easy: { get name() { return t("diffEasy"); }, base: 4.6, max: 9.5, gap: 1.25 },
  normal: { get name() { return t("diffNormal"); }, base: 5.3, max: 11, gap: 1 },
  hard: { get name() { return t("diffHard"); }, base: 6.2, max: 13, gap: 0.82 },
};
const THEMES = [
  { get n() { return t("city.tash"); }, city: "tash", wx: "leaf", night: 0, top: "#0f2a5c", bot: "#f2a766", a: "#53f7ff", b: "#ffb36b", body: [0.8, 0.55, 22, "#ffd9a0"] },
  { get n() { return t("city.sam"); }, city: "sam", wx: "spark", night: 0, top: "#2a2f78", bot: "#ffb066", a: "#ffd84f", b: "#22b8c4", body: [0.74, 0.56, 38, "#ffcf6a"] },
  { get n() { return t("city.bux"); }, city: "bux", wx: "dust", night: 0, top: "#1f3a63", bot: "#f7c47a", a: "#ffb36b", b: "#7aa5ff", body: [0.78, 0.52, 34, "#ffe29a"] },
  { get n() { return t("city.khi"); }, city: "khi", wx: "dust", night: 1, top: "#060a1c", bot: "#2b3a63", a: "#53f7ff", b: "#a78bfa", body: [0.82, 0.2, 22, "#e6ecff"] },
  { get n() { return t("city.khiN"); }, city: "khi", wx: "dust", night: 1, top: "#03050f", bot: "#101a34", a: "#8c7bff", b: "#53f7ff", body: [0.84, 0.2, 20, "#a9b4ff"] },
  { get n() { return t("city.tashN"); }, city: "tashN", wx: "rain", night: 1, top: "#050818", bot: "#2b2058", a: "#ff3b5c", b: "#ffb36b", body: [0.8, 0.2, 24, "#ff7a8a"] },
];
const FACTS = { get tash() { return t("fact.tash"); }, get tashN() { return t("fact.tash"); }, get sam() { return t("fact.sam"); }, get bux() { return t("fact.bux"); }, get khi() { return t("fact.khi"); } };
const POWER = {
  shield: { icon: "🛡", color: "#53f7ff", dur: 0 },
  slow: { icon: "⏳", color: "#a78bfa", dur: 5000 },
  x2: { icon: "×2", color: "#ffd84f", dur: 8000 },
  magnet: { icon: "🧲", color: "#ff4fd8", dur: 8000 },
  fuel: { icon: "⛽", color: "#ffb36b", dur: 0 },
  plov: { icon: "🍚", color: "#ffd84f", dur: 0 },
  hover: { icon: "🛹", color: "#53f7ff", dur: 9000 },
  box: { icon: "🎁", color: "#ff4fd8", dur: 0 },
};
const SKINS = [
  { id: "default", n: "ZUMARY", a: null, b: null, cost: 0 },
  { id: "rose", get n() { return t("skin.rose"); }, a: "#ff4fd8", b: "#ff8a5c", cost: 80 },
  { id: "mint", get n() { return t("skin.mint"); }, a: "#50ffb0", b: "#53f7ff", cost: 200 },
  { id: "gold", get n() { return t("skin.gold"); }, a: "#ffd84f", b: "#ff7a59", cost: 400 },
];

const PX_M = 30; // world pixels per metre
const LEVELS = [
  { get name() { return t("city.tash"); }, get tag() { return t("lvl.1"); }, len: 600, base: 4.8, max: 8, gap: 1.3, theme: 0, types: ["block"], coins: 25 },
  { get name() { return t("city.sam"); }, get tag() { return t("lvl.2"); }, len: 800, base: 5.3, max: 9.5, gap: 1.15, theme: 1, types: ["block", "drone", "double", "train"], coins: 35 },
  { get name() { return t("city.bux"); }, get tag() { return t("lvl.3"); }, len: 1000, base: 5.6, max: 10.5, gap: 1.1, theme: 2, types: ["block", "drone", "pit", "train"], coins: 45, g: 0.4, jump: [-10.8, -9.5] },
  { get name() { return t("city.khiN"); }, get tag() { return t("lvl.4"); }, len: 1200, base: 6, max: 11.5, gap: 1.05, theme: 4, types: ["block", "drone", "pit", "double", "train"], coins: 50, dark: true },
  { get name() { return t("city.tashN"); }, get tag() { return t("lvl.5"); }, len: 1500, base: 6.2, max: 12, gap: 1.7, theme: 5, types: ["block", "pit", "drone", "train"], coins: 60, boss: true },
];
let prog = store.get("zr_prog", { unlocked: 1, stars: {} });
let mode = store.get("zr_mode", "campaign");
let sel = store.get("zr_sel", 0);
if (mode !== "campaign" && mode !== "endless") mode = "campaign";
if (!(sel >= 0 && sel < LEVELS.length && sel <= prog.unlocked - 1)) sel = 0;

let up = store.get("zr_up", { jet: 0, fuel: 0, mag: 0, sh: 0, life: 0 });
const SHOP = [
  { k: "jet", get n() { return t("shop.jet.n"); }, get d() { return t("shop.jet.d"); }, max: 1, cost: [120] },
  { k: "fuel", get n() { return t("shop.fuel.n"); }, get d() { return t("shop.fuel.d"); }, max: 3, cost: [100, 200, 350] },
  { k: "mag", get n() { return t("shop.mag.n"); }, get d() { return t("shop.mag.d"); }, max: 2, cost: [90, 180] },
  { k: "sh", get n() { return t("shop.sh.n"); }, get d() { return t("shop.sh.d"); }, max: 1, cost: [150] },
  { k: "life", get n() { return t("shop.life.n"); }, get d() { return t("shop.life.d"); }, max: 1, cost: [300] },
  { k: "pet", get n() { return t("shop.pet.n"); }, get d() { return t("shop.pet.d"); }, max: 1, cost: [250] },
];
let diff = store.get("zr_diff", "normal");
if (!DIFF[diff]) diff = "normal";
let bests = store.get("zr_bests", {});
let board = store.get("zr_top", []);
let muted = store.get("zr_muted", false);
let wallet = store.get("zr_wallet", 0);
let owned = store.get("zr_owned", ["default"]);
let skin = store.get("zr_skin", "default");
if (!owned.includes(skin)) skin = "default";

/* ============ SOUND + HAPTICS ============ */
let ac = null, busS = null, busM = null, activeS = 0;
const CFG = Object.assign({ music: 0.6, sfx: 0.9, reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches, left: false, vib: true }, store.get("zr_cfg", {}));
const saveCfg = () => store.set("zr_cfg", CFG);
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(), comp = ac.createDynamicsCompressor();
    master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
    busS = ac.createGain(); busM = ac.createGain(); busS.connect(master); busM.connect(master);
  }
  busS.gain.value = CFG.sfx; busM.gain.value = CFG.music;
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function beep(f, d = 0.08, type = "square", v = 0.04, slide = 0, music = false) {
  if (muted || (music ? CFG.music : CFG.sfx) <= 0.001) return;
  if (!music && activeS > 10) return;                 // never pile up sound nodes on a slow phone
  try {
    const a = audio(), t0 = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(music ? busM : busS); o.start(t0); o.stop(t0 + d + 0.02);
    if (!music) activeS++;
    o.onended = () => { if (!music) activeS--; g.disconnect(); };
  } catch (e) {}
}
const vib = (ms) => { if (!muted && CFG.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };
const sfx = {
  jump: () => beep(380, 0.12, "square", 0.035, 280),
  jump2: () => beep(520, 0.12, "square", 0.035, 360),
  coin: () => { const k = 1 + Math.min(combo, 20) * 0.025; beep(880 * k, 0.07, "triangle", 0.05); setTimeout(() => beep(1320 * k, 0.09, "triangle", 0.05), 55); },
  power: () => { beep(500, 0.1, "sine", 0.06, 500); setTimeout(() => beep(900, 0.14, "sine", 0.06, 400), 90); vib(15); },
  hit: () => { beep(140, 0.35, "sawtooth", 0.07, -90); vib(60); },
  bonk: () => { beep(260, 0.07, "square", 0.07, -150); setTimeout(() => beep(110, 0.12, "sawtooth", 0.06, -50), 45); vib(25); },
  zone: () => { beep(440, 0.12, "triangle"); setTimeout(() => beep(660, 0.12, "triangle"), 110); setTimeout(() => beep(880, 0.2, "triangle"), 220); },
};

/* ============ STATE ============ */
let state = "ready"; // ready | play | pause | over
let score, speed, frame, coins, combo, shake, invul, shield, banner, lastZone;
let lvl = null, dist = 0, lives = 1, hits = 0, shotTimer = 1500, darkKey = "", darkG = null;
let maxLives = 1, fuel = 0, flying = false, jumpHeld = false, sq = 0, zoom = 1, freeze = 0, hbT = 0, lastPhase = 0, shopOpen = false, curPanel = "shop", screenFn = null;
let prefetched = -1, extraGap = 0, cleanT = 0, boardT = 0, chaseX = -120, trainHint = false;
let spawnPx = 0, nextGapPx = 380, skill = 0.5, skillT = 0, hitFlag = false, runTime = 0, runDist = 0, runPhase = 0, landT = 0, prevLm = 0, fadeT = 0, prevA = null, acc = 0, rafAvg = 16.7, skipDraw = false;
let shoutO = { text: "", t: 0, max: 1, c: "#fff" }, flash = { c: "#fff", a: 0 };
let fx, obstacles, items, particles, pops, stars, layers;
let obstacleTimer, nextObstacle, itemTimer, nextItem, lastT = 0;
let duckKey = false, duckPtr = false, duckBtn = false;
let cur = { ...THEMES[0] };
let skyKey = "", skyG = null, gndKey = "", gndG = null;
let fpsAcc = 0, fpsN = 0;

const player = { x: 120, y: groundY - 44, w: 34, h: 44, vy: 0, g: 0.65, grounded: true, jumps: 2, pb: groundY, trail: [] };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (c1, c2, t) => {
  const a = hex(c1), b = hex(c2);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

function makeLayer(n, hmin, hmax, wmin, wmax, mul, shade, windows) {
  const L = { mul, shade, windows, hmin, hmax, wmin, wmax, b: [] };
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(wmin, wmax);
    L.b.push({ x, w, h: rnd(hmin, hmax), seed: Math.random() * 99 });
    x += w + rnd(4, 16);
  }
  return L;
}
function buildWorld() {
  stars = Array.from({ length: COARSE ? 45 : 75 }, () => ({ x: rnd(0, W), y: rnd(0, groundY * 0.7), s: rnd(0.3, 2), a: rnd(0.15, 0.8) }));
  layers = [];
  clouds = Array.from({ length: 5 }, () => ({ x: rnd(0, W), y: rnd(20, groundY * 0.5), w: rnd(70, 150), s: rnd(0.02, 0.06) }));
  artFor(cur.city || "tash");
  lm = { city: cur.city || "tash", x: W * 0.55 };
  decor = []; farOff = midOff = gndOff = 0;
  buildWeather();
}

/* ============ EMOTION: shout, combo, music ============ */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fuelMax = () => 2200 + 800 * up.fuel;
function shout(text, c = "#ffd84f", ms = 1200) { shoutO = { text, c, t: ms, max: ms }; }
const COMBO_CALLS = { 5: ["combo.5", "#53f7ff"], 10: ["combo.10", "#ffd84f"], 20: ["combo.20", "#ff4fd8"], 35: ["combo.35", "#50ffb0"], 50: ["combo.50", "#ff8a5c"] };
function addCombo() {
  combo++;
  meta.bestCombo = Math.max(meta.bestCombo, combo); mMax("combo", combo);
  const c = COMBO_CALLS[combo];
  if (c) {
    shout(t(c[0]), c[1], 1100); flash = { c: c[1], a: 0.16 }; zoom = 1.04; vib(20);
    [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 0.1, "triangle", 0.05), i * 70));
    burst(player.x + 17, player.y, c[1], 22); checkAch();
  }
}
let musicOn = false, musicStep = 0;
const noteHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function musicTick() {
  if (!musicOn || muted || state !== "play") { musicOn = false; return; }
  const roots = lvl ? [48, 50, 45, 43, 41] : [48, 50, 45, 43];
  const root = roots[lvl ? sel : Math.floor(score / 500) % 4];
  const st = musicStep++ % 16, pent = [0, 3, 5, 7, 10];
  if (st % 4 === 0) beep(noteHz(root - 12 + [0, 0, 5, 3][st >> 2]), 0.18, "triangle", 0.05, 0, true);
  if (st % 2 === 0 || (!COARSE && Math.random() < 0.35)) beep(noteHz(root + 12 + pent[(st * 3 + (st >> 3)) % 5]), 0.08, "square", 0.012, 0, true);
  const bpm = 105 + Math.min(55, speed * 6) + (lvl && lvl.boss ? 15 : 0);
  setTimeout(musicTick, 60000 / bpm / 4);
}
function startMusic() { if (musicOn || muted) return; musicOn = true; musicStep = 0; musicTick(); }

/* ============ CITIES · WEATHER · PROGRESSION ============ */
let clouds = [], lm = { city: "tash", x: 400 }, decor = [], wx = [], decorGap = 200;
let toastO = { text: "", t: 0, max: 1 }; const toastQ = [];
let turbo = 0, turboT = 0, revived = false, padRdy = false, pet = { x: 80, y: 200 };
const TURBO_MS = 3000, REVIVE_COST = 50;
const todayStr = (d = new Date()) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
let meta = Object.assign({ time: 0, bestDist: 0, xp: 0, runs: 0, dist: 0, coinsTotal: 0, bestCombo: 0, flyMs: 0, bestScore: 0, streak: 0, lastDay: "", boxDay: "", mDay: "", missions: [], medals: {}, wins: 0, turbos: 0 }, store.get("zr_meta", {}));
const saveMeta = () => store.set("zr_meta", meta);

function toast(text) { toastQ.push(text); }
function updateToast(delta) {
  if (toastO.t > 0) toastO.t -= delta;
  else if (toastQ.length) toastO = { text: toastQ.shift(), t: 2600, max: 2600 };
}

/* ---- daily missions ---- */
const MPOOL = [
  { k: "coin", t: (n) => t("m.coin", { n }), g: [25, 60], r: 40 },
  { k: "near", t: (n) => t("m.near", { n }), g: [3, 8], r: 45 },
  { k: "combo", t: (n) => t("m.combo", { n }), g: [12, 30], r: 50 },
  { k: "score", t: (n) => t("m.score", { n }), g: [400, 1200], r: 55 },
  { k: "turbo", t: (n) => t("m.turbo", { n }), g: [1, 3], r: 50 },
  { k: "fly", t: (n) => t("m.fly", { n }), g: [5, 12], r: 60, need: "jet" },
  { k: "win", t: (n) => t("m.win", { n }), g: [1, 2], r: 80 },
  { k: "rare", t: (n) => t("m.rare", { n }), g: [2, 5], r: 55 },
  { k: "evt", t: (n) => t("m.evt", { n }), g: [2, 4], r: 60 },
];
function genMissions() {
  const pool = MPOOL.filter((m) => !m.need || up[m.need]), out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({ k: m.k, g: Math.round(rnd(m.g[0], m.g[1])), p: 0, done: 0, r: m.r });
  }
  return out;
}
function checkM(m) {
  if (m.p >= m.g) { m.done = 1; wallet += m.r; store.set("zr_wallet", wallet); toast(t("mDone", { r: m.r })); sfx.zone(); saveMeta(); }
}
function mAdd(k, n) { for (const m of meta.missions) if (m.k === k && !m.done) { m.p += n; checkM(m); } }
function mMax(k, v) { for (const m of meta.missions) if (m.k === k && !m.done) { m.p = Math.max(m.p, v); checkM(m); } }

/* ---- medals ---- */
const ACH = [
  { id: "a1", get n() { return t("ach.a1.n"); }, get d() { return t("ach.a1.d"); }, ok: () => meta.bestScore >= 100, r: 20 },
  { id: "a2", get n() { return t("ach.a2.n"); }, get d() { return t("ach.a2.d"); }, ok: () => meta.bestScore >= 1000, r: 60 },
  { id: "a3", get n() { return t("ach.a3.n"); }, get d() { return t("ach.a3.d"); }, ok: () => meta.bestCombo >= 20, r: 40 },
  { id: "a4", get n() { return t("ach.a4.n"); }, get d() { return t("ach.a4.d"); }, ok: () => meta.bestCombo >= 50, r: 100 },
  { id: "a5", get n() { return t("ach.a5.n"); }, get d() { return t("ach.a5.d"); }, ok: () => meta.coinsTotal >= 500, r: 60 },
  { id: "a6", get n() { return t("ach.a6.n"); }, get d() { return t("ach.a6.d"); }, ok: () => meta.coinsTotal >= 2000, r: 150 },
  { id: "a7", get n() { return t("ach.a7.n"); }, get d() { return t("ach.a7.d"); }, ok: () => meta.flyMs >= 20000, r: 60 },
  { id: "a8", get n() { return t("ach.a8.n"); }, get d() { return t("ach.a8.d"); }, ok: () => (prog.stars[1] || 0) > 0, r: 40 },
  { id: "a9", get n() { return t("ach.a9.n"); }, get d() { return t("ach.a9.d"); }, ok: () => (prog.stars[5] || 0) > 0, r: 200 },
  { id: "a10", get n() { return t("ach.a10.n"); }, get d() { return t("ach.a10.d"); }, ok: () => meta.streak >= 3, r: 50 },
  { id: "a12", get n() { return t("ach.a12.n"); }, get d() { return t("ach.a12.d"); }, ok: () => (meta.events | 0) >= 10, r: 80 },
  { id: "a13", get n() { return t("ach.a13.n"); }, get d() { return t("ach.a13.d"); }, ok: () => (meta.rare | 0) >= 30, r: 90 },
  { id: "a11", get n() { return t("ach.a11.n"); }, get d() { return t("ach.a11.d"); }, ok: () => meta.turbos >= 5, r: 60 },
];
function checkAch() {
  let any = false;
  for (const a of ACH) if (!meta.medals[a.id] && a.ok()) { meta.medals[a.id] = 1; wallet += a.r; toast(`🏅 ${a.n}! +◎${a.r}`); any = true; }
  if (any) { store.set("zr_wallet", wallet); saveMeta(); sfx.power(); }
}

/* ---- XP + ranks ---- */
const RANKS = [["rank.0", 0], ["rank.1", 100], ["rank.2", 300], ["rank.3", 700], ["rank.4", 1500], ["rank.5", 3000]];
const rankOf = (xp) => { let i = 0; RANKS.forEach((r, j) => { if (xp >= r[1]) i = j; }); return i; };
function gainXp(n) {
  const before = rankOf(meta.xp);
  meta.xp += Math.max(0, Math.round(n));
  const after = rankOf(meta.xp);
  if (after > before) { toast(t("rankUpToast", { r: t(RANKS[after][0]) })); return RANKS[after][0]; }
  return null;
}
const rkText = (rk) => (rk.rank ? t("rankUpHtml", { r: t(rk.rank) }) : "") + t("xpLine", { n: rk.xp });
function bookRun(winBonus) {
  meta.runs++; meta.dist += Math.floor(runDist); meta.time += runTime; meta.bestDist = Math.max(meta.bestDist || 0, Math.floor(runDist)); meta.coinsTotal += coins;
  meta.bestScore = Math.max(meta.bestScore, Math.floor(score));
  mMax("score", Math.floor(score));
  const xp = score / 10 + coins * 2 + (winBonus || 0);
  const rank = gainXp(xp);
  checkAch(); saveMeta();
  return { rank, xp: Math.round(xp) };
}

/* ---- daily streak (runs once on load) ---- */
(function dailyInit() {
  const t = todayStr();
  if (meta.lastDay !== t) {
    const ys = todayStr(new Date(Date.now() - 864e5));
    meta.streak = meta.lastDay === ys ? meta.streak + 1 : 1;
    meta.lastDay = t;
  }
  if (meta.mDay !== t) { meta.mDay = t; meta.missions = genMissions(); }
  checkAch(); saveMeta();
})();

/* ---- turbo ---- */
function turboAdd(n) {
  if (turboT > 0) return;
  const was = turbo >= 100;
  turbo = Math.min(100, turbo + n);
  if (!was && turbo >= 100) { toast(t("turboReady")); beep(1200, 0.1, "triangle", 0.05); vib(20); }
}
function useTurbo() {
  if (state !== "play" || turbo < 100 || turboT > 0) return;
  turboT = TURBO_MS; meta.turbos++; mAdd("turbo", 1);
  flash = { c: "#53f7ff", a: 0.35 }; zoom = 1.08; shout("TURBO!", "#53f7ff", 900); vib(40);
  [400, 600, 900, 1300].forEach((f, i) => setTimeout(() => beep(f, 0.1, "sawtooth", 0.04), i * 50));
  checkAch();
}

/* ---- scenery: real Uzbek skylines pre-rendered in art.js ---- */
let ART = null, farOff = 0, midOff = 0, gndOff = 0, birds = [];
const ARTOPT = { coarse: COARSE };
function artFor(city) {
  const c = Art.peek(city);
  if (c) { ART = c; return c; }
  if (!ART || !ART.far.width) { ART = Art.get(city, ARTOPT); return ART; }   // first paint only
  Art.getAsync(city, ARTOPT);                                                 // otherwise build quietly in the background
  return ART;
}
function buildWeather() {
  const n = Q.level >= 2 ? 0 : Q.level === 1 ? 24 : COARSE ? 32 : 45;
  wx = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, groundY), z: rnd(0.5, 1) }));
  birds = Array.from({ length: 6 }, () => ({ x: rnd(0, W), y: rnd(30, groundY * 0.5), s: rnd(0.3, 0.8), ph: rnd(0, 6) }));
}
function moveScenery(d, f = 1) {
  farOff = (farOff + d * 0.1) % Art.TW; midOff = (midOff + d * 0.3) % Art.TW; gndOff = (gndOff + d) % Art.GW;
  for (const c of clouds) { c.x -= d * c.s; if (c.x + c.w < 0) { c.x = W + 20; c.y = rnd(20, groundY * 0.5); } }
  lm.x -= d * 0.18; prevLm -= d * 0.18;
  if (ART && lm.x < -ART.lmW * 0.9) lm.x = W + rnd(450, 900);
  for (const b of birds) { b.x -= d * 0.12 + b.s * f; if (b.x < -10) { b.x = W + 10; b.y = rnd(30, groundY * 0.5); } }
  const t = cur.wx;
  for (const p of wx) {
    if (t === "rain") { p.y += (9 + 6 * p.z) * f; p.x -= 2 * f; }
    else if (t === "leaf") { p.y += (0.8 + p.z) * f; p.x -= d * 0.35 + Math.sin(p.y * 0.05) * 0.9 * f; }
    else if (t === "dust") { p.x -= 6 * f + d * p.z; p.y += 0.2 * f; }
    else { p.y -= (0.4 + p.z * 0.6) * f; p.x -= d * 0.3; }
    if (p.y > groundY || p.y < -10 || p.x < -20) {
      if (t === "rain" || t === "leaf") { p.x = rnd(0, W + 80); p.y = -10; }
      else if (t === "dust") { p.x = W + rnd(0, 60); p.y = rnd(0, groundY); }
      else { p.x = rnd(0, W); p.y = groundY - rnd(0, 40); }
    }
  }
}
function drawSkyBody() {
  const b = cur.body || [0.84, 0.22, 26, "#fff"];
  const bx = W * b[0], by = Math.min(b[1] * H, groundY - 30), r = b[2] * Math.max(1, UI * 0.8);
  ctx.fillStyle = b[3];
  ctx.globalAlpha = 0.1; ctx.beginPath(); ctx.arc(bx, by, r * 2.4, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(bx, by, r * 1.5, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
const CLOUDSP = [null, null];
function cloudSprite(night) {                           // a cloud is painted once; every frame it is a single drawImage
  const k = night ? 1 : 0;
  if (!CLOUDSP[k]) {
    const cv = document.createElement("canvas"); cv.width = 160; cv.height = 48;
    const g = cv.getContext("2d"), w = 100, cx = 80, cy = 28;
    g.fillStyle = night ? "#9fb0ff" : "#fff3e0"; g.beginPath();
    g.ellipse(cx, cy, w * 0.5, w * 0.12, 0, 0, 7);
    g.ellipse(cx + w * 0.25, cy - w * 0.06, w * 0.3, w * 0.1, 0, 0, 7);
    g.ellipse(cx - w * 0.25, cy - w * 0.03, w * 0.28, w * 0.09, 0, 0, 7);
    g.fill(); CLOUDSP[k] = cv;
  }
  return CLOUDSP[k];
}
function drawClouds() {
  const sp = cloudSprite(!!cur.night);
  ctx.globalAlpha = cur.night ? 0.06 : 0.13;
  for (const c of clouds) {
    const k = c.w / 100;
    if (c.x + 0.8 * c.w < 0 || c.x - 0.8 * c.w > W) continue;     // off-screen clouds cost nothing
    ctx.drawImage(sp, c.x - 80 * k, c.y - 28 * k, 160 * k, 48 * k);
  }
  ctx.globalAlpha = 1;
}
function drawBirds() {
  if (cur.night) return;
  ctx.strokeStyle = "rgba(25,20,45,.6)"; ctx.lineWidth = 1.4; ctx.beginPath();
  for (const b of birds) { const f = Math.sin(frame * 0.25 + b.ph) * 3; ctx.moveTo(b.x - 5, b.y + f * 0.3); ctx.quadraticCurveTo(b.x - 2, b.y - 3 - f, b.x, b.y); ctx.quadraticCurveTo(b.x + 2, b.y - 3 - f, b.x + 5, b.y + f * 0.3); }
  ctx.stroke();
}
function drawWeather() {
  if (!wx.length || Q.level >= 2) return;
  const t = cur.wx; ctx.lineWidth = 1;
  if (t === "rain") {
    ctx.strokeStyle = cur.city === "tashN" ? "rgba(255,140,170,.32)" : "rgba(170,200,255,.35)"; ctx.beginPath();
    for (const p of wx) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3 * p.z, p.y + 13 * p.z); }
    ctx.stroke();
  } else if (t === "leaf") {
    ctx.fillStyle = "#e08a2c"; ctx.globalAlpha = 0.8;
    for (const p of wx) ctx.fillRect(p.x, p.y, 3 + p.z * 2, 2 + p.z);
    ctx.globalAlpha = 1;
  } else if (t === "dust") {
    ctx.strokeStyle = "rgba(255,210,140,.2)"; ctx.beginPath();
    for (const p of wx) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 14 + p.z * 16, p.y); }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffe08a";
    for (const p of wx) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(frame * 0.05 + p.x)); ctx.fillRect(p.x, p.y, 2, 2); }
    ctx.globalAlpha = 1;
  }
}
function drawPet() {
  if (!up.pet || state === "ready") return;
  const s = Math.sin(frame * 1.4) * 8;
  glow("#ffb36b", 12);
  ctx.fillStyle = "#ffb36b"; ctx.beginPath(); ctx.arc(pet.x, pet.y, 7, 0, 7); ctx.fill(); noGlow();
  ctx.fillStyle = "#10142c"; ctx.fillRect(pet.x - 4, pet.y - 2, 8, 3.5);
  ctx.fillStyle = "#fff"; ctx.fillRect(pet.x - 2.5, pet.y - 1.5, 1.6, 1.6); ctx.fillRect(pet.x + 1, pet.y - 1.5, 1.6, 1.6);
  ctx.strokeStyle = "#ffd0c0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pet.x - s, pet.y - 9); ctx.lineTo(pet.x + s, pet.y - 9); ctx.stroke();
}
function drawTurboFx() {
  if (turboT <= 0) return;
  const p = player;
  ctx.strokeStyle = "#9ffcff"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const y = p.y + 6 + (i * (p.h - 8)) / 5, l = 40 + ((frame * 9 + i * 31) % 60); ctx.moveTo(p.x - 6, y); ctx.lineTo(p.x - 6 - l, y); }
  ctx.stroke();
  ctx.globalAlpha = 0.22; ctx.fillStyle = "#53f7ff"; ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 34, p.h / 2 + 14, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
}

/* ---- menu panels ---- */
function renderDaily() {
  const ri = rankOf(meta.xp), c0 = RANKS[ri][1], last = ri >= RANKS.length - 1, n0 = last ? c0 + 1 : RANKS[ri + 1][1];
  const pr = last ? 100 : Math.min(100, ((meta.xp - c0) / (n0 - c0)) * 100);
  const gift = meta.boxDay !== todayStr();
  return `<div class="xp"><span>${t(RANKS[ri][0])}</span><i><b style="width:${pr}%"></b></i><em>${meta.xp} XP</em></div>` +
    `<div class="daily"><span>${t("daily.streak", { n: meta.streak })}</span>${gift ? `<button type="button" id="giftBtn">${t("daily.gift")}</button>` : `<span class="dim">${t("daily.tomorrow")}</span>`}</div>`;
}
function renderMissions() {
  return `<div class="top-title">${t("missions.title")}</div><div class="shop">` +
    meta.missions.map((m) => {
      const def = MPOOL.find((x) => x.k === m.k), pr = Math.min(m.g, Math.floor(m.p));
      return `<div class="shop-row"><div><b>${def.t(m.g)}</b><small>${pr} / ${m.g} · ${t("missions.reward")} ◎${m.r}</small><i class="bar"><b style="width:${(pr / m.g) * 100}%"></b></i></div><button type="button" class="${m.done ? "done" : "lock"}">${m.done ? "✓" : "◎" + m.r}</button></div>`;
    }).join("") + `</div><p class="note">${t("missions.note")}</p>`;
}
function renderMedals() {
  const album = `<div class="top-title">${t("album.title")}</div><div class="album">` +
    LEVELS.map((L, i) => {
      const got = (prog.stars[i + 1] || 0) > 0, th = THUMBS[THEMES[L.theme].city];
      return `<div class="card-pc ${got ? "" : "lock"}" style="${th ? `background-image:url(${th})` : ""}"><span>${got ? L.name : "???"}</span></div>`;
    }).join("") + `</div>`;
  const fmtT = (ms) => { const sec = Math.floor(ms / 1000); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  const cell = (v, k) => `<div><b>${v}</b><small>${t(k)}</small></div>`;
  const st = `<div class="stats">${cell(meta.runs, "stats.runs")}${cell(meta.dist, "stats.dist")}${cell(meta.coinsTotal, "stats.coins")}${cell(meta.bestCombo, "stats.combo")}${cell(fmtT(meta.time), "stats.time")}${cell(meta.bestDist || 0, "stats.best")}</div>`;
  return album + `<div class="top-title">${t("stats.title")}</div>${st}<div class="top-title">${t("medals.title", { a: Object.keys(meta.medals).length, b: ACH.length })}</div><div class="shop">` +
    ACH.map((a) => `<div class="shop-row"><div><b>${meta.medals[a.id] ? "🏅" : "🔒"} ${a.n}</b><small>${a.d} · ◎${a.r}</small></div></div>`).join("") + `</div>`;
}
function renderSettings() {
  const row = (label, body) => `<div class="shop-row"><div><b>${label}</b></div>${body}</div>`;
  const tog = (k, on) => `<button type="button" class="tog${on ? " on" : ""}" data-cfg="${k}">${on ? t("set.on") : t("set.off")}</button>`;
  const rng = (k, v) => `<input type="range" min="0" max="100" value="${Math.round(v * 100)}" data-vol="${k}" aria-label="${k}">`;
  return `<div class="top-title">${t("panel.settings.t")}</div><div class="shop">` +
    row(t("set.music"), rng("music", CFG.music)) + row(t("set.sfx"), rng("sfx", CFG.sfx)) +
    row(t("set.gfx"), `<button type="button" class="tog on" data-act="gfx">${t("gfx." + gfx)}</button>`) +
    row(t("set.reduce"), tog("reduce", CFG.reduce)) + row(t("set.left"), tog("left", CFG.left)) + row(t("set.vib"), tog("vib", CFG.vib)) + `</div>`;
}
function showPanel(name) {
  curPanel = name;
  showOverlay({ shop: "🛒", missions: "📋", medals: "🏅", settings: "⚙️" }[name], t("panel." + name + ".t"), t("panel." + name + ".d"), t("back"), { panel: name });
}

/* ============ CHASE · TRAINS · HOVERBOARD · MYSTERY BOX ============ */
function compactInPlace(a, keep) { let j = 0; for (let i = 0; i < a.length; i++) if (keep(a[i])) a[j++] = a[i]; a.length = j; return a; }
function chaseBark() { beep(180, 0.1, "sawtooth", 0.06, -70); setTimeout(() => beep(160, 0.12, "sawtooth", 0.06, -60), 140); vib(30); }
function openBox(x, y) {
  const r = Math.random();
  burst(x, y, "#ff4fd8", 24); sfx.power();
  if (r < 0.3) { coins += 15; score += 150; pop(x, y - 14, "+◎15", "#ffd84f"); shout("+◎15", "#ffd84f", 800); }
  else if (r < 0.5) { shield = true; shout(t("pw.shield"), "#53f7ff", 900); }
  else if (r < 0.65) { turbo = 100; shout(t("box.turbo"), "#53f7ff", 1000); }
  else if (r < 0.8) { boardT = 9000; shout(t("pw.hover"), "#53f7ff", 1000); }
  else if (r < 0.92) { if (lives < maxLives) { lives++; cleanT = 0; } else shield = true; shout(t("pw.plov"), "#ffd84f", 1000); }
  else { coins += 60; score += 600; shout(t("box.jackpot", { n: 60 }), "#ffd84f", 1300); flash = { c: "#ffd84f", a: 0.3 }; zoom = 1.05; }
}
function drawTrain(o) {                       // metro car: its roof is a platform you can run on
  ctx.fillStyle = "#2f6fd1"; rr(o.x, o.y, o.w, o.h, 6); ctx.fill();
  ctx.fillStyle = "#e8eefc"; ctx.fillRect(o.x, o.y + o.h - 16, o.w, 4);
  ctx.fillStyle = "#9fd0ff";
  for (let wx = o.x + 20; wx < o.x + o.w - 22; wx += 26) { rr(wx, o.y + 11, 17, 14, 3); ctx.fill(); }
  ctx.fillStyle = "#1b3a7a"; rr(o.x, o.y + 5, 13, o.h - 11, 4); ctx.fill();
  ctx.fillStyle = "#fff7b0"; ctx.beginPath(); ctx.arc(o.x + 5, o.y + o.h - 9, 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#0e1124"; ctx.fillRect(o.x + 10, o.y + o.h - 3, o.w - 20, 3);
  ctx.fillStyle = "#cfe3ff"; ctx.fillRect(o.x + 3, o.y, o.w - 6, 3);
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.4; rr(o.x, o.y, o.w, o.h, 6); ctx.stroke();
}
function drawBoard() {
  if (boardT <= 0 || state === "ready") return;
  if (boardT < 2000 && Math.floor(frame / 4) % 2) return;
  const p = player, bx = p.x - 5, by = p.y + p.h - 2;
  halo(bx, by, p.w + 10, 6, 0, "#53f7ff");
  ctx.fillStyle = "#53f7ff"; rr(bx, by, p.w + 10, 5, 2.5); ctx.fill();
  ctx.fillStyle = "#12307a"; ctx.beginPath(); ctx.arc(bx + 7, by + 6, 2.6, 0, 7); ctx.arc(bx + p.w + 3, by + 6, 2.6, 0, 7); ctx.fill();
}
function drawChaser() {                       // the guard and his dog (the closer they are, the fewer lives you have)
  if (state === "ready" || chaseX < -70) return;
  const G = guardSheet(), D = dogSheet(), gy = groundY, gx = chaseX + 26;
  const close = lives === 1 || state === "over" || state === "revive";
  halo(chaseX - 8, gy - 56, 80, 56, 0, "#ff3b5c");
  const caught = state === "over" || state === "revive";
  ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(gx + 4, gy + 3, 22, 4.2, 0, 0, 7); ctx.fill();          // ground shadows
  if (lives < maxLives || caught) { ctx.beginPath(); ctx.ellipse(gx + 40, gy + 3, 24, 3.6, 0, 0, 7); ctx.fill(); }
  if (caught && bustT > 150) {                          // the officer swings: leans in hard, then back, once per bonk
    const ph = Math.max(0, (bustT - BUST_FIRST + BUST_EVERY * 0.7) % BUST_EVERY) / BUST_EVERY, swing = Math.sin(Math.min(1, ph * 1.15) * Math.PI);
    ctx.save(); ctx.translate(gx + 6, gy); ctx.rotate(0.03 + swing * (G.swing === undefined ? 0.42 : 0.2)); ctx.translate(-gx - 6, -gy);
    ctx.drawImage(G.f[G.swing === undefined ? 0 : G.swing], gx - G.fx * CPS, gy - G.fy * CPS, G.w * CPS, G.h * CPS);
    ctx.restore();
  } else ctx.drawImage(G.f[Math.floor((frame * 0.42 * (G.n || 8)) / 8) % (G.n || 8)], gx - G.fx * CPS, gy - G.fy * CPS, G.w * CPS, G.h * CPS);
  if (lives < maxLives || caught) {
    const dn = D.n || 8, ds = D.snarl === undefined ? 8 : D.snarl;
    const di = caught ? ds + (Math.floor(bustT / 70) % dn) : (Math.floor((frame * 0.55 * dn) / 8) % dn) + (close ? ds : 0);
    const hop = caught ? Math.abs(Math.sin(bustT / 110)) * 14 * CPS : 0;   // the dog jumps at the runner
    ctx.drawImage(D.f[di], gx + (caught ? 36 : 34) - D.fx * CPS, gy - hop - D.fy * CPS, D.w * CPS, D.h * CPS);
  }
}

/* ============ HELPERS ============ */
const duck = () => duckKey || duckPtr || duckBtn;
const comboMult = () => 1 + Math.min(4, Math.floor(combo / 5));
const mult = () => comboMult() * (fx.x2 > 0 ? 2 : 1);
const hit = (a, b, pad = 0) => a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h > b.y;
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const skinColors = () => {
  const s = SKINS.find((k) => k.id === skin) || SKINS[0];
  return [s.a || cur.a, s.b || cur.b];
};

const PPOOL = [];
function spawnP(x, y, vx, vy, sz, life, color) {
  const q = PPOOL.pop() || {};
  q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.s = sz; q.life = life; q.color = color; particles.push(q);
}
function burst(x, y, color, n = 12) {
  if (!FX.particles || particles.length > Q.maxP) return;
  if (CFG.reduce) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) spawnP(x, y, rnd(-3, 3), rnd(-4, 2), rnd(2, 5), 1, color);
}
function pop(x, y, s, color) { pops.push({ x, y, s, color, life: 1 }); }

/* ============ SPAWNING ============ */
const mkCoin = (x, y) => rollCoin(x, y);

function endlessTypes() {
  return score < 150 ? ["block"] : score < 250 ? ["block", "block", "drone"] : score < 400 ? ["block", "drone", "train", "block"] : ["block", "drone", "train", "double", "pit"];
}
function mkBlock(off) {                                  // returns the end offset (px) of what it placed
  const tall = Math.random() > 0.55, h = tall ? rnd(45, 65) : rnd(28, 42), w = tall ? rnd(30, 40) : rnd(34, 46), sx = W + 20 + off;
  const v = tall ? (Math.random() < 0.5 ? "crate" : "hazard") : (Math.random() < 0.5 ? "cones" : "hazard");
  obstacles.push({ t: "block", v, x: sx, y: groundY - h, w, h, passed: false, c: "#ff4fd8" });
  if (Math.random() < 0.55) for (let i = 0; i < 5; i++) items.push(mkCoin(sx + w / 2 + (i - 2) * 28, groundY - h - 28 - Math.sin((i / 4) * Math.PI) * 38));
  return off + w;
}
function mkDrone(off) {
  const y = groundY - 52, sx = W + 20 + off;
  obstacles.push({ t: "drone", x: sx, y, by: y, w: 44, h: 26, passed: false, c: "#ff7a59" });
  if (Math.random() < 0.7) for (let i = 0; i < 4; i++) items.push(mkCoin(sx + 8 + i * 26, groundY - 14));
  return off + 44;
}
function mkPit(off) {
  const w = rnd(95, 135), sx = W + 20 + off;
  obstacles.push({ t: "pit", x: sx, y: groundY, w, h: 60, passed: false, c: "#ff3b5c" });
  for (let i = 0; i < 5; i++) items.push(mkCoin(sx + w / 2 + (i - 2) * 26, groundY - 50 - Math.sin((i / 4) * Math.PI) * 45));
  return off + w;
}
function mkTrain(off) {
  const w = rnd(150, 210), h = 54, sx = W + 20 + off;
  obstacles.push({ t: "train", x: sx, y: groundY - h, w, h, passed: false, c: "#2f6fd1" });
  for (let i = 0; i < Math.floor(w / 28) - 1; i++) items.push(mkCoin(sx + 24 + i * 28, groundY - h - 16));
  if (!trainHint) { trainHint = true; if (!store.get("zr_trh", 0)) { store.set("zr_trh", 1); FX.hints && shout(t("train.hint"), "#9fd0ff", 2400); } }
  return off + w;
}
function spawnPattern() {                                // returns the length (px) of the pattern that was placed
  const types = lvl ? lvl.types : endlessTypes(), kind = types[Math.floor(Math.random() * types.length)];
  const jg = Math.max(4, speed) * 60 * 0.72 + 70;        // room to land, react, and jump or duck again
  if (kind === "train") return mkTrain(0);
  if (kind === "pit") return mkPit(0);
  if (kind === "drone") { const e = mkDrone(0); return skill > 0.55 && Math.random() < 0.4 ? mkBlock(e + jg * 0.8) : e; }
  if (kind === "double") { const e = mkBlock(0); return mkBlock(e + 75); }
  const e = mkBlock(0);
  return skill > 0.45 && Math.random() < 0.3 * skill ? mkBlock(e + jg) : e;
}
function gapFor(len) {                                   // distance-based: gaps grow with speed, so reaction time stays fair
  const s = Math.max(4, speed) * 60, mult = 1.28 - 0.55 * skill, g = lvl ? lvl.gap : DIFF[diff].gap;
  return len + s * 0.68 + 90 + rnd(40, 240) * mult * g;
}
function spawnShot(both) {
  const high = Math.random() < 0.5;
  const mk = (h, dx) => obstacles.push({ t: "shot", x: W - 150 + dx, y: h ? groundY - 50 : groundY - 26, w: 30, h: 16, passed: false, c: "#ff3b5c", sp: 1.45 });
  mk(high, 0);
  if (both) mk(!high, 120);
  burst(W - 150, groundY - 38, "#ffb36b", 6);
  beep(220, 0.08, "sawtooth", 0.03, -60);
}
function spawnPower() {
  const list = up.jet ? ["shield", "slow", "x2", "magnet", "plov", "hover", "hover", "fuel", "fuel"] : ["shield", "slow", "x2", "magnet", "plov", "hover", "hover"];
  const k = Math.random() < 0.2 ? "box" : list[Math.floor(Math.random() * list.length)];
  items.push({ k, x: W + 30, y: groundY - rnd(55, 110), r: 15 });
}

/* ============ ACTIONS ============ */
/* ============ JUMP — buffered · coyote time · variable height ============ */
const J = { BUFFER: 140, COYOTE: 90, GAP: 120, MIN_HOLD: 70 };      // ms
let jumpBuf = -1e9, lastJumpAt = -1e9, coyote = 0, jumpAge = 0, simT = 0;   // simT = simulated milliseconds
function resetInputs() { duckKey = duckPtr = duckBtn = jumpHeld = false; jumpBuf = -1e9; }
function startJump(n) {
  const p = player, jp = lvl && lvl.jump ? lvl.jump : [-13.4, -11.6];
  p.vy = n === 1 ? jp[0] : jp[1];
  p.jumps = n === 1 ? 1 : 0; p.grounded = false; coyote = 0; jumpAge = 0; lastJumpAt = simT;
  burst(p.x + p.w / 2, p.y + p.h, n === 1 ? "#53f7ff" : "#ff4fd8", n === 1 ? 8 : 6);
  sq = -0.3; n === 1 ? sfx.jump() : sfx.jump2();
}
function tryJump() {
  const p = player;
  if (p.grounded || coyote > 0) { startJump(1); return true; }
  if (p.jumps > 0) { startJump(2); return true; }                  // deliberate double jump
  return false;
}
function consumeJump() {                                           // runs inside every fixed physics step
  if (jumpBuf < -1e8) return;
  if (simT - jumpBuf > J.BUFFER) { jumpBuf = -1e9; return; }
  if (tryJump()) jumpBuf = -1e9;
}

/* ============ UPDATE ============ */
function scrollWorld(d, f = 1) {
  moveScenery(d, f);
  stars.forEach((s) => { s.x -= d * 0.05; if (s.x < 0) { s.x = W; s.y = rnd(0, groundY - 47); } });
  layers.forEach((L) => {
    L.b.forEach((b) => {
      b.x -= d * L.mul;
      if (b.x + b.w < 0) {
        let r = 0;
        for (const o of L.b) if (o.x + o.w > r) r = o.x + o.w;
        b.x = r + rnd(4, 16); b.w = rnd(L.wmin, L.wmax); b.h = rnd(L.hmin, L.hmax); b.seed = Math.random() * 99;
      }
    });
  });
}

function hurt(o) {
  const p = player;
  if (boardT > 0) {                                       // the hoverboard takes the hit
    boardT = 0; invul = 1000; shake = 7; freeze = 90; flash = { c: "#53f7ff", a: 0.25 };
    burst(p.x + 17, p.y + p.h, "#53f7ff", 20);
    if (o.t === "pit") { p.vy = -11; p.grounded = false; p.jumps = 1; } else o.x = -999;
    sfx.hit(); pop(p.x, p.y - 10, t("pop.boardBroke"), "#53f7ff");
    return false;
  }
  if (shield) {
    shield = false; invul = 900; shake = 9;
    burst(p.x + 17, p.y + 20, "#53f7ff", 24);
    if (o.t === "pit") { p.vy = -11; p.grounded = false; p.jumps = 1; } else o.x = -999;
    sfx.hit(); pop(p.x, p.y - 10, t("pop.shieldBroke"), "#53f7ff");
    freeze = 140; flash = { c: "#53f7ff", a: 0.3 }; zoom = 1.05;
    return false;
  }
  hits++; combo = 0; hitFlag = true;
  if (lives > 1) {
    lives--; cleanT = 0; invul = 1600; shake = 10; chaseBark();
    if (lives === 1 && maxLives > 1) setTimeout(() => { if (state === "play" && lives === 1) shout(t("chase.near"), "#ff6b8a", 1200); }, 800);
    burst(p.x + 17, p.y + 22, "#ff4fd8", 18);
    if (o.t === "pit") { p.vy = -12; p.grounded = false; p.jumps = 1; } else o.x = -999;
    sfx.hit(); pop(p.x, p.y - 12, "♥ " + lives, "#ff6b8a");
    freeze = 110; flash = { c: "#ff3b5c", a: 0.45 }; zoom = 1.06; shout(t("hurt"), "#ff6b8a", 700);
    return false;
  }
  endGame();
  return true;
}

function updateGame(delta) {
  const f = Math.min(delta / 16.67, 2);
  frame += f;

  fx.slow = Math.max(0, fx.slow - delta);
  fx.x2 = Math.max(0, fx.x2 - delta);
  fx.magnet = Math.max(0, fx.magnet - delta);
  WE_update(delta, f);
  invul = Math.max(0, invul - delta);
  if (boardT > 0) boardT -= delta;
  cleanT += delta;
  if (cleanT > 14000 && lives < maxLives) { lives++; cleanT = 0; toast(t("chase.back")); beep(500, 0.1, "triangle", 0.05); }
  if (turboT > 0) { turboT -= delta; if (turboT <= 0) { turboT = 0; turbo = 0; invul = Math.max(invul, 900); zoom = 1.04; } }
  if (maxLives > 1 && lives === 1) { hbT -= delta; if (hbT <= 0) { hbT = 900; beep(70, 0.12, "sine", 0.08); vib(10); } }
  banner.t = Math.max(0, banner.t - delta);

  const cfg = lvl || DIFF[diff];
  score += f * 0.12 * WE.score;
  speed = lvl ? lvl.base + (lvl.max - lvl.base) * Math.min(1, dist / lvl.len) : Math.min(cfg.base + score / 180, cfg.max);
  const ev = speed * (fx.slow > 0 ? 0.65 : 1) * (turboT > 0 ? 1.7 : 1) * WE.spd;
  runTime += delta; runDist += (ev * f) / PX_M;

  let T;
  if (lvl) { dist += (ev * f) / PX_M; T = THEMES[lvl.theme]; }
  else {
    const zone = Math.floor(score / 500) % 4;
    if (zone !== lastZone) { lastZone = zone; banner = { text: THEMES[zone].n, sub: t("newCity"), t: 2200, max: 2200 }; sfx.zone(); }
    T = THEMES[zone];
  }
  cur.wx = T.wx; cur.body = T.body; cur.night = T.night;
  if (cur.city !== T.city) { prevA = ART; prevLm = lm.x; fadeT = 1; cur.city = T.city; lm = { city: T.city, x: W + 420 }; decor = []; }
  if (!lvl && score % 500 > 380) { const nz = (Math.floor(score / 500) + 1) % 4; if (prefetched !== nz) { prefetched = nz; Art.getAsync(THEMES[nz].city, ARTOPT); } }
  if (cur.wx === "rain" && Math.random() < 0.0025) flash = { c: "#cfe0ff", a: 0.2 };
  if (cur.top !== T.top || cur.a !== T.a || cur.b !== T.b || cur.bot !== T.bot)
    ["top", "bot", "a", "b"].forEach((k) => (cur[k] = mix(cur[k], T[k], 0.04)));

  scrollWorld(ev * f, f);

  const p = player;
  let floorY = groundY;
  const pcx0 = p.x + p.w / 2;
  for (const o of obstacles) if (o.t === "train" && pcx0 > o.x + 3 && pcx0 < o.x + o.w - 3 && p.pb <= o.y + 10 && o.y < floorY) floorY = o.y;
  if (p.grounded && p.y + p.h < floorY - 0.6) { p.grounded = false; coyote = J.COYOTE; }   // the train ended: fall, but allow a late jump
  p.h = p.grounded && duck() ? 24 : 44;
  if (p.grounded) p.y = floorY - p.h;
  consumeJump();
  flying = !!up.jet && fuel > 0 && jumpHeld && !p.grounded && p.jumps <= 0;
  if (flying) {
    fuel = Math.max(0, fuel - delta); meta.flyMs += delta; mAdd("fly", delta / 1000);
    p.vy += ((duck() ? 4.5 : -3.8) - p.vy) * 0.18 * f;
    if (frame % 2 < f && particles.length < Q.maxP + 40)
      spawnP(p.x + 8 + rnd(0, 18), p.y + p.h, rnd(-0.6, 0.6), rnd(1.5, 3), rnd(3, 6), 0.8, Math.random() < 0.5 ? "#ffb36b" : "#ff4fd8");
  } else {
    let gm = duck() && !p.grounded ? 2.2 : 1;
    if (p.vy < 0) { jumpAge += delta; if (!jumpHeld && jumpAge > J.MIN_HOLD) gm = 1.6; }   // release early = shorter hop, never a useless one
    p.vy += p.g * gm * f;
  }
  p.y += p.vy * f;
  if (p.y < 12) { p.y = 12; if (p.vy < 0) p.vy = 0; }
  if (p.y + p.h >= floorY) {
    if (!p.grounded && p.vy > 3) { burst(p.x + p.w / 2, floorY, "#a78bfa", 5); sq = Math.min(0.45, p.vy / 30); landT = 110; }
    p.y = floorY - p.h; p.vy = 0; p.grounded = true; p.jumps = 2;
  } else p.grounded = false;
  p.pb = p.y + p.h;
  if (coyote > 0) coyote -= delta;
  if (landT > 0) landT -= delta;
  runPhase += Math.min(ev, 9) * f * 0.075;
  if (p.grounded && Q.level < 2 && frame % 6 < f) spawnP(p.x + 8, floorY - 1, -rnd(1.2, 2.4), -rnd(0.4, 1.2), rnd(2, 3.4), 0.5, "#c9b99a");
  if (p.grounded && fuel < fuelMax()) fuel = Math.min(fuelMax(), fuel + delta * 1.4);
  sq *= Math.pow(0.82, f);


  // stop spawning near the finish line so the last stretch is clear
  const spawning = lvl ? (lvl.len - dist) * PX_M > W * 0.95 : true;
  spawnPx += ev * f;
  if (spawning && spawnPx >= nextGapPx) { spawnPx = 0; nextGapPx = gapFor(spawnPattern()); }
  skillT += delta;                                       // dynamic difficulty: ease off after mistakes, tighten after clean play
  if (skillT > 8000) { skillT = 0; skill = Math.max(0.15, Math.min(1, skill + (hitFlag ? -0.14 : 0.07))); hitFlag = false; }
  if (fadeT > 0) fadeT = Math.max(0, fadeT - delta / 1800);
  itemTimer += delta;
  if (spawning && itemTimer >= nextItem) { spawnPower(); itemTimer = 0; nextItem = rnd(9000, 14000); }
  if (lvl && lvl.boss && spawning) {
    const hp = 1 - Math.min(1, dist / lvl.len), ph = hp < 0.34 ? 2 : hp < 0.67 ? 1 : 0;
    if (ph !== lastPhase) { lastPhase = ph; shout(ph === 2 ? t("boss.mad") : t("boss.stronger"), "#ff6b8a", 1600); flash = { c: "#ff3b5c", a: 0.25 }; zoom = 1.05; shake = 8; }
    shotTimer -= delta * (1 + ph * 0.3);
    if (shotTimer <= 0) { spawnShot(ph === 2 && Math.random() < 0.4); shotTimer = rnd(1100, 1700) * Math.max(0.7, 5.5 / speed); }
  }

  const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 };
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  for (const o of obstacles) {
    o.x -= ev * f * (o.sp || 1);
    if (o.t === "drone") o.y = o.by + Math.sin(frame * 0.1) * 4;
    if (turboT > 0 && o.t !== "pit" && o.x > -900 && hit(box, o, 0)) {
      const ox = o.x, oy = o.y; o.x = -999; score += 15; shake = 5;
      burst(ox + 10, oy + 10, "#53f7ff", 14); beep(300, 0.06, "square", 0.04); continue;
    }
    if (invul <= 0 && turboT <= 0) {
      if (o.t === "pit") {
        if (p.grounded && pcx > o.x + 6 && pcx < o.x + o.w - 6 && hurt(o)) return;
      } else if (hit(box, o, 3) && !(o.t === "train" && p.y + p.h <= o.y + 12)) { if (hurt(o)) return; }
      else if (o.t !== "train" && box.x - 7 < o.x + o.w && box.x + box.w + 7 > o.x && box.y - 7 < o.y + o.h && box.y + box.h + 7 > o.y) o.near = true;
    }
    if (!o.passed && o.x + o.w < p.x) {
      o.passed = true; addCombo(); turboAdd(2);
      const g = 10 * mult();
      score += g;
      pop(p.x + 20, p.y - 14, "+" + g, "#c7edff");
      if (o.near && o.t !== "pit") { score += 20; turboAdd(10); mAdd("near", 1); pop(p.x + 44, p.y - 36, t("pop.near"), "#ffd84f"); beep(1000, 0.07, "triangle", 0.04); }
    }
  }
  compactInPlace(obstacles, (o) => o.x + o.w > -10);

  for (const it of items) {
    it.x -= ev * f;
    if (it.k === "coin" && (fx.magnet > 0 || turboT > 0)) {
      const dx = pcx - it.x, dy = pcy - it.y, d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) { it.x += (dx / d) * 9 * f; it.y += (dy / d) * 9 * f; }
    }
    if (it.k === "coin" && up.pet) {
      const pd = Math.hypot(it.x - pet.x, it.y - pet.y);
      if (pd < 90 && pd > 1) { it.x += ((pet.x - it.x) / pd) * 5 * f; it.y += ((pet.y - it.y) / pd) * 5 * f; }
    }
    const grab = (Math.abs(it.x - pcx) < it.r + p.w / 2 - 3 && Math.abs(it.y - pcy) < it.r + p.h / 2 - 3) ||
      (it.k === "coin" && up.pet && Math.hypot(it.x - pet.x, it.y - pet.y) < it.r + 11);
    if (grab) {
      it.got = true;
      if (it.k === "coin") {
        coinCollect(it);
      } else {
        if (it.k === "shield") shield = true;
        else if (it.k === "fuel") fuel = fuelMax();
        else if (it.k === "plov") { if (lives < maxLives) { lives++; cleanT = 0; shout(t("plov1"), "#ffd84f", 1000); } else { shield = true; shout(t("plov2"), "#ffd84f", 1000); } }
        else if (it.k === "hover") { boardT = 9000; shout(t("pw.hover"), "#53f7ff", 900); }
        else if (it.k === "box") openBox(it.x, it.y);
        else fx[it.k] = POWER[it.k].dur + (it.k === "magnet" ? 3000 * up.mag : 0);
        burst(it.x, it.y, POWER[it.k].color, 18);
        sfx.power();
        pop(it.x, it.y - 12, t("pw." + it.k), POWER[it.k].color);
      }
    }
  }
  compactInPlace(items, (i) => !i.got && i.x > -30);

  if (lvl && dist >= lvl.len) { winLevel(); return; }
  updateParticles(delta);
  if (frame % 3 < f) updateHUD();
}

let bustT = 0, bustHit = 0;                       // "caught!" scene: time since the officer and the dog caught up with the runner
const BUST_FIRST = 360, BUST_EVERY = 240;         // ms until the first bonk, and between bonks
function updateBust(delta) {
  bustT += delta;
  const p = player;
  if (p.y + p.h < groundY - 1) p.y += Math.min(groundY - p.h - p.y, 6 * (delta / 16.67)); // the runner drops to the ground
  if (bustT >= BUST_FIRST + bustHit * BUST_EVERY && bustHit < 6) {
    bustHit++;
    sfx.bonk(); shake = Math.max(shake, 7);
    const hx = p.x + p.w / 2, hy = p.y - 8;
    burst(hx, hy, "#ffd84f", 10); burst(hx, hy, "#ffffff", 5);
    pop(hx + (bustHit % 2 ? -38 : 34), hy - 30 - (bustHit % 3) * 12, t("bust.hit"), bustHit % 2 ? "#ffd84f" : "#ff8ad8");
  }
}
function updateParticles(delta) {
  const f = delta / 16.67;
  if (state === "over" || state === "revive") updateBust(delta);
  for (const q of particles) { q.x += q.vx * f; q.y += q.vy * f; q.vy += 0.12 * f; q.life -= 0.025 * f; }
  { let j = 0; for (let i = 0; i < particles.length; i++) { const q = particles[i]; if (q.life > 0) particles[j++] = q; else if (PPOOL.length < 200) PPOOL.push(q); } particles.length = j; }
  for (const q of pops) { q.y -= 0.8 * f; q.life -= 0.018 * f; }
  compactInPlace(pops, (q) => q.life > 0);
  shake = Math.max(0, shake - 0.5 * f);
  flash.a = Math.max(0, flash.a - 0.03 * f);
  updateToast(delta);
  {
    const nearX = Math.max(22, player.x - 96), midX = Math.max(6, player.x - 175);
    const caught = state === "over" || state === "revive";
    const tx = caught ? player.x - 88 : lives >= maxLives ? -120 : lives === 1 ? nearX : midX;
    chaseX += (tx - chaseX) * Math.min(1, (caught ? 0.14 : 0.05) * f);   // when it is over they rush in faster
  }
  if (up.pet) { pet.x += (player.x - 34 - pet.x) * 0.12 * f; pet.y += (player.y - 18 + Math.sin(frame * 0.1) * 5 - pet.y) * 0.12 * f; }
  zoom = 1 + (zoom - 1) * Math.pow(0.9, f);
  shoutO.t = Math.max(0, shoutO.t - delta);
  if (state !== "play") sq *= Math.pow(0.82, f);
}

const hudEl = { score: $("score"), best: $("best"), speed: $("speed"), coins: $("coins") };
const hudLast = {};
function setHud(k, v) { if (hudLast[k] !== v) { hudLast[k] = v; hudEl[k].textContent = v; } }
function updateHUD() {
  setHud("score", fmt(score));
  setHud("best", fmt(Math.max(bests[bestKey()] || 0, state === "play" || state === "over" || state === "won" ? score : 0)));
  setHud("speed", ((speed * (fx.slow > 0 ? 0.65 : 1)) / 5).toFixed(1) + "x");
  setHud("coins", String(coins));
  const rdy = turbo >= 100 && turboT <= 0 && state === "play";
  if (rdy !== padRdy) { padRdy = rdy; $("padTurbo").classList.toggle("ready", rdy); }
}

/* ============ DRAW ============ */
function drawCity(A, lmx, a) {
  const sc = Math.max(1, Math.min(1.5, groundY / 292)), tw = Art.TW * sc;
  const fx0 = -(farOff * sc), mx0 = -(midOff * sc), fh = Art.FAR_H * sc, mh = Art.MID_H * sc;
  if (a < 1) ctx.globalAlpha = a;
  ctx.drawImage(A.far, fx0, groundY - fh, tw, fh);
  if (fx0 + tw < W) ctx.drawImage(A.far, fx0 + tw, groundY - fh, tw, fh);
  const ls = Math.min(1.45, (groundY - 14) / A.lmH), lw = A.lmW * ls, lh = A.lmH * ls;
  if (lmx + lw / 2 > 0 && lmx - lw / 2 < W) ctx.drawImage(A.lm, lmx - lw / 2, groundY - lh, lw, lh);
  ctx.drawImage(A.mid, mx0, groundY - mh, tw, mh);
  if (mx0 + tw < W) ctx.drawImage(A.mid, mx0 + tw, groundY - mh, tw, mh);
  ctx.fillStyle = A.gBase; ctx.fillRect(-20, groundY, W + 40, H - groundY + 24);
  for (let x = -(gndOff % Art.GW); x < W + Art.GW; x += Art.GW) ctx.drawImage(A.gnd, x, groundY, Art.GW, Art.GH);
  if (a < 1) ctx.globalAlpha = 1;
}
function drawBackground() {
  const A = artFor(cur.city || "tash");
  const key = cur.top + cur.bot + groundY + Q.flat;
  if (key !== skyKey) {
    skyKey = key;
    if (Q.flat) skyG = cur.top;
    else { const g = ctx.createLinearGradient(0, 0, 0, groundY); g.addColorStop(0, cur.top); g.addColorStop(0.6, mix(cur.top, cur.bot, 0.5)); g.addColorStop(1, cur.bot); skyG = g; }
  }
  ctx.fillStyle = skyG;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  if (cur.night) {
    ctx.fillStyle = "#c7edff";
    for (const s of stars) { ctx.globalAlpha = s.a; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
  }
  if (FX.blur && speed >= 8 && Q.level < 2 && state === "play") {
    ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.1; ctx.lineWidth = 1.5; ctx.beginPath();
    const n = Math.min(10, Math.floor((speed - 7) * 3));
    for (let i = 0; i < n; i++) { const x = W - ((frame * speed * 2.5 + i * 137) % (W + 140)), y = 14 + ((i * 53.7) % (groundY - 40)); ctx.moveTo(x, y); ctx.lineTo(x + 30 + speed * 4, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawSkyBody();
  if (Q.level < 2 && FX.bg) { drawClouds(); drawBirds(); }
  drawCity(A, lm.x, 1);
  if (fadeT > 0 && prevA && prevA !== A && prevA.far.width) drawCity(prevA, prevLm, fadeT);   // smooth city-to-city transition
  ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(-20, groundY, W + 40, 2);
}

// on-screen sprite scale: set in resize() (bigger on small / portrait phones); hitboxes stay the same                          // on-screen sprite scale (hitboxes stay the same)
const CSC = COARSE ? 1.5 : 2;                         // sprite density (phones use less memory)
let RUN = null, RUN_SKIN = "", GRD = null, DOGS = null, COINSP = null;
const BADGES = {}, OBST = {}, HEARTS = {};
/* real PNG characters (sprites.js) are used when enabled and loaded; otherwise the painted ones from chars.js */
const IMG = typeof Sprites !== "undefined" ? Sprites : { get: () => null, preload() {} };   // sprites.js missing? the game still runs with the painted characters
const RIGX = typeof Rig !== "undefined" ? Rig : null;          // rig.js: realistic skeleton characters (falls back to pictures / painted ones if it is missing)
const rigTry = (fn) => { try { return fn(); } catch (e) { return null; } };
const runnerSheet = () => (RIGX && rigTry(() => RIGX.runner(skin, CSC))) || IMG.get("runner", skin, CSC) || ((!RUN || RUN_SKIN !== skin) ? ((RUN = Chars.runner(skin, CSC)), (RUN_SKIN = skin), RUN) : RUN);
const badgeOf = (k) => BADGES[k] || (BADGES[k] = Chars.badge(POWER[k].icon, POWER[k].color, CSC));
const heartSprite = (f) => HEARTS[f] || (HEARTS[f] = Chars.heart(f, CSC));
const obstSprite = (v) => OBST[v] || (OBST[v] = Chars.obstacle(v, CSC));
const coinSheet = () => COINSP || (COINSP = (RIGX && rigTry(() => RIGX.coins(CSC))) || Chars.coins(CSC));
const guardSheet = () => (RIGX && rigTry(() => RIGX.guard(CSC))) || IMG.get("guard", "default", CSC) || GRD || (GRD = Chars.guard(CSC));
const dogSheet = () => (RIGX && rigTry(() => RIGX.dog(CSC))) || IMG.get("dog", "default", CSC) || DOGS || (DOGS = Chars.dogs(CSC));
IMG.preload();                                   // start loading the image characters while the menu is shown
function skinGlow() { const sk = SKINS.find((k) => k.id === skin) || SKINS[0]; return sk.b || cur.b; }
function playerFrame() {                              // rig: 0-11 stride · 12 jump · 13 fall · 14 land · 15 slide · 16 hit  (painted: 0-7 · 8 · 9 · 10 · 11 · 12)
  const R = runnerSheet(), n = R.n || 8, F = R.n ? R : { jump: 8, fall: 9, land: 10, duck: 11, hit: 12 };
  if (state === "over" || state === "revive") return F.hit;
  const p = player;
  if (!p.grounded) return flying || p.vy < -1 ? F.jump : F.fall;
  if (landT > 0) return F.land;
  if (p.h < 40) return F.duck;
  return Math.floor((runPhase * n) / 8) % n;
}
function drawPlayer() {
  const p = player, R = runnerSheet(), pb = skinGlow();
  const sy = p.grounded ? p.y + p.h : groundY, hg = Math.max(0, sy - (p.y + p.h));
  if (FX.shadow) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, sy + 3, Math.max(10, 26 - hg * 0.07), 5, 0, 0, 7); ctx.fill(); }
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h);
  ctx.scale(1 + sq * 0.5, 1 - sq * 0.5);                // squash & stretch
  if ((state === "over" || state === "revive") && bustT > 0) {       // being bonked: the runner wobbles and squashes with every hit
    const since = (bustT - BUST_FIRST) % BUST_EVERY, kick = bustT >= BUST_FIRST ? Math.max(0, 1 - since / 150) : 0;
    ctx.rotate(Math.sin(bustT / 55) * 0.05 * (0.4 + kick) - kick * 0.08);
    ctx.scale(1 + kick * 0.1, 1 - kick * 0.12);
  }
  ctx.globalAlpha = invul > 0 && Math.floor(frame / 3) % 2 ? 0.35 : 1;
  if (FX.charFx) halo(-p.w / 2, -p.h, p.w, p.h, 8, pb);
  if (FX.charFx) glow(pb, 20);
  ctx.drawImage(R.f[playerFrame()], -R.fx * PS, -R.fy * PS, R.w * PS, R.h * PS);
  noGlow(); ctx.globalAlpha = 1;
  if (shield) {
    ctx.strokeStyle = "#53f7ff"; ctx.lineWidth = 2;
    glow("#53f7ff", 16);
    ctx.globalAlpha = 0.6 + Math.sin(frame * 0.2) * 0.25;
    ctx.beginPath(); ctx.ellipse(0, -p.h / 2, 34, p.h / 2 + 12, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; noGlow();
  }
  ctx.restore();
  if ((state === "over" || state === "revive") && bustT > BUST_FIRST - 80) {      // dizzy stars circling the runner's head
    ctx.fillStyle = "#ffd84f"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.round(15 * UI)}px sans-serif`;
    for (let i = 0; i < 3; i++) { const a = bustT / 170 + (i * Math.PI * 2) / 3; ctx.fillText("★", p.x + p.w / 2 + Math.cos(a) * 26, p.y - 22 + Math.sin(a) * 7); }
  }
  drawBoard();
  drawFuelBar();
  if (FX.charFx) { drawPet(); drawTurboFx(); }
}

function drawFuelBar() {
  if (!up.jet || state !== "play" || (!flying && fuel >= fuelMax() - 1)) return;
  const p = player, w = 44, x = p.x + p.w / 2 - w / 2, y = p.y - 14, pr = fuel / fuelMax();
  ctx.fillStyle = "rgba(10,14,34,.75)"; rr(x - 1, y - 1, w + 2, 7, 4); ctx.fill();
  ctx.fillStyle = pr < 0.25 ? "#ff3b5c" : "#ffb36b"; if (pr > 0.02) { rr(x, y, w * pr, 5, 3); ctx.fill(); }
}

function stripes(x, y, w, h, c1, c2, sw) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h); ctx.fillStyle = c2;
  for (let k = -h; k < w + h; k += sw * 2) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + sw, y + h); ctx.lineTo(x + k + sw + h, y); ctx.lineTo(x + k + h, y); ctx.fill(); }
  ctx.restore();
}
function drawObstacles() {
  const blink = Math.floor(frame / 14) % 2;
  for (const o of obstacles) {
    if (o.t === "pit") {
      ctx.fillStyle = "#02030a"; ctx.fillRect(o.x, groundY - 1, o.w, H - groundY + 24);
      stripes(o.x - 6, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5); stripes(o.x + o.w, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5);
      continue;
    }
    if (o.t === "train") { drawTrain(o); continue; }
    halo(o.x, o.y, o.w, o.h, 0, "#ff3b5c");
    glow("#ff3b5c", 14);
    if (o.t === "block") {
      ctx.drawImage(obstSprite(o.v || "hazard"), o.x, o.y, o.w, o.h); noGlow();
      if (o.v !== "cones") { ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a"; ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y - 4, 3.2, 0, 7); ctx.fill(); }
    } else if (o.t === "drone") {
      ctx.fillStyle = "#3a1226"; rr(o.x, o.y, o.w, o.h, 11); ctx.fill(); noGlow();
      ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#12040a"; rr(o.x + 7, o.y + 8, o.w - 14, 8, 4); ctx.fill();
      ctx.fillStyle = "#ff3b3b"; ctx.fillRect(o.x + o.w / 2 - 3 + Math.sin(frame * 0.2) * 9, o.y + 10, 6, 4);
      ctx.strokeStyle = "#ffd0c0"; ctx.lineWidth = 2; const s = Math.sin(frame * 1.2) * 12;
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2 - s, o.y - 4); ctx.lineTo(o.x + o.w / 2 + s, o.y - 4); ctx.stroke();
      ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a"; ctx.beginPath(); ctx.arc(o.x + 5, o.y + 3, 2.4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "#ff5a3c"; rr(o.x, o.y, o.w, o.h, 8); ctx.fill(); noGlow();
      ctx.fillStyle = "#ffd08a"; rr(o.x + 6, o.y + 4, o.w - 12, o.h - 8, 4); ctx.fill();
      ctx.fillStyle = "#ffb36b"; ctx.globalAlpha = 0.55; ctx.fillRect(o.x + o.w, o.y + 4, 16 + Math.sin(frame) * 4, 8); ctx.globalAlpha = 1;
    }
    noGlow();
  }
}

function drawItems() {
  const CN = coinSheet();
  for (const it of items) {
    if (it.k === "coin" && it.ct) {
      const fr = coinTypeSheets()[it.ct], sz = it.ct === 3 ? 40 : 34;
      if (FX.coinGlow) halo(it.x - it.r, it.y - it.r, it.r * 2, it.r * 2, 0, COIN_T[it.ct].col);
      ctx.drawImage(fr[Math.floor(frame * (it.ct === 2 ? 0.26 : 0.18) + it.x * 0.05) % fr.length], it.x - sz / 2, it.y - sz / 2, sz, sz);
    } else if (it.k === "coin") {
      if (FX.coinGlow) halo(it.x - it.r, it.y - it.r, it.r * 2, it.r * 2, 0, "#ffd84f");
      ctx.drawImage(CN.n[Math.floor(frame * 0.18 + it.x * 0.05) % CN.n.length], it.x - 13, it.y - 13, 26, 26);
    } else {
      const bob = Math.sin(frame * 0.1 + it.x) * 3;
      if (FX.coinGlow) halo(it.x - it.r, it.y - it.r + bob, it.r * 2, it.r * 2, 0, POWER[it.k].color);
      ctx.drawImage(badgeOf(it.k), it.x - 19, it.y + bob - 19, 38, 38);
    }
  }
}
function drawParticles() {
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, q.s, q.s);
  }
  ctx.globalAlpha = 1;
  if (pops.length) {
    ctx.font = `700 ${Math.round(13 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const q of pops) { ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.color; ctx.fillText(q.s, q.x, q.y); }
    ctx.globalAlpha = 1;
  }
}

function drawFinish() {
  if (!lvl) return;
  const gx = player.x + (lvl.len - dist) * PX_M;
  if (gx > W + 80) return;
  ctx.fillStyle = "#fff"; ctx.fillRect(gx, groundY - 112, 6, 112); ctx.fillRect(gx + 104, groundY - 112, 6, 112);
  for (let i = 0; i < 11; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? "#fff" : "#10142c";
    ctx.fillRect(gx + 6 + i * 9, groundY - 112 + j * 12, 9, 12);
  }
  ctx.fillStyle = cur.a; ctx.globalAlpha = 0.25; ctx.fillRect(gx + 6, groundY - 88, 98, 88); ctx.globalAlpha = 1;
  ctx.font = `700 ${Math.round(12 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff"; ctx.fillText(t("hud.finish"), gx + 55, groundY - 60);
}

function drawBoss() {
  if (!(lvl && lvl.boss) || state === "ready" || state === "won") return;
  const bw = 120, bh = 86, x = W - 78, y = H * 0.34 + Math.sin(frame * 0.05) * 12;
  const charging = state === "play" && shotTimer < 350;
  halo(x - bw / 2, y - bh / 2, bw, bh, 22, "#ff3b5c");
  glow("#ff3b5c", 26);
  ctx.fillStyle = grad(x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2, "#ff3b5c", "#5a0f24");
  rr(x - bw / 2, y - bh / 2, bw, bh, 22); ctx.fill();
  noGlow();
  ctx.fillStyle = "#12040a"; rr(x - bw / 2 + 14, y - 16, bw - 28, 22, 10); ctx.fill();
  ctx.fillStyle = charging ? "#fff" : "#ffb36b";
  ctx.beginPath(); ctx.arc(x + Math.sin(frame * 0.08) * 22, y - 5, 6, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a0a14"; ctx.fillRect(x - bw / 2 - 16, y + 8, 22, 14);
  if (charging) { ctx.fillStyle = "#ffb36b"; ctx.beginPath(); ctx.arc(x - bw / 2 - 16, y + 15, 8 + Math.sin(frame) * 2, 0, 7); ctx.fill(); }
  ctx.strokeStyle = "#ffb36b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 20, y - bh / 2); ctx.lineTo(x - 28, y - bh / 2 - 14); ctx.moveTo(x + 20, y - bh / 2); ctx.lineTo(x + 28, y - bh / 2 - 14); ctx.stroke();
}

function drawDark() {
  if (!(lvl && lvl.dark) || state === "ready") return;
  const cx = player.x + W * 0.16, cy = groundY - 50, r = W * 0.55;
  const k = cx + "|" + cy + "|" + r + "|" + Q.flat;
  if (k !== darkKey) {
    darkKey = k;
    if (Q.flat) darkG = "rgba(0,0,0,.5)";
    else {
      const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.6, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,.94)");
      darkG = g;
    }
  }
  ctx.fillStyle = darkG; ctx.fillRect(-20, -20, W + 40, H + 40);
}

function drawHUD() {
  const u = UI, m = 14 * u;
  ctx.textBaseline = "middle";
  let row = m + 8 * u;
  if (state !== "ready") {                                    // health: slim segmented bar (one segment per life)
    const segs = Math.min(maxLives, 6), sw = (segs > 3 ? 20 : 28) * u, sh = 7 * u, gp = 3 * u, by = row + 9 * u;
    ctx.textAlign = "left"; ctx.font = `700 ${Math.round(8.5 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillText(t("hud.health"), m, row);
    for (let i = 0; i < segs; i++) {
      const x = m + i * (sw + gp);
      ctx.fillStyle = "rgba(0,0,0,.6)"; rr(x - 1.2 * u, by - 1.2 * u, sw + 2.4 * u, sh + 2.4 * u, 2 * u); ctx.fill();
      if (i < lives) {
        ctx.fillStyle = lives === 1 && maxLives > 1 ? (Math.floor(frame / 18) % 2 ? "#ff3b3b" : "#ff9a9a") : lives / maxLives < 0.67 ? "#ffd34a" : "#46e08c";
        rr(x, by, sw, sh, 1.6 * u); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(x, by, sw, sh * 0.38);
      } else { ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; rr(x, by, sw, sh, 1.6 * u); ctx.stroke(); }
    }
    row = by + sh + 13 * u;
  }
  if (combo >= 2 && state !== "ready") {
    ctx.textAlign = "left"; ctx.font = `700 ${Math.round(14 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = mult() > 1 ? "#ffd84f" : "#c7edff";
    ctx.fillText(t("hud.combo") + " " + combo + "  ×" + mult(), m, row);
  }
  if (state === "play" || state === "pause") {
    const bw = 110 * u, ty = row + 20 * u, pr = turboT > 0 ? turboT / TURBO_MS : turbo / 100;
    ctx.fillStyle = "rgba(10,14,34,.7)"; rr(m, ty - 4 * u, bw, 8 * u, 4 * u); ctx.fill();
    ctx.fillStyle = turboT > 0 ? "#fff" : turbo >= 100 ? "#53f7ff" : "#3b8fa0";
    if (pr > 0.02) { rr(m, ty - 4 * u, bw * pr, 8 * u, 4 * u); ctx.fill(); }
    ctx.textAlign = "left"; ctx.font = `600 ${Math.round(9 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(turboT > 0 ? "TURBO!" : turbo >= 100 ? t("hud.turboReady") : t("hud.turbo"), m + bw + 6 * u, ty);
  }
  // level progress / boss health
  if (lvl && state !== "ready") {
    const bw = Math.min(W * 0.34, 300), x0 = (W - bw) / 2, y0 = m, pr = Math.min(1, dist / lvl.len);
    ctx.fillStyle = "rgba(10,14,34,.7)"; rr(x0, y0, bw, 9 * u, 5 * u); ctx.fill();
    ctx.fillStyle = lvl.boss ? "#ff3b5c" : cur.a;
    const fw = lvl.boss ? bw * (1 - pr) : bw * pr;
    if (fw > 2) { rr(x0, y0, fw, 9 * u, 5 * u); ctx.fill(); }
    ctx.textAlign = "center"; ctx.font = `600 ${Math.round(10 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.fillStyle = "#c7edff";
    ctx.fillText(lvl.boss ? "ZUMARY-X" : `${Math.min(lvl.len, Math.floor(dist))} / ${lvl.len} m`, W / 2, y0 + 20 * u);
  }
  let x = W - m;
  ctx.textAlign = "center";
  const list = [];
  if (shield) list.push(["shield", 1]);
  if (boardT > 0) list.push(["hover", boardT / 9000]);
  for (const k of ["slow", "x2", "magnet"]) if (fx[k] > 0) list.push([k, fx[k] / POWER[k].dur]);
  for (const [k, pct] of list) {
    const P = POWER[k], bw = 36 * u, bh = 30 * u;
    x -= bw + 4 * u;
    ctx.fillStyle = "rgba(10,14,34,.75)"; rr(x, m - 4 * u, bw, bh, 8 * u); ctx.fill();
    ctx.drawImage(badgeOf(k), x + bw / 2 - 12 * u, m - 4 * u + 2 * u, 24 * u, 24 * u);
    ctx.fillStyle = P.color;
    ctx.fillRect(x + 5 * u, m - 4 * u + bh - 6 * u, (bw - 10 * u) * Math.min(1, pct), 3 * u);
  }
  if (state === "play" && maxLives > 1 && (lives < maxLives || chaseX > -70)) {          // wanted level: stars light up as the police close in
    const lit = Math.min(5, maxLives - lives + 1), sz = Math.round(15 * u), flash2 = lives === 1 && Math.floor(frame / 16) % 2;
    ctx.textAlign = "right"; ctx.font = `700 ${sz}px sans-serif`; ctx.textBaseline = "middle";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < lit ? (lives === 1 ? (flash2 ? "#ff4a5a" : "#4a8bff") : "#ffd84f") : "rgba(255,255,255,.2)";
      ctx.fillText("★", W - m - (4 - i) * (sz + 1 * u) + 0, m + 42 * u);
    }
  }
  if (banner.t > 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, banner.t / 500, (banner.max - banner.t) / 300 + 0.2));
    ctx.fillStyle = cur.a; glow(cur.a, 20);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(26 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(banner.text, W / 2, H * 0.3);
    ctx.font = `500 ${Math.round(11 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(banner.sub || "", W / 2, H * 0.3 + 28 * u);
    noGlow(); ctx.globalAlpha = 1;
  }
  if (shoutO.t > 0) {
    const el = shoutO.max - shoutO.t, k = el < 180 ? 1 + 0.5 * (1 - el / 180) : 1;
    ctx.globalAlpha = Math.min(1, shoutO.t / 350);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(Math.min(30 * u, (W * 0.92) / (shoutO.text.length * 0.78)) * k)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = shoutO.c; glow(shoutO.c, 18);
    ctx.fillText(shoutO.text, W / 2, H * 0.5);
    noGlow(); ctx.globalAlpha = 1;
  }
  if (toastO.t > 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, toastO.t / 300, (toastO.max - toastO.t) / 200 + 0.1));
    ctx.font = `700 ${Math.round(12 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    const tw = ctx.measureText(toastO.text).width + 26 * u, ty = (lvl && state !== "ready" ? 44 : 16) * u;
    ctx.fillStyle = "rgba(10,14,34,.88)"; rr(W / 2 - tw / 2, ty, tw, 26 * u, 13 * u); ctx.fill();
    ctx.fillStyle = "#ffd84f"; ctx.textAlign = "center"; ctx.fillText(toastO.text, W / 2, ty + 13.5 * u);
    ctx.globalAlpha = 1;
  }
}

/* ============ CINEMATIC LAYER (colour grade, vignette, bloom, speed lines, BUSTED) ============ */
let VIG = null, VIGK = "", BLM = null;
function gradeSprite() {                          // one small canvas, stretched over the screen: warm sky, cool ground, dark corners
  const k = Math.round(W) + "x" + Math.round(H);
  if (VIGK !== k) {
    VIGK = k;
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = Math.max(40, Math.round((128 * H) / W));
    const g = cv.getContext("2d"), r = Math.hypot(cv.width, cv.height) / 2;
    const lg = g.createLinearGradient(0, 0, 0, cv.height);
    lg.addColorStop(0, "rgba(255,150,70,.15)"); lg.addColorStop(0.55, "rgba(255,150,70,0)"); lg.addColorStop(1, "rgba(30,110,150,.17)");
    g.fillStyle = lg; g.fillRect(0, 0, cv.width, cv.height);
    const gr = g.createRadialGradient(cv.width / 2, cv.height * 0.55, r * 0.34, cv.width / 2, cv.height * 0.55, r * 1.02);
    gr.addColorStop(0, "rgba(8,6,20,0)"); gr.addColorStop(1, "rgba(8,6,20,.58)");
    g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    VIG = cv;
  }
  return VIG;
}
function speedLines() {
  const k = Math.min(1, Math.max(0, (speed - 6) / 6) + (turboT > 0 ? 0.55 : 0) + (WE.kind === "speed" ? 0.5 : 0));
  if (!FX.blur || k < 0.03 || state !== "play" || CFG.reduce || Q.level >= 2) return;
  const n = Math.round(4 + k * 8);
  ctx.fillStyle = "#fff6e6";
  for (let i = 0; i < n; i++) {
    const x = W - ((runPhase * 60 * (1 + (i % 4) * 0.45) + i * 173) % (W + 260)), y = 14 + ((i * 67) % Math.max(60, groundY - 26)), len = 70 + (i % 3) * 55;
    ctx.globalAlpha = 0.05 + 0.1 * k * (0.5 + (i % 3) * 0.25); ctx.fillRect(x, y, len, 1.3);
  }
  ctx.globalAlpha = 1;
}
function bloomPass() {                              // soft glow: shrink the picture, stretch it back on top with "screen"
  if (!FX.bloom || Q.level > 1 || CFG.reduce) return;
  const bw = 160, bh = Math.max(40, Math.round((bw * canvas.height) / canvas.width));
  if (!BLM) { BLM = document.createElement("canvas"); BLM.g = BLM.getContext("2d"); }
  if (BLM.width !== bw || BLM.height !== bh) { BLM.width = bw; BLM.height = bh; }
  BLM.g.drawImage(canvas, 0, 0, bw, bh);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.2;
  ctx.drawImage(BLM, 0, 0, canvas.width, canvas.height); ctx.restore();
}
function drawBusted() {
  if (!(state === "over" || state === "revive") || bustT <= 0 || !$("overlay").classList.contains("hidden")) return;
  const k = Math.min(1, bustT / 280), bar = H * 0.115 * k;
  ctx.fillStyle = "rgba(8,10,26," + (0.34 * k) + ")"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  if (bustT < 380) return;
  const e = Math.min(1, (bustT - 380) / 240), sc = 1 + (1 - e) * 0.7, u = UI;
  ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc); ctx.globalAlpha = e;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(Math.min(58 * u, (W * 0.8) / Math.max(6, t("bust.caught").length * 0.8)))}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
  ctx.lineJoin = "round"; ctx.lineWidth = 6 * u; ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.strokeText(t("bust.caught"), 2, 3);
  ctx.fillStyle = "#f1f2f7"; ctx.fillText(t("bust.caught"), 0, 0);
  ctx.font = `600 ${Math.round(11 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.fillStyle = "#ff6b84";
  ctx.fillText(t("bust.sub"), 0, 34 * u);
  ctx.restore();
}
function drawCinema() {
  if (CFG.reduce && Q.level >= 1) return;
  if (FX.light && !Q.flat && Q.level < 3) ctx.drawImage(gradeSprite(), 0, 0, W, H);
  speedLines();
}

function draw() {
  ctx.save();
  if (shake > 0 && FX.shake > 0 && !CFG.reduce) { const sh = shake * FX.shake; ctx.translate(rnd(-sh, sh), rnd(-sh, sh)); }
  if (zoom > 1.002 && FX.cam && !CFG.reduce) { ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2); }
  drawBackground(); WE_drawBack(); drawFinish(); drawBoss(); drawItems(); drawParticles(); drawObstacles(); drawChaser(); drawPlayer(); WE_drawFront(); if (FX.env) drawWeather(); if (FX.light) drawDark();
  ctx.restore();
  drawCinema(); bloomPass(); drawBusted();
  if (flash.a > 0.01 && FX.cam && !CFG.reduce) { ctx.globalAlpha = flash.a; ctx.fillStyle = flash.c; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (maxLives > 1 && lives === 1 && state === "play") {
    ctx.strokeStyle = "#ff3b5c"; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(frame * 0.18); ctx.lineWidth = 10 * UI;
    ctx.strokeRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  drawHUD();
}

/* ============ OVERLAY / MENU ============ */
const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const bestKey = () => (lvl ? "L" + (sel + 1) : diff);
function renderTop() {
  if (!board.length) return `<div class="top-title">${t("top.head")}</div><p>${t("top.empty")}</p>`;
  return `<div class="top-title">${t("top.best5")}</div><ol class="top">` +
    board.map((r, i) => `<li><span>${i + 1}.</span><b>${fmt(r.s)}</b><em>${DIFF[r.d] ? DIFF[r.d].name : ""}</em></li>`).join("") + `</ol>`;
}
function renderSkins() {
  return `<div class="top-title">${t("skins.title", { w: wallet })}</div><div class="skins">` +
    SKINS.map((s) => {
      const has = owned.includes(s.id);
      return `<button type="button" data-s="${s.id}" class="${skin === s.id ? "on" : ""}${has ? "" : " lock"}" style="--c:${s.a || "#53f7ff"}"><i></i>${s.n}${has ? "" : `<small>◎${s.cost}</small>`}</button>`;
    }).join("") + `</div>`;
}
const THUMBS = {};
Art.cities.forEach((c) => { const v = store.get("zr_th3_" + c, null); if (v) THUMBS[c] = v; });
function buildThumbs() {
  const list = Art.cities.filter((c) => !THUMBS[c]);
  const cur0 = LEVELS[sel] ? THEMES[LEVELS[sel].theme].city : null;
  if (cur0 && list.includes(cur0)) { list.splice(list.indexOf(cur0), 1); list.unshift(cur0); }
  const next = () => {
    const c = list.shift();
    if (!c) return;
    Art.thumb(c, (url) => {
      THUMBS[c] = url; store.set("zr_th3_" + c, url);
      if (state === "ready" && !shopOpen && screenFn) screenFn();
      setTimeout(next, 40);
    });
  };
  next();
}
function renderLevels() {
  return `<div class="top-title">${t("cities.title")}</div><div class="levels">` +
    LEVELS.map((L, i) => {
      const locked = i >= prog.unlocked, th = THUMBS[THEMES[L.theme].city];
      const bg = th ? `style="background-image:linear-gradient(180deg,rgba(5,7,22,.1),rgba(5,7,22,.88)),url(${th})"` : "";
      return `<button type="button" data-l="${i}" ${bg} class="${i === sel ? "on" : ""}${locked ? " lock" : ""}"><b>${locked ? "🔒" : i + 1}</b><span>${L.name}</span><small>${locked ? "&nbsp;" : starText(prog.stars[i + 1] || 0)}</small></button>`;
    }).join("") + `</div>`;
}
function renderShop() {
  return `<div class="top-title">${t("shop.title", { w: wallet })}</div><div class="shop">` +
    SHOP.map((it) => {
      const lv = up[it.k] || 0, maxed = lv >= it.max, cost = it.cost[lv];
      return `<div class="shop-row"><div><b>${it.n}${it.max > 1 ? ` ${lv}/${it.max}` : ""}</b><small>${it.d}</small></div><button type="button" data-u="${it.k}" class="${maxed ? "done" : wallet >= cost ? "" : "lock"}">${maxed ? "✓" : "◎" + cost}</button></div>`;
    }).join("") + `</div>`;
}
function showOverlay(icon, title, text, btn, o = {}) {
  $("oIcon").textContent = icon;
  $("oTitle").textContent = title;
  $("oText").innerHTML = text;
  $("startButton").textContent = btn;
  $("mode").style.display = o.menu ? "flex" : "none";
  $("diff").style.display = o.menu && mode === "endless" ? "flex" : "none";
  $("levelBox").innerHTML = o.menu && mode === "campaign" ? renderLevels() : "";
  $("skinBox").innerHTML = o.skins ? renderSkins() : "";
  $("topBox").innerHTML = o.top && mode === "endless" ? renderTop() : "";
  $("menuButton").style.display = o.menuBtn ? "flex" : "none";
  $("nav").style.display = o.menu || o.panel ? "flex" : "none";
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.p === (o.panel || "play")));
  $("dailyBox").innerHTML = o.menu ? renderDaily() : "";
  $("shopBox").innerHTML = o.panel === "shop" ? renderShop() : o.panel === "missions" ? renderMissions() : o.panel === "medals" ? renderMedals() : o.panel === "settings" ? renderSettings() : "";
  $("shareButton").style.display = o.share ? "flex" : "none";
  $("menuButton").textContent = o.menuLabel || t("menuBtn");
  shopOpen = !!o.panel;
  $("overlay").classList.remove("hidden");
  paintDiff();
}
function paintDiff() {
  document.querySelectorAll("#diff button").forEach((b) => b.classList.toggle("on", b.dataset.d === diff));
  document.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
}
function showReady() {
  const render = () => {
    if (mode === "campaign") {
      const L = LEVELS[sel];
      showOverlay("✦", t("ready.title", { n: sel + 1, name: L.name }),
        t("ready.text", { tag: L.tag, len: L.len, coins: L.coins, fact: pick(FACTS[THEMES[L.theme].city]) }),
        t("ready.btn", { n: sel + 1 }), { menu: true, skins: true });
    } else {
      showOverlay("✦", t("endless.title"), t("endless.text"), t("endless.btn"), { menu: true, skins: true, top: true });
    }
  };
  screenFn = render; render();
}

/* ============ FLOW ============ */
function resetGame() {
  state = "ready"; WE_reset();
  lvl = mode === "campaign" ? LEVELS[sel] : null;
  dist = 0; hits = 0; maxLives = (lvl ? 3 : 2) + up.life; lives = maxLives; shotTimer = 1500; cleanT = 0; boardT = 0; chaseX = -120; extraGap = 0;
  spawnPx = 0; nextGapPx = 380; skill = 0.5; skillT = 0; hitFlag = false; runTime = 0; runDist = 0; runPhase = 0; landT = 0; coyote = 0; jumpBuf = -1e9; fadeT = 0; prevA = null; acc = 0;
  fuel = fuelMax(); flying = false; sq = 0; zoom = 1; freeze = 0; flash.a = 0; shoutO.t = 0; lastPhase = 0; hbT = 0; turbo = 0; turboT = 0; revived = false; pet.x = player.x - 34; pet.y = player.y - 18;
  score = 0; speed = (lvl || DIFF[diff]).base; frame = 0; coins = 0; combo = 0; shake = 0; invul = 0; shield = !!up.sh;
  banner = { text: "", sub: "", t: 0, max: 1 }; lastZone = 0; cur = { ...THEMES[lvl ? lvl.theme : 0] }; skyKey = "";
  fx = { slow: 0, x2: 0, magnet: 0 };
  obstacles = []; items = []; particles = []; pops = [];
  obstacleTimer = 0; nextObstacle = 1000; itemTimer = 0; nextItem = rnd(8000, 12000);
  Object.assign(player, { y: groundY - 44, h: 44, vy: 0, g: lvl && lvl.g ? lvl.g : 0.65, grounded: true, jumps: 2, pb: groundY, trail: [] });
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  buildWorld();
  updateHUD();
}
function startGame() {
  if (state === "play") return;
  if (state === "over" || state === "ready" || state === "won") resetGame();
  resetInputs(); acc = 0; state = "play"; lastT = 0; fpsAcc = 0; fpsN = -15;
  if (COARSE && !fsOn) setFs(true);
  if (lvl) banner = { text: t("banner.level", { n: sel + 1 }), sub: lvl.name + " · " + lvl.tag, t: 2800, max: 2800 };
  $("overlay").classList.add("hidden");
  beep(660, 0.1, "triangle");
  startMusic();
  if (up.jet && !store.get("zr_jh", 0)) { store.set("zr_jh", 1); FX.hints && shout(t("jet.hint"), "#ffb36b", 3400); }
}
function goMenu() { resetGame(); showReady(); }
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  resetInputs();
  screenFn = () => showOverlay("❚❚", t("pause.title"), t("pause.text"), t("pause.btn"), { menuBtn: true });
  screenFn();
}
function resumeGame() {
  if (state !== "pause") return;
  resetInputs(); state = "play"; lastT = 0; acc = 0; fpsAcc = 0; fpsN = -20; invul = Math.max(invul, 1200);   // short grace after a pause
  $("overlay").classList.add("hidden");
  startMusic();
}
function saveBest() {
  const s = Math.floor(score), k = bestKey(), isBest = s > (bests[k] || 0);
  if (isBest) { bests[k] = s; store.set("zr_bests", bests); }
  return isBest;
}

function endGame() {
  if (state === "over" || state === "revive") return;
  bustT = 0; bustHit = 0;
  shake = 12; sfx.hit(); zoom = 1.06; flash = { c: "#ff3b5c", a: 0.4 };
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  burst(player.x + player.w / 2, player.y + player.h / 2, "#ff4fd8", 35);
  if (!revived && wallet >= REVIVE_COST && (lvl || score > 120)) {
    state = "revive";
    setTimeout(() => {
      if (state !== "revive") return;
      screenFn = () => showOverlay("♥", t("revive.title"), t("revive.text", { c: REVIVE_COST, w: wallet }),
        t("revive.btn", { c: REVIVE_COST }), { menuBtn: true, menuLabel: t("revive.no") });
      screenFn();
    }, 1500);   // let the officer and the dog finish the scene first
    return;
  }
  finalizeOver();
}
function doRevive() {
  if (state !== "revive" || wallet < REVIVE_COST) return;
  wallet -= REVIVE_COST; store.set("zr_wallet", wallet); revived = true;
  resetInputs(); acc = 0; state = "play"; lastT = 0; fpsAcc = 0; fpsN = -20;
  invul = 2600; lives = 1; shield = true;
  obstacles = obstacles.filter((o) => o.x > player.x + 260 || o.x + o.w < player.x - 20);
  Object.assign(player, { h: 44, y: groundY - 44, vy: 0, grounded: true, jumps: 2, pb: groundY }); boardT = 0;
  $("overlay").classList.add("hidden");
  flash = { c: "#ffffff", a: 0.4 }; zoom = 1.07; shout(t("revive.shout"), "#50ffb0", 1200);
  [500, 700, 1000].forEach((f, i) => setTimeout(() => beep(f, 0.12, "triangle", 0.06), i * 90));
  startMusic();
}
function finalizeOver() {
  state = "over";
  const s = Math.floor(score), isBest = saveBest();
  if (!lvl && s > 0) {
    board.push({ s, d: diff });
    board.sort((a, b) => b.s - a.s);
    board = board.slice(0, 5);
    store.set("zr_top", board);
  }
  wallet += coins; store.set("zr_wallet", wallet);
  const rk = bookRun(0);
  updateHUD();
  const L0 = lvl, dist0 = Math.floor(dist), coins0 = coins, w0 = wallet, best0 = bests[diff] || 0, dk = diff, mi = Math.floor(Math.random() * 4);
  setTimeout(() => {
    if (state !== "over") return;
    screenFn = () => {
      if (L0) showOverlay("✕", t("lose.title"), t("lose.text", { d: dist0, len: L0.len, c: coins0, w: w0, msg: t("lose")[mi], rk: rkText(rk) }),
        t("lose.btn"), { menu: true, skins: true, share: true });
      else showOverlay(isBest ? "★" : "✕", t(isBest ? "over.record" : "over.title"),
        t("over.text", { s: fmt(s), c: coins0, w: w0, msg: t("lose")[mi], d: DIFF[dk].name, b: fmt(best0), rk: rkText(rk) }),
        t("over.btn"), { menu: true, skins: true, top: true, share: true });
    };
    screenFn();
  }, 1500);   // the caught scene plays before the result screen
}

function winLevel() {
  const L = lvl, id = sel + 1;
  state = "won"; sfx.zone(); vib(80);
  flash = { c: "#fff", a: 0.5 }; zoom = 1.08;
  [523, 659, 784, 1047].forEach((f2, i) => setTimeout(() => beep(f2, 0.18, "triangle", 0.07), i * 130));
  obstacles = []; items = []; duckKey = duckPtr = duckBtn = jumpHeld = false;
  for (let i = 0; i < 6; i++) setTimeout(() => { if (state === "won") burst(rnd(100, W - 100), rnd(60, groundY - 60), ["#53f7ff", "#ff4fd8", "#ffd84f"][i % 3], 30); }, i * 130);
  if (L.boss) burst(W - 78, H * 0.34, "#ff3b5c", 60);
  const st = 1 + (coins >= L.coins ? 1 : 0) + (hits === 0 ? 1 : 0);
  if (!(prog.stars[id] > 0)) toast(t("postcard", { n: L.name }));
  prog.stars[id] = Math.max(prog.stars[id] || 0, st);
  if (id < LEVELS.length) prog.unlocked = Math.max(prog.unlocked, id + 1);
  store.set("zr_prog", prog);
  saveBest();
  mAdd("win", 1); meta.wins++;
  const rk = bookRun(50);
  wallet += coins + st * 10; store.set("zr_wallet", wallet);
  const last = id >= LEVELS.length;
  if (!last) { sel = id; store.set("zr_sel", sel); }
  updateHUD();
  const c0 = coins, h0 = hits, w0 = wallet, mi = Math.floor(Math.random() * 4);
  setTimeout(() => {
    if (state !== "won") return;
    screenFn = () => showOverlay(starText(st), t(last ? "win.final" : "win.title"),
      t("win.text", { name: L.name, c: c0, g: L.coins, ok: c0 >= L.coins ? "✓" : "✗", nh: h0 === 0 ? "✓" : "✗ (" + h0 + ")", b: st * 10, w: w0, msg: t("win")[mi], fact: pick(FACTS[THEMES[L.theme].city]), rk: rkText(rk) }),
      t(last ? "win.btnFinal" : "win.btnNext"), { menuBtn: true, share: true });
    screenFn();
  }, 900);
}

/* ============ COIN TYPES — gold / crystal / energy / ZUMARY (pre-rendered sprites, no real-time effects) ============ */
const COIN_T = [
  { id: "gold", col: "#ffd84f", xp: 0 }, { id: "crystal", col: "#6cf3ff", xp: 1 }, { id: "energy", col: "#ff4fd8", xp: 2 }, { id: "zumary", col: "#b388ff", xp: 8 },
];
let CTS = null;
function coinTypeSheets() {
  if (CTS) return CTS;
  CTS = []; const N = 12, sz = 44, c = sz / 2;
  for (let ty = 1; ty < 4; ty++) {
    const frames = [];
    for (let i = 0; i < N; i++) {
      const cv = document.createElement("canvas"); cv.width = cv.height = sz; const g = cv.getContext("2d");
      const ph = (i / N) * Math.PI * 2, sx = Math.max(0.14, Math.abs(Math.cos(ph)));
      g.translate(c, c);
      if (ty === 1) {                                           // premium crystal: faceted hexagonal gem with a travelling sparkle
        g.save(); g.scale(sx, 1);
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 3; g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); } g.closePath();
        const gr = g.createLinearGradient(-14, -16, 14, 16); gr.addColorStop(0, "#f2ffff"); gr.addColorStop(0.45, "#46d2ff"); gr.addColorStop(1, "#1c5fd0");
        g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = "#0a3e78"; g.stroke();
        g.strokeStyle = "rgba(255,255,255,.65)"; g.lineWidth = 1; g.beginPath();
        for (let k = 0; k < 6; k += 2) { const a = -Math.PI / 2 + (k * Math.PI) / 3; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); } g.stroke();
        g.restore();
        const s = 3 + 4 * Math.abs(Math.sin(ph * 1.5)); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-6, -8 - s); g.lineTo(-4.5, -8); g.lineTo(-6, -8 + s); g.lineTo(-7.5, -8); g.closePath(); g.moveTo(-6 - s, -8); g.lineTo(-6, -9.5); g.lineTo(-6 + s, -8); g.lineTo(-6, -6.5); g.closePath(); g.fill();
      } else if (ty === 2) {                                    // rare energy coin: plasma orb in a spinning ring, lightning core
        const gl = g.createRadialGradient(0, 0, 2, 0, 0, 21); gl.addColorStop(0, "rgba(255,120,235,.75)"); gl.addColorStop(1, "rgba(255,79,216,0)");
        g.fillStyle = gl; g.fillRect(-c, -c, sz, sz);
        const core = g.createRadialGradient(0, 0, 1, 0, 0, 11); core.addColorStop(0, "#fff"); core.addColorStop(0.5, "#ff7ae6"); core.addColorStop(1, "#7a1fd1");
        g.fillStyle = core; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
        g.lineWidth = 3; g.strokeStyle = "#ff4fd8"; g.beginPath(); g.ellipse(0, 0, 16 * sx, 16, 0, 0, 7); g.stroke();
        g.lineWidth = 1.2; g.strokeStyle = "#fff"; g.beginPath(); g.ellipse(0, 0, 16 * sx, 16, 0, 0.3, 2.2); g.stroke();
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(2, -9); g.lineTo(-5, 1); g.lineTo(-1, 1); g.lineTo(-3, 9); g.lineTo(5, -2); g.lineTo(1, -2); g.closePath(); g.fill();
      } else {                                                  // special ZUMARY coin: gold body, violet ring, engraved Z, orbiting sparks
        g.save(); g.scale(sx, 1);
        const gr = g.createLinearGradient(-16, -16, 16, 16); gr.addColorStop(0, "#fff0a8"); gr.addColorStop(0.5, "#ffc93a"); gr.addColorStop(1, "#b8780a");
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill();
        g.lineWidth = 3.2; g.strokeStyle = "#8b5cf6"; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.stroke();
        g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.stroke();
        g.fillStyle = "#4a2a9a"; g.font = "800 17px Orbitron, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Z", 0, 1);
        g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-6, -8, 5, 2.2, -0.6, 0, 7); g.fill();
        g.restore();
        g.fillStyle = "#e9dcff"; for (let k = 0; k < 3; k++) { const a = ph + (k * Math.PI * 2) / 3; g.beginPath(); g.arc(Math.cos(a) * 20, Math.sin(a) * 20, 1.6, 0, 7); g.fill(); }
      }
      frames.push(cv);
    }
    CTS[ty] = frames;
  }
  return CTS;
}
const rings = [];
function ring(x, y, col, r1 = 34) { if (rings.length < 10) rings.push({ x, y, r: 6, r1, col, life: 1 }); }
function rollCoin(x, y) {
  const r = Math.random();
  if (r < 0.012) return { k: "coin", x, y, r: 13, ct: 3, v: 10 };
  if (r < 0.04) return { k: "coin", x, y, r: 12, ct: 2, v: 5 };
  if (r < 0.11) return { k: "coin", x, y, r: 11, ct: 1, v: 3 };
  return { k: "coin", x, y, r: 9 };
}
function coinCollect(it) {
  const ct = it.ct | 0, ty = COIN_T[ct], cv = Math.max(1, Math.round((it.v || 1) * WE.coin));
  coins += cv; addCombo(); turboAdd(ct === 2 ? 25 : 4); mAdd("coin", cv);
  if (ct) { meta.rare = (meta.rare | 0) + 1; mAdd("rare", 1); meta.xp += ty.xp; }
  const g = 25 * mult() * cv; score += g;
  pop(it.x, it.y, "+" + g, ty.col);
  if (ct === 0) { burst(it.x, it.y, "#ffd84f", 5); sfx.coin(); }
  else if (ct === 1) { burst(it.x, it.y, "#6cf3ff", 9); burst(it.x, it.y, "#ffffff", 4); ring(it.x, it.y, "#6cf3ff", 30); beep(1568, 0.08, "triangle", 0.05); setTimeout(() => beep(2093, 0.12, "triangle", 0.045), 60); }
  else if (ct === 2) { burst(it.x, it.y, "#ff4fd8", 14); ring(it.x, it.y, "#ff4fd8", 44); flash = { c: "#ff4fd8", a: 0.12 }; beep(220, 0.16, "sawtooth", 0.05, 700); }
  else { burst(it.x, it.y, "#b388ff", 18); burst(it.x, it.y, "#ffd84f", 14); ring(it.x, it.y, "#ffd84f", 60); ring(it.x, it.y, "#b388ff", 42); flash = { c: "#b388ff", a: 0.2 }; zoom = 1.04; shout(t("coin.zumary"), "#e0ccff", 1100);
    [523, 659, 784, 1047].forEach((f2, i) => setTimeout(() => beep(f2, 0.12, "triangle", 0.06), i * 70)); vib(20); }
}

/* ============ DYNAMIC WORLD EVENTS — storm, meteors, blackout, magnet zone, speed zone ============ */
const WE_DEF = { storm: { dur: 9000, col: "#8fb4ff", ic: "⚡" }, meteor: { dur: 10000, col: "#ff8a5c", ic: "☄" }, blackout: { dur: 8000, col: "#9aa3ff", ic: "🌃" }, magnet: { dur: 8000, col: "#ff4fd8", ic: "🧲" }, speed: { dur: 7000, col: "#53f7ff", ic: "»" } };
const WE = { t: 20000, kind: "", left: 0, tot: 1, coin: 1, score: 1, spd: 1, dark: 0, hits0: 0, mT: 0, bT: 0, gateX: -1, meteors: [], bolts: [], bolt: 0 };
function WE_reset() { WE.t = rnd(14000, 22000); WE.kind = ""; WE.left = 0; WE.coin = 1; WE.score = 1; WE.spd = 1; WE.dark = 0; WE.meteors.length = 0; WE.bolts.length = 0; WE.bolt = 0; WE.gateX = -1; rings.length = 0; }
function WE_start(kind) {
  const d = WE_DEF[kind]; WE.kind = kind; WE.left = WE.tot = d.dur; WE.hits0 = hits; WE.mT = 500; WE.bT = 300;
  WE.coin = kind === "storm" ? 2 : kind === "speed" ? 1.5 : 1; WE.score = kind === "blackout" ? 1.5 : kind === "speed" ? 1.5 : 1; WE.spd = kind === "speed" ? 1.3 : 1;
  if (kind === "speed") WE.gateX = W + 40;
  banner = { text: d.ic + " " + t("ev." + kind), sub: t("ev." + kind + ".d"), t: 2400, max: 2400 }; sfx.zone(); flash = { c: d.col, a: 0.16 };
}
function WE_end() {
  const ok = hits === WE.hits0;
  WE.kind = ""; WE.coin = 1; WE.score = 1; WE.spd = 1; WE.meteors.length = 0; WE.t = rnd(16000, 28000);
  meta.events = (meta.events | 0) + 1; mAdd("evt", 1); meta.xp += ok ? 6 : 2;
  if (ok) { score += 150; pop(player.x + 30, player.y - 30, t("ev.clean"), "#50ffb0"); } saveMeta();
}
function WE_update(delta, f) {
  if (state !== "play" || (lvl && lvl.boss)) return;
  const p = player, ev = speed;
  if (!WE.kind) { WE.t -= delta; if (WE.t <= 0 && runTime > 10000) WE_start(["storm", "meteor", "blackout", "magnet", "speed"][Math.floor(Math.random() * 5)]); else if (WE.t <= 0) WE.t = 4000; WE.dark = Math.max(0, WE.dark - delta / 700); return; }
  WE.left -= delta;
  const k = WE.kind;
  WE.dark = k === "blackout" ? Math.min(1, WE.dark + delta / 600, WE.left / 600) : Math.max(0, WE.dark - delta / 700);
  if (k === "magnet") fx.magnet = Math.max(fx.magnet, 300);
  if (k === "storm") { WE.bolt -= delta; if (WE.bolt <= 0) { WE.bolt = rnd(500, 1500); WE.bolts.push({ x: rnd(40, W - 40), life: 1 }); if (Q.level < 3) flash = { c: "#cfe0ff", a: 0.22 }; shake = Math.max(shake, 2); beep(90, 0.2, "sawtooth", 0.04, -40); } }
  if (k === "speed" && WE.gateX > -60) WE.gateX -= ev * 1.25 * f;
  if (k === "meteor") {
    WE.mT -= delta;
    if (WE.mT <= 0 && WE.left > 1500 && WE.meteors.length < 4) { WE.mT = rnd(800, 1400); WE.meteors.push({ tx: Math.min(W - 60, p.x + rnd(70, 360)), t: 1100, T: 1100, x: 0, y: -40, hit: false }); }
  }
  for (const m of WE.meteors) {
    m.t -= delta; m.tx -= ev * f; const q = Math.max(0, 1 - m.t / m.T);
    m.x = m.tx + (1 - q) * 200; m.y = -40 + (groundY + 6) * q * q;
    if (!m.hit && q > 0.35 && invul <= 0 && Math.abs(m.x - (p.x + p.w / 2)) < 18 + p.w / 2 && Math.abs(m.y - (p.y + p.h / 2)) < 16 + p.h / 2) { m.hit = true; m.t = -1; burst(m.x, m.y, "#ff8a5c", 16); if (hurt({ t: "meteor", x: 0, w: 0 })) return; }
    if (m.t <= 0 && !m.hit) {
      m.hit = true; shake = Math.max(shake, 6); burst(m.tx, groundY - 4, "#ff8a5c", 14); burst(m.tx, groundY - 4, "#ffd84f", 8); ring(m.tx, groundY - 6, "#ff8a5c", 52); beep(70, 0.22, "sawtooth", 0.06, -30);
      if (invul <= 0 && Math.abs(m.tx - (p.x + p.w / 2)) < 30 + p.w / 2 && p.y + p.h > groundY - 34) { if (hurt({ t: "meteor", x: 0, w: 0 })) return; }
      for (let i = -1; i <= 1; i++) items.push({ k: "coin", x: m.tx + i * 26, y: groundY - 34 - (i === 0 ? 16 : 0), r: 11, ct: 1, v: 3 });   // crystal shards
    }
  }
  compactInPlace(WE.meteors, (m) => !m.hit || m.t > -600);
  for (const b of WE.bolts) { b.life -= delta / 220; b.x -= ev * f * 0.5; }
  compactInPlace(WE.bolts, (b) => b.life > 0);
  if (WE.left <= 0) WE_end();
}
function WE_drawBack() {
  if (WE.dark > 0.01 && FX.light) { ctx.globalAlpha = (0.58 + (Math.random() < 0.04 ? 0.15 : 0)) * WE.dark; ctx.fillStyle = "#050818"; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1; }
  if (WE.kind === "storm" && FX.env) { ctx.globalAlpha = 0.22; ctx.fillStyle = "#1a2460"; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1; }
}
function WE_drawFront() {
  const p = player, k = WE.kind;
  if (k && state === "play") {                                         // thin event bar, top centre
    const d = WE_DEF[k], bw = Math.min(180, W * 0.4), bx = (W - bw) / 2, by = 8 * UI;
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(bx, by, bw, 4); ctx.fillStyle = d.col; ctx.fillRect(bx, by, bw * Math.max(0, WE.left / WE.tot), 4);
  }
  if (k === "storm" && FX.env) {
    ctx.strokeStyle = "#e6f0ff"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
    for (const b of WE.bolts) {
      ctx.globalAlpha = Math.min(1, b.life * 1.6); ctx.beginPath(); let x = b.x, y = 0; ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) { x += ((i * 37 + b.x * 3) % 29) - 14; y += groundY / 7; ctx.lineTo(x, Math.min(y, groundY)); } ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (k === "magnet") { const a = (frame * 0.05) % 1; ctx.strokeStyle = "#ff4fd8"; for (let i = 0; i < 2; i++) { const q = (a + i * 0.5) % 1; ctx.globalAlpha = (1 - q) * 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 30 + q * 160, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (k === "speed" && WE.gateX > -60) {                               // energy gate sweeping past
    const gx = WE.gateX, h = groundY; ctx.fillStyle = "#53f7ff"; ctx.globalAlpha = 0.85; ctx.fillRect(gx - 5, 30, 5, h - 30); ctx.fillRect(gx + 40, 30, 5, h - 30); ctx.fillRect(gx - 5, 30, 50, 5);
    ctx.globalAlpha = 0.18; ctx.fillRect(gx, 35, 40, h - 35); ctx.globalAlpha = 1;
  }
  for (const m of WE.meteors) {
    if (!m.hit) {
      const q = 1 - m.t / m.T; ctx.strokeStyle = "#ff4d4d"; ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(frame * 0.3)); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(m.tx, groundY + 2, 18 + 14 * q, 5 + 3 * q, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,170,90,.55)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + 46, m.y - 70); ctx.stroke();
      ctx.fillStyle = "#ffb36b"; ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = "#ff5a1f"; ctx.beginPath(); ctx.arc(m.x - 3, m.y - 2, 7, 0, 7); ctx.fill();
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.life -= 0.045; r.r += (r.r1 - r.r) * 0.16;
    if (r.life <= 0) { rings.splice(i, 1); continue; }
    ctx.globalAlpha = r.life * 0.8; ctx.strokeStyle = r.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ============ MAIN LOOP — fixed 120 Hz simulation, rendering at the screen's own pace ============ */
const STEP = 1000 / 120;
function stepOnce(dt) {
  if (state === "play") simT += dt;
  if (freeze > 0 && state === "play") { freeze -= dt; return; }
  if (state === "play") updateGame(dt);
  else if (state !== "pause") {
    updateParticles(dt);
    if (state === "ready" || state === "won") { frame += dt / 16.67; scrollWorld(((state === "won" ? 3 : 1.2) * dt) / 16.67, dt / 16.67); }
  }
}
function advance() {
  let n = 0;
  const MAXN = COARSE ? 8 : 14;
  while (acc >= STEP && n < MAXN) { acc -= STEP; n++; stepOnce(STEP); }
  if (n === MAXN) acc = 0;                                  // after a long stall: drop the backlog instead of fast-forwarding
}
let ceilQ = 0, baseQ = 0, goodWin = 0, nextDraw = 0, thermalT = 0, hzRing = [], hz = 60, lastDown = -1e9, lastDraw = 0, perfOn = false, perfEl = null, pf = { n: 0, sum: 0, worst: 0, slow: 0, fps: 0, avg: 0, wst: 0, long: 0, t0: 0 };
function perfTick(raw, t) {                                  // FPS monitor: F3 or ?fps=1 shows it; updates the text once per second only
  pf.n++; pf.sum += raw; if (raw > pf.worst) pf.worst = raw; if (raw > 33.4) pf.slow++;
  if (!pf.t0) pf.t0 = t;
  if (t - pf.t0 >= 1000) {
    pf.fps = Math.round((pf.n * 1000) / (t - pf.t0)); pf.avg = pf.sum / pf.n; pf.wst = pf.worst; pf.slowN = pf.slow;
    pf.n = pf.sum = pf.worst = pf.slow = 0; pf.t0 = t;
    if (perfOn) perfEl.textContent = `${pf.fps} fps  avg ${pf.avg.toFixed(1)}ms  worst ${pf.wst.toFixed(0)}ms\nslow(>33ms) ${pf.slowN}  long tasks ${pf.long}\nQ${Q.level} ${gfx}${gfx === "auto" ? " (max " + ceilQ + ")" : ""}  ${canvas.width}x${canvas.height}  dpr ${DPR.toFixed(2)}\nparticles ${particles ? particles.length : 0}`;
  }
}
function togglePerf() {
  perfOn = !perfOn;
  if (perfOn && !perfEl) { perfEl = document.createElement("div"); perfEl.id = "perf"; document.body.appendChild(perfEl); }
  if (perfEl) perfEl.style.display = perfOn ? "block" : "none";
}
if ("PerformanceObserver" in window) { try { new PerformanceObserver((l) => { pf.long += l.getEntries().length; }).observe({ entryTypes: ["longtask"] }); } catch (e) {} }
if (/[?&]fps\b/.test(location.search)) setTimeout(togglePerf, 0);
function loop(t) {
  requestAnimationFrame(loop);                             // schedule first, so one exception can never freeze the game
  if (window.__ZR_MANUAL) { lastT = 0; return; }
  if (document.hidden) { lastT = 0; return; }              // background tab: no simulation, no drawing, no heat
  const raw = lastT ? t - lastT : 16.67;
  lastT = t;
  rafAvg += (raw - rafAvg) * 0.05;
  perfTick(raw, t);
  if (hzRing.length < 90) { hzRing.push(raw); if (hzRing.length === 90) { const s = hzRing.slice().sort((a, b) => a - b); hz = 1000 / s[45]; } }   // refresh-rate probe (median of 90 frames)
  acc += Math.min(raw, 100);
  advance();
  thermalT = state === "play" ? thermalT + raw : Math.max(0, thermalT - raw * 0.5);
  if (state !== "play") {                                  // menus / pause / game-over: nothing fast moves, so redraw at ~30 fps (pause: ~4 fps)
    if (t - lastDraw < (state === "pause" ? 250 : CFG.bgsave === false ? 32 : 60)) return;
  } else {
    const cap = FPSCAP > 0 ? FPSCAP : CFG.thermal && thermalT > 180000 ? 30 : CFG.battery ? 30 : 0;   // thermal-friendly: after 3 min of play the draw rate drops to 30
    if (cap > 0) { const dt = 1000 / cap; if (t < nextDraw - 1.5) return; nextDraw = Math.max(nextDraw + dt, t - dt); }
    else if (FPSCAP === 0 && rafAvg < 11.5) { skipDraw = !skipDraw; if (skipDraw) return; }   // auto on 90/120 Hz screens: simulate every frame, draw every other one
  }
  lastDraw = t;
  if (state === "play" && ++fpsN > 0) {                    // adaptive quality: lowers fast when slow, raises slowly when the device has headroom
    fpsAcc += Math.min(raw, 50);                           // one random hitch must not count as "slow device"
    if (fpsN >= 20) {                                      // judge every 20 frames
      const avg = fpsAcc / fpsN;
      if (CFG.adaptive !== false && avg > 21 && Q.level < 3) {
        const from = Q.level;
        setQuality(Math.min(3, Q.level + (avg > 34 ? 2 : 1)));        // very slow → skip a level
        ceilQ = Math.max(ceilQ, from + 1); goodWin = 0; lastDown = t;  // never climb back to a level that just failed
        if (COARSE) store.set("zr_q", Q.level);                       // next launch starts at the level this phone can handle
      } else if (CFG.adaptive !== false && avg < (rafAvg < 11.5 ? 11 : 18) && Q.level > Math.max(ceilQ, baseQ, FLOOR) && t - lastDown > 15000) {
        if (++goodWin >= 10) { setQuality(Q.level - 1); goodWin = 0; lastDown = t - 8000; if (COARSE) store.set("zr_q", Q.level); }   // ~3.5 s of clear headroom
      } else goodWin = 0;
      fpsAcc = 0; fpsN = 0;
    }
  }
  if (state !== "pause" || !document.hidden) draw();
}
window.ZR = { get hz() { return hz; }, get FX() { return FX; }, get perf() { return pf; }, get Q() { return Q; }, get state() { return state; }, step(raw) { acc += Math.min(raw, 100); advance(); }, draw };   // small test hook (used by the automated tests)

/* ============ INPUT — one reliable path for keyboard, mouse and touch ============ */
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"], DUCK_KEYS = ["ArrowDown", "KeyS"];
function action() {                                          // tap / click / space on a menu screen
  if (state === "ready" || state === "over" || state === "won") startGame();
  else if (state === "pause") resumeGame();
}
function pressJump() {
  if (state !== "play") { action(); return; }
  const now = simT;
  jumpHeld = true;
  if (now - lastJumpAt < J.GAP) return;                      // the same tap reported twice → never an accidental double jump
  jumpBuf = now;                                             // remembered for J.BUFFER ms, so it can't be lost between frames
}
function releaseJump() { jumpHeld = false; }
document.addEventListener("keydown", (e) => {
  if (e.code === "F3") { e.preventDefault(); togglePerf(); return; }
  if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) pressJump(); }
  else if (DUCK_KEYS.includes(e.code)) { e.preventDefault(); duckKey = true; }
  else if (e.code === "KeyT" || e.code === "ShiftLeft" || e.code === "ShiftRight") { useTurbo(); }
  else if (e.code === "KeyP" || e.code === "Escape") { state === "pause" ? resumeGame() : pauseGame(); }
  else if (e.code === "KeyM") toggleMute();
  else if (e.code === "KeyR") { resetGame(); showReady(); }
  else if (e.code === "KeyF") toggleFs();
});
document.addEventListener("keyup", (e) => {
  if (JUMP_KEYS.includes(e.code)) releaseJump();
  if (DUCK_KEYS.includes(e.code)) duckKey = false;
});

let py = 0;
canvas.addEventListener("pointerdown", (e) => { py = e.clientY; pressJump(); });
canvas.addEventListener("pointermove", (e) => { if ((e.buttons || e.pointerType === "touch") && e.clientY - py > SWIPE) duckPtr = true; });
["pointerup", "pointercancel"].forEach((n) => canvas.addEventListener(n, () => { duckPtr = false; releaseJump(); }));

function holdButton(el, down, up) {                          // multi-touch safe: tracks every finger on the button
  const ids = new Set();
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    ids.add(e.pointerId); el.classList.add("on"); down();
  });
  const end = (e) => { ids.delete(e.pointerId); if (!ids.size) { el.classList.remove("on"); up(); } };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) => el.addEventListener(n, end));
}
holdButton($("padJump"), pressJump, releaseJump);
holdButton($("padDuck"), () => { duckBtn = true; }, () => { duckBtn = false; });

// keep the browser out of the way while playing (scroll, pull-to-refresh, pinch, double-tap zoom)
document.addEventListener("touchmove", (e) => { if (state === "play") e.preventDefault(); }, { passive: false });
["gesturestart", "gesturechange", "dblclick"].forEach((n) => document.addEventListener(n, (e) => { if (state === "play") e.preventDefault(); }));
window.addEventListener("blur", () => { resetInputs(); if (state === "play" && CFG.autopause !== false) pauseGame(); });

$("startButton").addEventListener("click", () => { if (shopOpen) goMenu(); else if (state === "revive") doRevive(); else if (state === "pause") resumeGame(); else startGame(); });
$("restartButton").addEventListener("click", () => { resetGame(); startGame(); });
$("pauseButton").addEventListener("click", () => (state === "pause" ? resumeGame() : pauseGame()));
$("muteButton").addEventListener("click", toggleMute);
$("fullscreenButton").addEventListener("click", toggleFs);

$("diff").addEventListener("click", (e) => {
  const d = e.target.dataset.d;
  if (!d) return;
  diff = d; store.set("zr_diff", d);
  paintDiff(); resetGame(); updateHUD();
});
$("skinBox").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-s]");
  if (!btn) return;
  const s = SKINS.find((k) => k.id === btn.dataset.s);
  if (!owned.includes(s.id)) {
    if (wallet < s.cost) { btn.classList.remove("shake"); void btn.offsetWidth; btn.classList.add("shake"); vib(30); return; }
    wallet -= s.cost; owned.push(s.id);
    store.set("zr_wallet", wallet); store.set("zr_owned", owned);
    sfx.power();
  }
  skin = s.id; store.set("zr_skin", skin);
  $("skinBox").innerHTML = renderSkins();
});

$("mode").addEventListener("click", (e) => {
  const m = e.target.dataset.m;
  if (!m || m === mode) return;
  mode = m; store.set("zr_mode", m);
  goMenu();
});
$("levelBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-l]");
  if (!b) return;
  const i = +b.dataset.l;
  if (i >= prog.unlocked) { b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); vib(30); return; }
  sel = i; store.set("zr_sel", i);
  goMenu();
});
$("menuButton").addEventListener("click", () => { if (state === "revive") finalizeOver(); else goMenu(); });
$("padTurbo").addEventListener("pointerdown", (e) => { e.preventDefault(); useTurbo(); });
$("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-p]");
  if (!b) return;
  b.dataset.p === "play" ? goMenu() : showPanel(b.dataset.p);
});
$("dailyBox").addEventListener("click", (e) => {
  if (!e.target.closest("#giftBtn")) return;
  const td = todayStr();
  if (meta.boxDay === td) return;
  const lucky = Math.random() < 0.2 ? 100 : 0, amt = 30 + Math.min(meta.streak, 7) * 15 + lucky;
  wallet += amt; meta.boxDay = td; store.set("zr_wallet", wallet); checkAch(); saveMeta(); sfx.power(); vib(30);
  $("dailyBox").innerHTML = renderDaily() + `<div class="gift-got">🎁 +◎${amt}${lucky ? t("gift.lucky") : ""}</div>`;
  if ($("skinBox").innerHTML) $("skinBox").innerHTML = renderSkins();
});
$("shareButton").addEventListener("click", async () => {
  const b = $("shareButton"), old = b.textContent;
  const txt = t("share.text", { s: fmt(score), c: coins, lv: lvl ? t("share.lv", { name: lvl.name, d: Math.floor(dist) }) : "" });
  try {
    if (navigator.share) await navigator.share({ title: "ZUMARY RUN", text: txt, url: location.href });
    else { await navigator.clipboard.writeText(txt + " " + location.href); b.textContent = t("share.copied"); setTimeout(() => (b.textContent = old), 1500); }
  } catch (x) {}
});
$("shopBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-u]");
  if (!b) return;
  const it = SHOP.find((x) => x.k === b.dataset.u), lv = up[it.k] || 0;
  if (lv >= it.max) return;
  const cost = it.cost[lv];
  if (wallet < cost) { b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); vib(30); beep(160, 0.15, "sawtooth", 0.04); return; }
  wallet -= cost; up[it.k] = lv + 1;
  store.set("zr_wallet", wallet); store.set("zr_up", up);
  sfx.power(); vib(25);
  $("shopBox").innerHTML = renderShop();
});

$("shopBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cfg],button[data-act]");
  if (!b) return;
  if (b.dataset.act === "gfx") { gfx = GFX[(GFX.indexOf(gfx) + 1) % GFX.length]; store.set("zr_gfx", gfx); applyGfx(); b.textContent = t("gfx." + gfx); return; }
  const k = b.dataset.cfg; CFG[k] = !CFG[k]; saveCfg();
  b.classList.toggle("on", CFG[k]); b.textContent = t(CFG[k] ? "set.on" : "set.off");
  if (k === "left") document.body.classList.toggle("lefty", CFG.left);
  if (k === "vib" && CFG.vib) vib(30);
});
$("shopBox").addEventListener("input", (e) => {
  const k = e.target.dataset.vol; if (!k) return;
  CFG[k] = e.target.value / 100; saveCfg();
  if (ac) { busS.gain.value = CFG.sfx; busM.gain.value = CFG.music; }
});
$("shopBox").addEventListener("change", (e) => { if (e.target.dataset.vol) beep(660, 0.07, "triangle", 0.06); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (CFG.autopause !== false) pauseGame(); else invul = Math.max(invul, 1500); if (CFG.bgsave !== false && ac && ac.state === "running") ac.suspend().catch(() => {}); }
  else if (ac && ac.state === "suspended" && !muted) ac.resume().catch(() => {});
});
window.addEventListener("pagehide", () => { saveMeta(); if (CFG.autopause !== false) pauseGame(); });
shell.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) b.blur(); });

function toggleMute() {
  muted = !muted; store.set("zr_muted", muted); if (!muted && state === "play") startMusic();
  $("muteButton").firstChild.textContent = muted ? "🔇" : "🔊";
}

/* ============ FULL SCREEN (native when possible, CSS fallback for iPhone) ============ */
let fsOn = false;
function setFs(on) {
  fsOn = on;
  shell.classList.toggle("fs", on);
  document.body.classList.toggle("fs-lock", on);
  window.scrollTo(0, 0);
}
async function toggleFs() {
  resetInputs();
  const on = !fsOn;
  setFs(on);
  try {
    if (on) {
      if (shell.requestFullscreen) await shell.requestFullscreen({ navigationUI: "hide" });
      if (COARSE && screen.orientation && screen.orientation.lock) { try { await screen.orientation.lock("landscape"); } catch (x) {} }
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    }
  } catch (x) {}
  resize();
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && fsOn) setFs(false);
  resize();
});

/* ============ GRAPHICS ============ */
const GFX = ["auto", "ultra", "high", "medium", "low", "custom"];
let gfx = store.get("zr_gfx", "auto");
if (!GFX.includes(gfx)) gfx = "auto";
const gfxLabel = () => ($("gfxLabel").textContent = " " + t("gfx") + ": " + t("gfx." + gfx));
const GFX_LVL = { ultra: 0, high: 1, medium: 2, low: 3 };
function applyGfx() {
  const fixed = gfx === "custom" ? Math.max(0, Math.min(3, CFG.cq | 0)) : GFX_LVL[gfx];
  baseQ = fixed !== undefined ? fixed : COARSE ? 1 : 0;                                       // best level adaptive quality may climb back to
  ceilQ = 0;
  setQuality(fixed !== undefined ? fixed : COARSE ? Math.max(1, Math.min(3, CFG.autoopt === false ? 1 : store.get("zr_q", 1) | 0)) : 1);
  gfxLabel();
}
$("gfxButton").addEventListener("click", () => {
  gfx = GFX[(GFX.indexOf(gfx) + 1) % GFX.length]; store.set("zr_gfx", gfx); applyGfx();
  toast("🎨 " + t("gfx") + ": " + t("gfx." + gfx));
});

/* ============ LANGUAGE ============ */
window.onLangChange = () => {
  hudLast.score = hudLast.best = hudLast.speed = hudLast.coins = undefined;
  gfxLabel();
  if (!$("overlay").classList.contains("hidden")) { if (shopOpen) showPanel(curPanel); else if (screenFn) screenFn(); }
  updateHUD();
};

/* ============ INIT ============ */
if ("ResizeObserver" in window) new ResizeObserver(() => resize()).observe(wrap);
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 250));
$("muteButton").firstChild.textContent = muted ? "🔇" : "🔊";
document.body.classList.toggle("lefty", CFG.left);
applyGfx();
resetGame();
showReady();
requestAnimationFrame(loop);
{
  const warm = [() => runnerSheet(), () => coinSheet(), () => guardSheet(), () => dogSheet(), () => Object.keys(POWER).forEach(badgeOf),
    () => { heartSprite(true); heartSprite(false); }, () => ["hazard", "crate", "cones"].forEach(obstSprite)];
  const run = () => { const f = warm.shift(); if (f) { f(); setTimeout(run, 30); } };
  setTimeout(run, 120);
}
setTimeout(buildThumbs, 150);
