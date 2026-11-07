/* view/chaser.js — Chasers: three compact white-and-red security bots (wheeled box-bot, rolling ball-bot, winged drone). */
"use strict";
/* All share the hero's scale family (about 1.2-1.5 tall), a glossy white shell, black screens with angry red LED eyes and red accents. */
const CM = {
  white: mat([0.95, 0.96, 1], { spec: 1, emis: 0.6 }),
  grey: mat([0.7, 0.74, 0.84], { spec: 0.9, emis: 0.45 }),
  red: mat([0.9, 0.1, 0.16], { spec: 0.9, emis: 0.7 }),
  dark: mat([0.05, 0.05, 0.09], { spec: 0.6, emis: 0.16 }),
  screen: mat([0.02, 0.02, 0.05], { spec: 1, emis: 0.1 }),
  eye: { tint: [1, 0.12, 0.16], emis: 1 },
};
/* angry red eye pair on a screen: slanted bars + dot, brow slants inward-down */
function angryEyes(sc, w, y, z, t) {
  const bl = t % 2.7 < 0.1 ? 0.35 : 1;
  for (const s of [-1, 1]) {
    const e = joint(sc, s * w, y, z, 0);
    pd(
      boxM(w * 1.0, 0.05 * bl, 0.02),
      joint(e, 0, 0, 0, 0, 0, -s * 0.38),
      null,
      CM.eye,
    );
    pd(sphM(w * 0.28, 1, 0.4), joint(e, 0, -0.05, 0, 0), null, CM.eye);
  }
}
/* wheeled box-bot: boxy white body, black screen, antenna with a red ball, four black wheels with red hubs */
function drawBox(root, ph, t) {
  const R = joint(
    root,
    0,
    Math.abs(Math.sin(ph * 2)) * 0.015,
    0,
    0.04,
    0,
    Math.sin(ph) * 0.03,
  );
  const body = joint(R, 0, 0.36, 0, 0);
  pd(boxM(0.8, 0.5, 0.62), body, null, CM.white);
  pd(boxM(0.84, 0.08, 0.66, -0.2), body, null, CM.grey);
  pd(boxM(0.84, 0.06, 0.66, 0.2), body, null, CM.red);
  const hd = joint(body, 0, 0.52, 0.02, 0);
  pd(boxM(0.7, 0.46, 0.56), hd, null, CM.white);
  pd(boxM(0.56, 0.34, 0.05), joint(hd, 0, 0, 0.3, 0), null, CM.screen);
  angryEyes(joint(hd, 0, 0, 0.33, 0), 0.12, 0.02, 0.0, t);
  pd(boxM(0.1, 0.1, 0.5), joint(hd, -0.4, 0, 0, 0), null, CM.red);
  pd(boxM(0.1, 0.1, 0.5), joint(hd, 0.4, 0, 0, 0), null, CM.red);
  pd(cylM(0.015, 0.015, 0.3), joint(hd, 0.18, 0.55, -0.1, 0.1), null, CM.dark);
  pd(
    sphM(0.06),
    joint(hd, 0.18, 0.56, -0.1, 0.1),
    null,
    Math.floor(t * 6) % 2 ? SIREN_R : CM.red,
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const w = joint(
          body,
          sx * 0.44,
          -0.22,
          sz * 0.2,
          ph * 2 * (sz > 0 ? 1 : 1),
        ),
        a = joint(w, 0, 0, 0, 0, 0, (PI / 2) * sx);
      pd(cylM(0.17, 0.17, 0.16), joint(a, 0, 0.08, 0, 0), null, CM.dark);
      pd(cylM(0.09, 0.09, 0.18), joint(a, 0, 0.09, 0, 0), null, CM.red);
      pd(
        boxM(0.04, 0.1, 0.19, 0.0),
        joint(w, sx * 0.02, 0, 0, 0),
        null,
        CM.white,
      );
    }
}
/* ball-bot: white sphere on a small roller base, red siren on top, side ear discs, angry red eyes, spinning stripe */
function drawBall(root, ph, t) {
  const R = joint(
    root,
    0,
    0.62 + Math.abs(Math.sin(ph * 2)) * 0.03,
    0,
    ph * 2.2,
    0,
    0,
  );
  const upright = joint(
    root,
    0,
    0.62 + Math.abs(Math.sin(ph * 2)) * 0.03,
    0,
    0.05,
    0,
    Math.sin(ph) * 0.04,
  );
  pd(sphM(0.55, 0.95, 0.95), upright, null, CM.white);
  pd(sphM(0.57, 0.96, 0.96), R, null, CM.grey); // rolling shell band (visible spin)
  pd(sphM(0.555, 0.95, 0.95), upright, null, CM.white);
  pd(boxM(0.46, 0.22, 0.04), joint(upright, 0, 0.05, 0.5, 0), null, CM.screen);
  angryEyes(joint(upright, 0, 0.05, 0.54, 0), 0.1, 0.0, 0, t);
  for (const s of [-1, 1]) {
    const e = joint(upright, s * 0.55, 0.0, 0, 0, 0, (PI / 2) * s);
    pd(cylM(0.17, 0.17, 0.1), e, null, CM.red);
    pd(cylM(0.1, 0.1, 0.12), e, null, CM.dark);
  }
  pd(cylM(0.14, 0.18, 0.08), joint(upright, 0, 0.5, 0, 0), null, CM.red);
  pd(
    sphM(0.11, 1, 1),
    joint(upright, 0, 0.62, 0, 0),
    null,
    Math.floor(t * 7) % 2 ? SIREN_R : SIREN_B,
  );
}
/* winged drone: diamond body, swept red wing blades, angry eyes, thruster flame; hovers and bobs */
function drawDrone(root, ph, t) {
  const hv = Math.sin(t * 5 + ph) * 0.08,
    R = joint(
      root,
      0,
      0.75 + hv,
      0,
      0.12 + Math.sin(t * 3) * 0.04,
      0,
      Math.sin(t * 2.4) * 0.1,
    );
  pd(sphM(0.4, 1.0, 0.9), R, null, CM.white);
  pd(coneM(0.3, 0.38), joint(R, 0, 0.3, 0, 0), null, CM.white);
  pd(coneM(0.28, 0.34), joint(R, 0, -0.3, 0, PI), null, CM.grey);
  pd(boxM(0.46, 0.22, 0.04), joint(R, 0, 0.02, 0.33, 0), null, CM.screen);
  angryEyes(joint(R, 0, 0.02, 0.36, 0), 0.1, 0, 0, t);
  for (const s of [-1, 1]) {
    const f = Math.sin(t * 12 + s) * 0.05,
      w = joint(R, s * 0.4, 0.05, -0.05, 0, -s * 0.5, s * (-0.35 + f));
    pd(boxM(0.7, 0.05, 0.3, 0), joint(w, s * 0.3, 0, 0, 0), null, CM.red);
    pd(
      boxM(0.4, 0.06, 0.12, 0),
      joint(w, s * 0.15, 0.0, 0.1, 0),
      null,
      CM.white,
    );
  }
  pd(cylM(0.1, 0.12, 0.1), joint(R, 0, 0.0, -0.4, PI / 2), null, CM.dark);
  pd(
    coneM(0.09, 0.3 + Math.random() * 0.14),
    joint(R, 0, 0.0, -0.45, -PI / 2),
    null,
    FLAME,
  );
}
