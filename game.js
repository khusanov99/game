/* =====================================================
   ZUMARY RUN — mobile-first build
   • responsive world (uniform scale, never stretched)
   • adaptive quality (auto-lowers effects on slow phones)
   • touch pad, swipe-duck, haptics, full screen
===================================================== */
const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  wrap = $("wrap"),
  shell = $("shell"),
  ctx = canvas.getContext("2d", {
    alpha: !/[?&]2d=1/.test(location.search),
    desynchronized: false, // a low-latency (desynchronized) overlay ignores alpha on Windows/Chrome and paints the 2D layer opaque black over the 3D canvas
  });

if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

/* ============ WORLD SIZE (responsive) ============ */
let W = 900,
  H = 350,
  groundY = 292,
  S = 1,
  UI = 1,
  DPR = 1;
let PS = 1.55,
  CPS = 1.5;
const COARSE = window.matchMedia("(pointer:coarse)").matches;

/* ============ QUALITY ============ */
const FX = {
  particles: true,
  blur: true,
  bloom: !COARSE,
  shake: 1,
  cam: true,
  light: true,
  shadow: true,
  env: true,
  coinGlow: true,
  charFx: true,
  bg: true,
  hints: true,
}; // filled by settings.js
let RS = 1,
  FLOOR = 0,
  SWIPE = 30,
  FPSCAP = 0; // render scale, quality floor, swipe distance, fps cap (0 = auto, -1 = device maximum)
const Q = { level: 0, shadow: !COARSE, flat: false, dpr: 2, maxP: 140 };

const INTRO = { on: false, t: 0, last: 0, spd: 1, pose: null }; // opening animation (see introStart)

/* =====================================================
   3D RENDERER — the whole world (city, road, obstacles, coins, chasers and the hero) is drawn as real 3D models
   by a tiny WebGL batcher that lives in this file. Gameplay, controls and hitboxes are untouched: the game still runs on its
   2D coordinates, and every object is simply placed in 3D at that position (1 world unit = 1 game pixel).
   One dynamic buffer, one draw call for the world, one for soft shadows. No textures, no model files.
   The 2D canvas on top only carries particles, weather, HUD and menus. ?2d=1 (or no WebGL) keeps the classic 2D renderer.
===================================================== */
const GL3 = (() => {
  const PI = Math.PI,
    TAU = PI * 2,
    API = { on: false };
  if (/[?&]2d=1/.test(location.search)) return API;
  let gl = null,
    cv3 = null,
    prog = null,
    U = null,
    vbuf = null,
    ibuf = null;
  const MAXV = 30000,
    VB = new Float32Array(MAXV * 10),
    IB = new Uint16Array(MAXV * 3);
  let nv = 0,
    ni = 0;
  /* ---- tiny matrix kit: column-major 4x4 from a recycled pool (no per-frame garbage) ---- */
  const MP = Array.from({ length: 1024 }, () => new Float32Array(16));
  let mp = 0;
  const nm = () => MP[mp++ & 1023];
  const IDM = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  function J(P, x, y, z, rx, ry, rz) {
    // P x T(x,y,z) x Rz x Ry x Rx
    const ca = Math.cos(rx || 0),
      sa = Math.sin(rx || 0),
      cb = Math.cos(ry || 0),
      sb = Math.sin(ry || 0),
      cg = Math.cos(rz || 0),
      sg = Math.sin(rz || 0);
    const r00 = cg * cb,
      r01 = cg * sb * sa - sg * ca,
      r02 = cg * sb * ca + sg * sa,
      r10 = sg * cb,
      r11 = sg * sb * sa + cg * ca,
      r12 = sg * sb * ca - cg * sa,
      r20 = -sb,
      r21 = cb * sa,
      r22 = cb * ca;
    const o = nm();
    const a0 = P[0],
      a1 = P[1],
      a2 = P[2],
      b0 = P[4],
      b1 = P[5],
      b2 = P[6],
      c0 = P[8],
      c1 = P[9],
      c2 = P[10];
    o[0] = a0 * r00 + b0 * r10 + c0 * r20;
    o[1] = a1 * r00 + b1 * r10 + c1 * r20;
    o[2] = a2 * r00 + b2 * r10 + c2 * r20;
    o[3] = 0;
    o[4] = a0 * r01 + b0 * r11 + c0 * r21;
    o[5] = a1 * r01 + b1 * r11 + c1 * r21;
    o[6] = a2 * r01 + b2 * r11 + c2 * r21;
    o[7] = 0;
    o[8] = a0 * r02 + b0 * r12 + c0 * r22;
    o[9] = a1 * r02 + b1 * r12 + c1 * r22;
    o[10] = a2 * r02 + b2 * r12 + c2 * r22;
    o[11] = 0;
    o[12] = a0 * x + b0 * y + c0 * z + P[12];
    o[13] = a1 * x + b1 * y + c1 * z + P[13];
    o[14] = a2 * x + b2 * y + c2 * z + P[14];
    o[15] = 1;
    return o;
  }
  const T = (x, y, z) => J(IDM, x, y, z, 0, 0, 0);
  const SC = (P, k) => {
    // uniform scale
    const o = nm();
    for (let i = 0; i < 12; i++) o[i] = P[i] * k;
    o[12] = P[12];
    o[13] = P[13];
    o[14] = P[14];
    o[15] = 1;
    return o;
  };
  function persp(fy, asp, n, f) {
    const t = 1 / Math.tan(fy / 2),
      o = new Float32Array(16);
    o[0] = t / asp;
    o[5] = t;
    o[10] = (f + n) / (n - f);
    o[11] = -1;
    o[14] = (2 * f * n) / (n - f);
    return o;
  }
  function lookAt(e, c) {
    // camera looks along +z (up = +y)
    let fx = c[0] - e[0],
      fy = c[1] - e[1],
      fz = c[2] - e[2];
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;
    let sx = fz,
      sz = -fx; // s = f x up(0,1,0)  -> (fz, 0, -fx)
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl;
    sz /= sl;
    const ux = sz * fy,
      uy = fz * sx - fx * sz,
      uz = -sx * fy;
    const o = new Float32Array(16);
    o[0] = sx;
    o[4] = 0;
    o[8] = sz;
    o[1] = ux;
    o[5] = uy;
    o[9] = uz;
    o[2] = -fx;
    o[6] = -fy;
    o[10] = -fz;
    o[12] = -(sx * e[0] + sz * e[2]);
    o[13] = -(ux * e[0] + uy * e[1] + uz * e[2]);
    o[14] = fx * e[0] + fy * e[1] + fz * e[2];
    o[15] = 1;
    return o;
  }
  function mulVP(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  }
  /* ---- primitives (unit size): box, sphere, cylinder (hangs down from y=0), cone (base at y=0, apex y=1) ---- */
  const prim = (v, i) => ({
    v: new Float32Array(v),
    i: new Uint16Array(i),
    n: v.length / 6,
  });
  const BOX = (() => {
    const v = [],
      i = [];
    const F = [
      [0, 0, 1, [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [0, 0, -1, [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
      [1, 0, 0, [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
      [-1, 0, 0, [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [0, 1, 0, [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
      [0, -1, 0, [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    ];
    F.forEach((f, k) => {
      for (let j = 3; j < 7; j++)
        v.push(f[j][0] * 0.5, f[j][1] * 0.5, f[j][2] * 0.5, f[0], f[1], f[2]);
      i.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    return prim(v, i);
  })();
  const SPH = (la, lo) => {
    const v = [],
      i = [];
    for (let a = 0; a <= la; a++)
      for (let b = 0; b <= lo; b++) {
        const th = (a / la) * PI,
          ph = (b / lo) * TAU,
          x = Math.sin(th) * Math.cos(ph),
          y = Math.cos(th),
          z = Math.sin(th) * Math.sin(ph);
        v.push(x, y, z, x, y, z);
      }
    for (let a = 0; a < la; a++)
      for (let b = 0; b < lo; b++) {
        const p = a * (lo + 1) + b;
        i.push(p, p + 1, p + lo + 1, p + 1, p + lo + 2, p + lo + 1);
      }
    return prim(v, i);
  };
  const CYL = (seg, r1) => {
    // r1 = bottom radius scale (cone when 0): side + top cap, y from 0 (top) to -1
    const v = [],
      i = [];
    for (let b = 0; b <= seg; b++) {
      const ph = (b / seg) * TAU,
        c = Math.cos(ph),
        s = Math.sin(ph);
      v.push(c, 0, s, c, 0, s, c * r1, -1, s * r1, c, 0, s);
    }
    for (let b = 0; b < seg; b++) {
      const p = b * 2;
      i.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
    const t0 = v.length / 6;
    v.push(0, 0, 0, 0, 1, 0);
    for (let b = 0; b <= seg; b++)
      v.push(Math.cos((b / seg) * TAU), 0, Math.sin((b / seg) * TAU), 0, 1, 0);
    for (let b = 0; b < seg; b++) i.push(t0, t0 + 2 + b, t0 + 1 + b);
    const b0 = v.length / 6;
    v.push(0, -1, 0, 0, -1, 0);
    for (let b = 0; b <= seg; b++)
      v.push(
        Math.cos((b / seg) * TAU) * r1,
        -1,
        Math.sin((b / seg) * TAU) * r1,
        0,
        -1,
        0,
      );
    for (let b = 0; b < seg; b++) i.push(b0, b0 + 1 + b, b0 + 2 + b);
    return prim(v, i);
  };
  const CONE = (() => {
    const p = CYL(12, 0);
    // flip: apex up, base at y=0  (cylinder runs 0 -> -1 with r1 at the bottom)
    for (let k = 0; k < p.v.length; k += 6) {
      p.v[k + 1] = -p.v[k + 1];
      p.v[k + 4] = -p.v[k + 4];
    }
    for (let k = 0; k < p.i.length; k += 3) {
      const t = p.i[k + 1];
      p.i[k + 1] = p.i[k + 2];
      p.i[k + 2] = t;
    }
    return p;
  })();
  const SPH1 = SPH(8, 12),
    SPH0 = SPH(5, 8),
    CYL1 = CYL(14, 1),
    CYL0 = CYL(8, 1);
  const SPHR = (() => {
    const p = SPH(8, 16);
    p.par = new Uint8Array(p.n).map((_, k) => (k % 17) & 1);
    return p;
  })();
  const TAPER = CYL(14, 1.35);
  let LOD = 1,
    EK = 1,
    DET = 1;
  const col = {};
  const C = (h) =>
    col[h] ||
    (col[h] = [
      parseInt(h.slice(1, 3), 16) / 255,
      parseInt(h.slice(3, 5), 16) / 255,
      parseInt(h.slice(5, 7), 16) / 255,
    ]);
  const mixc = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  /* put one primitive instance, transformed on the CPU: M * (S*v + (0,dy,0)); c = [r,g,b]; e = emissive 0..1 */
  function put(p, M, sx, sy, sz, dy, c, e, c2) {
    if (nv + p.n > MAXV || ni + p.i.length > MAXV * 3) return;
    if (e < 0.95) e *= EK;
    const m0 = M[0],
      m1 = M[1],
      m2 = M[2],
      m4 = M[4],
      m5 = M[5],
      m6 = M[6],
      m8 = M[8],
      m9 = M[9],
      m10 = M[10],
      tx = M[12],
      ty = M[13],
      tz = M[14];
    const v = p.v;
    let o = nv * 10;
    const r = c[0],
      g = c[1],
      b = c[2];
    for (let k = 0; k < v.length; k += 6) {
      const lx = v[k] * sx,
        ly = v[k + 1] * sy + dy,
        lz = v[k + 2] * sz;
      VB[o] = m0 * lx + m4 * ly + m8 * lz + tx;
      VB[o + 1] = m1 * lx + m5 * ly + m9 * lz + ty;
      VB[o + 2] = m2 * lx + m6 * ly + m10 * lz + tz;
      const nx = v[k + 3] / sx,
        ny = v[k + 4] / sy,
        nz = v[k + 5] / sz;
      let wx = m0 * nx + m4 * ny + m8 * nz,
        wy = m1 * nx + m5 * ny + m9 * nz,
        wz = m2 * nx + m6 * ny + m10 * nz;
      const il = 1 / (Math.hypot(wx, wy, wz) || 1);
      VB[o + 3] = wx * il;
      VB[o + 4] = wy * il;
      VB[o + 5] = wz * il;
      const cc = c2 && p.par && p.par[k / 6] ? c2 : c;
      VB[o + 6] = cc[0];
      VB[o + 7] = cc[1];
      VB[o + 8] = cc[2];
      VB[o + 9] = e;
      o += 10;
    }
    const ix = p.i;
    for (let k = 0; k < ix.length; k++) IB[ni + k] = ix[k] + nv;
    nv += p.n;
    ni += ix.length;
  }
  const box = (M, w, h, d, dy, c, e) =>
    put(BOX, M, w, h, d, dy || 0, c, e || 0);
  const sph = (M, rx, ry, rz, c, e) =>
    put(LOD ? SPH1 : SPH0, M, rx, ry || rx, rz || rx, 0, c, e || 0);
  const cyl = (M, r, h, c, e, rb) =>
    put(LOD ? CYL1 : CYL0, M, r, h, r, 0, c, e || 0);
  const cone = (M, r, h, c, e) => put(CONE, M, r, h, r, 0, c, e || 0);
  /* ---- static piece cache: every landmark / building is built ONCE into its own GPU buffer and then only drawn with a
     position offset, so the per-frame CPU cost does not depend on how detailed the city is (this is what keeps phones smooth) ---- */
  const SBUF = new Map(),
    SQ = [];
  let built = 0,
    lastDET = -1;
  function piece(key, fn, x, z) {
    key += ":" + DET;
    let b = SBUF.get(key);
    if (!b) {
      if (built >= 2) return; // spread the one-time builds over frames (pieces are built well before they scroll into view)
      built++;
      const nv0 = nv,
        ni0 = ni,
        l = LOD;
      LOD = DET;
      EK = 0.3;
      try {
        fn(0, z);
      } finally {
        LOD = l;
        EK = 1;
      }
      b = { n: ni - ni0, vb: null, ib: null };
      if (b.n) {
        b.vb = gl.createBuffer();
        b.ib = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          VB.slice(nv0 * 10, nv * 10),
          gl.STATIC_DRAW,
        );
        const ix = IB.slice(ni0, ni);
        for (let k = 0; k < ix.length; k++) ix[k] -= nv0;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
      }
      nv = nv0;
      ni = ni0;
      SBUF.set(key, b);
    }
    if (b.n) SQ.push(b, x);
  }
  function dropPieces() {
    for (const b of SBUF.values()) {
      if (b.vb) gl.deleteBuffer(b.vb);
      if (b.ib) gl.deleteBuffer(b.ib);
    }
    SBUF.clear();
  }
  /* a flat quad in NDC (sky, stars) */
  /* ---- city looks (time of day / mood): set in Settings or on the start screen, saved in CFG.look ---- */
  const LOOKS = {
    day: {
      m: 0,
      top: [0.2, 0.46, 0.88],
      bot: [0.76, 0.88, 0.97],
      sun: [0.32, 0.72, -0.62],
      sunC: [0.82, 0.76, 0.62],
      amb: [0.56, 0.6, 0.7],
      body: [1, 0.96, 0.78],
      by: 0.3,
      st: 0,
      win: 0,
      winC: [1, 0.82, 0.45],
    },
    sunset: {
      m: 1,
      top: [0.3, 0.2, 0.52],
      bot: [1, 0.55, 0.28],
      sun: [0.8, 0.3, -0.5],
      sunC: [1, 0.6, 0.36],
      amb: [0.5, 0.4, 0.5],
      body: [1, 0.78, 0.45],
      by: 0.8,
      st: 0,
      win: 0.4,
      winC: [1, 0.8, 0.45],
    },
    dawn: {
      m: 1,
      top: [0.38, 0.42, 0.78],
      bot: [1, 0.76, 0.8],
      sun: [-0.6, 0.35, -0.6],
      sunC: [1, 0.84, 0.78],
      amb: [0.55, 0.52, 0.66],
      body: [1, 0.9, 0.78],
      by: 0.72,
      st: 0.1,
      win: 0.2,
      winC: [1, 0.85, 0.55],
    },
    night: {
      m: 1,
      top: [0.015, 0.03, 0.14],
      bot: [0.12, 0.17, 0.4],
      sun: [-0.3, 0.7, -0.6],
      sunC: [0.22, 0.28, 0.55],
      amb: [0.2, 0.24, 0.42],
      body: [0.88, 0.92, 1],
      by: 0.22,
      st: 0.95,
      win: 1,
      winC: [1, 0.82, 0.42],
    },
    neon: {
      m: 1,
      top: [0.07, 0.02, 0.22],
      bot: [0.8, 0.1, 0.55],
      sun: [0.4, 0.5, -0.6],
      sunC: [0.55, 0.3, 0.95],
      amb: [0.3, 0.22, 0.52],
      body: [1, 0.5, 0.85],
      by: 0.3,
      st: 0.8,
      win: 1,
      winC: [0.3, 0.95, 1],
    },
  };
  const LOOK_SEQ = ["day", "sunset", "night", "dawn"];
  let LSTATE = null;
  function lookKey() {
    const k = (typeof CFG !== "undefined" && CFG.look) || "day";
    return k === "auto"
      ? LOOK_SEQ[Math.floor(performance.now() / 45000) % 4]
      : k;
  }
  function lookStep() {
    const T = LOOKS[lookKey()] || LOOKS.day;
    if (!LSTATE) LSTATE = JSON.parse(JSON.stringify(T));
    else
      for (const k in T) {
        if (Array.isArray(T[k]))
          for (let i = 0; i < T[k].length; i++)
            LSTATE[k][i] += (T[k][i] - LSTATE[k][i]) * 0.06;
        else LSTATE[k] += (T[k] - LSTATE[k]) * 0.06;
      }
    return LSTATE;
  }
  function ndcQuad(x0, y0, x1, y1, ca, cb, e) {
    if (nv + 4 > MAXV) return;
    const q = [
      [x0, y1, ca],
      [x1, y1, ca],
      [x1, y0, cb],
      [x0, y0, cb],
    ];
    for (const [x, y, c] of q) {
      const o = nv * 10;
      VB[o] = x;
      VB[o + 1] = y;
      VB[o + 2] = 0;
      VB[o + 3] = 0;
      VB[o + 4] = 0;
      VB[o + 5] = -1;
      VB[o + 6] = c[0];
      VB[o + 7] = c[1];
      VB[o + 8] = c[2];
      VB[o + 9] = e;
      nv++;
    }
    IB[ni++] = nv - 4;
    IB[ni++] = nv - 3;
    IB[ni++] = nv - 2;
    IB[ni++] = nv - 4;
    IB[ni++] = nv - 2;
    IB[ni++] = nv - 1;
  }
  function ndcDisc(cx, cy, rx, ry, c, e) {
    if (nv + 22 > MAXV) return;
    const b0 = nv;
    for (let k = 0; k <= 20; k++) {
      const a = (k / 20) * TAU,
        o = nv * 10;
      VB[o] = cx + (k ? Math.cos(a) * rx : 0);
      VB[o + 1] = cy + (k ? Math.sin(a) * ry : 0);
      VB[o + 2] = 0;
      VB[o + 3] = 0;
      VB[o + 4] = 0;
      VB[o + 5] = -1;
      VB[o + 6] = c[0];
      VB[o + 7] = c[1];
      VB[o + 8] = c[2];
      VB[o + 9] = e;
      nv++;
    }
    for (let k = 1; k <= 19; k++) {
      IB[ni++] = b0;
      IB[ni++] = b0 + k;
      IB[ni++] = b0 + k + 1;
    }
    IB[ni++] = b0;
    IB[ni++] = b0 + 20;
    IB[ni++] = b0 + 1;
  }
  const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;uniform mat4 uVP;uniform vec3 uOff;uniform float uNDC;varying vec3 vN;varying vec4 vC;varying float vD;varying float vY;
void main(){vN=aN;vC=aC;vY=aP.y;vec4 p=uVP*vec4(aP+uOff,1.0);vD=p.w;gl_Position=uNDC>0.5?vec4(aP.xy,0.999,1.0):p;}`;
  const FS = `precision mediump float;varying vec3 vN;varying vec4 vC;varying float vD;varying float vY;uniform vec3 uSun;uniform vec3 uSunC;uniform vec3 uAmb;uniform vec3 uFog;uniform vec2 uFogR;uniform float uAlpha;uniform float uWin;uniform vec3 uWinC;
void main(){vec3 n=normalize(vN);float d=max(dot(n,uSun),0.0);
vec3 lit=vC.rgb*(uAmb+uSunC*d);
float r=1.0-clamp(-n.z,0.0,1.0);float rim=r*r*r*0.2*step(0.0,n.y+0.6);
float s1=max(dot(n,vec3(0.2,0.55,-0.81)),0.0);s1*=s1;float s2=s1*s1;float s3=s2*s2;float sp=s3*s2*s1*0.32;
vec3 c=mix(lit+vec3(rim*0.9,rim*0.95,rim)+vec3(sp),vC.rgb,vC.a);
c*=0.84+0.16*clamp(vY*0.0166,0.0,1.0);
float wn=step(0.9,vC.a)*step(vC.r+vC.g+vC.b,0.75);c=mix(c,uWinC,wn*uWin);
float f=clamp((vD-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);gl_FragColor=vec4(mix(c,uFog,f*0.6),uAlpha);}`;
  function sh(t, s) {
    const o = gl.createShader(t);
    gl.shaderSource(o, s);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(o));
    return o;
  }
  function init() {
    try {
      cv3 = document.createElement("canvas");
      cv3.setAttribute("aria-hidden", "true");
      cv3.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
      gl = cv3.getContext("webgl", {
        antialias: !COARSE,
        alpha: false,
        depth: true,
        powerPreference: COARSE ? "default" : "high-performance",
        preserveDrawingBuffer: false,
      });
      if (!gl) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, "aP");
      gl.bindAttribLocation(prog, 1, "aN");
      gl.bindAttribLocation(prog, 2, "aC");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(prog));
      U = {};
      for (const n of [
        "uVP",
        "uOff",
        "uNDC",
        "uSun",
        "uSunC",
        "uAmb",
        "uFog",
        "uFogR",
        "uAlpha",
        "uWin",
        "uWinC",
      ])
        U[n] = gl.getUniformLocation(prog, n);
      vbuf = gl.createBuffer();
      ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, VB.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IB.byteLength, gl.DYNAMIC_DRAW);
      cv3.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        API.on = false; // the classic 2D renderer takes over at once (no black frame)
        cv3.style.visibility = "hidden";
        setTimeout(() => typeof resize === "function" && resize(), 0);
      });
      cv3.addEventListener("webglcontextrestored", () => {
        try {
          SBUF.clear();
          const old = cv3;
          if (old.parentNode) old.parentNode.removeChild(old);
          if (init() && !API.dead) {
            API.size(API.gw, API.gh);
            API.on = true;
            setTimeout(() => typeof resize === "function" && resize(), 0);
          }
        } catch (e) {
          API.on = false;
        }
      });
      canvas.parentNode.insertBefore(cv3, canvas);
      return true;
    } catch (e) {
      if (cv3 && cv3.parentNode) cv3.parentNode.removeChild(cv3);
      return false;
    }
  }
  API.size = (w, h) => {
    API.gw = w;
    API.gh = h;
    if (cv3 && (cv3.width !== w || cv3.height !== h)) {
      cv3.width = w;
      cv3.height = h;
    }
  };
  /* ================= MODELS ================= */
  const K = {
    white: [0.96, 0.98, 1],
    whiteD: [0.74, 0.8, 0.93],
    dark: [0.05, 0.06, 0.1],
    face: [0.02, 0.03, 0.07],
    beak: [1, 0.58, 0.08],
    beakD: [0.92, 0.4, 0.05],
    cyan: [0.3, 0.95, 1],
    cheek: [1, 0.45, 0.65],
    red: [0.92, 0.1, 0.16],
    flame: [1, 0.65, 0.2],
    gold: [1, 0.8, 0.28],
    grey: [0.7, 0.74, 0.84],
  };
  const ACC = {
    default: [0.14, 0.4, 1],
    rose: [1, 0.3, 0.62],
    mint: [0.08, 0.72, 0.5],
    gold: [1, 0.6, 0.08],
  };
  /* hero "ZUMA": white duck-bot with a black visor + cyan LED eyes, headphone discs, crest, orange bill, blue armour, cape, sneakers.
     Built in ~1.55-unit model space, drawn through a scaled root matrix. st = {ph, air, slide, hit, boost, land, t, fly} */
  function drawHero(root, st) {
    const A = ACC[skin] || ACC.default,
      AD = mulc(A, 0.7),
      t = st.t,
      ph = st.ph,
      sw = Math.sin(ph),
      cw = Math.cos(ph),
      air = st.air;
    let R = root;
    if (st.slide) R = J(R, 0, 0.3, 0, 1.15);
    else if (st.hit) R = J(R, 0, 0, 0, -0.25);
    else
      R = J(
        R,
        0,
        air ? 0 : Math.abs(sw) * 0.04,
        0,
        air ? 0.1 : 0.14,
        0,
        air ? 0 : sw * 0.08,
      );
    const hip = J(R, 0, 0.3 - st.land * 0.1, 0);
    for (const s of [-1, 1]) {
      const sg = s > 0 ? sw : -sw,
        cg = s > 0 ? cw : -cw;
      let h1, k1;
      if (st.slide) {
        h1 = 0.4;
        k1 = 0.2;
      } else if (air) {
        h1 = s > 0 ? -0.7 : 0.2;
        k1 = s > 0 ? 1.1 : 0.8;
      } else if (st.hit) {
        h1 = s * 0.3;
        k1 = 0.3;
      } else {
        h1 = -sg * 0.85;
        k1 = 0.15 + 0.85 * Math.max(0, cg) + st.land * 0.4;
      }
      const th = J(hip, s * 0.13, 0, 0, h1);
      cyl(th, 0.065, 0.16, K.white, 0.6);
      const kn = J(th, 0, -0.16, 0, k1);
      sph(kn, 0.065, 0.065, 0.065, K.dark, 0.2);
      cyl(kn, 0.058, 0.12, K.white, 0.6);
      const ft = J(kn, 0, -0.12, 0, -(h1 + k1) * 0.5 + (air ? 0.3 : 0));
      box(J(ft, 0, -0.02, 0.07, 0), 0.2, 0.1, 0.28, 0, A, 0.8);
      box(J(ft, 0, -0.09, 0.07, 0), 0.22, 0.035, 0.31, 0, K.white, 0.6);
    }
    const tor = J(hip, 0, 0.24, 0, 0, 0, st.slide ? 0 : -sw * 0.05);
    sph(tor, 0.3, 0.3, 0.29, K.white, 0.62);
    box(J(tor, 0, 0.0, 0.25, -0.08), 0.32, 0.24, 0.05, 0, A, 0.8);
    box(J(tor, 0, 0.14, 0.26, -0.08), 0.32, 0.03, 0.055, 0, K.white, 0.9);
    const crn = J(tor, 0, -0.01, 0.29, -0.08);
    box(crn, 0.18, 0.04, 0.02, 0, K.cyan, 1);
    for (let i = -1; i <= 1; i++)
      cone(J(crn, i * 0.06, 0.02, 0), 0.03, 0.09, K.cyan, 1);
    if (st.boost)
      for (const sx of [-0.08, 0.08])
        cone(
          J(tor, sx, -0.12, -0.27, PI),
          0.06,
          0.34 + Math.random() * 0.16,
          K.flame,
          1,
        );
    let cj = J(tor, 0, 0.2, -0.22, 0);
    const fl = 0.35 + st.sp * 0.8;
    for (let i = 0; i < 3; i++) {
      const w = Math.sin(t * 9 - i * 0.95) * 0.1 * fl;
      cj = J(
        cj,
        0,
        i ? -0.15 : -0.02,
        0,
        0.1 + fl * 0.24 + (air ? 0.2 : 0) + w,
      );
      box(cj, 0.38 - i * 0.05, 0.16, 0.025, -0.075, i % 2 ? AD : A, 0.8);
    }
    const hd = J(tor, 0, 0.46, 0.02, st.hit ? 0.25 : st.slide ? -1.0 : 0.04);
    sph(hd, 0.38, 0.34, 0.36, K.white, 0.62);
    sph(J(hd, 0, 0, 0.2), 0.31, 0.26, 0.19, K.face, 0.1);
    box(J(hd, 0, 0.2, 0.3, -0.35), 0.36, 0.028, 0.03, 0, A, 0.9);
    const mood = st.hit ? 2 : t % 3.3 < 0.12 ? 1 : 0;
    for (const s of [-1, 1]) {
      const ex = J(hd, s * 0.11, 0.03, 0.355, 0);
      if (mood === 0) {
        box(J(ex, -0.032, 0, 0, 0, 0, 0.62), 0.075, 0.03, 0.02, 0, K.cyan, 1);
        box(J(ex, 0.032, 0, 0, 0, 0, -0.62), 0.075, 0.03, 0.02, 0, K.cyan, 1);
      } else if (mood === 1) box(ex, 0.11, 0.022, 0.02, 0, K.cyan, 1);
      else {
        box(J(ex, 0, 0, 0, 0, 0, 0.8), 0.12, 0.028, 0.02, 0, K.cyan, 1);
        box(J(ex, 0, 0, 0, 0, 0, -0.8), 0.12, 0.028, 0.02, 0, K.cyan, 1);
      }
      const ear = J(hd, s * 0.385, -0.01, 0, 0, 0, (PI / 2) * s);
      cyl(ear, 0.15, 0.07, K.white, 0.6);
      cyl(J(ear, 0, 0.02, 0), 0.105, 0.1, K.cyan, 1);
      cyl(J(ear, 0, 0.03, 0), 0.06, 0.12, K.dark, 0.2);
    }
    const mo = st.hit ? 0.55 : st.air ? 0.2 : 0;
    sph(J(hd, 0, -0.13, 0.4), 0.15, 0.057, 0.17, K.beak, 0.62);
    sph(J(hd, 0, -0.18, 0.38, mo), 0.11, 0.03, 0.1, K.beakD, 0.5);
    box(
      J(hd, 0.04, 0.32, 0.06, -0.5, 0, 0.25),
      0.1,
      0.3,
      0.03,
      0.15,
      K.white,
      0.6,
    );
    box(
      J(hd, -0.04, 0.32, 0.06, -0.75, 0, -0.25),
      0.1,
      0.24,
      0.03,
      0.12,
      K.white,
      0.6,
    );
    for (const s of [-1, 1]) {
      const a = st.slide
          ? 1.2
          : st.hit
            ? -2.6 + s * 0.3
            : air
              ? -2.0 + s * 0.2
              : (s > 0 ? sw : -sw) * 0.85,
        sho = J(
          tor,
          s * 0.3,
          0.12,
          0,
          a,
          0,
          s * (st.hit ? 0.9 : air ? 0.7 : 0.16),
        );
      sph(sho, 0.07, 0.07, 0.07, K.dark, 0.2);
      cyl(sho, 0.06, 0.16, K.white, 0.6);
      const el = J(
        sho,
        0,
        -0.16,
        0,
        air ? -0.5 : -0.9 - (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.4,
      );
      cyl(el, 0.052, 0.13, K.white, 0.6);
      cyl(J(el, 0, -0.1, 0), 0.06, 0.035, A, 0.8);
      sph(J(el, 0, -0.17, 0), 0.088, 0.088, 0.088, K.white, 0.6);
    }
  }
  /* chasers: wheeled box-bot (the guard) and ball-bot (the dog): white shells, black screens with angry red LED eyes */
  const angry = (sc, w, y, z, t) => {
    const bl = t % 2.7 < 0.1 ? 0.35 : 1;
    for (const s of [-1, 1]) {
      const e = J(sc, s * w, y, z, 0);
      box(J(e, 0, 0, 0, 0, 0, -s * 0.38), w, 0.05 * bl, 0.02, 0, K.red, 1);
      sph(J(e, 0, -0.05, 0), w * 0.28, w * 0.28, w * 0.1, K.red, 1);
    }
  };
  function drawBoxBot(root, ph, t, lean) {
    const R = J(
        root,
        0,
        Math.abs(Math.sin(ph * 2)) * 0.015,
        0,
        0.04,
        0,
        lean || 0,
      ),
      body = J(R, 0, 0.36, 0);
    box(body, 0.8, 0.5, 0.62, 0, K.white, 0.6);
    box(body, 0.84, 0.08, 0.66, -0.2, K.grey, 0.5);
    box(body, 0.84, 0.06, 0.66, 0.2, K.red, 0.7);
    const hd = J(body, 0, 0.52, 0.02);
    box(hd, 0.7, 0.46, 0.56, 0, K.white, 0.6);
    box(J(hd, 0, 0, 0.3), 0.56, 0.34, 0.05, 0, K.face, 0.1);
    angry(J(hd, 0, 0, 0.33), 0.12, 0.02, 0, t);
    box(J(hd, -0.4, 0, 0), 0.1, 0.1, 0.5, 0, K.red, 0.7);
    box(J(hd, 0.4, 0, 0), 0.1, 0.1, 0.5, 0, K.red, 0.7);
    cyl(J(hd, 0.18, 0.55, -0.1, 0.1), 0.015, 0.3, K.dark, 0.2);
    sph(
      J(hd, 0.18, 0.56, -0.1),
      0.06,
      0.06,
      0.06,
      Math.floor(t * 6) % 2 ? [1, 0.15, 0.2] : K.red,
      1,
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const w = J(body, sx * 0.44, -0.22, sz * 0.2, ph * 2),
          a = J(w, 0, 0, 0, 0, 0, (PI / 2) * sx);
        cyl(J(a, 0, 0.08, 0), 0.17, 0.16, K.dark, 0.2);
        cyl(J(a, 0, 0.09, 0), 0.09, 0.18, K.red, 0.9);
      }
  }
  function drawBallBot(root, ph, t, snarl) {
    const bob = 0.62 + Math.abs(Math.sin(ph * 2)) * 0.03,
      up = J(root, 0, bob, 0, 0.05, 0, Math.sin(ph) * 0.04);
    sph(up, 0.55, 0.52, 0.55, K.white, 0.6);
    sph(J(root, 0, bob, 0, ph * 2.2), 0.575, 0.12, 0.575, K.grey, 0.5);
    box(J(up, 0, 0.05, 0.5), 0.46, 0.22, 0.04, 0, K.face, 0.1);
    angry(J(up, 0, 0.05, 0.54), 0.1, 0, 0, snarl ? t * 2 : t);
    for (const s of [-1, 1]) {
      const e = J(up, s * 0.55, 0, 0, 0, 0, (PI / 2) * s);
      cyl(e, 0.17, 0.1, K.red, 0.8);
      cyl(J(e, 0, 0.02, 0), 0.1, 0.12, K.dark, 0.2);
    }
    cyl(J(up, 0, 0.55, 0), 0.15, 0.08, K.red, 0.8);
    sph(
      J(up, 0, 0.62, 0),
      0.11,
      0.11,
      0.11,
      Math.floor(t * 7) % 2 ? [1, 0.15, 0.2] : [0.15, 0.3, 1],
      1,
    );
  }
  /* ================= WORLD ================= */
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (i, s) => {
    const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let curCity = null,
    prevCity = null,
    sFar = 0,
    sMid = 0,
    sGnd = 0,
    lastF = 0,
    lastM = 0,
    lastG = 0,
    ready = false;
  const dWrap = (a, b, p) => {
    let d = a - b;
    if (d < -p / 2) d += p;
    else if (d > p / 2) d -= p;
    return d;
  };
  const mod = (a, p) => ((a % p) + p) % p;
  /* ================= THE FOUR CITIES (at night) =================
     Tashkent → Samarkand → Bukhara → Khiva → Tashkent. Each city is a strip of authored landmark models (mid layer),
     a low street layer in front and a skyline behind. Floodlit stone is simulated with warm emissive colours. */
  const PAL = {
    sand: [0.9, 0.72, 0.46],
    sandD: [0.7, 0.52, 0.32],
    brick: [0.78, 0.52, 0.3],
    brickD: [0.58, 0.36, 0.2],
    turq: [0.08, 0.74, 0.86],
    blue: [0.1, 0.36, 0.9],
    navy: [0.06, 0.16, 0.5],
    gold: [1, 0.78, 0.3],
    white: [0.93, 0.93, 0.9],
    mud: [0.74, 0.55, 0.34],
    warm: [0.13, 0.19, 0.3], // dark window glass / openings (daylight)
    glass: [0.3, 0.55, 0.9],
    dark: [0.04, 0.05, 0.09],
    green: [0.1, 0.4, 0.2],
    red: [0.8, 0.14, 0.12],
  };
  const TASH_PASTEL = [
    [0.9, 0.84, 0.7],
    [0.82, 0.86, 0.9],
    [0.92, 0.88, 0.8],
  ];
  const DAY_SKY = {
    tash: { top: [0.2, 0.46, 0.88], bot: [0.76, 0.88, 0.97] },
    sam: { top: [0.16, 0.44, 0.9], bot: [0.88, 0.9, 0.93] },
    bux: { top: [0.24, 0.48, 0.86], bot: [0.95, 0.89, 0.76] },
    khi: { top: [0.3, 0.52, 0.86], bot: [0.97, 0.9, 0.74] },
  };
  const GROUND = {
    tash: {
      road: [0.3, 0.31, 0.34],
      side: [0.7, 0.7, 0.68],
      plain: [0.34, 0.52, 0.28],
    },
    sam: {
      road: [0.34, 0.33, 0.33],
      side: [0.82, 0.74, 0.6],
      plain: [0.66, 0.58, 0.42],
    },
    bux: {
      road: [0.4, 0.35, 0.3],
      side: [0.8, 0.68, 0.5],
      plain: [0.74, 0.6, 0.42],
    },
    khi: {
      road: [0.56, 0.47, 0.35],
      side: [0.74, 0.62, 0.44],
      plain: [0.8, 0.68, 0.48],
    },
  };
  const LIT = 0.12; // faint warm bounce on sunlit stone
  const lit = (c, k) => mulc(c, k === undefined ? 1 : k);
  /* ---- shared building blocks ---- */
  function windowsGrid(x, z, w, h, y0, cx, cy, sd, c, e) {
    if (!LOD) return;
    const cols = Math.max(2, Math.floor(w / cx)),
      rows = Math.max(1, Math.floor(h / cy));
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        if (hash(q + r * 17 + sd, 3) < 0.28) continue;
        box(
          T(
            x - w / 2 + (q + 0.5) * (w / cols),
            y0 + (r + 0.5) * (h / rows),
            z - 0.6,
          ),
          cx * 0.42,
          cy * 0.5,
          1,
          0,
          c,
          e,
        );
      }
  }
  /* dome on a drum: base y; rib = alternating colour bands (melon dome) */
  function dome(x, y, z, r, c, e, rib, drumH, c2) {
    if (drumH) {
      cyl(T(x, y + drumH, z), r * 0.86, drumH, lit(c, 0.9), e);
      cyl(T(x, y + drumH + 2, z), r * 0.9, 3, c2 || lit(c, 0.6), e);
      y += drumH;
    }
    put(
      rib ? SPHR : LOD ? SPH1 : SPH0,
      T(x, y, z),
      r,
      r * 1.12,
      r,
      0,
      c,
      e,
      rib ? c2 || lit(c, 0.55) : undefined,
    );
    cyl(T(x, y + r * 1.12 + 7, z), 1.4, 9, PAL.gold, 1);
    sph(T(x, y + r * 1.12 + 8, z), 3, 3, 3, PAL.gold, 1);
  }
  /* portal (pishtaq): tall slab with a deep arched niche, tiled frame and a parapet */
  function portal(x, z, w, h, c, tile, e) {
    box(T(x, 0, z), w, h, 22, h / 2, c, e);
    box(
      T(x, 0, z - 11.4),
      w * 0.52,
      h * 0.72,
      2,
      h * 0.36,
      [0.03, 0.04, 0.09],
      0.12,
    );
    put(
      CYL0,
      J(T(x, h * 0.72, z - 11.6), 0, 0, 0, PI / 2),
      w * 0.26,
      2,
      w * 0.26,
      0,
      [0.03, 0.04, 0.09],
      0.12,
    );
    for (const s of [-1, 1])
      box(
        T(x + s * w * 0.4, 0, z - 11.6),
        w * 0.1,
        h * 0.9,
        1.4,
        h * 0.45,
        tile,
        0.85,
      );
    box(T(x, h * 0.9, z - 11.6), w * 0.9, 5, 1.4, 0, tile, 0.85);
    box(T(x, h * 0.96, z - 11.6), w * 0.95, 3, 1.4, 0, PAL.gold, 0.9);
    for (let k = 0; k < 3; k++)
      box(T(x, h * (0.12 + k * 0.16), z - 12), w * 0.3, 3, 1, 0, tile, 0.7);
    box(T(x, h, z), w * 1.04, 4, 24, 0, lit(c, 1.15), e);
  }
  /* tapered tower with bands + lantern */
  function minaret(x, z, r, h, c, band, bandE, lantern, cap) {
    put(TAPER, T(x, h, z), r, h, r, 0, c, LIT);
    const n = Math.max(3, Math.floor(h / 26));
    for (let k = 1; k < n; k++)
      put(
        CYL0,
        T(x, h - (k * h) / n + 3, z),
        r * (1.28 - (k / n) * 0.3),
        6,
        r * (1.28 - (k / n) * 0.3),
        0,
        band,
        bandE,
      );
    if (lantern) {
      cyl(T(x, h + lantern, z), r * 1.35, lantern * 0.9, lit(c, 1.1), LIT);
      for (let k = 0; k < 4; k++)
        box(
          J(T(x, h + lantern * 0.5, z), 0, 0, 0, 0, (k * PI) / 4),
          r * 2.3,
          lantern * 0.5,
          2,
          0,
          PAL.warm,
          0.95,
        );
      cyl(T(x, h + lantern + 4, z), r * 1.5, 4, band, 0.7);
    }
    if (cap) cone(T(x, h + (lantern || 0) + 4, z), r * 1.2, r * 3, cap, 0.8);
  }
  const trees = (x, z, n) => {
    if (!LOD) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const tx = x + i * 26;
      cyl(T(tx, 26, z), 2, 26, [0.25, 0.16, 0.08], 0.2);
      sph(
        T(tx, 40, z),
        14,
        16,
        14,
        [0.06, 0.28 + hash(i, 4) * 0.1, 0.14],
        0.35,
      );
    }
  };
  const lowHouses = (x, z, n, c, wnd) => {
    for (let i = 0; i < n; i++) {
      const w = 48 + hash(i, 5) * 30,
        h = 34 + hash(i, 6) * 26,
        hx = x + i * 84;
      box(T(hx, 0, z), w, h, 36, h / 2, lit(c, 0.9 + hash(i, 7) * 0.2), 0.32);
      box(T(hx, h, z), w + 4, 4, 38, 0, lit(c, 1.15), 0.3);
      windowsGrid(hx, z - 18, w, h * 0.7, 6, 18, 18, i, PAL.warm, 1);
      if (hash(i, 8) > 0.6)
        box(T(hx, h + 4, z), 18, 12, 18, 6, lit(c, 0.85), 0.3);
    }
  };
  /* ---------- TASHKENT ---------- */
  const tashTower = (x, z) => {
    put(TAPER, T(x, 150, z), 17, 150, 17, 0, [0.82, 0.84, 0.9], 0.5);
    put(TAPER, T(x, 255, z), 10, 105, 10, 0, [0.85, 0.87, 0.93], 0.5);
    for (let k = 0; k < 4; k++)
      put(
        CYL0,
        T(x, 90 + k * 40, z),
        12 + (3 - k) * 1.2,
        3,
        12 + (3 - k) * 1.2,
        0,
        PAL.glass,
        0.95,
      );
    sph(T(x, 285, z), 36, 14, 36, [0.8, 0.84, 0.95], 0.6);
    sph(T(x, 285, z), 38, 4, 38, PAL.glass, 1);
    sph(T(x, 302, z), 24, 12, 24, [0.75, 0.8, 0.95], 0.55);
    cyl(T(x, 350, z), 4, 48, [0.8, 0.85, 0.95], 0.6);
    cyl(T(x, 400, z), 1.5, 50, [0.9, 0.9, 0.95], 0.7);
    sph(
      T(x, 402, z),
      3,
      3,
      3,
      Math.floor(performance.now() / 600) % 2
        ? [1, 0.15, 0.15]
        : [0.5, 0.05, 0.05],
      1,
    );
  };
  const tashTower2 = (x, z, w, h, sd) => {
    box(T(x, 0, z), w, h, w * 0.8, h / 2, [0.12, 0.2, 0.4], 0.35);
    for (let r = 0; r < h / 16; r++)
      box(
        T(x, 8 + r * 16, z - w * 0.4 - 0.5),
        w * 0.94,
        5,
        1,
        0,
        hash(r + sd, 2) > 0.2 ? PAL.glass : [0.9, 0.8, 0.5],
        0.9,
      );
    box(T(x, h, z), w * 0.6, 14, w * 0.5, 7, [0.14, 0.24, 0.5], 0.5);
    cone(T(x, h + 14, z), w * 0.25, 26, [0.5, 0.7, 1], 0.9);
  };
  const humo = (x, z) => {
    cyl(T(x, 36, z), 98, 36, [0.5, 0.6, 0.8], 0.5);
    sph(T(x, 36, z), 98, 40, 70, [0.55, 0.68, 0.95], 0.6);
    for (let k = -3; k <= 3; k++)
      box(T(x + k * 26, 6, z - 52), 6, 40, 2, 0, PAL.glass, 1);
    box(T(x, 36, z - 60), 190, 3, 1.5, 0, PAL.turq, 1);
  };
  const minor = (x, z) => {
    box(T(x, 0, z), 120, 42, 56, 21, PAL.white, 0.6);
    for (let k = -2; k <= 2; k++)
      box(T(x + k * 22, 4, z - 28.5), 12, 26, 1, 0, PAL.warm, 0.95);
    put(LOD ? SPH1 : SPH0, T(x, 42, z), 30, 30, 30, 0, PAL.white, 0.7);
    cyl(T(x, 74, z), 1.4, 12, PAL.gold, 1);
    for (const s of [-1, 1])
      minaret(x + s * 66, z, 5, 105, PAL.white, PAL.turq, 0.8, 8, PAL.turq);
  };
  const amirTimur = (x, z) => {
    cyl(T(x, 14, z), 62, 14, [0.55, 0.62, 0.8], 0.55);
    box(T(x, 0, z), 40, 54, 40, 27 + 14, [0.7, 0.68, 0.6], 0.5);
    sph(T(x, 95, z), 17, 11, 9, PAL.gold, 0.9); // horse
    box(J(T(x + 10, 107, z), 0, 0, 0, 0, 0, -0.5), 9, 16, 7, 0, PAL.gold, 0.9); // neck
    sph(T(x + 19, 118, z), 6, 5, 5, PAL.gold, 0.9);
    box(T(x - 4, 112, z), 9, 20, 9, 0, PAL.gold, 0.9); // rider
    sph(T(x - 4, 126, z), 5, 5, 5, PAL.gold, 0.9);
    for (let k = 0; k < 10; k++)
      box(
        T(
          x + Math.cos((k / 10) * TAU) * 80,
          1.5,
          z + Math.sin((k / 10) * TAU) * 28 - 10,
        ),
        7,
        3,
        7,
        0,
        [0.4, 0.8, 1],
        1,
      ); // fountain lights
  };
  const hotelUz = (x, z) => {
    box(T(x, 0, z), 240, 104, 62, 52, [0.52, 0.5, 0.48], 0.4);
    box(T(x + 70, 104, z), 100, 36, 50, 18, [0.52, 0.5, 0.48], 0.4);
    windowsGrid(x, z - 31, 236, 100, 4, 14, 18, 3, PAL.warm, 0.95);
  };
  const aptBlock = (x, z, sd) => {
    const w = 80 + hash(sd, 1) * 40,
      h = 80 + hash(sd, 2) * 70;
    box(T(x, 0, z), w, h, 44, h / 2, TASH_PASTEL[sd % 3], 0.2);
    windowsGrid(x, z - 22, w, h - 10, 4, 14, 16, sd, PAL.warm, 1);
  };
  /* ---------- SAMARKAND ---------- */
  const registan = (x, z) => {
    const st = PAL.sand,
      tl = PAL.blue;
    // Ulugh Beg (left), Sher-Dor (right), Tilya-Kori (centre, behind)
    box(T(x - 200, 0, z), 160, 92, 46, 46, lit(st, 0.95), 0.5);
    portal(x - 200, z - 24, 78, 118, lit(st, 1.05), PAL.turq, 0.5);
    minaret(x - 288, z - 14, 9, 128, lit(st, 1), tl, 0.85, 8, PAL.turq);
    minaret(x - 112, z - 14, 9, 128, lit(st, 1), tl, 0.85, 8, PAL.turq);
    box(T(x + 200, 0, z), 160, 92, 46, 46, lit(st, 0.95), 0.5);
    portal(x + 200, z - 24, 78, 118, lit(st, 1.05), PAL.turq, 0.5);
    minaret(x + 112, z - 14, 9, 128, lit(st, 1), tl, 0.85, 8, PAL.turq);
    minaret(x + 288, z - 14, 9, 128, lit(st, 1), tl, 0.85, 8, PAL.turq);
    for (const s of [-1, 1])
      dome(x + 200 + s * 52, 92, z - 4, 26, PAL.turq, 0.65, true, 18, PAL.blue); // Sher-Dor ribbed domes
    box(T(x, 0, z + 40), 170, 78, 40, 39, lit(st, 0.9), 0.5);
    portal(x, z + 15, 70, 96, lit(st, 1.05), PAL.turq, 0.5);
    dome(x, 78, z + 38, 34, PAL.turq, 0.7, true, 26, PAL.blue);
    for (const s of [-1, 1])
      minaret(x + s * 98, z + 20, 7, 96, lit(st, 1), tl, 0.8, 7, PAL.gold);
    box(T(x, 1, z - 40), 560, 2, 40, 0, [0.9, 0.7, 0.4], 0.8); // lit forecourt
  };
  const gurEmir = (x, z) => {
    box(T(x, 0, z), 112, 66, 112, 33, lit(PAL.sand, 0.9), 0.5);
    box(T(x, 0, z - 57), 52, 44, 2, 22, [0.03, 0.04, 0.09], 0.15);
    box(T(x, 40, z - 58), 56, 4, 1.4, 0, PAL.turq, 0.9);
    dome(x, 66, z, 52, PAL.turq, 0.65, true, 40, PAL.blue);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        minaret(
          x + sx * 62,
          z + sz * 20,
          6,
          82,
          lit(PAL.sand, 1),
          PAL.blue,
          0.8,
          6,
          PAL.turq,
        );
    box(T(x, 1, z - 70), 200, 2, 30, 0, [0.9, 0.7, 0.4], 0.8);
  };
  const shahi = (x, z) => {
    for (let k = 0; k < 5; k++) {
      const h = 44 + hash(k, 3) * 24,
        bx = x + (k - 2) * 62;
      box(T(bx, 0, z), 54, h, 36, h / 2, lit(PAL.sand, 0.95), 0.45);
      box(T(bx, 6, z - 18.6), 24, h * 0.55, 1.2, 0, [0.03, 0.04, 0.09], 0.15);
      box(T(bx, h * 0.72, z - 18.6), 34, 4, 1.2, 0, PAL.turq, 0.9);
      dome(
        bx,
        h,
        z,
        20 + hash(k, 5) * 6,
        k % 2 ? PAL.turq : PAL.blue,
        0.65,
        true,
        10,
      );
    }
  };
  const biBi = (x, z) => {
    portal(x, z - 20, 100, 150, lit(PAL.sand, 1), PAL.turq, 0.5);
    box(T(x, 0, z + 30), 150, 70, 80, 35, lit(PAL.sandD, 1), 0.4);
    dome(x, 70, z + 40, 44, PAL.turq, 0.65, true, 36, PAL.blue);
    minaret(
      x - 70,
      z - 10,
      9,
      135,
      lit(PAL.sand, 1),
      PAL.blue,
      0.8,
      8,
      PAL.turq,
    );
  };
  /* ---------- BUKHARA ---------- */
  const kalyan = (x, z) => {
    minaret(
      x,
      z,
      17,
      220,
      lit(PAL.brick, 1.05),
      lit(PAL.brickD, 0.9),
      0.4,
      26,
      PAL.turq,
    );
    for (let k = 0; k < 8; k++)
      box(T(x, 20 + k * 22, z - 17.5), 20, 5, 1, 0, lit(PAL.brickD, 0.7), 0.4);
    box(T(x + 150, 0, z + 6), 220, 56, 56, 28, lit(PAL.brick, 0.95), 0.5);
    for (let k = 0; k < 3; k++)
      dome(x + 90 + k * 60, 56, z + 6, 26, PAL.turq, 0.65, true, 8, PAL.blue);
    portal(x + 150, z - 24, 70, 100, lit(PAL.brick, 1.05), PAL.turq, 0.5);
    box(T(x - 140, 0, z + 6), 190, 70, 56, 35, lit(PAL.brick, 0.95), 0.5);
    portal(x - 140, z - 24, 84, 98, lit(PAL.brick, 1.05), PAL.turq, 0.5);
    for (const s of [-1, 1])
      dome(x - 140 + s * 54, 70, z + 4, 30, PAL.turq, 0.7, true, 20, PAL.blue); // Mir-i-Arab
    box(T(x, 1, z - 44), 480, 2, 32, 0, [0.9, 0.68, 0.38], 0.8);
  };
  const chorMinor = (x, z) => {
    box(T(x, 0, z), 74, 54, 74, 27, lit(PAL.brick, 1), 0.5);
    box(T(x, 0, z - 38), 34, 38, 1.5, 19, [0.03, 0.04, 0.09], 0.15);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        cyl(T(x + sx * 30, 90, z + sz * 30), 11, 36, lit(PAL.brick, 1.1), 0.5);
        dome(
          x + sx * 30,
          90,
          z + sz * 30,
          13,
          PAL.turq,
          0.8,
          true,
          0,
          PAL.blue,
        );
      }
    dome(x, 54, z, 16, PAL.turq, 0.7, true, 12, PAL.blue);
  };
  const ark = (x, z) => {
    box(T(x, 0, z), 340, 86, 46, 43, lit(PAL.mud, 0.9), 0.45);
    for (let k = -8; k <= 8; k++)
      box(T(x + k * 20, 86, z - 20), 10, 12, 8, 6, lit(PAL.mud, 1.05), 0.45);
    for (const s of [-1, 1]) {
      put(TAPER, T(x + s * 54, 96, z - 6), 26, 96, 26, 0, lit(PAL.mud, 1), 0.5);
      for (let k = 0; k < 6; k++)
        box(
          T(
            x + s * 54 + Math.cos((k / 6) * TAU) * 22,
            96,
            z - 6 + Math.sin((k / 6) * TAU) * 22,
          ),
          9,
          10,
          9,
          5,
          lit(PAL.mud, 1.05),
          0.5,
        );
    }
    box(T(x, 0, z - 24), 70, 70, 2, 35, [0.03, 0.04, 0.09], 0.12);
    put(
      CYL0,
      J(T(x, 70, z - 24.5), 0, 0, 0, PI / 2),
      35,
      2,
      35,
      0,
      [0.03, 0.04, 0.09],
      0.12,
    );
  };
  const samanid = (x, z) => {
    box(T(x, 0, z), 76, 64, 76, 32, lit(PAL.brick, 1), 0.5);
    for (let k = 0; k < 5; k++)
      box(
        T(x, 10 + k * 11, z - 38.4),
        70,
        2.5,
        1,
        0,
        lit(PAL.brickD, 0.75),
        0.4,
      );
    dome(x, 64, z, 34, lit(PAL.brick, 1.05), 0.5, false, 0);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        sph(
          T(x + sx * 30, 70, z + sz * 30),
          9,
          9,
          9,
          lit(PAL.brick, 1.05),
          0.5,
        );
  };
  const lyabi = (x, z) => {
    box(T(x, 0.6, z - 30), 200, 1.2, 100, 0, [0.12, 0.35, 0.7], 0.7);
    trees(x - 110, z + 30, 3);
    trees(x + 40, z + 30, 3);
    box(T(x, 0, z + 50), 220, 56, 40, 28, lit(PAL.sand, 0.95), 0.45);
    portal(x, z + 28, 72, 78, lit(PAL.sand, 1), PAL.turq, 0.5);
    for (let k = -4; k <= 4; k++)
      sph(T(x + k * 24, 22, z - 78), 3, 3, 3, [0.95, 0.95, 0.9], 0.9);
  };
  /* ---------- KHIVA ---------- */
  const kalta = (x, z) => {
    put(TAPER, T(x, 74, z), 38, 74, 38, 0, PAL.turq, 0.6);
    for (let k = 0; k < 6; k++)
      put(
        CYL0,
        T(x, 12 + k * 11, z),
        39.5 - k * 0.3,
        4,
        39.5 - k * 0.3,
        0,
        k % 2 ? PAL.blue : PAL.white,
        0.7,
      );
    cyl(T(x, 78, z), 41, 5, PAL.white, 0.6);
    for (let k = 0; k < 3; k++)
      box(T(x, 20 + k * 20, z - 38.5), 16, 5, 1, 0, PAL.warm, 1);
    box(T(x - 104, 0, z + 20), 110, 48, 48, 24, lit(PAL.mud, 1), 0.45);
  };
  const islamKhoja = (x, z) => {
    put(TAPER, T(x, 236, z), 11, 236, 11, 0, lit(PAL.brick, 1.05), 0.55);
    for (let k = 0; k < 9; k++)
      put(
        CYL0,
        T(x, 232 - k * 24, z),
        13.4 - k * 0.45,
        7,
        13.4 - k * 0.45,
        0,
        k % 3 === 0 ? PAL.turq : k % 3 === 1 ? PAL.white : PAL.red,
        0.8,
      );
    cyl(T(x, 258, z), 15, 22, lit(PAL.brick, 1.1), 0.6);
    for (let k = 0; k < 4; k++)
      box(J(T(x, 247, z), 0, 0, 0, 0, (k * PI) / 4), 28, 14, 3, 0, PAL.warm, 1);
    cone(T(x, 260, z), 14, 30, PAL.turq, 0.8);
    box(T(x - 90, 0, z + 14), 120, 54, 44, 27, lit(PAL.mud, 1), 0.45);
    portal(x - 90, z - 8, 56, 70, lit(PAL.mud, 1.05), PAL.turq, 0.5);
    dome(x - 130, 54, z + 14, 20, PAL.turq, 0.65, true, 8, PAL.blue);
  };
  const juma = (x, z) => {
    box(T(x, 0, z), 230, 52, 70, 26, lit(PAL.mud, 0.9), 0.4);
    for (let k = -5; k <= 5; k++)
      cyl(T(x + k * 20, 48, z - 35.5), 3, 48, [0.4, 0.22, 0.1], 0.5);
    box(T(x, 52, z), 236, 5, 74, 0, lit(PAL.mud, 1.1), 0.4);
    box(T(x + 60, 56, z), 40, 14, 40, 0, lit(PAL.mud, 1.0), 0.4);
  };
  const khivaWall = (x, z, w) => {
    box(T(x, 0, z), w, 64, 22, 32, lit(PAL.mud, 0.95), 0.42);
    for (let k = 0; k < w / 16; k++)
      box(
        T(x - w / 2 + 8 + k * 16, 64, z - 8),
        8,
        12,
        5,
        6,
        lit(PAL.mud, 1.05),
        0.42,
      );
    for (const s of [-1, 1]) {
      put(
        TAPER,
        T(x + s * (w / 2), 86, z),
        20,
        86,
        20,
        0,
        lit(PAL.mud, 1),
        0.45,
      );
      cyl(T(x + s * (w / 2), 94, z), 22, 8, lit(PAL.mud, 1.1), 0.45);
    }
  };
  const khivaWallLow = (x, z, w) => {
    box(T(x, 0, z), w, 30, 18, 15, lit(PAL.mud, 0.9), 0.4);
    for (let k = 0; k < w / 14; k++)
      box(
        T(x - w / 2 + 7 + k * 14, 30, z - 6),
        7,
        8,
        4,
        4,
        lit(PAL.mud, 1.05),
        0.4,
      );
  };
  const khivaGate = (x, z) => {
    box(T(x, 0, z), 150, 92, 30, 46, lit(PAL.mud, 0.95), 0.42);
    box(T(x, 0, z - 16), 44, 68, 2, 34, [0.03, 0.04, 0.09], 0.12);
    put(
      CYL0,
      J(T(x, 68, z - 16.5), 0, 0, 0, PI / 2),
      22,
      2,
      22,
      0,
      [0.03, 0.04, 0.09],
      0.12,
    );
    for (const s of [-1, 1]) {
      put(TAPER, T(x + s * 62, 112, z), 24, 112, 24, 0, lit(PAL.mud, 1), 0.45);
      cyl(T(x + s * 62, 120, z), 26, 8, lit(PAL.mud, 1.1), 0.45);
    }
  };
  const kunya = (x, z) => {
    box(T(x, 0, z), 170, 70, 52, 35, lit(PAL.mud, 0.95), 0.42);
    portal(x - 30, z - 28, 60, 90, lit(PAL.mud, 1.05), PAL.turq, 0.5);
    box(T(x + 56, 70, z), 54, 30, 40, 15, lit(PAL.mud, 1.05), 0.42);
    dome(x + 56, 100, z, 14, PAL.turq, 0.7, true, 0);
  };
  /* ---- sequences (piece, width) per city for the mid layer ---- */
  const P = (f, w) => ({ f, w });
  const SEQ = {
    tash: [
      P(tashTower, 160),
      P((x, z) => aptBlock(x, z, 1), 130),
      P(humo, 240),
      P((x, z) => tashTower2(x, z, 62, 210, 1), 120),
      P((x, z) => tashTower2(x, z, 52, 160, 2), 110),
      P(minor, 280),
      P((x, z) => aptBlock(x, z, 5), 130),
      P(amirTimur, 220),
      P(hotelUz, 320),
      P((x, z) => tashTower2(x, z, 70, 250, 3), 130),
      P((x, z) => aptBlock(x, z, 9), 130),
    ],
    sam: [
      P((x, z) => lowHouses(x - 120, z, 3, PAL.sand, 1), 300),
      P(gurEmir, 360),
      P((x, z) => trees(x - 40, z, 4), 180),
      P(registan, 780),
      P((x, z) => lowHouses(x - 120, z, 3, PAL.sand, 1), 300),
      P(shahi, 420),
      P((x, z) => trees(x - 40, z, 4), 160),
      P(biBi, 380),
    ],
    bux: [
      P((x, z) => lowHouses(x - 120, z, 3, PAL.mud, 1), 300),
      P(chorMinor, 190),
      P(kalyan, 800),
      P(lyabi, 330),
      P((x, z) => lowHouses(x - 120, z, 3, PAL.mud, 1), 300),
      P(samanid, 190),
      P(ark, 420),
    ],
    khi: [
      P((x, z) => khivaWall(x, z, 260), 260),
      P(khivaGate, 220),
      P(islamKhoja, 400),
      P(juma, 300),
      P(kalta, 330),
      P(kunya, 260),
      P((x, z) => khivaWall(x, z, 260), 260),
    ],
  };
  /* far skyline per city (each building is a cached piece) */
  function farLayer(id, z, s, D, vis, side, bx) {
    const sp = id === "tash" ? 330 : 260,
      per = Math.ceil((((vis * (D + z)) / D) * 1.3) / sp) * sp,
      N = per / sp,
      sh = s * ((D + z) / D);
    for (let i = 0; i < N; i++) {
      const x = mod(i * sp - sh + per / 2, per) - per / 2;
      if (side === 1 && x < bx) continue;
      if (side === 2 && x >= bx) continue;
      if (Math.abs(x) > (vis * (D + z)) / D / 2 + 300) continue;
      piece(
        "f" + id + i,
        (x0, z0) => {
          const r = hash(i, 11);
          if (id === "tash") {
            const w = 70 + r * 50,
              h = 190 + r * 240;
            box(T(x0, 0, z0), w, h, 60, h / 2, [0.55, 0.66, 0.82], 0.2);
            windowsGrid(x0, z0 - 30, w, h, 8, 16, 22, i, PAL.glass, 0.9);
            if (r > 0.5) cone(T(x0, h, z0), w * 0.3, 30, [0.7, 0.8, 0.95], 0.4);
          } else if (r > 0.45) {
            box(
              T(x0, 0, z0),
              90,
              60 + r * 40,
              50,
              30 + r * 20,
              id === "khi" ? [0.76, 0.62, 0.44] : [0.78, 0.66, 0.5],
              0.2,
            );
            dome(x0, 60 + r * 40, z0, 22, [0.16, 0.6, 0.78], 0.3, false, 0);
          } else {
            box(
              T(x0, 0, z0),
              130,
              50 + r * 30,
              50,
              25 + r * 15,
              id === "khi" ? [0.74, 0.6, 0.42] : [0.8, 0.66, 0.46],
              0.2,
            );
            cyl(T(x0 + 30, 130, z0), 5, 80, [0.76, 0.62, 0.44], 0.2);
          }
        },
        x,
        z,
      );
    }
  }
  /* mid strip: authored landmarks, repeated to cover the view, with the moving "city boundary" for the hand-over between cities */
  function strip(id, z, s, D, vis, side, bx) {
    const seq = SEQ[id] || SEQ.tash;
    let tot = 0;
    for (const p of seq) tot += p.w;
    const reps = Math.max(1, Math.ceil((((vis * (D + z)) / D) * 1.4) / tot)),
      per = tot * reps,
      sh = s * ((D + z) / D),
      half = (vis * (D + z)) / D / 2 + 340;
    let off = 0,
      ci = 0;
    for (let r = 0; r < reps; r++)
      for (const p of seq) {
        const x = mod(off + p.w / 2 - sh + per / 2, per) - per / 2,
          k = ci++;
        off += p.w;
        if (Math.abs(x) > half) continue;
        if (side === 1 && x < bx) continue;
        if (side === 2 && x >= bx) continue;
        piece("s" + id + k, p.f, x, z);
      }
  }
  /* near street layer: low houses / low Itchan Kala wall / trees (cached pieces) */
  function nearLayer(id, z, s, D, vis, side, bx) {
    const sp = id === "khi" ? 260 : 150,
      per = Math.ceil((((vis * (D + z)) / D) * 1.3) / sp) * sp,
      N = per / sp,
      sh = s * ((D + z) / D);
    for (let i = 0; i < N; i++) {
      const x = mod(i * sp - sh + per / 2, per) - per / 2;
      if (side === 1 && x < bx) continue;
      if (side === 2 && x >= bx) continue;
      if (Math.abs(x) > (vis * (D + z)) / D / 2 + 200) continue;
      piece(
        "n" + id + i,
        (x0, z0) => {
          if (id === "khi") {
            if (hash(i, 9) > 0.35) khivaWallLow(x0, z0, 230);
          } else if (id === "tash") {
            const c = TASH_PASTEL[i % 3];
            box(T(x0, 0, z0), 70, 44 + hash(i, 4) * 30, 34, 30, c, 0.2);
            windowsGrid(x0, z0 - 17, 66, 60, 6, 14, 16, i, PAL.warm, 0.9);
            trees(x0 + 50, z0 - 20, 2);
          } else if (hash(i, 6) > 0.4) trees(x0 - 30, z0, 3);
          else lowHouses(x0 - 30, z0, 1, id === "sam" ? PAL.sand : PAL.mud, 1);
        },
        x,
        z,
      );
    }
  }

  /* ================= PER-FRAME ================= */
  const renderInner = function (dx, dy) {
    if (!API.on) return;
    if (gl.isContextLost()) {
      API.on = false;
      return;
    }
    const asp = W / H,
      fov =
        (18 * (PI / 180)) /
        (typeof zoom === "number" && zoom > 1.002 && FX.cam && !CFG.reduce
          ? zoom
          : 1);
    const D = H / (2 * Math.tan((18 * PI) / 360));
    LOD = Q.level >= 3 ? 0 : 1; // characters keep their detail; scenery detail is DET
    DET = COARSE || Q.level >= 2 ? 0 : 1;
    if (DET !== lastDET) {
      dropPieces();
      lastDET = DET;
    }
    SQ.length = 0;
    built = 0;
    mp = 0;
    nv = 0;
    ni = 0;
    sFar += dWrap(farOff, lastF, Art.TW);
    lastF = farOff;
    sMid += dWrap(midOff, lastM, Art.TW);
    lastM = midOff;
    sGnd += dWrap(gndOff, lastG, Art.GW);
    lastG = gndOff;
    const cid0 =
      API.forceCity || (cur.city === "tashN" ? "tash" : cur.city || "tash");
    if (!curCity) curCity = cid0;
    if (cid0 !== curCity) {
      prevCity = curCity;
      curCity = cid0;
    }
    if (API.forceCity || (prevCity && (!lm || lm.x < -520))) prevCity = null;
    const kT = prevCity ? clampN((W + 420 - lm.x) / (W + 900), 0, 1) : 1,
      NA = DAY_SKY[prevCity || curCity] || DAY_SKY.tash,
      NB = DAY_SKY[curCity] || DAY_SKY.tash,
      top0 = mixc(NA.top, NB.top, kT),
      bot0 = mixc(NA.bot, NB.bot, kT);
    let top = top0,
      bot = bot0;
    const LS = lookStep();
    top = mixc(top, LS.top, LS.m);
    bot = mixc(bot, LS.bot, LS.m);
    /* sky (NDC pass): gradient + sun/moon + stars */
    const gy = 1 - (2 * groundY) / H;
    ndcQuad(-1, gy, 1, 1, bot, top, 1);
    ndcQuad(-1, -1, 1, gy, bot, bot, 1);
    const b = cur.body || [0.84, 0.22, 26, "#ffffff"],
      bc = LS.body,
      bx = W * b[0],
      by0 = Math.min(b[1] * H, groundY - 30),
      by = by0 + (Math.min(LS.by * groundY, groundY - 30) - by0) * LS.m,
      br = Math.max(18, b[2] * 0.8) * Math.max(1, UI * 0.8);
    for (const [k, a] of [
      [2.8, 0.14],
      [1.7, 0.3],
      [1, 1],
    ])
      ndcDisc(
        (bx / W) * 2 - 1,
        1 - (by / H) * 2,
        (br * k * 2) / W,
        (br * k * 2) / H,
        mixc(mixc(top, bot, clampN(by / groundY, 0, 1)), bc, a),
        1,
      );
    if (LS.st > 0.04 && !LOD)
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 0.6180339 + 0.13) % 1) * 2 - 1,
          sy = 1 - ((((i * 0.3819 + 0.07) % 1) * (2 * groundY)) / H) * 0.9,
          tw = 0.55 + 0.45 * Math.sin(frame * 0.05 + i * 1.7),
          sr = (i % 5 === 0 ? 2.4 : 1.5) * Math.max(1, UI * 0.7),
          c = mixc(top, [1, 1, 1], LS.st * tw);
        ndcQuad(sx - sr / W, sy - sr / H, sx + sr / W, sy + sr / H, c, c, 1);
      }
    const skyI = ni;
    /* world pass */
    const cx = -(dx || 0),
      cy = groundY - H / 2 + (dy || 0);
    const VP = mulVP(
      persp(fov, asp, 40, 6000),
      lookAt([cx, cy, -D], [cx, cy, 0]),
    );
    const bnd = (z) => (lm ? ((lm.x - W / 2) * (D + z)) / D : 1e9);
    for (const [id, side] of prevCity
      ? [
          [prevCity, 2],
          [curCity, 1],
        ]
      : [[curCity, 0]]) {
      farLayer(id, 1100, sFar, D, W, side, bnd(1100));
      strip(id, 520, sMid, D, W, side, bnd(520));
      nearLayer(id, 190, sGnd * 0.6, D, W, side, bnd(190));
    }
    /* ground: road, lane dashes, sidewalk, lamps, far plain */
    const GA = GROUND[prevCity || curCity] || GROUND.tash,
      GB = GROUND[curCity] || GROUND.tash,
      road = mixc(GA.road, GB.road, kT),
      side = mixc(GA.side, GB.side, kT),
      plain = mixc(GA.plain, GB.plain, kT);
    box(T(0, 0, -155), 9000, 20, 460, -10, road, 0.04);
    box(T(0, 0, 85), 9000, 6, 70, -3 + 6, side, 0.05);
    box(T(0, 0, 1300), 9000, 4, 2500, -2, mixc(plain, bot, 0.25), 0);
    box(T(0, 0.3, 48), 9000, 1.2, 4, 0, mixc(side, [0.5, 0.5, 0.5], 0.4), 0); // kerb
    for (let i = -14; i < 14; i++) {
      const x = mod(i * 96 - sGnd + 48, 96 * 28) - 96 * 14;
      box(T(x, 0.6, -34), 50, 1, 5, 0, [0.95, 0.95, 0.9], 0.5);
    }
    for (let i = 0; i < 9; i++) {
      const x = mod(i * 260 - sGnd * 0.98 + 130, 260 * 9) - 260 * 4.5;
      cyl(T(x, 120, 110), 2, 120, K.grey, 0.3);
      sph(T(x, 126, 108), 7, 4, 7, [0.95, 0.95, 0.9], 0.9);
    }
    for (let i = 0; i < 5; i++) {
      const cxp =
        mod(i * 900 - frame * 0.25 * (0.6 + hash(i, 31)), 4500) - 2250;
      sph(
        T(cxp, 330 + hash(i, 32) * 180, 1700),
        150 + hash(i, 33) * 90,
        24,
        40,
        [1, 1, 1],
        0.9,
      );
    }
    /* obstacles */
    const blink = Math.floor(frame / 14) % 2,
      t = performance.now() / 1000;
    for (const o of obstacles) {
      const X = o.x + o.w / 2 - W / 2,
        Y = groundY - (o.y + o.h);
      if (X < -W - 200 || X > W) continue;
      if (o.t === "pit") {
        /* open trench: dark shaft with a hot glow at the bottom, concrete curbs with chevrons, warning signs, lamps and cones */
        const cx = o.x + o.w / 2 - W / 2,
          x0 = o.x - W / 2,
          x1 = o.x + o.w - W / 2;
        box(T(cx, 0.8, -10), o.w, 1.4, 170, 0, [0.01, 0.01, 0.03], 0);
        box(
          T(cx, 0.55, -30),
          o.w - 6,
          0.5,
          6,
          0,
          [1, 0.38, 0.08],
          0.9 + 0.1 * blink,
        ); // glow at the bottom
        box(T(cx, 0.6, -2), o.w - 6, 0.5, 4, 0, [0.7, 0.18, 0.05], 0.8);
        for (const gx of [x0 + 4, x1 - 4])
          box(T(gx, 1.7, -20), 5, 0.5, 120, 0, [1, 0.45, 0.1], 0.9); // glowing rim
        box(T(cx, 1.8, -62), o.w - 6, 0.5, 3, 0, [1, 0.5, 0.12], 0.85);
        for (const sx of [x0 - 3, x1 + 3]) {
          const ou = sx < cx ? -1 : 1;
          box(T(sx, 3, -30), 8, 6, 30, 0, [0.1, 0.24, 0.68], 0.25); // tiled curb
          for (let k = 0; k < 5; k++)
            box(
              J(T(sx, 6.4, -30 + (k - 2) * 6), 0, 0, 0, 0, 0, 0),
              8.4,
              0.8,
              3,
              0,
              k % 2 ? [1, 0.78, 0.2] : [0.97, 0.93, 0.82],
              0.35,
            );
          // warning post with a blinking lamp + a red triangle sign
          cyl(T(sx + ou * 2, 34, -38), 1.1, 34, K.grey, 0.2);
          sph(
            T(sx + ou * 2, 36, -38),
            3.4,
            3.4,
            3.4,
            blink ? [1, 0.7, 0.1] : [0.5, 0.3, 0.05],
            1,
          );
          box(
            J(T(sx + ou * 2, 26, -41.5), 0, 0, 0, 0, 0, PI / 4),
            9,
            9,
            0.8,
            0,
            [0.8, 0.32, 0.18],
            0.5,
          );
          box(
            J(T(sx + ou * 2, 26, -42.1), 0, 0, 0, 0, 0, PI / 4),
            5.6,
            5.6,
            0.5,
            0,
            [1, 1, 1],
            0.6,
          );
          // a cone beside the curb
          const cb = T(sx + ou * 9, 0, -36);
          cone(cb, 4, 13, [1, 0.42, 0.08], 0.3);
          cyl(J(cb, 0, 8, 0), 2.3, 2.4, [0.96, 0.96, 0.96], 0.5);
        }
      } else if (o.t === "train" && o.v === "damas") {
        /* Chevrolet / Daewoo Damas Deluxe micro-van: grey nose with round headlights, black bumper with amber
           indicators, tall cabin with a sloping windscreen, three side windows, orange + black rear stripe */
        const w = o.w,
          x0 = -w / 2,
          wh = [0.95, 0.96, 0.98],
          gr = [0.76, 0.79, 0.83],
          gl_ = [0.12, 0.17, 0.24],
          bk = [0.09, 0.09, 0.1],
          at = (u, y, z) => T(X + u, Y + y, z);
        box(at(6, 0, 0), w - 12, 22, 40, 21, wh, 0.28); // lower body
        box(at(x0 + 6, 0, 0), 12, 17, 39, 21.5, gr, 0.3); // nose / bonnet (grey)
        box(at(x0 + 6, 0, 0), 12.4, 3, 40, 29.5, wh, 0.25); // bonnet lip
        box(at(x0 - 0.8, 0, 0), 4, 8, 43, 12, bk, 0.1); // bumper
        for (const z of [-17.5, 17.5])
          box(at(x0 - 2.5, 0, z), 1.2, 3.2, 5, 11.5, [1, 0.58, 0.1], 0.9); // amber indicators
        box(at(x0 - 1.1, 0, 0), 0.8, 2, 20, 9, [0.2, 0.2, 0.22], 0.1); // lower grille
        for (const z of [-13.5, 13.5]) {
          box(at(x0 - 0.2, 0, z), 1.4, 7.5, 10, 22.5, [0.88, 0.92, 0.96], 0.85); // headlights
          box(at(x0 - 0.2, 0, z), 1.6, 8.5, 11, 22.5, [0.5, 0.53, 0.58], 0.3);
        }
        box(at(x0 + 5, 0, -19.8), 6, 7, 1, 22.5, [0.88, 0.92, 0.96], 0.85); // wrap-around light (side)
        box(at(x0 - 0.5, 0, 0), 1, 3, 7, 22.5, [0.95, 0.78, 0.3], 0.6); // bowtie badge
        /* cabin */
        box(at(10, 0, 0), w - 20, 15, 38, 39.5, wh, 0.28); // upper body
        box(at(8, 0, 0), w - 30, 2.2, 35, 48.2, wh, 0.32); // domed roof
        box(at(x0 + 16, 0, 0), 8, 16, 34, 38, gl_, 0.3); // interior seen through the cut-away
        box(
          J(at(x0 + 15, 38, 0), 0, 0, 0, 0, 0, 1.01),
          19,
          1.6,
          34,
          0,
          [0.2, 0.3, 0.4],
          0.55,
        ); // slanted windscreen
        for (const [a, b] of [
          [x0 + 14, x0 + 36],
          [x0 + 38, x0 + w * 0.62],
          [x0 + w * 0.64, w / 2 - 3],
        ])
          box(at((a + b) / 2, 0, -19.4), b - a, 10.5, 0.8, 39, gl_, 0.42); // side windows
        box(at(x0 + 37, 0, -19.9), 1.2, 22, 0.7, 28, [0.55, 0.57, 0.6], 0.2); // door shut-line
        box(
          at(x0 + w * 0.63, 0, -19.9),
          1.2,
          22,
          0.7,
          28,
          [0.55, 0.57, 0.6],
          0.2,
        );
        box(at(x0 + 33, 0, -20.2), 2.4, 1.2, 0.8, 27, bk, 0.2); // door handle
        box(at(x0 + 12, 0, -23), 2.5, 7, 3.2, 36, bk, 0.1); // mirror
        /* rear-side stripe: orange over black */
        box(
          at(w * 0.22, 0, -20.1),
          w * 0.5,
          3.4,
          0.7,
          27.5,
          [0.93, 0.42, 0.12],
          0.45,
        );
        box(at(w * 0.22 + 2, 0, -20.1), w * 0.46, 2.2, 0.7, 23.6, bk, 0.2);
        box(at(w / 2 + 0.4, 0, -12), 1.4, 8, 5, 30, [0.9, 0.12, 0.1], 0.9); // tail lights
        box(at(w / 2 + 0.4, 0, 12), 1.4, 8, 5, 30, [0.9, 0.12, 0.1], 0.9);
        box(at(w / 2 + 0.2, 0, 0), 1.2, 4.5, 14, 14, bk, 0.1); // rear bumper
        /* wheels with silver hub-caps */
        for (const wx of [x0 + 22, w / 2 - 20]) {
          box(at(wx, 0, -20.4), 21, 3.2, 1.2, 19.5, bk, 0.1); // wheel arch
          cyl(
            J(at(wx, 9.5, -19.5), 0, 0, 0, PI / 2, 0, 0),
            9.5,
            7,
            [0.07, 0.07, 0.08],
            0.08,
          );
          cyl(
            J(at(wx, 9.5, -25.5), 0, 0, 0, PI / 2, 0, 0),
            6.2,
            3,
            [0.9, 0.92, 0.96],
            0.8,
          );
          cyl(
            J(at(wx, 9.5, -27.5), 0, 0, 0, PI / 2, 0, 0),
            1.6,
            1,
            [0.55, 0.58, 0.62],
            0.3,
          );
        }
      } else if (o.t === "train") {
        const bd = T(X, Y, 0);
        box(bd, o.w, o.h - 8, 46, (o.h - 8) / 2 + 6, [0.04, 0.55, 0.62], 0.2);
        box(bd, o.w + 2, 5, 48, o.h - 6, [1, 0.78, 0.2], 0.5);
        box(bd, o.w + 2, 4, 48, 20, [0.98, 0.94, 0.82], 0.4);
        for (let wx = -o.w / 2 + 28; wx < o.w / 2 - 20; wx += 26)
          box(
            T(X + wx, Y + o.h - 24, -23.5),
            17,
            15,
            1.5,
            0,
            [0.62, 0.82, 1],
            0.7,
          );
        box(
          T(X - o.w / 2 + 6, Y + o.h / 2, -23.5),
          12,
          o.h - 14,
          2,
          0,
          [0.1, 0.22, 0.48],
          0.2,
        );
        box(T(X - o.w / 2 + 6, Y + 14, -25), 6, 6, 2, 0, [1, 0.97, 0.69], 1);
        /* metro details: yellow safety stripe, sliding doors, roof AC units, headlight bar, rain gutter, coupler */
        box(T(X, Y + 11, -24.2), o.w, 2.2, 1, 0, [1, 0.8, 0.12], 0.45);
        for (const dx of [-o.w * 0.12, o.w * 0.3]) {
          box(
            T(X + dx, Y + 22, -24),
            12,
            o.h - 26,
            1.2,
            0,
            [0.82, 0.88, 0.96],
            0.4,
          );
          box(
            T(X + dx, Y + 22, -24.7),
            0.9,
            o.h - 26,
            0.8,
            0,
            [0.12, 0.2, 0.4],
            0.2,
          );
          box(
            T(X + dx, Y + o.h - 14, -24.8),
            9,
            9,
            0.8,
            0,
            [0.62, 0.82, 1],
            0.7,
          );
        }
        for (const dx of [-o.w * 0.25, o.w * 0.2]) {
          box(T(X + dx, Y + o.h + 2, 0), 22, 4, 26, 0, [0.7, 0.74, 0.8], 0.2);
          box(
            T(X + dx, Y + o.h + 4.4, -4),
            14,
            1,
            1.2,
            0,
            [0.3, 0.33, 0.4],
            0.1,
          );
        }
        box(T(X - o.w / 2 - 1, Y + 20, -14), 1.5, 5, 8, 0, [1, 0.97, 0.69], 1);
        box(T(X - o.w / 2 - 1, Y + 20, 14), 1.5, 5, 8, 0, [1, 0.97, 0.69], 1);
        box(T(X + o.w / 2 + 2, Y + 8, 0), 4, 3, 6, 0, K.dark, 0.1);
        for (const wx of [
          -o.w / 2 + 28,
          -o.w / 2 + 48,
          o.w / 2 - 48,
          o.w / 2 - 28,
        ])
          cyl(
            J(T(X + wx, Y + 7, -22), 0, 0, 0, 0, 0, PI / 2),
            7,
            6,
            K.dark,
            0.1,
          );
      } else if (o.t === "block") {
        /* Uzbek-craft obstacles, drawn 1.2x larger than the hitbox so they read well on small screens:
           painted bazaar chest, glazed clay pots, tiled gate barrier. Palette: turquoise, cobalt, gold, terracotta, cream. */
        const S = 1.2,
          B = SC(T(X, Y, 0), S),
          at = (u, y, z) => J(B, u, y, z, 0, 0, 0),
          w = o.w,
          h = o.h,
          dp = Math.min(46, w + 8),
          TQ = [0.04, 0.62, 0.68],
          CB = [0.1, 0.24, 0.68],
          GD = [1, 0.78, 0.2],
          TC = [0.8, 0.32, 0.18],
          CR = [0.98, 0.94, 0.82],
          NV = [0.06, 0.1, 0.28];
        box(
          at(0, 0, 0),
          w + 12,
          1.2,
          dp + 10,
          0.6,
          [1, 0.8, 0.25],
          0.55 + 0.25 * blink,
        ); // glowing base pad = "danger" read
        if (o.v === "crate") {
          /* sandiq: turquoise painted chest, gold bands, ikat diamonds, domed terracotta lid */
          box(at(0, 0, 0), w, h * 0.84, dp, h * 0.42, TQ, 0.22);
          box(at(0, 0, 0), w + 3, 3.4, dp + 3, 1.7, NV, 0.1);
          for (const xx of [-w / 2 + 1.5, w / 2 - 1.5])
            box(at(xx, 0, -1), 3.4, h * 0.84, dp + 2.2, h * 0.42, GD, 0.5);
          box(at(0, 0, 0), w + 2, 3.4, dp + 2, h * 0.84 - 1.5, GD, 0.5);
          const dy = h * 0.46,
            dr = Math.min(w, h) * 0.2;
          for (let k = -1; k <= 1; k++) {
            const c = k % 2 ? CR : CB;
            box(
              J(at(k * dr * 1.7, dy, -dp / 2 - 1.4), 0, 0, 0, 0, 0, PI / 4),
              dr * 1.5,
              dr * 1.5,
              1.2,
              0,
              c,
              0.45,
            );
            box(
              J(at(k * dr * 1.7, dy, -dp / 2 - 2.1), 0, 0, 0, 0, 0, PI / 4),
              dr * 0.7,
              dr * 0.7,
              0.8,
              0,
              k % 2 ? TC : GD,
              0.6,
            );
          }
          sph(at(0, h * 0.84, 0), w * 0.6, h * 0.18, dp * 0.55, TC, 0.2);
          box(at(0, 0, -dp / 2 - 1.6), 5, 6, 1.2, h * 0.3, GD, 0.7); // lock plate
        } else if (o.v === "cones") {
          /* three glazed kuzas (clay pots) with turquoise glaze and gold rims */
          [
            [-0.3, 0.92, 0],
            [0.3, 0.92, 0],
            [0, 1.18, 5],
          ].forEach(([u, k, z], i) => {
            const r = Math.min(11, w * 0.2) * (i === 2 ? 1.15 : 1),
              ph = h * k,
              p = at(u * w, 0, z);
            sph(J(p, 0, ph * 0.42, 0), r, ph * 0.42, r, i % 2 ? TQ : TC, 0.22);
            cyl(
              J(p, 0, ph * 0.98, 0),
              r * 0.52,
              ph * 0.2,
              i % 2 ? TQ : TC,
              0.22,
            );
            cyl(J(p, 0, ph * 1.0, 0), r * 0.68, 2.2, GD, 0.6); // gold rim
            cyl(J(p, 0, ph * 0.5, 0), r * 1.02, 2.6, GD, 0.55); // gold belt
            cyl(J(p, 0, ph * 0.36, 0), r * 0.98, 2.2, CB, 0.35);
            sph(J(p, 0, ph * 0.96, 0), r * 0.4, 2.2, r * 0.4, NV, 0.05); // dark mouth
          });
        } else {
          /* darvoza gate: tiled cobalt pillars, striped gold/navy arm, lantern beacon */
          for (const sx of [-w * 0.4, w * 0.4]) {
            box(at(sx, 0, 0), 8, h * 0.9, 10, h * 0.45, CB, 0.25);
            box(at(sx, 0, -5.3), 6, 5, 0.8, h * 0.62, GD, 0.7);
            box(at(sx, 0, -5.3), 6, 5, 0.8, h * 0.3, CR, 0.55);
            sph(at(sx, h * 0.9, 0), 6, 3.4, 6, TQ, 0.35);
          }
          box(at(0, 0, -2), w * 0.9, h * 0.22, 5, h * 0.62, NV, 0.2);
          const ns = 7;
          for (let k = 0; k < ns; k++)
            box(
              J(
                at(-w * 0.4 + (w * 0.8 * (k + 0.5)) / ns, h * 0.62, -5),
                0,
                0,
                0,
                0,
                0,
                0.55,
              ),
              ((w * 0.8) / ns) * 0.58,
              h * 0.3,
              1,
              0,
              k % 2 ? GD : TQ,
              0.6,
            );
          cyl(at(0, h * 0.95 + 14, 0), 1.2, 12, K.dark, 0.2);
          sph(
            at(0, h * 0.95 + 14, 0),
            4.6,
            5.4,
            4.6,
            blink ? [1, 0.3, 0.2] : [0.7, 0.12, 0.1],
            1,
          );
          sph(
            at(0, h * 0.95 + 14, 0),
            7.4,
            8.4,
            7.4,
            blink ? [1, 0.5, 0.3] : [0.4, 0.1, 0.1],
            blink ? 0.4 : 0.1,
          );
        }
      } else if (o.t === "drone") {
        /* patrol quad-copter: armoured body, glowing red eye, four arms with spinning rotors, skids and an under-light */
        const hv = Math.sin(t * 4 + o.x * 0.01) * 2,
          dr = SC(T(X, Y + o.h / 2 + hv, 0), 1.3),
          gm = [0.04, 0.5, 0.58],
          gl = [0.98, 0.78, 0.2];
        sph(dr, 10, 6.5, 10, gm, 0.22);
        sph(J(dr, 0, 3, 0), 8, 4, 8, gl, 0.3);
        box(J(dr, 0, -1, -8.6), 12, 5.4, 2, 0, [0.05, 0.02, 0.05], 0.1);
        sph(
          J(dr, Math.sin(frame * 0.2) * 3.4, -1, -9.6),
          2.2,
          2.2,
          2.2,
          [1, 0.2, 0.2],
          1,
        );
        sph(
          J(dr, Math.sin(frame * 0.2) * 3.4, -1, -9.6),
          3.6,
          3.6,
          3.6,
          [1, 0.35, 0.3],
          0.2,
        );
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            const rx = sx * 16,
              rz = sz * 8.5,
              ry = 5.5;
            box(
              J(dr, sx * 8, 3, sz * 4, 0, 0, sx * 0.1),
              14,
              2.2,
              2.6,
              0,
              [0.14, 0.15, 0.19],
              0.15,
            ); // arm
            cyl(J(dr, rx, ry - 1, rz), 2.6, 5, [0.1, 0.1, 0.13], 0.15); // motor
            const rt = J(dr, rx, ry + 1.4, rz, 0, t * 60 * sx * sz);
            box(rt, 17, 0.9, 2.6, 0, [0.88, 0.9, 0.95], 0.55);
            box(
              J(rt, 0, 0, 0, 0, PI / 2),
              17,
              0.9,
              2.6,
              0,
              [0.88, 0.9, 0.95],
              0.55,
            );
            cyl(J(dr, rx, ry + 1.1, rz), 8.8, 0.35, [0.7, 0.78, 0.9], 0.5); // rotor blur disc
          }
        for (const sx of [-6, 6])
          box(J(dr, sx, -7, 0), 1.4, 5, 1.4, 0, K.grey, 0.2);
        box(J(dr, 0, -9.4, 0), 18, 1.2, 1.4, 0, K.grey, 0.2);
        cone(
          J(dr, 0, -6, 0, PI),
          6,
          9,
          blink ? [1, 0.25, 0.2] : [0.6, 0.12, 0.1],
          0.75,
        );
        sph(
          J(dr, -7, 4.6, -8),
          1.8,
          1.8,
          1.8,
          blink ? [1, 0.23, 0.23] : [0.48, 0.1, 0.1],
          1,
        );
      } else {
        /* plasma bolt: bright core, hot shell and a streaming tail */
        const c0 = T(X, Y + o.h / 2, 0),
          fl = Math.sin(frame * 0.7) * 0.8;
        sph(c0, 6.5, 6.5, 6.5, [1, 0.95, 0.85], 1);
        sph(c0, 9.5 + fl, 9.5 + fl, 9.5 + fl, [1, 0.28, 0.2], 0.9);
        sph(c0, 12 + fl, 12 + fl, 12 + fl, [1, 0.5, 0.35], 0.3);
        for (let k = 0; k < 3; k++)
          cone(
            J(c0, 8 + k * 4, (k - 1) * 3, 0, 0, 0, -PI / 2),
            5 - k,
            22 - k * 4,
            k ? [1, 0.45, 0.2] : [1, 0.3, 0.2],
            0.85,
          );
      }
    }
    /* items: spinning coins and power-up gems */
    for (const it of items) {
      const X = it.x - W / 2,
        Y = groundY - it.y;
      if (X < -W * 0.7 - 40 || X > W * 0.7 + 40) continue;
      if (it.k === "coin") {
        const cc = it.ct ? C(COIN_T[it.ct].col) : [1, 0.68, 0.06],
          r = (it.ct === 3 ? 22 : it.ct ? 18 : 17) * Math.max(1, UI * 0.8),
          sp = frame * (it.ct === 2 ? 0.26 : 0.18) * 0.5 + it.x * 0.03;
        const cd = J(T(X, Y, 0), 0, 0, 0, PI / 2, sp);
        /* dark-bronze rim + saturated, self-lit faces: reads clearly against the bright daylight city */
        cyl(cd, r * 1.2, 4.2, mulc(cc, 0.32), 0.1);
        cyl(J(cd, 0, 1.6, 0), r * 0.94, 3.4, cc, 1);
        cyl(J(cd, 0, -1.6, 0), r * 0.94, 3.4, cc, 1);
        cyl(J(cd, 0, 2.2, 0), r * 0.5, 3.4, mulc(cc, 1.15), 1);
        cyl(J(cd, 0, -2.2, 0), r * 0.5, 3.4, mulc(cc, 1.15), 1);
      } else if (it.k === "parcel") {
        const bob = Math.sin(frame * 0.1 + it.x) * 3,
          pm = J(T(X, Y + bob, 0), 0, 0, 0, 0.2, frame * 0.04, 0);
        box(pm, 22, 18, 22, 0, [0.96, 0.9, 0.74], 0.35);
        box(pm, 23, 4, 23, 0, [0.9, 0.2, 0.18], 0.6);
        box(pm, 4, 19, 23, 0, [0.9, 0.2, 0.18], 0.6);
        sph(J(pm, 0, 11, 0), 5, 3, 5, [1, 0.78, 0.2], 0.8);
      } else if (it.k === "relic") {
        const bob = Math.sin(frame * 0.08 + it.x) * 4,
          rm = J(T(X, Y + bob, 0), 0, 0, 0, 0, frame * 0.05, 0);
        sph(rm, 20, 20, 20, [1, 0.8, 0.25], 0.9);
        sph(rm, 26, 26, 26, [1, 0.9, 0.5], 0.25);
        cyl(J(rm, 0, 0, 0, PI / 2.3, 0, 0), 27, 2, [1, 0.85, 0.3], 0.9);
      } else {
        const bob = Math.sin(frame * 0.1 + it.x) * 3,
          pc = C(POWER[it.k].color),
          gd = J(T(X, Y + bob, 0), 0, 0, 0, 0, frame * 0.05, 0);
        sph(gd, 14, 14, 14, mulc(pc, 0.7), 0.7);
        box(J(gd, 0, 0, 0, 0.6, 0.6), 12, 12, 12, 0, pc, 1);
        cyl(J(gd, 0, 0, 0, PI / 2.6, 0, 0), 20, 1.6, K.white, 0.9);
      }
    }
    /* chasers */
    if (state !== "ready" && chaseX >= -70) {
      const caught = state === "over" || state === "revive",
        close = lives === 1 || caught,
        gx = chaseX + 26;
      let lean = 0;
      if (caught && bustT > 150) {
        const ph =
          Math.max(0, (bustT - BUST_FIRST + BUST_EVERY * 0.7) % BUST_EVERY) /
          BUST_EVERY;
        lean = -(0.03 + Math.sin(Math.min(1, ph * 1.15) * PI) * 0.2);
      }
      const gr = J(T(gx + 6 - W / 2, 0, 0), 0, 0, 0, 0, PI / 2 + 0.35, 0),
        gs = SC(gr, 56 * (CPS / 1.5));
      drawBoxBot(gs, frame * 0.42 * 0.8, t, lean);
      if (lives < maxLives || caught) {
        const hop = caught ? Math.abs(Math.sin(bustT / 110)) * 14 : 0;
        const dr = SC(
          J(T(gx + 48 - W / 2, hop, 0), 0, 0, 0, 0, PI / 2 + 0.35, 0),
          44 * (CPS / 1.5),
        );
        drawBallBot(dr, frame * 0.5, t, close);
      }
    }
    /* hero */
    {
      const p = player,
        duckk = p.h < 40,
        hit = state === "over" || state === "revive",
        air = !p.grounded,
        ip = INTRO.on && INTRO.pose ? INTRO.pose() : null,
        Y = ip ? groundY - (p.y + p.h) + ip.y : groundY - (p.y + p.h),
        X = ip ? ip.x : p.x + p.w / 2 - W / 2;
      if (ip) {
        const hs = 50 * (PS / 1.55),
          cy = 0.55 * hs,
          m1 = J(T(X, Y + cy, 0), 0, 0, 0, 0, 0, ip.ang),
          m2 = J(m1, 0, -cy, 0, 0, PI / 2 + 0.38 + ip.spin, 0);
        drawHero(SC(m2, hs), {
          ph: ip.ph,
          air: ip.air,
          slide: false,
          hit: false,
          boost: ip.boost,
          land: ip.land,
          t,
          sp: 0.8,
        });
      } else if (!(invul > 0 && Math.floor(frame / 3) % 2)) {
        const root = SC(
          J(T(X, Y, 0), 0, 0, 0, 0, PI / 2 + 0.38, 0),
          50 * (PS / 1.55),
        );
        drawHero(root, {
          ph: (runPhase / 8) * TAU,
          air,
          slide: duckk && !air,
          hit,
          boost: turboT > 0 || flying,
          land: landT > 0 ? 0.6 : 0,
          t,
          sp: Math.min(1, (speed - 5) / 12),
        });
      }
      if (
        boardT > 0 &&
        state !== "ready" &&
        !(boardT < 2000 && Math.floor(frame / 4) % 2)
      ) {
        box(T(X, Y + 2, 0), p.w + 12, 5, 28, 0, [0.33, 0.97, 1], 1);
        for (const sdx of [-p.w / 2 + 2, p.w / 2 + 2])
          cyl(
            J(T(X + sdx, Y + 1, 0), 0, 0, 0, 0, 0, PI / 2),
            3,
            4,
            K.dark,
            0.1,
          );
      }
    }
    const worldI = ni;
    /* soft contact shadows (blended) */
    const sdw = [
      [
        player.x + player.w / 2 - W / 2,
        Math.max(10, 26 - Math.max(0, groundY - (player.y + player.h)) * 0.07),
        18,
      ],
    ];
    if (state !== "ready" && chaseX >= -70)
      sdw.push([chaseX + 32 - W / 2, 24, 16]);
    for (const o of obstacles)
      if (o.t === "block" || o.t === "train")
        sdw.push([o.x + o.w / 2 - W / 2, o.w * 0.62, 20]);
    for (const [x, rx, rz] of sdw)
      put(LOD ? CYL1 : CYL0, T(x, 1.8, -2), rx, 1, rz, 0, [0, 0, 0], 0);
    /* ---- upload + draw ---- */
    const w = cv3.width,
      h = cv3.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(top[0], top[1], top[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, VB.subarray(0, nv * 10));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, IB.subarray(0, ni));
    for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3f(U.uSun, LS.sun[0], LS.sun[1], LS.sun[2]);
    gl.uniform3f(U.uSunC, LS.sunC[0], LS.sunC[1], LS.sunC[2]);
    gl.uniform3f(U.uAmb, LS.amb[0], LS.amb[1], LS.amb[2]);
    gl.uniform3f(U.uWinC, LS.winC[0], LS.winC[1], LS.winC[2]);
    gl.uniform1f(U.uWin, 0);
    gl.uniform3f(U.uFog, bot[0], bot[1], bot[2]);
    gl.uniform2f(U.uFogR, D + 350, D + 3000);
    gl.uniform1f(U.uAlpha, 1);
    gl.uniform3f(U.uOff, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(U.uNDC, 1);
    gl.drawElements(gl.TRIANGLES, skyI, gl.UNSIGNED_SHORT, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.uniform1f(U.uNDC, 0);
    gl.uniform1f(U.uWin, LS.win);
    for (let i = 0; i < SQ.length; i += 2) {
      const pb = SQ[i];
      gl.bindBuffer(gl.ARRAY_BUFFER, pb.vb);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pb.ib);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
      gl.uniform3f(U.uOff, SQ[i + 1], 0, 0);
      gl.drawElements(gl.TRIANGLES, pb.n, gl.UNSIGNED_SHORT, 0);
    }
    gl.uniform3f(U.uOff, 0, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.drawElements(gl.TRIANGLES, worldI - skyI, gl.UNSIGNED_SHORT, skyI * 2);
    if (ni > worldI) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(U.uAlpha, 0.34);
      gl.drawElements(gl.TRIANGLES, ni - worldI, gl.UNSIGNED_SHORT, worldI * 2);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  };
  /* safety net: any exception or a blank (all-black) frame switches to the classic 2D renderer for good,
     so the player can never be left staring at a black screen */
  let errN = 0,
    chk = 0;
  function bail() {
    API.on = false;
    API.dead = true;
    if (cv3) cv3.style.display = "none";
    setTimeout(() => typeof resize === "function" && resize(), 0); // the 2D layer goes back to full resolution
  }
  function blank() {
    const px = new Uint8Array(4);
    let lit = 0;
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0.25, 0.6],
      [0.75, 0.6],
      [0.5, 0.2],
      [0.5, 0.9],
    ]) {
      gl.readPixels(
        Math.floor(cv3.width * fx),
        Math.floor(cv3.height * fy),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        px,
      );
      if (px[0] + px[1] + px[2] > 6) lit++;
    }
    return lit === 0;
  }
  API.render = function (dx, dy) {
    if (!API.on) return;
    try {
      renderInner(dx, dy);
      if (API.on && chk < 4 && ++chk >= 2 && blank()) bail();
    } catch (e) {
      if (++errN >= 3) bail();
    }
  };
  API.stats = () => ({ nv, ni, max: MAXV });
  if (init()) API.on = true;
  return API;
})();
const PIXEL_BUDGET = COARSE
  ? [900000, 700000, 520000, 360000]
  : [1500000, 1100000, 800000, 500000]; // canvas pixels per quality level
function setQuality(l) {
  l = Math.max(l, FLOOR);
  Q.level = l;
  Q.shadow = gfx === "ultra" && !COARSE && FX.shadow; // real shadowBlur is very expensive: only when the player explicitly picks ULTRA on desktop
  Q.flat = l >= 2;
  Q.dpr = [2, 1.75, 1.25, 1][Math.min(l, 3)];
  Q.maxP = [140, 70, 40, 24][Math.min(l, 3)] >> (CFG.lowmem ? 1 : 0);
  skyKey = "";
  gndKey = "";
  buildWeather();
  resize();
}
const glow = (c, b) => {
  if (Q.shadow) {
    ctx.shadowColor = c;
    ctx.shadowBlur = b;
  }
};
const noGlow = () => {
  if (Q.shadow) ctx.shadowBlur = 0;
};
const grad = (x0, y0, x1, y1, c0, c1) => {
  if (Q.flat) return c0;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
};
const GLOWS = {};
function glowSprite(c) {
  // pre-rendered soft glow: one cheap drawImage instead of shadowBlur
  if (!GLOWS[c]) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d"),
      gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, c + "cc");
    gr.addColorStop(0.4, c + "55");
    gr.addColorStop(1, c + "00");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    GLOWS[c] = cv;
  }
  return GLOWS[c];
}
const halo = (x, y, w, h, r, c) => {
  if (Q.shadow || Q.flat || !FX.bloom) return;
  const d = Math.max(w, h) * 2.3,
    cx = x + w / 2,
    cy = y + h / 2;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(glowSprite(c), cx - d / 2, cy - d / 2, d, d);
  ctx.globalAlpha = 1;
};
let hazPat = null;
function hazardPattern() {
  if (!hazPat) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 16;
    const g = cv.getContext("2d"),
      im = g.createImageData(16, 16);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4,
          dark = (x + y) % 16 < 8;
        im.data[i] = dark ? 23 : 255;
        im.data[i + 1] = dark ? 23 : 194;
        im.data[i + 2] = dark ? 31 : 26;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
    hazPat = ctx.createPattern(cv, "repeat");
  }
  return hazPat;
}

function resize() {
  const cw = Math.max(200, wrap.clientWidth),
    ch = Math.max(140, wrap.clientHeight);
  const oldG = groundY;
  /* phones held upright: a narrower world (400 instead of 560 units) draws the city, obstacles and hero ~40% larger */
  const minW = COARSE && window.innerHeight > window.innerWidth ? 400 : 560;
  let s = ch / 350,
    w = cw / s;
  if (w < minW) {
    s = cw / minW;
    w = minW;
  } else if (w > 1100) {
    s = cw / 1100;
    w = 1100;
  }
  S = s;
  W = w;
  H = ch / s;
  groundY = H - 58;
  UI = Math.max(1, 0.95 / s);
  {
    const sf = Math.min(1.4, Math.max(1, UI * 0.9 + 0.1));
    PS = 1.55 * sf;
    CPS = 1.5 * sf;
  }
  DPR = Math.min(window.devicePixelRatio || 1, Q.dpr, CFG.lowmem ? 1 : 9) * RS;
  const want = cw * ch * DPR * DPR,
    budget = PIXEL_BUDGET[Math.min(Q.level, 3)]; // hard cap on pixels drawn per frame (fill-rate is what freezes phones)
  if (want > budget) DPR = Math.max(0.5, DPR * Math.sqrt(budget / want));
  const nw = Math.round(cw * DPR),
    nh = Math.round(ch * DPR);
  /* with the 3D layer on, the 2D layer only carries HUD / particles / effects: it may be much coarser on phones
     (two full-resolution layers are what makes a phone's compositor and GPU run hot) */
  let ow = nw,
    oh = nh;
  if (GL3.on && COARSE) {
    const k = Math.min(1, 1.2 / DPR);
    ow = Math.max(1, Math.round(nw * k));
    oh = Math.max(1, Math.round(nh * k));
  }
  if (canvas.width !== ow || canvas.height !== oh) {
    canvas.width = ow;
    canvas.height = oh;
  }
  if (GL3.size) GL3.size(nw, nh);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (COARSE) ctx.imageSmoothingQuality = "low";
  player.x = Math.round(W < 500 ? 96 : Math.min(190, Math.max(125, W * 0.19))); // hero sits further left in the narrow phone world (more room to react)
  const dy = groundY - oldG;
  if (dy && obstacles) {
    obstacles.forEach((o) => {
      o.y += dy;
      if (o.by !== undefined) o.by += dy;
    });
    items.forEach((i) => (i.y += dy));
    player.y += dy;
    skyKey = "";
  }
}

/* ============ STORAGE / CONFIG ============ */
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
const rnd = (a, b) => Math.random() * (b - a) + a;
const fmt = (v) => String(Math.floor(v)).padStart(6, "0");

const DIFF = {
  easy: {
    get name() {
      return t("diffEasy");
    },
    base: 4.6,
    max: 9.5,
    gap: 1.25,
  },
  normal: {
    get name() {
      return t("diffNormal");
    },
    base: 5.3,
    max: 11,
    gap: 1,
  },
  hard: {
    get name() {
      return t("diffHard");
    },
    base: 6.2,
    max: 13,
    gap: 0.82,
  },
};
const THEMES = [
  {
    get n() {
      return t("city.tash");
    },
    city: "tash",
    wx: "leaf",
    night: 0,
    top: "#0f2a5c",
    bot: "#f2a766",
    a: "#53f7ff",
    b: "#ffb36b",
    body: [0.8, 0.55, 22, "#ffd9a0"],
  },
  {
    get n() {
      return t("city.sam");
    },
    city: "sam",
    wx: "spark",
    night: 0,
    top: "#2a2f78",
    bot: "#ffb066",
    a: "#ffd84f",
    b: "#22b8c4",
    body: [0.74, 0.56, 38, "#ffcf6a"],
  },
  {
    get n() {
      return t("city.bux");
    },
    city: "bux",
    wx: "dust",
    night: 0,
    top: "#1f3a63",
    bot: "#f7c47a",
    a: "#ffb36b",
    b: "#7aa5ff",
    body: [0.78, 0.52, 34, "#ffe29a"],
  },
  {
    get n() {
      return t("city.khi");
    },
    city: "khi",
    wx: "dust",
    night: 1,
    top: "#060a1c",
    bot: "#2b3a63",
    a: "#53f7ff",
    b: "#a78bfa",
    body: [0.82, 0.2, 22, "#e6ecff"],
  },
  {
    get n() {
      return t("city.khiN");
    },
    city: "khi",
    wx: "dust",
    night: 1,
    top: "#03050f",
    bot: "#101a34",
    a: "#8c7bff",
    b: "#53f7ff",
    body: [0.84, 0.2, 20, "#a9b4ff"],
  },
  {
    get n() {
      return t("city.tashN");
    },
    city: "tashN",
    wx: "rain",
    night: 1,
    top: "#050818",
    bot: "#2b2058",
    a: "#ff3b5c",
    b: "#ffb36b",
    body: [0.8, 0.2, 24, "#ff7a8a"],
  },
];
const FACTS = {
  get tash() {
    return t("fact.tash");
  },
  get tashN() {
    return t("fact.tash");
  },
  get sam() {
    return t("fact.sam");
  },
  get bux() {
    return t("fact.bux");
  },
  get khi() {
    return t("fact.khi");
  },
};
const POWER = {
  shield: { icon: "🛡", color: "#53f7ff", dur: 0 },
  slow: { icon: "⏳", color: "#a78bfa", dur: 5000 },
  x2: { icon: "×2", color: "#ffd84f", dur: 8000 },
  magnet: { icon: "🧲", color: "#ff4fd8", dur: 8000 },
  fuel: { icon: "⛽", color: "#ffb36b", dur: 0 },
  plov: { icon: "🍚", color: "#ffd84f", dur: 0 },
  hover: { icon: "🛹", color: "#53f7ff", dur: 9000 },
  box: { icon: "🎁", color: "#ff4fd8", dur: 0 },
};
const SKINS = [
  { id: "default", n: "ZUMARY", a: null, b: null, cost: 0 },
  {
    id: "rose",
    get n() {
      return t("skin.rose");
    },
    a: "#ff4fd8",
    b: "#ff8a5c",
    cost: 80,
  },
  {
    id: "mint",
    get n() {
      return t("skin.mint");
    },
    a: "#50ffb0",
    b: "#53f7ff",
    cost: 200,
  },
  {
    id: "gold",
    get n() {
      return t("skin.gold");
    },
    a: "#ffd84f",
    b: "#ff7a59",
    cost: 400,
  },
];

const PX_M = 30; // world pixels per metre
const LEVELS = [
  {
    get name() {
      return t("city.tash");
    },
    get tag() {
      return t("lvl.1");
    },
    len: 600,
    base: 4.8,
    max: 8,
    gap: 1.3,
    theme: 0,
    types: ["block"],
    coins: 25,
  },
  {
    get name() {
      return t("city.sam");
    },
    get tag() {
      return t("lvl.2");
    },
    len: 800,
    base: 5.3,
    max: 9.5,
    gap: 1.15,
    theme: 1,
    types: ["block", "drone", "double", "train", "damas"],
    coins: 35,
  },
  {
    get name() {
      return t("city.bux");
    },
    get tag() {
      return t("lvl.3");
    },
    len: 1000,
    base: 5.6,
    max: 10.5,
    gap: 1.1,
    theme: 2,
    types: ["block", "drone", "pit", "train", "damas"],
    coins: 45,
    g: 0.4,
    jump: [-10.8, -9.5],
  },
  {
    get name() {
      return t("city.khiN");
    },
    get tag() {
      return t("lvl.4");
    },
    len: 1200,
    base: 6,
    max: 11.5,
    gap: 1.05,
    theme: 4,
    types: ["block", "drone", "pit", "double", "train", "damas"],
    coins: 50,
    dark: true,
  },
  {
    get name() {
      return t("city.tashN");
    },
    get tag() {
      return t("lvl.5");
    },
    len: 1500,
    base: 6.2,
    max: 12,
    gap: 1.7,
    theme: 5,
    types: ["block", "pit", "drone", "train", "damas"],
    coins: 60,
    boss: true,
  },
];
let prog = store.get("zr_prog", { unlocked: 1, stars: {} });
let mode = store.get("zr_mode", "campaign");
let sel = store.get("zr_sel", 0);
if (mode !== "campaign" && mode !== "endless") mode = "campaign";
if (!(sel >= 0 && sel < LEVELS.length && sel <= prog.unlocked - 1)) sel = 0;

let up = store.get("zr_up", { jet: 0, fuel: 0, mag: 0, sh: 0, life: 0 });
const SHOP = [
  {
    k: "jet",
    get n() {
      return t("shop.jet.n");
    },
    get d() {
      return t("shop.jet.d");
    },
    max: 1,
    cost: [120],
  },
  {
    k: "fuel",
    get n() {
      return t("shop.fuel.n");
    },
    get d() {
      return t("shop.fuel.d");
    },
    max: 3,
    cost: [100, 200, 350],
  },
  {
    k: "mag",
    get n() {
      return t("shop.mag.n");
    },
    get d() {
      return t("shop.mag.d");
    },
    max: 2,
    cost: [90, 180],
  },
  {
    k: "sh",
    get n() {
      return t("shop.sh.n");
    },
    get d() {
      return t("shop.sh.d");
    },
    max: 1,
    cost: [150],
  },
  {
    k: "life",
    get n() {
      return t("shop.life.n");
    },
    get d() {
      return t("shop.life.d");
    },
    max: 1,
    cost: [300],
  },
  {
    k: "pet",
    get n() {
      return t("shop.pet.n");
    },
    get d() {
      return t("shop.pet.d");
    },
    max: 1,
    cost: [250],
  },
];
let diff = store.get("zr_diff", "normal");
if (!DIFF[diff]) diff = "normal";
let bests = store.get("zr_bests", {});
let board = store.get("zr_top", []);
let muted = store.get("zr_muted", false);
let wallet = store.get("zr_wallet", 0);
let owned = store.get("zr_owned", ["default"]);
let skin = store.get("zr_skin", "default");
if (!owned.includes(skin)) skin = "default";

/* ============ SOUND + HAPTICS ============ */
let ac = null,
  busS = null,
  busM = null,
  activeS = 0;
const CFG = Object.assign(
  {
    music: 0.6,
    sfx: 0.9,
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    left: false,
    vib: true,
  },
  store.get("zr_cfg", {}),
);
const saveCfg = () => store.set("zr_cfg", CFG);
/* ---- city look (day / sunset / dawn / night / neon / auto): chosen on the start screen or in Settings ---- */
if (!CFG.look) CFG.look = "day";
const LOOK_IDS = ["day", "sunset", "night", "dawn", "neon", "auto"],
  LOOK_ICO = {
    day: "☀️",
    sunset: "🌇",
    night: "🌙",
    dawn: "🌅",
    neon: "💜",
    auto: "🔄",
  };
{
  const nm = {
    day: ["Kun", "Day", "昼"],
    sunset: ["Shom", "Sunset", "夕焼け"],
    night: ["Kecha", "Night", "夜"],
    dawn: ["Tong", "Dawn", "夜明け"],
    neon: ["Neon", "Neon", "ネオン"],
    auto: ["Avto", "Auto", "自動"],
  };
  for (const k in nm) {
    I18N.uz["look." + k] = nm[k][0];
    I18N.en["look." + k] = nm[k][1];
    I18N.ja["look." + k] = nm[k][2];
  }
  I18N.uz["look.t"] = "SHAHAR MAVZUSI";
  I18N.en["look.t"] = "CITY LOOK";
  I18N.ja["look.t"] = "街のテーマ";
}
const lookChips = () =>
  LOOK_IDS.map(
    (k) =>
      `<button type="button" data-look="${k}" class="${CFG.look === k ? "on" : ""}"><i>${LOOK_ICO[k]}</i><span data-i18n="look.${k}">${t("look." + k)}</span></button>`,
  ).join("");
function setLook(k) {
  if (!LOOK_IDS.includes(k)) return;
  CFG.look = k;
  saveCfg();
  document
    .querySelectorAll("[data-look]")
    .forEach((b) => b.classList.toggle("on", b.dataset.look === k));
  document.body.dataset.look = k;
  if (typeof sfx !== "undefined" && sfx.tick) sfx.tick();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-look]");
  if (b) setLook(b.dataset.look);
});
{
  const bar = document.createElement("div");
  bar.className = "lookbar";
  bar.id = "lookBar";
  bar.innerHTML = `<div class="lookt" data-i18n="look.t">${t("look.t")}</div><div class="lookrow">${lookChips()}</div>`;
  const dbx = document.getElementById("dailyBox");
  if (dbx && dbx.parentNode) dbx.parentNode.insertBefore(bar, dbx);
  document.body.dataset.look = CFG.look;
}
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(),
      comp = ac.createDynamicsCompressor();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ac.destination);
    busS = ac.createGain();
    busM = ac.createGain();
    busS.connect(master);
    busM.connect(master);
  }
  busS.gain.value = CFG.sfx;
  busM.gain.value = CFG.music;
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function beep(
  f,
  d = 0.08,
  type = "square",
  v = 0.04,
  slide = 0,
  music = false,
) {
  if (muted || (music ? CFG.music : CFG.sfx) <= 0.001) return;
  if (!music && activeS > 10) return; // never pile up sound nodes on a slow phone
  try {
    const a = audio(),
      t0 = a.currentTime,
      o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slide)
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g);
    g.connect(music ? busM : busS);
    o.start(t0);
    o.stop(t0 + d + 0.02);
    if (!music) activeS++;
    o.onended = () => {
      if (!music) activeS--;
      g.disconnect();
    };
  } catch (e) {}
}
const vib = (ms) => {
  if (!muted && CFG.vib && navigator.vibrate)
    try {
      navigator.vibrate(ms);
    } catch (e) {}
};
const sfx = {
  jump: () => beep(380, 0.12, "square", 0.035, 280),
  jump2: () => beep(520, 0.12, "square", 0.035, 360),
  coin: () => {
    const k = 1 + Math.min(combo, 20) * 0.025;
    beep(880 * k, 0.07, "triangle", 0.05);
    setTimeout(() => beep(1320 * k, 0.09, "triangle", 0.05), 55);
  },
  power: () => {
    beep(500, 0.1, "sine", 0.06, 500);
    setTimeout(() => beep(900, 0.14, "sine", 0.06, 400), 90);
    vib(15);
  },
  hit: () => {
    beep(140, 0.35, "sawtooth", 0.07, -90);
    vib(60);
  },
  bonk: () => {
    beep(260, 0.07, "square", 0.07, -150);
    setTimeout(() => beep(110, 0.12, "sawtooth", 0.06, -50), 45);
    vib(25);
  },
  zone: () => {
    beep(440, 0.12, "triangle");
    setTimeout(() => beep(660, 0.12, "triangle"), 110);
    setTimeout(() => beep(880, 0.2, "triangle"), 220);
  },
};

/* ============ STATE ============ */
let state = "ready"; // ready | play | pause | over
let score, speed, frame, coins, combo, shake, invul, shield, banner, lastZone;
let airT = 0;
let lvl = null,
  dist = 0,
  lives = 1,
  hits = 0,
  shotTimer = 1500,
  darkKey = "",
  darkG = null;
let maxLives = 1,
  fuel = 0,
  flying = false,
  jumpHeld = false,
  sq = 0,
  zoom = 1,
  freeze = 0,
  hbT = 0,
  lastPhase = 0,
  shopOpen = false,
  curPanel = "shop",
  screenFn = null;
let prefetched = -1,
  extraGap = 0,
  cleanT = 0,
  boardT = 0,
  chaseX = -120,
  trainHint = false;
let spawnPx = 0,
  nextGapPx = 380,
  skill = 0.5,
  skillT = 0,
  hitFlag = false,
  runTime = 0,
  runDist = 0,
  runPhase = 0,
  landT = 0,
  prevLm = 0,
  fadeT = 0,
  prevA = null,
  acc = 0,
  slowW = 0,
  rafAvg = 16.7,
  skipDraw = false;
let shoutO = { text: "", t: 0, max: 1, c: "#fff" },
  flash = { c: "#fff", a: 0 };
let fx, obstacles, items, particles, pops, stars, layers;
let obstacleTimer,
  nextObstacle,
  itemTimer,
  nextItem,
  lastT = 0;
let duckKey = false,
  duckPtr = false,
  duckBtn = false;
let cur = { ...THEMES[0] };
let skyKey = "",
  skyG = null,
  gndKey = "",
  gndG = null;
let fpsAcc = 0,
  fpsN = 0;

const player = {
  x: 120,
  y: groundY - 44,
  w: 34,
  h: 44,
  vy: 0,
  g: 0.65,
  grounded: true,
  jumps: 2,
  pb: groundY,
  trail: [],
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (c1, c2, t) => {
  const a = hex(c1),
    b = hex(c2);
  return (
    "#" +
    a
      .map((v, i) =>
        Math.round(v + (b[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};

function makeLayer(n, hmin, hmax, wmin, wmax, mul, shade, windows) {
  const L = { mul, shade, windows, hmin, hmax, wmin, wmax, b: [] };
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(wmin, wmax);
    L.b.push({ x, w, h: rnd(hmin, hmax), seed: Math.random() * 99 });
    x += w + rnd(4, 16);
  }
  return L;
}
function buildWorld() {
  stars = Array.from({ length: COARSE ? 45 : 75 }, () => ({
    x: rnd(0, W),
    y: rnd(0, groundY * 0.7),
    s: rnd(0.3, 2),
    a: rnd(0.15, 0.8),
  }));
  layers = [];
  clouds = Array.from({ length: 5 }, () => ({
    x: rnd(0, W),
    y: rnd(20, groundY * 0.5),
    w: rnd(70, 150),
    s: rnd(0.02, 0.06),
  }));
  artFor(cur.city || "tash");
  lm = { city: cur.city || "tash", x: W * 0.55 };
  decor = [];
  farOff = midOff = gndOff = 0;
  buildWeather();
}

/* ============ EMOTION: shout, combo, music ============ */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fuelMax = () => 2200 + 800 * up.fuel;
function shout(text, c = "#ffd84f", ms = 1200) {
  shoutO = { text, c, t: ms, max: ms };
}
const COMBO_CALLS = {
  5: ["combo.5", "#53f7ff"],
  10: ["combo.10", "#ffd84f"],
  20: ["combo.20", "#ff4fd8"],
  35: ["combo.35", "#50ffb0"],
  50: ["combo.50", "#ff8a5c"],
};
function addCombo() {
  combo++;
  meta.bestCombo = Math.max(meta.bestCombo, combo);
  mMax("combo", combo);
  const c = COMBO_CALLS[combo];
  if (c) {
    shout(t(c[0]), c[1], 1100);
    flash = { c: c[1], a: 0.16 };
    zoom = 1.04;
    vib(20);
    [660, 880, 1100].forEach((f, i) =>
      setTimeout(() => beep(f, 0.1, "triangle", 0.05), i * 70),
    );
    burst(player.x + 17, player.y, c[1], 22);
    checkAch();
  }
}
let musicOn = false,
  musicStep = 0;
const noteHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function musicTick() {
  if (!musicOn || muted || state !== "play") {
    musicOn = false;
    return;
  }
  const roots = lvl ? [48, 50, 45, 43, 41] : [48, 50, 45, 43];
  const root = roots[lvl ? sel : Math.floor(score / 500) % 4];
  const st = musicStep++ % 16,
    pent = [0, 3, 5, 7, 10];
  if (st % 4 === 0)
    beep(
      noteHz(root - 12 + [0, 0, 5, 3][st >> 2]),
      0.18,
      "triangle",
      0.05,
      0,
      true,
    );
  if (st % 2 === 0 || (!COARSE && Math.random() < 0.35))
    beep(
      noteHz(root + 12 + pent[(st * 3 + (st >> 3)) % 5]),
      0.08,
      "square",
      0.012,
      0,
      true,
    );
  const bpm = 105 + Math.min(55, speed * 6) + (lvl && lvl.boss ? 15 : 0);
  setTimeout(musicTick, 60000 / bpm / 4);
}
function startMusic() {
  if (musicOn || muted) return;
  musicOn = true;
  musicStep = 0;
  musicTick();
}

/* ============ CITIES · WEATHER · PROGRESSION ============ */
let clouds = [],
  lm = { city: "tash", x: 400 },
  decor = [],
  wx = [],
  decorGap = 200;
let toastO = { text: "", t: 0, max: 1 };
const toastQ = [];
let turbo = 0,
  turboT = 0,
  revived = false,
  padRdy = false,
  pet = { x: 80, y: 200 };
const TURBO_MS = 3000,
  REVIVE_COST = 50;
const todayStr = (d = new Date()) =>
  d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
let meta = Object.assign(
  {
    time: 0,
    bestDist: 0,
    xp: 0,
    runs: 0,
    dist: 0,
    coinsTotal: 0,
    bestCombo: 0,
    flyMs: 0,
    bestScore: 0,
    streak: 0,
    lastDay: "",
    boxDay: "",
    mDay: "",
    missions: [],
    medals: {},
    wins: 0,
    turbos: 0,
  },
  store.get("zr_meta", {}),
);
const saveMeta = () => store.set("zr_meta", meta);

function toast(text) {
  toastQ.push(text);
}
function updateToast(delta) {
  if (toastO.t > 0) toastO.t -= delta;
  else if (toastQ.length) toastO = { text: toastQ.shift(), t: 2600, max: 2600 };
}

/* ---- daily missions ---- */
const MPOOL = [
  { k: "coin", t: (n) => t("m.coin", { n }), g: [25, 60], r: 40 },
  { k: "near", t: (n) => t("m.near", { n }), g: [3, 8], r: 45 },
  { k: "combo", t: (n) => t("m.combo", { n }), g: [12, 30], r: 50 },
  { k: "score", t: (n) => t("m.score", { n }), g: [400, 1200], r: 55 },
  { k: "turbo", t: (n) => t("m.turbo", { n }), g: [1, 3], r: 50 },
  { k: "fly", t: (n) => t("m.fly", { n }), g: [5, 12], r: 60, need: "jet" },
  { k: "win", t: (n) => t("m.win", { n }), g: [1, 2], r: 80 },
  { k: "rare", t: (n) => t("m.rare", { n }), g: [2, 5], r: 55 },
  { k: "evt", t: (n) => t("m.evt", { n }), g: [2, 4], r: 60 },
];
function genMissions() {
  const pool = MPOOL.filter((m) => !m.need || up[m.need]),
    out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({
      k: m.k,
      g: Math.round(rnd(m.g[0], m.g[1])),
      p: 0,
      done: 0,
      r: m.r,
    });
  }
  return out;
}
function checkM(m) {
  if (m.p >= m.g) {
    m.done = 1;
    wallet += m.r;
    store.set("zr_wallet", wallet);
    toast(t("mDone", { r: m.r }));
    sfx.zone();
    saveMeta();
  }
}
function mAdd(k, n) {
  for (const m of meta.missions)
    if (m.k === k && !m.done) {
      m.p += n;
      checkM(m);
    }
}
function mMax(k, v) {
  for (const m of meta.missions)
    if (m.k === k && !m.done) {
      m.p = Math.max(m.p, v);
      checkM(m);
    }
}

/* ---- medals ---- */
const ACH = [
  {
    id: "a1",
    get n() {
      return t("ach.a1.n");
    },
    get d() {
      return t("ach.a1.d");
    },
    ok: () => meta.bestScore >= 100,
    r: 20,
  },
  {
    id: "a2",
    get n() {
      return t("ach.a2.n");
    },
    get d() {
      return t("ach.a2.d");
    },
    ok: () => meta.bestScore >= 1000,
    r: 60,
  },
  {
    id: "a3",
    get n() {
      return t("ach.a3.n");
    },
    get d() {
      return t("ach.a3.d");
    },
    ok: () => meta.bestCombo >= 20,
    r: 40,
  },
  {
    id: "a4",
    get n() {
      return t("ach.a4.n");
    },
    get d() {
      return t("ach.a4.d");
    },
    ok: () => meta.bestCombo >= 50,
    r: 100,
  },
  {
    id: "a5",
    get n() {
      return t("ach.a5.n");
    },
    get d() {
      return t("ach.a5.d");
    },
    ok: () => meta.coinsTotal >= 500,
    r: 60,
  },
  {
    id: "a6",
    get n() {
      return t("ach.a6.n");
    },
    get d() {
      return t("ach.a6.d");
    },
    ok: () => meta.coinsTotal >= 2000,
    r: 150,
  },
  {
    id: "a7",
    get n() {
      return t("ach.a7.n");
    },
    get d() {
      return t("ach.a7.d");
    },
    ok: () => meta.flyMs >= 20000,
    r: 60,
  },
  {
    id: "a8",
    get n() {
      return t("ach.a8.n");
    },
    get d() {
      return t("ach.a8.d");
    },
    ok: () => (prog.stars[1] || 0) > 0,
    r: 40,
  },
  {
    id: "a9",
    get n() {
      return t("ach.a9.n");
    },
    get d() {
      return t("ach.a9.d");
    },
    ok: () => (prog.stars[5] || 0) > 0,
    r: 200,
  },
  {
    id: "a10",
    get n() {
      return t("ach.a10.n");
    },
    get d() {
      return t("ach.a10.d");
    },
    ok: () => meta.streak >= 3,
    r: 50,
  },
  {
    id: "a12",
    get n() {
      return t("ach.a12.n");
    },
    get d() {
      return t("ach.a12.d");
    },
    ok: () => (meta.events | 0) >= 10,
    r: 80,
  },
  {
    id: "a13",
    get n() {
      return t("ach.a13.n");
    },
    get d() {
      return t("ach.a13.d");
    },
    ok: () => (meta.rare | 0) >= 30,
    r: 90,
  },
  {
    id: "a11",
    get n() {
      return t("ach.a11.n");
    },
    get d() {
      return t("ach.a11.d");
    },
    ok: () => meta.turbos >= 5,
    r: 60,
  },
];
function checkAch() {
  let any = false;
  for (const a of ACH)
    if (!meta.medals[a.id] && a.ok()) {
      meta.medals[a.id] = 1;
      wallet += a.r;
      toast(`🏅 ${a.n}! +◎${a.r}`);
      any = true;
    }
  if (any) {
    store.set("zr_wallet", wallet);
    saveMeta();
    sfx.power();
  }
}

/* ---- XP + ranks ---- */
const RANKS = [
  ["rank.0", 0],
  ["rank.1", 100],
  ["rank.2", 300],
  ["rank.3", 700],
  ["rank.4", 1500],
  ["rank.5", 3000],
];
const rankOf = (xp) => {
  let i = 0;
  RANKS.forEach((r, j) => {
    if (xp >= r[1]) i = j;
  });
  return i;
};
function gainXp(n) {
  const before = rankOf(meta.xp);
  meta.xp += Math.max(0, Math.round(n));
  const after = rankOf(meta.xp);
  if (after > before) {
    toast(t("rankUpToast", { r: t(RANKS[after][0]) }));
    return RANKS[after][0];
  }
  return null;
}
const rkText = (rk) =>
  (rk.rank ? t("rankUpHtml", { r: t(rk.rank) }) : "") +
  t("xpLine", { n: rk.xp });
function bookRun(winBonus) {
  meta.runs++;
  meta.dist += Math.floor(runDist);
  meta.time += runTime;
  meta.bestDist = Math.max(meta.bestDist || 0, Math.floor(runDist));
  meta.coinsTotal += coins;
  meta.bestScore = Math.max(meta.bestScore, Math.floor(score));
  mMax("score", Math.floor(score));
  const xp = score / 10 + coins * 2 + (winBonus || 0);
  const rank = gainXp(xp);
  checkAch();
  saveMeta();
  return { rank, xp: Math.round(xp) };
}

/* ---- daily streak (runs once on load) ---- */
(function dailyInit() {
  const t = todayStr();
  if (meta.lastDay !== t) {
    const ys = todayStr(new Date(Date.now() - 864e5));
    meta.streak = meta.lastDay === ys ? meta.streak + 1 : 1;
    meta.lastDay = t;
  }
  if (meta.mDay !== t) {
    meta.mDay = t;
    meta.missions = genMissions();
  }
  checkAch();
  saveMeta();
})();

/* ---- turbo ---- */
function turboAdd(n) {
  if (turboT > 0) return;
  const was = turbo >= 100;
  turbo = Math.min(100, turbo + n);
  if (!was && turbo >= 100) {
    toast(t("turboReady"));
    beep(1200, 0.1, "triangle", 0.05);
    vib(20);
  }
}
function useTurbo() {
  if (state !== "play" || turbo < 100 || turboT > 0) return;
  turboT = TURBO_MS;
  meta.turbos++;
  mAdd("turbo", 1);
  flash = { c: "#53f7ff", a: 0.35 };
  zoom = 1.08;
  shout("TURBO!", "#53f7ff", 900);
  vib(40);
  [400, 600, 900, 1300].forEach((f, i) =>
    setTimeout(() => beep(f, 0.1, "sawtooth", 0.04), i * 50),
  );
  checkAch();
}

/* ---- scenery: real Uzbek skylines pre-rendered in art.js ---- */
let ART = null,
  farOff = 0,
  midOff = 0,
  gndOff = 0,
  birds = [];
const ARTOPT = { coarse: COARSE };
function artFor(city) {
  const c = Art.peek(city);
  if (c) {
    ART = c;
    return c;
  }
  if (!ART || !ART.far.width) {
    ART = Art.get(city, ARTOPT);
    return ART;
  } // first paint only
  Art.getAsync(city, ARTOPT); // otherwise build quietly in the background
  return ART;
}
function buildWeather() {
  const n = Q.level >= 2 ? 0 : Q.level === 1 ? 24 : COARSE ? 32 : 45;
  wx = Array.from({ length: n }, () => ({
    x: rnd(0, W),
    y: rnd(0, groundY),
    z: rnd(0.5, 1),
  }));
  birds = Array.from({ length: 6 }, () => ({
    x: rnd(0, W),
    y: rnd(30, groundY * 0.5),
    s: rnd(0.3, 0.8),
    ph: rnd(0, 6),
  }));
}
function moveScenery(d, f = 1) {
  farOff = (farOff + d * 0.1) % Art.TW;
  midOff = (midOff + d * 0.3) % Art.TW;
  gndOff = (gndOff + d) % Art.GW;
  for (const c of clouds) {
    c.x -= d * c.s;
    if (c.x + c.w < 0) {
      c.x = W + 20;
      c.y = rnd(20, groundY * 0.5);
    }
  }
  lm.x -= d * 0.18;
  prevLm -= d * 0.18;
  if (ART && lm.x < -ART.lmW * 0.9) lm.x = W + rnd(450, 900);
  for (const b of birds) {
    b.x -= d * 0.12 + b.s * f;
    if (b.x < -10) {
      b.x = W + 10;
      b.y = rnd(30, groundY * 0.5);
    }
  }
  const t = cur.wx;
  for (const p of wx) {
    if (t === "rain") {
      p.y += (9 + 6 * p.z) * f;
      p.x -= 2 * f;
    } else if (t === "leaf") {
      p.y += (0.8 + p.z) * f;
      p.x -= d * 0.35 + Math.sin(p.y * 0.05) * 0.9 * f;
    } else if (t === "dust") {
      p.x -= 6 * f + d * p.z;
      p.y += 0.2 * f;
    } else {
      p.y -= (0.4 + p.z * 0.6) * f;
      p.x -= d * 0.3;
    }
    if (p.y > groundY || p.y < -10 || p.x < -20) {
      if (t === "rain" || t === "leaf") {
        p.x = rnd(0, W + 80);
        p.y = -10;
      } else if (t === "dust") {
        p.x = W + rnd(0, 60);
        p.y = rnd(0, groundY);
      } else {
        p.x = rnd(0, W);
        p.y = groundY - rnd(0, 40);
      }
    }
  }
}
function drawSkyBody() {
  const b = cur.body || [0.84, 0.22, 26, "#fff"];
  const bx = W * b[0],
    by = Math.min(b[1] * H, groundY - 30),
    r = b[2] * Math.max(1, UI * 0.8);
  ctx.fillStyle = b[3];
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(bx, by, r * 2.4, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(bx, by, r * 1.5, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
}
const CLOUDSP = [null, null];
function cloudSprite(night) {
  // a cloud is painted once; every frame it is a single drawImage
  const k = night ? 1 : 0;
  if (!CLOUDSP[k]) {
    const cv = document.createElement("canvas");
    cv.width = 160;
    cv.height = 48;
    const g = cv.getContext("2d"),
      w = 100,
      cx = 80,
      cy = 28;
    g.fillStyle = night ? "#9fb0ff" : "#fff3e0";
    g.beginPath();
    g.ellipse(cx, cy, w * 0.5, w * 0.12, 0, 0, 7);
    g.ellipse(cx + w * 0.25, cy - w * 0.06, w * 0.3, w * 0.1, 0, 0, 7);
    g.ellipse(cx - w * 0.25, cy - w * 0.03, w * 0.28, w * 0.09, 0, 0, 7);
    g.fill();
    CLOUDSP[k] = cv;
  }
  return CLOUDSP[k];
}
function drawClouds() {
  const sp = cloudSprite(!!cur.night);
  ctx.globalAlpha = cur.night ? 0.06 : 0.13;
  for (const c of clouds) {
    const k = c.w / 100;
    if (c.x + 0.8 * c.w < 0 || c.x - 0.8 * c.w > W) continue; // off-screen clouds cost nothing
    ctx.drawImage(sp, c.x - 80 * k, c.y - 28 * k, 160 * k, 48 * k);
  }
  ctx.globalAlpha = 1;
}
function drawBirds() {
  if (cur.night) return;
  ctx.strokeStyle = "rgba(25,20,45,.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const b of birds) {
    const f = Math.sin(frame * 0.25 + b.ph) * 3;
    ctx.moveTo(b.x - 5, b.y + f * 0.3);
    ctx.quadraticCurveTo(b.x - 2, b.y - 3 - f, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 2, b.y - 3 - f, b.x + 5, b.y + f * 0.3);
  }
  ctx.stroke();
}
function drawWeather() {
  if (!wx.length || Q.level >= 2) return;
  const t = cur.wx;
  ctx.lineWidth = 1;
  if (t === "rain") {
    ctx.strokeStyle =
      cur.city === "tashN" ? "rgba(255,140,170,.32)" : "rgba(170,200,255,.35)";
    ctx.beginPath();
    for (const p of wx) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 3 * p.z, p.y + 13 * p.z);
    }
    ctx.stroke();
  } else if (t === "leaf") {
    ctx.fillStyle = "#e08a2c";
    ctx.globalAlpha = 0.8;
    for (const p of wx) ctx.fillRect(p.x, p.y, 3 + p.z * 2, 2 + p.z);
    ctx.globalAlpha = 1;
  } else if (t === "dust") {
    ctx.strokeStyle = "rgba(255,210,140,.2)";
    ctx.beginPath();
    for (const p of wx) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 14 + p.z * 16, p.y);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffe08a";
    for (const p of wx) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(frame * 0.05 + p.x));
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
function drawPet() {
  if (!up.pet || state === "ready") return;
  const s = Math.sin(frame * 1.4) * 8;
  glow("#ffb36b", 12);
  ctx.fillStyle = "#ffb36b";
  ctx.beginPath();
  ctx.arc(pet.x, pet.y, 7, 0, 7);
  ctx.fill();
  noGlow();
  ctx.fillStyle = "#10142c";
  ctx.fillRect(pet.x - 4, pet.y - 2, 8, 3.5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(pet.x - 2.5, pet.y - 1.5, 1.6, 1.6);
  ctx.fillRect(pet.x + 1, pet.y - 1.5, 1.6, 1.6);
  ctx.strokeStyle = "#ffd0c0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pet.x - s, pet.y - 9);
  ctx.lineTo(pet.x + s, pet.y - 9);
  ctx.stroke();
}
function drawTurboFx() {
  if (turboT <= 0) return;
  const p = player;
  ctx.strokeStyle = "#9ffcff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const y = p.y + 6 + (i * (p.h - 8)) / 5,
      l = 40 + ((frame * 9 + i * 31) % 60);
    ctx.moveTo(p.x - 6, y);
    ctx.lineTo(p.x - 6 - l, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#53f7ff";
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 34, p.h / 2 + 14, 0, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---- menu panels ---- */
function renderDaily() {
  const ri = rankOf(meta.xp),
    c0 = RANKS[ri][1],
    last = ri >= RANKS.length - 1,
    n0 = last ? c0 + 1 : RANKS[ri + 1][1];
  const pr = last ? 100 : Math.min(100, ((meta.xp - c0) / (n0 - c0)) * 100);
  const gift = meta.boxDay !== todayStr();
  return (
    `<div class="xp"><span>${t(RANKS[ri][0])}</span><i><b style="width:${pr}%"></b></i><em>${meta.xp} XP</em></div>` +
    `<div class="daily"><span>${t("daily.streak", { n: meta.streak })}</span>${gift ? `<button type="button" id="giftBtn">${t("daily.gift")}</button>` : `<span class="dim">${t("daily.tomorrow")}</span>`}</div>`
  );
}
function renderMissions() {
  return (
    `<div class="top-title">${t("missions.title")}</div><div class="shop">` +
    meta.missions
      .map((m) => {
        const def = MPOOL.find((x) => x.k === m.k),
          pr = Math.min(m.g, Math.floor(m.p));
        return `<div class="shop-row"><div><b>${def.t(m.g)}</b><small>${pr} / ${m.g} · ${t("missions.reward")} ◎${m.r}</small><i class="bar"><b style="width:${(pr / m.g) * 100}%"></b></i></div><button type="button" class="${m.done ? "done" : "lock"}">${m.done ? "✓" : "◎" + m.r}</button></div>`;
      })
      .join("") +
    `</div><p class="note">${t("missions.note")}</p>`
  );
}
function renderMedals() {
  const album =
    `<div class="top-title">${t("album.title")}</div><div class="album">` +
    LEVELS.map((L, i) => {
      const got = (prog.stars[i + 1] || 0) > 0,
        th = THUMBS[THEMES[L.theme].city];
      return `<div class="card-pc ${got ? "" : "lock"}" style="${th ? `background-image:url(${th})` : ""}"><span>${got ? L.name : "???"}</span></div>`;
    }).join("") +
    `</div>`;
  const fmtT = (ms) => {
    const sec = Math.floor(ms / 1000);
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  };
  const cell = (v, k) => `<div><b>${v}</b><small>${t(k)}</small></div>`;
  const st = `<div class="stats">${cell(meta.runs, "stats.runs")}${cell(meta.dist, "stats.dist")}${cell(meta.coinsTotal, "stats.coins")}${cell(meta.bestCombo, "stats.combo")}${cell(fmtT(meta.time), "stats.time")}${cell(meta.bestDist || 0, "stats.best")}</div>`;
  return (
    album +
    albumHtml() +
    `<div class="top-title">${t("stats.title")}</div>${st}<div class="top-title">${t("medals.title", { a: Object.keys(meta.medals).length, b: ACH.length })}</div><div class="shop">` +
    ACH.map(
      (a) =>
        `<div class="shop-row"><div><b>${meta.medals[a.id] ? "🏅" : "🔒"} ${a.n}</b><small>${a.d} · ◎${a.r}</small></div></div>`,
    ).join("") +
    `</div>`
  );
}
function renderSettings() {
  const row = (label, body) =>
    `<div class="shop-row"><div><b>${label}</b></div>${body}</div>`;
  const tog = (k, on) =>
    `<button type="button" class="tog${on ? " on" : ""}" data-cfg="${k}">${on ? t("set.on") : t("set.off")}</button>`;
  const rng = (k, v) =>
    `<input type="range" min="0" max="100" value="${Math.round(v * 100)}" data-vol="${k}" aria-label="${k}">`;
  return (
    `<div class="top-title">${t("panel.settings.t")}</div><div class="shop">` +
    row(t("set.music"), rng("music", CFG.music)) +
    row(t("set.sfx"), rng("sfx", CFG.sfx)) +
    row(
      t("set.gfx"),
      `<button type="button" class="tog on" data-act="gfx">${t("gfx." + gfx)}</button>`,
    ) +
    row(t("set.reduce"), tog("reduce", CFG.reduce)) +
    row(t("set.left"), tog("left", CFG.left)) +
    row(t("set.vib"), tog("vib", CFG.vib)) +
    `</div>`
  );
}
function showPanel(name) {
  curPanel = name;
  showOverlay(
    { shop: "🛒", missions: "📋", medals: "🏅", settings: "⚙️" }[name],
    t("panel." + name + ".t"),
    t("panel." + name + ".d"),
    t("back"),
    { panel: name },
  );
}

/* ============ CHASE · TRAINS · HOVERBOARD · MYSTERY BOX ============ */
function compactInPlace(a, keep) {
  let j = 0;
  for (let i = 0; i < a.length; i++) if (keep(a[i])) a[j++] = a[i];
  a.length = j;
  return a;
}
function chaseBark() {
  beep(180, 0.1, "sawtooth", 0.06, -70);
  setTimeout(() => beep(160, 0.12, "sawtooth", 0.06, -60), 140);
  vib(30);
}
function openBox(x, y) {
  const r = Math.random();
  burst(x, y, "#ff4fd8", 24);
  sfx.power();
  if (r < 0.3) {
    coins += 15;
    score += 150;
    pop(x, y - 14, "+◎15", "#ffd84f");
    shout("+◎15", "#ffd84f", 800);
  } else if (r < 0.5) {
    shield = true;
    shout(t("pw.shield"), "#53f7ff", 900);
  } else if (r < 0.65) {
    turbo = 100;
    shout(t("box.turbo"), "#53f7ff", 1000);
  } else if (r < 0.8) {
    boardT = 9000;
    shout(t("pw.hover"), "#53f7ff", 1000);
  } else if (r < 0.92) {
    if (lives < maxLives) {
      lives++;
      cleanT = 0;
    } else shield = true;
    shout(t("pw.plov"), "#ffd84f", 1000);
  } else {
    coins += 60;
    score += 600;
    shout(t("box.jackpot", { n: 60 }), "#ffd84f", 1300);
    flash = { c: "#ffd84f", a: 0.3 };
    zoom = 1.05;
  }
}
function drawDamas2D(o) {
  const x = o.x,
    y = o.y,
    w = o.w,
    h = o.h;
  ctx.fillStyle = "#eef2f8";
  rr(x, y + 14, w, h - 20, 5);
  ctx.fill();
  rr(x + 8, y, w - 12, 22, 5);
  ctx.fill();
  ctx.fillStyle = "#3b4f66";
  ctx.fillRect(x + 12, y + 5, w - 22, 11);
  ctx.fillStyle = "#2f6fd1";
  ctx.fillRect(x, y + 27, w, 3);
  ctx.fillStyle = "#ffe98a";
  ctx.fillRect(x - 1, y + 28, 4, 5);
  ctx.fillStyle = "#e23";
  ctx.fillRect(x + w - 2, y + 26, 3, 5);
  ctx.fillStyle = "#ffc21a";
  ctx.fillRect(x + w / 2 - 6, y - 3, 12, 3);
  ctx.fillStyle = "#15151c";
  for (const wx of [x + 17, x + w - 17]) {
    ctx.beginPath();
    ctx.arc(wx, y + h - 6, 7, 0, 7);
    ctx.fill();
  }
}
function drawTrain(o) {
  if (o.v === "damas") return drawDamas2D(o);
  // metro car: its roof is a platform you can run on
  ctx.fillStyle = "#2f6fd1";
  rr(o.x, o.y, o.w, o.h, 6);
  ctx.fill();
  ctx.fillStyle = "#e8eefc";
  ctx.fillRect(o.x, o.y + o.h - 16, o.w, 4);
  ctx.fillStyle = "#9fd0ff";
  for (let wx = o.x + 20; wx < o.x + o.w - 22; wx += 26) {
    rr(wx, o.y + 11, 17, 14, 3);
    ctx.fill();
  }
  ctx.fillStyle = "#1b3a7a";
  rr(o.x, o.y + 5, 13, o.h - 11, 4);
  ctx.fill();
  ctx.fillStyle = "#fff7b0";
  ctx.beginPath();
  ctx.arc(o.x + 5, o.y + o.h - 9, 3, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#0e1124";
  ctx.fillRect(o.x + 10, o.y + o.h - 3, o.w - 20, 3);
  ctx.fillStyle = "#cfe3ff";
  ctx.fillRect(o.x + 3, o.y, o.w - 6, 3);
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 1.4;
  rr(o.x, o.y, o.w, o.h, 6);
  ctx.stroke();
}
function drawBoard() {
  if (boardT <= 0 || state === "ready") return;
  if (boardT < 2000 && Math.floor(frame / 4) % 2) return;
  const p = player,
    bx = p.x - 5,
    by = p.y + p.h - 2;
  halo(bx, by, p.w + 10, 6, 0, "#53f7ff");
  ctx.fillStyle = "#53f7ff";
  rr(bx, by, p.w + 10, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = "#12307a";
  ctx.beginPath();
  ctx.arc(bx + 7, by + 6, 2.6, 0, 7);
  ctx.arc(bx + p.w + 3, by + 6, 2.6, 0, 7);
  ctx.fill();
}
function drawChaser() {
  // the guard and his dog (the closer they are, the fewer lives you have)
  if (state === "ready" || chaseX < -70) return;
  const G = guardSheet(),
    D = dogSheet(),
    gy = groundY,
    gx = chaseX + 26;
  const close = lives === 1 || state === "over" || state === "revive";
  halo(chaseX - 8, gy - 56, 80, 56, 0, "#ff3b5c");
  const caught = state === "over" || state === "revive";
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(gx + 4, gy + 3, 22, 4.2, 0, 0, 7);
  ctx.fill(); // ground shadows
  if (lives < maxLives || caught) {
    ctx.beginPath();
    ctx.ellipse(gx + 40, gy + 3, 24, 3.6, 0, 0, 7);
    ctx.fill();
  }
  if (caught && bustT > 150) {
    // the officer swings: leans in hard, then back, once per bonk
    const ph =
        Math.max(0, (bustT - BUST_FIRST + BUST_EVERY * 0.7) % BUST_EVERY) /
        BUST_EVERY,
      swing = Math.sin(Math.min(1, ph * 1.15) * Math.PI);
    ctx.save();
    ctx.translate(gx + 6, gy);
    ctx.rotate(0.03 + swing * (G.swing === undefined ? 0.42 : 0.2));
    ctx.translate(-gx - 6, -gy);
    ctx.drawImage(
      G.f[G.swing === undefined ? 0 : G.swing],
      gx - G.fx * CPS,
      gy - G.fy * CPS,
      G.w * CPS,
      G.h * CPS,
    );
    ctx.restore();
  } else
    ctx.drawImage(
      G.f[Math.floor((frame * 0.42 * (G.n || 8)) / 8) % (G.n || 8)],
      gx - G.fx * CPS,
      gy - G.fy * CPS,
      G.w * CPS,
      G.h * CPS,
    );
  if (lives < maxLives || caught) {
    const dn = D.n || 8,
      ds = D.snarl === undefined ? 8 : D.snarl;
    const di = caught
      ? ds + (Math.floor(bustT / 70) % dn)
      : (Math.floor((frame * 0.55 * dn) / 8) % dn) + (close ? ds : 0);
    const hop = caught ? Math.abs(Math.sin(bustT / 110)) * 14 * CPS : 0; // the dog jumps at the runner
    ctx.drawImage(
      D.f[di],
      gx + (caught ? 36 : 34) - D.fx * CPS,
      gy - hop - D.fy * CPS,
      D.w * CPS,
      D.h * CPS,
    );
  }
}

/* ============ HELPERS ============ */
const duck = () => duckKey || duckPtr || duckBtn;
const comboMult = () => 1 + Math.min(4, Math.floor(combo / 5));
const mult = () => comboMult() * (fx.x2 > 0 ? 2 : 1);
const hit = (a, b, pad = 0) =>
  a.x + pad < b.x + b.w &&
  a.x + a.w - pad > b.x &&
  a.y + pad < b.y + b.h &&
  a.y + a.h > b.y;
const rr = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
const skinColors = () => {
  const s = SKINS.find((k) => k.id === skin) || SKINS[0];
  return [s.a || cur.a, s.b || cur.b];
};

const PPOOL = [];
function spawnP(x, y, vx, vy, sz, life, color) {
  const q = PPOOL.pop() || {};
  q.x = x;
  q.y = y;
  q.vx = vx;
  q.vy = vy;
  q.s = sz;
  q.life = life;
  q.color = color;
  particles.push(q);
}
function burst(x, y, color, n = 12) {
  if (!FX.particles || particles.length > Q.maxP) return;
  if (CFG.reduce) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++)
    spawnP(x, y, rnd(-3, 3), rnd(-4, 2), rnd(2, 5), 1, color);
}
function pop(x, y, s, color) {
  pops.push({ x, y, s, color, life: 1 });
}

/* ============ SPAWNING ============ */
const mkCoin = (x, y) => rollCoin(x, y);

function endlessTypes() {
  return score < 150
    ? ["block"]
    : score < 250
      ? ["block", "block", "drone"]
      : score < 400
        ? ["block", "drone", "train", "block", "damas"]
        : ["block", "drone", "train", "double", "pit", "damas", "damas"];
}
function mkBlock(off) {
  // returns the end offset (px) of what it placed
  const tall = Math.random() > 0.55,
    h = tall ? rnd(45, 65) : rnd(28, 42),
    w = tall ? rnd(30, 40) : rnd(34, 46),
    sx = W + 20 + off;
  const v = tall
    ? Math.random() < 0.5
      ? "crate"
      : "hazard"
    : Math.random() < 0.5
      ? "cones"
      : "hazard";
  obstacles.push({
    t: "block",
    v,
    x: sx,
    y: groundY - h,
    w,
    h,
    passed: false,
    c: "#ff4fd8",
  });
  if (Math.random() < 0.55)
    for (let i = 0; i < 5; i++)
      items.push(
        mkCoin(
          sx + w / 2 + (i - 2) * 28,
          groundY - h - 28 - Math.sin((i / 4) * Math.PI) * 38,
        ),
      );
  return off + w;
}
function mkDrone(off) {
  const y = groundY - 52,
    sx = W + 20 + off;
  obstacles.push({
    t: "drone",
    x: sx,
    y,
    by: y,
    w: 44,
    h: 26,
    passed: false,
    c: "#ff7a59",
  });
  if (Math.random() < 0.7)
    for (let i = 0; i < 4; i++)
      items.push(mkCoin(sx + 8 + i * 26, groundY - 14));
  return off + 44;
}
function mkPit(off) {
  const w = rnd(95, 135),
    sx = W + 20 + off;
  obstacles.push({
    t: "pit",
    x: sx,
    y: groundY,
    w,
    h: 60,
    passed: false,
    c: "#ff3b5c",
  });
  for (let i = 0; i < 5; i++)
    items.push(
      mkCoin(
        sx + w / 2 + (i - 2) * 26,
        groundY - 50 - Math.sin((i / 4) * Math.PI) * 45,
      ),
    );
  return off + w;
}
function mkTrain(off) {
  const w = rnd(150, 210),
    h = 54,
    sx = W + 20 + off;
  obstacles.push({
    t: "train",
    x: sx,
    y: groundY - h,
    w,
    h,
    passed: false,
    c: "#2f6fd1",
  });
  for (let i = 0; i < Math.floor(w / 28) - 1; i++)
    items.push(mkCoin(sx + 24 + i * 28, groundY - h - 16));
  if (!trainHint) {
    trainHint = true;
    if (!store.get("zr_trh", 0)) {
      store.set("zr_trh", 1);
      FX.hints && shout(t("train.hint"), "#9fd0ff", 2400);
    }
  }
  return off + w;
}
/* Damas van: the classic Uzbek micro-van. Behaves like a metro car (its roof is a platform) but is short, a bit
   faster than the road and honks when it enters the screen. */
function mkDamas(off) {
  const w = rnd(98, 108),
    h = 48,
    sx = W + 20 + off;
  obstacles.push({
    t: "train",
    v: "damas",
    x: sx,
    y: groundY - h,
    w,
    h,
    passed: false,
    c: "#e9eef5",
    sp: 1.1,
  });
  for (let i = 0; i < 3; i++)
    items.push(mkCoin(sx + 20 + i * 22, groundY - h - 18));
  return off + w;
}
function spawnPattern() {
  // returns the length (px) of the pattern that was placed
  const types = lvl ? lvl.types : endlessTypes(),
    kind = types[Math.floor(Math.random() * types.length)];
  const jg = Math.max(4, speed) * 60 * 0.72 + 70; // room to land, react, and jump or duck again
  if (kind === "damas") return mkDamas(0);
  if (kind === "train") return mkTrain(0);
  if (kind === "pit") return mkPit(0);
  if (kind === "drone") {
    const e = mkDrone(0);
    return skill > 0.55 && Math.random() < 0.4 ? mkBlock(e + jg * 0.8) : e;
  }
  if (kind === "double") {
    const e = mkBlock(0);
    return mkBlock(e + 75);
  }
  const e = mkBlock(0);
  return skill > 0.45 && Math.random() < 0.3 * skill ? mkBlock(e + jg) : e;
}
function gapFor(len) {
  // distance-based: gaps grow with speed, so reaction time stays fair
  const s = Math.max(4, speed) * 60,
    mult = 1.28 - 0.55 * skill,
    g = lvl ? lvl.gap : DIFF[diff].gap;
  return len + s * 0.68 + 90 + rnd(40, 240) * mult * g;
}
function spawnShot(both) {
  const high = Math.random() < 0.5;
  const mk = (h, dx) =>
    obstacles.push({
      t: "shot",
      x: W - 150 + dx,
      y: h ? groundY - 50 : groundY - 26,
      w: 30,
      h: 16,
      passed: false,
      c: "#ff3b5c",
      sp: 1.45,
    });
  mk(high, 0);
  if (both) mk(!high, 120);
  burst(W - 150, groundY - 38, "#ffb36b", 6);
  beep(220, 0.08, "sawtooth", 0.03, -60);
}
function spawnPower() {
  const list = up.jet
    ? [
        "shield",
        "slow",
        "x2",
        "magnet",
        "plov",
        "hover",
        "hover",
        "fuel",
        "fuel",
      ]
    : ["shield", "slow", "x2", "magnet", "plov", "hover", "hover"];
  const k =
    Math.random() < 0.2 ? "box" : list[Math.floor(Math.random() * list.length)];
  items.push({ k, x: W + 30, y: groundY - rnd(55, 110), r: 15 });
}

/* ============ ACTIONS ============ */
/* ============ JUMP — buffered · coyote time · variable height ============ */
const J = { BUFFER: 140, COYOTE: 90, GAP: 120, MIN_HOLD: 70 }; // ms
let jumpBuf = -1e9,
  lastJumpAt = -1e9,
  coyote = 0,
  jumpAge = 0,
  simT = 0; // simT = simulated milliseconds
function resetInputs() {
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  jumpBuf = -1e9;
}
function startJump(n) {
  const p = player,
    jp = lvl && lvl.jump ? lvl.jump : [-13.4, -11.6];
  p.vy = n === 1 ? jp[0] : jp[1];
  p.jumps = n === 1 ? 1 : 0;
  p.grounded = false;
  coyote = 0;
  jumpAge = 0;
  lastJumpAt = simT;
  burst(
    p.x + p.w / 2,
    p.y + p.h,
    n === 1 ? "#53f7ff" : "#ff4fd8",
    n === 1 ? 8 : 6,
  );
  sq = -0.3;
  n === 1 ? sfx.jump() : sfx.jump2();
}
function tryJump() {
  const p = player;
  if (p.grounded || coyote > 0) {
    startJump(1);
    return true;
  }
  if (p.jumps > 0) {
    startJump(2);
    return true;
  } // deliberate double jump
  return false;
}
function consumeJump() {
  // runs inside every fixed physics step
  if (jumpBuf < -1e8) return;
  if (simT - jumpBuf > J.BUFFER) {
    jumpBuf = -1e9;
    return;
  }
  if (tryJump()) jumpBuf = -1e9;
}

/* ============ UPDATE ============ */
function scrollWorld(d, f = 1) {
  moveScenery(d, f);
  stars.forEach((s) => {
    s.x -= d * 0.05;
    if (s.x < 0) {
      s.x = W;
      s.y = rnd(0, groundY - 47);
    }
  });
  layers.forEach((L) => {
    L.b.forEach((b) => {
      b.x -= d * L.mul;
      if (b.x + b.w < 0) {
        let r = 0;
        for (const o of L.b) if (o.x + o.w > r) r = o.x + o.w;
        b.x = r + rnd(4, 16);
        b.w = rnd(L.wmin, L.wmax);
        b.h = rnd(L.hmin, L.hmax);
        b.seed = Math.random() * 99;
      }
    });
  });
}

function hurt(o) {
  const p = player;
  x10Hit();
  if (boardT > 0) {
    // the hoverboard takes the hit
    boardT = 0;
    invul = 1000;
    shake = 7;
    freeze = 90;
    flash = { c: "#53f7ff", a: 0.25 };
    burst(p.x + 17, p.y + p.h, "#53f7ff", 20);
    if (o.t === "pit") {
      p.vy = -11;
      p.grounded = false;
      p.jumps = 1;
    } else o.x = -999;
    sfx.hit();
    pop(p.x, p.y - 10, t("pop.boardBroke"), "#53f7ff");
    return false;
  }
  if (shield) {
    shield = false;
    invul = 900;
    shake = 9;
    burst(p.x + 17, p.y + 20, "#53f7ff", 24);
    if (o.t === "pit") {
      p.vy = -11;
      p.grounded = false;
      p.jumps = 1;
    } else o.x = -999;
    sfx.hit();
    pop(p.x, p.y - 10, t("pop.shieldBroke"), "#53f7ff");
    freeze = 140;
    flash = { c: "#53f7ff", a: 0.3 };
    zoom = 1.05;
    return false;
  }
  hits++;
  combo = 0;
  hitFlag = true;
  if (lives > 1) {
    lives--;
    cleanT = 0;
    invul = 1600;
    shake = 10;
    chaseBark();
    if (lives === 1 && maxLives > 1)
      setTimeout(() => {
        if (state === "play" && lives === 1)
          shout(t("chase.near"), "#ff6b8a", 1200);
      }, 800);
    burst(p.x + 17, p.y + 22, "#ff4fd8", 18);
    if (o.t === "pit") {
      p.vy = -12;
      p.grounded = false;
      p.jumps = 1;
    } else o.x = -999;
    sfx.hit();
    pop(p.x, p.y - 12, "♥ " + lives, "#ff6b8a");
    freeze = 110;
    flash = { c: "#ff3b5c", a: 0.45 };
    zoom = 1.06;
    shout(t("hurt"), "#ff6b8a", 700);
    return false;
  }
  endGame();
  return true;
}

/* ============ EXTRA FEATURES (light-weight) ============
   1 Damas van · 2 Golden Rush (15 coins in a row = x2 score) · 3 checkpoint heal every 500 m · 4 250 m fireworks bonus
   5 "new record" call-out · 6 jump / landing dust · 7 speed lines · 8 combo magnet (every 25 combo)
   9 clean-run shield (30 s without a hit) · 10 roof-rider bonus on a Damas · 11 honk + off-screen warning */
const T3 = (en, uz, ja) => (LANG === "uz" ? uz : LANG === "ja" ? ja : en);
const X10 = {
  run: 0,
  km: 0,
  best0: 0,
  rec: false,
  magK: 0,
  clean: 0,
  roof: 0,
  roofT: 0,
  g: true,
  air: 0,
};
function x10Reset() {
  Object.assign(X10, {
    run: 0,
    km: 0,
    best0: meta.bestScore | 0,
    rec: false,
    magK: 0,
    clean: 0,
    roof: 0,
    roofT: 0,
    g: true,
    air: 0,
  });
}
function x10Hit() {
  X10.run = 0;
  X10.clean = 0;
}
function x10Coin() {
  if (++X10.run === 15) {
    fx.x2 = Math.max(fx.x2, 6000);
    shout(
      T3("GOLDEN RUSH! ×2", "OLTIN YUGURISH! ×2", "ゴールデンラッシュ！×2"),
      "#ffd84f",
      1500,
    );
    flash = { c: "#ffd84f", a: 0.18 };
    burst(player.x + 17, player.y, "#ffd84f", 24);
    [784, 988, 1175, 1568].forEach((f, i) =>
      setTimeout(() => beep(f, 0.1, "triangle", 0.05), i * 60),
    );
    X10.run = 0;
  }
}
function x10Update(delta) {
  if (state !== "play") return;
  const p = player;
  /* jump / landing dust */
  if (X10.g && !p.grounded) burst(p.x + 17, p.y + p.h, "#e8eef7", 4);
  if (!X10.g && p.grounded && X10.air > 14)
    burst(p.x + 17, p.y + p.h, "#e8eef7", 6);
  X10.air = p.grounded ? 0 : X10.air + 1;
  X10.g = p.grounded;
  /* milestones */
  const km = Math.floor(dist / 250);
  if (km > X10.km) {
    X10.km = km;
    const g = 100 * mult();
    score += g;
    burst(player.x + 40, player.y - 20, "#ff4fd8", 12);
    burst(player.x + 40, player.y - 20, "#53f7ff", 12);
    burst(player.x + 40, player.y - 20, "#ffd84f", 12);
    pop(p.x + 30, p.y - 40, "+" + g, "#ffd84f");
    shout(Math.floor(dist) + " m!", "#9ff", 1100);
    if (km % 2 === 0) {
      if (lives < maxLives) {
        lives++;
        toast(
          T3(
            "Checkpoint: +1 life",
            "Nazorat nuqtasi: +1 jon",
            "チェックポイント：ライフ+1",
          ),
        );
      } else if (!shield) {
        shield = true;
        toast(
          T3(
            "Checkpoint: shield",
            "Nazorat nuqtasi: qalqon",
            "チェックポイント：シールド",
          ),
        );
      }
      beep(880, 0.12, "triangle", 0.05);
    }
  }
  /* new personal record */
  if (!X10.rec && X10.best0 >= 150 && score > X10.best0) {
    X10.rec = true;
    shout(T3("NEW RECORD!", "YANGI REKORD!", "新記録！"), "#ff4fd8", 1600);
    burst(player.x + 20, player.y - 10, "#ff4fd8", 26);
    vib(25);
  }
  /* combo magnet */
  const mk = Math.floor(combo / 25);
  if (mk > X10.magK) {
    fx.magnet = Math.max(fx.magnet, 4000);
    shout(
      T3("COMBO MAGNET!", "KOMBO MAGNIT!", "コンボマグネット！"),
      "#53f7ff",
      1200,
    );
  }
  X10.magK = mk;
  /* clean run */
  X10.clean += delta;
  if (X10.clean > 30000) {
    X10.clean = 0;
    if (!shield) {
      shield = true;
      shout(
        T3(
          "CLEAN RUN: SHIELD!",
          "TOZA YUGURISH: QALQON!",
          "ノーミス：シールド！",
        ),
        "#9fd0ff",
        1300,
      );
    }
  }
  /* roof rider + honk */
  const pcx = p.x + p.w / 2;
  let riding = false;
  for (const o of obstacles) {
    if (o.v !== "damas") continue;
    if (!o.honk && o.x < W + 40 && o.x > 0) {
      o.honk = true;
      beep(420, 0.12, "square", 0.04);
      setTimeout(() => beep(520, 0.16, "square", 0.04), 130);
    }
    if (p.grounded && pcx > o.x && pcx < o.x + o.w && p.y + p.h <= o.y + 2)
      riding = true;
  }
  if (riding) {
    X10.roofT += delta;
    if (X10.roofT > 500) {
      X10.roofT = 0;
      const g = 10 * mult();
      score += g;
      pop(p.x + 20, p.y - 26, T3("ROOF +", "TOM +", "屋根 +") + g, "#ffe98a");
    }
  } else X10.roofT = 0;
}
function x10Draw() {
  const fast =
    (speed > 8.5 || turboT > 0) &&
    FX.particles &&
    !CFG.reduce &&
    state === "play";
  if (fast) {
    ctx.strokeStyle =
      turboT > 0 ? "rgba(120,240,255,.5)" : "rgba(255,255,255,.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const x = W + 100 - ((frame * (16 + i * 4) + i * 211) % (W + 220)),
        y = 40 + ((i * 97) % Math.max(60, groundY - 80));
      ctx.moveTo(x, y);
      ctx.lineTo(x + 36 + i * 5, y);
    }
    ctx.stroke();
  }
  for (const o of obstacles)
    if (
      o.v === "damas" &&
      o.x > W - 10 &&
      o.x < W + 420 &&
      Math.floor(frame / 8) % 2
    ) {
      const x = W - 24,
        y = groundY - 62;
      ctx.fillStyle = "#ffc21a";
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x + 16, y + 12);
      ctx.lineTo(x - 16, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#17171f";
      ctx.font = "700 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", x, y + 9);
    }
}
/* ============ X11: ghost run · ZAP · parcel delivery · relic album ============ */
const RELICS = {
  tash: [
    ["📡", "Tashkent tower model", "Teleminora modeli", "テレビ塔の模型"],
    ["🚇", "Metro token", "Metro jetoni", "メトロのトークン"],
    ["🥟", "Golden samsa", "Oltin somsa", "黄金のサムサ"],
  ],
  sam: [
    ["🕌", "Registan tile", "Registon plitkasi", "レギスタンのタイル"],
    ["🧵", "Silk roll", "Ipak o'rami", "シルクの反物"],
    ["🥖", "Samarkand bread", "Samarqand noni", "サマルカンドのパン"],
  ],
  bux: [
    ["🏺", "Clay kuza", "Sopol ko'za", "陶器の壺"],
    ["🧣", "Zardozi scarf", "Zardo'zi ro'mol", "金糸刺繍のスカーフ"],
    ["🏛️", "Kalon minaret", "Kalon minorasi", "カラーン・ミナレット"],
  ],
  khi: [
    ["🍈", "Khiva melon", "Xiva qovuni", "ヒヴァのメロン"],
    ["🎩", "Fur telpak hat", "Telpak", "毛皮の帽子"],
    ["🗡️", "Khiva dagger", "Xiva xanjari", "ヒヴァの短剣"],
  ],
};
const PARCEL = {
  tash: ["🥟", "Somsa", "Somsa", "サムサ"],
  sam: ["🥖", "Bread", "Non", "パン"],
  bux: ["🍯", "Sweets", "Paxlava", "お菓子"],
  khi: ["🍈", "Melon", "Qovun", "メロン"],
};
const relicCity = () => (RELICS[cur.city] ? cur.city : "tash");
const X11 = {
  par: 0,
  zap: 0,
  nextPar: 90,
  nextRel: 260,
  ghost: store.get("zr_ghost", null),
  rec: [],
  recT: 0,
  beam: null,
  passed: false,
  btn: null,
};
function x11Reset() {
  Object.assign(X11, {
    par: 0,
    zap: 0,
    nextPar: 80 + Math.random() * 60,
    nextRel: 200 + Math.random() * 120,
    rec: [],
    recT: 0,
    beam: null,
    passed: false,
  });
}
function x11Coin() {
  X11.zap = Math.min(100, X11.zap + 6);
}
function x11Save() {
  /* keep the ghost of the best endless run */
  if (lvl || X11.rec.length < 20 || score <= X10.best0) return;
  const rec = X11.rec.length > 3000 ? X11.rec.slice(0, 3000) : X11.rec;
  X11.ghost = { s: Math.floor(score), r: rec };
  store.set("zr_ghost", X11.ghost);
}
function x11Zap() {
  if (state !== "play") return;
  if (X11.zap < 100) {
    pop(
      player.x + 20,
      player.y - 30,
      T3("charging…", "zaryad…", "充電中…"),
      "#8aa",
    );
    return;
  }
  let tgt = null;
  for (const o of obstacles)
    if (
      (o.t === "drone" || o.t === "shot" || o.t === "block") &&
      o.x + o.w > player.x + 10 &&
      o.x < W - 10 &&
      (!tgt || o.x < tgt.x)
    )
      tgt = o;
  if (!tgt) {
    pop(
      player.x + 20,
      player.y - 30,
      T3("no target", "nishon yo'q", "標的なし"),
      "#8aa",
    );
    return;
  }
  X11.zap = 0;
  const tx = tgt.x + tgt.w / 2,
    ty = tgt.y + tgt.h / 2;
  X11.beam = {
    x1: player.x + player.w,
    y1: player.y + 14,
    x2: tx,
    y2: ty,
    t: 220,
  };
  obstacles.splice(obstacles.indexOf(tgt), 1);
  burst(tx, ty, "#53f7ff", 22);
  burst(tx, ty, "#ffffff", 10);
  ring(tx, ty, "#53f7ff", 50);
  flash = { c: "#53f7ff", a: 0.16 };
  const g = 60 * mult();
  score += g;
  pop(tx, ty - 16, "ZAP +" + g, "#9ff");
  shake = Math.max(shake, 5);
  beep(1400, 0.08, "sawtooth", 0.05, -900);
  setTimeout(() => beep(300, 0.14, "square", 0.05, -150), 60);
  vib(20);
  meta.zaps = (meta.zaps | 0) + 1;
}
function x11Collect(it) {
  if (it.k === "parcel") {
    X11.par++;
    const pc = PARCEL[relicCity()];
    burst(it.x, it.y, "#ffe29a", 12);
    sfx.coin();
    if (X11.par >= 3) {
      X11.par = 0;
      const g = 300 * mult();
      score += g;
      coins += 10;
      meta.deliv = (meta.deliv | 0) + 1;
      saveMeta();
      shout(
        T3("DELIVERED! ", "YETKAZILDI! ", "配達完了！") + pc[0] + " +" + g,
        "#ffe29a",
        1700,
      );
      ring(it.x, it.y, "#ffe29a", 70);
      burst(it.x, it.y, "#ffd84f", 24);
      [659, 784, 988, 1319].forEach((f, i) =>
        setTimeout(() => beep(f, 0.1, "triangle", 0.05), i * 70),
      );
    } else pop(it.x, it.y - 14, pc[0] + " " + X11.par + "/3", "#ffe29a");
    return;
  }
  /* relic */
  meta.album = meta.album || {};
  meta.album[it.id] = 1;
  const [city, idx] = it.id.split(":"),
    r = RELICS[city][idx | 0];
  const full = RELICS[city].every((_, i) => meta.album[city + ":" + i]);
  shout(
    T3("NEW FIND: ", "YANGI TOPILMA: ", "発見：") +
      r[0] +
      " " +
      T3(r[1], r[2], r[3]),
    "#ffd84f",
    2000,
  );
  ring(it.x, it.y, "#ffd84f", 70);
  burst(it.x, it.y, "#ffd84f", 26);
  flash = { c: "#ffd84f", a: 0.16 };
  [523, 659, 784, 1047, 1319].forEach((f, i) =>
    setTimeout(() => beep(f, 0.12, "triangle", 0.055), i * 70),
  );
  if (full) {
    coins += 100;
    setTimeout(
      () =>
        shout(
          T3(
            "SET COMPLETE! +100",
            "TO'PLAM TUGADI! +100",
            "コンプリート！+100",
          ),
          "#ff4fd8",
          2000,
        ),
      1800,
    );
  }
  saveMeta();
}
function x11Update(delta) {
  const b = X11.btn;
  if (b) {
    const on = state === "play";
    b.classList.toggle("show", on);
    b.classList.toggle("rdy", X11.zap >= 100);
    b.style.setProperty("--c", X11.zap + "%");
  }
  if (state !== "play") return;
  const p = player;
  /* record this run (endless only) */
  if (!lvl) {
    X11.recT += delta;
    while (X11.recT >= 100) {
      X11.recT -= 100;
      X11.rec.push([
        Math.round(runDist * 10) / 10,
        Math.round(groundY - (p.y + p.h)),
      ]);
    }
  }
  /* spawn parcels and relics ahead */
  if (runDist > X11.nextPar) {
    X11.nextPar = runDist + 110 + Math.random() * 90;
    items.push({
      k: "parcel",
      x: W + 40,
      y: groundY - 52 - Math.random() * 34,
      r: 14,
    });
  }
  if (runDist > X11.nextRel) {
    X11.nextRel = runDist + 300 + Math.random() * 200;
    const c = relicCity(),
      al = meta.album || {},
      i = RELICS[c].findIndex((_, k) => !al[c + ":" + k]);
    if (i >= 0)
      items.push({
        k: "relic",
        id: c + ":" + i,
        e: RELICS[c][i][0],
        x: W + 40,
        y: groundY - 70,
        r: 17,
      });
  }
  if (X11.beam && (X11.beam.t -= delta) <= 0) X11.beam = null;
}
function ghostAt(t) {
  const g = X11.ghost && X11.ghost.r;
  if (!g || !g.length) return null;
  const f = t / 100,
    i = Math.min(g.length - 1, Math.floor(f)),
    j = Math.min(g.length - 1, i + 1),
    k = f - Math.floor(f);
  if (f > g.length + 5) return null;
  return [g[i][0] + (g[j][0] - g[i][0]) * k, g[i][1] + (g[j][1] - g[i][1]) * k];
}
function x11Draw() {
  const p = player;
  if (X11.beam) {
    const bm = X11.beam;
    ctx.save();
    ctx.globalAlpha = Math.min(1, bm.t / 120);
    ctx.strokeStyle = "#9ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bm.x1, bm.y1);
    ctx.lineTo(bm.x2, bm.y2);
    ctx.stroke();
    ctx.restore();
  }
  if (state !== "play") return;
  /* relic emoji on top of the 3D orb */
  ctx.textAlign = "center";
  ctx.font = "20px sans-serif";
  for (const it of items)
    if (it.k === "relic") ctx.fillText(it.e, it.x, it.y + 7);
    else if (it.k === "parcel")
      ctx.fillText(PARCEL[relicCity()][0], it.x, it.y + 6);
  /* ghost of the best run */
  if (lvl) return;
  const gh = ghostAt(runTime);
  if (!gh) return;
  const off = (gh[0] - runDist) * PX_M,
    gx = p.x + p.w / 2 + off,
    gy = groundY - gh[1];
  if (!X11.passed && off < -30 && runTime > 4000) {
    X11.passed = true;
    shout(
      T3("GHOST BEATEN!", "SPOKNI OZDINGIZ!", "ゴースト超え！"),
      "#53f7ff",
      1400,
    );
  }
  if (gx > -30 && gx < W + 30) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#53f7ff";
    ctx.beginPath();
    ctx.ellipse(gx, gy - 22, 11, 20, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gx + 3, gy - 48, 9, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#cfffff";
    ctx.font = "700 9px Orbitron, sans-serif";
    ctx.fillText(T3("BEST", "REKORD", "ベスト"), gx, gy - 62);
    ctx.restore();
  } else if (gx >= W + 30) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#53f7ff";
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("▶ " + Math.round(off / PX_M) + " m", W - 8, groundY - 70);
    ctx.restore();
  }
}
function albumHtml() {
  const al = meta.album || {};
  let n = 0;
  const cities = Object.keys(RELICS).map((c) => {
    const cells = RELICS[c]
      .map((r, i) => {
        const got = al[c + ":" + i];
        if (got) n++;
        return `<div class="rel${got ? " got" : ""}"><i>${got ? r[0] : "❔"}</i><small>${got ? T3(r[1], r[2], r[3]) : "???"}</small></div>`;
      })
      .join("");
    return `<div class="relrow"><b>${{ tash: "TASHKENT", sam: "SAMARKAND", bux: "BUKHARA", khi: "KHIVA" }[c]}</b>${cells}</div>`;
  });
  return (
    `<div class="top-title">${T3("RELIC ALBUM", "KOLLEKSIYA ALBOMI", "コレクション")} · ${n}/12</div><div class="relalbum">` +
    cities.join("") +
    `</div><div class="stats"><div><b>${meta.deliv | 0}</b><small>${T3("deliveries", "yetkazmalar", "配達")}</small></div><div><b>${meta.zaps | 0}</b><small>ZAP</small></div></div>`
  );
}
{
  const w = document.getElementById("wrap");
  if (w) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "zapBtn";
    b.className = "zapbtn";
    b.innerHTML = "<i>🎯</i><span>ZAP</span>";
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      x11Zap();
    });
    w.appendChild(b);
    X11.btn = b;
  }
}
function updateGame(delta) {
  const f = Math.min(delta / 16.67, 2);
  frame += f;

  fx.slow = Math.max(0, fx.slow - delta);
  fx.x2 = Math.max(0, fx.x2 - delta);
  fx.magnet = Math.max(0, fx.magnet - delta);
  WE_update(delta, f);
  invul = Math.max(0, invul - delta);
  if (boardT > 0) boardT -= delta;
  cleanT += delta;
  x10Update(delta);
  x11Update(delta);
  if (cleanT > 14000 && lives < maxLives) {
    lives++;
    cleanT = 0;
    toast(t("chase.back"));
    beep(500, 0.1, "triangle", 0.05);
  }
  if (turboT > 0) {
    turboT -= delta;
    if (turboT <= 0) {
      turboT = 0;
      turbo = 0;
      invul = Math.max(invul, 900);
      zoom = 1.04;
    }
  }
  if (maxLives > 1 && lives === 1) {
    hbT -= delta;
    if (hbT <= 0) {
      hbT = 900;
      beep(70, 0.12, "sine", 0.08);
      vib(10);
    }
  }
  banner.t = Math.max(0, banner.t - delta);

  const cfg = lvl || DIFF[diff];
  score += f * 0.12 * WE.score;
  speed = lvl
    ? lvl.base + (lvl.max - lvl.base) * Math.min(1, dist / lvl.len)
    : Math.min(cfg.base + score / 180, cfg.max);
  const ev = speed * (fx.slow > 0 ? 0.65 : 1) * (turboT > 0 ? 1.7 : 1) * WE.spd;
  runTime += delta;
  runDist += (ev * f) / PX_M;

  let T;
  if (lvl) {
    dist += (ev * f) / PX_M;
    T = THEMES[lvl.theme];
  } else {
    const zone = Math.floor(score / 500) % 4;
    if (zone !== lastZone) {
      lastZone = zone;
      banner = { text: THEMES[zone].n, sub: t("newCity"), t: 2200, max: 2200 };
      sfx.zone();
    }
    T = THEMES[zone];
  }
  cur.wx = T.wx;
  cur.body = T.body;
  cur.night = T.night;
  if (cur.city !== T.city) {
    prevA = ART;
    prevLm = lm.x;
    fadeT = 1;
    cur.city = T.city;
    lm = { city: T.city, x: W + 420 };
    decor = [];
  }
  if (!lvl && score % 500 > 380) {
    const nz = (Math.floor(score / 500) + 1) % 4;
    if (prefetched !== nz) {
      prefetched = nz;
      Art.getAsync(THEMES[nz].city, ARTOPT);
    }
  }
  if (cur.wx === "rain" && Math.random() < 0.0025)
    flash = { c: "#cfe0ff", a: 0.2 };
  if (cur.top !== T.top || cur.a !== T.a || cur.b !== T.b || cur.bot !== T.bot)
    ["top", "bot", "a", "b"].forEach((k) => (cur[k] = mix(cur[k], T[k], 0.04)));

  scrollWorld(ev * f, f);

  const p = player;
  let floorY = groundY;
  const pcx0 = p.x + p.w / 2;
  for (const o of obstacles)
    if (
      o.t === "train" &&
      pcx0 > o.x + 3 &&
      pcx0 < o.x + o.w - 3 &&
      p.pb <= o.y + 10 &&
      o.y < floorY
    )
      floorY = o.y;
  if (p.grounded && p.y + p.h < floorY - 0.6) {
    p.grounded = false;
    coyote = J.COYOTE;
  } // the train ended: fall, but allow a late jump
  p.h = p.grounded && duck() ? 24 : 44;
  if (p.grounded) p.y = floorY - p.h;
  consumeJump();
  flying = !!up.jet && fuel > 0 && jumpHeld && !p.grounded && p.jumps <= 0;
  if (flying) {
    fuel = Math.max(0, fuel - delta);
    meta.flyMs += delta;
    mAdd("fly", delta / 1000);
    p.vy += ((duck() ? 4.5 : -3.8) - p.vy) * 0.18 * f;
    if (frame % 2 < f && particles.length < Q.maxP + 40)
      spawnP(
        p.x + 8 + rnd(0, 18),
        p.y + p.h,
        rnd(-0.6, 0.6),
        rnd(1.5, 3),
        rnd(3, 6),
        0.8,
        Math.random() < 0.5 ? "#ffb36b" : "#ff4fd8",
      );
  } else {
    let gm = duck() && !p.grounded ? 2.2 : 1;
    if (p.vy < 0) {
      jumpAge += delta;
      if (!jumpHeld && jumpAge > J.MIN_HOLD) gm = 1.6;
    } // release early = shorter hop, never a useless one
    p.vy += p.g * gm * f;
  }
  p.y += p.vy * f;
  if (p.y < 12) {
    p.y = 12;
    if (p.vy < 0) p.vy = 0;
  }
  if (p.y + p.h >= floorY) {
    if (!p.grounded && p.vy > 3) {
      burst(p.x + p.w / 2, floorY, "#a78bfa", 5);
      sq = Math.min(0.45, p.vy / 30);
      landT = 110;
    }
    p.y = floorY - p.h;
    p.vy = 0;
    p.grounded = true;
    p.jumps = 2;
  } else p.grounded = false;
  p.pb = p.y + p.h;
  if (coyote > 0) coyote -= delta;
  if (landT > 0) landT -= delta;
  runPhase += Math.min(ev, 9) * f * 0.075;
  if (p.grounded && Q.level < 2 && frame % 6 < f)
    spawnP(
      p.x + 8,
      floorY - 1,
      -rnd(1.2, 2.4),
      -rnd(0.4, 1.2),
      rnd(2, 3.4),
      0.5,
      "#c9b99a",
    );
  if (p.grounded && fuel < fuelMax())
    fuel = Math.min(fuelMax(), fuel + delta * 1.4);
  sq *= Math.pow(0.82, f);

  // stop spawning near the finish line so the last stretch is clear
  const spawning = lvl ? (lvl.len - dist) * PX_M > W * 0.95 : true;
  spawnPx += ev * f;
  if (spawning && spawnPx >= nextGapPx) {
    spawnPx = 0;
    nextGapPx = gapFor(spawnPattern());
  }
  skillT += delta; // dynamic difficulty: ease off after mistakes, tighten after clean play
  if (skillT > 8000) {
    skillT = 0;
    skill = Math.max(0.15, Math.min(1, skill + (hitFlag ? -0.14 : 0.07)));
    hitFlag = false;
  }
  if (fadeT > 0) fadeT = Math.max(0, fadeT - delta / 1800);
  itemTimer += delta;
  if (spawning && itemTimer >= nextItem) {
    spawnPower();
    itemTimer = 0;
    nextItem = rnd(9000, 14000);
  }
  if (lvl && lvl.boss && spawning) {
    const hp = 1 - Math.min(1, dist / lvl.len),
      ph = hp < 0.34 ? 2 : hp < 0.67 ? 1 : 0;
    if (ph !== lastPhase) {
      lastPhase = ph;
      shout(ph === 2 ? t("boss.mad") : t("boss.stronger"), "#ff6b8a", 1600);
      flash = { c: "#ff3b5c", a: 0.25 };
      zoom = 1.05;
      shake = 8;
    }
    shotTimer -= delta * (1 + ph * 0.3);
    if (shotTimer <= 0) {
      spawnShot(ph === 2 && Math.random() < 0.4);
      shotTimer = rnd(1100, 1700) * Math.max(0.7, 5.5 / speed);
    }
  }

  const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 };
  const pcx = p.x + p.w / 2,
    pcy = p.y + p.h / 2;
  for (const o of obstacles) {
    o.x -= ev * f * (o.sp || 1);
    if (o.t === "drone") o.y = o.by + Math.sin(frame * 0.1) * 4;
    if (turboT > 0 && o.t !== "pit" && o.x > -900 && hit(box, o, 0)) {
      const ox = o.x,
        oy = o.y;
      o.x = -999;
      score += 15;
      shake = 5;
      burst(ox + 10, oy + 10, "#53f7ff", 14);
      beep(300, 0.06, "square", 0.04);
      continue;
    }
    if (invul <= 0 && turboT <= 0) {
      if (o.t === "pit") {
        if (p.grounded && pcx > o.x + 6 && pcx < o.x + o.w - 6 && hurt(o))
          return;
      } else if (
        hit(box, o, 3) &&
        !(o.t === "train" && p.y + p.h <= o.y + 12)
      ) {
        if (hurt(o)) return;
      } else if (
        o.t !== "train" &&
        box.x - 7 < o.x + o.w &&
        box.x + box.w + 7 > o.x &&
        box.y - 7 < o.y + o.h &&
        box.y + box.h + 7 > o.y
      )
        o.near = true;
    }
    if (!o.passed && o.x + o.w < p.x) {
      o.passed = true;
      addCombo();
      turboAdd(2);
      const g = 10 * mult();
      score += g;
      pop(p.x + 20, p.y - 14, "+" + g, "#c7edff");
      if (o.near && o.t !== "pit") {
        score += 20;
        turboAdd(10);
        mAdd("near", 1);
        pop(p.x + 44, p.y - 36, t("pop.near"), "#ffd84f");
        beep(1000, 0.07, "triangle", 0.04);
      }
    }
  }
  /* air-time bonus: a long, high jump pays out when you land (cheap: one counter, one pop-up) */
  if (p.grounded) {
    if (airT > 46 && state === "play") {
      const g = Math.min(80, Math.round(airT / 4) * 2) * mult();
      score += g;
      turboAdd(6);
      pop(p.x + 20, p.y - 30, "AIR +" + g, "#9ff");
      beep(740, 0.06, "triangle", 0.035);
    }
    airT = 0;
  } else airT += f;
  compactInPlace(obstacles, (o) => o.x + o.w > -10);

  for (const it of items) {
    it.x -= ev * f;
    if (it.k === "coin" && (fx.magnet > 0 || turboT > 0)) {
      const dx = pcx - it.x,
        dy = pcy - it.y,
        d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) {
        it.x += (dx / d) * 9 * f;
        it.y += (dy / d) * 9 * f;
      }
    }
    if (it.k === "coin" && up.pet) {
      const pd = Math.hypot(it.x - pet.x, it.y - pet.y);
      if (pd < 90 && pd > 1) {
        it.x += ((pet.x - it.x) / pd) * 5 * f;
        it.y += ((pet.y - it.y) / pd) * 5 * f;
      }
    }
    const grab =
      (Math.abs(it.x - pcx) < it.r + p.w / 2 - 3 &&
        Math.abs(it.y - pcy) < it.r + p.h / 2 - 3) ||
      (it.k === "coin" &&
        up.pet &&
        Math.hypot(it.x - pet.x, it.y - pet.y) < it.r + 11);
    if (grab) {
      it.got = true;
      if (it.k === "coin") {
        coinCollect(it);
      } else if (it.k === "parcel" || it.k === "relic") {
        x11Collect(it);
      } else {
        if (it.k === "shield") shield = true;
        else if (it.k === "fuel") fuel = fuelMax();
        else if (it.k === "plov") {
          if (lives < maxLives) {
            lives++;
            cleanT = 0;
            shout(t("plov1"), "#ffd84f", 1000);
          } else {
            shield = true;
            shout(t("plov2"), "#ffd84f", 1000);
          }
        } else if (it.k === "hover") {
          boardT = 9000;
          shout(t("pw.hover"), "#53f7ff", 900);
        } else if (it.k === "box") openBox(it.x, it.y);
        else
          fx[it.k] = POWER[it.k].dur + (it.k === "magnet" ? 3000 * up.mag : 0);
        burst(it.x, it.y, POWER[it.k].color, 18);
        sfx.power();
        pop(it.x, it.y - 12, t("pw." + it.k), POWER[it.k].color);
      }
    }
  }
  compactInPlace(items, (i) => !i.got && i.x > -30);

  if (lvl && dist >= lvl.len) {
    winLevel();
    return;
  }
  updateParticles(delta);
  if (frame % 3 < f) updateHUD();
}

let bustT = 0,
  bustHit = 0; // "caught!" scene: time since the officer and the dog caught up with the runner
const BUST_FIRST = 360,
  BUST_EVERY = 240; // ms until the first bonk, and between bonks
function updateBust(delta) {
  bustT += delta;
  const p = player;
  if (p.y + p.h < groundY - 1)
    p.y += Math.min(groundY - p.h - p.y, 6 * (delta / 16.67)); // the runner drops to the ground
  if (bustT >= BUST_FIRST + bustHit * BUST_EVERY && bustHit < 6) {
    bustHit++;
    sfx.bonk();
    shake = Math.max(shake, 7);
    const hx = p.x + p.w / 2,
      hy = p.y - 8;
    burst(hx, hy, "#ffd84f", 10);
    burst(hx, hy, "#ffffff", 5);
    pop(
      hx + (bustHit % 2 ? -38 : 34),
      hy - 30 - (bustHit % 3) * 12,
      t("bust.hit"),
      bustHit % 2 ? "#ffd84f" : "#ff8ad8",
    );
  }
}
function updateParticles(delta) {
  const f = delta / 16.67;
  if (state === "over" || state === "revive") updateBust(delta);
  for (const q of particles) {
    q.x += q.vx * f;
    q.y += q.vy * f;
    q.vy += 0.12 * f;
    q.life -= 0.025 * f;
  }
  {
    let j = 0;
    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      if (q.life > 0) particles[j++] = q;
      else if (PPOOL.length < 200) PPOOL.push(q);
    }
    particles.length = j;
  }
  for (const q of pops) {
    q.y -= 0.8 * f;
    q.life -= 0.018 * f;
  }
  compactInPlace(pops, (q) => q.life > 0);
  shake = Math.max(0, shake - 0.5 * f);
  flash.a = Math.max(0, flash.a - 0.03 * f);
  updateToast(delta);
  {
    const nearX = Math.max(22, player.x - 96),
      midX = Math.max(6, player.x - 175);
    const caught = state === "over" || state === "revive";
    const tx = caught
      ? player.x - 88
      : lives >= maxLives
        ? -120
        : lives === 1
          ? nearX
          : midX;
    chaseX += (tx - chaseX) * Math.min(1, (caught ? 0.14 : 0.05) * f); // when it is over they rush in faster
  }
  if (up.pet) {
    pet.x += (player.x - 34 - pet.x) * 0.12 * f;
    pet.y += (player.y - 18 + Math.sin(frame * 0.1) * 5 - pet.y) * 0.12 * f;
  }
  zoom = 1 + (zoom - 1) * Math.pow(0.9, f);
  shoutO.t = Math.max(0, shoutO.t - delta);
  if (state !== "play") sq *= Math.pow(0.82, f);
}

const hudEl = {
  score: $("score"),
  best: $("best"),
  speed: $("speed"),
  coins: $("coins"),
};
const hudLast = {};
function setHud(k, v) {
  if (hudLast[k] !== v) {
    hudLast[k] = v;
    hudEl[k].textContent = v;
  }
}
function updateHUD() {
  setHud("score", fmt(score));
  setHud(
    "best",
    fmt(
      Math.max(
        bests[bestKey()] || 0,
        state === "play" || state === "over" || state === "won" ? score : 0,
      ),
    ),
  );
  setHud("speed", ((speed * (fx.slow > 0 ? 0.65 : 1)) / 5).toFixed(1) + "x");
  setHud("coins", String(coins));
  const rdy = turbo >= 100 && turboT <= 0 && state === "play";
  if (rdy !== padRdy) {
    padRdy = rdy;
    $("padTurbo").classList.toggle("ready", rdy);
  }
}

/* ============ DRAW ============ */
function drawCity(A, lmx, a) {
  const sc = Math.max(1, Math.min(1.5, groundY / 292)),
    tw = Art.TW * sc;
  const fx0 = -(farOff * sc),
    mx0 = -(midOff * sc),
    fh = Art.FAR_H * sc,
    mh = Art.MID_H * sc;
  if (a < 1) ctx.globalAlpha = a;
  ctx.drawImage(A.far, fx0, groundY - fh, tw, fh);
  if (fx0 + tw < W) ctx.drawImage(A.far, fx0 + tw, groundY - fh, tw, fh);
  const ls = Math.min(1.45, (groundY - 14) / A.lmH),
    lw = A.lmW * ls,
    lh = A.lmH * ls;
  if (lmx + lw / 2 > 0 && lmx - lw / 2 < W)
    ctx.drawImage(A.lm, lmx - lw / 2, groundY - lh, lw, lh);
  ctx.drawImage(A.mid, mx0, groundY - mh, tw, mh);
  if (mx0 + tw < W) ctx.drawImage(A.mid, mx0 + tw, groundY - mh, tw, mh);
  ctx.fillStyle = A.gBase;
  ctx.fillRect(-20, groundY, W + 40, H - groundY + 24);
  for (let x = -(gndOff % Art.GW); x < W + Art.GW; x += Art.GW)
    ctx.drawImage(A.gnd, x, groundY, Art.GW, Art.GH);
  if (a < 1) ctx.globalAlpha = 1;
}
function drawBackground() {
  const A = artFor(cur.city || "tash");
  const key = cur.top + cur.bot + groundY + Q.flat;
  if (key !== skyKey) {
    skyKey = key;
    if (Q.flat) skyG = cur.top;
    else {
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      g.addColorStop(0, cur.top);
      g.addColorStop(0.6, mix(cur.top, cur.bot, 0.5));
      g.addColorStop(1, cur.bot);
      skyG = g;
    }
  }
  ctx.fillStyle = skyG;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  if (cur.night) {
    ctx.fillStyle = "#c7edff";
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  if (FX.blur && speed >= 8 && Q.level < 2 && state === "play") {
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = Math.min(10, Math.floor((speed - 7) * 3));
    for (let i = 0; i < n; i++) {
      const x = W - ((frame * speed * 2.5 + i * 137) % (W + 140)),
        y = 14 + ((i * 53.7) % (groundY - 40));
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + speed * 4, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawSkyBody();
  if (Q.level < 2 && FX.bg) {
    drawClouds();
    drawBirds();
  }
  drawCity(A, lm.x, 1);
  if (fadeT > 0 && prevA && prevA !== A && prevA.far.width)
    drawCity(prevA, prevLm, fadeT); // smooth city-to-city transition
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.fillRect(-20, groundY, W + 40, 2);
}

// on-screen sprite scale: set in resize() (bigger on small / portrait phones); hitboxes stay the same                          // on-screen sprite scale (hitboxes stay the same)
const CSC = COARSE ? 1.5 : 2; // sprite density (phones use less memory)
let RUN = null,
  RUN_SKIN = "",
  GRD = null,
  DOGS = null,
  COINSP = null;
const BADGES = {},
  OBST = {},
  HEARTS = {};
/* real PNG characters (sprites.js) are used when enabled and loaded; otherwise the painted ones from chars.js */
const IMG =
  typeof Sprites !== "undefined" ? Sprites : { get: () => null, preload() {} }; // sprites.js missing? the game still runs with the painted characters
const RIGX = typeof Rig !== "undefined" ? Rig : null; // rig.js: realistic skeleton characters (falls back to pictures / painted ones if it is missing)
const rigTry = (fn) => {
  try {
    return fn();
  } catch (e) {
    return null;
  }
};
const runnerSheet = () =>
  (RIGX && rigTry(() => RIGX.runner(skin, CSC))) ||
  IMG.get("runner", skin, CSC) ||
  (!RUN || RUN_SKIN !== skin
    ? ((RUN = Chars.runner(skin, CSC)), (RUN_SKIN = skin), RUN)
    : RUN);
const badgeOf = (k) =>
  BADGES[k] || (BADGES[k] = Chars.badge(POWER[k].icon, POWER[k].color, CSC));
const heartSprite = (f) => HEARTS[f] || (HEARTS[f] = Chars.heart(f, CSC));
const obstSprite = (v) => OBST[v] || (OBST[v] = Chars.obstacle(v, CSC));
const coinSheet = () =>
  COINSP ||
  (COINSP = (RIGX && rigTry(() => RIGX.coins(CSC))) || Chars.coins(CSC));
const guardSheet = () =>
  (RIGX && rigTry(() => RIGX.guard(CSC))) ||
  IMG.get("guard", "default", CSC) ||
  GRD ||
  (GRD = Chars.guard(CSC));
const dogSheet = () =>
  (RIGX && rigTry(() => RIGX.dog(CSC))) ||
  IMG.get("dog", "default", CSC) ||
  DOGS ||
  (DOGS = Chars.dogs(CSC));
IMG.preload(); // start loading the image characters while the menu is shown
function skinGlow() {
  const sk = SKINS.find((k) => k.id === skin) || SKINS[0];
  return sk.b || cur.b;
}
function playerFrame() {
  // rig: 0-11 stride · 12 jump · 13 fall · 14 land · 15 slide · 16 hit  (painted: 0-7 · 8 · 9 · 10 · 11 · 12)
  const R = runnerSheet(),
    n = R.n || 8,
    F = R.n ? R : { jump: 8, fall: 9, land: 10, duck: 11, hit: 12 };
  if (state === "over" || state === "revive") return F.hit;
  const p = player;
  if (!p.grounded) return flying || p.vy < -1 ? F.jump : F.fall;
  if (landT > 0) return F.land;
  if (p.h < 40) return F.duck;
  return Math.floor((runPhase * n) / 8) % n;
}
function drawPlayer() {
  const p = player,
    R = runnerSheet(),
    pb = skinGlow();
  const sy = p.grounded ? p.y + p.h : groundY,
    hg = Math.max(0, sy - (p.y + p.h));
  const g3 = GL3.on;
  if (FX.shadow && !g3) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(
      p.x + p.w / 2,
      sy + 3,
      Math.max(10, 26 - hg * 0.07),
      5,
      0,
      0,
      7,
    );
    ctx.fill();
  }
  if (FX.charFx && !Q.flat && state !== "over" && !g3) {
    // wet-road reflection: one flipped, faded copy of the runner sprite mirrored about the ground line (cheap depth cue)
    ctx.save();
    ctx.globalAlpha = 0.17;
    ctx.translate(p.x + p.w / 2, sy);
    ctx.scale(1, -0.5);
    ctx.drawImage(
      R.f[playerFrame()],
      -R.fx * PS,
      -R.fy * PS - hg,
      R.w * PS,
      R.h * PS,
    );
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h);
  ctx.scale(1 + sq * 0.5, 1 - sq * 0.5); // squash & stretch
  if ((state === "over" || state === "revive") && bustT > 0) {
    // being bonked: the runner wobbles and squashes with every hit
    const since = (bustT - BUST_FIRST) % BUST_EVERY,
      kick = bustT >= BUST_FIRST ? Math.max(0, 1 - since / 150) : 0;
    ctx.rotate(Math.sin(bustT / 55) * 0.05 * (0.4 + kick) - kick * 0.08);
    ctx.scale(1 + kick * 0.1, 1 - kick * 0.12);
  }
  ctx.globalAlpha = invul > 0 && Math.floor(frame / 3) % 2 ? 0.35 : 1;
  if (!g3) {
    if (FX.charFx) halo(-p.w / 2, -p.h, p.w, p.h, 8, pb);
    if (FX.charFx) glow(pb, 20);
    ctx.drawImage(
      R.f[playerFrame()],
      -R.fx * PS,
      -R.fy * PS,
      R.w * PS,
      R.h * PS,
    );
  }
  noGlow();
  ctx.globalAlpha = 1;
  if (shield) {
    ctx.strokeStyle = "#53f7ff";
    ctx.lineWidth = 2;
    glow("#53f7ff", 16);
    ctx.globalAlpha = 0.6 + Math.sin(frame * 0.2) * 0.25;
    ctx.beginPath();
    ctx.ellipse(0, -p.h / 2, 34, p.h / 2 + 12, 0, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    noGlow();
  }
  ctx.restore();
  if ((state === "over" || state === "revive") && bustT > BUST_FIRST - 80) {
    // dizzy stars circling the runner's head
    ctx.fillStyle = "#ffd84f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(15 * UI)}px sans-serif`;
    for (let i = 0; i < 3; i++) {
      const a = bustT / 170 + (i * Math.PI * 2) / 3;
      ctx.fillText(
        "★",
        p.x + p.w / 2 + Math.cos(a) * 26,
        p.y - 22 + Math.sin(a) * 7,
      );
    }
  }
  if (!g3) drawBoard();
  drawFuelBar();
  if (FX.charFx) {
    drawPet();
    drawTurboFx();
  }
}

function drawFuelBar() {
  if (!up.jet || state !== "play" || (!flying && fuel >= fuelMax() - 1)) return;
  const p = player,
    w = 44,
    x = p.x + p.w / 2 - w / 2,
    y = p.y - 14,
    pr = fuel / fuelMax();
  ctx.fillStyle = "rgba(10,14,34,.75)";
  rr(x - 1, y - 1, w + 2, 7, 4);
  ctx.fill();
  ctx.fillStyle = pr < 0.25 ? "#ff3b5c" : "#ffb36b";
  if (pr > 0.02) {
    rr(x, y, w * pr, 5, 3);
    ctx.fill();
  }
}

function stripes(x, y, w, h, c1, c2, sw) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  for (let k = -h; k < w + h; k += sw * 2) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + sw, y + h);
    ctx.lineTo(x + k + sw + h, y);
    ctx.lineTo(x + k + h, y);
    ctx.fill();
  }
  ctx.restore();
}
function drawObstacles() {
  const blink = Math.floor(frame / 14) % 2;
  for (const o of obstacles) {
    if (o.t === "pit") {
      ctx.fillStyle = "#02030a";
      ctx.fillRect(o.x, groundY - 1, o.w, H - groundY + 24);
      stripes(o.x - 6, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5);
      stripes(o.x + o.w, groundY - 1, 6, 26, "#ffc21a", "#17171f", 5);
      continue;
    }
    if (o.t === "train") {
      drawTrain(o);
      continue;
    }
    halo(o.x, o.y, o.w, o.h, 0, "#ff3b5c");
    glow("#ff3b5c", 14);
    if (o.t === "block") {
      ctx.drawImage(obstSprite(o.v || "hazard"), o.x, o.y, o.w, o.h);
      noGlow();
      if (o.v !== "cones") {
        ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a";
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y - 4, 3.2, 0, 7);
        ctx.fill();
      }
    } else if (o.t === "drone") {
      ctx.fillStyle = "#3a1226";
      rr(o.x, o.y, o.w, o.h, 11);
      ctx.fill();
      noGlow();
      ctx.strokeStyle = "#ff3b5c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#12040a";
      rr(o.x + 7, o.y + 8, o.w - 14, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(
        o.x + o.w / 2 - 3 + Math.sin(frame * 0.2) * 9,
        o.y + 10,
        6,
        4,
      );
      ctx.strokeStyle = "#ffd0c0";
      ctx.lineWidth = 2;
      const s = Math.sin(frame * 1.2) * 12;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2 - s, o.y - 4);
      ctx.lineTo(o.x + o.w / 2 + s, o.y - 4);
      ctx.stroke();
      ctx.fillStyle = blink ? "#ff3b3b" : "#7a1a1a";
      ctx.beginPath();
      ctx.arc(o.x + 5, o.y + 3, 2.4, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff5a3c";
      rr(o.x, o.y, o.w, o.h, 8);
      ctx.fill();
      noGlow();
      ctx.fillStyle = "#ffd08a";
      rr(o.x + 6, o.y + 4, o.w - 12, o.h - 8, 4);
      ctx.fill();
      ctx.fillStyle = "#ffb36b";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(o.x + o.w, o.y + 4, 16 + Math.sin(frame) * 4, 8);
      ctx.globalAlpha = 1;
    }
    noGlow();
  }
}

function drawItems() {
  const CN = coinSheet();
  for (const it of items) {
    if (it.k === "parcel" || it.k === "relic") {
      ctx.fillStyle =
        it.k === "relic" ? "rgba(255,216,79,.45)" : "rgba(255,226,154,.4)";
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r + 6, 0, 7);
      ctx.fill();
      continue;
    }
    if (it.k === "coin" && it.ct) {
      const fr = coinTypeSheets()[it.ct],
        sz = it.ct === 3 ? 40 : 34;
      if (FX.coinGlow)
        halo(
          it.x - it.r,
          it.y - it.r,
          it.r * 2,
          it.r * 2,
          0,
          COIN_T[it.ct].col,
        );
      ctx.drawImage(
        fr[
          Math.floor(frame * (it.ct === 2 ? 0.26 : 0.18) + it.x * 0.05) %
            fr.length
        ],
        it.x - sz / 2,
        it.y - sz / 2,
        sz,
        sz,
      );
    } else if (it.k === "coin") {
      if (FX.coinGlow)
        halo(it.x - it.r, it.y - it.r, it.r * 2, it.r * 2, 0, "#ffd84f");
      ctx.drawImage(
        CN.n[Math.floor(frame * 0.18 + it.x * 0.05) % CN.n.length],
        it.x - 13,
        it.y - 13,
        26,
        26,
      );
    } else {
      const bob = Math.sin(frame * 0.1 + it.x) * 3;
      if (FX.coinGlow)
        halo(
          it.x - it.r,
          it.y - it.r + bob,
          it.r * 2,
          it.r * 2,
          0,
          POWER[it.k].color,
        );
      ctx.drawImage(badgeOf(it.k), it.x - 19, it.y + bob - 19, 38, 38);
    }
  }
}
function drawParticles() {
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, q.s, q.s);
  }
  ctx.globalAlpha = 1;
  if (pops.length) {
    ctx.font = `700 ${Math.round(13 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const q of pops) {
      ctx.globalAlpha = Math.max(0, q.life);
      ctx.fillStyle = q.color;
      ctx.fillText(q.s, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawFinish() {
  if (!lvl) return;
  const gx = player.x + (lvl.len - dist) * PX_M;
  if (gx > W + 80) return;
  ctx.fillStyle = "#fff";
  ctx.fillRect(gx, groundY - 112, 6, 112);
  ctx.fillRect(gx + 104, groundY - 112, 6, 112);
  for (let i = 0; i < 11; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#fff" : "#10142c";
      ctx.fillRect(gx + 6 + i * 9, groundY - 112 + j * 12, 9, 12);
    }
  ctx.fillStyle = cur.a;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(gx + 6, groundY - 88, 98, 88);
  ctx.globalAlpha = 1;
  ctx.font = `700 ${Math.round(12 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(t("hud.finish"), gx + 55, groundY - 60);
}

function drawBoss() {
  if (!(lvl && lvl.boss) || state === "ready" || state === "won") return;
  const bw = 120,
    bh = 86,
    x = W - 78,
    y = H * 0.34 + Math.sin(frame * 0.05) * 12;
  const charging = state === "play" && shotTimer < 350;
  halo(x - bw / 2, y - bh / 2, bw, bh, 22, "#ff3b5c");
  glow("#ff3b5c", 26);
  ctx.fillStyle = grad(
    x - bw / 2,
    y - bh / 2,
    x + bw / 2,
    y + bh / 2,
    "#ff3b5c",
    "#5a0f24",
  );
  rr(x - bw / 2, y - bh / 2, bw, bh, 22);
  ctx.fill();
  noGlow();
  ctx.fillStyle = "#12040a";
  rr(x - bw / 2 + 14, y - 16, bw - 28, 22, 10);
  ctx.fill();
  ctx.fillStyle = charging ? "#fff" : "#ffb36b";
  ctx.beginPath();
  ctx.arc(x + Math.sin(frame * 0.08) * 22, y - 5, 6, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#2a0a14";
  ctx.fillRect(x - bw / 2 - 16, y + 8, 22, 14);
  if (charging) {
    ctx.fillStyle = "#ffb36b";
    ctx.beginPath();
    ctx.arc(x - bw / 2 - 16, y + 15, 8 + Math.sin(frame) * 2, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = "#ffb36b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 20, y - bh / 2);
  ctx.lineTo(x - 28, y - bh / 2 - 14);
  ctx.moveTo(x + 20, y - bh / 2);
  ctx.lineTo(x + 28, y - bh / 2 - 14);
  ctx.stroke();
}

function drawDark() {
  if (!(lvl && lvl.dark) || state === "ready") return;
  const cx = player.x + W * 0.16,
    cy = groundY - 50,
    r = W * 0.55;
  const k = cx + "|" + cy + "|" + r + "|" + Q.flat;
  if (k !== darkKey) {
    darkKey = k;
    if (Q.flat) darkG = "rgba(0,0,0,.5)";
    else {
      const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.6, "rgba(0,0,0,.6)");
      g.addColorStop(1, "rgba(0,0,0,.94)");
      darkG = g;
    }
  }
  ctx.fillStyle = darkG;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

function drawHUD() {
  const u = UI,
    m = 14 * u;
  ctx.textBaseline = "middle";
  let row = m + 8 * u;
  if (state !== "ready") {
    // health: slim segmented bar (one segment per life)
    const segs = Math.min(maxLives, 6),
      sw = (segs > 3 ? 20 : 28) * u,
      sh = 7 * u,
      gp = 3 * u,
      by = row + 9 * u;
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(8.5 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillText(t("hud.health"), m, row);
    for (let i = 0; i < segs; i++) {
      const x = m + i * (sw + gp);
      ctx.fillStyle = "rgba(0,0,0,.6)";
      rr(x - 1.2 * u, by - 1.2 * u, sw + 2.4 * u, sh + 2.4 * u, 2 * u);
      ctx.fill();
      if (i < lives) {
        ctx.fillStyle =
          lives === 1 && maxLives > 1
            ? Math.floor(frame / 18) % 2
              ? "#ff3b3b"
              : "#ff9a9a"
            : lives / maxLives < 0.67
              ? "#ffd34a"
              : "#46e08c";
        rr(x, by, sw, sh, 1.6 * u);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.fillRect(x, by, sw, sh * 0.38);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.lineWidth = 1;
        rr(x, by, sw, sh, 1.6 * u);
        ctx.stroke();
      }
    }
    row = by + sh + 13 * u;
  }
  if (combo >= 2 && state !== "ready") {
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(14 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = mult() > 1 ? "#ffd84f" : "#c7edff";
    ctx.fillText(t("hud.combo") + " " + combo + "  ×" + mult(), m, row);
  }
  if (state === "play" || state === "pause") {
    const bw = 110 * u,
      ty = row + 20 * u,
      pr = turboT > 0 ? turboT / TURBO_MS : turbo / 100;
    ctx.fillStyle = "rgba(10,14,34,.7)";
    rr(m, ty - 4 * u, bw, 8 * u, 4 * u);
    ctx.fill();
    ctx.fillStyle = turboT > 0 ? "#fff" : turbo >= 100 ? "#53f7ff" : "#3b8fa0";
    if (pr > 0.02) {
      rr(m, ty - 4 * u, bw * pr, 8 * u, 4 * u);
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(9 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(
      turboT > 0
        ? "TURBO!"
        : turbo >= 100
          ? t("hud.turboReady")
          : t("hud.turbo"),
      m + bw + 6 * u,
      ty,
    );
  }
  // level progress / boss health
  if (lvl && state !== "ready") {
    const bw = Math.min(W * 0.34, 300),
      x0 = (W - bw) / 2,
      y0 = m,
      pr = Math.min(1, dist / lvl.len);
    ctx.fillStyle = "rgba(10,14,34,.7)";
    rr(x0, y0, bw, 9 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = lvl.boss ? "#ff3b5c" : cur.a;
    const fw = lvl.boss ? bw * (1 - pr) : bw * pr;
    if (fw > 2) {
      rr(x0, y0, fw, 9 * u, 5 * u);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.font = `600 ${Math.round(10 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = "#c7edff";
    ctx.fillText(
      lvl.boss
        ? "ZUMARY-X"
        : `${Math.min(lvl.len, Math.floor(dist))} / ${lvl.len} m`,
      W / 2,
      y0 + 20 * u,
    );
  }
  let x = W - m;
  ctx.textAlign = "center";
  const list = [];
  if (shield) list.push(["shield", 1]);
  if (boardT > 0) list.push(["hover", boardT / 9000]);
  for (const k of ["slow", "x2", "magnet"])
    if (fx[k] > 0) list.push([k, fx[k] / POWER[k].dur]);
  for (const [k, pct] of list) {
    const P = POWER[k],
      bw = 36 * u,
      bh = 30 * u;
    x -= bw + 4 * u;
    ctx.fillStyle = "rgba(10,14,34,.75)";
    rr(x, m - 4 * u, bw, bh, 8 * u);
    ctx.fill();
    ctx.drawImage(
      badgeOf(k),
      x + bw / 2 - 12 * u,
      m - 4 * u + 2 * u,
      24 * u,
      24 * u,
    );
    ctx.fillStyle = P.color;
    ctx.fillRect(
      x + 5 * u,
      m - 4 * u + bh - 6 * u,
      (bw - 10 * u) * Math.min(1, pct),
      3 * u,
    );
  }
  if (state === "play" && maxLives > 1 && (lives < maxLives || chaseX > -70)) {
    // wanted level: stars light up as the police close in
    const lit = Math.min(5, maxLives - lives + 1),
      sz = Math.round(15 * u),
      flash2 = lives === 1 && Math.floor(frame / 16) % 2;
    ctx.textAlign = "right";
    ctx.font = `700 ${sz}px sans-serif`;
    ctx.textBaseline = "middle";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle =
        i < lit
          ? lives === 1
            ? flash2
              ? "#ff4a5a"
              : "#4a8bff"
            : "#ffd84f"
          : "rgba(255,255,255,.2)";
      ctx.fillText("★", W - m - (4 - i) * (sz + 1 * u) + 0, m + 42 * u);
    }
  }
  if (banner.t > 0) {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, banner.t / 500, (banner.max - banner.t) / 300 + 0.2),
    );
    ctx.fillStyle = cur.a;
    glow(cur.a, 20);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(26 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(banner.text, W / 2, H * 0.3);
    ctx.font = `500 ${Math.round(11 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillText(banner.sub || "", W / 2, H * 0.3 + 28 * u);
    noGlow();
    ctx.globalAlpha = 1;
  }
  if (shoutO.t > 0) {
    const el = shoutO.max - shoutO.t,
      k = el < 180 ? 1 + 0.5 * (1 - el / 180) : 1;
    ctx.globalAlpha = Math.min(1, shoutO.t / 350);
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(Math.min(30 * u, (W * 0.92) / (shoutO.text.length * 0.78)) * k)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = shoutO.c;
    glow(shoutO.c, 18);
    ctx.fillText(shoutO.text, W / 2, H * 0.5);
    noGlow();
    ctx.globalAlpha = 1;
  }
  if (toastO.t > 0) {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, toastO.t / 300, (toastO.max - toastO.t) / 200 + 0.1),
    );
    ctx.font = `700 ${Math.round(12 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    const tw = ctx.measureText(toastO.text).width + 26 * u,
      ty = (lvl && state !== "ready" ? 44 : 16) * u;
    ctx.fillStyle = "rgba(10,14,34,.88)";
    rr(W / 2 - tw / 2, ty, tw, 26 * u, 13 * u);
    ctx.fill();
    ctx.fillStyle = "#ffd84f";
    ctx.textAlign = "center";
    ctx.fillText(toastO.text, W / 2, ty + 13.5 * u);
    ctx.globalAlpha = 1;
  }
}

/* ============ CINEMATIC LAYER (colour grade, vignette, bloom, speed lines, BUSTED) ============ */
let VIG = null,
  VIGK = "",
  BLM = null;
function gradeSprite() {
  // one small canvas, stretched over the screen: warm sky, cool ground, dark corners
  const k = Math.round(W) + "x" + Math.round(H);
  if (VIGK !== k) {
    VIGK = k;
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = Math.max(40, Math.round((128 * H) / W));
    const g = cv.getContext("2d"),
      r = Math.hypot(cv.width, cv.height) / 2;
    const lg = g.createLinearGradient(0, 0, 0, cv.height);
    lg.addColorStop(0, "rgba(255,150,70,.15)");
    lg.addColorStop(0.55, "rgba(255,150,70,0)");
    lg.addColorStop(1, "rgba(30,110,150,.17)");
    g.fillStyle = lg;
    g.fillRect(0, 0, cv.width, cv.height);
    const gr = g.createRadialGradient(
      cv.width / 2,
      cv.height * 0.55,
      r * 0.34,
      cv.width / 2,
      cv.height * 0.55,
      r * 1.02,
    );
    gr.addColorStop(0, "rgba(8,6,20,0)");
    gr.addColorStop(1, "rgba(8,6,20,.58)");
    g.fillStyle = gr;
    g.fillRect(0, 0, cv.width, cv.height);
    VIG = cv;
  }
  return VIG;
}
function speedLines() {
  const k = Math.min(
    1,
    Math.max(0, (speed - 6) / 6) +
      (turboT > 0 ? 0.55 : 0) +
      (WE.kind === "speed" ? 0.5 : 0),
  );
  if (!FX.blur || k < 0.03 || state !== "play" || CFG.reduce || Q.level >= 2)
    return;
  const n = Math.round(4 + k * 8);
  ctx.fillStyle = "#fff6e6";
  for (let i = 0; i < n; i++) {
    const x =
        W - ((runPhase * 60 * (1 + (i % 4) * 0.45) + i * 173) % (W + 260)),
      y = 14 + ((i * 67) % Math.max(60, groundY - 26)),
      len = 70 + (i % 3) * 55;
    ctx.globalAlpha = 0.05 + 0.1 * k * (0.5 + (i % 3) * 0.25);
    ctx.fillRect(x, y, len, 1.3);
  }
  ctx.globalAlpha = 1;
}
function bloomPass() {
  // soft glow: shrink the picture, stretch it back on top with "screen"
  if (GL3.on || !FX.bloom || Q.level > 1 || CFG.reduce) return;
  const bw = 160,
    bh = Math.max(40, Math.round((bw * canvas.height) / canvas.width));
  if (!BLM) {
    BLM = document.createElement("canvas");
    BLM.g = BLM.getContext("2d");
  }
  if (BLM.width !== bw || BLM.height !== bh) {
    BLM.width = bw;
    BLM.height = bh;
  }
  BLM.g.drawImage(canvas, 0, 0, bw, bh);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.2;
  ctx.drawImage(BLM, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}
function drawBusted() {
  if (
    !(state === "over" || state === "revive") ||
    bustT <= 0 ||
    !$("overlay").classList.contains("hidden")
  )
    return;
  const k = Math.min(1, bustT / 280),
    bar = H * 0.115 * k;
  ctx.fillStyle = "rgba(8,10,26," + 0.34 * k + ")";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  if (bustT < 380) return;
  const e = Math.min(1, (bustT - 380) / 240),
    sc = 1 + (1 - e) * 0.7,
    u = UI;
  ctx.save();
  ctx.translate(W / 2, H * 0.36);
  ctx.scale(sc, sc);
  ctx.globalAlpha = e;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(Math.min(58 * u, (W * 0.8) / Math.max(6, t("bust.caught").length * 0.8)))}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 6 * u;
  ctx.strokeStyle = "rgba(0,0,0,.65)";
  ctx.strokeText(t("bust.caught"), 2, 3);
  ctx.fillStyle = "#f1f2f7";
  ctx.fillText(t("bust.caught"), 0, 0);
  ctx.font = `600 ${Math.round(11 * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
  ctx.fillStyle = "#ff6b84";
  ctx.fillText(t("bust.sub"), 0, 34 * u);
  ctx.restore();
}
function drawCinema() {
  if (CFG.reduce && Q.level >= 1) return;
  if (FX.light && !Q.flat && Q.level < 3)
    ctx.drawImage(gradeSprite(), 0, 0, W, H);
  speedLines();
}

/* ============ OPENING ANIMATION ============
   Before the menu: the 3D robot runs in, does a front salto, a high back-flip, a turbo dash and a spinning jump,
   then the title appears. Any tap / key skips it. Everything is drawn by the same 3D renderer (hero pose override). */
const easeIO = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const INTRO_CARDS = [
    [
      "flag",
      ["UZBEKISTAN", "O'ZBEKISTON", "ウズベキスタン"],
      [
        "The heart of Central Asia, where East meets West.",
        "Markaziy Osiyoning yuragi: Sharq va G'arb uchrashgan yurt.",
        "東と西が出会う、中央アジアの心臓部。",
      ],
    ],
    [
      "🏙️",
      ["CAPITAL: TASHKENT", "POYTAXT: TOSHKENT", "首都：タシケント"],
      [
        "About 37 million people live here. Independent since 1 September 1991.",
        "Aholisi taxminan 37 million. 1991-yil 1-sentyabrda mustaqillikka erishgan.",
        "人口は約3700万人。1991年9月1日に独立。",
      ],
    ],
    [
      "🐪",
      ["THE GREAT SILK ROAD", "BUYUK IPAK YO'LI", "シルクロード"],
      [
        "Samarkand, Bukhara and Khiva were the legendary stops of caravans between China and Europe.",
        "Samarqand, Buxoro va Xiva Xitoy bilan Yevropa orasidagi karvonlarning afsonaviy bekatlari edi.",
        "サマルカンド、ブハラ、ヒヴァは東西を結ぶ隊商の伝説の宿場でした。",
      ],
    ],
    [
      "🕌",
      ["UNESCO TREASURES", "YUNESKO MEROSI", "世界遺産"],
      [
        "Registan's blue domes, old Bukhara and the walled Itchan Kala of Khiva are World Heritage sites.",
        "Registonning ko'k gumbazlari, qadimiy Buxoro va Xivaning Ichan Qal'asi jahon merosi sanaladi.",
        "レギスタンの青いドーム、古都ブハラ、城壁のヒヴァは世界遺産です。",
      ],
    ],
    [
      "🔭",
      ["LAND OF SCIENTISTS", "OLIMLAR YURTI", "科学者の国"],
      [
        "Al-Khwarizmi gave the world algebra, Ulugh Beg charted the stars in Samarkand, Ibn Sina was born near Bukhara.",
        "Al-Xorazmiy algebrani, Mirzo Ulug'bek Samarqandda yulduzlar xaritasini yaratdi, Ibn Sino Buxoro yaqinida tug'ilgan.",
        "アル＝フワーリズミーは代数学を、ウルグ・ベクはサマルカンドで星表を、イブン・シーナーはブハラ近郊で生まれました。",
      ],
    ],
    [
      "🍚",
      ["PLOV & HOSPITALITY", "PLOV VA MEHMONDO'STLIK", "プロフとおもてなし"],
      [
        "Plov is the national dish. Every guest is welcomed with hot tea and fresh non bread.",
        "Plov milliy taom. Har bir mehmon issiq choy va yangi non bilan kutib olinadi.",
        "プロフは国民食。お客様は熱いお茶と焼きたてのナンでもてなします。",
      ],
    ],
    [
      "🏃",
      ["NOW — RUN!", "ENDI — YUGUR!", "さあ、走れ！"],
      [
        "Four legendary cities are waiting for you.",
        "To'rtta afsonaviy shahar seni kutmoqda.",
        "4つの伝説の都市があなたを待っています。",
      ],
    ],
  ],
  INTRO_T0 = 7.0, // title ends, facts begin
  INTRO_CARD = 8,
  INTRO_LEN = INTRO_T0 + INTRO_CARDS.length * INTRO_CARD;
function introWrap(txt, maxW) {
  const out = [];
  let line = "";
  const sep = /[\u3000-\u9fff]/.test(txt) ? "" : " ";
  for (const w of sep ? txt.split(" ") : [...txt]) {
    const tst = line ? line + sep + w : w;
    if (ctx.measureText(tst).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = tst;
  }
  if (line) out.push(line);
  return out;
}
function introFlag(x, y, w) {
  const h = w * 0.5,
    u = h / 9;
  ctx.fillStyle = "#1eb4e6";
  ctx.fillRect(x, y, w, u * 3);
  ctx.fillStyle = "#ce1126";
  ctx.fillRect(x, y + u * 3, w, u * 0.35);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y + u * 3.35, w, u * 2.3);
  ctx.fillStyle = "#ce1126";
  ctx.fillRect(x, y + u * 5.65, w, u * 0.35);
  ctx.fillStyle = "#1eb53a";
  ctx.fillRect(x, y + u * 6, w, u * 3);
  /* crescent + 12 stars on the blue band */
  const cx = x + u * 2.2,
    cy = y + u * 1.5;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, u * 1.05, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#1eb4e6";
  ctx.beginPath();
  ctx.arc(cx + u * 0.4, cy, u * 0.9, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#fff";
  [3, 4, 5].forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(
        x + u * (4 + r * 0.9 + i * 0.9),
        y + u * (0.55 + r * 0.9) - 0.0,
        u * 0.22,
        0,
        7,
      );
      ctx.fill();
    }
  });
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
function drawIntroCard(t) {
  const i = Math.min(
      INTRO_CARDS.length - 1,
      Math.floor((t - INTRO_T0) / INTRO_CARD),
    ),
    u = (t - INTRO_T0 - i * INTRO_CARD) / INTRO_CARD,
    a = Math.max(0, Math.min(1, u * 7, (1 - u) * 7)),
    C = INTRO_CARDS[i],
    L = LANG === "uz" ? 1 : LANG === "ja" ? 2 : 0,
    pw = Math.min(W - 20, 560 * UI),
    ph = 150 * UI,
    px = (W - pw) / 2,
    py = H * 0.13 + (1 - a) * 14 * UI;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(6,10,32,.82)";
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(px, py, pw, ph, 14 * UI)
    : ctx.rect(px, py, pw, ph);
  ctx.fill();
  ctx.strokeStyle = "rgba(83,247,255,.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const ix = px + 16 * UI,
    iw = 84 * UI;
  if (C[0] === "flag") introFlag(ix, py + ph / 2 - iw * 0.25, iw);
  else {
    ctx.font = `${Math.round(52 * UI)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(C[0], ix + iw / 2, py + ph / 2 + 2);
  }
  const tx = ix + iw + 16 * UI,
    tw = pw - (tx - px) - 14 * UI;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffd84f";
  ctx.font = `800 ${Math.round(18 * UI)}px Orbitron, 'Noto Sans JP', sans-serif`;
  ctx.fillText(C[1][L], tx, py + 36 * UI, tw);
  ctx.fillStyle = "#e8f1ff";
  ctx.font = `500 ${Math.round(15 * UI)}px 'Noto Sans JP', system-ui, sans-serif`;
  introWrap(C[2][L], tw)
    .slice(0, 4)
    .forEach((ln, k) => ctx.fillText(ln, tx, py + 62 * UI + k * 20 * UI));
  /* page dots */
  ctx.globalAlpha = 0.9;
  INTRO_CARDS.forEach((_, k) => {
    ctx.fillStyle = k === i ? "#53f7ff" : "rgba(255,255,255,.28)";
    ctx.beginPath();
    ctx.arc(
      W / 2 + (k - (INTRO_CARDS.length - 1) / 2) * 12 * UI,
      py + ph + 14 * UI,
      3 * UI,
      0,
      7,
    );
    ctx.fill();
  });
  ctx.restore();
}
function introPose() {
  const t = INTRO.t,
    hx = player.x + player.w / 2 - W / 2,
    P = {
      x: hx,
      y: 0,
      ang: 0,
      spin: 0,
      air: false,
      boost: false,
      land: 0,
      ph: t * 13,
    };
  if (t < 1.1) {
    const u = t / 1.1,
      e = 1 - (1 - u) * (1 - u);
    P.x = -W / 2 - 70 + (hx + W / 2 + 70) * e;
  } else if (t < 1.95) {
    const u = (t - 1.1) / 0.85;
    P.y = 95 * 4 * u * (1 - u);
    P.ang = -TAU_ * easeIO(u);
    P.air = true;
  } else if (t < 2.25) P.land = 0.6;
  else if (t < 3.25) {
    const u = t - 2.25;
    P.y = 150 * 4 * u * (1 - u);
    P.ang = TAU_ * easeIO(u);
    P.air = true;
  } else if (t < 3.5) P.land = 0.6;
  else if (t < 4.5) {
    const u = (t - 3.5) / 1.0;
    P.boost = true;
    P.x = hx + 70 * Math.sin(Math.PI * u);
  } else if (t < 5.5) {
    const u = t - 4.5;
    P.y = 90 * 4 * u * (1 - u);
    P.spin = TAU_ * easeIO(u);
    P.air = true;
  } else if (t < 5.8) P.land = 0.5;
  return P;
}
const TAU_ = Math.PI * 2;
function introFx(from, to) {
  const hx = player.x + player.w / 2,
    ev = (a) => from < a && to >= a;
  const land = (c) => {
    burst(hx, groundY, c, 14);
    ring(hx, groundY - 4, c, 46);
    zoom = 1.05;
    shake = 4;
    beep(180, 0.08, "square", 0.05, -80);
  };
  const jump = (c) => {
    burst(hx, groundY, "#e8eef7", 8);
    ring(hx, groundY - 4, c, 30);
    beep(520, 0.1, "triangle", 0.05, 380);
  };
  if (ev(1.1)) jump("#53f7ff");
  if (ev(1.95)) land("#53f7ff");
  if (ev(2.25)) jump("#ff4fd8");
  if (ev(3.25)) land("#ff4fd8");
  if (ev(3.5)) {
    flash = { c: "#53f7ff", a: 0.25 };
    beep(300, 0.4, "sawtooth", 0.04, 900);
  }
  if (ev(4.5)) {
    jump("#ffd84f");
    burst(hx, groundY - 20, "#ffd84f", 18);
  }
  if (ev(5.5)) land("#ffd84f");
  if (ev(4.6))
    [660, 880, 1100, 1320].forEach((f, i) =>
      setTimeout(() => beep(f, 0.12, "triangle", 0.05), i * 90),
    );
  if (INTRO.t > 3.5 && INTRO.t < 4.5) {
    if (Math.random() < 0.7) burst(hx - 30, groundY - 12, "#53f7ff", 2);
  }
}
function introTick() {
  if (!INTRO.on) return;
  const now = performance.now(),
    dt = Math.min(0.05, (now - INTRO.last) / 1000);
  INTRO.last = now;
  const from = INTRO.t;
  INTRO.t += dt;
  INTRO.spd = INTRO.t > 3.5 && INTRO.t < 4.5 ? 5 : 1;
  introFx(from, INTRO.t);
  if (INTRO.t >= INTRO_LEN) introEnd();
}
function introEnd() {
  if (!INTRO.on) return;
  INTRO.on = false;
  INTRO.spd = 1;
  const ov = $("overlay");
  if (ov) ov.classList.remove("hidden");
}
function introStart() {
  if (!INTRO.pose) INTRO.pose = introPose;
  INTRO.on = true;
  INTRO.t = 0;
  INTRO.last = performance.now();
  const ov = $("overlay");
  if (ov) ov.classList.add("hidden");
  const skip = (e) => {
    if (!INTRO.on) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    introEnd();
  };
  wrap.addEventListener("pointerdown", skip, true);
  window.addEventListener("keydown", skip, true);
}
function drawIntro() {
  if (!INTRO.on) return;
  const t = INTRO.t,
    k = Math.min(1, t / 0.6, (INTRO_LEN - t) / 0.5),
    bar = H * 0.1 * Math.max(0, k);
  ctx.fillStyle = "#05071a";
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  if (t >= INTRO_T0) drawIntroCard(t);
  const a =
    Math.min(1, Math.max(0, (t - 4.5) / 0.6)) *
    Math.max(0, Math.min(1, (INTRO_T0 - t) / 0.5));
  if (a > 0.01) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const sc = 1 + (1 - a) * 0.15,
      cx = W / 2,
      cy = H * 0.34;
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.font = `900 ${Math.round(46 * UI)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    ctx.lineWidth = 6 * UI;
    ctx.strokeStyle = "rgba(5,7,26,.85)";
    ctx.strokeText("ZUMARY RUN", 0, 0);
    ctx.fillStyle = "#53f7ff";
    ctx.fillText("ZUMARY RUN", 0, 0);
    ctx.font = `700 ${Math.round(12 * UI)}px Orbitron, sans-serif`;
    ctx.lineWidth = 4 * UI;
    ctx.strokeText("TASHKENT · SAMARKAND · BUKHARA · KHIVA", 0, 34 * UI);
    ctx.fillStyle = "#ffd84f";
    ctx.fillText("TASHKENT · SAMARKAND · BUKHARA · KHIVA", 0, 34 * UI);
    ctx.restore();
  }
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${Math.round(10 * UI)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(
    LANG === "uz"
      ? "o'tkazib yuborish uchun bosing"
      : LANG === "ja"
        ? "タップでスキップ"
        : "tap to skip",
    W / 2,
    H - bar - 12 * UI,
  );
  ctx.globalAlpha = 1;
}

function draw() {
  introTick();
  ctx.save();
  let shx = 0,
    shy = 0;
  if (shake > 0 && FX.shake > 0 && !CFG.reduce) {
    const sh = shake * FX.shake;
    shx = rnd(-sh, sh);
    shy = rnd(-sh, sh);
    ctx.translate(shx, shy);
  }
  if (zoom > 1.002 && FX.cam && !CFG.reduce) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
  }
  if (GL3.on) GL3.render(shx, shy); // the whole world is drawn in 3D underneath; this canvas only carries effects and HUD
  const g3 = GL3.on; // (render() may have fallen back to 2D)
  if (g3) ctx.clearRect(-40, -40, W + 80, H + 80);
  else drawBackground();
  WE_drawBack();
  drawFinish();
  drawBoss();
  if (!g3) drawItems();
  drawParticles();
  if (!g3) {
    drawObstacles();
    drawChaser();
  }
  drawPlayer();
  WE_drawFront();
  x10Draw();
  x11Draw();
  if (FX.env) drawWeather();
  if (FX.light) drawDark();
  ctx.restore();
  drawCinema();
  bloomPass();
  drawBusted();
  if (flash.a > 0.01 && FX.cam && !CFG.reduce) {
    ctx.globalAlpha = flash.a;
    ctx.fillStyle = flash.c;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (maxLives > 1 && lives === 1 && state === "play") {
    ctx.strokeStyle = "#ff3b5c";
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(frame * 0.18);
    ctx.lineWidth = 10 * UI;
    ctx.strokeRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (INTRO.on) drawIntro();
  else drawHUD();
}

/* ============ OVERLAY / MENU ============ */
const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const bestKey = () => (lvl ? "L" + (sel + 1) : diff);
function renderTop() {
  if (!board.length)
    return `<div class="top-title">${t("top.head")}</div><p>${t("top.empty")}</p>`;
  return (
    `<div class="top-title">${t("top.best5")}</div><ol class="top">` +
    board
      .map(
        (r, i) =>
          `<li><span>${i + 1}.</span><b>${fmt(r.s)}</b><em>${DIFF[r.d] ? DIFF[r.d].name : ""}</em></li>`,
      )
      .join("") +
    `</ol>`
  );
}
function renderSkins() {
  return (
    `<div class="top-title">${t("skins.title", { w: wallet })}</div><div class="skins">` +
    SKINS.map((s) => {
      const has = owned.includes(s.id);
      return `<button type="button" data-s="${s.id}" class="${skin === s.id ? "on" : ""}${has ? "" : " lock"}" style="--c:${s.a || "#53f7ff"}"><i></i>${s.n}${has ? "" : `<small>◎${s.cost}</small>`}</button>`;
    }).join("") +
    `</div>`
  );
}
const THUMBS = {};
Art.cities.forEach((c) => {
  const v = store.get("zr_th3_" + c, null);
  if (v) THUMBS[c] = v;
});
function buildThumbs() {
  const list = Art.cities.filter((c) => !THUMBS[c]);
  const cur0 = LEVELS[sel] ? THEMES[LEVELS[sel].theme].city : null;
  if (cur0 && list.includes(cur0)) {
    list.splice(list.indexOf(cur0), 1);
    list.unshift(cur0);
  }
  const next = () => {
    const c = list.shift();
    if (!c) return;
    Art.thumb(c, (url) => {
      THUMBS[c] = url;
      store.set("zr_th3_" + c, url);
      if (state === "ready" && !shopOpen && screenFn) screenFn();
      setTimeout(next, 40);
    });
  };
  next();
}
function renderLevels() {
  return (
    `<div class="top-title">${t("cities.title")}</div><div class="levels">` +
    LEVELS.map((L, i) => {
      const locked = i >= prog.unlocked,
        th = THUMBS[THEMES[L.theme].city];
      const bg = th
        ? `style="background-image:linear-gradient(180deg,rgba(5,7,22,.1),rgba(5,7,22,.88)),url(${th})"`
        : "";
      return `<button type="button" data-l="${i}" ${bg} class="${i === sel ? "on" : ""}${locked ? " lock" : ""}"><b>${locked ? "🔒" : i + 1}</b><span>${L.name}</span><small>${locked ? "&nbsp;" : starText(prog.stars[i + 1] || 0)}</small></button>`;
    }).join("") +
    `</div>`
  );
}
function renderShop() {
  return (
    `<div class="top-title">${t("shop.title", { w: wallet })}</div><div class="shop">` +
    SHOP.map((it) => {
      const lv = up[it.k] || 0,
        maxed = lv >= it.max,
        cost = it.cost[lv];
      return `<div class="shop-row"><div><b>${it.n}${it.max > 1 ? ` ${lv}/${it.max}` : ""}</b><small>${it.d}</small></div><button type="button" data-u="${it.k}" class="${maxed ? "done" : wallet >= cost ? "" : "lock"}">${maxed ? "✓" : "◎" + cost}</button></div>`;
    }).join("") +
    `</div>`
  );
}
function showOverlay(icon, title, text, btn, o = {}) {
  $("oIcon").textContent = icon;
  $("oTitle").textContent = title;
  $("oText").innerHTML = text;
  $("startButton").textContent = btn;
  $("mode").style.display = o.menu ? "flex" : "none";
  const lb = $("lookBar");
  if (lb) lb.hidden = o.panel === "settings" || !(o.menu || o.panel);
  $("diff").style.display = o.menu && mode === "endless" ? "flex" : "none";
  $("levelBox").innerHTML = o.menu && mode === "campaign" ? renderLevels() : "";
  $("skinBox").innerHTML = o.skins ? renderSkins() : "";
  $("topBox").innerHTML = o.top && mode === "endless" ? renderTop() : "";
  $("menuButton").style.display = o.menuBtn ? "flex" : "none";
  $("nav").style.display = o.menu || o.panel ? "flex" : "none";
  document
    .querySelectorAll("#nav button")
    .forEach((b) =>
      b.classList.toggle("on", b.dataset.p === (o.panel || "play")),
    );
  $("dailyBox").innerHTML = o.menu ? renderDaily() : "";
  $("shopBox").innerHTML =
    o.panel === "shop"
      ? renderShop()
      : o.panel === "missions"
        ? renderMissions()
        : o.panel === "medals"
          ? renderMedals()
          : o.panel === "settings"
            ? renderSettings()
            : "";
  $("shareButton").style.display = o.share ? "flex" : "none";
  $("menuButton").textContent = o.menuLabel || t("menuBtn");
  shopOpen = !!o.panel;
  if (!INTRO.on) $("overlay").classList.remove("hidden"); // stays hidden while the opening animation plays
  paintDiff();
}
function paintDiff() {
  document
    .querySelectorAll("#diff button")
    .forEach((b) => b.classList.toggle("on", b.dataset.d === diff));
  document
    .querySelectorAll("#mode button")
    .forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
}
function showReady() {
  const render = () => {
    if (mode === "campaign") {
      const L = LEVELS[sel];
      showOverlay(
        "✦",
        t("ready.title", { n: sel + 1, name: L.name }),
        t("ready.text", {
          tag: L.tag,
          len: L.len,
          coins: L.coins,
          fact: pick(FACTS[THEMES[L.theme].city]),
        }),
        t("ready.btn", { n: sel + 1 }),
        { menu: true, skins: true },
      );
    } else {
      showOverlay(
        "✦",
        t("endless.title"),
        t("endless.text"),
        t("endless.btn"),
        { menu: true, skins: true, top: true },
      );
    }
  };
  screenFn = render;
  render();
}

/* ============ FLOW ============ */
function resetGame() {
  state = "ready";
  WE_reset();
  lvl = mode === "campaign" ? LEVELS[sel] : null;
  dist = 0;
  hits = 0;
  x10Reset();
  x11Reset();
  maxLives = (lvl ? 3 : 2) + up.life;
  lives = maxLives;
  shotTimer = 1500;
  cleanT = 0;
  boardT = 0;
  chaseX = -120;
  extraGap = 0;
  spawnPx = 0;
  nextGapPx = 380;
  skill = 0.5;
  skillT = 0;
  hitFlag = false;
  runTime = 0;
  runDist = 0;
  runPhase = 0;
  landT = 0;
  coyote = 0;
  jumpBuf = -1e9;
  fadeT = 0;
  prevA = null;
  acc = 0;
  fuel = fuelMax();
  flying = false;
  sq = 0;
  zoom = 1;
  freeze = 0;
  flash.a = 0;
  shoutO.t = 0;
  lastPhase = 0;
  hbT = 0;
  turbo = 0;
  turboT = 0;
  revived = false;
  pet.x = player.x - 34;
  pet.y = player.y - 18;
  score = 0;
  speed = (lvl || DIFF[diff]).base;
  frame = 0;
  coins = 0;
  combo = 0;
  shake = 0;
  invul = 0;
  shield = !!up.sh;
  banner = { text: "", sub: "", t: 0, max: 1 };
  lastZone = 0;
  cur = { ...THEMES[lvl ? lvl.theme : 0] };
  skyKey = "";
  fx = { slow: 0, x2: 0, magnet: 0 };
  obstacles = [];
  items = [];
  particles = [];
  pops = [];
  obstacleTimer = 0;
  nextObstacle = 1000;
  itemTimer = 0;
  nextItem = rnd(8000, 12000);
  Object.assign(player, {
    y: groundY - 44,
    h: 44,
    vy: 0,
    g: lvl && lvl.g ? lvl.g : 0.65,
    grounded: true,
    jumps: 2,
    pb: groundY,
    trail: [],
  });
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  buildWorld();
  updateHUD();
}
/* keep the whole play area on screen (no zooming or fullscreen needed): scroll it into view if part of it is cut off */
function ensureVisible() {
  try {
    const r = wrap.getBoundingClientRect(),
      vh = window.innerHeight;
    if (r.top < 0 || r.bottom > vh)
      window.scrollTo({
        top: Math.max(
          0,
          window.scrollY + r.top - Math.max(6, (vh - r.height) / 2),
        ),
        behavior: "smooth",
      });
  } catch (e) {}
}
function startGame() {
  introEnd();
  ensureVisible();
  if (state === "play") return;
  if (state === "over" || state === "ready" || state === "won") resetGame();
  resetInputs();
  acc = 0;
  state = "play";
  lastT = 0;
  fpsAcc = 0;
  fpsN = -90; // ~1.5 s of grace: shader compile / first-frame stalls must not look like a "slow phone"
  if (COARSE && !fsOn) setFs(true);
  if (lvl)
    banner = {
      text: t("banner.level", { n: sel + 1 }),
      sub: lvl.name + " · " + lvl.tag,
      t: 2800,
      max: 2800,
    };
  $("overlay").classList.add("hidden");
  beep(660, 0.1, "triangle");
  startMusic();
  if (up.jet && !store.get("zr_jh", 0)) {
    store.set("zr_jh", 1);
    FX.hints && shout(t("jet.hint"), "#ffb36b", 3400);
  }
}
function goMenu() {
  resetGame();
  showReady();
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  resetInputs();
  screenFn = () =>
    showOverlay("❚❚", t("pause.title"), t("pause.text"), t("pause.btn"), {
      menuBtn: true,
    });
  screenFn();
}
function resumeGame() {
  if (state !== "pause") return;
  resetInputs();
  state = "play";
  lastT = 0;
  acc = 0;
  fpsAcc = 0;
  fpsN = -20;
  invul = Math.max(invul, 1200); // short grace after a pause
  $("overlay").classList.add("hidden");
  startMusic();
}
function saveBest() {
  const s = Math.floor(score),
    k = bestKey(),
    isBest = s > (bests[k] || 0);
  if (isBest) {
    bests[k] = s;
    store.set("zr_bests", bests);
  }
  return isBest;
}

function endGame() {
  if (state === "over" || state === "revive") return;
  bustT = 0;
  bustHit = 0;
  shake = 12;
  sfx.hit();
  zoom = 1.06;
  flash = { c: "#ff3b5c", a: 0.4 };
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  burst(player.x + player.w / 2, player.y + player.h / 2, "#ff4fd8", 35);
  if (!revived && wallet >= REVIVE_COST && (lvl || score > 120)) {
    state = "revive";
    setTimeout(() => {
      if (state !== "revive") return;
      screenFn = () =>
        showOverlay(
          "♥",
          t("revive.title"),
          t("revive.text", { c: REVIVE_COST, w: wallet }),
          t("revive.btn", { c: REVIVE_COST }),
          { menuBtn: true, menuLabel: t("revive.no") },
        );
      screenFn();
    }, 1500); // let the officer and the dog finish the scene first
    return;
  }
  finalizeOver();
}
function doRevive() {
  if (state !== "revive" || wallet < REVIVE_COST) return;
  wallet -= REVIVE_COST;
  store.set("zr_wallet", wallet);
  revived = true;
  resetInputs();
  acc = 0;
  state = "play";
  lastT = 0;
  fpsAcc = 0;
  fpsN = -20;
  invul = 2600;
  lives = 1;
  shield = true;
  obstacles = obstacles.filter(
    (o) => o.x > player.x + 260 || o.x + o.w < player.x - 20,
  );
  Object.assign(player, {
    h: 44,
    y: groundY - 44,
    vy: 0,
    grounded: true,
    jumps: 2,
    pb: groundY,
  });
  boardT = 0;
  $("overlay").classList.add("hidden");
  flash = { c: "#ffffff", a: 0.4 };
  zoom = 1.07;
  shout(t("revive.shout"), "#50ffb0", 1200);
  [500, 700, 1000].forEach((f, i) =>
    setTimeout(() => beep(f, 0.12, "triangle", 0.06), i * 90),
  );
  startMusic();
}
function finalizeOver() {
  state = "over";
  x11Save();
  const s = Math.floor(score),
    isBest = saveBest();
  if (!lvl && s > 0) {
    board.push({ s, d: diff });
    board.sort((a, b) => b.s - a.s);
    board = board.slice(0, 5);
    store.set("zr_top", board);
  }
  wallet += coins;
  store.set("zr_wallet", wallet);
  const rk = bookRun(0);
  updateHUD();
  const L0 = lvl,
    dist0 = Math.floor(dist),
    coins0 = coins,
    w0 = wallet,
    best0 = bests[diff] || 0,
    dk = diff,
    mi = Math.floor(Math.random() * 4);
  setTimeout(() => {
    if (state !== "over") return;
    screenFn = () => {
      if (L0)
        showOverlay(
          "✕",
          t("lose.title"),
          t("lose.text", {
            d: dist0,
            len: L0.len,
            c: coins0,
            w: w0,
            msg: t("lose")[mi],
            rk: rkText(rk),
          }),
          t("lose.btn"),
          { menu: true, skins: true, share: true },
        );
      else
        showOverlay(
          isBest ? "★" : "✕",
          t(isBest ? "over.record" : "over.title"),
          t("over.text", {
            s: fmt(s),
            c: coins0,
            w: w0,
            msg: t("lose")[mi],
            d: DIFF[dk].name,
            b: fmt(best0),
            rk: rkText(rk),
          }),
          t("over.btn"),
          { menu: true, skins: true, top: true, share: true },
        );
    };
    screenFn();
  }, 1500); // the caught scene plays before the result screen
}

function winLevel() {
  const L = lvl,
    id = sel + 1;
  state = "won";
  sfx.zone();
  vib(80);
  flash = { c: "#fff", a: 0.5 };
  zoom = 1.08;
  [523, 659, 784, 1047].forEach((f2, i) =>
    setTimeout(() => beep(f2, 0.18, "triangle", 0.07), i * 130),
  );
  obstacles = [];
  items = [];
  duckKey = duckPtr = duckBtn = jumpHeld = false;
  for (let i = 0; i < 6; i++)
    setTimeout(() => {
      if (state === "won")
        burst(
          rnd(100, W - 100),
          rnd(60, groundY - 60),
          ["#53f7ff", "#ff4fd8", "#ffd84f"][i % 3],
          30,
        );
    }, i * 130);
  if (L.boss) burst(W - 78, H * 0.34, "#ff3b5c", 60);
  const st = 1 + (coins >= L.coins ? 1 : 0) + (hits === 0 ? 1 : 0);
  if (!(prog.stars[id] > 0)) toast(t("postcard", { n: L.name }));
  prog.stars[id] = Math.max(prog.stars[id] || 0, st);
  if (id < LEVELS.length) prog.unlocked = Math.max(prog.unlocked, id + 1);
  store.set("zr_prog", prog);
  saveBest();
  mAdd("win", 1);
  meta.wins++;
  const rk = bookRun(50);
  wallet += coins + st * 10;
  store.set("zr_wallet", wallet);
  const last = id >= LEVELS.length;
  if (!last) {
    sel = id;
    store.set("zr_sel", sel);
  }
  updateHUD();
  const c0 = coins,
    h0 = hits,
    w0 = wallet,
    mi = Math.floor(Math.random() * 4);
  setTimeout(() => {
    if (state !== "won") return;
    screenFn = () =>
      showOverlay(
        starText(st),
        t(last ? "win.final" : "win.title"),
        t("win.text", {
          name: L.name,
          c: c0,
          g: L.coins,
          ok: c0 >= L.coins ? "✓" : "✗",
          nh: h0 === 0 ? "✓" : "✗ (" + h0 + ")",
          b: st * 10,
          w: w0,
          msg: t("win")[mi],
          fact: pick(FACTS[THEMES[L.theme].city]),
          rk: rkText(rk),
        }),
        t(last ? "win.btnFinal" : "win.btnNext"),
        { menuBtn: true, share: true },
      );
    screenFn();
  }, 900);
}

/* ============ COIN TYPES — gold / crystal / energy / ZUMARY (pre-rendered sprites, no real-time effects) ============ */
const COIN_T = [
  { id: "gold", col: "#ffd84f", xp: 0 },
  { id: "crystal", col: "#6cf3ff", xp: 1 },
  { id: "energy", col: "#ff4fd8", xp: 2 },
  { id: "zumary", col: "#b388ff", xp: 8 },
];
let CTS = null;
function coinTypeSheets() {
  if (CTS) return CTS;
  CTS = [];
  const N = 12,
    sz = 44,
    c = sz / 2;
  for (let ty = 1; ty < 4; ty++) {
    const frames = [];
    for (let i = 0; i < N; i++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = sz;
      const g = cv.getContext("2d");
      const ph = (i / N) * Math.PI * 2,
        sx = Math.max(0.14, Math.abs(Math.cos(ph)));
      g.translate(c, c);
      if (ty === 1) {
        // premium crystal: faceted hexagonal gem with a travelling sparkle
        g.save();
        g.scale(sx, 1);
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 3;
          g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        }
        g.closePath();
        const gr = g.createLinearGradient(-14, -16, 14, 16);
        gr.addColorStop(0, "#f2ffff");
        gr.addColorStop(0.45, "#46d2ff");
        gr.addColorStop(1, "#1c5fd0");
        g.fillStyle = gr;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = "#0a3e78";
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,.65)";
        g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < 6; k += 2) {
          const a = -Math.PI / 2 + (k * Math.PI) / 3;
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        }
        g.stroke();
        g.restore();
        const s = 3 + 4 * Math.abs(Math.sin(ph * 1.5));
        g.fillStyle = "#fff";
        g.beginPath();
        g.moveTo(-6, -8 - s);
        g.lineTo(-4.5, -8);
        g.lineTo(-6, -8 + s);
        g.lineTo(-7.5, -8);
        g.closePath();
        g.moveTo(-6 - s, -8);
        g.lineTo(-6, -9.5);
        g.lineTo(-6 + s, -8);
        g.lineTo(-6, -6.5);
        g.closePath();
        g.fill();
      } else if (ty === 2) {
        // rare energy coin: plasma orb in a spinning ring, lightning core
        const gl = g.createRadialGradient(0, 0, 2, 0, 0, 21);
        gl.addColorStop(0, "rgba(255,120,235,.75)");
        gl.addColorStop(1, "rgba(255,79,216,0)");
        g.fillStyle = gl;
        g.fillRect(-c, -c, sz, sz);
        const core = g.createRadialGradient(0, 0, 1, 0, 0, 11);
        core.addColorStop(0, "#fff");
        core.addColorStop(0.5, "#ff7ae6");
        core.addColorStop(1, "#7a1fd1");
        g.fillStyle = core;
        g.beginPath();
        g.arc(0, 0, 11, 0, 7);
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = "#ff4fd8";
        g.beginPath();
        g.ellipse(0, 0, 16 * sx, 16, 0, 0, 7);
        g.stroke();
        g.lineWidth = 1.2;
        g.strokeStyle = "#fff";
        g.beginPath();
        g.ellipse(0, 0, 16 * sx, 16, 0, 0.3, 2.2);
        g.stroke();
        g.fillStyle = "#fff";
        g.beginPath();
        g.moveTo(2, -9);
        g.lineTo(-5, 1);
        g.lineTo(-1, 1);
        g.lineTo(-3, 9);
        g.lineTo(5, -2);
        g.lineTo(1, -2);
        g.closePath();
        g.fill();
      } else {
        // special ZUMARY coin: gold body, violet ring, engraved Z, orbiting sparks
        g.save();
        g.scale(sx, 1);
        const gr = g.createLinearGradient(-16, -16, 16, 16);
        gr.addColorStop(0, "#fff0a8");
        gr.addColorStop(0.5, "#ffc93a");
        gr.addColorStop(1, "#b8780a");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, 17, 0, 7);
        g.fill();
        g.lineWidth = 3.2;
        g.strokeStyle = "#8b5cf6";
        g.beginPath();
        g.arc(0, 0, 15, 0, 7);
        g.stroke();
        g.lineWidth = 1;
        g.strokeStyle = "rgba(255,255,255,.7)";
        g.beginPath();
        g.arc(0, 0, 12, 0, 7);
        g.stroke();
        g.fillStyle = "#4a2a9a";
        g.font = "800 17px Orbitron, Arial, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("Z", 0, 1);
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.ellipse(-6, -8, 5, 2.2, -0.6, 0, 7);
        g.fill();
        g.restore();
        g.fillStyle = "#e9dcff";
        for (let k = 0; k < 3; k++) {
          const a = ph + (k * Math.PI * 2) / 3;
          g.beginPath();
          g.arc(Math.cos(a) * 20, Math.sin(a) * 20, 1.6, 0, 7);
          g.fill();
        }
      }
      frames.push(cv);
    }
    CTS[ty] = frames;
  }
  return CTS;
}
const rings = [];
function ring(x, y, col, r1 = 34) {
  if (rings.length < 10) rings.push({ x, y, r: 6, r1, col, life: 1 });
}
function rollCoin(x, y) {
  const r = Math.random();
  if (r < 0.012) return { k: "coin", x, y, r: 13, ct: 3, v: 10 };
  if (r < 0.04) return { k: "coin", x, y, r: 12, ct: 2, v: 5 };
  if (r < 0.11) return { k: "coin", x, y, r: 11, ct: 1, v: 3 };
  return { k: "coin", x, y, r: 9 };
}
function coinCollect(it) {
  const ct = it.ct | 0,
    ty = COIN_T[ct],
    cv = Math.max(1, Math.round((it.v || 1) * WE.coin));
  coins += cv;
  addCombo();
  turboAdd(ct === 2 ? 25 : 4);
  mAdd("coin", cv);
  if (ct) {
    meta.rare = (meta.rare | 0) + 1;
    mAdd("rare", 1);
    meta.xp += ty.xp;
  }
  x10Coin();
  x11Coin();
  const g = 25 * mult() * cv;
  score += g;
  pop(it.x, it.y, "+" + g, ty.col);
  if (ct === 0) {
    burst(it.x, it.y, "#ffd84f", 5);
    sfx.coin();
  } else if (ct === 1) {
    burst(it.x, it.y, "#6cf3ff", 9);
    burst(it.x, it.y, "#ffffff", 4);
    ring(it.x, it.y, "#6cf3ff", 30);
    beep(1568, 0.08, "triangle", 0.05);
    setTimeout(() => beep(2093, 0.12, "triangle", 0.045), 60);
  } else if (ct === 2) {
    burst(it.x, it.y, "#ff4fd8", 14);
    ring(it.x, it.y, "#ff4fd8", 44);
    flash = { c: "#ff4fd8", a: 0.12 };
    beep(220, 0.16, "sawtooth", 0.05, 700);
  } else {
    burst(it.x, it.y, "#b388ff", 18);
    burst(it.x, it.y, "#ffd84f", 14);
    ring(it.x, it.y, "#ffd84f", 60);
    ring(it.x, it.y, "#b388ff", 42);
    flash = { c: "#b388ff", a: 0.2 };
    zoom = 1.04;
    shout(t("coin.zumary"), "#e0ccff", 1100);
    [523, 659, 784, 1047].forEach((f2, i) =>
      setTimeout(() => beep(f2, 0.12, "triangle", 0.06), i * 70),
    );
    vib(20);
  }
}

/* ============ DYNAMIC WORLD EVENTS — storm, meteors, blackout, magnet zone, speed zone ============ */
const WE_DEF = {
  storm: { dur: 9000, col: "#8fb4ff", ic: "⚡" },
  meteor: { dur: 10000, col: "#ff8a5c", ic: "☄" },
  blackout: { dur: 8000, col: "#9aa3ff", ic: "🌃" },
  magnet: { dur: 8000, col: "#ff4fd8", ic: "🧲" },
  speed: { dur: 7000, col: "#53f7ff", ic: "»" },
};
const WE = {
  t: 20000,
  kind: "",
  left: 0,
  tot: 1,
  coin: 1,
  score: 1,
  spd: 1,
  dark: 0,
  hits0: 0,
  mT: 0,
  bT: 0,
  gateX: -1,
  meteors: [],
  bolts: [],
  bolt: 0,
};
function WE_reset() {
  WE.t = rnd(14000, 22000);
  WE.kind = "";
  WE.left = 0;
  WE.coin = 1;
  WE.score = 1;
  WE.spd = 1;
  WE.dark = 0;
  WE.meteors.length = 0;
  WE.bolts.length = 0;
  WE.bolt = 0;
  WE.gateX = -1;
  rings.length = 0;
}
function WE_start(kind) {
  const d = WE_DEF[kind];
  WE.kind = kind;
  WE.left = WE.tot = d.dur;
  WE.hits0 = hits;
  WE.mT = 500;
  WE.bT = 300;
  WE.coin = kind === "storm" ? 2 : kind === "speed" ? 1.5 : 1;
  WE.score = kind === "blackout" ? 1.5 : kind === "speed" ? 1.5 : 1;
  WE.spd = kind === "speed" ? 1.3 : 1;
  if (kind === "speed") WE.gateX = W + 40;
  banner = {
    text: d.ic + " " + t("ev." + kind),
    sub: t("ev." + kind + ".d"),
    t: 2400,
    max: 2400,
  };
  sfx.zone();
  flash = { c: d.col, a: 0.16 };
}
function WE_end() {
  const ok = hits === WE.hits0;
  WE.kind = "";
  WE.coin = 1;
  WE.score = 1;
  WE.spd = 1;
  WE.meteors.length = 0;
  WE.t = rnd(16000, 28000);
  meta.events = (meta.events | 0) + 1;
  mAdd("evt", 1);
  meta.xp += ok ? 6 : 2;
  if (ok) {
    score += 150;
    pop(player.x + 30, player.y - 30, t("ev.clean"), "#50ffb0");
  }
  saveMeta();
}
function WE_update(delta, f) {
  if (state !== "play" || (lvl && lvl.boss)) return;
  const p = player,
    ev = speed;
  if (!WE.kind) {
    WE.t -= delta;
    if (WE.t <= 0 && runTime > 10000)
      WE_start(
        ["storm", "meteor", "blackout", "magnet", "speed"][
          Math.floor(Math.random() * 5)
        ],
      );
    else if (WE.t <= 0) WE.t = 4000;
    WE.dark = Math.max(0, WE.dark - delta / 700);
    return;
  }
  WE.left -= delta;
  const k = WE.kind;
  WE.dark =
    k === "blackout"
      ? Math.min(1, WE.dark + delta / 600, WE.left / 600)
      : Math.max(0, WE.dark - delta / 700);
  if (k === "magnet") fx.magnet = Math.max(fx.magnet, 300);
  if (k === "storm") {
    WE.bolt -= delta;
    if (WE.bolt <= 0) {
      WE.bolt = rnd(500, 1500);
      WE.bolts.push({ x: rnd(40, W - 40), life: 1 });
      if (Q.level < 3) flash = { c: "#cfe0ff", a: 0.22 };
      shake = Math.max(shake, 2);
      beep(90, 0.2, "sawtooth", 0.04, -40);
    }
  }
  if (k === "speed" && WE.gateX > -60) WE.gateX -= ev * 1.25 * f;
  if (k === "meteor") {
    WE.mT -= delta;
    if (WE.mT <= 0 && WE.left > 1500 && WE.meteors.length < 4) {
      WE.mT = rnd(800, 1400);
      WE.meteors.push({
        tx: Math.min(W - 60, p.x + rnd(70, 360)),
        t: 1100,
        T: 1100,
        x: 0,
        y: -40,
        hit: false,
      });
    }
  }
  for (const m of WE.meteors) {
    m.t -= delta;
    m.tx -= ev * f;
    const q = Math.max(0, 1 - m.t / m.T);
    m.x = m.tx + (1 - q) * 200;
    m.y = -40 + (groundY + 6) * q * q;
    if (
      !m.hit &&
      q > 0.35 &&
      invul <= 0 &&
      Math.abs(m.x - (p.x + p.w / 2)) < 18 + p.w / 2 &&
      Math.abs(m.y - (p.y + p.h / 2)) < 16 + p.h / 2
    ) {
      m.hit = true;
      m.t = -1;
      burst(m.x, m.y, "#ff8a5c", 16);
      if (hurt({ t: "meteor", x: 0, w: 0 })) return;
    }
    if (m.t <= 0 && !m.hit) {
      m.hit = true;
      shake = Math.max(shake, 6);
      burst(m.tx, groundY - 4, "#ff8a5c", 14);
      burst(m.tx, groundY - 4, "#ffd84f", 8);
      ring(m.tx, groundY - 6, "#ff8a5c", 52);
      beep(70, 0.22, "sawtooth", 0.06, -30);
      if (
        invul <= 0 &&
        Math.abs(m.tx - (p.x + p.w / 2)) < 30 + p.w / 2 &&
        p.y + p.h > groundY - 34
      ) {
        if (hurt({ t: "meteor", x: 0, w: 0 })) return;
      }
      for (let i = -1; i <= 1; i++)
        items.push({
          k: "coin",
          x: m.tx + i * 26,
          y: groundY - 34 - (i === 0 ? 16 : 0),
          r: 11,
          ct: 1,
          v: 3,
        }); // crystal shards
    }
  }
  compactInPlace(WE.meteors, (m) => !m.hit || m.t > -600);
  for (const b of WE.bolts) {
    b.life -= delta / 220;
    b.x -= ev * f * 0.5;
  }
  compactInPlace(WE.bolts, (b) => b.life > 0);
  if (WE.left <= 0) WE_end();
}
function WE_drawBack() {
  if (WE.dark > 0.01 && FX.light) {
    ctx.globalAlpha = (0.58 + (Math.random() < 0.04 ? 0.15 : 0)) * WE.dark;
    ctx.fillStyle = "#050818";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalAlpha = 1;
  }
  if (WE.kind === "storm" && FX.env) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#1a2460";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalAlpha = 1;
  }
}
function WE_drawFront() {
  const p = player,
    k = WE.kind;
  if (k && state === "play") {
    // thin event bar, top centre
    const d = WE_DEF[k],
      bw = Math.min(180, W * 0.4),
      bx = (W - bw) / 2,
      by = 8 * UI;
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = d.col;
    ctx.fillRect(bx, by, bw * Math.max(0, WE.left / WE.tot), 4);
  }
  if (k === "storm" && FX.env) {
    ctx.strokeStyle = "#e6f0ff";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    for (const b of WE.bolts) {
      ctx.globalAlpha = Math.min(1, b.life * 1.6);
      ctx.beginPath();
      let x = b.x,
        y = 0;
      ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) {
        x += ((i * 37 + b.x * 3) % 29) - 14;
        y += groundY / 7;
        ctx.lineTo(x, Math.min(y, groundY));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (k === "magnet") {
    const a = (frame * 0.05) % 1;
    ctx.strokeStyle = "#ff4fd8";
    for (let i = 0; i < 2; i++) {
      const q = (a + i * 0.5) % 1;
      ctx.globalAlpha = (1 - q) * 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 30 + q * 160, 0, 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (k === "speed" && WE.gateX > -60) {
    // energy gate sweeping past
    const gx = WE.gateX,
      h = groundY;
    ctx.fillStyle = "#53f7ff";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(gx - 5, 30, 5, h - 30);
    ctx.fillRect(gx + 40, 30, 5, h - 30);
    ctx.fillRect(gx - 5, 30, 50, 5);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(gx, 35, 40, h - 35);
    ctx.globalAlpha = 1;
  }
  for (const m of WE.meteors) {
    if (!m.hit) {
      const q = 1 - m.t / m.T;
      ctx.strokeStyle = "#ff4d4d";
      ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(frame * 0.3));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(m.tx, groundY + 2, 18 + 14 * q, 5 + 3 * q, 0, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,170,90,.55)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + 46, m.y - 70);
      ctx.stroke();
      ctx.fillStyle = "#ffb36b";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 12, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ff5a1f";
      ctx.beginPath();
      ctx.arc(m.x - 3, m.y - 2, 7, 0, 7);
      ctx.fill();
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= 0.045;
    r.r += (r.r1 - r.r) * 0.16;
    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = r.life * 0.8;
    ctx.strokeStyle = r.col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ============ MAIN LOOP — fixed 120 Hz simulation, rendering at the screen's own pace ============ */
const STEP = 1000 / 120;
function stepOnce(dt) {
  if (state === "play") simT += dt;
  if (freeze > 0 && state === "play") {
    freeze -= dt;
    return;
  }
  if (state === "play") updateGame(dt);
  else if (state !== "pause") {
    updateParticles(dt);
    if (state === "ready" || state === "won") {
      frame += dt / 16.67;
      scrollWorld(
        ((state === "won" ? 3 : 1.2 * INTRO.spd) * dt) / 16.67,
        dt / 16.67,
      );
    }
  }
}
function advance() {
  let n = 0;
  const MAXN = COARSE ? 8 : 14;
  while (acc >= STEP && n < MAXN) {
    acc -= STEP;
    n++;
    stepOnce(STEP);
  }
  if (n === MAXN) acc = 0; // after a long stall: drop the backlog instead of fast-forwarding
}
let ceilQ = 0,
  baseQ = 0,
  goodWin = 0,
  nextDraw = 0,
  thermalT = 0,
  hzRing = [],
  hz = 60,
  lastDown = -1e9,
  lastDraw = 0,
  perfOn = false,
  perfEl = null,
  pf = {
    n: 0,
    sum: 0,
    worst: 0,
    slow: 0,
    fps: 0,
    avg: 0,
    wst: 0,
    long: 0,
    t0: 0,
  };
function perfTick(raw, t) {
  // FPS monitor: F3 or ?fps=1 shows it; updates the text once per second only
  pf.n++;
  pf.sum += raw;
  if (raw > pf.worst) pf.worst = raw;
  if (raw > 33.4) pf.slow++;
  if (!pf.t0) pf.t0 = t;
  if (t - pf.t0 >= 1000) {
    pf.fps = Math.round((pf.n * 1000) / (t - pf.t0));
    pf.avg = pf.sum / pf.n;
    pf.wst = pf.worst;
    pf.slowN = pf.slow;
    pf.n = pf.sum = pf.worst = pf.slow = 0;
    pf.t0 = t;
    if (perfOn)
      perfEl.textContent = `${pf.fps} fps  avg ${pf.avg.toFixed(1)}ms  worst ${pf.wst.toFixed(0)}ms\nslow(>33ms) ${pf.slowN}  long tasks ${pf.long}\nQ${Q.level} ${gfx}${gfx === "auto" ? " (max " + ceilQ + ")" : ""}  ${canvas.width}x${canvas.height}  dpr ${DPR.toFixed(2)}\nparticles ${particles ? particles.length : 0}`;
  }
}
function togglePerf() {
  perfOn = !perfOn;
  if (perfOn && !perfEl) {
    perfEl = document.createElement("div");
    perfEl.id = "perf";
    document.body.appendChild(perfEl);
  }
  if (perfEl) perfEl.style.display = perfOn ? "block" : "none";
}
if ("PerformanceObserver" in window) {
  try {
    new PerformanceObserver((l) => {
      pf.long += l.getEntries().length;
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) {}
}
if (/[?&]fps\b/.test(location.search)) setTimeout(togglePerf, 0);
function loop(t) {
  requestAnimationFrame(loop); // schedule first, so one exception can never freeze the game
  if (window.__ZR_MANUAL) {
    lastT = 0;
    return;
  }
  if (document.hidden) {
    lastT = 0;
    return;
  } // background tab: no simulation, no drawing, no heat
  const raw = lastT ? t - lastT : 16.67;
  lastT = t;
  rafAvg += (raw - rafAvg) * 0.05;
  perfTick(raw, t);
  if (hzRing.length < 90) {
    hzRing.push(raw);
    if (hzRing.length === 90) {
      const s = hzRing.slice().sort((a, b) => a - b);
      hz = 1000 / s[45];
    }
  } // refresh-rate probe (median of 90 frames)
  acc += Math.min(raw, 100);
  advance();
  thermalT =
    state === "play" ? thermalT + raw : Math.max(0, thermalT - raw * 0.5);
  if (state !== "play") {
    // menus / pause / game-over: nothing fast moves, so redraw at ~30 fps (pause: ~4 fps)
    if (
      t - lastDraw <
      (state === "pause" ? 250 : INTRO.on ? 0 : CFG.bgsave === false ? 32 : 60)
    )
      return;
  } else {
    const cap =
      FPSCAP > 0
        ? FPSCAP
        : CFG.thermal && thermalT > 180000
          ? 30
          : CFG.battery
            ? 30
            : 0; // thermal-friendly: after 3 min of play the draw rate drops to 30
    if (cap > 0) {
      const dt = 1000 / cap;
      if (t < nextDraw - 1.5) return;
      nextDraw = Math.max(nextDraw + dt, t - dt);
    } else if (FPSCAP === 0 && rafAvg < 11.5) {
      skipDraw = !skipDraw;
      if (skipDraw) return;
    } // auto on 90/120 Hz screens: simulate every frame, draw every other one
  }
  lastDraw = t;
  if (state === "play" && ++fpsN > 0) {
    // adaptive quality: lowers fast when slow, raises slowly when the device has headroom
    fpsAcc += Math.min(raw, 50); // one random hitch must not count as "slow device"
    if (fpsN >= 20) {
      // judge every 20 frames
      const avg = fpsAcc / fpsN;
      if (avg > 22) slowW++;
      else slowW = 0;
      if (
        CFG.adaptive !== false &&
        gfx === "auto" && // a preset the player picked by hand (Ultra / High / ...) is never lowered behind their back
        avg > 22 &&
        (slowW >= 2 || avg > 34) &&
        Q.level < 3
      ) {
        slowW = 0;
        const from = Q.level;
        setQuality(Math.min(3, Q.level + (avg > 34 ? 2 : 1))); // very slow → skip a level
        ceilQ = Math.max(ceilQ, from + 1);
        goodWin = 0;
        lastDown = t; // never climb back to a level that just failed
        if (COARSE) store.set("zr_q2", Math.min(2, Q.level)); // next launch starts at the level this phone can handle (never the lowest)
      } else if (
        CFG.adaptive !== false &&
        avg < (rafAvg < 11.5 ? 11 : 18) &&
        Q.level > Math.max(ceilQ, baseQ, FLOOR) &&
        t - lastDown > 15000
      ) {
        if (++goodWin >= 10) {
          setQuality(Q.level - 1);
          goodWin = 0;
          lastDown = t - 8000;
          if (COARSE) store.set("zr_q2", Math.min(2, Q.level));
        } // ~3.5 s of clear headroom
      } else goodWin = 0;
      fpsAcc = 0;
      fpsN = 0;
    }
  }
  if (state !== "pause" || !document.hidden) draw();
}
window.ZR = {
  get hz() {
    return hz;
  },
  get FX() {
    return FX;
  },
  get perf() {
    return pf;
  },
  get Q() {
    return Q;
  },
  get state() {
    return state;
  },
  step(raw) {
    acc += Math.min(raw, 100);
    advance();
  },
  draw,
}; // small test hook (used by the automated tests)

/* ============ INPUT — one reliable path for keyboard, mouse and touch ============ */
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"],
  DUCK_KEYS = ["ArrowDown", "KeyS"];
function action() {
  // tap / click / space on a menu screen
  if (state === "ready" || state === "over" || state === "won") startGame();
  else if (state === "pause") resumeGame();
}
function pressJump() {
  if (state !== "play") {
    action();
    return;
  }
  const now = simT;
  jumpHeld = true;
  if (now - lastJumpAt < J.GAP) return; // the same tap reported twice → never an accidental double jump
  jumpBuf = now; // remembered for J.BUFFER ms, so it can't be lost between frames
}
function releaseJump() {
  jumpHeld = false;
}
document.addEventListener("keydown", (e) => {
  if (e.code === "F3") {
    e.preventDefault();
    togglePerf();
    return;
  }
  if (JUMP_KEYS.includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) pressJump();
  } else if (DUCK_KEYS.includes(e.code)) {
    e.preventDefault();
    duckKey = true;
  } else if (
    e.code === "KeyT" ||
    e.code === "ShiftLeft" ||
    e.code === "ShiftRight"
  ) {
    useTurbo();
  } else if (e.code === "KeyX" || e.code === "KeyZ") {
    x11Zap();
  } else if (e.code === "KeyP" || e.code === "Escape") {
    state === "pause" ? resumeGame() : pauseGame();
  } else if (e.code === "KeyM") toggleMute();
  else if (e.code === "KeyR") {
    resetGame();
    showReady();
  } else if (e.code === "KeyF") toggleFs();
});
document.addEventListener("keyup", (e) => {
  if (JUMP_KEYS.includes(e.code)) releaseJump();
  if (DUCK_KEYS.includes(e.code)) duckKey = false;
});

let py = 0;
canvas.addEventListener("pointerdown", (e) => {
  py = e.clientY;
  pressJump();
});
canvas.addEventListener("pointermove", (e) => {
  if ((e.buttons || e.pointerType === "touch") && e.clientY - py > SWIPE)
    duckPtr = true;
});
["pointerup", "pointercancel"].forEach((n) =>
  canvas.addEventListener(n, () => {
    duckPtr = false;
    releaseJump();
  }),
);

function holdButton(el, down, up) {
  // multi-touch safe: tracks every finger on the button
  const ids = new Set();
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (x) {}
    ids.add(e.pointerId);
    el.classList.add("on");
    down();
  });
  const end = (e) => {
    ids.delete(e.pointerId);
    if (!ids.size) {
      el.classList.remove("on");
      up();
    }
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) =>
    el.addEventListener(n, end),
  );
}
holdButton($("padJump"), pressJump, releaseJump);
holdButton(
  $("padDuck"),
  () => {
    duckBtn = true;
  },
  () => {
    duckBtn = false;
  },
);

// keep the browser out of the way while playing (scroll, pull-to-refresh, pinch, double-tap zoom)
document.addEventListener(
  "touchmove",
  (e) => {
    if (state === "play") e.preventDefault();
  },
  { passive: false },
);
["gesturestart", "gesturechange", "dblclick"].forEach((n) =>
  document.addEventListener(n, (e) => {
    if (state === "play") e.preventDefault();
  }),
);
window.addEventListener("blur", () => {
  resetInputs();
  if (state === "play" && CFG.autopause !== false) pauseGame();
});

$("startButton").addEventListener("click", () => {
  if (shopOpen) goMenu();
  else if (state === "revive") doRevive();
  else if (state === "pause") resumeGame();
  else startGame();
});
$("restartButton").addEventListener("click", () => {
  resetGame();
  startGame();
});
$("pauseButton").addEventListener("click", () =>
  state === "pause" ? resumeGame() : pauseGame(),
);
$("muteButton").addEventListener("click", toggleMute);
$("fullscreenButton").addEventListener("click", toggleFs);

$("diff").addEventListener("click", (e) => {
  const d = e.target.dataset.d;
  if (!d) return;
  diff = d;
  store.set("zr_diff", d);
  paintDiff();
  resetGame();
  updateHUD();
});
$("skinBox").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-s]");
  if (!btn) return;
  const s = SKINS.find((k) => k.id === btn.dataset.s);
  if (!owned.includes(s.id)) {
    if (wallet < s.cost) {
      btn.classList.remove("shake");
      void btn.offsetWidth;
      btn.classList.add("shake");
      vib(30);
      return;
    }
    wallet -= s.cost;
    owned.push(s.id);
    store.set("zr_wallet", wallet);
    store.set("zr_owned", owned);
    sfx.power();
  }
  skin = s.id;
  store.set("zr_skin", skin);
  $("skinBox").innerHTML = renderSkins();
});

$("mode").addEventListener("click", (e) => {
  const m = e.target.dataset.m;
  if (!m || m === mode) return;
  mode = m;
  store.set("zr_mode", m);
  goMenu();
});
$("levelBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-l]");
  if (!b) return;
  const i = +b.dataset.l;
  if (i >= prog.unlocked) {
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    vib(30);
    return;
  }
  sel = i;
  store.set("zr_sel", i);
  goMenu();
});
$("menuButton").addEventListener("click", () => {
  if (state === "revive") finalizeOver();
  else goMenu();
});
$("padTurbo").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  useTurbo();
});
$("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-p]");
  if (!b) return;
  b.dataset.p === "play" ? goMenu() : showPanel(b.dataset.p);
});
$("dailyBox").addEventListener("click", (e) => {
  if (!e.target.closest("#giftBtn")) return;
  const td = todayStr();
  if (meta.boxDay === td) return;
  const lucky = Math.random() < 0.2 ? 100 : 0,
    amt = 30 + Math.min(meta.streak, 7) * 15 + lucky;
  wallet += amt;
  meta.boxDay = td;
  store.set("zr_wallet", wallet);
  checkAch();
  saveMeta();
  sfx.power();
  vib(30);
  $("dailyBox").innerHTML =
    renderDaily() +
    `<div class="gift-got">🎁 +◎${amt}${lucky ? t("gift.lucky") : ""}</div>`;
  if ($("skinBox").innerHTML) $("skinBox").innerHTML = renderSkins();
});
$("shareButton").addEventListener("click", async () => {
  const b = $("shareButton"),
    old = b.textContent;
  const txt = t("share.text", {
    s: fmt(score),
    c: coins,
    lv: lvl ? t("share.lv", { name: lvl.name, d: Math.floor(dist) }) : "",
  });
  try {
    if (navigator.share)
      await navigator.share({
        title: "ZUMARY RUN",
        text: txt,
        url: location.href,
      });
    else {
      await navigator.clipboard.writeText(txt + " " + location.href);
      b.textContent = t("share.copied");
      setTimeout(() => (b.textContent = old), 1500);
    }
  } catch (x) {}
});
$("shopBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-u]");
  if (!b) return;
  const it = SHOP.find((x) => x.k === b.dataset.u),
    lv = up[it.k] || 0;
  if (lv >= it.max) return;
  const cost = it.cost[lv];
  if (wallet < cost) {
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    vib(30);
    beep(160, 0.15, "sawtooth", 0.04);
    return;
  }
  wallet -= cost;
  up[it.k] = lv + 1;
  store.set("zr_wallet", wallet);
  store.set("zr_up", up);
  sfx.power();
  vib(25);
  $("shopBox").innerHTML = renderShop();
});

$("shopBox").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cfg],button[data-act]");
  if (!b) return;
  if (b.dataset.act === "gfx") {
    gfx = GFX[(GFX.indexOf(gfx) + 1) % GFX.length];
    store.set("zr_gfx", gfx);
    applyGfx();
    b.textContent = t("gfx." + gfx);
    return;
  }
  const k = b.dataset.cfg;
  CFG[k] = !CFG[k];
  saveCfg();
  b.classList.toggle("on", CFG[k]);
  b.textContent = t(CFG[k] ? "set.on" : "set.off");
  if (k === "left") document.body.classList.toggle("lefty", CFG.left);
  if (k === "vib" && CFG.vib) vib(30);
});
$("shopBox").addEventListener("input", (e) => {
  const k = e.target.dataset.vol;
  if (!k) return;
  CFG[k] = e.target.value / 100;
  saveCfg();
  if (ac) {
    busS.gain.value = CFG.sfx;
    busM.gain.value = CFG.music;
  }
});
$("shopBox").addEventListener("change", (e) => {
  if (e.target.dataset.vol) beep(660, 0.07, "triangle", 0.06);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (CFG.autopause !== false) pauseGame();
    else invul = Math.max(invul, 1500);
    if (CFG.bgsave !== false && ac && ac.state === "running")
      ac.suspend().catch(() => {});
  } else if (ac && ac.state === "suspended" && !muted)
    ac.resume().catch(() => {});
});
window.addEventListener("pagehide", () => {
  saveMeta();
  if (CFG.autopause !== false) pauseGame();
});
shell.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) b.blur();
});

function toggleMute() {
  muted = !muted;
  store.set("zr_muted", muted);
  if (!muted && state === "play") startMusic();
  $("muteButton").firstChild.textContent = muted ? "🔇" : "🔊";
}

/* ============ FULL SCREEN (native when possible, CSS fallback for iPhone) ============ */
let fsOn = false;
function setFs(on) {
  fsOn = on;
  shell.classList.toggle("fs", on);
  document.body.classList.toggle("fs-lock", on);
  window.scrollTo(0, 0);
}
async function toggleFs() {
  resetInputs();
  const on = !fsOn;
  setFs(on);
  const el = shell,
    req = el.requestFullscreen || el.webkitRequestFullscreen,
    ex = document.exitFullscreen || document.webkitExitFullscreen,
    cur = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (on) {
      if (req) await req.call(el, { navigationUI: "hide" });
      if (COARSE && screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch (x) {}
      }
    } else {
      if (cur && ex) await ex.call(document);
      if (screen.orientation && screen.orientation.unlock)
        screen.orientation.unlock();
    }
  } catch (x) {} // no native fullscreen (iPhone) or denied: the CSS full-screen layout stays on
  resize();
  requestAnimationFrame(resize);
  setTimeout(resize, 350);
}
function onFsChange() {
  const cur = document.fullscreenElement || document.webkitFullscreenElement;
  if (!cur && fsOn && nativeFs) setFs(false);
  nativeFs = !!cur;
  resize();
}
let nativeFs = false;
document.addEventListener("fullscreenchange", onFsChange);
document.addEventListener("webkitfullscreenchange", onFsChange);
/* a second full-screen button that sits on top of the start menu, so full screen never has to be reached
   through (or after) the menu sheet that covers the page on phones */
{
  const ov = $("overlay");
  if (ov) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "fsMenuBtn";
    b.setAttribute("aria-label", "Full screen");
    b.textContent = "⛶";
    b.style.cssText =
      "position:absolute;z-index:60;top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 10px);width:44px;height:44px;border-radius:12px;border:1px solid rgba(120,240,255,.5);background:rgba(8,12,30,.78);color:#8ff;font-size:22px;line-height:1;cursor:pointer;display:none";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFs();
    });
    ov.appendChild(b);
    const sync = () => {
      b.style.display = ov.classList.contains("hidden") ? "none" : "block";
    };
    new MutationObserver(sync).observe(ov, {
      attributes: true,
      attributeFilter: ["class"],
    });
    sync();
  }
}

/* ============ GRAPHICS ============ */
const GFX = ["auto", "ultra", "high", "medium", "low", "custom"];
let gfx = store.get("zr_gfx", "auto");
if (!GFX.includes(gfx)) gfx = "auto";
const gfxLabel = () =>
  ($("gfxLabel").textContent = " " + t("gfx") + ": " + t("gfx." + gfx));
const GFX_LVL = { ultra: 0, high: 1, medium: 2, low: 3 };
function applyGfx() {
  const fixed =
    gfx === "custom" ? Math.max(0, Math.min(3, CFG.cq | 0)) : GFX_LVL[gfx];
  baseQ = fixed !== undefined ? fixed : COARSE ? 1 : 0; // best level adaptive quality may climb back to
  ceilQ = 0;
  setQuality(
    fixed !== undefined
      ? fixed
      : COARSE
        ? Math.max(
            1,
            Math.min(3, CFG.autoopt === false ? 1 : store.get("zr_q2", 1) | 0),
          )
        : 1,
  );
  gfxLabel();
}
$("gfxButton").addEventListener("click", () => {
  gfx = GFX[(GFX.indexOf(gfx) + 1) % GFX.length];
  store.set("zr_gfx", gfx);
  applyGfx();
  toast("🎨 " + t("gfx") + ": " + t("gfx." + gfx));
});

/* ============ LANGUAGE ============ */
window.onLangChange = () => {
  hudLast.score = hudLast.best = hudLast.speed = hudLast.coins = undefined;
  gfxLabel();
  if (!$("overlay").classList.contains("hidden")) {
    if (shopOpen) showPanel(curPanel);
    else if (screenFn) screenFn();
  }
  updateHUD();
};

/* ============ INIT ============ */
if ("ResizeObserver" in window)
  new ResizeObserver(() => resize()).observe(wrap);
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 250));
$("muteButton").firstChild.textContent = muted ? "🔇" : "🔊";
document.body.classList.toggle("lefty", CFG.left);
applyGfx();
resetGame();
showReady();
introStart();
requestAnimationFrame(loop);
{
  const warm = [
    () => runnerSheet(),
    () => coinSheet(),
    () => guardSheet(),
    () => dogSheet(),
    () => Object.keys(POWER).forEach(badgeOf),
    () => {
      heartSprite(true);
      heartSprite(false);
    },
    () => ["hazard", "crate", "cones"].forEach(obstSprite),
  ];
  const run = () => {
    const f = warm.shift();
    if (f) {
      f();
      setTimeout(run, 30);
    }
  };
  setTimeout(run, 120);
}
setTimeout(buildThumbs, 150);
