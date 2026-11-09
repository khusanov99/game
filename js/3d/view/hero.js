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
    bagA: mat([1, 0.5, 0.1], { spec: 0.6, emis: 0.5 }),
    bagB: mat([0.78, 0.3, 0.05], { spec: 0.5, emis: 0.4 }),
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
/* shop variants: bag colours and ride colours are derived from the look's materials once and cached */
const SHK = new WeakMap();
function shopMats(K, bagId, rideId) {
  let c = SHK.get(K);
  if (!c) SHK.set(K, (c = {}));
  const key = bagId + "|" + rideId;
  if (c[key]) return c[key];
  const bg = shItem("bag", bagId),
    o = Object.create(K);
  o.bagA = mat(bg.a, { spec: 0.6, emis: bagId === "gold" ? 0.8 : 0.5 });
  o.bagB = mat(bg.b, { spec: 0.5, emis: 0.4 });
  o.bagC = { tint: bg.c, emis: 0.9 };
  if (rideId === "scoot2") {
    o.deck = mat([0.2, 0.05, 0.3], { spec: 0.9, emis: 0.3 });
    o.glow = { tint: [1, 0.25, 0.9], emis: 1 };
    o.acc = { tint: [0.3, 1, 0.9], emis: 1 };
    o.body = mat([0.85, 0.7, 1], { spec: 1, emis: 0.6 });
  } else if (rideId === "bike") {
    o.deck = mat([0.9, 0.2, 0.2], { spec: 0.9, emis: 0.45 });
    o.glow = { tint: [1, 0.9, 0.5], emis: 1 };
  } else if (rideId === "bike2") {
    o.deck = mat([1, 0.8, 0.25], { spec: 1, emis: 0.85 });
    o.glow = { tint: [1, 1, 0.8], emis: 1 };
    o.acc = { tint: [1, 0.7, 0.1], emis: 1 };
  }
  return (c[key] = o);
}
/* a bicycle: two big spoked wheels, a diagonal frame, fork + bar, spinning pedals; the rider is lifted onto it */
function drawBike(base, K, wph) {
  const S0 = joint(base, 0, 0, -0.05, 0);
  for (const wz of [0.62, -0.6]) {
    const W0 = joint(S0, 0, 0.27, wz, wph),
      tw = joint(W0, 0, 0, 0, 0, 0, PI / 2);
    pd(cylM(0.27, 0.27, 0.045), joint(tw, 0, 0.0225, 0, 0), null, K.tyre);
    pd(cylM(0.2, 0.2, 0.05), joint(tw, 0, 0.025, 0, 0), null, K.white);
    pd(boxM(0.04, 0.02, 0.48), W0, null, K.glow);
    pd(boxM(0.04, 0.48, 0.02), W0, null, K.glow);
  }
  pd(boxM(0.06, 0.06, 1.1), joint(S0, 0, 0.3, 0, 0.0), null, K.deck);
  pd(boxM(0.06, 0.06, 0.7), joint(S0, 0, 0.3, -0.18, -0.55), null, K.deck);
  const fk = joint(S0, 0, 0.27, 0.62, -0.3);
  pd(boxM(0.05, 0.62, 0.05, 0.31), fk, null, K.body);
  pd(boxM(0.5, 0.05, 0.05, 0.62), fk, null, K.body);
  for (const s of [-1, 1]) pd(cylM(0.035, 0.035, 0.1), joint(fk, s * 0.27, 0.62, 0, 0, 0, PI / 2), null, K.acc);
  for (const s of [-1, 1]) {
    const pe = joint(S0, s * 0.14, 0.2 + Math.sin(wph * 1.3 + (s > 0 ? 0 : PI)) * 0.07, Math.cos(wph * 1.3 + (s > 0 ? 0 : PI)) * 0.07, 0);
    pd(boxM(0.14, 0.03, 0.1), pe, null, K.glow);
  }
  pd(boxM(0.14, 0.05, 0.24), joint(S0, 0, 0.5, -0.25, 0), null, K.acc);
}
/* generic low-poly cars (no badges): an open-top white sedan and a boxy white mini van with a cargo box; the rider sits in the cab */
const CARM = {
  white: mat([0.97, 0.98, 1], { spec: 0.9, emis: 0.55 }),
  glass: mat([0.1, 0.16, 0.28], { spec: 1, emis: 0.2 }),
  dark: mat([0.07, 0.07, 0.09], { spec: 0.4, emis: 0.2 }),
  seat: mat([0.35, 0.36, 0.42], { spec: 0.2, emis: 0.3 }),
  rim: mat([0.8, 0.82, 0.88], { spec: 1, emis: 0.5 }),
  amber: { tint: [1, 0.6, 0.1], emis: 1 },
};
function drawCar(base, wph, van) {
  const C = CARM,
    S0 = joint(base, 0, 0, van ? 0.35 : 0, 0);
  for (const sz of van ? [0.72, -0.68] : [0.72, -0.72])
    for (const sx of [-1, 1]) {
      const W = joint(S0, sx * 0.48, 0.2, sz - (van ? 0.35 : 0), wph, 0, 0),
        tw = joint(W, 0, 0, 0, 0, 0, PI / 2);
      pd(cylM(0.2, 0.2, 0.12), joint(tw, sx * -0.06 + 0.06, 0.06, 0, 0), null, C.dark);
      pd(cylM(0.12, 0.12, 0.13), joint(tw, sx * -0.06 + 0.06, 0.065, 0, 0), null, C.rim);
      pd(boxM(0.14, 0.03, 0.03), joint(W, sx * 0.07, 0, 0, 0), null, C.dark);
    }
  const Z = (z) => z - (van ? 0.35 : 0);
  pd(boxM(0.95, 0.26, van ? 1.2 : 2.3, 0.34), joint(S0, 0, 0, Z(van ? 0.55 : 0), 0), null, C.white);
  pd(boxM(0.9, 0.12, 0.12), joint(S0, 0, 0.2, Z(van ? 1.12 : 1.13), 0), null, C.dark); // front bumper
  pd(boxM(0.9, 0.12, 0.12), joint(S0, 0, 0.2, Z(van ? -0.3 : -1.13), 0), null, C.dark); // rear bumper (van: behind the cab)
  for (const sx of [-1, 1]) {
    pd(boxM(0.2, 0.1, 0.05), joint(S0, sx * 0.31, 0.46, Z(van ? 1.16 : 1.16), 0), null, K_WHITE);
    pd(boxM(0.1, 0.07, 0.05), joint(S0, sx * 0.4, 0.3, Z(van ? 1.16 : 1.16), 0), null, C.amber);
    pd(boxM(0.2, 0.08, 0.05), joint(S0, sx * 0.31, 0.46, Z(van ? -0.34 : -1.16), 0), null, SIREN_R);
  }
  pd(boxM(0.8, 0.1, 0.5), joint(S0, 0, 0.52, Z(van ? 0.9 : 0.88), 0), null, C.white); // hood
  pd(boxM(0.04, 0.34, 0.5), joint(S0, 0.45, 0.62, Z(0.18), 0), null, C.white); // doors
  pd(boxM(0.04, 0.34, 0.5), joint(S0, -0.45, 0.62, Z(0.18), 0), null, C.white);
  pd(boxM(0.8, 0.34, 0.08), joint(S0, 0, 0.62, Z(van ? 0.78 : 0.62), 0), null, C.dark); // dashboard
  pd(boxM(0.84, 0.46, 0.035), joint(S0, 0, 0.94, Z(van ? 0.82 : 0.66), -0.45), null, C.glass); // windscreen
  pd(boxM(0.8, 0.18, 0.36), joint(S0, 0, 0.5, Z(van ? -0.12 : -0.2), 0), null, C.seat);
  pd(cylM(0.15, 0.15, 0.025), joint(S0, 0, 0.98, Z(van ? 0.62 : 0.46), 1.0), null, C.dark); // steering wheel
  if (van) {
    pd(boxM(0.98, 0.8, 1.1, 0.0), joint(S0, 0, 0.66, Z(-0.62), 0), null, C.white); // cargo box (low enough to see the rider over it)
    for (const sx of [-1, 1]) {
      pd(boxM(0.02, 0.24, 0.8), joint(S0, sx * 0.495, 0.82, Z(-0.62), 0), null, C.glass);
      pd(boxM(0.02, 0.08, 0.8), joint(S0, sx * 0.495, 0.58, Z(-0.62), 0), null, K_ORANGE);
    }
    pd(boxM(0.6, 0.22, 0.02), joint(S0, 0, 0.82, Z(-1.18), 0), null, C.glass);
  } else {
    pd(boxM(0.9, 0.12, 0.6), joint(S0, 0, 0.54, Z(-0.88), 0), null, C.white); // trunk
    for (const sx of [-1, 1]) pd(boxM(0.03, 0.05, 0.4), joint(S0, sx * 0.46, 0.8, Z(-0.2), 0), null, C.white);
  }
}
const K_WHITE = { tint: [1, 1, 0.92], emis: 1 },
  K_ORANGE = { tint: [1, 0.55, 0.1], emis: 0.9 };
function drawRide(base, K, wph, t) {
  const r = ldv("ride");
  if (r === "car" || r === "van") return drawCar(base, wph, r === "van");
  if (r === "bike" || r === "bike2") drawBike(base, K, wph);
  else drawScooter(base, K, wph, t);
}
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
/* headwear sits on the head joint: courier cap, doppi, safety helmet, golden crown */
function drawHat(hd, K, id) {
  if (id === "none") return;
  if (id === "cap") {
    pd(sphM(0.39, 0.62, 0.98), joint(hd, 0, 0.14, -0.01, 0), null, K.blue);
    pd(boxM(0.4, 0.03, 0.3, 0), joint(hd, 0, 0.2, 0.37, -0.2), null, K.blueD);
    pd(boxM(0.14, 0.05, 0.02), joint(hd, 0, 0.3, 0.3, -0.5), null, K.glow);
  } else if (id === "doppi") {
    pd(cylM(0.25, 0.31, 0.15, 12), joint(hd, 0, 0.4, 0, 0), null, K.dark);
    pd(cylM(0.32, 0.32, 0.025, 12), joint(hd, 0, 0.255, 0, 0), null, K.white);
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2;
      pd(boxM(0.09, 0.09, 0.02), joint(hd, Math.sin(a) * 0.29, 0.33, Math.cos(a) * 0.29, 0, a, 0), null, K.white);
    }
  } else if (id === "helmet") {
    pd(sphM(0.41, 0.72, 1.0), joint(hd, 0, 0.1, -0.01, 0), null, K.beak);
    pd(boxM(0.08, 0.025, 0.5), joint(hd, 0, 0.42, 0, 0), null, K.white);
    pd(boxM(0.46, 0.03, 0.14, 0), joint(hd, 0, 0.17, 0.32, -0.15), null, K.beakD);
    pd(sphM(0.05), joint(hd, 0, 0.3, 0.3, 0), null, SIREN_R);
  } else if (id === "crown") {
    pd(cylM(0.26, 0.28, 0.1, 10), joint(hd, 0, 0.42, 0, 0), null, K.gold);
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * PI) / 5;
      pd(coneM(0.05, 0.16), joint(hd, Math.sin(a) * 0.25, 0.42, Math.cos(a) * 0.25, 0), null, K.gold);
      pd(sphM(0.03), joint(hd, Math.sin(a) * 0.25, 0.6, Math.cos(a) * 0.25, 0), null, K.glow);
    }
  }
}
function drawHero(root, look, st) {
  // st: {ph, air, slide, hit, boost, dash, scoot, fx, fy, land, wing, t, sp, tilt, idle, wave, yaw}
  const K = shopMats(heroMats(look), ldv("bag"), ldv("ride")),
    lift = { bike: 0.17, bike2: 0.17, car: 0.3, van: 0.3 }[ldv("ride")] || 0,
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
  if (sc) drawRide(base, K, ph * 1.6, t);
  if (sc && lift) base = joint(base, 0, lift, ldv("ride") === "van" ? 0.35 : 0, 0);
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
  // courier delivery bag: orange insulated box on the back with a lid, a glowing logo patch and shoulder straps
  const bg = st.bag;
  if (bg !== false) {
    const bk = 1 + (Math.round(((bg && bg.pop) || 0) * 3) / 3) * 0.22,
      B0 = joint(tor, 0, -0.02, -0.4, 0.05);
    pd(boxM(0.42 * bk, 0.44 * bk, 0.26 * bk), B0, null, K.bagA);
    pd(boxM(0.45 * bk, 0.07, 0.29 * bk), joint(B0, 0, 0.23 * bk, 0, 0), null, K.bagB);
    pd(boxM(0.34, 0.03, 0.02), joint(B0, 0, -0.14, -0.135 * bk, 0), null, K.white);
    pd(boxM(0.4 * bk, 0.035, 0.015), joint(B0, 0, 0.1 * bk, -0.133 * bk, 0), null, K.bagC);
    pd(boxM(0.4 * bk, 0.035, 0.015), joint(B0, 0, -0.04 * bk, -0.133 * bk, 0), null, K.bagC);
    for (const sx of [-0.12, 0.12]) pd(boxM(0.05, 0.38, 0.02), joint(tor, sx, 0.03, 0.288, -0.08), null, K.bagB);
  }
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
  drawHat(hd, K, ldv("hat"));
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
