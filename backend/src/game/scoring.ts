/**
 * Pure scoring functions for headline evaluation.
 * These functions have no side effects and don't access the database.
 */

import {
  PlausibilityLevel,
  StoryConnectionLevel,
  ConnectionScoreType,
  ScoringConfig,
  HeadlineScoringInput,
  HeadlineScoreBreakdown,
  StoryConnectionConfig,
  ConnectionPointsConfig,
} from './scoringTypes.js';

// ============================================================================
// Individual Score Computations
// ============================================================================

/**
 * Compute baseline score (B) for submitting a headline.
 * Every headline gets this just for being submitted.
 * 
 * @param config - Scoring configuration
 * @returns Baseline score (B)
 */
export function computeBaselineScore(config: ScoringConfig): number {
  return config.baselineB;
}

/**
 * Compute plausibility score based on AI-assessed level.
 * 
 * Scoring logic:
 * - exactTarget (A1): level matches targetLevel (default: 3)
 * - nearTarget (A2): level is in nearLevels (default: 2 or 4)
 * - other: any other level (1 or 5)
 * 
 * The idea is that level 3 is the "sweet spot" - plausible but creative.
 * Levels 1 and 5 are either too implausible or too obvious.
 * 
 * @param level - AI-assessed plausibility level (1-5)
 * @param config - Scoring configuration
 * @returns Plausibility score (A1/A2/other)
 */
export function computePlausibilityScore(
  level: PlausibilityLevel,
  config: ScoringConfig
): number {
  const { plausibilityPoints } = config;

  // Check for exact target (A1)
  if (level === plausibilityPoints.targetLevel) {
    return plausibilityPoints.exactTarget;
  }

  // Check for near target (A2)
  if (plausibilityPoints.nearLevels.includes(level)) {
    return plausibilityPoints.nearTarget;
  }

  // Other levels
  return plausibilityPoints.other;
}

/**
 * Compute story connection score from a connection level.
 * Used for both self-story (X_L/M/H) and others-story (Y_L/M/H) connections.
 *
 * @deprecated Use computeConnectionScore instead for the simplified model.
 * @param level - Story connection level (LOW, MEDIUM, HIGH)
 * @param pointsTable - Table mapping levels to points
 * @returns Story connection score
 */
export function computeStoryConnectionScore(
  level: StoryConnectionLevel,
  pointsTable: StoryConnectionConfig
): number {
  return pointsTable[level];
}

/**
 * Compute connection score using the simplified mutually exclusive model.
 *
 * Scoring logic:
 * - OTHERS: Connected to another player's headline → max points (default: 3)
 * - SELF: Connected only to own headlines → partial points (default: 1)
 * - NONE: No strong connections → 0 points
 *
 * @param connectionType - The type of connection (OTHERS/SELF/NONE)
 * @param config - Scoring configuration
 * @returns Connection score (0, 1, or 3 by default)
 */
export function computeConnectionScore(
  connectionType: ConnectionScoreType,
  config: ScoringConfig
): number {
  const { connectionPoints } = config;
  return connectionPoints[connectionType.toLowerCase() as keyof ConnectionPointsConfig];
}

// ============================================================================
// Aggregate Score Computation
// ============================================================================

/**
 * Compute the complete score breakdown for a headline.
 * This is a pure function that takes all inputs and returns the breakdown.
 *
 * Note: The planet bonus is computed separately via planetWeighting.ts
 * and passed in here, because planet bonus depends on player-specific
 * LRU state which is handled elsewhere.
 *
 * IMPORTANT: Plausibility scoring uses the AI's plausibilityLevel assessment,
 * which reflects how plausible the player's story direction is. The dice roll
 * (selectedBand) only determines which headline variant is displayed, not scoring.
 *
 * Connection scoring uses the simplified mutually exclusive model:
 * - OTHERS: +3 pts (connected to another player's headline)
 * - SELF: +1 pt (connected only to own headlines)
 * - NONE: 0 pts (no strong connections)
 *
 * @param input - AI/heuristic evaluation input
 * @param planetBonus - Pre-computed planet bonus (from applyPlanetScoringAndUsage)
 * @param config - Scoring configuration
 * @returns Complete score breakdown with total
 */
export function computeHeadlineScore(
  input: HeadlineScoringInput,
  planetBonus: number,
  config: ScoringConfig
): HeadlineScoreBreakdown {
  const baseline = computeBaselineScore(config);

  // Use AI's plausibilityLevel assessment for scoring
  // Level 3 = best (A1), Level 2/4 = good (A2), Level 1/5 = 0 points
  const plausibility = computePlausibilityScore(
    input.plausibilityLevel,
    config
  );

  // Use new simplified connection scoring
  const connectionScore = computeConnectionScore(input.connectionType, config);

  const total = baseline + plausibility + connectionScore + planetBonus;

  return {
    baseline,
    plausibility,
    connectionScore,
    // Deprecated fields kept for backwards compatibility
    selfStory: 0,
    othersStory: 0,
    planetBonus,
    total,
  };
}

/**
 * Helper to get the label for a plausibility score (for display/debugging).
 * 
 * @param level - Plausibility level
 * @param config - Scoring configuration
 * @returns Label like "A1", "A2", or "other"
 */
export function getPlausibilityLabel(
  level: PlausibilityLevel,
  config: ScoringConfig
): string {
  if (level === config.plausibilityPoints.targetLevel) {
    return 'A1';
  }
  if (config.plausibilityPoints.nearLevels.includes(level)) {
    return 'A2';
  }
  return 'other';
}

/**
 * Helper to format story connection level as X_L/M/H or Y_L/M/H.
 * 
 * @param level - Story connection level
 * @param prefix - 'X' for self, 'Y' for others
 * @returns Label like "X_M" or "Y_H"
 */
export function getStoryConnectionLabel(
  level: StoryConnectionLevel,
  prefix: 'X' | 'Y'
): string {
  const suffix = level === 'LOW' ? 'L' : level === 'MEDIUM' ? 'M' : 'H';
  return `${prefix}_${suffix}`;
}


