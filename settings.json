"use strict";

const express = require("express");
const http = require("http");
const https = require("https");
const { addLog, getLogs } = require("./logger");
const { state } = require("./state");
const { startBot, stopBot } = require("./botManager");

function formatUptime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function startServer(config) {
  if (!config.dashboard.enabled) {
    addLog("[Server] Dashboard disabled in settings.json.");
    return null;
  }

  const app = express();

  app.get("/", (req, res) => {
    res.type("html").send(renderDashboard(config));
  });

  app.get("/health", (req, res) => {
    res.json({
      status: state.connected ? "connected" : "disconnected",
      uptimeSeconds: Math.floor((Date.now() - state.startTime) / 1000),
      reconnectAttempts: state.reconnectAttempts,
      lastError: state.lastError,
    });
  });

  app.get("/logs", (req, res) => {
    res.json({ logs: getLogs() });
  });

  app.post("/start", (req, res) => {
    if (state.bot) return res.json({ success: false, msg: "Already running." });
    startBot(config);
    addLog("[Control] Bot started via dashboard.");
    res.json({ success: true });
  });

  app.post("/stop", (req, res) => {
    if (!state.bot) return res.json({ success: false, msg: "Already stopped." });
    stopBot();
    addLog("[Control] Bot stopped via dashboard.");
    res.json({ success: true });
  });

  app.post("/command", express.json(), (req, res) => {
    const cmd = String(req.body?.command || "").trim();
    if (!cmd) return res.json({ success: false, msg: "Empty command." });

    const bot = state.bot;
    if (!bot || !state.connected) {
      return res.json({ success: false, msg: "Bot is not connected." });
    }

    try {
      bot.chat(cmd);
      addLog(`[Console] > ${cmd}`);
      res.json({ success: true, msg: `Sent: ${cmd}` });
    } catch (err) {
      res.json({ success: false, msg: err.message });
    }
  });

  const port = Number(process.env.PORT) || config.dashboard.port || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    addLog(`[Server] Dashboard listening on port ${server.address().port}.`);
  });
  server.on("error", (err) => {
    addLog(`[Server] Failed to start: ${err.message}`);
  });

  maybeStartSelfPing(config, port);
  return server;
}

function maybeStartSelfPing(config, port) {
  const cfg = config.dashboard["self-ping"];
  if (!cfg.enabled) return;

  const url = cfg.url || `http://127.0.0.1:${port}/health`;
  const protocol = url.startsWith("https:") ? https : http;

  setInterval(() => {
    protocol
      .get(url, (res) => res.resume())
      .on("error", (err) => addLog(`[SelfPing] error: ${err.message}`));
  }, 10 * 60 * 1000); // every 10 minutes — frequent enough for free-tier hosts

  addLog(`[SelfPing] Enabled, pinging ${url} every 10 minutes.`);
}

function renderDashboard(config) {
  const uptime = formatUptime((Date.now() - state.startTime) / 1000);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(config.name || "AFK Bot")} — Dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0f1117; color:#e5e7eb; margin:0; padding:2rem; }
  h1 { margin-top:0; }
  .card { background:#171923; border-radius:10px; padding:1.2rem 1.5rem; margin-bottom:1rem; }
  .status { font-weight:600; }
  .status.connected { color:#4ade80; }
  .status.disconnected { color:#f87171; }
  button { background:#3b82f6; color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer; margin-right:0.5rem; }
  button:hover { background:#2563eb; }
  pre#logs { background:#0b0d12; padding:1rem; border-radius:8px; height:320px; overflow-y:auto; font-size:0.82rem; white-space:pre-wrap; }
  input { background:#0b0d12; border:1px solid #333; color:#e5e7eb; padding:0.5rem; border-radius:6px; width:60%; }
</style>
</head>
<body>
  <h1>${escapeHtml(config.name || "AFK Bot")}</h1>
  <div class="card">
    <div>Status: <span id="status" class="status">loading…</span></div>
    <div>Uptime: <span id="uptime">${uptime}</span></div>
    <div>Server: ${escapeHtml(config.server.ip)}:${config.server.port}</div>
  </div>
  <div class="card">
    <button onclick="post('/start')">Start</button>
    <button onclick="post('/stop')">Stop</button>
    <input id="cmd" placeholder="minecraft command or chat message">
    <button onclick="sendCmd()">Send</button>
  </div>
  <div class="card">
    <h3>Logs</h3>
    <pre id="logs">loading…</pre>
  </div>
<script>
async function refresh() {
  try {
    const h = await (await fetch('/health')).json();
    const el = document.getElementById('status');
    el.textContent = h.status;
    el.className = 'status ' + h.status;
    document.getElementById('uptime').textContent = h.uptimeSeconds + 's';
    const l = await (await fetch('/logs')).json();
    const logsEl = document.getElementById('logs');
    logsEl.textContent = l.logs.join('\\n');
    logsEl.scrollTop = logsEl.scrollHeight;
  } catch (e) { /* dashboard poll failed, retry next tick */ }
}
function post(path) { fetch(path, { method: 'POST' }).then(refresh); }
function sendCmd() {
  const input = document.getElementById('cmd');
  fetch('/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: input.value })
  }).then(refresh);
  input.value = '';
}
refresh();
setInterval(refresh, 4000);
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

module.exports = { startServer };
