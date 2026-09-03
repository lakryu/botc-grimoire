// Nacht-Reihenfolge: gefilterte Liste, abhakbar, weckt (highlightet) Spieler
import { state, emit, log } from "./state.js";
import { role, iconUrl, META_FIRST } from "./data.js";
import { el, openPanel, openDialog, closeDialog, toast } from "./ui.js";
import { setWake } from "./grimoire.js";
import { showBluffs, showThisIsTheDemon, showTheseAreYourMinions, showYouAre, showYouAreGood, showYouAreEvil, showCard } from "./cards.js";
import { hasAbility, runAbility, canRun } from "./abilities.js";

// ECHTE Setup-Marker: werden vom Erzähler VOR der ersten Nacht gelegt und nie neu vergeben.
// (Alle anderen Marker wählt die Rolle im Spiel selbst — z. B. Poisoner „Poisoned" erste Nacht,
//  Monk „Protected" jede Nacht, Virgin „No ability" beim Auslösen am Tag.)
const SETUP_MARKERS = new Set([
  "fortuneteller:Red herring", // FT: ein guter Spieler gilt als Dämon
  "grandmother:Grandchild",    // BMR: Enkel wird beim Setup bestimmt
  "eviltwin:Twin",             // SNV: gut/böse-Zwillingspaar beim Setup
]);
// Nach der ersten Nacht in der Nachtliste ausblenden (nur die Setup-Marker):
const SETUP_ONLY = SETUP_MARKERS;

// Braucht diese Rolle eine Entscheidung vor/zu Spielbeginn UND hat einen Marker?
// = echte Setup-Marker ODER Erste-Nacht-Info-Rollen (die einen „Wrong“-Marker legen).
// Stirbt dieser Spieler diese Nacht ungeschützt? (Dead-Marker, kein Schutz, noch am Leben)
function isDying(i) {
  const p = state.players[i];
  if (!p || p.dead) return false;
  const marked = p.reminders.some(rm => /^dead$|stirbt heute nacht/i.test(rm.text.trim()));
  if (!marked) return false;
  const prot = p.roleId === "soldier" || p.reminders.some(rm => /^protected$|^safe$|^geschützt$/i.test(rm.text.trim()));
  return !prot;
}

function isSetupPreparable(id) {
  const r = role(id);
  if (!r) return false;
  const rems = [...(r.reminders || []), ...(r.remindersGlobal || [])];
  return rems.some(t => SETUP_MARKERS.has(id + ":" + t)) || rems.includes("Wrong");
}

// Info-Karten-Buttons pro Nacht-Eintrag (stopPropagation, damit nicht abgehakt wird)
function cardButtons(defs) {
  const wrap = el("div", { class: "no-cards" });
  for (const [label, fn] of defs) {
    wrap.append(el("button", { class: "btn", onclick: e => { e.stopPropagation(); fn(); } }, label));
  }
  return wrap;
}

export function nightEntries() {
  const first = state.nightCount <= 1;
  const key = first ? "firstNight" : "otherNight";
  const remKey = first ? "firstNightReminder" : "otherNightReminder";
  const inPlay = new Map(); // roleId -> [playerIndex]
  state.players.forEach((p, i) => {
    if (!p.roleId) return;
    if (!inPlay.has(p.roleId)) inPlay.set(p.roleId, []);
    inPlay.get(p.roleId).push(i);
  });

  const entries = [];
  if (first && state.players.length >= 7) {
    for (const m of META_FIRST) {
      entries.push({ key: m.id, name: m.name, team: m.team, order: m.firstNight,
        reminder: m.firstNightReminder, players: [], icon: null, meta: true });
    }
  }
  const pool = new Set([...state.scriptRoles, ...state.fabled, ...inPlay.keys()]);
  for (const id of pool) {
    const r = role(id);
    if (!r || !r[key]) continue;
    const players = inPlay.get(id) || [];
    // Traveller & Fabled nur zeigen, wenn im Spiel; normale Rollen immer (GM-Entscheidung, z. B. für Bluff-Wecken)
    if ((r.team === "traveler") && !players.length) continue;
    if (r.team === "fabled" && !state.fabled.includes(id)) continue;
    entries.push({ key: id, name: r.name, team: r.team, order: r[key],
      reminder: r[remKey], players, icon: iconUrl(r), inPlay: players.length > 0,
      allDead: players.length > 0 && players.every(i => state.players[i].dead) });
  }
  entries.sort((a, b) => a.order - b.order);
  return entries;
}

// Marker aus der Nachtliste auf einen Spieler legen
function placeReminder(roleId, text, onDone = openNightOrder) {
  const r = role(roleId);
  const body = el("div", {});
  const put = p => {
    p.reminders.push({ roleId, text });
    closeDialog(); emit();
    toast(`🔖 „${text}“ → ${p.name}`);
    onDone();
  };

  // Logik: Der Marker gehört oft auf den Träger der Rolle selbst (z. B. Scarlet Woman „Demon“)
  for (const p of state.players.filter(p => p.roleId === roleId)) {
    body.append(el("button", {
      class: "btn primary", style: "display:block;width:100%;margin-bottom:10px",
      onclick: () => put(p),
    }, `⭐ Direkt auf ${p.name} legen (ist ${r.name})`));
  }

  const grid = el("div", { class: "rolegrid" });
  state.players.forEach((p, i) => {
    grid.append(playerCard(i, { onclick: () => put(p), selected: p.roleId === roleId }));
  });
  body.append(grid);

  openDialog({
    title: el("span", {}, el("img", { src: iconUrl(r), style: "width:26px;height:26px;vertical-align:middle;margin-right:6px" }), `„${text}“ auf wen legen?`),
    body,
  });
}

// Setup am Spielanfang: alle nötigen Start-Marker der Rollen im Spiel setzen
export function openSetupMarkers() {
  const body = el("div", {});

  // eindeutige Rollen im Spiel (in Nacht-Reihenfolge)
  const uniqRoles = [];
  const seen = new Set();
  for (const p of state.players) {
    if (!p.roleId || seen.has(p.roleId)) continue;
    seen.add(p.roleId); uniqRoles.push(p.roleId);
  }
  const holdersOf = id => state.players.filter(q => q.roleId === id).map(q => q.name).join(", ");

  // --- 1) Marker im Setup vorbereiten & legen (aktionierbar) ---
  // Alles, was du vor/zu Spielbeginn entscheidest UND einen Marker hat:
  // echte Setup-Marker (Red herring …) + Erste-Nacht-Infos (Washerwoman/Librarian/Investigator: Wrong).
  const markerRoles = uniqRoles.filter(id => isSetupPreparable(id));
  if (markerRoles.length) {
    body.append(el("div", { class: "teamhead", style: "margin-top:0" }, "① Marker im Setup legen"));
    body.append(el("p", { style: "font-size:12.5px;color:var(--dim);margin:0 0 8px" },
      "Hier entscheidest du dich vor dem Spiel und legst die Marker. Sie erscheinen dann in der Nacht-Reihenfolge, wenn du die Info gibst."));
    for (const id of markerRoles) {
      const r = role(id);
      const rems = [...(r.reminders || []), ...(r.remindersGlobal || [])];
      const placed = state.players.flatMap(q => q.reminders.filter(rm => rm.roleId === id).map(rm => `„${rm.text}“ → ${q.name}`));
      body.append(el("div", { class: `no-item t-${r.team}`, style: "cursor:default" },
        el("img", { src: iconUrl(r) }),
        el("div", { style: "min-width:0" },
          el("div", { class: "noi-name" }, r.name),
          el("div", { class: "noi-players" }, holdersOf(id)),
          el("div", { class: "noi-rem" }, r.ability),
          placed.length ? el("div", { class: "noi-rem", style: "color:var(--gold)" }, "✓ " + placed.join(" · ")) : null,
          cardButtons(rems.map(text => [`🔖 ${text}`, () => placeReminder(id, text, openSetupMarkers)])))));
    }
  }

  // --- 2) Spielaufbau beachten (setup:true — ändert die Verteilung, kein Marker) ---
  const setupRoles = uniqRoles.filter(id => role(id).setup && !isSetupPreparable(id));
  if (setupRoles.length) {
    body.append(el("div", { class: "teamhead" }, "② Spielaufbau beachten"));
    for (const id of setupRoles) body.append(infoItem(id, holdersOf(id)));
  }

  if (!markerRoles.length && !setupRoles.length) {
    body.append(el("p", { style: "color:var(--dim)" }, "Nichts vorzubereiten — direkt in die erste Nacht."));
  }

  openDialog({ title: "🧷 Setup & Vorbereitung", body,
    buttons: [{ label: "Fertig", class: "primary", onclick: closeDialog }] });
}

// reine Info-Zeile (nicht aktionierbar) für Setup-relevante Rollen
function infoItem(id, holders) {
  const r = role(id);
  return el("div", { class: `no-item t-${r.team}`, style: "cursor:default" },
    el("img", { src: iconUrl(r) }),
    el("div", { style: "min-width:0" },
      el("div", { class: "noi-name" }, r.name),
      el("div", { class: "noi-players" }, holders),
      el("div", { class: "noi-rem" }, r.ability)));
}

/* ---------- Einheitliche Spielerkarte für Auswahllisten (Tote deutlich markiert) ---------- */
export function playerCard(i, { onclick = null, selected = false } = {}) {
  const p = state.players[i];
  const r = p.roleId ? role(p.roleId) : null;
  const card = el("div", {
    class: "rolecard" + (r ? ` t-${r.team}` : "") + (selected ? " sel" : "") + (p.dead ? " dead" : ""),
    onclick: onclick || undefined,
  });
  if (r) card.append(el("img", { src: iconUrl(r) }));
  else card.append(el("div", { style: "font-size:24px" }, "🧍"));
  card.append(el("div", { class: "rc-name" }, p.name),
    r ? el("div", { class: "rc-name", style: "color:var(--dim)" }, r.name) : null);
  if (p.dead) card.append(el("div", { class: "rc-flag deadflag" }, "☠ TOT"));
  return card;
}

/* ---------- Eigene Info-Karten (in den Einstellungen gespeichert, überleben neue Spiele) ---------- */
function customCards() { return state.settings.customCards || []; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function manageCustomCards() {
  const body = el("div", {});
  const cards = customCards();

  if (cards.length) {
    body.append(el("div", { class: "teamhead", style: "margin-top:0" }, "Deine Karten"));
    cards.forEach((c, i) => {
      body.append(el("div", { style: "display:flex;gap:8px;margin-bottom:8px;align-items:center" },
        el("button", { class: "btn", style: "flex:1;text-align:left", onclick: () => showCard({ title: esc(c.title), sub: c.sub || "" }) },
          `📝 ${c.title}`),
        el("button", { class: "btn small danger", onclick: () => {
          cards.splice(i, 1); state.settings.customCards = cards; emit(); manageCustomCards();
        } }, "🗑")));
    });
  }

  const inpTitle = el("input", { type: "text", placeholder: "Kartentext (groß), z. B. „DU bist verflucht“" });
  const inpSub = el("input", { type: "text", placeholder: "Untertext (klein, optional)", style: "margin-top:8px" });
  body.append(el("div", { class: "teamhead" }, "Neue Karte"), inpTitle, inpSub,
    el("button", { class: "btn primary", style: "margin-top:10px", onclick: () => {
      const title = inpTitle.value.trim();
      if (!title) return toast("Kartentext fehlt");
      state.settings.customCards = [...cards, { title, sub: inpSub.value.trim() }];
      emit(); manageCustomCards();
    } }, "＋ Speichern"));

  openDialog({ title: "📝 Eigene Info-Karten", body,
    buttons: [{ label: "Fertig", class: "primary", onclick: () => { closeDialog(); openNightOrder(); } }] });
}

// Geführter Flow: Eintrag abhaken und die Fähigkeit des nächsten fälligen Eintrags direkt öffnen
export function completeAndNext(roleKey) {
  state.nightDone[`${state.nightCount}:${roleKey}`] = true;
  emit();
  openNightOrder();
  const entries = nightEntries().filter(e => (e.meta || e.inPlay) && !e.allDead);
  const next = entries.find(e => !state.nightDone[`${state.nightCount}:${e.key}`]);
  if (next && !next.meta && hasAbility(next.key) && canRun(next.key).ok) {
    runAbility(next.key); // z. B. Fortune Teller: direkt die Auswahl-Oberfläche
  }
}

export function openNightOrder() {
  const entries = nightEntries();
  const first = state.nightCount <= 1;
  const body = el("div", {});
  body.append(el("p", { style: "font-size:13px;color:var(--dim);margin-top:0" },
    first ? "Erste Nacht — Reihenfolge des offiziellen Sheets. Tippen = abhaken & Spieler hervorheben." :
      "Weitere Nacht — nur relevante Rollen. Tippen = abhaken & Spieler hervorheben."));
  if (first) {
    body.append(el("button", { class: "btn", style: "display:block;width:100%;margin-bottom:10px",
      onclick: openSetupMarkers }, "🧷 Setup & Vorbereitung öffnen"));
  }


  const doneKey = e => `${state.nightCount}:${e.key}`;
  let currentSet = false;

  for (const e of entries) {
    if (!e.meta && !e.inPlay) continue; // nicht im Spiel -> ausblenden (Bluff-Wecken macht der GM manuell)
    const done = state.nightDone[doneKey(e)];
    const dying = !e.meta && e.players.some(isDying);
    const item = el("div", {
      class: "no-item t-" + e.team + (done ? " done" : "") + (e.allDead ? " dead-role" : "") + (dying ? " dying-role" : ""),
      onclick: () => {
        state.nightDone[doneKey(e)] = !state.nightDone[doneKey(e)];
        emit();
        openNightOrder(); // neu rendern (hebt automatisch den nächsten Eintrag hervor)
      },
    });
    if (!done && !currentSet && !e.allDead) {
      item.classList.add("current");
      currentSet = true;
      if (state.phase === "night") setWake(e.players); // wer als Nächstes dran ist, leuchtet — nur nachts
    }
    if (e.icon) item.append(el("img", { src: e.icon }));
    else item.append(el("div", { style: "width:42px;text-align:center;font-size:24px" }, e.team === "demon" ? "😈" : "👥"));
    const names = e.players.map(i => state.players[i].name + (state.players[i].dead ? " †" : (isDying(i) ? " ☠" : ""))).join(", ");
    const content = el("div", { style: "min-width:0" },
      el("div", { class: "noi-name" }, e.name),
      names ? el("div", { class: "noi-players" }, names) : null,
      dying ? el("div", { class: "noi-rem", style: "color:var(--demon)" }, "☠ Stirbt diese Nacht — Fähigkeit meist nicht ausführen (Ausnahme: Ravenkeeper)") : null,
      e.reminder ? el("div", { class: "noi-rem" }, e.reminder) : null);
    // Im Setup vorbereitete Marker dieser Rolle anzeigen (z. B. Investigator: Minion/Wrong)
    if (!e.meta) {
      const placed = state.players.flatMap(q =>
        q.reminders.filter(rm => rm.roleId === e.key).map(rm => `„${rm.text}“ → ${q.name}`));
      if (placed.length) content.append(el("div", { class: "noi-rem", style: "color:var(--gold)" }, "✓ " + placed.join(" · ")));
    }
    // Passende Info-Karten direkt am Eintrag
    if (e.key === "_minioninfo") content.append(cardButtons([["😈 „DIES ist der Dämon“", showThisIsTheDemon]]));
    if (e.key === "_demoninfo") content.append(cardButtons([
      ["👥 „DIES sind deine Schergen“", showTheseAreYourMinions],
      ["🎭 Bluffs zeigen", showBluffs],
    ]));
    // Marker der Rolle direkt setzen: Button antippen -> Zielspieler wählen
    if (!e.meta) {
      const r = role(e.key);
      const rems = [...(r?.reminders || []), ...(r?.remindersGlobal || [])]
        .filter(text => first || !SETUP_ONLY.has(e.key + ":" + text));
      const btns = rems.map(text => [`🔖 ${text}`, () => placeReminder(e.key, text)]);
      // Nacht-Assistent: Antwort der Info-Fähigkeit ausrechnen — nur wenn gerade sinnvoll
      if (hasAbility(e.key) && e.inPlay) {
        const gate = canRun(e.key);
        if (gate.ok) btns.unshift(["⚡ Ausführen", () => runAbility(e.key)]);
        else content.append(el("div", { class: "noi-rem", style: "color:var(--dim);font-style:italic" }, "💤 " + gate.reason));
      }
      // Scarlet Woman mit „Demon“-Marker ist jetzt der Dämon -> sie tötet nachts wie der Imp
      if (e.key === "scarletwoman" && e.players.some(i =>
        state.players[i].reminders.some(rm => /^demon$/i.test(rm.text.trim())))) {
        btns.push(["🗡 Tötet (Dead legen)", () => placeReminder(role("imp") ? "imp" : "scarletwoman", "Dead")]);
      }
      // Rollenwechsel im Text (Scarlet Woman …) -> „DU bist“-Karte anbieten.
      // Beim Imp nur im Setup/erste Nacht nötig, danach nicht mehr.
      if ((e.reminder || "").includes("'You are'") && !(e.key === "imp" && !first)) {
        btns.push(["🃏 „DU bist …“-Karte", showYouAre]);
      }
      if (btns.length) content.append(cardButtons(btns));
    }
    item.append(content);
    body.append(item);
  }
  if (!currentSet || state.phase !== "night") setWake([]); // alles abgehakt oder Tag -> nichts hervorheben

  body.append(el("div", { class: "teamhead" }, "Info-Karten (Vollbild zum Vorzeigen)"),
    cardButtons([
      ["😈 „DIES ist der Dämon“", showThisIsTheDemon],
      ["👥 „DIES sind deine Schergen“", showTheseAreYourMinions],
      ["🎭 Bluffs zeigen", showBluffs],
      ["🃏 „DU bist …“", showYouAre],
      ["🔵 „DU bist GUT“", showYouAreGood],
      ["🔴 „DU bist BÖSE“", showYouAreEvil],
      ...customCards().map(c => [`📝 ${c.title}`, () => showCard({ title: esc(c.title), sub: c.sub || "" })]),
      ["➕ Eigene Karte …", manageCustomCards],
    ]));

  body.append(el("button", { class: "btn small", style: "margin-top:10px", onclick: () => {
    for (const e of entries) delete state.nightDone[`${state.nightCount}:${e.key}`];
    setWake([]); emit(); openNightOrder();
  } }, "↺ Alle Haken entfernen"));

  openPanel(first ? `Erste Nacht` : `Nacht ${state.nightCount}`, body);
}
