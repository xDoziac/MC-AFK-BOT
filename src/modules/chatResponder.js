"use strict";

const { addLog } = require("../logger");

function initChatResponder(bot, config, onChatEvent) {
  if (!config.modules.chat) return;

  bot.on("chat", (username, message) => {
    if (username === bot.username) return; // never react to our own messages

    if (config.utils["chat-log"]) {
      addLog(`[Chat] <${username}> ${message}`);
    }

    if (typeof onChatEvent === "function") {
      try {
        onChatEvent(username, message);
      } catch (err) {
        addLog("[Chat] onChatEvent error:", err.message);
      }
    }

    if (!config.chat.respond) return;

    try {
      const lower = message.toLowerCase();
      if (lower === "!ping") {
        bot.chat("pong");
      } else if (lower.includes("hello") || lower.includes(" hi ") || lower === "hi") {
        bot.chat(`Hey, ${username}!`);
      }
    } catch (err) {
      addLog("[Chat] respond error:", err.message);
    }
  });
}

module.exports = { initChatResponder };
