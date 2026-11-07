/* controller/audio.js — Procedural sound effects, soundtrack and vibration. */
"use strict";
/* ---------- audio / input ---------- */
let AC = null, muted = store.get("zr3d_mute", false);
const actx = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) {} return AC; };
function tone(f, d, type, v, f2, at) { if (muted) return; try { const a = actx(); if (!a) return; const t = at || a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
const sfx = {
  coin() { tone(988, 0.07, "sine", 0.06); setTimeout(() => tone(1480, 0.1, "sine", 0.05), 55); }, jump() { tone(300, 0.16, "triangle", 0.07, 620); }, slide() { tone(260, 0.2, "sawtooth", 0.03, 120); }, hit() { tone(180, 0.28, "sawtooth", 0.09, 55); },
  bust() { tone(120, 0.5, "square", 0.07, 40); }, move() { tone(500, 0.05, "sine", 0.03, 420); }, pow() { tone(520, 0.1, "square", 0.05, 1040); setTimeout(() => tone(1040, 0.2, "square", 0.05, 1560), 90); }, shield() { tone(900, 0.3, "sawtooth", 0.05, 200); },
  close() { tone(1200, 0.08, "triangle", 0.05, 1800); }, smash() { tone(150, 0.2, "sawtooth", 0.08, 40); }, heli() { tone(90, 0.8, "sawtooth", 0.05, 70); }, flip() { tone(420, 0.2, "triangle", 0.06, 980); }, dash() { tone(200, 0.3, "sawtooth", 0.06, 1400); }, land() { tone(160, 0.1, "sine", 0.06, 90); }, pad() { tone(400, 0.3, "sawtooth", 0.05, 1200); }, letter() { tone(700, 0.1, "triangle", 0.06, 1400); }, zumary() { for (let i = 0; i < 5; i++) setTimeout(() => tone(523 * Math.pow(1.26, i), 0.18, "triangle", 0.06), i * 90); },
};
const vib = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };
/* tiny procedural soundtrack: a bass + hat + arpeggio in a Hijaz-like scale, key changes per city */
const MUS = { step: 0, next: 0 }, SCALE = [1, 1.0595, 1.26, 1.335, 1.5, 1.587, 1.888], ROOT = [146.8, 164.8, 155.6, 146.8, 174.6, 130.8];
function musicTick() {
  if (muted || state !== "play" || paused || !AC || AC.state !== "running") return; const t = AC.currentTime; if (MUS.next < t) MUS.next = t + 0.05; const sp = 60 / (112 + speed * 0.9) / 4;
  while (MUS.next < t + 0.3) {
    const s = MUS.step++ % 16, root = ROOT[themeAt(pz)], at = MUS.next;
    if (s % 4 === 0) tone(120, 0.12, "sine", 0.07, 45, at); if (s % 2 === 1) tone(6000, 0.03, "square", 0.008, 0, at);
    if ([0, 3, 6, 8, 11, 14].includes(s)) tone((root / 2) * (s === 8 ? 1.5 : s === 14 ? 1.26 : 1), sp * 2.2, "sawtooth", 0.03, 0, at);
    if (s % 2 === 0) tone(root * 2 * SCALE[(s / 2 + (MUS.step >> 4)) % 7 | 0], sp * 1.6, "triangle", 0.018, 0, at);
    MUS.next += sp;
  }
}
setInterval(musicTick, 90);
