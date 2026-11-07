/* model/update.js — Per-frame simulation step. */
"use strict";
/* ---------- update ---------- */
function landed(v) {
  landT = 1;
  camDip = Math.min(0.35, v * 0.025);
  if (v > 7) shakeT = Math.max(shakeT, 0.08);
  dust(v > 7 ? 10 : 5);
  if (trick) {
    trick = false;
    flipT = 0;
    S.flip++;
    LT.flips++;
    bonus += 60 * mult;
    chain += 2;
    chainT = 1.5;
    energy = Math.min(100, energy + 20);
    floatText(T("style") + " +" + 60 * mult, "#9ffcff");
    burst(px, 0.6, pz, 16, "#9ffcff", 5);
    sfx.land();
    checkAch();
  }
  air2 = true;
  flipT = 0;
}
const DASHC = ["#53f7ff", "#ffe27a", "#ff4fd8"];
let lastMetro = 0,
  forkMul = 1,
  lastFork = false,
  forkWarned = false;
function update(dt) {
  if (hitStop > 0) {
    hitStop -= dt;
    return;
  }
  if (state === "play") {
    forkMul = lerp(forkMul, forkAt(pz) ? (px > 1.1 ? 1.25 : px < -1.1 ? 0.8 : 1) : 1, Math.min(1, dt * 4));
    const vEff =
      forkMul *
      (1 + 0.22 * rushK) *
      (speed +
      (turbo > 0 ? 12 : 0) +
      (padB > 0 ? 7 : 0) +
      (dash > 0 ? 16 : 0) +
        (scoot > 0 ? 2 : 0));
    speed = Math.min(34, speed + dt * 0.22);
    pz += vEff * dt;
    S.dist = pz - startZ;
    runPh += dt * (6.2 + vEff * 0.19);
    px += (LX[lane] - px) * Math.min(1, dt * 13);
    tilt = lerp(
      tilt,
      clamp((LX[lane] - px) * 0.18, -0.3, 0.3),
      Math.min(1, dt * 12),
    );
    camX += (px * 0.7 - camX) * Math.min(1, dt * 6);
    if (dash > 0) {
      dash -= dt;
      if (sparks.length < 70)
        burst(
          px + rnd(-0.3, 0.3),
          py + rnd(0.2, 1.6),
          pz - 0.5,
          2,
          DASHC[(Math.random() * 3) | 0],
          1.2,
        );
    }
    if (scoot > 0) {
      scoot -= dt;
      if (scoot <= 0) {
        scoot = 0;
        invul = Math.max(invul, 0.8);
        floatText(T("scootEnd"), "#2ee6c8");
      }
    }
    energy = Math.min(100, energy + dt * 2.5);
    if (landT > 0) landT = Math.max(0, landT - dt * 5);
    if (camDip !== 0)
      camDip =
        camDip > 0
          ? Math.max(0, camDip - dt * 2.2)
          : Math.min(0, camDip + dt * 2.2);
    fovK = lerp(fovK, dash > 0 ? 1 : 0, Math.min(1, dt * 9));
    slowK = lerp(slowK, slow > 0 ? 1 : 0, Math.min(1, dt * 5));
    camRoll = lerp(
      camRoll,
      clamp((LX[lane] - px) * 0.014, -0.05, 0.05),
      Math.min(1, dt * 8),
    );
    {
      const th = themeAt(pz);
      if (th !== lastTheme) {
        lastTheme = th;
        if (pz > 50) {
          bonus += 150;
          floatText(THEMES[th].name.toUpperCase() + "  +150", "#ffe27a");
          sfx.zumary();
          camDip = -0.2;
        }
      }
    }
    {
      const sc = secAt(pz + 4);
      if (sc !== lastMetro) {
        const prev = lastMetro;
        lastMetro = sc;
        if (pz > 50 && sc) {
          floatText(SEC_NAME[sc], "#7fe6ff");
          sfx.zumary();
        } else if (pz > 50 && prev) {
          bonus += 100;
          floatText(SEC_NAME[prev] + " +100", "#ffe27a");
        }
      }
    }
    {
      const inF = forkAt(pz + 2),
        aF = forkAhead(pz);
      if (inF !== lastFork) {
        lastFork = inF;
        if (pz > 50 && !inF) {
          bonus += 50;
          floatText(px > 1.1 ? "TEZ YO'L +50" : px < -1.1 ? "TANGA YO'LI +50" : "YO'L +50", "#ffe27a");
        }
      }
      if (aF && !inF && aF[0] - pz < 95 && aF[0] - pz > 85 && !forkWarned) {
        forkWarned = true;
        floatText("CHORRAHA: ⇦ TEZ  |  TANGA ⇨", "#ff9a3c");
      }
      if (!aF || aF[0] - pz > 96) forkWarned = false;
    }
    jetK = lerp(jetK, jet > 0 ? 1 : 0, Math.min(1, dt * 3));
    wingK = lerp(
      wingK,
      py > floorY + 0.12 || dash > 0 || jet > 0 ? 1 : 0.15,
      Math.min(1, dt * 10),
    );
    if (flipT > 0) {
      flipT += dt / 0.55;
      if (flipT >= 1) flipT = 0.999;
    }
    if (mag > 0) mag -= dt;
    if (shield > 0) shield -= dt;
    if (turbo > 0) turbo -= dt;
    if (dbl > 0) dbl -= dt;
    if (padB > 0) padB -= dt;
    if (jet > 0) {
      jet -= dt;
      if (jet <= 0) {
        invul = Math.max(invul, 1.6);
        vy = 0;
      }
    }
    if (chainT > 0) {
      chainT -= dt;
      if (chainT <= 0) {
        chain = 0;
        mult = 1;
      }
    }
    for (const o of objs) {
      if (o.vz) o.z += o.vz * dt;
      if (o.k === "cart") {
        o.x += o.vx * dt;
        if (o.x > 3.2 || o.x < -3.2) o.vx = -o.vx;
      }
    }
    floorY = 0;
    for (const o of objs)
      if (
        o.k === "ramp" &&
        pz >= o.z &&
        pz <= o.z + o.len &&
        Math.abs(o.x - px) < 1.05
      )
        floorY = Math.max(floorY, (1.4 * (pz - o.z)) / o.len);
    if (jet > 0) {
      py += (3.7 - py) * Math.min(1, dt * 4);
      vy = 0;
    } else {
      vy -= 28 * dt;
      py += vy * dt;
      if (py <= floorY) {
        if (vy < -3) landed(-vy);
        py = floorY;
        if (vy < 0) vy = 0;
      }
    }
    if (lastFloor > 0.3 && floorY === 0 && jet <= 0 && vy <= 0.01 && py > 0.9) {
      vy = 10.5;
      S.ramp++;
      sfx.jump();
      burst(px, py, pz, 8, "#ffd84f", 3);
    }
    lastFloor = floorY;
    if (slideT > 0) slideT -= dt;
    if (invul > 0) invul -= dt;
    if (hitT > 0) {
      hitT -= dt;
      if (hitT <= 0) hits = 0;
    }
    if (shakeT > 0) shakeT -= dt;
    if (stumbleT > 0) stumbleT -= dt;
    courUpdate(dt);
    if (storyCard.t > 0) storyCard.t -= dt;
    evUpdate();
    rushK = lerp(rushK, RUNEV.on && RUNEV.cur === "rush" ? 1 : 0, Math.min(1, dt * 2.5));
    nightK = lerp(nightK, RUNEV.on && RUNEV.cur === "night" ? 1 : 0, Math.min(1, dt * 1.2));
    gap = lerp(gap, hits > 0 ? 4.4 : 11 - 5.5 * clamp((heat - 45) / 55, 0, 1), Math.min(1, dt * 1.6));
    while (nextSpawn < pz + 150) spawn();
    if (!heli && pz > nextHeli) {
      heli = { t: 0, dur: 11, ph: Math.random() * 6, x: 0 };
      nextHeli = pz + rnd(1200, 1800);
      floatText(T("heli"), "#ff6b84");
      sfx.heli();
    }
    if (heli) {
      heli.t += dt;
      heli.x = Math.sin(heli.t * (1.5 + heli.t * 0.06) + heli.ph) * 3.4;
      const inb = Math.abs(px - heli.x) < 1.25 && py < 1.2;
      lit = inb ? lit + dt : Math.max(0, lit - dt * 2);
      if (lit > 0.55 && jet <= 0) {
        lit = 0;
        hurt(null);
      }
      if (heli && heli.t > heli.dur) {
        heli = null;
        lit = 0;
        bonus += 100;
        floatText(T("heliEnd"), "#7ffcb0");
      }
    }
    const top = py + (slideT > 0 && py < floorY + 0.1 ? 0.7 : 1.62),
      pad = 0.45;
    for (const o of objs) {
      if (o.dead || o.got) continue;
      const k = o.k;
      if (k === "coin") {
        if (mag > 0) {
          const dzz = o.z - pz;
          if (dzz > -1.5 && dzz < 10 && Math.abs(o.x - px) < 5.5) {
            const f = Math.min(1, dt * 8);
            o.x += (px - o.x) * f;
            o.y += (py + 1.0 - o.y) * f;
            o.z += (pz + 0.5 - o.z) * f * (dzz > 0 ? 1 : 0.5);
          }
        }
        if (
          jet > 0
            ? Math.abs(o.z - pz) < 1.4 &&
              Math.abs(o.x - px) < 1.6 &&
              Math.abs(o.y - py) < 1.6
            : Math.abs(o.z - pz) < 1.0 &&
              Math.abs(o.x - px) < 0.9 &&
              o.y > py - 0.25 &&
              o.y < top + 0.35
        )
          pickCoin(o);
        continue;
      }
      if (k === "pow" || k === "let") {
        if (
          Math.abs(o.z - pz) < 1.2 &&
          Math.abs(o.x - px) < 1.0 &&
          o.y > py - 0.4 &&
          o.y < top + 0.5
        ) {
          o.got = true;
          if (k === "pow") givePow(o.t);
          else pickLetter(o);
        }
        continue;
      }
      if (k === "pkg" || k === "drop") {
        if (
          Math.abs(o.z - pz) < 1.3 &&
          Math.abs(o.x - px) < (k === "drop" ? 1.3 : 1.0) &&
          (k === "drop" || (o.y > py - 0.4 && o.y < top + 0.5))
        )
          courTouch(o);
        continue;
      }
      if (k === "pad") {
        if (
          o.z < pz + 0.5 &&
          o.z + o.len > pz - 0.5 &&
          Math.abs(o.x - px) < 1.0 &&
          py < 0.5 &&
          padB <= 0
        ) {
          padB = 2.2;
          sfx.pad();
          burst(px, 0.4, pz, 12, "#53f7ff", 4);
          floatText("BOOST", "#53f7ff");
        }
        continue;
      }
      if (k === "ramp") continue;
      const z1 = o.z + o.len,
        over = o.z < pz + pad && z1 > pz - pad;
      if (over) {
        const dx = Math.abs(o.x - px);
        if (o.md === undefined || dx < o.md) o.md = dx;
        if (collide(o, dx, top)) {
          o.hit = true;
          hurt(o);
        }
      } else if (!o.passed && z1 < pz - pad) {
        o.passed = true;
        if (
          !o.hit &&
          BLOCK[k] &&
          o.md !== undefined &&
          o.md >= 0.95 &&
          o.md < 1.8
        )
          closeCall();
      }
    }
    /* in-place compaction (no new array every frame) */
    let w = 0;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (!o.got && !o.dead && o.z + (o.len || 0) > pz - 15) objs[w++] = o;
    }
    objs.length = w;
  } else if (state === "over") {
    bustT += dt;
    px += (LX[lane] - px) * Math.min(1, dt * 10);
    gap = lerp(gap, 2.2, Math.min(1, dt * 4));
    runPh += dt * 3;
    vy -= 28 * dt;
    py = Math.max(0, py + vy * dt);
    if (shakeT > 0) shakeT -= dt;
  } else {
    runPh += dt * 6;
    camX *= 0.9;
    pz += 4 * dt;
  }
  if (coinHud > 0) coinHud -= dt;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.l -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.vy -= 9 * dt;
    if (s.l <= 0) {
      /* swap-remove + recycle: no splice shifting, no garbage */
      sparks[i] = sparks[sparks.length - 1];
      sparks.pop();
      SPARK_POOL.push(s);
    }
  }
  for (let i = floaties.length - 1; i >= 0; i--) {
    floaties[i].l -= dt;
    if (floaties[i].l <= 0) floaties.splice(i, 1);
  }
  ensureCity(pz, 3.5);
}
