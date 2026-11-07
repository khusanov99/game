/* core/gl.js — WebGL context creation and capability detection. */
"use strict";
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
  location.replace("./index.html");
  throw new Error("WebGL unavailable: redirecting to the main game");
}
const ANISO =
  gl.getExtension("EXT_texture_filter_anisotropic") ||
  gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
cv.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
});
cv.addEventListener("webglcontextrestored", () => location.reload());
