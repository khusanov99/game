/* core/gl.js — WebGL context creation and capability detection. */
"use strict";
/* ---------- WebGL ---------- */
let gl = null;
try {
  gl =
    cv.getContext("webgl", {
      /* 4x MSAA costs 40%+ of the frame time on integrated GPUs and phones: only when the player picks GRAPHICS: HIGH (applies after a reload) */
      antialias: !COARSE && store.get("zr3_gfx", "auto") === "high",
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
