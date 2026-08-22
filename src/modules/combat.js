"use strict";

const { addLog } = require("../logger");

const ATTACK_COOLDOWN_MS = 650; // just above vanilla 1.9+ attack cooldown
const ATTACK_RANGE = 4;

function initCombat(bot, config) {
  if (!config.modules.combat) return;

  if (config.combat["attack-mobs"]) initAttackMobs(bot);
  if (config.combat["auto-eat"]) initAutoEat(bot);
}

function initAttackMobs(bot) {
  let lastAttack = 0;

  const onTick = () => {
    if (!bot.entity) return;
    const now = Date.now();
    if (now - lastAttack < ATTACK_COOLDOWN_MS) return;

    try {
      const target = bot.nearestEntity(
        (e) =>
          e.type === "hostile" &&
          e.position &&
          bot.entity.position.distanceTo(e.position) <= ATTACK_RANGE,
      );
      if (target) {
        bot.attack(target);
        lastAttack = now;
      }
    } catch (err) {
      // Entity can vanish between the lookup and the attack call
      // (killed by something else, unloaded chunk, etc.) — not fatal.
      addLog("[Combat] attack error:", err.message);
    }
  };

  bot.on("physicsTick", onTick);
}

function initAutoEat(bot) {
  let eating = false;

  const onHealth = () => {
    if (eating) return;
    if (bot.food === undefined || bot.food >= 18) return;

    const food = bot.inventory
      .items()
      .find((item) => item.foodPoints > 0 || FOOD_NAME_FALLBACK.has(item.name));
    if (!food) return;

    eating = true;
    bot
      .equip(food, "hand")
      .then(() => bot.consume())
      .catch((err) => addLog("[AutoEat] error:", err.message))
      .finally(() => {
        eating = false;
      });
  };

  bot.on("health", onHealth);
}

// minecraft-data's foodPoints isn't populated for every server/version combo,
// so fall back to a name check for the common staples.
const FOOD_NAME_FALLBACK = new Set([
  "bread",
  "cooked_beef",
  "cooked_porkchop",
  "cooked_chicken",
  "cooked_mutton",
  "cooked_salmon",
  "cooked_cod",
  "apple",
  "carrot",
  "baked_potato",
  "golden_apple",
]);

module.exports = { initCombat };
