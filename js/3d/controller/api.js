/* controller/api.js — Public ZR3D object used by automated tests. */
"use strict";
window.ZR3D = {
  step: (dt) => update(dt), set gap(v) { gap = v; }, get showT() { return showT; }, set showT(v) { showT = v; }, get gap() { return gap; }, render, pause: togglePause, dash: dashNow, get paused() { return paused; }, get energy() { return energy; }, set energy(v) { energy = v; }, get info() { return { dash, scoot, slow, air2, trick, flipT, LT, AU }; }, get state() { return state; }, get pos() { return pz; }, start, setQual: (q) => { qual = q; }, get coins() { return coinsGot; }, set lane(v) { lane = v; },
  warp(p) { pz = p; resetCity(p); objs = []; nextSpawn = p + 40; ensureCity(p, 1e9); god = true; }, give: (t) => givePow(t), jumpNow: jump, slideNow: slide, spawnAt: (fn) => fn,
  stats() { return { chunks: CHUNKS.size, objs: objs.length, qual, DPR, DC, resScale, mult, mag, shield, turbo, jet, dbl, S }; }, objsAt() { return objs.map((o) => o.k); },
  add(k, l, dz, a) { const z = pz + dz; ({ ramp, pad, pit, cone, low, gate, cart, bus: (ll, zz) => bus(ll, zz, 12), car: (ll, zz) => car(ll, zz, 8), laser: (ll, zz) => laser(zz, a), pow: (ll, zz) => powUp(ll, zz, a), letter: (ll, zz) => letterUp(ll, zz, a), coinArc: (ll, zz) => arc(ll, zz, 8, 2, 1.2) })[k](l, z); },
};
