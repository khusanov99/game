/* =====================================================
   RIG — skeleton-animated 2D characters (side view for the main game, back view for the 2.5D city run).
   ZUMA the duck-bot (hero), the hawk-bot chaser and the robotic wolf pup are built from simple shaded volumes,
   inverse-kinematics legs, swinging wings and flowing scarf, drawn ONCE into small offscreen canvases; the game only
   calls drawImage per frame, so it costs the same as a plain picture on any phone. All three share one compact scale.

   API:  Rig.runner(skinId, scale) · Rig.guard(scale) · Rig.dog(scale) · Rig.runnerBack / guardBack / dogBack
   Each returns { w, h, fx, fy, f:[canvases], n:runFrames, … }
===================================================== */
const Rig = (() => {
  const TAU = Math.PI * 2,
    K = 0.9; // K: natural units → game units
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  };
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function shade(hex, k) {
    // k<0 darker, k>0 lighter
    const n = parseInt(hex.slice(1), 16),
      r = n >> 16,
      g = (n >> 8) & 255,
      b = n & 255;
    const f = (v) =>
      Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
    return (
      "#" +
      [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")
    );
  }
  const pt = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l]; // angle from straight down, + = forward
  const angOf = (x1, y1, x2, y2) => Math.atan2(x2 - x1, y2 - y1);
  function ik(hx, hy, tx, ty, l1, l2, dir) {
    // two-bone inverse kinematics → joint + reachable end
    const dx = tx - hx,
      dy = ty - hy;
    const d = clamp(
        Math.hypot(dx, dy),
        Math.abs(l1 - l2) + 0.05,
        l1 + l2 - 0.05,
      ),
      base = Math.atan2(dy, dx);
    const A = Math.acos(
        clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1),
      ),
      a = base + dir * A;
    return [
      hx + Math.cos(a) * l1,
      hy + Math.sin(a) * l1,
      hx + Math.cos(base) * d,
      hy + Math.sin(base) * d,
    ];
  }

  /* ---------- shaded limb (tapered capsule, lit from the upper-front) ---------- */
  function limb(c, x1, y1, x2, y2, w1, w2, col) {
    const dx = x2 - x1,
      dy = y2 - y1,
      L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L,
      ny = dx / L;
    if (nx * 0.5 + ny * -0.85 < 0) {
      nx = -nx;
      ny = -ny;
    }
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2,
      wm = Math.max(w1, w2) / 2;
    const g = c.createLinearGradient(
      mx + nx * wm,
      my + ny * wm,
      mx - nx * wm,
      my - ny * wm,
    );
    g.addColorStop(0, shade(col, 0.24));
    g.addColorStop(0.45, col);
    g.addColorStop(1, shade(col, -0.45));
    const a = Math.atan2(dy, dx);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x1, y1, w1 / 2, a + Math.PI / 2, a + Math.PI * 1.5);
    c.arc(x2, y2, w2 / 2, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
    c.fill();
  }
  const blob = (c, x, y, rx, ry, col, rot = 0) => {
    const g = c.createRadialGradient(
      x - rx * 0.35,
      y - ry * 0.4,
      0.3,
      x,
      y,
      Math.max(rx, ry) * 1.1,
    );
    g.addColorStop(0, shade(col, 0.25));
    g.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
    c.fill();
  };
  const egg = (c, x, y, rx, ry, col) => {
    // bright glossy shell: light top-left, soft shade at the rim
    const g = c.createRadialGradient(
      x - rx * 0.35,
      y - ry * 0.45,
      0.5,
      x,
      y,
      Math.max(rx, ry) * 1.15,
    );
    g.addColorStop(0, shade(col, 0.55));
    g.addColorStop(0.55, col);
    g.addColorStop(1, shade(col, -0.28));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
  };
  function poly(c, pts, close = true) {
    // smooth closed shape through points
    const n = pts.length;
    c.beginPath();
    if (close) {
      let m = [
        (pts[n - 1][0] + pts[0][0]) / 2,
        (pts[n - 1][1] + pts[0][1]) / 2,
      ];
      c.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) {
        const p = pts[i],
          q = pts[(i + 1) % n];
        c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      c.closePath();
    } else {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++)
        c.quadraticCurveTo(
          pts[i][0],
          pts[i][1],
          (pts[i][0] + pts[i + 1][0]) / 2,
          (pts[i][1] + pts[i + 1][1]) / 2,
        );
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  /* ---------- robot looks ---------- */
  const LOOKS = {
    // arm = main armour · plate = light plates · dark = joints · glow = eyes/core/soles · acc = accent
    default: {
      arm: "#1f6bff",
      plate: "#f4f8ff",
      dark: "#10142b",
      glow: "#35e6ff",
      acc: "#1f6bff",
      body: "#f6f9ff",
      trim: "#1f6bff",
    },
    rose: {
      arm: "#ff4fa8",
      plate: "#fff4f8",
      dark: "#2f1d3e",
      glow: "#ffd84f",
      acc: "#ff4fa8",
      body: "#fff6fa",
      trim: "#ff4fa8",
    },
    mint: {
      arm: "#17c28c",
      plate: "#f2fffa",
      dark: "#173a38",
      glow: "#a78bfa",
      acc: "#17c28c",
      body: "#f4fffb",
      trim: "#17c28c",
    },
    gold: {
      arm: "#ff9d1a",
      plate: "#fffaf0",
      dark: "#33220e",
      glow: "#ff7a59",
      acc: "#ff9d1a",
      body: "#fffaf0",
      trim: "#ff9d1a",
    },
  };
  const GUARD = {
    arm: "#d92b3c",
    plate: "#f4f6ff",
    dark: "#10152c",
    glow: "#ff3b4d",
    acc: "#ffd84f",
    siren: true,
    baton: true,
    guard: true,
    rim: "#ffa66b",
  };

  /* metallic limb: a sharp highlight stripe + dark edge, so it reads as polished armour */
  function plate(c, x1, y1, x2, y2, w1, w2, col) {
    const dx = x2 - x1,
      dy = y2 - y1,
      L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L,
      ny = dx / L;
    if (nx * 0.5 + ny * -0.85 < 0) {
      nx = -nx;
      ny = -ny;
    }
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2,
      wm = Math.max(w1, w2) / 2;
    const g = c.createLinearGradient(
      mx + nx * wm,
      my + ny * wm,
      mx - nx * wm,
      my - ny * wm,
    );
    g.addColorStop(0, shade(col, 0.1));
    g.addColorStop(0.22, shade(col, 0.6));
    g.addColorStop(0.34, shade(col, 0.15));
    g.addColorStop(0.7, shade(col, -0.2));
    g.addColorStop(1, shade(col, -0.62));
    const a = Math.atan2(dy, dx);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x1, y1, w1 / 2, a + Math.PI / 2, a + Math.PI * 1.5);
    c.arc(x2, y2, w2 / 2, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.25)";
    c.lineWidth = 0.6;
    c.stroke();
  }
  const glowOn = (c, col, b) => {
    c.shadowColor = col;
    c.shadowBlur = b;
  };
  const glowOff = (c) => {
    c.shadowBlur = 0;
    c.shadowColor = "transparent";
  };
  function joint(c, x, y, r, S, dark) {
    // dark ball joint with a thin glowing ring
    blob(c, x, y, r, r, shade(S.dark, dark || 0));
    c.strokeStyle = shade(S.acc, (dark || 0) * 0.6);
    c.lineWidth = 0.9;
    c.beginPath();
    c.arc(x, y, r * 0.62, 0, TAU);
    c.stroke();
  }

  /* ---------- the robot figure ---------- */
  /* ---------- the robot figures: ZUMA the duck-bot, the hawk-bot chaser (same code, different palette / head) ----------
     Side view, facing right, feet on y = 0. ~54 units tall (a chibi: big round head, egg body, short legs) so every robot in the game shares one scale. */
  const PAL = (S) =>
    S.guard
      ? {
          body: "#f1f4ff",
          belly: "#d3172e",
          trim: "#d3172e",
          beak: "#e9a23b",
          beakD: "#b87420",
          leg: "#8a93ad",
        }
      : {
          body: S.body || "#ffd23a",
          belly: "#e6eeff",
          trim: S.trim || "#19c6d6",
          beak: "#ff8a1c",
          beakD: "#e56a08",
          leg: S.trim || "#1f6bff",
        };
  const star8 = (c, x, y, r, col) => {
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2,
        rr = i & 1 ? r * 0.5 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  };
  function figure(c, P, S) {
    const G = !!S.guard,
      Pl = PAL(S),
      lean = P.lean * 0.7,
      hx = P.hx || 0,
      hipH = P.hipH * 0.62,
      hipY = -hipH,
      ux = Math.sin(lean),
      uy = -Math.cos(lean),
      fx = Math.cos(lean),
      fy = Math.sin(lean);
    const bx = hx + ux * 11 - 1,
      by = hipY + uy * 11 + (P.drop || 0) * 0.3,
      hcx = hx + ux * 25 + fx * 2.2,
      hcy = hipY + uy * 25 + fy * 2.2 + (P.drop || 0) * 0.5,
      flow = P.flow || 0;
    c.save();
    c.scale(0.92, 0.92);
    const leg = (spec, near) => {
      const dk = near ? 0 : -0.4,
        lf = P.hipH - 3.3 - spec[1],
        [kx, ky, ax, ay] = ik(
          hx,
          hipY,
          hx + spec[0] * 0.72,
          -2.2 - lf * 0.62,
          10.5,
          10.5,
          -1,
        );
      plate(c, hx, hipY, kx, ky, 6.4, 5.2, shade(Pl.leg, dk));
      plate(c, kx, ky, ax, ay, 5.2, 4.2, shade(Pl.leg, dk - 0.05));
      blob(c, kx, ky, 2.6, 2.6, shade(G ? "#e9a23b" : "#ffd23a", dk));
      c.save();
      c.translate(ax, ay);
      c.rotate(spec[2] * 0.6);
      blob(c, 3.4, 1.4, 6.6, 2.5, shade(Pl.beak, dk)); // webbed foot
      c.strokeStyle = shade(Pl.beakD, dk);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(1.5, 1.4);
      c.lineTo(8.6, 1.4);
      c.moveTo(3, 0.2);
      c.lineTo(8, 0.9);
      c.stroke();
      c.restore();
    };
    const wing = (a, f, near) => {
      const dk = near ? 0 : -0.4,
        sx = bx + 1.5 + fx * 2,
        sy = by - 2.5,
        [ex, ey] = pt(sx, sy, a, 6.8),
        [tx, ty] = pt(ex, ey, f, 6.4);
      plate(
        c,
        sx,
        sy,
        ex,
        ey,
        7.2,
        6.4,
        shade(G ? Pl.trim : Pl.body, dk - 0.12),
      );
      plate(c, ex, ey, tx, ty, 6.2, 4.6, shade(Pl.trim, dk));
      blob(c, sx, sy, 3.2, 3.2, shade("#ffd84f", dk));
      if (near && S.baton) {
        const bxn = Math.sin(f + 0.35),
          byn = Math.cos(f + 0.35);
        c.strokeStyle = "#14161f";
        c.lineWidth = 2.2;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(tx - bxn * 2, ty - byn * 2);
        c.lineTo(tx + bxn * 11, ty + byn * 11);
        c.stroke();
        c.strokeStyle = S.glow;
        c.lineWidth = 2;
        glowOn(c, S.glow, 6);
        c.beginPath();
        c.moveTo(tx + bxn * 11, ty + byn * 11);
        c.lineTo(tx + bxn * 16, ty + byn * 16);
        c.stroke();
        glowOff(c);
      }
    };
    wing(P.aB[0], P.aB[1], false);
    leg(P.lb, false);
    // tail feathers + jet flame
    if (P.boost) {
      const fl = 6 + P.boost + 3 * Math.sin(flow * 2),
        g = c.createLinearGradient(bx - 14, 0, bx - 14 - fl * 1.6, 0);
      g.addColorStop(0, S.glow);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(bx - 13, by + 1);
      c.lineTo(bx - 14 - fl * 1.6, by + 3.4);
      c.lineTo(bx - 13, by + 6);
      c.closePath();
      c.fill();
    }
    c.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const a =
        -2.5 - i * 0.34 + Math.sin(flow + i) * 0.07 + (P.tailDrop || 0) * 0.03;
      c.strokeStyle = i ? Pl.trim : "#ffd84f";
      c.lineWidth = 4.2;
      c.beginPath();
      c.moveTo(bx - 12, by + 1);
      c.lineTo(bx - 12 + Math.cos(a) * 11, by + 1 + Math.sin(a) * 11);
      c.stroke();
    }
    // body: glossy egg, belly plate, star core
    c.save();
    c.translate(bx, by);
    c.rotate(lean * 0.55);
    egg(c, 0, 0, 15.5, 14, Pl.body);
    c.strokeStyle = "rgba(255,255,255,.4)";
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(0, 0, 11.5, Math.PI * 1.05, Math.PI * 1.55);
    c.stroke(); // gloss
    blob(c, 5.2, 2.4, 9, 10.4, G ? Pl.belly : Pl.belly);
    c.fillStyle = G ? "#e9a23b" : "#3a56e8";
    c.beginPath();
    c.roundRect(-3.6, 6.4, 18, 3.2, 1.4);
    c.fill(); // belt (ikat band / bronze)
    c.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-1.2 + i * 4.4, 8);
      c.lineTo(0.2 + i * 4.4, 6.8);
      c.lineTo(1.6 + i * 4.4, 8);
      c.lineTo(0.2 + i * 4.4, 9.2);
      c.closePath();
      c.fill();
    }
    glowOn(c, S.glow, 6);
    star8(c, 5.6, -0.6, 4.6, "#ffd84f");
    c.fillStyle = S.glow;
    c.beginPath();
    c.arc(5.6, -0.6, 1.7 + 0.3 * Math.sin(flow * 2), 0, TAU);
    c.fill();
    glowOff(c);
    c.restore();
    leg(P.la, true);
    // scarf
    if (!G) {
      const x0 = hcx - 4,
        y0 = hcy + 10,
        top = [],
        bot = [],
        drop = P.drop || 0;
      for (let i = 0; i <= 7; i++) {
        const t = i / 7,
          x = x0 - t * 20 + Math.sin(flow + t * 4.2) * 1.2,
          y = y0 + Math.sin(flow * 1.1 + t * 4.4) * 2.6 * t + drop * t * t * 6,
          wd = 2.3 * (1 - 0.45 * t);
        top.push([x, y - wd]);
        bot.push([x, y + wd]);
      }
      const pts = top.concat(bot.reverse());
      c.fillStyle = S.acc;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff6c4";
      for (let i = 1; i < 7; i += 2) {
        const p = top[i],
          q = bot[bot.length - 1 - i];
        c.beginPath();
        c.arc((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 1, 0, TAU);
        c.fill();
      }
    }
    // head
    c.save();
    c.translate(hcx, hcy);
    c.rotate((P.tilt || 0) * 0.5 + lean * 0.3);
    egg(c, 0, 0, 13, 12, Pl.body);
    c.strokeStyle = "rgba(255,255,255,.4)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 9.6, Math.PI * 1.1, Math.PI * 1.55);
    c.stroke();
    const sg = c.createRadialGradient(3, -2, 1, 4, 0.5, 10);
    sg.addColorStop(0, "#26304f");
    sg.addColorStop(1, "#05060f");
    c.fillStyle = sg;
    c.beginPath();
    c.ellipse(3.8, 0.8, 9, 8.2, 0, 0, TAU);
    c.fill(); // face screen
    c.fillStyle = "rgba(255,255,255,.14)";
    c.beginPath();
    c.ellipse(1, -3.2, 4.6, 1.8, -0.35, 0, TAU);
    c.fill();
    const hit = P.brow < 0,
      blink = P.eye === 1 && !hit,
      happy = !hit && !G && (P.mouth || 0) > 0.2 && (P.mouth || 0) < 0.8;
    glowOn(c, S.glow, 6);
    c.strokeStyle = S.glow;
    c.fillStyle = S.glow;
    c.lineWidth = 1.7;
    c.lineCap = "round";
    if (G) {
      c.beginPath();
      c.roundRect(-0.6, -2.2, 12, 3.2, 1.5);
      c.fill();
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0.4, -5.4 + (P.brow || 0) * 0.6);
      c.lineTo(10, -3.2);
      c.stroke();
    } else if (hit) {
      c.beginPath();
      c.moveTo(4, -3.6);
      c.lineTo(8.2, 0.6);
      c.moveTo(8.2, -3.6);
      c.lineTo(4, 0.6);
      c.stroke();
    } else if (blink) {
      c.beginPath();
      c.moveTo(4, -1);
      c.lineTo(8.6, -1);
      c.stroke();
    } else if (happy) {
      c.beginPath();
      c.moveTo(3.6, 0);
      c.quadraticCurveTo(6.2, -4.2, 8.8, 0);
      c.stroke();
    } else {
      c.beginPath();
      c.ellipse(6.2, -1.6, 1.9, 3.1, 0, 0, TAU);
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(6.8, -2.8, 0.7, 0, TAU);
      c.fill();
    }
    glowOff(c);
    if (!G) {
      c.fillStyle = "rgba(255,110,160,.85)";
      c.beginPath();
      c.ellipse(3.2, 3.6, 1.7, 1.1, 0, 0, TAU);
      c.fill();
    }
    const mo = P.mouth || 0; // bill
    c.fillStyle = Pl.beakD;
    c.beginPath();
    c.moveTo(9, 3.2 + mo * 1.4);
    c.quadraticCurveTo(17, 4 + mo * 4, 15.5, 6.4 + mo * 3);
    c.quadraticCurveTo(11, 7.4 + mo * 2, 8.6, 5.4 + mo);
    c.closePath();
    c.fill();
    c.fillStyle = Pl.beak;
    c.beginPath();
    if (G) {
      c.moveTo(9, -0.6);
      c.quadraticCurveTo(17.5, 0.2, 18.4, 5.4);
      c.quadraticCurveTo(15, 3.6, 12.8, 3.8);
      c.lineTo(8.8, 3.6);
      c.closePath();
    } else {
      c.moveTo(8.6, 0.4);
      c.quadraticCurveTo(18.5, 0.4, 18.2, 3.6);
      c.quadraticCurveTo(15, 5.6, 8.8, 4);
      c.closePath();
    }
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.45)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(10.5, 1.2);
    c.quadraticCurveTo(14, 1, 16.2, 2.2);
    c.stroke();
    blob(c, -2.6, 2.4, 2.7, 2.7, "#ffd84f");
    glowOn(c, S.glow, 4);
    c.fillStyle = S.glow;
    c.beginPath();
    c.arc(-2.6, 2.4, 1.1, 0, TAU);
    c.fill();
    glowOff(c); // ear LED disc
    if (G) {
      // crest + police beacon
      for (let i = -1; i <= 1; i++) {
        c.fillStyle = i ? "#d3172e" : "#e9a23b";
        c.beginPath();
        c.moveTo(-2 + i * 4, -9.5);
        c.lineTo(-7 + i * 5.6, -18 - (i === 0 ? 3 : 0));
        c.lineTo(1 + i * 4, -10);
        c.closePath();
        c.fill();
      }
      const on = Math.floor(flow * 1.2) % 2;
      glowOn(c, on ? "#ff3b4d" : "#4f7bff", 8);
      c.fillStyle = on ? "#ff3b4d" : "#4f7bff";
      c.beginPath();
      c.arc(-1, -11.4, 2.4, 0, TAU);
      c.fill();
      glowOff(c);
    } else {
      // ribbed turquoise doppi + gold finial
      c.save();
      c.beginPath();
      c.ellipse(-0.5, -8.6, 10.6, 8, 0, Math.PI, TAU);
      c.closePath();
      const dg = c.createLinearGradient(0, -17, 0, -8);
      dg.addColorStop(0, shade(Pl.trim, 0.45));
      dg.addColorStop(1, shade(Pl.trim, -0.2));
      c.fillStyle = dg;
      c.fill();
      c.clip();
      c.strokeStyle = "rgba(255,216,79,.8)";
      c.lineWidth = 0.8;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(-0.5, -16.4);
        c.quadraticCurveTo(i * 5, -13, i * 6.6 - 0.5, -8.4);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "#3a56e8";
      c.beginPath();
      c.roundRect(-11.4, -9.8, 21.8, 2.8, 1.2);
      c.fill();
      c.fillStyle = "#fff";
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(-8.4 + i * 4.2, -8.4, 0.9, 0, TAU);
        c.fill();
      }
      c.strokeStyle = "#ffd84f";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-0.5, -16.4);
      c.lineTo(-0.5, -19.4);
      c.stroke();
      glowOn(c, S.glow, 6);
      c.fillStyle = S.glow;
      c.beginPath();
      c.arc(-0.5, -20.2, 1.5, 0, TAU);
      c.fill();
      glowOff(c);
    }
    c.restore();
    wing(P.aA[0], P.aA[1], true);
    c.restore();
  }

  const foot = (u, o) => {
    // foot path: [x, lift, pitch] relative to the hip
    const S0 = 0.38;
    if (u < S0) {
      const s = u / S0;
      return [o.xf + (o.xb - o.xf) * s, 0, -0.16 + 0.8 * Math.pow(s, 2.4)];
    }
    const s = (u - S0) / (1 - S0),
      e = s * s * (3 - 2 * s);
    return [
      o.xb + (o.xf - o.xb) * e,
      o.lift * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04)), 1.15),
      0.8 - 1.0 * Math.min(1, s * 1.1),
    ];
  };
  function runPose(ph, o = {}) {
    // one full stride, ph 0..1
    const bob = 0.5 - 0.5 * Math.cos(2 * TAU * (ph - 0.2)),
      hipH = 27.4 + 2.4 * bob * (o.bounce === undefined ? 1 : o.bounce);
    const fo = {
      xf: 12.5 * (o.stride || 1),
      xb: -15.5 * (o.stride || 1),
      lift: 17 * (o.knee || 1),
    };
    const mk2 = (u) => {
      const [x, lift, pitch] = foot(u, fo);
      return [x, hipH - 3.3 - lift, pitch];
    };
    const sw = Math.cos(TAU * ph),
      swB = Math.cos(TAU * (ph + 0.5)),
      amp = o.arms || 1.0;
    const lean =
      (o.lean === undefined ? 0.26 : o.lean) +
      0.035 * Math.sin(2 * TAU * (ph - 0.1));
    const P = {
      hipH,
      lean,
      la: mk2(ph),
      lb: mk2((ph + 0.5) % 1),
      aA: [-amp * sw + 0.12, -amp * sw + 0.12 + 1.38 + 0.28 * sw],
      aB: [-amp * swB + 0.12, -amp * swB + 0.12 + 1.38 + 0.28 * swB],
      tilt: -lean * 0.45 + 0.02 * Math.sin(2 * TAU * ph),
      flow: ph * TAU * 2,
      mouth: o.mouth || 0,
      brow: o.brow || 0,
      eye: o.eye || 0,
      drop: 0,
      tailDrop: Math.sin(2 * TAU * ph) * 1.5,
    };
    if (o.holdArm) {
      P.aA = [0.95 + 0.12 * sw, 1.95 + 0.1 * sw];
    }
    return P;
  }
  const POSES = {
    jump: {
      hipH: 27.5,
      lean: 0.12,
      la: [13, 12, 0.5],
      lb: [-9, 23, 1.15],
      aA: [2.35, 2.7],
      aB: [-0.9, 0.1],
      tilt: -0.1,
      flow: 1.3,
      mouth: 0.5,
      drop: -1.5,
    },
    fall: {
      hipH: 28,
      lean: 0.06,
      la: [5, 25, 0.35],
      lb: [-3, 24.5, 0.1],
      aA: [1.65, 1.95],
      aB: [-1.45, -1.75],
      tilt: -0.04,
      flow: 2.2,
      mouth: 0.3,
      drop: 2,
    },
    land: {
      hipH: 17.5,
      lean: 0.62,
      la: [14, 14.2, -0.1],
      lb: [9, 14, -0.1],
      aA: [1.25, 2.0],
      aB: [0.5, 1.5],
      tilt: -0.28,
      flow: 0.4,
      brow: 0.5,
      drop: 0,
    },
    duck: {
      hx: -3,
      hipH: 7.5,
      lean: -1.12,
      la: [27, 4.4, -0.12],
      lb: [23, 5.6, 0.05],
      aA: [1.5, 1.8],
      aB: [0.6, 0.9],
      tilt: 1.0,
      flow: 0.3,
      brow: 0.4,
      drop: 0,
    },
    hit: {
      hipH: 26.5,
      lean: -0.38,
      la: [-6, 23.4, 1.1],
      lb: [9, 23.4, 0.0],
      aA: [2.65, 2.95],
      aB: [-2.3, -2.6],
      tilt: 0.35,
      flow: 2.6,
      mouth: 1,
      eye: 1,
      brow: -0.8,
      drop: 3,
    },
  };

  /* ---------- rim light: a warm back-light on the edges facing up/back ---------- */
  function rim(cv, color, sc) {
    const t = mk(cv.width, cv.height),
      g = t.getContext("2d");
    g.drawImage(cv, 0, 0);
    g.globalCompositeOperation = "destination-out";
    g.drawImage(cv, 1.5 * sc, 1.3 * sc);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, t.width, t.height);
    const c = cv.getContext("2d");
    c.globalAlpha = 0.9;
    c.drawImage(t, 0, 0);
    c.globalAlpha = 1;
  }

  const cache = {};
  function frames(key, W, Ht, fx, fy, sc, fns, rimCol) {
    const rs = sc * 1.55; // the sheets are drawn sharper than the screen needs
    return fns.map((fn) => {
      const cv = mk(W * rs, Ht * rs),
        c = cv.getContext("2d");
      c.imageSmoothingQuality = "high";
      c.setTransform(rs, 0, 0, rs, 0, 0);
      c.translate(fx, fy);
      c.scale(K, K);
      fn(c);
      rim(cv, rimCol, rs);
      return cv;
    });
  }

  function runner(skin, sc) {
    const key = "r:" + skin + ":" + sc;
    if (cache[key]) return cache[key];
    const S = LOOKS[skin] || LOOKS.default;
    const N = 12,
      run = Array.from(
        { length: N },
        (_, i) => (c) => figure(c, runPose(i / N, { eye: i === 7 ? 1 : 0 }), S),
      );
    const poses = ["jump", "fall", "land", "duck", "hit"].map(
      (n) => (c) => figure(c, POSES[n], S),
    );
    // 0..11 run · 12 jump · 13 fall · 14 land · 15 duck(slide) · 16 hit
    return (cache[key] = {
      w: 84,
      h: 78,
      fx: 42,
      fy: 74,
      f: frames(key, 84, 78, 42, 74, sc, run.concat(poses), "#ffb97a"),
      n: N,
      jump: 12,
      fall: 13,
      land: 14,
      duck: 15,
      hit: 16,
    });
  }
  function guard(sc) {
    const key = "g:" + sc;
    if (cache[key]) return cache[key];
    const S = GUARD,
      N = 12;
    const run = Array.from(
      { length: N },
      (_, i) => (c) =>
        figure(
          c,
          runPose(i / N, {
            lean: 0.3,
            arms: 0.8,
            holdArm: true,
            mouth: 0.7,
            brow: 0.9,
            stride: 1.06,
          }),
          S,
        ),
    );
    const swing = (c) =>
      figure(
        c,
        {
          hipH: 25,
          lean: 0.55,
          la: [11, 21.6, 0.3],
          lb: [-8, 20.5, 0.5],
          aA: [2.75, 3.05],
          aB: [0.7, 1.7],
          tilt: -0.3,
          flow: 1.5,
          mouth: 1,
          brow: 1,
          tailDrop: -2,
        },
        S,
      );
    return (cache[key] = {
      w: 90,
      h: 82,
      fx: 44,
      fy: 78,
      f: frames(key, 90, 82, 44, 78, sc, run.concat([swing]), "#ffa66b"),
      n: N,
      swing: N,
    });
  }

  /* ---------- the robot hound (rotary gallop) ---------- */
  const DM = {
      metal: "#9aa5bd",
      dark: "#222737",
      glow: "#ff3b4d",
      acc: "#ff9a2e",
    },
    PUP = {
      fur: "#f1f4ff",
      dark: "#1a1e30",
      glow: "#ff3b4d",
      bronze: "#e0293a",
    };
  const dFoot = (u, front) => {
    // [x, lift] relative to the shoulder / hip joint
    const S0 = 0.34,
      xf = front ? 13.5 : 10.5,
      xb = front ? -9 : -16;
    if (u < S0) return [xf + (xb - xf) * (u / S0), 0];
    const s = (u - S0) / (1 - S0),
      e = s * s * (3 - 2 * s);
    return [
      xb + (xf - xb) * e,
      (front ? 11 : 12.5) * Math.pow(Math.sin(Math.PI * s), 1.1),
    ];
  };
  function dogFig(c, ph, snarl) {
    // "Bo'ri": a small robotic wolf pup — round, big-eared, bronze collar, plume tail
    const bobF = -1.8 * Math.sin(TAU * (2 * ph) + 0.5),
      bobH = -1.8 * Math.sin(TAU * (2 * ph) - 0.3),
      S = PUP;
    const shx = 8,
      shy = -11 + bobF,
      hpx = -10,
      hpy = -11 + bobH;
    const leg = (jx, jy, u, front, near) => {
      const dk = near ? 0 : -0.4,
        [fx, lift] = dFoot(u % 1, front),
        [kx, ky, ax, ay] = ik(
          jx,
          jy,
          jx + fx * 0.62,
          -2 - lift * 0.55,
          7.2,
          7.6,
          front ? 1 : -1,
        );
      plate(c, jx, jy, kx, ky, 6.4, 4.6, shade(S.fur, dk));
      plate(c, kx, ky, ax, ay, 4.4, 3.4, shade(S.dark, 0.25 + dk));
      blob(c, ax + 1.4, ay + 0.8, 3.6, 2.2, shade(S.bronze, dk));
    };
    leg(hpx, hpy + 2, ph, false, false);
    leg(shx, shy + 2, ph + 0.5, true, false);
    const tw = Math.sin(TAU * 2 * ph); // plume tail
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      blob(
        c,
        hpx - 8 - t * 6 + tw * t * 2,
        hpy - 6 - t * 9 + tw * 2 * t,
        4.4 - t * 1.4,
        3.2 - t * 0.8,
        i & 1 ? S.bronze : S.fur,
        -0.9,
      );
    }
    c.save();
    c.translate(-2, -14);
    c.rotate(0.04 * Math.sin(TAU * 2 * ph + 0.2));
    c.translate(2, 14);
    blob(c, -1, -14 + (bobF + bobH) / 4, 16, 9.6, S.fur);
    c.strokeStyle = "rgba(255,255,255,.35)";
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(-1, -14 + (bobF + bobH) / 4, 11.5, Math.PI * 1.1, Math.PI * 1.55);
    c.stroke();
    c.strokeStyle = S.bronze;
    c.lineWidth = 2.2;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-12, -21 + bobH * 0.6);
    c.quadraticCurveTo(-2, -24.6, 9, -21.6 + bobF * 0.6);
    c.stroke();
    c.strokeStyle = S.glow;
    c.lineWidth = 1;
    glowOn(c, S.glow, 4);
    c.beginPath();
    c.moveTo(-8, -19.6);
    c.lineTo(5, -19.6);
    c.stroke();
    glowOff(c);
    const hx = 18.5,
      hy = -22 + bobF * 0.8;
    blob(c, 12.5, hy + 3, 3.4, 4.2, S.bronze);
    glowOn(c, S.glow, 4);
    c.fillStyle = S.glow;
    c.beginPath();
    c.arc(13.6, hy + 7.2, 1.3, 0, TAU);
    c.fill();
    glowOff(c); // collar + tag
    c.save();
    c.translate(hx, hy);
    c.rotate(0.05 - snarl * 0.1);
    for (const e of [
      [-3, -7.5, 0.1],
      [3.2, -8, 0.38],
    ]) {
      c.save();
      c.translate(e[0], e[1]);
      c.rotate(e[2]);
      c.fillStyle = S.dark;
      c.beginPath();
      c.moveTo(-3.6, 1);
      c.lineTo(0, -9 - snarl * 1.4);
      c.lineTo(3.8, 1);
      c.closePath();
      c.fill();
      c.fillStyle = S.glow;
      c.globalAlpha = 0.6;
      c.beginPath();
      c.moveTo(-1.6, 0.6);
      c.lineTo(0, -5.6);
      c.lineTo(1.8, 0.6);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
      c.restore();
    }
    const jaw = snarl * 0.55 + 0.08;
    c.save();
    c.translate(3.4, 3.6);
    c.rotate(jaw);
    blob(c, 3.6, 0.6, 4.6, 1.9, S.dark);
    c.fillStyle = "#f2f4fa";
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.moveTo(3 + i * 2.6, -0.8);
      c.lineTo(3.8 + i * 2.6, -2.6);
      c.lineTo(4.6 + i * 2.6, -0.8);
      c.fill();
    }
    c.restore();
    blob(c, 0, 0, 8.6, 8, S.fur);
    blob(c, 6.6, 2.4, 5.4, 3.8, shade(S.fur, -0.15));
    blob(c, 11, 1.4, 1.9, 1.6, S.glow); // head, muzzle, LED nose
    c.fillStyle = "rgba(255,255,255,.14)";
    c.beginPath();
    c.ellipse(-1, -4, 4, 1.5, -0.3, 0, TAU);
    c.fill();
    glowOn(c, S.glow, 6);
    c.fillStyle = S.glow;
    c.beginPath();
    c.moveTo(2, -3.6);
    c.lineTo(7.4, -2.6 + snarl * 0.4);
    c.lineTo(6.8, -0.6);
    c.lineTo(2.4, -1.4);
    c.closePath();
    c.fill();
    glowOff(c); // angry LED eye
    c.restore();
    c.restore();
    leg(hpx, hpy + 2, ph + 0.1, false, true);
    leg(shx, shy + 2, ph + 0.6, true, true);
  }
  function dog(sc) {
    const key = "d:" + sc;
    if (cache[key]) return cache[key];
    const N = 12,
      fr = [];
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < N; i++)
        fr.push((c) => dogFig(c, i / N, s ? 1 : 0.15));
    return (cache[key] = {
      w: 96,
      h: 58,
      fx: 46,
      fy: 54,
      f: frames(key, 96, 58, 46, 54, sc, fr, "#ffc48a"),
      n: N,
      snarl: N,
    }); // 0-11 running · 12-23 snarling
  }

  /* ---------- NEW COINS: engraved gold coins with an 8-point ikat star, beaded rim, rotating edge and a gloss sweep ---------- */
  function coinFace(c, th, gem, sweep) {
    const R = 11.2,
      k = Math.cos(th),
      ax = Math.max(0.1, Math.abs(k)),
      side = Math.abs(Math.sin(th)),
      dir = k >= 0 ? 1 : -1;
    for (let i = Math.ceil(2.6 * side); i >= 1; i--) {
      c.fillStyle = i % 2 ? "#b27208" : "#9c6208";
      c.beginPath();
      c.ellipse(-dir * i * 0.9, 0, R * ax, R, 0, 0, TAU);
      c.fill();
    } // coin thickness
    c.save();
    c.scale(ax, 1);
    c.fillStyle = "#c8860f";
    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.fill();
    let g = c.createLinearGradient(-R, -R, R, R);
    g.addColorStop(0, gem ? "#fffbd0" : "#fff3a2");
    g.addColorStop(0.5, "#f5bd2c");
    g.addColorStop(1, "#c98a12");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, R * 0.93, 0, TAU);
    c.fill();
    c.fillStyle = "#fff6c0";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      c.beginPath();
      c.arc(Math.cos(a) * R * 0.83, Math.sin(a) * R * 0.83, 0.55, 0, TAU);
      c.fill();
    } // beads
    c.strokeStyle = "rgba(120,70,0,.55)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.arc(0, 0, R * 0.72, 0, TAU);
    c.stroke();
    g = c.createRadialGradient(-2, -3, 1, 0, 0, R * 0.7);
    g.addColorStop(0, "#fff0a0");
    g.addColorStop(1, "#e3a01a");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, R * 0.69, 0, TAU);
    c.fill();
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - Math.PI / 2,
        r = i % 2 ? R * 0.27 : R * 0.6;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); // 8-point star
    g = c.createLinearGradient(-R * 0.5, -R * 0.5, R * 0.5, R * 0.5);
    g.addColorStop(0, "#fff7c8");
    g.addColorStop(1, "#c98512");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(120,70,0,.7)";
    c.lineWidth = 0.6;
    c.stroke();
    if (gem) {
      c.fillStyle = "#53f7ff";
      c.beginPath();
      c.moveTo(0, -3.2);
      c.lineTo(2.6, 0);
      c.lineTo(0, 3.2);
      c.lineTo(-2.6, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,.8)";
      c.beginPath();
      c.moveTo(0, -3.2);
      c.lineTo(1.2, -0.6);
      c.lineTo(-1.2, -0.6);
      c.closePath();
      c.fill();
    } else {
      c.fillStyle = "#9c6208";
      c.beginPath();
      c.arc(0, 0, 1.5, 0, TAU);
      c.fill();
      c.fillStyle = "#fff6c0";
      c.beginPath();
      c.arc(-0.4, -0.4, 0.55, 0, TAU);
      c.fill();
    }
    c.save();
    c.beginPath();
    c.arc(0, 0, R * 0.93, 0, TAU);
    c.clip(); // gloss sweep
    const gl = c.createLinearGradient(sweep * R - 4, -R, sweep * R + 4, R);
    gl.addColorStop(0, "rgba(255,255,255,0)");
    gl.addColorStop(0.5, "rgba(255,255,255,.65)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl;
    c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
    c.restore();
  }
  function coins(sc) {
    const key = "c3:" + sc;
    if (cache[key]) return cache[key];
    const rs = sc * 1.6,
      make = (gem) =>
        Array.from({ length: 16 }, (_, i) => {
          const cv = mk(28 * rs, 28 * rs),
            c = cv.getContext("2d");
          c.setTransform(rs, 0, 0, rs, 14 * rs, 14 * rs);
          coinFace(c, (i / 16) * TAU, gem, ((i * 0.37) % 2) - 1);
          return cv;
        });
    return (cache[key] = { n: make(false), g: make(true), size: 28 });
  }

  /* ---------- BACK VIEW (for the city-street mode): the runner seen from behind ---------- */
  function backFigure(c, P, S) {
    // seen from behind (the 2.5D city run): same duck-bot / hawk-bot
    const G = !!S.guard,
      Pl = PAL(S),
      sq = P.sq || 1,
      hipY = -14 + (P.bob || 0) * 0.7,
      sw = P.sway || 0,
      flow = P.flow || 0,
      by = hipY - 11,
      hy = by - 16 + (P.nod || 0);
    c.save();
    c.scale(1 + (1 - sq) * 0.35, sq);
    c.rotate(P.tilt || 0);
    const leg = (s, lift) => {
      const ax = s * 5.4,
        ay = -2.2 - lift * 0.62,
        kx = s * 5.8,
        ky = (hipY + ay) / 2;
      plate(c, s * 5, hipY, kx, ky, 6, 5, shade(Pl.leg, -0.05));
      plate(c, kx, ky, ax, ay, 5, 4, shade(Pl.leg, -0.1));
      blob(c, ax, ay + 0.8, 5, 2.4, Pl.beak);
    };
    const wing = (s, a, up) => {
      const sx = s * 13.4,
        sy = by - 2,
        tx = s * (17.4 + up * 2.5),
        ty = by + 7 - a * 4 - up * 15;
      plate(c, sx, sy, tx, ty, 7.4, 5.4, G ? Pl.trim : shade(Pl.body, -0.12));
      blob(c, tx, ty, 3.2, 3.6, Pl.trim);
      blob(c, sx, sy, 3, 3, "#ffd84f");
    };
    const arm = P.arm || [0, 0],
      up = P.up || 0;
    wing(-1, arm[0], up);
    leg(-1, (P.lift || [0, 0])[0]);
    leg(1, (P.lift || [0, 0])[1]);
    if (P.flame || P.boost) {
      const fl = 5 + (P.boost || 0) + 3 * (P.flame || 0.5);
      const g = c.createLinearGradient(0, by + 14, 0, by + 14 + fl * 1.8);
      g.addColorStop(0, S.glow);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-3, by + 10);
      c.lineTo(0, by + 12 + fl * 1.8);
      c.lineTo(3, by + 10);
      c.closePath();
      c.fill();
    }
    c.save();
    c.translate(sw, by);
    egg(c, 0, 0, 15.5, 13.6, Pl.body);
    c.strokeStyle = "rgba(255,255,255,.34)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 11, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    const pg = c.createLinearGradient(-6, 0, 6, 0);
    pg.addColorStop(0, shade(Pl.trim, -0.2));
    pg.addColorStop(0.5, shade(Pl.trim, 0.3));
    pg.addColorStop(1, shade(Pl.trim, -0.1));
    c.fillStyle = pg;
    c.beginPath();
    c.roundRect(-5.6, -6, 11.2, 12.4, 3);
    c.fill(); // back pack
    glowOn(c, S.glow, 4);
    c.fillStyle = S.glow;
    c.beginPath();
    c.arc(-2.2, 2.6, 1.5, 0, TAU);
    c.arc(2.2, 2.6, 1.5, 0, TAU);
    c.fill();
    glowOff(c);
    star8(c, 0, -1.6, 2.6, "#ffd84f");
    c.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      c.strokeStyle = i ? Pl.trim : "#ffd84f";
      c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(i * 2, 11);
      c.lineTo(i * 7 + Math.sin(flow + i) * 1.2, 15.6);
      c.stroke();
    }
    c.restore();
    c.save();
    c.translate(sw * 0.5, hy);
    egg(c, 0, 0, 12.8, 11.8, Pl.body);
    c.strokeStyle = "rgba(255,255,255,.32)";
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(0, 0, 9.4, Math.PI * 1.2, Math.PI * 1.8);
    c.stroke();
    for (const s of [-1, 1]) {
      blob(c, s * 12.4, 1.2, 2.5, 3.2, "#ffd84f");
      glowOn(c, S.glow, 4);
      c.fillStyle = S.glow;
      c.beginPath();
      c.arc(s * 12.8, 1.2, 1, 0, TAU);
      c.fill();
      glowOff(c);
    }
    if (G) {
      for (let i = -1; i <= 1; i++) {
        c.fillStyle = i ? "#d3172e" : "#e9a23b";
        c.beginPath();
        c.moveTo(i * 4 - 2, -8);
        c.lineTo(i * 5.4, -17 - (i === 0 ? 3 : 0));
        c.lineTo(i * 4 + 2, -8.4);
        c.closePath();
        c.fill();
      }
      const on = Math.floor(flow * 1.2) % 2;
      glowOn(c, on ? "#ff3b4d" : "#4f7bff", 8);
      c.fillStyle = on ? "#ff3b4d" : "#4f7bff";
      c.beginPath();
      c.arc(0, -10, 2.3, 0, TAU);
      c.fill();
      glowOff(c);
    } else {
      c.save();
      c.beginPath();
      c.ellipse(0, -7.4, 10.6, 8.2, 0, Math.PI, TAU);
      c.closePath();
      const dg = c.createLinearGradient(0, -16, 0, -7);
      dg.addColorStop(0, shade(Pl.trim, 0.45));
      dg.addColorStop(1, shade(Pl.trim, -0.2));
      c.fillStyle = dg;
      c.fill();
      c.clip();
      c.strokeStyle = "rgba(255,216,79,.8)";
      c.lineWidth = 0.8;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(0, -15.4);
        c.quadraticCurveTo(i * 5, -12, i * 6.6, -7.2);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "#3a56e8";
      c.beginPath();
      c.roundRect(-11, -8.6, 22, 2.8, 1.2);
      c.fill();
      c.strokeStyle = "#ffd84f";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(0, -15.4);
      c.lineTo(0, -18.4);
      c.stroke();
      glowOn(c, S.glow, 6);
      c.fillStyle = S.glow;
      c.beginPath();
      c.arc(0, -19.2, 1.5, 0, TAU);
      c.fill();
      glowOff(c);
      const w = flow,
        x0 = 0;
      c.fillStyle = S.acc;
      c.beginPath();
      c.moveTo(-9, 8.6);
      c.quadraticCurveTo(
        -13 + Math.sin(w) * 2,
        14,
        -11 + Math.sin(w + 1) * 3,
        20,
      );
      c.lineTo(-7.6 + Math.sin(w + 1) * 3, 19);
      c.quadraticCurveTo(-8, 13, -5, 9.6);
      c.closePath();
      c.fill();
    }
    c.restore();
    wing(1, arm[1], up);
    c.restore();
  }

  function backPose(i, n, o = {}) {
    const p = i / n,
      a = Math.sin(TAU * p),
      b = Math.sin(TAU * p + Math.PI);
    return Object.assign(
      {
        lift: [Math.max(0, a) * 12, Math.max(0, b) * 12],
        arm: [b, a],
        bob: 1.6 * Math.abs(Math.cos(TAU * p)) - 0.6,
        sway: Math.sin(TAU * p) * 0.6,
        flow: p * TAU * 2,
        flame: 0.5 + 0.5 * Math.sin(TAU * p * 2),
        tilt: Math.sin(TAU * p) * 0.025,
      },
      o,
    );
  }
  function runnerBack(skin, sc) {
    const key = "rb:" + skin + ":" + sc;
    if (cache[key]) return cache[key];
    const S = LOOKS[skin] || LOOKS.default,
      N = 12;
    const run = Array.from(
      { length: N },
      (_, i) => (c) => backFigure(c, backPose(i, N), S),
    );
    const extra = [
      (c) =>
        backFigure(
          c,
          backPose(0, N, {
            lift: [8, 11],
            arm: [0, 0],
            up: 0.8,
            bob: -1,
            boost: 4,
            flow: 2.4,
          }),
          S,
        ), // jump
      (c) =>
        backFigure(
          c,
          backPose(1, N, {
            sq: 0.56,
            lift: [0, 0],
            arm: [-0.6, -0.6],
            bob: 4,
            nod: 2,
          }),
          S,
        ), // slide
      (c) =>
        backFigure(
          c,
          backPose(0, N, {
            lift: [3, 0],
            up: 1,
            arm: [0, 0],
            tilt: 0.12,
            nod: 1,
            flow: 3,
          }),
          S,
        ), // hit
    ];
    return (cache[key] = {
      w: 48,
      h: 80,
      fx: 24,
      fy: 76,
      f: frames(key, 48, 80, 24, 76, sc, run.concat(extra), "#ffb97a"),
      n: N,
      jump: N,
      slide: N + 1,
      hit: N + 2,
      unit: 1.85 / 59,
    });
  }
  function guardBack(sc) {
    const key = "gb:" + sc;
    if (cache[key]) return cache[key];
    const N = 12,
      run = Array.from(
        { length: N },
        (_, i) => (c) =>
          backFigure(
            c,
            backPose(i, N, { arm: [Math.sin((TAU * i) / N + Math.PI), -0.2] }),
            GUARD,
          ),
      );
    return (cache[key] = {
      w: 48,
      h: 80,
      fx: 24,
      fy: 76,
      f: frames(key, 48, 80, 24, 76, sc, run, "#ffa66b"),
      n: N,
      unit: 1.85 / 59,
    });
  }
  function dogBackFig(c, p, S) {
    const a = Math.sin(TAU * p),
      b = Math.sin(TAU * p + Math.PI),
      lf = [Math.max(0, a) * 5, Math.max(0, b) * 5],
      sh = Math.sin(TAU * p) * 0.8,
      P2 = PUP;
    for (const s of [-1, 1]) {
      const l = lf[s < 0 ? 1 : 0];
      plate(
        c,
        s * 4.4,
        -9,
        s * 4.8,
        -2.6 - l * 0.7,
        4.4,
        3.4,
        shade(P2.fur, -0.3),
      );
      blob(c, s * 4.8, -1.8 - l * 0.7, 2.7, 1.9, P2.bronze);
    }
    const tw = Math.sin(TAU * p * 2) * 2;
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      blob(
        c,
        tw * t * 1.4,
        -17 - t * 12,
        3.8 - t * 1.2,
        3 - t * 0.6,
        i & 1 ? P2.bronze : P2.fur,
      );
    }
    blob(c, sh * 0.4, -13, 11.4, 8.4, P2.fur);
    c.strokeStyle = P2.glow;
    c.lineWidth = 1.1;
    glowOn(c, P2.glow, 4);
    c.beginPath();
    c.moveTo(0, -20);
    c.lineTo(0, -9);
    c.stroke();
    glowOff(c);
    blob(c, sh * 0.3, -21, 5.2, 4.8, P2.fur);
    for (const s of [-1, 1]) {
      c.fillStyle = P2.dark;
      c.beginPath();
      c.moveTo(s * 1.6, -24);
      c.lineTo(s * 4.4, -33);
      c.lineTo(s * 5.2, -23.4);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = P2.bronze;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-4.4, -18);
    c.lineTo(4.4, -18);
    c.stroke();
  }
  function dogBack(sc) {
    const key = "db:" + sc;
    if (cache[key]) return cache[key];
    const N = 12,
      fr = Array.from(
        { length: N },
        (_, i) => (c) => dogBackFig(c, i / N, PUP),
      );
    return (cache[key] = {
      w: 40,
      h: 44,
      fx: 20,
      fy: 40,
      f: frames(key, 40, 44, 20, 40, sc, fr, "#ffc48a"),
      n: N,
      unit: 1.2 / 30,
    });
  }

  /* ---------- baked 3D sprites ----------
     assets/baked/*.png are side-view renders of the real 3D models (js/3d/view/hero.js + chaser.js, see tools/bake.py).
     Until a sheet has loaded (or if it is missing) the procedural figures above are used, so nothing ever breaks. */
  const baked = {},
    BAKE_SPEC = {
      hero: {
        w: 84,
        h: 78,
        fx: 42,
        fy: 74,
        n: 17,
        extra: { jump: 12, fall: 13, land: 14, duck: 15, hit: 16 },
        run: 12,
      },
      guard: {
        w: 90,
        h: 82,
        fx: 44,
        fy: 78,
        n: 13,
        extra: { swing: 12 },
        run: 12,
      },
      dog: {
        w: 96,
        h: 58,
        fx: 46,
        fy: 54,
        n: 24,
        extra: { snarl: 12 },
        run: 12,
      },
    };
  function bakedSheet(file, kind) {
    let b = baked[file];
    if (!b) {
      b = baked[file] = { sheet: null };
      if (typeof Image === "undefined") return null;
      const img = new Image(),
        sp = BAKE_SPEC[kind];
      img.onload = () => {
        const cw = Math.round(img.width / sp.n),
          ch = img.height;
        const f = [];
        for (let i = 0; i < sp.n; i++) {
          const cv = mk(cw, ch);
          cv.getContext("2d").drawImage(img, i * cw, 0, cw, ch, 0, 0, cw, ch);
          f.push(cv);
        }
        b.sheet = Object.assign(
          { w: sp.w, h: sp.h, fx: sp.fx, fy: sp.fy, f, n: sp.run },
          sp.extra,
        );
      };
      img.src = "assets/baked/" + file + ".png";
    }
    return b.sheet;
  }
  const runner3 = (skin, sc) =>
      bakedSheet("hero_" + (LOOKS[skin] ? skin : "default"), "hero") ||
      runner(skin, sc),
    guard3 = (sc) => bakedSheet("guard", "guard") || guard(sc),
    dog3 = (sc) => bakedSheet("dog", "dog") || dog(sc);

  return {
    runner: runner3,
    guard: guard3,
    dog: dog3,
    coins,
    runnerBack,
    guardBack,
    dogBack,
    LOOKS,
    GUARD,
    mk,
  };
})();
