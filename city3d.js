/* =====================================================
   ZUMARY CITY RUN 3D — real 3D (WebGL, no libraries) 3-lane street runner.
   • own tiny WebGL engine: meshes, lambert + spec + rim lighting, exp fog, sky shader, mip-mapped anisotropic textures
   • a 3D city of four Uzbek towns is generated chunk by chunk (Tashkent, Samarkand, Bukhara, Khiva)
   • robot hero / police robot / hound are built from 3D parts and animated with a joint hierarchy
   Falls back to city.html (the 2.5D version) when WebGL is not available.
===================================================== */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cv = $("c"),
    hudc = $("hud"),
    hx = hudc.getContext("2d");
  const COARSE = matchMedia("(pointer:coarse)").matches;
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    rnd = (a, b) => a + Math.random() * (b - a),
    TAU = Math.PI * 2,
    lerp = (a, b, t) => a + (b - a) * t;
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* ---------- texts ---------- */
  const TX = {
    uz: {
      title: "SHAHAR YUGURISH 3D",
      sub: "Ko'cha o'rtasida yugur, tanga yig', to'siqlardan qoch.<br>Chapga/o'ngga surish — yo'l almashtirish · yuqoriga — sakrash · pastga — sirpanish.",
      play: "BOSHLASH",
      again: "YANA",
      back: "◀ ASOSIY O'YIN",
      best: "REKORD",
      score: "NATIJA",
      coins: "TANGA",
      busted: "USHLANDI!",
      caught: "Politsiya sizni ushladi",
      stumble: "EHTIYOT BO'L!",
      m: "m",
      paused: "PAUZA",
      newbest: "YANGI REKORD!",
      loading: "Shahar qurilmoqda…",
    },
    en: {
      title: "CITY RUN 3D",
      sub: "Run down the middle of the street, grab coins, dodge obstacles.<br>Swipe left/right to change lane · up to jump · down to slide.",
      play: "START",
      again: "AGAIN",
      back: "◀ MAIN GAME",
      best: "BEST",
      score: "SCORE",
      coins: "COINS",
      busted: "BUSTED!",
      caught: "The police got you",
      stumble: "WATCH OUT!",
      m: "m",
      paused: "PAUSED",
      newbest: "NEW BEST!",
      loading: "Building the city…",
    },
    ja: {
      title: "シティラン 3D",
      sub: "街の真ん中を走って、コインを集めて、障害物をよけよう。<br>左右スワイプでレーン変更 · 上でジャンプ · 下でスライディング。",
      play: "スタート",
      again: "もう一度",
      back: "◀ メインゲーム",
      best: "ベスト",
      score: "スコア",
      coins: "コイン",
      busted: "確保！",
      caught: "警察に捕まった",
      stumble: "危ない！",
      m: "m",
      paused: "一時停止",
      newbest: "新記録！",
      loading: "街を作っています…",
    },
  };
  let LG = "uz";
  try {
    const s = localStorage.getItem("zr_lang");
    if (s && TX[s]) LG = s;
    else {
      const n = (navigator.language || "uz").slice(0, 2);
      if (TX[n]) LG = n;
    }
  } catch (e) {}
  Object.assign(TX.uz, {
    pow_mag: "MAGNIT",
    pow_shield: "QALQON",
    pow_turbo: "TURBO!",
    pow_dbl: "2× TANGA",
    pow_jet: "JETPACK",
    close: "XAVFLI O'TISH!",
    heli: "VERTOLYOT! Yorug'likdan qoch",
    heliEnd: "Qutuldingiz! +100",
    shieldBreak: "QALQON SINDI",
    zumary: "ZUMARY! +500",
    missions: "KUNLIK VAZIFALAR",
    level: "DARAJA",
    revive: "DAVOM ETISH · 100 TANGA",
    missionDone: "VAZIFA BAJARILDI",
    lvlUp: "YANGI DARAJA!",
    m_dist: "{n} m yugur",
    m_jump: "{n} marta sakra",
    m_slide: "{n} marta sirpan",
    m_close: "{n} ta xavfli o'tish",
    m_power: "{n} ta bonus ol",
    m_letters: "ZUMARY so'zini yig'",
    m_ramp: "{n} ta rampadan uch",
    m_smash: "Turbo bilan {n} ta to'siq sindir",
    m_coinsRun: "Bir o'yinda {n} ta tanga yig'",
  });
  Object.assign(TX.en, {
    pow_mag: "MAGNET",
    pow_shield: "SHIELD",
    pow_turbo: "TURBO!",
    pow_dbl: "2× COINS",
    pow_jet: "JETPACK",
    close: "CLOSE CALL!",
    heli: "HELICOPTER! Stay out of the light",
    heliEnd: "Escaped! +100",
    shieldBreak: "SHIELD BROKE",
    zumary: "ZUMARY! +500",
    missions: "DAILY MISSIONS",
    level: "LEVEL",
    revive: "CONTINUE · 100 COINS",
    missionDone: "MISSION COMPLETE",
    lvlUp: "LEVEL UP!",
    m_dist: "Run {n} m",
    m_jump: "Jump {n} times",
    m_slide: "Slide {n} times",
    m_close: "{n} close calls",
    m_power: "Grab {n} power-ups",
    m_letters: "Spell ZUMARY",
    m_ramp: "Launch off {n} ramps",
    m_smash: "Smash {n} obstacles with Turbo",
    m_coinsRun: "Collect {n} coins in one run",
  });
  Object.assign(TX.ja, {
    pow_mag: "マグネット",
    pow_shield: "シールド",
    pow_turbo: "ターボ！",
    pow_dbl: "コイン2倍",
    pow_jet: "ジェットパック",
    close: "ギリギリ！",
    heli: "ヘリ！ライトに当たるな",
    heliEnd: "脱出！ +100",
    shieldBreak: "シールド破壊",
    zumary: "ZUMARY！ +500",
    missions: "デイリーミッション",
    level: "レベル",
    revive: "続ける · 100コイン",
    missionDone: "ミッション達成",
    lvlUp: "レベルアップ！",
    m_dist: "{n} m 走る",
    m_jump: "{n} 回ジャンプ",
    m_slide: "{n} 回スライド",
    m_close: "ギリギリ回避 {n} 回",
    m_power: "パワーアップ {n} 個",
    m_letters: "ZUMARY を集める",
    m_ramp: "ランプで {n} 回ジャンプ",
    m_smash: "ターボで障害物 {n} 個破壊",
    m_coinsRun: "1回で {n} コイン",
  });
  const T = (k) => TX[LG][k];
  document.documentElement.lang = LG;

  /* ---------- WebGL ---------- */
  let gl = null;
  try {
    gl =
      cv.getContext("webgl", {
        antialias: !COARSE,
        alpha: false,
        depth: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }) || cv.getContext("experimental-webgl");
  } catch (e) {}
  if (!gl) {
    location.replace("./city.html");
    return;
  }
  const ANISO =
    gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  cv.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
  });
  cv.addEventListener("webglcontextrestored", () => location.reload());

  /* ---------- matrices (column-major) ---------- */
  const M4 = {
    id() {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },
    mul(a, b, o) {
      o = o || new Float32Array(16);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
          o[c * 4 + r] =
            a[r] * b[c * 4] +
            a[4 + r] * b[c * 4 + 1] +
            a[8 + r] * b[c * 4 + 2] +
            a[12 + r] * b[c * 4 + 3];
      return o;
    },
    persp(fy, as, n, f) {
      const t = 1 / Math.tan(fy / 2),
        o = new Float32Array(16);
      o[0] = t / as;
      o[5] = t;
      o[10] = (f + n) / (n - f);
      o[11] = -1;
      o[14] = (2 * f * n) / (n - f);
      return o;
    },
    look(e, c, u) {
      let zx = e[0] - c[0],
        zy = e[1] - c[1],
        zz = e[2] - c[2],
        l = Math.hypot(zx, zy, zz);
      zx /= l;
      zy /= l;
      zz /= l;
      let xx = u[1] * zz - u[2] * zy,
        xy = u[2] * zx - u[0] * zz,
        xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz);
      xx /= l;
      xy /= l;
      xz /= l;
      const yx = zy * xz - zz * xy,
        yy = zz * xx - zx * xz,
        yz = zx * xy - zy * xx;
      return new Float32Array([
        xx,
        yx,
        zx,
        0,
        xy,
        yy,
        zy,
        0,
        xz,
        yz,
        zz,
        0,
        -(xx * e[0] + xy * e[1] + xz * e[2]),
        -(yx * e[0] + yy * e[1] + yz * e[2]),
        -(zx * e[0] + zy * e[1] + zz * e[2]),
        1,
      ]);
    },
    T(x, y, z) {
      const o = M4.id();
      o[12] = x;
      o[13] = y;
      o[14] = z;
      return o;
    },
    RX(a) {
      const o = M4.id(),
        c = Math.cos(a),
        s = Math.sin(a);
      o[5] = c;
      o[6] = s;
      o[9] = -s;
      o[10] = c;
      return o;
    },
    RY(a) {
      const o = M4.id(),
        c = Math.cos(a),
        s = Math.sin(a);
      o[0] = c;
      o[2] = -s;
      o[8] = s;
      o[10] = c;
      return o;
    },
    RZ(a) {
      const o = M4.id(),
        c = Math.cos(a),
        s = Math.sin(a);
      o[0] = c;
      o[1] = s;
      o[4] = -s;
      o[5] = c;
      return o;
    },
  };
  const POOL = Array.from({ length: 700 }, () => new Float32Array(16));
  let PIX_I = 0;
  const nm = () => POOL[PIX_I++ % 700];
  function Tp(x, y, z) {
    const o = nm();
    o.fill(0);
    o[0] = o[5] = o[10] = o[15] = 1;
    o[12] = x;
    o[13] = y;
    o[14] = z;
    return o;
  }
  function joint(p, x, y, z, rx, ry, rz) {
    // parent × T × Rz × Ry × Rx, allocation-free
    rx = rx || 0;
    ry = ry || 0;
    rz = rz || 0;
    const cx = Math.cos(rx),
      sx = Math.sin(rx),
      cy = Math.cos(ry),
      sy = Math.sin(ry),
      cz = Math.cos(rz),
      sz = Math.sin(rz);
    const c = [
        cz * cy,
        sz * cy,
        -sy,
        cz * sy * sx - sz * cx,
        sz * sy * sx + cz * cx,
        cy * sx,
        cz * sy * cx + sz * sx,
        sz * sy * cx - cz * sx,
        cy * cx,
        x,
        y,
        z,
      ],
      o = nm();
    for (let k = 0; k < 4; k++) {
      const a = c[k * 3],
        b = c[k * 3 + 1],
        d = c[k * 3 + 2],
        w = k === 3 ? 1 : 0;
      o[k * 4] = p[0] * a + p[4] * b + p[8] * d + p[12] * w;
      o[k * 4 + 1] = p[1] * a + p[5] * b + p[9] * d + p[13] * w;
      o[k * 4 + 2] = p[2] * a + p[6] * b + p[10] * d + p[14] * w;
      o[k * 4 + 3] = w;
    }
    return o;
  }

  /* ---------- shaders ---------- */
  function prog(vs, fs, attrs) {
    const mk = (t, s) => {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }
  const MAIN = prog(
    `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aT; attribute vec3 aC;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vN; varying vec3 vC; varying vec3 vW; varying vec2 vT;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vT = aT; vC = aC; gl_Position = uVP * w; }`,
    `
precision mediump float;
uniform sampler2D uTex; uniform vec3 uTint; uniform float uEmis, uSpec, uRim, uAlpha, uFogK, uCut;
uniform vec3 uSun, uSunCol, uSky, uGnd, uFog, uCam, uRimCol;
varying vec3 vN; varying vec3 vC; varying vec3 vW; varying vec2 vT;
void main(){
  vec4 t = texture2D(uTex, vT); if (t.a < uCut) discard;
  vec3 base = t.rgb * vC * uTint;
  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
  float d = max(dot(n, uSun), 0.0); vec3 amb = mix(uGnd, uSky, n.y * 0.5 + 0.5);
  vec3 col = base * (amb + uSunCol * d);
  vec3 h = normalize(uSun + v); col += uSpec * pow(max(dot(n, h), 0.0), 40.0) * uSunCol;
  col += uRim * pow(1.0 - max(dot(n, v), 0.0), 3.0) * uRimCol;
  col = mix(col, base * 1.25, uEmis);
  float dist = length(uCam - vW); float f = 1.0 - exp(-pow(dist * uFogK, 1.7));
  col = mix(col, uFog, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, t.a * uAlpha);
}`,
    ["aP", "aN", "aT", "aC"],
  );
  const SKY = prog(
    `attribute vec3 aP; varying vec2 vQ; void main(){ vQ = aP.xy; gl_Position = vec4(aP.xy, 0.9999, 1.0); }`,
    `
precision mediump float;
uniform vec3 uTop, uMid, uLow, uSun, uSunCol, uF, uR, uU; uniform vec2 uTan; varying vec2 vQ;
void main(){
  vec3 ray = normalize(uF + uR * vQ.x * uTan.x + uU * vQ.y * uTan.y); float h = ray.y;
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.22, h)); c = mix(c, uTop, smoothstep(0.18, 0.75, h)); if (h < 0.0) c = uLow;
  c += 0.025 * sin(h * 55.0 + ray.x * 6.0) * (1.0 - smoothstep(0.0, 0.5, h));
  float s = max(dot(ray, uSun), 0.0); c += uSunCol * (pow(s, 900.0) * 1.6 + pow(s, 22.0) * 0.4 + pow(s, 4.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
}`,
    ["aP"],
  );

  /* ---------- geometry builder ---------- */
  const WHITE = [1, 1, 1];
  class B {
    constructor() {
      this.v = [];
      this.i = [];
      this.n = 0;
    }
    vert(x, y, z, nx, ny, nz, u, v, c) {
      this.v.push(x, y, z, nx, ny, nz, u, v, c[0], c[1], c[2]);
      return this.n++;
    }
    quad(p, nrm, uv, c) {
      const a = this.vert(
          p[0][0],
          p[0][1],
          p[0][2],
          nrm[0],
          nrm[1],
          nrm[2],
          uv[0][0],
          uv[0][1],
          c,
        ),
        b = this.vert(
          p[1][0],
          p[1][1],
          p[1][2],
          nrm[0],
          nrm[1],
          nrm[2],
          uv[1][0],
          uv[1][1],
          c,
        ),
        cc = this.vert(
          p[2][0],
          p[2][1],
          p[2][2],
          nrm[0],
          nrm[1],
          nrm[2],
          uv[2][0],
          uv[2][1],
          c,
        ),
        d = this.vert(
          p[3][0],
          p[3][1],
          p[3][2],
          nrm[0],
          nrm[1],
          nrm[2],
          uv[3][0],
          uv[3][1],
          c,
        );
      this.i.push(a, b, cc, a, cc, d);
    }
    box(cx, cy, cz, w, h, d, c, o) {
      // o.uv = { face: [u0,v0,u1,v1] } faces: px nx py ny pz nz
      o = o || {};
      const x0 = cx - w / 2,
        x1 = cx + w / 2,
        y0 = cy - h / 2,
        y1 = cy + h / 2,
        z0 = cz - d / 2,
        z1 = cz + d / 2,
        U = o.uv || {},
        F = (k) => U[k] || [0.02, 0.02, 0.03, 0.03],
        ck = (k) => (o.cols && o.cols[k]) || c;
      const face = (k, p, n) => {
        const u = F(k);
        this.quad(
          p,
          n,
          [
            [u[0], u[3]],
            [u[2], u[3]],
            [u[2], u[1]],
            [u[0], u[1]],
          ],
          ck(k),
        );
      };
      if (!o.skip || !o.skip.px)
        face(
          "px",
          [
            [x1, y0, z1],
            [x1, y0, z0],
            [x1, y1, z0],
            [x1, y1, z1],
          ],
          [1, 0, 0],
        );
      if (!o.skip || !o.skip.nx)
        face(
          "nx",
          [
            [x0, y0, z0],
            [x0, y0, z1],
            [x0, y1, z1],
            [x0, y1, z0],
          ],
          [-1, 0, 0],
        );
      if (!o.skip || !o.skip.py)
        face(
          "py",
          [
            [x0, y1, z1],
            [x1, y1, z1],
            [x1, y1, z0],
            [x0, y1, z0],
          ],
          [0, 1, 0],
        );
      if (!o.skip || !o.skip.ny)
        face(
          "ny",
          [
            [x0, y0, z0],
            [x1, y0, z0],
            [x1, y0, z1],
            [x0, y0, z1],
          ],
          [0, -1, 0],
        );
      if (!o.skip || !o.skip.pz)
        face(
          "pz",
          [
            [x0, y0, z1],
            [x1, y0, z1],
            [x1, y1, z1],
            [x0, y1, z1],
          ],
          [0, 0, 1],
        );
      if (!o.skip || !o.skip.nz)
        face(
          "nz",
          [
            [x1, y0, z0],
            [x0, y0, z0],
            [x0, y1, z0],
            [x1, y1, z0],
          ],
          [0, 0, -1],
        );
    }
    cyl(cx, cy, cz, r0, r1, h, seg, c, cap, c2) {
      // vertical, base at cy; optional alternating colour c2 for ribs
      const sl = Math.atan2(r0 - r1, h);
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * TAU,
          a1 = ((s + 1) / seg) * TAU,
          cc = c2 && s % 2 ? c2 : c,
          am = (a0 + a1) / 2,
          nx = Math.cos(am) * Math.cos(sl),
          nz = Math.sin(am) * Math.cos(sl),
          ny = Math.sin(sl);
        const u0 = s / seg,
          u1 = (s + 1) / seg;
        this.quad(
          [
            [cx + Math.cos(a0) * r0, cy, cz + Math.sin(a0) * r0],
            [cx + Math.cos(a1) * r0, cy, cz + Math.sin(a1) * r0],
            [cx + Math.cos(a1) * r1, cy + h, cz + Math.sin(a1) * r1],
            [cx + Math.cos(a0) * r1, cy + h, cz + Math.sin(a0) * r1],
          ],
          [nx, ny, nz],
          [
            [u0, 1],
            [u1, 1],
            [u1, 0],
            [u0, 0],
          ],
          cc,
        );
      }
      if (cap)
        for (const top of [0, 1]) {
          const y = top ? cy + h : cy,
            r = top ? r1 : r0;
          if (r <= 0.001) continue;
          const ct = this.vert(cx, y, cz, 0, top ? 1 : -1, 0, 0.5, 0.5, c);
          let prev = -1;
          for (let s = 0; s <= seg; s++) {
            const a = (s / seg) * TAU,
              q = this.vert(
                cx + Math.cos(a) * r,
                y,
                cz + Math.sin(a) * r,
                0,
                top ? 1 : -1,
                0,
                0.5 + Math.cos(a) * 0.5,
                0.5 + Math.sin(a) * 0.5,
                c,
              );
            if (prev >= 0) this.i.push(ct, prev, q);
            prev = q;
          }
        }
    }
    sph(cx, cy, cz, rx, ry, rz, la, lo, c) {
      for (let i = 0; i < la; i++)
        for (let j = 0; j < lo; j++) {
          const t0 = (i / la) * Math.PI,
            t1 = ((i + 1) / la) * Math.PI,
            p0 = (j / lo) * TAU,
            p1 = ((j + 1) / lo) * TAU;
          const P = (t, p) => [
              cx + Math.sin(t) * Math.cos(p) * rx,
              cy + Math.cos(t) * ry,
              cz + Math.sin(t) * Math.sin(p) * rz,
            ],
            Nn = (t, p) => [
              Math.sin(t) * Math.cos(p),
              Math.cos(t),
              Math.sin(t) * Math.sin(p),
            ];
          const A = [P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0)],
            Nm = [Nn(t0, p0), Nn(t0, p1), Nn(t1, p1), Nn(t1, p0)];
          const ids = A.map((q, k) =>
            this.vert(
              q[0],
              q[1],
              q[2],
              Nm[k][0],
              Nm[k][1],
              Nm[k][2],
              j / lo,
              i / la,
              c,
            ),
          );
          this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
        }
    }
    lathe(cx, cy, cz, pts, seg, c, c2) {
      // pts: [[r, y], ...] bottom → top
      for (let k = 0; k < pts.length - 1; k++) {
        const [r0, y0] = pts[k],
          [r1, y1] = pts[k + 1],
          dr = r1 - r0,
          dy = y1 - y0,
          l = Math.hypot(dr, dy) || 1,
          ny = -dr / l,
          nr = dy / l;
        for (let s = 0; s < seg; s++) {
          const a0 = (s / seg) * TAU,
            a1 = ((s + 1) / seg) * TAU,
            am = (a0 + a1) / 2,
            cc = c2 && s % 2 ? c2 : c,
            g = 0.8 + 0.2 * (k / pts.length);
          this.quad(
            [
              [cx + Math.cos(a0) * r0, cy + y0, cz + Math.sin(a0) * r0],
              [cx + Math.cos(a1) * r0, cy + y0, cz + Math.sin(a1) * r0],
              [cx + Math.cos(a1) * r1, cy + y1, cz + Math.sin(a1) * r1],
              [cx + Math.cos(a0) * r1, cy + y1, cz + Math.sin(a0) * r1],
            ],
            [Math.cos(am) * nr, ny, Math.sin(am) * nr],
            [
              [s / seg, 1 - k / pts.length],
              [(s + 1) / seg, 1 - k / pts.length],
              [(s + 1) / seg, 1 - (k + 1) / pts.length],
              [s / seg, 1 - (k + 1) / pts.length],
            ],
            [cc[0] * g, cc[1] * g, cc[2] * g],
          );
        }
      }
    }
    mesh() {
      const m = {
        vb: gl.createBuffer(),
        ib: gl.createBuffer(),
        n: this.i.length,
      };
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(this.i),
        gl.STATIC_DRAW,
      );
      return m;
    }
  }
  const freeMesh = (m) => {
    if (m) {
      gl.deleteBuffer(m.vb);
      gl.deleteBuffer(m.ib);
    }
  };
  const hex = (s) => {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  /* ---------- textures ---------- */
  const potUp = (n, cap) => {
    let p = 1;
    while (p < n && p < cap) p <<= 1;
    return p;
  };
  function texFrom(canvas, o) {
    o = o || {};
    let src = canvas;
    const w = potUp(canvas.width, o.cap || 1024),
      h = potUp(canvas.height, o.cap || 1024);
    if (w !== canvas.width || h !== canvas.height) {
      src = document.createElement("canvas");
      src.width = w;
      src.height = h;
      const g = src.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(canvas, 0, 0, w, h);
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wr = o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      o.repeatS === false ? gl.CLAMP_TO_EDGE : wr,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    if (ANISO)
      gl.texParameterf(
        gl.TEXTURE_2D,
        ANISO.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(
          COARSE ? 4 : 8,
          gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT),
        ),
      );
    return t;
  }
  const mkc = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const WHITE_TEX = (() => {
    const c = mkc(4, 4),
      g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 4, 4);
    return texFrom(c);
  })();

  /* ---------- draw ---------- */
  let VP = M4.id(),
    CAM = [0, 3, -6],
    SUN = [0.36, 0.2, 0.91],
    FOGC = [0.9, 0.6, 0.5],
    FOGK = 1 / 150,
    SKYC = [0.4, 0.45, 0.8],
    GNDC = [0.5, 0.4, 0.4],
    SUNC = [1.2, 0.8, 0.55];
  const IDM = M4.id();
  let DC = 0;
  function useMain() {
    gl.useProgram(MAIN.p);
    const u = MAIN.u;
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3fv(u.uSun, SUN);
    gl.uniform3fv(u.uSunCol, SUNC);
    gl.uniform3fv(u.uSky, SKYC);
    gl.uniform3fv(u.uGnd, GNDC);
    gl.uniform3fv(u.uFog, FOGC);
    gl.uniform3fv(u.uCam, CAM);
    gl.uniform1f(u.uFogK, FOGK);
    gl.uniform1i(u.uTex, 0);
    for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
  }
  const MAT0 = {
    tint: [1, 1, 1],
    emis: 0,
    spec: 0,
    rim: 0,
    rimCol: [1, 0.7, 0.5],
    alpha: 1,
    cut: 0,
  };
  function draw(m, M, tex, o) {
    o = o || MAT0;
    const u = MAIN.u;
    gl.uniformMatrix4fv(u.uM, false, M || IDM);
    gl.uniform3fv(u.uTint, o.tint || MAT0.tint);
    gl.uniform1f(u.uEmis, o.emis || 0);
    gl.uniform1f(u.uSpec, o.spec || 0);
    gl.uniform1f(u.uRim, o.rim || 0);
    gl.uniform3fv(u.uRimCol, o.rimCol || MAT0.rimCol);
    gl.uniform1f(u.uAlpha, o.alpha === undefined ? 1 : o.alpha);
    gl.uniform1f(u.uCut, o.cut || 0);
    gl.bindTexture(gl.TEXTURE_2D, tex || WHITE_TEX);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 24);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 44, 32);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
    DC++;
  }
  const SKYQ = (() => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      gl.STATIC_DRAW,
    );
    return b;
  })();

  /* ---------- view ---------- */
  let W = 360,
    H = 640,
    DPR = 1,
    qual = 0,
    budgetK = 1,
    avgDt = 16.7,
    FAR = 230,
    resScale = 1;
  const FARS = [230, 200, 170, 140];
  const PIX = () => (COARSE ? 800000 : 2600000) * budgetK;
  function resize() {
    const cw = Math.max(240, innerWidth),
      ch = Math.max(240, innerHeight);
    DPR = Math.min(devicePixelRatio || 1, 2) * resScale;
    const want = cw * ch * DPR * DPR,
      bud = PIX();
    if (want > bud) DPR = Math.max(0.4, DPR * Math.sqrt(bud / want));
    cv.width = Math.round(cw * DPR);
    cv.height = Math.round(ch * DPR);
    hudc.width = Math.round(cw * Math.min(DPR, 1.5));
    hudc.height = Math.round(ch * Math.min(DPR, 1.5));
    W = cw;
    H = ch;
    UI = Math.max(0.8, Math.min(W, H) / 390);
    hx.setTransform(hudc.width / W, 0, 0, hudc.height / H, 0, 0);
  }
  let UI = 1;

  /* ---------- themes ---------- */
  const THEMES = [
    {
      top: "#2a2f6b",
      mid: "#c4577a",
      low: "#ffb36b",
      fog: "#e6a07a",
      sun: "#ffd9a0",
      name: "Tashkent",
      amb: [0, 0, 0],
      sunK: 1,
    },
    {
      top: "#2d6fc6",
      mid: "#79b4e0",
      low: "#fbe0b0",
      fog: "#cfe0ee",
      sun: "#fff0c0",
      name: "Samarkand",
      amb: [0, 0, 0],
      sunK: 1,
    },
    {
      top: "#6a3a7a",
      mid: "#e8845a",
      low: "#ffcf7a",
      fog: "#f0b684",
      sun: "#fff0b0",
      name: "Bukhara",
      amb: [0, 0, 0],
      sunK: 1,
    },
    {
      top: "#1c2250",
      mid: "#6b4a8e",
      low: "#f08a6a",
      fog: "#c98a90",
      sun: "#ffd2a0",
      name: "Khiva",
      amb: [0, 0, 0],
      sunK: 1,
    },
    {
      top: "#2f7fd8",
      mid: "#8fd0f2",
      low: "#fff2d2",
      fog: "#d2e8f2",
      sun: "#fff8dc",
      name: "Fergana",
      amb: [0, 0, 0],
      sunK: 1.05,
      mount: true,
    },
    {
      top: "#04051a",
      mid: "#1a1048",
      low: "#7a2a86",
      fog: "#2c1c52",
      sun: "#9db0ff",
      name: "Neon Tashkent",
      amb: [0.26, 0.28, 0.52],
      sunK: 0.35,
      night: true,
      rain: true,
      fogK: 0.9,
    },
  ];
  const DEFS = [
    [
      ["glass", 5, 16],
      ["panel", 7, 9],
      ["tower", 5.5, 13],
      ["glass", 4.4, 19],
      ["panel", 6, 9],
      ["shops", 5, 7],
    ],
    [
      ["registan", 10, 11],
      ["madrasa", 8, 10],
      ["registan", 9, 10],
      ["shops", 5, 7],
      ["madrasa", 7, 9],
    ],
    [
      ["brick", 7, 7.5],
      ["brick", 5.5, 8],
      ["madrasa", 7, 9],
      ["brick", 6, 7],
      ["shops", 5.5, 7],
    ],
    [
      ["fort", 8, 8],
      ["fort", 6, 8.5],
      ["brick", 5, 7],
      ["fort", 7, 7.5],
      ["fort", 5.5, 8],
    ],
    [
      ["shops", 5, 7],
      ["panel", 7, 9],
      ["brick", 6, 7.5],
      ["tower", 5.5, 12],
      ["shops", 6, 7],
    ],
    [
      ["glass", 5, 18],
      ["tower", 5.5, 15],
      ["glass", 4.4, 21],
      ["panel", 6.5, 10],
      ["glass", 6, 16],
    ],
  ];
  const TMAT = [
    { emis: 0.28, tint: [1.06, 1.04, 1.0] },
    { emis: 0.28, tint: [1.06, 1.04, 1.0] },
    { emis: 0.28, tint: [1.06, 1.04, 1.0] },
    { emis: 0.28, tint: [1.06, 1.04, 1.0] },
    { emis: 0.26, tint: [1.0, 1.07, 1.0] },
    { emis: 0.72, tint: [0.62, 0.68, 1.0] },
  ];
  const THEME_LEN = 700,
    themeAt = (z) =>
      ((Math.floor(z / THEME_LEN) % THEMES.length) + THEMES.length) %
      THEMES.length,
    FS = 1.55,
    PPU = COARSE ? 24 : 36;
  const FT = {}; // facade GL textures by theme/index
  function facadeTex(th, idx) {
    const k = th + ":" + idx;
    if (FT[k]) return FT[k];
    const [kind, len, h] = DEFS[th][idx],
      f = Facades.make(th, kind, len, h, PPU, true);
    return (FT[k] = {
      tex: texFrom(f.cv, { cap: 1024 }),
      kind,
      len: len * FS,
      h: h * FS,
      domes: f.domes,
      w: f.w,
      hh: f.hh,
    });
  }
  function dropThemeTex(th) {
    for (const k of Object.keys(FT))
      if (k.startsWith(th + ":")) {
        gl.deleteTexture(FT[k].tex);
        delete FT[k];
      }
  }
  let MINT = null;
  function minaretTex() {
    if (MINT) return MINT;
    const c = mkc(128, 512),
      g = c.getContext("2d");
    Facades.brickPat(g, 128, 512, 0, "#d2a76d", "rgba(80,45,15,.45)");
    Facades.grain(g, 128, 512, 0.2);
    for (let i = 0; i < 5; i++)
      Facades.mosaic(
        g,
        0,
        40 + i * 90,
        128,
        30,
        "#14589a",
        "#6fd0e6",
        "#ffe9a8",
      );
    const q = g.createLinearGradient(0, 0, 128, 0);
    q.addColorStop(0, "rgba(0,0,0,.35)");
    q.addColorStop(0.35, "rgba(255,200,120,.12)");
    q.addColorStop(1, "rgba(0,0,0,.4)");
    g.fillStyle = q;
    g.fillRect(0, 0, 128, 512);
    return (MINT = texFrom(c, { repeat: true, repeatS: true }));
  }
  const ROADS = {},
    mkRoadTex = (cross) => {
      const w = 256,
        h = 1024,
        c = mkc(w, h),
        g = c.getContext("2d"),
        px = (m) => (m / 10.4) * w,
        pz = (m) => (m / 40) * h;
      g.fillStyle = "#2c2f39";
      g.fillRect(0, 0, w, h);
      Facades.grain(g, w, h, 0.5, "overlay");
      for (let i = 0; i < 40; i++) {
        g.fillStyle = "rgba(0,0,0," + rnd(0.05, 0.18) + ")";
        g.beginPath();
        g.ellipse(rnd(0, w), rnd(0, h), rnd(6, 30), rnd(10, 60), 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,.05)";
      g.fillRect(0, 0, px(1.9), h);
      g.fillRect(px(8.5), 0, px(1.9), h);
      g.fillStyle = "rgba(255,255,255,.85)";
      for (const m of [-1.1, 1.1])
        for (let k = 0; k < 8; k++)
          g.fillRect(px(5.2 + m - 0.07), pz(k * 5), px(0.14), pz(2.4));
      g.fillStyle = "rgba(255,255,255,.9)";
      for (const m of [-3.3, 3.3])
        g.fillRect(px(5.2 + m - 0.08), 0, px(0.16), h);
      g.fillStyle = "rgba(255,216,80,.9)";
      for (const m of [-5.0, 5.0])
        g.fillRect(px(5.2 + m - 0.06), 0, px(0.12), h);
      if (cross) {
        g.fillStyle = "rgba(245,245,245,.92)";
        for (let x = 0.3; x < 10.2; x += 0.9)
          g.fillRect(px(x), pz(1), px(0.5), pz(5));
        g.fillStyle = "rgba(255,255,255,.9)";
        g.fillRect(0, pz(0.4), w, pz(0.3));
        g.fillRect(0, pz(6.3), w, pz(0.3));
      }
      return texFrom(c, { repeat: true, repeatS: false });
    };
  let SWT = null;
  function sidewalkTex() {
    if (SWT) return SWT;
    const c = mkc(128, 128),
      g = c.getContext("2d");
    g.fillStyle = "#b8ae9a";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = ["#c4baa4", "#b2a890", "#bcb29c"][(x * 3 + y * 5) % 3];
        g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      }
    g.strokeStyle = "rgba(60,50,40,.4)";
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32, 128);
      g.moveTo(0, i * 32);
      g.lineTo(128, i * 32);
      g.stroke();
    }
    Facades.grain(g, 128, 128, 0.35, "overlay");
    return (SWT = texFrom(c, { repeat: true }));
  }
  const STRIPE = (() => {
    const c = mkc(64, 64),
      g = c.getContext("2d");
    g.fillStyle = "#ffcc1a";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#15151c";
    for (let i = -2; i < 6; i++) {
      g.beginPath();
      g.moveTo(i * 16, 64);
      g.lineTo(i * 16 + 8, 64);
      g.lineTo(i * 16 + 40, 0);
      g.lineTo(i * 16 + 32, 0);
      g.fill();
    }
    return texFrom(c, { repeat: true });
  })();
  const BLOB = (() => {
    const c = mkc(64, 64),
      g = c.getContext("2d"),
      q = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    q.addColorStop(0, "rgba(0,0,0,.75)");
    q.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = q;
    g.fillRect(0, 0, 64, 64);
    return texFrom(c);
  })();

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
    } else if (
      ft.kind === "panel" ||
      ft.kind === "tower" ||
      ft.kind === "shops"
    )
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
          sb.box(
            sd * (BX + 8),
            6,
            CUR[s] + g / 2,
            14,
            12,
            g,
            [0.5, 0.42, 0.34],
          );
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
      if (e.b.i.length)
        ch.meshes.push({ m: e.b.mesh(), tex: e.tex, mat: e.mat });
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

  /* ---------- characters ---------- */
  const PM = {}; // part mesh cache (CPU side — characters are batched into one buffer per frame)
  const part = (key, f) =>
    PM[key] ||
    (PM[key] = (() => {
      const b = new B();
      f(b);
      return { v: new Float32Array(b.v), i: new Uint16Array(b.i), nv: b.n };
    })());
  const cylM = (r0, r1, h, seg = 8) =>
    part("c" + r0 + "," + r1 + "," + h + "," + seg, (b) =>
      b.cyl(0, -h, 0, r1, r0, h, seg, WHITE, true),
    ); // hangs down from origin
  const boxM = (w, h, d, dy = 0) =>
    part("b" + w + "," + h + "," + d + "," + dy, (b) =>
      b.box(0, dy, 0, w, h, d, WHITE),
    );
  const sphM = (r, sy = 1, sz = 1) =>
    part("s" + r + "," + sy + "," + sz, (b) =>
      b.sph(0, 0, 0, r, r * sy, r * sz, 7, 10, WHITE),
    );
  const coneM = (r, h) =>
    part("k" + r + "," + h, (b) => b.cyl(0, 0, 0, r, 0.01, h, 6, WHITE));
  const CBMAX = 16000,
    CB = [0, 1].map(() => {
      const vb = gl.createBuffer(),
        ib = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, CBMAX * 44, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CBMAX * 4, gl.DYNAMIC_DRAW);
      return {
        vb,
        ib,
        v: new Float32Array(CBMAX * 11),
        i: new Uint16Array(CBMAX * 2),
        nv: 0,
        ni: 0,
      };
    });
  function put(mesh, M, m) {
    // transform a part into the character batch on the CPU
    const e = m.emis > 0.6 ? 1 : 0,
      b = CB[e],
      mi = mesh.i;
    if (b.nv + mesh.nv > CBMAX || b.ni + mi.length > CBMAX * 2) return;
    const t = m.tint,
      k = e ? 1 : 1 + 0.25 * (m.emis || 0),
      r = t[0] * k,
      g = t[1] * k,
      bl = t[2] * k,
      v = mesh.v,
      out = b.v;
    const m0 = M[0],
      m1 = M[1],
      m2 = M[2],
      m4 = M[4],
      m5 = M[5],
      m6 = M[6],
      m8 = M[8],
      m9 = M[9],
      m10 = M[10],
      m12 = M[12],
      m13 = M[13],
      m14 = M[14];
    let o = b.nv * 11;
    for (let q = 0, n = mesh.nv; q < n; q++) {
      const s = q * 11,
        x = v[s],
        y = v[s + 1],
        z = v[s + 2],
        nx = v[s + 3],
        ny = v[s + 4],
        nz = v[s + 5];
      out[o] = m0 * x + m4 * y + m8 * z + m12;
      out[o + 1] = m1 * x + m5 * y + m9 * z + m13;
      out[o + 2] = m2 * x + m6 * y + m10 * z + m14;
      out[o + 3] = m0 * nx + m4 * ny + m8 * nz;
      out[o + 4] = m1 * nx + m5 * ny + m9 * nz;
      out[o + 5] = m2 * nx + m6 * ny + m10 * nz;
      out[o + 6] = v[s + 6];
      out[o + 7] = v[s + 7];
      out[o + 8] = v[s + 8] * r;
      out[o + 9] = v[s + 9] * g;
      out[o + 10] = v[s + 10] * bl;
      o += 11;
    }
    const base = b.nv,
      ii = b.i;
    let p = b.ni;
    for (let q = 0; q < mi.length; q++) ii[p++] = mi[q] + base;
    b.ni = p;
    b.nv += mesh.nv;
  }
  const pd = (m, M, _t, o) => put(m, M, o);
  function flushChars() {
    for (let e = 0; e < 2; e++) {
      const b = CB[e];
      if (!b.ni) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.v.subarray(0, b.nv * 11));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, b.i.subarray(0, b.ni));
      draw({ vb: b.vb, ib: b.ib, n: b.ni }, IDM, null, e ? EMIS_MAT : LIT_MAT);
      b.nv = 0;
      b.ni = 0;
    }
  }
  const LIT_MAT = {
      tint: [1, 1, 1],
      spec: 0.7,
      rim: 0.7,
      rimCol: [1, 0.62, 0.4],
    },
    EMIS_MAT = { tint: [1, 1, 1], emis: 1 };
  const mat = (c, extra) =>
    Object.assign(
      { tint: c, spec: 0.5, rim: 0.7, rimCol: [1, 0.62, 0.4] },
      extra || {},
    );
  const MC = new WeakMap(),
    FLAME = { tint: [1, 0.65, 0.2], emis: 1 },
    SIREN_R = { tint: [1, 0.15, 0.2], emis: 1 },
    SIREN_B = { tint: [0.15, 0.3, 1], emis: 1 },
    BATON = { tint: [0.1, 0.1, 0.14], emis: 0 };
  function drawRobot(root, look, ph, st) {
    // st: {air, slide, hit, t}
    let K = MC.get(look);
    if (!K) {
      const P = {
        arm: hex(look.arm),
        plate: hex(look.plate),
        dark: hex(look.dark),
        glow: hex(look.glow),
        acc: hex(look.acc),
      };
      const mArm = mat(P.arm, { spec: 0.9, emis: 0.18 }),
        mPl = mat(P.plate, { spec: 0.6, emis: 0.2 }),
        mDk = mat(mulc(P.dark, 1.5), { spec: 0.2, rim: 0.4, emis: 0.1 }),
        mGl = { tint: P.glow, emis: 1 },
        mAc = { tint: P.acc, emis: 0.8 };
      MC.set(look, (K = { mArm, mPl, mDk, mGl, mAc }));
    }
    const { mArm, mPl, mDk, mGl, mAc } = K;
    const sw = Math.sin(ph),
      cw = Math.cos(ph),
      air = st.air,
      hipY = 0.98,
      bob = air ? 0 : Math.abs(sw) * 0.06;
    let R = root;
    if (st.slide) R = joint(R, 0, 0.62, 0, -1.2);
    else if (st.hit) R = joint(R, 0, 0, 0, 0.2);
    else R = joint(R, 0, bob, 0, 0.1); // forward lean
    const hip = joint(R, 0, hipY, 0, 0);
    pd(boxM(0.5, 0.24, 0.32), hip, null, mDk);
    const tor = joint(hip, 0, 0.5, 0, 0, sw * 0.12); // torso twist
    pd(boxM(0.64, 0.62, 0.36), tor, null, mArm);
    pd(boxM(0.5, 0.14, 0.2, 0), joint(tor, 0, 0.18, -0.19, 0), null, mPl);
    pd(boxM(0.5, 0.5, 0.06), joint(tor, 0, 0.02, -0.2, 0), null, mPl);
    pd(boxM(0.34, 0.06, 0.04), joint(tor, 0, 0.1, -0.235, 0), null, mGl);
    pd(boxM(0.34, 0.06, 0.04), joint(tor, 0, -0.06, -0.235, 0), null, mAc);
    // backpack / thrusters
    const bp = joint(tor, 0, 0.05, -0.3, 0);
    pd(boxM(0.5, 0.5, 0.24), bp, null, mArm);
    pd(boxM(0.36, 0.34, 0.05), joint(bp, 0, 0.02, -0.13, 0), null, mPl);
    pd(boxM(0.3, 0.05, 0.03), joint(bp, 0, 0.1, -0.16, 0), null, mGl);
    pd(boxM(0.3, 0.05, 0.03), joint(bp, 0, -0.02, -0.16, 0), null, mAc);
    pd(boxM(0.3, 0.05, 0.03), joint(bp, 0, -0.14, -0.16, 0), null, mGl);
    for (const sx of [-0.13, 0.13]) {
      pd(cylM(0.07, 0.09, 0.14), joint(bp, sx, -0.2, -0.04, 0), null, mPl);
      if (air || st.boost)
        pd(
          coneM(0.09, 0.5 + Math.random() * 0.2),
          joint(bp, sx, -0.36, -0.04, Math.PI),
          null,
          FLAME,
        );
      else pd(sphM(0.05), joint(bp, sx, -0.36, -0.04, 0), null, mGl);
    }
    // neck + head
    const hd = joint(tor, 0, 0.5, 0.0, 0.05);
    pd(cylM(0.09, 0.09, 0.1), hd, null, mDk);
    pd(sphM(0.27, 0.95, 0.95), joint(hd, 0, 0.3, 0, 0), null, mPl);
    pd(boxM(0.36, 0.14, 0.08), joint(hd, 0, 0.3, 0.24, 0), null, mGl);
    pd(boxM(0.3, 0.05, 0.04), joint(hd, 0, 0.32, -0.26, 0), null, mAc);
    for (const sx of [-1, 1]) {
      pd(
        cylM(0.1, 0.1, 0.06),
        joint(hd, sx * 0.27, 0.35, 0, 0, 0, (Math.PI / 2) * sx),
        null,
        mDk,
      );
      pd(
        cylM(0.06, 0.06, 0.04),
        joint(hd, sx * 0.31, 0.35, 0, 0, 0, (Math.PI / 2) * sx),
        null,
        mGl,
      );
    }
    pd(cylM(0.015, 0.015, 0.26), joint(hd, 0.1, 0.78, 0, 0), null, mDk);
    pd(sphM(0.05), joint(hd, 0.1, 0.82, 0), null, mAc);
    if (st.siren) {
      const on = Math.floor(st.t * 7) % 2;
      pd(
        cylM(0.09, 0.09, 0.1),
        joint(hd, 0, 0.62, 0, 0),
        null,
        on ? SIREN_R : SIREN_B,
      );
    }
    // arms
    for (const s of [-1, 1]) {
      const a = air
          ? -2.5 + s * 0.2
          : st.slide
            ? -1.4
            : (s > 0 ? sw : -sw) * 0.95,
        sh = joint(tor, s * 0.42, 0.2, 0, a, 0, s * 0.12);
      pd(sphM(0.12), sh, null, mDk);
      pd(cylM(0.085, 0.07, 0.32), sh, null, mArm);
      const el = joint(
        sh,
        0,
        -0.32,
        0,
        air ? -0.3 : -0.9 - (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.5,
      );
      pd(sphM(0.08), el, null, mDk);
      pd(cylM(0.07, 0.06, 0.3), el, null, mArm);
      pd(sphM(0.1), joint(el, 0, -0.32, 0, 0), null, mPl);
      if (st.baton && s > 0)
        pd(cylM(0.03, 0.03, 0.5), joint(el, 0, -0.34, 0.1, -1.4), null, BATON);
    }
    // legs
    for (const s of [-1, 1]) {
      const sg = s > 0 ? sw : -sw,
        cg = s > 0 ? cw : -cw;
      let h1, k1;
      if (st.slide) {
        h1 = -0.1;
        k1 = 0.1;
      } else if (air) {
        h1 = s > 0 ? -0.9 : 0.3;
        k1 = s > 0 ? 1.3 : 0.9;
      } else if (st.hit) {
        h1 = s * 0.3;
        k1 = 0.3;
      } else {
        h1 = -sg * 0.95;
        k1 = 0.2 + 0.95 * Math.max(0, cg);
      }
      const th = joint(hip, s * 0.17, 0, 0, h1);
      pd(sphM(0.13), th, null, mDk);
      pd(cylM(0.1, 0.08, 0.5), th, null, mPl);
      const kn = joint(th, 0, -0.5, 0, k1);
      pd(sphM(0.09), kn, null, mDk);
      pd(cylM(0.08, 0.07, 0.46), kn, null, mArm);
      const ft = joint(kn, 0, -0.47, 0, -(h1 + k1) * 0.5 + (air ? 0.4 : 0));
      pd(boxM(0.2, 0.12, 0.34, 0.0), joint(ft, 0, -0.03, 0.07, 0), null, mDk);
      pd(boxM(0.2, 0.04, 0.34), joint(ft, 0, -0.1, 0.07, 0), null, mGl);
    }
  }
  const DOGP = {
    metal: [0.52, 0.55, 0.62],
    dark: [0.1, 0.12, 0.18],
    glow: [1, 0.2, 0.25],
    acc: [1, 0.85, 0.3],
  };
  const DM1 = mat(DOGP.metal, { spec: 0.9 }),
    DM2 = mat(DOGP.dark, { spec: 0.2 }),
    DM3 = { tint: DOGP.glow, emis: 1 };
  function drawDog(root, ph, t) {
    const sw = Math.sin(ph * 1.4),
      R = joint(root, 0, 0.12 + Math.abs(sw) * 0.05, 0, 0.05),
      mM = DM1,
      mD = DM2,
      mG = DM3;
    pd(boxM(0.5, 0.42, 1.0), joint(R, 0, 0.6, 0, 0), null, mM);
    pd(boxM(0.36, 0.1, 0.5), joint(R, 0, 0.84, -0.1, 0), null, mD);
    pd(boxM(0.3, 0.28, 0.34), joint(R, 0, 0.78, 0.6, 0.1), null, mM);
    pd(boxM(0.2, 0.14, 0.3), joint(R, 0, 0.72, 0.84, 0.1), null, mD);
    pd(boxM(0.2, 0.05, 0.05), joint(R, 0, 0.82, 0.76, 0), null, mG);
    for (const sx of [-1, 1])
      pd(coneM(0.06, 0.2), joint(R, sx * 0.1, 0.9, 0.55, 0), null, mD);
    pd(
      cylM(0.04, 0.03, 0.4),
      joint(R, 0, 0.8, -0.55, 0.9 + Math.sin(t * 12) * 0.15),
      null,
      mD,
    );
    pd(sphM(0.06), joint(R, 0, 0.95, -0.82, 0), null, mG);
    for (const [lx, lz, f] of [
      [-0.2, 0.38, 0],
      [0.2, 0.38, 1],
      [-0.2, -0.38, 1],
      [0.2, -0.38, 0],
    ]) {
      const a = Math.sin(ph * 1.4 + f * Math.PI) * 0.9,
        up = joint(R, lx, 0.5, lz, a);
      pd(cylM(0.07, 0.05, 0.3), up, null, mM);
      const lo = joint(up, 0, -0.3, 0, 0.5 + Math.max(0, -a) * 0.5);
      pd(cylM(0.05, 0.04, 0.3), lo, null, mD);
    }
  }

  /* ---------- game state ---------- */
  const LX = [-2.2, 0, 2.2],
    SPEED0 = 15;
  let state = "ready",
    pz = 0,
    px = 0,
    py = 0,
    vy = 0,
    lane = 1,
    speed = SPEED0,
    slideT = 0,
    tilt = 0,
    runPh = 0,
    coinsGot = 0,
    hits = 0,
    hitT = 0,
    invul = 0,
    shakeT = 0,
    bustT = 0,
    stumbleT = 0,
    gap = 11.5,
    camX = 0;
  let objs = [],
    nextSpawn = 50,
    sparks = [],
    floaties = [],
    wallet = store.get("zr_wallet", 0),
    best = store.get("zr3d3_best", 0),
    coinHud = 0,
    paused = false,
    god = false,
    lastT = 0,
    skin = store.get("zr_skin", "default");
  let bonus = 0,
    mult = 1,
    chain = 0,
    chainT = 0,
    mag = 0,
    shield = 0,
    turbo = 0,
    dbl = 0,
    jet = 0,
    padB = 0,
    nextLetter = 0,
    floorY = 0,
    lastFloor = 0,
    revived = false,
    heli = null,
    nextHeli = 650,
    lit = 0,
    rainA = 0,
    bankedCoins = 0,
    doneMsgs = [],
    lvlMsg = "";
  const newStats = () => ({
    dist: 0,
    jump: 0,
    slide: 0,
    close: 0,
    power: 0,
    letters: 0,
    ramp: 0,
    smash: 0,
  });
  let S = newStats(),
    B0 = newStats();
  const look = () => Rig.LOOKS[skin] || Rig.LOOKS.default;
  const scoreNow = () => Math.floor(pz) + bonus;

  /* ---------- daily missions + player level ---------- */
  const MPOOL = [
    ["dist", [1200, 2500]],
    ["jump", [18, 35]],
    ["slide", [14, 28]],
    ["close", [6, 12]],
    ["power", [3, 5]],
    ["letters", [1, 1]],
    ["ramp", [2, 4]],
    ["smash", [4, 8]],
    ["coinsRun", [120, 250]],
  ];
  function mulberry(a) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function loadMissions() {
    let m = store.get("zr3d_m", null),
      dk = dayKey();
    if (!m || m.d !== dk || !Array.isArray(m.l)) {
      let h = 7;
      for (const ch of dk) h = (h * 31 + ch.charCodeAt(0)) | 0;
      const r = mulberry(h),
        pool = MPOOL.slice(),
        l = [];
      for (let i = 0; i < 3; i++) {
        const [id, ts] = pool.splice(Math.floor(r() * pool.length), 1)[0];
        l.push({ id, t: ts[Math.floor(r() * ts.length)], p: 0, done: false });
      }
      m = { d: dk, l };
      store.set("zr3d_m", m);
    }
    return m;
  }
  const lvlOf = (xp) => Math.floor(Math.sqrt(xp / 120)) + 1;
  let XP = store.get("zr3d_xp", 0);
  function bank() {
    // write this run's results into wallet, missions and XP (safe to call more than once: deltas only)
    const dC = coinsGot - bankedCoins;
    bankedCoins = coinsGot;
    wallet += dC;
    const m = loadMissions();
    doneMsgs = [];
    for (const q of m.l) {
      if (q.done) continue;
      const dv =
        q.id === "coinsRun"
          ? Math.max(0, coinsGot - (B0.coinsRunBase || 0))
          : (S[q.id] || 0) - (B0[q.id] || 0);
      q.p =
        q.id === "coinsRun"
          ? Math.max(q.p, Math.min(q.t, coinsGot))
          : q.p + Math.max(0, dv);
      if (q.p >= q.t) {
        q.done = true;
        q.p = q.t;
        wallet += 100;
        doneMsgs.push(q);
      }
    }
    for (const k of Object.keys(S)) B0[k] = S[k];
    store.set("zr3d_m", m);
    const before = lvlOf(XP);
    XP += Math.floor(scoreNow() / 30) - (B0.xpGiven || 0);
    B0.xpGiven = Math.floor(scoreNow() / 30);
    store.set("zr3d_xp", XP);
    const after = lvlOf(XP);
    lvlMsg = "";
    if (after > before) {
      wallet += 50 * after;
      lvlMsg = T("lvlUp") + " " + after + "  +" + 50 * after;
    }
    store.set("zr_wallet", wallet);
    const sc = scoreNow();
    if (sc > best) {
      best = sc;
      store.set("zr3d3_best", best);
      return true;
    }
    return false;
  }
  const missionText = (q) => T("m_" + q.id).replace("{n}", q.t);

  function reset() {
    pz = 0;
    px = 0;
    py = 0;
    vy = 0;
    lane = 1;
    speed = SPEED0;
    slideT = 0;
    tilt = 0;
    coinsGot = 0;
    hits = 0;
    hitT = 0;
    invul = 0;
    bustT = 0;
    stumbleT = 0;
    gap = 11.5;
    camX = 0;
    objs = [];
    sparks = [];
    floaties = [];
    nextSpawn = 55;
    coinHud = 0;
    bonus = 0;
    mult = 1;
    chain = 0;
    chainT = 0;
    mag = shield = turbo = dbl = jet = padB = 0;
    nextLetter = 0;
    floorY = lastFloor = 0;
    revived = false;
    heli = null;
    nextHeli = 650;
    lit = 0;
    bankedCoins = 0;
    S = newStats();
    B0 = newStats();
    B0.coinsRunBase = 0;
    B0.xpGiven = 0;
    resetCity(0);
    ensureCity(0, 1e9);
  }

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
    cone = (l, z) => objs.push({ k: "cone", x: LX[l], z, len: 1.2 });
  const pit = (l, z) => objs.push({ k: "pit", x: LX[l], z, len: 3 }),
    ramp = (l, z) => objs.push({ k: "ramp", x: LX[l], z, len: 6 }),
    pad = (l, z) => objs.push({ k: "pad", x: LX[l], z, len: 4 });
  const cart = (l, z) =>
      objs.push({
        k: "cart",
        x: LX[l],
        z,
        len: 1.4,
        vx: (Math.random() < 0.5 ? -1 : 1) * rnd(1.7, 2.5),
      }),
    laser = (z, hi) => objs.push({ k: "laser", x: 0, z, len: 0.5, hi });
  const car = (l, z, vz) =>
    objs.push({
      k: "car",
      x: LX[l],
      z,
      len: 4.6,
      vz: vz || 0,
      hue: pick([
        [0.92, 0.92, 0.95],
        [0.85, 0.12, 0.16],
        [0.14, 0.14, 0.18],
        [0.2, 0.36, 0.7],
      ]),
    });
  const bus = (l, z, len) =>
    objs.push({
      k: "bus",
      x: LX[l],
      z,
      len,
      hue: pick([
        [0.16, 0.4, 0.8],
        [0.9, 0.55, 0.1],
        [0.2, 0.62, 0.52],
      ]),
    });
  const powUp = (l, z, t) =>
      objs.push({ k: "pow", t, x: LX[l], z, y: 1.2, len: 0 }),
    letterUp = (l, z, n) =>
      objs.push({ k: "let", n, x: LX[l], z, y: 1.25, len: 0 });
  const BLOCK = { low: 1, cone: 1, car: 1, bus: 1, cart: 1 },
    POWS = ["mag", "shield", "turbo", "dbl", "jet"];
  function arc(l, z, n, step, h) {
    for (let i = 0; i < n; i++)
      coin(l, z + i * step, 1.0 + Math.sin((i / (n - 1)) * Math.PI) * h);
  }
  function spawn() {
    const z = nextSpawn,
      L = (Math.random() * 3) | 0,
      o1 = (L + 1 + ((Math.random() * 2) | 0)) % 3,
      o2 = 3 - L - o1,
      hard = clamp(pz / 2600, 0, 1),
      r = Math.random() * (pz < 350 ? 0.55 : 1);
    let used = 26;
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
    if (
      nextLetter < 6 &&
      Math.random() < 0.1 &&
      !objs.some((o) => o.k === "let")
    )
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
        b.cyl(
          x,
          0.06,
          z,
          0.3,
          0.04,
          0.78,
          10,
          [1, 0.45, 0.08],
          true,
          [1, 1, 1],
        );
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

  /* ---------- audio / input ---------- */
  let AC = null,
    muted = store.get("zr3d_mute", false);
  const actx = () => {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
    } catch (e) {}
    return AC;
  };
  function tone(f, d, type, v, f2, at) {
    if (muted) return;
    try {
      const a = actx();
      if (!a) return;
      const t = at || a.currentTime,
        o = a.createOscillator(),
        g = a.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v || 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    } catch (e) {}
  }
  const sfx = {
    coin() {
      tone(988, 0.07, "sine", 0.06);
      setTimeout(() => tone(1480, 0.1, "sine", 0.05), 55);
    },
    jump() {
      tone(300, 0.16, "triangle", 0.07, 620);
    },
    slide() {
      tone(260, 0.2, "sawtooth", 0.03, 120);
    },
    hit() {
      tone(180, 0.28, "sawtooth", 0.09, 55);
    },
    bust() {
      tone(120, 0.5, "square", 0.07, 40);
    },
    move() {
      tone(500, 0.05, "sine", 0.03, 420);
    },
    pow() {
      tone(520, 0.1, "square", 0.05, 1040);
      setTimeout(() => tone(1040, 0.2, "square", 0.05, 1560), 90);
    },
    shield() {
      tone(900, 0.3, "sawtooth", 0.05, 200);
    },
    close() {
      tone(1200, 0.08, "triangle", 0.05, 1800);
    },
    smash() {
      tone(150, 0.2, "sawtooth", 0.08, 40);
    },
    heli() {
      tone(90, 0.8, "sawtooth", 0.05, 70);
    },
    pad() {
      tone(400, 0.3, "sawtooth", 0.05, 1200);
    },
    letter() {
      tone(700, 0.1, "triangle", 0.06, 1400);
    },
    zumary() {
      for (let i = 0; i < 5; i++)
        setTimeout(
          () => tone(523 * Math.pow(1.26, i), 0.18, "triangle", 0.06),
          i * 90,
        );
    },
  };
  const vib = (n) => {
    try {
      navigator.vibrate && navigator.vibrate(n);
    } catch (e) {}
  };
  /* tiny procedural soundtrack: a bass + hat + arpeggio in a Hijaz-like scale, key changes per city */
  const MUS = { step: 0, next: 0 },
    SCALE = [1, 1.0595, 1.26, 1.335, 1.5, 1.587, 1.888],
    ROOT = [146.8, 164.8, 155.6, 146.8, 174.6, 130.8];
  function musicTick() {
    if (muted || state !== "play" || paused || !AC || AC.state !== "running")
      return;
    const t = AC.currentTime;
    if (MUS.next < t) MUS.next = t + 0.05;
    const sp = 60 / (112 + speed * 0.9) / 4;
    while (MUS.next < t + 0.3) {
      const s = MUS.step++ % 16,
        root = ROOT[themeAt(pz)],
        at = MUS.next;
      if (s % 4 === 0) tone(120, 0.12, "sine", 0.07, 45, at);
      if (s % 2 === 1) tone(6000, 0.03, "square", 0.008, 0, at);
      if ([0, 3, 6, 8, 11, 14].includes(s))
        tone(
          (root / 2) * (s === 8 ? 1.5 : s === 14 ? 1.26 : 1),
          sp * 2.2,
          "sawtooth",
          0.03,
          0,
          at,
        );
      if (s % 2 === 0)
        tone(
          root * 2 * SCALE[((s / 2 + (MUS.step >> 4)) % 7) | 0],
          sp * 1.6,
          "triangle",
          0.018,
          0,
          at,
        );
      MUS.next += sp;
    }
  }
  setInterval(musicTick, 90);

  function moveLane(d) {
    if (state !== "play") return;
    const nl = clamp(lane + d, 0, 2);
    if (nl !== lane) {
      lane = nl;
      sfx.move();
    }
  }
  function jump() {
    if (state !== "play" || jet > 0) return;
    if (py < floorY + 0.08) {
      vy = 9.2;
      slideT = 0;
      S.jump++;
      sfx.jump();
    }
  }
  function slide() {
    if (state !== "play" || jet > 0) return;
    slideT = 0.75;
    if (py > floorY + 0.08) vy = Math.min(vy, -12);
    else {
      S.slide++;
      sfx.slide();
    }
  }
  let pt = null;
  const ovOpen = () => !$("ov").classList.contains("hidden");
  addEventListener("pointerdown", (e) => {
    if (ovOpen()) return;
    pt = { x: e.clientX, y: e.clientY, done: false };
    actx();
  });
  addEventListener("pointermove", (e) => {
    if (!pt || pt.done) return;
    const dx = e.clientX - pt.x,
      dy = e.clientY - pt.y,
      th = 22;
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
      pt.done = true;
    } else if (Math.abs(dy) > th) {
      dy < 0 ? jump() : slide();
      pt.done = true;
    }
  });
  addEventListener("pointerup", () => {
    pt = null;
  });
  addEventListener("pointercancel", () => {
    pt = null;
  });
  addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k))
      e.preventDefault();
    if (state !== "play") {
      if ((k === "Enter" || k === " ") && ovOpen()) start();
      return;
    }
    if (k === "ArrowLeft" || k === "a" || k === "A") moveLane(-1);
    else if (k === "ArrowRight" || k === "d" || k === "D") moveLane(1);
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump();
    else if (k === "ArrowDown" || k === "s" || k === "S") slide();
    else if (k === "p" || k === "P") paused = !paused;
    else if (k === "m" || k === "M") {
      muted = !muted;
      store.set("zr3d_mute", muted);
    }
  });
  addEventListener("blur", () => {
    if (state === "play") paused = true;
  });
  addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") paused = true;
  });
  hudc.addEventListener("click", () => {
    paused = false;
  });
  addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- gameplay events ---------- */
  const POWTXT = {
    mag: "pow_mag",
    shield: "pow_shield",
    turbo: "pow_turbo",
    dbl: "pow_dbl",
    jet: "pow_jet",
  };
  function floatText(text, c) {
    floaties.push({ text, c, l: 1.4 });
    if (floaties.length > 4) floaties.shift();
  }
  function burst(x, y, z, n, c, sp) {
    for (let i = 0; i < n && sparks.length < 90; i++)
      sparks.push({
        x,
        y,
        z,
        vx: rnd(-sp, sp),
        vy: rnd(0, sp * 1.4),
        vz: rnd(-sp * 0.5, sp * 0.5),
        l: rnd(0.4, 0.8),
        c,
      });
  }
  function smash(o) {
    if (o.dead) return;
    o.dead = true;
    S.smash++;
    bonus += 30;
    burst(o.x, 1, o.z, 14, "#ffb36b", 5);
    sfx.smash();
    shakeT = Math.max(shakeT, 0.15);
  }
  function hurt(o) {
    if (turbo > 0) {
      if (o) smash(o);
      return;
    }
    if (jet > 0 || invul > 0 || god) return;
    if (shield > 0) {
      shield = 0;
      invul = 1.2;
      shakeT = 0.25;
      sfx.shield();
      burst(px, 1, pz, 16, "#7fd4ff", 5);
      floatText(T("shieldBreak"), "#7fd4ff");
      if (o) o.dead = true;
      return;
    }
    hits++;
    hitT = 8;
    invul = 1.4;
    shakeT = 0.45;
    sfx.hit();
    vib(60);
    stumbleT = 0.5;
    burst(px, 1, pz, 12, "#ffb36b", 4);
    chain = 0;
    mult = 1;
    chainT = 0;
    if (o && o.k !== "bus" && o.k !== "car") o.dead = true;
    if (hits >= 2) {
      endGame();
      return;
    }
    speed = Math.max(SPEED0, speed * 0.78);
    gap = 4.6;
    floatText(T("stumble"), "#ff6b84");
  }
  function pickCoin(o) {
    o.got = true;
    const v = o.gem ? 5 : 1,
      m = dbl > 0 ? 2 : 1;
    coinsGot += v * m;
    chain = chainT > 0 ? chain + 1 : 1;
    chainT = 1.5;
    mult = Math.min(6, 1 + Math.floor(chain / 8));
    bonus += (o.gem ? 50 : 10) * mult * m;
    coinHud = 0.25;
    sfx.coin();
    burst(o.x, o.y, o.z, 3, "#ffe27a", 2);
  }
  function givePow(t) {
    S.power++;
    sfx.pow();
    vib(20);
    floatText(T(POWTXT[t]), POWCOL[t]);
    if (t === "mag") mag = 9;
    else if (t === "shield") shield = 16;
    else if (t === "turbo") {
      turbo = 5;
      invul = Math.max(invul, 0.3);
    } else if (t === "dbl") dbl = 15;
    else {
      jet = 7;
      vy = 0;
      for (let i = 0; i < 50; i++)
        coin(
          clamp(1 + Math.round(Math.sin(i * 0.33) * 1.2), 0, 2),
          pz + 14 + i * 2.6,
          3.7,
          i % 12 === 11,
        );
    }
  }
  function pickLetter(o) {
    o.got = true;
    sfx.letter();
    if (o.n === nextLetter) {
      nextLetter++;
      floatText("ZUMARY".slice(0, nextLetter), "#ffd84f");
      if (nextLetter >= 6) {
        nextLetter = 0;
        S.letters++;
        coinsGot += 500;
        bonus += 1000;
        turbo = 6;
        sfx.zumary();
        floatText(T("zumary"), "#ffd84f");
      }
    }
  }
  function closeCall() {
    S.close++;
    bonus += 25 * mult;
    chain += 2;
    chainT = 1.5;
    sfx.close();
    floatText(T("close"), "#7ffcff");
  }
  function collide(o, dx, top) {
    switch (o.k) {
      case "low":
        return dx < 0.95 && py < 0.82;
      case "cone":
        return dx < 0.85 && py < 0.78;
      case "gate":
        return dx < 0.95 && top > 1.25 && py < 2.2;
      case "car":
        return dx < 0.95 && py < 1.5;
      case "bus":
        return dx < 1.0 && py < 2.9;
      case "cart":
        return dx < 1.15 && py < 1.3;
      case "pit":
        return dx < 0.95 && py < 0.3;
      case "laser":
        return o.hi ? top > 1.2 && py < 2.4 : py < 0.75;
    }
    return false;
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (state === "play") {
      const vEff = speed + (turbo > 0 ? 12 : 0) + (padB > 0 ? 7 : 0);
      speed = Math.min(34, speed + dt * 0.22);
      pz += vEff * dt;
      S.dist = pz;
      runPh += dt * (6.2 + vEff * 0.19);
      px += (LX[lane] - px) * Math.min(1, dt * 13);
      tilt = lerp(
        tilt,
        clamp((LX[lane] - px) * 0.18, -0.3, 0.3),
        Math.min(1, dt * 12),
      );
      camX += (px * 0.7 - camX) * Math.min(1, dt * 6);
      if (mag > 0) mag -= dt;
      if (shield > 0) shield -= dt;
      if (turbo > 0) turbo -= dt;
      if (dbl > 0) dbl -= dt;
      if (padB > 0) padB -= dt;
      if (jet > 0) {
        jet -= dt;
        if (jet <= 0) {
          invul = Math.max(invul, 1.6);
          vy = 0;
        }
      }
      if (chainT > 0) {
        chainT -= dt;
        if (chainT <= 0) {
          chain = 0;
          mult = 1;
        }
      }
      for (const o of objs) {
        if (o.vz) o.z += o.vz * dt;
        if (o.k === "cart") {
          o.x += o.vx * dt;
          if (o.x > 3.2 || o.x < -3.2) o.vx = -o.vx;
        }
      }
      floorY = 0;
      for (const o of objs)
        if (
          o.k === "ramp" &&
          pz >= o.z &&
          pz <= o.z + o.len &&
          Math.abs(o.x - px) < 1.05
        )
          floorY = Math.max(floorY, (1.4 * (pz - o.z)) / o.len);
      if (jet > 0) {
        py += (3.7 - py) * Math.min(1, dt * 4);
        vy = 0;
      } else {
        vy -= 28 * dt;
        py += vy * dt;
        if (py <= floorY) {
          py = floorY;
          if (vy < 0) vy = 0;
        }
      }
      if (
        lastFloor > 0.3 &&
        floorY === 0 &&
        jet <= 0 &&
        vy <= 0.01 &&
        py > 0.9
      ) {
        vy = 10.5;
        S.ramp++;
        sfx.jump();
        burst(px, py, pz, 8, "#ffd84f", 3);
      }
      lastFloor = floorY;
      if (slideT > 0) slideT -= dt;
      if (invul > 0) invul -= dt;
      if (hitT > 0) {
        hitT -= dt;
        if (hitT <= 0) hits = 0;
      }
      if (shakeT > 0) shakeT -= dt;
      if (stumbleT > 0) stumbleT -= dt;
      gap = lerp(gap, hits > 0 ? 4.4 : 11, Math.min(1, dt * 1.6));
      while (nextSpawn < pz + 150) spawn();
      if (!heli && pz > nextHeli) {
        heli = { t: 0, dur: 11, ph: Math.random() * 6, x: 0 };
        nextHeli = pz + rnd(1200, 1800);
        floatText(T("heli"), "#ff6b84");
        sfx.heli();
      }
      if (heli) {
        heli.t += dt;
        heli.x = Math.sin(heli.t * (1.5 + heli.t * 0.06) + heli.ph) * 3.4;
        const inb = Math.abs(px - heli.x) < 1.25 && py < 1.2;
        lit = inb ? lit + dt : Math.max(0, lit - dt * 2);
        if (lit > 0.55 && jet <= 0) {
          lit = 0;
          hurt(null);
        }
        if (heli && heli.t > heli.dur) {
          heli = null;
          lit = 0;
          bonus += 100;
          floatText(T("heliEnd"), "#7ffcb0");
        }
      }
      const top = py + (slideT > 0 && py < floorY + 0.1 ? 0.85 : 1.85),
        pad = 0.45;
      for (const o of objs) {
        if (o.dead || o.got) continue;
        const k = o.k;
        if (k === "coin") {
          if (mag > 0) {
            const dzz = o.z - pz;
            if (dzz > -1.5 && dzz < 10 && Math.abs(o.x - px) < 5.5) {
              const f = Math.min(1, dt * 8);
              o.x += (px - o.x) * f;
              o.y += (py + 1.0 - o.y) * f;
              o.z += (pz + 0.5 - o.z) * f * (dzz > 0 ? 1 : 0.5);
            }
          }
          if (
            Math.abs(o.z - pz) < 1.0 &&
            Math.abs(o.x - px) < 0.9 &&
            o.y > py - 0.25 &&
            o.y < top + 0.35
          )
            pickCoin(o);
          continue;
        }
        if (k === "pow" || k === "let") {
          if (
            Math.abs(o.z - pz) < 1.2 &&
            Math.abs(o.x - px) < 1.0 &&
            o.y > py - 0.4 &&
            o.y < top + 0.5
          ) {
            o.got = true;
            if (k === "pow") givePow(o.t);
            else pickLetter(o);
          }
          continue;
        }
        if (k === "pad") {
          if (
            o.z < pz + 0.5 &&
            o.z + o.len > pz - 0.5 &&
            Math.abs(o.x - px) < 1.0 &&
            py < 0.5 &&
            padB <= 0
          ) {
            padB = 2.2;
            sfx.pad();
            burst(px, 0.4, pz, 12, "#53f7ff", 4);
            floatText("BOOST", "#53f7ff");
          }
          continue;
        }
        if (k === "ramp") continue;
        const z1 = o.z + o.len,
          over = o.z < pz + pad && z1 > pz - pad;
        if (over) {
          const dx = Math.abs(o.x - px);
          if (o.md === undefined || dx < o.md) o.md = dx;
          if (collide(o, dx, top)) {
            o.hit = true;
            hurt(o);
          }
        } else if (!o.passed && z1 < pz - pad) {
          o.passed = true;
          if (
            !o.hit &&
            BLOCK[k] &&
            o.md !== undefined &&
            o.md >= 0.95 &&
            o.md < 1.8
          )
            closeCall();
        }
      }
      objs = objs.filter(
        (o) => !o.got && !o.dead && o.z + (o.len || 0) > pz - 15,
      );
    } else if (state === "over") {
      bustT += dt;
      px += (LX[lane] - px) * Math.min(1, dt * 10);
      gap = lerp(gap, 2.2, Math.min(1, dt * 4));
      runPh += dt * 3;
      vy -= 28 * dt;
      py = Math.max(0, py + vy * dt);
      if (shakeT > 0) shakeT -= dt;
    } else {
      runPh += dt * 6;
      camX *= 0.9;
      pz += 4 * dt;
    }
    if (coinHud > 0) coinHud -= dt;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.l -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 9 * dt;
      if (s.l <= 0) sparks.splice(i, 1);
    }
    for (let i = floaties.length - 1; i >= 0; i--) {
      floaties[i].l -= dt;
      if (floaties[i].l <= 0) floaties.splice(i, 1);
    }
    ensureCity(pz, 3.5);
  }

  /* ---------- render ---------- */
  function hexMix(a, b, t) {
    const A = hex(a),
      B2 = hex(b);
    return [lerp(A[0], B2[0], t), lerp(A[1], B2[1], t), lerp(A[2], B2[2], t)];
  }
  const maxc = (a, b) => [
      Math.max(a[0], b[0]),
      Math.max(a[1], b[1]),
      Math.max(a[2], b[2]),
    ],
    mixa = (a, b, t) => [
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t),
      lerp(a[2], b[2], t),
    ];
  let envTheme = 0;
  function setEnvironment() {
    const n = THEMES.length,
      th = themeAt(pz),
      nx = (th + 1) % n,
      into = ((pz % THEME_LEN) + THEME_LEN) % THEME_LEN,
      t = clamp((into - (THEME_LEN - 120)) / 120, 0, 1),
      A = THEMES[th],
      Bt = THEMES[nx];
    envTheme = t > 0.5 ? nx : th;
    const mix = (k) => hexMix(A[k], Bt[k], t);
    FOGC = mix("fog");
    SKY.cur = {
      top: mix("top"),
      mid: mix("mid"),
      low: mix("low"),
      sun: mix("sun"),
    };
    SKYC = maxc(mulc(hexMix(A.top, Bt.top, t), 1.35), mixa(A.amb, Bt.amb, t));
    GNDC = maxc(mulc(FOGC, 0.62), mulc(mixa(A.amb, Bt.amb, t), 0.8));
    SUNC = mulc(SKY.cur.sun, 1.35 * lerp(A.sunK, Bt.sunK, t));
    SUN = (() => {
      const v = [0.38, 0.22, 0.9],
        l = Math.hypot(...v);
      return v.map((x) => x / l);
    })();
    rainA = lerp(rainA, THEMES[envTheme].rain ? 1 : 0, 0.02);
  }
  const SPHM_B = BUBBLE;
  function render() {
    PIX_I = 0;
    DC = 0;
    resizeIfNeeded();
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0.1, 0.1, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    setEnvironment();
    const TH = THEMES[envTheme];
    const asp = W / H,
      boost = (turbo > 0 ? 7 : 0) + (padB > 0 ? 4 : 0),
      fy =
        (((asp < 0.8 ? 66 : asp < 1.2 ? 60 : 54) + boost) * Math.PI) / 180 +
        (speed - 15) * 0.0012,
      dist = asp < 0.8 ? 6.0 : 6.8,
      h = asp < 0.8 ? 3.5 : 3.7;
    const shk = shakeT > 0 ? shakeT : 0,
      sx = rnd(-1, 1) * shk * 0.25,
      sy = rnd(-1, 1) * shk * 0.2,
      jl = jet > 0 ? 0.8 : 0;
    CAM = [camX + sx, h + sy + jl, pz - dist];
    const tgt = [camX * 0.55 + px * 0.2, 2.7 + jl * 0.5, pz + 8],
      P = M4.persp(fy, asp, 0.3, 450),
      V = M4.look(CAM, tgt, [0, 1, 0]);
    VP = M4.mul(P, V);
    FOGK = (1 / (qual >= 2 ? 120 : 160)) * (TH.fogK || 1);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(SKY.p);
    const su = SKY.u,
      c = SKY.cur;
    const f = [tgt[0] - CAM[0], tgt[1] - CAM[1], tgt[2] - CAM[2]],
      fl = Math.hypot(...f),
      F = f.map((x) => x / fl),
      R = [F[2], 0, -F[0]],
      rl = Math.hypot(...R),
      RR = R.map((x) => x / rl),
      U = [
        RR[1] * F[2] - RR[2] * F[1],
        RR[2] * F[0] - RR[0] * F[2],
        RR[0] * F[1] - RR[1] * F[0],
      ];
    gl.uniform3fv(su.uTop, c.top);
    gl.uniform3fv(su.uMid, c.mid);
    gl.uniform3fv(su.uLow, c.low);
    gl.uniform3fv(su.uSun, SUN);
    gl.uniform3fv(su.uSunCol, mulc(c.sun, 0.8));
    gl.uniform3fv(su.uF, F);
    gl.uniform3fv(su.uR, RR);
    gl.uniform3fv(su.uU, U);
    gl.uniform2f(su.uTan, Math.tan(fy / 2) * asp, Math.tan(fy / 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, SKYQ);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    useMain();
    const z0 = Math.floor((pz - 60) / 40) * 40,
      rt = (cross) => ROADS[cross] || (ROADS[cross] = mkRoadTex(cross)),
      wet = rainA > 0.3 ? 0.9 : 0.1;
    for (let z = z0; z < pz + FAR; z += 40) {
      const M = Tp(0, 0, z);
      draw(ROADM, M, rt(Math.round(z / 40) % 5 === 0 ? 1 : 0), {
        emis: 0.1,
        tint: [1.15, 1.12, 1.1],
        spec: wet,
      });
      draw(SIDEM, M, sidewalkTex(), { emis: 0.15, tint: [1.1, 1.08, 1.05] });
    }
    for (const ch of CHUNKS.values()) {
      if (ch.zB < pz - 30 || ch.zA > pz + FAR) continue;
      for (const x of ch.meshes) draw(x.m, IDM, x.tex, x.mat || MAT0);
    }
    const ca = performance.now() / 380,
      blink = Math.floor(performance.now() / 260) % 2;
    for (const o of objs) {
      const k = o.k;
      if (k === "coin" || o.z - pz > FAR || o.z + (o.len || 0) < pz - 12)
        continue;
      if (k === "low") {
        draw(obMesh("low"), Tp(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 });
        draw(REDL, Tp(o.x - 0.7, 1.05, o.z + 0.3), null, {
          emis: blink ? 1 : 0.3,
          tint: [1, 0.2, 0.2],
        });
      } else if (k === "gate")
        draw(obMesh("gate"), Tp(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 });
      else if (k === "cone")
        draw(obMesh("cone"), Tp(o.x, 0, o.z + 0.4), null, { emis: 0.25 });
      else if (k === "pit")
        draw(obMesh("pit"), Tp(o.x, 0, o.z), null, { emis: 0.3 });
      else if (k === "ramp")
        draw(obMesh("ramp"), Tp(o.x, 0, o.z), STRIPE, {
          emis: 0.3,
          tint: [1, 0.9, 0.6],
        });
      else if (k === "pad")
        draw(obMesh("pad"), Tp(o.x, 0, o.z), PADT, { emis: 0.9 });
      else if (k === "cart")
        draw(obMesh("cart"), Tp(o.x, 0, o.z + 0.7), null, {
          emis: 0.15,
          spec: 0.2,
        });
      else if (k === "laser") {
        draw(obMesh(o.hi ? "laserH" : "laserL"), Tp(0, 0, o.z), null, {
          emis: 0.7,
        });
      } else if (k === "car") {
        draw(obMesh("car"), Tp(o.x, 0, o.z + 2.3), null, {
          tint: o.hue,
          spec: 0.8,
          rim: 0.4,
          emis: 0.1,
        });
        draw(TAIL, Tp(o.x, 0, o.z - 0.01), null, { emis: 1 });
      } else if (k === "bus") {
        draw(busMesh(o.len), Tp(o.x, 0, o.z), null, {
          tint: o.hue,
          spec: 0.5,
          rim: 0.4,
          emis: 0.1,
        });
        draw(TAIL, Tp(o.x, 0.4, o.z - 0.01), null, { emis: 1 });
      } else if (k === "pow")
        draw(
          PICKQ,
          joint(
            Tp(o.x, o.y + Math.sin(ca * 2 + o.z) * 0.12, o.z),
            0,
            ca * 1.6,
            0,
          ),
          powTex(o.t),
          PICKMAT,
        );
      else if (k === "let")
        draw(
          PICKQ,
          joint(
            Tp(o.x, o.y + Math.sin(ca * 2 + o.z) * 0.12, o.z),
            0,
            ca * 1.6,
            0,
          ),
          letTex(o.n),
          PICKMAT,
        );
    }
    coinTexs();
    CN.length = 0;
    GM.length = 0;
    for (const o of objs)
      if (o.k === "coin" && o.z - pz < 120 && o.z > pz - 10)
        (o.gem ? GM : CN).push(o);
    drawCoins(CN, COINT, 1.0, 0, ca);
    drawCoins(GM, GEMT, 1.35, 1, ca);
    const hz = pz - gap,
      tNow = performance.now() / 1000;
    if (gap < 10.5) {
      drawRobot(Tp(px * 0.7, 0, hz), Rig.GUARD, runPh + 1.5, {
        air: 0,
        slide: 0,
        hit: 0,
        siren: true,
        baton: true,
        t: tNow,
      });
      drawDog(Tp(px * 0.7 - 1.3, 0, hz - 0.3), runPh + 0.7, tNow);
    }
    if (heli) {
      const hxp = heli.x * 0.4,
        hzp = pz + 36,
        H0 = Tp(hxp, 17, hzp);
      put(boxM(2.2, 1.5, 3.6), H0, HELI_A);
      put(boxM(0.3, 0.3, 4), joint(H0, 0, 0.3, -3.6, 0), HELI_A);
      put(boxM(4.6, 0.06, 0.3), joint(H0, 0, 1.0, 0, 0, tNow * 40), HELI_B);
      put(
        boxM(0.3, 0.06, 1.2),
        joint(H0, 0.2, 0.3, -5.4, 0, 0, tNow * 50),
        HELI_B,
      );
      put(sphM(0.25), joint(H0, 0, -0.9, 1.2, 0), blink ? SIREN_R : SIREN_B);
      put(boxM(0.6, 0.4, 0.5), joint(H0, 0, -0.9, 1.7, 0), HELI_L);
    }
    const air = py > floorY + 0.12,
      over = state === "over",
      root = joint(Tp(px, py, pz), 0, 0, 0, 0, 0, -tilt * 0.9),
      flick = invul > 0 && !over && Math.floor(performance.now() / 70) % 2;
    if (!flick)
      drawRobot(root, look(), runPh, {
        air: air || jet > 0,
        slide: slideT > 0 && !air,
        hit: over || stumbleT > 0.25,
        t: 0,
        boost: turbo > 0 || padB > 0 || jet > 0,
      });
    flushChars();
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    draw(SHADOWM, Tp(px, 0, pz), BLOB, {
      alpha: 0.7 - Math.min(0.5, (py - floorY) * 0.12),
      tint: [0, 0, 0],
    });
    if (gap < 10.5)
      draw(SHADOWM, Tp(px * 0.7, 0, hz), BLOB, { alpha: 0.6, tint: [0, 0, 0] });
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    if (heli)
      (draw(LIGHTQ, joint(Tp(heli.x, 0, pz + 15), 0, 0, 0), LIGHTT, {
        alpha: 0.85,
        emis: 1,
        tint: [1.6 * 1.0, 1.4, 1.0],
        cut: 0,
      }),
        draw(LIGHTQ, joint(Tp(heli.x, 0, pz + 15), 0, 0, 0), LIGHTT, {
          alpha: 0.5,
          emis: 1,
          tint: [1, 1, 0.9],
        }));
    if (shield > 0 && (shield > 3 || blink))
      draw(SPHM_B, Tp(px, py, pz), null, {
        alpha: 0.28,
        emis: 1,
        rim: 1.2,
        rimCol: [0.5, 0.9, 1],
        tint: [0.4, 0.8, 1],
      });
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    drawHUD(VP);
  }
  const PICKMAT = { emis: 1, cut: 0.15 },
    HELI_A = { tint: [0.16, 0.2, 0.3], spec: 0.8, rim: 0.6, emis: 0.1 },
    HELI_B = { tint: [0.5, 0.5, 0.55], emis: 0 },
    HELI_L = { tint: [1, 0.95, 0.8], emis: 1 };
  const resizeIfNeeded = () => {
    if (
      cv.width !== Math.round(Math.max(240, innerWidth) * DPR) ||
      cv.height !== Math.round(Math.max(240, innerHeight) * DPR)
    )
      resize();
  };
  function proj(x, y, z, vp) {
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (w <= 0.01) return null;
    return [
      (((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) * W,
      (1 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 - 0.5) * H,
    ];
  }
  function drawHUD(vp) {
    hx.clearRect(0, 0, W, H);
    const u = UI,
      m = 16 * u,
      fnt = (w, sz) =>
        `${w} ${Math.round(sz * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`,
      tNow = performance.now();
    for (const s of sparks) {
      const p = proj(s.x, s.y, s.z, vp);
      if (!p) continue;
      hx.globalAlpha = clamp(s.l * 2, 0, 1);
      hx.fillStyle = s.c;
      hx.fillRect(p[0], p[1], 3.2 * u, 3.2 * u);
    }
    hx.globalAlpha = 1;
    if (rainA > 0.05 && qual < 2 && state !== "ready") {
      hx.strokeStyle = "rgba(200,220,255," + 0.32 * rainA + ")";
      hx.lineWidth = 1;
      hx.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = (i * 83.7 + 13) % W,
          y = ((i * 47.3 + tNow * (0.9 + (i % 5) * 0.12)) % (H + 40)) - 20;
        hx.moveTo(x, y);
        hx.lineTo(x - 5 * u, y + 20 * u);
      }
      hx.stroke();
    }
    if (heli && lit > 0.05) {
      hx.fillStyle = "rgba(255,255,230," + Math.min(0.5, lit) + ")";
      hx.fillRect(0, 0, W, H);
    }
    if (state === "over" && bustT > 0) {
      const k = Math.min(1, bustT / 0.3),
        bar = H * 0.1 * k;
      hx.fillStyle = "rgba(8,10,26," + 0.34 * k + ")";
      hx.fillRect(0, 0, W, H);
      hx.fillStyle = "#000";
      hx.fillRect(0, 0, W, bar);
      hx.fillRect(0, H - bar, W, bar);
      if (bustT > 0.35 && !ovOpen()) {
        const e = Math.min(1, (bustT - 0.35) / 0.25),
          sc = 1 + (1 - e) * 0.7;
        hx.save();
        hx.translate(W / 2, H * 0.3);
        hx.scale(sc, sc);
        hx.globalAlpha = e;
        hx.textAlign = "center";
        hx.textBaseline = "middle";
        hx.font = `800 ${Math.round(Math.min(56 * u, (W * 0.84) / Math.max(5, T("busted").length * 0.8)))}px Orbitron, 'Hiragino Sans', sans-serif`;
        hx.lineJoin = "round";
        hx.lineWidth = 6 * u;
        hx.strokeStyle = "rgba(0,0,0,.65)";
        hx.strokeText(T("busted"), 2, 3);
        hx.fillStyle = "#f1f2f7";
        hx.fillText(T("busted"), 0, 0);
        hx.font = `600 ${Math.round(11 * u)}px Orbitron, sans-serif`;
        hx.fillStyle = "#ff6b84";
        hx.fillText(T("caught"), 0, 34 * u);
        hx.restore();
      }
    }
    if (state === "ready") return;
    hx.textBaseline = "middle";
    hx.textAlign = "left";
    hx.fillStyle = "rgba(0,0,0,.45)";
    hx.font = fnt(800, 26);
    const sc = String(scoreNow());
    hx.fillText(sc, m + 1.5, m + 18 * u + 2);
    hx.fillStyle = "#fff";
    hx.fillText(sc, m, m + 18 * u);
    hx.font = fnt(600, 9);
    hx.fillStyle = "rgba(255,255,255,.8)";
    hx.fillText(
      Math.floor(pz) +
        " " +
        T("m") +
        "  ·  " +
        THEMES[themeAt(pz)].name.toUpperCase(),
      m,
      m + 40 * u,
    );
    const pipY = m + 52 * u;
    for (let i = 0; i < 2; i++) {
      hx.fillStyle = "rgba(0,0,0,.55)";
      hx.beginPath();
      hx.roundRect(m + i * 30 * u, pipY, 26 * u, 7 * u, 3 * u);
      hx.fill();
      if (i < 2 - hits) {
        hx.fillStyle = hits ? "#ff6b84" : "#46e08c";
        hx.beginPath();
        hx.roundRect(
          m + i * 30 * u + 1,
          pipY + 1,
          26 * u - 2,
          7 * u - 2,
          2 * u,
        );
        hx.fill();
      }
    }
    const ly = pipY + 20 * u;
    for (let i = 0; i < 6; i++) {
      const on = i < nextLetter;
      hx.fillStyle = on ? "#ffd84f" : "rgba(0,0,0,.5)";
      hx.beginPath();
      hx.roundRect(m + i * 21 * u, ly, 18 * u, 18 * u, 4 * u);
      hx.fill();
      hx.fillStyle = on ? "#3a2200" : "rgba(255,255,255,.35)";
      hx.textAlign = "center";
      hx.font = fnt(800, 11);
      hx.fillText("ZUMARY"[i], m + i * 21 * u + 9 * u, ly + 9.5 * u);
    }
    if (COINICON) {
      const ic = 26 * u * (1 + Math.max(0, coinHud) * 1.2),
        fr = Math.floor(tNow / 70) % 16;
      hx.textAlign = "right";
      hx.font = fnt(800, 24);
      const txt = String(coinsGot),
        tw = hx.measureText(txt).width;
      hx.fillStyle = "rgba(0,0,0,.5)";
      hx.fillText(txt, W - m + 1.5, m + 18 * u + 2);
      hx.fillStyle = "#ffe27a";
      hx.fillText(txt, W - m, m + 18 * u);
      hx.drawImage(
        COINICON[fr],
        W - m - tw - ic - 4 * u,
        m + 18 * u - ic / 2,
        ic,
        ic,
      );
    }
    let ry = m + 46 * u;
    if (mult > 1 || chain > 1) {
      hx.textAlign = "right";
      hx.font = fnt(800, 16);
      hx.fillStyle = mult > 3 ? "#ff8a3c" : "#7ffcff";
      hx.fillText("×" + mult, W - m, ry);
      hx.fillStyle = "rgba(255,255,255,.25)";
      hx.fillRect(W - m - 46 * u, ry + 10 * u, 46 * u, 3 * u);
      hx.fillStyle = "#fff";
      hx.fillRect(
        W - m - 46 * u,
        ry + 10 * u,
        46 * u * clamp(chainT / 1.5, 0, 1),
        3 * u,
      );
      ry += 26 * u;
    }
    for (const [t, v, mx] of [
      ["mag", mag, 9],
      ["shield", shield, 16],
      ["turbo", turbo, 5],
      ["dbl", dbl, 15],
      ["jet", jet, 7],
    ]) {
      if (v <= 0) continue;
      const ic = 26 * u;
      hx.drawImage(powCanvas(t), W - m - ic, ry - ic / 2 + 4 * u, ic, ic);
      hx.fillStyle = "rgba(0,0,0,.5)";
      hx.fillRect(W - m - ic - 48 * u, ry + 2 * u, 42 * u, 6 * u);
      hx.fillStyle = POWCOL[t];
      hx.fillRect(
        W - m - ic - 48 * u,
        ry + 2 * u,
        42 * u * clamp(v / mx, 0, 1),
        6 * u,
      );
      ry += 28 * u;
    }
    for (const f of floaties) {
      hx.globalAlpha = Math.min(1, f.l * 1.5);
      hx.textAlign = "center";
      hx.font = fnt(800, 20);
      hx.lineWidth = 4 * u;
      hx.strokeStyle = "rgba(0,0,0,.55)";
      hx.strokeText(f.text, W / 2, H * 0.24 - (1.4 - f.l) * 18 * u);
      hx.fillStyle = f.c;
      hx.fillText(f.text, W / 2, H * 0.24 - (1.4 - f.l) * 18 * u);
      hx.globalAlpha = 1;
    }
    if (state === "play" && (speed > 22 || turbo > 0) && qual < 2) {
      const k = turbo > 0 ? 1 : clamp((speed - 22) / 12, 0, 1);
      hx.strokeStyle = "rgba(255,246,230," + (0.05 + 0.12 * k) + ")";
      hx.lineWidth = 1.2;
      hx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2,
          r0 = Math.hypot(W, H) * (0.34 + ((i * 0.37 + runPh * 0.3) % 1) * 0.2),
          r1 = r0 + 50 * u * (1 + k);
        hx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.42 + Math.sin(a) * r0 * 0.9);
        hx.lineTo(W / 2 + Math.cos(a) * r1, H * 0.42 + Math.sin(a) * r1 * 0.9);
      }
      hx.stroke();
    }
    if (paused) {
      hx.fillStyle = "rgba(6,8,20,.6)";
      hx.fillRect(0, 0, W, H);
      hx.textAlign = "center";
      hx.fillStyle = "#fff";
      hx.font = fnt(800, 32);
      hx.fillText(T("paused"), W / 2, H / 2);
    }
  }

  /* ---------- flow ---------- */
  const rvBtn = document.createElement("button");
  rvBtn.id = "rv";
  rvBtn.type = "button";
  rvBtn.style.cssText =
    "background:linear-gradient(90deg,#ffd84f,#ff9a3c);display:none";
  $("go").parentNode.insertBefore(rvBtn, $("go"));
  function showOv(title, sub, row, btn, canRevive) {
    $("oTitle").textContent = title;
    $("oSub").innerHTML = sub;
    $("oRow").innerHTML = row;
    $("go").textContent = btn;
    $("back").textContent = T("back");
    rvBtn.style.display = canRevive ? "block" : "none";
    rvBtn.textContent = "▶ " + T("revive");
    $("ov").classList.remove("hidden");
  }
  function missionHtml() {
    const m = loadMissions();
    return `<div style="width:100%;text-align:left;font:600 11px Inter,sans-serif;color:#c8cdf0;margin-top:4px"><div style="font:700 9px Orbitron,sans-serif;letter-spacing:1.5px;color:#8c93b8;margin-bottom:4px">${T("missions")}</div>${m.l.map((q) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;opacity:${q.done ? 0.55 : 1}"><span>${q.done ? "✔ " : "◻ "}${missionText(q)}</span><span style="color:#ffd84f">${q.done ? "OK" : q.p + "/" + q.t}</span></div>`).join("")}</div>`;
  }
  function menu() {
    showOv(
      T("title"),
      T("sub"),
      `<div class="pill"><small>${T("best")}</small>${best}</div><div class="pill"><small>${T("level")}</small>${lvlOf(XP)}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>${wallet}</div>` +
        missionHtml(),
      T("play"),
      false,
    );
  }
  function start() {
    actx();
    reset();
    state = "play";
    paused = false;
    $("ov").classList.add("hidden");
    lastT = 0;
  }
  function endGame() {
    if (state !== "play") return;
    state = "over";
    bustT = 0;
    sfx.bust();
    vib([80, 40, 120]);
    shakeT = 0.5;
    vy = 4;
    const nb = bank(),
      d = scoreNow();
    setTimeout(() => {
      if (state !== "over") return;
      const extra =
        doneMsgs
          .map(
            (q) =>
              `<br><b style="color:#7ffcb0">✔ ${T("missionDone")} +100</b>`,
          )
          .join("") +
        (lvlMsg ? `<br><b style="color:#ffd84f">${lvlMsg}</b>` : "");
      showOv(
        T("busted"),
        T("caught") +
          (nb ? "<br><b style='color:#ffd84f'>" + T("newbest") + "</b>" : "") +
          extra,
        `<div class="pill"><small>${T("score")}</small>${d}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>+${coinsGot}</div><div class="pill"><small>${T("best")}</small>${best}</div>`,
        T("again"),
        !revived && wallet >= 100,
      );
    }, 1500);
  }
  rvBtn.addEventListener("click", () => {
    if (state !== "over" || revived || wallet < 100) return;
    wallet -= 100;
    store.set("zr_wallet", wallet);
    revived = true;
    state = "play";
    hits = 0;
    hitT = 0;
    invul = 3;
    gap = 11.5;
    bustT = 0;
    shakeT = 0;
    vy = 0;
    py = 0;
    shield = 4;
    lastT = 0;
    paused = false;
    for (const o of objs)
      if (o.k !== "coin" && o.z > pz - 6 && o.z < pz + 30) o.dead = true;
    $("ov").classList.add("hidden");
  });
  $("go").addEventListener("click", start);
  let gAcc = 0,
    gN = 0,
    now = 0,
    lastChg = 0,
    lastDown = 0;
  function setRes(v) {
    resScale = v;
    qual = v > 0.85 ? 0 : v > 0.7 ? 1 : v > 0.58 ? 2 : 3;
    FAR = FARS[qual];
    resize();
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastT) {
      lastT = ts;
      return;
    }
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.1) dt = 0.1;
    const ms = dt * 1000;
    if (state === "play" && !paused) {
      // dynamic-resolution governor: keeps the frame rate up on any phone
      gAcc += ms;
      gN++;
      if (gN >= 20) {
        const avg = gAcc / gN;
        gAcc = 0;
        gN = 0;
        now = performance.now();
        if (avg > 22 && resScale > 0.45 && now - lastChg > 900) {
          setRes(Math.max(0.45, resScale * (avg > 34 ? 0.78 : 0.9)));
          lastChg = now;
          lastDown = now;
        } else if (
          avg < 14 &&
          resScale < 1 &&
          now - lastDown > 5000 &&
          now - lastChg > 1500
        ) {
          setRes(Math.min(1, resScale * 1.06));
          lastChg = now;
        }
      }
    }
    if (!paused) update(dt);
    render();
  }
  addEventListener("resize", resize);
  addEventListener("orientationchange", () => setTimeout(resize, 200));
  (() => {
    // starting tier from what the browser tells us about the device
    let r = "";
    try {
      const e = gl.getExtension("WEBGL_debug_renderer_info");
      r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "";
    } catch (x) {}
    const cores = navigator.hardwareConcurrency || 4,
      mem = navigator.deviceMemory || 4;
    let t = cores <= 4 || mem <= 3 ? 1 : 0;
    if (/mali-4|adreno \(tm\) [23]\d\d|powervr sgx/i.test(r)) t = 2;
    if (/swiftshader|llvmpipe|software/i.test(r)) t = 3;
    setRes([1, 0.8, 0.62, 0.5][t]);
  })();
  resize();
  reset();
  coinTexs();
  if (!CVER) initCoinBuf();
  rt0();
  menu();
  requestAnimationFrame(frame);
  function rt0() {
    for (const c of [0, 1]) ROADS[c] = ROADS[c] || mkRoadTex(c);
    sidewalkTex();
    minaretTex();
    for (const t of POWS) powTex(t);
    for (let i = 0; i < 6; i++) letTex(i);
  }
  window.ZR3D = {
    step: (dt) => update(dt),
    render,
    get state() {
      return state;
    },
    get pos() {
      return pz;
    },
    start,
    setQual: (q) => {
      qual = q;
    },
    get coins() {
      return coinsGot;
    },
    set lane(v) {
      lane = v;
    },
    warp(p) {
      pz = p;
      resetCity(p);
      objs = [];
      nextSpawn = p + 40;
      ensureCity(p, 1e9);
      god = true;
    },
    give: (t) => givePow(t),
    jumpNow: jump,
    slideNow: slide,
    spawnAt: (fn) => fn,
    stats() {
      return {
        chunks: CHUNKS.size,
        objs: objs.length,
        qual,
        DPR,
        DC,
        resScale,
        mult,
        mag,
        shield,
        turbo,
        jet,
        dbl,
        S,
      };
    },
    objsAt() {
      return objs.map((o) => o.k);
    },
    add(k, l, dz, a) {
      const z = pz + dz;
      ({
        ramp,
        pad,
        pit,
        cone,
        low,
        gate,
        cart,
        bus: (ll, zz) => bus(ll, zz, 12),
        car: (ll, zz) => car(ll, zz, 8),
        laser: (ll, zz) => laser(zz, a),
        pow: (ll, zz) => powUp(ll, zz, a),
        letter: (ll, zz) => letterUp(ll, zz, a),
        coinArc: (ll, zz) => arc(ll, zz, 8, 2, 1.2),
      })[k](l, z);
    },
  };
})();
