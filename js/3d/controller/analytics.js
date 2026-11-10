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
    dev: { os: DEV.ios ? "ios" : DEV.android ? "android" : "desktop", low: !!DEV.low, w: innerWidth, h: innerHeight, lg: LG, soft: !!SOFTGL },
    ev: anaQ.splice(0),
  });
  try {
    if (!(navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_URL, body))) fetch(ANALYTICS_URL, { method: "POST", body, keepalive: true });
  } catch (e) {}
}
addEventListener("visibilitychange", () => document.hidden && anaFlush());
addEventListener("pagehide", anaFlush);
track("open", {});
/* local statistics page: city3d.html?stats=1 */
if (/[?&]stats\b/.test(location.search)) {
  const s = anaS,
    avg = s.fpsN ? Math.round(s.fpsSum / s.fpsN) : "-",
    tot = s.dist.reduce((a, b) => a + b, 0) || 1,
    names = ["<200 m", "200–500 m", "500–1000 m", "1000–2000 m", "2000+ m"],
    d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;z-index:99;overflow:auto;background:#0b0d22;color:#e6e9ff;font:600 13px Inter,sans-serif;padding:20px";
  d.innerHTML =
    `<h2 style="font:800 18px Orbitron,sans-serif;margin:0 0 12px">STATS (this device)</h2>` +
    [["Opens", s.opens], ["Starts", s.starts], ["Runs finished", s.runs], ["Days played", Object.keys(s.days).length], ["Play time", Math.round(s.secs / 60) + " min"], ["Best run", s.best + " m"], ["Avg FPS", avg], ["Tutorial done", s.tut], ["Shop opened", s.shop], ["Purchases", s.buys]]
      .map(([a, b]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1)"><span>${a}</span><b>${b}</b></div>`)
      .join("") +
    `<div style="margin:14px 0 6px;color:#8c93b8">Where runs end</div>` +
    s.dist.map((n, i) => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="width:92px">${names[i]}</span><div style="flex:1;height:10px;background:rgba(255,255,255,.1);border-radius:5px;overflow:hidden"><div style="width:${Math.round((n / tot) * 100)}%;height:100%;background:#7fe6ff"></div></div><span>${n}</span></div>`).join("") +
    `<button onclick="this.parentNode.remove()" style="margin-top:18px;width:100%;padding:14px;border:0;border-radius:14px;background:#7fe6ff;font:800 13px Orbitron,sans-serif;color:#06121d">CLOSE</button>`;
  document.body.appendChild(d);
}
