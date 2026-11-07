/* view/city-builder.js — Static meshes and the chunked, time-sliced 3D city generator. */
"use strict";
/* ---------- static meshes ---------- */
const ROADM = (() => {
  const b = new B();
  b.quad(
    [
      [-5.2, 0, 0],
      [5.2, 0, 0],
      [5.2, 0, 40],
      [-5.2, 0, 40],
    ],
    [0, 1, 0],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    WHITE,
  );
  return b.mesh();
})();
const SIDEM = (() => {
  const b = new B();
  for (const sd of [-1, 1]) {
    const x0 = sd * 5.4,
      x1 = sd * 8.6;
    b.quad(
      [
        [x0, 0.16, 0],
        [x1, 0.16, 0],
        [x1, 0.16, 40],
        [x0, 0.16, 40],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 10],
        [0, 10],
      ],
      WHITE,
    );
    b.box(sd * 5.3, 0.08, 20, 0.2, 0.16, 40, [0.85, 0.82, 0.74], {
      skip: { py: 1 },
    });
  }
  return b.mesh();
})();
const SHADOWM = (() => {
  const b = new B();
  b.quad(
    [
      [-1, 0.03, -1],
      [1, 0.03, -1],
      [1, 0.03, 1],
      [-1, 0.03, 1],
    ],
    [0, 1, 0],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    WHITE,
  );
  return b.mesh();
})();

/* ---------- city generator ---------- */
const CH = 60,
  BX = 9.2,
  CHUNKS = new Map(),
  CUR = [-40, -40];
const WALL = [
    [0.78, 0.66, 0.5],
    [0.74, 0.7, 0.66],
    [0.82, 0.7, 0.52],
    [0.72, 0.6, 0.46],
  ],
  TILEB = [0.1, 0.42, 0.66];
function addDome(b, x, y, z, R, tall, col, col2) {
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2);
    pts.push([
      R * Math.cos(a) * (1 + 0.16 * Math.sin(2 * a)),
      y + tall * Math.sin(a),
    ]);
  }
  const dr = R * 0.62;
  b.cyl(x, y - dr, z, R * 0.86, R * 0.86, dr, 14, [0.82, 0.68, 0.46], false);
  b.lathe(x, 0, z, pts, 18, col, col2);
  b.cyl(x, y + tall, z, 0.05, 0.05, R * 0.4, 6, [0.95, 0.78, 0.3]);
  b.sph(x, y + tall + R * 0.4, z, 0.14, 0.14, 0.14, 6, 8, [0.95, 0.78, 0.3]);
}
function addMinaret(b, sb, x, z, hgt, r) {
  const seg = 14,
    c = [1, 1, 1];
  b.cyl(x, 0, z, r * 1.35, r * 0.9, hgt, seg, c, false);
  sb.cyl(x, hgt - 2.2, z, r * 1.5, r * 1.5, 0.5, seg, [0.78, 0.6, 0.38]);
  sb.cyl(x, hgt - 1.7, z, r * 1.25, r * 1.1, 0.7, seg, [0.12, 0.46, 0.7]);
  sb.cyl(x, hgt - 1.0, z, r * 0.9, r * 0.9, 1.4, 10, [0.12, 0.5, 0.74], true);
  addDome(
    sb,
    x,
    hgt + 0.4,
    z,
    r * 1.05,
    r * 1.7,
    [0.1, 0.62, 0.78],
    [0.2, 0.78, 0.88],
  );
}
function chunkB(ch, key) {
  return ch.b[key] || (ch.b[key] = { b: new B(), tex: null, mat: null });
}
function addBuilding(ch, sd, z0, th) {
  const idx = (Math.random() * DEFS[th].length) | 0,
    ft = facadeTex(th, idx),
    Wm = ft.len,
    Hm = ft.h * rnd(0.95, 1.1),
    dep = 15,
    xf = sd * (BX + rnd(0, 1.2));
  const wc = pick(WALL),
    key = "f" + th + ":" + idx,
    e = chunkB(ch, key);
  e.tex = ft.tex;
  e.mat = TMAT[th];
  const b = e.b;
  const zc = z0 + Wm / 2,
    xc = xf + (sd * dep) / 2,
    nrm = sd > 0 ? "nx" : "px";
  // facade quad faces the street; u runs left → right as seen from the street
  const front =
    sd < 0
      ? [
          [xf, 0, z0 + Wm],
          [xf, 0, z0],
          [xf, Hm, z0],
          [xf, Hm, z0 + Wm],
        ]
      : [
          [xf, 0, z0],
          [xf, 0, z0 + Wm],
          [xf, Hm, z0 + Wm],
          [xf, Hm, z0],
        ];
  b.quad(
    front,
    [-sd, 0, 0],
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
    [1, 1, 1],
  );
  // solid body (side walls, back, roof) in the shared plain batch
  const s = chunkB(ch, "solid");
  s.tex = null;
  s.mat = { emis: 0, spec: 0.0 };
  const sb = s.b,
    wcc = mulc(wc, 0.85),
    roofY = Hm;
  sb.box(xc + sd * 0.02, Hm / 2, zc, dep, Hm, Wm - 0.02, wcc, {
    skip: { [nrm]: 1 },
    cols: { py: [0.42, 0.4, 0.4] },
  });
  sb.box(xf - sd * 0.12, Hm + 0.25, zc, 0.5, 0.5, Wm + 0.3, mulc(wc, 1.1)); // cornice
  if (ft.kind === "glass") {
    sb.cyl(xc, Hm, zc, 0.12, 0.05, 6, 5, [0.6, 0.6, 0.65]);
    sb.sph(xc, Hm + 6, zc, 0.22, 0.22, 0.22, 5, 6, [1, 0.2, 0.2]);
  } else if (ft.kind === "panel" || ft.kind === "tower" || ft.kind === "shops")
    for (let k = 0; k < 2; k++)
      sb.box(
        xc + sd * rnd(-2, 2),
        Hm + 0.5,
        z0 + rnd(0.2, 0.8) * Wm,
        rnd(0.8, 1.6),
        1.0,
        rnd(0.8, 1.6),
        [0.5, 0.5, 0.52],
      );
  if (["glass", "panel", "tower", "shops"].includes(ft.kind)) {
    // shop awnings over the lit ground floor
    const n = Math.max(2, Math.round(Wm / 3.6)),
      pal = [
        [0.8, 0.22, 0.3],
        [0.16, 0.6, 0.72],
        [0.92, 0.7, 0.2],
      ];
    for (let i = 0; i < n; i++) {
      const zz = z0 + ((i + 0.5) * Wm) / n;
      sb.box(
        xf - sd * 0.55,
        2.9,
        zz,
        1.1,
        0.14,
        Wm / n - 0.4,
        pal[(i + th) % 3],
      );
    }
  }
  if (THEMES[th].night || (th === 0 && Math.random() < 0.35)) {
    // neon signs
    const gb = chunkB(ch, "glow");
    gb.tex = null;
    gb.mat = { emis: 1 };
    const NE = [
      [1, 0.2, 0.8],
      [0.2, 0.95, 1],
      [1, 0.85, 0.2],
      [0.5, 1, 0.4],
    ];
    for (let i = 0, n = 1 + ((Math.random() * 3) | 0); i < n; i++)
      gb.b.box(
        xf - sd * 0.5,
        rnd(4.5, Math.min(Hm - 1, 10)),
        z0 + rnd(0.15, 0.85) * Wm,
        0.25,
        rnd(1.4, 3.2),
        0.8,
        pick(NE),
      );
    gb.b.box(xf - sd * 0.12, 3.75, zc, 0.1, 0.16, Wm * 0.85, pick(NE));
  }
  for (const d of ft.domes || []) {
    // real 3D domes on top of madrasas / Registan
    const dx = d.x / ft.w,
      dwm = (d.w / ft.w) * Wm,
      dz = z0 + (sd < 0 ? Wm - (dx * Wm + dwm / 2) : dx * Wm + dwm / 2),
      dy = Hm * (1 - d.y / ft.hh);
    addDome(
      sb,
      xf + sd * dwm * 0.55,
      dy,
      dz,
      (dwm / 2) * 0.92,
      dwm * 0.66,
      [0.1, 0.62, 0.78],
      [0.22, 0.8, 0.9],
    );
  }
  return Wm;
}
function* genChunk(ci) {
  const zA = ci * CH,
    zB = zA + CH,
    th = themeAt(zA + CH / 2),
    ch = { ci, zA, zB, b: {}, meshes: [] };
  for (let s = 0; s < 2; s++) {
    const sd = s ? 1 : -1;
    while (CUR[s] < zB) {
      if (Math.random() < 0.2) {
        const g = rnd(5, 9);
        const sb = chunkB(ch, "solid").b;
        sb.box(sd * (BX + 8), 6, CUR[s] + g / 2, 14, 12, g, [0.5, 0.42, 0.34]);
        addMinaretMaybe(ch, sd, CUR[s] + g / 2, th);
        CUR[s] += g;
        yield;
        continue;
      }
      CUR[s] +=
        addBuilding(ch, sd, CUR[s], th) +
        (Math.random() < 0.25 ? rnd(0.3, 1.4) : 0.02);
      yield;
    }
  }
  // distant towers behind the street wall — depth, fog-dimmed
  for (let s = 0; s < 2; s++)
    for (let k = 0; k < 2; k++) {
      const sd = s ? 1 : -1,
        z = zA + rnd(4, CH - 8),
        hh = rnd(26, 62),
        w = rnd(10, 18),
        e = chunkB(ch, "far" + th);
      e.tex = facadeTex(th, th === 0 ? 0 : 0).tex;
      e.mat = { emis: 0.3, tint: [0.85, 0.85, 0.95] };
      e.b.box(sd * rnd(30, 55), hh / 2, z, w, hh, w, [1, 1, 1], {
        uv: {
          px: [0.1, 0.05, 0.9, 0.95],
          nx: [0.1, 0.05, 0.9, 0.95],
          pz: [0.1, 0.05, 0.9, 0.95],
          nz: [0.1, 0.05, 0.9, 0.95],
        },
      });
    }
  if (THEMES[th].mount)
    for (const sd of [-1, 1]) {
      // snowy ranges of the Fergana valley
      const sb2 = chunkB(ch, "solid").b,
        mx = sd * rnd(190, 260),
        mz = zA + rnd(0, CH),
        H2 = rnd(70, 110),
        R2 = rnd(80, 120);
      sb2.lathe(
        mx,
        0,
        mz,
        [
          [R2, 0],
          [R2 * 0.72, H2 * 0.3],
        ],
        12,
        [0.32, 0.42, 0.28],
      );
      sb2.lathe(
        mx,
        0,
        mz,
        [
          [R2 * 0.72, H2 * 0.3],
          [R2 * 0.42, H2 * 0.62],
        ],
        12,
        [0.48, 0.44, 0.4],
        [0.42, 0.38, 0.36],
      );
      sb2.lathe(
        mx,
        0,
        mz,
        [
          [R2 * 0.42, H2 * 0.62],
          [2, H2],
        ],
        12,
        [0.96, 0.97, 1],
        [0.86, 0.9, 0.98],
      );
    }
  yield;
  // street furniture
  const sb = chunkB(ch, "solid").b,
    kit = qual < 2;
  for (let z = Math.ceil(zA / 20) * 20; z < zB; z += 20)
    for (const sd of [-1, 1]) {
      sb.cyl(sd * 5.9, 0, z, 0.09, 0.07, 5.2, 7, [0.16, 0.18, 0.24]);
      sb.box(sd * 5.1, 5.15, z, 1.8, 0.08, 0.08, [0.16, 0.18, 0.24]);
      const lb = chunkB(ch, "glow");
      lb.tex = null;
      lb.mat = { emis: 1 };
      lb.b.sph(sd * 4.25, 5.0, z, 0.26, 0.14, 0.26, 5, 8, [1, 0.9, 0.6]);
      if (kit && THEMES[th].mount && z % 20 === 0) {
        for (const dx of [-0.2, 0.2])
          sb.sph(
            sd * 7.6 + dx,
            6,
            z + 4,
            0.9,
            6.2,
            0.9,
            5,
            7,
            [0.2, 0.46, 0.24],
          );
        sb.cyl(sd * 7.6, 0, z + 4, 0.14, 0.12, 1.5, 6, [0.4, 0.3, 0.2]);
      }
      if (kit && z % 40 === 0) {
        sb.cyl(sd * 7.2, 0, z + 10, 0.22, 0.28, 1.6, 7, [0.38, 0.26, 0.16]);
        for (const [dx, dy, r, c] of [
          [0, 3.0, 1.7, [0.2, 0.45, 0.24]],
          [-0.9, 2.5, 1.2, [0.24, 0.52, 0.28]],
          [0.9, 2.6, 1.2, [0.18, 0.4, 0.22]],
          [0, 3.9, 1.2, [0.26, 0.55, 0.3]],
        ])
          sb.sph(sd * 7.2 + dx, dy + 0.9, z + 10, r, r * 0.85, r, 6, 8, c);
      }
      if (kit && Math.random() < 0.55) addParkedCar(ch, sd, z + rnd(4, 15));
    }
  for (const k of Object.keys(ch.b)) {
    const e = ch.b[k];
    if (e.b.i.length) ch.meshes.push({ m: e.b.mesh(), tex: e.tex, mat: e.mat });
  }
  ch.b = null;
  return ch;
}
function addMinaretMaybe(ch, sd, z, th) {
  if (th === 0) return;
  const sb = chunkB(ch, "mn").b,
    e = chunkB(ch, "mn");
  e.tex = minaretTex();
  e.mat = { emis: 0.25 };
  addMinaret(sb, chunkB(ch, "solid").b, sd * (BX + 10), z, rnd(18, 26), 1.5);
}
function addParkedCar(ch, sd, z) {
  const sb = chunkB(ch, "solid").b,
    c = pick([
      [0.92, 0.92, 0.94],
      [0.9, 0.9, 0.92],
      [0.12, 0.12, 0.15],
      [0.55, 0.56, 0.6],
      [0.2, 0.3, 0.55],
      [0.7, 0.12, 0.14],
    ]),
    x = sd * 4.3;
  sb.box(x, 0.55, z, 1.75, 0.6, 4.4, c);
  sb.box(x, 1.05, z - 0.1, 1.55, 0.5, 2.3, c, {
    cols: {
      px: [0.1, 0.14, 0.22],
      nx: [0.1, 0.14, 0.22],
      pz: [0.1, 0.14, 0.22],
      nz: [0.1, 0.14, 0.22],
    },
  });
  for (const dz of [-1.4, 1.4])
    for (const dx of [-0.85, 0.85])
      sb.box(x + dx, 0.28, z + dz, 0.2, 0.56, 0.56, [0.06, 0.06, 0.07]);
  const lg = chunkB(ch, "glow").b;
  lg.box(x - 0.55, 0.62, z - 2.21, 0.35, 0.14, 0.05, [1, 0.1, 0.1]);
  lg.box(x + 0.55, 0.62, z - 2.21, 0.35, 0.14, 0.05, [1, 0.1, 0.1]);
}
let PEND = null;
function ensureCity(pz, ms) {
  // builds the city incrementally: never more than ~ms milliseconds of work per call
  const t0 = performance.now(),
    c0 = Math.floor((pz - 70) / CH),
    c1 = Math.floor((pz + FAR) / CH);
  for (const [ci, ch] of CHUNKS)
    if (ci < c0 - 1) {
      ch.meshes.forEach((x) => freeMesh(x.m));
      CHUNKS.delete(ci);
    }
  const th = themeAt(pz + FAR * 0.6),
    nx = themeAt(pz + 520);
  for (const t of [th, nx]) {
    let miss = -1;
    for (let i = 0; i < DEFS[t].length; i++)
      if (!FT[t + ":" + i]) {
        miss = i;
        break;
      }
    if (miss >= 0 && !PEND) {
      facadeTex(t, miss);
      if (performance.now() - t0 > ms) return;
    }
  }
  for (;;) {
    if (!PEND) {
      let ci = c0;
      while (ci <= c1 && CHUNKS.has(ci)) ci++;
      if (ci > c1) break;
      if (CUR[0] < ci * CH - 5 || CUR[1] < ci * CH - 5) {
        CUR[0] = Math.max(CUR[0], ci * CH - 4);
        CUR[1] = Math.max(CUR[1], ci * CH - 4);
      }
      PEND = { ci, it: genChunk(ci) };
    }
    const r = PEND.it.next();
    if (r.done) {
      CHUNKS.set(PEND.ci, r.value);
      PEND = null;
    }
    if (performance.now() - t0 > ms) break;
  }
  const cur = themeAt(pz);
  for (let t = 0; t < THEMES.length; t++)
    if (t !== cur && t !== th && t !== nx && t !== themeAt(pz - 120))
      dropThemeTex(t);
}
function resetCity(z) {
  PEND = null;
  for (const ch of CHUNKS.values()) ch.meshes.forEach((x) => freeMesh(x.m));
  CHUNKS.clear();
  CUR[0] = CUR[1] = z - 40;
}
