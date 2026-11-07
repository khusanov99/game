/* core/textures.js — Procedural textures (mip-mapped) and texture helpers. */
"use strict";
/* ---------- textures ---------- */
const potUp = (n, cap) => {
  let p = 1;
  while (p < n && p < cap) p <<= 1;
  return p;
};
function texFrom(canvas, o) {
  o = o || {};
  let src = canvas;
  const cap = Math.min(o.cap || 1024, DEV.low ? 512 : 1024),
    w = potUp(canvas.width, cap),
    h = potUp(canvas.height, cap);
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
