/* =====================================================
   ZUMARY — settings system (loaded after game.js)
   Every row below changes real behaviour in game.js through
   CFG / FX / Q / RS / FLOOR / SWIPE / FPSCAP, is saved in localStorage ("zr_cfg", "zr_gfx")
   and is applied immediately.
===================================================== */
(function () {
  "use strict";
  /* ---------- defaults (only added when missing, saved values win) ---------- */
  const DEF = {
    cq: 1,
    rscale: 100,
    fps: "auto",
    fxParticles: true,
    fxBlur: true,
    fxBloom: !COARSE,
    fxShake: true,
    fxLight: true,
    fxShadow: true,
    fxEnv: true,
    fxCoin: true,
    fxChar: true,
    fxBg: true,
    adaptive: true,
    battery: false,
    lowmem: false,
    bgsave: true,
    autoopt: true,
    thermal: false,
    showfps: false,
    sens: 1,
    cam: true,
    autopause: true,
    hints: true,
    uiscale: 1,
    shakeInt: 1,
    layout: "auto",
    contrast: false,
    cb: false,
    large: false,
    simple: false,
  };
  for (const k in DEF) if (!(k in CFG)) CFG[k] = DEF[k];

  /* ---------- texts: [uz, en, ja] ---------- */
  const L = {
    "g.graphics": ["GRAFIKA", "GRAPHICS", "画質"],
    "g.fps": ["FPS", "FPS", "FPS"],
    "g.fx": ["VIZUAL EFFEKTLAR", "VISUAL EFFECTS", "ビジュアル効果"],
    "g.perf": ["ISHLASH TEZLIGI", "PERFORMANCE", "パフォーマンス"],
    "g.play": ["O'YIN", "GAMEPLAY", "ゲームプレイ"],
    "g.display": ["EKRAN", "DISPLAY", "表示"],
    "g.access": ["QULAYLIK", "ACCESSIBILITY", "アクセシビリティ"],
    gfx: ["Grafika sifati", "Graphics preset", "画質プリセット"],
    cq: ["Batafsillik (Custom)", "Detail level (Custom)", "詳細度 (カスタム)"],
    rscale: ["Render o'lchami", "Render scale", "描画スケール"],
    "gfx.custom": ["MAXSUS", "CUSTOM", "カスタム"],
    fps: ["FPS chegarasi", "FPS limit", "FPS 上限"],
    "fps.auto": ["AVTO", "AUTO", "自動"],
    "fps.max": ["QURILMA MAKSIMUMI", "DEVICE MAXIMUM", "デバイス最大"],
    "fps.note": [
      "Qurilma yangilanish tezligi:",
      "Detected refresh rate:",
      "検出したリフレッシュレート:",
    ],
    fxParticles: ["Zarrachalar", "Particle effects", "パーティクル"],
    fxBlur: [
      "Harakat xiraligi (tezlik chiziqlari)",
      "Motion blur (speed lines)",
      "モーションブラー",
    ],
    fxBloom: ["Bloom (yorug'lik)", "Bloom", "ブルーム"],
    fxShake: ["Ekran silkinishi", "Screen shake", "画面の揺れ"],
    fxLight: ["Dinamik yoritish", "Dynamic lighting", "ダイナミックライト"],
    fxShadow: ["Soyalar", "Shadows", "影"],
    fxEnv: [
      "Atrof-muhit effektlari (ob-havo)",
      "Environmental effects (weather)",
      "環境エフェクト",
    ],
    fxCoin: ["Tanga yarqirashi", "Coin glow", "コインの輝き"],
    fxChar: ["Qahramon effektlari", "Character effects", "キャラクター効果"],
    fxBg: ["Fon animatsiyalari", "Background animations", "背景アニメ"],
    adaptive: ["Moslashuvchan sifat", "Adaptive quality", "適応型画質"],
    battery: [
      "Batareya tejash (30 FPS)",
      "Battery saver (30 FPS)",
      "バッテリーセーバー (30 FPS)",
    ],
    lowmem: ["Kam xotira rejimi", "Low memory mode", "低メモリモード"],
    bgsave: [
      "Fon jarayonlarini kamaytirish",
      "Reduced background processing",
      "バックグラウンド処理を減らす",
    ],
    autoopt: [
      "Avtomatik optimallashtirish",
      "Automatic performance optimization",
      "自動パフォーマンス最適化",
    ],
    thermal: [
      "Issiqlikka qulay rejim",
      "Thermal-friendly mode",
      "発熱を抑えるモード",
    ],
    showfps: ["FPS hisoblagich", "Show FPS counter", "FPS表示"],
    "thermal.note": [
      "3 daqiqa o'ynagach chizish tezligi 30 FPS ga tushadi. Qurilma qizimasligiga kafolat bera olmaydi.",
      "After 3 minutes of play the draw rate drops to 30 FPS. It reduces work but cannot guarantee the device stays cool.",
      "3分プレイ後に描画を30FPSに下げます。発熱しないことの保証はできません。",
    ],
    music: ["Musiqa ovozi", "Music volume", "音楽の音量"],
    sfx: ["Effekt ovozi", "Effects volume", "効果音の音量"],
    vib: ["Tebranish", "Vibration", "振動"],
    sens: [
      "Boshqaruv sezgirligi (swipe)",
      "Control sensitivity (swipe)",
      "操作感度 (スワイプ)",
    ],
    cam: [
      "Kamera effektlari (zoom, chaqnash)",
      "Camera effects (zoom, flash)",
      "カメラ効果",
    ],
    autopause: ["Avto-pauza", "Automatic pause", "自動ポーズ"],
    hints: ["O'yin maslahatlari", "Gameplay hints", "ヒント"],
    fullscreen: ["To'liq ekran", "Fullscreen", "フルスクリーン"],
    "fs.go": ["YOQISH / O'CHIRISH", "TOGGLE", "切替"],
    uiscale: ["Interfeys o'lchami", "Interface scale", "UIスケール"],
    shakeInt: ["Silkinish kuchi", "Screen shake intensity", "揺れの強さ"],
    layout: ["Joylashuv", "Responsive layout", "レイアウト"],
    "layout.auto": ["AVTO", "AUTO", "自動"],
    "layout.compact": ["ZICH", "COMPACT", "コンパクト"],
    "layout.roomy": ["KENG", "ROOMY", "ゆったり"],
    left: ["Chapaqay boshqaruv", "Left-handed controls", "左手用の操作"],
    reduce: ["Harakatni kamaytirish", "Reduced motion", "視差を減らす"],
    contrast: ["Yuqori kontrast", "High contrast", "ハイコントラスト"],
    cb: [
      "Rang ko'rish uchun qulay interfeys",
      "Color-friendly UI",
      "色覚に配慮したUI",
    ],
    large: ["Kattaroq interfeys", "Larger interface", "大きいUI"],
    simple: [
      "Soddalashtirilgan effektlar",
      "Simplified visual effects",
      "簡易エフェクト",
    ],
    "cb.note": [
      "Interfeys ranglarini ko'k/to'q sariqqa almashtiradi. O'yin ichidagi to'siqlar shakli bilan ham ajraladi.",
      "Switches the interface accents to blue/orange. In-game hazards are still told apart by shape.",
      "UIの強調色を青/オレンジに切り替えます。",
    ],
    on: ["YOQ", "ON", "オン"],
    off: ["O'CH", "OFF", "オフ"],
    reset: ["Sozlamalarni tiklash", "Reset settings", "設定をリセット"],
    "reset.go": ["TIKLASH", "RESET", "リセット"],
  };
  for (const k in L) {
    I18N.uz["s." + k] = L[k][0];
    I18N.en["s." + k] = L[k][1];
    I18N.ja["s." + k] = L[k][2];
  }
  const S = (k) => t("s." + k);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /* ---------- applying ---------- */
  const root = document.documentElement;
  function applyAll() {
    const sp = CFG.simple;
    FX.particles = CFG.fxParticles && !sp;
    FX.blur = CFG.fxBlur && !sp;
    FX.bloom = CFG.fxBloom && !sp;
    FX.light = CFG.fxLight && !sp;
    FX.shadow = CFG.fxShadow;
    FX.env = CFG.fxEnv && !sp;
    FX.coinGlow = CFG.fxCoin && !sp;
    FX.charFx = CFG.fxChar && !sp;
    FX.bg = CFG.fxBg && !sp;
    FX.shake = CFG.fxShake && !sp ? CFG.shakeInt : 0;
    FX.cam = CFG.cam && !sp;
    FX.hints = CFG.hints;
    const f = CFG.fps;
    FPSCAP = f === "auto" ? 0 : f === "max" ? -1 : +f || 0;
    FLOOR = (CFG.battery ? 2 : 0) | 0;
    if (CFG.simple) FLOOR = Math.max(FLOOR, 1);
    RS = Math.max(0.5, Math.min(1, CFG.rscale / 100)) * (CFG.lowmem ? 0.85 : 1);
    SWIPE = Math.round(30 / Math.max(0.5, Math.min(1.5, CFG.sens)));
    const us = CFG.uiscale * (CFG.large ? 1.18 : 1);
    root.style.setProperty("--uis", us.toFixed(3));
    const b = document.body.classList;
    b.toggle("hc", !!CFG.contrast);
    b.toggle("cb", !!CFG.cb);
    b.toggle("big", !!CFG.large);
    b.toggle("nohints", !CFG.hints);
    b.toggle("lay-compact", CFG.layout === "compact");
    b.toggle("lay-roomy", CFG.layout === "roomy");
    b.toggle("lefty", !!CFG.left);
    b.toggle("calm", !!CFG.reduce);
    if (typeof Q !== "undefined") {
      setQuality(Math.max(Q.level, 0));
    }
    if (!!CFG.showfps !== perfOn) togglePerf();
  }
  window.applySettings = applyAll;

  /* ---------- UI ---------- */
  const openSec = { look: true, graphics: true };
  function hzOptions() {
    const o = ["auto", 30];
    const h = Math.round(hz);
    if (h >= 55) o.push(60);
    if (h >= 85) o.push(90);
    if (h >= 115) o.push(120);
    if (h >= 140) o.push(144);
    o.push("max");
    return o;
  }
  const sel = (k, opts, cur, lab) =>
    `<select class="sel" data-s="${k}" aria-label="${esc(S(k))}">${opts.map((o) => `<option value="${o}"${String(o) === String(cur) ? " selected" : ""}>${esc(lab(o))}</option>`).join("")}</select>`;
  const tog = (k) =>
    `<button type="button" class="tog${CFG[k] ? " on" : ""}" data-s="${k}" data-b="1" role="switch" aria-checked="${!!CFG[k]}">${S(CFG[k] ? "on" : "off")}</button>`;
  const rng = (k, min, max, step, val, fmt) =>
    `<span class="rngw"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-s="${k}" data-n="1" aria-label="${esc(S(k))}"><output>${fmt(val)}</output></span>`;
  const row = (label, body, note) =>
    `<div class="shop-row"><div><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ""}</div>${body}</div>`;
  const pct = (v) => Math.round(v) + "%";
  const gfxLab = (o) => (o === "custom" ? S("gfx.custom") : t("gfx." + o));

  function sections() {
    const rows = {
      graphics: [
        row(S("gfx"), sel("gfx", GFX, gfx, gfxLab)),
        gfx === "custom"
          ? row(
              S("cq"),
              sel(
                "cq",
                [0, 1, 2, 3],
                CFG.cq,
                (o) => ["ULTRA", "HIGH", "MEDIUM", "LOW"][o],
              ),
            )
          : "",
        row(S("rscale"), rng("rscale", 50, 100, 5, CFG.rscale, pct)),
      ],
      fps: [
        row(
          S("fps"),
          sel("fps", hzOptions(), CFG.fps, (o) =>
            o === "auto"
              ? S("fps.auto")
              : o === "max"
                ? S("fps.max")
                : o + " FPS",
          ),
          S("fps.note") + " ~" + Math.round(hz) + " Hz",
        ),
      ],
      fx: [
        "fxParticles",
        "fxBlur",
        "fxBloom",
        "fxShake",
        "fxLight",
        "fxShadow",
        "fxEnv",
        "fxCoin",
        "fxChar",
        "fxBg",
      ].map((k) => row(S(k), tog(k))),
      perf: [
        row(S("adaptive"), tog("adaptive")),
        row(S("battery"), tog("battery")),
        row(S("lowmem"), tog("lowmem")),
        row(S("bgsave"), tog("bgsave")),
        row(S("autoopt"), tog("autoopt")),
        row(S("thermal"), tog("thermal"), S("thermal.note")),
        row(S("showfps"), tog("showfps")),
      ],
      play: [
        `<div class="shop-row"><div><b>${esc(S("music"))}</b></div><input type="range" min="0" max="100" value="${Math.round(CFG.music * 100)}" data-vol="music" aria-label="music"></div>`,
        `<div class="shop-row"><div><b>${esc(S("sfx"))}</b></div><input type="range" min="0" max="100" value="${Math.round(CFG.sfx * 100)}" data-vol="sfx" aria-label="sfx"></div>`,
        `<div class="shop-row"><div><b>${esc(S("vib"))}</b></div><button type="button" class="tog${CFG.vib ? " on" : ""}" data-cfg="vib">${S(CFG.vib ? "on" : "off")}</button></div>`,
        row(
          S("sens"),
          rng("sens", 50, 150, 10, Math.round(CFG.sens * 100), pct),
        ),
        row(S("cam"), tog("cam")),
        row(S("autopause"), tog("autopause")),
        row(S("hints"), tog("hints")),
      ],
      display: [
        row(
          S("fullscreen"),
          `<button type="button" class="tog" data-act2="fs">${S("fs.go")}</button>`,
        ),
        row(
          S("uiscale"),
          rng("uiscale", 80, 130, 5, Math.round(CFG.uiscale * 100), pct),
        ),
        row(
          S("shakeInt"),
          rng("shakeInt", 0, 150, 10, Math.round(CFG.shakeInt * 100), pct),
        ),
        row(
          S("layout"),
          sel("layout", ["auto", "compact", "roomy"], CFG.layout, (o) =>
            S("layout." + o),
          ),
        ),
        `<div class="shop-row"><div><b>${esc(S("left"))}</b></div><button type="button" class="tog${CFG.left ? " on" : ""}" data-cfg="left">${S(CFG.left ? "on" : "off")}</button></div>`,
      ],
      access: [
        `<div class="shop-row"><div><b>${esc(S("reduce"))}</b></div><button type="button" class="tog${CFG.reduce ? " on" : ""}" data-cfg="reduce" data-after="1">${S(CFG.reduce ? "on" : "off")}</button></div>`,
        row(S("contrast"), tog("contrast")),
        row(S("cb"), tog("cb"), S("cb.note")),
        row(S("large"), tog("large")),
        row(S("simple"), tog("simple")),
        row(
          S("reset"),
          `<button type="button" class="tog" data-act2="reset">${S("reset.go")}</button>`,
        ),
      ],
    };
    return [
      ["look", "look.t", [`<div class="lookchips">${lookChips()}</div>`]],
      ["graphics", "g.graphics", [...rows.graphics, ...rows.fps]],
      ["fx", "g.fx", rows.fx],
      ["perf", "g.perf", rows.perf],
      ["play", "g.play", rows.play],
      ["display", "g.display", rows.display],
      ["access", "g.access", rows.access],
    ];
  }
  renderSettings = function () {
    return (
      `<div class="top-title">${t("panel.settings.t")}</div><div class="shop setx">` +
      sections()
        .map(
          ([id, title, rows]) =>
            `<details class="set-sec" data-sec="${id}"${openSec[id] ? " open" : ""}><summary>${esc(title === "look.t" ? t("look.t") : S(title))}</summary><div class="set-body">${rows.join("")}</div></details>`,
        )
        .join("") +
      `</div>`
    );
  };
  function refresh() {
    const card = document.querySelector(".overlay-card"),
      y = card ? card.scrollTop : 0;
    $("shopBox").innerHTML = renderSettings();
    if (card) card.scrollTop = y;
  }

  const box = $("shopBox");
  box.addEventListener(
    "toggle",
    (e) => {
      const d = e.target;
      if (d && d.dataset && d.dataset.sec) openSec[d.dataset.sec] = d.open;
    },
    true,
  );
  box.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act2]");
    if (a) {
      if (a.dataset.act2 === "fs") toggleFs();
      else if (a.dataset.act2 === "reset") {
        for (const k in DEF) CFG[k] = DEF[k];
        CFG.reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        CFG.left = false;
        CFG.vib = true;
        CFG.music = 0.6;
        CFG.sfx = 0.9;
        gfx = "auto";
        store.set("zr_gfx", gfx);
        saveCfg();
        applyGfx();
        applyAll();
        if (ac) {
          busS.gain.value = CFG.sfx;
          busM.gain.value = CFG.music;
        }
        refresh();
      }
      return;
    }
    const c = e.target.closest("button[data-cfg][data-after]");
    if (c)
      setTimeout(() => {
        applyAll();
      }, 0); // the old handler (game.js) already flipped CFG[k]
    const b = e.target.closest("button[data-b]");
    if (!b) return;
    const k = b.dataset.s;
    CFG[k] = !CFG[k];
    saveCfg();
    applyAll();
    b.classList.toggle("on", CFG[k]);
    b.textContent = S(CFG[k] ? "on" : "off");
    b.setAttribute("aria-checked", !!CFG[k]);
    if (k === "battery" || k === "lowmem" || k === "simple") refresh();
  });
  function onVal(e, fin) {
    const el = e.target.closest("[data-s]");
    if (!el || el.dataset.b) return;
    const k = el.dataset.s;
    let v = el.value;
    if (k === "gfx") {
      gfx = v;
      store.set("zr_gfx", gfx);
      applyGfx();
      gfxLabel();
      applyAll();
      if (fin) refresh();
      return;
    }
    if (el.dataset.n) {
      v = +v;
      if (k === "rscale") CFG[k] = v;
      else CFG[k] = v / 100;
      const o = el.parentNode.querySelector("output");
      if (o) o.textContent = Math.round(v) + "%";
      saveCfg();
      if (
        k === "rscale" ||
        k === "uiscale" ||
        k === "sens" ||
        k === "shakeInt"
      ) {
        applyAll();
        if (k === "rscale" && fin) resize();
      }
      if (k === "shakeInt" && fin) {
        shake = 8;
      }
      return;
    }
    if (k === "cq") v = +v;
    else if (k === "fps" && v !== "auto" && v !== "max") v = +v;
    CFG[k] = v;
    saveCfg();
    applyAll();
    if (k === "cq") {
      applyGfx();
    }
    if (k === "layout") resize();
  }
  box.addEventListener("input", (e) => onVal(e, false));
  box.addEventListener("change", (e) => onVal(e, true));

  /* 🎨 button: cycle presets, and keep the panel / label in sync */
  $("gfxButton").addEventListener("click", () => {
    setTimeout(() => {
      applyAll();
    }, 0);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "F3")
      setTimeout(() => {
        CFG.showfps = perfOn;
        saveCfg();
      }, 0);
  });
  const lastLang = window.onLangChange;
  window.onLangChange = function () {
    if (lastLang) lastLang();
  };

  applyAll();
  applyGfx();
})();
