# Game Loop & State Machine Testing Guide

## Overview

This guide covers testing the newly implemented game timing system including:
- State machine transitions (WAITING → PLAYING → BREAK → FINISHED)
- 15-minute play rounds and 5-minute breaks
- Real-time countdown timers
- In-game date/time display (60x speed)
- State persistence across reconnects

## Prerequisites

1. Run database migrations:
   ```bash
   cd backend
   npm run migrate
   ```

2. Verify new columns exist:
   ```bash
   psql -d future_headlines -c "\d game_sessions"
   ```
   Should show: `phase`, `current_round`, `play_minutes`, `break_minutes`, `max_rounds`, `phase_started_at`, `phase_ends_at`, `in_game_start_at`, `timeline_speed_ratio`

3. Start backend and frontend:
   ```bash
   # Terminal 1
   cd backend && npm run dev
   
   # Terminal 2
   cd frontend && npm run dev
   ```

## Test Suite

### Test 1: Basic State Transitions

**Goal:** Verify phase transitions work correctly with default timings.

**Steps:**
1. Open browser at http://localhost:5173
2. Create a session as Host (Alice)
3. Open another browser window, join as Player (Bob)
4. **Verify:** Both see "Waiting to Start" phase badge
5. As Host, click "Start Game"
6. **Verify:**
   - Phase changes to "Playing"
   - Round shows "Round 1 of 4"
   - Countdown timer appears showing 15:00 and counts down
   - In-game date appears (future date, updating every second)
7. **Check database:**
   ```bash
   psql -d future_headlines -c "SELECT phase, current_round, phase_started_at, phase_ends_at FROM game_sessions;"
   ```
   Should show `phase = 'PLAYING'`, `current_round = 1`, timestamps set

8. **Check state transitions table:**
   ```bash
   psql -d future_headlines -c "SELECT * FROM game_session_state_transitions ORDER BY occurred_at;"
   ```
   Should show one row: `WAITING → PLAYING, round_no = 1`

**Expected Results:**
- ✅ Phase badge updates from gray "Waiting" to green "Playing"
- ✅ Timer counts down from 15:00
- ✅ Round progress bar appears
- ✅ In-game time progresses (much faster than real time)
- ✅ All players see same state simultaneously

### Test 2: Shortened Timings (for faster testing)

**Goal:** Test full game cycle without waiting 15 minutes per round.

**Steps:**
1. Stop the backend
2. Update default timings in migration (or directly in DB):
   ```bash
   psql -d future_headlines -c "UPDATE game_sessions SET play_minutes = 0.5, break_minutes = 0.25 WHERE join_code = 'XXXXX';"
   ```
   (This sets 30 second play, 15 second break)

3. Restart backend, create NEW session
4. Start the game
5. **Wait ~30 seconds** and observe automatic transition
6. **Verify:**
   - Phase automatically changes to "BREAK" after 30s
   - Timer resets and counts down from 00:15
   - Round stays at "Round 1 of 4"
   - Database shows new transition: `PLAYING → BREAK`

7. **Wait ~15 more seconds**
8. **Verify:**
   - Phase changes to "PLAYING" again
   - Round increments to "Round 2 of 4"
   - Timer resets to 00:30
   - Progress bar updates

9. **Continue observing** through all 4 rounds
10. **Final transition after Round 4 break:**
    - Phase changes to "FINISHED"
    - No more timer
    - "Game Finished" badge appears

**Expected Results:**
- ✅ Transitions happen automatically (no manual intervention)
- ✅ Timers reset correctly for each phase
- ✅ Round counter increments after breaks
- ✅ Game finishes after 4 rounds
- ✅ Backend logs show scheduled transitions

### Test 3: Reconnection During Active Game

**Goal:** Verify players can rejoin and see correct state/timer.

**Steps:**
1. Start a game with shortened timings (30s play / 15s break)
2. During Round 1 PLAYING phase (e.g., 20 seconds in), refresh browser
3. **Verify:**
   - Player automatically rejoins lobby
   - Sees current phase (PLAYING)
   - Sees current round (Round 1 of 4)
   - **Timer shows ~10 seconds remaining** (not reset to 30s)
   - In-game time continues from where it was

4. Check browser console for:
   ```
   Socket connected: ...
   Game state updated: { phase: 'PLAYING', ... }
   ```

5. Let phase transition to BREAK while watching
6. **Verify:** Timer updates correctly after transition

**Expected Results:**
- ✅ Reconnect is seamless
- ✅ Timer syncs with server (doesn't restart from beginning)
- ✅ `serverNow` and `phaseEndsAt` used to compute remaining time accurately
- ✅ In-game time picks up from correct point

### Test 4: Multiple Players Synchronized

**Goal:** All players see same timer countdown.

**Steps:**
1. Open 3 browser windows (Host + 2 Players)
2. Join all to same session
3. Host starts game
4. **Observe all 3 windows side-by-side**
5. **Verify:**
   - All show same phase
   - Timers count down in sync (±1 second tolerance due to render intervals)
   - All see same in-game date/time
   - When phase transitions, all update simultaneously

**Expected Results:**
- ✅ No player sees different phase than others
- ✅ Timers are synchronized across clients
- ✅ Phase transitions broadcast to all instantly

### Test 5: Late Join Behavior

**Goal:** Player joining mid-game sees current state.

**Steps:**
1. Start a game, get to Round 2 PLAYING
2. Have a new player (Charlie) try to join using the code
3. **Expected:** Join is rejected because `phase !== 'WAITING'`
4. **Check API response:**
   ```bash
   curl -X POST http://localhost:3001/api/sessions/XXXXX/join \
     -H "Content-Type: application/json" \
     -d '{"nickname":"Charlie"}'
   ```
   Should return 400 with error message

**Alternative:** If you want to allow late joins (future feature):
- Modify `POST /api/sessions/:joinCode/join` to allow joins in PLAYING/BREAK
- Then test that late joiner sees current round/timer immediately

**Expected Results:**
- ✅ Late joins are prevented (MVP choice)
- ✅ Clear error message to user
- ✅ No server crash

### Test 6: Server Restart Kills Active Games

**Goal:** Confirm expected behavior when backend restarts.

**Steps:**
1. Start a game, get into Round 1 PLAYING
2. Kill backend (Ctrl+C)
3. **Observe frontend:**
   - Socket disconnects
   - Players see "Disconnected" indicator (if implemented)
4. Restart backend
5. Refresh frontend
6. **Verify:**
   - Session still exists in database
   - Phase/round are frozen at last persisted state
   - No timers running
   - GameLoopManager has no active loops (expected per design)

**Expected Results:**
- ✅ Session data persists (DB is fine)
- ✅ Timers do NOT resume (expected: server restart kills timers)
- ✅ Players cannot continue game (must create new session)

### Test 7: In-Game Time Accuracy

**Goal:** Verify in-game time progresses at 60x real time.

**Steps:**
1. Start game with default timings
2. Note starting in-game time (e.g., "January 1, 2025, 00:00")
3. Wait 10 real seconds
4. **Calculate:** 10 seconds × 60 = 600 seconds = 10 minutes in-game
5. **Verify:** In-game time shows ~10 minutes later

**Expected Results:**
- ✅ In-game clock advances 60 seconds for every 1 real second
- ✅ `timeline_speed_ratio = 60.0` is applied correctly

### Test 8: Database State Transitions Log

**Goal:** Confirm all transitions are logged.

**Steps:**
1. Complete a full game (4 rounds)
2. Query transitions:
   ```bash
   psql -d future_headlines -c "
   SELECT from_phase, to_phase, round_no, occurred_at 
   FROM game_session_state_transitions 
   WHERE session_id = 'SESSION_UUID'
   ORDER BY occurred_at;
   "
   ```

**Expected Results:**
```
 from_phase | to_phase  | round_no |       occurred_at
------------+-----------+----------+------------------------
 WAITING    | PLAYING   |        1 | 2025-01-15 10:00:00
 PLAYING    | BREAK     |        1 | 2025-01-15 10:15:00
 BREAK      | PLAYING   |        2 | 2025-01-15 10:20:00
 PLAYING    | BREAK     |        2 | 2025-01-15 10:35:00
 BREAK      | PLAYING   |        3 | 2025-01-15 10:40:00
 PLAYING    | BREAK     |        3 | 2025-01-15 10:55:00
 BREAK      | PLAYING   |        4 | 2025-01-15 11:00:00
 PLAYING    | BREAK     |        4 | 2025-01-15 11:15:00
 BREAK      | FINISHED  |        4 | 2025-01-15 11:20:00
```

- ✅ 9 transitions for 4-round game
- ✅ Timestamps are sequential
- ✅ Round numbers increment correctly

### Test 9: Host Controls

**Goal:** Verify host-only actions.

**Steps:**
1. Create session as Host (Alice)
2. Join as Player (Bob) in separate window
3. As Bob, try to start game (inspect element, call Socket.IO directly if needed)
4. **Expected:** Server rejects with "Only the host can start the game"
5. As Alice, start game → succeeds

**Expected Results:**
- ✅ Non-host cannot start game
- ✅ Host can start game
- ✅ Authorization checked on server side

### Test 10: UI Polish Check

**Goal:** Ensure UI is readable and functional.

**Checklist:**
- ✅ Phase badge colors are distinct (WAITING=gray, PLAYING=green, BREAK=blue, FINISHED=purple)
- ✅ Timer font is large and readable
- ✅ Round progress bar animates smoothly
- ✅ In-game date format is clear
- ✅ Join code is still visible when WAITING
- ✅ Join code hidden during game
- ✅ Start Game button only appears in WAITING phase

## Common Issues & Debugging

### Issue: Timer doesn't count down

**Check:**
- Is `phaseEndsAt` being sent from server?
- Open browser console → check `sessionState` object
- Is `usePhaseTimer` hook mounting?

**Fix:** Verify `game:state` event is being emitted and received

### Issue: Phase doesn't auto-transition

**Check:**
- Backend logs: Are timers being scheduled?
- Look for: `[GameLoop ABC123] Scheduled transition to BREAK in 900s`
- Check database: Is `phase_ends_at` set correctly?

**Fix:** Ensure GameLoopManager is initialized with Socket.IO instance

### Issue: In-game time not updating

**Check:**
- Is `in_game_start_at` set in database?
- Is `timeline_speed_ratio` non-zero?
- Check calculation in `getSessionState` function

**Fix:** Verify phase has transitioned to PLAYING at least once

### Issue: Players see different timers

**Possible causes:**
- Clock drift on client machines
- Network latency
- Browser background tab throttling

**Expected:** Up to 1-2 second variance is normal; server is authoritative

## Performance Notes

- Each game loop uses one `setTimeout` per phase
- Active sessions: ~1 timer per session (minimal memory overhead)
- Database writes: 1 write per phase transition (~9 per game)
- Socket.IO broadcasts: 1 per phase transition

## Next Steps After Testing

Once all tests pass:

1. **Update README** with new features
2. **Add screenshots** of game status display
3. **Document timing configuration** (where to change defaults)
4. **Consider adding:**
   - Pause/resume feature (host control)
   - Manual phase skip (dev/testing tool)
   - Admin endpoint to cleanup stale sessions
   - Visual/audio alerts for phase changes

## Summary

All game loop features are now implemented and ready for testing:
- ✅ Server-side state machine
- ✅ Timed rounds with automatic transitions
- ✅ Real-time countdown display
- ✅ In-game time at 60x speed
- ✅ State persistence in database
- ✅ Reconnect support
- ✅ Phase synchronization across all players

Happy testing! 🎮

