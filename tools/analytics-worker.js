/* tools/analytics-worker.js — a tiny collector for the game's anonymous statistics (Cloudflare Workers + one KV namespace named STATS).
   Deploy: create a Worker, paste this file, bind a KV namespace as STATS, then put the Worker's address into ANALYTICS_URL
   in js/3d/controller/analytics.js. Open  <worker address>/report?key=YOUR_SECRET  to read the totals (set SECRET in the Worker's variables).
   It stores only counters, never ids or raw events. */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/report") {
      if (url.searchParams.get("key") !== env.SECRET) return new Response("no", { status: 403 });
      const list = await env.STATS.list();
      const out = {};
      for (const k of list.keys) out[k.name] = +(await env.STATS.get(k.name)) || 0;
      return new Response(JSON.stringify(out, null, 1), { headers: { "content-type": "application/json" } });
    }
    if (req.method !== "POST") return new Response("ok", { headers: cors });
    let b;
    try {
      b = JSON.parse(await req.text());
    } catch (e) {
      return new Response("bad", { status: 400, headers: cors });
    }
    const day = new Date().toISOString().slice(0, 10),
      os = (b.dev && b.dev.os) || "?",
      inc = {};
    const add = (k, n = 1) => (inc[k] = (inc[k] || 0) + n);
    for (const e of (b.ev || []).slice(0, 40)) {
      add(`${day}:${e.ev}`);
      add(`${day}:${e.ev}:${os}`);
      if (e.ev === "run") {
        const m = e.m | 0;
        add(`dist:${m < 200 ? "000-200" : m < 500 ? "200-500" : m < 1000 ? "500-1000" : m < 2000 ? "1000-2000" : "2000+"}`);
        add("run:secs", Math.min(e.sec | 0, 3600));
        add("run:fps", Math.min(e.fps | 0, 240));
        add("run:n");
      }
      if (e.ev === "buy") add(`buy:${String(e.tab).slice(0, 8)}:${String(e.id).slice(0, 12)}`);
    }
    for (const [k, n] of Object.entries(inc)) await env.STATS.put(k, String((+(await env.STATS.get(k)) || 0) + n));
    return new Response("ok", { headers: cors });
  },
};
