# Statistics for all players (Cloudflare, free)

GitHub Pages can only serve files, so it cannot count visitors from other phones. The game therefore sends anonymous events to a tiny
collector that you run on Cloudflare's free plan. After this setup `city3d.html?stats=1&key=YOUR_SECRET` shows ALL players.

## What you get
Devices (total / today / 7 days / 30 days), new players, D1 and D7 return rate, funnel (opened → started → finished a run → tutorial → shop → bought),
system (iPhone, iPad, Android, Windows, Mac), phone model (iPhone by screen size, Android by model code such as SM-A146B), browser (incl. Instagram / Telegram in-app),
country, language, where players came from, average run length and FPS per device, where runs end, best-selling shop items.

## One-time setup (about 10 minutes)
1. Create a free account at cloudflare.com.
2. **Workers & Pages → D1 → Create database**, name it `zumary-stats`. Open its **Console** and paste the whole of `tools/analytics-schema.sql`, run it.
3. **Workers & Pages → Create → Worker**, name it `zumary-stats`, deploy, then **Edit code** and replace everything with `tools/analytics-worker.js`.
4. Worker → **Settings → Bindings → Add → D1 database**: variable name `DB`, database `zumary-stats`.
5. Worker → **Settings → Variables**: add a text variable `SECRET` with a long random password (this protects the report).
6. Copy the Worker address (like `https://zumary-stats.YOURNAME.workers.dev`) into `ANALYTICS_URL` at the top of `js/3d/controller/analytics.js`, commit and publish.
7. Open `https://khusanov99.github.io/game/city3d.html?stats=1&key=YOUR_SECRET` once. The key is remembered on that device; afterwards `?stats=1` is enough.

## Measuring ads
Add `?src=` to every link you advertise, for example `.../city3d.html?src=instagram_reel1` or `?src=telegram_channelname`.
The report lists every `src` with the number of devices, so you can compare campaigns.

## Privacy
Only a random device id and gameplay numbers are stored. No name, email or IP address is saved. Players can switch it off in Settings.
Mention it in your privacy policy; some countries require consent (ask a lawyer).
