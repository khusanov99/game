/* core/draw.js — draw() — the single draw call wrapper — and the canvas / resolution handling. */
"use strict";
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
  resetMatCache();
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
/* last material uniforms sent to the GPU: unchanged values are not sent again (thousands of redundant uniform calls per frame on some scenes) */
let L_t0 = -1, L_t1 = -1, L_t2 = -1, L_e = -1, L_s = -1, L_r = -1, L_a = -1, L_c = -1, L_r0 = -1, L_r1 = -1, L_r2 = -1;
function resetMatCache() {
  L_t0 = L_e = L_s = L_r = L_a = L_c = L_r0 = -1;
}
function draw(m, M, tex, o) {
  o = o || MAT0;
  const u = MAIN.u;
  gl.uniformMatrix4fv(u.uM, false, M || IDM);
  const t = o.tint || MAT0.tint,
    rc = o.rimCol || MAT0.rimCol,
    em = o.emis || 0,
    sp = o.spec || 0,
    rm = o.rim || 0,
    al = o.alpha === undefined ? 1 : o.alpha,
    ct = o.cut || 0;
  if (t[0] !== L_t0 || t[1] !== L_t1 || t[2] !== L_t2) {
    gl.uniform3fv(u.uTint, t);
    L_t0 = t[0];
    L_t1 = t[1];
    L_t2 = t[2];
  }
  if (em !== L_e) gl.uniform1f(u.uEmis, (L_e = em));
  if (sp !== L_s) gl.uniform1f(u.uSpec, (L_s = sp));
  if (rm !== L_r) gl.uniform1f(u.uRim, (L_r = rm));
  if (rc[0] !== L_r0 || rc[1] !== L_r1 || rc[2] !== L_r2) {
    gl.uniform3fv(u.uRimCol, rc);
    L_r0 = rc[0];
    L_r1 = rc[1];
    L_r2 = rc[2];
  }
  if (al !== L_a) gl.uniform1f(u.uAlpha, (L_a = al));
  if (ct !== L_c) gl.uniform1f(u.uCut, (L_c = ct));
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
/* pixel budget per device class: desktop > iPhone/iPad > Android > low-end Android */
const PIX = () =>
  (COARSE
    ? DEV.ios
      ? 1500000
      : DEV.low
        ? 600000
        : 950000
    : 1800000) * budgetK;
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
  UI = Math.max(0.8, Math.min(1.5, Math.min(W, H) / 390));
  readInsets();
  hx.setTransform(hudc.width / W, 0, 0, hudc.height / H, 0, 0);
}
let UI = 1;
function readInsets() {
  try {
    let d = document.getElementById("insProbe");
    if (!d) {
      d = document.createElement("div");
      d.id = "insProbe";
      d.style.cssText =
        "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
      document.body.appendChild(d);
    }
    const c = getComputedStyle(d);
    INS = {
      t: parseFloat(c.paddingTop) || 0,
      r: parseFloat(c.paddingRight) || 0,
      b: parseFloat(c.paddingBottom) || 0,
      l: parseFloat(c.paddingLeft) || 0,
    };
  } catch (e) {}
}
