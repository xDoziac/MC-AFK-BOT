"use strict";

const https = require("https");
const http = require("http");
const { addLog } = require("../logger");

const RATE_LIMIT_MS = 3000;
let lastSend = 0;
let queued = null;

function sendDiscordWebhook(config, content, color = 0x0099ff) {
  const cfg = config.discord;
  if (!cfg || !cfg.enabled) return;
  if (!cfg.webhookUrl || !/^https?:\/\//.test(cfg.webhookUrl)) {
    addLog("[Discord] Enabled but webhookUrl is missing/invalid — skipping.");
    return;
  }

  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastSend);
  if (wait > 0) {
    // Coalesce bursts (e.g. rapid connect/disconnect flapping) into the
    // most recent message instead of queuing every single one.
    queued = { content, color };
    setTimeout(() => {
      if (queued) {
        const q = queued;
        queued = null;
        doSend(cfg.webhookUrl, q.content, q.color);
      }
    }, wait);
    return;
  }

  doSend(cfg.webhookUrl, content, color);
}

function doSend(webhookUrl, content, color) {
  lastSend = Date.now();

  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    addLog("[Discord] Invalid webhook URL, skipping send.");
    return;
  }

  const payload = JSON.stringify({
    embeds: [{ description: content, color, timestamp: new Date().toISOString() }],
  });

  const protocol = url.protocol === "http:" ? http : https;
  const req = protocol.request(
    {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 8000,
    },
    (res) => {
      res.on("data", () => {}); // drain
      res.on("error", () => {});
    },
  );

  req.on("timeout", () => req.destroy());
  req.on("error", (err) => addLog("[Discord] webhook error:", err.message));
  req.write(payload);
  req.end();
}

module.exports = { sendDiscordWebhook };
