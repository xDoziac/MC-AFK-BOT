"use strict";

const { addLog } = require("../logger");
const { trackInterval } = require("../state");

const NIGHT_START = 12541; // matches vanilla "can sleep" window
const NIGHT_END = 23458;

function initBeds(bot, config) {
  if (!config.modules.beds || !config.beds["place-night"]) return;

  let trying = false;

  const id = trackInterval(
    setInterval(async () => {
      if (!bot.entity || !bot.time || trying) return;

      const t = bot.time.timeOfDay;
      const isNight = t >= NIGHT_START && t <= NIGHT_END;
      if (!isNight || bot.isSleeping) return;

      const bedBlock = bot.findBlock({
        matching: (block) => block.name && block.name.includes("bed"),
        maxDistance: 8,
      });
      if (!bedBlock) return;

      trying = true;
      try {
        await bot.sleep(bedBlock);
        addLog("[Beds] Sleeping for the night.");
      } catch (err) {
        // Common and harmless: monsters nearby, not night yet on this
        // server's clock, bed occupied, etc.
        addLog("[Beds] Could not sleep:", err.message);
      } finally {
        trying = false;
      }
    }, 10000),
  );
  return id;
}

module.exports = { initBeds };
