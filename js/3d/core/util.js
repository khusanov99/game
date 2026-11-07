/* core/util.js — Shared helpers: DOM lookup, persistent store, math shorthands. */
"use strict";
const $ = (id) => document.getElementById(id);
const cv = $("c"),
  hudc = $("hud"),
  hx = hudc.getContext("2d");
const COARSE = matchMedia("(pointer:coarse)").matches;
/* device class: drives the pixel budget, the starting quality tier and the texture caps */
const DEV = (() => {
  const ua = navigator.userAgent || "",
    d = {
      ios:
        /iP(hone|ad|od)/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      android: /Android/i.test(ua),
      mem: navigator.deviceMemory || 4,
      cores: navigator.hardwareConcurrency || 4,
    };
  d.low = (d.android && (d.mem <= 3 || d.cores <= 4)) || d.mem <= 2;
  return d;
})();
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  rnd = (a, b) => a + Math.random() * (b - a),
  TAU = Math.PI * 2,
  lerp = (a, b, t) => a + (b - a) * t;
const pick = (a) => a[(Math.random() * a.length) | 0];
