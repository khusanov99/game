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
  const cv = $("c"), hudc = $("hud"), hx = hudc.getContext("2d");
  const COARSE = matchMedia("(pointer:coarse)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, lerp = (a, b, t) => a + (b - a) * t;
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* ---------- texts ---------- */
  const TX = {
    uz: { title: "SHAHAR YUGURISH 3D", sub: "Ko'cha o'rtasida yugur, tanga yig', to'siqlardan qoch.<br>Chapga/o'ngga surish — yo'l almashtirish · yuqoriga — sakrash · pastga — sirpanish.", play: "BOSHLASH", again: "YANA", back: "◀ ASOSIY O'YIN", best: "REKORD", score: "NATIJA", coins: "TANGA", busted: "USHLANDI!", caught: "Politsiya sizni ushladi", stumble: "EHTIYOT BO'L!", m: "m", paused: "PAUZA", newbest: "YANGI REKORD!", loading: "Shahar qurilmoqda…" },
    en: { title: "CITY RUN 3D", sub: "Run down the middle of the street, grab coins, dodge obstacles.<br>Swipe left/right to change lane · up to jump · down to slide.", play: "START", again: "AGAIN", back: "◀ MAIN GAME", best: "BEST", score: "SCORE", coins: "COINS", busted: "BUSTED!", caught: "The police got you", stumble: "WATCH OUT!", m: "m", paused: "PAUSED", newbest: "NEW BEST!", loading: "Building the city…" },
    ja: { title: "シティラン 3D", sub: "街の真ん中を走って、コインを集めて、障害物をよけよう。<br>左右スワイプでレーン変更 · 上でジャンプ · 下でスライディング。", play: "スタート", again: "もう一度", back: "◀ メインゲーム", best: "ベスト", score: "スコア", coins: "コイン", busted: "確保！", caught: "警察に捕まった", stumble: "危ない！", m: "m", paused: "一時停止", newbest: "新記録！", loading: "街を作っています…" },
  };
  let LG = "uz"; try { const s = localStorage.getItem("zr_lang"); if (s && TX[s]) LG = s; else { const n = (navigator.language || "uz").slice(0, 2); if (TX[n]) LG = n; } } catch (e) {}
  const T = (k) => TX[LG][k];
  document.documentElement.lang = LG;

  /* ---------- WebGL ---------- */
  let gl = null;
  try { gl = cv.getContext("webgl", { antialias: !COARSE, alpha: false, depth: true, powerPreference: "high-performance", preserveDrawingBuffer: false }) || cv.getContext("experimental-webgl"); } catch (e) {}
  if (!gl) { location.replace("./city.html"); return; }
  const ANISO = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
  cv.addEventListener("webglcontextrestored", () => location.reload());

  /* ---------- matrices (column-major) ---------- */
  const M4 = {
    id() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul(a, b, o) { o = o || new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
    persp(fy, as, n, f) { const t = 1 / Math.tan(fy / 2), o = new Float32Array(16); o[0] = t / as; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o; },
    look(e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
    },
    T(x, y, z) { const o = M4.id(); o[12] = x; o[13] = y; o[14] = z; return o; },
    RX(a) { const o = M4.id(), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
    RY(a) { const o = M4.id(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
    RZ(a) { const o = M4.id(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  };
  const TMP = [new Float32Array(16), new Float32Array(16), new Float32Array(16)];
  function joint(parent, x, y, z, rx, ry, rz) {            // parent × T × Rz × Ry × Rx
    let m = M4.mul(parent, M4.T(x, y, z));
    if (rz) m = M4.mul(m, M4.RZ(rz)); if (ry) m = M4.mul(m, M4.RY(ry)); if (rx) m = M4.mul(m, M4.RX(rx)); return m;
  }

  /* ---------- shaders ---------- */
  function prog(vs, fs, attrs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const MAIN = prog(`
attribute vec3 aP; attribute vec3 aN; attribute vec2 aT; attribute vec3 aC;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vN; varying vec3 vC; varying vec3 vW; varying vec2 vT;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vT = aT; vC = aC; gl_Position = uVP * w; }`, `
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
}`, ["aP", "aN", "aT", "aC"]);
  const SKY = prog(`attribute vec3 aP; varying vec2 vQ; void main(){ vQ = aP.xy; gl_Position = vec4(aP.xy, 0.9999, 1.0); }`, `
precision mediump float;
uniform vec3 uTop, uMid, uLow, uSun, uSunCol, uF, uR, uU; uniform vec2 uTan; varying vec2 vQ;
void main(){
  vec3 ray = normalize(uF + uR * vQ.x * uTan.x + uU * vQ.y * uTan.y); float h = ray.y;
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.22, h)); c = mix(c, uTop, smoothstep(0.18, 0.75, h)); if (h < 0.0) c = uLow;
  c += 0.025 * sin(h * 55.0 + ray.x * 6.0) * (1.0 - smoothstep(0.0, 0.5, h));
  float s = max(dot(ray, uSun), 0.0); c += uSunCol * (pow(s, 900.0) * 1.6 + pow(s, 22.0) * 0.4 + pow(s, 4.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
}`, ["aP"]);

  /* ---------- geometry builder ---------- */
  const WHITE = [1, 1, 1];
  class B {
    constructor() { this.v = []; this.i = []; this.n = 0; }
    vert(x, y, z, nx, ny, nz, u, v, c) { this.v.push(x, y, z, nx, ny, nz, u, v, c[0], c[1], c[2]); return this.n++; }
    quad(p, nrm, uv, c) { const a = this.vert(p[0][0], p[0][1], p[0][2], nrm[0], nrm[1], nrm[2], uv[0][0], uv[0][1], c), b = this.vert(p[1][0], p[1][1], p[1][2], nrm[0], nrm[1], nrm[2], uv[1][0], uv[1][1], c), cc = this.vert(p[2][0], p[2][1], p[2][2], nrm[0], nrm[1], nrm[2], uv[2][0], uv[2][1], c), d = this.vert(p[3][0], p[3][1], p[3][2], nrm[0], nrm[1], nrm[2], uv[3][0], uv[3][1], c); this.i.push(a, b, cc, a, cc, d); }
    box(cx, cy, cz, w, h, d, c, o) {                      // o.uv = { face: [u0,v0,u1,v1] } faces: px nx py ny pz nz
      o = o || {}; const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2, U = o.uv || {}, F = (k) => U[k] || [0.02, 0.02, 0.03, 0.03], ck = (k) => (o.cols && o.cols[k]) || c;
      const face = (k, p, n) => { const u = F(k); this.quad(p, n, [[u[0], u[3]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]]], ck(k)); };
      if (!o.skip || !o.skip.px) face("px", [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
      if (!o.skip || !o.skip.nx) face("nx", [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
      if (!o.skip || !o.skip.py) face("py", [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
      if (!o.skip || !o.skip.ny) face("ny", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
      if (!o.skip || !o.skip.pz) face("pz", [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
      if (!o.skip || !o.skip.nz) face("nz", [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
    }
    cyl(cx, cy, cz, r0, r1, h, seg, c, cap, c2) {         // vertical, base at cy; optional alternating colour c2 for ribs
      const sl = Math.atan2(r0 - r1, h);
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * TAU, a1 = ((s + 1) / seg) * TAU, cc = c2 && s % 2 ? c2 : c, am = (a0 + a1) / 2, nx = Math.cos(am) * Math.cos(sl), nz = Math.sin(am) * Math.cos(sl), ny = Math.sin(sl);
        const u0 = s / seg, u1 = (s + 1) / seg;
        this.quad([[cx + Math.cos(a0) * r0, cy, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cy, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cy + h, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cy + h, cz + Math.sin(a0) * r1]], [nx, ny, nz], [[u0, 1], [u1, 1], [u1, 0], [u0, 0]], cc);
      }
      if (cap) for (const top of [0, 1]) { const y = top ? cy + h : cy, r = top ? r1 : r0; if (r <= 0.001) continue; const ct = this.vert(cx, y, cz, 0, top ? 1 : -1, 0, 0.5, 0.5, c); let prev = -1; for (let s = 0; s <= seg; s++) { const a = (s / seg) * TAU, q = this.vert(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, top ? 1 : -1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5, c); if (prev >= 0) this.i.push(ct, prev, q); prev = q; } }
    }
    sph(cx, cy, cz, rx, ry, rz, la, lo, c) {
      for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) {
        const t0 = (i / la) * Math.PI, t1 = ((i + 1) / la) * Math.PI, p0 = (j / lo) * TAU, p1 = ((j + 1) / lo) * TAU;
        const P = (t, p) => [cx + Math.sin(t) * Math.cos(p) * rx, cy + Math.cos(t) * ry, cz + Math.sin(t) * Math.sin(p) * rz], Nn = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
        const A = [P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0)], Nm = [Nn(t0, p0), Nn(t0, p1), Nn(t1, p1), Nn(t1, p0)];
        const ids = A.map((q, k) => this.vert(q[0], q[1], q[2], Nm[k][0], Nm[k][1], Nm[k][2], j / lo, i / la, c)); this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
      }
    }
    lathe(cx, cy, cz, pts, seg, c, c2) {                   // pts: [[r, y], ...] bottom → top
      for (let k = 0; k < pts.length - 1; k++) {
        const [r0, y0] = pts[k], [r1, y1] = pts[k + 1], dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy) || 1, ny = -dr / l, nr = dy / l;
        for (let s = 0; s < seg; s++) {
          const a0 = (s / seg) * TAU, a1 = ((s + 1) / seg) * TAU, am = (a0 + a1) / 2, cc = c2 && s % 2 ? c2 : c, g = 0.8 + 0.2 * (k / pts.length);
          this.quad([[cx + Math.cos(a0) * r0, cy + y0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cy + y0, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cy + y1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cy + y1, cz + Math.sin(a0) * r1]], [Math.cos(am) * nr, ny, Math.sin(am) * nr], [[s / seg, 1 - k / pts.length], [(s + 1) / seg, 1 - k / pts.length], [(s + 1) / seg, 1 - (k + 1) / pts.length], [s / seg, 1 - (k + 1) / pts.length]], [cc[0] * g, cc[1] * g, cc[2] * g]);
        }
      }
    }
    mesh() {
      const m = { vb: gl.createBuffer(), ib: gl.createBuffer(), n: this.i.length };
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.i), gl.STATIC_DRAW); return m;
    }
  }
  const freeMesh = (m) => { if (m) { gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib); } };
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  /* ---------- textures ---------- */
  const potUp = (n, cap) => { let p = 1; while (p < n && p < cap) p <<= 1; return p; };
  function texFrom(canvas, o) {
    o = o || {}; let src = canvas;
    const w = potUp(canvas.width, o.cap || 1024), h = potUp(canvas.height, o.cap || 1024);
    if (w !== canvas.width || h !== canvas.height) { src = document.createElement("canvas"); src.width = w; src.height = h; const g = src.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(canvas, 0, 0, w, h); }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wr = o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.repeatS === false ? gl.CLAMP_TO_EDGE : wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(COARSE ? 4 : 8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }
  const mkc = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const WHITE_TEX = (() => { const c = mkc(4, 4), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 4, 4); return texFrom(c); })();

  /* ---------- draw ---------- */
  let VP = M4.id(), CAM = [0, 3, -6], SUN = [0.36, 0.2, 0.91], FOGC = [0.9, 0.6, 0.5], FOGK = 1 / 150, SKYC = [0.4, 0.45, 0.8], GNDC = [0.5, 0.4, 0.4], SUNC = [1.2, 0.8, 0.55];
  const IDM = M4.id();
  function useMain() {
    gl.useProgram(MAIN.p); const u = MAIN.u;
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uSun, SUN); gl.uniform3fv(u.uSunCol, SUNC); gl.uniform3fv(u.uSky, SKYC); gl.uniform3fv(u.uGnd, GNDC); gl.uniform3fv(u.uFog, FOGC); gl.uniform3fv(u.uCam, CAM); gl.uniform1f(u.uFogK, FOGK); gl.uniform1i(u.uTex, 0);
    for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
  }
  const MAT0 = { tint: [1, 1, 1], emis: 0, spec: 0, rim: 0, rimCol: [1, 0.7, 0.5], alpha: 1, cut: 0 };
  function draw(m, M, tex, o) {
    o = o || MAT0; const u = MAIN.u;
    gl.uniformMatrix4fv(u.uM, false, M || IDM); gl.uniform3fv(u.uTint, o.tint || MAT0.tint); gl.uniform1f(u.uEmis, o.emis || 0); gl.uniform1f(u.uSpec, o.spec || 0); gl.uniform1f(u.uRim, o.rim || 0); gl.uniform3fv(u.uRimCol, o.rimCol || MAT0.rimCol); gl.uniform1f(u.uAlpha, o.alpha === undefined ? 1 : o.alpha); gl.uniform1f(u.uCut, o.cut || 0);
    gl.bindTexture(gl.TEXTURE_2D, tex || WHITE_TEX); gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 24); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 44, 32);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }
  const SKYQ = (() => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW); return b; })();

  /* ---------- view ---------- */
  let W = 360, H = 640, DPR = 1, qual = 0, budgetK = 1, avgDt = 16.7, slowN = 0, FAR = 230;
  const PIX = () => (COARSE ? 800000 : 2600000) * budgetK;
  function resize() {
    const cw = Math.max(240, innerWidth), ch = Math.max(240, innerHeight);
    DPR = Math.min(devicePixelRatio || 1, 2); const want = cw * ch * DPR * DPR, bud = PIX(); if (want > bud) DPR = Math.max(0.5, DPR * Math.sqrt(bud / want));
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR); hudc.width = Math.round(cw * Math.min(DPR, 1.5)); hudc.height = Math.round(ch * Math.min(DPR, 1.5));
    W = cw; H = ch; UI = Math.max(0.8, Math.min(W, H) / 390); hx.setTransform(hudc.width / W, 0, 0, hudc.height / H, 0, 0);
  }
  let UI = 1;

  /* ---------- themes ---------- */
  const THEMES = [
    { top: "#2a2f6b", mid: "#c4577a", low: "#ffb36b", fog: "#e6a07a", sun: "#ffd9a0", name: "Tashkent" },
    { top: "#2d6fc6", mid: "#79b4e0", low: "#fbe0b0", fog: "#cfe0ee", sun: "#fff0c0", name: "Samarkand" },
    { top: "#6a3a7a", mid: "#e8845a", low: "#ffcf7a", fog: "#f0b684", sun: "#fff0b0", name: "Bukhara" },
    { top: "#1c2250", mid: "#6b4a8e", low: "#f08a6a", fog: "#c98a90", sun: "#ffd2a0", name: "Khiva" },
  ];
  const DEFS = [
    [["glass", 5, 16], ["panel", 7, 9], ["tower", 5.5, 13], ["glass", 4.4, 19], ["panel", 6, 9], ["shops", 5, 7]],
    [["registan", 10, 11], ["madrasa", 8, 10], ["registan", 9, 10], ["shops", 5, 7], ["madrasa", 7, 9]],
    [["brick", 7, 7.5], ["brick", 5.5, 8], ["madrasa", 7, 9], ["brick", 6, 7], ["shops", 5.5, 7]],
    [["fort", 8, 8], ["fort", 6, 8.5], ["brick", 5, 7], ["fort", 7, 7.5], ["fort", 5.5, 8]],
  ];
  const THEME_LEN = 900, themeAt = (z) => (((Math.floor(z / THEME_LEN) % 4) + 4) % 4), S = 1.55, PPU = COARSE ? 28 : 40;
  const FT = {};                                                   // facade GL textures by theme/index
  function facadeTex(th, idx) {
    const k = th + ":" + idx; if (FT[k]) return FT[k];
    const [kind, len, h] = DEFS[th][idx], f = Facades.make(th, kind, len, h, PPU, true);
    return (FT[k] = { tex: texFrom(f.cv, { cap: 1024 }), kind, len: len * S, h: h * S, domes: f.domes, w: f.w, hh: f.hh });
  }
  function dropThemeTex(th) { for (const k of Object.keys(FT)) if (k.startsWith(th + ":")) { gl.deleteTexture(FT[k].tex); delete FT[k]; } }
  let MINT = null;
  function minaretTex() {
    if (MINT) return MINT; const c = mkc(128, 512), g = c.getContext("2d"); Facades.brickPat(g, 128, 512, 0, "#d2a76d", "rgba(80,45,15,.45)"); Facades.grain(g, 128, 512, 0.2);
    for (let i = 0; i < 5; i++) Facades.mosaic(g, 0, 40 + i * 90, 128, 30, "#14589a", "#6fd0e6", "#ffe9a8");
    const q = g.createLinearGradient(0, 0, 128, 0); q.addColorStop(0, "rgba(0,0,0,.35)"); q.addColorStop(0.35, "rgba(255,200,120,.12)"); q.addColorStop(1, "rgba(0,0,0,.4)"); g.fillStyle = q; g.fillRect(0, 0, 128, 512);
    return (MINT = texFrom(c, { repeat: true, repeatS: true }));
  }
  const ROADS = {}, mkRoadTex = (cross) => {
    const w = 256, h = 1024, c = mkc(w, h), g = c.getContext("2d"), px = (m) => (m / 10.4) * w, pz = (m) => (m / 40) * h;
    g.fillStyle = "#2c2f39"; g.fillRect(0, 0, w, h); Facades.grain(g, w, h, 0.5, "overlay");
    for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(0,0,0," + rnd(0.05, 0.18) + ")"; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(6, 30), rnd(10, 60), 0, 0, TAU); g.fill(); }
    g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(0, 0, px(1.9), h); g.fillRect(px(8.5), 0, px(1.9), h);
    g.fillStyle = "rgba(255,255,255,.85)"; for (const m of [-1.1, 1.1]) for (let k = 0; k < 8; k++) g.fillRect(px(5.2 + m - 0.07), pz(k * 5), px(0.14), pz(2.4));
    g.fillStyle = "rgba(255,255,255,.9)"; for (const m of [-3.3, 3.3]) g.fillRect(px(5.2 + m - 0.08), 0, px(0.16), h);
    g.fillStyle = "rgba(255,216,80,.9)"; for (const m of [-5.0, 5.0]) g.fillRect(px(5.2 + m - 0.06), 0, px(0.12), h);
    if (cross) { g.fillStyle = "rgba(245,245,245,.92)"; for (let x = 0.3; x < 10.2; x += 0.9) g.fillRect(px(x), pz(1), px(0.5), pz(5)); g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(0, pz(0.4), w, pz(0.3)); g.fillRect(0, pz(6.3), w, pz(0.3)); }
    return texFrom(c, { repeat: true, repeatS: false });
  };
  let SWT = null; function sidewalkTex() {
    if (SWT) return SWT; const c = mkc(128, 128), g = c.getContext("2d"); g.fillStyle = "#b8ae9a"; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = ["#c4baa4", "#b2a890", "#bcb29c"][(x * 3 + y * 5) % 3]; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
    g.strokeStyle = "rgba(60,50,40,.4)"; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
    Facades.grain(g, 128, 128, 0.35, "overlay"); return (SWT = texFrom(c, { repeat: true }));
  }
  const STRIPE = (() => { const c = mkc(64, 64), g = c.getContext("2d"); g.fillStyle = "#ffcc1a"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#15151c"; for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 16, 64); g.lineTo(i * 16 + 8, 64); g.lineTo(i * 16 + 40, 0); g.lineTo(i * 16 + 32, 0); g.fill(); } return texFrom(c, { repeat: true }); })();
  const BLOB = (() => { const c = mkc(64, 64), g = c.getContext("2d"), q = g.createRadialGradient(32, 32, 2, 32, 32, 32); q.addColorStop(0, "rgba(0,0,0,.75)"); q.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = q; g.fillRect(0, 0, 64, 64); return texFrom(c); })();

  /* ---------- static meshes ---------- */
  const ROADM = (() => { const b = new B(); b.quad([[-5.2, 0, 0], [5.2, 0, 0], [5.2, 0, 40], [-5.2, 0, 40]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE); return b.mesh(); })();
  const SIDEM = (() => { const b = new B(); for (const sd of [-1, 1]) { const x0 = sd * 5.4, x1 = sd * 8.6; b.quad([[x0, 0.16, 0], [x1, 0.16, 0], [x1, 0.16, 40], [x0, 0.16, 40]], [0, 1, 0], [[0, 0], [1, 0], [1, 10], [0, 10]], WHITE); b.box(sd * 5.3, 0.08, 20, 0.2, 0.16, 40, [0.85, 0.82, 0.74], { skip: { py: 1 } }); } return b.mesh(); })();
  const SHADOWM = (() => { const b = new B(); b.quad([[-1, 0.03, -1], [1, 0.03, -1], [1, 0.03, 1], [-1, 0.03, 1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE); return b.mesh(); })();

  /* ---------- city generator ---------- */
  const CH = 60, BX = 9.2, CHUNKS = new Map(), CUR = [-40, -40];
  const WALL = [[0.78, 0.66, 0.5], [0.74, 0.7, 0.66], [0.82, 0.7, 0.52], [0.72, 0.6, 0.46]], TILEB = [0.1, 0.42, 0.66];
  function addDome(b, x, y, z, R, tall, col, col2) {
    const pts = []; for (let k = 0; k <= 10; k++) { const a = (k / 10) * (Math.PI / 2); pts.push([R * Math.cos(a) * (1 + 0.16 * Math.sin(2 * a)), y + tall * Math.sin(a)]); }
    const dr = R * 0.62; b.cyl(x, y - dr, z, R * 0.86, R * 0.86, dr, 14, [0.82, 0.68, 0.46], false); b.lathe(x, 0, z, pts, 18, col, col2); b.cyl(x, y + tall, z, 0.05, 0.05, R * 0.4, 6, [0.95, 0.78, 0.3]); b.sph(x, y + tall + R * 0.4, z, 0.14, 0.14, 0.14, 6, 8, [0.95, 0.78, 0.3]);
  }
  function addMinaret(b, sb, x, z, hgt, r) {
    const seg = 14, c = [1, 1, 1]; b.cyl(x, 0, z, r * 1.35, r * 0.9, hgt, seg, c, false);
    sb.cyl(x, hgt - 2.2, z, r * 1.5, r * 1.5, 0.5, seg, [0.78, 0.6, 0.38]); sb.cyl(x, hgt - 1.7, z, r * 1.25, r * 1.1, 0.7, seg, [0.12, 0.46, 0.7]);
    sb.cyl(x, hgt - 1.0, z, r * 0.9, r * 0.9, 1.4, 10, [0.12, 0.5, 0.74], true);
    addDome(sb, x, hgt + 0.4, z, r * 1.05, r * 1.7, [0.1, 0.62, 0.78], [0.2, 0.78, 0.88]);
  }
  function chunkB(ch, key) { return ch.b[key] || (ch.b[key] = { b: new B(), tex: null, mat: null }); }
  function addBuilding(ch, sd, z0, th) {
    const idx = (Math.random() * DEFS[th].length) | 0, ft = facadeTex(th, idx), Wm = ft.len, Hm = ft.h * rnd(0.95, 1.1), dep = 15, xf = sd * (BX + rnd(0, 1.2));
    const wc = pick(WALL), key = "f" + th + ":" + idx, e = chunkB(ch, key); e.tex = ft.tex; e.mat = { emis: 0.28, tint: [1.06, 1.04, 1.0] }; const b = e.b;
    const zc = z0 + Wm / 2, xc = xf + sd * dep / 2, nrm = sd > 0 ? "nx" : "px";
    // facade quad faces the street; u runs left → right as seen from the street
    const front = sd < 0 ? [[xf, 0, z0 + Wm], [xf, 0, z0], [xf, Hm, z0], [xf, Hm, z0 + Wm]] : [[xf, 0, z0], [xf, 0, z0 + Wm], [xf, Hm, z0 + Wm], [xf, Hm, z0]];
    b.quad(front, [-sd, 0, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]);
    // solid body (side walls, back, roof) in the shared plain batch
    const s = chunkB(ch, "solid"); s.tex = null; s.mat = { emis: 0, spec: 0.0 };
    const sb = s.b, wcc = mulc(wc, 0.85), roofY = Hm;
    sb.box(xc + sd * 0.02, Hm / 2, zc, dep, Hm, Wm - 0.02, wcc, { skip: { [nrm]: 1 }, cols: { py: [0.42, 0.4, 0.4] } });
    sb.box(xf - sd * 0.12, Hm + 0.25, zc, 0.5, 0.5, Wm + 0.3, mulc(wc, 1.1));          // cornice
    if (ft.kind === "glass") { sb.cyl(xc, Hm, zc, 0.12, 0.05, 6, 5, [0.6, 0.6, 0.65]); sb.sph(xc, Hm + 6, zc, 0.22, 0.22, 0.22, 5, 6, [1, 0.2, 0.2]); }
    else if (ft.kind === "panel" || ft.kind === "tower" || ft.kind === "shops") for (let k = 0; k < 2; k++) sb.box(xc + sd * rnd(-2, 2), Hm + 0.5, z0 + rnd(0.2, 0.8) * Wm, rnd(0.8, 1.6), 1.0, rnd(0.8, 1.6), [0.5, 0.5, 0.52]);
    if (["glass", "panel", "tower", "shops"].includes(ft.kind)) {                            // shop awnings over the lit ground floor
      const n = Math.max(2, Math.round(Wm / 3.6)), pal = [[0.8, 0.22, 0.3], [0.16, 0.6, 0.72], [0.92, 0.7, 0.2]];
      for (let i = 0; i < n; i++) { const zz = z0 + ((i + 0.5) * Wm) / n; sb.box(xf - sd * 0.55, 2.9, zz, 1.1, 0.14, Wm / n - 0.4, pal[(i + th) % 3]); }
    }
    for (const d of ft.domes || []) {                                                        // real 3D domes on top of madrasas / Registan
      const dx = d.x / ft.w, dwm = (d.w / ft.w) * Wm, dz = z0 + (sd < 0 ? Wm - (dx * Wm + dwm / 2) : dx * Wm + dwm / 2), dy = Hm * (1 - d.y / ft.hh);
      addDome(sb, xf + sd * dwm * 0.55, dy, dz, dwm / 2 * 0.92, dwm * 0.66, [0.1, 0.62, 0.78], [0.22, 0.8, 0.9]);
    }
    return Wm;
  }
  function genChunk(ci) {
    const zA = ci * CH, zB = zA + CH, th = themeAt(zA + CH / 2), ch = { ci, zA, zB, b: {}, meshes: [] };
    for (let s = 0; s < 2; s++) {
      const sd = s ? 1 : -1; while (CUR[s] < zB) {
        if (Math.random() < 0.2) { const g = rnd(5, 9); const sb = chunkB(ch, "solid").b; sb.box(sd * (BX + 8), 6, CUR[s] + g / 2, 14, 12, g, [0.5, 0.42, 0.34]); addMinaretMaybe(ch, sd, CUR[s] + g / 2, th); CUR[s] += g; continue; }
        CUR[s] += addBuilding(ch, sd, CUR[s], th) + (Math.random() < 0.25 ? rnd(0.3, 1.4) : 0.02);
      }
    }
    // distant towers behind the street wall — depth, fog-dimmed
    for (let s = 0; s < 2; s++) for (let k = 0; k < 2; k++) { const sd = s ? 1 : -1, z = zA + rnd(4, CH - 8), hh = rnd(26, 62), w = rnd(10, 18), e = chunkB(ch, "far" + th); e.tex = facadeTex(th, th === 0 ? 0 : 0).tex; e.mat = { emis: 0.3, tint: [0.85, 0.85, 0.95] }; e.b.box(sd * rnd(30, 55), hh / 2, z, w, hh, w, [1, 1, 1], { uv: { px: [0.1, 0.05, 0.9, 0.95], nx: [0.1, 0.05, 0.9, 0.95], pz: [0.1, 0.05, 0.9, 0.95], nz: [0.1, 0.05, 0.9, 0.95] } }); }
    // street furniture
    const sb = chunkB(ch, "solid").b, kit = qual < 2;
    for (let z = Math.ceil(zA / 20) * 20; z < zB; z += 20) for (const sd of [-1, 1]) {
      sb.cyl(sd * 5.9, 0, z, 0.09, 0.07, 5.2, 7, [0.16, 0.18, 0.24]); sb.box(sd * 5.1, 5.15, z, 1.8, 0.08, 0.08, [0.16, 0.18, 0.24]); const lb = chunkB(ch, "glow"); lb.tex = null; lb.mat = { emis: 1 }; lb.b.sph(sd * 4.25, 5.0, z, 0.26, 0.14, 0.26, 5, 8, [1, 0.9, 0.6]);
      if (kit && z % 40 === 0) { sb.cyl(sd * 7.2, 0, z + 10, 0.22, 0.28, 1.6, 7, [0.38, 0.26, 0.16]); for (const [dx, dy, r, c] of [[0, 3.0, 1.7, [0.2, 0.45, 0.24]], [-0.9, 2.5, 1.2, [0.24, 0.52, 0.28]], [0.9, 2.6, 1.2, [0.18, 0.4, 0.22]], [0, 3.9, 1.2, [0.26, 0.55, 0.3]]]) sb.sph(sd * 7.2 + dx, dy + 0.9, z + 10, r, r * 0.85, r, 6, 8, c); }
      if (kit && Math.random() < 0.55) addParkedCar(ch, sd, z + rnd(4, 15));
    }
    for (const k of Object.keys(ch.b)) { const e = ch.b[k]; if (e.b.i.length) ch.meshes.push({ m: e.b.mesh(), tex: e.tex, mat: e.mat }); }
    ch.b = null; return ch;
  }
  function addMinaretMaybe(ch, sd, z, th) { if (th === 0) return; const sb = chunkB(ch, "mn").b, e = chunkB(ch, "mn"); e.tex = minaretTex(); e.mat = { emis: 0.25 }; addMinaret(sb, chunkB(ch, "solid").b, sd * (BX + 10), z, rnd(18, 26), 1.5); }
  function addParkedCar(ch, sd, z) {
    const sb = chunkB(ch, "solid").b, c = pick([[0.92, 0.92, 0.94], [0.9, 0.9, 0.92], [0.12, 0.12, 0.15], [0.55, 0.56, 0.6], [0.2, 0.3, 0.55], [0.7, 0.12, 0.14]]), x = sd * 4.3;
    sb.box(x, 0.55, z, 1.75, 0.6, 4.4, c); sb.box(x, 1.05, z - 0.1, 1.55, 0.5, 2.3, c, { cols: { px: [0.1, 0.14, 0.22], nx: [0.1, 0.14, 0.22], pz: [0.1, 0.14, 0.22], nz: [0.1, 0.14, 0.22] } });
    for (const dz of [-1.4, 1.4]) for (const dx of [-0.85, 0.85]) sb.box(x + dx, 0.28, z + dz, 0.2, 0.56, 0.56, [0.06, 0.06, 0.07]);
    const lg = chunkB(ch, "glow").b; lg.box(x - 0.55, 0.62, z - 2.21, 0.35, 0.14, 0.05, [1, 0.1, 0.1]); lg.box(x + 0.55, 0.62, z - 2.21, 0.35, 0.14, 0.05, [1, 0.1, 0.1]);
  }
  function ensureCity(pz, budget) {
    const c0 = Math.floor((pz - 70) / CH), c1 = Math.floor((pz + FAR) / CH); let made = 0;
    for (let ci = c0; ci <= c1; ci++) if (!CHUNKS.has(ci)) { if (CUR[0] < ci * CH - 5 || CUR[1] < ci * CH - 5) { CUR[0] = Math.max(CUR[0], ci * CH - 4); CUR[1] = Math.max(CUR[1], ci * CH - 4); } CHUNKS.set(ci, genChunk(ci)); if (++made >= budget) break; }
    for (const [ci, ch] of CHUNKS) if (ci < c0 - 1) { ch.meshes.forEach((x) => freeMesh(x.m)); CHUNKS.delete(ci); }
    const th = themeAt(pz), nx = themeAt(pz + 300); if (nx !== th) for (let i = 0; i < DEFS[nx].length; i++) facadeTex(nx, i);
    for (let t = 0; t < 4; t++) if (t !== th && t !== nx && t !== themeAt(pz - 120)) dropThemeTex(t);
  }
  function resetCity(z) { for (const ch of CHUNKS.values()) ch.meshes.forEach((x) => freeMesh(x.m)); CHUNKS.clear(); CUR[0] = CUR[1] = z - 40; }

  /* ---------- characters ---------- */
  const PM = {};                                           // part mesh cache
  const part = (key, f) => PM[key] || (PM[key] = (() => { const b = new B(); f(b); return b.mesh(); })());
  const cylM = (r0, r1, h, seg = 10) => part("c" + r0 + "," + r1 + "," + h + "," + seg, (b) => b.cyl(0, -h, 0, r1, r0, h, seg, WHITE, true));    // hangs down from origin
  const boxM = (w, h, d, dy = 0) => part("b" + w + "," + h + "," + d + "," + dy, (b) => b.box(0, dy, 0, w, h, d, WHITE));
  const sphM = (r, sy = 1, sz = 1) => part("s" + r + "," + sy + "," + sz, (b) => b.sph(0, 0, 0, r, r * sy, r * sz, 10, 14, WHITE));
  const coneM = (r, h) => part("k" + r + "," + h, (b) => b.cyl(0, 0, 0, r, 0.01, h, 8, WHITE));
  const mat = (c, extra) => Object.assign({ tint: c, spec: 0.5, rim: 0.7, rimCol: [1, 0.62, 0.4] }, extra || {});
  function drawRobot(root, look, ph, st) {                  // st: {air, slide, hit, t}
    const P = { arm: hex(look.arm), plate: hex(look.plate), dark: hex(look.dark), glow: hex(look.glow), acc: hex(look.acc) };
    const mArm = mat(P.arm, { spec: 0.9, emis: 0.18 }), mPl = mat(P.plate, { spec: 0.6, emis: 0.2 }), mDk = mat(mulc(P.dark, 1.5), { spec: 0.2, rim: 0.4, emis: 0.1 }), mGl = { tint: P.glow, emis: 1 }, mAc = { tint: P.acc, emis: 0.8 };
    const sw = Math.sin(ph), cw = Math.cos(ph), air = st.air, hipY = 0.98, bob = air ? 0 : Math.abs(sw) * 0.06;
    let R = root;
    if (st.slide) R = joint(R, 0, 0.62, 0, -1.2);
    else if (st.hit) R = joint(R, 0, 0, 0, 0.2);
    else R = joint(R, 0, bob, 0, 0.1);                    // forward lean
    const hip = joint(R, 0, hipY, 0, 0);
    draw(boxM(0.5, 0.24, 0.32), hip, null, mDk);
    const tor = joint(hip, 0, 0.5, 0, 0, sw * 0.12);      // torso twist
    draw(boxM(0.64, 0.62, 0.36), tor, null, mArm); draw(boxM(0.5, 0.14, 0.2, 0), joint(tor, 0, 0.18, -0.19, 0), null, mPl);
    draw(boxM(0.5, 0.5, 0.06), joint(tor, 0, 0.02, -0.2, 0), null, mPl); draw(boxM(0.34, 0.06, 0.04), joint(tor, 0, 0.1, -0.235, 0), null, mGl); draw(boxM(0.34, 0.06, 0.04), joint(tor, 0, -0.06, -0.235, 0), null, mAc);
    // backpack / thrusters
    const bp = joint(tor, 0, 0.05, -0.3, 0); draw(boxM(0.5, 0.5, 0.24), bp, null, mArm); draw(boxM(0.36, 0.34, 0.05), joint(bp, 0, 0.02, -0.13, 0), null, mPl); draw(boxM(0.3, 0.05, 0.03), joint(bp, 0, 0.1, -0.16, 0), null, mGl); draw(boxM(0.3, 0.05, 0.03), joint(bp, 0, -0.02, -0.16, 0), null, mAc); draw(boxM(0.3, 0.05, 0.03), joint(bp, 0, -0.14, -0.16, 0), null, mGl);
    for (const sx of [-0.13, 0.13]) { draw(cylM(0.07, 0.09, 0.14), joint(bp, sx, -0.2, -0.04, 0), null, mPl); if (air || st.boost) draw(coneM(0.09, 0.5 + Math.random() * 0.2), joint(bp, sx, -0.36, -0.04, Math.PI), null, { tint: [1, 0.65, 0.2], emis: 1 }); else draw(sphM(0.05), joint(bp, sx, -0.36, -0.04, 0), null, mGl); }
    // neck + head
    const hd = joint(tor, 0, 0.5, 0.0, 0.05); draw(cylM(0.09, 0.09, 0.1), hd, null, mDk);
    draw(sphM(0.27, 0.95, 0.95), joint(hd, 0, 0.3, 0, 0), null, mPl); draw(boxM(0.36, 0.14, 0.08), joint(hd, 0, 0.3, 0.24, 0), null, mGl);
    draw(boxM(0.3, 0.05, 0.04), joint(hd, 0, 0.32, -0.26, 0), null, mAc);
    for (const sx of [-1, 1]) { draw(cylM(0.1, 0.1, 0.06), joint(hd, sx * 0.27, 0.35, 0, 0, 0, Math.PI / 2 * sx), null, mDk); draw(cylM(0.06, 0.06, 0.04), joint(hd, sx * 0.31, 0.35, 0, 0, 0, Math.PI / 2 * sx), null, mGl); }
    draw(cylM(0.015, 0.015, 0.26), joint(hd, 0.1, 0.78, 0, 0), null, mDk); draw(sphM(0.05), joint(hd, 0.1, 0.82, 0), null, mAc);
    if (st.siren) { const on = Math.floor(st.t * 7) % 2; draw(cylM(0.09, 0.09, 0.1), joint(hd, 0, 0.62, 0, 0), null, { tint: on ? [1, 0.15, 0.2] : [0.15, 0.3, 1], emis: 1 }); }
    // arms
    for (const s of [-1, 1]) {
      const a = air ? -2.5 + s * 0.2 : st.slide ? -1.4 : (s > 0 ? sw : -sw) * 0.95, sh = joint(tor, s * 0.42, 0.2, 0, a, 0, s * 0.12);
      draw(sphM(0.12), sh, null, mDk); draw(cylM(0.085, 0.07, 0.32), sh, null, mArm);
      const el = joint(sh, 0, -0.32, 0, air ? -0.3 : -0.9 - (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.5); draw(sphM(0.08), el, null, mDk); draw(cylM(0.07, 0.06, 0.3), el, null, mArm);
      draw(sphM(0.1), joint(el, 0, -0.32, 0, 0), null, mPl);
      if (st.baton && s > 0) draw(cylM(0.03, 0.03, 0.5), joint(el, 0, -0.34, 0.1, -1.4), null, { tint: [0.1, 0.1, 0.14], spec: 0.3 });
    }
    // legs
    for (const s of [-1, 1]) {
      const sg = s > 0 ? sw : -sw, cg = s > 0 ? cw : -cw;
      let h1, k1;
      if (st.slide) { h1 = -0.1; k1 = 0.1; } else if (air) { h1 = s > 0 ? -0.9 : 0.3; k1 = s > 0 ? 1.3 : 0.9; } else if (st.hit) { h1 = s * 0.3; k1 = 0.3; } else { h1 = -sg * 0.95; k1 = 0.2 + 0.95 * Math.max(0, cg); }
      const th = joint(hip, s * 0.17, 0, 0, h1); draw(sphM(0.13), th, null, mDk); draw(cylM(0.1, 0.08, 0.5), th, null, mPl);
      const kn = joint(th, 0, -0.5, 0, k1); draw(sphM(0.09), kn, null, mDk); draw(cylM(0.08, 0.07, 0.46), kn, null, mArm);
      const ft = joint(kn, 0, -0.47, 0, -(h1 + k1) * 0.5 + (air ? 0.4 : 0)); draw(boxM(0.2, 0.12, 0.34, 0.0), joint(ft, 0, -0.03, 0.07, 0), null, mDk); draw(boxM(0.2, 0.04, 0.34), joint(ft, 0, -0.1, 0.07, 0), null, mGl);
    }
  }
  const DOGP = { metal: [0.52, 0.55, 0.62], dark: [0.1, 0.12, 0.18], glow: [1, 0.2, 0.25], acc: [1, 0.85, 0.3] };
  function drawDog(root, ph, t) {
    const sw = Math.sin(ph * 1.4), R = joint(root, 0, 0.12 + Math.abs(sw) * 0.05, 0, 0.05), mM = mat(DOGP.metal, { spec: 0.9 }), mD = mat(DOGP.dark, { spec: 0.2 }), mG = { tint: DOGP.glow, emis: 1 };
    draw(boxM(0.5, 0.42, 1.0), joint(R, 0, 0.6, 0, 0), null, mM); draw(boxM(0.36, 0.1, 0.5), joint(R, 0, 0.84, -0.1, 0), null, mD);
    draw(boxM(0.3, 0.28, 0.34), joint(R, 0, 0.78, 0.6, 0.1), null, mM); draw(boxM(0.2, 0.14, 0.3), joint(R, 0, 0.72, 0.84, 0.1), null, mD); draw(boxM(0.2, 0.05, 0.05), joint(R, 0, 0.82, 0.76, 0), null, mG);
    for (const sx of [-1, 1]) draw(coneM(0.06, 0.2), joint(R, sx * 0.1, 0.9, 0.55, 0), null, mD);
    draw(cylM(0.04, 0.03, 0.4), joint(R, 0, 0.8, -0.55, 0.9 + Math.sin(t * 12) * 0.15), null, mD); draw(sphM(0.06), joint(R, 0, 0.95, -0.82, 0), null, mG);
    for (const [lx, lz, f] of [[-0.2, 0.38, 0], [0.2, 0.38, 1], [-0.2, -0.38, 1], [0.2, -0.38, 0]]) { const a = Math.sin(ph * 1.4 + f * Math.PI) * 0.9, up = joint(R, lx, 0.5, lz, a); draw(cylM(0.07, 0.05, 0.3), up, null, mM); const lo = joint(up, 0, -0.3, 0, 0.5 + Math.max(0, -a) * 0.5); draw(cylM(0.05, 0.04, 0.3), lo, null, mD); }
  }

  /* ---------- game state ---------- */
  const LX = [-2.2, 0, 2.2], SPEED0 = 15;
  let state = "ready", pz = 0, px = 0, py = 0, vy = 0, lane = 1, speed = SPEED0, slideT = 0, tilt = 0, runPh = 0, coinsGot = 0, hits = 0, hitT = 0, invul = 0, shakeT = 0, bustT = 0, stumbleT = 0, gap = 11.5, camX = 0, camShake = 0;
  let objs = [], nextSpawn = 50, sparks = [], floaties = [], wallet = store.get("zr_wallet", 0), best = store.get("zr3d2_best", 0), coinHud = 0, paused = false, god = false, boost = 0, lastT = 0, skin = store.get("zr_skin", "default");
  const look = () => (Rig.LOOKS[skin] || Rig.LOOKS.default);

  function reset() { pz = 0; px = 0; py = 0; vy = 0; lane = 1; speed = SPEED0; slideT = 0; tilt = 0; coinsGot = 0; hits = 0; hitT = 0; invul = 0; bustT = 0; stumbleT = 0; gap = 11.5; camX = 0; objs = []; sparks = []; floaties = []; nextSpawn = 55; coinHud = 0; resetCity(0); ensureCity(0, 99); }

  /* obstacles */
  function coin(l, z, y, gem) { objs.push({ k: "coin", x: LX[l], z, y: y === undefined ? 1.0 : y, gem: !!gem, ph: Math.random() * 6 }); }
  function coinLine(l, z, n, step = 2.2, y) { for (let i = 0; i < n; i++) coin(l, z + i * step, y); }
  const low = (l, z) => objs.push({ k: "low", x: LX[l], z, len: 0.7 }), gate = (l, z) => objs.push({ k: "gate", x: LX[l], z, len: 0.6 });
  const car = (l, z) => objs.push({ k: "car", x: LX[l], z, len: 4.6, hue: pick([[0.92, 0.92, 0.95], [0.85, 0.12, 0.16], [0.14, 0.14, 0.18], [0.2, 0.36, 0.7]]) });
  const bus = (l, z, len) => objs.push({ k: "bus", x: LX[l], z, len, hue: pick([[0.16, 0.4, 0.8], [0.9, 0.55, 0.1], [0.2, 0.62, 0.52]]) });
  function spawn() {
    const z = nextSpawn, L = (Math.random() * 3) | 0, o1 = (L + 1 + ((Math.random() * 2) | 0)) % 3, o2 = 3 - L - o1, hard = clamp(pz / 3000, 0, 1), r = Math.random(); let used = 24;
    if (r < 0.18) { coinLine(L, z, 9); used = 24; }
    else if (r < 0.36) { low(L, z + 8); for (let i = 0; i < 8; i++) coin(L, z + 2 + i * 2, 1.0 + Math.sin((i / 7) * Math.PI) * 1.2); used = 26; }
    else if (r < 0.52) { gate(L, z + 8); coinLine(L, z + 1, 7, 1.6, 0.7); coinLine(o1, z, 6, 2.4); used = 22; }
    else if (r < 0.68) { bus(L, z + 4, rnd(11, 16)); coinLine(o1, z + 2, 9); if (hard > 0.3 && Math.random() < 0.6) low(o2, z + 12); used = 32; }
    else if (r < 0.8) { car(L, z + 6); car(o1, z + 8); coinLine(o2, z, 9); used = 24; }
    else if (r < 0.92) { for (let i = 0; i < 10; i++) coin([0, 1, 2, 1][i % 4], z + i * 2.4); gate(L, z + 24); used = 30; }
    else { gate(0, z + 6); gate(1, z + 6); gate(2, z + 6); coinLine(1, z, 5, 1.6, 0.7); coin(1, z + 14, 1.0, true); used = 22; }
    if (Math.random() < 0.3) coin((Math.random() * 3) | 0, z + rnd(3, 14), 1.0, true);
    nextSpawn = z + used + speed * rnd(0.5, 0.9);
  }

  /* obstacle meshes */
  const OB = {};
  function obMesh(k) {
    if (OB[k]) return OB[k]; const b = new B();
    if (k === "low") { b.box(0, 0.4, 0, 1.9, 0.8, 0.6, [1, 1, 1], { uv: { pz: [0, 0, 1, 1], nz: [0, 0, 1, 1], px: [0, 0, 0.3, 1], nx: [0, 0, 0.3, 1], py: [0, 0, 0.5, 0.5] } }); b.box(0, 0.88, 0, 1.9, 0.1, 0.5, [0.9, 0.9, 0.9]); }
    else if (k === "gate") { for (const sx of [-0.95, 0.95]) b.box(sx, 1.35, 0, 0.14, 2.7, 0.3, [0.25, 0.28, 0.36]); b.box(0, 1.9, 0, 2.0, 0.65, 0.3, [1, 1, 1], { uv: { pz: [0, 0, 2, 0.6], nz: [0, 0, 2, 0.6], py: [0, 0, 1, 1] } }); b.box(0, 2.35, 0, 2.0, 0.08, 0.34, [0.2, 0.2, 0.26]); }
    else if (k === "car") {
      const c = [1, 1, 1]; b.box(0, 0.62, 0, 1.8, 0.7, 4.6, c); b.box(0, 1.2, -0.1, 1.6, 0.55, 2.4, c, { cols: { px: [0.07, 0.1, 0.18], nx: [0.07, 0.1, 0.18], pz: [0.07, 0.1, 0.18], nz: [0.05, 0.08, 0.14], py: c } });
      for (const dz of [-1.5, 1.5]) for (const dx of [-0.9, 0.9]) b.box(dx, 0.3, dz, 0.22, 0.6, 0.6, [0.05, 0.05, 0.06]);
    } else if (k === "bus") { b.box(0, 1.55, 0, 2.2, 2.6, 1, [1, 1, 1]); }
    return (OB[k] = b.mesh());
  }
  const GLOWM = {};
  function glowBox(k, f) { return GLOWM[k] || (GLOWM[k] = (() => { const b = new B(); f(b); return b.mesh(); })()); }
  let BUSL = {};                                          // buses are cut to length, cached by length
  function busMesh(len) {
    const key = Math.round(len); if (BUSL[key]) return BUSL[key]; const b = new B(), L = key, c = [1, 1, 1], gl2 = [0.12, 0.16, 0.26];
    b.box(0, 1.5, L / 2, 2.3, 2.6, L, c, { cols: { px: c, nx: c, pz: [0.15, 0.18, 0.28], nz: [0.15, 0.18, 0.28] } }); b.box(0, 2.42, L / 2, 2.34, 0.7, L - 0.6, gl2); b.box(0, 0.26, L / 2, 2.0, 0.5, L - 0.4, [0.08, 0.08, 0.1]);
    b.box(0, 2.9, L / 2, 2.0, 0.12, L - 0.4, [0.8, 0.8, 0.82]);
    return (BUSL[key] = b.mesh());
  }
  const TAIL = (() => { const b = new B(); b.box(-0.8, 0.9, 0, 0.35, 0.16, 0.06, [1, 0.12, 0.1]); b.box(0.8, 0.9, 0, 0.35, 0.16, 0.06, [1, 0.12, 0.1]); return b.mesh(); })();
  const REDL = (() => { const b = new B(); b.sph(0, 0, 0, 0.1, 0.1, 0.1, 6, 8, [1, 0.1, 0.1]); return b.mesh(); })();

  /* coins: one dynamic batch per face texture; CPU-transformed discs */
  let COINT = null, GEMT = null, COINTPL = null;
  function coinTexs() {
    if (COINT) return;
    const mkT = (frames, gem) => { const c = mkc(128, 128), g = c.getContext("2d"), q = g.createRadialGradient(64, 64, 4, 64, 64, 90); q.addColorStop(0, gem ? "#fff6b0" : "#ffe58a"); q.addColorStop(1, gem ? "#ff9a2a" : "#e59a1e"); g.fillStyle = q; g.fillRect(0, 0, 128, 128); const f = frames[0]; g.drawImage(f, 14, 14, 100, 100); return texFrom(c, {}); };
    const R = Rig.coins(1.6); COINT = mkT(R.n, false); GEMT = mkT(R.g, true); COINICON = R.n;
    const b = new B(), seg = 16, r = 0.5, t = 0.09, c = [1, 1, 1]; for (const sgn of [1, -1]) { const ct = b.vert(0, 0, sgn * t, 0, 0, sgn, 0.5, 0.5, c); let prev = -1; for (let s = 0; s <= seg; s++) { const a = (s / seg) * TAU, q2 = b.vert(Math.cos(a) * r, Math.sin(a) * r, sgn * t, 0, 0, sgn, 0.5 + Math.cos(a) * 0.5 * 0.9 * (sgn > 0 ? 1 : -1), 0.5 - Math.sin(a) * 0.5 * 0.9, c); if (prev >= 0) b.i.push(ct, sgn > 0 ? prev : q2, sgn > 0 ? q2 : prev); prev = q2; } }
    for (let s = 0; s < seg; s++) { const a0 = (s / seg) * TAU, a1 = ((s + 1) / seg) * TAU, nn = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]; b.quad([[Math.cos(a0) * r, Math.sin(a0) * r, -t], [Math.cos(a1) * r, Math.sin(a1) * r, -t], [Math.cos(a1) * r, Math.sin(a1) * r, t], [Math.cos(a0) * r, Math.sin(a0) * r, t]], nn, [[0.02, 0.02], [0.03, 0.02], [0.03, 0.03], [0.02, 0.03]], [0.95, 0.75, 0.25]); }
    COINTPL = { v: new Float32Array(b.v), i: b.i, n: b.n };
  }
  let COINICON = null; const DYN = { vb: gl.createBuffer(), ib: gl.createBuffer(), n: 0 };
  function drawCoins(list, tex, size) {
    if (!list.length) return; const nv = COINTPL.n, vs = COINTPL.v, ni = COINTPL.i.length, verts = new Float32Array(list.length * nv * 11), idx = new Uint16Array(list.length * ni); let o = 0, io = 0, base = 0;
    for (const cn of list) {
      const a = cn.a, ca = Math.cos(a), sa = Math.sin(a), bob = Math.sin(cn.ph) * 0.08;
      for (let v = 0; v < nv; v++) { const q = v * 11, x = vs[q] * size, y = vs[q + 1] * size, z = vs[q + 2] * size, nx = vs[q + 3], ny = vs[q + 4], nz = vs[q + 5]; verts[o++] = x * ca + z * sa + cn.x; verts[o++] = y + cn.y + bob; verts[o++] = -x * sa + z * ca + cn.z; verts[o++] = nx * ca + nz * sa; verts[o++] = ny; verts[o++] = -nx * sa + nz * ca; verts[o++] = vs[q + 6]; verts[o++] = vs[q + 7]; verts[o++] = vs[q + 8]; verts[o++] = vs[q + 9]; verts[o++] = vs[q + 10]; }
      for (let i = 0; i < ni; i++) idx[io++] = COINTPL.i[i] + base; base += nv;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, DYN.vb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, DYN.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW); DYN.n = idx.length;
    draw(DYN, IDM, tex, { emis: 0.55, spec: 0.8, tint: [1.1, 1.05, 0.9] });
  }

  /* ---------- audio / input ---------- */
  let AC = null, muted = store.get("zr3d_mute", false);
  function tone(f, d, type, v, f2) { if (muted) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); const o = AC.createOscillator(), g = AC.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, AC.currentTime); if (f2) o.frequency.exponentialRampToValueAtTime(f2, AC.currentTime + d); g.gain.setValueAtTime(v || 0.06, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d + 0.02); } catch (e) {} }
  const sfx = { coin() { tone(988, 0.07, "sine", 0.07); setTimeout(() => tone(1480, 0.1, "sine", 0.06), 55); }, jump() { tone(300, 0.16, "triangle", 0.07, 620); }, slide() { tone(260, 0.2, "sawtooth", 0.03, 120); }, hit() { tone(180, 0.28, "sawtooth", 0.09, 55); }, bust() { tone(120, 0.5, "square", 0.07, 40); }, move() { tone(500, 0.05, "sine", 0.03, 420); } };
  const vib = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };
  function moveLane(d) { if (state !== "play") return; const nl = clamp(lane + d, 0, 2); if (nl !== lane) { lane = nl; sfx.move(); } }
  function jump() { if (state !== "play") return; if (py < 0.06) { vy = 9.2; slideT = 0; sfx.jump(); } }
  function slide() { if (state !== "play") return; slideT = 0.75; if (py > 0.06) vy = Math.min(vy, -12); else sfx.slide(); }
  let pt = null; const ovOpen = () => !$("ov").classList.contains("hidden");
  addEventListener("pointerdown", (e) => { if (ovOpen()) return; pt = { x: e.clientX, y: e.clientY, done: false }; if (AC && AC.state === "suspended") AC.resume(); });
  addEventListener("pointermove", (e) => { if (!pt || pt.done) return; const dx = e.clientX - pt.x, dy = e.clientY - pt.y, th = 22; if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { moveLane(dx > 0 ? 1 : -1); pt.done = true; } else if (Math.abs(dy) > th) { dy < 0 ? jump() : slide(); pt.done = true; } });
  addEventListener("pointerup", () => { pt = null; }); addEventListener("pointercancel", () => { pt = null; });
  addEventListener("keydown", (e) => {
    const k = e.key; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k)) e.preventDefault();
    if (state !== "play") { if ((k === "Enter" || k === " ") && ovOpen()) start(); return; }
    if (k === "ArrowLeft" || k === "a" || k === "A") moveLane(-1); else if (k === "ArrowRight" || k === "d" || k === "D") moveLane(1); else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump(); else if (k === "ArrowDown" || k === "s" || k === "S") slide(); else if (k === "p" || k === "P") paused = !paused; else if (k === "m" || k === "M") { muted = !muted; store.set("zr3d_mute", muted); }
  });
  addEventListener("blur", () => { if (state === "play") paused = true; }); addEventListener("visibilitychange", () => { if (document.hidden && state === "play") paused = true; });
  hudc.addEventListener("click", () => { paused = false; }); addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- update ---------- */
  function floatText(text, c) { floaties.push({ text, c, l: 1.3 }); }
  function hurt() {
    if (invul > 0 || god) return; hits++; hitT = 8; invul = 1.4; shakeT = 0.45; sfx.hit(); vib(60); stumbleT = 0.5;
    for (let i = 0; i < 14; i++) sparks.push({ x: px, y: 1, z: pz, vx: rnd(-4, 4), vy: rnd(1, 5), vz: rnd(-2, 2), l: 0.7, c: "#ffb36b" });
    if (hits >= 2) { endGame(); return; } speed = Math.max(SPEED0, speed * 0.78); gap = 4.6; floatText(T("stumble"), "#ff6b84");
  }
  function update(dt) {
    if (state === "play") {
      speed = Math.min(34, speed + dt * 0.22); pz += speed * dt; runPh += dt * (6.2 + speed * 0.19);
      px += (LX[lane] - px) * Math.min(1, dt * 13); tilt = lerp(tilt, clamp((LX[lane] - px) * 0.18, -0.3, 0.3), Math.min(1, dt * 12)); camX += (px * 0.7 - camX) * Math.min(1, dt * 6);
      vy -= 28 * dt; py += vy * dt; if (py <= 0) { py = 0; if (vy < 0) vy = 0; } if (slideT > 0) slideT -= dt;
      if (invul > 0) invul -= dt; if (hitT > 0) { hitT -= dt; if (hitT <= 0) hits = 0; } if (shakeT > 0) shakeT -= dt; if (stumbleT > 0) stumbleT -= dt; if (boost > 0) boost -= dt;
      gap = lerp(gap, hits > 0 ? 4.4 : 11, Math.min(1, dt * 1.6));
      while (nextSpawn < pz + 150) spawn();
      const top = py + (slideT > 0 && py < 0.1 ? 0.85 : 1.85), pad = 0.45;
      for (const o of objs) {
        if (o.dead || o.got) continue;
        if (o.k === "coin") { if (Math.abs(o.z - pz) < 1.0 && Math.abs(o.x - px) < 0.85 && o.y > py - 0.2 && o.y < top + 0.3) { o.got = true; coinsGot += o.gem ? 5 : 1; coinHud = 0.25; sfx.coin(); for (let i = 0; i < 7; i++) sparks.push({ x: o.x, y: o.y, z: o.z, vx: rnd(-2, 2), vy: rnd(0, 3), vz: rnd(-1, 1), l: 0.5, c: "#ffe27a" }); } continue; }
        if (o.z < pz + pad && o.z + o.len > pz - pad && Math.abs(o.x - px) < 0.95) { if (o.k === "low" && py < 0.8) hurt(); else if (o.k === "gate" && top > 1.25 && py < 2.2) hurt(); else if (o.k === "car" && py < 1.5) hurt(); else if (o.k === "bus") hurt(); if (o.k !== "bus" && o.k !== "car" && invul > 0) o.dead = true; }
      }
      objs = objs.filter((o) => !o.got && !o.dead && o.z + (o.len || 0) > pz - 15);
    } else if (state === "over") { bustT += dt; px += (LX[lane] - px) * Math.min(1, dt * 10); gap = lerp(gap, 2.2, Math.min(1, dt * 4)); runPh += dt * 3; vy -= 28 * dt; py = Math.max(0, py + vy * dt); }
    else { runPh += dt * 6; camX *= 0.9; pz += 4 * dt; }
    if (coinHud > 0) coinHud -= dt;
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.l -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= 9 * dt; if (s.l <= 0) sparks.splice(i, 1); }
    for (let i = floaties.length - 1; i >= 0; i--) { floaties[i].l -= dt; if (floaties[i].l <= 0) floaties.splice(i, 1); }
    ensureCity(pz, 1);
  }

  /* ---------- render ---------- */
  let sunScreen = null;
  function hexMix(a, b, t) { const A = hex(a), B2 = hex(b); return [lerp(A[0], B2[0], t), lerp(A[1], B2[1], t), lerp(A[2], B2[2], t)]; }
  function setEnvironment() {
    const th = themeAt(pz), nx = (th + 1) % 4, into = ((pz % THEME_LEN) + THEME_LEN) % THEME_LEN, t = clamp((into - (THEME_LEN - 120)) / 120, 0, 1), A = THEMES[th], Bt = THEMES[nx];
    const mix = (k) => hexMix(A[k], Bt[k], t); FOGC = mix("fog"); SKY.cur = { top: mix("top"), mid: mix("mid"), low: mix("low"), sun: mix("sun") };
    SKYC = mulc(hexMix(A.top, Bt.top, t), 1.35); GNDC = mulc(FOGC, 0.62); SUNC = mulc(SKY.cur.sun, 1.35);
    SUN = (() => { const v = [0.38, 0.22, 0.9], l = Math.hypot(...v); return v.map((x) => x / l); })();
  }
  function render() {
    resizeIfNeeded();
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.1, 0.1, 0.2, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.CULL_FACE);
    setEnvironment();
    const asp = W / H, fy = (asp < 0.8 ? 66 : asp < 1.2 ? 60 : 54) * Math.PI / 180 + (speed - 15) * 0.0012, dist = asp < 0.8 ? 6.0 : 6.8, h = asp < 0.8 ? 3.5 : 3.7;
    const shk = shakeT > 0 ? shakeT : 0, sx = rnd(-1, 1) * shk * 0.25, sy = rnd(-1, 1) * shk * 0.2;
    CAM = [camX + sx, h + sy, pz - dist]; const tgt = [camX * 0.55 + px * 0.2, 2.7, pz + 8], P = M4.persp(fy, asp, 0.3, 420), V = M4.look(CAM, tgt, [0, 1, 0]); VP = M4.mul(P, V);
    FOGK = 1 / (qual >= 2 ? 120 : 160);
    // sky
    gl.disable(gl.DEPTH_TEST); gl.useProgram(SKY.p); const su = SKY.u, c = SKY.cur;
    const f = [tgt[0] - CAM[0], tgt[1] - CAM[1], tgt[2] - CAM[2]], fl = Math.hypot(...f), F = f.map((x) => x / fl), R = [F[2], 0, -F[0]], rl = Math.hypot(...R), RR = R.map((x) => x / rl), U = [RR[1] * F[2] - RR[2] * F[1], RR[2] * F[0] - RR[0] * F[2], RR[0] * F[1] - RR[1] * F[0]];
    gl.uniform3fv(su.uTop, c.top); gl.uniform3fv(su.uMid, c.mid); gl.uniform3fv(su.uLow, c.low); gl.uniform3fv(su.uSun, SUN); gl.uniform3fv(su.uSunCol, mulc(c.sun, 0.8)); gl.uniform3fv(su.uF, F); gl.uniform3fv(su.uR, RR); gl.uniform3fv(su.uU, U); gl.uniform2f(su.uTan, Math.tan(fy / 2) * asp, Math.tan(fy / 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, SKYQ); gl.enableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); useMain();
    // ground
    const z0 = Math.floor((pz - 60) / 40) * 40, rt = (cross) => ROADS[cross] || (ROADS[cross] = mkRoadTex(cross));
    for (let z = z0; z < pz + FAR; z += 40) { const M = M4.T(0, 0, z); draw(ROADM, M, rt(Math.round(z / 40) % 5 === 0 ? 1 : 0), { emis: 0.1, tint: [1.15, 1.12, 1.1] }); draw(SIDEM, M, sidewalkTex(), { emis: 0.15, tint: [1.1, 1.08, 1.05] }); }
    // city chunks
    for (const ch of CHUNKS.values()) { if (ch.zB < pz - 30 || ch.zA > pz + FAR) continue; for (const x of ch.meshes) { const o = x.mat || MAT0; draw(x.m, IDM, x.tex, o); } }
    // obstacles
    for (const o of objs) {
      if (o.k === "coin" || o.z - pz > FAR || o.z + o.len < pz - 12) continue;
      if (o.k === "low") draw(obMesh("low"), M4.T(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 }), draw(REDL, M4.T(o.x - 0.7, 1.05, o.z + 0.3), null, { emis: Math.floor(performance.now() / 260) % 2 ? 1 : 0.3, tint: [1, 0.2, 0.2] });
      else if (o.k === "gate") draw(obMesh("gate"), M4.T(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 });
      else if (o.k === "car") { draw(obMesh("car"), M4.T(o.x, 0, o.z + 2.3), null, { tint: o.hue, spec: 0.8, rim: 0.4, emis: 0.1 }); draw(TAIL, M4.T(o.x, 0, o.z - 0.01), null, { emis: 1 }); }
      else if (o.k === "bus") { draw(busMesh(o.len), M4.T(o.x, 0, o.z), null, { tint: o.hue, spec: 0.5, rim: 0.4, emis: 0.1 }); draw(TAIL, M4.T(o.x, 0.4, o.z - 0.01), null, { emis: 1 }); }
    }
    // coins
    coinTexs(); const cn = [], gm = [], ca = performance.now() / 380;
    for (const o of objs) if (o.k === "coin" && o.z - pz < 120 && o.z > pz - 10) (o.gem ? gm : cn).push({ x: o.x, y: o.y, z: o.z, a: ca * 2 + o.ph, ph: ca + o.ph });
    drawCoins(cn, COINT, 1.0); drawCoins(gm, GEMT, 1.35);
    // chasers
    const hz = pz - gap;
    if (gap < 10.5) { const root = M4.T(px * 0.7, 0, hz), G = Rig.GUARD; drawRobot(root, G, runPh + 1.5, { air: 0, slide: 0, hit: 0, siren: true, baton: true, t: performance.now() / 1000 }); drawDog(M4.T(px * 0.7 - 1.3, 0, hz - 0.3), runPh + 0.7, performance.now() / 1000); }
    // player
    const air = py > 0.12, over = state === "over", root = M4.mul(M4.T(px, py, pz), M4.RZ(-tilt * 0.9));
    const flick = invul > 0 && !over && Math.floor(performance.now() / 70) % 2;
    if (!flick) drawRobot(root, look(), runPh, { air, slide: slideT > 0 && !air, hit: over || stumbleT > 0.25, t: 0, boost: false });
    // shadows (alpha-blended)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const sc = (s, a) => ({ alpha: a, tint: [0, 0, 0] });
    draw(SHADOWM, joint(M4.T(px, 0, pz), 0, 0, 0, 0), BLOB, { alpha: 0.7 - Math.min(0.4, py * 0.3), tint: [0, 0, 0], cut: 0 });
    if (gap < 10.5) draw(SHADOWM, M4.T(px * 0.7, 0, hz), BLOB, { alpha: 0.6, tint: [0, 0, 0] });
    gl.depthMask(true); gl.disable(gl.BLEND);
    // HUD layer
    drawHUD(VP);
  }
  const resizeIfNeeded = () => { if (cv.width !== Math.round(Math.max(240, innerWidth) * DPR) || cv.height !== Math.round(Math.max(240, innerHeight) * DPR)) resize(); };
  function proj(x, y, z, vp) { const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; if (w <= 0.01) return null; return [(((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) * W, (1 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 - 0.5) * H]; }
  function drawHUD(vp) {
    hx.clearRect(0, 0, W, H); const u = UI, m = 16 * u, fnt = (w, sz) => `${w} ${Math.round(sz * u)}px Orbitron, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;
    for (const s of sparks) { const p = proj(s.x, s.y, s.z, vp); if (!p) continue; hx.globalAlpha = clamp(s.l * 2, 0, 1); hx.fillStyle = s.c; hx.fillRect(p[0], p[1], 3.2 * u, 3.2 * u); } hx.globalAlpha = 1;
    if (state === "over" && bustT > 0) { const k = Math.min(1, bustT / 0.3), bar = H * 0.1 * k; hx.fillStyle = "rgba(8,10,26," + 0.34 * k + ")"; hx.fillRect(0, 0, W, H); hx.fillStyle = "#000"; hx.fillRect(0, 0, W, bar); hx.fillRect(0, H - bar, W, bar);
      if (bustT > 0.35 && !ovOpen()) { const e = Math.min(1, (bustT - 0.35) / 0.25), sc = 1 + (1 - e) * 0.7; hx.save(); hx.translate(W / 2, H * 0.3); hx.scale(sc, sc); hx.globalAlpha = e; hx.textAlign = "center"; hx.textBaseline = "middle"; hx.font = `800 ${Math.round(Math.min(56 * u, (W * 0.84) / Math.max(5, T("busted").length * 0.8)))}px Orbitron, 'Hiragino Sans', sans-serif`; hx.lineJoin = "round"; hx.lineWidth = 6 * u; hx.strokeStyle = "rgba(0,0,0,.65)"; hx.strokeText(T("busted"), 2, 3); hx.fillStyle = "#f1f2f7"; hx.fillText(T("busted"), 0, 0); hx.font = `600 ${Math.round(11 * u)}px Orbitron, sans-serif`; hx.fillStyle = "#ff6b84"; hx.fillText(T("caught"), 0, 34 * u); hx.restore(); } }
    if (state === "ready") return; hx.textBaseline = "middle";
    hx.textAlign = "left"; hx.fillStyle = "rgba(0,0,0,.45)"; hx.font = fnt(800, 26); hx.fillText(Math.floor(pz) + " " + T("m"), m + 1.5, m + 18 * u + 2); hx.fillStyle = "#fff"; hx.fillText(Math.floor(pz) + " " + T("m"), m, m + 18 * u);
    hx.font = fnt(600, 9); hx.fillStyle = "rgba(255,255,255,.75)"; hx.fillText(T("best") + " " + Math.max(best, Math.floor(pz)) + "  ·  " + THEMES[themeAt(pz)].name.toUpperCase(), m, m + 40 * u);
    if (COINICON) { const ic = 26 * u * (1 + Math.max(0, coinHud) * 1.2), fr = Math.floor(performance.now() / 70) % 16; hx.textAlign = "right"; hx.font = fnt(800, 24); const txt = String(coinsGot), tw = hx.measureText(txt).width; hx.fillStyle = "rgba(0,0,0,.5)"; hx.fillText(txt, W - m + 1.5, m + 18 * u + 2); hx.fillStyle = "#ffe27a"; hx.fillText(txt, W - m, m + 18 * u); hx.drawImage(COINICON[fr], W - m - tw - ic - 4 * u, m + 18 * u - ic / 2, ic, ic); }
    const pipY = m + 62 * u; for (let i = 0; i < 2; i++) { hx.fillStyle = "rgba(0,0,0,.55)"; hx.beginPath(); hx.roundRect(m + i * 30 * u, pipY, 26 * u, 7 * u, 3 * u); hx.fill(); if (i < 2 - hits) { hx.fillStyle = hits ? "#ff6b84" : "#46e08c"; hx.beginPath(); hx.roundRect(m + i * 30 * u + 1, pipY + 1, 26 * u - 2, 7 * u - 2, 2 * u); hx.fill(); } }
    for (const f of floaties) { hx.globalAlpha = Math.min(1, f.l * 1.5); hx.textAlign = "center"; hx.font = fnt(800, 20); hx.fillStyle = f.c; hx.fillText(f.text, W / 2, H * 0.26 - (1.3 - f.l) * 20 * u); hx.globalAlpha = 1; }
    if (state === "play" && speed > 22 && qual < 2) { const k = clamp((speed - 22) / 12, 0, 1); hx.strokeStyle = "rgba(255,246,230," + (0.05 + 0.1 * k) + ")"; hx.lineWidth = 1.2; hx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2, r0 = Math.hypot(W, H) * (0.34 + ((i * 0.37 + runPh * 0.3) % 1) * 0.2), r1 = r0 + 50 * u * (1 + k); hx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.42 + Math.sin(a) * r0 * 0.9); hx.lineTo(W / 2 + Math.cos(a) * r1, H * 0.42 + Math.sin(a) * r1 * 0.9); } hx.stroke(); }
    if (paused) { hx.fillStyle = "rgba(6,8,20,.6)"; hx.fillRect(0, 0, W, H); hx.textAlign = "center"; hx.fillStyle = "#fff"; hx.font = fnt(800, 32); hx.fillText(T("paused"), W / 2, H / 2); }
  }

  /* ---------- flow ---------- */
  function showOv(title, sub, row, btn) { $("oTitle").textContent = title; $("oSub").innerHTML = sub; $("oRow").innerHTML = row; $("go").textContent = btn; $("back").textContent = T("back"); $("ov").classList.remove("hidden"); }
  function menu() { showOv(T("title"), T("sub"), `<div class="pill"><small>${T("best")}</small>${best} ${T("m")}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>${wallet}</div>`, T("play")); }
  function start() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) {} reset(); state = "play"; paused = false; $("ov").classList.add("hidden"); lastT = 0; }
  function endGame() {
    if (state !== "play") return; state = "over"; bustT = 0; sfx.bust(); vib([80, 40, 120]); shakeT = 0.5; vy = 4;
    const d = Math.floor(pz), nb = d > best; if (nb) { best = d; store.set("zr3d2_best", best); } wallet += coinsGot; store.set("zr_wallet", wallet);
    setTimeout(() => { if (state === "over") showOv(T("busted"), T("caught") + (nb ? "<br><b style='color:#ffd84f'>" + T("newbest") + "</b>" : ""), `<div class="pill"><small>${T("score")}</small>${d} ${T("m")}</div><div class="pill"><small>${T("coins")}</small><span class="coin"></span>+${coinsGot}</div><div class="pill"><small>${T("best")}</small>${best} ${T("m")}</div>`, T("again")); }, 1500);
  }
  $("go").addEventListener("click", start);
  function frame(ts) {
    requestAnimationFrame(frame); if (!lastT) { lastT = ts; return; }
    let dt = (ts - lastT) / 1000; lastT = ts; if (dt > 0.1) dt = 0.1; const ms = dt * 1000; avgDt = avgDt * 0.93 + ms * 0.07;
    if (!paused && ms > 26) slowN++; else if (slowN > 0) slowN -= 0.25;
    if (slowN > 28 && qual < 3) { qual++; slowN = 0; budgetK = Math.max(0.4, budgetK * 0.78); FAR = Math.max(140, FAR - 30); resize(); }
    if (!paused) update(dt); render();
  }
  addEventListener("resize", resize); addEventListener("orientationchange", () => setTimeout(resize, 200));
  resize(); reset(); coinTexs(); menu(); requestAnimationFrame(frame);
  window.ZR3D = { step: (dt) => update(dt), render, get state() { return state; }, get pos() { return pz; }, start, setQual: (q) => { qual = q; }, warp(p) { pz = p; resetCity(p); objs = []; nextSpawn = p + 40; ensureCity(p, 99); god = true; }, get coins() { return coinsGot; }, set lane(v) { lane = v; }, stats() { return { chunks: CHUNKS.size, objs: objs.length, qual, DPR }; } };
})();
