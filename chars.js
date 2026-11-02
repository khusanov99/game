/* =====================================================
   CHARS — pre-rendered, skeleton-animated sprites:
   the runner (with Uzbek doppi + ikat scarf), the guard,
   the chasing Alabay dog, coins, badges, hearts, obstacles.
   Everything is drawn ONCE into small canvases; the game
   only calls drawImage per frame (cheap on phones).
===================================================== */
const Chars = (() => {
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const lg = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shade(hex, k) {                       // k<0 darker, k>0 lighter
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = (v) => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
    return "#" + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  const pt = (x, y, ang, len) => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];   // ang from straight-down, + = forward
  function cap(c, x1, y1, x2, y2, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function tube(c, x1, y1, x2, y2, w, col) {      // limb with a soft highlight so it reads as a volume
    cap(c, x1, y1, x2, y2, w, shade(col, -0.28)); cap(c, x1 - 0.5, y1 - 0.6, x2 - 0.5, y2 - 0.6, w * 0.62, col);
  }

  /* ---------- styles ---------- */
  const SKINS = {
    default: { jacket: "#1fa9ff", trim: "#ff4fd8", pants: "#1b2150", shoe: "#f4f6ff", sole: "#53f7ff", pack: "#ff4fd8" },
    rose: { jacket: "#ff4fa8", trim: "#ffd84f", pants: "#2a1636", shoe: "#fff0f6", sole: "#ff8a5c", pack: "#ffd84f" },
    mint: { jacket: "#2fd9a0", trim: "#53f7ff", pants: "#12302e", shoe: "#eafff7", sole: "#a78bfa", pack: "#53f7ff" },
    gold: { jacket: "#ffc23a", trim: "#7a3a0a", pants: "#2a1a08", shoe: "#fff6dc", sole: "#ff7a59", pack: "#7a3a0a" },
  };
  const GUARD = { jacket: "#2f4bb0", trim: "#ffd84f", pants: "#161c44", shoe: "#0d0f1a", sole: "#444", pack: null };
  const SKIN_TONE = "#e8b48a";

  /* ---------- humanoid rig (feet at origin, facing right) ---------- */
  function human(c, P, S, guard) {
    const hipX = 0, hipY = -24 + (P.hip || 0), lean = P.lean || 0;
    const neckX = hipX + Math.sin(lean) * 17, neckY = hipY - Math.cos(lean) * 17;
    const headX = neckX + Math.sin(lean) * 6 + (P.headDx || 0), headY = neckY - Math.cos(lean) * 6.5 - 1.5;
    const leg = (th, k, near) => {
      const [kx, ky] = pt(hipX, hipY, th, 12), [ax, ay] = pt(kx, ky, th - k, 12);
      const dark = near ? S.pants : shade(S.pants, -0.3);
      tube(c, hipX, hipY, kx, ky, 6.2, dark); tube(c, kx, ky, ax, ay, 5.2, dark);
      const fa = th - k + 1.45;                    // foot direction
      const [fx, fy] = pt(ax, ay, fa, 6.2);
      cap(c, ax, ay, fx, fy, 5, near ? S.shoe : shade(S.shoe, -0.25));
      cap(c, ax - 0.3, ay + 2.1, fx, fy + 2.1, 1.6, S.sole);
    };
    const arm = (a, e, near) => {
      const sx = neckX - Math.sin(lean) * 2.5, sy = neckY + Math.cos(lean) * 3;
      const [ex, ey] = pt(sx, sy, a, 8.5), [wx, wy] = pt(ex, ey, a + e, 8);
      const sleeve = near ? S.jacket : shade(S.jacket, -0.3);
      tube(c, sx, sy, ex, ey, 5, sleeve); tube(c, ex, ey, wx, wy, 4.2, near ? S.jacket : shade(S.jacket, -0.3));
      c.fillStyle = SKIN_TONE; c.beginPath(); c.arc(wx, wy, 2.5, 0, TAU); c.fill();
      if (guard && near && P.baton) { cap(c, wx, wy, wx + 8, wy - 7, 2.6, "#121212"); }
    };
    // far limbs
    arm(P.aB, P.eB, false); leg(P.tB, P.kB, false);
    // backpack
    if (S.pack) { c.fillStyle = S.pack; c.beginPath(); c.roundRect(hipX - 11 + Math.sin(lean) * 4, neckY + 1, 7, 12, 3); c.fill(); c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(hipX - 9.5 + Math.sin(lean) * 4, neckY + 6, 4, 1.4); }
    // scarf (ikat) streaming back
    if (!guard) {
      const w = P.scarf || 0, sx = neckX, sy = neckY + 1.5;
      for (const [off, col, wd] of [[0, "#ff3b5c", 4.6], [-0.9, "#ffd84f", 1.4]]) {
        c.strokeStyle = col; c.lineWidth = wd; c.lineCap = "round"; c.beginPath(); c.moveTo(sx, sy + off);
        c.bezierCurveTo(sx - 7, sy + off + Math.sin(w) * 3 + (P.sy || 0), sx - 13, sy + off + Math.sin(w + 1.3) * 3 + (P.sy || 0) * 1.5, sx - 20, sy + off + Math.sin(w + 2.4) * 4 + (P.sy || 0) * 2);
        c.stroke();
      }
    }
    // torso (jacket) with hip band
    cap(c, hipX, hipY + 1, hipX, hipY - 2, 10.5, S.pants);
    const tw = 12.6;
    c.strokeStyle = shade(S.jacket, -0.3); c.lineWidth = tw; c.lineCap = "round"; c.beginPath(); c.moveTo(hipX, hipY - 3); c.lineTo(neckX, neckY + 1); c.stroke();
    c.strokeStyle = lg(c, hipX - 7, 0, hipX + 7, 0, [[0, shade(S.jacket, 0.18)], [1, S.jacket]]); c.lineWidth = tw - 2.2; c.beginPath(); c.moveTo(hipX - 0.4, hipY - 3); c.lineTo(neckX - 0.4, neckY + 1); c.stroke();
    // ikat chest band
    c.save(); c.translate((hipX + neckX) / 2 + 0.5, (hipY + neckY) / 2 + 1); c.rotate(lean);
    c.fillStyle = S.trim; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, -2.2); c.lineTo(i * 4 + 2, 0); c.lineTo(i * 4, 2.2); c.lineTo(i * 4 - 2, 0); c.closePath(); c.fill(); }
    c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(-6.2, 3.4, 12.4, 1.1);
    if (guard) { c.fillStyle = "#ffd84f"; c.fillRect(2.5, -6, 3, 3); }
    c.restore();
    // near leg
    leg(P.tA, P.kA, true);
    // head
    c.fillStyle = shade(SKIN_TONE, -0.18); c.beginPath(); c.arc(headX - 0.4, headY + 0.4, 7.4, 0, TAU); c.fill();
    c.fillStyle = lg(c, headX - 6, headY - 7, headX + 6, headY + 7, [[0, shade(SKIN_TONE, 0.15)], [1, SKIN_TONE]]); c.beginPath(); c.arc(headX, headY, 7.2, 0, TAU); c.fill();
    c.fillStyle = "#14162a"; c.beginPath(); c.arc(headX - 3.4, headY - 1.4, 5.2, Math.PI * 0.55, Math.PI * 1.85); c.fill();          // hair
    // eye + brow + mouth
    const ex = headX + 3, ey = headY - 0.8 + (P.eyeY || 0);
    c.fillStyle = "#fff"; c.beginPath(); c.ellipse(ex, ey, 2.3, P.blink ? 0.5 : 2.1, 0, 0, TAU); c.fill();
    if (!P.blink) { c.fillStyle = guard ? "#ff3b3b" : "#101433"; c.beginPath(); c.arc(ex + 0.7, ey + 0.2, 1.15, 0, TAU); c.fill(); }
    c.strokeStyle = "#14162a"; c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath();
    c.moveTo(ex - 2.4, ey - 3 + (P.brow || 0)); c.lineTo(ex + 2.3, ey - 3.4 - (P.brow || 0) * 0.6); c.stroke();
    c.beginPath(); c.fillStyle = "#7a2230";
    if (P.mouth) { c.ellipse(headX + 3.6, headY + 3.6, 1.7, 1.2 + P.mouth * 1.3, 0, 0, TAU); c.fill(); }
    else { c.strokeStyle = "#7a2230"; c.lineWidth = 1.1; c.moveTo(headX + 2.4, headY + 3.5); c.quadraticCurveTo(headX + 3.8, headY + 4.4, headX + 5, headY + 3.4); c.stroke(); }
    c.fillStyle = shade(SKIN_TONE, -0.08); c.beginPath(); c.arc(headX + 7, headY + 0.8, 1.5, 0, TAU); c.fill();                          // nose
    // headwear
    if (!guard) {                                                                                                                    // doppi
      c.fillStyle = "#0e1124"; c.beginPath(); c.moveTo(headX - 7.3, headY - 2.4); c.lineTo(headX - 5, headY - 9.6); c.lineTo(headX + 5, headY - 9.6); c.lineTo(headX + 7.3, headY - 2.4); c.closePath(); c.fill();
      c.fillStyle = "#f4f1e6"; c.fillRect(headX - 7, headY - 4.2, 14, 1.6);
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(headX + i * 3.6, headY - 8.6); c.lineTo(headX + i * 3.6 + 1.4, headY - 7); c.lineTo(headX + i * 3.6, headY - 5.6); c.lineTo(headX + i * 3.6 - 1.4, headY - 7); c.closePath(); c.fill(); }
    } else {                                                                                                                          // peaked cap
      c.fillStyle = "#1a2250"; c.beginPath(); c.roundRect(headX - 7.6, headY - 10, 15.4, 7.2, 3); c.fill();
      c.fillStyle = "#0e1230"; c.fillRect(headX - 1, headY - 3.4, 11, 1.8);
      c.fillStyle = "#ffd84f"; c.beginPath(); c.arc(headX + 1, headY - 6.4, 1.7, 0, TAU); c.fill();
    }
    // near arm on top
    arm(P.aA, P.eA, true);
  }

  /* ---------- poses ---------- */
  function runPose(i, n, o = {}) {
    const f = (i / n) * TAU, A = (ph) => 0.92 * Math.sin(ph), K = (ph) => 0.3 + 0.95 * Math.max(0, Math.cos(ph));
    return Object.assign({
      lean: 0.2, hip: -Math.abs(Math.cos(f)) * 1.6,
      tA: A(f), kA: K(f), tB: A(f + Math.PI), kB: K(f + Math.PI),
      aA: -0.85 * Math.sin(f), eA: 1.15, aB: 0.85 * Math.sin(f), eB: 1.15,
      scarf: f * 1.0, sy: -1, blink: false,
    }, o);
  }
  const POSES = {
    jump: { lean: 0.12, hip: -2, tA: 0.8, kA: 1.15, tB: -0.55, kB: 0.5, aA: 2.5, eA: 0.3, aB: -0.9, eB: 0.9, scarf: 1.2, sy: -3, mouth: 0.6 },
    fall: { lean: 0.05, hip: -1, tA: 0.35, kA: 0.25, tB: -0.25, kB: 0.35, aA: 1.35, eA: 0.2, aB: -1.3, eB: 0.2, scarf: 2.2, sy: 3, mouth: 0.3 },
    land: { lean: 0.55, hip: 7, tA: 1.05, kA: 1.9, tB: 0.6, kB: 1.7, aA: 1.1, eA: 0.9, aB: 0.6, eB: 1.1, scarf: 0.5, sy: 0 },
    duck: { lean: 1.15, hip: 12, headDx: 1, tA: 1.35, kA: 0.1, tB: 0.25, kB: 1.9, aA: -0.9, eA: 0.6, aB: -1.3, eB: 0.5, scarf: 0.3, sy: 2, brow: 0.6 },
    hit: { lean: -0.32, hip: 0, tA: 0.55, kA: 0.3, tB: -0.6, kB: 0.6, aA: 2.7, eA: -0.3, aB: -2.4, eB: 0.4, scarf: 2.6, sy: 4, mouth: 1, eyeY: 0.6, brow: -0.8 },
  };

  /* ---------- dog (Alabay shepherd, gallop) ---------- */
  function leg2(c, x, y, a1, l1, a2, l2, w, col, paw) {
    const [kx, ky] = pt(x, y, a1, l1), [ax, ay] = pt(kx, ky, a2, l2);
    tube(c, x, y, kx, ky, w, col); tube(c, kx, ky, ax, ay, w * 0.82, col);
    c.fillStyle = paw; c.beginPath(); c.ellipse(ax + 1.2, ay + 0.6, 3.2, 1.9, 0, 0, TAU); c.fill();
  }
  function dog(c, ph, snarl) {
    const COAT = "#c89a58", SAD = "#7d5630", BELLY = "#e8cf9d", MUZ = "#3b2a1c", PAW = "#3b2a1c";
    const stretch = Math.sin(ph) * 2.2, bob = -Math.abs(Math.sin(ph)) * 2.4;
    const rx = -13 - stretch * 0.5, ry = -19 + bob, cx = 8 + stretch * 0.5, cy = -19.5 + bob;
    // far legs
    leg2(c, cx - 1, cy + 4, 0.95 * Math.sin(ph + 0.5) + 0.25, 9, -0.9 * Math.sin(ph + 0.5) - 0.2, 9, 4.2, shade(COAT, -0.32), PAW);
    leg2(c, rx + 2, ry + 4, -0.9 * Math.sin(ph + 0.6) + 0.1, 9, 1.0 * Math.sin(ph + 0.6) + 0.5, 9, 4.6, shade(COAT, -0.32), PAW);
    // tail (wagging up)
    c.strokeStyle = COAT; c.lineWidth = 3.6; c.lineCap = "round"; c.beginPath(); c.moveTo(rx - 4, ry - 2); c.quadraticCurveTo(rx - 12, ry - 8 + Math.sin(ph * 2) * 2, rx - 11, ry - 16); c.stroke();
    // body: belly, back, saddle
    cap(c, rx, ry + 1.5, cx, cy + 1.5, 13, shade(COAT, -0.22)); cap(c, rx, ry, cx, cy, 12.5, COAT); cap(c, rx + 2, ry + 4, cx - 2, cy + 4, 5, BELLY); cap(c, rx + 2, ry - 3.4, cx - 2, cy - 3.4, 6, SAD);
    // neck + head
    cap(c, cx, cy - 1, 17.5, -27 + bob, 10, COAT);
    const hx = 22, hy = -28 + bob;
    c.fillStyle = COAT; c.beginPath(); c.arc(hx, hy, 6.4, 0, TAU); c.fill();
    cap(c, hx + 2, hy + 1.5, hx + 10, hy + 2.2, 6, MUZ);                                         // upper muzzle
    const jaw = snarl * 5.2; cap(c, hx + 1.5, hy + 4.2, hx + 9, hy + 4.4 + jaw, 3.2, shade(MUZ, 0.1));   // lower jaw
    c.fillStyle = "#fff"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hx + 5 + i * 2.2, hy + 4); c.lineTo(hx + 6 + i * 2.2, hy + 4 + 1.5 + snarl * 1.5); c.lineTo(hx + 7 + i * 2.2, hy + 4); c.fill(); }
    if (snarl > 0.3) { c.fillStyle = "#c9334a"; c.beginPath(); c.ellipse(hx + 7, hy + 4.6 + jaw * 0.4, 3.4, 1 + snarl, 0, 0, TAU); c.fill(); }
    c.fillStyle = "#0e0a08"; c.beginPath(); c.arc(hx + 11.2, hy + 1.2, 2.1, 0, TAU); c.fill();         // nose
    // ears (pinned back when snarling)
    c.fillStyle = SAD; c.beginPath(); c.moveTo(hx - 3, hy - 4); c.lineTo(hx - 9 - snarl * 2, hy - 8 + snarl * 4); c.lineTo(hx - 1, hy - 8 + snarl * 1.5); c.closePath(); c.fill();
    // eye (angry)
    c.fillStyle = "#fff7b0"; c.beginPath(); c.arc(hx + 3, hy - 1.6, 1.7, 0, TAU); c.fill(); c.fillStyle = "#c01c1c"; c.beginPath(); c.arc(hx + 3.5, hy - 1.5, 1, 0, TAU); c.fill();
    c.strokeStyle = "#241810"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx + 0.6, hy - 4.5 + snarl); c.lineTo(hx + 5.2, hy - 2.8); c.stroke();
    // spiked collar
    c.strokeStyle = "#d6233c"; c.lineWidth = 3; c.beginPath(); c.arc(16.2, -22.5 + bob, 5.2, -1.2, 1.4); c.stroke();
    c.fillStyle = "#e8edf8"; for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.8, px = 16.2 + Math.cos(a) * 5.4, py = -22.5 + bob + Math.sin(a) * 5.4; c.beginPath(); c.moveTo(px - 1, py); c.lineTo(px + 0.8, py - 2.4); c.lineTo(px + 1.4, py + 0.2); c.fill(); }
    // near legs
    leg2(c, cx - 1, cy + 4, 0.95 * Math.sin(ph) + 0.25, 9, -0.9 * Math.sin(ph) - 0.2, 9, 4.4, COAT, PAW);
    leg2(c, rx + 2, ry + 4, -0.9 * Math.sin(ph + 0.1) + 0.1, 9, 1.0 * Math.sin(ph + 0.1) + 0.5, 9, 4.8, COAT, PAW);
  }

  /* ---------- sprite sheets ---------- */
  const cache = {};
  function sheet(key, w, h, fx, fy, sc, frames) {          // frames: array of fn(c)
    const out = { w, h, fx, fy, f: frames.map((fn) => { const cv = mk(w * sc, h * sc), c = cv.getContext("2d"); c.scale(sc, sc); c.translate(fx, fy); fn(c); return cv; }) };
    cache[key] = out; return out;
  }
  function runner(skin, sc) {
    const key = "r:" + skin + ":" + sc; if (cache[key]) return cache[key];
    const S = SKINS[skin] || SKINS.default, W = 64, H = 66, fx = 30, fy = 62;
    const run = Array.from({ length: 8 }, (_, i) => (c) => human(c, runPose(i, 8, { blink: i === 5 }), S, false));
    const poses = ["jump", "fall", "land", "duck", "hit"].map((n) => (c) => human(c, Object.assign({ scarf: 1 }, POSES[n]), S, false));
    return sheet(key, W, H, fx, fy, sc, run.concat(poses));
  }
  function guard(sc) {
    const key = "g:" + sc; if (cache[key]) return cache[key];
    const run = Array.from({ length: 8 }, (_, i) => (c) => human(c, runPose(i, 8, { lean: 0.28, mouth: 0.7, brow: 0.9, baton: true, aA: -0.9 * Math.sin((i / 8) * TAU) + 1.1, eA: 0.2 }), GUARD, true));
    return sheet(key, 64, 66, 30, 62, sc, run);
  }
  function dogs(sc) {
    const key = "d:" + sc; if (cache[key]) return cache[key];
    const fr = [];
    for (let s = 0; s < 2; s++) for (let i = 0; i < 8; i++) fr.push((c) => dog(c, (i / 8) * TAU, s ? 1 : 0.25));
    return sheet(key, 80, 50, 40, 46, sc, fr);          // 0-7 running, 8-15 snarling
  }

  /* ---------- items ---------- */
  function coins(sc) {
    const key = "c:" + sc; if (cache[key]) return cache[key];
    const make = (gold) => Array.from({ length: 8 }, (_, i) => {
      const cv = mk(28 * sc, 28 * sc), c = cv.getContext("2d"); c.scale(sc, sc); c.translate(14, 14);
      const wd = Math.max(0.16, Math.abs(Math.cos((i / 8) * Math.PI))) * 10.5, hh = 11, a = gold ? ["#fff8c8", "#ffe36a", "#d99a18"] : ["#ffe9a0", "#ffd84f", "#c98a12"];
      c.fillStyle = a[2]; c.beginPath(); c.ellipse(0, 0, wd + 1.1, hh + 1.1, 0, 0, TAU); c.fill();
      c.fillStyle = lg(c, -wd, -hh, wd, hh, [[0, a[0]], [0.5, a[1]], [1, a[2]]]); c.beginPath(); c.ellipse(0, 0, wd, hh, 0, 0, TAU); c.fill();
      if (wd > 4) { c.strokeStyle = "rgba(150,90,0,.55)"; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, wd * 0.66, hh * 0.66, 0, 0, TAU); c.stroke();
        c.fillStyle = "rgba(150,90,0,.6)"; c.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * TAU, rr = k % 2 ? 2.6 : 5.6; c.lineTo(Math.cos(ang) * rr * (wd / 10.5), Math.sin(ang) * rr); } c.closePath(); c.fill(); }
      return cv;
    });
    const out = { n: make(false), g: make(true), size: 28 }; cache[key] = out; return out;
  }
  function badge(icon, color, sc) {
    const cv = mk(40 * sc, 40 * sc), c = cv.getContext("2d"); c.scale(sc, sc);
    c.fillStyle = "rgba(10,14,34,.92)"; c.beginPath(); c.arc(20, 20, 17, 0, TAU); c.fill();
    c.strokeStyle = color; c.lineWidth = 2.5; c.beginPath(); c.arc(20, 20, 16, 0, TAU); c.stroke();
    c.fillStyle = color; c.font = "700 17px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(icon, 20, 21);
    return cv;
  }
  function heart(full, sc) {
    const cv = mk(24 * sc, 22 * sc), c = cv.getContext("2d"); c.scale(sc, sc);
    c.beginPath(); c.moveTo(12, 20); c.bezierCurveTo(-3, 9, 3, -2, 12, 5); c.bezierCurveTo(21, -2, 27, 9, 12, 20); c.closePath();
    if (full) { c.fillStyle = lg(c, 0, 0, 0, 22, [[0, "#ff8fa3"], [1, "#e0204a"]]); c.fill(); c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1; c.stroke(); }
    else { c.fillStyle = "rgba(255,255,255,.08)"; c.fill(); c.strokeStyle = "rgba(255,120,150,.55)"; c.lineWidth = 1.4; c.stroke(); }
    return cv;
  }

  /* ---------- obstacles (all clearly "danger": warning colours + white outline) ---------- */
  function obstacle(kind, sc) {
    const key = "o:" + kind + ":" + sc; if (cache[key]) return cache[key];
    const w = 48, h = 64, cv = mk(w * sc, h * sc), c = cv.getContext("2d"); c.scale(sc, sc);
    const outline = () => { c.strokeStyle = "#fff"; c.lineWidth = 1.8; c.stroke(); };
    if (kind === "crate") {
      for (const [y0, hh] of [[34, 30], [4, 30]]) {
        c.fillStyle = lg(c, 0, y0, w, y0 + hh, [[0, "#d9904a"], [1, "#9a5a22"]]); c.beginPath(); c.roundRect(2, y0, w - 4, hh - 1.5, 3); c.fill(); outline();
        c.strokeStyle = "rgba(60,30,8,.55)"; c.lineWidth = 2; c.beginPath(); c.moveTo(8, y0 + 3); c.lineTo(w - 8, y0 + hh - 4); c.moveTo(w - 8, y0 + 3); c.lineTo(8, y0 + hh - 4); c.stroke();
        c.fillStyle = "#ffc21a"; c.fillRect(2, y0 + hh / 2 - 3, w - 4, 5); c.fillStyle = "#17171f"; for (let x = 2; x < w - 8; x += 12) { c.beginPath(); c.moveTo(x, y0 + hh / 2 + 2); c.lineTo(x + 6, y0 + hh / 2 + 2); c.lineTo(x + 12, y0 + hh / 2 - 3); c.lineTo(x + 6, y0 + hh / 2 - 3); c.fill(); }
      }
    } else if (kind === "cones") {
      for (const [cx0, sz] of [[14, 1], [34, 0.92]]) {
        const bx = cx0, by = h - 2, bw = 17 * sz, th = 58 * sz;
        c.fillStyle = "#17171f"; c.beginPath(); c.roundRect(bx - bw / 2 - 2, by - 5, bw + 4, 5, 2); c.fill();
        c.fillStyle = lg(c, bx - bw / 2, 0, bx + bw / 2, 0, [[0, "#ff7a1a"], [0.5, "#ffa04a"], [1, "#e0560a"]]);
        c.beginPath(); c.moveTo(bx - bw / 2, by - 5); c.lineTo(bx - 3, by - th); c.lineTo(bx + 3, by - th); c.lineTo(bx + bw / 2, by - 5); c.closePath(); c.fill(); outline();
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(bx - bw / 2 + 2.4, by - th * 0.32); c.lineTo(bx - 4.6, by - th * 0.5); c.lineTo(bx + 4.6, by - th * 0.5); c.lineTo(bx + bw / 2 - 2.4, by - th * 0.32); c.closePath(); c.fill();
      }
    } else {                                                          // hazard barrier
      c.fillStyle = "#17171f"; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 5); c.fill();
      c.save(); c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 5); c.clip();
      c.fillStyle = "#ffc21a"; for (let k = -h; k < w + h; k += 24) { c.beginPath(); c.moveTo(k, h); c.lineTo(k + 12, h); c.lineTo(k + 12 + h, 0); c.lineTo(k + h, 0); c.fill(); }
      c.fillStyle = "rgba(255,255,255,.22)"; c.fillRect(2, 2, w - 4, 7); c.restore();
      c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 5); outline();
    }
    cache[key] = cv; return cv;
  }

  return { runner, guard, dogs, coins, badge, heart, obstacle, SKINS, mk };
})();
