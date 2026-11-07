/* view/character-batch.js — Batched character rendering (put/pd/flushChars) and shared character materials. */
"use strict";
/* ---------- characters ---------- */
const PM = {};                                           // part mesh cache (CPU side — characters are batched into one buffer per frame)
const part = (key, f) => PM[key] || (PM[key] = (() => { const b = new B(); f(b); return { v: new Float32Array(b.v), i: new Uint16Array(b.i), nv: b.n }; })());
const cylM = (r0, r1, h, seg = 8) => part("c" + r0 + "," + r1 + "," + h + "," + seg, (b) => b.cyl(0, -h, 0, r1, r0, h, seg, WHITE, true));    // hangs down from origin
const boxM = (w, h, d, dy = 0) => part("b" + w + "," + h + "," + d + "," + dy, (b) => b.box(0, dy, 0, w, h, d, WHITE));
const sphM = (r, sy = 1, sz = 1) => part("s" + r + "," + sy + "," + sz, (b) => b.sph(0, 0, 0, r, r * sy, r * sz, 7, 10, WHITE));
const coneM = (r, h) => part("k" + r + "," + h, (b) => b.cyl(0, 0, 0, r, 0.01, h, 6, WHITE));
const CBMAX = 16000, CB = [0, 1].map(() => {
  const vb = gl.createBuffer(), ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, CBMAX * 44, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CBMAX * 4, gl.DYNAMIC_DRAW);
  return { vb, ib, v: new Float32Array(CBMAX * 11), i: new Uint16Array(CBMAX * 2), nv: 0, ni: 0 };
});
function put(mesh, M, m) {                                // transform a part into the character batch on the CPU
  const e = m.emis > 0.6 ? 1 : 0, b = CB[e], mi = mesh.i; if (b.nv + mesh.nv > CBMAX || b.ni + mi.length > CBMAX * 2) return;
  const t = m.tint, k = e ? 1 : 1 + 0.25 * (m.emis || 0), r = t[0] * k, g = t[1] * k, bl = t[2] * k, v = mesh.v, out = b.v;
  const m0 = M[0], m1 = M[1], m2 = M[2], m4 = M[4], m5 = M[5], m6 = M[6], m8 = M[8], m9 = M[9], m10 = M[10], m12 = M[12], m13 = M[13], m14 = M[14]; let o = b.nv * 11;
  for (let q = 0, n = mesh.nv; q < n; q++) {
    const s = q * 11, x = v[s], y = v[s + 1], z = v[s + 2], nx = v[s + 3], ny = v[s + 4], nz = v[s + 5];
    out[o] = m0 * x + m4 * y + m8 * z + m12; out[o + 1] = m1 * x + m5 * y + m9 * z + m13; out[o + 2] = m2 * x + m6 * y + m10 * z + m14;
    out[o + 3] = m0 * nx + m4 * ny + m8 * nz; out[o + 4] = m1 * nx + m5 * ny + m9 * nz; out[o + 5] = m2 * nx + m6 * ny + m10 * nz;
    out[o + 6] = v[s + 6]; out[o + 7] = v[s + 7]; out[o + 8] = v[s + 8] * r; out[o + 9] = v[s + 9] * g; out[o + 10] = v[s + 10] * bl; o += 11;
  }
  const base = b.nv, ii = b.i; let p = b.ni; for (let q = 0; q < mi.length; q++) ii[p++] = mi[q] + base; b.ni = p; b.nv += mesh.nv;
}
const pd = (m, M, _t, o) => put(m, M, o);
function flushChars() {
  for (let e = 0; e < 2; e++) {
    const b = CB[e]; if (!b.ni) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.v.subarray(0, b.nv * 11)); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, b.i.subarray(0, b.ni));
    draw({ vb: b.vb, ib: b.ib, n: b.ni }, IDM, null, e ? EMIS_MAT : LIT_MAT); b.nv = 0; b.ni = 0;
  }
}
const LIT_MAT = { tint: [1, 1, 1], spec: 0.7, rim: 0.7, rimCol: [1, 0.62, 0.4] }, EMIS_MAT = { tint: [1, 1, 1], emis: 1 };
const mat = (c, extra) => Object.assign({ tint: c, spec: 0.5, rim: 0.7, rimCol: [1, 0.62, 0.4] }, extra || {});
const FLAME = { tint: [1, 0.65, 0.2], emis: 1 }, SIREN_R = { tint: [1, 0.15, 0.2], emis: 1 }, SIREN_B = { tint: [0.15, 0.3, 1], emis: 1 };
