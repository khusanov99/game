/* view/chaser.js — Chaser "Alp" and the robotic wolf "Bo'ri". */
"use strict";
/* ---------- CHASER: "Alp" — an armoured steppe warrior-bot ----------
   Heavy crimson armour with bronze trim, a conical bahodir helmet with chain veil and a single red visor slit, ram-horn (qo'chqor shoxi)
   pauldrons, a streaming cape and a glowing lance. Deliberately wide and heavy so it never reads as the slim hero. */
const CM = {
  armor: mat([0.62, 0.1, 0.14], { spec: 0.9, emis: 0.36 }),
  steel: mat([0.3, 0.33, 0.44], { spec: 0.95, emis: 0.3 }),
  dark: mat([0.12, 0.12, 0.18], { spec: 0.3, emis: 0.2 }),
  bronze: mat([0.95, 0.62, 0.22], { spec: 1, emis: 0.55 }),
  cape: mat([0.5, 0.06, 0.12], { emis: 0.34 }),
  eye: { tint: [1, 0.12, 0.18], emis: 1 },
  lance: { tint: [1, 0.35, 0.2], emis: 1 },
  shaft: mat([0.2, 0.14, 0.1], { emis: 0.2 }),
};
function horn(base, s, big) {
  // curled ram horn: 4 tapering segments bending outwards then forward
  let j = base;
  for (let i = 0; i < 4; i++) {
    pd(coneM(0.085 - i * 0.015, 0.26 * big), j, null, CM.bronze);
    j = joint(j, 0, 0.22 * big, 0, 0.18, 0, -s * 0.5);
  }
}
function drawChaser(root, ph, t) {
  const sw = Math.sin(ph),
    cw = Math.cos(ph),
    bob = Math.abs(sw) * 0.07,
    R = joint(root, 0, bob, 0, 0.16),
    hip = joint(R, 0, 1.02, 0, 0);
  pd(boxM(0.62, 0.26, 0.4, 0.05), hip, null, CM.dark);
  pd(boxM(0.66, 0.1, 0.42, 0.04), joint(hip, 0, 0.14, 0, 0), null, CM.bronze);
  const tor = joint(hip, 0, 0.58, 0, 0, sw * 0.1);
  pd(boxM(0.86, 0.78, 0.5, 0.08), tor, null, CM.armor);
  pd(boxM(0.6, 0.5, 0.08, 0.04), joint(tor, 0, 0.02, 0.27, 0), null, CM.steel);
  pd(boxM(0.5, 0.06, 0.05), joint(tor, 0, 0.16, 0.31, 0), null, CM.eye);
  pd(boxM(0.5, 0.05, 0.05), joint(tor, 0, -0.04, 0.31, 0), null, CM.bronze);
  pd(boxM(0.5, 0.05, 0.05), joint(tor, 0, -0.14, 0.31, 0), null, CM.eye);
  // cape: three panels, each waving a little out of phase
  for (let i = -1; i <= 1; i++)
    pd(
      boxM(0.3, 1.0, 0.04),
      joint(
        tor,
        i * 0.29,
        0.34,
        -0.3,
        0.42 + Math.sin(t * 9 + i * 1.3) * 0.14 + Math.abs(sw) * 0.1,
        0,
        i * 0.03,
      ),
      null,
      CM.cape,
    );
  pd(boxM(0.9, 0.08, 0.06), joint(tor, 0, 0.36, -0.28, 0), null, CM.bronze);
  // back beacon
  const on = Math.floor(t * 7) % 2;
  pd(sphM(0.1), joint(tor, 0, 0.1, -0.36, 0), null, on ? SIREN_R : SIREN_B);
  // head: conical helmet + veil + visor slit
  const hd = joint(tor, 0, 0.5, 0.04, 0.12);
  pd(cylM(0.12, 0.12, 0.12), hd, null, CM.dark);
  pd(sphM(0.3, 1, 0.95), joint(hd, 0, 0.3, 0, 0), null, CM.steel);
  pd(coneM(0.15, 0.5), joint(hd, 0, 0.56, 0, 0), null, CM.bronze);
  pd(sphM(0.05), joint(hd, 0, 1.06, 0, 0), null, CM.eye);
  pd(boxM(0.4, 0.07, 0.07), joint(hd, 0, 0.32, 0.27, 0), null, CM.eye);
  pd(boxM(0.5, 0.1, 0.42, 0.03), joint(hd, 0, 0.5, 0, 0), null, CM.bronze);
  pd(boxM(0.46, 0.2, 0.3, 0.04), joint(hd, 0, 0.1, 0.02, 0), null, CM.dark);
  for (const s of [-1, 1]) {
    pd(boxM(0.08, 0.3, 0.3), joint(hd, s * 0.3, 0.2, 0, 0), null, CM.steel);
    horn(joint(hd, s * 0.3, 0.36, 0, 0, 0, s * 0.6), s, 1);
  }
  // arms: left swings, right carries the lance forward
  for (const s of [-1, 1]) {
    const sh = joint(
      tor,
      s * 0.54,
      0.26,
      0,
      s > 0 ? -1.0 + sw * 0.15 : -sw * 0.9,
      0,
      s * 0.14,
    );
    pd(sphM(0.2, 1, 0.8), joint(tor, s * 0.54, 0.34, 0, 0), null, CM.bronze);
    pd(cylM(0.11, 0.09, 0.34), sh, null, CM.armor);
    const el = joint(
      sh,
      0,
      -0.34,
      0,
      s > 0 ? -0.5 : -0.8 - Math.max(0, s * sw) * 0.3,
    );
    pd(sphM(0.09), el, null, CM.dark);
    pd(cylM(0.09, 0.08, 0.32), el, null, CM.steel);
    pd(sphM(0.12), joint(el, 0, -0.34, 0, 0), null, CM.bronze);
    if (s > 0) {
      const L = joint(el, 0, -0.34, 0.05, -1.35);
      pd(cylM(0.03, 0.03, 1.5), joint(L, 0, -0.2, 0, 0), null, CM.shaft);
      pd(coneM(0.09, 0.4), joint(L, 0, 1.3, 0, 0), null, CM.lance);
      pd(sphM(0.1), joint(L, 0, 1.3, 0, 0), null, CM.lance);
    }
  }
  // legs: heavy stride
  for (const s of [-1, 1]) {
    const sg = s > 0 ? sw : -sw,
      cg = s > 0 ? cw : -cw,
      h1 = -sg * 0.9,
      k1 = 0.2 + 0.9 * Math.max(0, cg);
    const th = joint(hip, s * 0.22, 0, 0, h1);
    pd(sphM(0.16), th, null, CM.bronze);
    pd(cylM(0.14, 0.1, 0.5), th, null, CM.armor);
    const kn = joint(th, 0, -0.5, 0, k1);
    pd(sphM(0.11), kn, null, CM.dark);
    pd(cylM(0.1, 0.09, 0.46), kn, null, CM.steel);
    const ft = joint(kn, 0, -0.47, 0, -(h1 + k1) * 0.5);
    pd(
      boxM(0.26, 0.14, 0.42, 0.04),
      joint(ft, 0, -0.03, 0.08, 0),
      null,
      CM.dark,
    );
    pd(boxM(0.26, 0.05, 0.42), joint(ft, 0, -0.1, 0.08, 0), null, CM.bronze);
  }
}
/* "Bo'ri" — a robotic steppe wolf: long snout, pricked ears, bronze collar with a glowing tag, plume tail made of segments. */
const WM = {
  fur: mat([0.38, 0.4, 0.5], { spec: 0.9, emis: 0.3 }),
  dark: mat([0.1, 0.11, 0.16], { spec: 0.3, emis: 0.2 }),
  bronze: CM.bronze,
  eye: CM.eye,
};
function drawWolf(root, ph, t) {
  const g = ph * 1.5,
    sw = Math.sin(g),
    R = joint(root, 0, 0.1 + Math.abs(sw) * 0.09, 0, 0.06 * sw);
  pd(boxM(0.46, 0.44, 0.74, 0.08), joint(R, 0, 0.66, -0.2, 0), null, WM.fur);
  pd(boxM(0.5, 0.4, 0.5, 0.08), joint(R, 0, 0.68, 0.3, 0), null, WM.fur);
  pd(boxM(0.3, 0.07, 0.8), joint(R, 0, 0.9, 0, 0), null, WM.dark);
  pd(boxM(0.14, 0.06, 0.8), joint(R, 0, 0.95, 0, 0), null, WM.bronze);
  const hd = joint(R, 0, 0.9, 0.62, 0.12 + sw * 0.05);
  pd(boxM(0.34, 0.3, 0.34, 0.07), joint(hd, 0, 0, 0, 0), null, WM.fur);
  pd(boxM(0.2, 0.15, 0.4, 0.05), joint(hd, 0, -0.05, 0.3, 0.08), null, WM.dark);
  pd(boxM(0.22, 0.05, 0.3), joint(hd, 0, -0.14, 0.3, 0), null, WM.fur);
  for (const s of [-1, 1]) {
    pd(
      coneM(0.09, 0.3),
      joint(hd, s * 0.12, 0.2, -0.06, 0, 0, s * 0.12),
      null,
      WM.fur,
    );
    pd(boxM(0.05, 0.05, 0.1), joint(hd, s * 0.12, 0.07, 0.17, 0), null, WM.eye);
  }
  pd(boxM(0.4, 0.07, 0.12), joint(hd, 0, -0.18, -0.05, 0), null, WM.bronze);
  pd(sphM(0.05), joint(hd, 0, -0.26, 0.1, 0), null, WM.eye);
  let j = joint(R, 0, 0.8, -0.6, 0.9);
  for (let i = 0; i < 4; i++) {
    pd(
      cylM(0.06 - i * 0.008, 0.07 - i * 0.008, 0.2),
      j,
      null,
      i & 1 ? WM.bronze : WM.fur,
    );
    j = joint(j, 0, 0.19, 0, 0.12 + Math.sin(t * 11 + i) * 0.16);
  }
  for (const [lx, lz, f] of [
    [-0.18, 0.4, 0],
    [0.18, 0.4, 1],
    [-0.18, -0.46, 1],
    [0.18, -0.46, 0],
  ]) {
    const a = Math.sin(g + f * Math.PI) * 0.95,
      up = joint(R, lx, 0.52, lz, a);
    pd(sphM(0.09), up, null, WM.dark);
    pd(cylM(0.09, 0.06, 0.3), up, null, WM.fur);
    const lo = joint(up, 0, -0.3, 0, 0.55 + Math.max(0, -a) * 0.6);
    pd(cylM(0.06, 0.04, 0.3), lo, null, WM.dark);
    pd(boxM(0.1, 0.05, 0.16), joint(lo, 0, -0.3, 0.04, 0), null, WM.bronze);
  }
}
