/* controller/analytics.js — Anonymous play statistics.
   - No personal data: a random id made on this device, no name, no email, no location; only gameplay numbers and a device class.
   - Everything is also counted ON THIS DEVICE (open ?stats=1 to read it).
   - To collect statistics from all players, put a collector address in ANALYTICS_URL (see tools/analytics-worker.js). Empty = nothing is sent.
   - The player can switch it off in Settings (zr3d_ana = false). */
"use strict";
const ANALYTICS_URL = "";
let anaOn = store.get("zr3d_ana", true),
  anaQ = [],
  anaId = store.get("zr3d_aid", null),
  anaS = store.get("zr3d_stats", null);
if (!anaId) store.set("zr3d_aid", (anaId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)));
if (!anaS || typeof anaS !== "object")
  anaS = { first: Date.now(), opens: 0, starts: 0, runs: 0, secs: 0, best: 0, dist: [0, 0, 0, 0, 0], tut: 0, shop: 0, buys: 0, fpsSum: 0, fpsN: 0, days: {} };
/* what kind of device this is: OS, model (iPhone by screen size, Android by the browser's model string), browser, where the visit came from */
const anaDev = (() => {
  const ua = navigator.userAgent || "",
    sw = Math.min(screen.width, screen.height),
    sh = Math.max(screen.width, screen.height),
    dpr = Math.round(devicePixelRatio || 1),
    IPH = { "320x568": "iPhone 5/SE1", "375x667": "iPhone 6/7/8/SE2/SE3", "414x736": "iPhone 6+/7+/8+", "375x812": "iPhone X/XS/11 Pro/12-13 mini", "390x844": "iPhone 12/13/14", "393x852": "iPhone 14 Pro/15/15 Pro/16", "402x874": "iPhone 16 Pro", "428x926": "iPhone 12-13 Pro Max/14 Plus", "430x932": "iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus", "440x956": "iPhone 16 Pro Max" };
  let os = DEV.ios ? (/iPad|Macintosh/.test(ua) ? "ipad" : "iphone") : DEV.android ? "android" : /Windows/.test(ua) ? "windows" : /Mac/.test(ua) ? "mac" : /Linux/.test(ua) ? "linux" : "other",
    model = "";
  if (os === "iphone") model = IPH[sw + "x" + sh] ? IPH[sw + "x" + sh] : "iPhone " + sw + "x" + sh + "@" + dpr + "x";
  else if (os === "ipad") model = "iPad " + sw + "x" + sh;
  else if (os === "android") {
    const m = ua.match(/;\s*([^;)]+?)\s+Build/) || ua.match(/Android[^;]*;\s*([^;)]+)\)/);
    model = m && m[1] !== "K" ? m[1] : "";
  }
  const br = /Instagram/i.test(ua) ? "Instagram app" : /FBAN|FBAV/.test(ua) ? "Facebook app" : /Telegram/i.test(ua) ? "Telegram app" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /EdgA?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "other";
  let src = "";
  try {
    const q = new URLSearchParams(location.search);
    src = q.get("src") || q.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "direct");
  } catch (e) {}
  const o = { os, model, br, src: String(src).slice(0, 40), mem: DEV.mem, cores: DEV.cores, dpr, lg: LG, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || "").slice(0, 40), nl: (navigator.language || "").slice(0, 8) };
  try {
    navigator.userAgentData &&
      navigator.userAgentData.getHighEntropyValues(["model"]).then((v) => {
        if (v.model) o.model = v.model;
      });
  } catch (e) {}
  return o;
})();
const DIST_B = [200, 500, 1000, 2000]; // run-length buckets: <200, <500, <1000, <2000, 2000+
function track(ev, d) {
  const t = Date.now(),
    day = new Date(t).toISOString().slice(0, 10);
  anaS.days[day] = 1;
  if (ev === "open") anaS.opens++;
  else if (ev === "start") anaS.starts++;
  else if (ev === "tutorial") anaS.tut++;
  else if (ev === "shop") anaS.shop++;
  else if (ev === "buy") anaS.buys++;
  else if (ev === "run") {
    anaS.runs++;
    anaS.secs += d.sec || 0;
    anaS.best = Math.max(anaS.best, d.m || 0);
    let b = DIST_B.findIndex((x) => d.m < x);
    anaS.dist[b < 0 ? 4 : b]++;
    if (d.fps) {
      anaS.fpsSum += d.fps;
      anaS.fpsN++;
    }
  }
  store.set("zr3d_stats", anaS);
  if (!anaOn || !ANALYTICS_URL) return;
  anaQ.push({ ev, t, ...d });
  if (anaQ.length >= 20 || ev === "run") anaFlush();
}
function anaFlush() {
  if (!anaQ.length || !ANALYTICS_URL) return;
  const body = JSON.stringify({
    id: anaId,
    dev: { ...anaDev, low: !!DEV.low, soft: !!SOFTGL, gpu: String(typeof GPUNAME === "string" ? GPUNAME : "").slice(0, 60), w: innerWidth, h: innerHeight },
    ev: anaQ.splice(0),
  });
  try {
    if (!(navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_URL, body))) fetch(ANALYTICS_URL, { method: "POST", body, keepalive: true });
  } catch (e) {}
}
addEventListener("visibilitychange", () => document.hidden && anaFlush());
addEventListener("pagehide", anaFlush);
track("open", {});
/* statistics page: city3d.html?stats=1&key=SECRET  (all players, from the collector)  +  this device's own counters */
if (/[?&]stats\b/.test(location.search)) {
  const q = new URLSearchParams(location.search);
  if (q.get("key")) store.set("zr3d_statkey", q.get("key"));
  const key = store.get("zr3d_statkey", ""),
    s = anaS,
    avg = s.fpsN ? Math.round(s.fpsSum / s.fpsN) : "-",
    tot = s.dist.reduce((a, b) => a + b, 0) || 1,
    names = ["<200 m", "200–500 m", "500–1000 m", "1000–2000 m", "2000+ m"],
    d = document.createElement("div"),
    row = (a, b) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1)"><span style="min-width:0;overflow-wrap:anywhere">${a}</span><b>${b}</b></div>`,
    head = (t) => `<div style="margin:18px 0 6px;color:#7fe6ff;font:800 11px Orbitron,sans-serif;letter-spacing:1.5px">${t}</div>`,
    esc = (x) => String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]),
    list = (a) => (a && a.length ? a.map((r) => row(esc(r.k || "?"), r.n)).join("") : row("—", ""));
  d.style.cssText = "position:fixed;inset:0;z-index:99;overflow:auto;background:#0b0d22;color:#e6e9ff;font:600 13px Inter,sans-serif;padding:20px max(16px,env(safe-area-inset-right)) 40px max(16px,env(safe-area-inset-left))";
  const local = () =>
    head("THIS DEVICE ONLY") +
    [["Opens", s.opens], ["Starts", s.starts], ["Runs finished", s.runs], ["Days played", Object.keys(s.days).length], ["Play time", Math.round(s.secs / 60) + " min"], ["Best run", s.best + " m"], ["Avg FPS", avg], ["Tutorial done", s.tut], ["Shop opened", s.shop], ["Purchases", s.buys]].map(([a, b]) => row(a, b)).join("") +
    head("WHERE RUNS END (this device)") +
    s.dist.map((n, i) => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="width:92px">${names[i]}</span><div style="flex:1;height:10px;background:rgba(255,255,255,.1);border-radius:5px;overflow:hidden"><div style="width:${Math.round((n / tot) * 100)}%;height:100%;background:#7fe6ff"></div></div><span>${n}</span></div>`).join("");
  const global = (r) =>
    head("DEVICES (all players)") +
    row("Total devices ever", r.total) + row("Active today", r.dau) + row("Active last 7 days", r.wau) + row("Active last 30 days", r.mau) + row("New today", r.newToday) +
    head("RETURNING PLAYERS") + row("Came back next day (D1)", r.d1) + row("Came back within 7 days (D7)", r.d7) +
    head("FUNNEL (devices)") + row("Opened", r.f.open) + row("Started a run", r.f.start) + row("Finished a run", r.f.run) + row("Finished the tutorial", r.f.tutorial) + row("Opened the shop", r.f.shop) + row("Bought something", r.f.buy) +
    head("BY SYSTEM") + list(r.os) +
    head("PHONE / DEVICE MODEL") + list(r.model) +
    head("BROWSER") + list(r.br) +
    head("COUNTRY") + list(r.country) +
    head("WHERE THEY CAME FROM (src / referrer)") + list(r.src) +
    head("LANGUAGE") + list(r.lg) +
    head("RUNS") + row("Runs", r.runs.n) + row("Average run", Math.round(r.runs.m) + " m") + row("Average play time", Math.round(r.runs.sec) + " s") + row("Average FPS", Math.round(r.runs.fps)) +
    head("AVERAGE FPS BY DEVICE") + list(r.fpsBy) +
    head("WHERE RUNS END (all players)") + list(r.dist) +
    head("BEST SELLERS IN THE SHOP") + list(r.buys) +
    head("DEVICES PER DAY (last 14 days)") + list(r.days);
  const draw = (g) => {
    d.innerHTML = `<h2 style="font:800 18px Orbitron,sans-serif;margin:0">STATS</h2>${g}${local()}<button onclick="this.parentNode.remove()" style="margin-top:22px;width:100%;padding:14px;border:0;border-radius:14px;background:#7fe6ff;font:800 13px Orbitron,sans-serif;color:#06121d">CLOSE</button>`;
  };
  d.innerHTML = '<div style="padding:30px 0;color:#8c93b8">Loading…</div>';
  document.body.appendChild(d);
  if (!ANALYTICS_URL) draw(head("ALL PLAYERS") + `<div style="color:#ffb35c">No collector yet. Set ANALYTICS_URL (see tools/ANALYTICS.md) to see all devices here.</div>`);
  else if (!key) draw(head("ALL PLAYERS") + `<div style="color:#ffb35c">Open this page once as ?stats=1&amp;key=YOUR_SECRET, the key is then remembered on this device.</div>`);
  else
    fetch(ANALYTICS_URL.replace(/\/?$/, "/") + "report?key=" + encodeURIComponent(key))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((r) => draw(global(r)))
      .catch((e) => draw(head("ALL PLAYERS") + `<div style="color:#ff6b6b">Could not load the report (${esc(e)}). Check the key and the collector address.</div>`));
}
