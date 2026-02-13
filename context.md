# Future Headlines Game - Development Context

## Project Overview

A multiplayer web game (10-20 players, 60-90 minutes) where players compete by submitting "headlines from the future" that are evaluated by an AI Juror for plausibility, transformed via dice roll, and scored on multiple dimensions.

### Core Gameplay Loop

1. Host creates game → Players join via code
2. Game runs in intervals: 15 min play + 5 min break (configurable)
3. During play: Players submit headlines for the displayed future date
4. AI Juror evaluates: Plausibility, planet classification, headline connections
5. Dice roll: Determines which of 5 headline variants is selected
6. Scoring: Points for plausibility band, story connections, planet bonus
7. Break summaries: AI generates news report summarizing round's headlines
8. Game end: Final leaderboard displayed

---

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js (REST) + Socket.IO (real-time)
- **Database**: PostgreSQL (local)
- **AI**: OpenAI Responses API (gpt-4o-mini)
- **Testing**: Jest (213 tests)

### Frontend
- React + TypeScript
- Socket.IO Client
- Vite
- Tailwind CSS

---

## Implementation Status

### Completed (Sprints 1-7)

#### Session Management
- Host creates game with unique 6-char join code
- Players join via code, assigned player ID
- Nicknames, host status tracking
- Socket.IO rooms for session broadcasts

#### Game Loop & State Machine
| Phase | Description |
|-------|-------------|
| WAITING | Lobby, waiting for host to start |
| PLAYING | Active round, players submit headlines |
| BREAK | Between rounds, summaries displayed |
| FINISHED | Game complete, final leaderboard |

- Configurable play/break durations
- Automatic phase transitions
- In-game timeline with accelerated date (60x speed)

#### Headline Submission Flow
```
Player submits "story direction"
        ↓
Rate limit check (1 per minute)
        ↓
Fetch existing headlines for context
        ↓
Call LLM Juror for evaluation
        ↓
Backend dice roll (0-100)
        ↓
Select headline from rolled band
        ↓
Store in database (with full LLM request/response)
        ↓
Apply scoring
        ↓
Broadcast to all players
```

#### LLM Juror Integration
The LLM evaluates each headline and returns:

| Output | Description |
|--------|-------------|
| PLAUSIBILITY | Band 1-5 assessment with rationale |
| PLANETS | Top 3 planet classifications |
| LINKED | Top 3 connections to previous headlines (STRONG/WEAK) |
| HEADLINES | 5 headline variants (one per band) |

#### Dice Roll System
Weighted probabilities (3:5:8:3:1 ratio):

| Band | Roll Range | Probability | Label |
|------|------------|-------------|-------|
| 1 | 0-14 | 15% | Inevitable |
| 2 | 15-39 | 25% | Probable |
| 3 | 40-79 | 40% | Plausible |
| 4 | 80-94 | 15% | Possible |
| 5 | 95-100 | 5% | Preposterous |

#### Scoring System (Current Implementation)
| Component | Source | Points |
|-----------|--------|--------|
| Baseline | Submitting a headline | 10 pts |
| Plausibility | AI grade (3=2, 2/4=1, 1/5=0) | 0-2 pts |
| Connection | STRONG connections to headlines (mutually exclusive) | 0/1/3 pts |
| Planet Bonus | Frequency-based tally matching (flat bonus) | 0/3 pts |

**Connection Scoring (Simplified Model)**:
- OTHERS: Any STRONG connection to another player's headline → +3 pts
- SELF: STRONG connections only to own headlines → +1 pt
- NONE: No STRONG connections → 0 pts

**Max possible per headline**: ~18 pts (10 + 2 + 3 + 3)

#### Planet Weighting (Frequency-Based Tally System)
- 8 planets (Mercury through Neptune)
- Each player tracks a tally of how often each planet appears in their AI evaluations
- "Priority planet" = randomly selected from bottom half of tally counts (excluding previous)
- If headline's AI top-3 includes the priority planet → flat +3 pts bonus
- After each evaluation:
  - Tally incremented for all 3 planets in AI's top-3
  - New priority planet selected from least-frequently-appearing planets
  - Previous priority excluded from next selection

#### Database Logging
Full LLM request/response stored for each headline:
- `llm_request` (JSONB) - Story direction, context, planets, instructions
- `llm_response` (JSONB) - Full evaluation output

---

### Not Yet Implemented

#### Refactors Required (Target: end of January)
| Feature | Description | Status |
|---------|-------------|--------|
| **Plausibility scoring** | Change from dice-roll-band-based to AI grading (grade 3→+2, 2/4→+1, 1/5→0) | ✅ Done |
| **Connection scoring** | Change from tiered (5/10/15, 3/8/12) to mutually exclusive (+3 others / +1 self / 0) | ✅ Done |
| **Planet system** | Change from LRU to frequency-based tally (pick from bottom half, exclude previous, flat +3 bonus) | ✅ Done |
| **Priority planet frontend** | Display current priority planet in game UI so players can aim for bonus | Pending |

#### New Features (Target: early-mid February)
| Feature | Description | Status |
|---------|-------------|--------|
| **End-to-end round flow** | Automate PLAYING → BREAK → next round transitions | ✅ Done (gameLoop.ts) |
| **Round snapshots** | Store headlines per round as discrete units | Pending |
| **Break summaries** | AI-generated news report during breaks | Pending |
| **Game end handling** | Transition to FINISHED, display final leaderboard, cleanup | Pending |
| **Deployment** | Host frontend/backend online, production DB, WebSocket config | Pending |

#### Playtesting (Target: mid-February)
| Feature | Description |
|---------|-------------|
| **User playtests** | Run sessions with 10-20 participants |
| **Feedback collection** | Gather feedback on scoring, headline quality, experience |
| **Bug fixes** | Fix usability issues and edge cases found during play |

#### Leaderboard & Replay (Target: early March)
| Feature | Description |
|---------|-------------|
| **Live leaderboard** | Real-time rank updates during gameplay |
| **Replay system** | Per-round data stored for post-game viewing |
| **Replay UI** | Step through game history |
| **Moderation** | Input filtering and moderation logs |

#### Stretch Features (Target: mid-March)
| Feature | Description |
|---------|-------------|
| **Real Headlines Warmup** | Actual 2022-2025 headlines during 3-min clock advance intro |
| **AI Player** | LLM-powered competitor with same rules/cooldowns |
| **Audio Summaries** | TTS for break summaries with narrative structure |

---

## Database Schema

### Tables

**game_sessions**
```sql
id, join_code, status, host_player_id
play_minutes, break_minutes, max_rounds, current_round
phase, phase_started_at, phase_ends_at
timeline_speed_ratio, in_game_start_at
```

**session_players**
```sql
id, session_id, nickname, is_host, joined_at
total_score, planet_usage_state (JSONB)
```

**game_session_headlines**
```sql
-- Core
id, session_id, player_id, round_no, headline_text, created_at

-- Dice roll & selection
dice_roll, selected_band, selected_headline
band1_headline, band2_headline, band3_headline, band4_headline, band5_headline

-- LLM evaluation
plausibility_level, plausibility_rationale
planet_1, planet_2, planet_3
linked_headlines (JSONB), planet_rationales (JSONB)

-- Scoring breakdown
baseline_score, plausibility_score
self_story_connection_level, self_story_score
others_story_connection_level, others_story_score
planet_bonus_score, total_headline_score

-- LLM logging
llm_model, llm_input_tokens, llm_output_tokens
llm_request (JSONB), llm_response (JSONB)
llm_status
```

### Migrations
1. `001_initial.sql` - Base tables
2. `002_game_state.sql` - Game loop columns
3. `003_headlines.sql` - Headlines table
4. `004_host_player.sql` - Host tracking
5. `005_headline_transformation.sql` - Dice roll & bands
6. `006_llm_request_response.sql` - LLM logging
7. `007_scoring_columns.sql` - Scoring breakdown

---

## Socket.IO Events

### Client → Server
| Event | Description |
|-------|-------------|
| `session:create` | Create new session |
| `session:join` | Join existing session |
| `game:start` | Host starts game |
| `headline:submit` | Submit headline |
| `headline:get_feed` | Get headlines for session |

### Server → Client
| Event | Description |
|-------|-------------|
| `session:state` | Full session state (join/reconnect) |
| `game:state` | Phase, round, timing info |
| `headline:new` | New headline submitted |
| `leaderboard:update` | Scores updated |
| `player:joined` | New player joined |

---

## File Structure

```
backend/
├── src/
│   ├── db/
│   │   └── pool.ts
│   ├── game/
│   │   ├── diceRoll.ts           # Dice roll logic
│   │   ├── gameLoop.ts           # State machine
│   │   ├── headlineTransformationService.ts
│   │   ├── jurorService.ts       # LLM orchestration
│   │   ├── planetWeighting.ts    # LRU planet logic
│   │   ├── planets.ts            # Planet definitions
│   │   ├── scoring.ts            # Pure scoring functions
│   │   ├── scoringService.ts     # DB scoring integration
│   │   └── scoringTypes.ts       # Type definitions
│   ├── llm/
│   │   ├── jurorPrompt.ts        # LLM prompt & schema
│   │   └── openaiResponsesClient.ts
│   ├── routes/
│   │   └── juror.ts              # REST endpoints
│   ├── socket/
│   │   └── lobbyHandlers.ts      # Socket.IO handlers
│   └── utils/
│       └── validation.ts
├── tests/                        # 11 test files, 195 tests
├── db/migrations/                # 7 migration files
└── package.json
```

---

## Configuration

### Environment Variables (.env)
```
DATABASE_URL=postgresql://user@localhost:5432/future_headlines
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # optional, defaults to gpt-4o-mini
```

---

## Running the Project

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database Setup
```bash
# Create database
createdb future_headlines

# Run migrations
psql -d future_headlines -f db/migrations/001_initial.sql
# ... repeat for all migrations
```

### Running Tests
```bash
cd backend
npm test
```

---

## Key Design Decisions

### 1. Backend Dice Roll
The dice roll happens on the backend, not in the LLM. This ensures:
- Fairness (can't be manipulated)
- Auditability (stored in DB)
- Consistent probabilities

### 2. Weighted Dice Probabilities (3:5:8:3:1)
- Band 3 (plausible) is most likely at 40%
- Band 5 (preposterous) is rare at 5%
- Creates more balanced gameplay

### 3. Scoring Uses AI Assessment (Refactor Complete)
Plausibility points now come from `plausibilityLevel` (LLM assessment), not `selectedBand` (dice result). The AI grading determines points: grade 3 → +2 pts, grade 2/4 → +1 pt, grade 1/5 → 0 pts. The dice roll still determines which headline variant is displayed, but doesn't affect scoring.

### 4. LLM Request/Response Logging
Full request and response stored for:
- Debugging
- Research analysis
- Audit trail

### 5. Story Connections (Refactor Complete)
Uses simplified mutually exclusive scoring: WEAK connections are discarded; `deriveConnectionScore()` queries DB to find headline owners from STRONG connections; if any belong to another player → +3 pts, else if any belong to self → +1 pt, else → 0 pts. This encourages players to build on others' narratives.

### 6. Planet System (Refactor Complete)
Uses frequency-based tally system. Each player tracks how often each planet appears in their AI evaluations. Priority planet is randomly selected from the bottom half of tally counts (least frequently appearing), excluding the previous priority. Flat +3 bonus when priority matches anywhere in AI's top-3. Legacy LRU state is automatically migrated on first read.

---

## Testing

### Test Coverage
```
Test Suites: 11 passed
Tests:       213 passed
```

| Test File | What It Tests |
|-----------|---------------|
| `diceRoll.test.ts` | Dice roll mapping, boundaries, weighted distribution |
| `scoring.test.ts` | Pure scoring functions |
| `scoringService.test.ts` | DB scoring integration, transactions |
| `planetWeighting.test.ts` | Frequency-based tally logic, priority selection, migration |
| `jurorService.test.ts` | LLM validation, error handling |
| `jurorRoutes.test.ts` | REST API endpoints |
| `headlineHandlers.test.ts` | Socket headline submission flow |
| `lobbyHandlers.test.ts` | Session management |
| `gameLoop.test.ts` | State machine transitions |
| `gameLoopManager.test.ts` | Multi-session loop management |
| `openaiResponsesClient.test.ts` | OpenAI client |

---

## Sprint Progress

| Sprint | Focus | Target | Status |
|--------|-------|--------|--------|
| 1 | Project Setup & Requirements | — | ✅ Complete |
| 2 | Architecture, DB Schema, Lobby | — | ✅ Complete |
| 3 | Real-Time Game Loop | — | ✅ Complete |
| 4 | Headline Submission & Feed | — | ✅ Complete |
| 5 | Scoring System & Planet Weighting | — | ✅ Complete |
| 6 | Dice Mechanic & Transformation | — | ✅ Complete |
| 7 | Juror LLM Integration | — | ✅ Complete |
| 8 | Refactors (Scoring ✅, Connections ✅, Planet ✅, Priority Display) | End of Jan | 🔄 Nearly Complete |
| 9 | Break Summaries + Deployment (auto-transitions ✅) | Early Feb | 🔄 In Progress |
| 10 | Playtesting | Mid-Feb | ⏳ Pending |
| 11 | Leaderboard & Replay | Early Mar | ⏳ Pending |
| 12 | Stretch Goals (Real Headlines, AI Player, TTS) | Mid-Mar | ⏳ Pending |
