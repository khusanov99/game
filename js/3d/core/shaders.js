/* core/shaders.js — GLSL programs (MAIN, SKY) and uniform lookup. */
"use strict";
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
