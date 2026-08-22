"use strict";

const { addLog } = require("../logger");
const { trackInterval } = require("../state");

/**
 * NOTE ON DESIGN: the original bot mixed mineflayer-pathfinder (goal-based
 * navigation) with raw setControlState() calls for "anti-afk". Pathfinder
 * periodically fights raw control state (it resets controls every tick to
 * follow its own path), which caused the jittery/broken movement players
 * reported. This rewrite drops pathfinder entirely for movement and only
 * ever uses bot.setControlState/bot.look, which is simple and predictable.
 */
function initMovement(bot, config) {
  if (!config.movement.enabled) return;

  initAntiAfkSneak(bot, config);
  initCircleWalk(bot, config);
  initLookAround(bot, config);
  initRandomJump(bot, config);
}

function initAntiAfkSneak(bot, config) {
  const cfg = config.utils["anti-afk"];
  if (!cfg.enabled || !cfg.sneak) return;

  let sneaking = false;
  const id = setInterval(() => {
    if (!bot.entity) return;
    try {
      sneaking = !sneaking;
      bot.setControlState("sneak", sneaking);
    } catch (err) {
      addLog("[AntiAFK] sneak error:", err.message);
    }
  }, 2500);
  trackInterval(id);
}

function initCircleWalk(bot, config) {
  const cfg = config.movement["circle-walk"];
  if (!cfg.enabled) return;

  const radius = Math.max(1, Number(cfg.radius) || 4);
  const tickMs = Math.max(500, Number(cfg.speed) || 3000);
  // Bigger radius -> gentler turn per tick, so the loop stays roughly the
  // requested size instead of spinning in place.
  const yawStepPerTick = Math.PI / (radius * 2);

  bot.setControlState("forward", true);

  const id = setInterval(() => {
    if (!bot.entity) return;
    try {
      const currentYaw = bot.entity.yaw || 0;
      bot.look(currentYaw + yawStepPerTick, 0, true);
    } catch (err) {
      addLog("[Movement] circle-walk error:", err.message);
    }
  }, tickMs);
  trackInterval(id);
}

function initLookAround(bot, config) {
  const cfg = config.movement["look-around"];
  if (!cfg.enabled) return;

  const id = setInterval(() => {
    if (!bot.entity) return;
    try {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = Math.random() * 0.6 - 0.3;
      bot.look(yaw, pitch, true);
    } catch (err) {
      addLog("[Movement] look-around error:", err.message);
    }
  }, Math.max(1000, Number(cfg.interval) || 5000));
  trackInterval(id);
}

function initRandomJump(bot, config) {
  const cfg = config.movement["random-jump"];
  if (!cfg.enabled) return;

  const id = setInterval(() => {
    if (!bot.entity) return;
    try {
      bot.setControlState("jump", true);
      setTimeout(() => {
        // Bot may have disconnected between the jump starting and this
        // callback firing — guard before touching controls.
        if (bot && bot.entity) bot.setControlState("jump", false);
      }, 250);
    } catch (err) {
      addLog("[Movement] random-jump error:", err.message);
    }
  }, Math.max(2000, Number(cfg.interval) || 15000));
  trackInterval(id);
}

module.exports = { initMovement };
