"use strict";

const MAX_LOGS = 500;
const logs = [];

/**
 * Add a line to the in-memory log buffer and print it to stdout.
 * Accepts printf-style extra args like console.log does.
 */
function addLog(...parts) {
  const timestamp = new Date().toISOString();
  const message = parts
    .map((p) => (typeof p === "string" ? p : safeStringify(p)))
    .join(" ");
  const line = `[${timestamp}] ${message}`;

  logs.push(line);
  if (logs.length > MAX_LOGS) logs.shift();

  console.log(line);
}

function safeStringify(value) {
  try {
    if (value instanceof Error) return value.stack || value.message;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getLogs() {
  return logs.slice();
}

module.exports = { addLog, getLogs };
