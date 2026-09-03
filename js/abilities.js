// Nacht-Assistent: rechnet Info-Fähigkeiten aus (inkl. Drunk/Poisoned & Recluse/Spy-Hinweisen).
// Ergebnis-Karten sind antippbar (Spieler tauschen -> Neuberechnung).
// ✓ OK schreibt die gegebene Info in die Chronik, ✗ verwirft ohne Log.
import { state, emit, log } from "./state.js";
import { role, iconUrl } from "./data.js";
import { el, openDialog, closeDialog, toast } from "./ui.js";
import { openNightOrder, completeAndNext, playerCard } from "./night.js";

/* ---------- Helfer ---------- */
const players = () => state.players;
const nameOf = i => players()[i].name;

function holderIndex(roleId) {
  return players().findIndex(p => p.roleId === roleId);
}

// betrunken/vergiftet? -> Begründung oder null
function impaired(p) {
  if (!p) return null;
  if (p.roleId === "drunk") return "ist der Drunk";
  const rem = p.reminders.find(rm => /drunk|poison|betrunken|vergiftet/i.test(rm.text));
  return rem ? `hat Marker „${rem.text}“` : null;
}

function isEvil(p) {
  const r = role(p.roleId);
  return !!r && (r.team === "minion" || r.team === "demon");
}
function misregNote(p) {
  if (p.roleId === "recluse") return `${p.name} (Recluse) DARF als böse/Minion/Dämon gelten`;
  if (p.roleId === "spy") return `${p.name} (Spy) DARF als gut/Townsfolk gelten`;
  return null;
}

// lebende Nachbarn (links/rechts) eines Spielers
function aliveNeighbours(idx) {
  const n = players().length;
  const res = [];
  for (const dir of [-1, 1]) {
    for (let k = 1; k < n; k++) {
      const j = (idx + dir * k + n) % n;
      if (j === idx) break;
      if (!players()[j].dead) { res.push(j); break; }
    }
  }
  return [...new Set(res)];
}

/* ---------- Ergebnis-Dialog ---------- */
// Spielerkarte inkl. aller Tags (Marker) des Charakters
function chip(i, onClick = null) {
  const p = players()[i];
  const c = playerCard(i, { onclick: onClick });
  c.style.width = "96px";
  if (!onClick) c.style.cursor = "default";
  if (p.reminders.length) {
    c.append(el("div", { class: "rc-name", style: "color:var(--gold);white-space:normal;line-height:1.3" },
      "🔖 " + p.reminders.map(rm => rm.text).join(" · ")));
  }
  if (onClick) c.append(el("div", { class: "rc-name", style: "color:var(--dim)" }, "↻ tauschen"));
  return c;
}

// chips: Spieler-Indizes; onSwap(pos, neuerIndex) macht Karten antippbar (Neuberechnung);
// logText: wird bei ✓ OK in die Chronik geschrieben.
// roleId: bei ✓ OK wird der Nacht-Eintrag abgehakt und die nächste fällige Fähigkeit direkt geöffnet
function resultDialog({ title, big = null, chips = [], warnings = [], notes = [], onSwap = null, logText = null, roleId = null }) {
  const body = el("div", { style: "text-align:center" });
  for (const w of warnings) {
    body.append(el("p", { style: "color:var(--demon);font-size:15.5px;margin:6px 0" }, "⚠️ " + w));
  }
  if (big !== null) body.append(el("div", { style: "font-size:56px;color:var(--gold);text-shadow:0 0 18px rgba(212,169,78,.4);margin:6px 0" }, String(big)));
  if (chips.length) {
    body.append(el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0" },
      ...chips.map((i, pos) => chip(i, onSwap ? () => swapPlayer(i, ni => onSwap(pos, ni)) : null))));
  }
  for (const n of notes) {
    body.append(el("p", { style: "color:var(--gold);font-size:13.5px;margin:4px 0" }, "ℹ️ " + n));
  }
  const done = withLog => {
    if (withLog && logText) { log(logText); emit(); }
    closeDialog();
    if (withLog && roleId) completeAndNext(roleId); // abhaken + nächste Fähigkeit öffnen
    else openNightOrder();
  };
  openDialog({
    title, body,
    onClose: () => openNightOrder(),
    buttons: logText
      ? [{ label: "✗ Verwerfen", onclick: () => done(false) },
         { label: "✓ OK — in Chronik", class: "primary", onclick: () => done(true) }]
      : [{ label: "OK", class: "primary", onclick: () => done(false) }],
  });
}

// einzelnen Spieler neu wählen (für ↻ tauschen)
function swapPlayer(currentIdx, onPick) {
  const body = el("div", { class: "rolegrid" });
  players().forEach((p, i) => {
    body.append(playerCard(i, { onclick: () => { closeDialog(); onPick(i); }, selected: i === currentIdx }));
  });
  openDialog({ title: `↻ Statt ${nameOf(currentIdx)} wen?`, body });
}

/* ---------- Spieler-Mehrfachauswahl (z. B. Fortune Teller) ---------- */
function pickPlayers({ title, count, onDone }) {
  const sel = new Set();
  const body = el("div", {});
  const grid = el("div", { class: "rolegrid" });
  players().forEach((p, i) => {
    const card = playerCard(i, { onclick: () => {
      sel.has(i) ? sel.delete(i) : (sel.size < count && sel.add(i));
      card.classList.toggle("sel", sel.has(i));
      btn.disabled = sel.size !== count;
    } });
    grid.append(card);
  });
  body.append(el("p", { style: "font-size:14px;color:var(--dim);margin-top:0" }, `${count} Spieler antippen`), grid);
  const btn = el("button", { class: "btn primary", disabled: true, onclick: () => { closeDialog(); onDone([...sel]); } }, "Antwort berechnen");
  openDialog({ title, body, buttons: [] });
  document.querySelector(".overlay .dialog").append(el("div", { class: "dlg-foot" },
    el("button", { class: "btn", onclick: () => { closeDialog(); openNightOrder(); } }, "Abbrechen"), btn));
}

/* ---------- Fähigkeiten ---------- */
function runEmpath() {
  const idx = holderIndex("empath");
  if (idx < 0) return toast("Kein Empath im Spiel");
  empathResult(aliveNeighbours(idx));
}
function empathResult(nb) {
  const me = players()[holderIndex("empath")];
  const evil = nb.filter(i => isEvil(players()[i]));
  const warnings = [];
  const imp = impaired(me);
  if (imp) warnings.push(`${me.name} ${imp} — du darfst eine falsche Zahl zeigen!`);
  if (me.dead) warnings.push(`${me.name} ist tot.`);
  const notes = nb.map(i => misregNote(players()[i])).filter(Boolean);
  if (evil.length) notes.push(`Böse gezählt: ${evil.map(nameOf).join(", ")}`);
  resultDialog({
    title: "💙 Empath — böse lebende Nachbarn",
    big: evil.length, chips: nb, warnings, notes,
    onSwap: (pos, ni) => { const copy = [...nb]; copy[pos] = ni; empathResult([...new Set(copy)]); },
    logText: `💙 Empath (${me.name}) sah: ${evil.length} (Nachbarn: ${nb.map(nameOf).join(", ")})`,
    roleId: "empath",
  });
}

function runChef() {
  const idx = holderIndex("chef");
  if (idx < 0) return toast("Kein Chef im Spiel");
  const me = players()[idx];
  const n = players().length;
  let pairs = 0;
  const involved = new Set();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (isEvil(players()[i]) && isEvil(players()[j])) {
      pairs++; involved.add(i); involved.add(j);
    }
  }
  const warnings = [];
  const imp = impaired(me);
  if (imp) warnings.push(`${me.name} ${imp} — du darfst eine falsche Zahl zeigen!`);
  const notes = players().map(p => misregNote(p)).filter(Boolean);
  if (notes.length) notes.push("Misregistrierung kann die Paarzahl ändern.");
  resultDialog({
    title: "🍳 Chef — nebeneinandersitzende Böse (Paare)",
    big: pairs, chips: [...involved], warnings, notes,
    logText: `🍳 Chef (${me.name}) sah: ${pairs} Paar(e)`,
    roleId: "chef",
  });
}

function runFortuneTeller() {
  const idx = holderIndex("fortuneteller");
  if (idx < 0) return toast("Kein Fortune Teller im Spiel");
  pickPlayers({
    title: "🔮 Fortune Teller — wen prüft er?",
    count: 2,
    onDone: ftResult,
  });
}
function ftResult(sel) {
  const me = players()[holderIndex("fortuneteller")];
  const hits = sel.filter(i => {
    const p = players()[i];
    const r = p.roleId ? role(p.roleId) : null;
    return (r && r.team === "demon") || p.reminders.some(rm => /red herring/i.test(rm.text));
  });
  const yes = hits.length > 0;
  const warnings = [];
  const imp = impaired(me);
  if (imp) warnings.push(`${me.name} ${imp} — du darfst falsch antworten!`);
  const notes = sel.map(i => misregNote(players()[i])).filter(Boolean);
  for (const i of hits) {
    const p = players()[i];
    if (p.reminders.some(rm => /red herring/i.test(rm.text))) notes.push(`${p.name} ist der Red Herring (zählt als JA)`);
    else notes.push(`${p.name} ist der Dämon (JA)`);
  }
  resultDialog({
    title: "🔮 Fortune Teller — ist ein Dämon dabei?",
    big: yes ? "JA ✓" : "NEIN ✗", chips: sel, warnings, notes,
    onSwap: (pos, ni) => { const copy = [...sel]; copy[pos] = ni; ftResult([...new Set(copy)]); },
    logText: `🔮 Fortune Teller (${me.name}) prüfte ${sel.map(nameOf).join(" + ")}: ${yes ? "JA" : "NEIN"}`,
    roleId: "fortuneteller",
  });
}

// autoFind: liefert Spieler-Index, auf den die Fähigkeit vermutlich zielt (z. B. Executed-Marker) — es wird aber erst nachgefragt
function mkShowRole(actorId, emoji, what, prompt, autoFind = null) {
  const show = ([i]) => {
    const me = players()[holderIndex(actorId)];
    const p = players()[i];
    const warnings = [];
    const imp = me && impaired(me);
    if (imp) warnings.push(`${me.name} ${imp} — du darfst einen falschen Charakter zeigen!`);
    const notes = [misregNote(p)].filter(Boolean);
    if (p.roleId === "drunk") notes.push(`${p.name} ist der Drunk — zeige normalerweise seinen vermeintlichen Townsfolk!`);
    const r = p.roleId ? role(p.roleId) : null;
    resultDialog({
      title: `${emoji} ${what}`, big: r ? r.name : "?", chips: [i], warnings, notes,
      onSwap: (pos, ni) => show([ni]),
      logText: `${emoji} ${what}: ${r ? r.name : "?"} (${p.name})`,
      roleId: actorId,
    });
  };
  const pick = () => pickPlayers({ title: prompt, count: 1, onDone: show });
  return () => {
    const auto = autoFind ? autoFind() : -1;
    if (auto < 0) return pick();
    const p = players()[auto];
    openDialog({
      title: `${emoji} Fähigkeit ausführen?`,
      body: el("div", { style: "text-align:center" },
        el("p", { style: "font-size:16px;line-height:1.5" },
          `Der passende Marker liegt bei ${p.name} — Fähigkeit darauf ausführen?`),
        el("div", { style: "display:flex;justify-content:center" }, chip(auto))),
      onClose: () => openNightOrder(),
      buttons: [
        { label: "Anderen wählen", onclick: () => { closeDialog(); pick(); } },
        { label: "✓ Ja, ausführen", class: "primary", onclick: () => { closeDialog(); show([auto]); } },
      ],
    });
  };
}

// Washerwoman/Librarian/Investigator: zeigt die im Setup vorbereiteten Spieler + den zu zeigenden Charakter.
// Falls (noch) keine Marker gesetzt sind: Fallback auf mögliche Kandidaten nach Team.
function mkTeamInfo(actorId, team, teamName, emoji) {
  return () => {
    const idx = holderIndex(actorId);
    const me = idx >= 0 ? players()[idx] : null;
    const warnings = [];
    const imp = me && impaired(me);
    if (imp) warnings.push(`${me.name} ${imp} — du darfst falsche Info zeigen!`);

    // Im Setup gelegte Marker dieser Rolle (echter Treffer + „Wrong“-Ablenkung)
    const marked = players().map((p, i) => ({ p, i }))
      .filter(({ p }) => p.reminders.some(rm => rm.roleId === actorId));
    const trueOne = marked.find(({ p }) => p.reminders.some(rm => rm.roleId === actorId && !/wrong/i.test(rm.text)));
    const shown = trueOne ? role(trueOne.p.roleId) : null;

    if (marked.length) {
      const notes = marked.map(m => misregNote(m.p)).filter(Boolean);
      notes.push(shown
        ? `Zeige das Charakter-Plättchen „${shown.name}“ und zeige auf diese ${marked.length} Spieler.`
        : "Zeige das Charakter-Plättchen und zeige auf diese Spieler.");
      resultDialog({
        title: `${emoji} ${teamName}-Info (im Setup vorbereitet)`,
        big: shown ? shown.name : null,
        chips: marked.map(m => m.i), warnings, notes,
        logText: `${emoji} ${teamName}-Info: „${shown ? shown.name : "?"}“ → ${marked.map(m => nameOf(m.i)).join(" + ")}`,
        roleId: actorId,
      });
      return;
    }

    // Fallback: keine Marker gesetzt -> mögliche Kandidaten nach Team anzeigen
    const matches = players().map((p, i) => ({ p, i }))
      .filter(({ p }) => { const r = p.roleId ? role(p.roleId) : null; return r && r.team === team; })
      .map(({ i }) => i);
    const notes = players().map(p => misregNote(p)).filter(Boolean);
    notes.push("⚠️ Keine Setup-Marker gesetzt. Wähle 2 Spieler und markiere sie (🔖 in der Nachtliste).");
    if (!matches.length) notes.push(`Kein ${teamName} im Spiel — zeige „0“ (Librarian) oder nutze Recluse/Spy.`);
    resultDialog({
      title: `${emoji} ${teamName}-Info — mögliche Spieler`,
      big: matches.length ? null : 0,
      chips: matches, warnings, notes,
      logText: `${emoji} ${teamName}-Info gezeigt (${matches.map(nameOf).join(", ") || "keine"})`,
      roleId: actorId,
    });
  };
}

/* ---------- Registry ---------- */
const ABILITIES = {
  empath: runEmpath,
  chef: runChef,
  fortuneteller: runFortuneTeller,
  undertaker: mkShowRole("undertaker", "⚰️", "Undertaker sah", "⚰️ Wer wurde heute hingerichtet?",
    () => players().findIndex(p => p.reminders.some(rm => /executed|hingerichtet/i.test(rm.text)))),
  ravenkeeper: mkShowRole("ravenkeeper", "🐦", "Ravenkeeper sah", "🐦 Wen hat der Ravenkeeper gewählt?"),
  washerwoman: mkTeamInfo("washerwoman", "townsfolk", "Townsfolk", "🧺"),
  librarian: mkTeamInfo("librarian", "outsider", "Outsider", "📚"),
  investigator: mkTeamInfo("investigator", "minion", "Minion", "🔍"),
};

export function hasAbility(roleId) { return !!ABILITIES[roleId]; }
export function runAbility(roleId) { ABILITIES[roleId]?.(); }

// Ist die Fähigkeit gerade sinnvoll ausführbar? -> {ok, reason}
export function canRun(roleId) {
  if (roleId === "undertaker") {
    const someoneExecuted = players().some(p => p.reminders.some(rm => /executed|hingerichtet/i.test(rm.text)));
    return someoneExecuted
      ? { ok: true }
      : { ok: false, reason: "Heute wurde niemand hingerichtet — Undertaker nicht wecken." };
  }
  return { ok: true };
}
