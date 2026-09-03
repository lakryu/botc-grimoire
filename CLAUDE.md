# BotC Grimoire

Blood-on-the-Clocktower-GM-App fürs iPad: Grimoire, Nacht-Reihenfolge, Charakterziehen, Sounds, ESP32-Kerzensteuerung. Vor-Ort-Spiel, nur ein Gerät (GM-Tablet).

## Stack
- Statische Web-App, kein Build-Step: plain HTML + ES-Module + CSS
- PWA (offline-fähig auf dem iPad)
- Charakterdaten (englisch): roles.json + Icons aus bra1n/townsquare
- Sounds: prozedural per WebAudio (keine Audiodateien nötig)
- Kerzen: WebSocket zu ESP32 (Hardware später)

## Befehle
- Run: beliebiger statischer Server im Projektordner, z. B. `python -m http.server 8080` — oder Browser-Preview via launch.json

## Konventionen
- Alles Vanilla-JS, ES-Module unter `js/`, Daten unter `data/`, Icons unter `assets/icons/`
- UI-Sprache Deutsch, Charakternamen/-texte Englisch
- Muss offline und touch-first funktionieren (iPad Safari)

## Nicht anfassen
- `data/roles.json` und `assets/icons/` sind generiert/importiert — nicht von Hand editieren

## Session-Regeln
- Lies zu Beginn HANDOFF.md für den aktuellen Stand.
- Auf "handoff": HANDOFF.md aktualisieren (siehe kontext-handoff-Skill).
