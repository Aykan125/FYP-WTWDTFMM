# Improvements Log

This document tracks significant changes and improvements made to the Future Headlines Game systems. Each entry documents the before/after state, rationale, implementation details, and impact.

---

## Scoring System

### Plausibility Scoring Rework

**Status:** ✅ Complete
**Completed:** 2025-01-27
**Priority:** High

#### Problem with Current Implementation

The current system scores plausibility based on the **dice roll band** rather than the AI's assessment of the story direction. This means:
- A well-crafted, plausible story direction can score 0 points if the dice lands on band 1 or 5
- A poorly-crafted direction can score 20 points with a lucky band 3 roll
- Player skill in crafting good story directions is not directly rewarded
- Scoring feels arbitrary and luck-based

#### Before (Current)

```
Source: Dice roll band (selectedBand from weighted 0-100 roll)

Scoring:
  Band 1 (Inevitable, 0-14, 15%)   → 0 pts
  Band 2 (Probable, 15-39, 25%)    → 10 pts
  Band 3 (Plausible, 40-79, 40%)   → 20 pts
  Band 4 (Possible, 80-94, 15%)    → 10 pts
  Band 5 (Preposterous, 95-100, 5%) → 0 pts

Max plausibility points per headline: 20 pts
```

#### After (Target)

```
Source: AI's plausibility grading of the story direction (plausibilityLevel 1-5)

Scoring:
  Grade 1 (Very implausible)  → 0 pts
  Grade 2 (Somewhat unlikely) → +1 pt
  Grade 3 (Plausible)         → +2 pts
  Grade 4 (Somewhat likely)   → +1 pt
  Grade 5 (Very likely)       → 0 pts

Max plausibility points per headline: 2 pts
```

#### Rationale

- **Rewards skill**: Players who craft genuinely plausible story directions get more points
- **Reduces luck factor**: Dice roll still determines which headline variant is shown, but doesn't affect scoring
- **Simpler mental model**: Players understand that "plausible = more points"
- **Grade 1/5 = 0**: Extremes (too obvious or too ridiculous) don't score, encouraging the "sweet spot"

#### Implementation Details

1. In `scoring.ts`, change `calculatePlausibilityScore()` to read from `plausibilityLevel` instead of `selectedBand`
2. Update scoring constants: `PLAUSIBILITY_GRADE_3 = 2`, `PLAUSIBILITY_GRADE_2_4 = 1`, `PLAUSIBILITY_GRADE_1_5 = 0`
3. The dice roll and band selection still happen (for headline variant selection) but don't affect points
4. Database column `plausibility_score` will store smaller values (0-2 instead of 0-20)

#### Files Affected

- `backend/src/game/scoring.ts` — Core scoring logic
- `backend/src/game/scoringService.ts` — Database integration
- `backend/src/game/scoringTypes.ts` — Type definitions
- `backend/tests/scoring.test.ts` — Update test expectations

#### Impact on Gameplay

- Total possible points per headline decreases (baseline + 2 + 3 + planet vs baseline + 20 + tiered + planet)
- May need to adjust baseline score to compensate
- Games will have tighter score distributions
- Skilled players have more consistent advantage

---

### Connection Scoring Rework

**Status:** ✅ Complete
**Completed:** 2025-01-27
**Priority:** High

#### Problem with Previous Implementation

The previous system used **tiered scoring** where both self-connections and others-connections could score simultaneously, with points scaling based on number of connections:
- Complex to understand for players
- Didn't clearly incentivise connecting to others vs self
- LLM returns headline text without player IDs, making self/others distinction unreliable

#### Before (Previous)

```
Self-Story Connections (to player's own previous headlines):
  1 STRONG connection  → 5 pts
  2 STRONG connections → 10 pts
  3 STRONG connections → 15 pts

Others-Story Connections (to other players' headlines):
  1 STRONG connection  → 3 pts
  2 STRONG connections → 8 pts
  3 STRONG connections → 12 pts

Both could score simultaneously.
Weak connections were counted but scored less.

Max connection points: 15 + 12 = 27 pts
```

#### After (Implemented)

```
AI returns top 3 connections, each graded STRONG or WEAK.

Step 1: Discard all WEAK connections
Step 2: Query DB to find headline owners by text
Step 3: Check remaining STRONG connections (mutually exclusive):
  - If ANY belong to another player → +3 pts (stop)
  - Else if ANY belong to player's own headlines → +1 pt (stop)
  - Else (list empty or no DB match) → 0 pts

Max connection points: 3 pts
```

#### Rationale

- **Simpler**: One check, one score, easy to understand
- **Prioritises social play**: Connecting to others' headlines scores more (+3 vs +1)
- **Mutually exclusive**: No complex stacking, just "did you connect to someone else?"
- **Weak = ignored**: Only strong narrative connections count

#### Implementation Details

1. Added `ConnectionScoreType = 'OTHERS' | 'SELF' | 'NONE'` to scoringTypes.ts
2. Added `ConnectionPointsConfig` with `{others: 3, self: 1, none: 0}`
3. Created `computeConnectionScore()` in scoring.ts for pure scoring logic
4. Replaced `deriveStoryConnectionLevel()` with async `deriveConnectionScore()` in lobbyHandlers.ts
5. `deriveConnectionScore()` queries DB to match headline text → player_id
6. Updated `HeadlineScoringInput` to use `connectionType` instead of `selfStoryConnection`/`othersStoryConnection`
7. Updated `HeadlineScoreBreakdown` to include `connectionScore` (deprecated `selfStory`/`othersStory`)
8. DB columns `others_story_connection_level` now stores connectionType, `others_story_score` stores connectionScore

#### Files Changed

- `backend/src/game/scoringTypes.ts` — New types and config
- `backend/src/game/scoring.ts` — `computeConnectionScore()` function
- `backend/src/socket/lobbyHandlers.ts` — `deriveConnectionScore()` with DB query
- `backend/src/game/scoringService.ts` — Updated payload handling
- `backend/tests/game/scoring.test.ts` — New connection score tests
- `backend/tests/game/scoringService.test.ts` — Updated mock payloads

#### Impact on Gameplay

- Encourages players to read and build on others' headlines
- Creates more collaborative/competitive narrative building
- Simpler for players to understand ("connect to others = +3")
- Max points per headline reduced from ~54 to ~30 (tighter score distributions)

---

## Planet System

### Priority Planet Selection Rework

**Status:** ✅ Complete
**Completed:** 2025-01-27
**Priority:** High

#### Problem with Previous Implementation

The previous **LRU (Least Recently Used)** system:
- Priority planet was always the one used longest ago
- Predictable: players could game the system by cycling through planets
- Didn't account for which planets the AI naturally assigns to different story types
- Some players might never get certain planets if their story themes were consistent

#### Before (LRU System)

```
Data structure: Record<PlanetId, { lastUsedRound: number | null }>

Priority planet: Planet with null lastUsedRound (never used), or oldest lastUsedRound

On headline evaluation:
  1. Check if priority planet is in AI's top 3 planets
  2. If match at rank 1 → 15 pts
  3. If match at rank 2 → 10 pts
  4. If match at rank 3 → 5 pts
  5. Mark matched planet with current round number

Deterministic and gameable.
```

#### After (Frequency-Based Tally) ✅ Implemented

```
Data structure: {
  tally: Record<PlanetId, number>,    // Count of appearances in AI's top-3
  previousPriority: PlanetId | null,  // Excluded from next selection
  currentPriority: PlanetId | null    // Current priority for scoring
}

Priority planet selection:
  1. Rank all planets by tally count (ascending)
  2. Take bottom half (rounded up)
  3. Exclude the previous priority planet
  4. Pick randomly from remaining candidates

On headline evaluation:
  1. Check if currentPriority appears anywhere in AI's top-3
  2. If match → flat +3 pts bonus (regardless of rank 1/2/3)
  3. Increment tally for all 3 planets in AI's top-3
  4. Select new priority planet using algorithm above
  5. previousPriority = old currentPriority
```

#### Rationale

- **Less predictable**: Random selection from eligible set prevents gaming
- **Rewards variety**: Planets that rarely appear in your evaluations become priority
- **Encourages exploration**: Players might try different story themes to hit their priority
- **Fair**: Excludes previous priority so you don't get stuck on same planet
- **Simplified bonus**: Flat +3 pts instead of tiered 15/10/5 - cleaner mental model

#### Implementation Details

1. New `PlanetTallyState` type in `scoringTypes.ts`
2. New functions in `planetWeighting.ts`:
   - `initialPlanetTallyState()` - Creates state with all planets at count 0
   - `selectPriorityPlanet()` - Random from bottom half, excluding previous
   - `updatePlanetTally()` - Increments tally for AI's top-3
   - `migratePlanetState()` - Handles legacy LRU → tally conversion
   - `isLegacyState()` / `convertLegacyToTallyState()` - Migration helpers
3. Updated `scoringService.ts` to use `migratePlanetState()` for automatic migration
4. New `planetBonus: { match: 3 }` config in `ScoringConfig`
5. Legacy state migrated automatically on first read (no DB migration needed)

#### Files Changed

- `backend/src/game/planetWeighting.ts` — Complete rewrite with tally logic
- `backend/src/game/scoringTypes.ts` — New types, config
- `backend/src/game/scoringService.ts` — Migration integration
- `backend/tests/game/planetWeighting.test.ts` — 48 tests for new system
- `backend/tests/game/scoringService.test.ts` — Updated for new format

#### Impact on Gameplay

- Players can't predict their next priority planet
- Encourages trying different headline themes
- Creates moments of "oh, I got my priority planet!" surprise
- Tighter score distribution (max +3 instead of +15)
- More fair: everyone has equal chance at bonus regardless of play style

---

## Frontend

### Priority Planet Display

**Status:** ✅ Complete
**Completed:** 2025-01-27
**Priority:** High

#### Problem

Players currently have no visibility into their priority planet. They can't strategically aim for the planet bonus because they don't know what to aim for.

#### Before

- Priority planet exists in backend but not exposed to frontend
- Players have no way to know their current priority
- Planet bonus feels random/invisible

#### After

- Game UI displays current priority planet prominently during PLAYING/BREAK phases
- Shows planet name with "+3 bonus if matched" hint
- Updates after each headline submission when priority changes
- Players can make informed decisions about story direction themes

#### Implementation Details

**Backend:**
1. Modified `broadcastGameState()` in `gameLoop.ts` to include `planet_usage_state` in SQL query
2. Process players to extract `currentPriority` using `migratePlanetState()`
3. Same changes to `getSessionState()` in `lobbyHandlers.ts`
4. Initialize planet state with random priority on game start in `lobby:start_game` handler

**Frontend:**
1. Added `priorityPlanet` field to `Player` interface in `useSocket.ts`
2. Created `PriorityPlanet.tsx` component with purple styling
3. Added `priorityPlanet` prop to `GameStatus.tsx`
4. Pass current player's priority to `GameStatus` in `HostLobby.tsx` and `JoinLobby.tsx`

#### Files Affected

- `backend/src/game/gameLoop.ts` — Include priority in broadcastGameState
- `backend/src/socket/lobbyHandlers.ts` — Include priority in getSessionState, init on game start
- `frontend/src/hooks/useSocket.ts` — Add priorityPlanet to Player interface
- `frontend/src/components/PriorityPlanet.tsx` — New component
- `frontend/src/components/GameStatus.tsx` — Display priority planet
- `frontend/src/components/HostLobby.tsx` — Pass priorityPlanet to GameStatus
- `frontend/src/components/JoinLobby.tsx` — Pass priorityPlanet to GameStatus
- `backend/tests/socket/lobbyHandlers.test.ts` — Updated mock data for tests

---

## LLM Prompts

### Juror Prompt Iterations

Track each significant change to the AI Juror prompt, following the semi-formal prompt engineering process.

| Version | Date | Changes Made | Sample Size | Outcome | Adopted? |
|---------|------|--------------|-------------|---------|----------|
| v1.0 | Initial | Base prompt: evaluate plausibility, classify planets, find connections, generate 5 variants | — | Baseline | Yes |
| | | | | | |
| | | | | | |

#### Prompt Engineering Process

For each iteration:
1. **Collect samples**: Gather 10+ AI evaluations
2. **Review**: Rate each as happy / neutral / unhappy with notes on why
3. **Identify patterns**: What's consistently good or bad?
4. **Adjust prompt**: Modify instructions, examples, or constraints
5. **Re-run**: Evaluate same samples with new prompt
6. **Compare**: Rate each as much worse / slightly worse / same / slightly better / much better
7. **Decision**: Adopt if net positive improvement

#### Files Affected

- `backend/src/llm/jurorPrompt.ts` — Prompt template and schema

#### Notes for Future Iterations

- Document specific examples of good/bad outputs
- Note which aspects improved (plausibility ratings, headline quality, connection detection, etc.)
- Keep old prompt versions commented or in version control

---

## Database Migrations

Track schema changes required for improvements.

| Migration | Description | Status |
|-----------|-------------|--------|
| `008_scoring_rework.sql` | Adjust scoring columns for new point values | Not needed (reused existing columns) |
| `009_planet_tally.sql` | Change planet_usage_state structure to tally format | Not needed (migration in code) |

**Note:** Connection scoring refactor reused existing DB columns (`others_story_connection_level` stores connectionType, `others_story_score` stores connectionScore) to maintain backwards compatibility without requiring a new migration.

**Note:** Planet tally refactor handles migration in application code via `migratePlanetState()`. The `planet_usage_state` JSONB column accepts both old LRU format and new tally format. Legacy states are automatically converted on first read.

---

## Template for New Improvements

```markdown
### [Feature Name]

**Status:** Pending / In Progress / Complete
**Priority:** High / Medium / Low
**Target:** [Date]

#### Problem with Current Implementation

[Describe what's wrong or suboptimal]

#### Before (Current)

[Describe or show current behaviour]

#### After (Target)

[Describe or show target behaviour]

#### Rationale

- [Why this change improves things]

#### Implementation Details

1. [Step-by-step implementation notes]

#### Files Affected

- `path/to/file.ts` — Description

#### Impact on Gameplay

- [How this affects players]

#### Date Completed

YYYY-MM-DD
```
