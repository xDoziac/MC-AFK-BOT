"use strict";

const { addLog } = require("../logger");
const { trackInterval } = require("../state");

const DANGER_RANGE = 5;

/**
 * Simple, dependency-free "back away" behaviour: if a hostile mob is closer
 * than DANGER_RANGE, face away from it and step backward briefly. This is
 * only meaningful when combat is disabled — if combat is on, attacking is
 * the priority and this module steps aside.
 */
function initAvoidMobs(bot, config) {
  if (!config.modules["avoid-mobs"]) return;
  if (config.modules.combat && config.combat["attack-mobs"]) return;

  let backingAway = false;

  const id = setInterval(() => {
    if (!bot.entity || backingAway) return;

    try {
      const threat = bot.nearestEntity(
        (e) =>
          e.type === "hostile" &&
          e.position &&
          bot.entity.position.distanceTo(e.position) <= DANGER_RANGE,
      );
      if (!threat) return;

      const dx = bot.entity.position.x - threat.position.x;
      const dz = bot.entity.position.z - threat.position.z;
      const yawAwayFromThreat = Math.atan2(-dx, dz);

      bot.look(yawAwayFromThreat, 0, true);
      bot.setControlState("forward", true);
      backingAway = true;
      setTimeout(() => {
        if (bot && bot.entity) bot.setControlState("forward", false);
        backingAway = false;
      }, 800);
    } catch (err) {
      addLog("[AvoidMobs] error:", err.message);
      backingAway = false;
    }
  }, 1000);
  trackInterval(id);
}

module.exports = { initAvoidMobs };
