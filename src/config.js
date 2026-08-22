"use strict";

const fs = require("fs");
const path = require("path");
const { addLog } = require("./logger");

const SETTINGS_PATH =
  process.env.SETTINGS_PATH || path.join(__dirname, "..", "settings.json");

const DEFAULTS = {
  name: "AFK Bot",
  "bot-account": { username: "AFKBot", password: "", type: "offline" },
  server: { ip: "localhost", port: 25565, version: "" },
  utils: {
    "auto-auth": { enabled: false, password: "" },
    "anti-afk": { enabled: true, sneak: true },
    "chat-messages": {
      enabled: false,
      repeat: true,
      "repeat-delay": 120,
      messages: [],
    },
    "chat-log": true,
    "auto-reconnect": true,
    "auto-reconnect-delay": 3000,
    "max-reconnect-delay": 120000,
  },
  movement: {
    enabled: true,
    "circle-walk": { enabled: true, radius: 4, speed: 3000 },
    "look-around": { enabled: true, interval: 5000 },
    "random-jump": { enabled: true, interval: 15000 },
  },
  modules: { "avoid-mobs": true, combat: true, beds: false, chat: true },
  combat: { "attack-mobs": true, "auto-eat": true },
  beds: { "place-night": false },
  discord: {
    enabled: false,
    webhookUrl: "",
    events: { connect: true, disconnect: true, chat: false },
  },
  chat: { respond: true },
  dashboard: {
    enabled: true,
    port: 3000,
    "self-ping": { enabled: false, url: "" },
  },
};

/** Recursively merge `overrides` on top of `base`, without mutating either. */
function deepMerge(base, overrides) {
  if (Array.isArray(base) || Array.isArray(overrides)) {
    return overrides !== undefined ? overrides : base;
  }
  if (typeof base !== "object" || base === null) {
    return overrides !== undefined ? overrides : base;
  }
  const result = { ...base };
  if (typeof overrides === "object" && overrides !== null) {
    for (const key of Object.keys(overrides)) {
      result[key] = deepMerge(base[key], overrides[key]);
    }
  }
  return result;
}

function loadConfig() {
  let userConfig = {};
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    userConfig = JSON.parse(raw);
  } catch (err) {
    addLog(
      `[Config] Could not read/parse settings.json (${err.message}). Falling back to defaults.`,
    );
    userConfig = {};
  }

  const merged = deepMerge(DEFAULTS, userConfig);

  // Basic sanity checks that would otherwise crash the bot much later
  // with a confusing stack trace.
  if (!merged.server.ip || typeof merged.server.ip !== "string") {
    throw new Error("settings.json: server.ip must be a non-empty string");
  }
  if (
    !Number.isInteger(merged.server.port) ||
    merged.server.port <= 0 ||
    merged.server.port > 65535
  ) {
    throw new Error("settings.json: server.port must be a valid port number");
  }
  if (!merged["bot-account"].username) {
    throw new Error("settings.json: bot-account.username is required");
  }

  return merged;
}

module.exports = { loadConfig, SETTINGS_PATH };
