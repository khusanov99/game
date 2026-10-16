/* ============ SETUP ============ */
const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  ctx = canvas.getContext("2d");
const W = 900,
  H = 350,
  groundY = 292;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.scale(DPR, DPR);

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

let diff = store.get("zr_diff", "normal");
let bests = store.get("zr_bests", {});
let board = store.get("zr_top", []);
let muted = store.get("zr_muted", false);

/* ============ SOUND ============ */
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
  },
  hit: () => beep(140, 0.35, "sawtooth", 0.07, -90),
  zone: () => {
    beep(440, 0.12, "triangle");
    setTimeout(() => beep(660, 0.12, "triangle"), 110);
    setTimeout(() => beep(880, 0.2, "triangle"), 220);
  },
};

/* ============ STATE ============ */
let state = "ready"; // ready | play | pause | over
let score, speed, frame, coins, combo, shake, invul, shield, banner, lastZone;
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
  stars = Array.from({ length: 75 }, () => ({
    x: rnd(0, W),
    y: rnd(0, 245),
    s: rnd(0.3, 2),
    a: rnd(0.15, 0.75),
  }));
  layers = [
    makeLayer(14, 60, 150, 40, 80, 0.12, "#0d1229", false),
    makeLayer(11, 70, 160, 54, 105, 0.35, "#101733", true),
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

function burst(x, y, color, n = 12) {
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
  if (score > 150 && Math.random() < 0.28) {
    const y = groundY - 52;
    obstacles.push({
      t: "drone",
      x: W + 20,
      y,
      by: y,
      w: 44,
      h: 26,
      passed: false,
      c: "#ff7a59",
    });
    if (Math.random() < 0.7)
      for (let i = 0; i < 4; i++)
        items.push(mkCoin(W + 28 + i * 26, groundY - 14));
    return;
  }
  const tall = Math.random() > 0.55;
  const h = tall ? rnd(45, 65) : rnd(28, 42),
    w = tall ? rnd(25, 36) : rnd(32, 46);
  const c = Math.random() > 0.5 ? "#ff4fd8" : "#ff7a59";
  obstacles.push({
    t: "block",
    x: W + 20,
    y: groundY - h,
    w,
    h,
    passed: false,
    c,
  });
  if (score > 400 && Math.random() < 0.22) {
    const h2 = rnd(28, 48),
      w2 = rnd(28, 40);
    obstacles.push({
      t: "block",
      x: W + 20 + w + 75,
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
          W + 20 + w / 2 + (i - 2) * 28,
          groundY - h - 28 - Math.sin((i / 4) * Math.PI) * 38,
        ),
      );
}
function spawnPower() {
  const k = ["shield", "slow", "x2", "magnet"][Math.floor(Math.random() * 4)];
  items.push({ k, x: W + 30, y: groundY - rnd(55, 110), r: 15 });
}

/* ============ ACTIONS ============ */
function jump() {
  if (state !== "play" || player.jumps <= 0) return;
  const first = player.jumps === 2;
  player.vy = first ? -14 : -12;
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
  if (player.vy < -5) player.vy = -5;
}

/* ============ UPDATE ============ */
function scrollWorld(d) {
  stars.forEach((s) => {
    s.x -= d * 0.05;
    if (s.x < 0) {
      s.x = W;
      s.y = rnd(0, 245);
    }
  });
  layers.forEach((L) => {
    L.b.forEach((b) => {
      b.x -= d * L.mul;
      if (b.x + b.w < 0) {
        const r = Math.max(...L.b.map((o) => o.x + o.w));
        b.x = r + rnd(4, 16);
        b.w = rnd(L.wmin, L.wmax);
        b.h = rnd(L.hmin, L.hmax);
        b.seed = Math.random() * 99;
      }
    });
  });
}

function updateGame(delta) {
  const f = Math.min(delta / 16.67, 2);
  frame += f;

  // timers
  fx.slow = Math.max(0, fx.slow - delta);
  fx.x2 = Math.max(0, fx.x2 - delta);
  fx.magnet = Math.max(0, fx.magnet - delta);
  invul = Math.max(0, invul - delta);
  banner.t = Math.max(0, banner.t - delta);

  const cfg = DIFF[diff];
  score += f * 0.12;
  speed = Math.min(cfg.base + score / 180, cfg.max);
  const ev = speed * (fx.slow > 0 ? 0.65 : 1);

  // zones
  const zone = Math.floor(score / 500) % THEMES.length;
  if (zone !== lastZone) {
    lastZone = zone;
    banner = { text: THEMES[zone].n, t: 2200 };
    sfx.zone();
  }
  const T = THEMES[zone];
  ["top", "bot", "a", "b"].forEach((k) => (cur[k] = mix(cur[k], T[k], 0.04)));

  scrollWorld(ev * f);

  // player physics
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

  // spawn
  obstacleTimer += delta;
  if (obstacleTimer >= nextObstacle) {
    spawnObstacle();
    obstacleTimer = 0;
    nextObstacle = Math.max(
      700,
      rnd(1000, 1600) * cfg.gap * Math.max(0.62, 5.5 / speed),
    );
  }
  itemTimer += delta;
  if (itemTimer >= nextItem) {
    spawnPower();
    itemTimer = 0;
    nextItem = rnd(9000, 14000);
  }

  // obstacles
  const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 };
  for (const o of obstacles) {
    o.x -= ev * f;
    if (o.t === "drone") o.y = o.by + Math.sin(frame * 0.1) * 4;
    if (invul <= 0 && state === "play" && hit(box, o, 3)) {
      if (shield) {
        shield = false;
        invul = 900;
        shake = 9;
        o.x = -999;
        burst(o.x < 0 ? p.x + 30 : o.x, o.y, "#53f7ff", 24);
        sfx.hit();
        pop(p.x, p.y - 10, "QALQON SINDI", "#53f7ff");
      } else {
        endGame();
        return;
      }
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

  // items
  const pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  for (const it of items) {
    it.x -= ev * f;
    if (it.k === "coin" && fx.magnet > 0) {
      const dx = pc.x - it.x,
        dy = pc.y - it.y,
        d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) {
        it.x += (dx / d) * 9 * f;
        it.y += (dy / d) * 9 * f;
      }
    }
    if (
      Math.abs(it.x - pc.x) < it.r + p.w / 2 - 3 &&
      Math.abs(it.y - pc.y) < it.r + p.h / 2 - 3
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

  updateParticles(delta);
  updateHUD();
}

function updateParticles(delta) {
  const f = delta / 16.67;
  particles.forEach((q) => {
    q.x += q.vx * f;
    q.y += q.vy * f;
    q.vy += 0.12 * f;
    q.life -= 0.025 * f;
  });
  particles = particles.filter((q) => q.life > 0);
  pops.forEach((q) => {
    q.y -= 0.8 * f;
    q.life -= 0.018 * f;
  });
  pops = pops.filter((q) => q.life > 0);
  shake = Math.max(0, shake - 0.5 * f);
}

function updateHUD() {
  $("score").textContent = fmt(score);
  $("best").textContent = fmt(
    Math.max(
      bests[diff] || 0,
      state === "play" || state === "over" ? score : 0,
    ),
  );
  $("speed").textContent =
    ((speed * (fx.slow > 0 ? 0.65 : 1)) / 5).toFixed(1) + "x";
  $("coins").textContent = coins;
}

/* ============ DRAW ============ */
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, cur.top);
  g.addColorStop(1, cur.bot);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  stars.forEach((s) => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#c7edff";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });
  ctx.globalAlpha = 1;

  // glowing moon
  ctx.fillStyle = cur.b;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(760, 78, 54, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(760, 78, 26, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;

  // parallax skyline
  layers.forEach((L) => {
    L.b.forEach((b) => {
      ctx.fillStyle = L.shade;
      ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
      if (!L.windows) return;
      ctx.fillStyle = (b.seed | 0) % 2 ? cur.a : cur.b;
      ctx.globalAlpha = 0.4;
      for (let wy = groundY - b.h + 10; wy < groundY - 8; wy += 15)
        for (let wx = b.x + 8; wx < b.x + b.w - 6; wx += 14)
          if (((b.seed * 7 + wy * 0.37 + wx * 0.11) | 0) % 3 !== 0)
            ctx.fillRect(wx, wy, 4, 5);
      ctx.globalAlpha = 1;
    });
  });

  // ground
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, "rgba(255,255,255,.1)");
  gg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gg;
  ctx.fillRect(-20, groundY, W + 40, H - groundY);
  ctx.strokeStyle = cur.a;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = cur.a;
  ctx.beginPath();
  ctx.moveTo(-20, groundY);
  ctx.lineTo(W + 20, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const off = (frame * speed * 0.7) % 90;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  for (let x = -off; x < W + 40; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 35, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = player,
    small = p.h < 40;
  p.trail.forEach((pt, i) => {
    ctx.globalAlpha = ((i + 1) / p.trail.length) * 0.15;
    ctx.fillStyle = cur.a;
    rr(pt.x, pt.y, p.w, pt.h, 8);
    ctx.fill();
  });
  ctx.globalAlpha = invul > 0 && Math.floor(frame / 3) % 2 ? 0.35 : 1;

  ctx.shadowColor = cur.b;
  ctx.shadowBlur = 24;
  const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
  g.addColorStop(0, cur.a);
  g.addColorStop(1, cur.b);
  ctx.fillStyle = g;
  rr(p.x, p.y, p.w, p.h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#10142c";
  rr(p.x + 6, p.y + (small ? 4 : 9), p.w - 12, small ? 8 : 11, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.shadowColor = cur.a;
  ctx.shadowBlur = 8;
  ctx.fillRect(p.x + 10, p.y + (small ? 7 : 13), 4, 2);
  ctx.fillRect(p.x + 20, p.y + (small ? 7 : 13), 4, 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff4fd8";
  const run = p.grounded ? Math.sin(frame * 0.6) * 2 : 0;
  ctx.fillRect(p.x + 4 + run, p.y + p.h - 3, 9, 4);
  ctx.fillRect(p.x + 21 - run, p.y + p.h - 3, 9, 4);
  ctx.globalAlpha = 1;

  if (shield) {
    ctx.strokeStyle = "#53f7ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#53f7ff";
    ctx.shadowBlur = 16;
    ctx.globalAlpha = 0.6 + Math.sin(frame * 0.2) * 0.25;
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 34, p.h / 2 + 10, 0, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function drawObstacles() {
  obstacles.forEach((o) => {
    ctx.shadowColor = o.c;
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
    g.addColorStop(0, o.c);
    g.addColorStop(1, o.t === "drone" ? "#7a2b12" : "#7c245f");
    ctx.fillStyle = g;
    rr(o.x, o.y, o.w, o.h, o.t === "drone" ? 12 : 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffc0f0";
    ctx.lineWidth = 1;
    ctx.stroke();
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
  });
}

function drawItems() {
  items.forEach((it) => {
    if (it.k === "coin") {
      const sx = Math.abs(Math.cos(frame * 0.08 + it.x * 0.02));
      ctx.shadowColor = "#ffd84f";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffd84f";
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(2, it.r * sx), it.r, 0, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const P = POWER[it.k],
        bob = Math.sin(frame * 0.1 + it.x) * 3;
      ctx.shadowColor = P.color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = P.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(10,14,34,.85)";
      ctx.beginPath();
      ctx.arc(it.x, it.y + bob, it.r + 2, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = P.color;
      ctx.font = "700 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(P.icon, it.x, it.y + bob + 1);
    }
  });
}

function drawParticles() {
  particles.forEach((q) => {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color;
    ctx.shadowColor = q.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(q.x, q.y, q.s, q.s);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.font = "700 13px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  pops.forEach((q) => {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color;
    ctx.fillText(q.s, q.x, q.y);
  });
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.textBaseline = "middle";
  if (combo >= 2 && state !== "ready") {
    ctx.textAlign = "left";
    ctx.font = "700 14px Orbitron, sans-serif";
    ctx.fillStyle = mult() > 1 ? "#ffd84f" : "#c7edff";
    ctx.fillText("KOMBO " + combo + "  ×" + mult(), 16, 22);
  }
  // active power-ups
  let x = W - 16;
  ctx.textAlign = "center";
  const list = [];
  if (shield) list.push(["shield", 1]);
  ["slow", "x2", "magnet"].forEach(
    (k) => fx[k] > 0 && list.push([k, fx[k] / POWER[k].dur]),
  );
  list.forEach(([k, pct]) => {
    const P = POWER[k];
    x -= 38;
    ctx.fillStyle = "rgba(10,14,34,.7)";
    rr(x - 16, 10, 36, 30, 8);
    ctx.fill();
    ctx.fillStyle = P.color;
    ctx.font = "700 13px Orbitron, sans-serif";
    ctx.fillText(P.icon, x + 2, 22);
    ctx.fillRect(x - 11, 33, 26 * pct, 3);
  });
  // zone banner
  if (banner.t > 0) {
    ctx.globalAlpha = Math.min(
      1,
      banner.t / 500,
      (2200 - banner.t) / 300 + 0.2,
    );
    ctx.fillStyle = cur.a;
    ctx.shadowColor = cur.a;
    ctx.shadowBlur = 20;
    ctx.font = "800 26px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(banner.text, W / 2, 70);
    ctx.font = "500 11px Orbitron, sans-serif";
    ctx.fillText("YANGI ZONA", W / 2, 96);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBackground();
  drawItems();
  drawParticles();
  drawObstacles();
  drawPlayer();
  ctx.restore();
  drawHUD();
}

/* ============ OVERLAY ============ */
function renderTop() {
  if (!board.length)
    return `<div class="top-title">REYTING</div><p style="margin-bottom:12px">Hali natija yo'q. Birinchi bo'l!</p>`;
  return (
    `<div class="top-title">ENG YAXSHI 5 NATIJA</div><ol class="top">` +
    board
      .map(
        (r, i) =>
          `<li><span>${i + 1}.</span><b>${fmt(r.s)}</b><em>${DIFF[r.d].name}</em></li>`,
      )
      .join("") +
    `</ol>`
  );
}
function showOverlay(icon, title, text, btn, opts = {}) {
  $("oIcon").textContent = icon;
  $("oTitle").textContent = title;
  $("oText").innerHTML = text;
  $("startButton").textContent = btn;
  $("diff").style.display = opts.diff ? "flex" : "none";
  $("topBox").innerHTML = opts.top ? renderTop() : "";
  $("overlay").classList.remove("hidden");
}
function paintDiff() {
  document
    .querySelectorAll("#diff button")
    .forEach((b) => b.classList.toggle("on", b.dataset.d === diff));
}
function showReady() {
  showOverlay(
    "✦",
    "TAYYORMISAN, YUGURUVCHI?",
    "Sakra, engash, tanga yig' va quvvat kuchlarini ol.<br>To'siqlardan o't va yangi rekord o'rnat.",
    "▶   YUGURISHNI BOSHLA!",
    { diff: true, top: true },
  );
  paintDiff();
}

/* ============ FLOW ============ */
function resetGame() {
  state = "ready";
  score = 0;
  speed = DIFF[diff].base;
  frame = 0;
  coins = 0;
  combo = 0;
  shake = 0;
  invul = 0;
  shield = false;
  banner = { text: "", t: 0 };
  lastZone = 0;
  cur = { ...THEMES[0] };
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
  if (state === "over" || state === "ready") {
    const keep = state;
    resetGame();
  }
  state = "play";
  lastT = 0;
  $("overlay").classList.add("hidden");
  beep(660, 0.1, "triangle");
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  duckKey = duckPtr = duckBtn = false;
  showOverlay(
    "❚❚",
    "PAUZA",
    "Davom etish uchun P yoki tugmani bosing.",
    "▶   DAVOM ETISH",
  );
}
function resumeGame() {
  if (state !== "pause") return;
  state = "play";
  lastT = 0;
  $("overlay").classList.add("hidden");
}

function endGame() {
  if (state === "over") return;
  state = "over";
  shake = 12;
  sfx.hit();
  burst(player.x + player.w / 2, player.y + player.h / 2, "#ff4fd8", 35);
  const s = Math.floor(score),
    isBest = s > (bests[diff] || 0);
  if (isBest) {
    bests[diff] = s;
    store.set("zr_bests", bests);
  }
  if (s > 0) {
    board.push({ s, d: diff });
    board.sort((a, b) => b.s - a.s);
    board = board.slice(0, 5);
    store.set("zr_top", board);
  }
  updateHUD();
  setTimeout(() => {
    if (state !== "over") return;
    showOverlay(
      isBest ? "★" : "✕",
      isBest ? "YANGI REKORD!" : "YUGURISH TUGADI",
      `NATIJA: <b>${fmt(score)}</b> · TANGALAR: <b>${coins}</b><br>ENG YAXSHI (${DIFF[diff].name}): <b>${fmt(bests[diff] || 0)}</b>`,
      "↻   YANA URINISH",
      { diff: true, top: true },
    );
    paintDiff();
  }, 650);
}

function loop(t) {
  const delta = lastT ? Math.min(t - lastT, 40) : 16.67;
  lastT = t;
  if (state === "play") updateGame(delta);
  else if (state !== "pause") {
    updateParticles(delta);
    if (state === "ready") {
      frame += delta / 16.67;
      scrollWorld((1.2 * delta) / 16.67);
    }
  }
  draw();
  requestAnimationFrame(loop);
}

/* ============ INPUT ============ */
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"],
  DUCK_KEYS = ["ArrowDown", "KeyS"];
function action() {
  if (state === "ready" || state === "over") startGame();
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
  }
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
  if (e.buttons || e.pointerType === "touch") {
    if (e.clientY - py > 30) duckPtr = true;
  }
});
["pointerup", "pointercancel", "pointerleave"].forEach((n) =>
  canvas.addEventListener(n, () => {
    duckPtr = false;
    releaseJump();
  }),
);

const db = $("duckBtn");
db.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  duckBtn = true;
});
["pointerup", "pointercancel", "pointerleave"].forEach((n) =>
  db.addEventListener(n, () => (duckBtn = false)),
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
$("diff").addEventListener("click", (e) => {
  const d = e.target.dataset.d;
  if (!d) return;
  diff = d;
  store.set("zr_diff", d);
  paintDiff();
  resetGame();
  state = "ready";
  updateHUD();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

function toggleMute() {
  muted = !muted;
  store.set("zr_muted", muted);
  $("muteButton").textContent = muted ? "🔇 OVOZ" : "🔊 OVOZ";
}

/* ============ INIT ============ */
$("muteButton").textContent = muted ? "🔇 OVOZ" : "🔊 OVOZ";
resetGame();
showReady();
requestAnimationFrame(loop);
