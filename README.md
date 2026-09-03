# 🕰️ Grimoire – Blood on the Clocktower

Ein Erzähler-Werkzeug (Grimoire) für **Blood on the Clocktower**, gebaut fürs **iPad und Handy**. Gedacht für Runden, die **vor Ort am Tisch** spielen, während der Erzähler alles auf einem Gerät verwaltet – Rollen, Nacht-Reihenfolge, Abstimmungen, Sounds und optional physische Kerzen.

Reine statische Web-App: **kein Build, kein Server nötig**, läuft offline als PWA (zum Home-Bildschirm hinzufügen).

**🎮 Live-App: [lakryu.github.io/botc-grimoire](https://lakryu.github.io/botc-grimoire/)**
*(sobald GitHub Pages aktiviert ist – siehe [Starten](#-starten))*

---

## ✨ Features

**Spielaufbau**
- Setup-Assistent für **Trouble Brewing**, **Bad Moon Rising** und **Sects & Violets** sowie **Import beliebiger Custom-Skripte** (JSON vom offiziellen Script-Tool)
- Automatische Rollenverteilung nach offizieller Tabelle, mit Warnung bei Setup-Rollen (z. B. Baron)
- Charaktere verteilen per **Tablet-Ziehen** (jeder deckt geheim seine Karte auf), **manueller Plättchen-Zuordnung** (Namen ↔ Charaktere per Klick paaren) oder Zufall

**Grimoire**
- Spielerkreis mit frei verschiebbaren Tokens (echte Sitzordnung nachbauen)
- Leichentuch, Geiststimmen, Erinnerungsmarker, Notizen pro Spieler
- **Rote Markierung** für Spieler, die diese Nacht ungeschützt sterben

**Nacht-Reihenfolge & Assistent**
- Gefilterte, abhakbare Reihenfolge; der nächste fällige Spieler leuchtet im Grimoire
- **Nacht-Assistent** rechnet Info-Fähigkeiten aus (Empath, Chef, Fortune Teller, Undertaker, Ravenkeeper, Washerwoman/Librarian/Investigator) – inklusive Drunk-/Poison-Warnung und Recluse/Spy-Hinweisen
- **Setup & Vorbereitung**: Marker vorbereiten (z. B. Investigator „Minion/Wrong“) und in der Nacht wieder angezeigt bekommen
- Info-Plättchen als Vollbild-Karten zum Vorzeigen („DIES ist der Dämon“, „DU bist …“, Bluffs …), eigene Karten anlegbar

**Tag**
- Vereinfachte Abstimmung (Nominierten antippen → Banner → auszählen)
- **Slayer**- und **Virgin**-Fähigkeiten integriert
- Automatischer Nacht-Tod am Morgen (ungeschützte Opfer sterben, Marker werden aufgeräumt)

**Drumherum**
- **Chronik** – Verlauf nach Tag/Nacht sortiert plus ⭐-Endauswertung
- Diskussions-Timer, Verdeck-Screen („Der Erzähler denkt nach …“, 3× tippen zum Entsperren)
- Skript-Referenz (beide Nacht-Reihenfolgen + alle Charaktere)
- **Prozedurale Sounds** (WebAudio, keine Dateien) – Ambiente & Effekte einzeln schaltbar
- **ESP32-Kerzen**: pro Spieler eine echte flackernde LED-Kerze, die beim Tod erlischt

---

## 🚀 Starten

### Auf dem iPad/Handy (empfohlen) – GitHub Pages
Einmalig aktivieren: **Settings → Pages → Source: „Deploy from a branch“ → Branch `main` / `root` → Save**. Nach ~1 Minute ist die App erreichbar unter:

**https://lakryu.github.io/botc-grimoire/**

Einfach in Safari öffnen und **„Zum Home-Bildschirm hinzufügen“** – läuft dann als Vollbild-App und offline. (Hinweis: Pages braucht ein öffentliches Repo; die ESP32-Kerzen funktionieren nur über die lokale Variante, da `ws://` unter `https` blockiert wird.)

### Lokal im WLAN
Nötig für die ESP32-Kerzen (die brauchen `ws://` und damit http-Hosting). Im Projektordner:

```bash
python -m http.server 8321
```

Dann am iPad/Handy `http://<PC-IP>:8321` öffnen (PC und Gerät im selben WLAN).

---

## 🕯️ ESP32-Kerzen (optional)

Physische LED-Kerzen pro Spieler, gesteuert per WebSocket. Firmware und Anleitung liegen unter [`esp32/`](esp32/). Die App sendet Kerzenzustände (an/aus pro Sitzplatz) und Szenen (Nacht/Tag/Tod). Adresse in der App unter 🕯 **Kerzen** eintragen.

---

## 🛠️ Technik

- Vanilla JavaScript (ES-Module), plain HTML + CSS – kein Build-Step
- PWA mit Service Worker (Offline-Cache)
- Charakterdaten & Icons unter `data/` bzw. `assets/icons/`
- Touch-first, funktioniert auf iPad Safari; Handy-Layout separat optimiert

---

## 🙏 Credits

- **Blood on the Clocktower** ist ein Spiel von **[The Pandemonium Institute](https://bloodontheclocktower.com/)**. Dieses inoffizielle Fan-Tool ist nicht mit ihnen verbunden.
- Charakterdaten, Nacht-Reihenfolge und Icons stammen aus dem Open-Source-Projekt **[bra1n/townsquare](https://github.com/bra1n/townsquare)** (clocktower.online).
