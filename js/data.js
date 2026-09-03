// Rollen-, Editions- und Skriptdaten
export let ROLES = new Map();      // id -> role
export let EDITIONS = [];
export let FABLED = [];
export let GAMESIZES = [];         // index 0 = 5 Spieler

export const TEAMS = ["townsfolk", "outsider", "minion", "demon", "traveler", "fabled"];
export const TEAM_NAMES = {
  townsfolk: "Townsfolk", outsider: "Outsider", minion: "Minion",
  demon: "Demon", traveler: "Traveller", fabled: "Fabled",
};

// Meta-Einträge der ersten Nacht (wie im offiziellen Nacht-Sheet)
export const META_FIRST = [
  {
    id: "_minioninfo", name: "Minion-Info", team: "minion", firstNight: 5,
    firstNightReminder: "Bei 7+ Spielern: Minions wecken. Sie erkennen sich gegenseitig. Zeige die „Das ist der Dämon“-Karte und zeige auf den Dämon.",
  },
  {
    id: "_demoninfo", name: "Dämon-Info & Bluffs", team: "demon", firstNight: 8,
    firstNightReminder: "Bei 7+ Spielern: Dämon wecken. Zeige die „Das sind deine Minions“-Karte und zeige auf die Minions. Zeige 3 gute Charaktere, die NICHT im Spiel sind (Bluffs).",
  },
];

export async function loadData() {
  const [roles, editions, fabled, game] = await Promise.all([
    fetch("data/roles.json").then(r => r.json()),
    fetch("data/editions.json").then(r => r.json()),
    fetch("data/fabled.json").then(r => r.json()),
    fetch("data/game.json").then(r => r.json()),
  ]);
  ROLES = new Map(roles.map(r => [r.id, r]));
  for (const f of fabled) { f.team = "fabled"; ROLES.set(f.id, f); }
  EDITIONS = editions;
  FABLED = fabled;
  GAMESIZES = game;
}

export function role(id) { return ROLES.get(id); }

export function iconUrl(r) {
  if (!r) return "";
  if (r.image) return r.image; // custom script with own image URL
  return `assets/icons/${r.imageAlt || r.id}.png`;
}

// Alle Rollen einer Edition (ohne Traveller)
export function editionRoles(editionId) {
  return [...ROLES.values()].filter(r => r.edition === editionId && r.team !== "traveler" && r.team !== "fabled");
}
export function editionTravellers(editionId) {
  return [...ROLES.values()].filter(r => r.edition === editionId && r.team === "traveler");
}

// Offizielle Verteilung für n Spieler (5–15)
export function distribution(n) {
  const nn = Math.max(5, Math.min(15, n));
  return GAMESIZES[nn - 5];
}

// Custom-Skript-JSON (offizielles Script-Tool-Format) -> Liste von Rollen-IDs
// Unbekannte Objekte mit eigenem "team"/"ability" werden als Homebrew-Rolle registriert.
export function parseScript(json) {
  const ids = [];
  for (const entry of json) {
    if (typeof entry === "string") {
      const id = normId(entry);
      if (ROLES.has(id)) ids.push(id);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const id = normId(entry.id || "");
    if (id === "_meta") continue;
    if (ROLES.has(id)) { ids.push(id); continue; }
    if (entry.team && entry.ability) {
      ROLES.set(id, {
        id, name: entry.name || id, team: entry.team, edition: "custom",
        ability: entry.ability, image: Array.isArray(entry.image) ? entry.image[0] : entry.image,
        firstNight: entry.firstNight || 0, otherNight: entry.otherNight || 0,
        firstNightReminder: entry.firstNightReminder || "", otherNightReminder: entry.otherNightReminder || "",
        reminders: entry.reminders || [], setup: !!entry.setup,
      });
      ids.push(id);
    }
  }
  return ids;
}
function normId(id) { return String(id).toLowerCase().replace(/[^a-z0-9]/g, ""); }

export function scriptMeta(json) {
  const m = json.find(e => e && typeof e === "object" && e.id === "_meta");
  return m ? { name: m.name || "Custom-Skript", author: m.author || "" } : { name: "Custom-Skript", author: "" };
}
