/* view/courier-view.js — Parcel and drop-off markers, plus landmark plazas of the rebuilt city. */
"use strict";
let PKGM = null,
  DROPM = null;
/* ---------- the real things being delivered (front faces -z, towards the camera) ---------- */
const ITEMB = [
  /* 0 teddy bear */ (b) => {
    const br = [0.62, 0.4, 0.22],
      lt = [0.88, 0.68, 0.45],
      dk = [0.1, 0.06, 0.04],
      rd = [0.9, 0.12, 0.22];
    b.sph(0, 0.3, 0, 0.3, 0.28, 0.26, 7, 10, br);
    b.sph(0, 0.3, -0.18, 0.18, 0.2, 0.09, 6, 8, lt);
    b.sph(0, 0.72, 0, 0.25, 0.23, 0.22, 7, 10, br);
    for (const sx of [-0.19, 0.19]) {
      b.sph(sx, 0.9, 0, 0.1, 0.1, 0.06, 6, 8, br);
      b.sph(sx, 0.9, -0.03, 0.055, 0.055, 0.03, 5, 6, lt);
      b.sph(sx * 1.75, 0.36, -0.04, 0.1, 0.17, 0.1, 6, 8, br);
      b.sph(sx * 0.68, 0.08, -0.1, 0.13, 0.1, 0.15, 6, 8, br);
      b.sph(sx * 0.4, 0.77, -0.2, 0.032, 0.036, 0.02, 5, 6, dk);
    }
    b.sph(0, 0.67, -0.2, 0.1, 0.08, 0.07, 6, 8, lt);
    b.sph(0, 0.7, -0.26, 0.035, 0.03, 0.025, 5, 6, dk);
    b.sph(0, 0.5, -0.17, 0.07, 0.05, 0.04, 5, 6, rd);
    b.sph(-0.11, 0.5, -0.17, 0.08, 0.05, 0.04, 5, 6, rd);
    b.sph(0.11, 0.5, -0.17, 0.08, 0.05, 0.04, 5, 6, rd);
  },
  /* 1 Samarkand ceramic vase */ (b) => {
    b.lathe(0, 0, 0, [[0.16, 0], [0.28, 0.1], [0.37, 0.34], [0.3, 0.6], [0.16, 0.76], [0.13, 0.9], [0.23, 1.0]], 14, [0.1, 0.6, 0.76], [0.04, 0.32, 0.62]);
    b.cyl(0, 0.3, 0, 0.375, 0.375, 0.05, 14, [1, 0.8, 0.28]);
    b.cyl(0, 0.5, 0, 0.33, 0.33, 0.04, 14, [1, 0.8, 0.28]);
    for (let i = 0; i < 6; i++) b.sph(Math.sin(i * 1.047) * 0.34, 0.41, -Math.cos(i * 1.047) * 0.34, 0.05, 0.05, 0.05, 4, 5, [0.96, 0.96, 1]);
  },
  /* 2 Bukhara silk rolls */ (b) => {
    b.cyl(-0.2, 0, 0, 0.21, 0.21, 0.82, 10, [0.86, 0.1, 0.45], true, [0.98, 0.7, 0.18]);
    b.cyl(0.22, 0, 0.04, 0.19, 0.19, 0.74, 10, [0.1, 0.62, 0.7], true, [0.96, 0.9, 0.5]);
    b.box(-0.2, 0.5, -0.215, 0.3, 0.04, 0.02, [1, 0.85, 0.35]);
    b.box(0, 0.02, -0.36, 0.7, 0.025, 0.3, [0.86, 0.1, 0.45]);
  },
  /* 3 Khiva old brass key */ (b) => {
    const g = [0.95, 0.72, 0.22],
      g2 = [0.7, 0.5, 0.12];
    for (let i = 0; i < 12; i++) b.sph(Math.cos(i * 0.5236) * 0.19, 0.82 + Math.sin(i * 0.5236) * 0.19, 0, 0.055, 0.055, 0.05, 4, 5, g);
    b.box(0, 0.4, 0, 0.08, 0.64, 0.07, g);
    b.box(0, 0.62, 0, 0.16, 0.06, 0.1, g2);
    b.box(0.1, 0.1, 0, 0.14, 0.07, 0.07, g);
    b.box(0.08, 0.22, 0, 0.1, 0.07, 0.07, g);
    b.box(0, 0.5, -0.06, 0.2, 0.15, 0.03, [0.8, 0.1, 0.18]);
  },
  /* 4 Fergana silk-mill thread spools */ (b) => {
    const cols = [[0.9, 0.15, 0.25], [0.12, 0.6, 0.85], [0.98, 0.8, 0.2]];
    [[-0.26, 0.05], [0.26, 0.05], [0, -0.22]].forEach(([x, z], i) => {
      b.cyl(x, 0, z, 0.2, 0.2, 0.05, 10, [0.78, 0.6, 0.36]);
      b.cyl(x, 0.05, z, 0.14, 0.14, 0.42, 10, cols[i]);
      b.cyl(x, 0.47, z, 0.2, 0.2, 0.05, 10, [0.78, 0.6, 0.36]);
    });
    b.box(0, 0.54, 0.0, 0.34, 0.04, 0.26, [0.96, 0.45, 0.7]);
  },
  /* 5 night-cafe sweets */ (b) => {
    b.box(0, 0.15, 0, 0.84, 0.3, 0.64, [0.96, 0.52, 0.7]);
    b.box(0, 0.3, 0, 0.84, 0.03, 0.64, [1, 0.85, 0.35]);
    const c = [[0.95, 0.35, 0.2], [0.5, 0.25, 0.1], [0.98, 0.78, 0.2], [0.4, 0.8, 0.4], [0.95, 0.35, 0.2], [0.5, 0.25, 0.1]];
    for (let i = 0; i < 6; i++) {
      const x = -0.25 + (i % 3) * 0.25,
        z = i < 3 ? -0.14 : 0.14;
      b.cyl(x, 0.3, z, 0.1, 0.12, 0.07, 8, [1, 0.9, 0.7]);
      b.sph(x, 0.42, z, 0.11, 0.1, 0.11, 6, 8, c[i]);
    }
  },
  /* 6 flat round bread (non) on a cloth */ (b) => {
    b.box(0, 0.015, 0, 1.0, 0.03, 1.0, [0.8, 0.15, 0.25]);
    b.cyl(0, 0.03, 0, 0.5, 0.46, 0.14, 14, [0.86, 0.58, 0.22], true);
    b.cyl(0, 0.17, 0, 0.34, 0.3, 0.025, 14, [0.74, 0.44, 0.14], true);
    for (let i = 0; i < 12; i++) b.sph(Math.sin(i * 0.52) * 0.4, 0.17, Math.cos(i * 0.52) * 0.4, 0.03, 0.02, 0.03, 4, 5, [0.98, 0.92, 0.7]);
  },
  /* 7 school books */ (b) => {
    [[0.09, 0.18, 0.82, [0.2, 0.4, 0.9]], [0.27, 0.16, 0.76, [0.88, 0.2, 0.25]], [0.44, 0.17, 0.79, [0.2, 0.7, 0.4]]].forEach(([y, h, w, c], i) => {
      b.box(0.03 * (i - 1), y, 0, w, h, 0.56, c);
      b.box(0.03 * (i - 1) + w / 2 - 0.005, y, 0, 0.015, h - 0.04, 0.52, [0.97, 0.94, 0.86]);
      b.box(0.03 * (i - 1), y, -0.285, w - 0.04, h - 0.05, 0.015, [1, 0.85, 0.35]);
    });
  },
  /* 8 grocery crate */ (b) => {
    const w = [0.66, 0.44, 0.22];
    b.box(0, 0.22, 0, 0.84, 0.44, 0.62, w);
    for (const y of [0.12, 0.3]) b.box(0, y, -0.315, 0.86, 0.06, 0.02, [0.5, 0.32, 0.14]);
    [[-0.22, -0.12, [0.82, 0.12, 0.2]], [0, -0.14, [0.9, 0.2, 0.15]], [0.22, -0.1, [0.82, 0.12, 0.2]], [-0.12, 0.14, [0.5, 0.8, 0.2]], [0.14, 0.14, [0.45, 0.78, 0.2]]].forEach(([x, z, c]) => b.sph(x, 0.55, z, 0.14, 0.13, 0.14, 6, 8, c));
    b.sph(0.02, 0.7, 0.0, 0.08, 0.02, 0.04, 4, 6, [0.2, 0.6, 0.2]);
  },
];
const ITEMM = [];
const itemMesh = (i) => {
  if (!ITEMM[i]) {
    const b = new B();
    ITEMB[i](b);
    ITEMM[i] = b.mesh();
  }
  return ITEMM[i];
};
function scaleM(M, k) {
  const o = nm();
  o.set(M);
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) o[i] *= k;
  return o;
}
/* "ZUMARY DELIVERY" printed on the back of the courier bag, in the current language */
const BAGTXT = { uz: ["ZUMARY", "YETKAZIB BERISH"], en: ["ZUMARY", "DELIVERY"], ja: ["ZUMARY", "デリバリー"] };
let BAGL = null;
function bagLabel() {
  if (BAGL && BAGL.lg === LG) return BAGL;
  const c = mkc(256, 192),
    g = c.getContext("2d"),
    t = BAGTXT[LG] || BAGTXT.en;
  g.fillStyle = "#ff8a1f";
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = "#fff";
  g.lineWidth = 8;
  g.strokeRect(6, 6, 244, 180);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 50px system-ui,sans-serif";
  g.fillText(t[0], 128, 66);
  let fs = 44;
  g.font = `800 ${fs}px 'Hiragino Sans',system-ui,sans-serif`;
  while (g.measureText(t[1]).width > 220 && fs > 16) {
    fs -= 2;
    g.font = `800 ${fs}px 'Hiragino Sans',system-ui,sans-serif`;
  }
  g.fillStyle = "#0b1b3a";
  g.fillText(t[1], 128, 134);
  const b = new B();
  b.quad([[0.17, 0.12, 0], [-0.17, 0.12, 0], [-0.17, -0.12, 0], [0.17, -0.12, 0]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]);
  return (BAGL = { lg: LG, m: b.mesh(), tex: texFrom(c) });
}
const ITEM_OPT = { emis: 0.42, spec: 0.45, rim: 0.4 };
let BAGPOP = 0,
  lastRN = 0;
/* pick-up / hand-over animation: the item arcs into the courier bag (bag bounces, sparks), or out of it to the gate */
function courAnimTick(rdt) {
  BAGPOP = Math.max(0, BAGPOP - rdt * 2.4);
  const a = CR.anim;
  if (!a) return;
  a.t += rdt;
  if (a.k === "in" && a.t >= 0.6 && !a.hit) {
    a.hit = 1;
    BAGPOP = 1;
    burst(px, py + 1, pz - 0.4, 18, "#7fe6ff", 4.5);
    sfx.pow();
  }
  if (a.k === "out" && a.t >= 0.75 && !a.hit) {
    a.hit = 1;
    BAGPOP = 0.7;
    burst(a.x, 2.2, a.z, 28, "#ffd84f", 7);
  }
  if (a.t > 2.4) CR.anim = null;
}
function drawBagLabel(root) {
  const L = bagLabel();
  draw(L.m, joint(root, 0, 0.64, -0.545, 0.1), L.tex, { emis: 0.7 });
}
function drawItemFx(root, ca) {
  const a = CR.anim;
  const bag = joint(root, 0, 0.93, -0.4, 0);
  if (CR.st === "carry" && !(a && a.k === "in" && a.t < 0.6) && CR.item >= 0) {
    const w = Math.sin(ca * 3) * 0.04;
    draw(itemMesh(CR.item), scaleM(joint(bag, 0, -0.2 + w, 0, 0, ca * 0.8, 0), 0.45), null, ITEM_OPT);
  }
  if (!a) return;
  const k = a.k === "in" ? Math.min(1, a.t / 0.6) : Math.min(1, a.t / 0.75),
    e = k * k * (3 - 2 * k);
  let x, y, z, sc;
  if (a.k === "in") {
    x = a.x + (px - a.x) * e;
    y = a.y + (py + 1.05 - a.y) * e + Math.sin(k * Math.PI) * 1.6;
    z = a.z + (pz - 0.4 - a.z) * e;
    sc = 1.15 - 0.65 * e;
    if (k < 1) draw(itemMesh(a.item), scaleM(joint(Tp(x, y - 0.4, z), 0, a.t * 9, 0, 0), sc), null, ITEM_OPT);
  } else if (a.t < 2.2) {
    /* out: from the bag up onto the gate, then it rests there glowing */
    const gx = a.x,
      gz = a.z + 1.2;
    x = px + (gx - px) * e;
    y = py + 1.05 + (1.7 - py - 1.05) * e + Math.sin(k * Math.PI) * 1.2;
    z = pz - 0.4 + (gz - pz + 0.4) * e;
    sc = 0.5 + 0.8 * e;
    draw(itemMesh(a.item), scaleM(joint(Tp(x, y, z), 0, a.t * 5, 0, 0), sc), null, ITEM_OPT);
    if (k >= 1 && PKGM) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.depthMask(false);
      draw(PKGM.halo, Tp(gx, 1.9, gz - 0.2), HALOT, { emis: 1, alpha: Math.max(0, 0.9 - (a.t - 0.75) * 0.6), tint: [1, 0.9, 0.5] });
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }
}
function courBuild() {
  const g = new B(),
    q = new B();
  for (const a of [0, 1, 2, 3]) g.box(Math.cos(a * 1.571) * 0.8, 0.5 + (a % 2) * 0.35, Math.sin(a * 1.571) * 0.8, 0.09, 0.09, 0.09, [1, 0.95, 0.6]);
  q.quad([[-1.3, 1.3, 0], [1.3, 1.3, 0], [1.3, -1.3, 0], [-1.3, -1.3, 0]], [0, 0, -1], QUADUV, [1, 0.85, 0.4]);
  PKGM = { g: g.mesh(), halo: q.mesh() };
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
      M = joint(Tp(o.x, o.y - 0.5 + bob, o.z), 0, 0, 0, 0, ca * 1.3, 0);
    draw(itemMesh(o.item || 0), scaleM(M, 1.2), null, ITEM_OPT);
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
