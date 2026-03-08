# Per-round variable in-game time speed (ratio 3:5:7)

## What changed

**File:** `backend/src/game/gameLoop.ts`

- Removed the single `timelineSpeedRatio` computed once at game start (uniform across all rounds).
- Added module-level constants `ROUND_SPEED_WEIGHTS = [3, 5, 7]` and `TOTAL_INGAME_MS`.
- On each transition to `PLAYING`, the speed ratio is now computed from the round's proportional weight: Round 1 gets 3/15 of 20 years, Round 2 gets 5/15, Round 3 gets 7/15.
- On transition to `BREAK`, `timelineSpeedRatio` is set to `0` so no in-game time elapses during breaks (accumulation uses the outgoing phase's ratio, which is already correct before this assignment).

## Trade-offs considered

1. **Single ratio (old behaviour):** Simple, but all rounds advance at the same speed — no narrative acceleration toward the far future.
2. **Per-round ratio stored only in memory:** Could be lost on server restart. Rejected because the ratio is re-derived deterministically from `roundNo` and config on every transition, so it survives restarts via DB reload.
3. **Store per-round ratios in DB as an array:** More flexible for arbitrary configs, but over-engineered for a fixed 3-round game with a well-known weight array.

## Justified rationale

Option 2 was chosen. Computing the ratio fresh on each phase transition means no new DB columns, no migration, and no schema change — the existing `timeline_speed_ratio` column continues to hold the current phase's ratio as before. This is the minimum-change solution that achieves the desired narrative effect.

---

# Rewrite juror prompt in jurorPrompt.ts

## What changed

`backend/src/llm/jurorPrompt.ts` — `buildJurorPrompt` and `buildJurorInstructions` rewritten. The TypeScript types and JSON schema are unchanged.

The new prompt:
- Explicitly names the five plausibility levels as P1–P5 with definitions for each
- Splits tasks into four clearly labelled sections (plausibility, planet classification, link headlines, headline generation)
- Adds detailed guidance on what factors to consider when classifying plausibility (date, adoption pace, claim type, existing timeline)
- Adds per-headline generation rules (no simple paraphrases, progressively more surprising P1→P5, no explanatory text inside headline strings)
- Updates system instructions to reflect the richer task description

## Trade-offs considered

- **Keep the old terse prompt**: Shorter token count, but lacks explicit guidance on date-sensitive plausibility reasoning and headline variation rules, leading to lower-quality outputs.
- **Rewrite with richer instructions (chosen)**: Slightly more tokens per call, but the additional task scaffolding produces more consistent plausibility classifications and more varied headline bands.

## Justified rationale

The old prompt gave no guidance on how to vary the five headline bands or how to weight the date when assessing plausibility. The new prompt codifies the game's intent directly, which should improve output consistency without changing any parsing logic.

---

# Expand backend logging for headline submission and scoring

## What changed

`backend/src/socket/lobbyHandlers.ts` — two `console.log` statements expanded.

1. **Headline submission log**: now prints the dice roll, selected band, plausibility band and label, all 5 AI-generated band variants (`band1`–`band5`), and the selected headline.
2. **Scoring log**: now prints a per-component breakdown — `baseline`, `plausibility` (with band number), `connectionScore` (with connection type), and `planetBonus` — before the total delta and running total.

## Trade-offs considered

- **Structured logging (JSON objects)**: easier to parse programmatically, but harder to skim in a terminal during manual testing; overkill for a dev-time debugging tool.
- **Minimal change (current approach)**: human-readable multi-line format, no new dependencies, all data already in scope — best fit for dev workflow and requires zero refactoring.

## Justified rationale

The game is in active development and the logs are primarily used by the developer to verify AI output quality and scoring correctness during test sessions. A concise, readable multi-line format gives instant visual feedback without adding infrastructure. All required fields (`allBands`, `plausibility`, `breakdown.*`, `connectionType`) were already in scope at both log sites.

---

# P1 Socket Reconnect Fixes

## Problem 1 — Transport reconnect silently breaks the session

### What goes wrong

Socket.IO reconnects the underlying transport automatically, but the server's in-memory state is tied to the socket instance, not the player identity. After a drop, the server allocates a fresh socket with a new ID; the old socket's room membership (`session:${joinCode}`) and its `socket.data.playerId` are gone. The client's `connect` event fires, `setConnected(true)` flips the UI green, and the player appears online — but the server no longer associates them with a room. From that point, all room broadcasts (`game:state`, `headline:new`, `leaderboard:update`) are silently dropped on the server before they reach the client, and any `headline:submit` emits fail because the socket carries no player identity.

The root cause is a single line in the old `connect` handler:

```ts
socket.on('connect', () => {
  setConnected(true);  // ← nothing else
});
```

---

### Options considered

#### Option A — Persist room membership server-side (e.g. Redis adapter)

Store room membership and `socket.data` in Redis so any socket instance can look them up by player ID on reconnect. Socket.IO's Redis adapter does this out of the box for multi-node deployments.

**Trade-offs:**
- Eliminates the problem at the infrastructure level; works across server restarts and horizontal scaling.
- Requires a Redis dependency, changes to the deployment setup, and a non-trivial migration of the socket server initialisation.
- The game currently runs on a single Heroku/Render dyno with no Redis. Adding it is over-engineering for the current scale.

#### Option B — Explicit `socket.io` `sessionID` persistence (Socket.IO v4 connection state recovery)

Socket.IO v4.6+ has a `connectionStateRecovery` option that buffers missed events on the server and replays them after reconnect, transparently restoring the socket to its previous room.

**Trade-offs:**
- Requires Socket.IO ≥ 4.6 on both client and server, and opting into `connectionStateRecovery` in server config.
- Buffers events in memory with a configurable TTL; still loses state on server restart.
- The version currently in use is not confirmed to support this, and enabling it changes server-wide reconnect semantics, affecting all clients.

#### Option C — Re-emit `lobby:join` on every `connect` event (chosen)

Store the last successful join credentials in a `rejoinRef` (`useRef`) inside `useSocket`. On every `connect` event, if the ref is populated, immediately re-emit `lobby:join` with the stored `joinCode` and `playerId`. The backend `lobby:join` handler already accepts existing players in any phase and re-adds them to the Socket.IO room, restoring `socket.data.playerId`. After re-joining, re-fetch the headline feed to recover any events missed during the outage.

**Trade-offs:**
- Pure client-side change; no new infrastructure, no schema changes.
- Re-emitting `lobby:join` is idempotent — the handler is written to handle existing players without creating duplicates.
- Adds one round-trip on reconnect (the `lobby:join` ack), which is imperceptible at human timescales.
- Does not replay events that fired while the socket was down (e.g. a `leaderboard:update` mid-drop). The headline re-fetch recovers the feed; scores are recovered via the `game:state` included in the `lobby:join` response. Any events that land in the gap before the re-join completes could still be missed, but this is an acceptable edge case given the game's tolerance for eventual consistency.

**Justification:** Option C is the minimal, reversible fix that directly addresses the root cause without introducing new dependencies or changing server-wide behaviour. The backend `lobby:join` handler was already designed to be re-entrant, so the fix is low risk and easy to reason about.

---

## Problem 2 — Cross-device / cross-browser recovery is impossible mid-game

### What goes wrong

`POST /api/sessions/:joinCode/join` creates a new player and hard-blocks once `status !== 'WAITING'`:

```ts
if (session.status !== 'WAITING') {
  res.status(400).json({ error: 'Cannot join session', ... });
  return;
}
```

A player who opens a fresh browser tab, switches device, or loses `localStorage` (e.g. private browsing ends, browser data cleared) has no path back to their identity. The only public re-entry point — the invite link — goes through the join endpoint and hits this wall. The result is a ghost player in the scoreboard and a confused user who can watch but not participate.

---

### Options considered

#### Option A — Store session credentials server-side (HTTP session / JWT)

Issue a signed JWT or server-side session cookie on first join, containing `{ joinCode, playerId }`. On any subsequent join attempt for the same session, verify the token and return the existing player.

**Trade-offs:**
- Solves the problem for page refreshes and tab restores without requiring the player to remember their nickname.
- Adds auth infrastructure (JWT signing key, cookie handling, CORS implications). Increases attack surface: a stolen token lets anyone impersonate the player.
- Overkill for a low-stakes party game where the "identity" is just a nickname chosen seconds ago.

#### Option B — Allow re-joining in-progress sessions by nickname (chosen)

Add `POST /api/sessions/:joinCode/rejoin` that looks up an existing player by nickname (case-insensitive) and returns their `playerId`. No new player is created. On the frontend, when the normal join endpoint returns `400 / "Cannot join session"`, automatically fall back to the rejoin endpoint.

**Trade-offs:**
- No new auth concepts; the nickname acts as a low-friction shared secret (you know your own nickname).
- Case-insensitive matching reduces friction from accidental capitalisation differences.
- Security model is weak by design: anyone who knows a nickname can reclaim that player's session. For a party game where all players are in the same room/call, this is acceptable and matches user expectations.
- If two players chose identical nicknames before the game started (the join endpoint prevents this, so it cannot happen), the query would return the first match. The uniqueness constraint at join time makes this a non-issue.
- The frontend fallback is transparent: the nickname field and submit button are identical for both flows; errors ("nickname not found") surface naturally through the existing error display.

**Justification:** Option B is the minimal recoverable path that matches the threat model of a casual multiplayer game. It does not introduce auth infrastructure, respects the existing data model, and the "nickname as credential" assumption is consistent with the rest of the game's identity model (nicknames are already the only user-facing identifier throughout the UI). The fallback is invisible to players who join normally — it only activates when the primary join is blocked.

---

## Files changed

| File | Change |
|---|---|
| `frontend/src/hooks/useSocket.ts` | Added `rejoinRef`; `connect` handler re-emits `lobby:join` and re-fetches headlines if credentials are stored; `joinLobby` sets the ref on success; `leaveLobby` clears it |
| `backend/src/routes/sessions.ts` | Added `POST /api/sessions/:joinCode/rejoin` route |
| `frontend/src/App.tsx` | `handleJoinSession` falls back to the rejoin endpoint when the join is blocked due to an in-progress session |

---

## Scoring rebalance

### Problem

The baseline score of 10 dominated every headline's total. A player who submits anything at all — regardless of quality, story connections, or planet luck — received the majority of available points per round. Skill-dependent components (plausibility, connection, planet bonus) were crowded out, reducing the incentive to engage with them.

### Score table

| Component | Old | New |
|---|---|---|
| Baseline | 10 | **5** |
| Planet bonus (match) | 3 | 3 |
| Connection — Others | 3 | 3 |
| Connection — Self | 1 | 1 |
| Plausibility exact (level 3) | 2 | 2 |
| Plausibility near (level 2/4) | 1 | 1 |
| Plausibility other (level 1/5) | 0 | 0 |

Only `baselineB` changed (`backend/src/game/scoringTypes.ts`).

### Effect on balance

| Scenario | Old | New |
|---|---|---|
| Minimum (just submitted) | 10 pts | 5 pts |
| Maximum (others + planet + plausibility exact) | 18 pts | 13 pts |
| Skill components as % of max | 44% | 62% |

Halving the baseline compresses the floor without touching the ceiling shape. Players who actively connect to others' headlines, hit the plausibility sweet spot, and maintain a planet priority earn a proportionally larger reward relative to passive submitters. The scoring spread between an engaged and a disengaged player roughly doubles.

---

## In-game date display: tick interval and format

### What changed

- `frontend/src/hooks/useInGameNow.ts` — tick interval reduced from 1s to 5s.
- `frontend/src/components/InGameDate.tsx` — date format changed from `"Mar 15, 2031"` (short month + day + year) to `"March 2031"` (long month + year only).

### Trade-offs considered

**Tick interval:**
- **1s** — matches the real-time feel but causes unnecessary re-renders every second for a display that only changes meaningfully over minutes. Adds minor CPU cost on low-end devices.
- **5s** (chosen) — still feels live without wasteful renders. A 5s lag in the displayed date is imperceptible given in-game time spans years per minute.
- **60s** (original) — too infrequent; the date appeared frozen.

**Date format:**
- **Full date (day + month + year)** — more precise but the day figure is noisy when in-game time jumps days per second; it changes too fast to be readable.
- **Month + year only** (chosen) — appropriate granularity for a game spanning decades. Stable enough to read comfortably; still communicates how far into the future the timeline has reached.
- **Year only** — too coarse; loses the sense of month-by-month progression during a round.

### Justification

The game's timeline spans roughly 20 years across a session of ~55 minutes. At that speed, days are meaningless — players care about the year and approximate era. Month + year gives the right level of resolution. A 5s tick is a good balance between responsiveness and efficiency.
