"use strict";

/**
 * Single shared, mutable state object. Kept in one place (instead of scattered
 * module-level `let`s) so every part of the app reads/writes the same truth
 * and nothing gets out of sync across reconnects.
 */
const state = {
  bot: null,
  connected: false,
  spawnedAt: null,
  startTime: Date.now(),
  reconnectAttempts: 0,
  wasThrottled: false,
  manuallyStopped: false, // true after /stop, prevents auto-reconnect
  isReconnecting: false,
  lastError: null,
  errors: [], // capped ring buffer of recent errors
  // timers/intervals that belong to the *current* bot connection.
  // Always cleared before a new bot is created so nothing leaks across
  // reconnects (this was the root cause of most "gets slower over time"
  // and "duplicate messages" bugs in the old version).
  activeIntervals: [],
  activeTimeouts: [],
};

const MAX_ERRORS = 25;

function pushError(type, message) {
  state.lastError = { type, message, time: Date.now() };
  state.errors.push(state.lastError);
  if (state.errors.length > MAX_ERRORS) state.errors.shift();
}

function trackInterval(id) {
  state.activeIntervals.push(id);
  return id;
}

function trackTimeout(id) {
  state.activeTimeouts.push(id);
  return id;
}

function clearAllTimers() {
  state.activeIntervals.forEach(clearInterval);
  state.activeTimeouts.forEach(clearTimeout);
  state.activeIntervals = [];
  state.activeTimeouts = [];
}

module.exports = { state, pushError, trackInterval, trackTimeout, clearAllTimers };
