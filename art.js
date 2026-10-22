/* =====================================================
   ART — hand-built, pre-rendered scenery of real Uzbek
   places: Toshkent TV tower & Minor mosque, Registon,
   Kalon minaret & Mir-i Arab, Kalta Minor & Ichan-Qal'a.
   Everything is drawn once into offscreen canvases.
===================================================== */
const Art = (() => {
  const TW = 1200,
    GW = 160,
    GH = 64,
    FAR_H = 190,
    MID_H = 110;
  const P = {
    sand: "#c9a66b",
    sandD: "#8f6c3c",
    sandL: "#ecd29a",
    tq: "#22b8c4",
    cob: "#1d4fb0",
    gold: "#e2b050",
    brick: "#bd8650",
  };
  const TQ = ["#0f7f90", "#8ff5f6", "#22b8c4"],
    COB = ["#12307a", "#7aa5ff", "#1d4fb0"],
    WHT = ["#8e97b2", "#ffffff", "#e8ebf4"];
  const SKY = {
    tash: ["#0f2a5c", "#f2a766"],
    sam: ["#2a2f78", "#ffb066"],
    bux: ["#1f3a63", "#f7c47a"],
    khi: ["#060a1c", "#2b3a63"],
    tashN: ["#050818", "#2b2058"],
  };
  const HAZE = {
    tash: "rgba(240,160,110,.42)",
    sam: "rgba(255,150,90,.42)",
    bux: "rgba(255,190,110,.42)",
    khi: "rgba(30,50,100,.55)",
    tashN: "rgba(60,40,120,.5)",
  };
  const TINT = {
    tash: "rgba(255,170,110,.14)",
    sam: "rgba(255,140,70,.2)",
    bux: "rgba(255,170,90,.18)",
    khi: "rgba(50,80,150,.38)",
    tashN: "rgba(40,50,120,.42)",
  };
  const NIGHT = { khi: 1, tashN: 1 };

  let rd = Math.random;
  const rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const R = (a, b) => rd() * (b - a) + a;
  const mk = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  };
  const lg = (c, x0, y0, x1, y1, st) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    st.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  };

  /* ---------- primitives ---------- */
  function arch(c, x, by, w, h) {
    // pointed (Persian) arch, bottom-left (x,by)
    h = Math.max(h, w * 0.95);
    const r = w / 2,
      sp = by - h + r * 1.15;
    c.moveTo(x, by);
    c.lineTo(x, sp);
    c.quadraticCurveTo(x, sp - r * 0.9, x + r, by - h);
    c.quadraticCurveTo(x + w, sp - r * 0.9, x + w, sp);
    c.lineTo(x + w, by);
    c.closePath();
  }
  function tiles(c, x, y, w, h, s, a, b) {
    // majolica diamond tiling
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    for (let j = 0; j * s < h + s; j++)
      for (let i = 0; i * s < w + s; i++) {
        const cx = x + i * s + (j % 2 ? s / 2 : 0),
          cy = y + j * s;
        c.fillStyle = (i + j) % 2 ? a : b;
        c.beginPath();
        c.moveTo(cx, cy - s / 2);
        c.lineTo(cx + s / 2, cy);
        c.lineTo(cx, cy + s / 2);
        c.lineTo(cx - s / 2, cy);
        c.fill();
      }
    c.restore();
  }
  function dome(c, cx, by, r, h, pal, ribs = 7) {
    c.beginPath();
    c.moveTo(cx - r, by);
    c.bezierCurveTo(
      cx - r * 1.2,
      by - h * 0.55,
      cx - r * 0.5,
      by - h * 0.95,
      cx,
      by - h,
    );
    c.bezierCurveTo(
      cx + r * 0.5,
      by - h * 0.95,
      cx + r * 1.2,
      by - h * 0.55,
      cx + r,
      by,
    );
    c.closePath();
    c.fillStyle = lg(c, cx - r, 0, cx + r, 0, [
      [0, pal[0]],
      [0.32, pal[1]],
      [0.6, pal[2]],
      [1, pal[0]],
    ]);
    c.fill();
    c.strokeStyle = "rgba(0,20,60,.32)";
    c.lineWidth = 1;
    for (let i = -ribs; i <= ribs; i++) {
      c.beginPath();
      c.moveTo(cx + (i * r) / ribs, by);
      c.quadraticCurveTo(
        cx + ((i * r) / ribs) * 1.15,
        by - h * 0.62,
        cx,
        by - h,
      );
      c.stroke();
    }
    c.strokeStyle = P.gold;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(cx, by - h);
    c.lineTo(cx, by - h - r * 0.5);
    c.stroke();
    c.fillStyle = P.gold;
    c.beginPath();
    c.arc(cx, by - h - r * 0.5, r * 0.07 + 1, 0, 7);
    c.fill();
  }
  function drum(c, cx, by, r, h, a = P.cob, b = P.tq) {
    c.fillStyle = lg(c, cx - r, 0, cx + r, 0, [
      [0, P.sandD],
      [0.4, P.sandL],
      [1, P.sandD],
    ]);
    c.fillRect(cx - r * 0.82, by - h, r * 1.64, h);
    tiles(c, cx - r * 0.82, by - h, r * 1.64, h * 0.3, 5, a, b);
    c.fillStyle = "#16205a";
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      arch(c, cx + i * r * 0.5 - 3, by - 2, 6, h * 0.5);
      c.fill();
    }
  }
  function minaret(c, x, by, w, h, c1 = P.cob, c2 = P.tq, wall = null) {
    const tw = w * 0.72;
    c.beginPath();
    c.moveTo(x - w / 2, by);
    c.lineTo(x - tw / 2, by - h);
    c.lineTo(x + tw / 2, by - h);
    c.lineTo(x + w / 2, by);
    c.closePath();
    c.fillStyle =
      wall ||
      lg(c, x - w / 2, 0, x + w / 2, 0, [
        [0, P.sandD],
        [0.4, P.sandL],
        [1, P.sandD],
      ]);
    c.fill();
    c.save();
    c.clip();
    for (let i = 0; i < 5; i++)
      tiles(c, x - w / 2, by - h * 0.14 - i * h * 0.17, w, h * 0.08, 5, c1, c2);
    c.restore();
    c.fillStyle = P.sandD;
    c.fillRect(x - tw / 2 - 3, by - h - 3, tw + 6, 5);
    c.fillStyle = P.sandL;
    c.fillRect(x - tw * 0.4, by - h - 17, tw * 0.8, 14);
    c.fillStyle = "#16205a";
    for (let i = 0; i < 3; i++)
      c.fillRect(x - tw * 0.3 + i * tw * 0.26, by - h - 14, 3, 9);
    dome(c, x, by - h - 17, tw * 0.5, tw * 0.75, TQ, 3);
  }
  function pishtaq(c, x, by, w, h, a = P.cob, b = P.tq) {
    // monumental portal
    c.fillStyle = lg(c, x, by - h, x + w, by, [
      [0, P.sandL],
      [1, P.sandD],
    ]);
    c.fillRect(x, by - h, w, h);
    tiles(c, x + 3, by - h + 3, w - 6, h * 0.08, 6, a, b);
    tiles(c, x + 3, by - h + 3, w * 0.1, h - 6, 6, a, b);
    tiles(c, x + w - 3 - w * 0.1, by - h + 3, w * 0.1, h - 6, 6, a, b);
    const aw = w * 0.56,
      ax = x + (w - aw) / 2,
      ah = h * 0.8;
    c.fillStyle = lg(c, 0, by - ah, 0, by, [
      [0, "#0b1033"],
      [1, "#2a3a8a"],
    ]);
    c.beginPath();
    arch(c, ax, by, aw, ah);
    c.fill();
    c.strokeStyle = b;
    c.lineWidth = 2.5;
    c.beginPath();
    arch(c, ax - 2, by, aw + 4, ah + 3);
    c.stroke();
    c.strokeStyle = P.gold;
    c.lineWidth = 1;
    c.beginPath();
    arch(c, ax - 5, by, aw + 10, ah + 7);
    c.stroke();
    c.fillStyle = "rgba(226,176,80,.55)"; // muqarnas
    for (let r = 0; r < 3; r++) {
      const n = 4 - r,
        cw = (aw * 0.62) / n;
      for (let i = 0; i < n; i++) {
        c.beginPath();
        arch(
          c,
          ax + aw * 0.19 + i * cw + 1,
          by - ah * 0.5 - r * ah * 0.11,
          cw - 2,
          ah * 0.12,
        );
        c.fill();
      }
    }
    c.fillStyle = "#070a24";
    c.beginPath();
    arch(c, ax + aw * 0.28, by, aw * 0.44, ah * 0.44);
    c.fill();
    for (const t of [0.12, 0.46])
      for (const sx of [x + w * 0.13, x + w - w * 0.23]) {
        c.fillStyle = "#1a2260";
        c.beginPath();
        arch(c, sx, by - h * t, w * 0.1, h * 0.2);
        c.fill();
        c.strokeStyle = b;
        c.lineWidth = 1;
        c.stroke();
      }
    c.fillStyle = P.sandD;
    for (let i = 0; i < w; i += 8) c.fillRect(x + i, by - h - 5, 5, 5);
  }
  function facade(c, x, by, w, h) {
    c.fillStyle = lg(c, x, by - h, x + w, by, [
      [0, P.sandL],
      [1, P.sandD],
    ]);
    c.fillRect(x, by - h, w, h);
    tiles(c, x + 2, by - h + 2, w - 4, h * 0.09, 6, P.cob, P.tq);
    const n = Math.floor(w / 34);
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < n; i++) {
        c.fillStyle = "#16205a";
        c.beginPath();
        arch(
          c,
          x + 8 + i * ((w - 16) / n),
          by - row * h * 0.46 - 4,
          (w - 16) / n - 8,
          h * 0.38,
        );
        c.fill();
        c.strokeStyle = P.tq;
        c.lineWidth = 1;
        c.stroke();
      }
    c.fillStyle = P.sandD;
    for (let i = 0; i < w; i += 8) c.fillRect(x + i, by - h - 5, 5, 5);
  }
  function windowsGrid(c, x, by, w, h, night, step = 9) {
    for (let wy = by - h + 8; wy < by - 8; wy += step)
      for (let wx = x + 5; wx < x + w - 6; wx += 8) {
        const lit = rd() < (night ? 0.62 : 0.28);
        c.fillStyle = lit
          ? rd() < 0.7
            ? "#ffd98a"
            : "#9fd6ff"
          : "rgba(10,14,40,.55)";
        c.fillRect(wx, wy, 4, 5);
      }
  }
  function glass(c, x, by, w, h, night) {
    c.fillStyle = lg(
      c,
      x,
      by - h,
      x + w,
      by,
      night
        ? [
            [0, "#22386a"],
            [1, "#0c1430"],
          ]
        : [
            [0, "#7db4d6"],
            [1, "#2c4f7a"],
          ],
    );
    c.fillRect(x, by - h, w, h);
    c.strokeStyle = "rgba(255,255,255,.22)";
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 7; i < w; i += 7) {
      c.moveTo(x + i, by - h);
      c.lineTo(x + i, by);
    }
    for (let j = 12; j < h; j += 12) {
      c.moveTo(x, by - j);
      c.lineTo(x + w, by - j);
    }
    c.stroke();
    if (night) windowsGrid(c, x, by, w, h, true, 12);
    c.fillStyle = "rgba(255,255,255,.28)";
    c.fillRect(x, by - h, 3, h);
    c.fillStyle = night ? "#2a3a70" : "#5f86a8";
    c.fillRect(x + w * 0.2, by - h - 9, w * 0.6, 9);
    c.fillRect(x + w / 2 - 1, by - h - 26, 2, 18);
  }
  function tvTower(c, x, by, h, night) {
    const sh = lg(c, x - 8, 0, x + 8, 0, [
      [0, "#8d96aa"],
      [0.5, "#e4e8f1"],
      [1, "#7e879c"],
    ]);
    c.fillStyle = sh;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + s * 34, by);
      c.lineTo(x + s * 27, by);
      c.lineTo(x + s * 4, by - h * 0.36);
      c.lineTo(x + s * 1, by - h * 0.36);
      c.closePath();
      c.fill();
    }
    c.beginPath();
    c.moveTo(x - 7, by - h * 0.3);
    c.lineTo(x - 4.5, by - h * 0.69);
    c.lineTo(x + 4.5, by - h * 0.69);
    c.lineTo(x + 7, by - h * 0.3);
    c.fill();
    const py = by - h * 0.69;
    c.fillStyle = "#c9cfde";
    c.beginPath();
    c.ellipse(x, py, 24, 7, 0, 0, 7);
    c.fill();
    c.fillStyle = lg(c, x - 18, 0, x + 18, 0, [
      [0, "#8e97ab"],
      [0.5, "#eef1f7"],
      [1, "#8e97ab"],
    ]);
    c.fillRect(x - 18, py - 20, 36, 15);
    c.fillStyle = night ? "#ffd98a" : "#26345f";
    for (let i = 0; i < 7; i++) c.fillRect(x - 15 + i * 5, py - 16, 3, 7);
    c.fillStyle = "#c9cfde";
    c.beginPath();
    c.ellipse(x, py - 21, 17, 5, 0, 0, 7);
    c.fill();
    c.fillStyle = sh;
    c.fillRect(x - 10, py - 33, 20, 12);
    c.fillStyle = night ? "#ffd98a" : "#26345f";
    for (let i = 0; i < 4; i++) c.fillRect(x - 8 + i * 5, py - 30, 3, 5);
    const my = py - 33,
      top = by - h,
      seg = (my - top) / 9;
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 2 ? "#f2f2f2" : "#e03a3a";
      const ww = 5 - i * 0.42;
      c.fillRect(x - ww / 2, my - (i + 1) * seg, ww, seg);
    }
    if (night) {
      c.fillStyle = "rgba(255,217,138,.25)";
      c.beginPath();
      c.arc(x, py - 12, 30, 0, 7);
      c.fill();
    }
    c.fillStyle = "#ff3b3b";
    c.beginPath();
    c.arc(x, top, 2.6, 0, 7);
    c.fill();
  }

  /* ---------- landmark paintings ---------- */
  function tashkent(c, w, h, night) {
    const GY = h;
    // Minor mosque (white marble)
    const mx = 34;
    c.fillStyle = lg(c, mx, GY - 70, mx + 150, GY, [
      [0, "#f6f3ea"],
      [1, "#b6bdd0"],
    ]);
    c.fillRect(mx, GY - 70, 150, 70);
    c.fillStyle = "#46507e";
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      arch(c, mx + 12 + i * 28, GY, 16, 38);
      c.fill();
    }
    c.fillStyle = "#d6c27a";
    c.fillRect(mx, GY - 72, 150, 3);
    drum(c, mx + 75, GY - 70, 36, 22, "#9aa3bd", "#e8ebf4");
    dome(c, mx + 75, GY - 92, 40, 50, WHT, 8);
    minaret(c, mx - 8, GY, 13, 125, "#9aa3bd", "#e8ebf4", "#e9ecf5");
    minaret(c, mx + 158, GY, 13, 125, "#9aa3bd", "#e8ebf4", "#e9ecf5");
    // Tashkent City towers
    for (const [tx, tw, th] of [
      [236, 50, 205],
      [292, 42, 262],
      [340, 54, 172],
      [400, 40, 228],
      [448, 46, 150],
    ])
      glass(c, tx, GY, tw, th, night);
    tvTower(c, 548, GY, 328, night);
  }
  function registan(c, w, h) {
    const GY = h,
      tq = TQ;
    // Tilya-Kori (centre) with its dome
    drum(c, 280, GY - 128, 40, 30);
    dome(c, 280, GY - 158, 44, 74, COB, 9);
    facade(c, 150, GY, 260, 128);
    pishtaq(c, 226, GY, 108, 168);
    // Ulugbek madrasa (left)
    pishtaq(c, 0, GY, 150, 205);
    minaret(c, 6, GY, 20, 214);
    minaret(c, 148, GY, 20, 214);
    // Sher-Dor (right) with two ribbed domes and the Sun mosaic
    drum(c, 462, GY - 150, 26, 26, P.cob, P.tq);
    drum(c, 538, GY - 150, 26, 26, P.cob, P.tq);
    dome(c, 462, GY - 176, 28, 50, tq, 11);
    dome(c, 538, GY - 176, 28, 50, tq, 11);
    pishtaq(c, 410, GY, 150, 205);
    minaret(c, 412, GY, 20, 216);
    minaret(c, 554, GY, 20, 216);
    c.fillStyle = "#e8a020";
    c.beginPath();
    c.arc(485, GY - 168, 11, 0, 7);
    c.fill();
    c.strokeStyle = "#f6c545";
    c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      c.moveTo(485 + Math.cos(a) * 13, GY - 168 + Math.sin(a) * 13);
      c.lineTo(485 + Math.cos(a) * 19, GY - 168 + Math.sin(a) * 19);
    }
    c.stroke();
    c.fillStyle = "#6b3b0b";
    c.fillRect(481, GY - 171, 2, 2);
    c.fillRect(487, GY - 171, 2, 2);
    c.fillRect(482, GY - 165, 6, 1.5);
  }
  function bukhara(c, w, h) {
    const GY = h,
      brick = lg(c, 0, 0, 40, 0, [
        [0, "#8a5a2f"],
        [0.45, "#d7a366"],
        [1, "#8a5a2f"],
      ]);
    // Po-i-Kalon mosque dome (left)
    drum(c, 82, GY - 70, 44, 40, P.cob, P.tq);
    dome(c, 82, GY - 110, 50, 64, COB, 10);
    c.fillStyle = lg(c, 30, GY - 70, 140, GY, [
      [0, P.sandL],
      [1, P.sandD],
    ]);
    c.fillRect(30, GY - 70, 104, 70);
    c.fillStyle = "#16205a";
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      arch(c, 40 + i * 24, GY, 14, 40);
      c.fill();
    }
    // Kalon minaret (46 m, brick, ornamental belts)
    const kx = 214,
      kh = 262,
      kw = 36;
    c.beginPath();
    c.moveTo(kx - kw / 2, GY);
    c.lineTo(kx - 12, GY - kh);
    c.lineTo(kx + 12, GY - kh);
    c.lineTo(kx + kw / 2, GY);
    c.closePath();
    c.fillStyle = lg(c, kx - kw / 2, 0, kx + kw / 2, 0, [
      [0, "#8a5a2f"],
      [0.4, "#d9a869"],
      [1, "#7e5028"],
    ]);
    c.fill();
    c.save();
    c.clip();
    for (let i = 0; i < 9; i++) {
      const yy = GY - 14 - i * 28;
      tiles(
        c,
        kx - kw / 2,
        yy - 6,
        kw,
        12,
        4,
        i % 3 === 1 ? "#2a63c4" : "#e9c98f",
        i % 3 === 1 ? "#9cc0ff" : "#a8763f",
      );
    }
    c.restore();
    c.fillStyle = "#8a5a2f";
    c.fillRect(kx - 17, GY - kh - 3, 34, 6);
    c.fillStyle = "#e0b676";
    c.fillRect(kx - 15, GY - kh - 26, 30, 22);
    c.fillStyle = "#16205a";
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      arch(c, kx - 13 + i * 6, GY - kh - 6, 4, 14);
      c.fill();
    }
    dome(c, kx, GY - kh - 26, 17, 22, TQ, 4);
    // Mir-i Arab madrasa (right): portal + two blue domes
    pishtaq(c, 326, GY, 130, 150);
    drum(c, 350, GY - 150, 28, 30);
    drum(c, 432, GY - 150, 28, 30);
    dome(c, 350, GY - 180, 32, 56, COB, 10);
    dome(c, 432, GY - 180, 32, 56, COB, 10);
    c.fillStyle = brick; // low brick wall
    c.fillRect(458, GY - 54, 60, 54);
    c.fillStyle = "#16205a";
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      arch(c, 466 + i * 17, GY, 11, 30);
      c.fill();
    }
  }
  function khiva(c, w, h) {
    const GY = h,
      wall = lg(c, 0, GY - 70, 0, GY, [
        [0, "#c39a64"],
        [1, "#8f6a3f"],
      ]);
    // Islam Khoja minaret (tall, banded)
    const ix = 438,
      ih = 250;
    c.beginPath();
    c.moveTo(ix - 14, GY);
    c.lineTo(ix - 8, GY - ih);
    c.lineTo(ix + 8, GY - ih);
    c.lineTo(ix + 14, GY);
    c.closePath();
    c.fillStyle = lg(c, ix - 14, 0, ix + 14, 0, [
      [0, "#8a3f2a"],
      [0.4, "#d46a4a"],
      [1, "#7a3524"],
    ]);
    c.fill();
    c.save();
    c.clip();
    for (let i = 0; i < 5; i++) {
      tiles(c, ix - 14, GY - 30 - i * 44, 28, 14, 4, "#f2f2f2", "#2a63c4");
    }
    c.restore();
    c.fillStyle = "#6d3a1f";
    c.fillRect(ix - 11, GY - ih - 3, 22, 5);
    c.fillStyle = "#d9b27a";
    c.fillRect(ix - 9, GY - ih - 22, 18, 18);
    dome(c, ix, GY - ih - 22, 11, 16, TQ, 3);
    // Pahlavon Mahmud mausoleum dome
    drum(c, 300, GY - 82, 42, 34);
    dome(c, 300, GY - 116, 46, 66, TQ, 11);
    c.fillStyle = lg(c, 250, GY - 82, 350, GY, [
      [0, "#dcc08a"],
      [1, "#a98254"],
    ]);
    c.fillRect(256, GY - 82, 88, 82);
    c.fillStyle = "#16205a";
    c.beginPath();
    arch(c, 284, GY, 32, 60);
    c.fill();
    c.strokeStyle = P.tq;
    c.lineWidth = 2;
    c.stroke();
    // Kalta Minor (short, very wide, turquoise glazed)
    const kx = 130,
      kh = 118,
      kw = 82;
    c.fillStyle = "#e6e0cf";
    c.fillRect(kx - kw / 2, GY - kh, kw, kh);
    const cols = [
      "#1d4fb0",
      "#f2f2f2",
      "#22b8c4",
      "#1a8f5a",
      "#f2f2f2",
      "#1d4fb0",
      "#22b8c4",
    ];
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(kx - kw / 2, GY - kh + i * (kh / 7), kw, kh / 7 - 2);
    });
    c.save();
    c.beginPath();
    c.rect(kx - kw / 2, GY - kh, kw, kh);
    c.clip();
    tiles(
      c,
      kx - kw / 2,
      GY - kh,
      kw,
      kh,
      7,
      "rgba(255,255,255,.18)",
      "rgba(0,40,90,.18)",
    );
    c.restore();
    c.fillStyle = lg(c, kx - kw / 2, 0, kx + kw / 2, 0, [
      [0, "rgba(0,20,60,.45)"],
      [0.35, "rgba(255,255,255,.12)"],
      [1, "rgba(0,20,60,.5)"],
    ]);
    c.fillRect(kx - kw / 2, GY - kh, kw, kh);
    c.fillStyle = "#1d4fb0";
    c.fillRect(kx - kw / 2 - 3, GY - kh - 4, kw + 6, 5);
    // Ichan-Qala wall with towers
    c.fillStyle = wall;
    c.fillRect(0, GY - 62, w, 62);
    c.fillStyle = "#9b7747";
    for (let i = 0; i < w; i += 12) c.fillRect(i, GY - 70, 8, 9);
    for (const tx of [30, 205, 380, 520]) {
      c.fillStyle = "#b08a58";
      c.fillRect(tx - 14, GY - 80, 28, 80);
      c.fillStyle = "#9b7747";
      for (let i = -14; i < 14; i += 9) c.fillRect(tx + i, GY - 88, 6, 9);
    }
    c.fillStyle = "rgba(60,30,10,.3)";
    for (let i = 20; i < w; i += 28) c.fillRect(i, GY - 40, 2, 18);
  }
  const LM = {
    tash: { w: 620, h: 340, fn: (c, w, h) => tashkent(c, w, h, false) },
    tashN: { w: 620, h: 340, fn: (c, w, h) => tashkent(c, w, h, true) },
    sam: { w: 580, h: 300, fn: registan },
    bux: { w: 530, h: 310, fn: bukhara },
    khi: { w: 560, h: 300, fn: khiva },
  };
  function landmark(city, sc) {
    const L = LM[city],
      cv = mk(L.w * sc, L.h * sc),
      c = cv.getContext("2d");
    rd = rng(city.length * 977 + city.charCodeAt(0));
    c.scale(sc, sc);
    L.fn(c, L.w, L.h);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = TINT[city];
    c.fillRect(0, 0, L.w, L.h);
    return cv;
  }

  /* ---------- parallax strips ---------- */
  function building(c, city, x, by, w, h, layer, night) {
    const WALL = {
      tash: ["#58628a", "#333c5c"],
      tashN: ["#232a4a", "#141a33"],
      sam: ["#b99458", "#8d6c3b"],
      bux: ["#b07d4a", "#855a32"],
      khi: ["#a98254", "#7e5c37"],
    }[city];
    c.fillStyle = lg(c, x, by - h, x, by, [
      [0, WALL[0]],
      [1, WALL[1]],
    ]);
    c.fillRect(x, by - h, w, h);
    if (city === "tash" || city === "tashN") {
      windowsGrid(c, x, by, w, h, night);
      if (rd() < 0.25) {
        c.fillStyle = WALL[1];
        c.fillRect(x + w / 2 - 1, by - h - 12, 2, 12);
      } else {
        c.fillStyle = WALL[1];
        c.fillRect(x + 3, by - h - 4, w - 6, 4);
      }
    } else {
      c.fillStyle = "rgba(15,18,60,.7)";
      for (let wy = by - h + 8; wy < by - 10; wy += 15)
        for (let wx = x + 6; wx < x + w - 8; wx += 13) {
          c.beginPath();
          arch(c, wx, wy + 9, 6, 9);
          c.fill();
          if (rd() < (night ? 0.55 : 0.2)) {
            c.fillStyle = "#ffd98a";
            c.beginPath();
            arch(c, wx + 1, wy + 8, 4, 6);
            c.fill();
            c.fillStyle = "rgba(15,18,60,.7)";
          }
        }
      c.fillStyle = WALL[1];
      for (let i = 0; i < w; i += 7) c.fillRect(x + i, by - h - 3, 4, 3);
      const k = rd();
      if (k < 0.32)
        dome(
          c,
          x + w / 2,
          by - h,
          w * 0.3,
          w * 0.38,
          city === "bux" ? COB : TQ,
          5,
        );
      else if (k < 0.45 && !layer)
        minaret(c, x + w / 2, by - h, 9, 38, P.cob, P.tq);
    }
  }
  function trees(c, city, by, night) {
    if (city === "khi") return;
    c.fillStyle = night ? "#0f2418" : "#264733";
    for (let i = 0; i < 26; i++) {
      const x = rd() * TW,
        k = rd();
      if (k < 0.5) {
        c.beginPath();
        c.ellipse(x, by - 18, 4.5, 20, 0, 0, 7);
        c.fill();
      } // poplar
      else {
        c.fillRect(x - 1.5, by - 14, 3, 14);
        c.beginPath();
        c.arc(x, by - 20, 10, 0, 7);
        c.arc(x - 8, by - 14, 7, 0, 7);
        c.arc(x + 8, by - 14, 7, 0, 7);
        c.fill();
      } // chinar
    }
  }
  function strip(city, layer, sc) {
    const night = !!NIGHT[city],
      H0 = layer ? MID_H : FAR_H,
      cv = mk(TW * sc, H0 * sc),
      c = cv.getContext("2d");
    rd = rng(layer * 131 + city.length * 53 + city.charCodeAt(1));
    c.scale(sc, sc);
    let x = 0;
    while (x < TW - 80) {
      const bw = R(layer ? 36 : 44, layer ? 72 : 96),
        bh = layer ? R(24, 70) : R(60, 150);
      building(c, city, x, H0, bw, bh, layer, night);
      x += bw + R(2, layer ? 10 : 18);
    }
    if (layer) trees(c, city, H0, night);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = layer ? "rgba(20,20,40,.22)" : HAZE[city];
    c.fillRect(0, 0, TW, H0);
    return cv;
  }

  /* ---------- ground tiles ---------- */
  function ground(city, sc) {
    const cv = mk(GW * sc, GH * sc),
      c = cv.getContext("2d");
    rd = rng(city.charCodeAt(0) * 31);
    c.scale(sc, sc);
    const base = {
      tash: "#2b3040",
      tashN: "#151a2c",
      sam: "#b48d55",
      bux: "#a86a3c",
      khi: "#8a6a45",
    }[city];
    c.fillStyle = base;
    c.fillRect(0, 0, GW, GH);
    if (city === "tash" || city === "tashN") {
      c.fillStyle = city === "tash" ? "#8189a3" : "#4a5275";
      c.fillRect(0, 0, GW, 6);
      c.fillStyle = "rgba(255,255,255,.25)";
      c.fillRect(0, 0, GW, 1.5);
      c.fillStyle = city === "tash" ? "#e9e9f0" : "#c9b76a";
      c.fillRect(18, 36, 64, 4);
      c.fillRect(110, 36, 40, 4);
      for (let i = 0; i < 40; i++) {
        c.fillStyle = "rgba(255,255,255,.06)";
        c.fillRect(rd() * GW, 8 + rd() * (GH - 8), 2, 1);
      }
      if (city === "tashN")
        for (const [x, col] of [
          [30, "255,79,216"],
          [100, "83,247,255"],
        ]) {
          c.fillStyle = lg(c, 0, 8, 0, GH, [
            [0, `rgba(${col},.22)`],
            [1, `rgba(${col},0)`],
          ]);
          c.fillRect(x, 8, 6, GH - 8);
        }
    } else {
      const jc = { sam: "#8a6a3a", bux: "#7b4a26", khi: "#6a4d2d" }[city],
        rh = city === "bux" ? 10 : 16,
        bw = city === "bux" ? 28 : 40;
      c.fillStyle = { sam: "#e0c08a", bux: "#d49a62", khi: "#c9a070" }[city];
      c.fillRect(0, 0, GW, 5);
      c.fillStyle = jc;
      for (let y = 5, r = 0; y < GH; y += rh, r++) {
        c.fillRect(0, y, GW, 1.4);
        for (let x = ((r % 2) * bw) / 2; x < GW; x += bw)
          c.fillRect(x, y, 1.4, rh);
      }
      for (let i = 0; i < 30; i++) {
        c.fillStyle = "rgba(0,0,0,.07)";
        c.fillRect(rd() * GW, 8 + rd() * (GH - 8), 5, 2);
      }
    }
    return { cv, base };
  }

  /* ---------- public API ---------- */
  // Sprites are drawn into world units by the game, so their pixel scale only affects sharpness vs memory.
  const cache = {},
    order = [],
    pending = {};
  const scales = (opt) =>
    opt && opt.coarse ? { g: 1, s: 1, l: 1.25 } : { g: 1.5, s: 1.25, l: 1.75 };
  const dispose = (A) => {
    for (const k of ["far", "mid", "lm", "gnd"])
      if (A[k]) {
        A[k].width = 0;
        A[k].height = 0;
      }
  };
  function remember(city, A) {
    cache[city] = A;
    order.push(city);
    while (order.length > 2) {
      const old = order.shift();
      if (old !== city && cache[old]) {
        dispose(cache[old]);
        delete cache[old];
      }
    }
  }
  const peek = (city) => cache[city] || null;
  function parts(city, sc) {
    const g = ground(city, sc.g),
      L = LM[city];
    return [
      (P) => {
        P.gnd = g.cv;
        P.gBase = g.base;
      },
      (P) => {
        P.far = strip(city, 0, sc.s);
      },
      (P) => {
        P.mid = strip(city, 1, sc.s);
      },
      (P) => {
        P.lm = landmark(city, sc.l);
        P.lmW = L.w;
        P.lmH = L.h;
      },
    ];
  }
  function get(city, opt = {}) {
    // synchronous (only used for the very first paint)
    if (cache[city]) return cache[city];
    const P = { city };
    parts(city, scales(opt)).forEach((f) => f(P));
    remember(city, P);
    return P;
  }
  function getAsync(city, opt = {}, cb) {
    // builds one piece per timer tick so the game never freezes
    if (cache[city]) {
      if (cb) cb(cache[city]);
      return;
    }
    if (pending[city]) {
      if (cb) pending[city].push(cb);
      return;
    }
    pending[city] = cb ? [cb] : [];
    const P = { city },
      steps = parts(city, scales(opt));
    const run = (i) => {
      if (i < steps.length) {
        steps[i](P);
        setTimeout(() => run(i + 1), 24);
        return;
      }
      remember(city, P);
      const cbs = pending[city];
      delete pending[city];
      cbs.forEach((f) => f(P));
    };
    setTimeout(() => run(0), 0);
  }
  function thumb(city, cb) {
    // small postcard → saved by the game, so menus show it instantly
    const L = LM[city],
      k = Math.min((240 / L.w) * 1.05, 122 / L.h),
      cv = mk(240, 130),
      c = cv.getContext("2d"),
      s = SKY[city];
    c.fillStyle = lg(c, 0, 0, 0, 130, [
      [0, s[0]],
      [1, s[1]],
    ]);
    c.fillRect(0, 0, 240, 130);
    const lm = landmark(city, k);
    c.drawImage(lm, 120 - lm.width / 2, 130 - lm.height);
    lm.width = 0;
    const url = cv.toDataURL("image/jpeg", 0.7);
    cv.width = 0;
    cb(url);
  }
  return {
    TW,
    GW,
    GH,
    FAR_H,
    MID_H,
    get,
    getAsync,
    peek,
    thumb,
    SKY,
    NIGHT,
    cities: Object.keys(LM),
  };
})();
