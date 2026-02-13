/**
 * Scoring service for headline evaluation.
 * This module handles database operations for scoring and provides
 * the main API for LLM/heuristic integration.
 */

import pool from '../db/pool.js';
import {
  HeadlineEvaluationPayload,
  HeadlineEvaluationResult,
  HeadlineScoreBreakdown,
  PlayerScoreEntry,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_PLANETS,
} from './scoringTypes.js';
import {
  PlanetTallyState,
  applyPlanetScoringAndUsage,
  migratePlanetState,
} from './planetWeighting.js';
import { computeHeadlineScore } from './scoring.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw player row from database.
 * Note: planet_usage_state can be in legacy LRU format or new tally format.
 */
interface PlayerRow {
  id: string;
  session_id: string;
  nickname: string;
  total_score: number;
  planet_usage_state: unknown;  // Can be legacy or new format, use migratePlanetState
}

/**
 * Raw headline row from database.
 */
interface HeadlineRow {
  id: string;
  session_id: string;
  player_id: string;
  round_no: number;
  total_headline_score: number | null;
}

// ============================================================================
// Error Classes
// ============================================================================

export class ScoringError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ScoringError';
  }
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Apply an AI/LLM headline evaluation and update scores.
 * 
 * This function:
 * 1. Validates the headline exists and belongs to the player/session
 * 2. Loads the player's current score and planet usage state
 * 3. Computes the complete score breakdown (including planet bonus)
 * 4. Updates the headline with scoring details
 * 5. Updates the player's total score and planet usage state
 * 6. Returns the breakdown, new total, and full leaderboard
 * 
 * @param payload - Evaluation payload from AI/LLM
 * @param config - Scoring configuration (defaults to DEFAULT_SCORING_CONFIG)
 * @returns Score breakdown, new total, and leaderboard
 */
export async function applyHeadlineEvaluation(
  payload: HeadlineEvaluationPayload,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<HeadlineEvaluationResult> {
  const {
    sessionId,
    playerId,
    headlineId,
    plausibilityLevel,
    selectedBand,
    connectionType,
    aiPlanetRankings,
    roundNo,
  } = payload;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Load and validate player
    const playerResult = await client.query<PlayerRow>(
      `SELECT id, session_id, nickname, total_score, planet_usage_state
       FROM session_players
       WHERE id = $1 AND session_id = $2`,
      [playerId, sessionId]
    );

    if (playerResult.rows.length === 0) {
      throw new ScoringError(
        `Player ${playerId} not found in session ${sessionId}`,
        'PLAYER_NOT_FOUND'
      );
    }

    const player = playerResult.rows[0];

    // Step 2: Load and validate headline
    const headlineResult = await client.query<HeadlineRow>(
      `SELECT id, session_id, player_id, round_no, total_headline_score
       FROM game_session_headlines
       WHERE id = $1`,
      [headlineId]
    );

    if (headlineResult.rows.length === 0) {
      throw new ScoringError(
        `Headline ${headlineId} not found`,
        'HEADLINE_NOT_FOUND'
      );
    }

    const headline = headlineResult.rows[0];

    // Validate headline belongs to the correct session and player
    if (headline.session_id !== sessionId) {
      throw new ScoringError(
        `Headline ${headlineId} does not belong to session ${sessionId}`,
        'HEADLINE_SESSION_MISMATCH'
      );
    }

    if (headline.player_id !== playerId) {
      throw new ScoringError(
        `Headline ${headlineId} does not belong to player ${playerId}`,
        'HEADLINE_PLAYER_MISMATCH'
      );
    }

    // Check if headline was already scored
    if (headline.total_headline_score !== null) {
      throw new ScoringError(
        `Headline ${headlineId} has already been scored`,
        'HEADLINE_ALREADY_SCORED'
      );
    }

    // Step 3: Migrate and initialize planet state (handles legacy LRU and new tally formats)
    const planetState: PlanetTallyState = migratePlanetState(
      player.planet_usage_state,
      DEFAULT_PLANETS
    );

    // Step 4: Calculate planet scoring and update state
    const planetResult = applyPlanetScoringAndUsage(
      planetState,
      aiPlanetRankings,
      roundNo,
      config
    );

    // Step 5: Calculate complete headline score
    // Note: selectedBand (dice roll result) is used for plausibility scoring
    const breakdown: HeadlineScoreBreakdown = computeHeadlineScore(
      {
        plausibilityLevel,
        selectedBand,
        connectionType,
        aiPlanetRankings,
        roundNo,
      },
      planetResult.bonus,
      config
    );

    // Step 6: Update headline with scoring breakdown
    // Note: Using others_story_connection_level to store connectionType
    // and others_story_score to store connectionScore for backwards compatibility
    const [planet1, planet2, planet3] = aiPlanetRankings.slice(0, 3);

    await client.query(
      `UPDATE game_session_headlines
       SET baseline_score = $1,
           plausibility_level = $2,
           selected_band = $3,
           plausibility_score = $4,
           self_story_connection_level = NULL,
           self_story_score = 0,
           others_story_connection_level = $5,
           others_story_score = $6,
           planet_1 = $7,
           planet_2 = $8,
           planet_3 = $9,
           planet_bonus_score = $10,
           total_headline_score = $11,
           llm_status = 'evaluated'
       WHERE id = $12`,
      [
        breakdown.baseline,
        plausibilityLevel,
        selectedBand,
        breakdown.plausibility,
        connectionType,
        breakdown.connectionScore,
        planet1 ?? null,
        planet2 ?? null,
        planet3 ?? null,
        breakdown.planetBonus,
        breakdown.total,
        headlineId,
      ]
    );

    // Step 7: Update player's total score and planet usage state
    const newTotalScore = player.total_score + breakdown.total;

    await client.query(
      `UPDATE session_players
       SET total_score = $1,
           planet_usage_state = $2
       WHERE id = $3`,
      [newTotalScore, JSON.stringify(planetResult.updatedState), playerId]
    );

    // Step 8: Get updated leaderboard
    const leaderboardResult = await client.query<{
      id: string;
      nickname: string;
      total_score: number;
    }>(
      `SELECT id, nickname, total_score
       FROM session_players
       WHERE session_id = $1
       ORDER BY total_score DESC, joined_at ASC`,
      [sessionId]
    );

    const leaderboard: PlayerScoreEntry[] = leaderboardResult.rows.map(
      (row, index) => ({
        playerId: row.id,
        nickname: row.nickname,
        totalScore: row.total_score,
        rank: index + 1,
      })
    );

    await client.query('COMMIT');

    return {
      breakdown,
      newTotalScore,
      leaderboard,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current leaderboard for a session.
 * 
 * @param sessionId - Session ID
 * @returns Array of player scores ordered by rank
 */
export async function getLeaderboard(
  sessionId: string
): Promise<PlayerScoreEntry[]> {
  const result = await pool.query<{
    id: string;
    nickname: string;
    total_score: number;
  }>(
    `SELECT id, nickname, total_score
     FROM session_players
     WHERE session_id = $1
     ORDER BY total_score DESC, joined_at ASC`,
    [sessionId]
  );

  return result.rows.map((row, index) => ({
    playerId: row.id,
    nickname: row.nickname,
    totalScore: row.total_score,
    rank: index + 1,
  }));
}

/**
 * Get scoring breakdown for a specific headline.
 *
 * @param headlineId - Headline ID
 * @returns Score breakdown or null if not scored yet
 */
export async function getHeadlineScoreBreakdown(
  headlineId: string
): Promise<HeadlineScoreBreakdown | null> {
  const result = await pool.query<{
    baseline_score: number | null;
    plausibility_score: number | null;
    self_story_score: number | null;
    others_story_score: number | null;
    planet_bonus_score: number | null;
    total_headline_score: number | null;
  }>(
    `SELECT baseline_score, plausibility_score, self_story_score,
            others_story_score, planet_bonus_score, total_headline_score
     FROM game_session_headlines
     WHERE id = $1`,
    [headlineId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // If not scored yet, return null
  if (row.total_headline_score === null) {
    return null;
  }

  // others_story_score now stores connectionScore in the new model
  return {
    baseline: row.baseline_score ?? 0,
    plausibility: row.plausibility_score ?? 0,
    connectionScore: row.others_story_score ?? 0,
    selfStory: 0, // Deprecated, always 0
    othersStory: 0, // Deprecated, always 0
    planetBonus: row.planet_bonus_score ?? 0,
    total: row.total_headline_score,
  };
}

/**
 * Get aggregated score breakdowns for all players in a session.
 * Sums each score component across all headlines per player.
 *
 * @param sessionId - Session ID
 * @returns Map of playerId to score breakdown
 */
export async function getPlayerScoreBreakdowns(
  sessionId: string
): Promise<Map<string, { baseline: number; plausibility: number; connection: number; planetBonus: number }>> {
  const result = await pool.query(
    `SELECT
      sp.id AS player_id,
      COALESCE(SUM(h.baseline_score), 0)::int AS baseline,
      COALESCE(SUM(h.plausibility_score), 0)::int AS plausibility,
      COALESCE(SUM(h.others_story_score), 0)::int AS connection,
      COALESCE(SUM(h.planet_bonus_score), 0)::int AS planet_bonus
    FROM session_players sp
    LEFT JOIN game_session_headlines h ON h.player_id = sp.id
    WHERE sp.session_id = $1
    GROUP BY sp.id`,
    [sessionId]
  );

  const map = new Map<string, { baseline: number; plausibility: number; connection: number; planetBonus: number }>();
  for (const row of result.rows) {
    map.set(row.player_id, {
      baseline: row.baseline,
      plausibility: row.plausibility,
      connection: row.connection,
      planetBonus: row.planet_bonus,
    });
  }
  return map;
}

/**
 * Get player's current planet state.
 * Handles migration from legacy LRU format to new tally format.
 *
 * @param playerId - Player ID
 * @returns Planet tally state (migrated if necessary)
 */
export async function getPlayerPlanetState(
  playerId: string
): Promise<PlanetTallyState> {
  const result = await pool.query<{ planet_usage_state: unknown }>(
    `SELECT planet_usage_state FROM session_players WHERE id = $1`,
    [playerId]
  );

  if (result.rows.length === 0) {
    return migratePlanetState(null, DEFAULT_PLANETS);
  }

  return migratePlanetState(result.rows[0].planet_usage_state, DEFAULT_PLANETS);
}


