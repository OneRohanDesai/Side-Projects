/* Shared client: API + WebSocket realtime */

const TT = {
  state: {
    tables: [],
    orders: [],
    menu: [],
    staff: [],
    assignments: [],
    tickets: [],
    stations: [],
    analytics: null,
  },
  listeners: {},
  ws: null,
  connected: false,
  _ping: null,
};

TT.on = function (event, fn) {
  (TT.listeners[event] ||= []).push(fn);
};

TT.emit = function (event, data) {
  (TT.listeners[event] || []).forEach((fn) => {
    try { fn(data); } catch (e) { console.error(e); }
  });
  (TT.listeners["*"] || []).forEach((fn) => {
    try { fn(event, data); } catch (e) { console.error(e); }
  });
};

TT.api = async function (path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.detail) || res.statusText || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
};

TT.connect = function () {
  if (TT.ws && (TT.ws.readyState === 0 || TT.ws.readyState === 1)) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  TT.ws = new WebSocket(`${proto}://${location.host}/ws`);

  TT.ws.onopen = () => {
    TT.connected = true;
    TT._setLive(true);
    clearInterval(TT._ping);
    TT._ping = setInterval(() => {
      if (TT.ws?.readyState === 1) TT.ws.send("ping");
    }, 20000);
  };

  TT.ws.onclose = () => {
    TT.connected = false;
    TT._setLive(false);
    clearInterval(TT._ping);
    setTimeout(() => TT.connect(), 1500);
  };

  TT.ws.onerror = () => TT.ws?.close();

  TT.ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    const { event, data } = msg;
    if (event === "snapshot") {
      Object.assign(TT.state, data || {});
      TT.emit("snapshot", TT.state);
      TT.emit("change", TT.state);
      return;
    }
    if (event === "tables_updated") TT.state.tables = data;
    if (event === "orders_updated") TT.state.orders = data;
    if (event === "menu_updated") TT.state.menu = data;
    if (event === "staff_updated") TT.state.staff = data;
    if (event === "assignments_updated") TT.state.assignments = data;
    if (event === "tickets_updated") TT.state.tickets = data;
    if (event === "analytics_updated") TT.state.analytics = data;
    if (event === "simulation_status") TT.state.simulation = data;
    TT.emit(event, data);
    TT.emit("change", TT.state);
  };
};

TT._setLive = function (on) {
  document.querySelectorAll(".live-dot").forEach((el) => el.classList.toggle("on", on));
};

TT.bootstrap = async function () {
  TT.connect();
  try {
    const s = await TT.api("/state");
    Object.assign(TT.state, s);
    TT.emit("snapshot", TT.state);
    TT.emit("change", TT.state);
  } catch (e) {
    console.warn("bootstrap failed, waiting for WS", e);
  }
};

TT.toast = function (msg, ms = 2400) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
};

TT.timeAgo = function (iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

TT.fmtMoney = function (n) {
  return "$" + (Number(n) || 0).toFixed(2);
};

TT.fmtTimer = function (secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

TT.statusLabel = function (s) {
  return (s || "").replaceAll("_", " ");
};

TT.play = function (id) {
  const a = document.getElementById(id);
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {});
};

TT.modal = function ({ title, bodyHTML, actions }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog">
      <h3>${title}</h3>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-actions"></div>
    </div>`;
  const actionsEl = backdrop.querySelector(".modal-actions");
  (actions || []).forEach((a) => {
    const b = document.createElement("button");
    b.textContent = a.label;
    if (a.className) b.className = a.className;
    b.onclick = async () => {
      try {
        if (a.onClick) await a.onClick(backdrop);
        if (!a.keepOpen) backdrop.remove();
      } catch (e) {
        TT.toast(e.message || String(e));
      }
    };
    actionsEl.appendChild(b);
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  return backdrop;
};

// Mark active nav
document.addEventListener("DOMContentLoaded", () => {
  const path = location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".role-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (path === "/" && href === "/")) a.classList.add("active");
  });
});
