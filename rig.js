/* =====================================================
   RIG — realistic skeleton-animated characters.
   The runner, the policewoman and the chasing dog are built from
   real bones (inverse-kinematics legs, swinging arms, bobbing hips,
   flowing scarf / hair), shaded like solid volumes and lit with a
   warm back-light (rim). Every frame is drawn ONCE into a small
   offscreen canvas; the game only calls drawImage per frame, so it
   costs the same as a plain picture on any phone.

   API:  Rig.runner(skinId, scale) · Rig.guard(scale) · Rig.dog(scale)
   Each returns { w, h, fx, fy, f:[canvases], n:runFrames, … }
===================================================== */
const Rig = (() => {
  const TAU = Math.PI * 2, K = 0.9;                              // K: natural units → game units
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function shade(hex, k) {                                       // k<0 darker, k>0 lighter
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
    return "#" + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  const pt = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l];      // angle from straight down, + = forward
  const angOf = (x1, y1, x2, y2) => Math.atan2(x2 - x1, y2 - y1);
  function ik(hx, hy, tx, ty, l1, l2, dir) {                     // two-bone inverse kinematics → joint + reachable end
    const dx = tx - hx, dy = ty - hy;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.05, l1 + l2 - 0.05), base = Math.atan2(dy, dx);
    const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), a = base + dir * A;
    return [hx + Math.cos(a) * l1, hy + Math.sin(a) * l1, hx + Math.cos(base) * d, hy + Math.sin(base) * d];
  }

  /* ---------- shaded limb (tapered capsule, lit from the upper-front) ---------- */
  function limb(c, x1, y1, x2, y2, w1, w2, col) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (nx * 0.5 + ny * -0.85 < 0) { nx = -nx; ny = -ny; }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, wm = Math.max(w1, w2) / 2;
    const g = c.createLinearGradient(mx + nx * wm, my + ny * wm, mx - nx * wm, my - ny * wm);
    g.addColorStop(0, shade(col, 0.24)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.45));
    const a = Math.atan2(dy, dx);
    c.fillStyle = g; c.beginPath();
    c.arc(x1, y1, w1 / 2, a + Math.PI / 2, a + Math.PI * 1.5);
    c.arc(x2, y2, w2 / 2, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath(); c.fill();
  }
  const blob = (c, x, y, rx, ry, col, rot = 0) => {
    const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 0.3, x, y, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill();
  };
  function poly(c, pts, close = true) {                          // smooth closed shape through points
    const n = pts.length;
    c.beginPath();
    if (close) {
      let m = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
      c.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      c.closePath();
    } else {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  /* ---------- looks ---------- */
  const SKIN = { runner: "#d9a273", guard: "#e6b48d" };
  const LOOKS = {
    default: { jacket: "#1fa9ff", trim: "#ff4fd8", pants: "#232a4a", shoe: "#f2f5ff", sole: "#53f7ff", pack: "#ff4fd8", hair: "#17141c" },
    rose: { jacket: "#ff4fa8", trim: "#ffd84f", pants: "#2f1d3e", shoe: "#fff0f6", sole: "#ff8a5c", pack: "#ffd84f", hair: "#17141c" },
    mint: { jacket: "#2fd9a0", trim: "#53f7ff", pants: "#173a38", shoe: "#eafff7", sole: "#a78bfa", pack: "#53f7ff", hair: "#17141c" },
    gold: { jacket: "#ffc23a", trim: "#7a3a0a", pants: "#33220e", shoe: "#fff6dc", sole: "#ff7a59", pack: "#7a3a0a", hair: "#17141c" },
  };
  const GUARD = { jacket: "#26407f", trim: "#ffd84f", pants: "#141b3c", shoe: "#0d0f1a", sole: "#3b3b44", pack: null, hair: "#3a2214", cap: true, pony: true, belt: true, baton: true, skin: SKIN.guard, rim: "#ffb27a", slim: true };

  /* ---------- the figure ---------- */
  function figure(c, P, S) {
    const hx = P.hx || 0, hipY = -P.hipH, lean = P.lean, skin = S.skin || SKIN.runner;
    const TL = 19.5;                                             // torso length
    const nx = hx + Math.sin(lean) * TL, ny = hipY - Math.cos(lean) * TL;               // neck base
    const hdx = Math.sin(lean * 0.7) * 4 + 1.2, hdy = -Math.cos(lean * 0.7) * 4.4 - 6.4;
    const headX = nx + hdx, headY = ny + hdy, tilt = P.tilt || 0;
    const slim = S.slim ? 0.86 : 1;
    // legs (IK from ankle targets)
    const leg = (spec, near) => {
      const [tx, ty, pitch] = spec, ax0 = hx + tx, ay0 = hipY + ty;
      const [kx, ky, ax, ay] = ik(hx, hipY, ax0, ay0, 16.4, 16.4, -1);
      const dark = near ? 0 : -0.34, pants = shade(S.pants, dark);
      limb(c, hx, hipY, kx, ky, 9.2 * slim, 7 * slim, pants);
      limb(c, kx, ky, ax, ay, 6.8 * slim, 4.7 * slim, pants);
      if (S.belt) { /* boots: taller dark shaft */ limb(c, ax + (kx - ax) * 0.3, ay + (ky - ay) * 0.3, ax, ay, 5.4, 5.2, shade("#15151c", dark)); }
      else { c.strokeStyle = shade(S.trim, dark); c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath(); c.moveTo(hx + (kx - hx) * 0.25 - 0.3, hipY + (ky - hipY) * 0.25); c.lineTo(kx, ky); c.lineTo(ax + (kx - ax) * 0.22, ay + (ky - ay) * 0.22); c.stroke(); }
      // shoe
      c.save(); c.translate(ax, ay); c.rotate(pitch);
      const up = shade(S.shoe, dark), sole = shade(S.sole, dark);
      const g = c.createLinearGradient(0, -3.6, 0, 3.6); g.addColorStop(0, shade(up, 0.2)); g.addColorStop(1, shade(up, -0.4));
      c.fillStyle = g; c.beginPath(); c.moveTo(-3.2, -3.4); c.lineTo(-3.6, 1.4); c.quadraticCurveTo(-3.4, 3.2, -1.6, 3.3); c.lineTo(7, 3.3); c.quadraticCurveTo(10.6, 3.1, 10, 0.8); c.quadraticCurveTo(8.2, -0.8, 5.6, -1.4); c.lineTo(2.2, -2.6); c.quadraticCurveTo(0.4, -3.6, -0.6, -3.6); c.closePath(); c.fill();
      c.strokeStyle = sole; c.lineWidth = 1.7; c.lineCap = "round"; c.beginPath(); c.moveTo(-3.3, 3.6); c.lineTo(9.8, 3.6); c.stroke();
      if (!S.belt) { c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(1, -1.6); c.lineTo(3.6, -0.2); c.moveTo(2.8, -2.2); c.lineTo(5.3, -0.9); c.stroke(); }
      c.restore();
    };
    const sx = nx - Math.sin(lean) * 2.2, sy = ny + Math.cos(lean) * 3.2;                 // shoulder
    const arm = (a, f, near, hold) => {
      const dark = near ? 0 : -0.36, ex = sx + Math.sin(a) * 10.2, ey = sy + Math.cos(a) * 10.2, wx = ex + Math.sin(f) * 9.6, wy = ey + Math.cos(f) * 9.6;
      const sl = shade(S.jacket, dark);
      limb(c, sx, sy, ex, ey, 6 * slim, 5 * slim, sl);
      limb(c, ex, ey, wx, wy, 5 * slim, 3.9 * slim, shade(S.cuff || S.jacket, dark));
      c.strokeStyle = shade(S.trim, dark); c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.moveTo(wx - Math.sin(f) * 1.6 - 1.7, wy - Math.cos(f) * 1.6); c.lineTo(wx - Math.sin(f) * 1.6 + 1.7, wy - Math.cos(f) * 1.6); c.stroke();
      if (hold && S.baton) { const bx = Math.sin(f + 0.35), by = Math.cos(f + 0.35); c.strokeStyle = "#0c0c10"; c.lineWidth = 2.8; c.beginPath(); c.moveTo(wx - bx * 3, wy - by * 3); c.lineTo(wx + bx * 12, wy + by * 12); c.stroke(); c.strokeStyle = "#e6e6f0"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(wx + bx * 10, wy + by * 10); c.lineTo(wx + bx * 12, wy + by * 12); c.stroke(); }
      blob(c, wx + Math.sin(f) * 1.2, wy + Math.cos(f) * 1.2, 2.7, 2.7, shade(skin, dark));
    };
    // ---- far limbs
    arm(P.aB[0], P.aB[1], false); leg(P.lb, false);
    // ---- backpack / ponytail root are drawn behind the torso
    if (S.pack) {
      c.save(); c.translate((hx + nx) / 2 - 7.6, (hipY + ny) / 2 - 1); c.rotate(lean);
      const g = c.createLinearGradient(-4, 0, 4, 0); g.addColorStop(0, shade(S.pack, -0.42)); g.addColorStop(1, shade(S.pack, 0.1));
      c.fillStyle = g; c.beginPath(); c.roundRect(-4.2, -8.5, 8.4, 15, 3); c.fill();
      c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(-3.2, -2.4, 6.4, 1.2);
      c.restore();
    }
    // ---- torso
    {
      const ux = nx - hx, uy = ny - hipY, L = Math.hypot(ux, uy), tx = ux / L, ty = uy / L, fxn = -ty, fyn = tx, N = 12, front = [], back = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, cx = hx + ux * t, cy = hipY + uy * t;
        const f = (3.9 + 1.7 * smooth(0.3, 0.8, t) - 1.1 * smooth(0.9, 1, t)) * slim, b = (3.8 + 1.1 * smooth(0.3, 0.8, t) - 0.9 * smooth(0.92, 1, t)) * slim;
        front.push([cx + fxn * f, cy + fyn * f]); back.push([cx - fxn * b, cy - fyn * b]);
      }
      const pts = front.concat(back.reverse());
      c.save(); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.clip();
      const mx = (hx + nx) / 2, my = (hipY + ny) / 2;
      let g = c.createLinearGradient(mx - fxn * 6, my - fyn * 6, mx + fxn * 6, my + fyn * 6);
      g.addColorStop(0, shade(S.jacket, -0.5)); g.addColorStop(0.6, S.jacket); g.addColorStop(1, shade(S.jacket, 0.3));
      c.fillStyle = g; c.fillRect(hx - 30, ny - 30, 60, 70);
      g = c.createLinearGradient(hx, hipY, nx, ny); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(255,255,255,.1)");
      c.fillStyle = g; c.fillRect(hx - 30, ny - 30, 60, 70);
      const band = (t0, t1, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i <= 4; i++) { const t = t0 + (t1 - t0) * (i / 4); c.lineTo(hx + ux * t + fxn * 9, hipY + uy * t + fyn * 9); } for (let i = 4; i >= 0; i--) { const t = t0 + (t1 - t0) * (i / 4); c.lineTo(hx + ux * t - fxn * 9, hipY + uy * t - fyn * 9); } c.closePath(); c.fill(); };
      if (S.belt) {                                               // uniform: duty belt, chest panel, pocket flap
        band(0.04, 0.17, "#0c0c12"); band(0.5, 0.52, "rgba(255,255,255,.15)");
        c.fillStyle = S.trim; c.fillRect(hx + ux * 0.1 + fxn * 0.5 - 1.8, hipY + uy * 0.1 - 1.7, 3.6, 3.4);
        c.fillStyle = "#e9edf7"; c.beginPath(); c.arc(hx + ux * 0.68 + fxn * 2.6, hipY + uy * 0.68 + fyn * 2.6, 1.7, 0, TAU); c.fill();
      } else {                                                    // street jacket: hem rib, chest stripe, zip
        band(0, 0.11, shade(S.trim, -0.1)); band(0.56, 0.64, S.trim); band(0.585, 0.595, "rgba(255,255,255,.7)");
        c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx + ux * 0.11 + fxn * 2.9, hipY + uy * 0.11 + fyn * 2.9); c.lineTo(hx + ux * 0.96 + fxn * 3.4, hipY + uy * 0.96 + fyn * 3.4); c.stroke();
        c.strokeStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.moveTo(hx + ux * 0.2 - fxn * 1.4, hipY + uy * 0.2 - fyn * 1.4); c.quadraticCurveTo(hx + ux * 0.45 - fxn * 3.2, hipY + uy * 0.45 - fyn * 3.2, hx + ux * 0.8 - fxn * 1.8, hipY + uy * 0.8 - fyn * 1.8); c.stroke();
      }
      c.restore();
      blob(c, sx, sy, 4.1 * slim, 4.3 * slim, S.jacket);          // shoulder cap
      if (S.belt) { c.fillStyle = S.trim; c.fillRect(sx - 2.4, sy - 4.3, 4.8, 1.6); }
    }
    // pelvis between torso and legs
    blob(c, hx - 0.3, hipY + 0.5, 5.5 * slim, 5 * slim, S.pants);
    if (S.belt) { const hxp = hx + Math.sin(lean) * 3 + 1.5, hyp = hipY + 1.5; c.fillStyle = "#0c0c12"; c.beginPath(); c.roundRect(hxp - 2, hyp - 1, 4.2, 6.5, 1.4); c.fill(); c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(hxp - 1.2, hyp - 0.4, 1, 4.6); }
    // ---- near leg
    leg(P.la, true);
    // ---- neck + head
    limb(c, nx, ny + 1, headX - 0.6, headY + 4, 4.5, 4.1, shade(skin, -0.12));
    drawHead(c, headX, headY, tilt, S, P);
    // ---- scarf (ikat) / hair streaming
    if (S.scarf !== false && !S.belt) {
      const w = P.flow || 0, x0 = nx + Math.sin(lean) * 0.6, y0 = ny + 1.2, drop = P.drop || 0;
      const top = [], bot = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = x0 - t * 23 + Math.sin(w + t * 4.2) * 1.4, y = y0 + Math.sin(w * 1.1 + t * 4.4) * 3.2 * t + drop * t * t * 8 + t * 1.4, wd = 2.4 * (1 - 0.45 * t);
        top.push([x, y - wd]); bot.push([x, y + wd]);
      }
      const pts = top.concat(bot.reverse());
      let g = c.createLinearGradient(x0 - 22, 0, x0, 0); g.addColorStop(0, "#c91f3f"); g.addColorStop(1, "#ff5470");
      c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill();
      c.fillStyle = "#ffd84f"; for (let i = 1; i < 8; i += 2) { const p = top[i], q = bot[bot.length - 1 - i]; c.beginPath(); c.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 1.3); c.lineTo((p[0] + q[0]) / 2 + 1.3, (p[1] + q[1]) / 2); c.lineTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 1.3); c.lineTo((p[0] + q[0]) / 2 - 1.3, (p[1] + q[1]) / 2); c.fill(); }
      blob(c, nx + 0.4, ny + 1.4, 4.2, 2.6, "#e03352");          // knot round the neck
    }
    // ---- near arm on top
    arm(P.aA[0], P.aA[1], true, true);
  }

  function drawHead(c, x, y, tilt, S, P) {
    const skin = S.skin || SKIN.runner;
    c.save(); c.translate(x, y); c.rotate(tilt);
    const flow = P.flow || 0;
    // ponytail swings behind the head
    if (S.pony) {
      const sw = Math.sin(flow * 1.1) * 3 + (P.tailDrop || 0);
      c.fillStyle = shade(S.hair, -0.15); c.beginPath(); c.moveTo(-4.6, -3.2); c.bezierCurveTo(-12, -4 + sw * 0.4, -16, 1 + sw, -15 + sw * 0.4, 7 + sw * 1.4); c.bezierCurveTo(-11, 3 + sw * 0.7, -8, 1, -4.2, 1.6); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6.5, -2); c.bezierCurveTo(-11, -2 + sw * 0.4, -13, 1 + sw * 0.8, -13, 5 + sw); c.stroke();
    }
    // face (profile facing right)
    const face = [[-5.5, -0.4], [-4.6, -5.1], [0, -6.9], [4.4, -5.2], [5.2, -2], [5.5, -0.4], [7.2, 1.9], [5.6, 2.5], [5.7, 3.5], [5.3, 4.2], [4.8, 5.9], [2.2, 7], [-1.4, 5.8], [-3, 3.4]];
    poly(c, face);
    let g = c.createLinearGradient(-5, -7, 6, 7); g.addColorStop(0, shade(skin, 0.18)); g.addColorStop(0.6, skin); g.addColorStop(1, shade(skin, -0.3));
    c.fillStyle = g; c.fill();
    c.fillStyle = "rgba(180,70,60,.18)"; c.beginPath(); c.ellipse(2.3, 3, 2.2, 1.5, 0, 0, TAU); c.fill();             // cheek
    c.fillStyle = shade(skin, -0.22); c.beginPath(); c.ellipse(-1.5, 0.9, 1.5, 2.2, 0.1, 0, TAU); c.fill();           // ear
    // eye
    const ex = 2.8, ey = -1, shut = P.eye === 1, wide = P.eye === 2;
    if (shut) { c.strokeStyle = "#1a1014"; c.lineWidth = 1.1; c.lineCap = "round"; c.beginPath(); c.moveTo(ex - 1.9, ey + 0.2); c.quadraticCurveTo(ex, ey + 1.3, ex + 1.9, ey + 0.1); c.stroke(); }
    else {
      c.fillStyle = "#fff"; c.beginPath(); c.ellipse(ex, ey, wide ? 2.3 : 2, wide ? 1.9 : 1.2, 0, 0, TAU); c.fill();
      c.fillStyle = S.belt ? "#2a1d12" : "#1a1014"; c.beginPath(); c.arc(ex + 0.7, ey + 0.05, wide ? 1.2 : 0.95, 0, TAU); c.fill();
      c.fillStyle = "rgba(255,255,255,.9)"; c.beginPath(); c.arc(ex + 1, ey - 0.3, 0.3, 0, TAU); c.fill();
    }
    c.strokeStyle = S.hair; c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath();
    const br = P.brow || 0; c.moveTo(ex - 2.5, ey - 2.2 - br * 0.6); c.lineTo(ex + 2.3, ey - 2.7 + br);  c.stroke();           // brow (br>0 = angry)
    // mouth
    const m = P.mouth || 0;
    if (m > 0.05) { c.fillStyle = "#4a1018"; c.beginPath(); c.ellipse(5.1, 4.5, 1.2 + m * 0.6, 0.7 + m * 1.7, 0, 0, TAU); c.fill(); c.fillStyle = "#f4f0ea"; c.fillRect(4.4, 3.9, 1.6, 0.8); }
    else { c.strokeStyle = S.belt ? "#a23a4a" : "#7a3a30"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(3.7, 4.3); c.quadraticCurveTo(5, 4.7, 5.6, 4.1); c.stroke(); }
    c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(5.6, 0.6); c.lineTo(6.5, 1.8); c.stroke();     // nose line
    // hair / cap
    if (S.cap) {
      let gg = c.createLinearGradient(0, -11, 0, -3); gg.addColorStop(0, "#2a4287"); gg.addColorStop(1, "#14204a");
      c.fillStyle = gg; c.beginPath(); c.moveTo(-6.2, -2.6); c.quadraticCurveTo(-6.8, -9.4, -2, -10.2); c.lineTo(3.6, -10); c.quadraticCurveTo(6.4, -9.2, 6.2, -3.2); c.closePath(); c.fill();
      c.fillStyle = "#0b1233"; c.fillRect(-6.3, -4.4, 12.6, 2); c.fillStyle = "#101a40"; c.beginPath(); c.moveTo(4.2, -4.3); c.lineTo(11.6, -2.8); c.quadraticCurveTo(12, -1.8, 10.6, -1.5); c.lineTo(4.2, -2.4); c.closePath(); c.fill();
      c.fillStyle = S.trim; c.beginPath(); c.arc(3.6, -7, 1.7, 0, TAU); c.fill(); c.fillStyle = "#fff6c4"; c.beginPath(); c.arc(3.2, -7.4, 0.55, 0, TAU); c.fill();
    } else {
      const hairPts = [[-6, 2.4], [-6.6, -3.8], [-2.4, -8.2], [3.2, -7.8], [6.7, -5.4], [5.1, -3.6], [3, -4.4], [0.6, -3.2], [-1.8, -1], [-3.4, 1.4]];
      poly(c, hairPts); gg = c.createLinearGradient(-6, -8, 6, 0); gg.addColorStop(0, "#3b3646"); gg.addColorStop(0.4, S.hair); gg.addColorStop(1, shade(S.hair, -0.3));
      c.fillStyle = gg; c.fill();
      c.strokeStyle = "rgba(255,255,255,.28)"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3.4, -6.6); c.quadraticCurveTo(0.8, -8, 4.8, -6.2); c.stroke();
      const wv = Math.sin(flow + 0.6) * 1.2;                                                            // back tuft flying in the wind
      c.fillStyle = S.hair; c.beginPath(); c.moveTo(-5.6, -3.6); c.quadraticCurveTo(-10.5, -3.4 + wv, -13 + wv, -1.4 + wv); c.quadraticCurveTo(-9.5, -0.6, -5.6, 0.8); c.closePath(); c.fill();
    }
    c.restore();
    var gg;
  }

  /* ---------- poses ---------- */
  const foot = (u, o) => {                                       // foot path: [x, lift, pitch] relative to the hip
    const S0 = 0.38;
    if (u < S0) { const s = u / S0; return [o.xf + (o.xb - o.xf) * s, 0, -0.16 + 0.8 * Math.pow(s, 2.4)]; }
    const s = (u - S0) / (1 - S0), e = s * s * (3 - 2 * s);
    return [o.xb + (o.xf - o.xb) * e, o.lift * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04)), 1.15), 0.8 - 1.0 * Math.min(1, s * 1.1)];
  };
  function runPose(ph, o = {}) {                                 // one full stride, ph 0..1
    const bob = 0.5 - 0.5 * Math.cos(2 * TAU * (ph - 0.2)), hipH = 27.4 + 2.4 * bob * (o.bounce === undefined ? 1 : o.bounce);
    const fo = { xf: 12.5 * (o.stride || 1), xb: -15.5 * (o.stride || 1), lift: 17 * (o.knee || 1) };
    const mk2 = (u) => { const [x, lift, pitch] = foot(u, fo); return [x, hipH - 3.3 - lift, pitch]; };
    const sw = Math.cos(TAU * ph), swB = Math.cos(TAU * (ph + 0.5)), amp = o.arms || 1.0;
    const lean = (o.lean === undefined ? 0.26 : o.lean) + 0.035 * Math.sin(2 * TAU * (ph - 0.1));
    const P = {
      hipH, lean, la: mk2(ph), lb: mk2((ph + 0.5) % 1),
      aA: [-amp * sw + 0.12, -amp * sw + 0.12 + 1.38 + 0.28 * sw], aB: [-amp * swB + 0.12, -amp * swB + 0.12 + 1.38 + 0.28 * swB],
      tilt: -lean * 0.45 + 0.02 * Math.sin(2 * TAU * ph), flow: ph * TAU * 2, mouth: o.mouth || 0, brow: o.brow || 0, eye: o.eye || 0, drop: 0, tailDrop: Math.sin(2 * TAU * ph) * 1.5,
    };
    if (o.holdArm) { P.aA = [0.95 + 0.12 * sw, 1.95 + 0.1 * sw]; }
    return P;
  }
  const POSES = {
    jump: { hipH: 27.5, lean: 0.12, la: [13, 12, 0.5], lb: [-9, 23, 1.15], aA: [2.35, 2.7], aB: [-0.9, 0.1], tilt: -0.1, flow: 1.3, mouth: 0.5, drop: -1.5 },
    fall: { hipH: 28, lean: 0.06, la: [5, 25, 0.35], lb: [-3, 24.5, 0.1], aA: [1.65, 1.95], aB: [-1.45, -1.75], tilt: -0.04, flow: 2.2, mouth: 0.3, drop: 2 },
    land: { hipH: 17.5, lean: 0.62, la: [14, 14.2, -0.1], lb: [9, 14, -0.1], aA: [1.25, 2.0], aB: [0.5, 1.5], tilt: -0.28, flow: 0.4, brow: 0.5, drop: 0 },
    duck: { hx: -3, hipH: 7.5, lean: -1.12, la: [27, 4.4, -0.12], lb: [23, 5.6, 0.05], aA: [1.5, 1.8], aB: [0.6, 0.9], tilt: 1.0, flow: 0.3, brow: 0.4, drop: 0 },
    hit: { hipH: 26.5, lean: -0.38, la: [-6, 23.4, 1.1], lb: [9, 23.4, 0.0], aA: [2.65, 2.95], aB: [-2.3, -2.6], tilt: 0.35, flow: 2.6, mouth: 1, eye: 1, brow: -0.8, drop: 3 },
  };

  /* ---------- rim light: a warm back-light on the edges facing up/back ---------- */
  function rim(cv, color, sc) {
    const t = mk(cv.width, cv.height), g = t.getContext("2d");
    g.drawImage(cv, 0, 0); g.globalCompositeOperation = "destination-out"; g.drawImage(cv, 1.5 * sc, 1.3 * sc);
    g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, t.width, t.height);
    const c = cv.getContext("2d"); c.globalAlpha = 0.9; c.drawImage(t, 0, 0); c.globalAlpha = 1;
  }

  const cache = {};
  function frames(key, W, Ht, fx, fy, sc, fns, rimCol) {
    const rs = sc * 1.55;                                         // the sheets are drawn sharper than the screen needs
    return fns.map((fn) => {
      const cv = mk(W * rs, Ht * rs), c = cv.getContext("2d");
      c.imageSmoothingQuality = "high"; c.setTransform(rs, 0, 0, rs, 0, 0); c.translate(fx, fy); c.scale(K, K);
      fn(c); rim(cv, rimCol, rs); return cv;
    });
  }

  function runner(skin, sc) {
    const key = "r:" + skin + ":" + sc; if (cache[key]) return cache[key];
    const S = Object.assign({}, LOOKS[skin] || LOOKS.default, { skin: SKIN.runner });
    const N = 12, run = Array.from({ length: N }, (_, i) => (c) => figure(c, runPose(i / N, { eye: i === 7 ? 1 : 0 }), S));
    const poses = ["jump", "fall", "land", "duck", "hit"].map((n) => (c) => figure(c, POSES[n], S));
    // 0..11 run · 12 jump · 13 fall · 14 land · 15 duck(slide) · 16 hit
    return (cache[key] = { w: 84, h: 78, fx: 42, fy: 74, f: frames(key, 84, 78, 42, 74, sc, run.concat(poses), "#ffb97a"), n: N, jump: 12, fall: 13, land: 14, duck: 15, hit: 16 });
  }
  function guard(sc) {
    const key = "g:" + sc; if (cache[key]) return cache[key];
    const S = GUARD, N = 12;
    const run = Array.from({ length: N }, (_, i) => (c) => figure(c, runPose(i / N, { lean: 0.3, arms: 0.8, holdArm: true, mouth: 0.7, brow: 0.9, stride: 1.06 }), S));
    const swing = (c) => figure(c, { hipH: 25, lean: 0.55, la: [11, 21.6, 0.3], lb: [-8, 20.5, 0.5], aA: [2.75, 3.05], aB: [0.7, 1.7], tilt: -0.3, flow: 1.5, mouth: 1, brow: 1, tailDrop: -2 }, S);
    return (cache[key] = { w: 90, h: 82, fx: 44, fy: 78, f: frames(key, 90, 82, 44, 78, sc, run.concat([swing]), "#ffa66b"), n: N, swing: N });
  }

  /* ---------- the dog (Alabay shepherd, rotary gallop) ---------- */
  const COAT = "#c8995a", SAD = "#8a5c2f", BELLY = "#ecd6a6", MASK = "#2e2118";
  const dFoot = (u, front) => {                                   // [x, lift] relative to the shoulder / hip joint
    const S0 = 0.34, xf = front ? 13.5 : 10.5, xb = front ? -9 : -16;
    if (u < S0) return [xf + (xb - xf) * (u / S0), 0];
    const s = (u - S0) / (1 - S0), e = s * s * (3 - 2 * s);
    return [xb + (xf - xb) * e, (front ? 11 : 12.5) * Math.pow(Math.sin(Math.PI * s), 1.1)];
  };
  function dogFig(c, ph, snarl) {
    const bobF = -2.4 * Math.sin(TAU * (2 * ph) + 0.5), bobH = -2.4 * Math.sin(TAU * (2 * ph) - 0.3), pitch = 0.07 * Math.sin(TAU * (2 * ph) + 0.2);
    const shx = 8, shy = -19.5 + bobF, hpx = -14, hpy = -19.5 + bobH;
    const leg = (jx, jy, u, front, near) => {
      const [fx, lift] = dFoot(u % 1, front), [kx, ky, ax, ay] = ik(jx, jy, jx + fx, -2.4 - lift, 12, 12.6, front ? 1 : -1), dk = near ? 0 : -0.36;
      limb(c, jx, jy, kx, ky, front ? 7.4 : 8.6, front ? 5 : 5.4, shade(COAT, dk)); limb(c, kx, ky, ax, ay, front ? 4.8 : 5, 3.4, shade(near ? COAT : SAD, dk));
      blob(c, ax + 1.6, ay + 0.9, 3.6, 2.2, shade(MASK, near ? 0.12 : 0), 0);
    };
    // tail
    c.strokeStyle = shade(COAT, -0.1); c.lineWidth = 3.6; c.lineCap = "round"; c.beginPath(); c.moveTo(hpx - 5, hpy - 6); c.bezierCurveTo(hpx - 12, hpy - 9 + Math.sin(TAU * 2 * ph) * 2, hpx - 17, hpy - 6 + Math.sin(TAU * 2 * ph + 1) * 3, hpx - 20, hpy - 13 + Math.sin(TAU * 2 * ph) * 2); c.stroke();
    leg(hpx, hpy + 3, ph, false, false); leg(shx, shy + 3, ph + 0.5, true, false);                  // far legs
    // body
    c.save(); c.translate(-3, -20); c.rotate(pitch); c.translate(3, 20);
    const body = [[9, -30.5 + bobF], [-5, -31.5 + (bobF + bobH) / 2], [-18, -28.5 + bobH], [-22, -22], [-18, -15.5], [-6, -15 + (bobF + bobH) / 2 * 0.5], [4, -12.6 + bobF * 0.6], [13, -14 + bobF], [15.5, -23 + bobF]];
    poly(c, body);
    let g = c.createLinearGradient(0, -33, 0, -12); g.addColorStop(0, SAD); g.addColorStop(0.34, COAT); g.addColorStop(0.78, shade(COAT, 0.1)); g.addColorStop(1, BELLY);
    c.fillStyle = g; c.fill();
    c.save(); poly(c, body); c.clip();
    g = c.createLinearGradient(-22, 0, 16, 0); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(255,255,255,.08)"); c.fillStyle = g; c.fillRect(-30, -40, 60, 40);
    c.fillStyle = "rgba(60,30,10,.3)"; c.beginPath(); c.ellipse(-4, -30, 16, 5, -0.03, 0, TAU); c.fill();                           // dark saddle
    c.strokeStyle = "rgba(255,240,200,.25)"; c.lineWidth = 0.8; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-14 + i * 5, -24); c.quadraticCurveTo(-12 + i * 5, -20, -15 + i * 5, -17); c.stroke(); }
    c.restore();
    // neck + head
    const nkx = 12, nky = -27 + bobF, hx = 26.5, hy = -33.5 + bobF * 0.8 - pitch * 12 + snarl * 2;
    limb(c, nkx, nky, hx - 2, hy + 3, 11, 8.6, COAT);
    c.strokeStyle = "#d6233c"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(nkx + 7, nky - 5); c.quadraticCurveTo(nkx + 9.6, nky - 1, nkx + 6.4, nky + 4); c.stroke();
    c.fillStyle = "#e8edf8"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(nkx + 8.4 - Math.abs(i - 1) * 0.8, nky - 3.4 + i * 3.4, 0.7, 0, TAU); c.fill(); }
    c.save(); c.translate(hx, hy); c.rotate(0.06 - snarl * 0.12);
    blob(c, 0, 0, 7.2, 6.8, COAT);                                                                                                  // skull
    const jaw = snarl * 0.62 + 0.1 + (snarl < 0.2 ? Math.max(0, Math.sin(TAU * 2 * ph)) * 0.1 : 0);                                // lower jaw angle
    c.save(); c.translate(1.2, 3.2); c.rotate(jaw);
    c.fillStyle = shade(MASK, 0.1); c.beginPath(); c.moveTo(-1, -1.8); c.lineTo(10.4, -0.8); c.quadraticCurveTo(11.4, 1.2, 9.4, 2.2); c.lineTo(-1, 3.2); c.closePath(); c.fill();
    if (snarl > 0.2 || jaw > 0.15) { c.fillStyle = "#d8556a"; c.beginPath(); c.ellipse(5.5, 0.4, 4.4, 1, 0, 0, TAU); c.fill(); }
    c.fillStyle = "#fff"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(3 + i * 2.5, -1.7); c.lineTo(3.9 + i * 2.5, -3.2 - snarl * 0.8); c.lineTo(4.8 + i * 2.5, -1.7); c.fill(); }
    c.restore();
    g = c.createLinearGradient(0, -3, 0, 4); g.addColorStop(0, "#4a3626"); g.addColorStop(1, MASK);
    c.fillStyle = g; c.beginPath(); c.moveTo(1, -3.6); c.quadraticCurveTo(8, -3.8, 12.6, -1.2); c.quadraticCurveTo(14, 0.6, 12, 2); c.lineTo(10, 2.8 - snarl * 0.4); c.lineTo(1, 4.2); c.closePath(); c.fill();   // upper muzzle / mask
    c.fillStyle = "#0b0706"; c.beginPath(); c.ellipse(12.4, -0.6, 1.9, 1.5, 0.3, 0, TAU); c.fill();
    c.fillStyle = "#fff"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(4 + i * 2.2, 3 + snarl * 0.2); c.lineTo(4.8 + i * 2.2, 5 + snarl * 1.6); c.lineTo(5.6 + i * 2.2, 3 + snarl * 0.2); c.fill(); }
    c.fillStyle = "#fff4b8"; c.beginPath(); c.ellipse(3.9, -2.2, 1.7, 1.1, -0.2, 0, TAU); c.fill(); c.fillStyle = "#9a1212"; c.beginPath(); c.arc(4.4, -2.1, 0.95, 0, TAU); c.fill();
    c.strokeStyle = "#1a100a"; c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.moveTo(1.8, -4.6 + snarl * 0.8); c.lineTo(6.2, -3.4); c.stroke();
    c.fillStyle = SAD; c.beginPath(); c.moveTo(-3, -4.6); c.lineTo(-8.6 - snarl * 2.6, -7 + snarl * 4); c.lineTo(-1.2, -9); c.closePath(); c.fill();   // cropped ear (pinned back when snarling)
    c.restore();
    c.restore();
    leg(hpx, hpy + 3, ph + 0.1, false, true); leg(shx, shy + 3, ph + 0.6, true, true);                // near legs
  }
  function dog(sc) {
    const key = "d:" + sc; if (cache[key]) return cache[key];
    const N = 12, fr = [];
    for (let s = 0; s < 2; s++) for (let i = 0; i < N; i++) fr.push((c) => dogFig(c, i / N, s ? 1 : 0.15));
    return (cache[key] = { w: 96, h: 58, fx: 46, fy: 54, f: frames(key, 96, 58, 46, 54, sc, fr, "#ffc48a"), n: N, snarl: N });   // 0-11 running · 12-23 snarling
  }

  return { runner, guard, dog, LOOKS, mk };
})();
