/* view/hud.js — 2D HUD drawn on its own canvas. */
"use strict";
function drawHUD(vp) {
  hx.clearRect(0, 0, W, H);
  const u = UI,
    m = 16 * u + Math.max(INS.l, INS.r),
    fnt = (w, sz) =>
      `${w} ${Math.round(sz * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`,
    tNow = performance.now();
  if (state === "play" && gap < 7.5) {
    const k = clamp((7.5 - gap) / 4, 0, 1) * (0.6 + 0.4 * Math.sin(tNow / 110)),
      g = hx.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.35,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.75,
      );
    g.addColorStop(0, "rgba(255,30,60,0)");
    g.addColorStop(1, "rgba(255,30,60," + 0.42 * k + ")");
    hx.fillStyle = g;
    hx.fillRect(0, 0, W, H);
  }
  for (const s of sparks) {
    const p = proj(s.x, s.y, s.z, vp);
    if (!p) continue;
    hx.globalAlpha = clamp(s.l * 2, 0, 1);
    hx.fillStyle = s.c;
    hx.fillRect(p[0], p[1], 3.2 * u, 3.2 * u);
  }
  hx.globalAlpha = 1;
  if (rainA > 0.05 && qual < 2 && state !== "ready") {
    hx.strokeStyle = "rgba(200,220,255," + 0.32 * rainA + ")";
    hx.lineWidth = 1;
    hx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = (i * 83.7 + 13) % W,
        y = ((i * 47.3 + tNow * (0.9 + (i % 5) * 0.12)) % (H + 40)) - 20;
      hx.moveTo(x, y);
      hx.lineTo(x - 5 * u, y + 20 * u);
    }
    hx.stroke();
  }
  if (heli && lit > 0.05) {
    hx.fillStyle = "rgba(255,255,230," + Math.min(0.5, lit) + ")";
    hx.fillRect(0, 0, W, H);
  }
  if (state === "over" && bustT > 0) {
    const k = Math.min(1, bustT / 0.3),
      bar = H * 0.1 * k;
    hx.fillStyle = "rgba(8,10,26," + 0.34 * k + ")";
    hx.fillRect(0, 0, W, H);
    hx.fillStyle = "#000";
    hx.fillRect(0, 0, W, bar);
    hx.fillRect(0, H - bar, W, bar);
    if (bustT > 0.35 && !ovOpen()) {
      const e = Math.min(1, (bustT - 0.35) / 0.25),
        sc = 1 + (1 - e) * 0.7;
      hx.save();
      hx.translate(W / 2, H * 0.3);
      hx.scale(sc, sc);
      hx.globalAlpha = e;
      hx.textAlign = "center";
      hx.textBaseline = "middle";
      hx.font = `800 ${Math.round(Math.min(56 * u, (W * 0.84) / Math.max(5, T("busted").length * 0.8)))}px Orbitron, 'Hiragino Sans', sans-serif`;
      hx.lineJoin = "round";
      hx.lineWidth = 6 * u;
      hx.strokeStyle = "rgba(0,0,0,.65)";
      hx.strokeText(T("busted"), 2, 3);
      hx.fillStyle = "#f1f2f7";
      hx.fillText(T("busted"), 0, 0);
      hx.font = `600 ${Math.round(11 * u)}px Orbitron, sans-serif`;
      hx.fillStyle = "#ff6b84";
      hx.fillText(T("caught"), 0, 34 * u);
      hx.restore();
    }
  }
  if (slowK > 0.02) {
    hx.fillStyle = "rgba(110,150,255," + 0.13 * slowK + ")";
    hx.fillRect(0, 0, W, H);
  }
  if (state === "ready") return;
  hx.save();
  hx.translate(0, INS.t * 0.8);
  hx.textBaseline = "middle";
  hx.textAlign = "left";
  hx.fillStyle = "rgba(0,0,0,.45)";
  hx.font = fnt(800, 26);
  const sc = String(scoreNow());
  hx.fillText(sc, m + 1.5, m + 18 * u + 2);
  hx.fillStyle = "#fff";
  hx.fillText(sc, m, m + 18 * u);
  hx.font = fnt(600, 9);
  hx.fillStyle = "rgba(255,255,255,.8)";
  hx.fillText(
    Math.floor(pz) +
      " " +
      T("m") +
      "  ·  " +
      THEMES[themeAt(pz)].name.toUpperCase(),
    m,
    m + 40 * u,
  );
  const pipY = m + 52 * u;
  for (let i = 0; i < 2; i++) {
    hx.fillStyle = "rgba(0,0,0,.55)";
    hx.beginPath();
    hx.roundRect(m + i * 30 * u, pipY, 26 * u, 7 * u, 3 * u);
    hx.fill();
    if (i < 2 - hits) {
      hx.fillStyle = hits ? "#ff6b84" : "#46e08c";
      hx.beginPath();
      hx.roundRect(m + i * 30 * u + 1, pipY + 1, 26 * u - 2, 7 * u - 2, 2 * u);
      hx.fill();
    }
  }
  const ly = pipY + 20 * u;
  for (let i = 0; i < 6; i++) {
    const on = i < nextLetter;
    hx.fillStyle = on ? "#ffd84f" : "rgba(0,0,0,.5)";
    hx.beginPath();
    hx.roundRect(m + i * 21 * u, ly, 18 * u, 18 * u, 4 * u);
    hx.fill();
    hx.fillStyle = on ? "#3a2200" : "rgba(255,255,255,.35)";
    hx.textAlign = "center";
    hx.font = fnt(800, 11);
    hx.fillText("ZUMARY"[i], m + i * 21 * u + 9 * u, ly + 9.5 * u);
  }
  {
    const ey = ly + 26 * u,
      ew = 120 * u;
    hx.fillStyle = "rgba(0,0,0,.5)";
    hx.beginPath();
    hx.roundRect(m, ey, ew, 6 * u, 3 * u);
    hx.fill();
    hx.fillStyle = energy >= 50 ? "#53f7ff" : "#4a78a8";
    hx.beginPath();
    hx.roundRect(m, ey, ew * clamp(energy / 100, 0, 1), 6 * u, 3 * u);
    hx.fill();
    hx.fillStyle = "rgba(255,255,255,.7)";
    hx.fillRect(m + ew * 0.5 - 0.5, ey - 1, 1.5, 8 * u);
    hx.textAlign = "left";
    hx.font = fnt(600, 8);
    hx.fillStyle = "rgba(255,255,255,.75)";
    hx.fillText(T("energy"), m + ew + 6 * u, ey + 3 * u);
  }
  if (COINICON) {
    const ic = 26 * u * (1 + Math.max(0, coinHud) * 1.2),
      fr = Math.floor(tNow / 70) % 16;
    hx.textAlign = "right";
    hx.font = fnt(800, 24);
    const txt = String(coinsGot),
      tw = hx.measureText(txt).width;
    hx.fillStyle = "rgba(0,0,0,.5)";
    hx.fillText(txt, W - m + 1.5, m + 18 * u + 2);
    hx.fillStyle = "#ffe27a";
    hx.fillText(txt, W - m, m + 18 * u);
    hx.drawImage(
      COINICON[fr],
      W - m - tw - ic - 4 * u,
      m + 18 * u - ic / 2,
      ic,
      ic,
    );
  }
  let ry = m + 46 * u;
  if (mult > 1 || chain > 1) {
    hx.textAlign = "right";
    hx.font = fnt(800, 16);
    hx.fillStyle = mult > 3 ? "#ff8a3c" : "#7ffcff";
    hx.fillText("×" + mult, W - m, ry);
    hx.fillStyle = "rgba(255,255,255,.25)";
    hx.fillRect(W - m - 46 * u, ry + 10 * u, 46 * u, 3 * u);
    hx.fillStyle = "#fff";
    hx.fillRect(
      W - m - 46 * u,
      ry + 10 * u,
      46 * u * clamp(chainT / 1.5, 0, 1),
      3 * u,
    );
    ry += 26 * u;
  }
  for (const [t, v, mx] of [
    ["mag", mag, 9],
    ["shield", shield, 16],
    ["turbo", turbo, 5],
    ["dbl", dbl, 15],
    ["jet", jet, 7],
    ["scoot", scoot, 12],
    ["slow", slow, 6],
  ]) {
    if (v <= 0) continue;
    const ic = 26 * u;
    hx.drawImage(powCanvas(t), W - m - ic, ry - ic / 2 + 4 * u, ic, ic);
    hx.fillStyle = "rgba(0,0,0,.5)";
    hx.fillRect(W - m - ic - 48 * u, ry + 2 * u, 42 * u, 6 * u);
    hx.fillStyle = POWCOL[t];
    hx.fillRect(
      W - m - ic - 48 * u,
      ry + 2 * u,
      42 * u * clamp(v / mx, 0, 1),
      6 * u,
    );
    ry += 28 * u;
  }
  for (const f of floaties) {
    hx.globalAlpha = Math.min(1, f.l * 1.5);
    hx.textAlign = "center";
    hx.font = fnt(800, 20);
    hx.lineWidth = 4 * u;
    hx.strokeStyle = "rgba(0,0,0,.55)";
    hx.strokeText(f.text, W / 2, H * 0.24 - (1.4 - f.l) * 18 * u);
    hx.fillStyle = f.c;
    hx.fillText(f.text, W / 2, H * 0.24 - (1.4 - f.l) * 18 * u);
    hx.globalAlpha = 1;
  }
  if (state === "play" && (speed > 22 || turbo > 0) && qual < 2) {
    const k = turbo > 0 ? 1 : clamp((speed - 22) / 12, 0, 1);
    hx.strokeStyle = "rgba(255,246,230," + (0.05 + 0.12 * k) + ")";
    hx.lineWidth = 1.2;
    hx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.2,
        r0 = Math.hypot(W, H) * (0.34 + ((i * 0.37 + runPh * 0.3) % 1) * 0.2),
        r1 = r0 + 50 * u * (1 + k);
      hx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.42 + Math.sin(a) * r0 * 0.9);
      hx.lineTo(W / 2 + Math.cos(a) * r1, H * 0.42 + Math.sin(a) * r1 * 0.9);
    }
    hx.stroke();
  }
  hx.restore();
  if (resumeCd > 0) {
    hx.fillStyle = "rgba(6,8,20,.35)";
    hx.fillRect(0, 0, W, H);
    hx.textAlign = "center";
    hx.textBaseline = "middle";
    hx.fillStyle = "#fff";
    hx.font = fnt(800, 72);
    hx.fillText(String(Math.ceil(resumeCd / 0.5)), W / 2, H / 2);
  }
}
