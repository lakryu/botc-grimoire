// Panels: Sounds, Kerzen, Bluffs, Menü, Timer
import { state, emit, log, resetGame, undo } from "./state.js";
import { role, iconUrl, FABLED, TEAM_NAMES, META_FIRST } from "./data.js";
import { el, openPanel, openDialog, closeDialog, toast, confirmDlg } from "./ui.js";
import * as audio from "./audio.js";
import * as candles from "./candles.js";
import { pickRole, resetLayout } from "./grimoire.js";
import { openSetup } from "./setup.js";
import { openSetupMarkers } from "./night.js";
import { startReveal } from "./reveal.js";

/* ---------- Sound-Panel ---------- */
export function openAudioPanel() {
  const body = el("div", {});

  // Master-Schalter
  const sfxRow = el("div", { class: "snd-row" },
    el("span", { class: "snd-name" }, "🔔 Effekte / Auto-Sounds"),
    el("button", { class: "btn small" + (state.settings.sfxEnabled !== false ? " primary" : ""), onclick: () => {
      state.settings.sfxEnabled = !(state.settings.sfxEnabled !== false);
      audio.setSfxEnabled(state.settings.sfxEnabled); emit(); openAudioPanel();
    } }, state.settings.sfxEnabled !== false ? "An" : "Aus"));
  const ambRow = el("div", { class: "snd-row" },
    el("span", { class: "snd-name" }, "🎵 Ambiente-Sounds"),
    el("button", { class: "btn small" + (state.settings.ambientEnabled !== false ? " primary" : ""), onclick: () => {
      const on = !(state.settings.ambientEnabled !== false);
      state.settings.ambientEnabled = on;
      audio.setAmbientEnabled(on); emit(); openAudioPanel();
    } }, state.settings.ambientEnabled !== false ? "An" : "Aus"));
  body.append(el("div", { class: "teamhead", style: "margin-top:0" }, "Sound an/aus"), sfxRow, ambRow);

  const ambientOff = state.settings.ambientEnabled === false;
  const sfxOff = state.settings.sfxEnabled === false;

  if (!ambientOff) {
    body.append(el("div", { class: "teamhead" }, "Ambiente (Loop)"));
    const ambients = [["night", "🌙 Nachtstimmung"], ["day", "☀️ Tagstimmung"], ["storm", "⛈ Sturm"], ["tension", "😰 Anspannung"]];
    for (const [id, name] of ambients) {
      const row = el("div", { class: "snd-row" },
        el("span", { class: "snd-name" }, name),
        el("button", { class: "btn small" + (audio.ambientName() === id ? " primary" : ""), onclick: () => {
          audio.ambientName() === id ? audio.stopAmbient() : audio.playAmbient(id);
          openAudioPanel();
        } }, audio.ambientName() === id ? "◼ Stop" : "▶ Play"));
      body.append(row);
    }
    body.append(el("div", { class: "snd-row" },
      el("span", { class: "snd-name" }, "🔇 Alles aus"),
      el("button", { class: "btn small", onclick: () => { audio.stopAmbient(); openAudioPanel(); } }, "Stop")));
  }

  body.append(el("div", { class: "teamhead" }, "Lautstärke"));
  const vol = el("input", { type: "range", min: 0, max: 1, step: 0.05, value: state.settings.volume, style: "width:100%" });
  vol.addEventListener("input", () => { state.settings.volume = +vol.value; audio.setVolume(+vol.value); });
  vol.addEventListener("change", () => emit());
  body.append(vol);

  if (!sfxOff) {
    body.append(el("div", { class: "teamhead" }, "Effekte testen"));
    const sfx = el("div", { class: "sfx-grid" });
    const fx = [
      ["🔔 Gong (Nacht)", audio.sfxGong], ["🐓 Fanfare (Morgen)", audio.sfxRooster],
      ["🛎 Dorfglocke", () => audio.sfxBell(1)], ["🥁 Todestrommel", audio.sfxDeath],
      ["⚡ Donner", audio.sfxThunder], ["💨 Whoosh", audio.sfxWhoosh],
    ];
    for (const [name, fn] of fx) sfx.append(el("button", { class: "btn", onclick: fn }, name));
    body.append(sfx);
  }
  body.append(el("p", { style: "font-size:12px;color:var(--dim);margin-top:14px" },
    "Alle Sounds werden live im Browser erzeugt — keine Dateien, funktioniert offline."));
  openPanel("Sounds", body);
}

/* ---------- Kerzen-Panel ---------- */
export function openCandlePanel() {
  const body = el("div", {});
  body.append(el("div", { class: "snd-row" },
    el("span", { class: "snd-name" }, "Kerzen-Flammen im Grimoire"),
    el("button", { class: "btn small" + (state.settings.candlesEnabled ? " primary" : ""), onclick: () => {
      state.settings.candlesEnabled = !state.settings.candlesEnabled; emit(); openCandlePanel();
    } }, state.settings.candlesEnabled ? "An" : "Aus")));

  const strip = el("div", { class: "candle-strip" });
  state.players.forEach(p => {
    strip.append(el("div", { class: "candle-mini" + (p.dead ? " out" : "") },
      el("div", { class: "cm-flame" }), p.name.slice(0, 8)));
  });
  if (state.players.length) {
    body.append(el("div", { class: "teamhead" }, "Kerzenstatus (Sitzreihenfolge)"), strip);
  }

  body.append(el("div", { class: "teamhead" }, "ESP32-Verbindung"));
  const status = el("p", { style: "font-size:14px" },
    el("span", { class: "conn-dot" + (candles.isConnected() ? " on" : "") }),
    candles.isConnected() ? "Verbunden" : "Nicht verbunden");
  const inp = el("input", { type: "text", placeholder: "ws://192.168.x.x:81", value: state.settings.espUrl });
  inp.addEventListener("change", () => { state.settings.espUrl = inp.value; emit(); });
  body.append(status, el("label", { class: "fld" }, "WebSocket-Adresse des ESP32"), inp,
    el("div", { style: "display:flex;gap:8px;margin-top:10px" },
      el("button", { class: "btn small primary", onclick: () => { state.settings.espUrl = inp.value; emit(); candles.connect(); setTimeout(openCandlePanel, 600); } }, "Verbinden"),
      el("button", { class: "btn small", onclick: () => { candles.disconnect(); openCandlePanel(); } }, "Trennen"),
      el("button", { class: "btn small", onclick: () => candles.syncCandles() }, "Kerzen sync")),
    el("div", { class: "teamhead" }, "Szenen testen"),
    el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      ...["night", "day", "death", "off"].map(s =>
        el("button", { class: "btn small", onclick: () => candles.scene(s) }, s))),
    el("p", { style: "font-size:12px;color:var(--dim);margin-top:14px;line-height:1.5" },
      "Die App sendet JSON über WebSocket: Kerzenzustände pro Sitzplatz (1 = an, 0 = aus) und Szenen. ",
      "Eine fertige ESP32-Firmware liegt im Projektordner unter esp32/candles/candles.ino — Details in esp32/README.md."));
  candles.onStatus(() => {}); // status wird beim Neuöffnen aktualisiert
  openPanel("Kerzen", body);
}

/* ---------- Bluffs ---------- */
export function openBluffs() {
  const body = el("div", {});
  body.append(el("p", { style: "font-size:14px;color:var(--dim);margin-top:0" },
    "Drei gute Charaktere, die nicht im Spiel sind — zeige sie dem Dämon in der ersten Nacht."));
  const row = el("div", { style: "display:flex;gap:12px;justify-content:center" });
  state.bluffs.forEach((id, i) => {
    const r = id ? role(id) : null;
    const slot = el("div", { class: "rolecard" + (r ? ` t-${r.team}` : ""), style: "width:100px", onclick: () => {
      pickBluff(i);
    } });
    if (r) { slot.append(el("img", { src: iconUrl(r) }), el("div", { class: "rc-name" }, r.name)); }
    else slot.append(el("div", { style: "font-size:34px;padding:12px" }, "❓"), el("div", { class: "rc-name" }, "wählen"));
    row.append(slot);
  });
  body.append(row);

  const inPlay = new Set(state.players.map(p => p.roleId));
  body.append(el("button", { class: "btn small", style: "margin-top:14px", onclick: () => {
    const goodOut = state.scriptRoles.filter(id => {
      const r = role(id);
      return (r.team === "townsfolk" || r.team === "outsider") && !inPlay.has(id);
    });
    for (let i = goodOut.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [goodOut[i], goodOut[j]] = [goodOut[j], goodOut[i]]; }
    state.bluffs = [goodOut[0] || null, goodOut[1] || null, goodOut[2] || null];
    emit(); openBluffs();
  } }, "🎲 Zufällig vorschlagen"));

  openDialog({ title: "Dämonen-Bluffs", body,
    buttons: [{ label: "Fertig", class: "primary", onclick: closeDialog }] });
}

// Bluff-Picker: nur gute Charaktere; im Spiel befindliche und schon gewählte Bluffs sind gesperrt
function pickBluff(slot) {
  const inPlay = new Set(state.players.map(p => p.roleId).filter(Boolean));
  const usedAsBluff = new Set(state.bluffs.filter((id, i) => id && i !== slot));
  const body = el("div", {});
  body.append(el("p", { style: "font-size:13px;color:var(--dim);margin-top:0" },
    "Rot markiert = wurde gezogen, ist im Spiel — kein gültiger Bluff."));

  for (const team of ["townsfolk", "outsider"]) {
    const ids = state.scriptRoles.filter(id => role(id)?.team === team);
    if (!ids.length) continue;
    body.append(el("div", { class: "teamhead" }, TEAM_NAMES[team]));
    const g = el("div", { class: "rolegrid" });
    for (const id of ids) {
      const r = role(id);
      const taken = inPlay.has(id);
      const used = usedAsBluff.has(id);
      const card = el("div", {
        class: `rolecard t-${team}` + (taken ? " inplay" : "") + (used ? " sel" : ""),
        onclick: () => {
          if (used) return toast(`${r.name} ist schon ein anderer Bluff`);
          if (taken) {
            openDialog({
              title: "⚠️ Charakter ist im Spiel",
              body: el("p", { style: "font-size:16px;line-height:1.5" },
                `${r.name} wurde gezogen und ist im Spiel. Normalerweise bekommt der Dämon nur Charaktere als Bluff, die NICHT im Spiel sind. Trotzdem als Bluff setzen?`),
              buttons: [
                { label: "Abbrechen", onclick: () => pickBluff(slot) },
                { label: "Trotzdem setzen", class: "danger", onclick: () => {
                    state.bluffs[slot] = id;
                    closeDialog(); emit(); openBluffs();
                  } },
              ],
            });
            return;
          }
          state.bluffs[slot] = id;
          closeDialog(); emit(); openBluffs();
        },
      }, el("img", { src: iconUrl(r) }), el("div", { class: "rc-name" }, r.name));
      if (taken) card.append(el("div", { class: "rc-flag" }, "im Spiel"));
      if (used) card.append(el("div", { class: "rc-flag gold" }, "Bluff"));
      card.title = r.ability;
      g.append(card);
    }
    body.append(g);
  }
  body.append(el("button", { class: "btn small", style: "margin-top:12px",
    onclick: () => { state.bluffs[slot] = null; closeDialog(); emit(); openBluffs(); } }, "Slot leeren"));
  openDialog({ title: `Bluff ${slot + 1} wählen`, body });
}

/* ---------- Fabled ---------- */
function openFabled() {
  const body = el("div", {});
  body.append(el("p", { style: "font-size:13px;color:var(--dim)" }, "Fabled sind optionale Erzähler-Charaktere."));
  const g = el("div", { class: "rolegrid" });
  for (const f of FABLED) {
    const sel = state.fabled.includes(f.id);
    const card = el("div", { class: "rolecard t-fabled" + (sel ? " sel" : ""), onclick: () => {
      sel ? state.fabled.splice(state.fabled.indexOf(f.id), 1) : state.fabled.push(f.id);
      emit(); openFabled();
    } }, el("img", { src: iconUrl(f) }), el("div", { class: "rc-name" }, f.name));
    card.title = f.ability;
    g.append(card);
  }
  body.append(g);
  openDialog({ title: "Fabled", body, buttons: [{ label: "Fertig", class: "primary", onclick: closeDialog }] });
}

/* ---------- Skript-Übersicht (Referenz) ---------- */
export function openScriptInfo() {
  if (!state.scriptRoles.length) return toast("Starte erst ein Spiel (☰ Menü)");
  const body = el("div", {});
  const inPlay = new Set(state.players.map(p => p.roleId).filter(Boolean));

  // Tab-Umschalter
  let tab = openScriptInfo._tab || "first";
  const tabs = el("div", { style: "display:flex;gap:6px;margin-bottom:12px;position:sticky;top:0;background:var(--panel);padding-bottom:6px;z-index:1" });
  const mkTab = (id, label) => el("button", { class: "btn small" + (tab === id ? " primary" : ""),
    onclick: () => { openScriptInfo._tab = id; openScriptInfo(); } }, label);
  tabs.append(mkTab("first", "🌙 Erste Nacht"), mkTab("other", "🌒 Weitere Nächte"), mkTab("all", "📋 Alle Charaktere"));
  body.append(tabs);

  if (tab === "first" || tab === "other") {
    const first = tab === "first";
    const key = first ? "firstNight" : "otherNight";
    const remKey = first ? "firstNightReminder" : "otherNightReminder";
    const list = [];
    if (first) for (const m of META_FIRST) list.push({ order: m.firstNight, name: m.name, reminder: m.firstNightReminder, meta: true, team: m.team });
    for (const id of state.scriptRoles) {
      const r = role(id);
      if (r && r[key]) list.push({ order: r[key], name: r.name, reminder: r[remKey], team: r.team, id });
    }
    list.sort((a, b) => a.order - b.order);
    body.append(el("p", { style: "font-size:12.5px;color:var(--dim);margin-top:0" },
      "Vollständige Reihenfolge des Skripts. Fett = im Spiel." + (first ? "" : " (Nächte 2+)")));
    let n = 1;
    for (const e of list) {
      const active = e.id && inPlay.has(e.id);
      const item = el("div", { class: "no-item t-" + e.team, style: "cursor:default" + (active ? "" : ";opacity:.62") });
      if (e.id) item.append(el("img", { src: iconUrl(role(e.id)) }));
      else item.append(el("div", { style: "width:42px;text-align:center;font-size:22px" }, e.team === "demon" ? "😈" : "👥"));
      item.append(el("div", { style: "min-width:0" },
        el("div", { class: "noi-name", style: active ? "font-weight:bold;color:var(--parchment)" : "" }, `${n++}. ${e.name}`),
        e.reminder ? el("div", { class: "noi-rem" }, e.reminder) : null));
      body.append(item);
    }
  } else {
    // Alle Charaktere nach Team
    for (const team of ["townsfolk", "outsider", "minion", "demon", "traveler", "fabled"]) {
      const ids = state.scriptRoles.filter(id => role(id)?.team === team);
      if (!ids.length) continue;
      body.append(el("div", { class: "teamhead" }, `${TEAM_NAMES[team]} (${ids.length})`));
      for (const id of ids) {
        const r = role(id);
        const active = inPlay.has(id);
        body.append(el("div", { class: "no-item t-" + team, style: "cursor:default" + (active ? "" : ";opacity:.62") },
          el("img", { src: iconUrl(r) }),
          el("div", { style: "min-width:0" },
            el("div", { class: "noi-name", style: active ? "font-weight:bold;color:var(--parchment)" : "" }, r.name + (active ? " ✓" : "")),
            el("div", { class: "noi-rem" }, r.ability))));
      }
    }
  }
  openPanel(`Skript: ${state.scriptName}`, body);
}

/* ---------- Hauptmenü ---------- */
export function openMenu() {
  const body = el("div", { style: "display:flex;flex-direction:column;gap:10px" });
  const item = (label, fn, cls = "") => body.append(el("button", { class: "btn " + cls, style: "text-align:left;font-size:17px;padding:14px", onclick: fn }, label));

  item("🆕 Neues Spiel", () => { closeDialog(); openSetup(); }, "primary");
  if (state.started) {
    item("📲 Charakterziehen erneut starten", () => { closeDialog(); startReveal(); });
    item("🧷 Setup-Marker setzen", () => { closeDialog(); openSetupMarkers(); });
    item("🧚 Fabled verwalten", () => { closeDialog(); openFabled(); });
    if (state.players.some(p => p.pos)) {
      item("⭕ Tokens wieder im Kreis anordnen", () => { resetLayout(); closeDialog(); });
    }
    item("↩️ Rückgängig (letzter großer Schritt)", () => { undo() ? toast("Rückgängig gemacht") : toast("Nichts rückgängig zu machen"); });
    item("🗑 Spiel zurücksetzen", () => confirmDlg("Aktuelles Spiel wirklich verwerfen?", () => { resetGame(); closeDialog(); }), "danger");
  }
  const hintsOn = state.settings.cardHints !== false;
  item(`💬 Hinweistexte auf Info-Karten: ${hintsOn ? "An" : "Aus"}`, () => {
    state.settings.cardHints = !hintsOn;
    emit(); closeDialog(); openMenu();
  });
  item("⛶ Vollbild", () => {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  });
  body.append(el("p", { style: "font-size:12px;color:var(--dim);margin:6px 0 0" },
    "Tipp fürs iPad: In Safari „Zum Home-Bildschirm hinzufügen“ — dann läuft die App im Vollbild und offline."));
  openDialog({ title: "Menü", body });
}

/* ---------- Timer ---------- */
let timerInt = null, timerEnd = 0;
export function openTimer() {
  if (timerInt) {
    stopTimer();
    return;
  }
  const body = el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;justify-content:center" });
  for (const min of [1, 2, 3, 5, 10]) {
    body.append(el("button", { class: "btn", style: "font-size:18px;padding:16px 22px", onclick: () => { closeDialog(); startTimer(min * 60); } }, `${min} min`));
  }
  openDialog({ title: "Diskussions-Timer", body });
}

function startTimer(secs) {
  timerEnd = Date.now() + secs * 1000;
  const disp = document.getElementById("timerDisplay");
  disp.classList.remove("hidden");
  document.getElementById("btnTimer").classList.add("active");
  timerInt = setInterval(() => {
    const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    disp.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    disp.classList.toggle("urgent", left <= 30);
    if (left <= 0) {
      stopTimer();
      audio.sfxBell(3);
      toast("⏳ Zeit abgelaufen!");
    }
  }, 250);
}

function stopTimer() {
  clearInterval(timerInt); timerInt = null;
  document.getElementById("timerDisplay").classList.add("hidden");
  document.getElementById("btnTimer").classList.remove("active");
}
