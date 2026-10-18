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
    n: "NEON SHAHAR",
    top: "#090c23",
    bot: "#11132c",
    a: "#53f7ff",
    b: "#a78bfa",
  },
  {
    n: "PUSHTI KECHA",
    top: "#1d0b24",
    bot: "#2a1030",
    a: "#ff4fd8",
    b: "#ff8a5c",
  },
  {
    n: "ZUMRAD ORBITA",
    top: "#06201e",
    bot: "#0b2b2a",
    a: "#50ffb0",
    b: "#53f7ff",
  },
  {
    n: "OLTIN QUYOSH",
    top: "#231a06",
    bot: "#32230a",
    a: "#ffd84f",
    b: "#ff7a59",
  },
];
const POWER = {
  shield: { icon: "🛡", color: "#53f7ff", dur: 0 },
  slow: { icon: "⏳", color: "#a78bfa", dur: 5000 },
  x2: { icon: "×2", color: "#ffd84f", dur: 8000 },
  magnet: { icon: "🧲", color: "#ff4fd8", dur: 8000 },
};
const SKINS = [
  { id: "default", n: "ZUMARY", a: null, b: null, cost: 0 },
  { id: "rose", n: "ROZA", a: "#ff4fd8", b: "#ff8a5c", cost: 80 },
  { id: "mint", n: "MINT", a: "#50ffb0", b: "#53f7ff", cost: 200 },
  { id: "gold", n: "OLTIN", a: "#ffd84f", b: "#ff7a59", cost: 400 },
];

THEMES.push(
  {
    n: "QORONG'I TUNNEL",
    top: "#04050e",
    bot: "#0a0c1c",
    a: "#8c7bff",
    b: "#53f7ff",
  },
  {
    n: "ZUMARY-X BOSS",
    top: "#16040b",
    bot: "#260a14",
    a: "#ff3b5c",
    b: "#ffb36b",
  },
);
const PX_M = 30; // world pixels per metre
const LEVELS = [
  {
    name: "NEON SHAHAR",
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
    name: "PUSHTI KECHA",
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
    name: "ZUMRAD ORBITA",
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
    name: "QORONG'I TUNNEL",
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
    name: "ZUMARY-X BOSS",
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
    beep(880, 0.07, "triangle", 0.05);
    setTimeout(() => beep(1320, 0.09, "triangle", 0.05), 55);
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
  const count = Math.ceil(W / 40) + 2;
  stars = Array.from({ length: COARSE ? 45 : 75 }, () => ({
    x: rnd(0, W),
    y: rnd(0, groundY - 47),
    s: rnd(0.3, 2),
    a: rnd(0.15, 0.75),
  }));
  layers = [
    makeLayer(Math.max(14, count), 60, 150, 40, 80, 0.12, "#0d1229", false),
    makeLayer(
      Math.max(11, Math.ceil(W / 80) + 2),
      70,
      160,
      54,
      105,
      0.35,
      "#101733",
      true,
    ),
  ];
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
const mkCoin = (x, y) => ({ k: "coin", x, y, r: 9 });

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
function spawnShot() {
  const high = Math.random() < 0.5,
    y = high ? groundY - 50 : groundY - 26;
  obstacles.push({
    t: "shot",
    x: W - 150,
    y,
    w: 30,
    h: 16,
    passed: false,
    c: "#ff3b5c",
    sp: 1.45,
  });
  burst(W - 150, y + 8, "#ffb36b", 6);
  beep(220, 0.08, "sawtooth", 0.03, -60);
}
function spawnPower() {
  const k = ["shield", "slow", "x2", "magnet"][Math.floor(Math.random() * 4)];
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
  first ? sfx.jump() : sfx.jump2();
}
function releaseJump() {
  if (state === "play" && player.vy < -5) player.vy = -5;
}

/* ============ UPDATE ============ */
function scrollWorld(d) {
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
  banner.t = Math.max(0, banner.t - delta);

  const cfg = lvl || DIFF[diff];
  score += f * 0.12;
  speed = lvl
    ? lvl.base + (lvl.max - lvl.base) * Math.min(1, dist / lvl.len)
    : Math.min(cfg.base + score / 180, cfg.max);
  const ev = speed * (fx.slow > 0 ? 0.65 : 1);

  let T;
  if (lvl) {
    dist += (ev * f) / PX_M;
    T = THEMES[lvl.theme];
  } else {
    const zone = Math.floor(score / 500) % 4;
    if (zone !== lastZone) {
      lastZone = zone;
      banner = { text: THEMES[zone].n, sub: "YANGI ZONA", t: 2200, max: 2200 };
      sfx.zone();
    }
    T = THEMES[zone];
  }
  if (cur.top !== T.top || cur.a !== T.a || cur.b !== T.b || cur.bot !== T.bot)
    ["top", "bot", "a", "b"].forEach((k) => (cur[k] = mix(cur[k], T[k], 0.04)));

  scrollWorld(ev * f);

  const p = player;
  p.h = p.grounded && duck() ? 24 : 44;
  if (p.grounded) p.y = groundY - p.h;
  p.vy += p.g * (duck() && !p.grounded ? 2.2 : 1) * f;
  p.y += p.vy * f;
  if (p.y + p.h >= groundY) {
    if (!p.grounded && p.vy > 3) burst(p.x + p.w / 2, groundY, "#a78bfa", 5);
    p.y = groundY - p.h;
    p.vy = 0;
    p.grounded = true;
    p.jumps = 2;
  } else p.grounded = false;

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
    shotTimer -= delta;
    if (shotTimer <= 0) {
      spawnShot();
      shotTimer = rnd(1100, 1700) * Math.max(0.7, 5.5 / speed);
    }
  }

  const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 };
  const pcx = p.x + p.w / 2,
    pcy = p.y + p.h / 2;
  for (const o of obstacles) {
    o.x -= ev * f * (o.sp || 1);
    if (o.t === "drone") o.y = o.by + Math.sin(frame * 0.1) * 4;
    if (invul <= 0) {
      if (o.t === "pit") {
        if (p.grounded && pcx > o.x + 6 && pcx < o.x + o.w - 6 && hurt(o))
          return;
      } else if (hit(box, o, 3) && hurt(o)) return;
    }
    if (!o.passed && o.x + o.w < p.x) {
      o.passed = true;
      combo++;
      const g = 10 * mult();
      score += g;
      pop(p.x + 20, p.y - 14, "+" + g, "#c7edff");
    }
  }
  obstacles = obstacles.filter((o) => o.x + o.w > -10);

  for (const it of items) {
    it.x -= ev * f;
    if (it.k === "coin" && fx.magnet > 0) {
      const dx = pcx - it.x,
        dy = pcy - it.y,
        d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) {
        it.x += (dx / d) * 9 * f;
        it.y += (dy / d) * 9 * f;
      }
    }
    if (
      Math.abs(it.x - pcx) < it.r + p.w / 2 - 3 &&
      Math.abs(it.y - pcy) < it.r + p.h / 2 - 3
    ) {
      it.got = true;
      if (it.k === "coin") {
        coins++;
        combo++;
        const g = 25 * mult();
        score += g;
        pop(it.x, it.y, "+" + g, "#ffd84f");
        burst(it.x, it.y, "#ffd84f", 5);
        sfx.coin();
      } else {
        if (it.k === "shield") shield = true;
        else fx[it.k] = POWER[it.k].dur;
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
}

/* ============ DRAW ============ */
function drawBackground() {
  const key = cur.top + cur.bot + H;
  if (key !== skyKey) {
    skyKey = key;
    skyG = grad(0, 0, 0, H, cur.top, cur.bot);
  }
  ctx.fillStyle = skyG;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  ctx.fillStyle = "#c7edff";
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  const mr = Math.max(1, UI * 0.8);
  ctx.fillStyle = cur.b;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(W * 0.84, H * 0.22, 54 * mr, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(W * 0.84, H * 0.22, 26 * mr, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (const L of layers) {
    ctx.fillStyle = L.shade;
    for (const b of L.b) ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
    if (!L.windows || Q.level >= 2) continue;
    for (const b of L.b) {
      ctx.fillStyle = (b.seed | 0) % 2 ? cur.a : cur.b;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (let wy = groundY - b.h + 10; wy < groundY - 8; wy += 15)
        for (let wx = b.x + 8; wx < b.x + b.w - 6; wx += 14)
          if (((b.seed * 7 + wy * 0.37 + wx * 0.11) | 0) % 3 !== 0)
            ctx.rect(wx, wy, 4, 5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const gk = groundY + "|" + H + "|" + Q.flat;
  if (gk !== gndKey) {
    gndKey = gk;
    gndG = Q.flat
      ? "rgba(255,255,255,.06)"
      : (() => {
          const g = ctx.createLinearGradient(0, groundY, 0, H);
          g.addColorStop(0, "rgba(255,255,255,.1)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          return g;
        })();
  }
  ctx.fillStyle = gndG;
  ctx.fillRect(-20, groundY, W + 40, H - groundY + 20);
  ctx.strokeStyle = cur.a;
  ctx.lineWidth = 2;
  glow(cur.a, 14);
  ctx.beginPath();
  ctx.moveTo(-20, groundY);
  ctx.lineTo(W + 20, groundY);
  ctx.stroke();
  noGlow();

  const off = (frame * speed * 0.7) % 90;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -off; x < W + 40; x += 90) {
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 35, H + 10);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = player,
    small = p.h < 40;
  const [pa, pb] = skinColors();
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
}

function drawObstacles() {
  for (const o of obstacles) {
    if (o.t === "pit") {
      ctx.fillStyle = "#03040a";
      ctx.fillRect(o.x, groundY - 1, o.w, H - groundY + 22);
      ctx.fillStyle = o.c;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(o.x - 2, groundY - 1, 3, H - groundY + 22);
      ctx.fillRect(o.x + o.w - 1, groundY - 1, 3, H - groundY + 22);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(o.x, groundY + 6, o.w, 2);
      ctx.globalAlpha = 1;
      continue;
    }
    halo(o.x, o.y, o.w, o.h, 5, o.c);
    glow(o.c, 18);
    ctx.fillStyle = grad(
      o.x,
      o.y,
      o.x + o.w,
      o.y + o.h,
      o.c,
      o.t === "drone" ? "#7a2b12" : "#7c245f",
    );
    rr(o.x, o.y, o.w, o.h, o.t === "drone" ? 12 : 5);
    ctx.fill();
    noGlow();
    ctx.strokeStyle = "#ffc0f0";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (o.t === "shot") {
      ctx.fillStyle = "#ffb36b";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(o.x + o.w, o.y + 4, 16 + Math.sin(frame) * 4, 8);
      ctx.globalAlpha = 1;
    }
    if (o.t === "drone") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(o.x + 8, o.y + 10, o.w - 16, 5);
      ctx.fillStyle = "#ff2d55";
      ctx.fillRect(
        o.x + o.w / 2 - 3 + Math.sin(frame * 0.2) * 8,
        o.y + 10,
        6,
        5,
      );
      ctx.strokeStyle = "#ffd0c0";
      ctx.lineWidth = 2;
      const s = Math.sin(frame * 1.2) * 12;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2 - s, o.y - 4);
      ctx.lineTo(o.x + o.w / 2 + s, o.y - 4);
      ctx.stroke();
    }
  }
}

function drawItems() {
  for (const it of items) {
    if (it.k === "coin") {
      const sx = Math.abs(Math.cos(frame * 0.08 + it.x * 0.02));
      glow("#ffd84f", 12);
      ctx.fillStyle = "#ffd84f";
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
    const hl = Math.min(3, lives);
    ctx.fillText("♥".repeat(hl) + "♡".repeat(3 - hl), m, row);
    row += 22 * u;
  }
  if (combo >= 2 && state !== "ready") {
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(14 * u)}px Orbitron, sans-serif`;
    ctx.fillStyle = mult() > 1 ? "#ffd84f" : "#c7edff";
    ctx.fillText("KOMBO " + combo + "  ×" + mult(), m, row);
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
    ctx.fillRect(x + 5 * u, m - 4 * u + bh - 6 * u, (bw - 10 * u) * pct, 3 * u);
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
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBackground();
  drawFinish();
  drawBoss();
  drawItems();
  drawParticles();
  drawObstacles();
  drawPlayer();
  drawDark();
  ctx.restore();
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
function renderLevels() {
  return (
    `<div class="top-title">DARAJALAR</div><div class="levels">` +
    LEVELS.map((L, i) => {
      const locked = i >= prog.unlocked;
      return `<button type="button" data-l="${i}" class="${i === sel ? "on" : ""}${locked ? " lock" : ""}"><b>${locked ? "🔒" : i + 1}</b><span>${L.name}</span><small>${locked ? "&nbsp;" : starText(prog.stars[i + 1] || 0)}</small></button>`;
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
      `${L.tag}.<br>Maqsad: <b>${L.len} m</b> yugur · <b>${L.coins}</b> tanga yig' · 3 ta ♥`,
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
  lives = lvl ? 3 : 1;
  shotTimer = 1500;
  score = 0;
  speed = (lvl || DIFF[diff]).base;
  frame = 0;
  coins = 0;
  combo = 0;
  shake = 0;
  invul = 0;
  shield = false;
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
  duckKey = duckPtr = duckBtn = false;
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
  if (lvl)
    banner = {
      text: `DARAJA ${sel + 1}`,
      sub: lvl.name + " · " + lvl.tag,
      t: 2800,
      max: 2800,
    };
  $("overlay").classList.add("hidden");
  beep(660, 0.1, "triangle");
}
function goMenu() {
  resetGame();
  showReady();
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  duckKey = duckPtr = duckBtn = false;
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
  if (state === "over") return;
  state = "over";
  shake = 12;
  sfx.hit();
  duckKey = duckPtr = duckBtn = false;
  burst(player.x + player.w / 2, player.y + player.h / 2, "#ff4fd8", 35);
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
  updateHUD();
  setTimeout(() => {
    if (state !== "over") return;
    if (lvl) {
      showOverlay(
        "✕",
        "DARAJA TUGAMADI",
        `MASOFA: <b>${Math.floor(dist)} / ${lvl.len} m</b> · TANGA: <b>${coins}</b><br>Yana urinib ko'r — sen uddalaysan!`,
        "↻   QAYTA URINISH",
        { menu: true, skins: true },
      );
    } else {
      showOverlay(
        isBest ? "★" : "✕",
        isBest ? "YANGI REKORD!" : "YUGURISH TUGADI",
        `NATIJA: <b>${fmt(score)}</b> · TANGA: <b>${coins}</b><br>REKORD (${DIFF[diff].name}): <b>${fmt(bests[diff] || 0)}</b>`,
        "↻   YANA URINISH",
        { menu: true, skins: true, top: true },
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
  obstacles = [];
  items = [];
  duckKey = duckPtr = duckBtn = false;
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
  prog.stars[id] = Math.max(prog.stars[id] || 0, st);
  if (id < LEVELS.length) prog.unlocked = Math.max(prog.unlocked, id + 1);
  store.set("zr_prog", prog);
  saveBest();
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
      `${L.name}<br>★ tugatish ✓ · ★ ${coins}/${L.coins} tanga ${coins >= L.coins ? "✓" : "✗"} · ★ zarbasiz ${hits === 0 ? "✓" : "✗ (" + hits + ")"}<br>+${st * 10} bonus tanga`,
      last ? "↻   QAYTA O'YNA" : "▶   KEYINGI DARAJA",
      { menuBtn: true },
    );
  }, 900);
}

function loop(t) {
  const raw = lastT ? t - lastT : 16.67;
  const delta = Math.min(raw, 40);
  lastT = t;
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
    if (!e.repeat) action();
  } else if (DUCK_KEYS.includes(e.code)) {
    e.preventDefault();
    duckKey = true;
  } else if (e.code === "KeyP" || e.code === "Escape") {
    state === "pause" ? resumeGame() : pauseGame();
  } else if (e.code === "KeyM") toggleMute();
  else if (e.code === "KeyR") {
    resetGame();
    showReady();
  } else if (e.code === "KeyF") toggleFs();
});
document.addEventListener("keyup", (e) => {
  if (JUMP_KEYS.includes(e.code)) releaseJump();
  if (DUCK_KEYS.includes(e.code)) duckKey = false;
});

let py = 0;
canvas.addEventListener("pointerdown", (e) => {
  py = e.clientY;
  action();
});
canvas.addEventListener("pointermove", (e) => {
  if ((e.buttons || e.pointerType === "touch") && e.clientY - py > 30)
    duckPtr = true;
});
["pointerup", "pointercancel"].forEach((n) =>
  canvas.addEventListener(n, () => {
    duckPtr = false;
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
holdButton($("padJump"), action, releaseJump);
holdButton(
  $("padDuck"),
  () => {
    duckBtn = true;
  },
  () => {
    duckBtn = false;
  },
);

$("startButton").addEventListener("click", () =>
  state === "pause" ? resumeGame() : startGame(),
);
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
$("menuButton").addEventListener("click", goMenu);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
window.addEventListener("pagehide", pauseGame);
shell.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) b.blur();
});

function toggleMute() {
  muted = !muted;
  store.set("zr_muted", muted);
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
