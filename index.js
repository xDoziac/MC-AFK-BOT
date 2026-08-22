"use strict";

const { addLog } = require("./src/logger");
const { loadConfig } = require("./src/config");
const { startServer } = require("./src/server");
const { startBot, stopBot } = require("./src/botManager");
const { initConsole } = require("./src/modules/console");
const { pushError } = require("./src/state");

let config;
try {
  config = loadConfig();
} catch (err) {
  // A bad settings.json should fail loudly and immediately, not crash the
  // process 10 seconds later inside some unrelated module.
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
}

addLog(`[Boot] Starting ${config.name} for ${config.server.ip}:${config.server.port}`);

startServer(config);
startBot(config);
initConsole();

// Safety nets: log and keep running instead of letting one bad promise or
// stray exception kill the whole process (which then relies on the host
// platform to restart it — slow, and loses in-memory logs/state).
process.on("uncaughtException", (err) => {
  addLog(`[FATAL] Uncaught exception: ${err.stack || err.message}`);
  pushError("uncaughtException", err.message);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
  addLog(`[FATAL] Unhandled rejection: ${message}`);
  pushError("unhandledRejection", message);
});

function shutdown(signal) {
  addLog(`[Boot] Received ${signal}, shutting down...`);
  stopBot();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
