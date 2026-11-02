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

  /* ---------- robot looks ---------- */
  const LOOKS = {                                                // arm = main armour · plate = light plates · dark = joints · glow = eyes/core/soles · acc = accent
    default: { arm: "#1fa9ff", plate: "#eef3ff", dark: "#1a2140", glow: "#53f7ff", acc: "#ff4fd8" },
    rose: { arm: "#ff4fa8", plate: "#fff0f6", dark: "#2f1d3e", glow: "#ffd84f", acc: "#ff8a5c" },
    mint: { arm: "#2fd9a0", plate: "#eafff7", dark: "#173a38", glow: "#a78bfa", acc: "#53f7ff" },
    gold: { arm: "#ffc23a", plate: "#fff6dc", dark: "#33220e", glow: "#ff7a59", acc: "#8a4a12" },
  };
  const GUARD = { arm: "#2b438a", plate: "#dfe6f5", dark: "#10152c", glow: "#ff3b4d", acc: "#ffd84f", siren: true, baton: true, guard: true, rim: "#ffa66b" };

  /* metallic limb: a sharp highlight stripe + dark edge, so it reads as polished armour */
  function plate(c, x1, y1, x2, y2, w1, w2, col) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (nx * 0.5 + ny * -0.85 < 0) { nx = -nx; ny = -ny; }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, wm = Math.max(w1, w2) / 2;
    const g = c.createLinearGradient(mx + nx * wm, my + ny * wm, mx - nx * wm, my - ny * wm);
    g.addColorStop(0, shade(col, 0.1)); g.addColorStop(0.22, shade(col, 0.6)); g.addColorStop(0.34, shade(col, 0.15)); g.addColorStop(0.7, shade(col, -0.2)); g.addColorStop(1, shade(col, -0.62));
    const a = Math.atan2(dy, dx);
    c.fillStyle = g; c.beginPath(); c.arc(x1, y1, w1 / 2, a + Math.PI / 2, a + Math.PI * 1.5); c.arc(x2, y2, w2 / 2, a - Math.PI / 2, a + Math.PI / 2); c.closePath(); c.fill();
    c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 0.6; c.stroke();
  }
  const glowOn = (c, col, b) => { c.shadowColor = col; c.shadowBlur = b; };
  const glowOff = (c) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };
  function joint(c, x, y, r, S, dark) {                          // dark ball joint with a thin glowing ring
    blob(c, x, y, r, r, shade(S.dark, dark || 0));
    c.strokeStyle = shade(S.acc, (dark || 0) * 0.6); c.lineWidth = 0.9; c.beginPath(); c.arc(x, y, r * 0.62, 0, TAU); c.stroke();
  }

  /* ---------- the robot figure ---------- */
  function figure(c, P, S) {
    const hx = P.hx || 0, hipY = -P.hipH, lean = P.lean, TL = 17.5;
    const nx = hx + Math.sin(lean) * TL, ny = hipY - Math.cos(lean) * TL;                       // neck base
    const headX = nx + Math.sin(lean * 0.7) * 3 + 1.6, headY = ny - Math.cos(lean * 0.7) * 3 - 7.8, tilt = P.tilt || 0;
    const leg = (spec, near) => {
      const [tx, ty, pitch] = spec, [kx, ky, ax, ay] = ik(hx, hipY, hx + tx, hipY + ty, 15.6, 15.6, -1), dk = near ? 0 : -0.42;
      plate(c, hx, hipY, kx, ky, 11, 8.6, shade(S.arm, dk));                                      // thigh armour
      plate(c, kx, ky, ax, ay, 8.6, 6, shade(S.plate, dk));                                       // shin armour
      c.strokeStyle = shade(S.glow, dk); c.lineWidth = 1; c.lineCap = "round"; glowOn(c, S.glow, 3);
      c.beginPath(); c.moveTo(hx + (kx - hx) * 0.3, hipY + (ky - hipY) * 0.3); c.lineTo(kx - (kx - hx) * 0.12, ky - (ky - hipY) * 0.12); c.stroke(); glowOff(c);   // light strip
      joint(c, kx, ky, 4.6, S, dk);                                                               // knee
      c.save(); c.translate(ax, ay); c.rotate(pitch);                                              // boot
      const g = c.createLinearGradient(0, -4.4, 0, 4.4); g.addColorStop(0, shade(S.arm, 0.35 + dk)); g.addColorStop(1, shade(S.arm, -0.5 + dk));
      c.fillStyle = g; c.beginPath(); c.moveTo(-4.2, -4.4); c.lineTo(-4.8, 1.6); c.quadraticCurveTo(-4.6, 4.2, -2.4, 4.3); c.lineTo(7.4, 4.3); c.quadraticCurveTo(11.8, 4, 11, 1); c.quadraticCurveTo(9, -0.6, 5.6, -1.6); c.lineTo(2.2, -3.4); c.lineTo(1, -4.4); c.closePath(); c.fill();
      c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = shade(S.plate, dk); c.beginPath(); c.roundRect(2.2, -1.4, 5.6, 2, 1); c.fill();
      c.strokeStyle = shade(S.glow, dk); c.lineWidth = 1.9; glowOn(c, S.glow, 5); c.beginPath(); c.moveTo(-4, 4.9); c.lineTo(10.6, 4.9); c.stroke(); glowOff(c);   // glowing sole
      c.restore();
    };
    const sx = nx - Math.sin(lean) * 1.6, sy = ny + Math.cos(lean) * 3.4;                          // shoulder
    const arm = (a, f, near, hold) => {
      const dk = near ? 0 : -0.42, ex = sx + Math.sin(a) * 10, ey = sy + Math.cos(a) * 10, wx = ex + Math.sin(f) * 9.4, wy = ey + Math.cos(f) * 9.4;
      plate(c, sx, sy, ex, ey, 6.8, 5.6, shade(S.arm, dk));
      plate(c, ex, ey, wx, wy, 5.8, 5.2, shade(S.plate, dk));
      joint(c, ex, ey, 3.3, S, dk);
      if (hold && S.baton) { const bx = Math.sin(f + 0.35), by = Math.cos(f + 0.35); c.strokeStyle = "#14161f"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(wx - bx * 3, wy - by * 3); c.lineTo(wx + bx * 9, wy + by * 9); c.stroke();
        c.strokeStyle = S.glow; c.lineWidth = 2.2; glowOn(c, S.glow, 7); c.beginPath(); c.moveTo(wx + bx * 8, wy + by * 8); c.lineTo(wx + bx * 15, wy + by * 15); c.stroke(); glowOff(c); }
      blob(c, wx + Math.sin(f) * 1.4, wy + Math.cos(f) * 1.4, 3.3, 3.1, shade(S.dark, 0.1 + dk));                                      // fist
      c.fillStyle = shade(S.glow, dk); c.beginPath(); c.arc(wx + Math.sin(f) * 2.2, wy + Math.cos(f) * 2.2, 0.9, 0, TAU); c.fill();
    };
    arm(P.aB[0], P.aB[1], false); leg(P.lb, false);
    // jet pack on the back, with a flame
    {
      c.save(); c.translate((hx + nx) / 2 - 8.4, (hipY + ny) / 2 - 1); c.rotate(lean);
      const fl = 5 + 3.5 * (0.5 + 0.5 * Math.sin((P.flow || 0) * 2)) + (P.boost || 0);
      const fg = c.createLinearGradient(-3, 0, -3 - fl * 1.6, 0); fg.addColorStop(0, S.glow); fg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = fg; c.beginPath(); c.moveTo(-4, 5); c.lineTo(-4 - fl * 1.6, 7.4); c.lineTo(-4, 9.4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-4, -1.5); c.lineTo(-4 - fl, 0.6); c.lineTo(-4, 2.6); c.closePath(); c.fill();
      const g = c.createLinearGradient(-4.4, 0, 4.4, 0); g.addColorStop(0, shade(S.dark, -0.3)); g.addColorStop(0.6, shade(S.dark, 0.35)); g.addColorStop(1, shade(S.dark, 0.1));
      c.fillStyle = g; c.beginPath(); c.roundRect(-4.6, -9, 9.2, 19, 3); c.fill();
      c.fillStyle = S.glow; glowOn(c, S.glow, 4); c.beginPath(); c.arc(-1, 5, 1.7, 0, TAU); c.arc(-1, -1.5, 1.7, 0, TAU); c.fill(); glowOff(c);
      c.restore();
    }
    // torso
    {
      const ux = nx - hx, uy = ny - hipY, L = Math.hypot(ux, uy), tx = ux / L, ty = uy / L, fxn = -ty, fyn = tx, N = 12, front = [], back = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, cx = hx + ux * t, cy = hipY + uy * t;
        const f = 4.2 + 2.9 * smooth(0.25, 0.75, t) - 1.8 * smooth(0.9, 1, t), b = 4 + 2.2 * smooth(0.25, 0.75, t) - 1.4 * smooth(0.92, 1, t);
        front.push([cx + fxn * f, cy + fyn * f]); back.push([cx - fxn * b, cy - fyn * b]);
      }
      const pts = front.concat(back.reverse());
      c.save(); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.clip();
      const mx = (hx + nx) / 2, my = (hipY + ny) / 2;
      let g = c.createLinearGradient(mx - fxn * 8, my - fyn * 8, mx + fxn * 8, my + fyn * 8);
      g.addColorStop(0, shade(S.arm, -0.62)); g.addColorStop(0.5, S.arm); g.addColorStop(0.78, shade(S.arm, 0.5)); g.addColorStop(1, shade(S.arm, -0.05));
      c.fillStyle = g; c.fillRect(hx - 30, ny - 30, 60, 70);
      const band = (t0, t1, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i <= 4; i++) { const t = t0 + (t1 - t0) * (i / 4); c.lineTo(hx + ux * t + fxn * 10, hipY + uy * t + fyn * 10); } for (let i = 4; i >= 0; i--) { const t = t0 + (t1 - t0) * (i / 4); c.lineTo(hx + ux * t - fxn * 10, hipY + uy * t - fyn * 10); } c.closePath(); c.fill(); };
      band(0, 0.26, S.dark);                                                                     // waist block
      c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 0.7; for (let k = 1; k < 4; k++) { const t = 0.26 * (k / 4); c.beginPath(); c.moveTo(hx + ux * t - fxn * 8, hipY + uy * t - fyn * 8); c.lineTo(hx + ux * t + fxn * 8, hipY + uy * t + fyn * 8); c.stroke(); }
      // chest plate
      c.fillStyle = shade(S.plate, -0.05); c.beginPath();
      for (let i = 0; i <= 5; i++) { const t = 0.4 + 0.52 * (i / 5), f = 4.8 + 2.4 * smooth(0.4, 0.75, t) - 2.2 * smooth(0.9, 1, t); c.lineTo(hx + ux * t + fxn * f, hipY + uy * t + fyn * f); }
      for (let i = 5; i >= 0; i--) { const t = 0.4 + 0.52 * (i / 5); c.lineTo(hx + ux * t - fxn * 1.6, hipY + uy * t - fyn * 1.6); } c.closePath(); c.fill();
      c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.7; c.stroke();
      const cxp = hx + ux * 0.64 + fxn * 2.4, cyp = hipY + uy * 0.64 + fyn * 2.4;                  // energy core
      blob(c, cxp, cyp, 3.9, 3.9, S.dark);
      c.fillStyle = S.glow; glowOn(c, S.glow, 8); c.beginPath(); c.arc(cxp, cyp, 2.3 + 0.35 * Math.sin((P.flow || 0) * 2), 0, TAU); c.fill(); glowOff(c);
      c.fillStyle = "#fff"; c.beginPath(); c.arc(cxp - 0.5, cyp - 0.6, 0.8, 0, TAU); c.fill();
      c.strokeStyle = S.acc; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx + ux * 0.3 + fxn * 5, hipY + uy * 0.3 + fyn * 5); c.lineTo(hx + ux * 0.3 - fxn * 5, hipY + uy * 0.3 - fyn * 5); c.stroke();   // accent stripe
      c.restore();
      blob(c, sx, sy, 5.3, 5.2, S.arm); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 0.8; c.beginPath(); c.arc(sx - 0.5, sy - 0.8, 3.4, Math.PI * 1.05, Math.PI * 1.7); c.stroke();     // shoulder pod
    }
    blob(c, hx - 0.3, hipY + 0.6, 6.4, 5.4, S.dark);                                                   // pelvis
    leg(P.la, true);
    plate(c, nx - 0.2, ny + 1.6, headX - 0.8, headY + 4, 4.2, 3.8, S.dark);                              // neck
    drawHead(c, headX, headY, tilt, S, P);
    // energy scarf (ikat) streaming back
    if (!S.guard) {
      const w = P.flow || 0, x0 = nx + Math.sin(lean) * 0.8, y0 = ny + 1.4, drop = P.drop || 0, top = [], bot = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = x0 - t * 24 + Math.sin(w + t * 4.2) * 1.4, y = y0 + Math.sin(w * 1.1 + t * 4.4) * 3.2 * t + drop * t * t * 8 + t * 1.4, wd = 2.5 * (1 - 0.45 * t);
        top.push([x, y - wd]); bot.push([x, y + wd]);
      }
      const pts = top.concat(bot.reverse());
      const g = c.createLinearGradient(x0 - 22, 0, x0, 0); g.addColorStop(0, S.acc); g.addColorStop(1, shade(S.acc, 0.3));
      c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill();
      c.fillStyle = "#fff6c4"; for (let i = 1; i < 8; i += 2) { const p = top[i], q = bot[bot.length - 1 - i], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; c.beginPath(); c.moveTo(mx, my - 1.3); c.lineTo(mx + 1.3, my); c.lineTo(mx, my + 1.3); c.lineTo(mx - 1.3, my); c.fill(); }
    }
    arm(P.aA[0], P.aA[1], true, true);
  }

  function drawHead(c, x, y, tilt, S, P) {
    c.save(); c.translate(x, y); c.rotate(tilt);
    const flow = P.flow || 0;
    // antenna / siren on top
    if (S.siren) {
      const on = Math.floor(flow / 1.6) % 2;
      c.fillStyle = "#222736"; c.beginPath(); c.roundRect(-3.6, -9.4, 7.2, 3, 1); c.fill();
      glowOn(c, on ? "#ff3b4d" : "#3b7bff", 9); c.fillStyle = on ? "#ff3b4d" : "#3b7bff"; c.beginPath(); c.arc(0, -9.4, 3.6, Math.PI, TAU); c.fill(); glowOff(c);
      c.fillStyle = on ? "#3b7bff" : "#ff3b4d"; c.globalAlpha = 0.5; c.beginPath(); c.arc(0, -9.4, 3.6, Math.PI * 1.5, TAU); c.fill(); c.globalAlpha = 1;
    } else {
      c.strokeStyle = shade(S.dark, 0.3); c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath(); c.moveTo(-2.6, -6.6); c.quadraticCurveTo(-4.6 - Math.sin(flow) * 0.8, -10, -3.4 - Math.sin(flow + 1) * 1.4, -12.4); c.stroke();
      glowOn(c, S.acc, 6); c.fillStyle = S.acc; c.beginPath(); c.arc(-3.4 - Math.sin(flow + 1) * 1.4, -12.6, 1.7, 0, TAU); c.fill(); glowOff(c);
    }
    // helmet shell
    poly(c, [[-7.4, 0.4], [-6.8, -4.8], [-1.6, -7.6], [4.6, -6.8], [7.6, -2.8], [8, 2.2], [6.2, 6.4], [0, 7.4], [-5.6, 5.4]]);
    let g = c.createLinearGradient(-7, -8, 8, 7); g.addColorStop(0, shade(S.plate, 0.1)); g.addColorStop(0.45, S.plate); g.addColorStop(1, shade(S.plate, -0.5));
    c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.7; c.stroke();
    c.fillStyle = S.arm; c.beginPath(); c.moveTo(-6.6, -3.6); c.quadraticCurveTo(-1.5, -9, 4.4, -6.4); c.lineTo(3.4, -4.6); c.quadraticCurveTo(-1.5, -6.6, -5.6, -2); c.closePath(); c.fill();   // helmet crest
    // ear pod
    blob(c, -3, 1.2, 2.9, 2.9, S.dark); c.strokeStyle = S.glow; c.lineWidth = 0.9; glowOn(c, S.glow, 3); c.beginPath(); c.arc(-3, 1.2, 1.7, 0, TAU); c.stroke(); glowOff(c);
    // visor
    poly(c, [[0.2, -3.9], [6.4, -4], [8, -1.2], [7.4, 2.6], [1.4, 3.6], [-0.6, 0.6]]);
    g = c.createLinearGradient(0, -4, 6, 4); g.addColorStop(0, "#0a1228"); g.addColorStop(1, "#1a2e55"); c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(255,255,255,.3)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(1, -3.2); c.lineTo(6.2, -3.3); c.stroke();
    // eye
    const ex = 4.2, ey = -0.4, gl = S.glow;
    glowOn(c, gl, 6); c.fillStyle = gl; c.strokeStyle = gl; c.lineCap = "round";
    if (P.eye === 1) { c.lineWidth = 1.1; c.beginPath(); c.moveTo(ex - 1.8, ey - 1.5); c.lineTo(ex + 1.8, ey + 1.5); c.moveTo(ex + 1.8, ey - 1.5); c.lineTo(ex - 1.8, ey + 1.5); c.stroke(); }
    else {
      const w = P.eye === 2 ? 5.2 : 4.4, h = P.eye === 2 ? 3.4 : 2.3;
      c.beginPath(); c.roundRect(ex - w / 2, ey - h / 2, w, h, 1.1); c.fill();
      if ((P.brow || 0) > 0.3) { glowOff(c); c.fillStyle = "#0e1a36"; c.beginPath(); c.moveTo(ex - w / 2 - 0.4, ey - h / 2 - 0.6); c.lineTo(ex + w / 2 + 0.6, ey - h / 2 - 0.2); c.lineTo(ex - w / 2 - 0.4, ey + 0.1); c.closePath(); c.fill(); }   // angry brow
    }
    glowOff(c);
    // chin / speaker
    const m = P.mouth || 0;
    c.fillStyle = shade(S.dark, 0.2); c.beginPath(); c.roundRect(2, 4.2, 5, 2.6 + m * 1.2, 1); c.fill();
    c.strokeStyle = gl; c.lineWidth = 0.8; glowOn(c, gl, 3); for (let i = 0; i < 3; i++) { c.globalAlpha = m > 0.3 ? 1 : 0.55; c.beginPath(); c.moveTo(2.9 + i * 1.5, 4.9); c.lineTo(2.9 + i * 1.5, 5.9 + m * 1.2); c.stroke(); } c.globalAlpha = 1; glowOff(c);
    c.restore();
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
    const S = LOOKS[skin] || LOOKS.default;
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

  /* ---------- the robot hound (rotary gallop) ---------- */
  const DM = { metal: "#9aa5bd", dark: "#222737", glow: "#ff3b4d", acc: "#ff9a2e" };
  const dFoot = (u, front) => {                                   // [x, lift] relative to the shoulder / hip joint
    const S0 = 0.34, xf = front ? 13.5 : 10.5, xb = front ? -9 : -16;
    if (u < S0) return [xf + (xb - xf) * (u / S0), 0];
    const s = (u - S0) / (1 - S0), e = s * s * (3 - 2 * s);
    return [xb + (xf - xb) * e, (front ? 11 : 12.5) * Math.pow(Math.sin(Math.PI * s), 1.1)];
  };
  function dogFig(c, ph, snarl) {
    const bobF = -2.4 * Math.sin(TAU * (2 * ph) + 0.5), bobH = -2.4 * Math.sin(TAU * (2 * ph) - 0.3), pitch = 0.07 * Math.sin(TAU * (2 * ph) + 0.2);
    const shx = 8, shy = -19.5 + bobF, hpx = -14, hpy = -19.5 + bobH, S = DM;
    const leg = (jx, jy, u, front, near) => {
      const [fx, lift] = dFoot(u % 1, front), [kx, ky, ax, ay] = ik(jx, jy, jx + fx, -2.6 - lift, 12, 12.6, front ? 1 : -1), dk = near ? 0 : -0.42;
      plate(c, jx, jy, kx, ky, front ? 8 : 9.4, front ? 5.6 : 6, shade(S.metal, dk));
      plate(c, kx, ky, ax, ay, front ? 5 : 5.2, 3.6, shade(S.dark, 0.25 + dk));
      c.strokeStyle = shade("#d8dde8", dk); c.lineWidth = 0.9; c.beginPath(); c.moveTo(jx + (kx - jx) * 0.4 - 1.4, jy + (ky - jy) * 0.4); c.lineTo(kx - 1.2, ky); c.lineTo(ax + (kx - ax) * 0.5 - 1.2, ay + (ky - ay) * 0.5); c.stroke();   // hydraulic piston
      joint(c, kx, ky, 3.5, { dark: S.dark, acc: S.acc }, dk);
      blob(c, ax + 1.6, ay + 0.9, 4, 2.4, shade(S.dark, 0.2 + dk));
      c.strokeStyle = shade("#e6eaf2", dk); c.lineWidth = 0.8; c.lineCap = "round"; c.beginPath(); c.moveTo(ax + 4, ay + 1.4); c.lineTo(ax + 5.8, ay + 2.2); c.moveTo(ax + 3, ay + 2.4); c.lineTo(ax + 4.6, ay + 3.2); c.stroke();   // claws
    };
    // tail: segmented antenna with a glowing tip
    const tw = Math.sin(TAU * 2 * ph), tx = hpx - 19, ty = hpy - 12 + tw * 2;
    c.strokeStyle = S.dark; c.lineWidth = 2.6; c.lineCap = "round"; c.beginPath(); c.moveTo(hpx - 5, hpy - 6); c.bezierCurveTo(hpx - 11, hpy - 9 + tw * 2, hpx - 16, hpy - 7 + tw * 3, tx, ty); c.stroke();
    glowOn(c, S.glow, 6); c.fillStyle = S.glow; c.beginPath(); c.arc(tx, ty, 2, 0, TAU); c.fill(); glowOff(c);
    leg(hpx, hpy + 3, ph, false, false); leg(shx, shy + 3, ph + 0.5, true, false);
    c.save(); c.translate(-3, -20); c.rotate(pitch); c.translate(3, 20);
    const body = [[9, -30.5 + bobF], [-5, -31.5 + (bobF + bobH) / 2], [-18, -28.5 + bobH], [-22, -22], [-18, -15.5], [-6, -15 + (bobF + bobH) / 4], [4, -12.6 + bobF * 0.6], [13, -14 + bobF], [15.5, -23 + bobF]];
    poly(c, body);
    let g = c.createLinearGradient(0, -33, 0, -12); g.addColorStop(0, shade(S.metal, 0.5)); g.addColorStop(0.3, S.metal); g.addColorStop(0.75, shade(S.metal, -0.45)); g.addColorStop(1, shade(S.metal, -0.7));
    c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.7; c.stroke();
    c.save(); poly(c, body); c.clip();
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.8; for (const x of [-14, -7, 0, 6]) { c.beginPath(); c.moveTo(x, -34); c.quadraticCurveTo(x + 1.5, -24, x - 1, -12); c.stroke(); }      // armour seams
    c.fillStyle = S.dark; c.fillRect(-24, -20, 12, 8);                                                  // rear hip block
    c.strokeStyle = S.glow; c.lineWidth = 1.2; glowOn(c, S.glow, 5); c.beginPath(); c.moveTo(-18, -29 + bobH * 0.5); c.quadraticCurveTo(-4, -32.5, 8, -30 + bobF * 0.5); c.stroke(); glowOff(c);   // glowing spine
    c.restore();
    const nkx = 12, nky = -27 + bobF, hx = 26.5, hy = -33.5 + bobF * 0.8 - pitch * 12 + snarl * 2;
    plate(c, nkx, nky, hx - 2, hy + 3, 10, 8, S.metal);
    c.strokeStyle = S.acc; c.lineWidth = 2.8; glowOn(c, S.acc, 4); c.beginPath(); c.moveTo(nkx + 7, nky - 5); c.quadraticCurveTo(nkx + 9.6, nky - 1, nkx + 6.4, nky + 4); c.stroke(); glowOff(c);   // collar light
    c.save(); c.translate(hx, hy); c.rotate(0.06 - snarl * 0.12);
    const jaw = snarl * 0.62 + 0.1 + (snarl < 0.2 ? Math.max(0, Math.sin(TAU * 2 * ph)) * 0.1 : 0);
    c.save(); c.translate(1.2, 3.2); c.rotate(jaw);                                                     // lower jaw (opens when snarling)
    g = c.createLinearGradient(0, -2, 0, 3); g.addColorStop(0, shade(S.metal, -0.1)); g.addColorStop(1, shade(S.metal, -0.6));
    c.fillStyle = g; c.beginPath(); c.moveTo(-1, -1.8); c.lineTo(10.6, -0.8); c.quadraticCurveTo(11.6, 1.2, 9.4, 2.2); c.lineTo(-1, 3.2); c.closePath(); c.fill();
    if (snarl > 0.2 || jaw > 0.15) { glowOn(c, S.glow, 6); c.fillStyle = S.glow; c.beginPath(); c.ellipse(5.5, 0.4, 4.4, 1, 0, 0, TAU); c.fill(); glowOff(c); }
    c.fillStyle = "#f2f4fa"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(3 + i * 2.5, -1.7); c.lineTo(3.9 + i * 2.5, -3.4 - snarl * 0.8); c.lineTo(4.8 + i * 2.5, -1.7); c.fill(); }
    c.restore();
    poly(c, [[-6.4, -4], [0, -7.4], [6, -5], [12.6, -1.6], [12.8, 1.6], [8, 3], [-5.4, 5.6]]);                // angular head
    g = c.createLinearGradient(0, -8, 0, 5); g.addColorStop(0, shade(S.metal, 0.55)); g.addColorStop(0.5, S.metal); g.addColorStop(1, shade(S.metal, -0.55));
    c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.7; c.stroke();
    c.fillStyle = S.dark; c.beginPath(); c.moveTo(1.4, -4); c.lineTo(8, -3.2); c.lineTo(9.6, -1); c.lineTo(2, -1.6); c.closePath(); c.fill();           // visor band
    glowOn(c, S.glow, 7); c.fillStyle = S.glow; c.beginPath(); c.moveTo(3, -3.4); c.lineTo(7.4, -2.8); c.lineTo(6.6, -1.7); c.lineTo(3.4, -2); c.closePath(); c.fill(); glowOff(c);      // glowing eye
    c.fillStyle = "#0b0706"; c.beginPath(); c.ellipse(12.4, -0.5, 1.7, 1.4, 0.3, 0, TAU); c.fill();
    c.fillStyle = "#f2f4fa"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(4 + i * 2.2, 3 + snarl * 0.2); c.lineTo(4.8 + i * 2.2, 5 + snarl * 1.6); c.lineTo(5.6 + i * 2.2, 3 + snarl * 0.2); c.fill(); }
    c.fillStyle = S.dark; c.beginPath(); c.moveTo(-3, -5); c.lineTo(-8.8 - snarl * 2.4, -9.4 + snarl * 4); c.lineTo(-1, -8.4); c.closePath(); c.fill();     // antenna blade ear
    c.restore();
    c.restore();
    leg(hpx, hpy + 3, ph + 0.1, false, true); leg(shx, shy + 3, ph + 0.6, true, true);
  }
  function dog(sc) {
    const key = "d:" + sc; if (cache[key]) return cache[key];
    const N = 12, fr = [];
    for (let s = 0; s < 2; s++) for (let i = 0; i < N; i++) fr.push((c) => dogFig(c, i / N, s ? 1 : 0.15));
    return (cache[key] = { w: 96, h: 58, fx: 46, fy: 54, f: frames(key, 96, 58, 46, 54, sc, fr, "#ffc48a"), n: N, snarl: N });   // 0-11 running · 12-23 snarling
  }

  /* ---------- NEW COINS: engraved gold coins with an 8-point ikat star, beaded rim, rotating edge and a gloss sweep ---------- */
  function coinFace(c, th, gem, sweep) {
    const R = 11.2, k = Math.cos(th), ax = Math.max(0.1, Math.abs(k)), side = Math.abs(Math.sin(th)), dir = k >= 0 ? 1 : -1;
    for (let i = Math.ceil(2.6 * side); i >= 1; i--) { c.fillStyle = i % 2 ? "#b27208" : "#9c6208"; c.beginPath(); c.ellipse(-dir * i * 0.9, 0, R * ax, R, 0, 0, TAU); c.fill(); }   // coin thickness
    c.save(); c.scale(ax, 1);
    c.fillStyle = "#c8860f"; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    let g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, gem ? "#fffbd0" : "#fff3a2"); g.addColorStop(0.5, "#f5bd2c"); g.addColorStop(1, "#c98a12");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.93, 0, TAU); c.fill();
    c.fillStyle = "#fff6c0"; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.beginPath(); c.arc(Math.cos(a) * R * 0.83, Math.sin(a) * R * 0.83, 0.55, 0, TAU); c.fill(); }   // beads
    c.strokeStyle = "rgba(120,70,0,.55)"; c.lineWidth = 0.7; c.beginPath(); c.arc(0, 0, R * 0.72, 0, TAU); c.stroke();
    g = c.createRadialGradient(-2, -3, 1, 0, 0, R * 0.7); g.addColorStop(0, "#fff0a0"); g.addColorStop(1, "#e3a01a"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.69, 0, TAU); c.fill();
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU - Math.PI / 2, r = i % 2 ? R * 0.27 : R * 0.6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();   // 8-point star
    g = c.createLinearGradient(-R * 0.5, -R * 0.5, R * 0.5, R * 0.5); g.addColorStop(0, "#fff7c8"); g.addColorStop(1, "#c98512"); c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(120,70,0,.7)"; c.lineWidth = 0.6; c.stroke();
    if (gem) { c.fillStyle = "#53f7ff"; c.beginPath(); c.moveTo(0, -3.2); c.lineTo(2.6, 0); c.lineTo(0, 3.2); c.lineTo(-2.6, 0); c.closePath(); c.fill(); c.fillStyle = "rgba(255,255,255,.8)"; c.beginPath(); c.moveTo(0, -3.2); c.lineTo(1.2, -0.6); c.lineTo(-1.2, -0.6); c.closePath(); c.fill(); }
    else { c.fillStyle = "#9c6208"; c.beginPath(); c.arc(0, 0, 1.5, 0, TAU); c.fill(); c.fillStyle = "#fff6c0"; c.beginPath(); c.arc(-0.4, -0.4, 0.55, 0, TAU); c.fill(); }
    c.save(); c.beginPath(); c.arc(0, 0, R * 0.93, 0, TAU); c.clip();                                // gloss sweep
    const gl = c.createLinearGradient(sweep * R - 4, -R, sweep * R + 4, R); gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(0.5, "rgba(255,255,255,.65)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl; c.fillRect(-R, -R, R * 2, R * 2); c.restore();
    c.restore();
  }
  function coins(sc) {
    const key = "c3:" + sc; if (cache[key]) return cache[key];
    const rs = sc * 1.6, make = (gem) => Array.from({ length: 16 }, (_, i) => {
      const cv = mk(28 * rs, 28 * rs), c = cv.getContext("2d"); c.setTransform(rs, 0, 0, rs, 14 * rs, 14 * rs);
      coinFace(c, (i / 16) * TAU, gem, ((i * 0.37) % 2) - 1); return cv;
    });
    return (cache[key] = { n: make(false), g: make(true), size: 28 });
  }

  /* ---------- BACK VIEW (for the city-street mode): the runner seen from behind ---------- */
  function backFigure(c, P, S) {
    const sq = P.sq || 1, hipY = -26 + (P.bob || 0), sw = P.sway || 0;
    c.save(); c.scale(1 + (1 - sq) * 0.35, sq); c.rotate(P.tilt || 0);
    const leg = (s, lift) => {
      const ax = s * (4.9 + lift * 0.05), ay = -3.4 - lift, kx = s * (6 + lift * 0.12), ky = (hipY + ay) / 2 + lift * 0.1;
      plate(c, s * 4.2, hipY, kx, ky, 9.2, 8, shade(S.arm, -0.08));
      plate(c, kx, ky, ax, ay, 7.6, 6, shade(S.plate, -0.08));
      joint(c, kx, ky, 3.8, S, 0);
      c.fillStyle = shade(S.arm, -0.2); c.beginPath(); c.roundRect(ax - 4.4, ay - 1.6, 8.8, 5.4, 2); c.fill();
      c.strokeStyle = S.glow; c.lineWidth = 1.5; glowOn(c, S.glow, 4); c.beginPath(); c.moveTo(ax - 3.6, ay + 3.7); c.lineTo(ax + 3.6, ay + 3.7); c.stroke(); glowOff(c);
    };
    const arm = (s, sw2, up, hold) => {
      const sx = s * 10.8, sy = -45.5, ex = s * (12.8 + up * 1.5), ey = -38 - up * 12 + sw2 * 3, wx = s * (12 + up * 2.5), wy = -30 - up * 26 + sw2 * 7;
      plate(c, sx, sy, ex, ey, 6.6, 5.6, S.arm); plate(c, ex, ey, wx, wy, 5.6, 5, S.plate); joint(c, ex, ey, 3.2, S, 0);
      blob(c, wx, wy + 1.2, 3.4, 3.2, shade(S.dark, 0.1));
      if (hold && S.baton) { c.strokeStyle = "#14161f"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + 1, wy - 9); c.stroke(); c.strokeStyle = S.glow; c.lineWidth = 2.2; glowOn(c, S.glow, 7); c.beginPath(); c.moveTo(wx + 1, wy - 8); c.lineTo(wx + 1.6, wy - 16); c.stroke(); glowOff(c); }
    };
    const L = P.lift || [0, 0];
    leg(-1, L[0]); leg(1, L[1]);
    blob(c, 0, hipY + 0.5, 8.4, 5.2, S.dark);
    arm(-1, (P.arm || [0, 0])[0], P.up || 0); 
    // torso (back plate)
    let g = c.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, shade(S.arm, -0.55)); g.addColorStop(0.3, S.arm); g.addColorStop(0.5, shade(S.arm, 0.45)); g.addColorStop(0.75, S.arm); g.addColorStop(1, shade(S.arm, -0.6));
    c.fillStyle = g; c.beginPath(); c.moveTo(-6.8, hipY - 1); c.lineTo(-9.4, -46); c.quadraticCurveTo(0, -50.5, 9.4, -46); c.lineTo(6.8, hipY - 1); c.closePath(); c.fill(); c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.7; c.stroke();
    c.fillStyle = S.dark; c.fillRect(-7, hipY - 3, 14, 4.2);
    // jet pack with two nozzles and flames
    g = c.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, shade(S.dark, -0.2)); g.addColorStop(0.5, shade(S.dark, 0.55)); g.addColorStop(1, shade(S.dark, -0.1));
    c.fillStyle = g; c.beginPath(); c.roundRect(-6.4, -45, 12.8, 20, 3.4); c.fill(); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 0.7; c.stroke();
    const fl = 5 + (P.flame || 0) * 5 + (P.boost || 0);
    for (const s of [-1, 1]) {
      const fg = c.createLinearGradient(0, -25, 0, -25 + fl * 1.5); fg.addColorStop(0, S.glow); fg.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = fg;
      c.beginPath(); c.moveTo(s * 3.4 - 1.8, -25); c.lineTo(s * 3.4, -25 + fl * 1.5); c.lineTo(s * 3.4 + 1.8, -25); c.closePath(); c.fill();
      blob(c, s * 3.4, -26, 2.5, 2, S.dark); c.fillStyle = S.glow; glowOn(c, S.glow, 5); c.beginPath(); c.arc(s * 3.4, -25.6, 1.3, 0, TAU); c.fill(); glowOff(c);
    }
    c.strokeStyle = S.glow; c.lineWidth = 1.3; glowOn(c, S.glow, 6); c.beginPath(); c.moveTo(0, -43); c.lineTo(0, -30); c.stroke(); glowOff(c);                    // spine light
    c.strokeStyle = S.acc; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-8.2, -34); c.lineTo(-6.6, -34); c.moveTo(6.6, -34); c.lineTo(8.2, -34); c.stroke();
    // shoulder pods
    for (const s of [-1, 1]) { blob(c, s * 10.8, -45.5, 5.4, 5.2, S.arm); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 0.8; c.beginPath(); c.arc(s * 10.8 - 0.5, -46.5, 3.4, Math.PI * 1.1, Math.PI * 1.75); c.stroke(); }
    // scarf hanging down the back
    if (!S.guard) {
      const w = P.flow || 0, top = [], bot = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8, y = -48 + t * 21, x = Math.sin(w + t * 3.6) * (1.2 + t * 2.4) + sw * t * 3; top.push([x - 2.6 * (1 - t * 0.3), y]); bot.push([x + 2.6 * (1 - t * 0.3), y]); }
      const pts = top.concat(bot.reverse()); const gs = c.createLinearGradient(0, -48, 0, -27); gs.addColorStop(0, shade(S.acc, 0.25)); gs.addColorStop(1, S.acc);
      c.fillStyle = gs; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill();
      c.fillStyle = "#fff6c4"; for (let i = 1; i < 8; i += 2) { const p = top[i], q = bot[bot.length - 1 - i], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; c.beginPath(); c.moveTo(mx, my - 1.2); c.lineTo(mx + 1.2, my); c.lineTo(mx, my + 1.2); c.lineTo(mx - 1.2, my); c.fill(); }
    }
    arm(1, (P.arm || [0, 0])[1], P.up || 0, true);
    // neck + head (seen from behind)
    plate(c, 0, -48, 0, -52, 4.4, 4, S.dark);
    const hy = -59 + (P.nod || 0);
    if (S.siren) {
      const on = Math.floor((P.flow || 0) / 1.6) % 2;
      glowOn(c, on ? "#ff3b4d" : "#3b7bff", 9); c.fillStyle = on ? "#ff3b4d" : "#3b7bff"; c.beginPath(); c.arc(0, hy - 7, 3.6, Math.PI, TAU); c.fill(); glowOff(c);
    } else {
      c.strokeStyle = shade(S.dark, 0.3); c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath(); c.moveTo(-2.4, hy - 6.6); c.quadraticCurveTo(-4 + sw, hy - 10, -3 + sw * 1.5, hy - 12.6); c.stroke();
      glowOn(c, S.acc, 6); c.fillStyle = S.acc; c.beginPath(); c.arc(-3 + sw * 1.5, hy - 12.8, 1.7, 0, TAU); c.fill(); glowOff(c);
    }
    g = c.createRadialGradient(-2, hy - 3, 1, 0, hy, 8); g.addColorStop(0, shade(S.plate, 0.15)); g.addColorStop(1, shade(S.plate, -0.55));
    c.fillStyle = g; c.beginPath(); c.ellipse(0, hy, 7.2, 7.4, 0, 0, TAU); c.fill(); c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.7; c.stroke();
    c.fillStyle = S.arm; c.beginPath(); c.roundRect(-1.5, hy - 7.2, 3, 9, 1.2); c.fill();
    for (const s of [-1, 1]) { blob(c, s * 7.4, hy + 0.6, 2.6, 3, S.dark); c.strokeStyle = S.glow; c.lineWidth = 0.9; glowOn(c, S.glow, 3); c.beginPath(); c.arc(s * 7.4, hy + 0.6, 1.5, 0, TAU); c.stroke(); glowOff(c); }
    c.strokeStyle = S.glow; c.lineWidth = 1.2; glowOn(c, S.glow, 5); c.beginPath(); c.moveTo(-3.4, hy + 5); c.lineTo(3.4, hy + 5); c.stroke(); glowOff(c);
    c.restore();
  }
  function backPose(i, n, o = {}) {
    const p = i / n, a = Math.sin(TAU * p), b = Math.sin(TAU * p + Math.PI);
    return Object.assign({ lift: [Math.max(0, a) * 12, Math.max(0, b) * 12], arm: [b, a], bob: 1.6 * Math.abs(Math.cos(TAU * p)) - 0.6, sway: Math.sin(TAU * p) * 0.6, flow: p * TAU * 2, flame: 0.5 + 0.5 * Math.sin(TAU * p * 2), tilt: Math.sin(TAU * p) * 0.025 }, o);
  }
  function runnerBack(skin, sc) {
    const key = "rb:" + skin + ":" + sc; if (cache[key]) return cache[key];
    const S = LOOKS[skin] || LOOKS.default, N = 12;
    const run = Array.from({ length: N }, (_, i) => (c) => backFigure(c, backPose(i, N), S));
    const extra = [
      (c) => backFigure(c, backPose(0, N, { lift: [8, 11], arm: [0, 0], up: 0.8, bob: -1, boost: 4, flow: 2.4 }), S),                           // jump
      (c) => backFigure(c, backPose(1, N, { sq: 0.56, lift: [0, 0], arm: [-0.6, -0.6], bob: 4, nod: 2 }), S),                                 // slide
      (c) => backFigure(c, backPose(0, N, { lift: [3, 0], up: 1, arm: [0, 0], tilt: 0.12, nod: 1, flow: 3 }), S),                                // hit
    ];
    return (cache[key] = { w: 48, h: 80, fx: 24, fy: 76, f: frames(key, 48, 80, 24, 76, sc, run.concat(extra), "#ffb97a"), n: N, jump: N, slide: N + 1, hit: N + 2, unit: 1.85 / 59 });
  }
  function guardBack(sc) {
    const key = "gb:" + sc; if (cache[key]) return cache[key];
    const N = 12, run = Array.from({ length: N }, (_, i) => (c) => backFigure(c, backPose(i, N, { arm: [Math.sin(TAU * i / N + Math.PI), -0.2] }), GUARD));
    return (cache[key] = { w: 48, h: 80, fx: 24, fy: 76, f: frames(key, 48, 80, 24, 76, sc, run, "#ffa66b"), n: N, unit: 1.85 / 59 });
  }
  function dogBackFig(c, p, S) {
    const a = Math.sin(TAU * p), b = Math.sin(TAU * p + Math.PI), lf = [Math.max(0, a) * 7, Math.max(0, b) * 7], sh = Math.sin(TAU * p) * 0.8;
    const paw = (x, y, w, col) => { blob(c, x, y, w, 2.6, col); };
    for (const s of [-1, 1]) { const l = lf[s < 0 ? 1 : 0]; plate(c, s * 3.6, -13, s * 3.8, -3.6 - l * 0.7, 4.6, 3.6, shade(S.metal, -0.4)); paw(s * 3.8, -2.6 - l * 0.7, 2.7, shade(S.dark, 0)); }
    const tw = Math.sin(TAU * p * 2) * 2;
    c.strokeStyle = S.dark; c.lineWidth = 2.4; c.lineCap = "round"; c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(tw, -24, tw * 1.6, -30); c.stroke();
    glowOn(c, S.glow, 6); c.fillStyle = S.glow; c.beginPath(); c.arc(tw * 1.6, -30.6, 1.9, 0, TAU); c.fill(); glowOff(c);
    let g = c.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, shade(S.metal, -0.5)); g.addColorStop(0.45, shade(S.metal, 0.4)); g.addColorStop(1, shade(S.metal, -0.55));
    c.fillStyle = g; c.beginPath(); c.ellipse(sh * 0.4, -16, 10.5, 9, 0, 0, TAU); c.fill(); c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.7; c.stroke();
    for (const s of [-1, 1]) { const l = lf[s < 0 ? 0 : 1]; plate(c, s * 6.4, -14, s * 7.2, -4 - l, 7.4, 4.6, S.metal); joint(c, s * 7, -9 - l * 0.5, 2.8, { dark: S.dark, acc: S.acc }, 0); paw(s * 7.4, -2.6 - l, 3.2, S.dark); }
    c.strokeStyle = S.glow; c.lineWidth = 1.2; glowOn(c, S.glow, 5); c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -12); c.stroke(); glowOff(c);
    g = c.createRadialGradient(-1, -27, 1, 0, -25, 6); g.addColorStop(0, shade(S.metal, 0.3)); g.addColorStop(1, shade(S.metal, -0.5)); c.fillStyle = g; c.beginPath(); c.ellipse(sh * 0.3, -25, 4.8, 4.6, 0, 0, TAU); c.fill();
    c.fillStyle = S.dark; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.4, -28); c.lineTo(s * 4.8, -34); c.lineTo(s * 4.4, -28); c.closePath(); c.fill(); }
    c.strokeStyle = S.acc; c.lineWidth = 2; glowOn(c, S.acc, 4); c.beginPath(); c.moveTo(-4, -22); c.lineTo(4, -22); c.stroke(); glowOff(c);
  }
  function dogBack(sc) {
    const key = "db:" + sc; if (cache[key]) return cache[key];
    const N = 12, fr = Array.from({ length: N }, (_, i) => (c) => dogBackFig(c, i / N, DM));
    return (cache[key] = { w: 40, h: 44, fx: 20, fy: 40, f: frames(key, 40, 44, 20, 40, sc, fr, "#ffc48a"), n: N, unit: 1.2 / 30 });
  }

  return { runner, guard, dog, coins, runnerBack, guardBack, dogBack, LOOKS, GUARD, mk };
})();
