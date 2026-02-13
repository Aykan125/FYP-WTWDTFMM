# Visual Leaderboard Bar Chart - Implementation Plan

## Overview

A stacked horizontal bar chart fixed to the bottom-left of the screen during PLAYING and BREAK phases. Each player gets a bar showing their score breakdown by component (color-coded). A "theoretical max" bar at the top anchors the scale based on elapsed play time.

---

## Visual Design

```
 ┌──────────────────────────────────────────────────────┐
 │  MAX ████████████████████████████████████████  (54)   │  ← time-based max (gray)
 │ Alice ██████████████████████████               (42)   │  ← stacked: B + A + C + P
 │   Bob ████████████████████                     (38)   │
 │ Carol ██████████████                           (28)   │
 │   Dan ████████                                 (20)   │
 └──────────────────────────────────────────────────────┘
```

### Bar Segments (left to right, stacked)

| Segment | Color | Source | Per Headline |
|---------|-------|--------|--------------|
| Baseline | `#6B7280` (gray-500) | Submitting a headline | 10 pts |
| Plausibility | `#3B82F6` (blue-500) | AI assessment grade | 0-2 pts |
| Connection | `#10B981` (emerald-500) | Links to other headlines | 0-3 pts |
| Planet Bonus | `#8B5CF6` (violet-500) | Priority planet match | 0-3 pts |

### Time-Based Maximum Bar

- Represents the theoretical maximum score a player _could_ have earned given elapsed play time
- Calculation: `maxHeadlines = floor(elapsedPlaySeconds / 60) + 1` (rate limit is 1 per 60s, first is immediate)
- Max score = `maxHeadlines * 18` (10 baseline + 2 plausibility + 3 connection + 3 planet)
- This bar is the full width reference; all player bars scale relative to it
- If no play time has elapsed yet (round just started), max = 18 (one headline possible)

### Scaling

All bars rendered as percentage of the time-based max:
```
barWidth = (playerTotal / timeBasedMax) * 100%
```

This ensures no bar ever exceeds the container width, and bars grow naturally as the game progresses.

---

## Data Requirements

### Problem: Frontend Currently Only Receives `totalScore`

The `leaderboard:update` event and `game:state` both only send `totalScore` per player. The visual needs a per-player breakdown of score components (baseline, plausibility, connection, planetBonus).

### Solution: Add Score Breakdown to Backend Broadcasts

#### Option A: Extend `leaderboard:update` payload (chosen)

Modify the `leaderboard:update` event to include score component totals per player. These are aggregated from the `game_session_headlines` table where the individual headline scores are already stored.

**New payload shape:**
```typescript
{
  leaderboard: [
    {
      playerId: string,
      totalScore: number,
      breakdown: {
        baseline: number,      // sum of baseline_score
        plausibility: number,  // sum of plausibility_score
        connection: number,    // sum of others_story_score (stores connection score)
        planetBonus: number,   // sum of planet_bonus_score
      }
    }
  ]
}
```

**SQL query to aggregate:**
```sql
SELECT
  sp.id AS player_id,
  sp.total_score,
  COALESCE(SUM(h.baseline_score), 0) AS baseline,
  COALESCE(SUM(h.plausibility_score), 0) AS plausibility,
  COALESCE(SUM(h.others_story_score), 0) AS connection,
  COALESCE(SUM(h.planet_bonus_score), 0) AS planet_bonus
FROM session_players sp
LEFT JOIN game_session_headlines h ON h.player_id = sp.id
WHERE sp.session_id = $1
GROUP BY sp.id, sp.total_score
```

#### Also extend `game:state` players array

Add the same breakdown fields to each player object in `game:state` so the visual has data on initial load / reconnect (not just after score updates).

---

## Implementation Steps

### Step 1: Backend - Add Score Breakdown to Broadcasts

**Files to modify:**
- `backend/src/socket/lobbyHandlers.ts` - modify `getSessionState()` query and `leaderboard:update` emission
- `backend/src/game/gameLoop.ts` - modify `broadcastGameState()` to include breakdown

**Changes:**
1. Write a helper function `getPlayerScoreBreakdowns(sessionId)` that runs the aggregation query above
2. In `getSessionState()`, call this helper and merge breakdown into each player object
3. In the `headline:submit` handler where `leaderboard:update` is emitted, include the breakdown
4. In `broadcastGameState()`, include breakdown in player objects

### Step 2: Frontend - Extend Types

**File to modify:** `frontend/src/hooks/useSocket.ts`

**Changes:**
1. Add `ScoreBreakdown` interface:
   ```typescript
   interface ScoreBreakdown {
     baseline: number;
     plausibility: number;
     connection: number;
     planetBonus: number;
   }
   ```
2. Add `scoreBreakdown?: ScoreBreakdown` to the `Player` interface
3. Update the `game:state` listener to map breakdown data
4. Update the `leaderboard:update` listener to store breakdown per player

### Step 3: Frontend - Calculate Time-Based Maximum

**New hook:** `frontend/src/hooks/useTheoreticalMax.ts`

**Inputs:** `phaseStartedAt`, `serverNow`, `phase`, `currentRound`, `playMinutes`

**Logic:**
- Track cumulative elapsed PLAYING time across all rounds
- During PLAYING phase: `elapsed = completedRoundsPlayTime + currentPhaseElapsed`
- During BREAK/FINISHED: `elapsed = completedRoundsPlayTime` (no new headlines during break)
- Completed rounds contribute: `(currentRound - 1) * playMinutes * 60` seconds of play time (if in PLAYING) or `currentRound * playMinutes * 60` (if in BREAK/FINISHED, since that round's play is done)
- Current phase play time: `Date.now() - phaseStartedAt` (only if phase is PLAYING)
- `maxHeadlines = floor(totalElapsedPlaySeconds / 60) + 1`
- `theoreticalMax = maxHeadlines * 18`
- Update every second via `setInterval`

**Edge cases:**
- Round 1 PLAYING just started: max = 18 (1 headline possible)
- Minimum max is always 18 (at least 1 headline is always possible once game starts)
- During BREAK: max stays frozen at end-of-round value

### Step 4: Frontend - Create `ScoreBarChart` Component

**New file:** `frontend/src/components/ScoreBarChart.tsx`

**Props:**
```typescript
interface ScoreBarChartProps {
  players: Player[];           // All players with scoreBreakdown
  currentPlayerId?: string;    // Highlight current player
  theoreticalMax: number;      // Time-based maximum score
  phase: string;               // Current game phase
}
```

**Rendering:**
1. **Container**: Fixed position bottom-left, semi-transparent dark background, rounded corners, padding. Approx 320px wide, height adapts to player count.
2. **Max bar (top)**: Full-width gray bar labeled "MAX" with score value. This is the 100% reference width.
3. **Player bars (sorted by total score descending)**: Each bar is a stacked horizontal bar:
   - Gray segment (baseline)
   - Blue segment (plausibility)
   - Green segment (connection)
   - Violet segment (planet bonus)
   - Width = `(playerTotal / theoreticalMax) * 100%` of the max bar
   - Player nickname label on the left
   - Total score value on the right
4. **Legend**: Small color key at bottom showing the 4 categories
5. **Current player highlight**: Slightly brighter background or border on current player's row
6. **Transitions**: CSS `transition: width 0.5s ease` on bar segments for smooth growth animation

**Visibility:**
- Only render during PLAYING and BREAK phases
- Hidden during WAITING and FINISHED

### Step 5: Frontend - Integrate Component

**Files to modify:**
- `frontend/src/components/HostLobby.tsx` - Add `<ScoreBarChart>` component
- `frontend/src/components/JoinLobby.tsx` - Add `<ScoreBarChart>` component

**Placement:**
- Position: `fixed`, `bottom-4`, `left-4`, `z-10`
- Both HostLobby and JoinLobby render it identically
- Pass `players`, `currentPlayerId`, `theoreticalMax`, `phase` as props

### Step 6: Update Tests

**Files to modify:**
- `backend/tests/socket/lobbyHandlers.test.ts` - Update mock data to include breakdown fields
- `backend/tests/game/scoringService.test.ts` - Verify breakdown query if extracted as helper

**New test file (optional):**
- `frontend/src/hooks/useTheoreticalMax.test.ts` - Unit test the max calculation logic

---

## File Summary

### New Files (2)
1. `frontend/src/components/ScoreBarChart.tsx` - The visual bar chart component
2. `frontend/src/hooks/useTheoreticalMax.ts` - Hook for time-based max calculation

### Modified Files (5)
1. `backend/src/socket/lobbyHandlers.ts` - Add breakdown to `getSessionState()` and `leaderboard:update`
2. `backend/src/game/gameLoop.ts` - Add breakdown to `broadcastGameState()`
3. `frontend/src/hooks/useSocket.ts` - Add `ScoreBreakdown` type, update `Player` interface and listeners
4. `frontend/src/components/HostLobby.tsx` - Render `<ScoreBarChart>`
5. `frontend/src/components/JoinLobby.tsx` - Render `<ScoreBarChart>`

### Test Files (1-2)
1. `backend/tests/socket/lobbyHandlers.test.ts` - Update mocks
2. (Optional) `frontend/src/hooks/useTheoreticalMax.test.ts`

---

## Styling Notes

- Use Tailwind CSS classes consistent with existing components
- Semi-transparent dark backdrop (`bg-gray-900/80 backdrop-blur-sm`) so it doesn't fully obscure game content
- Text in white/light gray for contrast
- Bar segment colors use Tailwind's color palette (gray-500, blue-500, emerald-500, violet-500)
- Compact layout: ~320px wide, ~20px per player row + header + legend
- For 10+ players, add `max-h-64 overflow-y-auto` scroll

---

## Execution Order

1. Backend: Add score breakdown query and extend payloads (Step 1)
2. Frontend types: Extend Player interface and listeners (Step 2)
3. Frontend hook: Create useTheoreticalMax (Step 3)
4. Frontend component: Build ScoreBarChart (Step 4)
5. Frontend integration: Add to HostLobby and JoinLobby (Step 5)
6. Tests: Update existing, add new (Step 6)
