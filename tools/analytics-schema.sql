-- Run once in the Cloudflare D1 console (or: wrangler d1 execute zumary-stats --file tools/analytics-schema.sql)
CREATE TABLE IF NOT EXISTS ev (
  id TEXT NOT NULL, ts INTEGER, day TEXT, ev TEXT,
  os TEXT, model TEXT, br TEXT, src TEXT, country TEXT, lg TEXT, tz TEXT,
  low INTEGER, soft INTEGER, gpu TEXT, w INTEGER, h INTEGER,
  m INTEGER, coins INTEGER, sec INTEGER, fps INTEGER, tab TEXT, item TEXT
);
CREATE INDEX IF NOT EXISTS ev_day ON ev(day);
CREATE INDEX IF NOT EXISTS ev_id ON ev(id);
