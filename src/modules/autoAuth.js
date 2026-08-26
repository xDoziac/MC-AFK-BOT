"use strict";

const { addLog } = require("../logger");

/**
 * Handles AuthMe/EasyAuth-style /login /register prompts.
 *
 * IMPORTANT: this does NOT rely solely on spotting a chat prompt. Some auth
 * plugins/mods (EasyAuth in particular) show their login instructions via a
 * translated system message or title packet rather than a plain chat line,
 * so bot.on('messagestr') never sees anything to match — the auth window
 * then just times out with no visible attempt in the logs. To be robust
 * against that, we proactively send /register then /login shortly after
 * spawning, regardless of whether we saw a prompt. Sending the "wrong" one
 * of the pair is harmless — the plugin just replies "already registered" or
 * "not registered", which we ignore. We still also react to any chat-based
 * prompt for plugins that *do* send one, since that provides faster/more
 * targeted timing when it's available.
 */
function initAutoAuth(bot, config) {
  const cfg = config.utils["auto-auth"];
  if (!cfg.enabled) return;
  if (!cfg.password) {
    addLog("[AutoAuth] Enabled but no password set in settings.json — skipping.");
    return;
  }

  let attempted = false;
  const attempt = (reason) => {
    if (attempted) return;
    attempted = true;
    try {
      bot.chat(`/register ${cfg.password} ${cfg.password}`);
      addLog(`[AutoAuth] Sent /register (${reason})`);
    } catch (err) {
      addLog("[AutoAuth] /register send error:", err.message);
    }
    setTimeout(() => {
      if (!bot.entity) return;
      try {
        bot.chat(`/login ${cfg.password}`);
        addLog(`[AutoAuth] Sent /login (${reason})`);
      } catch (err) {
        addLog("[AutoAuth] /login send error:", err.message);
      }
    }, 1500);
  };

  // Proactive: don't wait for a prompt we might never see.
  setTimeout(() => attempt("proactive, post-spawn"), 1000);

  // Reactive fallback: some servers do send a plain chat prompt, and
  // reacting to it can be a bit faster than the fixed proactive delay.
  bot.on("messagestr", (message) => {
    const text = String(message).toLowerCase();
    if (text.includes("/register") || text.includes("please register") ||
        text.includes("/login") || text.includes("please login")) {
      attempt("chat prompt detected");
    }
  });
}

module.exports = { initAutoAuth };
