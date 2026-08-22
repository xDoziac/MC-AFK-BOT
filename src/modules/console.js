"use strict";

const readline = require("readline");
const { addLog } = require("../logger");
const { state } = require("../state");

function initConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const bot = state.bot;
    if (!bot || !state.connected) {
      addLog("[Console] Bot is not connected — command ignored.");
      return;
    }

    try {
      if (trimmed.startsWith("say ")) {
        bot.chat(trimmed.slice(4));
      } else if (trimmed.startsWith("cmd ")) {
        bot.chat("/" + trimmed.slice(4));
      } else if (trimmed === "status") {
        const uptimeSec = Math.floor((Date.now() - state.startTime) / 1000);
        addLog(`[Console] connected=${state.connected} uptime=${uptimeSec}s`);
      } else {
        bot.chat(trimmed);
      }
    } catch (err) {
      addLog("[Console] command error:", err.message);
    }
  });

  return rl;
}

module.exports = { initConsole };
