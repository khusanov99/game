/* facades.js — procedural Uzbek facade textures (shared by city.js and city3d.js) */
const Facades = (() => {
  "use strict";
  const TAU = Math.PI * 2,
    rnd = (a, b) => a + Math.random() * (b - a),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mkc(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }
  const lg = (g, x0, y0, x1, y1, st) => {
    const q = g.createLinearGradient(x0, y0, x1, y1);
    st.forEach(([o, c]) => q.addColorStop(o, c));
    return q;
  };
  function arch(g, x, y, w, h) {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + w / 2);
    g.quadraticCurveTo(x, y, x + w / 2, y);
    g.quadraticCurveTo(x + w, y, x + w, y + w / 2);
    g.lineTo(x + w, y + h);
    g.closePath();
  }
  function lit(g, x, y, w, h, on, warm) {
    g.fillStyle = on ? (warm ? "#ffd98a" : "#9fe3ff") : "#17203a";
    g.fillRect(x, y, w, h);
    if (on) {
      g.fillStyle = "rgba(255,255,255,.28)";
      g.fillRect(x, y, w, h * 0.3);
    }
  }
  function dome(g, x, y, w, col, col2) {
    const h = w * 0.62;
    g.fillStyle = lg(g, x, y - h, x + w, y, [
      [0, col2],
      [0.5, col],
      [1, "#0e5a78"],
    ]);
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(
      x - w * 0.06,
      y - h * 1.05,
      x + w * 0.3,
      y - h * 1.25,
      x + w / 2,
      y - h * 1.5,
    );
    g.bezierCurveTo(
      x + w * 0.7,
      y - h * 1.25,
      x + w * 1.06,
      y - h * 1.05,
      x + w,
      y,
    );
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.25)";
    g.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(x + (w * i) / 5, y);
      g.quadraticCurveTo(
        x + w / 2 + (i - 2.5) * w * 0.05,
        y - h * 1.0,
        x + w / 2,
        y - h * 1.48,
      );
      g.stroke();
    }
    g.fillStyle = "#f2c14e";
    g.fillRect(x + w / 2 - 1.5, y - h * 1.5 - 6, 3, 8);
  }
  function tiles(g, x, y, w, h, c1, c2) {
    // blue/turquoise geometric tile band
    g.fillStyle = c1;
    g.fillRect(x, y, w, h);
    g.strokeStyle = c2;
    g.lineWidth = 1;
    const s = h;
    for (let i = 0; i < w / s; i++) {
      const xx = x + i * s;
      g.beginPath();
      g.moveTo(xx + s / 2, y + 2);
      g.lineTo(xx + s - 2, y + s / 2);
      g.lineTo(xx + s / 2, y + s - 2);
      g.lineTo(xx + 2, y + s / 2);
      g.closePath();
      g.stroke();
      g.fillStyle = c2;
      g.fillRect(xx + s / 2 - 1.5, y + s / 2 - 1.5, 3, 3);
    }
  }
  /* ---- richer, lit facades: every wall is baked once with light, grime, depth and real Uzbek details ---- */
  let NZ = null;
  function noiseTile() {
    if (NZ) return NZ;
    NZ = mkc(96, 96);
    const g = NZ.getContext("2d"),
      im = g.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return NZ;
  }
  function grain(g, w, h, a, mode) {
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = mode || "overlay";
    g.fillStyle = g.createPattern(noiseTile(), "repeat");
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  function light(g, w, h, warm) {
    // low sun: warm top, cool shadowed street level, soft side falloff, cornice shadow
    g.save();
    let q = g.createLinearGradient(0, 0, 0, h);
    q.addColorStop(0, "rgba(255,170,90," + (warm || 0.22) + ")");
    q.addColorStop(0.5, "rgba(255,170,90,0)");
    q.addColorStop(1, "rgba(10,20,50,.42)");
    g.fillStyle = q;
    g.fillRect(0, 0, w, h);
    q = g.createLinearGradient(0, 0, w, 0);
    q.addColorStop(0, "rgba(0,0,0,.2)");
    q.addColorStop(0.12, "rgba(0,0,0,0)");
    q.addColorStop(0.88, "rgba(0,0,0,0)");
    q.addColorStop(1, "rgba(0,0,0,.2)");
    g.fillStyle = q;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  function skyGlass(g, x, y, w, h, hue) {
    // window glass reflecting the dusk sky
    const q = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    q.addColorStop(0, hue[0]);
    q.addColorStop(0.55, hue[1]);
    q.addColorStop(1, hue[2]);
    g.fillStyle = q;
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.22)";
    g.beginPath();
    g.moveTo(x, y + h * 0.5);
    g.lineTo(x + w * 0.6, y);
    g.lineTo(x + w, y);
    g.lineTo(x, y + h * 0.85);
    g.fill();
  }
  function win(g, x, y, w, h, o) {
    // framed window: sill, lintel, curtain, lit or dark, optional shutters / AC unit
    const on = Math.random() < (o.p === undefined ? 0.45 : o.p);
    g.fillStyle = o.frame || "#e8dcc4";
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    if (on) {
      const q = g.createLinearGradient(x, y, x, y + h);
      q.addColorStop(0, "#ffe9a8");
      q.addColorStop(1, "#ffb860");
      g.fillStyle = q;
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(120,50,20," + rnd(0.15, 0.4) + ")";
      g.fillRect(x, y, w * rnd(0.2, 0.5), h);
      if (Math.random() < 0.5) {
        g.fillStyle = "rgba(40,20,10,.55)";
        g.fillRect(x + w * rnd(0.3, 0.6), y + h * 0.45, w * 0.18, h * 0.55);
      }
    } else
      skyGlass(g, x, y, w, h, o.glass || ["#46618a", "#26365a", "#141c34"]);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x, y, w, 2);
    g.fillStyle = o.frame || "#e8dcc4";
    g.fillRect(x + w / 2 - 0.7, y, 1.4, h);
    g.fillRect(x - 3, y + h, w + 6, 3);
    g.fillStyle = "rgba(0,0,0,.3)";
    g.fillRect(x - 3, y + h + 3, w + 6, 2);
    if (o.ac && Math.random() < 0.22) {
      g.fillStyle = "#d8dde4";
      g.fillRect(x + w - 4, y + h + 5, w * 0.7, h * 0.3);
      g.fillStyle = "#6a7080";
      g.fillRect(x + w - 2, y + h + 7, w * 0.7 - 4, 2);
    }
    if (o.shut) {
      g.fillStyle = o.shut;
      g.fillRect(x - w * 0.42, y, w * 0.38, h);
      g.fillRect(x + w * 1.04, y, w * 0.38, h);
      g.fillStyle = "rgba(0,0,0,.25)";
      for (let i = 1; i < 5; i++) {
        g.fillRect(x - w * 0.42, y + (h * i) / 5, w * 0.38, 1);
        g.fillRect(x + w * 1.04, y + (h * i) / 5, w * 0.38, 1);
      }
    }
  }
  function balcony(g, x, y, w, h, col) {
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x, y + h, w, 4);
    g.fillStyle = col;
    g.fillRect(x, y + h - 2, w, 3);
    g.strokeStyle = col;
    g.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      g.beginPath();
      g.moveTo(x + (w * i) / 6, y + h * 0.35);
      g.lineTo(x + (w * i) / 6, y + h - 1);
      g.stroke();
    }
    g.fillRect(x, y + h * 0.35, w, 1.5);
  }
  function muqarnas(g, x, y, w, h, c1, c2) {
    // honeycomb vault inside a pishtaq arch
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const cs = Math.max(5, w / 9);
    for (let r = 0; r * cs * 0.8 < h; r++)
      for (let c = -1; c * cs < w; c++) {
        const xx = x + c * cs + (r % 2 ? cs / 2 : 0),
          yy = y + r * cs * 0.8;
        g.fillStyle = (r + c) % 2 ? c1 : c2;
        g.beginPath();
        g.moveTo(xx, yy + cs * 0.8);
        g.lineTo(xx + cs / 2, yy);
        g.lineTo(xx + cs, yy + cs * 0.8);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(0,0,0,.35)";
        g.lineWidth = 0.8;
        g.stroke();
      }
    g.restore();
  }
  function mosaic(g, x, y, w, h, base, a, b) {
    // blue/turquoise/white girih-like tile field
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    const s = Math.max(8, h / 2);
    for (let i = 0; i * s < w + s; i++)
      for (let j = 0; j * s < h + s; j++) {
        const cx2 = x + i * s + s / 2,
          cy2 = y + j * s + s / 2;
        if (cx2 > x + w + 2) continue;
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        g.translate(cx2, cy2);
        g.fillStyle = a;
        for (let k = 0; k < 8; k++) {
          g.rotate(Math.PI / 4);
          g.beginPath();
          g.moveTo(0, -s * 0.12);
          g.lineTo(s * 0.22, -s * 0.34);
          g.lineTo(0, -s * 0.46);
          g.lineTo(-s * 0.22, -s * 0.34);
          g.closePath();
          g.fill();
        }
        g.fillStyle = b;
        g.beginPath();
        g.arc(0, 0, s * 0.1, 0, TAU);
        g.fill();
        g.restore();
      }
    g.fillStyle = "rgba(255,255,255,.1)";
    g.fillRect(x, y, w, h * 0.2);
    g.fillStyle = "rgba(0,0,0,.2)";
    g.fillRect(x, y + h - 2, w, 2);
  }
  function ribbed(g, x, y, w, base, mid, rim) {
    // ribbed turquoise Timurid dome with drum
    const h = w * 0.7,
      dr = w * 0.22;
    g.fillStyle = lg(g, x, 0, x + w, 0, [
      [0, "#9a7a52"],
      [0.4, "#d6b27a"],
      [1, "#7a5a38"],
    ]);
    g.fillRect(x + w * 0.1, y - dr, w * 0.8, dr + 1);
    mosaic(
      g,
      x + w * 0.1,
      y - dr * 0.8,
      w * 0.8,
      dr * 0.5,
      "#1c6fa8",
      "#7fd6ee",
      "#fff",
    );
    const top = y - dr;
    g.beginPath();
    g.moveTo(x + w * 0.06, top);
    g.bezierCurveTo(
      x - w * 0.12,
      top - h * 0.7,
      x + w * 0.25,
      top - h * 1.25,
      x + w / 2,
      top - h * 1.38,
    );
    g.bezierCurveTo(
      x + w * 0.75,
      top - h * 1.25,
      x + w * 1.12,
      top - h * 0.7,
      x + w * 0.94,
      top,
    );
    g.closePath();
    g.fillStyle = lg(g, x, 0, x + w, 0, [
      [0, shadeC(base, -50)],
      [0.3, mid],
      [0.5, rim],
      [0.7, base],
      [1, shadeC(base, -70)],
    ]);
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(0,40,60,.45)";
    g.lineWidth = 1.4;
    for (let i = -8; i <= 8; i++) {
      g.beginPath();
      g.moveTo(x + w / 2 + i * w * 0.07, top);
      g.quadraticCurveTo(
        x + w / 2 + i * w * 0.075,
        top - h * 0.7,
        x + w / 2 + i * w * 0.004,
        top - h * 1.38,
      );
      g.stroke();
    }
    g.restore();
    g.fillStyle = "#f2c14e";
    g.fillRect(x + w / 2 - 1.5, top - h * 1.38 - 9, 3, 11);
    g.beginPath();
    g.arc(x + w / 2, top - h * 1.38 - 10, 3, 0, TAU);
    g.fill();
  }
  function shadeC(hex, d) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => clamp(v + d, 0, 255) | 0;
    return (
      "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")"
    );
  }
  function pishtaq(g, x, y, w, h, o) {
    // monumental portal: tiled frame, muqarnas, deep iwan, carved door
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x - 5, y + 4, w + 10, h);
    mosaic(g, x - 4, y, w + 8, h, "#14589a", "#6fd0e6", "#ffe9a8");
    g.fillStyle = "#0b1a2e";
    arch(g, x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.84);
    g.fill();
    g.save();
    arch(g, x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.84);
    g.clip();
    muqarnas(
      g,
      x + w * 0.16,
      y + h * 0.16,
      w * 0.68,
      h * 0.34,
      "#2a8fb8",
      "#d6b27a",
    );
    const q = g.createLinearGradient(0, y + h * 0.5, 0, y + h);
    q.addColorStop(0, "#26354f");
    q.addColorStop(1, "#ffc870");
    g.fillStyle = q;
    g.fillRect(x + w * 0.2, y + h * 0.5, w * 0.6, h * 0.5);
    g.fillStyle = "#5a3418";
    arch(g, x + w * 0.34, y + h * 0.62, w * 0.32, h * 0.38);
    g.fill();
    g.strokeStyle = "#e0b060";
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
    g.strokeStyle = "#ffe9a8";
    g.lineWidth = 2;
    arch(g, x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.84);
    g.stroke();
  }
  function stone(g, w, h, c1, c2, top) {
    g.fillStyle = lg(g, 0, top || 0, 0, h, [
      [0, c1],
      [1, c2],
    ]);
    g.fillRect(0, top || 0, w, h - (top || 0));
    grain(g, w, h, 0.3, "overlay");
  }
  function brickPat(g, w, h, top, col, mortar) {
    g.fillStyle = col;
    g.fillRect(0, top, w, h - top);
    const bh = 6,
      bw = 14;
    g.strokeStyle = mortar;
    g.lineWidth = 1;
    for (let y = top, r = 0; y < h; y += bh, r++) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      for (let x = r % 2 ? 0 : bw / 2; x < w; x += bw) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + bh);
        g.stroke();
      }
    }
    for (let i = 0; i < (w * (h - top)) / 90; i++) {
      g.fillStyle =
        "rgba(" +
        (Math.random() < 0.5 ? "60,30,10" : "255,220,160") +
        "," +
        rnd(0.04, 0.14) +
        ")";
      g.fillRect(rnd(0, w), rnd(top, h), bw - 2, bh - 2);
    }
    // Bukhara-style relief band
    g.fillStyle = "rgba(60,30,10,.3)";
    for (let x = 0; x < w; x += 12) g.fillRect(x + 2, top + 2, 6, 3);
  }
  function awning(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w + 3, y + h);
    g.lineTo(x - 3, y + h);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 8; i += 2) g.fillRect(x + (w * i) / 8, y, w / 8, h);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x - 3, y + h, w + 6, 3);
  }
  function shopfront(g, w, hh, PU, pal) {
    // lit ground floor: glass, awnings, bright signs, people silhouettes
    const fh = PU * 2.1,
      y0 = hh - fh;
    g.fillStyle = "#171a26";
    g.fillRect(0, y0, w, fh);
    const n = Math.max(2, Math.round(w / (PU * 3.4))),
      cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * cw + 4,
        c = pal[i % pal.length];
      const q = g.createLinearGradient(0, y0, 0, hh);
      q.addColorStop(0, "#ffefc0");
      q.addColorStop(1, "#ffb25a");
      g.fillStyle = q;
      g.fillRect(x + 4, y0 + fh * 0.36, cw - 12, fh * 0.64);
      g.fillStyle = "rgba(0,0,0,.4)";
      for (let k = 0; k < 3; k++)
        g.fillRect(x + 10 + k * (cw / 4), y0 + fh * 0.5, 4, fh * 0.5);
      g.fillStyle = "rgba(30,20,20,.8)";
      for (let k = 0; k < 2; k++)
        if (Math.random() < 0.7) {
          const px2 = x + cw * (0.25 + k * 0.4);
          g.beginPath();
          g.arc(px2, y0 + fh * 0.62, 3, 0, TAU);
          g.fill();
          g.fillRect(px2 - 3, y0 + fh * 0.66, 6, fh * 0.3);
        }
      awning(g, x, y0 + fh * 0.2, cw - 6, fh * 0.2, c);
      g.fillStyle = c;
      g.fillRect(x + 2, y0 + 3, cw - 10, fh * 0.17);
      g.fillStyle = "rgba(255,255,255,.85)";
      for (let k = 0; k < 5; k++)
        g.fillRect(
          x + 8 + k * ((cw - 24) / 5),
          y0 + 7,
          (cw - 24) / 5 - 3,
          fh * 0.07,
        );
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(0, y0 - 2, w, 3);
  }
  function facade(th, kind, len, h, PU, solid) {
    const domes = [],
      dm = (g2, x, y, ww, c1, c2, c3) => {
        if (solid) domes.push({ x, y, w: ww });
        else ribbed(g2, x, y, ww, c1, c2, c3);
      };
    const w = Math.round(len * PU),
      hh = Math.round(h * PU),
      cv2 = mkc(w, hh),
      g = cv2.getContext("2d");
    g.imageSmoothingQuality = "high";
    const rows = (top, fl) =>
      Math.max(1, Math.floor((hh - top - fl) / (PU * 1.15)));
    if (kind === "glass") {
      // Tashkent City: glass curtain-wall tower with LED crown
      const pal = [
        ["#6aa6d8", "#3a6aa0", "#1c3560"],
        ["#e0a070", "#8a5a8a", "#2a2850"],
        ["#7ab8c8", "#3a7a98", "#183a58"],
      ][(Math.random() * 3) | 0];
      g.fillStyle = lg(g, 0, 0, w, hh, [
        [0, pal[0]],
        [0.5, pal[1]],
        [1, pal[2]],
      ]);
      g.fillRect(0, 0, w, hh);
      const fh = PU * 2.1,
        cols = Math.max(4, Math.round(len * 3)),
        cw = w / cols,
        rh = PU * 0.62;
      for (let y = 4; y < hh - fh; y += rh)
        for (let c = 0; c < cols; c++) {
          const on = Math.random() < 0.3;
          g.fillStyle = on
            ? "rgba(255,225,150,.78)"
            : "rgba(255,255,255," + (0.03 + Math.random() * 0.12) + ")";
          g.fillRect(c * cw + 1, y + 1, cw - 2, rh - 2);
        }
      g.fillStyle = "rgba(255,255,255,.18)";
      g.beginPath();
      g.moveTo(0, hh * 0.5);
      g.lineTo(w * 0.7, 0);
      g.lineTo(w, 0);
      g.lineTo(w, hh * 0.1);
      g.lineTo(0, hh * 0.8);
      g.fill();
      g.strokeStyle = "rgba(10,20,40,.55)";
      g.lineWidth = 1.6;
      for (let c = 0; c <= cols; c++) {
        g.beginPath();
        g.moveTo(c * cw, 0);
        g.lineTo(c * cw, hh - fh);
        g.stroke();
      }
      for (let y = 4; y < hh - fh; y += rh * 4) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.fillStyle = "#12182a";
      g.fillRect(0, 0, w, 6);
      const cr = ["#53f7ff", "#ff4fd8", "#ffd84f"][(Math.random() * 3) | 0];
      g.save();
      g.shadowColor = cr;
      g.shadowBlur = 8;
      g.fillStyle = cr;
      g.fillRect(0, 2, w, 3);
      g.restore();
      shopfront(g, w, hh, PU, ["#e0405a", "#2fb6c4", "#f2b53a"]);
      light(g, w, hh, 0.18);
      grain(g, w, hh, 0.08);
    } else if (kind === "panel") {
      // Soviet-era 9-storey panel block with balconies, the real Tashkent residential look
      const top = PU * 0.7;
      stone(
        g,
        w,
        hh,
        ["#d8d0c0", "#c9c2b4", "#cdb89a"][(Math.random() * 3) | 0],
        "#8e8574",
        top,
      );
      g.fillStyle = "#6c6458";
      g.fillRect(0, 0, w, top);
      g.fillStyle = "rgba(0,0,0,.2)";
      for (let x = 0; x < w; x += PU * 1.6) g.fillRect(x, top, 2, hh);
      g.strokeStyle = "rgba(60,50,40,.35)";
      g.lineWidth = 1.4;
      for (let y = top + PU * 1.2; y < hh - PU * 2; y += PU * 1.2) {
        g.beginPath();
        g.moveTo(0, y + PU * 0.9);
        g.lineTo(w, y + PU * 0.9);
        g.stroke();
      }
      const cols = Math.max(2, Math.round(len * 1.5)),
        cw = w / cols;
      for (let y = top + PU * 0.3, r = 0; y < hh - PU * 2.2; y += PU * 1.2, r++)
        for (let c = 0; c < cols; c++) {
          win(g, c * cw + cw * 0.22, y, cw * 0.32, PU * 0.7, {
            frame: "#f1ead8",
            ac: true,
            p: 0.5,
          });
          if (c % 2 === 0) {
            g.fillStyle = "rgba(60,50,40,.55)";
            g.fillRect(c * cw + cw * 0.58, y - 2, cw * 0.34, PU * 0.95);
            balcony(
              g,
              c * cw + cw * 0.58,
              y - 2,
              cw * 0.34,
              PU * 0.95,
              "#554c42",
            );
            if (Math.random() < 0.5) {
              g.fillStyle = ["#cc4455", "#4a7ad0", "#e0d8c8"][
                (Math.random() * 3) | 0
              ];
              g.fillRect(c * cw + cw * 0.62, y + 4, cw * 0.1, PU * 0.5);
            }
          }
        }
      shopfront(g, w, hh, PU, ["#c43a4a", "#2a7ab8", "#e0a030"]);
      light(g, w, hh, 0.22);
      grain(g, w, hh, 0.14);
    } else if (kind === "tower") {
      // modern mid-rise: stone cladding, big lit windows
      stone(
        g,
        w,
        hh,
        ["#b9a890", "#a6a4aa", "#c4b49a"][(Math.random() * 3) | 0],
        "#6a6258",
        0,
      );
      const cols = Math.max(3, Math.round(len * 1.7)),
        cw = w / cols;
      for (let y = PU * 0.8, r = 0; y < hh - PU * 2.4; y += PU * 1.25, r++)
        for (let c = 0; c < cols; c++)
          win(g, c * cw + cw * 0.18, y, cw * 0.64, PU * 0.8, {
            frame: "#efe6d2",
            ac: true,
            p: 0.5,
            glass: ["#5a79a8", "#2a3c64", "#161e3a"],
          });
      g.fillStyle = "#ffe9b0";
      g.fillRect(0, 0, w, 5);
      g.fillStyle = "rgba(0,0,0,.3)";
      g.fillRect(0, 5, w, 4);
      shopfront(g, w, hh, PU, ["#e0405a", "#2fb6c4", "#f2b53a"]);
      light(g, w, hh, 0.2);
      grain(g, w, hh, 0.1);
    } else if (kind === "shops") {
      // old-town arcaded shophouse
      const top = PU * 0.6;
      stone(g, w, hh, "#d6b88e", "#8e6a46", top);
      g.fillStyle = "#a07a4e";
      g.fillRect(0, 0, w, top);
      g.fillStyle = "rgba(255,255,255,.2)";
      g.fillRect(0, 0, w, 2);
      const cols = Math.max(2, Math.round(len * 1.4)),
        cw = w / cols;
      for (let y = top + PU * 0.4; y < hh - PU * 2.4; y += PU * 1.35)
        for (let c = 0; c < cols; c++) {
          arch(g, c * cw + cw * 0.25, y, cw * 0.5, PU * 0.95);
          g.fillStyle = Math.random() < 0.5 ? "#ffd28a" : "#243049";
          g.fill();
          g.strokeStyle = "#f3e4c4";
          g.lineWidth = 2.5;
          g.stroke();
          g.fillStyle = "rgba(0,0,0,.3)";
          g.fillRect(c * cw + cw * 0.22, y + PU * 0.95, cw * 0.56, 3);
        }
      shopfront(g, w, hh, PU, ["#2a8a9a", "#c43a4a", "#e0a030"]);
      light(g, w, hh, 0.22);
      grain(g, w, hh, 0.14);
    } else if (kind === "registan") {
      // Samarkand Registan: tiled pishtaq between two-storey hujra galleries, ribbed turquoise dome
      const top = PU * 3.1;
      stone(g, w, hh, "#dcc298", "#a2825a", top);
      const pw = w * 0.4,
        px0 = (w - pw) / 2,
        ph = hh - top + PU * 0.9;
      g.fillStyle = "#c9a878";
      g.fillRect(0, top - PU * 0.7, w, PU * 0.7);
      for (const side of [0, 1]) {
        const x0 = side ? px0 + pw + 6 : 6,
          ww = side ? w - (px0 + pw) - 12 : px0 - 12,
          n = Math.max(2, Math.round(ww / (PU * 1.5))),
          cw = ww / n;
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < n; c++) {
            const ax = x0 + c * cw + cw * 0.12,
              ay = top + PU * (0.5 + r * 2.1);
            g.fillStyle = "#0e1a30";
            arch(g, ax, ay, cw * 0.76, PU * 1.8);
            g.fill();
            const q = g.createLinearGradient(0, ay, 0, ay + PU * 1.8);
            q.addColorStop(0, "#26354f");
            q.addColorStop(1, Math.random() < 0.55 ? "#ffc870" : "#26354f");
            g.fillStyle = q;
            arch(g, ax + 3, ay + 4, cw * 0.76 - 6, PU * 1.8 - 4);
            g.fill();
            g.strokeStyle = "#1c6fa8";
            g.lineWidth = 3;
            arch(g, ax, ay, cw * 0.76, PU * 1.8);
            g.stroke();
            g.strokeStyle = "#7fd6ee";
            g.lineWidth = 1;
            g.stroke();
          }
      }
      pishtaq(g, px0, top - PU * 0.7, pw, ph, {});
      for (const side of [0, 1])
        dm(
          g,
          side ? w - PU * 1.7 - 4 : 4,
          top - PU * 0.7,
          PU * 1.7,
          "#1fa3c4",
          "#46c4de",
          "#b6f2f6",
        );
      g.fillStyle = "#1a4a78";
      g.fillRect(0, top - PU * 0.75, w, 3);
      light(g, w, hh, 0.26);
      grain(g, w, hh, 0.1);
    } else if (kind === "madrasa") {
      // smaller madrasa: mosaic band, iwan, dome behind
      const top = PU * 2.6;
      stone(g, w, hh, "#d6b88a", "#9a7650", top);
      mosaic(g, 0, top + 2, w, PU * 0.55, "#14589a", "#6fd0e6", "#ffe9a8");
      mosaic(g, 0, hh - PU * 1.5, w, PU * 0.5, "#14589a", "#6fd0e6", "#ffe9a8");
      const pw = w * 0.34,
        px0 = (w - pw) / 2;
      pishtaq(g, px0, top + PU * 0.7, pw, hh - top - PU * 0.7, {});
      for (const side of [0, 1]) {
        const x0 = side ? px0 + pw + 8 : 8,
          ww = side ? w - (px0 + pw) - 16 : px0 - 16,
          n = Math.max(1, Math.round(ww / (PU * 1.4)));
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < n; c++)
            win(
              g,
              x0 + (c + 0.2) * (ww / n),
              top + PU * (1.5 + r * 2),
              (ww / n) * 0.6,
              PU * 1.3,
              { frame: "#1c6fa8", p: 0.5, shut: r ? null : null },
            );
      }
      dm(g, w * 0.34, top, w * 0.32, "#1fa3c4", "#46c4de", "#b6f2f6");
      g.fillStyle = "#c9a878";
      g.fillRect(0, top - 3, w, 3);
      light(g, w, hh, 0.26);
      grain(g, w, hh, 0.1);
    } else if (kind === "brick") {
      // Bukhara: ochre baked-brick houses, carved wooden doors, domed trading dome silhouette
      const top = PU * 1.3;
      brickPat(g, w, hh, top, "#c9995e", "rgba(90,50,20,.45)");
      g.fillStyle = "#b8864f";
      g.fillRect(0, top - 3, w, 5);
      const n = Math.max(2, Math.round(len * 1.2)),
        cw = w / n;
      for (let y = top + PU * 0.4; y < hh - PU * 2.4; y += PU * 1.3)
        for (let c = 0; c < n; c++) {
          arch(g, c * cw + cw * 0.22, y, cw * 0.56, PU * 1.0);
          g.fillStyle = Math.random() < 0.45 ? "#ffd28a" : "#241a14";
          g.fill();
          g.strokeStyle = "#6a4020";
          g.lineWidth = 3;
          g.stroke();
          g.strokeStyle = "#e8c890";
          g.lineWidth = 1;
          g.stroke();
        }
      for (let i = 0; i < 2; i++) {
        const dx = w * (0.18 + i * 0.5);
        g.fillStyle = "#4a2a14";
        arch(g, dx, hh - PU * 2.1, w * 0.18, PU * 2.1);
        g.fill();
        g.strokeStyle = "#e0b060";
        g.lineWidth = 1.4;
        g.stroke();
        g.strokeStyle = "rgba(224,176,96,.7)";
        for (let k = 1; k < 4; k++) {
          g.beginPath();
          g.moveTo(dx + (w * 0.18 * k) / 4, hh - PU * 1.6);
          g.lineTo(dx + (w * 0.18 * k) / 4, hh);
          g.stroke();
        }
      }
      dm(g, w * 0.04, top, PU * 1.6, "#2aa3b4", "#56c4d2", "#b6f2f6");
      dm(g, w * 0.78, top, PU * 1.6, "#2aa3b4", "#56c4d2", "#b6f2f6");
      light(g, w, hh, 0.3);
      grain(g, w, hh, 0.12);
    } else if (kind === "fort") {
      // Khiva Itchan Kala: mud-brick wall with crenellations, carved ayvan columns, tiled minaret stub
      const top = PU * 1.0;
      stone(g, w, hh, "#c79a62", "#8a6238", top);
      g.fillStyle = "#c79a62";
      for (let x = 0; x < w; x += PU * 0.9) {
        g.fillRect(x, 4, PU * 0.55, top);
        g.fillStyle = "rgba(0,0,0,.2)";
        g.fillRect(x + PU * 0.55, 4, 3, top);
        g.fillStyle = "#c79a62";
      }
      g.fillStyle = "rgba(0,0,0,.18)";
      for (let i = 0; i < 70; i++)
        g.fillRect(rnd(0, w), top + rnd(0, hh - top), rnd(4, 18), 2);
      g.fillStyle = "rgba(255,230,180,.12)";
      for (let i = 0; i < 50; i++)
        g.fillRect(rnd(0, w), top + rnd(0, hh - top), rnd(4, 14), 2);
      mosaic(g, 0, top + PU * 0.3, w, PU * 0.5, "#1a8aa0", "#9ee8ee", "#fff");
      const n = Math.max(2, Math.round(len * 1.1)),
        cw = w / n;
      for (let y = top + PU * 1.3; y < hh - PU * 2.6; y += PU * 1.3)
        for (let c = 0; c < n; c++)
          win(g, c * cw + cw * 0.3, y, cw * 0.4, PU * 0.9, {
            frame: "#6a3d1f",
            p: 0.4,
            shut: "#4a2a14",
          });
      const ax = w * 0.3,
        aw = w * 0.4,
        ay = hh - PU * 2.6;
      g.fillStyle = "#1a120e";
      g.fillRect(ax, ay, aw, PU * 2.6);
      g.fillStyle = "#6a3d1f";
      g.fillRect(ax - 4, ay - 5, aw + 8, 7);
      for (let i = 0; i < 4; i++) {
        const cx3 = ax + (aw * (i + 0.5)) / 4;
        g.fillStyle = lg(g, cx3 - 5, 0, cx3 + 5, 0, [
          [0, "#3a2010"],
          [0.5, "#a06a34"],
          [1, "#3a2010"],
        ]);
        g.fillRect(cx3 - 5, ay, 10, PU * 2.6);
        g.fillStyle = "#c88a44";
        g.fillRect(cx3 - 8, ay, 16, 5);
      }
      const q = g.createLinearGradient(0, ay, 0, hh);
      q.addColorStop(0, "rgba(255,200,120,0)");
      q.addColorStop(1, "rgba(255,200,120,.35)");
      g.fillStyle = q;
      g.fillRect(ax, ay, aw, PU * 2.6);
      light(g, w, hh, 0.3);
      grain(g, w, hh, 0.16);
    } else {
      // minaret: fat tapered brick tower with tiled bands, balcony with muqarnas and a lantern top
      const bw = w * 0.8,
        x0 = (w - bw) / 2,
        top = PU * 2.2,
        col = [
          ["#d8b078", "#9a7446"],
          ["#c8a064", "#8a6238"],
        ][(Math.random() * 2) | 0];
      g.fillStyle = "rgba(0,0,0,.15)";
      g.fillRect(0, 0, w, hh);
      g.fillStyle = lg(g, x0, 0, x0 + bw, 0, [
        [0, shadeC(col[1], -30)],
        [0.35, col[0]],
        [0.65, col[0]],
        [1, shadeC(col[1], -50)],
      ]);
      g.beginPath();
      g.moveTo(x0 + bw * 0.04, hh);
      g.lineTo(x0 + bw * 0.18, top + PU * 1.4);
      g.lineTo(x0 + bw * 0.82, top + PU * 1.4);
      g.lineTo(x0 + bw * 0.96, hh);
      g.closePath();
      g.fill();
      g.save();
      g.clip();
      brickPat(g, w, hh, top, "rgba(0,0,0,0)", "rgba(70,40,10,.4)");
      for (let i = 0; i < 5; i++)
        mosaic(
          g,
          x0,
          top + PU * (2.6 + i * 2.5),
          bw,
          PU * 0.8,
          "#14589a",
          "#6fd0e6",
          "#ffe9a8",
        );
      g.restore();
      g.fillStyle = "#c8a064";
      g.fillRect(x0 - 5, top + PU * 0.9, bw + 10, PU * 0.5);
      muqarnas(
        g,
        x0 - 3,
        top + PU * 0.4,
        bw + 6,
        PU * 0.55,
        "#d6b27a",
        "#8a6238",
      );
      mosaic(
        g,
        x0 + bw * 0.14,
        top - PU * 0.4,
        bw * 0.72,
        PU * 0.9,
        "#14589a",
        "#6fd0e6",
        "#ffe9a8",
      );
      for (let i = 0; i < 4; i++) {
        g.fillStyle = "#ffd98a";
        arch(
          g,
          x0 + bw * (0.2 + i * 0.18),
          top - PU * 0.2,
          bw * 0.1,
          PU * 0.55,
        );
        g.fill();
      }
      ribbed(
        g,
        x0 + bw * 0.14,
        top - PU * 0.4,
        bw * 0.72,
        "#1fa3c4",
        "#46c4de",
        "#b6f2f6",
      );
      light(g, w, hh, 0.3);
      grain(g, w, hh, 0.1);
    }
    return { cv: cv2, len, h, domes, w, hh };
  }
  return {
    make: facade,
    mkc,
    lg,
    arch,
    mosaic,
    brickPat,
    grain,
    noiseTile,
    stone,
    muqarnas,
  };
})();
