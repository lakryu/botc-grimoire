# ESP32-Kerzen für die Grimoire-App

Physische, flackernde LED-Kerzen pro Spieler. Stirbt jemand im Grimoire, geht seine Kerze aus.

## Hardware
- 1× ESP32 (beliebiges Dev-Board)
- 1× WS2812/NeoPixel-Strip oder einzelne NeoPixel (eine LED pro Spieler, Reihenfolge = Sitzreihenfolge)
- 5-V-Netzteil (bei vielen LEDs), Datenleitung an GPIO 5 (im Sketch änderbar)

Schöner Aufbau: pro Spieler ein kleines Teelichtglas/3D-gedrucktes Kerzengehäuse mit einer NeoPixel-LED, alle in Reihe verkabelt rund um den Tisch.

## Einrichtung
1. Arduino IDE: Bibliotheken **WebSockets** (Markus Sattler), **Adafruit NeoPixel**, **ArduinoJson** installieren.
2. In `candles/candles.ino` WLAN-Zugangsdaten, `LED_PIN` und `MAX_CANDLES` anpassen.
3. Flashen, seriellen Monitor öffnen — der ESP gibt seine Adresse aus, z. B. `ws://192.168.1.42:81`.
4. In der App: 🕯 **Kerzen** → Adresse eintragen → **Verbinden**.

Wichtig: iPad und ESP32 müssen im selben WLAN sein. Da die App per HTTP/Datei läuft, blockiert der Browser `ws://` nicht (bei HTTPS-Hosting würde er das — App dann lokal hosten).

## Protokoll
Die App sendet JSON-Textframes:

| Nachricht | Bedeutung |
|---|---|
| `{"type":"candles","states":[1,0,1]}` | Kerze pro Sitzplatz an/aus (Index 0 = Spieler 1) |
| `{"type":"scene","value":"night"}` | Szenen: `night` (gedimmt), `day` (hell), `death` (rotes Pulsieren, 2,5 s), `off` |
| `{"type":"ping"}` | ESP antwortet `{"type":"pong"}` |
