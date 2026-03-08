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
