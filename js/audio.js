// Prozeduraler Sound: Ambient-Loops + Effekte, komplett ohne Audiodateien (WebAudio)
let ctx = null;
let master = null;
let ambient = null; // {stop()}
let currentAmbient = "";
let sfxOn = true;
let ambientOn = true;

export function setSfxEnabled(v) { sfxOn = v; }
export function setAmbientEnabled(v) {
  ambientOn = v;
  if (!v) stopAmbient();
}
export function sfxEnabled() { return sfxOn; }
export function ambientEnabled() { return ambientOn; }

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setVolume(v) { if (master) master.gain.value = v; else { ac(); master.gain.value = v; } }
export function ambientName() { return currentAmbient; }

// ---------- Hilfen ----------
function noiseBuffer(seconds = 2) {
  const c = ac();
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(g, t, a, peak, d, sustain = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}

// ---------- Ambients ----------
export function stopAmbient() {
  if (ambient) { ambient.stop(); ambient = null; }
  currentAmbient = "";
}

export function playAmbient(name) {
  if (!ambientOn) return;
  if (currentAmbient === name) return;
  stopAmbient();
  const c = ac();
  if (name === "night") ambient = mkNight(c);
  else if (name === "day") ambient = mkDay(c);
  else if (name === "storm") ambient = mkStorm(c);
  else if (name === "tension") ambient = mkTension(c);
  if (ambient) currentAmbient = name;
}

// Nacht: tiefer Wind + Grillen
function mkNight(c) {
  const nodes = [];
  // Wind: gefiltertes Rauschen mit LFO auf der Filterfrequenz
  const src = c.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; f.Q.value = 1.2;
  const g = c.createGain(); g.gain.value = 0.10;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = c.createGain(); lfoG.gain.value = 130;
  lfo.connect(lfoG).connect(f.frequency);
  src.connect(f).connect(g).connect(master);
  src.start(); lfo.start();
  nodes.push(src, lfo);
  // Grillen: periodische hohe Chirps
  let alive = true;
  (function chirp() {
    if (!alive) return;
    const t = c.currentTime + 0.05;
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.value = 4200 + Math.random() * 500;
      const og = c.createGain();
      const tt = t + i * 0.055;
      env(og, tt, 0.008, 0.018, 0.03);
      o.connect(og).connect(master);
      o.start(tt); o.stop(tt + 0.06);
    }
    setTimeout(chirp, 900 + Math.random() * 2600);
  })();
  return { stop() { alive = false; nodes.forEach(n => { try { n.stop(); } catch {} }); } };
}

// Tag: heller Wind + Vogelzwitschern
function mkDay(c) {
  const nodes = [];
  const src = c.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 800; f.Q.value = 0.4;
  const g = c.createGain(); g.gain.value = 0.045;
  src.connect(f).connect(g).connect(master); src.start();
  nodes.push(src);
  let alive = true;
  (function bird() {
    if (!alive) return;
    const t = c.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(); o.type = "sine";
      const f0 = 1800 + Math.random() * 1800;
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.5), tt + 0.09);
      const og = c.createGain();
      env(og, tt, 0.01, 0.03, 0.1);
      o.connect(og).connect(master);
      o.start(tt); o.stop(tt + 0.14);
      tt += 0.12 + Math.random() * 0.1;
    }
    setTimeout(bird, 1500 + Math.random() * 4000);
  })();
  return { stop() { alive = false; nodes.forEach(n => { try { n.stop(); } catch {} }); } };
}

// Sturm: starker Wind + gelegentlicher Donner
function mkStorm(c) {
  const nodes = [];
  const src = c.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400; f.Q.value = 2;
  const g = c.createGain(); g.gain.value = 0.16;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.15;
  const lfoG = c.createGain(); lfoG.gain.value = 250;
  lfo.connect(lfoG).connect(f.frequency);
  src.connect(f).connect(g).connect(master);
  src.start(); lfo.start();
  nodes.push(src, lfo);
  let alive = true;
  (function thunder() {
    if (!alive) return;
    sfxThunder();
    setTimeout(thunder, 9000 + Math.random() * 20000);
  })();
  return { stop() { alive = false; nodes.forEach(n => { try { n.stop(); } catch {} }); } };
}

// Anspannung: tiefer Moll-Drone
function mkTension(c) {
  const nodes = [];
  const freqs = [55, 65.4, 82.4]; // A1, C2, E2 – a-Moll
  const g = c.createGain(); g.gain.value = 0.05; g.connect(master);
  for (const fr of freqs) {
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr;
    const of = c.createBiquadFilter(); of.type = "lowpass"; of.frequency.value = 300;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.1 + Math.random() * 0.1;
    const lg = c.createGain(); lg.gain.value = 1.5;
    lfo.connect(lg).connect(o.detune);
    o.connect(of).connect(g);
    o.start(); lfo.start();
    nodes.push(o, lfo);
  }
  return { stop() { nodes.forEach(n => { try { n.stop(); } catch {} }); } };
}

// ---------- Effekte ----------
export function sfxGong() { // Nacht bricht an
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime;
  [98, 147, 196, 294].forEach((fr, i) => {
    const o = c.createOscillator(); o.type = "sine"; o.frequency.value = fr * (1 + i * 0.002);
    const g = c.createGain();
    env(g, t, 0.01, 0.22 / (i + 1), 3.5 + i);
    o.connect(g).connect(master); o.start(t); o.stop(t + 6);
  });
}

export function sfxRooster() { // Morgen: helle Fanfare
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime;
  const notes = [523, 659, 784, 1047];
  notes.forEach((fr, i) => {
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = fr;
    const g = c.createGain();
    env(g, t + i * 0.16, 0.02, 0.16, 0.5);
    o.connect(g).connect(master); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.8);
  });
}

export function sfxDeath() { // dumpfer Trommelschlag
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
  const g = c.createGain(); env(g, t, 0.005, 0.6, 0.7);
  o.connect(g).connect(master); o.start(t); o.stop(t + 1);
  const s = c.createBufferSource(); s.buffer = noiseBuffer(0.4);
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 250;
  const ng = c.createGain(); env(ng, t, 0.005, 0.3, 0.35);
  s.connect(f).connect(ng).connect(master); s.start(t);
}

export function sfxBell(times = 1) { // Dorfglocke (Nominierung/Hinrichtung)
  if (!sfxOn) return;
  const c = ac();
  for (let k = 0; k < times; k++) {
    const t = c.currentTime + k * 0.9;
    [660, 990, 1320].forEach((fr, i) => {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = fr;
      const g = c.createGain();
      env(g, t, 0.005, 0.25 / (i + 1), 1.6);
      o.connect(g).connect(master); o.start(t); o.stop(t + 2);
    });
  }
}

export function sfxThunder() {
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime + Math.random() * 0.2;
  const s = c.createBufferSource(); s.buffer = noiseBuffer(2.5);
  const f = c.createBiquadFilter(); f.type = "lowpass";
  f.frequency.setValueAtTime(120, t);
  f.frequency.exponentialRampToValueAtTime(40, t + 2);
  const g = c.createGain();
  env(g, t, 0.06, 0.5, 2.2);
  s.connect(f).connect(g).connect(master); s.start(t);
}

export function sfxTick() { // Timer-Endton
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = "square"; o.frequency.value = 1000;
  const g = c.createGain(); env(g, t, 0.002, 0.08, 0.06);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
}

export function sfxWhoosh() { // Charakterkarte aufdecken
  if (!sfxOn) return;
  const c = ac(); const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noiseBuffer(0.6);
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.5;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2500, t + 0.35);
  const g = c.createGain(); env(g, t, 0.05, 0.25, 0.4);
  s.connect(f).connect(g).connect(master); s.start(t);
}

export function unlock() { ac(); } // beim ersten Touch aufrufen (iOS)
