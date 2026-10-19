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
  ctx = canvas.getContext("2d", { alpha: false });

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
let W = 900,
  H = 350,
  groundY = 292,
  S = 1,
  UI = 1,
  DPR = 1;
const COARSE = window.matchMedia("(pointer:coarse)").matches;

/* ============ QUALITY ============ */
const Q = {
  level: COARSE ? 1 : 0,
  shadow: !COARSE,
  flat: false,
  dpr: COARSE ? 1.5 : 2,
  maxP: COARSE ? 70 : 140,
};
function setQuality(l) {
  Q.level = l;
  Q.shadow = l === 0;
  Q.flat = l >= 2;
  Q.dpr = l >= 2 ? 1 : COARSE ? 1.5 : 2;
  Q.maxP = [140, 70, 40][Math.min(l, 2)];
  resize();
}
const glow = (c, b) => {
  if (Q.shadow) {
    ctx.shadowColor = c;
    ctx.shadowBlur = b;
  }
};
const noGlow = () => {
  if (Q.shadow) ctx.shadowBlur = 0;
};
const grad = (x0, y0, x1, y1, c0, c1) => {
  if (Q.flat) return c0;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
};
const halo = (x, y, w, h, r, c) => {
  // cheap glow when real shadows are off
  if (Q.shadow) return;
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, h + 8, r + 3);
  ctx.fill();
  ctx.globalAlpha = 1;
};

function resize() {
  const cw = Math.max(200, wrap.clientWidth),
    ch = Math.max(140, wrap.clientHeight);
  const oldG = groundY;
  let s = ch / 350,
    w = cw / s;
  if (w < 560) {
    s = cw / 560;
    w = 560;
  } else if (w > 1100) {
    s = cw / 1100;
    w = 1100;
  }
  S = s;
  W = w;
  H = ch / s;
  groundY = H - 58;
  UI = Math.max(1, 0.95 / s);
  DPR = Math.min(window.devicePixelRatio || 1, Q.dpr);
  canvas.width = Math.round(cw * DPR);
  canvas.height = Math.round(ch * DPR);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  player.x = Math.round(Math.min(190, Math.max(105, W * 0.19)));
  const dy = groundY - oldG;
  if (dy && obstacles) {
    obstacles.forEach((o) => {
      o.y += dy;
      if (o.by !== undefined) o.by += dy;
    });
    items.forEach((i) => (i.y += dy));
    player.y += dy;
    skyKey = "";
  }
}

/* ============ STORAGE / CONFIG ============ */
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
const rnd = (a, b) => Math.random() * (b - a) + a;
const fmt = (v) => String(Math.floor(v)).padStart(6, "0");

const DIFF = {
  easy: { name: "OSON", base: 4.6, max: 10, gap: 1.25 },
  normal: { name: "O'RTACHA", base: 5.3, max: 12, gap: 1 },
  hard: { name: "QIYIN", base: 6.2, max: 15, gap: 0.82 },
};
const THEMES = [
  {
    n: "TOSHKENT",
    city: "tash",
    wx: "leaf",
    night: 0,
    top: "#0f2a5c",
    bot: "#f2a766",
    a: "#53f7ff",
    b: "#ffb36b",
    body: [0.8, 0.55, 22, "#ffd9a0"],
  },
  {
    n: "SAMARQAND",
    city: "sam",
    wx: "spark",
    night: 0,
    top: "#2a2f78",
    bot: "#ffb066",
    a: "#ffd84f",
    b: "#22b8c4",
    body: [0.74, 0.56, 38, "#ffcf6a"],
  },
  {
    n: "BUXORO",
    city: "bux",
    wx: "dust",
    night: 0,
    top: "#1f3a63",
    bot: "#f7c47a",
    a: "#ffb36b",
    b: "#7aa5ff",
    body: [0.78, 0.52, 34, "#ffe29a"],
  },
  {
    n: "XIVA",
    city: "khi",
    wx: "dust",
    night: 1,
    top: "#060a1c",
    bot: "#2b3a63",
    a: "#53f7ff",
    b: "#a78bfa",
    body: [0.82, 0.2, 22, "#e6ecff"],
  },
  {
    n: "XIVA TUNI",
    city: "khi",
    wx: "dust",
    night: 1,
    top: "#03050f",
    bot: "#101a34",
    a: "#8c7bff",
    b: "#53f7ff",
    body: [0.84, 0.2, 20, "#a9b4ff"],
  },
  {
    n: "TOSHKENT TUNI",
    city: "tashN",
    wx: "rain",
    night: 1,
    top: "#050818",
    bot: "#2b2058",
    a: "#ff3b5c",
    b: "#ffb36b",
    body: [0.8, 0.2, 24, "#ff7a8a"],
  },
];
const FACTS = {
  tash: [
    "Toshkent teleminorasi 375 m balandlikda — Markaziy Osiyodagi eng baland inshoot.",
    "Toshkent metrosi 1977-yilda ochilgan — Markaziy Osiyoda birinchisi.",
  ],
  tashN: [
    "Toshkent teleminorasi 375 m balandlikda — Markaziy Osiyodagi eng baland inshoot.",
    "Toshkent metrosi 1977-yilda ochilgan — Markaziy Osiyoda birinchisi.",
  ],
  sam: [
    "Registon «qumli joy» degan ma'noni anglatadi.",
    "Samarqand 2700 yildan ortiq tarixga ega shahar.",
  ],
  bux: [
    "Kalon minorasi 1127-yilda qurilgan, balandligi taxminan 46 m.",
    "Buxoro tarixiy markazi YUNESKO ro'yxatiga kiritilgan.",
  ],
  khi: [
    "Xiva Ichan-Qal'a 1990-yilda YUNESKO ro'yxatiga kiritilgan.",
    "Kalta Minor tugallanmagan — rejada ancha baland bo'lishi kerak edi.",
  ],
};
const POWER = {
  shield: { icon: "🛡", color: "#53f7ff", dur: 0 },
  slow: { icon: "⏳", color: "#a78bfa", dur: 5000 },
  x2: { icon: "×2", color: "#ffd84f", dur: 8000 },
  magnet: { icon: "🧲", color: "#ff4fd8", dur: 8000 },
  fuel: { icon: "⛽", color: "#ffb36b", dur: 0 },
  plov: { icon: "🍚", color: "#ffd84f", dur: 0 },
};
const SKINS = [
  { id: "default", n: "ZUMARY", a: null, b: null, cost: 0 },
  { id: "rose", n: "ROZA", a: "#ff4fd8", b: "#ff8a5c", cost: 80 },
  { id: "mint", n: "MINT", a: "#50ffb0", b: "#53f7ff", cost: 200 },
  { id: "gold", n: "OLTIN", a: "#ffd84f", b: "#ff7a59", cost: 400 },
];

const PX_M = 30; // world pixels per metre
const LEVELS = [
  {
    name: "TOSHKENT",
    tag: "Asosiy to'siqlar",
    len: 600,
    base: 4.8,
    max: 8,
    gap: 1.3,
    theme: 0,
    types: ["block"],
    coins: 25,
  },
  {
    name: "SAMARQAND",
    tag: "Uchar dronlar va qo'sh to'siqlar",
    len: 800,
    base: 5.3,
    max: 9.5,
    gap: 1.15,
    theme: 1,
    types: ["block", "drone", "double"],
    coins: 35,
  },
  {
    name: "BUXORO",
    tag: "Kam tortishish va chuqurlar",
    len: 1000,
    base: 5.6,
    max: 10.5,
    gap: 1.1,
    theme: 2,
    types: ["block", "drone", "pit"],
    coins: 45,
    g: 0.4,
    jump: [-10.8, -9.5],
  },
  {
    name: "XIVA TUNI",
    tag: "Ko'rish cheklangan — oldinga ehtiyot bo'l",
    len: 1200,
    base: 6,
    max: 11.5,
    gap: 1.05,
    theme: 4,
    types: ["block", "drone", "pit", "double"],
    coins: 50,
    dark: true,
  },
  {
    name: "TOSHKENT TUNI",
    tag: "Yakuniy jang: o'qlardan qoch",
    len: 1500,
    base: 6.2,
    max: 12,
    gap: 1.7,
    theme: 5,
    types: ["block", "pit", "drone"],
    coins: 60,
    boss: true,
  },
];
let prog = store.get("zr_prog", { unlocked: 1, stars: {} });
let mode = store.get("zr_mode", "campaign");
let sel = store.get("zr_sel", 0);
if (mode !== "campaign" && mode !== "endless") mode = "campaign";
if (!(sel >= 0 && sel < LEVELS.length && sel <= prog.unlocked - 1)) sel = 0;

let up = store.get("zr_up", { jet: 0, fuel: 0, mag: 0, sh: 0, life: 0 });
const SHOP = [
  {
    k: "jet",
    n: "JETPACK",
    d: "Havoda yana bos va USHLAB TUR — uchasan!",
    max: 1,
    cost: [120],
  },
  {
    k: "fuel",
    n: "YOQILG'I",
    d: "+0.8 s parvoz vaqti",
    max: 3,
    cost: [100, 200, 350],
  },
  {
    k: "mag",
    n: "MAGNIT+",
    d: "Magnit +3 s uzoqroq ishlaydi",
    max: 2,
    cost: [90, 180],
  },
  {
    k: "sh",
    n: "BOSHLANG'ICH QALQON",
    d: "Har yugurish qalqon bilan boshlanadi",
    max: 1,
    cost: [150],
  },
  {
    k: "life",
    n: "QO'SHIMCHA ♥",
    d: "Kampaniyada +1 hayot",
    max: 1,
    cost: [300],
  },
  {
    k: "pet",
    n: "ROBO-DO'ST",
    d: "Yoningda uchadi, tangalarni o'zi tortadi",
    max: 1,
    cost: [250],
  },
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
let ac = null;
function beep(f, d = 0.08, type = "square", v = 0.04, slide = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime,
      o = ac.createOscillator(),
      g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide)
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + d);
  } catch (e) {}
}
const vib = (ms) => {
  if (!muted && navigator.vibrate)
    try {
      navigator.vibrate(ms);
    } catch (e) {}
};
const sfx = {
  jump: () => beep(380, 0.12, "square", 0.035, 280),
  jump2: () => beep(520, 0.12, "square", 0.035, 360),
  coin: () => {
    const k = 1 + Math.min(combo, 20) * 0.025;
    beep(880 * k, 0.07, "triangle", 0.05);
    setTimeout(() => beep(1320 * k, 0.09, "triangle", 0.05), 55);
  },
  power: () => {
    beep(500, 0.1, "sine", 0.06, 500);
    setTimeout(() => beep(900, 0.14, "sine", 0.06, 400), 90);
    vib(15);
  },
  hit: () => {
    beep(140, 0.35, "sawtooth", 0.07, -90);
    vib(60);
  },
  zone: () => {
    beep(440, 0.12, "triangle");
    setTimeout(() => beep(660, 0.12, "triangle"), 110);
    setTimeout(() => beep(880, 0.2, "triangle"), 220);
  },
};

/* ============ STATE ============ */
let state = "ready"; // ready | play | pause | over
let score, speed, frame, coins, combo, shake, invul, shield, banner, lastZone;
let lvl = null,
  dist = 0,
  lives = 1,
  hits = 0,
  shotTimer = 1500,
  darkKey = "",
  darkG = null;
let maxLives = 1,
  fuel = 0,
  flying = false,
  jumpHeld = false,
  sq = 0,
  zoom = 1,
  freeze = 0,
  hbT = 0,
  lastPhase = 0,
  shopOpen = false;
let prefetched = -1;
let shoutO = { text: "", t: 0, max: 1, c: "#fff" },
  flash = { c: "#fff", a: 0 };
let fx, obstacles, items, particles, pops, stars, layers;
let obstacleTimer,
  nextObstacle,
  itemTimer,
  nextItem,
  lastT = 0;
let duckKey = false,
  duckPtr = false,
  duckBtn = false;
let cur = { ...THEMES[0] };
let skyKey = "",
  skyG = null,
  gndKey = "",
  gndG = null;
let fpsAcc = 0,
  fpsN = 0;

const player = {
  x: 120,
  y: groundY - 44,
  w: 34,
  h: 44,
  vy: 0,
  g: 0.65,
  grounded: true,
  jumps: 2,
  trail: [],
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (c1, c2, t) => {
  const a = hex(c1),
    b = hex(c2);
  return (
    "#" +
    a
      .map((v, i) =>
        Math.round(v + (b[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
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
  stars = Array.from({ length: COARSE ? 45 : 75 }, () => ({
    x: rnd(0, W),
    y: rnd(0, groundY * 0.7),
    s: rnd(0.3, 2),
    a: rnd(0.15, 0.8),
  }));
  layers = [];
  clouds = Array.from({ length: 5 }, () => ({
    x: rnd(0, W),
    y: rnd(20, groundY * 0.5),
    w: rnd(70, 150),
    s: rnd(0.02, 0.06),
  }));
  artFor(cur.city || "tash");
  lm = { city: cur.city || "tash", x: W * 0.55 };
  decor = [];
  farOff = midOff = gndOff = 0;
  buildWeather();
}

/* ============ EMOTION: shout, combo, music ============ */
const LOSE = [
  "Hech qisi yo'q — yana bir bor!",
  "Deyarli bo'ldi! Yana urinib ko'r.",
  "Chempionlar ham yiqiladi, lekin turadi.",
  "Keyingisida albatta o'tasan!",
];
const WIN = [
  "Zo'r o'ynading!",
  "Sen haqiqiy yuguruvchisan!",
  "Bunday tezlikni kam odam ushlaydi!",
  "Ajoyib! Davom et!",
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fuelMax = () => 2200 + 800 * up.fuel;
function shout(text, c = "#ffd84f", ms = 1200) {
  shoutO = { text, c, t: ms, max: ms };
}
const COMBO_CALLS = {
  5: ["ZO'R!", "#53f7ff"],
  10: ["AJOYIB!", "#ffd84f"],
  20: ["USTOZ!", "#ff4fd8"],
  35: ["AFSONA!", "#50ffb0"],
  50: ["ILOHIY!", "#ff8a5c"],
};
function addCombo() {
  combo++;
  meta.bestCombo = Math.max(meta.bestCombo, combo);
  mMax("combo", combo);
  const c = COMBO_CALLS[combo];
  if (c) {
    shout(c[0], c[1], 1100);
    flash = { c: c[1], a: 0.16 };
    zoom = 1.04;
    vib(20);
    [660, 880, 1100].forEach((f, i) =>
      setTimeout(() => beep(f, 0.1, "triangle", 0.05), i * 70),
    );
    burst(player.x + 17, player.y, c[1], 22);
    checkAch();
  }
}
let musicOn = false,
  musicStep = 0;
const noteHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function musicTick() {
  if (!musicOn || muted || state !== "play") {
    musicOn = false;
    return;
  }
  const roots = lvl ? [48, 50, 45, 43, 41] : [48, 50, 45, 43];
  const root = roots[lvl ? sel : Math.floor(score / 500) % 4];
  const st = musicStep++ % 16,
    pent = [0, 3, 5, 7, 10];
  if (st % 4 === 0)
    beep(noteHz(root - 12 + [0, 0, 5, 3][st >> 2]), 0.18, "triangle", 0.05);
  if (st % 2 === 0 || Math.random() < 0.35)
    beep(
      noteHz(root + 12 + pent[(st * 3 + (st >> 3)) % 5]),
      0.08,
      "square",
      0.012,
    );
  const bpm = 105 + Math.min(55, speed * 6) + (lvl && lvl.boss ? 15 : 0);
  setTimeout(musicTick, 60000 / bpm / 4);
}
function startMusic() {
  if (musicOn || muted) return;
  musicOn = true;
  musicStep = 0;
  musicTick();
}

/* ============ CITIES · WEATHER · PROGRESSION ============ */
let clouds = [],
  lm = { city: "tash", x: 400 },
  decor = [],
  wx = [],
  decorGap = 200;
let toastO = { text: "", t: 0, max: 1 };
const toastQ = [];
let turbo = 0,
  turboT = 0,
  revived = false,
  padRdy = false,
  pet = { x: 80, y: 200 };
const TURBO_MS = 3000,
  REVIVE_COST = 50;
const todayStr = (d = new Date()) =>
  d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
let meta = Object.assign(
  {
    xp: 0,
    runs: 0,
    dist: 0,
    coinsTotal: 0,
    bestCombo: 0,
    flyMs: 0,
    bestScore: 0,
    streak: 0,
    lastDay: "",
    boxDay: "",
    mDay: "",
    missions: [],
    medals: {},
    wins: 0,
    turbos: 0,
  },
  store.get("zr_meta", {}),
);
const saveMeta = () => store.set("zr_meta", meta);

function toast(text) {
  toastQ.push(text);
}
function updateToast(delta) {
  if (toastO.t > 0) toastO.t -= delta;
  else if (toastQ.length) toastO = { text: toastQ.shift(), t: 2600, max: 2600 };
}

/* ---- daily missions ---- */
const MPOOL = [
  { k: "coin", t: (n) => `Bugun ${n} ta tanga yig'`, g: [25, 60], r: 40 },
  { k: "near", t: (n) => `${n} marta "YAQIN!" bonusini ol`, g: [3, 8], r: 45 },
  { k: "combo", t: (n) => `${n} kombo qil`, g: [12, 30], r: 50 },
  {
    k: "score",
    t: (n) => `Bir yugurishda ${n} ball to'pla`,
    g: [400, 1200],
    r: 55,
  },
  { k: "turbo", t: (n) => `Turboni ${n} marta ishlat`, g: [1, 3], r: 50 },
  {
    k: "fly",
    t: (n) => `Jetpack bilan ${n} soniya uch`,
    g: [5, 12],
    r: 60,
    need: "jet",
  },
  { k: "win", t: (n) => `${n} ta darajani tugat`, g: [1, 2], r: 80 },
];
function genMissions() {
  const pool = MPOOL.filter((m) => !m.need || up[m.need]),
    out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({
      k: m.k,
      g: Math.round(rnd(m.g[0], m.g[1])),
      p: 0,
      done: 0,
      r: m.r,
    });
  }
  return out;
}
function checkM(m) {
  if (m.p >= m.g) {
    m.done = 1;
    wallet += m.r;
    store.set("zr_wallet", wallet);
    toast(`✓ VAZIFA! +◎${m.r}`);
    sfx.zone();
    saveMeta();
  }
}
function mAdd(k, n) {
  for (const m of meta.missions)
    if (m.k === k && !m.done) {
      m.p += n;
      checkM(m);
    }
}
function mMax(k, v) {
  for (const m of meta.missions)
    if (m.k === k && !m.done) {
      m.p = Math.max(m.p, v);
      checkM(m);
    }
}

/* ---- medals ---- */
const ACH = [
  {
    id: "a1",
    n: "BIRINCHI QADAM",
    d: "Bir yugurishda 100 ball",
    ok: () => meta.bestScore >= 100,
    r: 20,
  },
  {
    id: "a2",
    n: "TEZKOR",
    d: "Bir yugurishda 1000 ball",
    ok: () => meta.bestScore >= 1000,
    r: 60,
  },
  {
    id: "a3",
    n: "KOMBO USTASI",
    d: "20 kombo",
    ok: () => meta.bestCombo >= 20,
    r: 40,
  },
  {
    id: "a4",
    n: "AFSONA KOMBO",
    d: "50 kombo",
    ok: () => meta.bestCombo >= 50,
    r: 100,
  },
  {
    id: "a5",
    n: "TANGA OVCHISI",
    d: "Jami 500 tanga",
    ok: () => meta.coinsTotal >= 500,
    r: 60,
  },
  {
    id: "a6",
    n: "BOY",
    d: "Jami 2000 tanga",
    ok: () => meta.coinsTotal >= 2000,
    r: 150,
  },
  {
    id: "a7",
    n: "PARVOZ",
    d: "Jami 20 soniya uchish",
    ok: () => meta.flyMs >= 20000,
    r: 60,
  },
  {
    id: "a8",
    n: "TOSHKENT FATHI",
    d: "1-darajani tugat",
    ok: () => (prog.stars[1] || 0) > 0,
    r: 40,
  },
  {
    id: "a9",
    n: "CHEMPION",
    d: "Toshkent tunidagi bossni yengish",
    ok: () => (prog.stars[5] || 0) > 0,
    r: 200,
  },
  {
    id: "a10",
    n: "SADOQAT",
    d: "3 kunlik seriya",
    ok: () => meta.streak >= 3,
    r: 50,
  },
  {
    id: "a11",
    n: "TURBO",
    d: "Turboni 5 marta ishlat",
    ok: () => meta.turbos >= 5,
    r: 60,
  },
];
function checkAch() {
  let any = false;
  for (const a of ACH)
    if (!meta.medals[a.id] && a.ok()) {
      meta.medals[a.id] = 1;
      wallet += a.r;
      toast(`🏅 ${a.n}! +◎${a.r}`);
      any = true;
    }
  if (any) {
    store.set("zr_wallet", wallet);
    saveMeta();
    sfx.power();
  }
}

/* ---- XP + ranks ---- */
const RANKS = [
  ["YANGI", 0],
  ["YUGURUVCHI", 100],
  ["TEZKOR", 300],
  ["USTA", 700],
  ["CHEMPION", 1500],
  ["AFSONA", 3000],
];
const rankOf = (xp) => {
  let i = 0;
  RANKS.forEach((r, j) => {
    if (xp >= r[1]) i = j;
  });
  return i;
};
function gainXp(n) {
  const before = rankOf(meta.xp);
  meta.xp += Math.max(0, Math.round(n));
  const after = rankOf(meta.xp);
  if (after > before) {
    toast(`⭐ YANGI UNVON: ${RANKS[after][0]}!`);
    return `<br>⭐ YANGI UNVON: <b>${RANKS[after][0]}</b>!`;
  }
  return "";
}
function bookRun(winBonus) {
  meta.runs++;
  meta.dist += Math.floor(lvl ? dist : score / 10);
  meta.coinsTotal += coins;
  meta.bestScore = Math.max(meta.bestScore, Math.floor(score));
  mMax("score", Math.floor(score));
  const msg = gainXp(score / 10 + coins * 2 + (winBonus || 0));
  checkAch();
  saveMeta();
  return (
    msg + `<br>+${Math.round(score / 10 + coins * 2 + (winBonus || 0))} XP`
  );
}

/* ---- daily streak (runs once on load) ---- */
(function dailyInit() {
  const t = todayStr();
  if (meta.lastDay !== t) {
    const ys = todayStr(new Date(Date.now() - 864e5));
    meta.streak = meta.lastDay === ys ? meta.streak + 1 : 1;
    meta.lastDay = t;
  }
  if (meta.mDay !== t) {
    meta.mDay = t;
    meta.missions = genMissions();
  }
  checkAch();
  saveMeta();
})();

/* ---- turbo ---- */
function turboAdd(n) {
  if (turboT > 0) return;
  const was = turbo >= 100;
  turbo = Math.min(100, turbo + n);
  if (!was && turbo >= 100) {
    toast("⚡ TURBO TAYYOR!  [T]");
    beep(1200, 0.1, "triangle", 0.05);
    vib(20);
  }
}
function useTurbo() {
  if (state !== "play" || turbo < 100 || turboT > 0) return;
  turboT = TURBO_MS;
  meta.turbos++;
  mAdd("turbo", 1);
  flash = { c: "#53f7ff", a: 0.35 };
  zoom = 1.08;
  shout("TURBO!", "#53f7ff", 900);
  vib(40);
  [400, 600, 900, 1300].forEach((f, i) =>
    setTimeout(() => beep(f, 0.1, "sawtooth", 0.04), i * 50),
  );
  checkAch();
}

/* ---- scenery: real Uzbek skylines pre-rendered in art.js ---- */
let ART = null,
  farOff = 0,
  midOff = 0,
  gndOff = 0,
  birds = [];
function artFor(city) {
  if (!ART || ART.city !== city) ART = Art.get(city, { coarse: COARSE });
  return ART;
}
function buildWeather() {
  const n = Q.level >= 2 ? 0 : COARSE ? 24 : 45;
  wx = Array.from({ length: n }, () => ({
    x: rnd(0, W),
    y: rnd(0, groundY),
    z: rnd(0.5, 1),
  }));
  birds = Array.from({ length: 6 }, () => ({
    x: rnd(0, W),
    y: rnd(30, groundY * 0.5),
    s: rnd(0.3, 0.8),
    ph: rnd(0, 6),
  }));
}
function moveScenery(d) {
  farOff = (farOff + d * 0.1) % Art.TW;
  midOff = (midOff + d * 0.3) % Art.TW;
  gndOff = (gndOff + d) % Art.GW;
  for (const c of clouds) {
    c.x -= d * c.s;
    if (c.x + c.w < 0) {
      c.x = W + 20;
      c.y = rnd(20, groundY * 0.5);
    }
  }
  lm.x -= d * 0.18;
  if (ART && lm.x < -ART.lmW * 0.9) lm.x = W + rnd(450, 900);
  for (const b of birds) {
    b.x -= d * 0.12 + b.s;
    if (b.x < -10) {
      b.x = W + 10;
      b.y = rnd(30, groundY * 0.5);
    }
  }
  const t = cur.wx;
  for (const p of wx) {
    if (t === "rain") {
      p.y += 9 + 6 * p.z;
      p.x -= 2;
    } else if (t === "leaf") {
      p.y += 0.8 + p.z;
      p.x -= d * 0.35 + Math.sin(p.y * 0.05) * 0.9;
    } else if (t === "dust") {
      p.x -= 6 + d * p.z;
      p.y += 0.2;
    } else {
      p.y -= 0.4 + p.z * 0.6;
      p.x -= d * 0.3;
    }
    if (p.y > groundY || p.y < -10 || p.x < -20) {
      if (t === "rain" || t === "leaf") {
        p.x = rnd(0, W + 80);
        p.y = -10;
      } else if (t === "dust") {
        p.x = W + rnd(0, 60);
        p.y = rnd(0, groundY);
      } else {
        p.x = rnd(0, W);
        p.y = groundY - rnd(0, 40);
      }
    }
  }
}
function drawSkyBody() {
  const b = cur.body || [0.84, 0.22, 26, "#fff"];
  const bx = W * b[0],
    by = Math.min(b[1] * H, groundY - 30),
    r = b[2] * Math.max(1, UI * 0.8);
  ctx.fillStyle = b[3];
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(bx, by, r * 2.4, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(bx, by, r * 1.5, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
}
function drawClouds() {
  ctx.fillStyle = cur.night ? "#9fb0ff" : "#fff3e0";
  ctx.globalAlpha = cur.night ? 0.06 : 0.13;
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.5, c.w * 0.12, 0, 0, 7);
    ctx.ellipse(
      c.x + c.w * 0.25,
      c.y - c.w * 0.06,
      c.w * 0.3,
      c.w * 0.1,
      0,
      0,
      7,
    );
    ctx.ellipse(
      c.x - c.w * 0.25,
      c.y - c.w * 0.03,
      c.w * 0.28,
      c.w * 0.09,
      0,
      0,
      7,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawBirds() {
  if (cur.night) return;
  ctx.strokeStyle = "rgba(25,20,45,.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const b of birds) {
    const f = Math.sin(frame * 0.25 + b.ph) * 3;
    ctx.moveTo(b.x - 5, b.y + f * 0.3);
    ctx.quadraticCurveTo(b.x - 2, b.y - 3 - f, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 2, b.y - 3 - f, b.x + 5, b.y + f * 0.3);
  }
  ctx.stroke();
}
function drawWeather() {
  if (!wx.length || Q.level >= 2) return;
  const t = cur.wx;
  ctx.lineWidth = 1;
  if (t === "rain") {
    ctx.strokeStyle =
      cur.city === "tashN" ? "rgba(255,140,170,.32)" : "rgba(170,200,255,.35)";
    ctx.beginPath();
    for (const p of wx) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 3 * p.z, p.y + 13 * p.z);
    }
    ctx.stroke();
  } else if (t === "leaf") {
    ctx.fillStyle = "#e08a2c";
    ctx.globalAlpha = 0.8;
    for (const p of wx) ctx.fillRect(p.x, p.y, 3 + p.z * 2, 2 + p.z);
    ctx.globalAlpha = 1;
  } else if (t === "dust") {
    ctx.strokeStyle = "rgba(255,210,140,.2)";
    ctx.beginPath();
    for (const p of wx) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 14 + p.z * 16, p.y);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffe08a";
    for (const p of wx) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(frame * 0.05 + p.x));
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
function drawPet() {
  if (!up.pet || state === "ready") return;
  const s = Math.sin(frame * 1.4) * 8;
  glow("#ffb36b", 12);
  ctx.fillStyle = "#ffb36b";
  ctx.beginPath();
  ctx.arc(pet.x, pet.y, 7, 0, 7);
  ctx.fill();
  noGlow();
  ctx.fillStyle = "#10142c";
  ctx.fillRect(pet.x - 4, pet.y - 2, 8, 3.5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(pet.x - 2.5, pet.y - 1.5, 1.6, 1.6);
  ctx.fillRect(pet.x + 1, pet.y - 1.5, 1.6, 1.6);
  ctx.strokeStyle = "#ffd0c0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pet.x - s, pet.y - 9);
  ctx.lineTo(pet.x + s, pet.y - 9);
  ctx.stroke();
}
function drawTurboFx() {
  if (turboT <= 0) return;
  const p = player;
  ctx.strokeStyle = "#9ffcff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const y = p.y + 6 + (i * (p.h - 8)) / 5,
      l = 40 + ((frame * 9 + i * 31) % 60);
    ctx.moveTo(p.x - 6, y);
    ctx.lineTo(p.x - 6 - l, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#53f7ff";
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 34, p.h / 2 + 14, 0, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---- menu panels ---- */
function renderDaily() {
  const ri = rankOf(meta.xp),
    c0 = RANKS[ri][1],
    last = ri >= RANKS.length - 1,
    n0 = last ? c0 + 1 : RANKS[ri + 1][1];
  const pr = last ? 100 : Math.min(100, ((meta.xp - c0) / (n0 - c0)) * 100);
  const gift = meta.boxDay !== todayStr();
  return (
    `<div class="xp"><span>${RANKS[ri][0]}</span><i><b style="width:${pr}%"></b></i><em>${meta.xp} XP</em></div>` +
    `<div class="daily"><span>🔥 ${meta.streak} kunlik seriya</span>${gift ? `<button type="button" id="giftBtn">🎁 SOVG'A OL</button>` : `<span class="dim">🎁 ertaga yana</span>`}</div>`
  );
}
function renderMissions() {
  return (
    `<div class="top-title">BUGUNGI VAZIFALAR</div><div class="shop">` +
    meta.missions
      .map((m) => {
        const def = MPOOL.find((x) => x.k === m.k),
          pr = Math.min(m.g, Math.floor(m.p));
        return `<div class="shop-row"><div><b>${def.t(m.g)}</b><small>${pr} / ${m.g} · mukofot ◎${m.r}</small><i class="bar"><b style="width:${(pr / m.g) * 100}%"></b></i></div><button type="button" class="${m.done ? "done" : "lock"}">${m.done ? "✓" : "◎" + m.r}</button></div>`;
      })
      .join("") +
    `</div><p class="note">Vazifalar har kuni yangilanadi. Mukofot avtomatik qo'shiladi.</p>`
  );
}
function renderMedals() {
  const album =
    `<div class="top-title">ALBOM — SHAHAR OTKRITKALARI</div><div class="album">` +
    LEVELS.map((L, i) => {
      const got = (prog.stars[i + 1] || 0) > 0,
        th = THUMBS[THEMES[L.theme].city];
      return `<div class="card-pc ${got ? "" : "lock"}" style="${th ? `background-image:url(${th})` : ""}"><span>${got ? L.name : "???"}</span></div>`;
    }).join("") +
    `</div>`;
  const st = `<div class="stats"><div><b>${meta.runs}</b><small>YUGURISH</small></div><div><b>${meta.dist}</b><small>METR</small></div><div><b>${meta.coinsTotal}</b><small>TANGA</small></div><div><b>${meta.bestCombo}</b><small>KOMBO</small></div></div>`;
  return (
    album +
    `<div class="top-title">STATISTIKA</div>${st}<div class="top-title">MEDALLAR ${Object.keys(meta.medals).length}/${ACH.length}</div><div class="shop">` +
    ACH.map(
      (a) =>
        `<div class="shop-row"><div><b>${meta.medals[a.id] ? "🏅" : "🔒"} ${a.n}</b><small>${a.d} · ◎${a.r}</small></div></div>`,
    ).join("") +
    `</div>`
  );
}
function showPanel(name) {
  const T = {
    shop: [
      "🛒",
      "DO'KON",
      "Yig'gan tangalaringni foydali kuchlarga almashtir.",
    ],
    missions: [
      "📋",
      "KUNLIK VAZIFALAR",
      "Bajar — mukofot avtomatik qo'shiladi.",
    ],
    medals: ["🏅", "MEDALLAR VA STATISTIKA", "Maqsadlarga yetish uchun o'yna!"],
  }[name];
  showOverlay(T[0], T[1], T[2], "←   ORQAGA", { panel: name });
}

/* ============ HELPERS ============ */
const duck = () => duckKey || duckPtr || duckBtn;
const comboMult = () => 1 + Math.min(4, Math.floor(combo / 5));
const mult = () => comboMult() * (fx.x2 > 0 ? 2 : 1);
const hit = (a, b, pad = 0) =>
  a.x + pad < b.x + b.w &&
  a.x + a.w - pad > b.x &&
  a.y + pad < b.y + b.h &&
  a.y + a.h > b.y;
const rr = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
const skinColors = () => {
  const s = SKINS.find((k) => k.id === skin) || SKINS[0];
  return [s.a || cur.a, s.b || cur.b];
};

function burst(x, y, color, n = 12) {
  if (particles.length > Q.maxP) return;
  for (let i = 0; i < n; i++)
    particles.push({
      x,
      y,
      vx: rnd(-3, 3),
      vy: rnd(-4, 2),
      s: rnd(2, 5),
      life: 1,
      color,
    });
}
function pop(x, y, s, color) {
  pops.push({ x, y, s, color, life: 1 });
}

/* ============ SPAWNING ============ */
const mkCoin = (x, y) =>
  Math.random() < 0.08
    ? { k: "coin", x, y, r: 11, v: 5 }
    : { k: "coin", x, y, r: 9 };

function spawnObstacle() {
  const sx = W + 20;
  let t;
  if (lvl) t = lvl.types[Math.floor(Math.random() * lvl.types.length)];
  else
    t =
      score > 150 && Math.random() < 0.28
        ? "drone"
        : score > 400 && Math.random() < 0.22
          ? "double"
          : "block";

  if (t === "drone") {
    const y = groundY - 52;
    obstacles.push({
      t: "drone",
      x: sx,
      y,
      by: y,
      w: 44,
      h: 26,
      passed: false,
      c: "#ff7a59",
    });
    if (Math.random() < 0.7)
      for (let i = 0; i < 4; i++)
        items.push(mkCoin(sx + 8 + i * 26, groundY - 14));
    return;
  }
  if (t === "pit") {
    const w = rnd(95, 135);
    obstacles.push({
      t: "pit",
      x: sx,
      y: groundY,
      w,
      h: 60,
      passed: false,
      c: "#ff3b5c",
    });
    for (let i = 0; i < 5; i++)
      items.push(
        mkCoin(
          sx + w / 2 + (i - 2) * 26,
          groundY - 50 - Math.sin((i / 4) * Math.PI) * 45,
        ),
      );
    return;
  }
  const tall = Math.random() > 0.55;
  const h = tall ? rnd(45, 65) : rnd(28, 42),
    w = tall ? rnd(25, 36) : rnd(32, 46);
  const c = Math.random() > 0.5 ? "#ff4fd8" : "#ff7a59";
  obstacles.push({ t: "block", x: sx, y: groundY - h, w, h, passed: false, c });
  if (t === "double") {
    const h2 = rnd(28, 48),
      w2 = rnd(28, 40);
    obstacles.push({
      t: "block",
      x: sx + w + 75,
      y: groundY - h2,
      w: w2,
      h: h2,
      passed: false,
      c,
    });
  }
  if (Math.random() < 0.6)
    for (let i = 0; i < 5; i++)
      items.push(
        mkCoin(
          sx + w / 2 + (i - 2) * 28,
          groundY - h - 28 - Math.sin((i / 4) * Math.PI) * 38,
        ),
      );
}
function spawnShot(both) {
  const high = Math.random() < 0.5;
  const mk = (h, dx) =>
    obstacles.push({
      t: "shot",
      x: W - 150 + dx,
      y: h ? groundY - 50 : groundY - 26,
      w: 30,
      h: 16,
      passed: false,
      c: "#ff3b5c",
      sp: 1.45,
    });
  mk(high, 0);
  if (both) mk(!high, 120);
  burst(W - 150, groundY - 38, "#ffb36b", 6);
  beep(220, 0.08, "sawtooth", 0.03, -60);
}
function spawnPower() {
  const list = up.jet
    ? ["shield", "slow", "x2", "magnet", "plov", "fuel", "fuel"]
    : ["shield", "slow", "x2", "magnet", "plov"];
  const k = list[Math.floor(Math.random() * list.length)];
  items.push({ k, x: W + 30, y: groundY - rnd(55, 110), r: 15 });
}

/* ============ ACTIONS ============ */
function jump() {
  if (state !== "play" || player.jumps <= 0) return;
  const first = player.jumps === 2;
  const jp = lvl && lvl.jump ? lvl.jump : [-14, -12];
  player.vy = first ? jp[0] : jp[1];
  player.jumps--;
  player.grounded = false;
  burst(
    player.x + player.w / 2,
    first ? groundY : player.y + player.h,
    first ? "#53f7ff" : "#ff4fd8",
    first ? 8 : 6,
  );
  sq = -0.3;
  first ? sfx.jump() : sfx.jump2();
}
function releaseJump() {
  if (state === "play" && player.vy < -5) player.vy = -5;
}

/* ============ UPDATE ============ */
function scrollWorld(d) {
  moveScenery(d);
  stars.forEach((s) => {
    s.x -= d * 0.05;
    if (s.x < 0) {
      s.x = W;
      s.y = rnd(0, groundY - 47);
    }
  });
  layers.forEach((L) => {
    L.b.forEach((b) => {
      b.x -= d * L.mul;
      if (b.x + b.w < 0) {
        let r = 0;
        for (const o of L.b) if (o.x + o.w > r) r = o.x + o.w;
        b.x = r + rnd(4, 16);
        b.w = rnd(L.wmin, L.wmax);
        b.h = rnd(L.hmin, L.hmax);
        b.seed = Math.random() * 99;
      }
    });
  });
}

function hurt(o) {
  const p = player;
  if (shield) {
    shield = false;
    invul = 900;
    shake = 9;
    burst(p.x + 17, p.y + 20, "#53f7ff", 24);
    if (o.t === "pit") {
      p.vy = -11;
      p.grounded = false;
      p.jumps = 1;
    } else o.x = -999;
    sfx.hit();
    pop(p.x, p.y - 10, "QALQON SINDI", "#53f7ff");
    freeze = 140;
    flash = { c: "#53f7ff", a: 0.3 };
    zoom = 1.05;
    return false;
  }
  hits++;
  combo = 0;
  if (lives > 1) {
    lives--;
    invul = 1600;
    shake = 10;
    burst(p.x + 17, p.y + 22, "#ff4fd8", 18);
    if (o.t === "pit") {
      p.vy = -12;
      p.grounded = false;
      p.jumps = 1;
    } else o.x = -999;
    sfx.hit();
    pop(p.x, p.y - 12, "♥ " + lives, "#ff6b8a");
    freeze = 110;
    flash = { c: "#ff3b5c", a: 0.45 };
    zoom = 1.06;
    shout("AU!", "#ff6b8a", 700);
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
  invul = Math.max(0, invul - delta);
  if (turboT > 0) {
    turboT -= delta;
    if (turboT <= 0) {
      turboT = 0;
      turbo = 0;
      invul = Math.max(invul, 900);
      zoom = 1.04;
    }
  }
  if (lvl && maxLives > 1 && lives === 1) {
    hbT -= delta;
    if (hbT <= 0) {
      hbT = 900;
      beep(70, 0.12, "sine", 0.08);
      vib(10);
    }
  }
  banner.t = Math.max(0, banner.t - delta);

  const cfg = lvl || DIFF[diff];
  score += f * 0.12;
  speed = lvl
    ? lvl.base + (lvl.max - lvl.base) * Math.min(1, dist / lvl.len)
    : Math.min(cfg.base + score / 180, cfg.max);
  const ev = speed * (fx.slow > 0 ? 0.65 : 1) * (turboT > 0 ? 1.7 : 1);

  let T;
  if (lvl) {
    dist += (ev * f) / PX_M;
    T = THEMES[lvl.theme];
  } else {
    const zone = Math.floor(score / 500) % 4;
    if (zone !== lastZone) {
      lastZone = zone;
      banner = {
        text: THEMES[zone].n,
        sub: "YANGI SHAHAR",
        t: 2200,
        max: 2200,
      };
      sfx.zone();
    }
    T = THEMES[zone];
  }
  cur.wx = T.wx;
  cur.body = T.body;
  cur.night = T.night;
  if (cur.city !== T.city) {
    cur.city = T.city;
    lm = { city: T.city, x: W + 420 };
    decor = [];
  }
  if (!lvl && score % 500 > 380) {
    const nz = (Math.floor(score / 500) + 1) % 4;
    if (prefetched !== nz) {
      prefetched = nz;
      setTimeout(() => Art.get(THEMES[nz].city, { coarse: COARSE }), 60);
    }
  }
  if (cur.wx === "rain" && Math.random() < 0.0025)
    flash = { c: "#cfe0ff", a: 0.2 };
  if (cur.top !== T.top || cur.a !== T.a || cur.b !== T.b || cur.bot !== T.bot)
    ["top", "bot", "a", "b"].forEach((k) => (cur[k] = mix(cur[k], T[k], 0.04)));

  scrollWorld(ev * f);

  const p = player;
  p.h = p.grounded && duck() ? 24 : 44;
  if (p.grounded) p.y = groundY - p.h;
  flying = !!up.jet && fuel > 0 && jumpHeld && !p.grounded && p.jumps <= 0;
  if (flying) {
    fuel = Math.max(0, fuel - delta);
    meta.flyMs += delta;
    mAdd("fly", delta / 1000);
    p.vy += ((duck() ? 4.5 : -3.8) - p.vy) * 0.18 * f;
    if (frame % 2 < f && particles.length < Q.maxP + 40)
      particles.push({
        x: p.x + 8 + rnd(0, 18),
        y: p.y + p.h,
        vx: rnd(-0.6, 0.6),
        vy: rnd(1.5, 3),
        s: rnd(3, 6),
        life: 0.8,
        color: Math.random() < 0.5 ? "#ffb36b" : "#ff4fd8",
      });
  } else p.vy += p.g * (duck() && !p.grounded ? 2.2 : 1) * f;
  p.y += p.vy * f;
  if (p.y < 12) {
    p.y = 12;
    if (p.vy < 0) p.vy = 0;
  }
  if (p.y + p.h >= groundY) {
    if (!p.grounded && p.vy > 3) {
      burst(p.x + p.w / 2, groundY, "#a78bfa", 5);
      sq = Math.min(0.45, p.vy / 30);
    }
    p.y = groundY - p.h;
    p.vy = 0;
    p.grounded = true;
    p.jumps = 2;
  } else p.grounded = false;
  if (p.grounded && fuel < fuelMax())
    fuel = Math.min(fuelMax(), fuel + delta * 1.4);
  sq *= Math.pow(0.82, f);

  if (frame % 2 < f) p.trail.push({ x: p.x, y: p.y, h: p.h });
  if (p.trail.length > 6) p.trail.shift();

  // stop spawning near the finish line so the last stretch is clear
  const spawning = lvl ? (lvl.len - dist) * PX_M > W * 0.95 : true;
  obstacleTimer += delta;
  if (spawning && obstacleTimer >= nextObstacle) {
    spawnObstacle();
    obstacleTimer = 0;
    nextObstacle = Math.max(
      700,
      rnd(1000, 1600) * cfg.gap * Math.max(0.62, 5.5 / speed),
    );
  }
  itemTimer += delta;
  if (spawning && itemTimer >= nextItem) {
    spawnPower();
    itemTimer = 0;
    nextItem = rnd(9000, 14000);
  }
  if (lvl && lvl.boss && spawning) {
    const hp = 1 - Math.min(1, dist / lvl.len),
      ph = hp < 0.34 ? 2 : hp < 0.67 ? 1 : 0;
    if (ph !== lastPhase) {
      lastPhase = ph;
      shout(
        ph === 2 ? "ZUMARY-X G'AZABDA!" : "BOSS KUCHAYDI!",
        "#ff6b8a",
        1600,
      );
      flash = { c: "#ff3b5c", a: 0.25 };
      zoom = 1.05;
      shake = 8;
    }
    shotTimer -= delta * (1 + ph * 0.3);
    if (shotTimer <= 0) {
      spawnShot(ph === 2 && Math.random() < 0.4);
      shotTimer = rnd(1100, 1700) * Math.max(0.7, 5.5 / speed);
    }
  }

  const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 };
  const pcx = p.x + p.w / 2,
    pcy = p.y + p.h / 2;
  for (const o of obstacles) {
    o.x -= ev * f * (o.sp || 1);
    if (o.t === "drone") o.y = o.by + Math.sin(frame * 0.1) * 4;
    if (turboT > 0 && o.t !== "pit" && o.x > -900 && hit(box, o, 0)) {
      const ox = o.x,
        oy = o.y;
      o.x = -999;
      score += 15;
      shake = 5;
      burst(ox + 10, oy + 10, "#53f7ff", 14);
      beep(300, 0.06, "square", 0.04);
      continue;
    }
    if (invul <= 0 && turboT <= 0) {
      if (o.t === "pit") {
        if (p.grounded && pcx > o.x + 6 && pcx < o.x + o.w - 6 && hurt(o))
          return;
      } else if (hit(box, o, 3)) {
        if (hurt(o)) return;
      } else if (
        hit({ x: box.x - 7, y: box.y - 7, w: box.w + 14, h: box.h + 14 }, o, 0)
      )
        o.near = true;
    }
    if (!o.passed && o.x + o.w < p.x) {
      o.passed = true;
      addCombo();
      turboAdd(2);
      const g = 10 * mult();
      score += g;
      pop(p.x + 20, p.y - 14, "+" + g, "#c7edff");
      if (o.near && o.t !== "pit") {
        score += 20;
        turboAdd(10);
        mAdd("near", 1);
        pop(p.x + 44, p.y - 36, "YAQIN! +20", "#ffd84f");
        beep(1000, 0.07, "triangle", 0.04);
      }
    }
  }
  obstacles = obstacles.filter((o) => o.x + o.w > -10);

  for (const it of items) {
    it.x -= ev * f;
    if (it.k === "coin" && (fx.magnet > 0 || turboT > 0)) {
      const dx = pcx - it.x,
        dy = pcy - it.y,
        d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) {
        it.x += (dx / d) * 9 * f;
        it.y += (dy / d) * 9 * f;
      }
    }
    if (it.k === "coin" && up.pet) {
      const pd = Math.hypot(it.x - pet.x, it.y - pet.y);
      if (pd < 90 && pd > 1) {
        it.x += ((pet.x - it.x) / pd) * 5 * f;
        it.y += ((pet.y - it.y) / pd) * 5 * f;
      }
    }
    const grab =
      (Math.abs(it.x - pcx) < it.r + p.w / 2 - 3 &&
        Math.abs(it.y - pcy) < it.r + p.h / 2 - 3) ||
      (it.k === "coin" &&
        up.pet &&
        Math.hypot(it.x - pet.x, it.y - pet.y) < it.r + 11);
    if (grab) {
      it.got = true;
      if (it.k === "coin") {
        coins += it.v || 1;
        addCombo();
        turboAdd(4);
        mAdd("coin", it.v || 1);
        const g = 25 * mult() * (it.v || 1);
        score += g;
        pop(it.x, it.y, "+" + g, "#ffd84f");
        burst(it.x, it.y, "#ffd84f", 5);
        sfx.coin();
      } else {
        if (it.k === "shield") shield = true;
        else if (it.k === "fuel") fuel = fuelMax();
        else if (it.k === "plov") {
          if (lvl && lives < maxLives) {
            lives++;
            shout("PLOV! ♥ +1", "#ffd84f", 1000);
          } else {
            shield = true;
            shout("PLOV! QALQON", "#ffd84f", 1000);
          }
        } else
          fx[it.k] = POWER[it.k].dur + (it.k === "magnet" ? 3000 * up.mag : 0);
        burst(it.x, it.y, POWER[it.k].color, 18);
        sfx.power();
        pop(
          it.x,
          it.y - 12,
          {
            shield: "QALQON!",
            slow: "SEKIN!",
            x2: "×2 BALL!",
            magnet: "MAGNIT!",
            fuel: "YOQILG'I!",
            plov: "PLOV!",
          }[it.k],
          POWER[it.k].color,
        );
      }
    }
  }
  items = items.filter((i) => !i.got && i.x > -30);

  if (lvl && dist >= lvl.len) {
    winLevel();
    return;
  }
  updateParticles(delta);
  updateHUD();
}

function updateParticles(delta) {
  const f = delta / 16.67;
  for (const q of particles) {
    q.x += q.vx * f;
    q.y += q.vy * f;
    q.vy += 0.12 * f;
    q.life -= 0.025 * f;
  }
  if (particles.length) particles = particles.filter((q) => q.life > 0);
  for (const q of pops) {
    q.y -= 0.8 * f;
    q.life -= 0.018 * f;
  }
  if (pops.length) pops = pops.filter((q) => q.life > 0);
  shake = Math.max(0, shake - 0.5 * f);
  flash.a = Math.max(0, flash.a - 0.03 * f);
  updateToast(delta);
  if (up.pet) {
    pet.x += (player.x - 34 - pet.x) * 0.12 * f;
    pet.y += (player.y - 18 + Math.sin(frame * 0.1) * 5 - pet.y) * 0.12 * f;
  }
  zoom = 1 + (zoom - 1) * Math.pow(0.9, f);
  shoutO.t = Math.max(0, shoutO.t - delta);
  if (state !== "play") sq *= Math.pow(0.82, f);
}

const hudEl = {
  score: $("score"),
  best: $("best"),
  speed: $("speed"),
  coins: $("coins"),
};
const hudLast = {};
function setHud(k, v) {
  if (hudLast[k] !== v) {
    hudLast[k] = v;
    hudEl[k].textContent = v;
  }
}
function updateHUD() {
  setHud("score", fmt(score));
  setHud(
    "best",
    fmt(
      Math.max(
        bests[bestKey()] || 0,
        state === "play" || state === "over" || state === "won" ? score : 0,
      ),
    ),
  );
  setHud("speed", ((speed * (fx.slow > 0 ? 0.65 : 1)) / 5).toFixed(1) + "x");
  setHud("coins", String(coins));
  const rdy = turbo >= 100 && turboT <= 0 && state === "play";
  if (rdy !== padRdy) {
    padRdy = rdy;
    $("padTurbo").classList.toggle("ready", rdy);
  }
}

/* ============ DRAW ============ */
function drawBackground() {
  const A = artFor(cur.city || "tash");
  const key = cur.top + cur.bot + groundY + Q.flat;
  if (key !== skyKey) {
    skyKey = key;
    if (Q.flat) skyG = cur.top;
    else {
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      g.addColorStop(0, cur.top);
      g.addColorStop(0.6, mix(cur.top, cur.bot, 0.5));
      g.addColorStop(1, cur.bot);
      skyG = g;
    }
  }
  ctx.fillStyle = skyG;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  if (cur.night) {
    ctx.fillStyle = "#c7edff";
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  if (speed >= 8 && Q.level < 2 && state === "play") {
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = Math.min(10, Math.floor((speed - 7) * 3));
    for (let i = 0; i < n; i++) {
      const x = W - ((frame * speed * 2.5 + i * 137) % (W + 140)),
        y = 14 + ((i * 53.7) % (groundY - 40));
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + speed * 4, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawSkyBody();
  drawClouds();
  drawBirds();

  const sc = Math.max(1, Math.min(1.5, groundY / 292)),
    tw = Art.TW * sc;
  const fx0 = -(farOff * sc),
    mx0 = -(midOff * sc),
    fh = Art.FAR_H * sc,
    mh = Art.MID_H * sc;
  ctx.drawImage(A.far, fx0, groundY - fh, tw, fh);
  ctx.drawImage(A.far, fx0 + tw, groundY - fh, tw, fh);
  const ls = Math.min(1.45, (groundY - 14) / A.lmH),
    lw = A.lmW * ls,
    lh = A.lmH * ls;
  ctx.drawImage(A.lm, lm.x - lw / 2, groundY - lh, lw, lh);
  ctx.drawImage(A.mid, mx0, groundY - mh, tw, mh);
  ctx.drawImage(A.mid, mx0 + tw, groundY - mh, tw, mh);

  ctx.fillStyle = A.gBase;
  ctx.fillRect(-20, groundY, W + 40, H - groundY + 24);
  for (let x = -(gndOff % Art.GW); x < W + Art.GW; x += Art.GW)
    ctx.drawImage(A.gnd, x, groundY, Art.GW, Art.GH);
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.fillRect(-20, groundY, W + 40, 2);
}

function drawPlayer() {
  const p = player,
    small = p.h < 40;
  const [pa, pb] = skinColors();
  ctx.save();
  const scx = p.x + p.w / 2,
    sby = p.y + p.h;
  ctx.translate(scx, sby);
  ctx.scale(1 + sq * 0.5, 1 - sq * 0.5);
  ctx.translate(-scx, -sby);
  ctx.fillStyle = pa;
  for (let i = 0; i < p.trail.length; i++) {
    const pt = p.trail[i];
    ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.15;
    rr(pt.x, pt.y, p.w, pt.h, 8);
    ctx.fill();
  }
  ctx.globalAlpha = invul > 0 && Math.floor(frame / 3) % 2 ? 0.35 : 1;

  halo(p.x, p.y, p.w, p.h, 8, pb);
  glow(pb, 24);
  ctx.fillStyle = grad(p.x, p.y, p.x + p.w, p.y + p.h, pa, pb);
  rr(p.x, p.y, p.w, p.h, 8);
  ctx.fill();
  noGlow();

  ctx.fillStyle = "#10142c";
  rr(p.x + 6, p.y + (small ? 4 : 9), p.w - 12, small ? 8 : 11, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(p.x + 10, p.y + (small ? 7 : 13), 4, 2);
  ctx.fillRect(p.x + 20, p.y + (small ? 7 : 13), 4, 2);
  ctx.fillStyle = "#ff4fd8";
  const run = p.grounded ? Math.sin(frame * 0.6) * 2 : 0;
  ctx.fillRect(p.x + 4 + run, p.y + p.h - 3, 9, 4);
  ctx.fillRect(p.x + 21 - run, p.y + p.h - 3, 9, 4);
  ctx.fillStyle = "#0e1124";
  ctx.beginPath();
  ctx.moveTo(p.x + 3, p.y + 2);
  ctx.lineTo(p.x + 6, p.y - 7);
  ctx.lineTo(p.x + p.w - 6, p.y - 7);
  ctx.lineTo(p.x + p.w - 3, p.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f3f0e6";
  for (let i = 0; i < 3; i++) {
    const dx = p.x + 9 + i * 8;
    ctx.beginPath();
    ctx.moveTo(dx, p.y - 3);
    ctx.lineTo(dx + 2.5, p.y - 5.5);
    ctx.lineTo(dx + 5, p.y - 3);
    ctx.lineTo(dx + 2.5, p.y - 0.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (shield) {
    ctx.strokeStyle = "#53f7ff";
    ctx.lineWidth = 2;
    glow("#53f7ff", 16);
    ctx.globalAlpha = 0.6 + Math.sin(frame * 0.2) * 0.25;
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 34, p.h / 2 + 10, 0, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    noGlow();
  }
  ctx.restore();
  drawFuelBar();
  drawPet();
  drawTurboFx();
}

function drawFuelBar() {
  if (!up.jet || state !== "play" || (!flying && fuel >= fuelMax() - 1)) return;
  const p = player,
    w = 44,
    x = p.x + p.w / 2 - w / 2,
    y = p.y - 14,
    pr = fuel / fuelMax();
  ctx.fillStyle = "rgba(10,14,34,.75)";
  rr(x - 1, y - 1, w + 2, 7, 4);
  ctx.fill();
  ctx.fillStyle = pr < 0.25 ? "#ff3b5c" : "#ffb36b";
  if (pr > 0.02) {
    rr(x, y, w * pr, 5, 3);
    ctx.fill();
  }
}

function stripes(x, y, w, h, c1, c2, sw) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  for (let k = -h; k < w + h; k += sw * 2) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + sw, y + h);
    ctx.lineTo(x + k + sw + h, y);
    ctx.lineTo(x + k + h, y);
    ctx.fill();
  }
  ctx.restore();
}
function drawObstacles() {
  const blink = Math.floor(frame / 14) % 2;
  for (const o of obstacles) {
    if (o.t === "pit") {
      ctx.fillStyle = "#02030a";
      ctx.fillRect(o.x, groundY - 1, o.w, H - groundY + 24);
      stripes(o.x - 6, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5);
      stripes(o.x + o.w, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5);
      continue;
    }
    glow("#ff3b5c", 14);
    if (o.t === "block") {
      ctx.fillStyle = "#ffc21a";
      rr(o.x, o.y, o.w, o.h, 4);
      ctx.fill();
      noGlow();
      ctx.save();
      rr(o.x, o.y, o.w, o.h, 4);
      ctx.clip();
      stripes(o.x, o.y, o.w, o.h, "#ffc21a", "#17171f", 7);
      ctx.restore();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.6;
      rr(o.x, o.y, o.w, o.h, 4);
      ctx.stroke();
      ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a";
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y - 4, 3.2, 0, 7);
      ctx.fill();
    } else if (o.t === "drone") {
      ctx.fillStyle = "#3a1226";
      rr(o.x, o.y, o.w, o.h, 11);
      ctx.fill();
      noGlow();
      ctx.strokeStyle = "#ff3b5c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#12040a";
      rr(o.x + 7, o.y + 8, o.w - 14, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(
        o.x + o.w / 2 - 3 + Math.sin(frame * 0.2) * 9,
        o.y + 10,
        6,
        4,
      );
      ctx.strokeStyle = "#ffd0c0";
      ctx.lineWidth = 2;
      const s = Math.sin(frame * 1.2) * 12;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2 - s, o.y - 4);
      ctx.lineTo(o.x + o.w / 2 + s, o.y - 4);
      ctx.stroke();
      ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a";
      ctx.beginPath();
      ctx.arc(o.x + 5, o.y + 3, 2.4, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff5a3c";
      rr(o.x, o.y, o.w, o.h, 8);
      ctx.fill();
      noGlow();
      ctx.fillStyle = "#ffd08a";
      rr(o.x + 6, o.y + 4, o.w - 12, o.h - 8, 4);
      ctx.fill();
      ctx.fillStyle = "#ffb36b";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(o.x + o.w, o.y + 4, 16 + Math.sin(frame) * 4, 8);
      ctx.globalAlpha = 1;
    }
    noGlow();
  }
}

function drawItems() {
  for (const it of items) {
    if (it.k === "coin") {
      const sx = Math.abs(Math.cos(frame * 0.08 + it.x * 0.02));
      glow(it.v ? "#fff3a0" : "#ffd84f", it.v ? 18 : 12);
      ctx.fillStyle = it.v ? "#fff3a0" : "#ffd84f";
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(2, it.r * sx), it.r, 0, 0, 7);
      ctx.fill();
      noGlow();
    } else {
      const P = POWER[it.k],
        bob = Math.sin(frame * 0.1 + it.x) * 3;
      glow(P.color, 18);
      ctx.strokeStyle = P.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(10,14,34,.9)";
      ctx.beginPath();
      ctx.arc(it.x, it.y + bob, it.r + 2, 0, 7);
      ctx.fill();
      ctx.stroke();
      noGlow();
      ctx.fillStyle = P.color;
      ctx.font = "700 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(P.icon, it.x, it.y + bob + 1);
    }
  }
}

function drawParticles() {
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, q.s, q.s);
  }
  ctx.globalAlpha = 1;
  if (pops.length) {
    ctx.font = `700 ${Math.round(13 * UI)}px Orbitron, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const q of pops) {
      ctx.globalAlpha = Math.max(0, q.life);
      ctx.fillStyle = q.color;
      ctx.fillText(q.s, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawFinish() {
  if (!lvl) return;
  const gx = player.x + (lvl.len - dist) * PX_M;
  if (gx > W + 80) return;
  ctx.fillStyle = "#fff";
  ctx.fillRect(gx, groundY - 112, 6, 112);
  ctx.fillRect(gx + 104, groundY - 112, 6, 112);
  for (let i = 0; i < 11; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#fff" : "#10142c";
      ctx.fillRect(gx + 6 + i * 9, groundY - 112 + j * 12, 9, 12);
    }
  ctx.fillStyle = cur.a;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(gx + 6, groundY - 88, 98, 88);
  ctx.globalAlpha = 1;
  ctx.font = `700 ${Math.round(12 * UI)}px Orbitron, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("FINISH", gx + 55, groundY - 60);
}

function drawBoss() {
  if (!(lvl && lvl.boss) || state === "ready" || state === "won") return;
  const bw = 120,
    bh = 86,
    x = W - 78,
    y = H * 0.34 + Math.sin(frame * 0.05) * 12;
  const charging = state === "play" && shotTimer < 350;
  halo(x - bw / 2, y - bh / 2, bw, bh, 22, "#ff3b5c");
  glow("#ff3b5c", 26);
  ctx.fillStyle = grad(
    x - bw / 2,
    y - bh / 2,
    x + bw / 2,
    y + bh / 2,
    "#ff3b5c",
    "#5a0f24",
  );
  rr(x - bw / 2, y - bh / 2, bw, bh, 22);
  ctx.fill();
  noGlow();
  ctx.fillStyle = "#12040a";
  rr(x - bw / 2 + 14, y - 16, bw - 28, 22, 10);
  ctx.fill();
  ctx.fillStyle = charging ? "#fff" : "#ffb36b";
  ctx.beginPath();
  ctx.arc(x + Math.sin(frame * 0.08) * 22, y - 5, 6, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#2a0a14";
  ctx.fillRect(x - bw / 2 - 16, y + 8, 22, 14);
  if (charging) {
    ctx.fillStyle = "#ffb36b";
    ctx.beginPath();
    ctx.arc(x - bw / 2 - 16, y + 15, 8 + Math.sin(frame) * 2, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = "#ffb36b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 20, y - bh / 2);
  ctx.lineTo(x - 28, y - bh / 2 - 14);
  ctx.moveTo(x + 20, y - bh / 2);
  ctx.lineTo(x + 28, y - bh / 2 - 14);
  ctx.stroke();
}

function drawDark() {
  if (!(lvl && lvl.dark) || state === "ready") return;
  const cx = player.x + W * 0.16,
    cy = groundY - 50,
    r = W * 0.55;
  const k = cx + "|" + cy + "|" + r + "|" + Q.flat;
  if (k !== darkKey) {
    darkKey = k;
    if (Q.flat) darkG = "rgba(0,0,0,.5)";
    else {
      const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.6, "rgba(0,0,0,.6)");
      g.addColorStop(1, "rgba(0,0,0,.94)");
      darkG = g;
    }
  }
  ctx.fillStyle = darkG;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

function drawHUD() {
  const u = UI,
    m = 14 * u;
  ctx.textBaseline = "middle";
  let row = m + 8 * u;
  if (lvl && state !== "ready") {
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(17 * u)}px Orbitron, sans-serif`;
    ctx.fillStyle = "#ff6b8a";
    const hl = Math.min(lives, 6);
    ctx.fillText(
      "♥".repeat(hl) + "♡".repeat(Math.max(0, Math.min(maxLives, 6) - hl)),
      m,
      row,
    );
    row += 22 * u;
  }
  if (combo >= 2 && state !== "ready") {
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(14 * u)}px Orbitron, sans-serif`;
    ctx.fillStyle = mult() > 1 ? "#ffd84f" : "#c7edff";
    ctx.fillText("KOMBO " + combo + "  ×" + mult(), m, row);
  }
  if (state === "play" || state === "pause") {
    const bw = 110 * u,
      ty = row + 20 * u,
      pr = turboT > 0 ? turboT / TURBO_MS : turbo / 100;
    ctx.fillStyle = "rgba(10,14,34,.7)";
    rr(m, ty - 4 * u, bw, 8 * u, 4 * u);
    ctx.fill();
    ctx.fillStyle = turboT > 0 ? "#fff" : turbo >= 100 ? "#53f7ff" : "#3b8fa0";
    if (pr > 0.02) {
      rr(m, ty - 4 * u, bw * pr, 8 * u, 4 * u);
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(9 * u)}px Orbitron, sans-serif`;
    ctx.fillText(
      turboT > 0 ? "TURBO!" : turbo >= 100 ? "TURBO TAYYOR [T]" : "⚡ TURBO",
      m + bw + 6 * u,
      ty,
    );
  }
  // level progress / boss health
  if (lvl && state !== "ready") {
    const bw = Math.min(W * 0.34, 300),
      x0 = (W - bw) / 2,
      y0 = m,
      pr = Math.min(1, dist / lvl.len);
    ctx.fillStyle = "rgba(10,14,34,.7)";
    rr(x0, y0, bw, 9 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = lvl.boss ? "#ff3b5c" : cur.a;
    const fw = lvl.boss ? bw * (1 - pr) : bw * pr;
    if (fw > 2) {
      rr(x0, y0, fw, 9 * u, 5 * u);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.font = `600 ${Math.round(10 * u)}px Orbitron, sans-serif`;
    ctx.fillStyle = "#c7edff";
    ctx.fillText(
      lvl.boss
        ? "ZUMARY-X"
        : `${Math.min(lvl.len, Math.floor(dist))} / ${lvl.len} m`,
      W / 2,
      y0 + 20 * u,
    );
  }
  let x = W - m;
  ctx.textAlign = "center";
  const list = [];
  if (shield) list.push(["shield", 1]);
  for (const k of ["slow", "x2", "magnet"])
    if (fx[k] > 0) list.push([k, fx[k] / POWER[k].dur]);
  for (const [k, pct] of list) {
    const P = POWER[k],
      bw = 36 * u,
      bh = 30 * u;
    x -= bw + 4 * u;
    ctx.fillStyle = "rgba(10,14,34,.75)";
    rr(x, m - 4 * u, bw, bh, 8 * u);
    ctx.fill();
    ctx.fillStyle = P.color;
    ctx.font = `700 ${Math.round(13 * u)}px Orbitron, sans-serif`;
    ctx.fillText(P.icon, x + bw / 2, m - 4 * u + bh * 0.42);
    ctx.fillRect(
      x + 5 * u,
      m - 4 * u + bh - 6 * u,
      (bw - 10 * u) * Math.min(1, pct),
      3 * u,
    );
  }
  if (banner.t > 0) {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, banner.t / 500, (banner.max - banner.t) / 300 + 0.2),
    );
    ctx.fillStyle = cur.a;
    glow(cur.a, 20);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(26 * u)}px Orbitron, sans-serif`;
    ctx.fillText(banner.text, W / 2, H * 0.3);
    ctx.font = `500 ${Math.round(11 * u)}px Orbitron, sans-serif`;
    ctx.fillText(banner.sub || "", W / 2, H * 0.3 + 28 * u);
    noGlow();
    ctx.globalAlpha = 1;
  }
  if (shoutO.t > 0) {
    const el = shoutO.max - shoutO.t,
      k = el < 180 ? 1 + 0.5 * (1 - el / 180) : 1;
    ctx.globalAlpha = Math.min(1, shoutO.t / 350);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(Math.min(30 * u, (W * 0.92) / (shoutO.text.length * 0.78)) * k)}px Orbitron, sans-serif`;
    ctx.fillStyle = shoutO.c;
    glow(shoutO.c, 18);
    ctx.fillText(shoutO.text, W / 2, H * 0.5);
    noGlow();
    ctx.globalAlpha = 1;
  }
  if (toastO.t > 0) {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, toastO.t / 300, (toastO.max - toastO.t) / 200 + 0.1),
    );
    ctx.font = `700 ${Math.round(12 * u)}px Orbitron, sans-serif`;
    const tw = ctx.measureText(toastO.text).width + 26 * u,
      ty = (lvl && state !== "ready" ? 44 : 16) * u;
    ctx.fillStyle = "rgba(10,14,34,.88)";
    rr(W / 2 - tw / 2, ty, tw, 26 * u, 13 * u);
    ctx.fill();
    ctx.fillStyle = "#ffd84f";
    ctx.textAlign = "center";
    ctx.fillText(toastO.text, W / 2, ty + 13.5 * u);
    ctx.globalAlpha = 1;
  }
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  if (zoom > 1.002) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
  }
  drawBackground();
  drawFinish();
  drawBoss();
  drawItems();
  drawParticles();
  drawObstacles();
  drawPlayer();
  drawWeather();
  drawDark();
  ctx.restore();
  if (flash.a > 0.01) {
    ctx.globalAlpha = flash.a;
    ctx.fillStyle = flash.c;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (lvl && maxLives > 1 && lives === 1 && state === "play") {
    ctx.strokeStyle = "#ff3b5c";
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(frame * 0.18);
    ctx.lineWidth = 10 * UI;
    ctx.strokeRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  drawHUD();
}

/* ============ OVERLAY / MENU ============ */
const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const bestKey = () => (lvl ? "L" + (sel + 1) : diff);
function renderTop() {
  if (!board.length)
    return `<div class="top-title">REYTING</div><p>Hali natija yo'q. Birinchi bo'l!</p>`;
  return (
    `<div class="top-title">ENG YAXSHI 5 NATIJA</div><ol class="top">` +
    board
      .map(
        (r, i) =>
          `<li><span>${i + 1}.</span><b>${fmt(r.s)}</b><em>${DIFF[r.d] ? DIFF[r.d].name : ""}</em></li>`,
      )
      .join("") +
    `</ol>`
  );
}
function renderSkins() {
  return (
    `<div class="top-title">KOSTYUM · ◎ ${wallet}</div><div class="skins">` +
    SKINS.map((s) => {
      const has = owned.includes(s.id);
      return `<button type="button" data-s="${s.id}" class="${skin === s.id ? "on" : ""}${has ? "" : " lock"}" style="--c:${s.a || "#53f7ff"}"><i></i>${s.n}${has ? "" : `<small>◎${s.cost}</small>`}</button>`;
    }).join("") +
    `</div>`
  );
}
const THUMBS = {};
function buildThumbs() {
  Art.cities.forEach((c) => {
    if (!THUMBS[c]) THUMBS[c] = Art.thumb(c);
  });
}
function renderLevels() {
  return (
    `<div class="top-title">SHAHARLAR</div><div class="levels">` +
    LEVELS.map((L, i) => {
      const locked = i >= prog.unlocked,
        th = THUMBS[THEMES[L.theme].city];
      const bg = th
        ? `style="background-image:linear-gradient(180deg,rgba(5,7,22,.1),rgba(5,7,22,.88)),url(${th})"`
        : "";
      return `<button type="button" data-l="${i}" ${bg} class="${i === sel ? "on" : ""}${locked ? " lock" : ""}"><b>${locked ? "🔒" : i + 1}</b><span>${L.name}</span><small>${locked ? "&nbsp;" : starText(prog.stars[i + 1] || 0)}</small></button>`;
    }).join("") +
    `</div>`
  );
}
function renderShop() {
  return (
    `<div class="top-title">DO'KON · ◎ ${wallet}</div><div class="shop">` +
    SHOP.map((it) => {
      const lv = up[it.k] || 0,
        maxed = lv >= it.max,
        cost = it.cost[lv];
      return `<div class="shop-row"><div><b>${it.n}${it.max > 1 ? ` ${lv}/${it.max}` : ""}</b><small>${it.d}</small></div><button type="button" data-u="${it.k}" class="${maxed ? "done" : wallet >= cost ? "" : "lock"}">${maxed ? "✓" : "◎" + cost}</button></div>`;
    }).join("") +
    `</div>`
  );
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
  document
    .querySelectorAll("#nav button")
    .forEach((b) =>
      b.classList.toggle("on", b.dataset.p === (o.panel || "play")),
    );
  $("dailyBox").innerHTML = o.menu ? renderDaily() : "";
  $("shopBox").innerHTML =
    o.panel === "shop"
      ? renderShop()
      : o.panel === "missions"
        ? renderMissions()
        : o.panel === "medals"
          ? renderMedals()
          : "";
  $("shareButton").style.display = o.share ? "flex" : "none";
  $("menuButton").textContent = o.menuLabel || "☰ MENYU";
  shopOpen = !!o.panel;
  $("overlay").classList.remove("hidden");
  paintDiff();
}
function paintDiff() {
  document
    .querySelectorAll("#diff button")
    .forEach((b) => b.classList.toggle("on", b.dataset.d === diff));
  document
    .querySelectorAll("#mode button")
    .forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
}
function showReady() {
  if (mode === "campaign") {
    const L = LEVELS[sel];
    showOverlay(
      "✦",
      `DARAJA ${sel + 1}: ${L.name}`,
      `${L.tag}.<br>Maqsad: <b>${L.len} m</b> yugur · <b>${L.coins}</b> tanga yig' · 3 ta ♥<em class="fact">💡 ${pick(FACTS[THEMES[L.theme].city])}</em>`,
      `▶   DARAJA ${sel + 1}NI BOSHLA`,
      { menu: true, skins: true },
    );
  } else {
    showOverlay(
      "✦",
      "TAYYORMISAN, YUGURUVCHI?",
      "Cheksiz rejim: to'xtamasdan yugur.<br>Har 500 ballda yangi zona boshlanadi.",
      "▶   YUGURISHNI BOSHLA!",
      { menu: true, skins: true, top: true },
    );
  }
}

/* ============ FLOW ============ */
function resetGame() {
  state = "ready";
  lvl = mode === "campaign" ? LEVELS[sel] : null;
  dist = 0;
  hits = 0;
  maxLives = lvl ? 3 + up.life : 1;
  lives = maxLives;
  shotTimer = 1500;
  fuel = fuelMax();
  flying = false;
  sq = 0;
  zoom = 1;
  freeze = 0;
  flash.a = 0;
  shoutO.t = 0;
  lastPhase = 0;
  hbT = 0;
  turbo = 0;
  turboT = 0;
  revived = false;
  pet.x = player.x - 34;
  pet.y = player.y - 18;
  score = 0;
  speed = (lvl || DIFF[diff]).base;
  frame = 0;
  coins = 0;
  combo = 0;
  shake = 0;
  invul = 0;
  shield = !!up.sh;
  banner = { text: "", sub: "", t: 0, max: 1 };
  lastZone = 0;
  cur = { ...THEMES[lvl ? lvl.theme : 0] };
  skyKey = "";
  fx = { slow: 0, x2: 0, magnet: 0 };
  obstacles = [];
  items = [];
  particles = [];
  pops = [];
  obstacleTimer = 0;
  nextObstacle = 1000;
  itemTimer = 0;
  nextItem = rnd(8000, 12000);
  Object.assign(player, {
    y: groundY - 44,
    h: 44,
    vy: 0,
    g: lvl && lvl.g ? lvl.g : 0.65,
    grounded: true,
    jumps: 2,
    trail: [],
  });
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  buildWorld();
  updateHUD();
}
function startGame() {
  if (state === "play") return;
  if (state === "over" || state === "ready" || state === "won") resetGame();
  state = "play";
  lastT = 0;
  fpsAcc = 0;
  fpsN = -45;
  if (COARSE && !fsOn) setFs(true);
  if (lvl)
    banner = {
      text: `DARAJA ${sel + 1}`,
      sub: lvl.name + " · " + lvl.tag,
      t: 2800,
      max: 2800,
    };
  $("overlay").classList.add("hidden");
  beep(660, 0.1, "triangle");
  startMusic();
  if (up.jet && !store.get("zr_jh", 0)) {
    store.set("zr_jh", 1);
    shout("JETPACK: havoda yana bos va USHLAB TUR!", "#ffb36b", 3400);
  }
}
function goMenu() {
  resetGame();
  showReady();
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  showOverlay(
    "❚❚",
    "PAUZA",
    "Davom etish uchun tugmani bosing.",
    "▶   DAVOM ETISH",
    { menuBtn: true },
  );
}
function resumeGame() {
  if (state !== "pause") return;
  state = "play";
  lastT = 0;
  fpsAcc = 0;
  fpsN = -20;
  startMusic();
  $("overlay").classList.add("hidden");
}

function saveBest() {
  const s = Math.floor(score),
    k = bestKey(),
    isBest = s > (bests[k] || 0);
  if (isBest) {
    bests[k] = s;
    store.set("zr_bests", bests);
  }
  return isBest;
}

function endGame() {
  if (state === "over" || state === "revive") return;
  shake = 12;
  sfx.hit();
  zoom = 1.06;
  flash = { c: "#ff3b5c", a: 0.4 };
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  burst(player.x + player.w / 2, player.y + player.h / 2, "#ff4fd8", 35);
  if (!revived && wallet >= REVIVE_COST && (lvl || score > 120)) {
    state = "revive";
    setTimeout(() => {
      if (state !== "revive") return;
      showOverlay(
        "♥",
        "TIRILASANMI?",
        `Bir marta davom et — atigi <b>◎${REVIVE_COST}</b>.<br>Hamyoning: ◎ ${wallet}`,
        `♥   TIRILISH · ◎${REVIVE_COST}`,
        { menuBtn: true, menuLabel: "KERAK EMAS" },
      );
    }, 500);
    return;
  }
  finalizeOver();
}
function doRevive() {
  if (state !== "revive" || wallet < REVIVE_COST) return;
  wallet -= REVIVE_COST;
  store.set("zr_wallet", wallet);
  revived = true;
  state = "play";
  lastT = 0;
  fpsAcc = 0;
  fpsN = -20;
  invul = 2600;
  lives = 1;
  shield = true;
  obstacles = obstacles.filter(
    (o) => o.x > player.x + 260 || o.x + o.w < player.x - 20,
  );
  Object.assign(player, {
    h: 44,
    y: groundY - 44,
    vy: 0,
    grounded: true,
    jumps: 2,
  });
  $("overlay").classList.add("hidden");
  flash = { c: "#ffffff", a: 0.4 };
  zoom = 1.07;
  shout("QAYTA OMON!", "#50ffb0", 1200);
  [500, 700, 1000].forEach((f, i) =>
    setTimeout(() => beep(f, 0.12, "triangle", 0.06), i * 90),
  );
  startMusic();
}
function finalizeOver() {
  state = "over";
  const s = Math.floor(score),
    isBest = saveBest();
  if (!lvl && s > 0) {
    board.push({ s, d: diff });
    board.sort((a, b) => b.s - a.s);
    board = board.slice(0, 5);
    store.set("zr_top", board);
  }
  wallet += coins;
  store.set("zr_wallet", wallet);
  const rk = bookRun(0);
  updateHUD();
  setTimeout(() => {
    if (state !== "over") return;
    if (lvl) {
      showOverlay(
        "✕",
        "DARAJA TUGAMADI",
        `MASOFA: <b>${Math.floor(dist)} / ${lvl.len} m</b> · TANGA: <b>${coins}</b> (jami ◎ ${wallet})<br>${pick(LOSE)}${rk}`,
        "↻   QAYTA URINISH",
        { menu: true, skins: true, share: true },
      );
    } else {
      showOverlay(
        isBest ? "★" : "✕",
        isBest ? "YANGI REKORD!" : "YUGURISH TUGADI",
        `NATIJA: <b>${fmt(score)}</b> · TANGA: <b>${coins}</b> (jami ◎ ${wallet})<br>${pick(LOSE)}<br>REKORD (${DIFF[diff].name}): <b>${fmt(bests[diff] || 0)}</b>${rk}`,
        "↻   YANA URINISH",
        { menu: true, skins: true, top: true, share: true },
      );
    }
  }, 650);
}

function winLevel() {
  const L = lvl,
    id = sel + 1;
  state = "won";
  sfx.zone();
  vib(80);
  flash = { c: "#fff", a: 0.5 };
  zoom = 1.08;
  [523, 659, 784, 1047].forEach((f2, i) =>
    setTimeout(() => beep(f2, 0.18, "triangle", 0.07), i * 130),
  );
  obstacles = [];
  items = [];
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  for (let i = 0; i < 6; i++)
    setTimeout(() => {
      if (state === "won")
        burst(
          rnd(100, W - 100),
          rnd(60, groundY - 60),
          ["#53f7ff", "#ff4fd8", "#ffd84f"][i % 3],
          30,
        );
    }, i * 130);
  if (L.boss) burst(W - 78, H * 0.34, "#ff3b5c", 60);
  const st = 1 + (coins >= L.coins ? 1 : 0) + (hits === 0 ? 1 : 0);
  if (!(prog.stars[id] > 0)) toast("🖼 Yangi otkritka: " + L.name);
  prog.stars[id] = Math.max(prog.stars[id] || 0, st);
  if (id < LEVELS.length) prog.unlocked = Math.max(prog.unlocked, id + 1);
  store.set("zr_prog", prog);
  saveBest();
  mAdd("win", 1);
  meta.wins++;
  const rk = bookRun(50);
  wallet += coins + st * 10;
  store.set("zr_wallet", wallet);
  const last = id >= LEVELS.length;
  if (!last) {
    sel = id;
    store.set("zr_sel", sel);
  }
  updateHUD();
  setTimeout(() => {
    if (state !== "won") return;
    showOverlay(
      starText(st),
      last ? "O'YIN YAKUNLANDI!" : "DARAJA TUGADI!",
      `${L.name}<br>★ tugatish ✓ · ★ ${coins}/${L.coins} tanga ${coins >= L.coins ? "✓" : "✗"} · ★ zarbasiz ${hits === 0 ? "✓" : "✗ (" + hits + ")"}<br>+${st * 10} bonus tanga · jami ◎ ${wallet}<br>${pick(WIN)}<em class="fact">💡 ${pick(FACTS[THEMES[L.theme].city])}</em>${rk}`,
      last ? "↻   QAYTA O'YNA" : "▶   KEYINGI DARAJA",
      { menuBtn: true, share: true },
    );
  }, 900);
}

function loop(t) {
  const raw = lastT ? t - lastT : 16.67;
  const delta = Math.min(raw, 40);
  lastT = t;
  if (freeze > 0 && state === "play") {
    freeze -= delta;
    draw();
    requestAnimationFrame(loop);
    return;
  }
  if (state === "play") {
    updateGame(delta);
    // auto-lower quality on slow devices
    if (++fpsN > 0) fpsAcc += raw;
    if (fpsN >= 90) {
      if (fpsAcc / fpsN > 25 && Q.level < 2) setQuality(Q.level + 1);
      fpsAcc = 0;
      fpsN = 0;
    }
  } else if (state !== "pause") {
    updateParticles(delta);
    if (state === "ready" || state === "won") {
      frame += delta / 16.67;
      scrollWorld(((state === "won" ? 3 : 1.2) * delta) / 16.67);
    }
  }
  if (state !== "pause" || !document.hidden) draw();
  requestAnimationFrame(loop);
}

/* ============ INPUT ============ */
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"],
  DUCK_KEYS = ["ArrowDown", "KeyS"];
function action() {
  if (state === "ready" || state === "over" || state === "won") startGame();
  else if (state === "pause") resumeGame();
  else jump();
}
document.addEventListener("keydown", (e) => {
  if (JUMP_KEYS.includes(e.code)) {
    e.preventDefault();
    jumpHeld = true;
    if (!e.repeat) action();
  } else if (DUCK_KEYS.includes(e.code)) {
    e.preventDefault();
    duckKey = true;
  } else if (
    e.code === "KeyT" ||
    e.code === "ShiftLeft" ||
    e.code === "ShiftRight"
  ) {
    useTurbo();
  } else if (e.code === "KeyP" || e.code === "Escape") {
    state === "pause" ? resumeGame() : pauseGame();
  } else if (e.code === "KeyM") toggleMute();
  else if (e.code === "KeyR") {
    resetGame();
    showReady();
  } else if (e.code === "KeyF") toggleFs();
});
document.addEventListener("keyup", (e) => {
  if (JUMP_KEYS.includes(e.code)) {
    jumpHeld = false;
    releaseJump();
  }
  if (DUCK_KEYS.includes(e.code)) duckKey = false;
});

let py = 0;
canvas.addEventListener("pointerdown", (e) => {
  py = e.clientY;
  jumpHeld = true;
  action();
});
canvas.addEventListener("pointermove", (e) => {
  if ((e.buttons || e.pointerType === "touch") && e.clientY - py > 30)
    duckPtr = true;
});
["pointerup", "pointercancel"].forEach((n) =>
  canvas.addEventListener(n, () => {
    duckPtr = false;
    jumpHeld = false;
    releaseJump();
  }),
);

function holdButton(el, down, up) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (x) {}
    el.classList.add("on");
    down();
  });
  const end = () => {
    el.classList.remove("on");
    up();
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) =>
    el.addEventListener(n, end),
  );
}
holdButton(
  $("padJump"),
  () => {
    jumpHeld = true;
    action();
  },
  () => {
    jumpHeld = false;
    releaseJump();
  },
);
holdButton(
  $("padDuck"),
  () => {
    duckBtn = true;
  },
  () => {
    duckBtn = false;
  },
);

$("startButton").addEventListener("click", () => {
  if (shopOpen) goMenu();
  else if (state === "revive") doRevive();
  else if (state === "pause") resumeGame();
  else startGame();
});
$("restartButton").addEventListener("click", () => {
  resetGame();
  startGame();
});
$("pauseButton").addEventListener("click", () =>
  state === "pause" ? resumeGame() : pauseGame(),
);
$("muteButton").addEventListener("click", toggleMute);
$("fullscreenButton").addEventListener("click", toggleFs);

$("diff").addEventListener("click", (e) => {
  const d = e.target.dataset.d;
  if (!d) return;
  diff = d;
  store.set("zr_diff", d);
  paintDiff();
  resetGame();
  updateHUD();
});
$("skinBox").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-s]");
  if (!btn) return;
  const s = SKINS.find((k) => k.id === btn.dataset.s);
  if (!owned.includes(s.id)) {
    if (wallet < s.cost) {
      btn.classList.remove("shake");
      void btn.offsetWidth;
      btn.classList.add("shake");
      vib(30);
      return;
    }
    wallet -= s.cost;
    owned.push(s.id);
    store.set("zr_wallet", wallet);
    store.set("zr_owned", owned);
    sfx.power();
  }
  skin = s.id;
  store.set("zr_skin", skin);
  $("skinBox").innerHTML = renderSkins();
});

$("mode").addEventListener("click", (e) => {
  const m = e.target.dataset.m;
  if (!m || m === mode) return;
  mode = m;
  store.set("zr_mode", m);
  goMenu();
});
$("levelBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-l]");
  if (!b) return;
  const i = +b.dataset.l;
  if (i >= prog.unlocked) {
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    vib(30);
    return;
  }
  sel = i;
  store.set("zr_sel", i);
  goMenu();
});
$("menuButton").addEventListener("click", () => {
  if (state === "revive") finalizeOver();
  else goMenu();
});
$("padTurbo").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  useTurbo();
});
$("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-p]");
  if (!b) return;
  b.dataset.p === "play" ? goMenu() : showPanel(b.dataset.p);
});
$("dailyBox").addEventListener("click", (e) => {
  if (!e.target.closest("#giftBtn")) return;
  const t = todayStr();
  if (meta.boxDay === t) return;
  const lucky = Math.random() < 0.2 ? 100 : 0,
    amt = 30 + Math.min(meta.streak, 7) * 15 + lucky;
  wallet += amt;
  meta.boxDay = t;
  store.set("zr_wallet", wallet);
  checkAch();
  saveMeta();
  sfx.power();
  vib(30);
  $("dailyBox").innerHTML =
    renderDaily() +
    `<div class="gift-got">🎁 +◎${amt}${lucky ? " · OMADLI QUTI! 🍀" : ""}</div>`;
  if ($("skinBox").innerHTML) $("skinBox").innerHTML = renderSkins();
});
$("shareButton").addEventListener("click", async () => {
  const b = $("shareButton"),
    old = b.textContent;
  const txt = `ZUMARY RUN: ${fmt(score)} ball, ${coins} tanga${lvl ? ` · ${lvl.name} ${Math.floor(dist)} m` : ""}! Meni yeta olasanmi? 🏃⚡`;
  try {
    if (navigator.share)
      await navigator.share({
        title: "ZUMARY RUN",
        text: txt,
        url: location.href,
      });
    else {
      await navigator.clipboard.writeText(txt + " " + location.href);
      b.textContent = "✓ NUSXALANDI";
      setTimeout(() => (b.textContent = old), 1500);
    }
  } catch (x) {}
});
$("shopBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-u]");
  if (!b) return;
  const it = SHOP.find((x) => x.k === b.dataset.u),
    lv = up[it.k] || 0;
  if (lv >= it.max) return;
  const cost = it.cost[lv];
  if (wallet < cost) {
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    vib(30);
    beep(160, 0.15, "sawtooth", 0.04);
    return;
  }
  wallet -= cost;
  up[it.k] = lv + 1;
  store.set("zr_wallet", wallet);
  store.set("zr_up", up);
  sfx.power();
  vib(25);
  $("shopBox").innerHTML = renderShop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
window.addEventListener("pagehide", () => {
  saveMeta();
  pauseGame();
});
shell.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) b.blur();
});

function toggleMute() {
  muted = !muted;
  store.set("zr_muted", muted);
  if (!muted && state === "play") startMusic();
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
  const on = !fsOn;
  setFs(on);
  try {
    if (on) {
      if (shell.requestFullscreen)
        await shell.requestFullscreen({ navigationUI: "hide" });
      if (COARSE && screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch (x) {}
      }
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      if (screen.orientation && screen.orientation.unlock)
        screen.orientation.unlock();
    }
  } catch (x) {}
  resize();
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && fsOn) setFs(false);
  resize();
});

/* ============ INIT ============ */
if ("ResizeObserver" in window)
  new ResizeObserver(() => resize()).observe(wrap);
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 250));
$("muteButton").firstChild.textContent = muted ? "🔇" : "🔊";
resize();
resetGame();
showReady();
requestAnimationFrame(loop);
setTimeout(() => {
  buildThumbs();
  if (state === "ready" && !shopOpen) showReady();
}, 300);
