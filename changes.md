# Remove planets from round summary generation

## What changed

**Files:** `backend/src/llm/summaryPrompt.ts`, `frontend/src/components/RoundSummary.tsx`, `frontend/src/hooks/useSocket.ts`

Summaries generated during BREAK and at game end previously mentioned "planetary themes" because the summary prompt was fed planet data per headline and asked the AI to list dominant planets. This broke immersion — summaries are supposed to read as pure historical recaps.

Changes:
- Removed `- Planets: ${planetStr}` from the headline format in the prompt
- Removed `dominantPlanets` from the summary JSON schema
- Removed task 4 ("Dominant Planets") from the prompt instructions
- Added explicit "Do NOT mention planets, planetary themes, or any game mechanics" directive
- Removed the unused `planetCounts` calculation and `planetStr` variable
- Removed the purple planet badges section from `RoundSummary.tsx`
- Made `dominantPlanets` optional on `RoundSummaryOutput` type for backwards compat with old DB rows

## Trade-offs considered

1. **Keep planets in prompt but instruct AI not to mention them:** Weak signal — the AI often leaked planet references anyway. Rejected.
2. **Remove planets from prompt entirely (chosen):** Cleaner — if the data isn't in the prompt, the AI can't mention it.

## Justified rationale

The planet system is a game mechanic, not part of the fictional world. Summaries should read as genuine historical recaps without reference to game internals.

---

# Revert plausibility prompt calibration

## What changed

**File:** `backend/src/llm/jurorPrompt.ts`

Reverted the P1/P5 wording changes from commits `5d2991a` and `505563b` back to the original definitions:

```
- P1 inevitable: overwhelmingly expected by that date; would be more surprising not to happen
- P2 probable: more likely than not by that date
- P3 plausible: credible and well within the range of realistic outcomes by that date
- P4 possible: not the baseline expectation, but still a serious possibility
- P5 preposterous: would require extremely surprising breakthroughs, cascades, or consequences by that date
```

## Trade-offs considered

1. **Keep the tweaked wording:** The tweak was based on single-rater disagreement (Ayman alone showed the AI called things P1 3x more often). Rejected.
2. **Revert to original (chosen):** A second rater (LDG) produced similar disagreement patterns with the AI but the humans also disagreed with each other significantly. When looking at the shared human agreement (where both humans agreed), the AI's ratings were in the right range. The original prompt was already well-calibrated.

## Justified rationale

Inter-rater variance between the two human raters was substantial — Ayman-vs-LDG weighted kappa was only 0.087 (poor) while Ayman-vs-AI and LDG-vs-AI were both ~0.28 (fair). This means the AI was actually closer to a human consensus than either individual rater. The original prompt was doing fine; my earlier tweak over-corrected based on noisy single-rater data.

---

# Planet color coding in headline feed

## What changed

**File:** `frontend/src/components/HeadlineFeed.tsx`

Added a subtle left-border colour to each non-archive headline card based on its primary planet (the first entry in `planets[]`). Uses Tailwind `-300` weight tones (`border-l-2 border-l-{color}-300`).

Planet → colour mapping:
```
EARTH → green, MARS → red, MERCURY → cyan, VENUS → pink, JUPITER → orange,
SATURN → yellow, NEPTUNE → blue, URANUS → teal, PLUTO → purple
```

Archive headlines are excluded (they don't have planet data). The border is intentionally subtle so readability isn't sacrificed.

## Trade-offs considered

1. **Bold background colour per planet:** Too distracting, hurts readability.
2. **Icon next to player name:** Adds clutter.
3. **Chosen: Subtle left border:** Visible but unobtrusive.

## Justified rationale

Players had no way to see what planet the AI had classified their headlines under. The left border gives a glanceable signal without requiring explicit labels.

---

# Score bar chart colour tweaking

## What changed

**File:** `frontend/src/components/ScoreBarChart.tsx`

The four segments (baseline, plausibility, connection, planet bonus) were all `-400` weight, making them visually similar:
- Plausibility: `indigo-400` → `indigo-500` (darker)
- Connection: `emerald-400` → `emerald-500` (darker)
- Planet: `violet-400` → `amber-400` (different hue entirely)
- Baseline: unchanged (`gray-400`)

## Trade-offs considered

1. **Radically different palette:** Would lose the existing theme feel. Rejected.
2. **Minor darkening + one hue change (chosen):** Enough to distinguish segments without breaking the visual identity.

## Justified rationale

Players reported difficulty telling the score segments apart. Distinct colours improve the leaderboard's readability at a glance.

---

# Score explanation card

## What changed

**Files:** `frontend/src/components/ScoreCard.tsx` (new), `frontend/src/components/GameLayout.tsx`

Added a new `ScoreCard` component to the left sidebar during PLAYING and BREAK phases. It shows the scoring rules at a glance:
```
Baseline           +1
Plausibility +2 sweet spot / +1 near
Connection   +1 / +4 / +9 for 1/2/3 unique authors
Planet bonus +2
```

## Trade-offs considered

1. **Add to a help modal or tooltip:** Hides the info behind a click. Rejected.
2. **Show inline in the left sidebar (chosen):** Always visible while playing. Uses the existing card styling.

## Justified rationale

The scoring changes from playtest 1 (baseline 5→1, connection 1/4/9, planet 3→2) make it harder for players to know what they're optimising for. A persistent reference card helps players strategise without breaking immersion.

---

# Per-headline score breakdown on hover

## What changed

**Files:** `backend/src/socket/lobbyHandlers.ts`, `frontend/src/hooks/useSocket.ts`, `frontend/src/components/HeadlineFeed.tsx`

Headlines in the feed now show a score breakdown tooltip on hover: `+1 baseline / +2 plaus / +4 conn / +2 planet = 9 pts`.

Implementation:
- The `headline:get_feed` query now returns score columns (`baseline_score`, `plausibility_score`, `others_story_score`, `planet_bonus_score`, `total_headline_score`) for each row
- The `Headline` interface on the frontend was extended with optional score fields
- The `leaderboard:update` listener now patches the matching headline in state with its score breakdown when a new headline is scored
- `HeadlineFeed.tsx` uses Tailwind `group` / `group-hover:flex` to show the tooltip only on hover

## Trade-offs considered

1. **Show breakdown always:** Clutters the feed. Rejected.
2. **Click to reveal:** Requires discovery. Rejected.
3. **Hover (chosen):** Invisible until needed, instant on hover.

## Justified rationale

Per-headline scores were tracked on the backend but never exposed to players. The hover tooltip lets players understand why specific headlines scored high or low without adding permanent visual noise.

---

# Adjust planet tally weights to Option B (2/3 ratio)

## What changed

**Files:** `backend/src/game/planetWeighting.ts`, `backend/tests/game/planetWeighting.test.ts`

Follow-up to the earlier weighted planet tallies change. The initial version used weights +1 (all planets) and +2 (NEPTUNE, PLUTO). Monte Carlo simulation showed this produced a 6.3x max/min ratio in priority selection, dropping PLUTO to 2.9% and effectively eliminating it.

Changed to:
```
All planets: weight 2
NEPTUNE, PLUTO: weight 3
```

The 2/3 ratio (1.5x effective difference) produces a more balanced distribution (simulated):
- EARTH/VENUS: ~17.7% (most likely as priority)
- NEPTUNE: 10.8% (still appears meaningfully)
- PLUTO: 4.4% (rare but not eliminated)
- Max/min ratio: 4.9x (best of all tested options)

## Trade-offs considered

1. **Keep +1/+2 (original):** Too aggressive — kills PLUTO completely.
2. **Use +1/+2/+3 (three-tier):** Even more extreme, drops PLUTO below 3%.
3. **Use +2/+3 (chosen):** Gentlest weighting that still suppresses abstract planets.

## Justified rationale

The goal was to make abstract planets (NEPTUNE/PLUTO) less likely to appear as priority, not eliminate them entirely. The 2/3 ratio keeps the natural variance of per-player tallies while gently biasing away from the hard-to-target planets.

---

# Tutorial phase + 90s cooldown + seed drip-feed

## What changed

**Files:** `backend/db/migrations/011_tutorial_phase.sql` (new), `backend/src/game/types.ts`, `backend/src/game/gameLoop.ts`, `backend/src/socket/lobbyHandlers.ts`, `frontend/src/components/GameStatus.tsx`, `frontend/src/components/GameLayout.tsx`, plus test updates

Added a new `TUTORIAL` phase between `WAITING` and `PLAYING` and increased the headline cooldown from 60s to 90s.

New game flow:
```
WAITING → TUTORIAL (3 min) → PLAYING → BREAK → ... → FINISHED
```

During the TUTORIAL phase:
- Headline input is disabled (players can only read)
- Archive/seed headlines drip-feed into the timeline one at a time over ~3 minutes (~5 seconds per headline)
- The host has time to explain the game rules
- Yellow "Tutorial" phase badge in the HUD
- Tutorial message in the centre column: "Watch the timeline build up — submissions open soon..."

Technical changes:
- `GamePhase` type extended with `'TUTORIAL'`
- New `TUTORIAL_DURATION_MS` constant (3 min)
- `GameLoopInstance` gained `seedDripHandle` and `archivePlayerId` fields
- `startGame()` now transitions to TUTORIAL round 0 instead of PLAYING round 1
- `computeNextPhase()` handles TUTORIAL → PLAYING round 1
- New `startSeedDrip()` private method inserts seeds one by one and broadcasts `headline:new`
- Seed insertion moved from synchronous loop at game start to async drip during TUTORIAL
- `lobby:start_game` handler now passes `archivePlayerId` to the game loop manager
- Cooldown constant `HEADLINE_COOLDOWN_MS` raised from 60_000 to 90_000
- Migration 011 adds 'TUTORIAL' to the `session_status` enum

## Trade-offs considered

1. **No tutorial phase, just use round 1 as warmup:** Players start scoring immediately, no grace period for rules explanation. Rejected.
2. **Insert all seeds at once during tutorial:** Simpler but boring — the timeline appears instantly. Rejected.
3. **Drip seeds during tutorial (chosen):** Creates anticipation and visible activity during the rules explanation.
4. **Keep 60s cooldown:** Playtest data showed median submission gap of 79s — players were spamming as fast as allowed. 90s gives more reading time without feeling punishing.

## Justified rationale

Playtest 1 showed 50.8% of submissions happened within 70-79s of the previous one and first-round submissions were rushed (no time to read). The tutorial phase gives players time to absorb the rules and see the timeline build up, and the longer cooldown encourages actual reading of other players' headlines during play.

---

# Game end page with full-game recap

## What changed

**Files:** `backend/src/game/gameLoop.ts`, `frontend/src/components/GameEnd.tsx` (new), `frontend/src/components/GameLayout.tsx`, `frontend/src/hooks/useSocket.ts`, `frontend/src/App.tsx`

Replaced the plain lobby-style FINISHED screen with a dedicated end-of-game page that shows:
- Final leaderboard (reuses `ScoreBarChart`)
- Game statistics: total headlines, top scorer, most prolific player, avg plausibility score, most common planet, player count
- Full-game historical recap summary covering all 4 rounds

Implementation:
- `gameLoop.ts` now triggers `generateAndBroadcastSummary(maxRounds, 1)` on the PLAYING→FINISHED transition. This runs async so the FINISHED phase begins immediately and the end page shows a loading state while the ~20-second summary generation completes.
- The generated summary is stored in `round_summaries` with `round_no = maxRounds` (no conflict since there's no break after the last round in the new format).
- `useSocket.ts` now preserves the round summary across phase transitions except PLAYING/TUTORIAL/WAITING (previously cleared on any non-BREAK transition).
- `App.tsx` requests the summary on entering FINISHED (for reconnection recovery) and loads all headlines so the statistics panel has complete data.
- `GameEnd.tsx` is a new component showing the leaderboard, stats, and summary with a loading state while the recap is being generated.

## Trade-offs considered

1. **Synchronous summary before transitioning to FINISHED:** Cleaner code — end page loads fully populated. Rejected because players wait ~20 seconds staring at the PLAYING phase without knowing the game is over.
2. **Separate `game:finished` event with its own payload:** More explicit but duplicates the existing `round:summary` infrastructure. Rejected — reusing the existing summary flow is simpler and the UI distinguishes "final" from "break" via the phase context.
3. **Dedicated `final_summaries` table:** More correct modeling but requires schema change. Rejected — storing in `round_summaries` with `round_no = maxRounds` works without migration.

## Justified rationale

The game previously ended abruptly with no recap of what the players had built. The end page gives closure — showing the story they told, the ranking they earned, and statistics that reward engagement. Using the existing summary infrastructure means no new LLM prompt, no new DB table, and no new socket events. The async generation keeps the UX snappy.

---

# New round format: 4 rounds, 8 min each, selective summaries

## What changed

**Files:** `backend/src/game/gameLoop.ts`, `backend/src/game/summaryService.ts`, `backend/src/llm/summaryPrompt.ts`, `backend/src/llm/summaryTypes.ts`, `backend/db/migrations/012_round_format.sql`, `backend/tests/game/gameLoop.test.ts`

The game is now 4 rounds of 8 minutes each, with variable break durations and only one mid-game summary:

```
Round 1 (8 min) → Break 1 (3 min, no summary)
Round 2 (8 min) → Break 2 (5 min, summary covering rounds 1-2)
Round 3 (8 min) → Break 3 (3 min, no summary)
Round 4 (8 min) → FINISHED
```

Implementation:
- New `BREAK_SCHEDULE` constant in `gameLoop.ts` controls per-break duration and whether a summary is generated. The existing `break_minutes` column is no longer used by the new logic but kept for backwards compatibility.
- `ROUND_SPEED_WEIGHTS` changed from `[3, 5, 7]` to `[2, 4, 6, 8]` — 4 rounds summing to weight 20, rounds still accelerate.
- `generateRoundSummary` now accepts `fromRound` and `toRound` instead of a single `roundNo`. The break 2 summary is generated with `fromRound=1, toRound=2` so it covers both rounds.
- `buildSummaryPrompt` updated to describe a period (e.g. "Rounds 1-2 of 4") instead of a single round.
- Migration `012_round_format.sql` sets default `play_minutes=8`, `max_rounds=4` for new sessions. Existing sessions keep their stored values.

## Trade-offs considered

1. **Schema change (add `from_round` column to round_summaries):** More correct but requires a migration. Rejected — the single `round_no` field storing `toRound` is sufficient since summaries are keyed by the break they appear in.
2. **Keep 3 rounds but add intro/outro breaks:** Simpler code change but doesn't give enough game time for 11 players. Rejected.
3. **Chosen: 4 rounds with BREAK_SCHEDULE:** Each break has its own config, selective summary generation is trivial, the structure matches playtest feedback (need more reading time, one mid-game recap is enough).

## Justified rationale

The previous 3-round 15-minute format was too long per round (players spammed headlines) and had three mid-game summaries, which felt repetitive. The new format gives shorter, more focused rounds, a single well-earned mid-game recap, and leaves the final moment for an end-of-game page (added in a separate commit). The [2,4,6,8] weights preserve the narrative acceleration effect across 4 rounds.

---

# Weighted planet tallies + 5-word frontend tags

## What changed

**Files:** `backend/src/game/planetWeighting.ts`, `frontend/src/components/PriorityPlanet.tsx`, `backend/tests/game/planetWeighting.test.ts`

1. **Weighted tally increments:** NEPTUNE and PLUTO now increment their tally by +2 (instead of +1) each time the AI assigns them in a headline's top-3. All other planets remain at +1. This makes abstract planets accumulate tally faster → they rise out of the bottom half of the sorted tally → they get selected as priority less often. Simulated effect: NEPTUNE drops from 14.8% → 8.1% as priority; concrete planets (EARTH, MARS, VENUS) fill the gap.

2. **Frontend planet tags expanded from 3 to 5 words:** Gives players more keywords to work with when targeting their priority planet. Also fixed "+3 bonus" label to "+2 bonus" to match the scoring rebalance.

## Trade-offs considered

1. **Global tally (shared across all players):** Would produce a deterministic distribution where the same 5 planets are always priority for everyone. Rejected because 220 headlines wash out all variance — different players would never get different priorities.

2. **Three-tier weights (+1/+2/+3):** More aggressive suppression of abstract planets. PLUTO/NEPTUNE would drop below 3%. Rejected as too extreme — they should still occasionally appear.

3. **Two-tier weights +1/+2 (chosen):** Gentle suppression. NEPTUNE/PLUTO are the only planets weighted at +2 because they are the hardest to intentionally target ("dreams, spirituality" and "hidden forces, transformation"). All other planets including moderately abstract ones (SATURN, URANUS) stay at +1 since the AI's natural frequency already differentiates them.

## Justified rationale

The per-player tally system with ~20 headlines per player has enough variance that the weighted tallies create a gentle bias without being deterministic. The +2 weight for NEPTUNE/PLUTO is the minimum change that produces a meaningful shift in the priority distribution while keeping all planets possible.

---

# Scoring rebalance v2: baseline, connection, planet (post-playtest 1)

## What changed

**Files:** `backend/src/game/scoringTypes.ts`, `backend/src/game/scoring.ts`, `backend/src/socket/lobbyHandlers.ts`, `backend/src/game/scoringService.ts`, plus all related test files.

Four scoring changes based on playtest 1 data (session UD0T2Q, 11 players, 218 headlines):

| Component | Old | New | Reason |
|---|---|---|---|
| Baseline | 5 | **1** | Was 45.4% of all points — volume beat quality |
| Self-connection | 1 | **removed** | Scored 0 total across all 218 headlines — dead mechanic |
| Other-connection | flat 3 | **1/4/9** by unique STRONG-linked other authors (0→0, 1→1, 2→4, 3→9) | 84.9% of headlines got the same 3 pts regardless of author diversity |
| Planet bonus | 3 | **2** | 75.7% hit rate was too generous |

The connection system was also restructured: `deriveConnectionScore()` (which returned a categorical `'OTHERS'|'SELF'|'NONE'`) was replaced by `deriveUniqueOtherAuthorCount()`, which counts distinct other player IDs from STRONG linked headlines and returns a number 0-3. The `ConnectionPointsConfig` interface changed from `{ others, self, none }` to `{ scale: [0, 1, 4, 9] }`.

## Trade-offs considered

1. **Count unique authors from all links (STRONG + WEAK):** Would give 40.8% of headlines the 9-point tier. Rejected because WEAK connections are too loose — rewarding them equally dilutes the quality signal.

2. **Count unique authors from STRONG links only (chosen):** With current AI output, only 3.2% of headlines get 3 unique STRONG-linked other authors; 35.3% get 2. This creates a meaningful skill gradient where connecting strongly to diverse players is rare and highly rewarded.

3. **Keep the categorical enum and add a count alongside:** More backwards-compatible but introduces redundancy. The old `SELF` category is removed and `OTHERS` is split into 3 tiers, so the enum no longer maps to the new semantics.

## Justified rationale

Option 2 uses the n-squared scaling (1/4/9) to make author diversity the dominant skill signal. Combined with baseline 5→1, the ratio of skill-based to guaranteed points shifts from 55:45 to approximately 93:7 at the max. The DB column `others_story_connection_level` now stores the unique author count as a string ("0"/"1"/"2"/"3") instead of the old category; existing rows with old string values are unaffected since scores are already computed and stored in `others_story_score`.

---

# Fix: Priority planet only rotates on a hit

## What changed

**File:** `backend/src/game/planetWeighting.ts` (`applyPlanetScoringAndUsage`, step 3)

Previously the priority planet was replaced with a newly selected planet after **every** headline submission, regardless of whether the player's current priority planet appeared in the AI's top-3 rankings. Now the planet only rotates when `matchRank !== null` (i.e. the planet was "hit"). On a miss the current priority and `previousPriority` are both preserved unchanged, giving the player another chance to target the same planet on their next submission.

## Trade-offs considered

1. **Always rotate (previous behaviour):** Simple and predictable, but penalises players who chose well — they lose their planet even when the AI didn't reward it, reducing the strategic value of the feature.
2. **Rotate only on hit (chosen):** Keeps the planet until the player actually achieves the bonus, making the system feel fair and rewarding skill. Slightly more complex (two code paths) but the logic is trivial and fully covered by existing tests.
3. **Reset to a fixed planet on miss:** Would be deterministic but arbitrary, and interferes with the tally-based exclusion logic.

## Justified rationale

Option 2 aligns with the game-design intent of the priority planet system: it is a target the player earns by crafting a matching headline, not an arbitrary timer. Keeping the planet stable on a miss preserves the `previousPriority` exclusion invariant and requires no changes outside `planetWeighting.ts`. All 223 existing tests continue to pass.

---

# Pre-fill game with 36 seed headlines from AI history (2022–2025)

## What changed

**Files:** `backend/db/migrations/010_system_player.sql`, `backend/src/game/seedHeadlines.ts`, `backend/src/socket/lobbyHandlers.ts`, `backend/src/game/scoringService.ts`, `frontend/src/components/HeadlineFeed.tsx`, `backend/tests/socket/lobbyHandlers.test.ts`

When a host starts a game, 36 real-world AI news headlines (2022–2025) are now pre-inserted into the session's headline feed. They are attributed to a dedicated "Archive" system player (identified by `is_system = TRUE` on `session_players`). Seeds use `llm_status = 'seed'`, are assigned `round_no = 1`, and have pre-set `in_game_submitted_at` timestamps so they sort chronologically before player submissions. The Archive player and its headlines are filtered out of the player list, leaderboard, and score breakdowns.

## Trade-offs considered

1. **Seed headlines via a separate `seed_headlines` table (not linked to a player):** Cleaner schema separation, but would require schema changes to `game_session_headlines` (nullable `player_id`) and new JOIN logic across multiple query sites. FK constraint removal would make data integrity harder to reason about.

2. **Seed headlines attributed to the host player:** Simpler (no new player row needed), but seeds would show up in the host's score, pollute the leaderboard, and require additional filtering by a `is_seed` flag on every query. Also misleading to the host.

3. **Chosen: dedicated Archive system player (`is_system = TRUE`):** Reuses all existing headline infrastructure unchanged. A single boolean column gates the Archive player out of all player-facing queries. Seeds behave exactly like other headlines for LLM context and round summaries, requiring no special-case handling in those paths.

## Justified rationale

The Archive player approach minimises code surface area while satisfying all constraints: seeds flow through the existing `headline:get_feed` query, appear in LLM context via the no-filter `WHERE session_id = $1` clause, and are visible in round summaries. The `is_system` filter is a one-line addition at each player-facing query site, and the migration is a single `ALTER TABLE` that defaults to `FALSE` — preserving all existing rows and test mocks without modification.

---

# Fix headline in-game date (store at submit time)

## What changed

**Files:** `backend/db/migrations/009_headline_ingame_time.sql`, `backend/src/socket/lobbyHandlers.ts`, `frontend/src/hooks/useSocket.ts`, `frontend/src/components/HeadlineFeed.tsx`, `frontend/src/components/GameLayout.tsx`

- Added nullable `in_game_submitted_at TIMESTAMPTZ` column to `game_session_headlines`.
- `headline:submit` handler now stores `sessionState.inGameNow` (computed at insert time) as `in_game_submitted_at` and returns it in the RETURNING clause and broadcast event.
- `headline:get_feed` SELECT now includes `in_game_submitted_at` so historical headlines carry the field.
- `HeadlineFeed` component removed `getHeadlineInGameDate` back-calculation (which produced wrong years after round boundaries due to ratio changes) and reads `headline.inGameSubmittedAt` directly.
- `GameLayout` no longer passes `inGameNow`, `serverNow`, `timelineSpeedRatio` to `HeadlineFeed` as those props are gone.

## Trade-offs considered

1. **Keep back-calculation, fix the ratio used** — pass each headline's round number and look up the ratio for that round. Avoids a DB migration. Rejected because ratio data is not stored per-round in the DB; reconstructing the correct ratio for a historical headline is fragile and would require more schema changes anyway.

2. **Store `in_game_submitted_at` at insert time (chosen)** — a single nullable column added; `getSessionState` already computes `inGameNow` correctly before the INSERT, so the value is reliable. Frontend becomes a simple date formatter. Requires a migration but the column is nullable so existing rows are unaffected.

## Justified rationale

Storing the in-game timestamp at write time is the only approach that survives round-boundary ratio changes. It is simple, self-contained, and consistent with how other temporal data (e.g. `phase_started_at`) is handled in this schema.

---

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
