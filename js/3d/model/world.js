/* model/world.js — Obstacle / coin / power-up spawning and patterns. */
"use strict";
/* ---------- obstacles, pickups, patterns ---------- */
function coin(l, z, y, gem) {
  objs.push({
    k: "coin",
    x: LX[l],
    z,
    y: y === undefined ? 1.0 : y,
    gem: !!gem,
    ph: Math.random() * 6,
    len: 0,
  });
}
function coinLine(l, z, n, step = 2.2, y) {
  for (let i = 0; i < n; i++) coin(l, z + i * step, y);
}
const low = (l, z) => objs.push({ k: "low", x: LX[l], z, len: 0.7 }),
  gate = (l, z) => objs.push({ k: "gate", x: LX[l], z, len: 0.6 }),
  cone = (l, z) =>
    secAt(z)
      ? low(l, z)
      : objs.push({ k: "cone", x: LX[l], z, len: 1.2 });
const pit = (l, z) => objs.push({ k: "pit", x: LX[l], z, len: 3 }),
  ramp = (l, z) => objs.push({ k: "ramp", x: LX[l], z, len: 6 }),
  pad = (l, z) => objs.push({ k: "pad", x: LX[l], z, len: 4 });
/* market stall / hay cart that stays put (sections) or rolls across lanes (street) */
const cartStill = (l, z) =>
  objs.push({ k: "cart", x: LX[l], z, len: 1.4, vx: 0 });
const cart = (l, z) => {
    const s = secAt(z);
    if (s === 1) return gate(l, z);
    if (s) return cartStill(l, z);
    objs.push({
      k: "cart",
      x: LX[l],
      z,
      len: 1.4,
      vx: (Math.random() < 0.5 ? -1 : 1) * rnd(1.7, 2.5),
    });
  },
  laser = (z, hi) => objs.push({ k: "laser", x: 0, z, len: 0.5, hi });
const car = (l, z, vz) => {
  const s = secAt(z);
  if (s > 1) return low(l, z);
  objs.push({
    k: s ? "bus" : "car",
    metro: !!s,
    x: LX[l],
    z,
    len: s ? 11 : 4.6,
    vz: s ? 0 : vz || 0,
    hue: pick([
      [0.92, 0.92, 0.95],
      [0.85, 0.12, 0.16],
      [0.14, 0.14, 0.18],
      [0.2, 0.36, 0.7],
    ]),
  });
};
const bus = (l, z, len) => {
  const s = secAt(z);
  if (s > 1) return gate(l, z);
  objs.push({
    k: "bus",
    metro: s === 1,
    x: LX[l],
    z,
    len,
    hue: pick([
      [0.16, 0.4, 0.8],
      [0.9, 0.55, 0.1],
      [0.2, 0.62, 0.52],
    ]),
  });
};
const powUp = (l, z, t) =>
    objs.push({ k: "pow", t, x: LX[l], z, y: 1.2, len: 0 }),
  letterUp = (l, z, n) =>
    objs.push({ k: "let", n, x: LX[l], z, y: 1.25, len: 0 });
const BLOCK = { low: 1, cone: 1, car: 1, bus: 1, cart: 1 },
  POWS = ["mag", "shield", "turbo", "dbl", "jet", "scoot", "slow"];
function arc(l, z, n, step, h) {
  for (let i = 0; i < n; i++)
    coin(l, z + i * step, 1.0 + Math.sin((i / (n - 1)) * Math.PI) * h);
}
/* patterns for the special sections; returns the length used */
function secSpawn(sec, z, L, o1, o2) {
  const q = Math.random();
  if (sec === 1) {
    /* metro: parked wagons to run over / between, turnstile gates */
    if (q < 0.4) {
      bus(L, z + 4, rnd(12, 16));
      coinLine(o1, z, 9);
      if (Math.random() < 0.5) coinLine(o2, z + 3, 8);
      return 34;
    } else if (q < 0.7) {
      bus(L, z + 4, rnd(10, 14));
      bus(o1, z + 12, rnd(10, 13));
      coinLine(o2, z, 11);
      return 38;
    } else if (q < 0.85) {
      gate(L, z + 8);
      gate(o1, z + 8);
      coinLine(o2, z, 8);
      return 22;
    }
    low(L, z + 8);
    arc(o1, z, 9, 1.8, 1.4);
    coinLine(o2, z + 6, 7);
    return 24;
  }
  if (sec === 2) {
    /* Bukhara tim: stalls, hanging carpets (slide), crates */
    if (q < 0.3) {
      cartStill(L, z + 8);
      cartStill(o1, z + 14);
      coinLine(o2, z, 10);
      return 28;
    } else if (q < 0.55) {
      gate(L, z + 8);
      gate(o1, z + 8);
      coinLine(o2, z + 2, 8, 2.2, 1.0);
      coinLine(L, z + 1, 5, 1.6, 0.7);
      return 24;
    } else if (q < 0.8) {
      low(L, z + 8);
      low(o1, z + 8);
      arc(o2, z + 1, 9, 1.8, 1.3);
      return 24;
    }
    cartStill(L, z + 10);
    gate(o1, z + 16);
    coinLine(o2, z, 12);
    coinLine(L, z + 14, 5, 1.6, 0.7);
    return 30;
  }
  if (sec === 3) {
    /* Khiva wall-top: gaps in the deck to jump, low blocks, arches */
    if (q < 0.35) {
      pit(L, z + 8);
      arc(L, z + 3, 9, 1.3, 1.3);
      coinLine(o1, z, 8);
      return 26;
    } else if (q < 0.6) {
      pit(L, z + 8);
      pit(o1, z + 18);
      arc(L, z + 3, 8, 1.3, 1.3);
      coinLine(o2, z, 12);
      return 30;
    } else if (q < 0.8) {
      ramp(L, z + 6);
      for (let i = 0; i < 9; i++) {
        const t = (i * 1.9) / 21;
        coin(L, z + 12 + i * 1.9, Math.max(1.0, 1.4 + 10.5 * t - 14 * t * t));
      }
      coinLine(o1, z + 2, 8);
      return 34;
    }
    gate(L, z + 8);
    low(o1, z + 8);
    coinLine(o2, z, 9);
    return 24;
  }
  /* sec === 4, Fergana: irrigation canals to jump, hay carts, cotton fields */
  if (q < 0.35) {
    pit(L, z + 8);
    arc(L, z + 3, 9, 1.2, 1.2);
    coinLine(o1, z, 8);
    return 26;
  } else if (q < 0.6) {
    for (const l of [0, 1, 2]) pit(l, z + 10);
    arc(1, z + 4, 9, 1.3, 1.4);
    return 26;
  } else if (q < 0.82) {
    cartStill(o1, z + 12);
    coinLine(L, z + 2, 9);
    coinLine(o2, z + 6, 7);
    return 26;
  }
  low(L, z + 8);
  coinLine(o1, z, 9);
  coin(o2, z + 10, 1.0, true);
  return 22;
}
function spawn() {
  spawn0();
  courClear();
}
function spawn0() {
  const z = nextSpawn,
    L = (Math.random() * 3) | 0,
    o1 = (L + 1 + ((Math.random() * 2) | 0)) % 3,
    o2 = 3 - L - o1,
    hard = clamp(pz / 2600, 0, 1),
    r = Math.random() * (pz < 350 ? 0.55 : 1);
  let used = 26;
  if (forkAt(z)) {
    /* road fork: walled median + fast (left) / coin (right) roads */
    objs.push({ k: "bus", fork: true, x: LX[1], z, len: 30, hue: [1, 1, 1] });
    const q = Math.random();
    if (q < 0.4) low(0, z + 6);
    else if (q < 0.7) gate(0, z + 12);
    else cone(0, z + 8);
    if (Math.random() < 0.6) low(0, z + 22);
    coin(0, z + 15, 1.0, Math.random() < 0.3);
    coinLine(2, z + 1, 13, 2.2);
    if (Math.random() < 0.3) coin(2, z + 29, 1.0, true);
    nextSpawn = z + 30;
    return;
  }
  const ek = evAt(z + 10);
  if (ek && !secAt(z + 20) && !forkAt(z) && plazaOf(Math.floor(z / CH)) < 0) {
    const r2 = evSpawn(ek, z, L, o1, o2);
    if (r2) {
      nextSpawn = z + r2[0] + r2[1];
      return;
    }
  }
  const sec = secAt(z + 20);
  if (sec && Math.random() < 0.8) {
    used = secSpawn(sec, z, L, o1, o2);
    nextSpawn = z + used + speed * rnd(0.5, 0.85) * (1.1 - hard * 0.35);
    return;
  }
  if (pz > 300 && !sec && Math.random() < 0.3) {
    used = extraPattern(z, L, o1, o2);
    nextSpawn = z + used + speed * rnd(0.5, 0.85) * (1.1 - hard * 0.35);
    return;
  }
  if (r < 0.08) {
    coinLine(L, z, 10);
    used = 26;
  } else if (r < 0.15) {
    low(L, z + 8);
    arc(L, z + 2, 8, 2, 1.3);
    used = 26;
  } else if (r < 0.22) {
    gate(L, z + 8);
    coinLine(L, z + 1, 7, 1.6, 0.7);
    coinLine(o1, z, 6, 2.4);
    used = 22;
  } else if (r < 0.29) {
    bus(L, z + 4, rnd(11, 16));
    coinLine(o1, z + 2, 9);
    if (hard > 0.25 && Math.random() < 0.7) low(o2, z + 12);
    used = 32;
  } else if (r < 0.35) {
    car(L, z + 6);
    car(o1, z + 8);
    coinLine(o2, z, 9);
    used = 24;
  } else if (r < 0.41) {
    cone(L, z + 6);
    cone(o1, z + 6);
    if (hard > 0.3) cone(o2, z + 15);
    coinLine(o2, z, 8);
    used = 22;
  } else if (r < 0.48) {
    pit(L, z + 8);
    arc(L, z + 3, 9, 1.2, 1.2);
    coinLine(o1, z, 7);
    if (hard > 0.4) pit(o1, z + 22);
    used = 28;
  } else if (r < 0.55) {
    ramp(L, z + 6);
    const zE = z + 12;
    for (let i = 0; i < 9; i++) {
      const t = (i * 1.9) / 21;
      coin(L, zE + i * 1.9, Math.max(1.0, 1.4 + 10.5 * t - 14 * t * t));
    }
    coinLine(o1, z + 2, 8);
    used = 34;
  } else if (r < 0.61) {
    car(L, z + 14, rnd(7, 10));
    coinLine(o1, z + 4, 9);
    if (hard > 0.35) car(o2, z + 22, rnd(8, 11));
    used = 30;
  } else if (r < 0.67) {
    pad(L, z + 4);
    coinLine(L, z + 9, 10, 2.4);
    used = 34;
  } else if (r < 0.73) {
    for (let i = 0; i < 10; i++) coin([0, 1, 2, 1][i % 4], z + i * 2.4);
    gate(L, z + 24);
    used = 30;
  } else if (r < 0.8) {
    cart(o1, z + 12);
    coinLine(L, z + 2, 9);
    used = 26;
  } else if (r < 0.88) {
    const hi = Math.random() < 0.5;
    laser(z + 8, hi);
    if (hi) coinLine(1, z - 2, 6, 1.4, 0.6);
    else arc(1, z - 1, 7, 1.2, 1.5);
    used = 24;
  } else if (r < 0.94) {
    gate(0, z + 6);
    gate(1, z + 6);
    gate(2, z + 6);
    coinLine(1, z, 5, 1.6, 0.7);
    coin(1, z + 14, 1.0, true);
    used = 22;
  } else {
    bus(L, z + 4, rnd(10, 13));
    pit(o1, z + 8);
    if (hard > 0.5) low(o2, z + 10);
    coinLine(o2, z, 7);
    used = 30;
  }
  if (Math.random() < (turbo > 0 || jet > 0 ? 0.04 : 0.11))
    powUp(Math.random() < 0.5 ? o2 : o1, z + rnd(4, 14), pick(POWS));
  if (nextLetter < 6 && Math.random() < 0.1 && !objs.some((o) => o.k === "let"))
    letterUp((Math.random() * 3) | 0, z + rnd(6, 16), nextLetter);
  if (Math.random() < 0.3)
    coin((Math.random() * 3) | 0, z + rnd(3, 14), 1.0, true);
  nextSpawn = z + used + speed * rnd(0.5, 0.85) * (1.1 - hard * 0.35);
}

/* obstacle / pickup meshes */
const OB = {};
const PADT = (() => {
  const c = mkc(64, 128),
    g = c.getContext("2d");
  g.fillStyle = "#0c2447";
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = "#53f7ff";
  g.lineWidth = 8;
  g.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(8, 118 - i * 36);
    g.lineTo(32, 94 - i * 36);
    g.lineTo(56, 118 - i * 36);
    g.stroke();
  }
  g.strokeStyle = "#fff";
  g.lineWidth = 4;
  g.strokeRect(2, 2, 60, 124);
  return texFrom(c);
})();
function obMesh(k) {
  if (OB[k]) return OB[k];
  const b = new B(),
    Y = [1, 0.8, 0.1];
  if (k === "low") {
    b.box(0, 0.4, 0, 1.9, 0.8, 0.6, [1, 1, 1], {
      uv: {
        pz: [0, 0, 1, 1],
        nz: [0, 0, 1, 1],
        px: [0, 0, 0.3, 1],
        nx: [0, 0, 0.3, 1],
        py: [0, 0, 0.5, 0.5],
      },
    });
    b.box(0, 0.88, 0, 1.9, 0.1, 0.5, [0.9, 0.9, 0.9]);
  } else if (k === "gate") {
    for (const sx of [-0.95, 0.95])
      b.box(sx, 1.35, 0, 0.14, 2.7, 0.3, [0.25, 0.28, 0.36]);
    b.box(0, 1.9, 0, 2.0, 0.65, 0.3, [1, 1, 1], {
      uv: { pz: [0, 0, 2, 0.6], nz: [0, 0, 2, 0.6], py: [0, 0, 1, 1] },
    });
    b.box(0, 2.35, 0, 2.0, 0.08, 0.34, [0.2, 0.2, 0.26]);
  } else if (k === "car") {
    const c = [1, 1, 1];
    b.box(0, 0.62, 0, 1.8, 0.7, 4.6, c);
    b.box(0, 1.2, -0.1, 1.6, 0.55, 2.4, c, {
      cols: {
        px: [0.07, 0.1, 0.18],
        nx: [0.07, 0.1, 0.18],
        pz: [0.07, 0.1, 0.18],
        nz: [0.05, 0.08, 0.14],
        py: c,
      },
    });
    for (const dz of [-1.5, 1.5])
      for (const dx of [-0.9, 0.9])
        b.box(dx, 0.3, dz, 0.22, 0.6, 0.6, [0.05, 0.05, 0.06]);
  } else if (k === "cone") {
    for (const [x, z] of [
      [-0.5, 0],
      [0.5, 0],
      [0, 0.4],
    ]) {
      b.box(x, 0.03, z, 0.7, 0.06, 0.7, [0.1, 0.1, 0.12]);
      b.cyl(x, 0.06, z, 0.3, 0.04, 0.78, 10, [1, 0.45, 0.08], true, [1, 1, 1]);
    }
  } else if (k === "pit") {
    b.quad(
      [
        [-1, 0.035, 0],
        [1, 0.035, 0],
        [1, 0.035, 3],
        [-1, 0.035, 3],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.01, 0.01, 0.015],
    );
    for (const [x, z, w, d] of [
      [-1.05, 1.5, 0.12, 3.2],
      [1.05, 1.5, 0.12, 3.2],
      [0, -0.05, 2.2, 0.12],
      [0, 3.05, 2.2, 0.12],
    ])
      b.box(x, 0.06, z, w, 0.07, d, Y);
  } else if (k === "cart") {
    b.box(0, 0.6, 0, 1.7, 0.5, 1.1, [0.5, 0.34, 0.2]);
    b.box(0, 1.8, 0, 1.9, 0.1, 1.3, [0.9, 0.2, 0.3]);
    for (const [x, z] of [
      [-0.8, -0.55],
      [0.8, -0.55],
      [-0.8, 0.55],
      [0.8, 0.55],
    ])
      b.box(x, 1.2, z, 0.08, 1.2, 0.08, [0.4, 0.3, 0.2]);
    for (let i = 0; i < 5; i++)
      b.sph(
        -0.6 + i * 0.3,
        1.0,
        rnd(-0.3, 0.3),
        0.17,
        0.15,
        0.17,
        5,
        7,
        pick([
          [0.2, 0.7, 0.2],
          [0.95, 0.55, 0.1],
          [0.85, 0.15, 0.2],
          [0.95, 0.85, 0.2],
        ]),
      );
    for (const dx of [-0.85, 0.85])
      b.cyl(dx, 0.3, 0, 0.3, 0.3, 0.1, 8, [0.1, 0.1, 0.12], true);
  } else if (k === "ramp") {
    const L = 6,
      H = 1.4,
      n = [0, L, -H],
      nl = Math.hypot(...n);
    b.quad(
      [
        [-1, 0, 0],
        [1, 0, 0],
        [1, H, L],
        [-1, H, L],
      ],
      [n[0] / nl, n[1] / nl, n[2] / nl],
      [
        [0, 0],
        [1, 0],
        [1, 4],
        [0, 4],
      ],
      [1, 1, 1],
    );
    b.quad(
      [
        [-1, 0, L],
        [1, 0, L],
        [1, H, L],
        [-1, H, L],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.3, 0.3, 0.34],
    );
    b.quad(
      [
        [-1, 0, 0],
        [-1, 0, L],
        [-1, H, L],
        [-1, 0, L],
      ],
      [-1, 0, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.3, 0.3, 0.34],
    );
    b.quad(
      [
        [1, 0, 0],
        [1, 0, L],
        [1, H, L],
        [1, 0, L],
      ],
      [1, 0, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.3, 0.3, 0.34],
    );
  } else if (k === "pad")
    b.quad(
      [
        [-0.9, 0.04, 0],
        [0.9, 0.04, 0],
        [0.9, 0.04, 4],
        [-0.9, 0.04, 4],
      ],
      [0, 1, 0],
      [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
      [1, 1, 1],
    );
  else if (k === "laserH" || k === "laserL") {
    const hi = k === "laserH",
      yb = hi ? 1.75 : 0.45;
    for (const sx of [-3.7, 3.7]) {
      b.box(sx, 1.4, 0, 0.26, 2.8, 0.34, [0.22, 0.24, 0.32]);
      b.box(sx, yb, 0, 0.36, 0.3, 0.4, [0.9, 0.2, 0.2]);
    }
    b.box(0, yb, 0, 7.4, 0.07, 0.07, [1, 0.2, 0.2]);
    b.box(0, yb, 0, 7.4, 0.2, 0.03, [1, 0.3, 0.3]);
  }
  return (OB[k] = b.mesh());
}
const BUSL = {};
function busMesh(len) {
  const key = Math.round(len);
  if (BUSL[key]) return BUSL[key];
  const b = new B(),
    L = key,
    c = [1, 1, 1],
    gl2 = [0.12, 0.16, 0.26];
  b.box(0, 1.5, L / 2, 2.3, 2.6, L, c, {
    cols: { px: c, nx: c, pz: [0.15, 0.18, 0.28], nz: [0.15, 0.18, 0.28] },
  });
  b.box(0, 2.42, L / 2, 2.34, 0.7, L - 0.6, gl2);
  b.box(0, 0.26, L / 2, 2.0, 0.5, L - 0.4, [0.08, 0.08, 0.1]);
  b.box(0, 2.9, L / 2, 2.0, 0.12, L - 0.4, [0.8, 0.8, 0.82]);
  return (BUSL[key] = b.mesh());
}
const TAIL = (() => {
  const b = new B();
  b.box(-0.8, 0.9, 0, 0.35, 0.16, 0.06, [1, 0.12, 0.1]);
  b.box(0.8, 0.9, 0, 0.35, 0.16, 0.06, [1, 0.12, 0.1]);
  return b.mesh();
})();
const REDL = (() => {
  const b = new B();
  b.sph(0, 0, 0, 0.1, 0.1, 0.1, 6, 8, [1, 0.1, 0.1]);
  return b.mesh();
})();
const QUAD = (w, h) => {
  const b = new B();
  b.quad(
    [
      [-w / 2, -h / 2, 0],
      [w / 2, -h / 2, 0],
      [w / 2, h / 2, 0],
      [-w / 2, h / 2, 0],
    ],
    [0, 0, 1],
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
    [1, 1, 1],
  );
  return b.mesh();
};
const PICKQ = QUAD(1.1, 1.1),
  LIGHTQ = (() => {
    const b = new B();
    b.quad(
      [
        [-1, 0.06, -1],
        [1, 0.06, -1],
        [1, 0.06, 1],
        [-1, 0.06, 1],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [1, 1, 1],
    );
    return b.mesh();
  })();
const BUBBLE = (() => {
  const b = new B();
  b.sph(0, 1.0, 0, 1.2, 1.35, 1.2, 12, 16, [0.4, 0.85, 1]);
  return b.mesh();
})();
const LIGHTT = (() => {
  const c = mkc(64, 64),
    g = c.getContext("2d"),
    q = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  q.addColorStop(0, "rgba(255,250,220,.95)");
  q.addColorStop(0.55, "rgba(255,240,190,.5)");
  q.addColorStop(1, "rgba(255,240,190,0)");
  g.fillStyle = q;
  g.fillRect(0, 0, 64, 64);
  return texFrom(c);
})();

/* pickup icons (drawn once on canvases: used both in 3D and in the HUD) */
const POWC = {},
  POWCOL = {
    mag: "#ff4f6a",
    shield: "#53b8ff",
    turbo: "#ffd84f",
    dbl: "#ffb02e",
    jet: "#b07bff",
    scoot: "#2ee6c8",
    slow: "#8fb4ff",
  };
function iconCanvas(t) {
  const c = mkc(96, 96),
    g = c.getContext("2d"),
    col = POWCOL[t],
    q = g.createRadialGradient(48, 40, 4, 48, 48, 48);
  q.addColorStop(0, "#ffffff");
  q.addColorStop(0.35, col);
  q.addColorStop(1, "#14183a");
  g.fillStyle = q;
  g.beginPath();
  g.arc(48, 48, 44, 0, TAU);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = "rgba(255,255,255,.9)";
  g.stroke();
  g.lineCap = "round";
  g.lineJoin = "round";
  if (t === "mag") {
    g.lineWidth = 13;
    g.strokeStyle = "#e8344e";
    g.beginPath();
    g.arc(48, 52, 20, Math.PI, Math.PI * 1.5);
    g.stroke();
    g.strokeStyle = "#3a78ff";
    g.beginPath();
    g.arc(48, 52, 20, Math.PI * 1.5, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "#e8344e";
    g.beginPath();
    g.moveTo(28, 52);
    g.lineTo(28, 68);
    g.stroke();
    g.strokeStyle = "#3a78ff";
    g.beginPath();
    g.moveTo(68, 52);
    g.lineTo(68, 68);
    g.stroke();
    g.fillStyle = "#fff";
    g.fillRect(21, 66, 14, 6);
    g.fillRect(61, 66, 14, 6);
  } else if (t === "shield") {
    g.fillStyle = "#e8f6ff";
    g.strokeStyle = "#2a6fd0";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(48, 20);
    g.lineTo(70, 28);
    g.lineTo(68, 52);
    g.quadraticCurveTo(64, 68, 48, 76);
    g.quadraticCurveTo(32, 68, 28, 52);
    g.lineTo(26, 28);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#3a8cff";
    g.beginPath();
    g.moveTo(48, 28);
    g.lineTo(62, 33);
    g.lineTo(60, 52);
    g.quadraticCurveTo(57, 62, 48, 68);
    g.closePath();
    g.fill();
  } else if (t === "turbo") {
    g.fillStyle = "#fff4a0";
    g.strokeStyle = "#c27a00";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(54, 14);
    g.lineTo(30, 54);
    g.lineTo(46, 54);
    g.lineTo(40, 82);
    g.lineTo(68, 40);
    g.lineTo(52, 40);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (t === "dbl") {
    g.fillStyle = "#fff";
    g.strokeStyle = "#a35a00";
    g.lineWidth = 6;
    g.font = "800 46px Orbitron, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.strokeText("2×", 48, 52);
    g.fillText("2×", 48, 52);
  } else if (t === "scoot") {
    g.lineCap = "round";
    g.strokeStyle = "#064c44";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(22, 66);
    g.lineTo(70, 66);
    g.moveTo(66, 66);
    g.lineTo(58, 24);
    g.moveTo(48, 24);
    g.lineTo(68, 24);
    g.stroke();
    g.strokeStyle = "#fff";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#064c44";
    for (const x of [26, 68]) {
      g.beginPath();
      g.arc(x, 72, 7, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#fff";
    for (const x of [26, 68]) {
      g.beginPath();
      g.arc(x, 72, 3, 0, TAU);
      g.fill();
    }
  } else if (t === "slow") {
    g.fillStyle = "#f4f8ff";
    g.strokeStyle = "#2a4ca8";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(30, 20);
    g.lineTo(66, 20);
    g.lineTo(50, 48);
    g.lineTo(66, 76);
    g.lineTo(30, 76);
    g.lineTo(46, 48);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#5b86ff";
    g.beginPath();
    g.moveTo(38, 70);
    g.lineTo(58, 70);
    g.lineTo(48, 56);
    g.closePath();
    g.fill();
    g.fillRect(46, 30, 4, 14);
  } else {
    g.fillStyle = "#f4f6ff";
    g.strokeStyle = "#4a2a9a";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(48, 12);
    g.quadraticCurveTo(66, 30, 62, 62);
    g.lineTo(34, 62);
    g.quadraticCurveTo(30, 30, 48, 12);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#ff4f6a";
    g.beginPath();
    g.moveTo(34, 52);
    g.lineTo(22, 70);
    g.lineTo(36, 64);
    g.fill();
    g.beginPath();
    g.moveTo(62, 52);
    g.lineTo(74, 70);
    g.lineTo(60, 64);
    g.fill();
    g.fillStyle = "#53b8ff";
    g.beginPath();
    g.arc(48, 38, 7, 0, TAU);
    g.fill();
    g.fillStyle = "#ffb02e";
    g.beginPath();
    g.moveTo(40, 64);
    g.lineTo(48, 86);
    g.lineTo(56, 64);
    g.fill();
  }
  return c;
}
const powCanvas = (t) => POWC[t] || (POWC[t] = iconCanvas(t));
const POWT = {},
  powTex = (t) => POWT[t] || (POWT[t] = texFrom(powCanvas(t)));
const LETT = [],
  letTex = (n) =>
    LETT[n] ||
    (LETT[n] = (() => {
      const c = mkc(96, 96),
        g = c.getContext("2d"),
        q = g.createLinearGradient(0, 0, 0, 96);
      q.addColorStop(0, "#fff3a0");
      q.addColorStop(1, "#f2a21e");
      g.fillStyle = q;
      g.beginPath();
      g.roundRect(6, 6, 84, 84, 20);
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = "#fff";
      g.stroke();
      g.fillStyle = "#4a2a00";
      g.font = "800 58px Orbitron, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("ZUMARY"[n], 48, 52);
      return texFrom(c);
    })());

/* coins: one dynamic batch per face texture; CPU-transformed discs */
let COINT = null,
  GEMT = null,
  COINTPL = null;
function coinTexs() {
  if (COINT) return;
  const mkT = (frames, gem) => {
    const c = mkc(128, 128),
      g = c.getContext("2d"),
      q = g.createRadialGradient(64, 64, 4, 64, 64, 90);
    q.addColorStop(0, gem ? "#fff6b0" : "#ffe58a");
    q.addColorStop(1, gem ? "#ff9a2a" : "#e59a1e");
    g.fillStyle = q;
    g.fillRect(0, 0, 128, 128);
    const f = frames[0];
    g.drawImage(f, 14, 14, 100, 100);
    return texFrom(c, {});
  };
  const R = Rig.coins(1.6);
  COINT = mkT(R.n, false);
  GEMT = mkT(R.g, true);
  COINICON = R.n;
  const b = new B(),
    seg = 16,
    r = 0.5,
    t = 0.09,
    c = [1, 1, 1];
  for (const sgn of [1, -1]) {
    const ct = b.vert(0, 0, sgn * t, 0, 0, sgn, 0.5, 0.5, c);
    let prev = -1;
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * TAU,
        q2 = b.vert(
          Math.cos(a) * r,
          Math.sin(a) * r,
          sgn * t,
          0,
          0,
          sgn,
          0.5 + Math.cos(a) * 0.5 * 0.9 * (sgn > 0 ? 1 : -1),
          0.5 - Math.sin(a) * 0.5 * 0.9,
          c,
        );
      if (prev >= 0) b.i.push(ct, sgn > 0 ? prev : q2, sgn > 0 ? q2 : prev);
      prev = q2;
    }
  }
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * TAU,
      a1 = ((s + 1) / seg) * TAU,
      nn = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
    b.quad(
      [
        [Math.cos(a0) * r, Math.sin(a0) * r, -t],
        [Math.cos(a1) * r, Math.sin(a1) * r, -t],
        [Math.cos(a1) * r, Math.sin(a1) * r, t],
        [Math.cos(a0) * r, Math.sin(a0) * r, t],
      ],
      nn,
      [
        [0.02, 0.02],
        [0.03, 0.02],
        [0.03, 0.03],
        [0.02, 0.03],
      ],
      [0.95, 0.75, 0.25],
    );
  }
  COINTPL = { v: new Float32Array(b.v), i: b.i, n: b.n };
}
const CN = [],
  GM = [];
let COINICON = null;
const CMAX = 150;
let CVER = null,
  CBUFS = null;
function initCoinBuf() {
  const nv = COINTPL.n,
    ni = COINTPL.i.length;
  CVER = new Float32Array(CMAX * nv * 11);
  const idx = new Uint16Array(CMAX * ni);
  for (let c = 0; c < CMAX; c++)
    for (let i = 0; i < ni; i++) idx[c * ni + i] = COINTPL.i[i] + c * nv;
  CBUFS = [0, 1].map(() => {
    const vb = gl.createBuffer(),
      ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, CVER.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vb, ib, n: 0 };
  });
}
function drawCoins(list, tex, size, which, ca) {
  const cnt = Math.min(list.length, CMAX);
  if (!cnt) return;
  if (!CVER) initCoinBuf();
  const nv = COINTPL.n,
    vs = COINTPL.v,
    ni = COINTPL.i.length,
    verts = CVER;
  let o = 0;
  for (let c = 0; c < cnt; c++) {
    const cn = list[c],
      a = ca * 2 + cn.ph,
      ca2 = Math.cos(a),
      sa = Math.sin(a),
      bob = Math.sin(ca + cn.ph) * 0.08;
    for (let v = 0; v < nv; v++) {
      const q = v * 11,
        x = vs[q] * size,
        y = vs[q + 1] * size,
        z = vs[q + 2] * size,
        nx = vs[q + 3],
        ny = vs[q + 4],
        nz = vs[q + 5];
      verts[o++] = x * ca2 + z * sa + cn.x;
      verts[o++] = y + cn.y + bob;
      verts[o++] = -x * sa + z * ca2 + cn.z;
      verts[o++] = nx * ca2 + nz * sa;
      verts[o++] = ny;
      verts[o++] = -nx * sa + nz * ca2;
      verts[o++] = vs[q + 6];
      verts[o++] = vs[q + 7];
      verts[o++] = vs[q + 8];
      verts[o++] = vs[q + 9];
      verts[o++] = vs[q + 10];
    }
  }
  const B2 = CBUFS[which];
  gl.bindBuffer(gl.ARRAY_BUFFER, B2.vb);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts.subarray(0, o));
  B2.n = cnt * ni;
  draw(B2, IDM, tex, COINMAT);
}
const COINMAT = { emis: 0.55, spec: 0.8, tint: [1.1, 1.05, 0.9] };
