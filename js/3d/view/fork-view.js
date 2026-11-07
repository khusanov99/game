/* view/fork-view.js — Fork visuals: gantry with two signs, median wall, coloured lane strips. */
"use strict";
let FORKM = null;
const FORKWALL = {};
function signTex(txt, c1, c2) {
  const c = mkc(256, 96),
    g = c.getContext("2d");
  g.fillStyle = c1;
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#fff";
  g.lineWidth = 6;
  g.strokeRect(4, 4, 248, 88);
  g.fillStyle = c2;
  g.font = "bold 46px system-ui,sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(txt, 128, 50);
  return texFrom(c);
}
function forkBuild() {
  const g = new B(),
    con = [0.45, 0.46, 0.5];
  for (const sx of [-4.2, 4.2]) g.box(sx, 3, 0, 0.35, 6, 0.35, con);
  g.box(0, 6.1, 0, 9.2, 0.3, 0.4, con);
  const sg = (txt, c1, c2) => {
    const b = new B();
    b.box(0, 0, 0, 3.6, 1.4, 0.15, [1, 1, 1], {
      uv: { nz: [0, 0, 1, 1], pz: [0.02, 0.02, 0.03, 0.03] },
    });
    return { m: b.mesh(), tex: signTex(txt, c1, c2) };
  };
  FORKM = {
    post: g.mesh(),
    fast: sg("⇦ TEZ", "#b3121e", "#fff"),
    coin: sg("TANGA ⇨", "#e8a812", "#3a2400"),
  };
  const s = new B();
  s.box(0, 0.02, 90, 1.7, 0.04, 180, [1, 1, 1]);
  FORKM.strip = s.mesh();
}
function forkWall(len) {
  const k = Math.round(len);
  if (FORKWALL[k]) return FORKWALL[k];
  const b = new B();
  b.box(0, 1.5, k / 2, 1.9, 3, k, [0.55, 0.55, 0.58]);
  b.box(0, 3.05, k / 2, 2.1, 0.12, k, [1, 0.8, 0.1]);
  for (let z = 0; z < k; z += 4) b.box(0, 0.5, z, 2.0, 0.5, 1.4, [0.95, 0.75, 0.1]);
  return (FORKWALL[k] = b.mesh());
}
function drawFork() {
  const f = forkAhead(pz);
  if (!f || f[1] < pz - 20) return;
  if (!FORKM) forkBuild();
  const z0 = f[0];
  draw(FORKM.post, Tp(0, 0, z0 - 40), null, { emis: 0.2 });
  draw(FORKM.fast.m, Tp(LX[0], 5.2, z0 - 40.2), FORKM.fast.tex, { emis: 0.9 });
  draw(FORKM.coin.m, Tp(LX[2], 5.2, z0 - 40.2), FORKM.coin.tex, { emis: 0.9 });
  draw(FORKM.strip, Tp(LX[0], 0.01, z0), null, { tint: [1, 0.15, 0.2], emis: 1, alpha: 0.5 });
  draw(FORKM.strip, Tp(LX[2], 0.01, z0), null, { tint: [1, 0.8, 0.15], emis: 1, alpha: 0.5 });
}
/* soft glow around street lamps — shown in rain, fog and snow */
const HALOT = (() => {
  const c = mkc(64, 64),
    g = c.getContext("2d"),
    r = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return texFrom(c);
})();
function drawHalos() {
  const wk = clamp(rainA * 0.8 + fogA * 1.0 + snowA * 0.7, 0, 1);
  if (wk < 0.06) return;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.depthMask(false);
  for (const ch of CHUNKS.values())
    if (ch.haloM && ch.zB >= pz - 10 && ch.zA < pz + FAR)
      draw(ch.haloM, IDM, HALOT, { emis: 1, alpha: 0.5 * wk });
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
