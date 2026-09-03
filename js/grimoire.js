// Das Grimoire: Spielerkreis, Tokens, Erinnerungsmarker, Spielermenü
import { state, emit, log, snapshot } from "./state.js";
import { role, iconUrl, TEAM_NAMES } from "./data.js";
import { el, openDialog, closeDialog, toast, confirmDlg } from "./ui.js";
import { sfxDeath } from "./audio.js";
import * as candles from "./candles.js";
import { showBluffs, showThisIsTheDemon, showTheseAreYourMinions } from "./cards.js";
import { slayerShot } from "./day.js";

let wakeHighlight = new Set(); // Spieler-Indizes, die gerade "geweckt" werden
export function setWake(indices) { wakeHighlight = new Set(indices); render(); }

// vom Tag/Vote-Modul gesetzt: (index) => bool  – true = Tap wurde konsumiert
export let tapInterceptor = null;
export function setTapInterceptor(fn) { tapInterceptor = fn; }

export function render() {
  const circle = document.getElementById("circle");
  const stage = document.getElementById("stage");
  circle.innerHTML = "";

  const n = state.players.length;
  const center = document.getElementById("centerInfo");
  if (!n) {
    center.innerHTML = `<div class="ci-phase">Blood on the Clocktower</div>
      <div class="ci-sub">Noch kein Spiel — öffne das Menü (☰) und starte ein neues Spiel.</div>`;
    return;
  }

  const W = stage.clientWidth, H = stage.clientHeight;
  const rx = W / 2 - 90, ry = H / 2 - 85;

  state.players.forEach((p, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    let x = W / 2 + rx * Math.cos(ang);
    let y = H / 2 + ry * Math.sin(ang);
    if (p.pos) { x = p.pos.x * W; y = p.pos.y * H; } // frei platziert
    const r = role(p.roleId);
    // stirbt diese Nacht ungeschützt? (Dead-Marker, kein Schutz, noch am Leben)
    const dyingUnprotected = !p.dead
      && p.reminders.some(rm => /^dead$|stirbt heute nacht/i.test(rm.text.trim()))
      && !(p.roleId === "soldier" || p.reminders.some(rm => /^protected$|^safe$|^geschützt$/i.test(rm.text.trim())));
    const seat = el("div", {
      class: "seat" + (p.dead ? " dead" : "") + (r ? " team-" + r.team : "") + (wakeHighlight.has(i) ? " wake" : "")
        + ((state.lastDeaths || []).includes(i) ? " fresh-dead" : "")
        + (dyingUnprotected ? " dying" : ""),
      style: `left:${x}px;top:${y}px`,
    });

    const token = el("div", { class: "token", onclick: () => {
      if (suppressClick) return;
      if (tapInterceptor && tapInterceptor(i)) return;
      openPlayerMenu(i);
    }});
    makeDraggable(token, seat, p, stage, x, y);
    if (r) token.append(el("img", { src: iconUrl(r), alt: r.name }));
    else token.append(el("span", { class: "no-role" }, "?"));
    if (p.dead) token.append(el("div", { class: "shroud" }));
    if (p.dead && p.ghostVote) token.append(el("span", { class: "ghostvote", title: "Geiststimme übrig" }, "🪦"));
    if (!p.dead && state.settings.candlesEnabled) token.append(el("div", { class: "flame" }));
    seat.append(token);

    seat.append(el("div", { class: "pname" }, p.name));
    if (r) seat.append(el("div", { class: "rname" }, r.name));

    if (p.reminders.length) {
      const rems = el("div", { class: "reminders" });
      p.reminders.forEach(rem => {
        // Entfernen nur im Spielermenü — Tipp auf den Chip öffnet es (kein versehentliches Löschen)
        const chip = el("span", { class: "rem" + (rem.roleId ? "" : " generic"),
          onclick: e => { e.stopPropagation(); if (!suppressClick) openPlayerMenu(i); } });
        if (rem.roleId) chip.append(el("img", { src: iconUrl(role(rem.roleId)) }));
        chip.append(rem.text);
        rems.append(chip);
      });
      seat.append(rems);
    }
    circle.append(seat);
  });

  renderCenter();
}

function renderCenter() {
  const center = document.getElementById("centerInfo");
  const alive = state.players.filter(p => !p.dead).length;
  const votesNeeded = Math.ceil(alive / 2);
  const phaseTxt = state.phase === "night" ? `🌙 Nacht ${state.nightCount}` : (state.dayCount ? `☀️ Tag ${state.dayCount}` : "Vorbereitung");
  center.innerHTML = `
    <div class="ci-phase">${phaseTxt}</div>
    <div class="ci-sub">${state.scriptName}</div>
    <div class="ci-alive">${alive} / ${state.players.length} am Leben · ${votesNeeded} Stimmen zur Hinrichtung</div>`;
  document.getElementById("phaseLabel").textContent = phaseTxt;
  document.getElementById("btnPhase").innerHTML = state.phase === "night" ? "☀️ Tag anbrechen" : "🌙 Nacht beginnen";
}

/* ---------- Token frei im Raum platzieren (Drag) ---------- */
let suppressClick = false;

function makeDraggable(token, seat, p, stage, cx, cy) {
  let pid = null, sx = 0, sy = 0, dragging = false;

  token.addEventListener("pointerdown", e => {
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragging = false;
  });
  token.addEventListener("pointermove", e => {
    if (pid === null || e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 14) {
      dragging = true;
      try { token.setPointerCapture(pid); } catch {}
      seat.classList.add("dragging");
      seat.style.transition = "none";
    }
    if (dragging) {
      seat.style.left = (cx + dx) + "px";
      seat.style.top = (cy + dy) + "px";
    }
  });
  const end = e => {
    if (pid === null || (e.pointerId !== undefined && e.pointerId !== pid)) return;
    if (dragging) {
      const W = stage.clientWidth, H = stage.clientHeight;
      const nx = cx + (e.clientX - sx), ny = cy + (e.clientY - sy);
      p.pos = {
        x: Math.min(0.96, Math.max(0.04, nx / W)),
        y: Math.min(0.94, Math.max(0.06, ny / H)),
      };
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      emit();
    }
    pid = null; dragging = false;
    seat.classList.remove("dragging");
  };
  token.addEventListener("pointerup", end);
  token.addEventListener("pointercancel", () => { pid = null; dragging = false; seat.classList.remove("dragging"); });
}

export function resetLayout() {
  for (const p of state.players) delete p.pos;
  emit();
}

/* ---------- Spielermenü ---------- */
function openPlayerMenu(i) {
  const p = state.players[i];
  const r = role(p.roleId);
  const body = el("div", {});

  if (r) {
    body.append(el("div", { style: "display:flex;gap:12px;align-items:center;margin-bottom:10px" },
      el("img", { src: iconUrl(r), style: "width:56px;height:56px" }),
      el("div", {},
        el("div", { style: "font-size:18px;color:var(--parchment)" }, r.name + " · " + (TEAM_NAMES[r.team] || r.team)),
        el("div", { style: "font-size:13.5px;color:var(--dim);line-height:1.35" }, r.ability))));
  }

  const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" });
  const act = (label, fn, cls = "") => grid.append(el("button", { class: "btn " + cls, onclick: fn }, label));

  act(p.dead ? "💚 Wiederbeleben" : "💀 Stirbt", () => {
    snapshot();
    p.dead = !p.dead;
    if (p.dead) { p.ghostVote = true; log(`💀 ${p.name} (${r ? r.name : "?"}) stirbt.`, true); sfxDeath(); candles.scene("death"); }
    else log(`💚 ${p.name} lebt wieder.`, true);
    candles.syncCandles();
    closeDialog(); emit();
  }, p.dead ? "" : "danger");

  if (p.dead) {
    act(p.ghostVote ? "🪦 Geistvote nutzen" : "🪦 Geistvote zurück", () => { p.ghostVote = !p.ghostVote; closeDialog(); emit(); });
  }
  act("🎭 Charakter ändern", () => pickRole(id => { snapshot(); p.roleId = id; log(`🎭 ${p.name} ist jetzt ${id ? role(id).name : "ohne Charakter"}.`, true); closeDialog(); emit(); }, true));
  act("🔖 Marker hinzufügen", () => pickReminder(rem => { p.reminders.push(rem); closeDialog(); emit(); }));
  if (r?.team === "demon") {
    act("🎭 Bluffs zeigen", showBluffs);
    act("👥 „Deine Schergen“-Karte", showTheseAreYourMinions);
  }
  if (r?.team === "minion") {
    act("😈 „DIES ist der Dämon“-Karte", showThisIsTheDemon);
  }
  if (r?.id === "slayer") {
    act("🏹 Slayer-Schuss", () => { closeDialog(); slayerShot(i); });
  }
  act("✏️ Umbenennen", () => {
    const inp = el("input", { type: "text", value: p.name });
    openDialog({ title: "Name", body: inp, buttons: [
      { label: "OK", class: "primary", onclick: () => { p.name = inp.value.trim() || p.name; closeDialog(); emit(); } }] });
  });
  act("↔️ Verschieben", () => movePlayer(i));
  act("➕ Nachbar einfügen", () => {
    snapshot();
    state.players.splice(i + 1, 0, { name: `Spieler ${state.players.length + 1}`, roleId: null, dead: false, ghostVote: true, reminders: [], note: "" });
    closeDialog(); emit();
  });
  act("🗑 Entfernen", () => confirmDlg(`${p.name} aus dem Spiel entfernen?`, () => { snapshot(); state.players.splice(i, 1); candles.syncCandles(); emit(); }), "danger");
  body.append(grid);

  if (p.reminders.length) {
    body.append(el("div", { class: "teamhead" }, "Marker (✕ entfernt)"));
    const wrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
    p.reminders.forEach((rem, ri) => {
      const chip = el("button", { class: "btn small", style: "display:inline-flex;align-items:center;gap:6px",
        onclick: () => { p.reminders.splice(ri, 1); emit(); closeDialog(); openPlayerMenu(i); } });
      if (rem.roleId) chip.append(el("img", { src: iconUrl(role(rem.roleId)), style: "width:20px;height:20px" }));
      chip.append(rem.text + " ✕");
      wrap.append(chip);
    });
    body.append(wrap);
  }

  const note = el("textarea", { rows: 2, placeholder: "Notiz zu diesem Spieler …", style: "margin-top:10px" }, p.note || "");
  note.addEventListener("input", () => { p.note = note.value; });
  note.addEventListener("change", () => emit());
  body.append(note);

  openDialog({ title: p.name, body });
}

function movePlayer(i) {
  const p = state.players[i];
  const body = el("div", { style: "display:flex;gap:10px" },
    el("button", { class: "btn", style: "flex:1", onclick: () => shift(-1) }, "⟲ Gegen Uhrzeigersinn"),
    el("button", { class: "btn", style: "flex:1", onclick: () => shift(1) }, "⟳ Im Uhrzeigersinn"));
  function shift(d) {
    const j = (i + d + state.players.length) % state.players.length;
    [state.players[i], state.players[j]] = [state.players[j], state.players[i]];
    i = j;
    emit();
  }
  openDialog({ title: `${p.name} verschieben`, body,
    buttons: [{ label: "Fertig", class: "primary", onclick: closeDialog }] });
}

/* ---------- Rollen-Picker ---------- */
export function pickRole(onPick, includeAll = false) {
  const body = el("div", {});
  const teams = ["townsfolk", "outsider", "minion", "demon", "traveler", "fabled"];
  const pool = includeAll ? [...new Set([...state.scriptRoles, ...allExtraIds()])] : state.scriptRoles;
  for (const team of teams) {
    const ids = pool.filter(id => role(id)?.team === team);
    if (!ids.length) continue;
    body.append(el("div", { class: "teamhead" }, TEAM_NAMES[team]));
    const g = el("div", { class: "rolegrid" });
    for (const id of ids) {
      const r = role(id);
      const card = el("div", { class: `rolecard t-${team}`, onclick: () => onPick(id) },
        el("img", { src: iconUrl(r) }), el("div", { class: "rc-name" }, r.name));
      card.title = r.ability;
      g.append(card);
    }
    body.append(g);
  }
  body.append(el("button", { class: "btn small", style: "margin-top:12px", onclick: () => onPick(null) }, "Kein Charakter (leeres Token)"));
  openDialog({ title: "Charakter wählen", body });
}

function allExtraIds() {
  // Traveller + Fabled aller Editionen zusätzlich anbieten
  return [...state.scriptRoles];
}

/* ---------- Marker-Picker ---------- */
function pickReminder(onPick) {
  const body = el("div", {});
  const inPlay = [...new Set(state.players.map(p => p.roleId).filter(Boolean))];
  const others = state.scriptRoles.filter(id => !inPlay.includes(id));

  const addGroup = (title, ids) => {
    if (!ids.length) return;
    body.append(el("div", { class: "teamhead" }, title));
    const wrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
    for (const id of ids) {
      const r = role(id);
      for (const rem of (r.reminders || [])) {
        wrap.append(el("button", { class: "btn small", style: "display:inline-flex;align-items:center;gap:6px",
          onclick: () => onPick({ roleId: id, text: rem }) },
          el("img", { src: iconUrl(r), style: "width:20px;height:20px" }), rem));
      }
      if (r.remindersGlobal) for (const rem of r.remindersGlobal) {
        wrap.append(el("button", { class: "btn small", style: "display:inline-flex;align-items:center;gap:6px",
          onclick: () => onPick({ roleId: id, text: rem }) },
          el("img", { src: iconUrl(r), style: "width:20px;height:20px" }), rem));
      }
    }
    body.append(wrap);
  };
  addGroup("Rollen im Spiel", inPlay);

  body.append(el("div", { class: "teamhead" }, "Allgemein"));
  const gen = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
  for (const txt of ["Gut", "Böse", "Betrunken", "Vergiftet", "Stirbt heute Nacht", "Geschützt", "Nominiert", "Custom …"]) {
    gen.append(el("button", { class: "btn small", onclick: () => {
      if (txt === "Custom …") {
        const inp = el("input", { type: "text", placeholder: "Markertext" });
        openDialog({ title: "Eigener Marker", body: inp, buttons: [
          { label: "OK", class: "primary", onclick: () => { if (inp.value.trim()) onPick({ roleId: null, text: inp.value.trim() }); } }] });
      } else onPick({ roleId: null, text: txt });
    } }, txt));
  }
  body.append(gen);
  addGroup("Nicht im Spiel", others);

  openDialog({ title: "Erinnerungsmarker", body });
}
