# Future Headlines Game - Development Plan

## Game Overview

A multiplayer web-based game (10-20 players, 60-90 minutes) where players compete by submitting "headlines from the future" that are evaluated by an AI Juror for plausibility, rewritten based on dice rolls, and scored on multiple dimensions.

### Core Gameplay Loop

1. **Host creates game** → Players join via link/code
2. **Game runs in intervals**: 15 minutes play + 5 minutes break (up to 60 minutes total)
3. **During play**: Players submit headlines occurring at the displayed future date
4. **AI Juror evaluates**: Plausibility rating, planet classification, headline connections
5. **Dice roll**: Determines if headline is upgraded/degraded across 5 bands
6. **Scoring**: Points awarded for plausibility band, story connections, planet bonus
7. **Break summaries**: AI generates news report summarizing the round's headlines
8. **Game end**: Final leaderboard displayed

### Timeline Display

- In-game date starts from current date and progresses at an accelerating ratio (e.g., 60x speed)
- Date visible in top-right corner during play
- When headline is submitted, store the in-game date (month/year) with it

---

## Scoring System

### Score Components

| Component | Description | Points |
|-----------|-------------|--------|
| **Baseline (B)** | Points just for submitting a headline | Fixed amount |
| **Plausibility (A)** | Based on AI's plausibility grading of the story direction | Grade 3: +2pts, Grade 2/4: +1pt, Grade 1/5: 0pts |
| **Connection (C)** | Strong connections to other headlines | Others' headline: +3pts, Own headline: +1pt, None: 0pts |
| **Planet Bonus (P)** | Frequency-based bonus for less-used planets | Awarded when priority planet matches |

### Planet Priority System (Frequency-Based Tally) ✅ Implemented

```
Data structure per player:
  { tally: { [planet]: count }, previousPriority, currentPriority }

To select a new priority planet:
  1. Rank planets by tally count (ascending)
  2. Take the bottom half (least frequently appearing)
  3. Exclude the previously prioritized planet
  4. Pick randomly from this filtered set

On each headline evaluation:
  1. Check if currentPriority matches anywhere in AI's top-3 → flat +3 bonus
  2. Increment tally for all 3 planets in AI's top-3
  3. Select new priority planet using algorithm above
  4. previousPriority = old currentPriority
```

Planets are themed around Greek gods (12 total):
- Earth (nature-based headlines)
- Mars (war and technology)
- etc.

### Headline Connection Scoring

AI Juror evaluates top 3 headline connections (strong/weak):
- Discard weak connections
- Check the filtered (strong-only) list:
  - If it contains another player's headline: score += 3
  - Otherwise, if it contains the player's own headline: score += 1
  - Otherwise (list is empty): no connection score

This is mutually exclusive — only the highest-value match applies.

---

## Dice Roll & Band System

### Band Mapping (0-100 roll, equal width)

| Band | Roll Range | Plausibility Points | Effect |
|------|------------|---------------------|--------|
| 1 | 0-19 | 0 | Headline weakened (very possible) |
| 2 | 20-39 | 1 | Slight downgrade |
| 3 | 40-59 | 2 | **Ideal band** - minimal change |
| 4 | 60-79 | 1 | Slight upgrade |
| 5 | 80-100 | 0 | Headline made wacky/unlikely |

### Headline Transformation Flow

1. Player submits headline direction/concept
2. AI generates 5 versions at different likelihood levels (stored for research)
3. Dice roll determines which band/version is used
4. Final headline is rewritten by AI to improve flow/style
5. Band affects the "power" of the headline

Example: Robot Pope headlines - if player keeps submitting dramatic advances, headlines aren't rejected but "calmed down" based on dice roll.

---

## Rate Limiting

- **1 headline per minute** per player (60-second cooldown)
- Minimum capacity: 150 headlines per 15-minute round (with 10+ players)
- Rate limiting enforced server-side via Redis SETNX
- Client displays cooldown timer with visual feedback

---

## Technical Architecture

### Tech Stack

**Frontend:**
- React + TypeScript
- Socket.IO Client (real-time, auto-reconnect)
- Vite (build tool)
- Tailwind CSS
- LocalStorage for resume_token + last_event_seq

**Backend:**
- Node.js + TypeScript
- Express.js (REST endpoints)
- Socket.IO Server (real-time multiplayer)
- BullMQ (Redis-based job queue for LLM calls)
- OpenAI API (GPT-4 - Juror LLM)
- Zod (input validation)
- JWT (resume tokens)

**Data Layer:**
- Redis (in-memory state, cooldowns, idempotency, event sequencing)
- PostgreSQL (durable storage for events, sessions, leaderboards)
- Prisma ORM
- Socket.IO Redis Adapter (multi-server scaling)

**Infrastructure:**
- Docker + Docker Compose
- NGINX/Caddy (reverse proxy, HTTPS, WebSocket routing)
- GitHub Actions (CI/CD)
- Vercel (frontend) + Fly.io/Render/Railway/AWS EC2 (backend)

### Architecture Philosophy

- **Node.js** = Authoritative logic (rules, scoring, LLM triggers)
- **Redis** = Real-time memory (active state + reconnect buffer)
- **PostgreSQL** = Long-term history (events, leaderboards)
- **React Client** = Presentation layer (UI + player input)

---

## Database Schema

### Game Sessions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| host_user_id | UUID | FK to Users (nullable) |
| join_code | string | Unique game code |
| status | enum | WAITING, PLAYING, BREAK, FINISHED |
| play_minutes | int | Default 15 |
| break_minutes | int | Default 5 |
| total_duration_minutes | int | e.g., 60 |
| current_round | int | Current round number |
| timeline_speed_ratio | number | e.g., 60.0 |
| config | JSON | Optional config (planet names, etc.) |
| created_at, started_at, ended_at | timestamp | Lifecycle timestamps |

### Session Players

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | FK to GameSessions |
| user_id | UUID | FK to Users (nullable) |
| nickname | string | Unique per session |
| is_host | boolean | Host flag |
| joined_at, last_seen_at | timestamp | Activity timestamps |
| resume_token_jti | UUID | For reconnection |
| resume_expires_at | timestamp | Token expiry |

### Headlines

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | FK to GameSessions |
| player_id | UUID | FK to SessionPlayers |
| round_no | int | Round number (≥0) |
| raw_text | string | Original submission |
| transformed_text | string | AI-rewritten version |
| in_game_date | timestamp | Future date when submitted |
| status | enum | PENDING, EVALUATED, FAILED |
| **Juror Outputs** | | |
| juror_plausibility_hint | smallint | 1-5 rating |
| juror_story_score | smallint | 0-3 rating |
| planet | string | Thematic label (Mars, Earth, etc.) |
| **Dice & Band** | | |
| dice_roll | smallint | 0-100 |
| final_band | smallint | 1-5 |
| **Points** | | |
| plausibility_points | int | From band |
| story_points | int | From connections |
| planet_bonus_points | int | From LRU system |
| total_points | int | Sum of all |
| **Timestamps** | | |
| submitted_at | timestamp | When submitted |
| evaluated_at | timestamp | When Juror completed |

### Scores (Rolling Aggregates)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | FK to GameSessions |
| player_id | UUID | FK to SessionPlayers |
| round_no | int | NULL for overall total |
| plaus_points_total | int | Accumulated plausibility |
| story_points_total | int | Accumulated story |
| planet_bonus_total | int | Accumulated planet |
| total_points | int | Grand total |

---

## Reconnection & Recovery

### Flow

1. Socket.IO attempts auto-reconnect with exponential back-off
2. Client sends `{resume_token, last_event_seq}` on reconnect
3. Server responds with either:
   - **Delta**: Events since last_event_seq
   - **Snapshot + Tail**: Current state + recent events
4. Player resumes seamlessly without loss of actions or points
5. Disconnected players marked offline but state preserved for grace period (2-5 minutes)

### Requirements

- Resume tokens: Signed JWTs with ≤10 min expiry
- All communication over WSS/HTTPS
- LocalStorage stores resume_token + last_event_seq

---

## LLM Juror Integration

### Evaluation Pipeline

1. Player submits headline direction/concept
2. Request queued via BullMQ (async, non-blocking)
3. OpenAI API evaluates:
   - Plausibility rating (1-5)
   - Planet classification (top 3)
   - Connection to previous headlines (own + others)
4. AI generates 5 versions at different likelihood levels
5. Store all versions in database for research
6. Dice roll selects final version
7. Emit `headlineEvaluated` event to all players

### Prompt Structure

- Feed LLM: date + headline + previous headlines context
- Request structured JSON output (unambiguous)
- Upload prompt as PDF for easier management

### Fallback

- Heuristic evaluation if LLM unavailable
- Cache repeated evaluations
- Log all Juror interactions for analysis

### AI Prompt Engineering (Semi-Formal Process)

Iterative prompt refinement as a repeatable engineering step:

1. **Collect samples**: Gather at least 10 AI evaluations of story directions
2. **Review**: For each evaluation, write a brief note — happy, neutral, or unhappy — and why
3. **Adjust**: Based on review comments, modify the guidance/instructions given to the AI
4. **Re-run**: Re-evaluate the same sample of storylines with the updated prompt
5. **Compare**: For each output, assess whether it is much worse, slightly worse, about the same, slightly better, or much better
6. **Decision**: If net improvement, adopt the new prompt. Repeat with a new batch time permitting

---

## Sprint Plan

### Sprint 1 (Oct 10 – Oct 23) — Project Setup & Requirements

- [ ] Write functional and non-functional requirements document
- [ ] Create wireframes: Lobby, Game screen, Leaderboard/summary
- [ ] Finalize tech stack
- [ ] Create initial folder/repository structure
- [ ] Initialize Git and project documentation
- [ ] Set up linting/formatting/basic CI
- [ ] Report: Introduction, Objectives, Planned Technologies

### Sprint 2 (Oct 24 – Nov 6) — Architecture, Database Schema & Lobby MVP

- [ ] Design system architecture diagram
- [ ] Design database schema (Users, Sessions, Headlines, Planets, Scores)
- [ ] Implement lobby: Host creates session, Players join via code/link
- [ ] Implement unique game-code generator
- [ ] Add player identity (nickname + session tracking)
- [ ] Add reconnect behavior
- [ ] Seed database with planet names/categories
- [ ] Report: Architecture & Schema Design

### Sprint 3 (Nov 7 – Nov 20) — Real-Time Game Loop Core

- [ ] Build server-side state machine (WAITING → PLAYING → BREAK → FINISHED)
- [ ] Add timing logic (15-min play + 5-min break, configurable)
- [ ] Broadcast game state updates to all players
- [ ] Display in-game date/time (faster than real time)
- [ ] Let host control game start
- [ ] Handle reconnects/late joins
- [ ] Persist state transitions
- [ ] Report: Game Loop and State Synchronization

### Sprint 4 (Nov 21 – Dec 4) — Headline Submission & Global Feed

- [ ] Implement headline submission event/endpoint
- [ ] Add rate-limiting (1 headline/minute per player)
- [ ] Save headline with timestamp, round ID, in-game date
- [ ] Broadcast new headlines to global feed
- [ ] Implement client-side cooldown timer + visual feedback
- [ ] Create scrollable global headline list UI
- [ ] Report: Headline Submission Flow

### Sprint 5 (Dec 5 – Dec 18) — Scoring System & Planet Weighting

- [ ] Define base scoring formula (plausibility + story + planet bonus)
- [ ] Implement baseline score for submissions
- [ ] Add story-score heuristic (connection detection)
- [ ] Implement planet weighting (LRU-style)
- [ ] Update player totals/leaderboard each submission
- [ ] Write unit tests for scoring and weighting
- [ ] Report: Scoring Design and Balancing

### Sprint 6 (Dec 19 – Jan 1) — Dice Mechanic & Headline Transformation

- [ ] Build dice-roll interface and random roll logic
- [ ] Map rolls to five bands
- [ ] Define transformation rules for upgrade/degrade
- [ ] Apply transformation to headline text
- [ ] Record original + transformed headline
- [ ] Recalculate score post-transformation
- [ ] Display result (band + transformation summary)
- [ ] Report: Dice Mechanics and Transformation Rules

### Sprint 7 (Jan 2 – Jan 15) — Juror LLM Integration

- [ ] Build juror evaluation service interface
- [ ] Integrate OpenAI API
- [ ] Generate 5 headline versions at different likelihoods
- [ ] Add fallback heuristic if unavailable
- [ ] Plug juror into scoring pipeline
- [ ] Add caching for repeated evaluations
- [ ] Log juror interactions
- [ ] Report: LLM Integration Design

### Sprint 8 (Target: End of January) — Refactors

- [x] Refactor plausibility scoring: use AI's grading (not dice roll band) for points
  - Grade 3 → +2 pts, Grade 2/4 → +1 pt, Grade 1/5 → 0 pts
- [x] Refactor connection scoring: mutually exclusive (+3 others / +1 self / 0)
  - Discard weak connections, query DB to find headline owners, check for others' vs own
- [x] Refactor planet selection: replace LRU with frequency-based tally system
  - Pick from bottom half of tally, exclude previous priority
  - Flat +3 bonus when priority planet matches anywhere in AI's top-3
  - Migration from legacy LRU state handled automatically
- [x] Update tests to reflect new planet logic (48 planet tests, 213 total)
- [ ] Add priority planet display to frontend UI

### Sprint 9 (Target: Early February) — End-to-End Round & Deployment

- [x] Automate PLAYING → BREAK → next round transitions (already implemented in gameLoop.ts)
- [ ] Store headlines per round as snapshots
- [ ] Generate AI-powered break summaries displayed to all players
- [ ] Handle game end: transition to FINISHED, final leaderboard, cleanup
- [ ] Host frontend and backend online (accessible via public URL)
- [ ] Configure production database and environment variables
- [ ] Ensure WebSocket connections work through hosting infrastructure

### Sprint 10 (Target: Mid-February) — Playtesting

- [ ] Run playtest session with 10-20 participants
- [ ] Gather feedback on scoring balance, headline quality, player experience
- [ ] Fix usability issues and edge cases found during live play
- [ ] Document findings and apply improvements

### Sprint 11 (Target: Early March) — Leaderboard & Replay

- [ ] Implement full leaderboard with live rank updates
- [ ] Store per-round data for replay
- [ ] Add replay viewer UI
- [ ] Add input filtering and moderation logs

### Sprint 12 (Target: Mid-March) — Stretch Features

- [ ] Real headlines warmup: compile actual 2022–2025 headlines; clock advances from 2022 to present over 3 minutes with real headlines posting; submit buttons activate when clock reaches today
- [ ] AI Player: LLM-powered competitor with same rules/cooldowns, host toggle
- [ ] Audio Summaries: TTS for break summaries with narrative structure

### Wrap-up — Final QA & Submission

- [ ] Comprehensive unit + integration tests
- [ ] Fix last bugs/UI inconsistencies
- [ ] Tag final release
- [ ] Submit report + live demo link

---

## Functional Requirements

### User and Session Management

1.1 Host can create a new game session with unique join code/link
1.2 Players can join existing session via code/link
1.3 System stores player identity (player_id, nickname) and session association
1.4 System issues secure resume token for reconnection
1.5 Disconnected players marked offline but state preserved (2-5 min grace)
1.6 On reconnect, verify resume token and restore state

### Game Lifecycle

2.1 Host can start and stop the game manually
2.2 Game runs in 15-min play + 5-min break intervals, up to 60 minutes
2.3 Display fast-moving in-game date during play
2.4 Automatic state transitions: WAITING → PLAYING → BREAK → FINISHED
2.5 All state transitions synchronized in real time

### Headline Submission and Validation

3.1 During active rounds, 1 headline per minute per player
3.2 Each submission logged with unique sequence number
3.3 Persist events in Redis (real-time) and PostgreSQL (durability)
3.4 Prevent duplicates using idempotency keys

### Dice Roll and Band Logic

4.1 Virtual dice roll (0-100) on submission
4.2 Roll mapped to one of five bands
4.3 Transformed headline displayed with resulting band

### LLM Evaluation

5.1 Each headline evaluated by OpenAI LLM for plausibility and rewriting
5.2 LLM requests executed async via BullMQ
5.3 On completion, emit headlineEvaluated event
5.4 Reconnecting players receive result via delta replay

### Scoring and Leaderboard

6.1 Scores based on: plausibility band, story continuity, planet weighting
6.2 Scores update in real time
6.3 Global leaderboard displays totals per round and at game end

### Break Summaries

7.1 Generate textual summary at start of each break
7.2 Optional: audio version (TTS stretch goal)
7.3 Archive summaries for viewing at game end

### Reconnection and Recovery

8.1 Socket.IO auto-reconnect with exponential back-off
8.2 Client sends {resume_token, last_event_seq} on reconnect
8.3 Server responds with Delta or Snapshot + Tail
8.4 Seamless resume without loss
8.5 Server rebuilds state from Redis/Postgres on restart

### Administration

9.1 Host can restart game if needed
9.2 All player actions logged for moderation

### AI Player (Stretch)

10.1 Host can enable AI Player with same rules/cooldowns
10.2 AI uses OpenAI API for headline generation

---

## Non-Functional Requirements

### Performance

- Support 20 concurrent players per session with <250ms latency
- LLM queue handles ≥150 headlines per 15 minutes
- Redis operations <5ms average

### Reliability

- Sessions survive disconnects and server restarts
- No submitted headline lost or duplicated
- 99.5% uptime during active play

### Scalability

- Horizontal scaling via Socket.IO Redis Adapter
- Redis/Postgres deployed with replication

### Security

- Resume tokens: signed JWTs with ≤10 min expiry
- All communication over WSS/HTTPS
- Input sanitized (XSS/injection prevention)
- API keys in environment variables/secrets manager

### Maintainability

- TypeScript throughout
- ESLint + Prettier + GitHub Actions CI
- Modular architecture: frontend/backend/worker/db

### Usability

- Responsive, intuitive interface
- Invisible reconnect behavior
- Human-readable error messages

### Extensibility

- AI players, audio summaries, analytics with minimal API changes
- Planet/scoring logic data-driven (DB configurable)

### Compliance

- OpenAI API usage policy compliance
- GDPR/UK Data Protection Act compliance

---

## Stretch Goals

1. **Audio Summaries**: Text-to-speech for break summaries (3 chapters of narratives, optional final conclusion)
2. **AI Player**: LLM-powered player that competes with humans
3. **Replay System**: View game history and individual round summaries
4. **Analytics Dashboard**: Metrics visualization (Prometheus + Grafana)
5. **Link-Based Joining**: Share links instead of codes for easier joining
6. **Real Headlines Warmup**: Compile a list of headlines describing actual events for 2022–2025. Game clock starts at 2022; over the first 3 minutes the clock advances to the current date with real headlines incrementally posting to the feed. Player submit buttons are greyed out until the clock reaches the present day.

---

## Testing Strategy

### Playtest Configuration

- In-game date starts from 2026 (e.g., March 2026, May 2026, July 2026)
- Time runs linearly within each 15-minute block
- Display month and year prominently
- Store date with each submitted headline

### Load Testing

- Simulate 10-20 concurrent players
- Verify <250ms latency on real-time updates
- Test LLM queue throughput (150+ headlines/15min)

### Unit Tests

- Scoring logic (plausibility, connections, planet bonus)
- Planet weighting (frequency-based tally)
- Dice roll band mapping
- State machine transitions

---

## Notes for Development

### Planet System (Frequency-Based Tally) ✅ Implemented

- Maintain tally per player of how often each planet appears in AI's top-3
- Priority planet = random pick from bottom half of tally counts, excluding previous
- Flat +3 bonus when priority planet appears anywhere in AI's top-3
- Legacy LRU state migrated automatically on first read
- Files: `planetWeighting.ts`, `scoringTypes.ts`, `scoringService.ts`

### Headline Generation Research

- Store all 5 generated headline versions for each submission
- Enables future analysis of LLM output patterns
- Create practice set of headlines for testing

### Connection Scoring Details

- AI returns top 3 connections graded as STRONG or WEAK
- Discard weak connections
- From strong-only list (mutually exclusive):
  - If contains another player's headline → +3 pts
  - Else if contains player's own headline → +1 pt
  - Else (empty) → 0 pts

### Things to Discuss/Test

- "Wackyness" feature (headlines rolled up to band 5)
- Relative band widths with professor
- Modulating LLM to improve/disimprove headlines
- Whether to keep the "make more wacky" feature
