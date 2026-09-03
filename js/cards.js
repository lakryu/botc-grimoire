// Vollbild-Info-Karten (wie die offiziellen Info-Plättchen):
// Der GM hält dem Spieler das Tablet hin, nur die Karte ist sichtbar.
// Weiter geht es erst nach 3× Tippen (damit niemand aus Versehen das Grimoire sieht).
import { state } from "./state.js";
import { role, iconUrl, TEAM_NAMES } from "./data.js";
import { el, closeDialog } from "./ui.js";
import { pickRole } from "./grimoire.js";

let card = null;

// sub = inhaltlicher Text (z. B. Fähigkeit), hint = Erzähler-Anweisung (abschaltbar in ☰ Menü)
export function showCard({ title, sub = "", hint = "", roles = [], accent = "gold" }) {
  if (state.settings.cardHints !== false && hint) sub = sub ? sub + " — " + hint : hint;
  hideCard();
  let taps = [];
  const dots = el("div", { class: "ic-dots" }, ...[0, 1, 2].map(() => el("span", { class: "ic-dot" })));
  card = el("div", { class: "infocard", onclick: () => {
    const now = Date.now();
    taps = taps.filter(t => now - t < 1500);
    taps.push(now);
    dots.querySelectorAll(".ic-dot").forEach((d, i) => d.classList.toggle("on", i < taps.length));
    if (taps.length >= 3) hideCard();
  }});
  card.append(el("div", { class: "ic-title " + accent, html: title }));
  if (roles.length) {
    const row = el("div", { class: "ic-tokens" });
    for (const r of roles) {
      row.append(el("div", { class: "ic-token" },
        el("div", { class: "token big" }, el("img", { src: iconUrl(r) })),
        el("div", { class: "ic-rname" }, r.name)));
    }
    card.append(row);
  }
  if (sub) card.append(el("div", { class: "ic-sub" }, sub));
  card.append(el("div", { class: "ic-hint" }, "Erzähler: 3× tippen für weiter ", dots));
  document.body.append(card);
}

export function hideCard() { card?.remove(); card = null; }

/* ---------- Fertige Karten ---------- */
export function showBluffs() {
  closeDialog();
  const roles = state.bluffs.filter(Boolean).map(id => role(id));
  showCard({
    title: "Diese Charaktere sind<br><b>NICHT</b> im Spiel",
    roles,
    sub: roles.length < 3 ? "⚠️ Es sind noch keine 3 Bluffs gewählt (🎭 Bluffs)." : "",
    accent: "evil",
  });
}

export function showThisIsTheDemon() {
  closeDialog();
  showCard({ title: "DIES ist<br>der Dämon", hint: "Der Erzähler zeigt auf den Spieler.", accent: "evil" });
}

export function showTheseAreYourMinions() {
  closeDialog();
  showCard({ title: "DIES sind<br>deine Schergen", hint: "Der Erzähler zeigt auf die Spieler.", accent: "evil" });
}

export function showYouAre() {
  pickRole(id => {
    closeDialog();
    if (!id) return;
    const r = role(id);
    showCard({
      title: "DU bist …",
      roles: [r],
      sub: r.ability,
      accent: (r.team === "townsfolk" || r.team === "outsider") ? "good" : "evil",
    });
  }, true);
}

export function showYouAreGood() {
  closeDialog();
  showCard({ title: "DU bist<br>GUT", accent: "good" });
}

export function showYouAreEvil() {
  closeDialog();
  showCard({ title: "DU bist<br>BÖSE", accent: "evil" });
}
