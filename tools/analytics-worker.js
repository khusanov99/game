/* tools/analytics-worker.js — collector + report for the game's anonymous statistics (Cloudflare Worker + D1 database).
   Setup steps are in tools/ANALYTICS.md. Bindings: DB (D1 database), SECRET (text variable: your password for the report).
   Stored per event: a random device id, day, event name, device class/model, browser, country (from Cloudflare), language, run numbers.
   No names, emails or IP addresses are stored. */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
const S = (x, n = 60) => (x == null ? "" : String(x).slice(0, n)),
  N = (x) => (Number.isFinite(+x) ? Math.round(+x) : 0);
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname.endsWith("/report")) return report(url, env);
    if (req.method !== "POST") return new Response("ok", { headers: CORS });
    let b;
    try {
      b = JSON.parse(await req.text());
    } catch (e) {
      return new Response("bad", { status: 400, headers: CORS });
    }
    const id = S(b.id, 32),
      dv = b.dev || {},
      country = S((req.cf && req.cf.country) || "", 3);
    if (!id) return new Response("bad", { status: 400, headers: CORS });
    const st = env.DB.prepare("INSERT INTO ev (id,ts,day,ev,os,model,br,src,country,lg,tz,low,soft,gpu,w,h,m,coins,sec,fps,tab,item) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const rows = (Array.isArray(b.ev) ? b.ev : []).slice(0, 40).map((e) => {
      const ts = N(e.t) || Date.now();
      return st.bind(id, ts, new Date(ts).toISOString().slice(0, 10), S(e.ev, 16), S(dv.os, 10), S(dv.model, 50), S(dv.br, 20), S(dv.src, 40), country, S(dv.lg, 4), S(dv.tz, 40), dv.low ? 1 : 0, dv.soft ? 1 : 0, S(dv.gpu), N(dv.w), N(dv.h), N(e.m), N(e.coins), Math.min(N(e.sec), 7200), Math.min(N(e.fps), 240), S(e.tab, 10), S(e.id, 14));
    });
    if (rows.length) await env.DB.batch(rows);
    return new Response("ok", { headers: CORS });
  },
};
async function report(url, env) {
  if (url.searchParams.get("key") !== env.SECRET) return new Response("no", { status: 403, headers: CORS });
  const q = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [],
    one = async (sql, ...a) => (await q(sql, ...a))[0] || {},
    day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10),
    top = (col, extra = "") => q(`SELECT ${col} AS k, COUNT(DISTINCT id) AS n FROM ev WHERE ${col}!='' ${extra} GROUP BY ${col} ORDER BY n DESC LIMIT 15`),
    firstSeen = "(SELECT id, MIN(day) AS d0 FROM ev GROUP BY id)";
  const f = {};
  for (const e of ["open", "start", "run", "tutorial", "shop", "buy"]) f[e] = (await one("SELECT COUNT(DISTINCT id) AS n FROM ev WHERE ev=?", e)).n || 0;
  const out = {
    total: (await one("SELECT COUNT(DISTINCT id) AS n FROM ev")).n || 0,
    dau: (await one("SELECT COUNT(DISTINCT id) AS n FROM ev WHERE day=?", day(0))).n || 0,
    wau: (await one("SELECT COUNT(DISTINCT id) AS n FROM ev WHERE day>=?", day(6))).n || 0,
    mau: (await one("SELECT COUNT(DISTINCT id) AS n FROM ev WHERE day>=?", day(29))).n || 0,
    newToday: (await one(`SELECT COUNT(*) AS n FROM ${firstSeen} WHERE d0=?`, day(0))).n || 0,
    d1: (await one(`SELECT COUNT(DISTINCT f.id) AS n FROM ${firstSeen} f JOIN ev e ON e.id=f.id AND e.day=date(f.d0,'+1 day')`)).n || 0,
    d7: (await one(`SELECT COUNT(DISTINCT f.id) AS n FROM ${firstSeen} f JOIN ev e ON e.id=f.id AND e.day>date(f.d0) AND e.day<=date(f.d0,'+7 day')`)).n || 0,
    f,
    os: await top("os"),
    model: await top("model"),
    br: await top("br"),
    country: await top("country"),
    src: await top("src"),
    lg: await top("lg"),
    runs: await one("SELECT COUNT(*) AS n, AVG(m) AS m, AVG(sec) AS sec, AVG(NULLIF(fps,0)) AS fps FROM ev WHERE ev='run'"),
    fpsBy: await q("SELECT CASE WHEN model!='' THEN model ELSE os END AS k, ROUND(AVG(NULLIF(fps,0))) AS n FROM ev WHERE ev='run' GROUP BY k HAVING COUNT(*)>=3 ORDER BY n ASC LIMIT 15"),
    dist: await q("SELECT CASE WHEN m<200 THEN '0-200 m' WHEN m<500 THEN '200-500 m' WHEN m<1000 THEN '500-1000 m' WHEN m<2000 THEN '1000-2000 m' ELSE '2000+ m' END AS k, COUNT(*) AS n FROM ev WHERE ev='run' GROUP BY k"),
    buys: await q("SELECT tab||': '||item AS k, COUNT(*) AS n FROM ev WHERE ev='buy' GROUP BY k ORDER BY n DESC LIMIT 15"),
    days: await q("SELECT day AS k, COUNT(DISTINCT id) AS n FROM ev WHERE day>=? GROUP BY day ORDER BY day DESC", day(13)),
  };
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", ...CORS } });
}
