/*
 * BotC-Kerzen — ESP32-Firmware
 * Eine adressierbare LED (WS2812/NeoPixel) pro Spieler als flackernde Kerze.
 * Die Grimoire-App verbindet sich per WebSocket und schaltet Kerzen an/aus.
 *
 * Benötigte Bibliotheken (Arduino-Bibliotheksverwalter):
 *   - "WebSockets" von Markus Sattler (Links2004)
 *   - "Adafruit NeoPixel"
 *   - "ArduinoJson" von Benoit Blanchon
 *
 * Protokoll (JSON, App -> ESP):
 *   {"type":"candles","states":[1,0,1,...]}   Index = Sitzplatz, 1 = an
 *   {"type":"scene","value":"night"|"day"|"death"|"off"}
 *   {"type":"ping"}  -> Antwort {"type":"pong"}
 *
 * In der App unter 🕯 Kerzen eintragen:  ws://<IP-des-ESP>:81
 */
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// ====== ANPASSEN ======
const char* WIFI_SSID = "DEIN_WLAN";
const char* WIFI_PASS = "DEIN_PASSWORT";
#define LED_PIN    5      // Datenpin des LED-Strips
#define MAX_CANDLES 20    // LEDs / maximale Spielerzahl
// ======================

Adafruit_NeoPixel strip(MAX_CANDLES, LED_PIN, NEO_GRB + NEO_KHZ800);
WebSocketsServer ws(81);

bool candleOn[MAX_CANDLES];
uint8_t flicker[MAX_CANDLES];
String scene = "day";
unsigned long deathUntil = 0;

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(120);
  for (int i = 0; i < MAX_CANDLES; i++) candleOn[i] = true;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Verbinde mit WLAN");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nVerbunden! In der App eintragen:  ws://%s:81\n", WiFi.localIP().toString().c_str());

  ws.begin();
  ws.onEvent(onWsEvent);
}

void onWsEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t len) {
  if (type != WStype_TEXT) return;
  StaticJsonDocument<768> doc;
  if (deserializeJson(doc, payload, len)) return;
  const char* t = doc["type"] | "";

  if (strcmp(t, "candles") == 0) {
    JsonArray states = doc["states"];
    for (int i = 0; i < MAX_CANDLES; i++)
      candleOn[i] = (i < (int)states.size()) ? (states[i].as<int>() == 1) : false;
  } else if (strcmp(t, "scene") == 0) {
    scene = String((const char*)(doc["value"] | "day"));
    if (scene == "death") deathUntil = millis() + 2500;
  } else if (strcmp(t, "ping") == 0) {
    ws.sendTXT(client, "{\"type\":\"pong\"}");
  }
}

// warmes Kerzenflackern
uint32_t candleColor(int i, float dim) {
  flicker[i] += random(1, 9);
  float f = 0.72f + 0.28f * (sin(flicker[i] * 0.13f) * 0.5f + 0.5f) * (random(70, 100) / 100.0f);
  uint8_t r = (uint8_t)(255 * f * dim);
  uint8_t g = (uint8_t)(120 * f * dim);
  uint8_t b = (uint8_t)(18  * f * dim);
  return strip.Color(r, g, b);
}

void loop() {
  ws.loop();

  float dim = 1.0f;                       // Tagszene: volle Helligkeit
  if (scene == "night") dim = 0.55f;      // Nacht: gedimmt & ruhiger
  if (scene == "off")   dim = 0.0f;

  bool deathFlash = millis() < deathUntil; // Todesszene: kurzes rotes Pulsieren

  for (int i = 0; i < MAX_CANDLES; i++) {
    if (!candleOn[i] || dim == 0.0f) {
      strip.setPixelColor(i, 0);
    } else if (deathFlash) {
      float p = (sin(millis() * 0.02f) * 0.5f + 0.5f);
      strip.setPixelColor(i, strip.Color((uint8_t)(180 * p), 0, 0));
    } else {
      strip.setPixelColor(i, candleColor(i, dim));
    }
  }
  strip.show();
  delay(33);
}
