/* core/math.js — Column-major 4x4 matrix helpers and the allocation-free matrix pool. */
"use strict";
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
