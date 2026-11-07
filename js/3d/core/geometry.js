/* core/geometry.js — Interleaved vertex builder and cached primitive meshes. */
"use strict";
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
