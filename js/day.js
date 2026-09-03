// Tag: Nominierungen, Abstimmung mit Uhrzeiger, Hinrichtung, Chronik
import { state, emit, log, snapshot, alivePlayers } from "./state.js";
import { role, iconUrl } from "./data.js";
import { el, openDialog, closeDialog, openPanel, toast, confirmDlg } from "./ui.js";
import { setTapInterceptor, render } from "./grimoire.js";
import { playerCard } from "./night.js";
import { sfxBell, sfxDeath, sfxTick } from "./audio.js";
import * as candles from "./candles.js";

let banner = null;

/* ---------- Abstimmung: Token antippen -> Banner in der Mitte -> Auszählen ---------- */
export function openNomination() {
  if (state.phase === "night") return toast("Es ist Nacht — Nominierungen nur am Tag");
  if (state.vote) return cancelVote();
  // Schritt 1: einfach den Nominierten antippen
  setTapInterceptor(i => {
    const p = state.players[i];
    const r = p.roleId ? role(p.roleId) : null;
    // Jungfrau ohne verbrauchte Fähigkeit -> Sonderbehandlung
    if (r && r.id === "virgin" && !p.reminders.some(rm => /no ability/i.test(rm.text))) {
      hideBanner(); setTapInterceptor(null);
      virginNomination(i, () => startVote(i));
      return true;
    }
    startVote(i);
    return true;
  });
  showBanner(
    el("div", { class: "vb-title" }, "⚖️ Wer wird nominiert?"),
    el("div", { class: "vb-sub" }, "Token antippen"),
    el("button", { class: "btn small", onclick: cancelVote }, "Abbrechen"));
}

function startVote(nominee) {
  state.vote = { nominee, hands: new Set(), counting: false };
  log(`⚖️ ${state.players[nominee].name} wird nominiert.`);
  sfxBell(1);
  setTapInterceptor(i => {
    const v = state.vote;
    if (!v || v.counting) return true;
    const p = state.players[i];
    if (p.dead && !p.ghostVote) { toast(`${p.name} hat keine Geiststimme mehr`); return true; }
    v.hands.has(i) ? v.hands.delete(i) : v.hands.add(i);
    updateVoteVisuals();
    return true;
  });
  const p = state.players[nominee];
  const r = p.roleId ? role(p.roleId) : null;
  showBanner(
    el("div", { class: "vb-title" },
      r ? el("img", { src: iconUrl(r), style: "width:30px;height:30px;vertical-align:middle;margin-right:6px" }) : null,
      `${p.name} steht zur Wahl`),
    el("div", { class: "vb-sub" }, "Hände durch Antippen der Tokens"),
    el("div", { class: "vb-tally" }, "0 Stimmen"),
    el("div", { style: "display:flex;gap:8px;justify-content:center" },
      el("button", { class: "btn small primary", onclick: countVote }, "🕰 Auszählen"),
      el("button", { class: "btn small", onclick: cancelVote }, "Abbrechen")));
  updateVoteVisuals();
}

function updateVoteVisuals() {
  const v = state.vote;
  document.querySelectorAll(".seat").forEach((seat, i) => {
    seat.classList.toggle("hand-up", !!v && v.hands.has(i));
    seat.classList.toggle("nominee", !!v && v.nominee === i);
    seat.querySelector(".votebadge")?.remove();
    if (v && v.hands.has(i)) seat.querySelector(".token").append(el("span", { class: "votebadge" }, "✋"));
  });
  if (banner && v) {
    const need = Math.ceil(alivePlayers().length / 2);
    const t = banner.querySelector(".vb-tally");
    if (t) t.textContent = `${v.hands.size} Stimmen · ${need} nötig`;
  }
}

function showBanner(...children) {
  hideBanner();
  banner = el("div", { class: "vote-banner" }, ...children);
  document.getElementById("stage").append(banner);
}
function hideBanner() { banner?.remove(); banner = null; }

function cancelVote() {
  state.vote = null;
  setTapInterceptor(null);
  hideBanner();
  render();
}

function countVote() {
  const v = state.vote;
  if (!v || v.counting) return;
  v.counting = true;

  let tally = 0;
  for (const i of v.hands) {
    tally++;
    const p = state.players[i];
    if (p.dead) p.ghostVote = false; // Geiststimme verbraucht
  }
  sfxTick();

  const alive = alivePlayers().length;
  const need = Math.ceil(alive / 2);
  const nomineeP = state.players[v.nominee];
  const prev = state.block; // wer aktuell "am Block" steht
  let result, imp = false;
  if (tally >= need && (!prev || tally > prev.votes)) {
    state.block = { index: v.nominee, votes: tally };
    result = `${nomineeP.name}: ${tally} Stimmen — steht am Block!`;
    imp = true;
  } else if (prev && tally === prev.votes && tally >= need) {
    state.block = null;
    result = `${nomineeP.name}: ${tally} Stimmen — Gleichstand, niemand am Block!`;
    imp = true;
  } else {
    result = `${nomineeP.name}: ${tally} Stimmen — nicht genug (${need} nötig).`;
  }
  log(result, imp);
  emit();

  openDialog({
    title: "Ergebnis",
    body: el("p", { style: "font-size:18px;line-height:1.5" }, result),
    buttons: [
      ...(state.block?.index === v.nominee ? [{
        label: "⚔️ Sofort hinrichten", class: "danger", onclick: () => { closeDialog(); executePlayer(v.nominee); } }] : []),
      { label: "Weiter", class: "primary", onclick: closeDialog },
    ],
  });
  cancelVote();
}

export function executeBlock() {
  if (state.block == null) return toast("Niemand steht am Block");
  executePlayer(state.block.index);
}

export function executePlayer(i) {
  snapshot();
  const p = state.players[i];
  const r = p.roleId ? role(p.roleId) : null;
  p.dead = true; p.ghostVote = true;
  state.block = null;
  // Executed-Marker fürs Undertaker-Grimoire (wird beim nächsten Tagesanbruch aufgeräumt)
  const utInPlay = state.players.some(q => q.roleId === "undertaker");
  p.reminders.push({ roleId: utInPlay ? "undertaker" : null, text: "Executed" });
  log(`⚔️ ${p.name}${r ? ` (${r.name})` : ""} wird hingerichtet.`, true);
  sfxBell(3);
  setTimeout(sfxDeath, 1200);
  candles.scene("death");
  candles.syncCandles();
  emit();
}

/* ---------- Chronik: nach Tag/Nacht gruppiert, ⭐ = Endauswertung ---------- */
let logFilter = "all";

// Panel neu rendern, aber Scroll-Position behalten (z. B. beim Markieren mitten in der Liste)
function refreshLog() {
  const pb = document.querySelector(".panel-body");
  const sc = pb ? pb.scrollTop : 0;
  openLog();
  requestAnimationFrame(() => {
    const pb2 = document.querySelector(".panel-body");
    if (pb2) pb2.scrollTop = sc;
  });
}

/* ---------- Tag-Fähigkeiten: Slayer & Virgin ---------- */
// Spielerauswahl (mit Charakter-/Tot-Anzeige)
function pickPlayer(title, filter, onPick) {
  const grid = el("div", { class: "rolegrid" });
  state.players.forEach((p, i) => {
    if (!filter(p)) return;
    grid.append(playerCard(i, { onclick: () => onPick(i) }));
  });
  openDialog({ title, body: grid, buttons: [{ label: "Abbrechen", onclick: closeDialog }] });
}

function isImpaired(p) {
  if (!p) return false;
  if (p.roleId === "drunk") return true;
  return p.reminders.some(rm => /drunk|poison|betrunken|vergiftet/i.test(rm.text));
}

export function slayerShot(i) {
  const slayer = state.players[i];
  if (slayer.reminders.some(rm => /no ability/i.test(rm.text))) {
    return toast("Slayer hat seine Fähigkeit bereits benutzt");
  }
  pickPlayer("🏹 Slayer — auf wen schießt er?", () => true, t => {
    closeDialog();
    snapshot();
    const target = state.players[t];
    const r = target.roleId ? role(target.roleId) : null;
    slayer.reminders.push({ roleId: "slayer", text: "No ability" });
    const imp = isImpaired(slayer);
    const isDemon = r && r.team === "demon";
    let msg, kill = false;
    if (imp) {
      msg = `🏹 ${slayer.name} ist betrunken/vergiftet — der Schuss verpufft.`;
    } else if (isDemon) {
      target.dead = true; target.ghostVote = true; kill = true;
      msg = `🏹 Slayer trifft ${target.name} (${r.name}) — DÄMON! Stirbt sofort.`;
      sfxBell(2); setTimeout(sfxDeath, 500); candles.scene("death"); candles.syncCandles();
    } else {
      msg = `🏹 ${target.name} ist kein Dämon — nichts passiert. Slayer verbraucht.`;
    }
    log(msg, kill);
    emit();
    openDialog({ title: "🏹 Slayer-Schuss",
      body: el("div", { style: "text-align:center" },
        el("div", { style: "display:flex;justify-content:center;margin-bottom:10px" }, playerCard(t, {})),
        el("p", { style: "font-size:17px;line-height:1.5" }, msg)),
      buttons: [{ label: "OK", class: "primary", onclick: closeDialog }] });
  });
}

// wird aus der Nominierung aufgerufen, wenn ein Virgin (mit Fähigkeit) nominiert wird
export function virginNomination(nomineeIdx, onProceed) {
  const virgin = state.players[nomineeIdx];
  pickPlayer("⛪ Jungfrau nominiert — wer nominiert?", () => true, j => {
    closeDialog();
    snapshot();
    const nominator = state.players[j];
    const nr = nominator.roleId ? role(nominator.roleId) : null;
    virgin.reminders.push({ roleId: "virgin", text: "No ability" });
    const imp = isImpaired(virgin);
    const isTown = nr && nr.team === "townsfolk";
    let msg, kill = false;
    if (imp) {
      msg = `⛪ ${virgin.name} ist betrunken/vergiftet — keine Wirkung. Normal abstimmen.`;
    } else if (isTown) {
      nominator.dead = true; nominator.ghostVote = true; kill = true;
      msg = `⛪ ${nominator.name} ist ein Townsfolk (${nr.name}) — wird SOFORT hingerichtet!`;
      sfxBell(3); setTimeout(sfxDeath, 800); candles.scene("death"); candles.syncCandles();
    } else {
      msg = `⛪ ${nominator.name} ist kein Townsfolk — keine Hinrichtung. Normal abstimmen.`;
    }
    log(msg, kill);
    emit();
    openDialog({ title: "⛪ Jungfrauen-Nominierung",
      body: el("div", { style: "text-align:center" },
        el("div", { style: "display:flex;justify-content:center;margin-bottom:10px" }, playerCard(j, {})),
        el("p", { style: "font-size:17px;line-height:1.5" }, msg)),
      buttons: [
        { label: "Fertig", onclick: closeDialog },
        ...(kill ? [] : [{ label: "Normal abstimmen", class: "primary", onclick: () => { closeDialog(); onProceed(); } }]),
      ] });
  });
}

export function openLog() {
  const body = el("div", {});

  const tgl = el("div", { style: "display:flex;gap:8px;margin-bottom:12px" },
    el("button", { class: "btn small" + (logFilter === "all" ? " primary" : ""),
      onclick: () => { logFilter = "all"; openLog(); } }, "Alles (Verlauf)"),
    el("button", { class: "btn small" + (logFilter === "imp" ? " primary" : ""),
      onclick: () => { logFilter = "imp"; openLog(); } }, "⭐ Wichtig (Endauswertung)"));
  body.append(tgl);

  // Eigene Notiz hinzufügen
  const inp = el("input", { type: "text", placeholder: "Eigene Notiz …" });
  const addNote = imp => {
    if (!inp.value.trim()) return;
    log(inp.value.trim(), imp);
    inp.value = ""; emit(); openLog();
  };
  body.append(el("div", { style: "display:flex;gap:6px;margin-bottom:14px" }, inp,
    el("button", { class: "btn small", onclick: () => addNote(false) }, "+"),
    el("button", { class: "btn small", onclick: () => addNote(true) }, "⭐+")));

  const entries = state.log
    .map((e, idx) => ({ ...e, idx }))
    .filter(e => logFilter === "all" || e.imp);
  if (!entries.length) body.append(el("p", { style: "color:var(--dim)" }, "Noch keine Einträge."));

  let lastPhase = null;
  for (const e of entries) {
    const ph = e.phase || "Verlauf";
    if (ph !== lastPhase) {
      body.append(el("div", { class: "teamhead" }, ph));
      lastPhase = ph;
    }
    const d = new Date(e.t);
    const row = el("div", { class: "log-entry" + (e.imp ? " imp" : "") },
      el("div", { class: "lg-text" },
        el("span", { class: "lg-time" }, d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + "  "),
        e.text),
      el("div", { class: "lg-actions" },
        el("button", { class: "lg-star" + (e.imp ? " on" : ""), title: e.imp ? "nicht mehr wichtig" : "als wichtig markieren",
          onclick: () => { state.log[e.idx].imp = !state.log[e.idx].imp; emit(); refreshLog(); } },
          e.imp ? "★" : "☆"),
        el("button", { class: "lg-star", title: "Eintrag löschen",
          onclick: () => confirmDlg(`Chronik-Eintrag löschen?\n„${e.text}“`, () => { state.log.splice(e.idx, 1); emit(); refreshLog(); }) }, "🗑")));
    body.append(row);
  }

  openPanel(logFilter === "imp" ? "Chronik · Endauswertung" : "Chronik", body);
}

