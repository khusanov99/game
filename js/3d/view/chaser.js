/* view/chaser.js — Chasers: "Burgut" (a compact hawk-bot) and "Bo'ri" (a small robotic wolf pup). */
"use strict";
/* ---------- CHASER: "Burgut" — hawk-bot ----------
   Same scale family as the hero (~1.55 tall) but sharper: dark steel shell, crimson armour, a hooked bronze beak, a single red LED visor
   stripe with angry brow plates, a swept crest with a police beacon, folded blade-wings on its back and talon feet. */
const CM = {
  steel: mat([0.2, 0.22, 0.34], { spec: 0.95, emis: 0.32 }),
  armor: mat([0.8, 0.1, 0.18], { spec: 0.9, emis: 0.42 }),
  dark: mat([0.07, 0.07, 0.12], { spec: 0.4, emis: 0.2 }),
  bronze: mat([0.95, 0.62, 0.22], { spec: 1, emis: 0.55 }),
  eye: { tint: [1, 0.12, 0.18], emis: 1 },
  rod: { tint: [1, 0.4, 0.2], emis: 1 },
};
function drawChaser(root, ph, t) {
  const sw = Math.sin(ph),
    cw = Math.cos(ph),
    R = joint(root, 0, Math.abs(sw) * 0.05, 0, 0.2, 0, sw * 0.07),
    hip = joint(R, 0, 0.38, 0, 0);
  for (const s of [-1, 1]) {
    const sg = s > 0 ? sw : -sw,
      cg = s > 0 ? cw : -cw,
      h1 = -sg * 0.9,
      k1 = 0.2 + 0.9 * Math.max(0, cg);
    const th = joint(hip, s * 0.15, 0, 0, h1);
    pd(cylM(0.075, 0.06, 0.2), th, null, CM.steel);
    const kn = joint(th, 0, -0.2, 0, k1);
    pd(sphM(0.06), kn, null, CM.bronze);
    pd(cylM(0.06, 0.05, 0.17), kn, null, CM.dark);
    const ft = joint(kn, 0, -0.17, 0, -(h1 + k1) * 0.5);
    pd(boxM(0.14, 0.05, 0.16), joint(ft, 0, -0.02, 0.04, 0), null, CM.dark);
    for (let i = -1; i <= 1; i++)
      pd(
        coneM(0.025, 0.14),
        joint(ft, i * 0.05, -0.03, 0.15, 1.5),
        null,
        CM.bronze,
      ); // talons
  }
  const tor = joint(hip, 0, 0.26, 0, 0, 0, -sw * 0.05);
  pd(sphM(0.34, 1.0, 0.98), tor, null, CM.steel);
  pd(sphM(0.27, 0.82, 0.5), joint(tor, 0, -0.03, 0.18, 0), null, CM.armor);
  pd(boxM(0.46, 0.05, 0.08), joint(tor, 0, -0.1, 0.17, 0), null, CM.bronze);
  pd(boxM(0.18, 0.04, 0.03), joint(tor, 0, 0.08, 0.29, 0), null, CM.eye);
  for (const s of [-1, 1])
    for (let i = 0; i < 2; i++)
      pd(
        boxM(0.07, 0.5 - i * 0.12, 0.02, 0.25),
        joint(
          tor,
          s * (0.12 + i * 0.07),
          0.08,
          -0.3,
          -0.5 + Math.sin(t * 8 + i) * 0.04,
          0,
          s * (0.28 + i * 0.22),
        ),
        null,
        i ? CM.bronze : CM.armor,
      ); // folded blade-wings
  const hd = joint(tor, 0, 0.48, 0.02, 0.1);
  pd(sphM(0.32, 0.9, 0.95), hd, null, CM.steel);
  pd(sphM(0.28, 0.6, 0.5), joint(hd, 0, 0.0, 0.17, 0), null, CM.dark);
  pd(boxM(0.38, 0.07, 0.03), joint(hd, 0, 0.04, 0.3, 0), null, CM.eye);
  for (const s of [-1, 1]) {
    pd(
      boxM(0.17, 0.04, 0.03),
      joint(hd, s * 0.1, 0.13, 0.3, 0, 0, -s * 0.4),
      null,
      CM.bronze,
    );
    pd(
      cylM(0.05, 0.05, 0.04),
      joint(hd, s * 0.31, 0, 0, 0, 0, (PI / 2) * s),
      null,
      CM.bronze,
    );
  }
  pd(coneM(0.085, 0.24), joint(hd, 0, -0.06, 0.3, 1.35), null, CM.bronze);
  pd(coneM(0.05, 0.13), joint(hd, 0, -0.16, 0.5, 2.1), null, CM.armor); // hooked beak
  for (let i = -1; i <= 1; i++)
    pd(
      boxM(0.06, 0.26, 0.02, 0.13),
      joint(hd, i * 0.1, 0.27, -0.06, -0.55 - Math.abs(i) * 0.1, 0, -i * 0.3),
      null,
      CM.armor,
    ); // crest
  pd(
    sphM(0.06),
    joint(hd, 0, 0.34, 0.06, 0),
    null,
    Math.floor(t * 7) % 2 ? SIREN_R : SIREN_B,
  ); // police beacon
  for (const s of [-1, 1]) {
    const a = s > 0 ? -0.95 + sw * 0.1 : -sw * 0.8,
      sh = joint(tor, s * 0.33, 0.06, 0, a, 0, s * 0.2);
    pd(sphM(0.09, 1.5, 0.5), joint(sh, 0, -0.14, 0, 0), null, CM.armor);
    pd(sphM(0.05), sh, null, CM.bronze);
    if (s > 0) {
      const L = joint(sh, 0, -0.3, 0.02, -1.5);
      pd(cylM(0.02, 0.02, 0.8), joint(L, 0, 0.2, 0, 0), null, CM.dark);
      pd(coneM(0.05, 0.2), joint(L, 0, 0.58, 0, 0), null, CM.rod);
      pd(sphM(0.055), joint(L, 0, 0.58, 0, 0), null, CM.rod);
    } // shock lance
  }
}
/* "Bo'ri" — a robotic wolf pup (~0.75 long legs-to-ears): big ears, plume tail, red LED eyes, bronze collar. Built at 0.7 scale. */
const WK = 0.7,
  WM = {
    fur: mat([0.42, 0.45, 0.58], { spec: 0.9, emis: 0.32 }),
    dark: mat([0.1, 0.11, 0.16], { spec: 0.3, emis: 0.2 }),
    bronze: CM.bronze,
    eye: CM.eye,
  };
const wJ = (p, x, y, z, rx, ry, rz) =>
    joint(p, x * WK, y * WK, z * WK, rx, ry, rz),
  wB = (w, h, d, dy) => boxM(w * WK, h * WK, d * WK, (dy || 0) * WK),
  wC = (a, b, h) => cylM(a * WK, b * WK, h * WK),
  wS = (r, a, b) => sphM(r * WK, a, b),
  wK = (r, h) => coneM(r * WK, h * WK);
function drawWolf(root, ph, t) {
  const g = ph * 1.5,
    sw = Math.sin(g),
    R = wJ(root, 0, 0.1 + Math.abs(sw) * 0.09, 0, 0.06 * sw);
  pd(wB(0.46, 0.44, 0.74), wJ(R, 0, 0.66, -0.2, 0), null, WM.fur);
  pd(wB(0.5, 0.4, 0.5), wJ(R, 0, 0.68, 0.3, 0), null, WM.fur);
  pd(wB(0.3, 0.07, 0.8), wJ(R, 0, 0.9, 0, 0), null, WM.dark);
  pd(wB(0.14, 0.06, 0.8), wJ(R, 0, 0.95, 0, 0), null, WM.bronze);
  const hd = wJ(R, 0, 0.9, 0.62, 0.12 + sw * 0.05);
  pd(wS(0.24, 1, 1), hd, null, WM.fur);
  pd(wB(0.2, 0.15, 0.4), wJ(hd, 0, -0.05, 0.3, 0.08), null, WM.dark);
  for (const s of [-1, 1]) {
    pd(
      wK(0.11, 0.34),
      wJ(hd, s * 0.13, 0.2, -0.06, 0, 0, s * 0.15),
      null,
      WM.fur,
    );
    pd(wB(0.05, 0.05, 0.1), wJ(hd, s * 0.12, 0.07, 0.17, 0), null, WM.eye);
  }
  pd(wB(0.4, 0.07, 0.12), wJ(hd, 0, -0.18, -0.05, 0), null, WM.bronze);
  pd(wS(0.05, 1, 1), wJ(hd, 0, -0.26, 0.1, 0), null, WM.eye);
  let j = wJ(R, 0, 0.8, -0.6, 0.9);
  for (let i = 0; i < 4; i++) {
    pd(
      wC(0.06 - i * 0.008, 0.07 - i * 0.008, 0.2),
      j,
      null,
      i & 1 ? WM.bronze : WM.fur,
    );
    j = wJ(j, 0, 0.19, 0, 0.12 + Math.sin(t * 11 + i) * 0.16);
  }
  for (const [lx, lz, f] of [
    [-0.18, 0.4, 0],
    [0.18, 0.4, 1],
    [-0.18, -0.46, 1],
    [0.18, -0.46, 0],
  ]) {
    const a = Math.sin(g + f * Math.PI) * 0.95,
      up = wJ(R, lx, 0.52, lz, a);
    pd(wS(0.09, 1, 1), up, null, WM.dark);
    pd(wC(0.09, 0.06, 0.3), up, null, WM.fur);
    const lo = wJ(up, 0, -0.3, 0, 0.55 + Math.max(0, -a) * 0.6);
    pd(wC(0.06, 0.04, 0.3), lo, null, WM.dark);
    pd(wB(0.1, 0.05, 0.16), wJ(lo, 0, -0.3, 0.04, 0), null, WM.bronze);
  }
}
