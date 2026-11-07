/* view/metro-view.js — Meshes for the Tashkent Metro tunnel: marble vault, columns, chandeliers, portals, wagons. */
"use strict";
let TUN = null,
  TUNG = null,
  PORTAL = null,
  PORTALG = null;
const METROW = {};
function tunnelBuild() {
  const b = new B(),
    g = new B(),
    LEN = CH,
    RX = 9,
    RY = 3.4,
    WH = 3.4,
    cream = [0.88,0.82,0.7],
    marble = [0.84,0.8,0.76],
    tile = [0.1,0.56,0.72],
    gold = [0.92,0.74,0.3];
  const ell = (a, k) => [Math.cos(a) * RX * k, WH + Math.sin(a) * RY * k];
  /* vault */
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI,
      a1 = ((i + 1) / N) * Math.PI,
      p0 = ell(a0, 1),
      p1 = ell(a1, 1),
      mid = (a0 + a1) / 2,
      nr = [-Math.cos(mid) / RX, -Math.sin(mid) / RY],
      nl = Math.hypot(nr[0], nr[1]);
    b.quad(
      [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], LEN], [p0[0], p0[1], LEN]],
      [nr[0] / nl, nr[1] / nl, 0],
      [[0, 0], [1, 0], [1, 1], [0, 1]],
      i % 2 ? cream : mulc(cream, 0.93),
    );
    /* ribs every 6 m */
    for (let z = 0; z < LEN; z += 6) {
      const q0 = ell(a0, 0.985),
        q1 = ell(a1, 0.985);
      b.quad(
        [[q0[0], q0[1], z], [q1[0], q1[1], z], [q1[0], q1[1], z + 0.45], [q0[0], q0[1], z + 0.45]],
        [nr[0] / nl, nr[1] / nl, 0],
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        gold,
      );
    }
  }
  /* walls: marble, turquoise tile band, gold trim */
  for (const sd of [-1, 1]) {
    const n = [-sd, 0, 0],
      x = sd * RX;
    const wall = (y0, y1, c, dx = 0) =>
      b.quad(
        [[x + sd * dx, y0, 0], [x + sd * dx, y0, LEN], [x + sd * dx, y1, LEN], [x + sd * dx, y1, 0]],
        n,
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        c,
      );
    wall(0, WH, marble);
    wall(1.1, 2.0, tile, -sd * 0.03);
    wall(2.0, 2.18, gold, -sd * 0.04);
    wall(1.0, 1.1, gold, -sd * 0.04);
    /* wall lamps */
    for (let z = 3; z < LEN; z += 6) {
      g.box(sd * (RX - 0.2), 2.75, z, 0.12, 0.7, 0.34, [1, 0.82, 0.5]);
      g.box(sd * (RX - 0.16), 3.2, z, 0.1, 0.2, 0.5, [1, 0.9, 0.7]);
    }
    /* safety line along the platform edge */
    g.box(sd * 5.35, 0.19, LEN / 2, 0.16, 0.03, LEN, [1, 0.8, 0.1]);
    /* ceiling light strips */
    g.box(sd * 3.6, 6.5, LEN / 2, 0.3, 0.1, LEN, [0.9, 0.96, 1]);
    /* columns */
    for (let z = 6; z < LEN; z += 12) {
      b.cyl(sd * 6.9, 0, z, 0.46, 0.4, 4.7, 12, [0.9, 0.88,0.84], false);
      b.cyl(sd * 6.9, 0, z, 0.62, 0.62, 0.32, 12, gold, true);
      b.cyl(sd * 6.9, 4.5, z, 0.68, 0.46, 0.4, 12, gold, true);
    }
  }
  /* chandeliers */
  for (let z = 6; z < LEN; z += 12) {
    g.sph(0, 6.1, z, 0.45, 0.5, 0.45, 6, 8, [1, 0.88, 0.6]);
    g.sph(0, 6.1, z, 0.75, 0.2, 0.75, 6, 8, [1, 0.8, 0.45]);
    b.cyl(0, 6.2, z, 0.04, 0.04, 0.7, 5, [0.3, 0.26, 0.2]);
  }
  TUN = b.mesh();
  TUNG = g.mesh();
  /* portal arch with a glowing M sign (drawn at both ends of the tunnel) */
  const pb = new B(),
    pg = new B(),
    con = [0.74, 0.74, 0.76];
  for (const sd of [-1, 1]) pb.box(sd * 9.7, 3.6, 0, 1.5, 7.2, 1.6, con);
  pb.box(0, 7.4, 0, 21, 1.4, 1.6, con);
  pb.box(0, 8.4, 0, 21.4, 0.3, 2, [0.5, 0.5, 0.54]);
  const MZ = -0.9,
    Mc = [0.2, 0.9, 1];
  pg.box(-1.2, 7.4, MZ, 0.34, 1.0, 0.1, Mc);
  pg.box(1.2, 7.4, MZ, 0.34, 1.0, 0.1, Mc);
  pg.quad([[-1.2, 7.9, MZ],[-0.2, 7.2, MZ],[-0.2, 6.85, MZ],[-1.2, 7.5, MZ]],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]],Mc);
  pg.quad([[1.2, 7.9, MZ],[0.2, 7.2, MZ],[0.2, 6.85, MZ],[1.2, 7.5, MZ]],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]],Mc);
  pg.box(0, 6.9, MZ, 4.6, 0.08, 0.08, Mc);
  PORTAL = pb.mesh();
  PORTALG = pg.mesh();
}
function tunnelMeshes() {
  if (!TUN) tunnelBuild();
}
/* metro wagon (faces the player: headlights + driver window) */
function metroWagon(len) {
  const key = Math.round(len);
  if (METROW[key]) return METROW[key];
  const L = key,
    b = new B(),
    g = new B(),
    body = [0.82,0.86,0.9],
    dark = [0.1,0.14,0.22];
  b.box(0, 1.5, L / 2, 2.3, 2.6, L, body, {
    cols: { pz: [0.7,0.74,0.8], nz: [0.15,0.2,0.3] },
  });
  b.box(0, 1.1, L / 2, 2.34, 0.34, L - 0.2, [0.1,0.4,0.78]); // blue belt
  b.box(0, 0.26, L / 2, 2.0, 0.5, L - 0.4, [0.08,0.08,0.1]); // bogies
  b.box(0, 2.88, L / 2, 2.0, 0.12, L - 0.4, [0.55,0.57,0.62]); // roof
  for (let z = 2.5; z < L - 2; z += 4.5) b.box(0, 3.0, z, 1.3, 0.2, 1.6, [0.4,0.42,0.48]);
  b.box(0, 2.25, 0.02, 1.8, 0.8, 0.06, dark); // driver window
  for (const sd of [-1, 1]) {
    b.box(sd * 1.17, 1.5, L / 2, 0.04, 2.0, 0.1, dark);
    for (let z = 2.2; z < L - 1.5; z += 2.6)
      g.box(sd * 1.16, 2.1, z, 0.05, 0.75, 1.5, [1, 0.9, 0.6]); // lit windows
    g.box(sd * 0.75, 0.95, -0.03, 0.4, 0.22, 0.06, [1, 0.97, 0.85]); // headlights
  }
  g.box(0, 3.05 - 0.15, 0.04, 0.9, 0.12, 0.06, [0.2, 0.9, 1]);
  return (METROW[key] = { b: b.mesh(), g: g.mesh() });
}
