/* view/hero.js — Hero "ZUMA" and the scooter: geometry, poses and animation. */
"use strict";
/* ---------- HERO: "ZUMA" — a Humo-bird robot ----------
   Silhouette from Uzbek heritage: a ribbed turquoise dome (Registan / Gur-Emir) with a gold finial, an ikat-banded doppi,
   almond eyes with expressive brows, a chapan-style coat with ikat tails, an 8-pointed-star chest core, curled mahsi boots,
   a flowing ikat scarf and folding "Humo" wings that open in the air and when dashing. Built from cached primitives. */
const HK = new WeakMap(),
  GOLD = [1, 0.8, 0.28],
  TURQ = [0.1, 0.74, 0.82],
  INDIGO = [0.2, 0.3, 0.78];
function heroMats(look) {
  let K = HK.get(look);
  if (K) return K;
  const P = {
      arm: hex(look.arm),
      plate: hex(look.plate),
      dark: hex(look.dark),
      glow: hex(look.glow),
      acc: hex(look.acc),
    },
    def = look === Rig.LOOKS.default;
  K = {
    body: mat(def ? INDIGO : mixa(INDIGO, P.arm, 0.5), {
      spec: 0.8,
      emis: 0.42,
    }),
    dome: mat(def ? TURQ : mixa(TURQ, P.arm, 0.5), { spec: 1, emis: 0.55 }),
    plate: mat(P.plate, { spec: 0.6, emis: 0.45 }),
    dark: mat(mulc(P.dark, 2.2), { spec: 0.3, emis: 0.3 }),
    gold: mat(GOLD, { spec: 1, emis: 0.62 }),
    glow: { tint: P.glow, emis: 1 },
    acc: { tint: P.acc, emis: 0.9 },
    accB: { tint: mixa(P.acc, GOLD, 0.5), emis: 0.9 },
    white: { tint: [1, 1, 1], emis: 1 },
    deck: mat([0.14, 0.17, 0.3], { spec: 0.9, emis: 0.12 }),
    tyre: mat([0.05, 0.05, 0.07], { spec: 0.2 }),
  };
  HK.set(look, K);
  return K;
}
const PI = Math.PI;
/* the scooter: deck + fork + bar + two spinning wheels (spokes are emissive so the spin reads at speed) */
function drawScooter(base, K, wph, t) {
  const S0 = joint(base, 0, 0, -0.12, 0);
  pd(boxM(0.36, 0.07, 1.5, 0.1), S0, null, K.deck);
  pd(boxM(0.3, 0.02, 1.3, 0.055), S0, null, K.glow);
  for (let i = -2; i <= 2; i++)
    pd(
      boxM(0.2, 0.012, 0.1, 0.14),
      joint(S0, 0, 0, i * 0.24, 0),
      null,
      i % 2 ? K.acc : K.gold,
    ); // ikat stripes on the deck
  const fk = joint(S0, 0, 0.1, 0.78, -0.25);
  pd(boxM(0.06, 1.0, 0.06, 0.5), fk, null, K.gold);
  pd(boxM(0.64, 0.06, 0.06, 1.0), fk, null, K.gold);
  for (const s of [-1, 1])
    pd(
      cylM(0.04, 0.04, 0.12),
      joint(fk, s * 0.34, 1.0, 0, 0, 0, PI / 2),
      null,
      K.acc,
    );
  for (const wz of [0.8, -0.78]) {
    const W0 = joint(S0, 0, 0.17, wz, wph),
      tw = joint(W0, 0, 0, 0, 0, 0, PI / 2);
    pd(cylM(0.17, 0.17, 0.08), joint(tw, 0, 0.04, 0, 0), null, K.tyre);
    pd(boxM(0.1, 0.03, 0.3), W0, null, K.glow);
    pd(boxM(0.1, 0.3, 0.03), W0, null, K.glow);
  }
}
function drawHero(root, look, st) {
  // st: {ph, air, slide, hit, boost, dash, scoot, fx, fy, land, wing, t, sp, tilt}
  const K = heroMats(look),
    t = st.t,
    ph = st.ph,
    sw = Math.sin(ph),
    cw = Math.cos(ph),
    air = st.air,
    sc = st.scoot,
    ds = st.dash > 0,
    sp = st.sp;
  let base = root;
  if (st.fx || st.fy) {
    base = joint(base, 0, 1, 0, st.fx, st.fy);
    base = joint(base, 0, -1, 0, 0);
  }
  if (sc) drawScooter(base, K, ph * 1.6, t);
  let R = base,
    crouch = st.land * 0.16 + (sc ? 0.1 : 0);
  if (st.slide && !sc) R = joint(R, 0, 0.62, 0, -1.2);
  else if (st.slide) {
    crouch += 0.3;
    R = joint(R, 0, 0, 0, 0.5);
  } else if (st.hit) R = joint(R, 0, 0, 0, 0.2);
  else if (ds) R = joint(R, 0, 0, 0, 0.6);
  else if (st.idle) R = joint(R, 0, Math.sin(t * 2) * 0.014, 0, 0.03);
  else R = joint(R, 0, air || sc ? 0 : Math.abs(sw) * 0.06, 0, sc ? 0.2 : 0.1);
  const hip = joint(R, 0, 0.98 - crouch + (sc ? -0.08 : 0), 0, 0);
  pd(boxM(0.5, 0.2, 0.32), hip, null, K.dark);
  pd(boxM(0.54, 0.09, 0.35, 0.1), hip, null, K.gold);
  pd(
    boxM(0.1, 0.1, 0.04),
    joint(hip, 0, 0.1, 0.18, 0, 0, PI / 4),
    null,
    K.glow,
  );
  const sway = sc ? 0.3 : ds ? 1.0 : air ? 0.75 : 0.25 + Math.abs(sw) * 0.25; // chapan coat tails
  for (const s of [-1, 1]) {
    const J = joint(
      hip,
      s * 0.14,
      0.06,
      -0.17,
      sway + (s > 0 ? sw : -sw) * 0.1,
      0,
      s * 0.07,
    );
    pd(boxM(0.2, 0.42, 0.04, -0.21), J, null, K.body);
    pd(boxM(0.2, 0.07, 0.05, -0.4), J, null, K.acc);
  }
  const ap = joint(hip, 0, 0.06, 0.17, -0.1 - (air ? 0.3 : 0));
  pd(boxM(0.3, 0.3, 0.04, -0.15), ap, null, K.plate);
  pd(boxM(0.3, 0.05, 0.05, -0.3), ap, null, K.accB);
  const tor = joint(hip, 0, 0.5, 0, 0, sw * 0.12 * (air || sc ? 0.3 : 1));
  pd(boxM(0.62, 0.58, 0.34), tor, null, K.body);
  pd(boxM(0.5, 0.46, 0.06, 0.02), joint(tor, 0, 0, 0.19, 0), null, K.dome);
  pd(boxM(0.7, 0.07, 0.38, 0.29), tor, null, K.gold);
  const pulse = 0.5 + 0.5 * Math.sin(t * 5),
    cs = joint(tor, 0, 0.04, 0.225, 0); // 8-pointed star core
  pd(boxM(0.24, 0.24, 0.03), cs, null, K.gold);
  pd(boxM(0.24, 0.24, 0.03), joint(cs, 0, 0, 0, 0, 0, PI / 4), null, K.gold);
  pd(boxM(0.13, 0.13, 0.04), cs, null, pulse > 0.5 ? K.glow : K.white);
  pd(
    boxM(0.13, 0.13, 0.04),
    joint(cs, 0, 0, 0, 0, 0, PI / 4),
    null,
    pulse > 0.5 ? K.glow : K.white,
  );
  pd(cylM(0.17, 0.2, 0.07), joint(tor, 0, 0.36, 0, 0), null, K.gold);
  // back mount + Humo wings (fold = crest, open = fan)
  const bp = joint(tor, 0, 0.05, -0.24, 0);
  pd(boxM(0.4, 0.46, 0.16), bp, null, K.dome);
  const bs = joint(bp, 0, 0.02, -0.095, 0);
  pd(boxM(0.2, 0.2, 0.03), bs, null, K.gold);
  pd(boxM(0.2, 0.2, 0.03), joint(bs, 0, 0, 0, 0, 0, PI / 4), null, K.gold);
  pd(boxM(0.1, 0.1, 0.035), bs, null, K.glow);
  pd(boxM(0.1, 0.1, 0.035), joint(bs, 0, 0, 0, 0, 0, PI / 4), null, K.glow);
  const wk = st.wing;
  for (const s of [-1, 1]) {
    const wb = joint(tor, s * 0.2, 0.2, -0.3, -0.5 - wk * 0.3);
    for (let i = 0; i < 4; i++) {
      const L = [0.55, 0.72, 0.82, 0.66][i],
        Bn = joint(
          wb,
          0,
          0,
          0,
          0,
          0,
          -s *
            (0.32 +
              i * 0.27 * (0.55 + wk * 0.75) +
              Math.sin(t * 10 + i) * 0.02 * wk),
        );
      pd(boxM(0.1, L, 0.025, L / 2), Bn, null, i % 2 ? K.gold : K.dome);
      pd(boxM(0.1, 0.1, 0.03, L), Bn, null, K.glow);
    }
  }
  if (st.boost)
    for (const sx of [-0.1, 0.1])
      pd(
        coneM(0.08, 0.45 + Math.random() * 0.25),
        joint(bp, sx, -0.22, -0.06, PI),
        null,
        FLAME,
      );
  // head: ribbed turquoise dome, ikat doppi band, almond eyes
  const hd = joint(
    tor,
    0,
    0.5,
    0.02,
    st.hit ? 0.3 : ds ? -0.25 : 0.05,
    st.yaw || 0,
  );
  pd(cylM(0.09, 0.09, 0.12), hd, null, K.dark);
  pd(sphM(0.25, 0.92, 0.95), joint(hd, 0, 0.28, 0), null, K.plate);
  pd(cylM(0.27, 0.27, 0.1), joint(hd, 0, 0.42, 0), null, K.dark);
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.34;
    pd(
      boxM(0.065, 0.065, 0.03),
      joint(hd, Math.sin(a) * 0.27, 0.37, Math.cos(a) * 0.27, 0, a, PI / 4),
      null,
      i % 2 ? K.acc : K.white,
    );
  }
  pd(sphM(0.285, 0.85, 0.285), joint(hd, 0, 0.45, -0.005), null, K.dome);
  for (let i = 0; i < 6; i++)
    pd(
      boxM(0.03, 0.3, 0.03, 0.12),
      joint(joint(hd, 0, 0.45, 0, 0, (i * PI) / 3, 0), 0, 0, 0.2, -0.6),
      null,
      K.gold,
    ); // dome ribs
  pd(coneM(0.045, 0.2), joint(hd, 0, 0.7, 0), null, K.gold);
  pd(sphM(0.045), joint(hd, 0, 0.91, 0), null, pulse > 0.5 ? K.glow : K.white);
  pd(sphM(0.23, 1.0, 0.6), joint(hd, 0, 0.25, 0.16, 0), null, K.dark); // dark visor behind the eyes
  const blink = t % 3.3 < 0.12,
    eh = blink ? 0.12 : st.hit ? 1.0 : ds ? 0.45 : 0.7;
  for (const s of [-1, 1]) {
    pd(
      sphM(0.1, eh, 0.3),
      joint(hd, s * 0.105, 0.27, 0.25, 0, 0, -s * 0.28),
      null,
      K.glow,
    );
    pd(
      boxM(0.12, 0.028, 0.03),
      joint(
        hd,
        s * 0.1,
        0.375,
        0.215,
        0,
        0,
        s * (0.12 + (ds ? 0.3 : 0) - (st.hit ? 0.6 : 0)),
      ),
      null,
      K.acc,
    );
    pd(
      cylM(0.07, 0.07, 0.04),
      joint(hd, s * 0.255, 0.28, 0, 0, 0, (PI / 2) * s),
      null,
      K.gold,
    );
    pd(
      cylM(0.035, 0.035, 0.05),
      joint(hd, s * 0.262, 0.28, 0, 0, 0, (PI / 2) * s),
      null,
      K.glow,
    );
  }
  // ikat scarf: a chain of segments, each one lags behind the previous (reads as cloth in the wind)
  let sj = joint(tor, 0.1, 0.36, -0.12, 0);
  const fl = 0.35 + sp * 0.9;
  for (let i = 0; i < 6; i++) {
    const w = Math.sin(t * 9 - i * 0.95) * 0.2 * fl;
    sj = joint(
      sj,
      0,
      0,
      -0.25,
      (air ? 0.22 : 0.05) + w * 0.6,
      w * 0.5 - (st.tilt || 0) * 0.4,
      0,
    );
    pd(boxM(0.13 - i * 0.012, 0.035, 0.3), sj, null, i % 2 ? K.accB : K.acc);
  }
  // arms
  for (const s of [-1, 1]) {
    const a = st.idle
        ? s > 0 && st.wave
          ? -2.55 - Math.sin(t * 7) * 0.22 * st.wave
          : s * 0.1 + Math.sin(t * 2 + s) * 0.05
        : air && !sc
          ? -2.5 + s * 0.2
          : sc
            ? -0.95
            : st.slide
              ? -1.4
              : ds
                ? 0.95
                : st.hit
                  ? -0.5 + s * 0.4
                  : (s > 0 ? sw : -sw) * 0.95,
      sh = joint(
        tor,
        s * 0.42,
        0.2,
        0,
        a,
        0,
        s * (sc ? 0.05 : 0.12 + (st.idle && s > 0 ? (st.wave || 0) * 0.95 : 0)),
      );
    pd(sphM(0.13), sh, null, K.gold);
    pd(cylM(0.085, 0.07, 0.32), sh, null, K.body);
    const el = joint(
      sh,
      0,
      -0.32,
      0,
      st.idle
        ? s > 0 && st.wave
          ? -0.7 - Math.sin(t * 7 + 1) * 0.3 * st.wave
          : -0.3
        : sc
          ? -0.15
          : air
            ? -0.3
            : ds
              ? -0.5
              : -0.9 - (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.5,
    );
    pd(sphM(0.08), el, null, K.dark);
    pd(cylM(0.07, 0.06, 0.3), el, null, K.dome);
    pd(cylM(0.085, 0.085, 0.05), joint(el, 0, -0.2, 0, 0), null, K.gold);
    pd(sphM(0.1), joint(el, 0, -0.32, 0, 0), null, K.plate);
  }
  // legs: run cycle / air tuck / slide / dash stride / scooter stance (front foot forward, back foot behind)
  for (const s of [-1, 1]) {
    const sg = s > 0 ? sw : -sw,
      cg = s > 0 ? cw : -cw;
    let h1, k1;
    if (sc) {
      h1 = s > 0 ? -0.78 : 0.4;
      k1 = s > 0 ? 0.9 : 0.8;
      if (st.land > 0) k1 += st.land * 0.3;
    } else if (st.slide) {
      h1 = -0.1;
      k1 = 0.1;
    } else if (air) {
      h1 = s > 0 ? -0.9 : 0.3;
      k1 = s > 0 ? 1.3 : 0.9;
      if (ds) {
        h1 = s > 0 ? 0.3 : 0.5;
        k1 = 1.1;
      }
    } else if (st.hit) {
      h1 = s * 0.3;
      k1 = 0.3;
    } else if (st.idle) {
      h1 = s * 0.06 + Math.sin(t * 2) * 0.02;
      k1 = 0.1;
    } else if (ds) {
      h1 = -sg * 1.15;
      k1 = 0.5 + 0.9 * Math.max(0, cg);
    } else {
      h1 = -sg * 0.95;
      k1 = 0.2 + 0.95 * Math.max(0, cg) + st.land * 0.5;
    }
    const th = joint(hip, s * 0.17, 0, 0, h1);
    pd(sphM(0.13), th, null, K.dark);
    pd(cylM(0.1, 0.08, 0.5), th, null, K.dome);
    const kn = joint(th, 0, -0.5, 0, k1);
    pd(sphM(0.09), kn, null, K.gold);
    pd(cylM(0.08, 0.07, 0.46), kn, null, K.body);
    const ft = joint(kn, 0, -0.47, 0, -(h1 + k1) * 0.5 + (air ? 0.4 : 0));
    pd(boxM(0.2, 0.12, 0.3), joint(ft, 0, -0.04, 0.06, 0), null, K.dark);
    pd(boxM(0.16, 0.07, 0.16), joint(ft, 0, 0.0, 0.25, -0.6), null, K.gold);
    pd(boxM(0.2, 0.03, 0.3), joint(ft, 0, -0.1, 0.06, 0), null, K.glow);
  }
}
