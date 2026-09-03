// Kleine DOM-Helfer: Panels, Dialoge, Elementbau
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

const panel = () => document.getElementById("panel");
const overlay = () => document.getElementById("overlay");

export function openPanel(title, body) {
  const p = panel();
  p.innerHTML = "";
  p.append(
    el("div", { class: "panel-head" },
      el("h2", {}, title),
      el("button", { class: "closebtn", onclick: closePanel }, "✕")),
    el("div", { class: "panel-body" }, body)
  );
  p.classList.remove("hidden");
}
export function closePanel() { panel().classList.add("hidden"); }
export function panelOpen() { return !panel().classList.contains("hidden"); }

export function openDialog({ title, body, buttons = [], full = false, onClose = null }) {
  const o = overlay();
  o.innerHTML = "";
  o.className = "overlay" + (full ? " full" : "");
  const dlg = el("div", { class: "dialog" });
  if (title !== null) {
    dlg.append(el("div", { class: "dlg-head" },
      el("span", {}, title),
      el("button", { class: "closebtn", onclick: () => { closeDialog(); onClose?.(); } }, "✕")));
  }
  dlg.append(el("div", { class: "dlg-body" }, body));
  if (buttons.length) {
    dlg.append(el("div", { class: "dlg-foot" },
      ...buttons.map(b => el("button", { class: "btn " + (b.class || ""), onclick: b.onclick }, b.label))));
  }
  o.append(dlg);
  o.classList.remove("hidden");
  return dlg;
}
export function closeDialog() {
  const o = overlay();
  o.classList.add("hidden");
  o.innerHTML = "";
}

export function toast(msg) {
  const t = el("div", {
    style: "position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:var(--panel2);border:1px solid var(--gold-dim);padding:10px 22px;border-radius:999px;z-index:200;font-size:15px;color:var(--parchment);box-shadow:0 4px 20px rgba(0,0,0,.6);"
  }, msg);
  document.body.append(t);
  setTimeout(() => { t.style.transition = "opacity .5s"; t.style.opacity = "0"; }, 1800);
  setTimeout(() => t.remove(), 2400);
}

export function confirmDlg(text, onYes) {
  openDialog({
    title: "Sicher?",
    body: el("p", { style: "font-size:16px" }, text),
    buttons: [
      { label: "Abbrechen", onclick: closeDialog },
      { label: "Ja", class: "danger", onclick: () => { closeDialog(); onYes(); } },
    ],
  });
}
