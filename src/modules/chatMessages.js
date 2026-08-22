"use strict";

const { addLog } = require("../logger");
const { trackInterval, trackTimeout } = require("../state");

function initChatMessages(bot, config) {
  const cfg = config.utils["chat-messages"];
  if (!cfg.enabled || !Array.isArray(cfg.messages) || cfg.messages.length === 0)
    return;

  const delayMs = Math.max(10, Number(cfg["repeat-delay"]) || 120) * 1000;
  let index = 0;

  const sendNext = () => {
    if (!bot.entity) return;
    try {
      bot.chat(cfg.messages[index % cfg.messages.length]);
      index++;
    } catch (err) {
      addLog("[ChatMessages] send error:", err.message);
    }
  };

  // Stagger the first message so it doesn't fire the instant we spawn.
  trackTimeout(setTimeout(sendNext, 5000));

  if (cfg.repeat) {
    trackInterval(setInterval(sendNext, delayMs));
  }
}

module.exports = { initChatMessages };
