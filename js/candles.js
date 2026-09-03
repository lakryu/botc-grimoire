// ESP32-Kerzensteuerung per WebSocket.
// Protokoll (JSON, App -> ESP):
//   {"type":"candles","states":[1,0,1,...]}   1 = an, 0 = aus (Index = Sitzplatz)
//   {"type":"scene","value":"night"|"day"|"death"|"off"}
//   {"type":"ping"}
// ESP -> App: {"type":"pong"} oder beliebiger Status.
import { state } from "./state.js";

let ws = null;
let connected = false;
let reconnectTimer = null;
const listeners = new Set();

export function onStatus(fn) { listeners.add(fn); }
function emit() { for (const fn of listeners) fn(connected); }

export function isConnected() { return connected; }

export function connect() {
  disconnect();
  const url = state.settings.espUrl?.trim();
  if (!url) return;
  try {
    ws = new WebSocket(url.startsWith("ws") ? url : "ws://" + url);
  } catch { return; }
  ws.onopen = () => { connected = true; emit(); syncCandles(); };
  ws.onclose = () => {
    connected = false; emit();
    if (state.settings.candlesEnabled && state.settings.espUrl) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 5000);
    }
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

export function disconnect() {
  clearTimeout(reconnectTimer);
  if (ws) { ws.onclose = null; try { ws.close(); } catch {} ws = null; }
  connected = false; emit();
}

function send(obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}

// Kerzenzustände aus dem Spielzustand ableiten und senden
export function syncCandles() {
  send({ type: "candles", states: state.players.map(p => (p.dead ? 0 : 1)) });
}

export function scene(value) { send({ type: "scene", value }); }
