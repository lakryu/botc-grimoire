// Spielzustand + Persistenz + Undo
const KEY = "botc-state-v1";

export const state = {
  started: false,
  scriptName: "",
  scriptRoles: [],        // Rollen-IDs im Skript
  players: [],            // {name, roleId, dead, ghostVote, reminders:[{icon,text}], note}
  bluffs: [null, null, null],
  fabled: [],             // Rollen-IDs
  phase: "day",           // "day" | "night"
  dayCount: 0, nightCount: 0,
  nightDone: {},          // key -> true (abgehakte Nacht-Schritte)
  log: [],                // {t, text}
  vote: null,             // aktiver Nominierungs-/Abstimmungszustand
  settings: { espUrl: "", volume: 0.6, candlesEnabled: true, sfxEnabled: true, ambientEnabled: true },
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }

let undoStack = [];
export function snapshot() {
  undoStack.push(JSON.stringify(serializable()));
  if (undoStack.length > 40) undoStack.shift();
}
export function undo() {
  const s = undoStack.pop();
  if (!s) return false;
  Object.assign(state, JSON.parse(s));
  emit();
  return true;
}

function serializable() {
  const { vote, ...rest } = state;
  return rest;
}

export function emit() {
  save();
  for (const fn of listeners) fn();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(serializable())); } catch {}
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(state, JSON.parse(raw), { vote: null });
  } catch {}
}

export function resetGame() {
  undoStack = [];
  Object.assign(state, {
    started: false, scriptName: "", scriptRoles: [], players: [],
    bluffs: [null, null, null], fabled: [], phase: "day", dayCount: 0, nightCount: 0,
    nightDone: {}, log: [], vote: null,
  });
  emit();
}

// important = ⭐ für die Endauswertung (Tode, Hinrichtungen, Rollenwechsel …)
export function log(text, important = false) {
  const phase = state.phase === "night" ? `Nacht ${state.nightCount}`
    : (state.dayCount ? `Tag ${state.dayCount}` : "Setup");
  state.log.push({ t: Date.now(), text, imp: important, phase });
}

export function alivePlayers() { return state.players.filter(p => !p.dead); }
