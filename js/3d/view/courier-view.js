/* view/courier-view.js — Parcel and drop-off markers, plus landmark plazas of the rebuilt city. */
"use strict";
let PKGM = null,
  DROPM = null;
/* wrapping paper: polka dots, tiny gold stars, a vertical gold ribbon with a highlight */
function paperTex() {
  const c = mkc(128, 128),
    g = c.getContext("2d"),
    gr = g.createLinearGradient(0, 0, 128, 128);
  gr.addColorStop(0, "#e0284a");
  gr.addColorStop(1, "#9c1030");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,255,255,.88)";
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      g.beginPath();
      g.arc(14 + x * 26 + (y % 2) * 13, 12 + y * 26, 4.2, 0, 7);
      g.fill();
    }
  g.fillStyle = "#ffd24a";
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const px = 27 + x * 26 + (y % 2) * 13,
        py = 25 + y * 26;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 1.6 : 4,
          a = (i / 10) * 6.283 - 1.57;
        g.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      g.fill();
    }
  const rb = g.createLinearGradient(54, 0, 74, 0);
  rb.addColorStop(0, "#c98f1c");
  rb.addColorStop(0.35, "#ffe27a");
  rb.addColorStop(0.65, "#ffd24a");
  rb.addColorStop(1, "#c98f1c");
  g.fillStyle = rb;
  g.fillRect(54, 0, 20, 128);
  return texFrom(c);
}
function courBuild() {
  const b = new B(),
    lid = new B(),
    g = new B(),
    gold = [1, 0.8, 0.28],
    gold2 = [0.9, 0.66, 0.15];
  b.box(0, 0.31, 0, 0.9, 0.62, 0.9, [1, 1, 1], { uv: { px: [0, 0, 1, 1], nx: [0, 0, 1, 1], pz: [0, 0, 1, 1], nz: [0, 0, 1, 1], py: [0, 0, 1, 1], ny: [0, 0, 1, 1] } });
  lid.box(0, 0.73, 0, 0.99, 0.22, 0.99, [0.86, 0.12, 0.28]);
  lid.box(0, 0.73, 0, 0.17, 0.235, 1.01, gold);
  lid.box(0, 0.73, 0, 1.01, 0.235, 0.17, gold);
  lid.box(0, 0.62, 0, 1.0, 0.04, 1.0, gold2);
  lid.sph(0, 0.89, 0, 0.14, 0.12, 0.14, 6, 8, gold2); // bow knot
  for (const [x, z] of [[0.24, 0], [-0.24, 0], [0, 0.24], [0, -0.24]]) {
    lid.sph(x, 0.93, z, x ? 0.22 : 0.1, 0.13, z ? 0.22 : 0.1, 6, 8, gold);
    lid.sph(x * 1.55, 0.9, z * 1.55, x ? 0.1 : 0.05, 0.08, z ? 0.1 : 0.05, 5, 6, gold2);
  }
  for (const sx of [-0.12, 0.12]) lid.box(sx, 0.64, -0.5, 0.1, 0.34, 0.03, gold2); // ribbon tails
  for (const a of [0, 1, 2, 3]) g.box(Math.cos(a * 1.571) * 0.8, 0.5 + (a % 2) * 0.35, Math.sin(a * 1.571) * 0.8, 0.09, 0.09, 0.09, [1, 0.95, 0.6]);
  const q = new B();
  q.quad([[-1.3, 1.3, 0], [1.3, 1.3, 0], [1.3, -1.3, 0], [-1.3, -1.3, 0]], [0, 0, -1], QUADUV, [1, 0.85, 0.4]);
  PKGM = { b: b.mesh(), lid: lid.mesh(), g: g.mesh(), halo: q.mesh(), tex: paperTex() };
  const d = new B(),
    dg = new B(),
    w = [0.9, 0.92, 0.95];
  for (const sx of [-1.15, 1.15]) {
    d.box(sx, 1.8, 0, 0.16, 3.6, 0.16, w);
    dg.box(sx, 1.8, 0, 0.06, 3.6, 0.2, [0.3, 1, 0.6]);
  }
  d.box(0, 3.5, 0, 2.5, 0.16, 0.16, w);
  dg.box(0, 0.03, 0, 2.2, 0.05, 3, [0.2, 0.9, 0.5]);
  for (let z = -1; z <= 1; z += 1) dg.box(0, 0.06, z, 1.1, 0.04, 0.3, [0.8, 1, 0.85]);
  dg.cyl(0, 3.9, 0, 0.6, 0.0, 0.9, 8, [0.3, 1, 0.6], true);
  DROPM = { b: d.mesh(), g: dg.mesh(), sign: secSign("YETKAZ", "#0b6e4f", "#fff", 2.2, 3.0, 0) };
}
function drawCourierObj(o, ca) {
  if (!PKGM) courBuild();
  if (o.k === "pkg") {
    const bob = Math.sin(ca * 2 + o.z) * 0.14,
      sc = 1 + Math.sin(ca * 4) * 0.04,
      M = joint(Tp(o.x, o.y - 0.45 + bob, o.z), 0, 0, 0, 0, ca * 1.3, 0);
    draw(PKGM.b, M, PKGM.tex, { emis: 0.4, spec: 0.35, tint: [sc, sc, sc] });
    draw(PKGM.lid, M, null, { emis: 0.45, spec: 0.7 });
    draw(PKGM.g, joint(Tp(o.x, o.y - 0.45 + bob, o.z), 0, 0, 0, 0, -ca * 2.2, 0), null, { emis: 1 });
    /* soft golden glow around it, so it reads from far away */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    draw(PKGM.halo, Tp(o.x, o.y + bob, o.z - 0.2), HALOT, { emis: 1, alpha: 0.55 + 0.25 * Math.sin(ca * 5), tint: o.story ? [0.35, 1.0, 1.3] : [1, 1, 1] });
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return;
  }
  const M = Tp(o.x, 0, o.z),
    bob = Math.sin(ca * 3) * 0.2;
  draw(DROPM.b, M, null, { emis: 0.3 });
  draw(DROPM.g, Tp(o.x, bob * 0.3, o.z), null, { emis: 1 });
  draw(DROPM.sign.m, Tp(o.x, 3.0, o.z - 0.02), DROPM.sign.tex, { emis: 0.9 });
}
/* ---------- landmark plazas ---------- */
const PLAZA = {};
function plazaBuild(th) {
  const b = new B(),
    g = new B(),
    sand = [0.84, 0.7, 0.48],
    turq = [0.1, 0.6, 0.74],
    brick = [0.72, 0.44, 0.27],
    stone = [0.78, 0.76, 0.72];
  for (const sd of [-1, 1]) {
    b.quad([[sd * 8.6, 0.04, 0], [sd * 42, 0.04, 0], [sd * 42, 0.04, CH], [sd * 8.6, 0.04, CH]], [0, 1, 0], QUADUV, stone);
    for (let z = 6; z < CH; z += 12) {
      b.box(sd * 9.6, 0.3, z, 0.6, 0.5, 1.8, [0.5, 0.36, 0.24]); // benches
      b.cyl(sd * 11.5, 0, z + 3, 0.18, 0.14, 2.2, 6, [0.4, 0.3, 0.2]);
      b.sph(sd * 11.5, 3.3, z + 3, 1.2, 1.4, 1.2, 6, 8, [0.22, 0.5, 0.26]);
    }
  }
  const at = (x) => (z) => [x, z];
  if (th === 0) {
    b.lathe(17, 0, 30, [[2.8, 0], [1.7, 20], [1.0, 42], [0.55, 52]], 12, [0.78, 0.8, 0.84], [0.62, 0.64, 0.7]);
    b.sph(17, 36, 30, 3.8, 1.2, 3.8, 8, 12, [0.7, 0.72, 0.78]);
    b.sph(17, 44, 30, 2.4, 0.9, 2.4, 8, 12, [0.7, 0.72, 0.78]);
    b.cyl(17, 52, 30, 0.2, 0.05, 11, 6, [0.8, 0.2, 0.2]);
    g.sph(17, 63.4, 30, 0.35, 0.35, 0.35, 5, 6, [1, 0.2, 0.2]);
    b.cyl(-15, 0, 30, 4.6, 4.6, 0.9, 20, stone, true);
    g.cyl(-15, 0.88, 30, 4.0, 4.0, 0.06, 20, [0.4, 0.8, 1], true);
    b.cyl(-15, 0, 30, 0.35, 0.35, 3, 8, stone, true);
  } else if (th === 1) {
    for (const sd of [-1, 1]) {
      const x = sd * 17;
      b.box(x, 7, 30, 4.4, 14, 22, sand);
      b.box(x - sd * 2.3, 9, 30, 0.5, 16, 8, sand);
      b.box(x - sd * 2.55, 7.5, 30, 0.3, 10, 5.5, [0.08, 0.06, 0.07]);
      for (const dz of [-9, 9]) {
        b.cyl(x - sd * 1.5, 0, 30 + dz, 1.3, 1.1, 17, 12, sand);
        b.cyl(x - sd * 1.5, 17, 30 + dz, 1.0, 0.1, 3, 12, turq);
      }
      b.sph(x + sd * 3.5, 13.5, 30, 5, 5.6, 5, 10, 14, turq);
      b.box(x - sd * 2.3, 14, 30, 0.2, 1.2, 14, turq);
      g.box(x - sd * 2.4, 3.5, 30, 0.1, 0.3, 6, [1, 0.8, 0.4]);
    }
  } else if (th === 2) {
    b.lathe(15, 0, 30, [[3.8, 0], [2.7, 18], [2.3, 36], [3.2, 38]], 14, brick, [0.62, 0.38, 0.23]);
    for (let y = 6; y < 36; y += 7) b.cyl(15, y, 30, 2.9 - y * 0.02, 2.9 - y * 0.02, 0.7, 14, [0.12, 0.5, 0.74]);
    b.cyl(15, 38, 30, 3.4, 3.2, 3, 14, [0.12, 0.5, 0.74]);
    b.cyl(15, 41, 30, 3.5, 0.2, 3.5, 14, turq);
    g.sph(15, 45, 30, 0.35, 0.35, 0.35, 5, 6, [1, 0.8, 0.3]);
    b.box(-17, 3, 30, 8, 6, 22, sand);
    b.sph(-17, 6, 30, 6, 4.5, 6, 10, 14, turq);
  } else if (th === 3) {
    b.cyl(16, 0, 30, 7.2, 6.8, 17, 18, turq, true, [0.1, 0.45, 0.62]);
    b.cyl(16, 17, 30, 7.4, 7.4, 0.8, 18, sand, true);
    for (let a = 0; a < 12; a++) b.box(16 + Math.cos((a / 12) * TAU) * 7.2, 18.3, 30 + Math.sin((a / 12) * TAU) * 7.2, 1.4, 1.4, 1.4, sand);
    g.box(9, 6, 30, 0.1, 0.4, 2, [1, 0.85, 0.5]);
    for (const sd of [-1, 1]) b.box(sd * 14, 2.4, 30, 1.2, 4.8, 24, sand);
  } else if (th === 4) {
    b.box(17, 3, 30, 10, 6, 28, [0.92, 0.55, 0.62]);
    for (let z = 18; z <= 42; z += 4) {
      b.box(12, 2.4, z, 0.4, 3.6, 2.6, [0.1, 0.06, 0.08]);
      b.box(17.2 - 5, 6.4, z, 0.5, 0.8, 3.4, [[0.2, 0.7, 0.85], [0.95, 0.75, 0.2], [0.85, 0.2, 0.4]][(z / 4) % 3 | 0]);
    }
    for (let i = 0; i < 3; i++) b.box(17, 6.6 + i * 0.8, 30, 10.5 - i * 2.5, 0.7, 28 - i * 6, [[0.2, 0.7, 0.85], [0.95, 0.75, 0.2], [0.85, 0.2, 0.4]][i]);
    for (let z = 10; z < 52; z += 5) {
      b.cyl(-14, 0, z, 0.12, 0.12, 3.6, 5, [0.5, 0.4, 0.3]);
      b.box(-14, 2.4, z + 2.5, 0.06, 2.4, 4, [[0.95, 0.3, 0.4], [0.2, 0.65, 0.9], [0.98, 0.8, 0.25]][(z / 5) % 3 | 0]);
    }
  } else {
    b.box(16, 1, 30, 7, 2, 7, [0.1, 0.1, 0.16]);
    b.cyl(16, 2, 30, 1.6, 1.0, 46, 10, [0.12, 0.12, 0.2]);
    for (let y = 8, i = 0; y < 46; y += 7, i++) g.cyl(16, y, 30, 4.5 - y * 0.05, 4.5 - y * 0.05, 0.4, 16, i % 2 ? [0.2, 0.95, 1] : [1, 0.25, 0.85], false);
    g.sph(16, 49, 30, 1, 1, 1, 6, 8, [1, 0.95, 0.4]);
    g.box(-12, 2.5, 30, 0.2, 5, 26, [0.3, 0.9, 1]);
  }
  return {
    parts: [
      { m: b.mesh(), mat: { emis: th === 5 ? 0.25 : 0.14 } },
      { m: g.mesh(), mat: { emis: 1 } },
    ],
    portal: [],
  };
}
