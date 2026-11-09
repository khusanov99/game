/* view/street-life.js — Decoration only: pedestrians, Damas vans, bazaar stalls, pigeons. None of it can be hit. */
"use strict";
const TRAFFIC = { "-1": [], 1: [] }; // road stretches reserved for a driving Damas (no parked cars there)
const inTraffic = (sd, z) =>
  TRAFFIC[sd].some((s) => z > s[0] - 6 && z < s[1] + 3);
let SLM = null,
  slT = 0;
const PERSON = [
  { k: 1, cloth: [0.95, 0.95, 0.92], cap: [0.06, 0.06, 0.1], f: 0 }, // man, white shirt, black doppi
  { k: 1, cloth: [0.2, 0.36, 0.72], cap: [0.92, 0.92, 0.92], f: 0 }, // man, blue jacket, white doppi
  { k: 1, dress: [0.86, 0.14, 0.36], scarf: [1, 0.8, 0.2], f: 1 }, // woman, atlas dress
  { k: 1, dress: [0.1, 0.66, 0.5], scarf: [0.96, 0.96, 0.96], f: 1 },
  { k: 0.72, cloth: [0.96, 0.62, 0.16], cap: [0.1, 0.1, 0.16], f: 0 }, // boy
  { k: 1, cloth: [0.5, 0.34, 0.2], cap: [0.08, 0.08, 0.12], f: 0 }, // man, brown chapan
];
function slBuild() {
  const M = { ped: [], legs: {} };
  PERSON.forEach((v, i) => {
    const b = new B(),
      k = v.k,
      skin = [0.86, 0.66, 0.5];
    if (v.f) {
      b.cyl(0, 0.12 * k, 0, 0.3 * k, 0.17 * k, 0.98 * k, 10, v.dress, true);
      b.box(0, 1.2 * k, 0, 0.36 * k, 0.4 * k, 0.22 * k, v.dress);
      b.sph(0, 1.56 * k, 0, 0.15 * k, 0.16 * k, 0.15 * k, 6, 8, v.scarf);
      b.sph(0, 1.54 * k, -0.03 * k, 0.1 * k, 0.1 * k, 0.1 * k, 5, 6, skin);
    } else {
      b.box(0, 1.08 * k, 0, 0.42 * k, 0.6 * k, 0.24 * k, v.cloth);
      b.sph(0, 1.55 * k, 0, 0.13 * k, 0.14 * k, 0.13 * k, 6, 8, skin);
      b.cyl(0, 1.64 * k, 0, 0.135 * k, 0.1 * k, 0.09 * k, 8, v.cap, true);
    }
    for (const s of [-1, 1])
      b.box(
        s * 0.27 * k,
        1.04 * k,
        0,
        0.1 * k,
        0.5 * k,
        0.12 * k,
        v.f ? v.dress : v.cloth,
      );
    M.ped.push(b.mesh());
    if (!v.f && !M.legs[k]) {
      const l = new B();
      l.box(0, -0.36 * k, 0, 0.14 * k, 0.72 * k, 0.16 * k, [0.16, 0.18, 0.26]);
      l.box(
        0,
        -0.7 * k,
        0.04 * k,
        0.15 * k,
        0.07 * k,
        0.24 * k,
        [0.08, 0.07, 0.07],
      );
      M.legs[k] = l.mesh();
    }
  });
  /* Damas micro-van (seen from behind: the camera looks along +z) */
  {
    const b = new B(),
      W = [0.94, 0.95, 0.97],
      G = [0.1, 0.15, 0.24];
    b.box(0, 0.62, 0, 1.7, 0.62, 3.6, W);
    b.box(0, 1.14, -0.15, 1.58, 0.62, 3.0, W);
    for (const s of [-1, 1]) b.box(s * 0.8, 1.2, -0.1, 0.04, 0.34, 2.4, G);
    b.box(0, 1.2, -1.66, 1.2, 0.34, 0.04, G);
    b.box(0, 1.2, 1.36, 1.3, 0.4, 0.04, G);
    b.box(0, 0.36, -1.82, 1.72, 0.18, 0.12, [0.08, 0.08, 0.1]);
    b.box(0, 0.36, 1.82, 1.72, 0.22, 0.14, [0.08, 0.08, 0.1]); // black front bumper
    b.box(0, 0.52, -1.84, 0.5, 0.14, 0.03, [1, 1, 0.95]);
    for (const s of [-1, 1]) {
      b.box(s * 0.86, 0.9, 0.2, 0.03, 0.1, 2.4, [0.95, 0.5, 0.12]); // side stripe: orange over blue
      b.box(s * 0.86, 0.8, 0.2, 0.03, 0.08, 2.4, [0.12, 0.3, 0.62]);
    }
    for (const sz of [-1.2, 1.2])
      for (const sx of [-0.86, 0.86])
        b.box(sx, 0.3, sz, 0.22, 0.6, 0.6, [0.05, 0.05, 0.06]);
    M.dam = b.mesh();
    const g = new B();
    for (const s of [-0.6, 0.6]) {
      g.box(s, 0.78, -1.84, 0.3, 0.14, 0.05, [1, 0.12, 0.1]);
      g.box(s, 0.76, 1.84, 0.3, 0.14, 0.05, [1, 0.95, 0.7]);
      g.box(s * 1.28, 0.42, 1.85, 0.2, 0.1, 0.05, [1, 0.6, 0.1]); // amber corner lamps
    }
    M.damG = g.mesh();
    /* a white four-door sedan (generic low-poly): body, tapered glass cabin, bumpers, wheels, lamps */
    const s = new B(),
      sg = new B();
    s.box(0, 0.55, 0, 1.7, 0.55, 4.3, W);
    s.box(0, 0.88, 1.35, 1.64, 0.14, 1.3, W); // hood
    s.box(0, 0.9, -1.55, 1.64, 0.16, 1.0, W); // boot
    s.box(0, 1.2, -0.1, 1.52, 0.48, 1.9, W); // cabin shell
    for (const x of [-1, 1]) s.box(x * 0.77, 1.22, -0.1, 0.04, 0.36, 1.7, G);
    s.box(0, 1.26, 0.88, 1.4, 0.4, 0.04, G); // windscreen
    s.box(0, 1.26, -1.07, 1.4, 0.36, 0.04, G); // rear window
    s.box(0, 0.38, 2.18, 1.72, 0.2, 0.12, [0.1, 0.1, 0.12]);
    s.box(0, 0.38, -2.18, 1.72, 0.2, 0.12, [0.1, 0.1, 0.12]);
    for (const sz of [-1.4, 1.4])
      for (const sx of [-0.86, 0.86]) s.box(sx, 0.32, sz, 0.22, 0.64, 0.64, [0.05, 0.05, 0.06]);
    M.sed = s.mesh();
    for (const x of [-0.6, 0.6]) {
      sg.box(x, 0.66, 2.17, 0.34, 0.14, 0.05, [1, 0.95, 0.7]);
      sg.box(x * 1.3, 0.42, 2.19, 0.18, 0.08, 0.05, [1, 0.6, 0.1]); // amber lamps
      sg.box(x, 0.66, -2.17, 0.34, 0.12, 0.05, [1, 0.12, 0.1]);
    }
    M.sedG = sg.mesh();
  }
  /* pigeon: resting and flying */
  {
    const gr = [0.58, 0.6, 0.66],
      mk = (up) => {
        const b = new B();
        b.sph(0, 0.1, 0, 0.07, 0.07, 0.11, 5, 6, gr);
        b.sph(0, 0.17, 0.1, 0.045, 0.045, 0.045, 5, 6, [0.4, 0.42, 0.5]);
        b.box(0, 0.1, -0.12, 0.05, 0.02, 0.1, [0.45, 0.46, 0.52]);
        for (const s of [-1, 1]) {
          if (up)
            b.box(s * 0.14, 0.18, -0.02, 0.2, 0.02, 0.1, [0.7, 0.72, 0.78]);
          else
            b.box(s * 0.065, 0.11, -0.02, 0.025, 0.05, 0.14, [0.5, 0.52, 0.58]);
        }
        return b.mesh();
      };
    M.pg = mk(false);
    M.pgf = mk(true);
  }
  return M;
}
/* bazaar stall baked into a chunk's plain batch */
function addStall(ch, sd, z) {
  const sb = chunkB(ch, "solid").b,
    xc = sd * 7.7,
    xf = xc - sd * 0.9,
    pal = pick([
      [
        [0.1, 0.62, 0.7],
        [0.97, 0.97, 0.94],
      ],
      [
        [0.86, 0.2, 0.22],
        [0.97, 0.93, 0.8],
      ],
      [
        [0.12, 0.3, 0.7],
        [0.98, 0.78, 0.22],
      ],
      [
        [0.15, 0.6, 0.3],
        [0.97, 0.97, 0.94],
      ],
    ]),
    L = 2.8,
    wood = [0.5, 0.34, 0.2];
  for (const dz of [-1.3, 1.3]) {
    sb.cyl(xf, 0, z + dz, 0.05, 0.05, 2.4, 6, wood);
    sb.cyl(xc + sd * 0.9, 0, z + dz, 0.05, 0.05, 2.7, 6, wood);
  }
  sb.box(xf + sd * 0.3, 0.76, z, 0.9, 0.08, L - 0.2, [0.7, 0.52, 0.32]);
  sb.box(xf + sd * 0.3, 0.38, z, 0.8, 0.76, L - 0.3, [0.42, 0.3, 0.2]);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const za = z - L / 2 + (L * i) / n,
      zb = za + L / n,
      c = pal[i % 2];
    sb.quad(
      [
        [xf - sd * 0.15, 2.4, za],
        [xf - sd * 0.15, 2.4, zb],
        [xc + sd * 1.0, 2.75, zb],
        [xc + sd * 1.0, 2.75, za],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      c,
    );
    sb.box(xf - sd * 0.16, 2.26, (za + zb) / 2, 0.04, 0.26, L / n, c);
  }
  const fruit = [
    [[0.16, 0.5, 0.2], 0.17],
    [[0.94, 0.78, 0.22], 0.15],
    [[0.78, 0.1, 0.16], 0.1],
  ];
  for (let i = 0; i < 9; i++) {
    const [c, r] = fruit[i % 3],
      zz = z - 1.1 + (i % 5) * 0.52,
      xx = xf + sd * (0.12 + ((i * 7) % 3) * 0.28);
    sb.sph(xx, 0.8 + r, zz, r, r * 0.9, r, 5, 6, c);
  }
  for (let i = 0; i < 4; i++)
    sb.cyl(
      xf + sd * 0.55,
      0.8 + i * 0.05,
      z + 0.9,
      0.24,
      0.24,
      0.05,
      8,
      [0.86, 0.66, 0.36],
      true,
    ); // non breads
  for (const [dz, c] of [
    [-1.0, [0.2, 0.55, 0.22]],
    [-0.2, [0.16, 0.5, 0.2]],
  ])
    sb.sph(xf - sd * 0.45, 0.28, z + dz, 0.3, 0.27, 0.3, 6, 8, c); // watermelons on the ground
  /* vendor */
  const vx = xc + sd * 0.5,
    vc = pick([
      [0.95, 0.95, 0.9],
      [0.3, 0.5, 0.8],
      [0.8, 0.45, 0.2],
    ]);
  sb.box(vx, 1.08, z - 0.4, 0.44, 0.62, 0.26, vc);
  sb.box(vx - 0.1, 0.35, z - 0.4, 0.14, 0.7, 0.16, [0.16, 0.18, 0.26]);
  sb.box(vx + 0.1, 0.35, z - 0.4, 0.14, 0.7, 0.16, [0.16, 0.18, 0.26]);
  sb.sph(vx, 1.55, z - 0.4, 0.13, 0.14, 0.13, 6, 8, [0.86, 0.66, 0.5]);
  sb.cyl(vx, 1.64, z - 0.4, 0.135, 0.1, 0.09, 8, [0.06, 0.06, 0.1], true);
}
function slPopulate(ch, th) {
  ch.born = performance.now();
  ch.peds = [];
  ch.pig = [];
  const nP = qual >= 2 ? 1 : 2 + ((Math.random() * 2) | 0);
  for (const sd of [-1, 1])
    for (let i = 0; i < nP; i++)
      ch.peds.push({
        x: sd * rnd(6.1, 6.6),
        z: ch.zA + rnd(2, CH - 2),
        d: Math.random() < 0.5 ? 1 : -1,
        v: rnd(0.9, 1.5),
        t: (Math.random() * 6) | 0,
        ph: Math.random() * 6,
      });
  if (qual < 2)
    for (const sd of [-1, 1])
      if (Math.random() < 0.5)
        ch.pig.push({
          sd,
          x: sd * rnd(6.0, 7.0),
          z: ch.zA + rnd(6, CH - 6),
          fly: 0,
          n: Array.from({ length: 3 + ((Math.random() * 3) | 0) }, () => ({
            dx: rnd(-0.6, 0.6),
            dz: rnd(-0.7, 0.7),
            ph: Math.random() * 6,
          })),
        });
  if (qual < 3 && Math.random() < 0.7) {
    const sd = Math.random() < 0.5 ? -1 : 1,
      z0 = ch.zA + rnd(0, 10);
    ch.slot = {
      sd,
      z0,
      z1: z0 + 60,
      z: 0,
      on: false,
      done: false,
      sedan: Math.random() < 0.5,
      sp: rnd(3.6, 5),
      hue: pick([
        [1, 1, 1],
        [0.88, 0.94, 1],
        [1, 0.97, 0.88],
      ]),
    };
    TRAFFIC[sd].push([z0, z0 + 60]);
  }
}
function drawStreetLife() {
  if (!SLM) SLM = slBuild();
  const now = performance.now(),
    dt = Math.min(0.1, (now - (slT || now)) / 1000);
  slT = now;
  const maxD = qual >= 3 ? 55 : 95;
  let budget = qual >= 2 ? 6 : 10;
  for (const ch of CHUNKS.values()) {
    if (!ch.peds || ch.zB < pz - 12 || ch.zA > pz + maxD + 20) continue;
    const age = (now - ch.born) / 1000;
    for (const p of ch.peds) {
      const z = p.z + p.d * p.v * age,
        rz = z - pz;
      if (rz < -8 || rz > maxD || budget <= 0) continue;
      budget--;
      const V = PERSON[p.t],
        yaw = p.d > 0 ? 0 : Math.PI,
        sw = Math.sin(age * 5 * p.v + p.ph),
        bob = Math.abs(sw) * 0.035,
        base = joint(Tp(p.x, bob, z), 0, 0, 0, 0, yaw, 0);
      draw(SLM.ped[p.t], base, null, { emis: 0.14, rim: 0.2 });
      if (!V.f) {
        const lg = SLM.legs[V.k];
        draw(lg, joint(base, -0.1 * V.k, 0.72 * V.k, 0, sw * 0.6), null, {
          emis: 0.14,
        });
        draw(lg, joint(base, 0.1 * V.k, 0.72 * V.k, 0, -sw * 0.6), null, {
          emis: 0.14,
        });
      }
    }
    const sl = ch.slot;
    if (sl && !sl.done) {
      if (!sl.on && sl.z0 - pz < maxD + 60 && sl.z0 > pz - 30) {
        sl.on = true;
        sl.z = sl.z0 + 1;
      }
      if (sl.on) {
        sl.z += sl.sp * dt;
        if (sl.z > sl.z1 || sl.z < pz - 25) sl.done = true;
        else if (sl.z - pz < maxD + 20) {
          const M = Tp(sl.sd * 4.35, 0, sl.z);
          draw(sl.sedan ? SLM.sed : SLM.dam, M, null, {
            tint: sl.hue,
            spec: 0.7,
            rim: 0.3,
            emis: 0.12,
          });
          draw(sl.sedan ? SLM.sedG : SLM.damG, M, null, { emis: 1 });
        }
      }
    }
    if (qual < 2)
      for (const f of ch.pig) {
        const rz = f.z - pz;
        if (rz > maxD || rz < -20) continue;
        if (!f.fly && rz < 20) f.fly = now;
        const ft = f.fly ? (now - f.fly) / 1000 : 0;
        if (ft > 3) continue;
        for (const q of f.n) {
          if (!f.fly) {
            draw(
              SLM.pg,
              joint(
                Tp(f.x + q.dx, 0, f.z + q.dz),
                0,
                0,
                0,
                Math.max(0, Math.sin(now / 170 + q.ph)) * 0.4,
                q.ph,
              ),
              null,
              { emis: 0.14 },
            );
          } else {
            const y = 0.1 + Math.min(ft * 3.4, 7) + q.ph * 0.1,
              flap = Math.floor((now / 90 + q.ph * 3) % 2) ? SLM.pg : SLM.pgf;
            draw(
              flap,
              joint(
                Tp(f.x + q.dx + f.sd * ft * 2.2, y, f.z + q.dz + ft * 6),
                0,
                0,
                0,
                -0.35,
                0,
                f.sd * 0.2,
              ),
              null,
              { emis: 0.14 },
            );
          }
        }
      }
  }
}
