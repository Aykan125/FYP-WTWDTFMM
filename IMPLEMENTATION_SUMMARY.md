# Game Loop & State Machine - Implementation Summary

## ✅ All Features Implemented

### Backend Implementation

**1. Database Schema** (`002_game_timing.sql`)
- Extended `game_sessions` table with:
  - `play_minutes`, `break_minutes`, `max_rounds` (configurable timings)
  - `current_round` (tracks progress)
  - `phase` (WAITING, PLAYING, BREAK, FINISHED)
  - `phase_started_at`, `phase_ends_at` (timing anchors)
  - `in_game_start_at` (for accelerated time calculation)
  - `timeline_speed_ratio` (default 60x speed)
- Created `game_session_state_transitions` table for audit log
- Proper indexes and triggers

**2. Game Loop Manager** (`backend/src/game/gameLoop.ts`)
- Singleton manager for all active game sessions
- Per-session `GameLoopInstance` with in-memory timers
- Automatic phase transitions using `setTimeout`
- Phase computation logic: `WAITING → PLAYING → BREAK → PLAYING → ... → FINISHED`
- Database persistence on every transition
- Socket.IO broadcasting to all players
- Graceful cleanup on server shutdown

**3. Type Definitions** (`backend/src/game/types.ts`)
- `GamePhase` union type
- `GameSessionConfig`, `GameSessionRuntimeState` interfaces
- `GameStateSnapshot` for client communication

**4. Socket.IO Integration**
- Extended `getSessionState()` to include phase/timing/in-game time
- Modified `lobby:start_game` handler to use GameLoopManager
- New `game:state` event for comprehensive state updates
- In-game time calculation (60x real time)

**5. Server Setup** (`backend/src/server.ts`)
- Initialize GameLoopManager with Socket.IO instance
- Cleanup all loops on graceful shutdown

### Frontend Implementation

**1. Updated Hooks**
- Extended `SessionState` interface in `useSocket.ts` with phase/timing fields
- Added listener for `game:state` events
- Created `usePhaseTimer.ts` hook for countdown display

**2. New Components**
- `GameStatus.tsx` - Displays phase badge, round progress, timer, in-game date

**3. Updated Components**
- `HostLobby.tsx` - Shows GameStatus during game, hides join code, conditional buttons
- `JoinLobby.tsx` - Shows GameStatus during game
- `App.tsx` - Passes all new props to lobby components

### Key Features

✅ **State Machine**: WAITING → PLAYING → BREAK → FINISHED  
✅ **Configurable Timings**: 15-min play, 5-min break, 4 rounds (stored per session in DB)  
✅ **Automatic Transitions**: Server-side timers trigger phase changes  
✅ **Real-Time Countdown**: Clients display synchronized countdown timer  
✅ **In-Game Time**: Progresses 60x faster than real time  
✅ **State Persistence**: Every transition logged to database  
✅ **Broadcasting**: All players notified instantly of phase changes  
✅ **Reconnection**: Players rejoin and see correct phase/timer state  
✅ **Host Controls**: Only host can start game, checked server-side  
✅ **Late Join Prevention**: Joins blocked if phase ≠ WAITING  

## Priority Planet Display (Sprint 9)

### What Was Implemented

Each player now sees their current "priority planet" displayed during gameplay. This is the planet that gives them a +3 bonus if the AI classifies their headline as relating to that planet.

**Backend Changes:**
- `backend/src/game/gameLoop.ts` - `broadcastGameState()` now includes `planet_usage_state` in SQL query and extracts `currentPriority` for each player
- `backend/src/socket/lobbyHandlers.ts` - `getSessionState()` includes priority planet, `lobby:start_game` initializes planet state with random priority for all players

**Frontend Changes:**
- `frontend/src/hooks/useSocket.ts` - `Player` interface includes `totalScore` and `priorityPlanet` fields
- `frontend/src/components/PriorityPlanet.tsx` - New component displaying priority planet with purple styling
- `frontend/src/components/GameStatus.tsx` - Shows priority planet during PLAYING/BREAK phases
- `frontend/src/components/HostLobby.tsx` & `JoinLobby.tsx` - Pass `priorityPlanet` to GameStatus

**Test Updates:**
- `backend/tests/socket/lobbyHandlers.test.ts` - Updated mock data to include new fields

## Score Display (Sprint 10)

### What Was Implemented

Player scores are now displayed on the frontend in two locations:
1. **PersonalScore component** - Shows the current player's total score in the top-right area next to GameStatus during PLAYING/BREAK phases
2. **PlayerList component** - Shows score for each player (e.g., "42 pts") next to their name

**Frontend Changes:**
- `frontend/src/hooks/useSocket.ts` - Added `leaderboard:update` event listener for real-time score updates
- `frontend/src/components/PersonalScore.tsx` - New component displaying "Your Score" with large score number
- `frontend/src/components/PlayerList.tsx` - Added `totalScore` to Player interface, displays score badge next to each player name
- `frontend/src/components/HostLobby.tsx` - Added PersonalScore component next to GameStatus
- `frontend/src/components/JoinLobby.tsx` - Added PersonalScore component next to GameStatus

**Score Update Flow:**
- Initial scores come from `game:state` on join/reconnect
- Real-time updates via `leaderboard:update` event after each headline is scored
- Both channels update the same `sessionState.players` array

---

## Files Created/Modified

### New Files (10)
1. `backend/db/migrations/002_game_timing.sql`
2. `backend/src/game/types.ts`
3. `backend/src/game/gameLoop.ts`
4. `frontend/src/hooks/usePhaseTimer.ts`
5. `frontend/src/components/GameStatus.tsx`
6. `frontend/src/components/PriorityPlanet.tsx`
7. `frontend/src/components/PersonalScore.tsx`
8. `GAME_LOOP_TESTING.md`
9. `IMPLEMENTATION_SUMMARY.md` (this file)

### Modified Files (8)
1. `backend/src/socket/lobbyHandlers.ts` - Extended SessionState, integrated GameLoopManager, priority planet init
2. `backend/src/server.ts` - Initialize GameLoopManager
3. `frontend/src/hooks/useSocket.ts` - Extended SessionState, listen for game:state/leaderboard:update, priorityPlanet/totalScore fields
4. `frontend/src/components/HostLobby.tsx` - Show GameStatus with priority planet, PersonalScore component
5. `frontend/src/components/JoinLobby.tsx` - Show GameStatus with priority planet, PersonalScore component
6. `frontend/src/components/PlayerList.tsx` - Display totalScore next to each player name
7. `frontend/src/App.tsx` - Pass phase/timing props
8. `backend/tests/socket/lobbyHandlers.test.ts` - Updated mock player data

## How to Use

### 1. Run Migration
```bash
cd backend
npm run migrate
```

Expected output:
```
⚙️  Running 002_game_timing.sql...
✅ Applied 002_game_timing.sql
✅ All migrations completed successfully!
```

### 2. Start Servers
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm run dev
```

### 3. Test the Game Loop
- Create session as host
- Join with 1+ other players
- Click "Start Game"
- Watch phase transitions, timer countdown, in-game time
- Full testing guide in `GAME_LOOP_TESTING.md`

## Architecture Decisions

### Why Store Timings in Database?
Per-session configurability. Each game can have different settings (15/5 vs 10/3 rounds). The DB is the authoritative source - consistent across reconnects and future features (e.g., host UI to configure before start).

### Why In-Memory Timers (Not Redis)?
Single-node deployment assumption. Simple `setTimeout` is reliable and efficient. If scaling to multiple backend instances is needed later, timers can be moved to Redis Pub/Sub or a dedicated scheduler service.

### Why Not Resume Timers on Server Restart?
Per requirements: "restarts can kill the session." This simplifies the MVP. To add restart recovery later:
1. On startup, query all sessions with `phase IN ('PLAYING', 'BREAK')`
2. Compare `phase_ends_at` with `CURRENT_TIMESTAMP`
3. If elapsed, auto-transition; else reschedule timer

### Why Separate `game:state` Event?
Decouples game timing from lobby mechanics. Future headline submission, scoring, etc. can also emit `game:state` updates without conflating concerns. Keeps Socket.IO event semantics clean.

## Completed Since This Document

All the sprints originally listed as "future" are now complete:

1. **Sprint 4**: ✅ Headline submission during PLAYING phase
2. **Sprint 5**: ✅ Scoring system integrated with phases
3. **Sprint 6**: ✅ Dice mechanics on submission
4. **Sprint 7**: ✅ LLM Juror evaluation during PLAYING
5. **Sprint 8**: ✅ Scoring refactors (plausibility, connections, planet tally system)
6. **Sprint 9**: ✅ Priority planet display on frontend
7. **Sprint 10**: ✅ Score display (PersonalScore component, PlayerList scores, leaderboard:update listener)

## Current Status (as of 2025-01-27)

- **213 tests passing** (up from original implementation)
- **Automatic phase transitions**: Working (PLAYING → BREAK → next round → FINISHED)
- **Scoring system**: Complete with AI-based plausibility, mutually exclusive connections, frequency-based planet tally
- **Priority planet display**: Complete - each player sees their current priority planet in GameStatus during gameplay
- **Score display**: Complete - PersonalScore shows current player's score, PlayerList shows all player scores with real-time updates via `leaderboard:update`
- **Next up**: Break summaries, deployment

## Performance Notes

- **Memory**: ~1 timer per active session (negligible overhead)
- **Database Writes**: 1 per transition (~9 writes per game)
- **Network**: 1 broadcast per transition (efficient with Socket.IO rooms)
- **Client CPU**: Timer hook updates every 100ms (smooth countdown)

## Known Limitations (By Design)

- ⚠️ Server restart kills active games (timers not persisted)
- ⚠️ Late joins blocked (must join in WAITING phase)
- ⚠️ No pause/resume feature
- ⚠️ Timings configured per-session but not editable by host UI (hardcoded defaults on session creation)

These can be addressed in future iterations if needed.

## Testing Status

All implementation is complete. Comprehensive testing guide provided in `GAME_LOOP_TESTING.md`. Ready for manual QA and user acceptance testing.

---

**Implementation completed successfully! 🎉**

All planned features from Sprint 3 (Real-Time Game Loop Core) are now functional.

