/* view/showcase.js — Pre-game cinematic: camera shots, podium and hunters. */
"use strict";
/* ---------- PRE-GAME SHOWCASE: a looping 16 s cinematic around the idle hero ----------
   A (0-5 s)  camera swings from the game position round to a low hero-reveal while the hero waves
   B (5-11 s) a full orbit with the wings opening
   C (11-16 s) pull-back to the exact in-game camera, so the loop (and the hand-off to gameplay) has no jump
   Hunters (Alp + Bo'ri) stalk in from the far end of the street during A and B. */
const ease = (x) => x * x * (3 - 2 * x),
  sm = (a, b, x) => ease(clamp((x - a) / (b - a), 0, 1));
function showShot(T, asp) {
  const u = T % 16,
    off = asp > 1.3 ? 1.15 : 0,
    gh = asp < 0.8 ? 3.1 : 3.3,
    gd = asp < 0.8 ? 5.3 : 6.0;
  let az,
    r,
    hg,
    fov,
    tk = 0,
    wave = 0;
  const rs = asp < 0.8 ? 1.9 : 1,
    ty = asp < 0.8 ? 0.15 : 0.85;
  if (u < 5) {
    const k = ease(u / 5);
    az = lerp(Math.PI, 0.3, k);
    r = lerp(gd, 2.7 * rs, k);
    hg = lerp(gh, 0.65, k);
    fov = lerp(54, 40, k);
    wave = sm(2.6, 3.4, u) * (1 - sm(4.4, 5, u));
  } else if (u < 11) {
    const k = (u - 5) / 6;
    az = 0.3 + ease(k) * TAU;
    r = (2.7 + Math.sin(k * Math.PI) * 0.7) * rs;
    hg = 0.65 + Math.sin(k * Math.PI) * 0.8;
    fov = 42;
  } else {
    const k = ease((u - 11) / 5);
    az = lerp(0.3, Math.PI, k);
    r = lerp(2.7 * rs, gd, k);
    hg = lerp(0.65, gh, k);
    fov = lerp(40, 54, k);
    tk = k;
  }
  let cam = [Math.sin(az) * r, hg, pz + Math.cos(az) * r],
    tgt = [0, lerp(ty, 2.35, tk), pz + lerp(0, 8, tk)];
  if (off) {
    const f = [tgt[0] - cam[0], tgt[2] - cam[2]],
      l = Math.hypot(f[0], f[1]) || 1,
      rx = f[1] / l,
      rz = -f[0] / l,
      o = -off * (1 - tk);
    cam[0] += rx * o;
    cam[2] += rz * o;
    tgt[0] += rx * o;
    tgt[2] += rz * o;
  }
  return {
    cam,
    tgt,
    fov: (fov * Math.PI) / 180,
    yaw: 0,
    wave,
    head: Math.sin(T * 0.8) * 0.3,
    wing:
      0.15 +
      0.85 *
        (u >= 5 && u < 11 ? sm(5, 6.2, u) * (1 - sm(10, 11, u)) : wave * 0.6),
    u,
  };
}
function drawStage(K, T) {
  // glowing Registan-star podium + orbiting motes under the idle hero
  const base = Tp(0, 0, pz),
    ang = T * 0.5;
  pd(cylM(1.05, 1.08, 0.08), joint(base, 0, 0.05, 0, 0), null, K.deck);
  pd(cylM(1.1, 1.1, 0.04), joint(base, 0, 0.1, 0, 0), null, K.gold);
  for (let i = 0; i < 2; i++)
    pd(
      boxM(1.1, 0.03, 1.1, 0.1),
      joint(base, 0, 0.13, 0, 0, ang + (i * Math.PI) / 4, 0),
      null,
      i ? K.glow : K.trim,
    );
  for (let i = 0; i < 8; i++) {
    const a = T * 0.9 + (i * TAU) / 8,
      rr = 0.95 + Math.sin(T * 1.3 + i) * 0.12;
    pd(
      sphM(0.045 + (i & 1) * 0.02),
      joint(
        base,
        Math.cos(a) * rr,
        0.5 + 0.55 * (0.5 + 0.5 * Math.sin(T * 1.7 + i * 1.9)),
        Math.sin(a) * rr,
        0,
      ),
      null,
      i & 1 ? K.accB : K.white,
    );
  }
}
function drawHunters(T, u) {
  // Alp and Bo'ri creep in behind the hero, then slink away
  const k = sm(1.5, 4, u) * (1 - sm(8.5, 10.5, u));
  if (k <= 0.001) return;
  const z = pz - lerp(34, 6.5, k),
    ph = T * 9;
  drawBox(Tp(-1.9, 0, z), ph + 1.5, T);
  drawBall(Tp(1.6, 0, z - 1.2), ph * 0.8, T);
  drawDrone(Tp(0, 0.5, z - 2.4), ph, T);
}

/* ---------- SHOP SHOT: the hero on the podium, the camera swaying round it; each tab frames its own part ---------- */
let shOn = false,
  shTab = "bag",
  shDrag = 0,
  shAzV = Math.PI,
  shLastT = 0;
function shopShot(T, asp) {
  const narrow = asp < 0.8,
    rs = narrow ? 1.7 : 1,
    F = {
      bag: [Math.PI, 3.1 * rs, 1.0, 0.85],
      outfit: [0.4, 3.9 * rs, 1.05, 0.75],
      hat: [0.35, 2.6 * rs, 1.3, 1.1],
      ride: [1.3, 4.6 * rs, 1.0, 0.45],
    }[shTab],
    dt = Math.min(0.1, Math.max(0, T - shLastT));
  shLastT = T;
  const want = F[0] + Math.sin(T * 0.6) * 0.55 + shDrag;
  shAzV += (want - shAzV) * Math.min(1, dt * 5);
  /* the hero sits in the upper part of the screen, above the shop panel */
  const lift = narrow ? 0.55 : 0.2,
    cam = [Math.sin(shAzV) * F[1], F[2] + 0.2, pz + Math.cos(shAzV) * F[1]],
    tgt = [0, F[3] - lift, pz];
  if (asp > 1.3) {
    const sd = 0.9;
    cam[0] += Math.cos(shAzV) * sd;
    cam[2] -= Math.sin(shAzV) * sd;
    tgt[0] += Math.cos(shAzV) * sd;
    tgt[2] -= Math.sin(shAzV) * sd;
    tgt[1] += lift;
  }
  return { cam, tgt, fov: (46 * Math.PI) / 180, yaw: 0, wave: shTab === "outfit" ? 0.5 + 0.5 * Math.sin(T * 2) : 0, head: Math.sin(T * 0.8) * 0.25, wing: 0.5 + 0.4 * Math.sin(T * 1.5), u: 0 };
}
