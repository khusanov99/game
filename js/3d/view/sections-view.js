/* view/sections-view.js — Meshes for the special sections: Bukhara tim, Khiva wall-top, Fergana fields; section dispatcher. */
"use strict";
const SECM = {},
  QUADUV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const rcol = (c, k) => mulc(c, 1 + rnd(-k, k));
function secSign(txt, c1, c2, w, y, z) {
  const b = new B();
  b.box(0, 0, 0, w, w * 0.3, 0.2, [1, 1, 1], { uv: { nz: [0, 0, 1, 1], pz: [0.02, 0.02, 0.03, 0.03] } });
  return { m: b.mesh(), tex: signTex(txt, c1, c2), at: [0, y, z] };
}
/* ---------- Bukhara: covered bazaar (tim) ---------- */
function timBuild() {
  const b = new B(),
    g = new B(),
    LEN = CH,
    RX = 9,
    RY = 3,
    WH = 3.8,
    brick = [0.74, 0.46, 0.28],
    brick2 = [0.66, 0.4, 0.25],
    stone = [0.86, 0.72, 0.52],
    cloth = [[0.78, 0.12, 0.16], [0.14, 0.3, 0.72], [0.96, 0.62, 0.12], [0.16, 0.55, 0.4]];
  const ell = (a, k) => [Math.cos(a) * RX * k, WH + Math.sin(a) * RY * k],
    N = 14;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI,
      a1 = ((i + 1) / N) * Math.PI,
      p0 = ell(a0, 1),
      p1 = ell(a1, 1),
      mid = (a0 + a1) / 2,
      nr = [-Math.cos(mid) / RX, -Math.sin(mid) / RY],
      nl = Math.hypot(nr[0], nr[1]),
      n = [nr[0] / nl, nr[1] / nl, 0];
    b.quad([[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], LEN], [p0[0], p0[1], LEN]], n, QUADUV, i % 2 ? brick : brick2);
    for (let z = 0; z < LEN; z += 10) {
      const q0 = ell(a0, 0.985),
        q1 = ell(a1, 0.985);
      b.quad([[q0[0], q0[1], z], [q1[0], q1[1], z], [q1[0], q1[1], z + 0.8], [q0[0], q0[1], z + 0.8]], n, QUADUV, stone);
    }
  }
  for (const sd of [-1, 1]) {
    const x = sd * RX;
    b.quad([[x, 0, 0], [x, 0, LEN], [x, WH, LEN], [x, WH, 0]], [-sd, 0, 0], QUADUV, brick);
    b.box(sd * (RX - 0.12), 1.2, LEN / 2, 0.24, 0.16, LEN, stone);
    b.box(sd * (RX - 0.12), 2.9, LEN / 2, 0.24, 0.12, LEN, stone);
    /* stalls: dark niche, hanging cloth, table with pottery, amber lantern */
    for (let z = 3; z < LEN; z += 6) {
      b.box(sd * (RX - 0.06), 1.7, z, 0.12, 2.3, 3.6, [0.12, 0.07, 0.05]);
      const c = cloth[(((z / 6) | 0) + (sd > 0 ? 1 : 0)) % 4];
      b.box(sd * (RX - 0.45), 2.0, z, 0.06, 1.7, 1.5, c);
      b.box(sd * (RX - 0.45), 2.0, z + 1.1, 0.06, 1.5, 0.8, cloth[(((z / 6) | 0) + 2) % 4]);
      b.box(sd * (RX - 0.8), 0.55, z, 0.9, 0.2, 3.0, [0.45, 0.3, 0.18]);
      for (let k = 0; k < 4; k++)
        b.sph(sd * (RX - 0.8), 0.86, z - 1.1 + k * 0.75, 0.22, 0.22, 0.22, 5, 6, k % 2 ? [0.1, 0.55, 0.7] : [0.9, 0.82, 0.62]);
      g.sph(sd * (RX - 1.6), 3.2, z, 0.2, 0.22, 0.2, 5, 6, [1, 0.74, 0.3]);
    }
  }
  /* arches' piers + light holes + hanging lanterns */
  for (let z = 0; z < LEN; z += 20) {
    g.box(0, 6.74, z + 10, 1.6, 0.06, 1.6, [1, 0.9, 0.62]);
    g.box(0, 6.74, z + 10, 0.5, 0.07, 3.5, [1, 0.86, 0.5]);
  }
  for (let z = 3; z < LEN; z += 6) {
    const x = Math.sin(z * 0.7) * 3.2,
      c = [[1, 0.6, 0.2], [1, 0.82, 0.35], [1, 0.4, 0.3]][((z / 6) | 0) % 3];
    b.cyl(x, 5.0, z, 0.02, 0.02, 1.6, 4, [0.3, 0.22, 0.15]);
    g.sph(x, 4.9, z, 0.26, 0.34, 0.26, 6, 8, c);
  }
  const portal = new B(),
    pg = new B();
  for (const sd of [-1, 1]) {
    portal.box(sd * 9.8, 4, 0, 1.4, 8, 1.8, brick);
    portal.box(sd * 9.8, 8.1, 0, 1.8, 0.3, 2.1, stone);
  }
  portal.box(0, 7.6, 0, 20, 1.5, 1.8, brick);
  portal.box(0, 8.5, 0, 21, 0.4, 2.2, stone);
  for (let x = -9; x <= 9; x += 3) pg.box(x, 6.75, -0.95, 0.5, 0.18, 0.1, [1, 0.8, 0.3]);
  return {
    parts: [
      { m: b.mesh(), mat: { emis: 0.1, tint: [0.9, 0.86, 0.84], spec: 0.05 } },
      { m: g.mesh(), mat: { emis: 1 } },
    ],
    portal: [
      { m: portal.mesh(), mat: { emis: 0.25 } },
      { m: pg.mesh(), mat: { emis: 1 } },
      secSign("BOZOR TIMI", "#5a210f", "#ffd98a", 9, 5.6, -1.0),
    ],
  };
}
/* ---------- Khiva: run along the Ichan Qala wall ---------- */
function wallBuild() {
  const b = new B(),
    g = new B(),
    roofs = new B(),
    LEN = CH,
    DEEP = -15,
    sand = [0.82, 0.66, 0.44],
    sand2 = [0.7, 0.52, 0.34],
    turq = [0.1, 0.62, 0.72];
  /* the town far below */
  roofs.quad([[-260, DEEP, 0], [260, DEEP, 0], [260, DEEP, LEN], [-260, DEEP, LEN]], [0, 1, 0], QUADUV, [0.5, 0.4, 0.3]);
  for (const sd of [-1, 1])
    for (let i = 0; i < 16; i++) {
      const w = rnd(5, 11),
        d = rnd(5, 12),
        h = rnd(2.5, 6),
        x = sd * rnd(12, 80),
        z = rnd(0, LEN),
        c = rcol(pick([sand, sand2, [0.74, 0.56, 0.4]]), 0.1);
      roofs.box(x, DEEP + h / 2, z, w, h, d, c);
      if (Math.random() < 0.3) roofs.sph(x, DEEP + h, z, w * 0.42, w * 0.32, w * 0.42, 6, 8, turq);
    }
  /* wall faces, parapet and merlons */
  for (const sd of [-1, 1]) {
    const x = sd * 5.45;
    b.quad([[x, DEEP, 0], [x, DEEP, LEN], [x, 0, LEN], [x, 0, 0]], [sd, 0, 0], QUADUV, sand2);
    b.box(sd * 5.65, 0.6, LEN / 2, 0.9, 1.2, LEN, sand);
    for (let z = 0.9; z < LEN; z += 1.8) b.box(sd * 5.65, 1.65, z, 0.9, 0.9, 1.0, rcol(sand, 0.04));
    for (let z = 0; z < LEN; z += 12) g.box(sd * 5.2, 1.9, z + 6, 0.16, 0.3, 0.16, [1, 0.6, 0.2]);
  }
  b.cyl(-6.9, DEEP, 30, 2.7, 2.4, 21.5, 14, sand2);
  b.cyl(6.9, DEEP, 30, 2.7, 2.4, 21.5, 14, sand2);
  for (const x of [-6.9, 6.9]) {
    b.cyl(x, 6.2, 30, 3.0, 2.8, 0.9, 14, sand);
    b.cyl(x, 7.1, 30, 2.7, 0.15, 2.6, 14, turq);
  }
  const portal = new B(),
    pg = new B();
  for (const sd of [-1, 1]) {
    portal.cyl(sd * 6.6, DEEP, 0, 2.3, 2.0, 25, 12, sand2);
    portal.cyl(sd * 6.6, 9.6, 0, 2.6, 2.4, 0.9, 12, sand);
    portal.cyl(sd * 6.6, 10.5, 0, 2.4, 0.15, 2.4, 12, turq);
  }
  portal.box(0, 8.4, 0, 14, 2.2, 2.2, sand);
  portal.box(0, 9.6, 0, 14.4, 0.4, 2.5, sand2);
  for (let x = -6; x <= 6; x += 3) pg.box(x, 7.2, -1.15, 1.2, 0.18, 0.08, [0.2, 0.9, 1]);
  return {
    parts: [
      { m: roofs.mesh(), mat: { emis: 0.12, tint: [0.9, 0.88, 0.95] } },
      { m: b.mesh(), mat: { emis: 0.12, spec: 0.05 } },
      { m: g.mesh(), mat: { emis: 1 } },
    ],
    portal: [
      { m: portal.mesh(), mat: { emis: 0.15 } },
      { m: pg.mesh(), mat: { emis: 1 } },
      secSign("ICHAN QAL'A", "#7a4a22", "#ffe9b0", 8.4, 8.4, -1.25),
    ],
  };
}
/* ---------- Fergana: canals and cotton fields ---------- */
function fieldBuild() {
  const b = new B(),
    w = new B(),
    LEN = CH,
    green = [0.28, 0.46, 0.2];
  b.quad([[-300, -0.03, 0], [300, -0.03, 0], [300, -0.03, LEN], [-300, -0.03, LEN]], [0, 1, 0], QUADUV, [0.46, 0.5, 0.24]);
  for (const sd of [-1, 1]) {
    b.quad([[sd * 5.2, 0.02, 0], [sd * 7.2, 0.02, 0], [sd * 7.2, 0.02, LEN], [sd * 5.2, 0.02, LEN]], [0, 1, 0], QUADUV, [0.56, 0.43, 0.29]);
    b.quad([[sd * 7.6, 0.06, 0], [sd * 9.0, 0.06, 0], [sd * 9.0, 0.06, LEN], [sd * 7.6, 0.06, LEN]], [0, 1, 0], QUADUV, [0.2, 0.52, 0.82]);
    w.quad([[sd * 7.6, 0.07, 0], [sd * 9.0, 0.07, 0], [sd * 9.0, 0.07, LEN], [sd * 7.6, 0.07, LEN]], [0, 1, 0], QUADUV, [0.5, 0.85, 1]);
    b.box(sd * 7.45, 0.18, LEN / 2, 0.3, 0.36, LEN, [0.72, 0.7, 0.66]);
    b.box(sd * 9.15, 0.18, LEN / 2, 0.3, 0.36, LEN, [0.72, 0.7, 0.66]);
    /* poplars */
    for (let z = 4; z < LEN; z += 10) {
      const h = rnd(7, 11),
        x = sd * rnd(10.4, 11.4);
      b.cyl(x, 0, z, 0.2, 0.16, 2.4, 6, [0.4, 0.3, 0.2]);
      b.sph(x, 2.4 + h / 2, z, 1.0, h / 2, 1.0, 5, 7, rcol([0.2, 0.42, 0.18], 0.15));
    }
    /* cotton rows */
    for (let j = 0; j < 5; j++) {
      const x = sd * (13.5 + j * 3.4);
      b.box(x, 0.26, LEN / 2, 1.1, 0.5, LEN, rcol(green, 0.08));
      for (let z = rnd(0, 1.6); z < LEN; z += 1.7)
        b.box(x + rnd(-0.35, 0.35), 0.62, z, 0.34, 0.3, 0.34, [0.97, 0.97, 0.94]);
    }
    /* far range of the Fergana valley */
    const mx = sd * 240;
    b.lathe(mx, 0, 30, [[110, 0], [80, 34]], 12, [0.34, 0.42, 0.28]);
    b.lathe(mx, 0, 30, [[80, 34], [46, 68]], 12, [0.5, 0.46, 0.4], [0.42, 0.38, 0.36]);
    b.lathe(mx, 0, 30, [[46, 68], [2, 108]], 12, [0.96, 0.97, 1], [0.86, 0.9, 0.98]);
  }
  const portal = new B(),
    pg = new B();
  for (const sx of [-6.2, 6.2]) portal.box(sx, 3, 0, 0.4, 6, 0.4, [0.62, 0.62, 0.64]);
  portal.box(0, 6.1, 0, 12.8, 0.3, 0.4, [0.62, 0.62, 0.64]);
  return {
    parts: [
      { m: b.mesh(), mat: { emis: 0.12 } },
      { m: w.mesh(), mat: { emis: 0.5, spec: 0.9 } },
    ],
    portal: [{ m: portal.mesh(), mat: { emis: 0.2 } }, secSign("PAXTA MAYDONI", "#2e7d3a", "#fff", 8, 5.0, -0.3)],
  };
}
function secBuild(t) {
  if (t === 1) {
    tunnelMeshes();
    return (SECM[1] = {
      parts: [
        { m: TUN, mat: { emis: 0.1, tint: [0.8, 0.78, 0.82], spec: 0.1 } },
        { m: TUNG, mat: { emis: 1 } },
      ],
      portal: [
        { m: PORTAL, mat: { emis: 0.3 } },
        { m: PORTALG, mat: { emis: 1 } },
      ],
    });
  }
  return (SECM[t] = t === 2 ? timBuild() : t === 3 ? wallBuild() : fieldBuild());
}
function drawSection(ch) {
  const t = ch.sec,
    S = SECM[t] || (t >= 10 ? (SECM[t] = plazaBuild(t - 10)) : secBuild(t)),
    M = Tp(0, 0, ch.zA);
  for (const p of S.parts) draw(p.m, M, null, p.mat);
  if (t >= 10) return; // landmark plaza: no portals
  for (const z of [ch.zA, ch.zB]) {
    if (secChunk(ch.ci + (z === ch.zA ? -1 : 1)) === t) continue;
    const P = Tp(0, 0, z);
    for (const p of S.portal)
      draw(p.m, p.at ? Tp(p.at[0], p.at[1], z + p.at[2]) : P, p.tex || null, p.mat || { emis: 0.9 });
  }
}
/* gaps in the Khiva deck and Fergana irrigation canals (replace the plain yellow-bordered pit) */
const PITV = {};
function pitVariant(t) {
  if (PITV[t]) return PITV[t];
  const b = new B(),
    w = new B(),
    lip = t === 3 ? [0.82, 0.66, 0.44] : [0.74, 0.72, 0.68];
  b.quad([[-1, 0.03, 0], [1, 0.03, 0], [1, 0.03, 3], [-1, 0.03, 3]], [0, 1, 0], QUADUV, t === 3 ? [0.03, 0.02, 0.02] : [0.15, 0.45, 0.78]);
  if (t === 4) w.quad([[-1, 0.05, 0], [1, 0.05, 0], [1, 0.05, 3], [-1, 0.05, 3]], [0, 1, 0], QUADUV, [0.5, 0.85, 1]);
  for (const [x, z, ww, d] of [[-1.07, 1.5, 0.16, 3.3], [1.07, 1.5, 0.16, 3.3], [0, -0.05, 2.3, 0.18], [0, 3.05, 2.3, 0.18]])
    b.box(x, 0.12, z, ww, 0.22, d, lip);
  return (PITV[t] = { b: b.mesh(), w: w.mesh() });
}
