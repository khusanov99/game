/* =====================================================
   SPRITES — real image characters (PNG) for the runner,
   the guard and the chasing dog.

   HOW TO USE
   1. Put your PNG files in  assets/characters/
   2. Edit CONFIG below (file names, which picture is which pose, size on screen)
   3. Set  enabled: true  for that character.

   If a character is disabled, or its images are missing, the game
   automatically keeps using the built-in painted character (chars.js),
   so nothing can break.

   Pictures are scaled ONCE at load to their on-screen size and kept as
   small canvases, so big source art costs almost no memory or speed on
   phones while the game is running.

   Animation sources
   • a grid PNG: frame numbers count left→right, top→bottom from 0   (anim: { run: [0,1,2,3] })
   • separate files: anim: { run: ["a.png", "b.png"] }
   • a single still picture can be animated by code with  motion  (bounce, lean, sway, stretch)
   Every picture can have its own size:  info: { "file.png": { h: 64, ax: 0.5 } }
     h  = on-screen height in game units      ax = where the body centre is (0–1 across the picture)
===================================================== */
window.Sprites =
  window.Sprites ||
  (() => {
    const CONFIG = {
      /* ---- the hero (the player): ZUMARY runner ---- */
      runner: {
        enabled: true,
        file: "", // all frames are separate pictures here
        anim: {
          run: ["assets/characters/hero_run1.png", "assets/characters/hero_run2.png"], // two strides, blended by motion
          jump: ["assets/characters/hero_run2.png"],
          fall: ["assets/characters/hero_run2.png"],
          land: ["assets/characters/hero_run1.png"],
          duck: ["assets/characters/hero_slide.png"],
          hit: ["assets/characters/hero_slide.png"],
        },
        height: 64,
        info: {
          "assets/characters/hero_run1.png": { h: 76, ax: 0.52 },
          "assets/characters/hero_run2.png": { h: 69, ax: 0.5 },
          "assets/characters/hero_slide.png": { h: 50, ax: 0.5 },
        },
        foot: 0, // units between the feet and the bottom of the picture
        flip: false, // true if the art faces LEFT
        motion: {
          run: { bounce: 3.2, tilt: 0.03, sway: 0.035 },
          jump: { tilt: -0.1 },
          fall: { tilt: 0.14 },
          land: { tilt: 0.05 },
        },
      },
      /* ---- the officer who chases you ---- */
      guard: {
        enabled: true,
        file: "assets/characters/guard.png",
        frameW: 263,
        frameH: 640,
        cols: 1,
        anim: { run: [0] }, // ONE still picture → the run is animated by code
        height: 78,
        foot: 1.2,
        flip: false,
        motion: { run: { bounce: 4.5, tilt: 0.1, sway: 0.05, skew: 0.07 } },
      },
      /* ---- the dog ---- */
      dog: {
        enabled: true,
        file: "assets/characters/dog.png",
        frameW: 245,
        frameH: 265,
        cols: 1,
        anim: { run: [0], snarl: [0] }, // one picture, galloping by code
        height: 54,
        foot: 2,
        flip: false,
        motion: {
          run: { bounce: 5.5, tilt: -0.035, sway: 0.06, stretch: 0.05 },
          snarl: { bounce: 7, tilt: -0.07, sway: 0.1, stretch: 0.09 },
        },
      },
    };

    const FALLBACK = { jump: "run", fall: "jump", land: "run", duck: "run", hit: "fall", snarl: "run" };
    const imgCache = {},
      status = {},
      built = {};

    const loadImg = (url) =>
      imgCache[url] ||
      (imgCache[url] = new Promise((res) => {
        const i = new Image();
        i.decoding = "async";
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = (window.SPRITE_DATA && window.SPRITE_DATA[url]) || url; // pictures embedded by characters-data.js, else the file itself
      }));
    const variantOf = (c, variant) => (c.file && typeof c.file === "object" ? (c.file[variant] ? variant : "default") : "default");
    const fileOf = (c, v) => (typeof c.file === "object" ? c.file[v] || c.file.default : c.file);
    const urlsOf = (c, v) => {
      const u = new Set();
      const f = fileOf(c, v);
      if (f && needsGrid(c)) u.add(f);
      Object.values(c.anim || {}).forEach((a) =>
        a.forEach((s) => {
          if (typeof s === "string") u.add(s);
        }),
      );
      return [...u];
    };
    function needsGrid(c) {
      return Object.values(c.anim || {}).some((a) => a.some((s) => typeof s === "number"));
    }

    function start(kind, v) {
      const key = kind + ":" + v,
        c = CONFIG[kind];
      if (status[key]) return;
      status[key] = { state: "loading", imgs: {} };
      const urls = urlsOf(c, v);
      Promise.all(urls.map(loadImg)).then((list) => {
        const st = status[key];
        urls.forEach((u, i) => (st.imgs[u] = list[i]));
        const ok = urls.every((u) => st.imgs[u]) && c.anim && c.anim.run && c.anim.run.length;
        st.state = ok ? "ok" : "fail";
        if (!ok && window.console) console.warn("[Sprites] " + kind + ": images not found or config incomplete — using the built-in character");
      });
    }

    const pickFrames = (arr, n) => Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n) % arr.length]);
    function anim(c, name) {
      let a = c.anim[name],
        g = name,
        guard = 0;
      while ((!a || !a.length) && FALLBACK[g] && guard++ < 6) {
        g = FALLBACK[g];
        a = c.anim[g];
      }
      return a && a.length ? a : c.anim.run;
    }

    function build(c, v, st, sc) {
      const grid = st.imgs[fileOf(c, v)];
      const rectOf = (spec) => {
        if (typeof spec === "string") {
          const i = st.imgs[spec];
          return { r: [i, 0, 0, i.width, i.height], key: spec };
        }
        const cols = c.cols || Math.max(1, Math.floor(grid.width / c.frameW));
        return { r: [grid, (spec % cols) * c.frameW, Math.floor(spec / cols) * c.frameH, c.frameW, c.frameH], key: fileOf(c, v) };
      };
      const specs = [],
        meta = [];
      c._order.forEach(([name, n]) =>
        pickFrames(anim(c, name), n).forEach((s, i) => {
          specs.push(s);
          meta.push({ name, i, n });
        }),
      );
      const items = specs.map(rectOf);
      // every picture may have its own height (units); the sheet is as big as the biggest one
      const dims = items.map(({ r, key }) => {
        const inf = (c.info && c.info[key]) || {};
        const h = inf.h || c.height;
        return { h, w: h * (r[3] / r[4]), ax: inf.ax === undefined ? 0.5 : inf.ax };
      });
      const Hmax = Math.max(...dims.map((d) => d.h)),
        Wmax = Math.max(...dims.map((d) => d.w));
      const mo = c.motion || null; // empty room around so tilting / stretching never clips
      const PX = mo ? Math.ceil(Wmax * 0.2) : 0,
        PT = mo ? Math.ceil(Hmax * 0.1) : 0,
        W = Math.ceil(Wmax) + PX * 2,
        HT = Hmax + PT;
      const f = items.map(({ r }, fi) => {
        const d = dims[fi];
        const cv = document.createElement("canvas");
        cv.width = Math.ceil(W * sc);
        cv.height = Math.ceil(HT * sc);
        const g = cv.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        const dh = d.h * sc,
          dw = d.w * sc,
          cx = (PX + Wmax / 2) * sc, // the body centre line of the sheet
          bottom = (PT + Hmax) * sc, // the ground line of the sheet
          dx = cx - dw * d.ax,
          dy = bottom - dh;
        if (c.flip) {
          g.translate(cv.width, 0);
          g.scale(-1, 1);
        }
        const m = mo && mo[meta[fi].name];
        if (m) {
          // still picture → motion: bounce + lean + sway + stride skew + squash/stretch, all around the feet
          const ph = (meta[fi].i / meta[fi].n) * Math.PI * 2,
            ay = bottom - (c.foot || 0) * sc;
          g.translate(cx, ay - Math.abs(Math.sin(ph)) * (m.bounce || 0) * sc);
          g.rotate((m.tilt || 0) + Math.sin(ph) * (m.sway || 0));
          g.transform(1, 0, Math.sin(ph + 1.2) * (m.skew || 0), 1, 0, 0);
          if (m.stretch) g.scale(1 + m.stretch * Math.sin(ph * 2), 1 - m.stretch * 0.6 * Math.sin(ph * 2));
          g.translate(-cx, -ay);
        }
        // downscale in steps of at most 2× so big source art stays sharp instead of aliasing
        let src = r[0],
          sx = r[1],
          sy = r[2],
          sw = r[3],
          sh = r[4];
        while (sh > dh * 2) {
          const nh = Math.max(dh, Math.floor(sh / 2)),
            nw = Math.max(1, Math.round(sw * (nh / sh)));
          const t = document.createElement("canvas");
          t.width = nw;
          t.height = nh;
          const tg = t.getContext("2d");
          tg.imageSmoothingQuality = "high";
          tg.drawImage(src, sx, sy, sw, sh, 0, 0, nw, nh);
          src = t;
          sx = 0;
          sy = 0;
          sw = nw;
          sh = nh;
        }
        g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
        return cv;
      });
      return { w: W, h: HT, fx: W / 2, fy: PT + Hmax - (c.foot || 0), f, image: true };
    }

    const ORDER = {
      runner: [
        ["run", 8],
        ["jump", 1],
        ["fall", 1],
        ["land", 1],
        ["duck", 1],
        ["hit", 1],
      ], // frames 0-7 run · 8 jump · 9 fall · 10 land · 11 duck · 12 hit
      guard: [["run", 8]],
      dog: [
        ["run", 8],
        ["snarl", 8],
      ], // 0-7 running · 8-15 snarling
    };

    /* get(kind, variant, scale) → a sheet {w,h,fx,fy,f:[canvases]} or null (null = use the painted character) */
    function get(kind, variant, sc) {
      const c = CONFIG[kind];
      if (!c || !c.enabled) return null;
      c._order = ORDER[kind];
      const v = variantOf(c, variant),
        key = kind + ":" + v,
        bk = key + ":" + sc;
      if (built[bk]) return built[bk];
      if (!status[key]) {
        start(kind, v);
        return null;
      }
      if (status[key].state !== "ok") return null;
      return (built[bk] = build(c, v, status[key], sc));
    }
    /* start loading every enabled character right away (during the menu), so the first run is already smooth */
    function preload() {
      Object.keys(CONFIG).forEach((k) => {
        const c = CONFIG[k];
        if (!c.enabled) return;
        const vs = c.file && typeof c.file === "object" ? Object.keys(c.file) : ["default"];
        vs.forEach((v) => start(k, v));
      });
    }
    /* configure({runner:{enabled:true,…}}) — merge settings at run time (used by tests; handy for experiments) */
    function configure(o) {
      Object.keys(o).forEach((k) => {
        CONFIG[k] = Object.assign(CONFIG[k] || {}, o[k]);
        Object.keys(status).forEach((s) => s.startsWith(k + ":") && delete status[s]);
        Object.keys(built).forEach((s) => s.startsWith(k + ":") && delete built[s]);
      });
      preload();
    }
    const info = () => Object.fromEntries(Object.keys(status).map((k) => [k, status[k].state]));
    return { get, preload, configure, info, CONFIG };
  })();
