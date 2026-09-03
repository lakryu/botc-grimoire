# Handoff – BotC Grimoire

## Aktueller Stand
- v1 komplett gebaut und im Browser durchgetestet (Setup → Grimoire → Nacht → Abstimmung → Hinrichtung → Reload-Persistenz): alles funktioniert, keine Konsolenfehler.
- Features: Setup-Wizard (TB/BMR/SNV + Custom-Skript-JSON-Import), Grimoire-Kreis mit Tokens/Leichentuch/Geiststimmen/Erinnerungsmarkern, Charakterziehen am Tablet (Halten-zum-Aufdecken), Nacht-Reihenfolge (erste/weitere Nacht, abhakbar, weckt Spieler per Glow), Nominierung mit animiertem Uhrzeiger + Block-Logik, Dämonen-Bluffs, Fabled, Chronik, Timer, Verdeck-Screen (3× tippen), prozedurale Sounds (WebAudio, keine Dateien), Kerzen-Flammen + ESP32-WebSocket-Anbindung, PWA/Offline (sw.js), Undo, localStorage-Persistenz.

- Nachtrag: Plättchen-Modus jetzt mit manuellem Zuordnungs-Screen (Namen links, Beutel rechts, Klick-Paarung, Paar lösen durch erneutes Antippen). Tokens sind frei im Raum platzierbar (Pointer-Drag, Position als Anteil der Stage-Größe in player.pos, persistiert); Menüpunkt „Tokens wieder im Kreis anordnen“. Service Worker auf network-first umgestellt (botc-v2), damit Updates ankommen; Icons bleiben cache-first.

- Nachtrag 2: Bluff-Picker markiert/sperrt gezogene Charaktere (Überschreiben nach Warnung möglich). Neues js/cards.js: Vollbild-Info-Karten („Bluffs zeigen“, „DIES ist der Dämon“, „DIES sind deine Schergen“, „DU bist …/GUT/BÖSE“), schließen nur per 3× Tippen; Buttons dazu im Spielermenü (Dämon/Minion) und in der Nacht-Reihenfolge (an Minion-/Dämon-Info + Sammelblock unten).

- Nachtrag 3: Abstimmung vereinfacht (Token antippen → Banner in Kreismitte, sofortiges Auszählen ohne Uhrzeiger). Chronik nach Tag/Nacht gruppiert mit ⭐-Endauswertung, eigenen Notizen, nachträglichem Markieren/Löschen. Nachtliste: Marker-Buttons pro Rolle (Spielerwahl mit Charakteranzeige, ⭐-Direktbutton für Rollenträger), SETUP_ONLY-Marker nach Nacht 1 ausgeblendet, „DU bist“-Karte beim Imp nur Nacht 1, Glow zeigt den NÄCHSTEN fälligen Eintrag (nur nachts). Neu: js/abilities.js Nacht-Assistent („⚡ Ausführen“ bei Empath, Chef, Fortune Teller, Undertaker, Ravenkeeper, Washerwoman/Librarian/Investigator) — rechnet Antworten inkl. Drunk/Poisoned-Warnung und Recluse/Spy-Hinweisen. Setup-Marker-Dialog (🧷) nach Spielstart/Menü/erste Nacht.

## Offen
- [ ] Auf echtem iPad testen (Safari, „Zum Home-Bildschirm“); Sounds erst nach erstem Touch (iOS-Regel, ist eingebaut)
- [ ] ESP32-Hardware bauen & Firmware testen (esp32/candles/candles.ino, Anleitung in esp32/README.md)
- [ ] Evtl. Icons verkleinern (assets/icons = 17 MB, fürs Offline-Caching okay, aber optimierbar)
- [ ] Nice-to-have-Ideen: Traveller-Unterstützung im Setup, Vote-Historie als eigene Ansicht, Spieler-Drag statt Verschieben-Buttons

## Erkenntnisse
- Rollendaten/Icons stammen aus bra1n/townsquare (clocktower.online); data/roles.json-Felder: firstNight/otherNight (Sortierzahl), reminders, setup. Minion-Info = Position 5, Dämon-Info = 8 (erste Nacht, ab 7 Spielern) — als META_FIRST in js/data.js.
- Kein Build-Step: ES-Module direkt, Server = `python -m http.server 8321` (.claude/launch.json „grimoire“).
- Kerzen-Protokoll (App→ESP): {"type":"candles","states":[1,0,…]} / {"type":"scene","value":"night|day|death|off"}.

## Relevante Dateien
- js/app.js (Einstieg/Phasenwechsel), js/grimoire.js (Kreis + Spielermenü), js/night.js, js/day.js (Vote/Uhrzeiger), js/setup.js (Wizard), js/reveal.js (Ziehen), js/audio.js (prozedurale Sounds), js/candles.js (ESP32-WS), js/panels.js (Menü/Sounds/Kerzen/Bluffs/Timer), js/state.js, js/data.js, css/style.css
- data/*.json (generiert, nicht editieren), assets/icons/ (152 PNGs), sw.js, manifest.webmanifest, esp32/
