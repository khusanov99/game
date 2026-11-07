/* view/warmup.js — Builds the lazily created meshes (items, customers, bag label, sections, plazas, metro stations) ahead of time, one per frame,
   so the first time they appear on screen there is no hitch. Nothing visible changes. */
"use strict";
let WARM = null,
  warmI = 0,
  warmLast = 0;
function warmInit() {
  WARM = [() => PKGM || courBuild(), () => bagLabel()];
  for (let i = 0; i < CUST3.length; i++) WARM.push(() => custMesh(i));
  for (let i = 0; i < ITEMB.length; i++) WARM.push(() => itemMesh(i));
  for (const t of [2, 3, 4]) WARM.push(() => SECM[t] || secBuild(t));
  WARM.push(() => SECM[1] || secBuild(1));
  for (let t = 0; t < THEMES.length; t++) WARM.push(() => SECM[10 + t] || (SECM[10 + t] = plazaBuild(t)));
}
/* metro stations: only when a metro line is within the next 1.5 km */
function metroSoon() {
  const LL = LAP_CH * CH;
  for (let l = Math.floor(pz / LL); l <= Math.floor((pz + 1500) / LL); l++) {
    const ms = metStart(l) * CH;
    if (ms - pz < 1500 && ms + MET_CH * CH > pz) return true;
  }
  return false;
}
function warmTick(dt) {
  if (!WARM) warmInit();
  const now = performance.now();
  /* on the menu screen: a job every frame; while running: at most one per 250 ms, and never on a slow frame */
  if (state === "play" && (dt > 0.03 || now - warmLast < 250)) return;
  if (state === "over") return;
  if (warmI < WARM.length) {
    warmLast = now;
    try {
      WARM[warmI++]();
    } catch (e) {}
    return;
  }
  if (state === "play" && metroSoon()) {
    for (let i = 0; i < STN.length; i++)
      if (!STNM[i]) {
        warmLast = now;
        try {
          stationBuild(i);
        } catch (e) {}
        return;
      }
  }
}
