// Charakterziehen: Tablet geht reihum, jeder deckt per Halten geheim seine Karte auf
import { state } from "./state.js";
import { role, iconUrl, TEAM_NAMES } from "./data.js";
import { el, openDialog, closeDialog } from "./ui.js";
import { sfxWhoosh } from "./audio.js";
import { openSetupMarkers } from "./night.js";

export function startReveal(startIndex = 0) {
  showHandover(startIndex);
}

function showHandover(i) {
  if (i >= state.players.length) {
    closeDialog();
    openDialog({
      title: null,
      full: true,
      body: el("div", { class: "reveal-stage" },
        el("h1", {}, "Alle Charaktere verteilt"),
        el("div", { class: "rv-sub" }, "Gib das Tablet zurück an den Erzähler."),
        el("button", { class: "btn primary", style: "font-size:18px;padding:16px 40px",
          onclick: () => { closeDialog(); openSetupMarkers(); } }, "Weiter: Setup-Marker setzen")),
    });
    return;
  }
  const p = state.players[i];
  openDialog({
    title: null,
    full: true,
    body: el("div", { class: "reveal-stage" },
      el("div", { class: "rv-sub" }, `Spieler ${i + 1} von ${state.players.length}`),
      el("h1", {}, `Gib das Tablet an ${p.name}`),
      el("div", { class: "rv-sub" }, "Niemand sonst darf auf den Bildschirm schauen!"),
      el("button", {
        class: "btn primary", style: "font-size:18px;padding:16px 40px",
        onclick: () => showCard(i)
      }, `Ich bin ${p.name}`)),
  });
}

function showCard(i) {
  const p = state.players[i];
  const r = role(p.roleId);
  const card = el("div", { class: "rv-card hidden" },
    el("img", { src: iconUrl(r) }),
    el("div", { class: "rv-name" }, r.name),
    el("div", { class: "rv-team", style: teamColor(r.team) }, TEAM_NAMES[r.team] || r.team),
    el("div", { class: "rv-ability" }, r.ability));
  const hold = el("button", { class: "holdbtn" }, "🤫 Halten, um deinen Charakter zu sehen");

  let held = false;
  const show = e => { e.preventDefault(); if (held) return; held = true; card.classList.remove("hidden"); hold.classList.add("hidden"); sfxWhoosh(); };
  const hide = () => { if (!held) return; held = false; card.classList.add("hidden"); hold.classList.remove("hidden"); };
  hold.addEventListener("touchstart", show, { passive: false });
  hold.addEventListener("mousedown", show);
  for (const evt of ["touchend", "touchcancel", "mouseup", "mouseleave"]) {
    document.addEventListener(evt, hide);
  }

  openDialog({
    title: null,
    full: true,
    body: el("div", { class: "reveal-stage" },
      el("div", { class: "rv-sub" }, `${p.name} — merk dir alles, dann gib weiter.`),
      hold, card,
      el("button", {
        class: "btn", style: "margin-top:10px",
        onclick: () => {
          for (const evt of ["touchend", "touchcancel", "mouseup", "mouseleave"]) document.removeEventListener(evt, hide);
          showHandover(i + 1);
        }
      }, "✓ Gemerkt — weitergeben")),
  });
}

function teamColor(team) {
  const good = team === "townsfolk" || team === "outsider";
  return `color:${good ? "#2d5f9e" : "#a02a3a"}`;
}
