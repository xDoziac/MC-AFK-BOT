# AFK Aternos Bot (v3 — rewrite)

A Minecraft AFK bot (built on [mineflayer](https://github.com/PrismarineJS/mineflayer)) that keeps
an Aternos (or any) server alive, with a small status dashboard and auto-reconnect.

This is a ground-up, modular rewrite of the original single-file bot, aimed at fixing the
recurring bugs and making the code easy to actually maintain.

> ⚠️ Running a bot to keep a free Aternos server online 24/7 violates Aternos's Terms of Service
> and can get the server suspended. Use at your own risk, ideally on a server you control the
> hosting for.

## Quick start

```bash
npm install
npm test      # syntax-checks every file
npm start
```

Edit `settings.json` first — at minimum set `bot-account.username` and `server.ip`/`server.port`.
The dashboard runs on `http://localhost:3000` by default (or `$PORT` if set, e.g. on Render).

## What changed from the original

The original `index.js` was a single ~2,000-line file with a lot of global mutable state and
patches layered on patches. It mostly worked, but had a few real, reproducible bugs:

1. **The "Stop" button didn't actually stop the bot.** `/stop` called `bot.end()`, which fired the
   `end` event, which *unconditionally* scheduled a reconnect — so a couple seconds after clicking
   Stop, the bot reconnected anyway. Fixed with an explicit `manuallyStopped` flag that the `end`
   handler checks before scheduling a reconnect.
2. **Pathfinder fought with the anti-afk movement.** `mineflayer-pathfinder` resets control state
   every physics tick to follow its own goal, which conflicted with the raw `setControlState` calls
   used for anti-afk sneaking/circling — this produced the jittery, "stuck" movement. This rewrite
   drops the pathfinder dependency entirely and does all movement (circle-walk, look-around,
   random-jump, avoid-mobs) with direct, predictable control-state calls.
3. **Chat could trigger arbitrary server commands.** The old chat responder ran `/tp <whatever
   any player typed>` — if the bot ever had OP, any player in chat could get it to run commands.
   Removed; the new chat responder only sends fixed, safe replies.
4. **Config access crashed if a key was missing from `settings.json`.** e.g. `config.combat` being
   undefined threw deep inside a random module. `src/config.js` now deep-merges your settings over
   full defaults, so a partial/older `settings.json` still works, and validates the handful of
   required fields (`server.ip`, `server.port`, `bot-account.username`) up front with a clear error
   instead of a cryptic crash minutes later.
5. **Timers/listeners could leak across reconnects.** Every module now registers its intervals
   through a single tracked list (`src/state.js`) that gets cleared before every new connection
   attempt, so repeated disconnects don't pile up duplicate timers (which was the cause of
   "messages get sent twice" / "bot slows down over time" style bugs).
6. **One broken module could take the whole bot down.** Module setup is now wrapped per-module in
   try/catch (`botManager.js` → `initModules`), so if, say, the beds module throws, combat/chat/
   movement keep working instead of the whole spawn handler crashing silently.
7. **`kicked` and `end` both tried to schedule reconnects**, which could race. Now `kicked` only
   logs/flags throttling; `end` is the single source of truth for reconnect scheduling.

## Project layout

```
index.js                  entry point: loads config, starts dashboard + bot
src/
  config.js                loads settings.json, deep-merges with defaults, validates
  state.js                 shared runtime state + timer tracking
  logger.js                in-memory log ring buffer used by the dashboard
  botManager.js             connection lifecycle: connect, spawn, kick, reconnect backoff
  server.js                 Express dashboard + /health /logs /start /stop /command
  modules/
    autoAuth.js              /login /register handling
    movement.js               anti-afk sneak, circle-walk, look-around, random-jump
    combat.js                  attack nearby hostiles, auto-eat
    avoidMobs.js               back away from hostiles (used when combat is off)
    beds.js                    sleep through the night if enabled
    chatMessages.js            periodic "I'm a real player" cover messages
    chatResponder.js           logs chat, simple safe canned replies
    discord.js                  rate-limited webhook notifications
    console.js                  stdin commands (say / cmd / status)
```

## Config notes (`settings.json`)

- `server.version`: leave `""` to auto-detect (recommended — matches whatever the server runs).
- `utils.auto-auth`: for servers running AuthMe/LoginSecurity etc. Set `password` and it'll answer
  `/register`/`/login` prompts automatically.
- `movement`: all four sub-features (`circle-walk`, `look-around`, `random-jump`, plus
  `utils.anti-afk.sneak`) run independently and are safe to mix and match.
- `modules.avoid-mobs` is only active when `modules.combat`/`combat.attack-mobs` is off — if
  combat is on, the bot fights instead of fleeing.
- `discord.webhookUrl` must be a full `https://discord.com/api/webhooks/...` URL for webhook
  notifications to send.
- `dashboard.self-ping`: only useful on free hosts (like Render's free tier) that sleep after
  inactivity — point `url` at your own public dashboard URL.

## Known limitations

- No pathfinding to a fixed spawn coordinate (the old `position` block) — dropped along with the
  `mineflayer-pathfinder` dependency to remove the movement conflicts described above. If you need
  the bot to walk to a specific spot once on join, that can be added back as an isolated one-shot
  action (it's the ongoing anti-afk/pathfinder mixing that was the problem, not pathfinder itself).
- `beds.place-night` is best-effort: some servers restrict sleeping with monsters nearby or a
  non-vanilla day/night cycle, in which case you'll just see harmless "Could not sleep" log lines.
