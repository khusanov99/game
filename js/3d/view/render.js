/* view/render.js — Frame rendering: camera, world, characters, effects. */
"use strict";
function render() {
  PIX_I = 0;
  DC = 0;
  resizeIfNeeded();
  gl.viewport(0, 0, cv.width, cv.height);
  gl.clearColor(0.1, 0.1, 0.2, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.CULL_FACE);
  setEnvironment();
  const TH = THEMES[envTheme];
  const asp = W / H,
    boost = (turbo > 0 ? 7 : 0) + (padB > 0 ? 4 : 0),
    fy =
      (((asp < 0.8 ? 66 : asp < 1.2 ? 60 : 54) + boost) * Math.PI) / 180 +
      (speed - 15) * 0.0012 +
      fovK * 0.16 -
      slowK * 0.07,
    dist = (asp < 0.8 ? 5.3 : 6.0) + fovK * 0.9,
    h = (asp < 0.8 ? 3.1 : 3.3) - camDip - (scoot > 0 ? 0.12 : 0);
  const shk = shakeT > 0 ? shakeT : 0,
    sx = rnd(-1, 1) * shk * 0.25,
    sy = rnd(-1, 1) * shk * 0.2,
    jl = jetK * 1.9;
  let CAMv = [camX + sx, h + sy + jl, pz - dist],
    tgt = [camX * 0.55 + px * 0.2, 2.35 + jl * 0.35, pz + 8],
    fyv = fy,
    heroYaw = 0,
    show = null;
  if (state === "ready") {
    show = showShot(showT, asp);
    CAMv = show.cam;
    tgt = show.tgt;
    fyv = show.fov;
    SC = show;
  } else if (camBlend > 0 && SC) {
    const k = ease(camBlend),
      mx = (a, b) => [
        lerp(a[0], b[0], k),
        lerp(a[1], b[1], k),
        lerp(a[2], b[2], k),
      ];
    CAMv = mx(CAMv, SC.cam);
    tgt = mx(tgt, SC.tgt);
    fyv = lerp(fyv, SC.fov, k);
    heroYaw = SC.yaw * k;
  }
  CAM = CAMv;
  const P = M4.persp(fyv, asp, 0.3, 450),
    V = M4.look(CAM, tgt, [Math.sin(camRoll), Math.cos(camRoll), 0]);
  VP = M4.mul(P, V);
  FOGK = (1 / (qual >= 2 ? 120 : 160)) * (TH.fogK || 1);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(SKY.p);
  const su = SKY.u,
    c = SKY.cur;
  const f = [tgt[0] - CAM[0], tgt[1] - CAM[1], tgt[2] - CAM[2]],
    fl = Math.hypot(...f),
    F = f.map((x) => x / fl),
    R = [F[2], 0, -F[0]],
    rl = Math.hypot(...R),
    RR = R.map((x) => x / rl),
    U = [
      RR[1] * F[2] - RR[2] * F[1],
      RR[2] * F[0] - RR[0] * F[2],
      RR[0] * F[1] - RR[1] * F[0],
    ];
  gl.uniform3fv(su.uTop, c.top);
  gl.uniform3fv(su.uMid, c.mid);
  gl.uniform3fv(su.uLow, c.low);
  gl.uniform3fv(su.uSun, SUN);
  gl.uniform3fv(su.uSunCol, mulc(c.sun, 0.8));
  gl.uniform3fv(su.uF, F);
  gl.uniform3fv(su.uR, RR);
  gl.uniform3fv(su.uU, U);
  gl.uniform2f(su.uTan, Math.tan(fyv / 2) * asp, Math.tan(fyv / 2));
  gl.bindBuffer(gl.ARRAY_BUFFER, SKYQ);
  gl.enableVertexAttribArray(0);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.disableVertexAttribArray(3);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST);
  useMain();
  const z0 = Math.floor((pz - 60) / 40) * 40,
    rt = (cross) => ROADS[cross] || (ROADS[cross] = mkRoadTex(cross)),
    wet = rainA > 0.3 ? 0.9 : 0.1;
  for (let z = z0; z < pz + FAR; z += 40) {
    const M = Tp(0, 0, z);
    draw(ROADM, M, rt(Math.round(z / 40) % 5 === 0 ? 1 : 0), {
      emis: 0.1,
      tint: [1.15, 1.12, 1.1],
      spec: wet,
    });
    draw(SIDEM, M, sidewalkTex(), { emis: 0.15, tint: [1.1, 1.08, 1.05] });
  }
  for (const ch of CHUNKS.values()) {
    if (ch.zB < pz - 30 || ch.zA > pz + FAR) continue;
    for (const x of ch.meshes) draw(x.m, IDM, x.tex, x.mat || MAT0);
  }
  const ca = performance.now() / 380,
    blink = Math.floor(performance.now() / 260) % 2;
  for (const o of objs) {
    const k = o.k;
    if (k === "coin" || o.z - pz > FAR || o.z + (o.len || 0) < pz - 12)
      continue;
    if (k === "low") {
      draw(obMesh("low"), Tp(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 });
      draw(REDL, Tp(o.x - 0.7, 1.05, o.z + 0.3), null, {
        emis: blink ? 1 : 0.3,
        tint: [1, 0.2, 0.2],
      });
    } else if (k === "gate")
      draw(obMesh("gate"), Tp(o.x, 0, o.z + 0.3), STRIPE, { emis: 0.3 });
    else if (k === "cone")
      draw(obMesh("cone"), Tp(o.x, 0, o.z + 0.4), null, { emis: 0.25 });
    else if (k === "pit")
      draw(obMesh("pit"), Tp(o.x, 0, o.z), null, { emis: 0.3 });
    else if (k === "ramp")
      draw(obMesh("ramp"), Tp(o.x, 0, o.z), STRIPE, {
        emis: 0.3,
        tint: [1, 0.9, 0.6],
      });
    else if (k === "pad")
      draw(obMesh("pad"), Tp(o.x, 0, o.z), PADT, { emis: 0.9 });
    else if (k === "cart")
      draw(obMesh("cart"), Tp(o.x, 0, o.z + 0.7), null, {
        emis: 0.15,
        spec: 0.2,
      });
    else if (k === "laser") {
      draw(obMesh(o.hi ? "laserH" : "laserL"), Tp(0, 0, o.z), null, {
        emis: 0.7,
      });
    } else if (k === "car") {
      draw(obMesh("car"), Tp(o.x, 0, o.z + 2.3), null, {
        tint: o.hue,
        spec: 0.8,
        rim: 0.4,
        emis: 0.1,
      });
      draw(TAIL, Tp(o.x, 0, o.z - 0.01), null, { emis: 1 });
    } else if (k === "bus") {
      draw(busMesh(o.len), Tp(o.x, 0, o.z), null, {
        tint: o.hue,
        spec: 0.5,
        rim: 0.4,
        emis: 0.1,
      });
      draw(TAIL, Tp(o.x, 0.4, o.z - 0.01), null, { emis: 1 });
    } else if (k === "pow")
      draw(
        PICKQ,
        joint(
          Tp(o.x, o.y + Math.sin(ca * 2 + o.z) * 0.12, o.z),
          0,
          ca * 1.6,
          0,
        ),
        powTex(o.t),
        PICKMAT,
      );
    else if (k === "let")
      draw(
        PICKQ,
        joint(
          Tp(o.x, o.y + Math.sin(ca * 2 + o.z) * 0.12, o.z),
          0,
          ca * 1.6,
          0,
        ),
        letTex(o.n),
        PICKMAT,
      );
  }
  coinTexs();
  CN.length = 0;
  GM.length = 0;
  for (const o of objs)
    if (o.k === "coin" && o.z - pz < 120 && o.z > pz - 3)
      (o.gem ? GM : CN).push(o);
  drawCoins(CN, COINT, 1.0, 0, ca);
  drawCoins(GM, GEMT, 1.35, 1, ca);
  const hz = pz - gap,
    tNow = performance.now() / 1000;
  if (!show && gap < 10.5) {
    drawChaser(Tp(px * 0.7, 0, hz), runPh + 1.5, tNow);
    drawWolf(Tp(px * 0.7 - 1.5, 0, hz - 0.2), runPh + 0.7, tNow);
  }
  if (heli) {
    const hxp = heli.x * 0.4,
      hzp = pz + 36,
      H0 = Tp(hxp, 17, hzp);
    put(boxM(2.2, 1.5, 3.6), H0, HELI_A);
    put(boxM(0.3, 0.3, 4), joint(H0, 0, 0.3, -3.6, 0), HELI_A);
    put(boxM(4.6, 0.06, 0.3), joint(H0, 0, 1.0, 0, 0, tNow * 40), HELI_B);
    put(
      boxM(0.3, 0.06, 1.2),
      joint(H0, 0.2, 0.3, -5.4, 0, 0, tNow * 50),
      HELI_B,
    );
    put(sphM(0.25), joint(H0, 0, -0.9, 1.2, 0), blink ? SIREN_R : SIREN_B);
    put(boxM(0.6, 0.4, 0.5), joint(H0, 0, -0.9, 1.7, 0), HELI_L);
  }
  const air = py > floorY + 0.12,
    over = state === "over",
    root = joint(Tp(px, py, pz), 0, 0, 0, 0, heroYaw, -tilt * 0.9),
    flick = invul > 0 && !over && Math.floor(performance.now() / 70) % 2;
  const fa = flipT > 0 ? flipT * flipT * (3 - 2 * flipT) * TAU : 0;
  if (show) {
    const K0 = heroMats(look());
    drawStage(K0, showT);
    drawHunters(showT, show.u);
    drawHero(root, look(), {
      idle: true,
      wave: show.wave,
      yaw: show.head,
      ph: 0,
      air: false,
      slide: false,
      hit: false,
      boost: false,
      dash: 0,
      scoot: false,
      fx: 0,
      fy: 0,
      land: 0,
      wing: show.wing,
      t: showT,
      sp: 0.3,
      tilt: 0,
    });
  } else if (!flick)
    drawHero(root, look(), {
      ph: runPh,
      air: air || jet > 0,
      slide: slideT > 0 && !air,
      hit: over || stumbleT > 0.25,
      boost: turbo > 0 || padB > 0 || jet > 0,
      dash,
      scoot: scoot > 0,
      fx: flipSpin ? 0 : fa,
      fy: flipSpin ? fa : 0,
      land: landT,
      wing: wingK,
      t: tNow,
      sp: clamp((speed - 15) / 19, 0, 1) + (dash > 0 ? 0.6 : 0),
      tilt,
    });
  flushChars();
  gl.enable(gl.BLEND);
  gl.depthMask(false);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  draw(SHADOWM, Tp(px, 0, pz), BLOB, {
    alpha: 0.7 - Math.min(0.5, (py - floorY) * 0.12),
    tint: [0, 0, 0],
  });
  if (!show && gap < 10.5)
    draw(SHADOWM, Tp(px * 0.7, 0, hz), BLOB, { alpha: 0.6, tint: [0, 0, 0] });
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  if (heli)
    (draw(LIGHTQ, joint(Tp(heli.x, 0, pz + 15), 0, 0, 0), LIGHTT, {
      alpha: 0.85,
      emis: 1,
      tint: [1.6 * 1.0, 1.4, 1.0],
      cut: 0,
    }),
      draw(LIGHTQ, joint(Tp(heli.x, 0, pz + 15), 0, 0, 0), LIGHTT, {
        alpha: 0.5,
        emis: 1,
        tint: [1, 1, 0.9],
      }));
  if (shield > 0 && (shield > 3 || blink))
    draw(SPHM_B, Tp(px, py, pz), null, {
      alpha: 0.28,
      emis: 1,
      rim: 1.2,
      rimCol: [0.5, 0.9, 1],
      tint: [0.4, 0.8, 1],
    });
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  drawHUD(VP);
}
const PICKMAT = { emis: 1, cut: 0.15 },
  HELI_A = { tint: [0.16, 0.2, 0.3], spec: 0.8, rim: 0.6, emis: 0.1 },
  HELI_B = { tint: [0.5, 0.5, 0.55], emis: 0 },
  HELI_L = { tint: [1, 0.95, 0.8], emis: 1 };
const resizeIfNeeded = () => {
  if (
    cv.width !== Math.round(Math.max(240, innerWidth) * DPR) ||
    cv.height !== Math.round(Math.max(240, innerHeight) * DPR)
  )
    resize();
};
function proj(x, y, z, vp) {
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (w <= 0.01) return null;
  return [
    (((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) * W,
    (1 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 - 0.5) * H,
  ];
}
