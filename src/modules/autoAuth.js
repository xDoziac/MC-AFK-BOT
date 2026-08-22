"use strict";

const { addLog } = require("../logger");

/**
 * Reactively answers common AuthMe-style /login /register prompts.
 * Guards against sending the command more than once per prompt (the old
 * bot could spam /register on every matching chat line).
 */
function initAutoAuth(bot, config) {
  const cfg = config.utils["auto-auth"];
  if (!cfg.enabled) return;
  if (!cfg.password) {
    addLog("[AutoAuth] Enabled but no password set in settings.json — skipping.");
    return;
  }

  let attempted = false;

  const handler = (message) => {
    const text = String(message).toLowerCase();
    if (attempted) return;

    const wantsRegister =
      text.includes("/register") || text.includes("please register");
    const wantsLogin =
      text.includes("/login") || text.includes("please login");

    if (wantsRegister) {
      attempted = true;
      bot.chat(`/register ${cfg.password} ${cfg.password}`);
      addLog("[AutoAuth] Sent /register");
      setTimeout(() => (attempted = false), 5000);
    } else if (wantsLogin) {
      attempted = true;
      bot.chat(`/login ${cfg.password}`);
      addLog("[AutoAuth] Sent /login");
      setTimeout(() => (attempted = false), 5000);
    }
  };

  bot.on("messagestr", handler);
}

module.exports = { initAutoAuth };
