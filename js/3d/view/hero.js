/* view/hero.js — Hero "ZUMA", a small duck-shaped robot, and its scooter: geometry, poses and animation. */
"use strict";
/* ---------- HERO: "ZUMA" — a duck-bot ----------
   About 1.6 units tall (a chibi: big head, round body, short legs). Smooth metallic yellow shell, a dark glossy face screen with
   expressive LED eyes (round / blink / happy ^ ^ / X when hit), a small orange bill that opens when dashing, stub wings that flap,
   an Uzbek touch: a ribbed turquoise doppi cap with a gold finial, an ikat belt and an 8-pointed-star chest core.
   Roughly 60 cached primitives per frame, all batched. Poses: run waddle, air tuck, belly slide, hit, dash, scooter, idle / wave. */
const HK = new WeakMap(),
  GOLD = [1, 0.8, 0.28],
  TURQ = [0.1, 0.74, 0.82],
  INDIGO = [0.2, 0.3, 0.78],
  PI = Math.PI;
const DUCK_SKINS = {
  default: { b: [1, 0.82, 0.22], t: TURQ },
  rose: { b: [1, 0.5, 0.74], t: [1, 0.8, 0.3] },
  mint: { b: [0.42, 0.95, 0.72], t: [0.4, 0.55, 1] },
  gold: { b: [1, 0.7, 0.16], t: [0.35, 0.2, 0.12] },
};
function heroMats(look) {
  let K = HK.get(look);
  if (K) return K;
  const key =
      Object.keys(Rig.LOOKS).find((k) => Rig.LOOKS[k] === look) || "default",
    D = DUCK_SKINS[key] || DUCK_SKINS.default,
    G = hex(look.glow),
    A = hex(look.acc);
  K = {
    body: mat(D.b, { spec: 1, emis: 0.66 }),
    bodyD: mat(mulc(D.b, 0.8), { spec: 0.9, emis: 0.55 }),
    belly: mat([0.95, 0.9, 0.78], { spec: 0.4, emis: 0.22 }),
    trim: mat(D.t, { spec: 1, emis: 0.8 }),
    gold: mat(GOLD, { spec: 1, emis: 0.62 }),
    beak: mat([1, 0.55, 0.1], { spec: 0.8, emis: 0.55 }),
    beakD: mat([0.9, 0.36, 0.06], { spec: 0.6, emis: 0.45 }),
    leg: mat([1, 0.5, 0.1], { spec: 0.6, emis: 0.7 }),
    face: mat([0.04, 0.05, 0.11], { spec: 1, emis: 0.12 }),
    eye: { tint: mixa(G, [1, 1, 1], 0.25), emis: 1 },
    cheek: { tint: [1, 0.4, 0.6], emis: 0.9 },
    white: { tint: [1, 1, 1], emis: 1 },
    ikat: mat([0.3, 0.42, 0.95], { spec: 0.6, emis: 0.7 }),
    acc: { tint: A, emis: 0.9 },
    accB: { tint: mixa(A, GOLD, 0.5), emis: 0.9 },
    glow: { tint: G, emis: 1 },
    deck: mat([0.14, 0.17, 0.3], { spec: 0.9, emis: 0.14 }),
    tyre: mat([0.05, 0.05, 0.07], { spec: 0.2 }),
  };
  HK.set(look, K);
  return K;
}
/* the scooter, scaled for a 1.6-unit rider: deck + fork + bar + two spinning wheels (emissive spokes make the spin readable) */
function drawScooter(base, K, wph, t) {
  const S0 = joint(base, 0, 0, -0.05, 0);
  pd(boxM(0.3, 0.06, 1.15, 0.1), S0, null, K.deck);
  pd(boxM(0.24, 0.02, 1.0, 0.05), S0, null, K.glow);
  for (let i = -2; i <= 2; i++)
    pd(
      boxM(0.16, 0.012, 0.08, 0.14),
      joint(S0, 0, 0, i * 0.19, 0),
      null,
      i % 2 ? K.acc : K.gold,
    );
  const fk = joint(S0, 0, 0.1, 0.6, -0.25);
  pd(boxM(0.05, 0.78, 0.05, 0.39), fk, null, K.gold);
  pd(boxM(0.5, 0.05, 0.05, 0.78), fk, null, K.gold);
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
      run ? sw * 0.09 : 0,
    ); // waddle: roll with every step
  const hip = joint(R, 0, 0.36 - crouch, 0, 0);
  // legs: short stubs with webbed feet
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
    const th = joint(hip, s * 0.15, 0, 0, h1);
    pd(cylM(0.075, 0.06, 0.2), th, null, K.leg);
    const kn = joint(th, 0, -0.2, 0, k1);
    pd(sphM(0.06), kn, null, K.gold);
    pd(cylM(0.06, 0.055, 0.17), kn, null, K.leg);
    const ft = joint(kn, 0, -0.17, 0, -(h1 + k1) * 0.5 + (air ? 0.3 : 0));
    pd(boxM(0.2, 0.05, 0.22), joint(ft, 0, -0.02, 0.07, 0), null, K.beak);
    for (let i = -1; i <= 1; i++)
      pd(
        boxM(0.06, 0.04, 0.1),
        joint(ft, i * 0.07, -0.02, 0.2, 0, i * 0.3, 0),
        null,
        K.beakD,
      );
  }
  // body: round shell, cream belly with an ikat band and the 8-pointed star core
  const tor = joint(hip, 0, 0.26, 0, sc ? 0.2 : 0, 0, run ? -sw * 0.05 : 0);
  pd(sphM(0.36, 0.95, 1.0), tor, null, K.body);
  pd(sphM(0.28, 0.85, 0.5), joint(tor, 0, -0.04, 0.2, 0), null, K.belly);
  pd(boxM(0.5, 0.05, 0.1, 0), joint(tor, 0, -0.1, 0.17, 0.0), null, K.ikat);
  pd(boxM(0.5, 0.012, 0.1, 0), joint(tor, 0, -0.07, 0.175, 0), null, K.gold);
  const pulse = 0.5 + 0.5 * Math.sin(t * 5),
    cs = joint(tor, 0, 0.06, 0.29, 0);
  pd(boxM(0.14, 0.14, 0.02), cs, null, K.gold);
  pd(boxM(0.14, 0.14, 0.02), joint(cs, 0, 0, 0, 0, 0, PI / 4), null, K.gold);
  pd(boxM(0.07, 0.07, 0.03), cs, null, pulse > 0.5 ? K.glow : K.white);
  // tail feathers + a tiny jet pack
  for (let i = -1; i <= 1; i++)
    pd(
      boxM(0.08, 0.22, 0.025, 0.11),
      joint(
        tor,
        i * 0.09,
        -0.08,
        -0.33,
        -0.95 + (idle ? 0 : Math.sin(t * 6 + i) * 0.06) - (air ? 0.2 : 0),
        0,
        i * 0.4,
      ),
      null,
      i ? K.trim : K.gold,
    );
  const jp = joint(tor, 0, 0.08, -0.31, 0);
  pd(boxM(0.24, 0.22, 0.1), jp, null, K.trim);
  pd(boxM(0.14, 0.04, 0.03, 0), joint(jp, 0, 0.04, -0.06, 0), null, K.glow);
  if (st.boost)
    for (const sx of [-0.06, 0.06])
      pd(
        coneM(0.06, 0.34 + Math.random() * 0.18),
        joint(jp, sx, -0.12, -0.04, PI),
        null,
        FLAME,
      );
  // head: big round shell, dark face screen, LED eyes, bill, ribbed turquoise doppi
  const hd = joint(
    tor,
    0,
    0.5,
    0.02,
    st.hit ? 0.25 : ds ? -0.18 : st.slide && !sc ? -1.0 : 0.04,
    st.yaw || 0,
  );
  pd(sphM(0.35, 0.92, 0.96), joint(hd, 0, 0, 0, 0), null, K.body);
  pd(sphM(0.27, 0.78, 0.5), joint(hd, 0, 0.02, 0.2, 0), null, K.face);
  const blink = t % 3.3 < 0.12,
    mood = st.hit
      ? 2
      : blink
        ? 1
        : ds ||
            st.land > 0.4 ||
            (idle && st.wave > 0.3) ||
            (air && !sc && wk > 0.6)
          ? 3
          : 0;
  for (const s of [-1, 1]) {
    const ex = joint(hd, s * 0.1, 0.07, 0.335, 0);
    if (mood === 0) {
      pd(sphM(0.055, 1.35, 0.3), ex, null, K.eye);
      pd(sphM(0.014), joint(ex, 0.02, 0.03, 0.015, 0), null, K.white);
    } else if (mood === 1) pd(boxM(0.1, 0.022, 0.02), ex, null, K.eye);
    else if (mood === 2) {
      pd(boxM(0.12, 0.028, 0.02), joint(ex, 0, 0, 0, 0, 0, 0.8), null, K.eye);
      pd(boxM(0.12, 0.028, 0.02), joint(ex, 0, 0, 0, 0, 0, -0.8), null, K.eye);
    } else {
      pd(
        boxM(0.07, 0.03, 0.02),
        joint(ex, -0.03, 0, 0, 0, 0, 0.6),
        null,
        K.eye,
      );
      pd(
        boxM(0.07, 0.03, 0.02),
        joint(ex, 0.03, 0, 0, 0, 0, -0.6),
        null,
        K.eye,
      );
    }
    pd(sphM(0.032, 0.8, 0.3), joint(hd, s * 0.2, -0.05, 0.3, 0), null, K.cheek); // blush LEDs
    pd(
      cylM(0.06, 0.06, 0.04),
      joint(hd, s * 0.335, 0.0, 0, 0, 0, (PI / 2) * s),
      null,
      K.gold,
    );
    pd(
      cylM(0.032, 0.032, 0.05),
      joint(hd, s * 0.342, 0.0, 0, 0, 0, (PI / 2) * s),
      null,
      K.glow,
    ); // ear LED discs
  }
  const mouth = st.hit ? 0.55 : ds ? 0.35 : air && wk > 0.6 ? 0.2 : 0;
  pd(sphM(0.13, 0.4, 1.15), joint(hd, 0, -0.07, 0.38, 0), null, K.beak); // upper bill
  pd(
    sphM(0.1, 0.3, 0.95),
    joint(hd, 0, -0.12 - mouth * 0.05, 0.36, mouth),
    null,
    K.beakD,
  ); // lower bill
  pd(sphM(0.28, 0.5, 0.95), joint(hd, 0, 0.3, -0.02, 0), null, K.trim); // doppi dome
  pd(cylM(0.285, 0.285, 0.05), joint(hd, 0, 0.3, -0.02, 0), null, K.ikat);
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.36;
    pd(
      boxM(0.05, 0.05, 0.025),
      joint(
        hd,
        Math.sin(a) * 0.285,
        0.275,
        -0.02 + Math.cos(a) * 0.285,
        0,
        a,
        PI / 4,
      ),
      null,
      i % 2 ? K.acc : K.white,
    );
  }
  for (let i = 0; i < 4; i++)
    pd(
      boxM(0.025, 0.2, 0.025, 0.08),
      joint(joint(hd, 0, 0.33, -0.02, 0, (i * PI) / 2, 0), 0, 0, 0.13, -0.7),
      null,
      K.gold,
    ); // dome ribs
  pd(coneM(0.035, 0.14), joint(hd, 0, 0.5, -0.02, 0), null, K.gold);
  pd(
    sphM(0.035),
    joint(hd, 0, 0.66, -0.02, 0),
    null,
    pulse > 0.5 ? K.glow : K.white,
  );
  // ikat scarf: segments that lag behind one another
  let sj = joint(tor, 0.08, 0.34, -0.08, 0);
  const fl = 0.35 + sp * 0.9;
  for (let i = 0; i < 5; i++) {
    const w = Math.sin(t * 9 - i * 0.95) * 0.2 * fl;
    sj = joint(
      sj,
      0,
      0,
      -0.2,
      (air ? 0.2 : 0.05) + w * 0.6,
      w * 0.5 - (st.tilt || 0) * 0.4,
      0,
    );
    pd(boxM(0.1 - i * 0.012, 0.03, 0.24), sj, null, i % 2 ? K.accB : K.acc);
  }
  // wings (the arms): swing when running, spread and flap in the air and when dashing, reach for the bar on the scooter, wave when idle
  const spread = 0.28 + wk * 0.85 + (wk > 0.5 ? Math.sin(t * 18) * 0.14 : 0);
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
              ? -0.5
              : ds
                ? 1.1
                : (s > 0 ? sw : -sw) * 0.8;
    const sh = joint(
      tor,
      s * 0.34,
      0.06,
      0,
      a,
      0,
      s *
        (idle
          ? 0.14 + (s > 0 ? (st.wave || 0) * 0.95 : 0)
          : sc
            ? 0.12
            : st.hit
              ? 0.9
              : ds
                ? 0.1
                : spread),
    );
    pd(sphM(0.11, 1.55, 0.5), joint(sh, 0, -0.15, 0, 0), null, K.bodyD);
    pd(sphM(0.07, 1.2, 0.4), joint(sh, 0, -0.3, 0, 0), null, K.trim);
    pd(sphM(0.06), sh, null, K.gold);
  }
}
