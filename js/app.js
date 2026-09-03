// Einstieg: Daten laden, Events verdrahten, Phasenwechsel
import { loadData, role } from "./data.js";
import { state, load, onChange, emit, log, snapshot } from "./state.js";
import { render, setWake } from "./grimoire.js";
import { openNightOrder } from "./night.js";
import { openNomination, openLog, executeBlock } from "./day.js";
import { openMenu, openAudioPanel, openCandlePanel, openBluffs, openTimer, openScriptInfo } from "./panels.js";
import { closePanel, panelOpen, toast } from "./ui.js";
import * as audio from "./audio.js";
import * as candles from "./candles.js";

async function main() {
  await loadData();
  load();
  onChange(render);
  render();

  // iOS: AudioContext erst nach erster Interaktion
  document.body.addEventListener("touchstart", audio.unlock, { once: true });
  document.body.addEventListener("mousedown", audio.unlock, { once: true });
  audio.setVolume(state.settings.volume);
  audio.setSfxEnabled(state.settings.sfxEnabled !== false);
  audio.setAmbientEnabled(state.settings.ambientEnabled !== false);

  if (state.settings.espUrl && state.settings.candlesEnabled) candles.connect();

  const $ = id => document.getElementById(id);
  $("btnMenu").onclick = openMenu;
  $("btnInfo").onclick = () => panelOpen() ? closePanel() : openScriptInfo();
  $("btnPhase").onclick = togglePhase;
  $("btnNightOrder").onclick = () => panelOpen() ? closePanel() : openNightOrder();
  $("btnVote").onclick = openNomination;
  $("btnBluffs").onclick = openBluffs;
  $("btnLog").onclick = openLog;
  $("btnAudio").onclick = openAudioPanel;
  $("btnCandles").onclick = openCandlePanel;
  $("btnTimer").onclick = openTimer;
  $("btnShield").onclick = showShield;

  // Verdeck-Screen: 3× tippen zum Entsperren
  let taps = [];
  $("shield").addEventListener("click", () => {
    const now = Date.now();
    taps = taps.filter(t => now - t < 1200);
    taps.push(now);
    if (taps.length >= 3) { $("shield").classList.add("hidden"); taps = []; }
  });

  window.addEventListener("resize", render);
  window.addEventListener("orientationchange", () => setTimeout(render, 300));

  // Service Worker für Offline-Betrieb
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function showShield() {
  document.getElementById("shield").classList.remove("hidden");
}

// Marker automatisch entfernen, wenn sie keinen Sinn mehr ergeben
function cleanupMarkers(phase) {
  const patterns = phase === "night"
    // zu Nachtbeginn: nächtliche Effekte der Vornacht sind abgelaufen (werden neu gelegt)
    ? [/^poisoned$/i, /^dead$/i, /^master$/i, /^cursed$/i, /^vergiftet$/i, /^stirbt heute nacht$/i]
    // zu Tagesanbruch: Nacht-Schutz & verwerteter Executed-Marker
    : [/^protected$/i, /^safe$/i, /^executed$/i];
  const removed = [];
  for (const p of state.players) {
    p.reminders = p.reminders.filter(rm => {
      const hit = patterns.some(rx => rx.test(rm.text.trim()));
      if (hit) removed.push(`„${rm.text}“ (${p.name})`);
      return !hit;
    });
  }
  if (removed.length) log(`🧹 Abgelaufene Marker entfernt: ${removed.join(", ")}`);
}

// Bei Tagesanbruch: Dead-Marker auflösen — Ungeschützte sterben automatisch (rot markiert als letzte Tote)
function resolveNightDeaths() {
  const died = [];
  state.players.forEach((p, i) => {
    if (p.dead) return;
    const marked = p.reminders.some(rm => /^dead$|stirbt heute nacht/i.test(rm.text.trim()));
    if (!marked) return;
    p.reminders = p.reminders.filter(rm => !/^dead$|stirbt heute nacht/i.test(rm.text.trim()));
    const prot = p.roleId === "soldier" ||
      p.reminders.some(rm => /^protected$|^safe$|^geschützt$/i.test(rm.text.trim()));
    if (prot) {
      log(`🛡 ${p.name} war geschützt und überlebt die Nacht.`);
    } else {
      p.dead = true; p.ghostVote = true;
      const r = p.roleId ? role(p.roleId) : null;
      log(`💀 ${p.name}${r ? ` (${r.name})` : ""} stirbt in der Nacht.`, true);
      died.push(i);
    }
  });
  state.lastDeaths = died; // rote Markierung im Grimoire bis zur nächsten Nacht
  if (died.length) { audio.sfxDeath(); candles.syncCandles(); }
}

function togglePhase() {
  if (!state.started) { toast("Starte erst ein Spiel (☰ Menü)"); return; }
  snapshot();
  if (state.phase === "day") {
    state.phase = "night";
    state.nightCount++;
    state.lastDeaths = [];
    cleanupMarkers("night");
    log(`🌙 Nacht ${state.nightCount} beginnt.`);
    audio.sfxGong();
    if (audio.ambientName()) audio.playAmbient("night");
    candles.scene("night");
    setWake([]);
    emit();
    openNightOrder();
  } else {
    state.phase = "day";
    state.dayCount++;
    state.block = null;
    resolveNightDeaths();
    cleanupMarkers("day");
    log(`☀️ Tag ${state.dayCount} beginnt.`);
    audio.sfxRooster();
    if (audio.ambientName()) audio.playAmbient("day");
    candles.scene("day");
    candles.syncCandles();
    setWake([]);
    closePanel();
    emit();
  }
}

main();
