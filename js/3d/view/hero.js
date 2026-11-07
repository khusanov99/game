/* view/hero.js — Hero "ZUMA", a small white-and-blue duck robot, and its scooter: geometry, poses and animation. */
"use strict";
/* ---------- HERO: "ZUMA" — duck-bot ----------
   Glossy white shell with blue armour, a big black visor face with glowing cyan LED eyes (smile arcs by default, blink, round, X when hit),
   an orange bill, round headphone discs with glowing rings, a white head crest, a crown emblem on the chest and on a flowing blue cape,
   white mitten hands, black joint rings and blue sneakers. About 1.55 units tall (chibi: big head, small body, short legs).
   ~70 cached primitives per frame, all batched. Poses: run, air tuck, belly slide, hit, dash, scooter, idle / wave. */
const HK = new WeakMap(),
  GOLD = [1, 0.8, 0.28],
  PI = Math.PI;
const DUCK_ACCENT = {
  default: [0.14, 0.4, 1],
  rose: [1, 0.3, 0.62],
  mint: [0.08, 0.72, 0.5],
  gold: [1, 0.6, 0.08],
};
function heroMats(look) {
  let K = HK.get(look);
  if (K) return K;
  const key =
      Object.keys(Rig.LOOKS).find((k) => Rig.LOOKS[k] === look) || "default",
    A = DUCK_ACCENT[key] || DUCK_ACCENT.default,
    G = hex(look.glow);
  K = {
    body: mat([0.96, 0.98, 1], { spec: 1, emis: 0.62 }),
    bodyD: mat([0.78, 0.84, 0.95], { spec: 0.9, emis: 0.5 }),
    blue: mat(A, { spec: 1, emis: 0.8 }),
    blueD: mat(mulc(A, 0.7), { spec: 0.9, emis: 0.6 }),
    trim: mat(A, { spec: 1, emis: 0.8 }),
    accB: { tint: mulc(A, 0.8), emis: 0.9 },
    dark: mat([0.05, 0.06, 0.1], { spec: 0.9, emis: 0.18 }),
    face: mat([0.02, 0.03, 0.07], { spec: 1, emis: 0.1 }),
    gold: mat(GOLD, { spec: 1, emis: 0.75 }),
    beak: mat([1, 0.58, 0.08], { spec: 0.8, emis: 0.62 }),
    beakD: mat([0.92, 0.4, 0.05], { spec: 0.6, emis: 0.5 }),
    eye: { tint: mixa(G, [1, 1, 1], 0.2), emis: 1 },
    glow: { tint: G, emis: 1 },
    white: { tint: [1, 1, 1], emis: 1 },
    cheek: { tint: [1, 0.45, 0.65], emis: 0.9 },
    acc: { tint: A, emis: 0.9 },
    deck: mat([0.14, 0.17, 0.3], { spec: 0.9, emis: 0.14 }),
    tyre: mat([0.05, 0.05, 0.07], { spec: 0.2 }),
  };
  HK.set(look, K);
  return K;
}
/* a small crown glyph (chest + cape): base bar and three points */
function crown(M, mt, s) {
  pd(boxM(0.2 * s, 0.045 * s, 0.02), M, null, mt);
  for (let i = -1; i <= 1; i++)
    pd(
      coneM(0.035 * s, 0.1 * s),
      joint(M, i * 0.07 * s, 0.02 * s, 0, 0),
      null,
      mt,
    );
}
/* the scooter, scaled for a 1.55-unit rider: deck + fork + bar + two spinning wheels (emissive spokes make the spin readable) */
function drawScooter(base, K, wph, t) {
  const S0 = joint(base, 0, 0, -0.05, 0);
  pd(boxM(0.3, 0.06, 1.15, 0.1), S0, null, K.deck);
  pd(boxM(0.24, 0.02, 1.0, 0.05), S0, null, K.glow);
  for (let i = -2; i <= 2; i++)
    pd(
      boxM(0.16, 0.012, 0.08, 0.14),
      joint(S0, 0, 0, i * 0.19, 0),
      null,
      i % 2 ? K.acc : K.white,
    );
  const fk = joint(S0, 0, 0.1, 0.6, -0.25);
  pd(boxM(0.05, 0.78, 0.05, 0.39), fk, null, K.body);
  pd(boxM(0.5, 0.05, 0.05, 0.78), fk, null, K.body);
  for (const s of [-1, 1])
    pd(
      cylM(0.035, 0.035, 0.1),
      joint(fk, s * 0.27, 0.78, 0, 0, 0, PI / 2),
      null,
      K.acc,
    );
  for (const wz of [0.62, -0.6]) {
    const W0 = joint(S0, 0, 0.13, wz, wph),
      tw = joint(W0, 0, 0, 0, 0, 0, PI / 2);
    pd(cylM(0.13, 0.13, 0.06), joint(tw, 0, 0.03, 0, 0), null, K.tyre);
    pd(boxM(0.08, 0.025, 0.24), W0, null, K.glow);
    pd(boxM(0.08, 0.24, 0.025), W0, null, K.glow);
  }
}
function drawHero(root, look, st) {
  // st: {ph, air, slide, hit, boost, dash, scoot, fx, fy, land, wing, t, sp, tilt, idle, wave, yaw}
  const K = heroMats(look),
    t = st.t,
    ph = st.ph,
    sw = Math.sin(ph),
    cw = Math.cos(ph),
    air = st.air,
    sc = st.scoot,
    ds = st.dash > 0,
    sp = st.sp,
    idle = st.idle,
    wk = st.wing;
  let base = root;
  if (st.fx || st.fy) {
    base = joint(base, 0, 0.7, 0, st.fx, st.fy);
    base = joint(base, 0, -0.7, 0, 0);
  }
  if (sc) drawScooter(base, K, ph * 1.6, t);
  const run = !air && !sc && !st.slide && !st.hit && !idle && !ds;
  let R = base,
    crouch = st.land * 0.1 + (sc ? 0.05 : 0);
  if (st.slide && !sc)
    R = joint(R, 0, 0.3, 0, 1.2); // belly-slide: pitched forward, feet trailing
  else if (st.slide) {
    crouch += 0.08;
    R = joint(R, 0, 0, 0, 0.3);
  } else if (st.hit) R = joint(R, 0, 0, 0, -0.25);
  else if (ds) R = joint(R, 0, 0, 0, 0.45);
  else if (idle) R = joint(R, 0, Math.sin(t * 2) * 0.012, 0, 0.02);
  else if (sc) R = joint(R, 0, 0.0, 0, 0.18);
  else
    R = joint(
      R,
      0,
      air ? 0 : Math.abs(sw) * 0.04,
      0,
      air ? 0.08 : 0.14,
      0,
      run ? sw * 0.08 : 0,
    );
  const hip = joint(R, 0, 0.3 - crouch, 0, 0);
  // legs: short white stubs, black knee rings, blue sneakers with white soles
  for (const s of [-1, 1]) {
    const sg = s > 0 ? sw : -sw,
      cg = s > 0 ? cw : -cw;
    let h1, k1;
    if (sc) {
      h1 = s > 0 ? -0.5 : 0.35;
      k1 = s > 0 ? 0.6 : 0.5;
      if (st.land > 0) k1 += st.land * 0.3;
    } else if (st.slide) {
      h1 = 0.4;
      k1 = 0.2;
    } else if (air) {
      h1 = s > 0 ? -0.7 : 0.2;
      k1 = s > 0 ? 1.1 : 0.8;
      if (ds) {
        h1 = 0.5;
        k1 = 0.9;
      }
    } else if (st.hit) {
      h1 = s * 0.3;
      k1 = 0.3;
    } else if (idle) {
      h1 = s * 0.05;
      k1 = 0.08;
    } else if (ds) {
      h1 = -sg * 1.0;
      k1 = 0.4 + 0.8 * Math.max(0, cg);
    } else {
      h1 = -sg * 0.85;
      k1 = 0.15 + 0.85 * Math.max(0, cg) + st.land * 0.4;
    }
    const th = joint(hip, s * 0.13, 0, 0, h1);
    pd(cylM(0.07, 0.06, 0.16), th, null, K.body);
    const kn = joint(th, 0, -0.16, 0, k1);
    pd(sphM(0.065), kn, null, K.dark);
    pd(cylM(0.06, 0.055, 0.12), kn, null, K.body);
    const ft = joint(kn, 0, -0.12, 0, -(h1 + k1) * 0.5 + (air ? 0.3 : 0));
    pd(boxM(0.2, 0.1, 0.28), joint(ft, 0, -0.02, 0.07, 0), null, K.blue);
    pd(sphM(0.1, 0.75, 1.0), joint(ft, 0, -0.02, 0.17, 0), null, K.body);
    pd(boxM(0.22, 0.035, 0.31), joint(ft, 0, -0.08, 0.07, 0), null, K.body);
    pd(boxM(0.2, 0.016, 0.2), joint(ft, 0, -0.092, 0.07, 0), null, K.glow);
  }
  // body: small white egg, blue vest with a glowing crown, black waist ring
  const tor = joint(hip, 0, 0.24, 0, sc ? 0.2 : 0, 0, run ? -sw * 0.05 : 0);
  pd(sphM(0.3, 1.0, 0.95), tor, null, K.body);
  pd(cylM(0.255, 0.255, 0.05), joint(tor, 0, -0.17, 0, 0), null, K.dark);
  pd(boxM(0.34, 0.26, 0.05), joint(tor, 0, 0.02, 0.255, -0.08), null, K.blue);
  pd(boxM(0.34, 0.03, 0.055), joint(tor, 0, 0.14, 0.26, -0.08), null, K.white);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  crown(joint(tor, 0, 0.0, 0.29, -0.08), pulse > 0.5 ? K.glow : K.white, 1);
  // jet nozzles (flames only while boosting) + cape
  if (st.boost)
    for (const sx of [-0.08, 0.08])
      pd(
        coneM(0.06, 0.32 + Math.random() * 0.16),
        joint(tor, sx, -0.12, -0.27, PI),
        null,
        FLAME,
      );
  let cj = joint(tor, 0, 0.2, -0.22, 0);
  const fl = 0.3 + sp * 0.8;
  pd(boxM(0.34, 0.03, 0.03), cj, null, K.white);
  for (let i = 0; i < 4; i++) {
    const w = Math.sin(t * 9 - i * 0.95) * 0.1 * fl;
    cj = joint(
      cj,
      0,
      i ? -0.14 : -0.02,
      0,
      0.1 + fl * 0.22 + (air ? 0.2 : 0) + w,
      w * 0.6 - (st.tilt || 0) * 0.3,
      0,
    );
    pd(
      boxM(0.38 - i * 0.04, 0.15, 0.025, -0.07),
      cj,
      null,
      i % 2 ? K.blueD : K.blue,
    );
  }
  crown(joint(tor, 0, 0.0, -0.3, PI), K.white, 0.9);
  // head: big white shell, black visor, LED eyes, headphone discs, crest, bill
  const hd = joint(
    tor,
    0,
    0.46,
    0.02,
    st.hit ? 0.25 : ds ? -0.18 : st.slide && !sc ? -1.0 : 0.04,
    st.yaw || 0,
  );
  pd(sphM(0.38, 0.9, 0.95), hd, null, K.body);
  pd(sphM(0.31, 0.74, 0.5), joint(hd, 0, 0.0, 0.2, 0), null, K.face);
  pd(boxM(0.36, 0.028, 0.03), joint(hd, 0, 0.2, 0.3, -0.35), null, K.blue); // blue brow arc over the visor
  pd(sphM(0.02, 1, 1), joint(hd, 0, 0.24, 0.27, 0), null, K.blue);
  const blink = t % 3.3 < 0.12,
    mood = st.hit
      ? 2
      : blink
        ? 1
        : st.land > 0.4 || (air && !sc && wk > 0.9)
          ? 4
          : 0; // 0 smile arcs, 1 blink, 2 X, 4 wide
  for (const s of [-1, 1]) {
    const ex = joint(hd, s * 0.11, 0.03, 0.355, 0);
    if (mood === 0) {
      pd(
        boxM(0.075, 0.03, 0.02),
        joint(ex, -0.032, 0.0, 0, 0, 0, 0.62),
        null,
        K.eye,
      );
      pd(
        boxM(0.075, 0.03, 0.02),
        joint(ex, 0.032, 0.0, 0, 0, 0, -0.62),
        null,
        K.eye,
      );
      pd(boxM(0.04, 0.026, 0.02), joint(ex, 0, 0.026, 0, 0), null, K.eye);
    } else if (mood === 1) pd(boxM(0.11, 0.022, 0.02), ex, null, K.eye);
    else if (mood === 2) {
      pd(boxM(0.12, 0.028, 0.02), joint(ex, 0, 0, 0, 0, 0, 0.8), null, K.eye);
      pd(boxM(0.12, 0.028, 0.02), joint(ex, 0, 0, 0, 0, 0, -0.8), null, K.eye);
    } else {
      pd(sphM(0.055, 1.35, 0.3), ex, null, K.eye);
      pd(sphM(0.014), joint(ex, 0.02, 0.03, 0.015, 0), null, K.white);
    }
    pd(sphM(0.03, 0.8, 0.3), joint(hd, s * 0.2, -0.08, 0.32, 0), null, K.cheek); // blush LEDs
    const ear = joint(hd, s * 0.385, -0.01, 0, 0, 0, (PI / 2) * s); // headphone discs with glowing rings
    pd(cylM(0.15, 0.15, 0.07), ear, null, K.body);
    pd(cylM(0.17, 0.17, 0.025), joint(ear, 0, 0.0, 0, 0), null, K.blue);
    pd(cylM(0.105, 0.105, 0.085), ear, null, K.glow);
    pd(cylM(0.07, 0.07, 0.09), ear, null, K.dark);
  }
  const mouth = st.hit ? 0.55 : ds ? 0.35 : air && wk > 0.9 ? 0.2 : 0;
  pd(sphM(0.15, 0.38, 1.12), joint(hd, 0, -0.13, 0.4, 0), null, K.beak); // upper bill
  pd(
    sphM(0.11, 0.28, 0.95),
    joint(hd, 0, -0.18 - mouth * 0.05, 0.38, mouth),
    null,
    K.beakD,
  ); // lower bill
  for (const [x, rx, rz, h] of [
    [0.04, -0.5, 0.25, 0.32],
    [-0.04, -0.75, -0.25, 0.26],
  ])
    pd(
      boxM(0.1, h, 0.03, h / 2),
      joint(hd, x, 0.32, 0.06, rx, 0, rz),
      null,
      K.body,
    ); // head crest feathers
  pd(
    boxM(0.04, 0.12, 0.02, 0.06),
    joint(hd, 0.04, 0.36, 0.08, -0.5, 0, 0.25),
    null,
    K.blue,
  );
  // arms: white, black elbow rings, mitten hands with blue cuffs; they swing, spread in the air, reach for the bar, wave when idle
  const spread = 0.16 + wk * 0.6 + (wk > 0.5 ? Math.sin(t * 18) * 0.1 : 0);
  for (const s of [-1, 1]) {
    const a = idle
        ? s > 0 && st.wave
          ? -2.55 - Math.sin(t * 7) * 0.22 * st.wave
          : s * 0.1 + Math.sin(t * 2 + s) * 0.05
        : sc
          ? -1.35
          : st.hit
            ? -2.6 + s * 0.3
            : st.slide
              ? 1.2
              : air
                ? -2.0 + s * 0.2
                : ds
                  ? 1.1
                  : (s > 0 ? sw : -sw) * 0.85,
      sh = joint(
        tor,
        s * 0.3,
        0.12,
        0,
        a,
        0,
        s *
          (idle
            ? 0.14 + (s > 0 ? (st.wave || 0) * 0.95 : 0)
            : sc
              ? 0.1
              : st.hit
                ? 0.9
                : ds
                  ? 0.1
                  : spread),
      );
    pd(sphM(0.07), sh, null, K.dark);
    pd(cylM(0.065, 0.055, 0.16), sh, null, K.body);
    const el = joint(
      sh,
      0,
      -0.16,
      0,
      idle
        ? s > 0 && st.wave
          ? -0.7 - Math.sin(t * 7 + 1) * 0.3 * st.wave
          : -0.3
        : sc
          ? -0.2
          : air
            ? -0.5
            : ds
              ? -0.5
              : -0.9 - (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.4,
    );
    pd(sphM(0.058), el, null, K.dark);
    pd(cylM(0.055, 0.05, 0.13), el, null, K.body);
    pd(cylM(0.062, 0.062, 0.035), joint(el, 0, -0.1, 0, 0), null, K.blue);
    pd(sphM(0.088), joint(el, 0, -0.17, 0, 0), null, K.body);
  }
}
