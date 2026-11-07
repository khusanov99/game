/* model/themes.js — The six city themes (palette, fog, rain) and theme selection by distance. */
"use strict";
/* ---------- themes ---------- */
const THEMES = [
  {
    top: "#2a2f6b",
    mid: "#c4577a",
    low: "#ffb36b",
    fog: "#e6a07a",
    sun: "#ffd9a0",
    name: "Tashkent",
    amb: [0, 0, 0],
    sunK: 1,
  },
  {
    top: "#2d6fc6",
    mid: "#79b4e0",
    low: "#fbe0b0",
    fog: "#cfe0ee",
    sun: "#fff0c0",
    name: "Samarkand",
    amb: [0, 0, 0],
    sunK: 1,
  },
  {
    top: "#6a3a7a",
    mid: "#e8845a",
    low: "#ffcf7a",
    fog: "#f0b684",
    sun: "#fff0b0",
    name: "Bukhara",
    amb: [0, 0, 0],
    sunK: 1,
  },
  {
    top: "#1c2250",
    mid: "#6b4a8e",
    low: "#f08a6a",
    fog: "#c98a90",
    sun: "#ffd2a0",
    name: "Khiva",
    amb: [0, 0, 0],
    sunK: 1,
  },
  {
    top: "#2f7fd8",
    mid: "#8fd0f2",
    low: "#fff2d2",
    fog: "#d2e8f2",
    sun: "#fff8dc",
    name: "Fergana",
    amb: [0, 0, 0],
    sunK: 1.05,
    mount: true,
  },
  {
    top: "#04051a",
    mid: "#1a1048",
    low: "#7a2a86",
    fog: "#2c1c52",
    sun: "#9db0ff",
    name: "Neon Tashkent",
    amb: [0.26, 0.28, 0.52],
    sunK: 0.35,
    night: true,
    rain: true,
    fogK: 0.9,
  },
];
const DEFS = [
  [
    ["glass", 5, 16],
    ["panel", 7, 9],
    ["tower", 5.5, 13],
    ["glass", 4.4, 19],
    ["panel", 6, 9],
    ["shops", 5, 7],
  ],
  [
    ["registan", 10, 11],
    ["madrasa", 8, 10],
    ["registan", 9, 10],
    ["shops", 5, 7],
    ["madrasa", 7, 9],
  ],
  [
    ["brick", 7, 7.5],
    ["brick", 5.5, 8],
    ["madrasa", 7, 9],
    ["brick", 6, 7],
    ["shops", 5.5, 7],
  ],
  [
    ["fort", 8, 8],
    ["fort", 6, 8.5],
    ["brick", 5, 7],
    ["fort", 7, 7.5],
    ["fort", 5.5, 8],
  ],
  [
    ["shops", 5, 7],
    ["panel", 7, 9],
    ["brick", 6, 7.5],
    ["tower", 5.5, 12],
    ["shops", 6, 7],
  ],
  [
    ["glass", 5, 18],
    ["tower", 5.5, 15],
    ["glass", 4.4, 21],
    ["panel", 6.5, 10],
    ["glass", 6, 16],
  ],
];
const TMAT = [
  { emis: 0.28, tint: [1.06, 1.04, 1.0] },
  { emis: 0.28, tint: [1.06, 1.04, 1.0] },
  { emis: 0.28, tint: [1.06, 1.04, 1.0] },
  { emis: 0.28, tint: [1.06, 1.04, 1.0] },
  { emis: 0.26, tint: [1.0, 1.07, 1.0] },
  { emis: 0.72, tint: [0.62, 0.68, 1.0] },
];
const THEME_LEN = 700,
  themeAt = (z) =>
    ((Math.floor(z / THEME_LEN) % THEMES.length) + THEMES.length) %
    THEMES.length,
  FS = 1.55,
  PPU = COARSE ? 24 : 36;
const FT = {}; // facade GL textures by theme/index
function facadeTex(th, idx) {
  const k = th + ":" + idx;
  if (FT[k]) return FT[k];
  const [kind, len, h] = DEFS[th][idx],
    f = Facades.make(th, kind, len, h, PPU, true);
  return (FT[k] = {
    tex: texFrom(f.cv, { cap: 1024 }),
    kind,
    len: len * FS,
    h: h * FS,
    domes: f.domes,
    w: f.w,
    hh: f.hh,
  });
}
function dropThemeTex(th) {
  for (const k of Object.keys(FT))
    if (k.startsWith(th + ":")) {
      gl.deleteTexture(FT[k].tex);
      delete FT[k];
    }
}
let MINT = null;
function minaretTex() {
  if (MINT) return MINT;
  const c = mkc(128, 512),
    g = c.getContext("2d");
  Facades.brickPat(g, 128, 512, 0, "#d2a76d", "rgba(80,45,15,.45)");
  Facades.grain(g, 128, 512, 0.2);
  for (let i = 0; i < 5; i++)
    Facades.mosaic(g, 0, 40 + i * 90, 128, 30, "#14589a", "#6fd0e6", "#ffe9a8");
  const q = g.createLinearGradient(0, 0, 128, 0);
  q.addColorStop(0, "rgba(0,0,0,.35)");
  q.addColorStop(0.35, "rgba(255,200,120,.12)");
  q.addColorStop(1, "rgba(0,0,0,.4)");
  g.fillStyle = q;
  g.fillRect(0, 0, 128, 512);
  return (MINT = texFrom(c, { repeat: true, repeatS: true }));
}
const ROADS = {},
  mkRoadTex = (cross) => {
    const w = 256,
      h = 1024,
      c = mkc(w, h),
      g = c.getContext("2d"),
      px = (m) => (m / 10.4) * w,
      pz = (m) => (m / 40) * h;
    g.fillStyle = "#2c2f39";
    g.fillRect(0, 0, w, h);
    Facades.grain(g, w, h, 0.5, "overlay");
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "rgba(0,0,0," + rnd(0.05, 0.18) + ")";
      g.beginPath();
      g.ellipse(rnd(0, w), rnd(0, h), rnd(6, 30), rnd(10, 60), 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.05)";
    g.fillRect(0, 0, px(1.9), h);
    g.fillRect(px(8.5), 0, px(1.9), h);
    g.fillStyle = "rgba(255,255,255,.85)";
    for (const m of [-1.1, 1.1])
      for (let k = 0; k < 8; k++)
        g.fillRect(px(5.2 + m - 0.07), pz(k * 5), px(0.14), pz(2.4));
    g.fillStyle = "rgba(255,255,255,.9)";
    for (const m of [-3.3, 3.3]) g.fillRect(px(5.2 + m - 0.08), 0, px(0.16), h);
    g.fillStyle = "rgba(255,216,80,.9)";
    for (const m of [-5.0, 5.0]) g.fillRect(px(5.2 + m - 0.06), 0, px(0.12), h);
    if (cross) {
      g.fillStyle = "rgba(245,245,245,.92)";
      for (let x = 0.3; x < 10.2; x += 0.9)
        g.fillRect(px(x), pz(1), px(0.5), pz(5));
      g.fillStyle = "rgba(255,255,255,.9)";
      g.fillRect(0, pz(0.4), w, pz(0.3));
      g.fillRect(0, pz(6.3), w, pz(0.3));
    }
    return texFrom(c, { repeat: true, repeatS: false });
  };
let SWT = null;
function sidewalkTex() {
  if (SWT) return SWT;
  const c = mkc(128, 128),
    g = c.getContext("2d");
  g.fillStyle = "#b8ae9a";
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = ["#c4baa4", "#b2a890", "#bcb29c"][(x * 3 + y * 5) % 3];
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
  g.strokeStyle = "rgba(60,50,40,.4)";
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 128);
    g.moveTo(0, i * 32);
    g.lineTo(128, i * 32);
    g.stroke();
  }
  Facades.grain(g, 128, 128, 0.35, "overlay");
  return (SWT = texFrom(c, { repeat: true }));
}
const STRIPE = (() => {
  const c = mkc(64, 64),
    g = c.getContext("2d");
  g.fillStyle = "#ffcc1a";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#15151c";
  for (let i = -2; i < 6; i++) {
    g.beginPath();
    g.moveTo(i * 16, 64);
    g.lineTo(i * 16 + 8, 64);
    g.lineTo(i * 16 + 40, 0);
    g.lineTo(i * 16 + 32, 0);
    g.fill();
  }
  return texFrom(c, { repeat: true });
})();
const BLOB = (() => {
  const c = mkc(64, 64),
    g = c.getContext("2d"),
    q = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  q.addColorStop(0, "rgba(0,0,0,.75)");
  q.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = q;
  g.fillRect(0, 0, 64, 64);
  return texFrom(c);
})();
