// Neues Spiel: Skript wählen -> Spieler -> Rollen -> Zuteilen
import { EDITIONS, editionRoles, role, iconUrl, distribution, parseScript, scriptMeta, TEAM_NAMES } from "./data.js";
import { state, emit, log, snapshot } from "./state.js";
import { el, openDialog, closeDialog, toast } from "./ui.js";
import { startReveal } from "./reveal.js";
import { openSetupMarkers } from "./night.js";

const CUSTOM_KEY = "botc-custom-scripts";

let wiz = null; // {scriptName, roleIds, playerNames, chosen:Set}

export function openSetup() {
  wiz = {
    scriptName: "", roleIds: [], chosen: new Set(),
    playerNames: state.players.length ? state.players.map(p => p.name) : ["", "", "", "", "", "", ""],
  };
  stepScript();
}

/* ---------- Schritt 1: Skript ---------- */
function stepScript() {
  const body = el("div", {});
  for (const ed of EDITIONS.filter(e => !e.isOfficial || true)) {
    if (!["tb", "bmr", "snv"].includes(ed.id)) continue;
    body.append(el("button", {
      class: "btn", style: "display:block;width:100%;margin-bottom:10px;text-align:left;font-size:18px",
      onclick: () => {
        wiz.scriptName = ed.name;
        wiz.roleIds = editionRoles(ed.id).map(r => r.id);
        stepPlayers();
      }
    }, `📕 ${ed.name}`));
  }
  body.append(el("div", { class: "teamhead" }, "Custom-Skripte"));
  const saved = getCustomScripts();
  for (const [name, ids] of Object.entries(saved)) {
    const row = el("div", { style: "display:flex;gap:8px;margin-bottom:8px" });
    row.append(
      el("button", {
        class: "btn", style: "flex:1;text-align:left",
        onclick: () => { wiz.scriptName = name; wiz.roleIds = ids.filter(id => role(id)); stepPlayers(); }
      }, `📜 ${name}`),
      el("button", { class: "btn danger small", onclick: () => { delete saved[name]; localStorage.setItem(CUSTOM_KEY, JSON.stringify(saved)); stepScript(); } }, "🗑")
    );
    row.querySelector && body.append(row);
  }
  const ta = el("textarea", { rows: 4, placeholder: 'JSON vom offiziellen Script-Tool hier einfügen …' });
  body.append(
    el("label", { class: "fld" }, "Neues Custom-Skript importieren (JSON)"),
    ta,
    el("button", {
      class: "btn", style: "margin-top:8px", onclick: () => {
        try {
          const json = JSON.parse(ta.value);
          const ids = parseScript(json);
          if (!ids.length) return toast("Keine bekannten Rollen gefunden");
          const meta = scriptMeta(json);
          const all = getCustomScripts();
          all[meta.name] = ids;
          localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
          wiz.scriptName = meta.name; wiz.roleIds = ids;
          stepPlayers();
        } catch { toast("Ungültiges JSON"); }
      }
    }, "Importieren →")
  );
  openDialog({ title: "Neues Spiel · Skript wählen", body });
}

function getCustomScripts() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || {}; } catch { return {}; }
}

/* ---------- Schritt 2: Spieler ---------- */
function stepPlayers() {
  const body = el("div", {});
  const list = el("div", {});
  const info = el("div", { class: "counts" });

  function render() {
    list.innerHTML = "";
    wiz.playerNames.forEach((name, i) => {
      const inp = el("input", { type: "text", placeholder: `Spieler ${i + 1}`, value: name,
        oninput: e => { wiz.playerNames[i] = e.target.value; } });
      list.append(el("div", { class: "playerlist-row" },
        el("span", { class: "num" }, String(i + 1)),
        inp,
        el("button", { class: "btn small", onclick: () => { wiz.playerNames.splice(i, 1); render(); } }, "✕")));
    });
    const n = wiz.playerNames.length;
    const d = distribution(n);
    info.innerHTML = n >= 5
      ? `<b>${n} Spieler:</b>&nbsp; ${d.townsfolk} Townsfolk · ${d.outsider} Outsider · <span class="bad">${d.minion} Minion · ${d.demon} Demon</span>`
      : `Mindestens 5 Spieler`;
  }
  render();

  body.append(list,
    el("button", { class: "btn small", onclick: () => { wiz.playerNames.push(""); render(); } }, "+ Spieler"),
    info);

  openDialog({
    title: `Spieler · ${wiz.scriptName}`,
    body,
    buttons: [
      { label: "← Skript", onclick: stepScript },
      { label: "Weiter →", class: "primary", onclick: () => {
          wiz.playerNames = wiz.playerNames.map((n, i) => n.trim() || `Spieler ${i + 1}`);
          if (wiz.playerNames.length < 5) return toast("Mindestens 5 Spieler");
          if (wiz.playerNames.length > 20) return toast("Maximal 20 Spieler");
          suggestRoles();
          stepRoles();
        } },
    ],
  });
}

/* ---------- Schritt 3: Rollen wählen ---------- */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function suggestRoles() {
  const d = distribution(wiz.playerNames.length);
  wiz.chosen = new Set();
  for (const team of ["townsfolk", "outsider", "minion", "demon"]) {
    const pool = shuffled(wiz.roleIds.filter(id => role(id).team === team));
    for (let i = 0; i < d[team] && i < pool.length; i++) wiz.chosen.add(pool[i]);
  }
}

function stepRoles() {
  const d = distribution(wiz.playerNames.length);
  const body = el("div", {});
  const counts = el("div", { class: "counts" });
  const grid = {};

  function renderCounts() {
    const c = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    let setupNote = false;
    for (const id of wiz.chosen) {
      const r = role(id);
      if (c[r.team] !== undefined) c[r.team]++;
      if (r.setup) setupNote = true;
    }
    const total = c.townsfolk + c.outsider + c.minion + c.demon;
    const ok = t => (c[t] === d[t] ? "✓" : "⚠");
    counts.innerHTML =
      `<span><b>${total}</b>/${wiz.playerNames.length} gewählt</span>` +
      `<span>${ok("townsfolk")} ${c.townsfolk}/${d.townsfolk} Townsfolk</span>` +
      `<span>${ok("outsider")} ${c.outsider}/${d.outsider} Outsider</span>` +
      `<span class="bad">${ok("minion")} ${c.minion}/${d.minion} Minion</span>` +
      `<span class="bad">${ok("demon")} ${c.demon}/${d.demon} Demon</span>` +
      (setupNote ? `<span style="color:var(--gold)">⚠ Setup-Rolle gewählt (z. B. Baron) – Verteilung ggf. anpassen!</span>` : "");
  }

  for (const team of ["townsfolk", "outsider", "minion", "demon"]) {
    body.append(el("div", { class: "teamhead" }, TEAM_NAMES[team]));
    const g = el("div", { class: "rolegrid" });
    for (const id of wiz.roleIds.filter(id => role(id).team === team)) {
      const r = role(id);
      const card = el("div", {
        class: `rolecard t-${team}` + (wiz.chosen.has(id) ? " sel" : ""),
        onclick: () => {
          wiz.chosen.has(id) ? wiz.chosen.delete(id) : wiz.chosen.add(id);
          card.classList.toggle("sel");
          renderCounts();
        }
      }, el("img", { src: iconUrl(r) }), el("div", { class: "rc-name" }, r.name));
      card.title = r.ability;
      g.append(card);
      grid[id] = card;
    }
    body.append(g);
  }
  renderCounts();
  body.prepend(counts,
    el("button", { class: "btn small", onclick: () => { suggestRoles(); for (const [id, c] of Object.entries(grid)) c.classList.toggle("sel", wiz.chosen.has(id)); renderCounts(); } }, "🎲 Neu auswürfeln"));

  openDialog({
    title: "Rollen in den Beutel",
    body,
    buttons: [
      { label: "← Spieler", onclick: stepPlayers },
      { label: "Zuteilen →", class: "primary", onclick: () => {
          if (wiz.chosen.size !== wiz.playerNames.length)
            return toast(`${wiz.chosen.size} Rollen für ${wiz.playerNames.length} Spieler – bitte angleichen`);
          stepAssign();
        } },
    ],
  });
}

/* ---------- Schritt 4: Zuteilen ---------- */
function stepAssign() {
  const body = el("div", {},
    el("p", { style: "font-size:16px;line-height:1.5" },
      "Wie sollen die Charaktere zu den Spielern kommen?"),
    el("button", { class: "btn primary", style: "display:block;width:100%;margin-bottom:10px;padding:16px", onclick: () => finish(true) },
      "📲 Am Tablet ziehen — Tablet geht reihum, jeder deckt geheim seine Karte auf"),
    el("button", { class: "btn", style: "display:block;width:100%;margin-bottom:10px;padding:16px", onclick: stepManualAssign },
      "🀄 Plättchen aus dem Beutel — Spieler ziehen echte Plättchen, du trägst die Paare per Klick ein"),
    el("button", { class: "btn", style: "display:block;width:100%;padding:16px", onclick: () => finish(false) },
      "🎲 Zufällig zuteilen — nur du siehst die Rollen im Grimoire"),
  );
  openDialog({ title: "Charaktere verteilen", body,
    buttons: [{ label: "← Rollen", onclick: stepRoles }] });
}

/* Manuell: Namen links, Charaktere rechts, per Klick paaren */
function stepManualAssign() {
  const assigned = new Map(); // playerIndex -> roleId
  let selP = null, selR = null;

  const left = el("div", { class: "assign-col" });
  const right = el("div", { class: "assign-col" });
  const status = el("div", { class: "counts" });

  function tryPair() {
    if (selP !== null && selR !== null) {
      assigned.set(selP, selR);
      selP = null; selR = null;
    }
    renderCols();
  }

  function renderCols() {
    left.innerHTML = ""; right.innerHTML = "";
    left.append(el("div", { class: "teamhead", style: "margin-top:0" }, "Spieler"));
    wiz.playerNames.forEach((name, i) => {
      const rid = assigned.get(i);
      const r = rid ? role(rid) : null;
      const b = el("button", {
        class: "btn assign-name" + (selP === i ? " sel" : "") + (r ? " paired" : ""),
        onclick: () => {
          if (r) { assigned.delete(i); selP = null; renderCols(); return; } // Paar lösen
          selP = (selP === i) ? null : i;
          tryPair();
        },
      }, `${i + 1}. ${name}`);
      if (r) b.append(el("span", { class: "assign-role" },
        el("img", { src: iconUrl(r), style: "width:22px;height:22px;vertical-align:middle" }), ` ${r.name} ✕`));
      left.append(b);
    });

    right.append(el("div", { class: "teamhead", style: "margin-top:0" }, "Charaktere im Beutel"));
    const taken = new Set(assigned.values());
    const grid = el("div", { class: "rolegrid" });
    for (const id of wiz.chosen) {
      if (taken.has(id)) continue;
      const r = role(id);
      const card = el("div", {
        class: `rolecard t-${r.team}` + (selR === id ? " sel" : ""),
        onclick: () => { selR = (selR === id) ? null : id; tryPair(); },
      }, el("img", { src: iconUrl(r) }), el("div", { class: "rc-name" }, r.name));
      card.title = r.ability;
      grid.append(card);
    }
    if (!grid.children.length) grid.append(el("p", { style: "color:var(--dim);font-size:14px" }, "Beutel leer — alle zugeteilt ✓"));
    right.append(grid);

    status.innerHTML = `<b>${assigned.size}</b>/${wiz.playerNames.length} zugeordnet` +
      (selP !== null ? ` · <span style="color:var(--gold)">${wiz.playerNames[selP]} wählt …</span>` : "") +
      (selR !== null ? ` · <span style="color:var(--gold)">${role(selR).name} geht an …</span>` : "");
  }
  renderCols();

  openDialog({
    title: "Plättchen eintragen",
    body: el("div", {}, status, el("div", { class: "assign-cols" }, left, right),
      el("p", { style: "font-size:12.5px;color:var(--dim)" },
        "Name antippen, dann Charakter (oder umgekehrt) = Paar. Zugeordneten Namen antippen = lösen.")),
    buttons: [
      { label: "← Zurück", onclick: stepAssign },
      { label: "Fertig →", class: "primary", onclick: () => {
          if (assigned.size !== wiz.playerNames.length)
            return toast(`Erst alle zuordnen (${assigned.size}/${wiz.playerNames.length})`);
          finish(false, wiz.playerNames.map((_, i) => assigned.get(i)));
        } },
    ],
  });
}

function finish(revealFlow, orderedRoleIds = null) {
  const roleIds = orderedRoleIds || shuffled([...wiz.chosen]);
  state.started = true;
  state.scriptName = wiz.scriptName;
  state.scriptRoles = wiz.roleIds;
  state.players = wiz.playerNames.map((name, i) => ({
    name, roleId: roleIds[i], dead: false, ghostVote: true, reminders: [], note: "",
  }));
  state.bluffs = [null, null, null];
  state.fabled = [];
  state.phase = "day"; state.dayCount = 0; state.nightCount = 0;
  state.nightDone = {}; state.log = [];
  log(`Neues Spiel: ${wiz.scriptName}, ${state.players.length} Spieler`);
  snapshot();
  closeDialog();
  emit();
  if (revealFlow) startReveal(); // Setup-Marker kommen danach (Ende des Ziehens)
  else openSetupMarkers();
}
