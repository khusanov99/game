/* controller/audio.js — Procedural sound effects, soundtrack and vibration. */
"use strict";
/* ---------- audio / input ---------- */
let AC = null,
  muted = store.get("zr3d_mute", false);
const actx = () => {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
  } catch (e) {}
  return AC;
};
function tone(f, d, type, v, f2, at) {
  if (muted) return;
  try {
    const a = actx();
    if (!a) return;
    const t = at || a.currentTime,
      o = a.createOscillator(),
      g = a.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  } catch (e) {}
}
const sfx = {
  coin() {
    tone(988, 0.07, "sine", 0.06);
    setTimeout(() => tone(1480, 0.1, "sine", 0.05), 55);
  },
  jump() {
    tone(300, 0.16, "triangle", 0.07, 620);
  },
  slide() {
    tone(260, 0.2, "sawtooth", 0.03, 120);
  },
  hit() {
    tone(180, 0.28, "sawtooth", 0.09, 55);
  },
  bust() {
    tone(120, 0.5, "square", 0.07, 40);
  },
  move() {
    tone(500, 0.05, "sine", 0.03, 420);
  },
  pow() {
    tone(520, 0.1, "square", 0.05, 1040);
    setTimeout(() => tone(1040, 0.2, "square", 0.05, 1560), 90);
  },
  shield() {
    tone(900, 0.3, "sawtooth", 0.05, 200);
  },
  close() {
    tone(1200, 0.08, "triangle", 0.05, 1800);
  },
  smash() {
    tone(150, 0.2, "sawtooth", 0.08, 40);
  },
  heli() {
    tone(90, 0.8, "sawtooth", 0.05, 70);
  },
  flip() {
    tone(420, 0.2, "triangle", 0.06, 980);
  },
  dash() {
    tone(200, 0.3, "sawtooth", 0.06, 1400);
  },
  land() {
    tone(160, 0.1, "sine", 0.06, 90);
  },
  pad() {
    tone(400, 0.3, "sawtooth", 0.05, 1200);
  },
  letter() {
    tone(700, 0.1, "triangle", 0.06, 1400);
  },
  zumary() {
    for (let i = 0; i < 5; i++)
      setTimeout(
        () => tone(523 * Math.pow(1.26, i), 0.18, "triangle", 0.06),
        i * 90,
      );
  },
};
const vib = (n) => {
  try {
    navigator.vibrate && navigator.vibrate(n);
  } catch (e) {}
};
/* ---------- soundtrack: every city has its own groove; the metro has calm station music, a train rumble and announcements ---------- */
const MUS = { step: 0, next: 0 },
  SCALE = [1, 1.0595, 1.26, 1.335, 1.5, 1.587, 1.888],
  ROOT = [146.8, 164.8, 155.6, 146.8, 174.6, 130.8],
  /* per city: tempo offset, lead voice and gain, doira (frame drum) pattern, 8th-note bass pulse */
  STYLE = [
    { bpm: 0, wave: "triangle", g: 0.018, doira: 0, pulse: 0 }, // Tashkent
    { bpm: -6, wave: "triangle", g: 0.026, doira: 1, pulse: 0 }, // Samarkand: plucked dutor + doira
    { bpm: -10, wave: "sine", g: 0.03, doira: 2, pulse: 0 }, // Bukhara: warm, slow
    { bpm: 6, wave: "square", g: 0.011, doira: 1, pulse: 0 }, // Khiva: reedy
    { bpm: -4, wave: "sine", g: 0.03, doira: 0, pulse: 0 }, // Fergana: soft
    { bpm: 10, wave: "sawtooth", g: 0.014, doira: 0, pulse: 1 }, // Neon Tashkent: synth
  ],
  STROOT = [146.8, 130.8, 164.8, 138.6, 155.6, 123.5, 174.6, 146.8, 196, 130.8];
let noiseBuf = null,
  rumble = null,
  trainT = 0,
  lastSpeak = "";
function noiseBuffer() {
  if (!noiseBuf && AC) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
/* low looping rumble of the tunnel; its volume follows how deep inside the metro we are */
function rumbleTick(on) {
  if (!AC || AC.state !== "running" || !noiseBuffer()) return;
  if (!rumble) {
    const src = AC.createBufferSource(),
      lp = AC.createBiquadFilter(),
      g = AC.createGain();
    src.buffer = noiseBuf;
    src.loop = true;
    lp.type = "lowpass";
    lp.frequency.value = 650; // phone speakers cannot play deep bass, so the rumble lives in the low-mids
    g.gain.value = 0;
    src.connect(lp);
    lp.connect(g);
    g.connect(AC.destination);
    src.start();
    rumble = g;
  }
  rumble.gain.setTargetAtTime(on, AC.currentTime, 0.25);
}
/* a train passing in the next tunnel: filtered noise sweeping up and fading */
function trainWhoosh() {
  if (muted || !AC || !noiseBuffer()) return;
  const t = AC.currentTime,
    src = AC.createBufferSource(),
    bp = AC.createBiquadFilter(),
    g = AC.createGain();
  src.buffer = noiseBuf;
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(180, t);
  bp.frequency.exponentialRampToValueAtTime(900, t + 1.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  src.connect(bp);
  bp.connect(g);
  g.connect(AC.destination);
  src.start(t);
  src.stop(t + 1.9);
}
/* phones: unlock audio and speech on the first touch, use the media channel (iOS silent switch), keep the context alive */
let VOICES = [],
  speechOk = false,
  silentEl = null;
function loadVoices() {
  try {
    VOICES = window.speechSynthesis.getVoices() || [];
  } catch (e) {}
}
try {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
} catch (e) {}
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) {}
  actx();
  try {
    if (AC && AC.state !== "running") AC.resume();
  } catch (e) {}
  if (!silentEl) {
    try {
      /* a silent looping <audio> moves older iOS Safari to the playback channel, which ignores the ring/silent switch */
      silentEl = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=");
      silentEl.loop = true;
      silentEl.volume = 0.01;
      silentEl.play().catch(() => (silentEl = null));
    } catch (e) {}
  }
  if (!voiceEl) {
    try {
      /* the same <audio> element that was unlocked by a touch plays the announcements later (iOS only allows that) */
      voiceEl = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=");
      const pr = voiceEl.play();
      if (pr && pr.then) pr.then(() => voiceEl.pause()).catch(() => {});
    } catch (e) {}
  }
  if (!speechOk) {
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechOk = true;
    } catch (e) {}
  }
  loadVoices();
}
for (const ev of ["pointerdown", "touchend", "keydown"]) addEventListener(ev, unlockAudio, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden)
    try {
      AC && AC.state !== "running" && AC.resume();
    } catch (e) {}
});
/* one bell strike: a fundamental plus two bright overtones, so it still carries on a tiny phone speaker */
function bell(f, t, d, v) {
  tone(f, d, "sine", v, 0, t);
  tone(f * 2, d * 0.6, "triangle", v * 0.5, 0, t);
  tone(f * 3, d * 0.4, "sine", v * 0.25, 0, t);
}
/* Uzbek is rarely installed as a voice: fall back to a Turkish or Russian voice, which read Uzbek Latin text well enough */
function pickVoice() {
  const prefs = LG === "ja" ? ["ja"] : LG === "uz" ? ["uz", "tr", "ru"] : ["en"];
  for (const p of prefs) {
    const v = VOICES.find((x) => x.lang && x.lang.toLowerCase().startsWith(p));
    if (v) return v;
  }
  return null;
}
/* Announcement texts: written out in normal case (ALL CAPS makes speech engines spell the letters one by one) */
const STNSAY = {
  uz: ["Mustaqillik Maydoni", "Kosmonavtlar", "Alisher Navoiy", "Paxtakor", "Mirzo Ulug'bek", "Buyuk Ipak Yo'li", "Amir Temur Xiyoboni", "Ming O'rik", "Yunus Rajabiy", "Chorsu"],
  en: ["Mustaqillik Maydoni", "Kosmonavtlar", "Alisher Navoiy", "Paxtakor", "Mirzo Ulugbek", "Buyuk Ipak Yo'li", "Amir Temur Khiyoboni", "Ming O'rik", "Yunus Rajabiy", "Chorsu"],
  ja: ["ムスタキッリク広場", "コスモナフトラル", "アリシェル・ナヴォイ", "パフタコル", "ミルゾ・ウルグベク", "ブユク・イパク・ヨリ", "アミール・ティムール大通り", "ミン・ウリク", "ユヌス・ラジャビー", "チョルスー"],
};
const STNLINE = { uz: (n) => "Navbatdagi bekat: " + n, en: (n) => "Next station: " + n, ja: (n) => "次は、" + n + "です" };
let voiceEl = null;
const STNAUD = {}; // "lang+index" -> "ok" | "no": is there a recorded file for it?
/* Real recorded announcements (audio/stn/<lang>/<index>.mp3, see tools/make_station_voice.py) win; otherwise the device's speech engine reads the line */
function speakStation(idx) {
  const lg = STNSAY[LG] ? LG : "en",
    txt = STNLINE[lg](STNSAY[lg][idx]),
    k = lg + idx;
  const synth = () => {
    try {
      const ss = window.speechSynthesis,
        v = pickVoice();
      if (!ss || !v) return;
      const u = new SpeechSynthesisUtterance(txt);
      u.voice = v;
      u.lang = v.lang;
      u.volume = 1;
      ss.cancel();
      ss.speak(u);
    } catch (e) {}
  };
  if (STNAUD[k] === "no" || !voiceEl) return synth();
  let fell = false;
  const fall = () => {
    if (fell) return;
    fell = true;
    STNAUD[k] = "no";
    synth();
  };
  voiceEl.onerror = fall;
  voiceEl.src = "audio/stn/" + lg + "/" + idx + ".mp3";
  voiceEl.volume = 1;
  const pr = voiceEl.play();
  if (pr && pr.then)
    pr.then(
      () => (STNAUD[k] = "ok"),
      () => STNAUD[k] !== "ok" && fall(),
    );
}
/* station chime ("ding-dong"), then the announcement */
function stationChime(name, idx) {
  if (muted) return;
  const a = actx();
  if (a) {
    bell(880, a.currentTime, 0.9, 0.16);
    bell(660, a.currentTime + 0.42, 1.2, 0.16);
  }
  if (idx >= 0 && idx !== lastSpeak) {
    lastSpeak = idx;
    setTimeout(() => speakStation(idx), 1300);
  }
}
function musicTick() {
  const inMetro = state === "play" && !paused && metroAmt(pz) > 0.5 && secAt(pz) === 1;
  rumbleTick(muted || state !== "play" || paused ? 0 : 0.1 * metroAmt(pz) * (secAt(pz) === 1 ? 1 : 0.4));
  if (muted || state !== "play" || paused || !AC || AC.state !== "running") return;
  const t = AC.currentTime;
  if (inMetro && t > trainT) {
    if (trainT) trainWhoosh();
    trainT = t + 7 + Math.random() * 6;
  }
  if (MUS.next < t) MUS.next = t + 0.05;
  const th = themeAt(pz),
    ST_ = STYLE[th] || STYLE[0],
    sp = 60 / (inMetro ? 84 : 112 + ST_.bpm + speed * 0.9) / 4;
  while (MUS.next < t + 0.3) {
    const s = MUS.step++ % 16,
      at = MUS.next;
    if (inMetro) {
      /* calm station music: a slow pad chord and a bell-like arpeggio in the station's own key */
      const root = STROOT[stationOf(Math.floor(pz / CH))];
      if (s === 0) for (const r of [1, 1.26, 1.5]) tone(root * r, sp * 14, "sine", 0.022, 0, at);
      if (s % 4 === 0) tone(root / 2, sp * 3, "sine", 0.05, 0, at);
      if (s % 2 === 0) tone(root * 4 * SCALE[((s / 2 + (MUS.step >> 4)) * 3) % 7 | 0], sp * 2.4, "sine", 0.012, 0, at);
    } else {
      const root = ROOT[th];
      if (s % 4 === 0) tone(120, 0.12, "sine", 0.07, 45, at);
      if (s % 2 === 1) tone(6000, 0.03, "square", 0.008, 0, at);
      if ([0, 3, 6, 8, 11, 14].includes(s)) tone((root / 2) * (s === 8 ? 1.5 : s === 14 ? 1.26 : 1), sp * 2.2, "sawtooth", 0.03, 0, at);
      if (ST_.pulse && s % 2 === 0) tone(root / 2, sp * 0.8, "square", 0.012, 0, at);
      if (ST_.doira === 1 && [0, 3, 6, 10, 12].includes(s)) tone(s % 3 ? 640 : 220, 0.07, "triangle", 0.05, 160, at); // doira: dum / tak
      if (ST_.doira === 2 && [0, 4, 7, 8, 12, 15].includes(s)) tone(s % 8 === 0 ? 200 : 700, 0.08, "triangle", 0.045, 150, at);
      if (s % 2 === 0) tone(root * 2 * SCALE[((s / 2 + (MUS.step >> 4)) % 7) | 0], sp * (ST_.wave === "triangle" ? 1.6 : 2.4), ST_.wave, ST_.g, 0, at);
    }
    MUS.next += sp;
  }
}
setInterval(musicTick, 90);
