/* =====================================================
   ZUMARY CITY RUN — a 3-lane runner seen from behind (Subway-Surfers style),
   running down the middle of an Uzbek city street.
   Pseudo-3D on a plain 2D canvas:
   • every object is projected with one formula  s = F / (z + Z0)
   • building walls are textured with vertical strips, so they get real perspective
   • characters, coins and buildings are pre-rendered once; per frame only drawImage / fillRect
   Shares the wallet (zr_wallet), skin (zr_skin) and language (zr_lang) with the side-scroller.
===================================================== */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cv = $("c"), ctx = cv.getContext("2d");
  const COARSE = matchMedia("(pointer:coarse)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- texts (uz / en / ja) ---------- */
  const TX = {
    uz: { title: "SHAHAR YUGURISH", sub: "Ko'cha o'rtasida yugur, tanga yig', to'siqlardan qoch.<br>Chapga/o'ngga surish — yo'l almashtirish · yuqoriga — sakrash · pastga — sirpanish.", play: "BOSHLASH", again: "YANA", back: "◀ ASOSIY O'YIN", best: "REKORD", score: "NATIJA", coins: "TANGA", busted: "USHLANDI!", caught: "Politsiya sizni ushladi", stumble: "EHTIYOT BO'L!", m: "m", paused: "PAUZA", newbest: "YANGI REKORD!" },
    en: { title: "CITY RUN", sub: "Run down the middle of the street, grab coins, dodge obstacles.<br>Swipe left/right to change lane · up to jump · down to slide.", play: "START", again: "AGAIN", back: "◀ MAIN GAME", best: "BEST", score: "SCORE", coins: "COINS", busted: "BUSTED!", caught: "The police got you", stumble: "WATCH OUT!", m: "m", paused: "PAUSED", newbest: "NEW BEST!" },
    ja: { title: "シティラン", sub: "街の真ん中を走って、コインを集めて、障害物をよけよう。<br>左右スワイプでレーン変更 · 上でジャンプ · 下でスライディング。", play: "スタート", again: "もう一度", back: "◀ メインゲーム", best: "ベスト", score: "スコア", coins: "コイン", busted: "確保！", caught: "警察に捕まった", stumble: "危ない！", m: "m", paused: "一時停止", newbest: "新記録！" },
  };
  let LG = "uz"; try { const s = localStorage.getItem("zr_lang"); if (s && TX[s]) LG = s; else { const n = (navigator.language || "uz").slice(0, 2); if (TX[n]) LG = n; } } catch (e) {}
  const T = (k) => TX[LG][k];
  document.documentElement.lang = LG;

  /* ---------- characters / coins (rig.js) ---------- */
  const CSC = COARSE ? 1.25 : 1.6;
  let skin = store.get("zr_skin", "default"), HERO = null, GRD = null, DOG = null, COIN = null;
  const hero = () => HERO || (HERO = Rig.runnerBack(skin, CSC));
  const guardS = () => GRD || (GRD = Rig.guardBack(CSC));
  const dogS = () => DOG || (DOG = Rig.dogBack(CSC));
  const coinS = () => COIN || (COIN = Rig.coins(CSC));

  /* ---------- view / projection ---------- */
  let W = 360, H = 640, DPR = 1, cx = 180, yH = 220, F = 380, laneP = 90, UI = 1;
  const CH = 3.2, Z0 = 1.2, ZP = 3.2;                      // camera height, lens offset, player depth in front of the camera
  let camX = 0, qual = 0, budgetK = 1, avgDt = 16.7, slowN = 0;
  const PIX = () => (COARSE ? 620000 : 2200000) * budgetK;
  function resize() {
    const cw = Math.max(240, innerWidth), ch = Math.max(240, innerHeight);
    DPR = Math.min(devicePixelRatio || 1, 2);
    const want = cw * ch * DPR * DPR, bud = PIX();
    if (want > bud) DPR = Math.max(0.6, DPR * Math.sqrt(bud / want));
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
    W = cw; H = ch; cx = W / 2;
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    laneP = Math.min(W * 0.25, H * 0.15); UI = Math.max(0.8, Math.min(W, H) / 390);
    F = laneP * (ZP + Z0); yH = H * 0.34;
    skyKey = ""; bgCache = null; vigK = "";
  }
  const sOf = (z) => F / (z + Z0);
  const PX = (x, z) => cx + (x - camX) * sOf(z);
  const PY = (y, z) => yH + (CH - y) * sOf(z);

  /* ---------- themes: Tashkent · Samarkand · Bukhara · Khiva ---------- */
  const THEMES = [
    { sky: ["#2a2f6b", "#c4577a", "#ffb36b"], sun: "#ffe0a0", fog: "#e6a07a", road: "#2c303c", road2: "#333847", walk: "#8c8fa0", walk2: "#9a9db0" },
    { sky: ["#2d7fd6", "#79c4f0", "#fbe7c0"], sun: "#fff6d0", fog: "#cfe6f3", road: "#3a3a42", road2: "#42424c", walk: "#b8a98c", walk2: "#c6b79a" },
    { sky: ["#7a4a8a", "#e8845a", "#ffcf7a"], sun: "#fff0b0", fog: "#f0b684", road: "#4a3d36", road2: "#54463e", walk: "#c9a070", walk2: "#d6ae7e" },
    { sky: ["#1c2250", "#6b4a8e", "#f08a6a"], sun: "#ffd2a0", fog: "#c98a90", road: "#3d3340", road2: "#463b49", walk: "#b08a6a", walk2: "#be977a" },
  ];
  const DEFS = [
    [["tower", 5, 14], ["tower", 4.2, 11], ["shops", 6, 7], ["tower", 5.5, 16], ["shops", 4.6, 6]],
    [["madrasa", 8, 9], ["minaret", 2.6, 14], ["madrasa", 6, 8], ["minaret", 2.4, 12], ["madrasa", 7, 7]],
    [["brick", 6, 7], ["minaret", 2.8, 13], ["brick", 5, 8], ["brick", 7, 6], ["brick", 4.4, 9]],
    [["fort", 7, 7], ["minaret", 3, 9], ["fort", 5, 8], ["fort", 6, 6], ["fort", 4.4, 7.5]],
  ];
  const PPU = COARSE ? 22 : 30, TEX = [null, null, null, null];

  function mkc(w, h) { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  const lg = (g, x0, y0, x1, y1, st) => { const q = g.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => q.addColorStop(o, c)); return q; };
  function arch(g, x, y, w, h) { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.quadraticCurveTo(x, y, x + w / 2, y); g.quadraticCurveTo(x + w, y, x + w, y + w / 2); g.lineTo(x + w, y + h); g.closePath(); }
  function lit(g, x, y, w, h, on, warm) { g.fillStyle = on ? (warm ? "#ffd98a" : "#9fe3ff") : "#17203a"; g.fillRect(x, y, w, h); if (on) { g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(x, y, w, h * 0.3); } }
  function dome(g, x, y, w, col, col2) {
    const h = w * 0.62; g.fillStyle = lg(g, x, y - h, x + w, y, [[0, col2], [0.5, col], [1, "#0e5a78"]]);
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - w * 0.06, y - h * 1.05, x + w * 0.3, y - h * 1.25, x + w / 2, y - h * 1.5); g.bezierCurveTo(x + w * 0.7, y - h * 1.25, x + w * 1.06, y - h * 1.05, x + w, y); g.closePath(); g.fill();
    g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + (w * i) / 5, y); g.quadraticCurveTo(x + w / 2 + (i - 2.5) * w * 0.05, y - h * 1.0, x + w / 2, y - h * 1.48); g.stroke(); }
    g.fillStyle = "#f2c14e"; g.fillRect(x + w / 2 - 1.5, y - h * 1.5 - 6, 3, 8);
  }
  function tiles(g, x, y, w, h, c1, c2) {                  // blue/turquoise geometric tile band
    g.fillStyle = c1; g.fillRect(x, y, w, h); g.strokeStyle = c2; g.lineWidth = 1;
    const s = h; for (let i = 0; i < w / s; i++) { const xx = x + i * s; g.beginPath(); g.moveTo(xx + s / 2, y + 2); g.lineTo(xx + s - 2, y + s / 2); g.lineTo(xx + s / 2, y + s - 2); g.lineTo(xx + 2, y + s / 2); g.closePath(); g.stroke(); g.fillStyle = c2; g.fillRect(xx + s / 2 - 1.5, y + s / 2 - 1.5, 3, 3); }
  }
  function facade(th, kind, len, h) {
    const w = Math.round(len * PPU), hh = Math.round(h * PPU), cv2 = mkc(w, hh), g = cv2.getContext("2d");
    const wall = (c1, c2, top = 0) => { g.fillStyle = lg(g, 0, top, 0, hh, [[0, c1], [1, c2]]); g.fillRect(0, top, w, hh - top); };
    if (kind === "tower") {
      const base = [["#5b7fa8", "#2b4264"], ["#6d7c92", "#34415a"], ["#8a8f9c", "#454b5e"], ["#4c6f9a", "#223654"]][(Math.random() * 4) | 0];
      wall(base[0], base[1]); g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(0, 0, w * 0.18, hh);
      const cols = Math.max(3, Math.round(len * 2.3)), rows = Math.round(h * 1.9), cw = w / cols, rh = (hh - PPU * 1.8) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lit(g, c * cw + cw * 0.14, r * rh + rh * 0.16, cw * 0.72, rh * 0.62, Math.random() < 0.5, true);
      g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, 0, w, 3); g.fillStyle = "#101626"; g.fillRect(0, hh - PPU * 1.8, w, PPU * 1.8);
      for (let i = 0; i < 3; i++) { g.fillStyle = ["#ff4fd8", "#53f7ff", "#ffd84f"][i]; g.fillRect(w * (0.08 + i * 0.3), hh - PPU * 1.5, w * 0.24, PPU * 0.9); }
      g.fillStyle = "#ff3b4d"; g.fillRect(w / 2 - 1.5, 0, 3, 5);
    } else if (kind === "shops") {
      wall("#c9a27a", "#8a6446"); for (let r = 0; r < Math.round(h - 2); r++) for (let c = 0; c < Math.round(len * 1.6); c++) { const cw = w / Math.round(len * 1.6); arch(g, c * cw + cw * 0.22, r * PPU + PPU * 0.4, cw * 0.56, PPU * 0.85); g.fillStyle = Math.random() < 0.45 ? "#ffd98a" : "#26304a"; g.fill(); g.strokeStyle = "#f0e0c0"; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = "#1a1c2a"; g.fillRect(0, hh - PPU * 2, w, PPU * 2); for (let i = 0; i < 3; i++) { g.fillStyle = ["#e0405a", "#2fb6c4", "#f2b53a"][i]; g.beginPath(); g.moveTo(w * (0.04 + i * 0.32), hh - PPU * 1.9); g.lineTo(w * (0.3 + i * 0.32), hh - PPU * 1.9); g.lineTo(w * (0.32 + i * 0.32), hh - PPU * 1.4); g.lineTo(w * (0.02 + i * 0.32), hh - PPU * 1.4); g.fill(); g.fillStyle = "#ffe9a8"; g.fillRect(w * (0.07 + i * 0.32), hh - PPU * 1.3, w * 0.2, PPU * 1.1); }
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 0, w, 4);
    } else if (kind === "madrasa") {
      const top = PPU * 2.4; wall("#d9b98a", "#9a7650", top);
      tiles(g, 0, top + 4, w, PPU * 0.5, "#1c6fa8", "#7fd6ee"); tiles(g, 0, hh - PPU * 1.6, w, PPU * 0.5, "#1c6fa8", "#7fd6ee");
      const pw = w * 0.36, px0 = (w - pw) / 2; g.fillStyle = "#2a8fb8"; arch(g, px0 - 6, top + PPU * 0.9, pw + 12, hh - top - PPU * 0.9); g.fill();
      g.fillStyle = "#15283f"; arch(g, px0 + 6, top + PPU * 1.5, pw - 12, hh - top - PPU * 1.5); g.fill();
      g.fillStyle = "#ffcf7a"; arch(g, px0 + 16, top + PPU * 2.4, pw - 32, hh - top - PPU * 2.4); g.fill(); g.fillStyle = "#6a3d1f"; arch(g, px0 + 24, top + PPU * 3.4, pw - 48, hh - top - PPU * 3.4); g.fill();
      for (const side of [0, 1]) { const x0 = side ? px0 + pw + 10 : 8, ww = side ? w - (px0 + pw) - 18 : px0 - 14; const n = Math.max(1, Math.round(ww / (PPU * 1.3))); for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) { arch(g, x0 + (c + 0.2) * (ww / n), top + PPU * (1.6 + r * 2.8), (ww / n) * 0.6, PPU * 1.7); g.fillStyle = Math.random() < 0.5 ? "#ffd98a" : "#1a2a44"; g.fill(); g.strokeStyle = "#1c6fa8"; g.lineWidth = 2; g.stroke(); } }
      dome(g, w * 0.36, top, w * 0.28, "#1fa3c4", "#8ee8f0");
      g.fillStyle = "#c89860"; g.fillRect(0, top - 3, w, 3);
    } else if (kind === "brick") {
      const top = PPU * 1.4; wall("#d2a56e", "#9a6a3a", top);
      g.strokeStyle = "rgba(90,50,20,.35)"; g.lineWidth = 1; for (let y = top; y < hh; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 7) | 0) % 2 ? 0 : 7; x < w; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 7); g.stroke(); } }
      const n = Math.max(2, Math.round(len * 1.3)), cw = w / n; for (let r = 0; r < Math.round(h - 2); r++) for (let c = 0; c < n; c++) { arch(g, c * cw + cw * 0.2, top + r * PPU * 1.1 + PPU * 0.3, cw * 0.6, PPU * 0.9); g.fillStyle = Math.random() < 0.45 ? "#ffd98a" : "#2a1c18"; g.fill(); g.strokeStyle = "#6a4020"; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = "#1a120e"; arch(g, w * 0.38, hh - PPU * 2.2, w * 0.24, PPU * 2.2); g.fill(); dome(g, w * 0.08, top, PPU * 1.5, "#2aa3b4", "#9ee8ee"); dome(g, w * 0.72, top, PPU * 1.5, "#2aa3b4", "#9ee8ee");
      g.fillStyle = "#b8864f"; g.fillRect(0, top - 2, w, 4);
    } else if (kind === "fort") {
      const top = PPU * 0.9; wall("#c99a62", "#8a6238", top);
      g.fillStyle = "#c99a62"; for (let x = 0; x < w; x += PPU * 0.9) g.fillRect(x, 4, PPU * 0.5, top);
      g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, top + Math.random() * (hh - top), rnd(4, 14), 2);
      tiles(g, 0, top + PPU * 0.3, w, PPU * 0.45, "#1a8aa0", "#9ee8ee");
      const n = Math.max(2, Math.round(len * 1.2)), cw = w / n; for (let r = 0; r < Math.round(h - 3); r++) for (let c = 0; c < n; c++) { arch(g, c * cw + cw * 0.28, top + PPU * 1.2 + r * PPU * 1.2, cw * 0.44, PPU * 0.95); g.fillStyle = Math.random() < 0.4 ? "#ffd98a" : "#241a14"; g.fill(); g.strokeStyle = "#5a3a1c"; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = "#1a120e"; arch(g, w * 0.4, hh - PPU * 2, w * 0.2, PPU * 2); g.fill();
    } else {                                              // minaret: tapered brick tower with tile bands and a lantern top
      const bw = w * 0.78, x0 = (w - bw) / 2, top = PPU * 1.8, col = [["#c8a064", "#8a6238"], ["#d6b27a", "#9a7446"]][(Math.random() * 2) | 0];
      g.fillStyle = lg(g, x0, 0, x0 + bw, 0, [[0, col[1]], [0.35, shade(col[0])], [1, col[1]]]); g.beginPath(); g.moveTo(x0 + bw * 0.06, hh); g.lineTo(x0 + bw * 0.16, top + PPU * 1.2); g.lineTo(x0 + bw * 0.84, top + PPU * 1.2); g.lineTo(x0 + bw * 0.94, hh); g.closePath(); g.fill();
      for (let i = 0; i < 4; i++) tiles(g, x0 + bw * 0.1, top + PPU * (2.4 + i * 2.6), bw * 0.8, PPU * 0.7, "#1a7fb0", "#9ee8ee");
      g.fillStyle = "#c8a064"; g.fillRect(x0 - 3, top + PPU * 0.8, bw + 6, PPU * 0.5); g.fillStyle = "#1c6fa8"; g.fillRect(x0 + bw * 0.14, top - PPU * 0.2, bw * 0.72, PPU * 1.1);
      for (let i = 0; i < 4; i++) { g.fillStyle = "#ffd98a"; g.fillRect(x0 + bw * (0.2 + i * 0.18), top, bw * 0.1, PPU * 0.6); }
      dome(g, x0 + bw * 0.14, top - PPU * 0.2, bw * 0.72, "#1fa3c4", "#8ee8f0");
    }
    return { cv: cv2, len, h };
  }
  const shade = (hex) => hex;
  function themeTex(i) { return TEX[i] || (TEX[i] = DEFS[i].map(([k, l, h]) => facade(i, k, l, h))); }

  /* sky, sun and a far skyline, cached per theme / size */
  let skyKey = "", skyCache = {}, bgCache = null;
  function skyFor(i) {
    const key = i + "|" + W + "x" + H;
    if (skyCache[key]) return skyCache[key];
    const c = mkc(W, Math.ceil(yH + 4)), g = c.getContext("2d"), th = THEMES[i];
    g.fillStyle = lg(g, 0, 0, 0, yH, [[0, th.sky[0]], [0.55, th.sky[1]], [1, th.sky[2]]]); g.fillRect(0, 0, W, yH + 4);
    const sg = g.createRadialGradient(cx + W * 0.12, yH - 26 * UI, 4, cx + W * 0.12, yH - 26 * UI, 90 * UI); sg.addColorStop(0, th.sun); sg.addColorStop(0.2, th.sun + "cc"); sg.addColorStop(1, th.sun + "00");
    g.fillStyle = sg; g.fillRect(0, 0, W, yH + 4);
    g.fillStyle = th.sun; g.beginPath(); g.arc(cx + W * 0.12, yH - 26 * UI, 15 * UI, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,.18)"; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(rnd(0, W), rnd(yH * 0.1, yH * 0.6), rnd(30, 80), rnd(4, 9), 0, 0, TAU); g.fill(); }
    // far skyline silhouette
    g.fillStyle = th.fog + "dd"; let x = -10; while (x < W) { const bw = rnd(16, 40) * UI, bh = rnd(10, 46) * UI; g.fillRect(x, yH - bh, bw, bh + 2); if (Math.random() < 0.22) { g.beginPath(); g.arc(x + bw / 2, yH - bh, bw * 0.4, Math.PI, TAU); g.fill(); } x += bw + rnd(0, 6); }
    skyCache[key] = c; if (Object.keys(skyCache).length > 10) skyCache = { [key]: c };
    return c;
  }
  let vigK = "", vigC = null;
  function vignette() {
    const k = W + "x" + H;
    if (vigK !== k) {
      vigK = k; const c = mkc(96, Math.max(48, Math.round((96 * H) / W))), g = c.getContext("2d"), r = Math.hypot(c.width, c.height) / 2;
      const q = g.createRadialGradient(c.width / 2, c.height * 0.5, r * 0.4, c.width / 2, c.height * 0.5, r * 1.02); q.addColorStop(0, "rgba(6,6,18,0)"); q.addColorStop(1, "rgba(6,6,18,.6)"); g.fillStyle = q; g.fillRect(0, 0, c.width, c.height);
      const l = g.createLinearGradient(0, 0, 0, c.height); l.addColorStop(0, "rgba(255,150,70,.1)"); l.addColorStop(0.6, "rgba(255,150,70,0)"); l.addColorStop(1, "rgba(30,110,150,.12)"); g.fillStyle = l; g.fillRect(0, 0, c.width, c.height); vigC = c;
    }
    return vigC;
  }

  /* lamp posts, chinar trees (billboards on the sidewalk) */
  let PROPS = null;
  function props() {
    if (PROPS) return PROPS;
    const lamp = mkc(40, 120), g = lamp.getContext("2d");
    g.fillStyle = "#2a2f3c"; g.fillRect(18, 18, 4, 100); g.fillRect(18, 16, 18, 3.5); const gl = g.createRadialGradient(34, 24, 1, 34, 24, 12); gl.addColorStop(0, "rgba(255,230,160,.95)"); gl.addColorStop(1, "rgba(255,230,160,0)"); g.fillStyle = gl; g.fillRect(14, 4, 40, 40); g.fillStyle = "#fff2c0"; g.beginPath(); g.arc(34, 22, 3.6, 0, TAU); g.fill();
    const tree = mkc(90, 130), t = tree.getContext("2d"); t.fillStyle = "#5a3d28"; t.fillRect(41, 62, 8, 68); for (const [x, y, r, c] of [[45, 40, 34, "#2d6a3a"], [28, 52, 22, "#33783f"], [62, 52, 22, "#2a6236"], [45, 30, 24, "#3b8a48"]]) { const q = t.createRadialGradient(x - 6, y - 8, 3, x, y, r); q.addColorStop(0, "#5fb065"); q.addColorStop(1, c); t.fillStyle = q; t.beginPath(); t.arc(x, y, r, 0, TAU); t.fill(); }
    return (PROPS = { lamp, tree });
  }

  /* ---------- game state ---------- */
  const SPEED0 = 13;
  let state = "ready", pos = 0, speed = SPEED0, lane = 1, px = 0, py = 0, vy = 0, slideT = 0, tilt = 0, runPh = 0, coinsGot = 0, hits = 0, hitT = 0, invul = 0, shakeT = 0, bustT = 0, stumbleT = 0;
  let walls = [[], []], objs = [], nextSpawn = 26, nextWall = [0, 0], propZ = 0, gap = 3, wallRng = 0, sparks = [], floaties = [], wallet = store.get("zr_wallet", 0), best = store.get("zr3d_best", 0), coinHud = 0, lastTheme = 0, themeBlend = 0, t0 = 0, paused = false;
  const themeAt = (z) => (((Math.floor(z / 700) % 4) + 4) % 4);

  function reset() {
    pos = 0; speed = SPEED0; lane = 1; px = 0; py = 0; vy = 0; slideT = 0; tilt = 0; coinsGot = 0; hits = 0; hitT = 0; invul = 0; bustT = 0; stumbleT = 0; gap = 3; camX = 0;
    walls = [[], []]; objs = []; sparks = []; floaties = []; nextSpawn = 28; nextWall = [-12, -12]; propZ = -6; coinHud = 0;
    fillWalls();
  }
  function fillWalls() {
    for (let s = 0; s < 2; s++) while (nextWall[s] < pos + 95) {
      const th = themeAt(nextWall[s]), defs = themeTex(th), tex = defs[(Math.random() * defs.length) | 0];
      const hh = tex.h * rnd(0.92, 1.12);
      walls[s].push({ z: nextWall[s], len: tex.len, h: hh, tex: tex.cv, th, x: 3.05 + rnd(0, 0.5) });
      nextWall[s] += tex.len + (Math.random() < 0.3 ? rnd(0.3, 1.2) : 0.02);
    }
    for (let s = 0; s < 2; s++) while (walls[s].length && walls[s][0].z + walls[s][0].len < pos - 6) walls[s].shift();
  }

  /* ---------- spawning (coins first, then the obstacles that guard them) ---------- */
  const LX = [-1, 0, 1];
  function coin(l, z, y, gem) { objs.push({ k: "coin", x: LX[l], z, y: y === undefined ? 0.6 : y, gem: !!gem, got: false, ph: Math.random() * 16 }); }
  function coinLine(l, z, n, step = 1.5, y) { for (let i = 0; i < n; i++) coin(l, z + i * step, y); }
  function low(l, z) { objs.push({ k: "low", x: LX[l], z, len: 0.5 }); }
  function gate(l, z) { objs.push({ k: "gate", x: LX[l], z, len: 0.5 }); }
  function train(l, z, len) { objs.push({ k: "train", x: LX[l], z, len, hue: (Math.random() * 3) | 0 }); }
  function spawn() {
    const z = nextSpawn, L = (Math.random() * 3) | 0, o1 = (L + 1 + ((Math.random() * 2) | 0)) % 3, o2 = 3 - L - o1, hard = clamp(pos / 2500, 0, 1);
    const r = Math.random(); let used = 14;
    if (r < 0.2) { coinLine(L, z, 8); used = 14; }
    else if (r < 0.4) { low(L, z + 4); for (let i = 0; i < 7; i++) coin(L, z + 1 + i * 1.1, 0.6 + Math.sin((i / 6) * Math.PI) * 1.2); used = 14; }
    else if (r < 0.55) { gate(L, z + 4); coinLine(L, z + 1, 7, 1.2); coinLine(o1, z, 5, 1.6); used = 12; }
    else if (r < 0.7) { train(L, z + 2, rnd(8, 13)); coinLine(o1, z + 1, 8); if (hard > 0.3 && Math.random() < 0.6) low(o2, z + 6); used = 18; }
    else if (r < 0.82) { low(L, z + 3); low(o1, z + 3); coinLine(o2, z, 8); used = 13; }
    else if (r < 0.92) { for (let i = 0; i < 9; i++) coin((i % 4 === 0 ? 0 : i % 4 === 1 ? 1 : i % 4 === 2 ? 2 : 1), z + i * 1.5); gate(L, z + 9); used = 15; }
    else { gate(0, z + 3); gate(1, z + 3); gate(2, z + 3); coinLine(1, z, 5, 1.2, 0.5); coin(1, z + 7, 0.6, true); used = 11; }
    if (Math.random() < 0.3) coin((Math.random() * 3) | 0, z + rnd(2, 9), 0.6, true);
    nextSpawn = z + used + speed * rnd(0.45, 0.8);
  }

  /* ---------- audio (tiny WebAudio blips) ---------- */
  let AC = null, muted = store.get("zr3d_mute", false);
  function tone(f, d, type, v, f2) {
    if (muted) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume();
      const o = AC.createOscillator(), g = AC.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, AC.currentTime); if (f2) o.frequency.exponentialRampToValueAtTime(f2, AC.currentTime + d);
      g.gain.setValueAtTime(v || 0.06, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d + 0.02); } catch (e) {}
  }
  const sfx = { coin() { tone(988, 0.07, "sine", 0.07); setTimeout(() => tone(1480, 0.1, "sine", 0.06), 55); }, jump() { tone(300, 0.16, "triangle", 0.07, 620); }, slide() { tone(260, 0.2, "sawtooth", 0.03, 120); }, hit() { tone(180, 0.28, "sawtooth", 0.09, 55); }, bust() { tone(120, 0.5, "square", 0.07, 40); }, move() { tone(500, 0.05, "sine", 0.03, 420); } };
  const vib = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

  /* ---------- input: swipe / keys ---------- */
  function moveLane(d) { if (state !== "play") return; const nl = clamp(lane + d, 0, 2); if (nl !== lane) { lane = nl; sfx.move(); } }
  function jump() { if (state !== "play") return; if (py < 0.05) { vy = 7.6; slideT = 0; sfx.jump(); } }
  function slide() { if (state !== "play") return; slideT = 0.7; if (py > 0.05) vy = Math.min(vy, -9); else sfx.slide(); }
  let pt = null;
  addEventListener("pointerdown", (e) => { if (e.target.closest(".ov") && !$("ov").classList.contains("hidden")) return; pt = { x: e.clientX, y: e.clientY, done: false }; if (AC && AC.state === "suspended") AC.resume(); });
  addEventListener("pointermove", (e) => {
    if (!pt || pt.done) return; const dx = e.clientX - pt.x, dy = e.clientY - pt.y, th = 22;
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { moveLane(dx > 0 ? 1 : -1); pt.done = true; }
    else if (Math.abs(dy) > th) { dy < 0 ? jump() : slide(); pt.done = true; }
  });
  addEventListener("pointerup", () => { pt = null; }); addEventListener("pointercancel", () => { pt = null; });
  addEventListener("keydown", (e) => {
    const k = e.key; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k)) e.preventDefault();
    if (state !== "play") { if ((k === "Enter" || k === " ") && !$("ov").classList.contains("hidden")) start(); return; }
    if (k === "ArrowLeft" || k === "a" || k === "A") moveLane(-1); else if (k === "ArrowRight" || k === "d" || k === "D") moveLane(1);
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump(); else if (k === "ArrowDown" || k === "s" || k === "S") slide();
    else if (k === "p" || k === "P") paused = !paused; else if (k === "m" || k === "M") { muted = !muted; store.set("zr3d_mute", muted); }
  });
  addEventListener("blur", () => { if (state === "play") paused = true; });
  addEventListener("visibilitychange", () => { if (document.hidden && state === "play") paused = true; });
  cv.addEventListener("click", () => { if (paused) paused = false; });
  addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- update ---------- */
  function hurt(o) {
    if (invul > 0) return;
    hits++; hitT = 7; invul = 1.3; shakeT = 0.4; sfx.hit(); vib(60); stumbleT = 0.5;
    for (let i = 0; i < 14; i++) sparks.push({ x: cx + (px - camX) * sOf(ZP), y: PY(0.9, ZP), vx: rnd(-160, 160), vy: rnd(-220, -20), l: 0.7, c: "#ffb36b" });
    if (hits >= 2) { endGame(true); return; }
    speed = Math.max(SPEED0, speed * 0.78); if (o && o.k !== "train") o.dead = true;
    floaters(T("stumble"), "#ff6b84");
  }
  function floaters(text, c) { floaties.push({ text, c, l: 1.3 }); }
  function update(dt) {
    if (state === "play") {
      speed = Math.min(31, speed + dt * 0.18); pos += speed * dt;
      runPh += dt * (2.0 + speed * 0.085);
      px += (LX[lane] - px) * Math.min(1, dt * 14); tilt = lerp(tilt, clamp((LX[lane] - px) * 0.7, -0.3, 0.3), Math.min(1, dt * 12));
      camX += (px * 0.62 - camX) * Math.min(1, dt * 6);
      vy -= 22 * dt; py += vy * dt; if (py <= 0) { py = 0; if (vy < 0) vy = 0; }
      if (slideT > 0) slideT -= dt;
      if (invul > 0) invul -= dt; if (hitT > 0) { hitT -= dt; if (hitT <= 0) hits = 0; }
      if (shakeT > 0) shakeT -= dt; if (stumbleT > 0) stumbleT -= dt;
      gap = lerp(gap, hits > 0 ? 1.6 : 3.2, Math.min(1, dt * 3));
      while (nextSpawn < pos + 70) spawn();
      fillWalls();
      // collisions + pick-ups
      const top = py + (slideT > 0 && py < 0.1 ? 0.8 : 1.75);
      for (const o of objs) {
        if (o.dead || o.got) continue;
        if (o.k === "coin") {
          if (Math.abs(o.z - pos) < 0.7 && Math.abs(o.x - px) < 0.55 && o.y > py - 0.35 && o.y < top + 0.1) {
            o.got = true; const v = o.gem ? 5 : 1; coinsGot += v; coinHud = 0.25; sfx.coin();
            const sx = cx + (o.x - camX) * sOf(ZP), sy = PY(o.y, ZP); for (let i = 0; i < 6; i++) sparks.push({ x: sx, y: sy, vx: rnd(-90, 90), vy: rnd(-130, 20), l: 0.5, c: "#ffe27a" });
          }
          continue;
        }
        const z1 = o.z + o.len;
        if (o.z < pos + 0.4 && z1 > pos - 0.3 && Math.abs(o.x - px) < 0.62) {
          if (o.k === "low" && py < 0.62) hurt(o);
          else if (o.k === "gate" && top > 1.05 && py < 1.4) hurt(o);
          else if (o.k === "train") hurt(o);
        }
      }
      objs = objs.filter((o) => !o.got && !o.dead && o.z + (o.len || 0) > pos - 6);
      if (Math.floor(pos / 700) !== lastTheme) { lastTheme = Math.floor(pos / 700); themeBlend = 1; }
    } else if (state === "over") {
      bustT += dt; px += (LX[lane] - px) * Math.min(1, dt * 10); gap = lerp(gap, 0.85, Math.min(1, dt * 5)); runPh += dt * 2; vy -= 22 * dt; py = Math.max(0, py + vy * dt);
    } else { runPh += dt * 2.6; camX *= 0.9; }
    if (themeBlend > 0) themeBlend = Math.max(0, themeBlend - dt * 0.5);
    if (coinHud > 0) coinHud -= dt;
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.l -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 420 * dt; if (s.l <= 0) sparks.splice(i, 1); }
    for (let i = floaties.length - 1; i >= 0; i--) { floaties[i].l -= dt; if (floaties[i].l <= 0) floaties.splice(i, 1); }
    if (state === "ready") { pos += SPEED0 * 0.5 * dt; fillWalls(); }
  }

  /* ---------- drawing ---------- */
  function ground(xl, xr, za, zb, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(PX(xl, za), PY(0, za)); ctx.lineTo(PX(xr, za), PY(0, za)); ctx.lineTo(PX(xr, zb), PY(0, zb)); ctx.lineTo(PX(xl, zb), PY(0, zb)); ctx.closePath(); ctx.fill();
  }
  function quad(a, b, c, d, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); }
  const P3 = (x, y, z) => [PX(x, z), PY(y, z)];
  function drawBox(xl, xr, y0, y1, za, zb, cols, detail) {            // za = front (near) face depth, zb = back
    za = Math.max(0.3, za); if (zb <= za) zb = za + 0.01;
    const f = [P3(xl, y1, za), P3(xr, y1, za), P3(xr, y0, za), P3(xl, y0, za)];
    if (camX > xr) quad(P3(xr, y1, za), P3(xr, y1, zb), P3(xr, y0, zb), P3(xr, y0, za), cols.side);
    else if (camX < xl) quad(P3(xl, y1, za), P3(xl, y1, zb), P3(xl, y0, zb), P3(xl, y0, za), cols.side);
    if (y1 < CH) quad(P3(xl, y1, za), P3(xr, y1, za), P3(xr, y1, zb), P3(xl, y1, zb), cols.top);
    quad(f[0], f[1], f[2], f[3], cols.front);
    if (detail) detail(f[0][0], f[0][1], f[1][0] - f[0][0], f[3][1] - f[0][1]);
  }
  function stripes(x, y, w, h, c1, c2, n) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = c1; ctx.fillRect(x, y, w, h); ctx.fillStyle = c2; const sw = w / n;
    for (let i = -2; i < n + 2; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * sw, y + h); ctx.lineTo(x + (i + 1) * sw, y + h); ctx.lineTo(x + (i + 1) * sw + h * 0.6, y); ctx.lineTo(x + i * sw + h * 0.6, y); ctx.fill(); } ctx.restore();
  }
  function drawObj(o) {
    const dz = o.z - pos + ZP, blink = Math.floor(performance.now() / 260) % 2;
    if (o.k === "low") {
      drawBox(o.x - 0.44, o.x + 0.44, 0, 0.72, dz, dz + 0.5, { front: "#1a1c26", top: "#ffd84f", side: "#b88a10" }, (x, y, w, h) => { stripes(x, y, w, h, "#ffcc1a", "#17171f", 7); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(x, y, w, h * 0.16); ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, w * 0.02); ctx.strokeRect(x, y, w, h); });
      const lx = PX(o.x, dz), ly = PY(0.82, dz), r = sOf(dz) * 0.07; ctx.fillStyle = blink ? "#ff3b3b" : "#701818"; ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
    } else if (o.k === "gate") {
      const s = sOf(dz); ctx.fillStyle = "#2b3040"; for (const dx of [-0.46, 0.38]) drawBox(o.x + dx, o.x + dx + 0.08, 0, 1.95, dz, dz + 0.3, { front: "#3a4156", top: "#5a6384", side: "#232838" });
      drawBox(o.x - 0.48, o.x + 0.48, 1.12, 1.55, dz, dz + 0.4, { front: "#222", top: "#ffd84f", side: "#b88a10" }, (x, y, w, h) => { stripes(x, y, w, h, "#ffcc1a", "#17171f", 8); ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, w * 0.02); ctx.strokeRect(x, y, w, h); });
      ctx.fillStyle = blink ? "#ff3b3b" : "#701818"; ctx.beginPath(); ctx.arc(PX(o.x - 0.42, dz), PY(1.62, dz), s * 0.06, 0, TAU); ctx.fill();
    } else if (o.k === "train") {
      const pal = [["#2a63c4", "#1b3f84", "#1e4aa0"], ["#c43a4a", "#7a1f2c", "#9a2a38"], ["#2fa08a", "#1b6455", "#228072"]][o.hue];
      drawBox(o.x - 0.46, o.x + 0.46, 0.15, 2.25, dz, dz + o.len, { front: pal[0], top: "#d8dde8", side: pal[2] }, (x, y, w, h) => {
        ctx.fillStyle = "#0f1626"; ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.36); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.08);
        ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(x + w * 0.2, y + h * 0.72, w * 0.07, 0, TAU); ctx.arc(x + w * 0.8, y + h * 0.72, w * 0.07, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffd84f"; ctx.fillRect(x + w * 0.1, y + h * 0.56, w * 0.8, h * 0.06); ctx.fillStyle = pal[1]; ctx.fillRect(x, y + h * 0.88, w, h * 0.12);
      });
    }
  }
  function drawSprite(sh, frame, x, z, y, tiltR, alpha) {
    const s = sOf(z), u = sh.unit * s, gx = PX(x, z), gy = PY(y, z);
    ctx.save(); ctx.translate(gx, gy); if (tiltR) ctx.rotate(tiltR); if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(sh.f[frame], -sh.fx * u, -sh.fy * u, sh.w * u, sh.h * u); ctx.restore();
  }
  function shadow(x, z, w, a) { const s = sOf(z); ctx.fillStyle = "rgba(0,0,0," + a + ")"; ctx.beginPath(); ctx.ellipse(PX(x, z), PY(0, z) + 1, w * s, w * s * 0.28, 0, 0, TAU); ctx.fill(); }

  function drawWorld() {
    const th = themeAt(pos), th2 = (th + 1) % 4, k = Math.round(W) + "x" + Math.round(H);
    // sky (cross-fades when the city changes)
    ctx.drawImage(skyFor(th), 0, 0, W, yH + 4);
    if (themeBlend > 0) { ctx.globalAlpha = themeBlend; ctx.drawImage(skyFor((th + 3) % 4), 0, 0, W, yH + 4); ctx.globalAlpha = 1; }
    const T0 = THEMES[th];
    // ground base
    ctx.fillStyle = T0.walk; ctx.fillRect(0, yH, W, H - yH);
    // road + stripes
    const far = 90; ground(-1.55, 1.55, 0.3, far, T0.road);
    const BL = 2, z0 = pos - ZP; ctx.fillStyle = T0.road2;
    for (let b = Math.floor(z0 / BL) * BL; b < z0 + far; b += BL * 2) { const za = Math.max(0.3, b - z0), zb = b + BL - z0; if (zb > 0.3) { ctx.beginPath(); ctx.moveTo(PX(-1.55, za), PY(0, za)); ctx.lineTo(PX(1.55, za), PY(0, za)); ctx.lineTo(PX(1.55, zb), PY(0, zb)); ctx.lineTo(PX(-1.55, zb), PY(0, zb)); ctx.fill(); } }
    // sidewalks with alternating slabs + curb
    for (const sd of [-1, 1]) {
      const xa = sd * 1.55, xb = sd * 3.1; ground(Math.min(xa, xb), Math.max(xa, xb), 0.3, far, T0.walk); ctx.fillStyle = T0.walk2;
      for (let b = Math.floor(z0 / 3) * 3; b < z0 + far; b += 6) { const za = Math.max(0.3, b - z0), zb = b + 3 - z0; if (zb > 0.3) { ctx.beginPath(); ctx.moveTo(PX(xa, za), PY(0, za)); ctx.lineTo(PX(xb, za), PY(0, za)); ctx.lineTo(PX(xb, zb), PY(0, zb)); ctx.lineTo(PX(xa, zb), PY(0, zb)); ctx.fill(); } }
      ground(Math.min(sd * 1.55, sd * 1.66), Math.max(sd * 1.55, sd * 1.66), 0.3, far, "#d9d2c0");
    }
    // lane marks (dashes) and edge lines
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const lx of [-0.5, 0.5]) for (let b = Math.floor(z0 / 3) * 3; b < z0 + 60; b += 3) { const za = Math.max(0.3, b - z0), zb = b + 1.2 - z0; if (zb > 0.3) { ctx.beginPath(); ctx.moveTo(PX(lx - 0.03, za), PY(0, za)); ctx.lineTo(PX(lx + 0.03, za), PY(0, za)); ctx.lineTo(PX(lx + 0.03, zb), PY(0, zb)); ctx.lineTo(PX(lx - 0.03, zb), PY(0, zb)); ctx.fill(); } }
    ground(-1.52, -1.46, 0.3, far, "#ffd84f"); ground(1.46, 1.52, 0.3, far, "#ffd84f");
    // building walls, far → near, with perspective strips
    const N = qual >= 2 ? 4 : qual === 1 ? 6 : 9;
    for (let s = 0; s < 2; s++) {
      const arr = walls[s], sd = s ? 1 : -1;
      for (let i = arr.length - 1; i >= 0; i--) {
        const w = arr[i], zA = w.z - z0, zB = zA + w.len; if (zB < 0.35 || zA > 88) continue;
        const x = sd * w.x, tw = w.tex.width, th2h = w.tex.height;
        for (let j = 0; j < N; j++) {
          let za = zA + (w.len * j) / N, zb = zA + (w.len * (j + 1)) / N; if (zb < 0.35) continue;
          let u0 = j / N, u1 = (j + 1) / N; if (za < 0.35) { u0 += ((0.35 - za) / (zb - za)) * (u1 - u0); za = 0.35; }
          const sa = sOf(za), sb = sOf(zb), xa = cx + (x - camX) * sa, xb = cx + (x - camX) * sb, sm = (sa + sb) / 2;
          const top = yH + (CH - w.h) * sm, bot = yH + CH * sm, lx = Math.min(xa, xb), ww = Math.abs(xb - xa) + 0.8;
          ctx.drawImage(w.tex, u0 * tw, 0, (u1 - u0) * tw, th2h, lx, top, ww, bot - top);
        }
        if (zA < 60) { ctx.fillStyle = "rgba(0,0,0,.18)"; const sa = sOf(Math.max(0.35, zA)); const xa = cx + (x - camX) * sa; ctx.fillRect(xa - (sd > 0 ? 0 : 1.5), yH + (CH - w.h) * sa, 1.5, (w.h) * sa); }
      }
    }
    // lamp posts + trees on the sidewalk
    const PR = props();
    for (let b = Math.floor(z0 / 7) * 7 + 70; b > z0 - 1; b -= 7) {
      const dz = b - z0; if (dz < 0.5) continue; const s = sOf(dz), idx = Math.round(b / 7);
      for (const sd of [-1, 1]) {
        const x = sd * 2.35, im = (idx + (sd > 0 ? 1 : 0)) % 2 ? PR.lamp : PR.tree, wpx = (im === PR.lamp ? 1.1 : 2.2) * s, hpx = (im === PR.lamp ? 3.4 : 3.2) * s;
        ctx.drawImage(im, PX(x, dz) - wpx / 2 * (im === PR.lamp ? 0.5 : 1), PY(0, dz) - hpx, wpx, hpx);
      }
    }
    // fog toward the horizon
    const fg = ctx.createLinearGradient(0, yH - H * 0.1, 0, yH + H * 0.2); fg.addColorStop(0, T0.fog + "00"); fg.addColorStop(0.45, T0.fog + "88"); fg.addColorStop(1, T0.fog + "00"); ctx.fillStyle = fg; ctx.fillRect(0, yH - H * 0.1, W, H * 0.3);
  }

  function drawActors() {
    const list = [];
    for (const o of objs) { const dz = o.z - pos + ZP; if (dz > 0.35 && dz < 80) list.push({ dz, o }); else if (o.k === "train" && dz + o.len > 0.4 && dz <= 0.35) list.push({ dz: 0.36, o }); }
    list.sort((a, b) => b.dz - a.dz);
    const CN = coinS(), ph = performance.now() / 55;
    let drewPlayer = false;
    const drawHero = () => {
      drewPlayer = true;
      const H0 = hero(), over = state === "over";
      let fr = Math.floor(runPh * 12) % 12; if (over || stumbleT > 0.25) fr = H0.hit; else if (py > 0.08) fr = H0.jump; else if (slideT > 0) fr = H0.slide;
      shadow(px, ZP, 0.42 - Math.min(0.2, py * 0.08), 0.35);
      if (invul > 0 && !over && Math.floor(performance.now() / 70) % 2) ctx.globalAlpha = 0.45;
      drawSprite(H0, fr, px, ZP, py, tilt, undefined); ctx.globalAlpha = 1;
    };
    for (const it of list) {
      if (!drewPlayer && it.dz < ZP) drawHero();
      const o = it.o;
      if (o.k === "coin") {
        const s = sOf(it.dz), size = (o.gem ? 0.62 : 0.5) * s, fr = Math.floor(ph * 0.5 + o.ph) % 16, sh = o.gem ? CN.g : CN.n;
        const gx = PX(o.x, it.dz), gy = PY(o.y, it.dz);
        if (qual < 2) { ctx.globalAlpha = 0.5; ctx.drawImage(glowSpr(), gx - size, gy - size, size * 2, size * 2); ctx.globalAlpha = 1; }
        ctx.drawImage(sh[fr], gx - size / 2, gy - size / 2, size, size);
      } else drawObj(o);
    }
    if (!drewPlayer) drawHero();
    // the chasers close behind (only after a hit, or when you are caught)
    const zc = ZP - gap;
    if (zc > 0.35 && gap < 3.1) {
      const GS = guardS(), DS = dogS(), fr = Math.floor(runPh * 12 + 3) % 12, cxp = px * 0.7;
      shadow(cxp, zc, 0.5, 0.35); drawSprite(GS, fr, cxp, zc, 0, 0);
      shadow(cxp - 0.95, zc - 0.1, 0.4, 0.3); drawSprite(DS, (fr + 5) % 12, cxp - 0.95, zc - 0.1, 0, 0);
    }
  }
  let GL = null; function glowSpr() { if (GL) return GL; GL = mkc(64, 64); const g = GL.getContext("2d"), q = g.createRadialGradient(32, 32, 2, 32, 32, 32); q.addColorStop(0, "rgba(255,226,120,.85)"); q.addColorStop(0.4, "rgba(255,200,60,.25)"); q.addColorStop(1, "rgba(255,200,60,0)"); g.fillStyle = q; g.fillRect(0, 0, 64, 64); return GL; }

  function drawHUD() {
    const u = UI, m = 16 * u, fnt = (w, sz) => `${w} ${Math.round(sz * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.textBaseline = "middle";
    // distance
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.font = fnt(800, 26); ctx.fillText(Math.floor(pos) + " " + T("m"), m + 1.5, m + 18 * u + 2); ctx.fillStyle = "#fff"; ctx.fillText(Math.floor(pos) + " " + T("m"), m, m + 18 * u);
    ctx.font = fnt(600, 9); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText(T("best") + " " + Math.max(best, Math.floor(pos)), m, m + 40 * u);
    // coins (spinning coin icon + counter)
    const CN = coinS(), ic = 26 * u * (1 + Math.max(0, coinHud) * 1.2), fr = Math.floor(performance.now() / 70) % 16;
    ctx.textAlign = "right"; ctx.font = fnt(800, 24); const txt = String(coinsGot), tw = ctx.measureText(txt).width;
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillText(txt, W - m + 1.5, m + 18 * u + 2); ctx.fillStyle = "#ffe27a"; ctx.fillText(txt, W - m, m + 18 * u);
    ctx.drawImage(CN.n[fr], W - m - tw - ic - 4 * u, m + 18 * u - ic / 2, ic, ic);
    // police / health pips
    const pipY = m + 62 * u; ctx.textAlign = "left";
    for (let i = 0; i < 2; i++) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(m + i * 30 * u, pipY, 26 * u, 7 * u, 3 * u); ctx.fill(); if (i < 2 - hits) { ctx.fillStyle = hits ? "#ff6b84" : "#46e08c"; ctx.beginPath(); ctx.roundRect(m + i * 30 * u + 1, pipY + 1, 26 * u - 2, 7 * u - 2, 2 * u); ctx.fill(); } }
    for (const f of floaties) { ctx.globalAlpha = Math.min(1, f.l * 1.5); ctx.textAlign = "center"; ctx.font = fnt(800, 20); ctx.fillStyle = f.c; ctx.fillText(f.text, W / 2, H * 0.28 - (1.3 - f.l) * 20 * u); ctx.globalAlpha = 1; }
    if (paused) { ctx.fillStyle = "rgba(6,8,20,.6)"; ctx.fillRect(0, 0, W, H); ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = fnt(800, 32); ctx.fillText(T("paused"), W / 2, H / 2); }
  }

  function render() {
    ctx.save();
    if (shakeT > 0) ctx.translate(rnd(-5, 5) * shakeT, rnd(-5, 5) * shakeT);
    drawWorld(); drawActors();
    for (const s of sparks) { ctx.globalAlpha = Math.max(0, s.l * 2); ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 3 * UI, 3 * UI); } ctx.globalAlpha = 1;
    ctx.restore();
    // cinematic layer: grade + vignette, speed lines
    if (qual < 3) ctx.drawImage(vignette(), 0, 0, W, H);
    if (state === "play" && speed > 18 && qual < 2) {
      const k = clamp((speed - 18) / 13, 0, 1); ctx.strokeStyle = "rgba(255,246,230," + (0.07 + 0.12 * k) + ")"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3 + Math.floor(runPh * 8) * 0.9 * (i % 2 ? 1 : -1) * 0.01, r0 = Math.hypot(W, H) * (0.3 + ((i * 0.37 + runPh * 1.7) % 1) * 0.3), r1 = r0 + 40 * UI * (1 + k); ctx.moveTo(cx + Math.cos(a) * r0, yH + Math.sin(a) * r0 * 0.9); ctx.lineTo(cx + Math.cos(a) * r1, yH + Math.sin(a) * r1 * 0.9); }
      ctx.stroke();
    }
    if (state === "over" && bustT > 0) {
      const k = Math.min(1, bustT / 0.3), bar = H * 0.1 * k; ctx.fillStyle = "rgba(8,10,26," + 0.34 * k + ")"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      if (bustT > 0.35 && $("ov").classList.contains("hidden")) {
        const e = Math.min(1, (bustT - 0.35) / 0.25), sc = 1 + (1 - e) * 0.7; ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.scale(sc, sc); ctx.globalAlpha = e; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `800 ${Math.round(Math.min(56 * UI, (W * 0.84) / Math.max(5, T("busted").length * 0.8)))}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.lineJoin = "round"; ctx.lineWidth = 6 * UI; ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.strokeText(T("busted"), 2, 3); ctx.fillStyle = "#f1f2f7"; ctx.fillText(T("busted"), 0, 0);
        ctx.font = `600 ${Math.round(11 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`; ctx.fillStyle = "#ff6b84"; ctx.fillText(T("caught"), 0, 34 * UI); ctx.restore();
      }
    }
    if (state !== "ready") drawHUD();
  }

  /* ---------- flow ---------- */
  function showOv(title, sub, row, btn) {
    $("oTitle").textContent = title; $("oSub").innerHTML = sub; $("oRow").innerHTML = row; $("go").textContent = btn; $("back").textContent = T("back"); $("ov").classList.remove("hidden");
  }
  function menu() {
    showOv(T("title"), T("sub"), `<div class="pill"><small>${T("best")}</small>${best} ${T("m")}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>${wallet}</div>`, T("play"));
  }
  function start() {
    if (AC && AC.state === "suspended") AC.resume(); try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    reset(); state = "play"; paused = false; $("ov").classList.add("hidden"); lastT = 0;
  }
  function endGame(caught) {
    if (state !== "play") return; state = "over"; bustT = 0; sfx.bust(); vib([80, 40, 120]); shakeT = 0.5; vy = 3;
    const d = Math.floor(pos), nb = d > best; if (nb) { best = d; store.set("zr3d_best", best); }
    wallet += coinsGot; store.set("zr_wallet", wallet);
    setTimeout(() => { if (state === "over") showOv(T("busted"), T("caught") + (nb ? "<br><b style='color:#ffd84f'>" + T("newbest") + "</b>" : ""), `<div class="pill"><small>${T("score")}</small>${d} ${T("m")}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>+${coinsGot}</div><div class="pill"><small>${T("best")}</small>${best} ${T("m")}</div>`, T("again")); }, 1500);
  }
  $("go").addEventListener("click", start);

  let lastT = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastT) { lastT = ts; return; }
    let dt = (ts - lastT) / 1000; lastT = ts; if (dt > 0.1) dt = 0.1;
    const ms = dt * 1000; avgDt = avgDt * 0.93 + ms * 0.07;
    if (state === "play" && !paused && ms > 24) slowN++; else if (slowN > 0) slowN -= 0.2;
    if (slowN > 30 && (qual < 3)) { qual++; slowN = 0; if (qual >= 2) { budgetK = Math.max(0.55, budgetK * 0.8); resize(); } }
    if (!paused) update(dt);
    render();
  }
  addEventListener("resize", resize); addEventListener("orientationchange", () => setTimeout(resize, 200));
  resize(); reset(); lastT = 0; menu();
  window.ZR3D = { step: (dt) => { update(dt); }, render, get state() { return state; }, get pos() { return pos; }, start, setQual: (q) => { qual = q; }, hurt, objs: () => objs, set lane(v) { lane = v; }, get coins() { return coinsGot; } };
  requestAnimationFrame(frame);
})();
