/* view/metro-stations.js — Ten halls modelled on the real Tashkent Metro stations; every 60 m chunk of the metro section is another one. */
"use strict";
const STN = [
  { n: "MUSTAQILLIK MAYDONI", bg: "#0b4f9c", fg: "#fff", vault: [[0.96, 0.94, 0.9], [0.9, 0.86, 0.78]], wall: [0.97, 0.96, 0.94], band: [0.1, 0.42, 0.8], trim: [0.95, 0.78, 0.3], col: [0.96, 0.95, 0.92], colS: "fluted", deco: "medal", glow: [1, 0.88, 0.6], chand: "grand" },
  { n: "KOSMONAVTLAR", bg: "#0b1240", fg: "#9fd8ff", vault: [[0.1, 0.12, 0.32], [0.06, 0.08, 0.22]], wall: [0.12, 0.14, 0.34], band: [0.2, 0.4, 0.9], trim: [0.7, 0.85, 1], col: [0.78, 0.84, 0.95], colS: "round", deco: "cosmos", glow: [0.6, 0.8, 1], chand: "ring" },
  { n: "ALISHER NAVOIY", bg: "#0d5a3c", fg: "#ffe9a8", vault: [[0.88, 0.92, 0.82], [0.8, 0.88, 0.74]], wall: [0.92, 0.95, 0.9], band: [0.08, 0.5, 0.34], trim: [0.92, 0.74, 0.3], col: [0.94, 0.92, 0.84], colS: "fluted", deco: "arches", glow: [1, 0.9, 0.6], chand: "grand" },
  { n: "PAXTAKOR", bg: "#176b3a", fg: "#fff", vault: [[0.96, 0.97, 0.95], [0.9, 0.94, 0.9]], wall: [0.98, 0.98, 0.96], band: [0.2, 0.62, 0.3], trim: [0.85, 0.9, 0.85], col: [0.95, 0.97, 0.94], colS: "cotton", deco: "cotton", glow: [1, 1, 0.9], chand: "ball" },
  { n: "MIRZO ULUG'BEK", bg: "#081a52", fg: "#ffd98a", vault: [[0.08, 0.12, 0.38], [0.05, 0.08, 0.28]], wall: [0.82, 0.78, 0.7], band: [0.1, 0.2, 0.6], trim: [1, 0.8, 0.3], col: [0.9, 0.86, 0.78], colS: "round", deco: "stars", glow: [1, 0.9, 0.5], chand: "armil" },
  { n: "BUYUK IPAK YO'LI", bg: "#8a3b12", fg: "#ffe2a0", vault: [[0.9, 0.64, 0.4], [0.82, 0.54, 0.32]], wall: [0.92, 0.72, 0.48], band: [0.75, 0.18, 0.18], trim: [0.98, 0.8, 0.3], col: [0.88, 0.64, 0.42], colS: "square", deco: "silk", glow: [1, 0.78, 0.45], chand: "lantern" },
  { n: "AMIR TEMUR XIYOBONI", bg: "#0a6f86", fg: "#fff", vault: [[0.12, 0.6, 0.76], [0.08, 0.5, 0.68]], wall: [0.88, 0.92, 0.95], band: [0.06, 0.4, 0.66], trim: [0.98, 0.8, 0.3], col: [0.9, 0.94, 0.97], colS: "round", deco: "domes", glow: [0.8, 0.95, 1], chand: "ring" },
  { n: "MING O'RIK", bg: "#b0306a", fg: "#fff", vault: [[1, 0.9, 0.92], [0.97, 0.82, 0.88]], wall: [1, 0.94, 0.95], band: [0.9, 0.4, 0.6], trim: [0.8, 0.9, 0.7], col: [0.97, 0.88, 0.9], colS: "round", deco: "blossom", glow: [1, 0.85, 0.9], chand: "ball" },
  { n: "YUNUS RAJABIY", bg: "#5a1a28", fg: "#ffd98a", vault: [[0.58, 0.32, 0.22], [0.5, 0.26, 0.18]], wall: [0.74, 0.52, 0.38], band: [0.5, 0.12, 0.2], trim: [0.98, 0.8, 0.3], col: [0.8, 0.58, 0.42], colS: "square", deco: "music", glow: [1, 0.78, 0.5], chand: "lantern" },
  { n: "CHORSU", bg: "#1b3d8f", fg: "#fff", vault: [[0.9, 0.9, 0.95], [0.82, 0.86, 0.94]], wall: [0.92, 0.92, 0.96], band: [0.12, 0.3, 0.78], trim: [0.98, 0.8, 0.3], col: [0.88, 0.9, 0.96], colS: "fluted", deco: "domes", glow: [0.9, 0.95, 1], chand: "ring" },
];
function stnSignTex(D) {
  const c = mkc(512, 154),
    g = c.getContext("2d");
  g.fillStyle = D.bg;
  g.fillRect(0, 0, 512, 154);
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.strokeRect(5, 5, 502, 144);
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(64, 77, 40, 0, 7);
  g.fill();
  g.fillStyle = D.bg;
  g.font = "bold 50px system-ui,sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("M", 64, 80);
  g.fillStyle = D.fg;
  let fs = 62;
  g.font = `bold ${fs}px system-ui,sans-serif`;
  while (g.measureText(D.n).width > 370 && fs > 20) {
    fs -= 2;
    g.font = `bold ${fs}px system-ui,sans-serif`;
  }
  g.fillText(D.n, 291, 80);
  return texFrom(c);
}
const STNM = {};
function stationBuild(i) {
  if (STNM[i]) return STNM[i];
  const D = STN[i],
    b = new B(),
    g = new B(),
    LEN = CH,
    RX = 9,
    RY = 3.4,
    WH = 3.4,
    N = 16,
    UV = [[0, 0], [1, 0], [1, 1], [0, 1]],
    ell = (a, k) => [Math.cos(a) * RX * k, WH + Math.sin(a) * RY * k],
    rr = (() => {
      let s = 7 + i * 131;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })(),
    G = D.glow,
    star = D.deco === "cosmos" || D.deco === "stars";
  /* vault */
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI,
      a1 = ((k + 1) / N) * Math.PI,
      p0 = ell(a0, 1),
      p1 = ell(a1, 1),
      mid = (a0 + a1) / 2,
      nr = [-Math.cos(mid) / RX, -Math.sin(mid) / RY],
      nl = Math.hypot(nr[0], nr[1]);
    b.quad([[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], LEN], [p0[0], p0[1], LEN]], [nr[0] / nl, nr[1] / nl, 0], UV, D.vault[k % 2]);
    for (let z = 0; z < LEN; z += 6) {
      const q0 = ell(a0, 0.985),
        q1 = ell(a1, 0.985);
      b.quad([[q0[0], q0[1], z], [q1[0], q1[1], z], [q1[0], q1[1], z + 0.45], [q0[0], q0[1], z + 0.45]], [nr[0] / nl, nr[1] / nl, 0], UV, D.trim);
    }
  }
  /* walls: stone, a coloured band, gold trim, framed panels */
  for (const sd of [-1, 1]) {
    const n = [-sd, 0, 0],
      x = sd * RX,
      wall = (y0, y1, c, dx = 0, z0 = 0, z1 = LEN) => b.quad([[x + sd * dx, y0, z0], [x + sd * dx, y0, z1], [x + sd * dx, y1, z1], [x + sd * dx, y1, z0]], n, UV, c);
    wall(0, WH, D.wall);
    wall(1.1, 2.0, D.band, -sd * 0.03);
    wall(2.0, 2.18, D.trim, -sd * 0.04);
    wall(1.0, 1.1, D.trim, -sd * 0.04);
    for (let z = 6; z < LEN; z += 12) {
      wall(2.35, 3.25, mulc(D.band, 0.8), -sd * 0.05, z - 3.2, z + 3.2);
      for (const [a, c] of [[2.3, 2.35], [3.25, 3.3]]) wall(a, c, D.trim, -sd * 0.06, z - 3.3, z + 3.3);
    }
    for (let z = 3; z < LEN; z += 6) {
      g.box(sd * (RX - 0.2), 2.75, z, 0.12, 0.7, 0.34, G);
      g.box(sd * (RX - 0.16), 3.2, z, 0.1, 0.2, 0.5, mulc(G, 0.95));
    }
    g.box(sd * 5.35, 0.19, LEN / 2, 0.16, 0.03, LEN, [1, 0.8, 0.1]);
    g.box(sd * 3.6, 6.5, LEN / 2, 0.3, 0.1, LEN, G);
    /* columns */
    for (let z = 6; z < LEN; z += 12) {
      const cx = sd * 6.9;
      if (D.colS === "square") {
        b.box(cx, 2.3, z, 0.86, 4.6, 0.86, D.col);
        b.box(cx, 0.18, z, 1.05, 0.36, 1.05, D.trim);
        b.box(cx, 4.55, z, 1.1, 0.4, 1.1, D.trim);
      } else {
        b.cyl(cx, 0, z, 0.46, 0.4, 4.7, D.colS === "fluted" ? 12 : 14, D.col, false, D.colS === "fluted" ? mulc(D.col, 0.86) : undefined);
        b.cyl(cx, 0, z, 0.62, 0.62, 0.32, 12, D.trim, true);
        b.cyl(cx, 4.5, z, 0.68, 0.46, 0.4, 12, D.trim, true);
      }
      if (D.colS === "cotton")
        for (let q = 0; q < 6; q++) {
          const a = q * 1.047;
          g.sph(cx + Math.cos(a) * 0.4, 4.95 + (q % 2) * 0.12, z + Math.sin(a) * 0.4, 0.2, 0.18, 0.2, 5, 6, [1, 1, 0.98]);
          b.box(cx + Math.cos(a) * 0.32, 4.72, z + Math.sin(a) * 0.32, 0.22, 0.05, 0.12, [0.2, 0.55, 0.25]);
        }
    }
  }
  /* chandeliers */
  for (let z = 6; z < LEN; z += 12) {
    b.cyl(0, 6.2, z, 0.04, 0.04, 0.7, 5, [0.3, 0.26, 0.2]);
    if (D.chand === "ring" || D.chand === "grand") {
      const r = D.chand === "grand" ? 1.5 : 1.2;
      for (let q = 0; q < 12; q++) g.sph(Math.cos(q * 0.5236) * r, 6.0, z + Math.sin(q * 0.5236) * r, 0.17, 0.17, 0.17, 4, 6, G);
      if (D.chand === "grand") for (let q = 0; q < 8; q++) g.sph(Math.cos(q * 0.785) * 0.8, 5.55, z + Math.sin(q * 0.785) * 0.8, 0.13, 0.13, 0.13, 4, 6, mulc(G, 0.95));
      g.sph(0, 5.8, z, 0.4, 0.45, 0.4, 5, 8, G);
    } else if (D.chand === "armil") {
      for (let q = 0; q < 16; q++) {
        const a = q * 0.3927;
        g.sph(Math.cos(a) * 1.0, 5.6 + Math.sin(a) * 0.9, z, 0.09, 0.09, 0.09, 4, 5, D.trim);
        g.sph(0, 5.6 + Math.sin(a) * 0.9, z + Math.cos(a) * 1.0, 0.09, 0.09, 0.09, 4, 5, D.trim);
        g.sph(Math.cos(a) * 1.0, 5.6, z + Math.sin(a) * 1.0, 0.09, 0.09, 0.09, 4, 5, D.trim);
      }
      g.sph(0, 5.6, z, 0.32, 0.32, 0.32, 5, 8, [0.4, 0.7, 1]);
    } else if (D.chand === "lantern") {
      g.box(0, 5.7, z, 0.7, 0.9, 0.7, G);
      b.box(0, 6.2, z, 0.95, 0.12, 0.95, D.trim);
      b.box(0, 5.2, z, 0.85, 0.1, 0.85, D.trim);
    } else {
      g.sph(0, 6.0, z, 0.55, 0.6, 0.55, 6, 8, G);
      g.sph(0, 6.0, z, 0.95, 0.22, 0.95, 6, 8, mulc(G, 0.95));
    }
  }
  /* each hall's own decoration */
  const dec = D.deco;
  if (dec === "cosmos" || dec === "stars")
    for (let q = 0; q < 70; q++) {
      const a = 0.1 + rr() * 2.94,
        p = ell(a, 0.97);
      g.sph(p[0], p[1], rr() * LEN, 0.07 + rr() * 0.06, 0.07, 0.07, 4, 4, dec === "stars" ? D.trim : [0.85, 0.92, 1]);
    }
  if (dec === "cosmos")
    [[0, 0.2, [1, 0.6, 0.2]], [0, 0.55, [0.3, 0.6, 1]], [0, 0.88, [0.8, 0.5, 0.9]]].forEach(([, f, c]) => {
      const z = LEN * f;
      g.sph(0, 6.55, z, 1.2, 0.18, 1.2, 6, 10, c);
      if (f > 0.5) g.sph(0, 6.55, z, 2.0, 0.05, 2.0, 5, 12, [0.9, 0.85, 0.7]);
    });
  if (dec === "medal")
    for (let z = 3; z < LEN; z += 6) {
      g.sph(0, 6.6, z, 1.25, 0.1, 1.25, 5, 12, D.trim);
      g.sph(0, 6.62, z, 0.7, 0.08, 0.7, 5, 10, [0.1, 0.42, 0.8]);
    }
  if (dec === "arches")
    for (const sd of [-1, 1])
      for (let z = 6; z < LEN; z += 12) {
        const x = sd * (RX - 0.12);
        b.box(x, 1.7, z - 3.4, 0.1, 3.4, 0.3, D.trim);
        b.box(x, 1.7, z + 3.4, 0.1, 3.4, 0.3, D.trim);
        for (let q = 0; q <= 6; q++) {
          const a = (q / 6) * Math.PI;
          b.box(x, 3.0 + Math.sin(a) * 0.9, z + Math.cos(a) * 3.4, 0.1, 0.3, 0.55, D.trim);
        }
      }
  if (dec === "cotton")
    for (const sd of [-1, 1])
      for (let z = 1.5; z < LEN; z += 3) {
        const x = sd * (RX - 0.25);
        b.box(x, 1.4, z, 0.06, 0.5, 0.06, [0.2, 0.55, 0.25]);
        for (let q = 0; q < 4; q++) g.sph(x, 1.7 + (q % 2) * 0.12, z + (q - 1.5) * 0.14, 0.1, 0.1, 0.1, 4, 5, [1, 1, 0.98]);
      }
  if (dec === "blossom") {
    const pk = [[1, 0.7, 0.8], [1, 0.82, 0.88], [0.96, 0.55, 0.72]];
    for (let q = 0; q < 46; q++) {
      const a = 0.12 + rr() * 2.9,
        p = ell(a, 0.96),
        z = rr() * LEN;
      for (let m = 0; m < 4; m++) g.sph(p[0] + (rr() - 0.5) * 0.6, p[1] - rr() * 0.3, z + (rr() - 0.5) * 0.6, 0.13, 0.11, 0.13, 4, 5, pk[(q + m) % 3]);
    }
  }
  if (dec === "silk")
    for (const sd of [-1, 1])
      for (let z = 0; z < LEN; z += 1.5) {
        const x = sd * (RX - 0.07),
          c = [[0.8, 0.14, 0.18], [0.98, 0.78, 0.2], [0.1, 0.58, 0.64]][Math.floor(z / 1.5) % 3];
        b.quad([[x, 0.05, z], [x, 0.05, z + 0.75], [x, 1.0, z + 0.75], [x, 1.0, z]], [-sd, 0, 0], UV, c);
      }
  if (dec === "domes")
    for (let z = 6; z < LEN; z += 12) {
      b.sph(0, 6.45, z, 1.7, 0.75, 1.7, 6, 12, [0.1, 0.6, 0.76]);
      g.sph(0, 6.55, z, 1.72, 0.12, 1.72, 5, 12, D.trim);
      b.cyl(0, 7.05, z, 0.05, 0.02, 0.5, 5, D.trim);
    }
  if (dec === "music")
    for (const sd of [-1, 1])
      for (let z = 6; z < LEN; z += 12) {
        const x = sd * (RX - 0.3);
        g.sph(x, 2.7, z, 0.18, 0.4, 0.34, 6, 8, [0.98, 0.78, 0.3]);
        g.box(x, 3.3, z, 0.07, 0.8, 0.07, [0.98, 0.78, 0.3]);
        g.sph(x, 3.72, z, 0.1, 0.1, 0.1, 4, 5, [1, 0.9, 0.5]);
      }
  /* hanging station sign */
  const sg = new B();
  sg.box(0, 0, 0, 8, 2.4, 0.2, [1, 1, 1], { uv: { nz: [0, 0, 1, 1], pz: [0.02, 0.02, 0.03, 0.03] } });
  const pb = new B();
  for (const sx of [-3.6, 3.6]) pb.box(sx, 6.3, 0, 0.08, 1.5, 0.08, [0.3, 0.3, 0.34]);
  return (STNM[i] = {
    parts: [
      { m: b.mesh(), mat: { emis: star ? 0.3 : 0.24, tint: [1, 0.98, 1], spec: 0.1 } },
      { m: g.mesh(), mat: { emis: 1 } },
      { m: pb.mesh(), mat: { emis: 0.2 } },
    ],
    signs: [{ m: sg.mesh(), tex: stnSignTex(D), at: [0, 5.1, LEN * 0.5] }],
  });
}
