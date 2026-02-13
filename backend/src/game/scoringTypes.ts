/**
 * Scoring system types and configuration for the Future Headlines game.
 * This module defines all types and default configuration for headline scoring.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Plausibility level assessed by AI (1-5 scale).
 * Level 3 is the "sweet spot" for maximum points.
 */
export type PlausibilityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Story connection level (how well a headline connects to previous headlines).
 * @deprecated Use ConnectionScoreType instead for the new simplified scoring model.
 */
export type StoryConnectionLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Connection score type for the simplified mutually exclusive scoring model.
 * - OTHERS: Headline connects to another player's headline (+3 pts)
 * - SELF: Headline connects only to own previous headlines (+1 pt)
 * - NONE: No strong connections found (0 pts)
 */
export type ConnectionScoreType = 'OTHERS' | 'SELF' | 'NONE';

/**
 * Planet identifier - string type for flexibility.
 */
export type PlanetId = string;

/**
 * Default list of planets in the game.
 * Can be extended or customized per game session.
 */
export const DEFAULT_PLANETS: PlanetId[] = [
  'MERCURY',
  'VENUS',
  'EARTH',
  'MARS',
  'JUPITER',
  'SATURN',
  'URANUS',
  'NEPTUNE',
];

// ============================================================================
// Scoring Configuration
// ============================================================================

/**
 * Configuration for plausibility scoring.
 */
export interface PlausibilityConfig {
  /** Points for hitting the exact target level (e.g., level 3) */
  exactTarget: number;
  /** Points for near-target levels (e.g., levels 2 and 4) */
  nearTarget: number;
  /** Points for other levels (1 and 5) */
  other: number;
  /** The target level that yields maximum points */
  targetLevel: PlausibilityLevel;
  /** Levels considered "near" the target */
  nearLevels: PlausibilityLevel[];
}

/**
 * Configuration for story connection scoring.
 * @deprecated Use ConnectionPointsConfig instead for the new simplified scoring model.
 */
export interface StoryConnectionConfig {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
}

/**
 * Configuration for connection scoring (simplified model).
 * Mutually exclusive: only one of these can apply per headline.
 */
export interface ConnectionPointsConfig {
  /** Points when connected to another player's headline */
  others: number;
  /** Points when connected only to own headlines */
  self: number;
  /** Points when no strong connections (always 0) */
  none: number;
}

/**
 * Configuration for planet bonus scoring.
 * @deprecated Use PlanetBonusConfigV2 for the new tally-based system.
 */
export interface PlanetBonusConfig {
  /** Points when preferred planet is #1 in AI ranking */
  P1: number;
  /** Points when preferred planet is #2 in AI ranking */
  P2: number;
  /** Points when preferred planet is #3 in AI ranking */
  P3: number;
}

/**
 * Configuration for planet bonus scoring (simplified tally-based system).
 * Flat bonus when priority planet appears anywhere in AI's top-3.
 */
export interface PlanetBonusConfigV2 {
  /** Points when priority planet matches anywhere in AI's top-3 */
  match: number;
}

// ============================================================================
// Planet Tally State Types
// ============================================================================

/**
 * Frequency-based tally state for planet priority selection.
 * Tracks how often each planet appears in a player's headline evaluations.
 */
export interface PlanetTallyState {
  /** Count of appearances in AI's top-3 for each planet */
  tally: Record<PlanetId, number>;
  /** Last priority planet (excluded from next selection) */
  previousPriority: PlanetId | null;
  /** Current priority planet for scoring */
  currentPriority: PlanetId | null;
}

/**
 * Legacy LRU-based planet usage state.
 * @deprecated Use PlanetTallyState instead.
 */
export interface LegacyPlanetUsageEntry {
  /** Round number when this planet was last used, or null if never used */
  lastUsedRound: number | null;
}

/**
 * Legacy per-player state tracking usage of all planets.
 * @deprecated Use PlanetTallyState instead.
 */
export type LegacyPlanetUsageState = Record<PlanetId, LegacyPlanetUsageEntry>;

/**
 * Complete scoring configuration.
 */
export interface ScoringConfig {
  /** Baseline points for submitting any headline (B) */
  baselineB: number;
  /** Plausibility scoring configuration */
  plausibilityPoints: PlausibilityConfig;
  /** @deprecated Use connectionPoints instead */
  selfStoryPoints: StoryConnectionConfig;
  /** @deprecated Use connectionPoints instead */
  othersStoryPoints: StoryConnectionConfig;
  /** Connection scoring (simplified model) */
  connectionPoints: ConnectionPointsConfig;
  /** @deprecated Use planetBonus instead (kept for backwards compatibility) */
  planetBonusPoints: PlanetBonusConfig;
  /** Planet bonus configuration (flat bonus for tally-based system) */
  planetBonus: PlanetBonusConfigV2;
  /** @deprecated No longer used in tally-based system */
  updatePlanetUsageOnNoMatch: boolean;
}

/**
 * Default scoring configuration.
 * These values can be adjusted for game balance.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  // Base score for submitting a headline
  baselineB: 10,

  // Plausibility scoring (A1 = exact target, A2 = near target)
  plausibilityPoints: {
    exactTarget: 2, // A1: level 3 (sweet spot)
    nearTarget: 1, // A2: levels 2 or 4
    other: 0, // Levels 1 or 5 (too implausible or too obvious)
    targetLevel: 3,
    nearLevels: [2, 4],
  },

  // Self story connection (X_L/M/H)
  selfStoryPoints: {
    LOW: 5,
    MEDIUM: 10,
    HIGH: 15,
  },

  // Others story connection (Y_L/M/H) - deprecated
  othersStoryPoints: {
    LOW: 3,
    MEDIUM: 8,
    HIGH: 12,
  },

  // Connection scoring (simplified model)
  connectionPoints: {
    others: 3, // Connected to another player's headline
    self: 1,   // Connected only to own headlines
    none: 0,   // No strong connections
  },

  // Planet bonus (P1/P2/P3) - deprecated, kept for backwards compatibility
  planetBonusPoints: {
    P1: 15, // Preferred planet is #1 in AI ranking
    P2: 10, // Preferred planet is #2 in AI ranking
    P3: 5, // Preferred planet is #3 in AI ranking
  },

  // Planet bonus (tally-based system) - flat bonus when priority matches
  planetBonus: {
    match: 3, // Flat +3 when priority planet is anywhere in AI's top-3
  },

  // @deprecated - No longer used in tally-based system
  updatePlanetUsageOnNoMatch: true,
};

// ============================================================================
// Input/Output Types for Scoring
// ============================================================================

/**
 * Input from AI/LLM evaluation for a single headline.
 * This is the data structure the AI will provide.
 */
export interface HeadlineScoringInput {
  /** AI-assessed plausibility level (1-5) - stored for reference */
  plausibilityLevel: PlausibilityLevel;
  /** Selected band from dice roll (1-5) - used for scoring */
  selectedBand: PlausibilityLevel;
  /** Connection type for simplified scoring (OTHERS/SELF/NONE) */
  connectionType: ConnectionScoreType;
  /** @deprecated Use connectionType instead */
  selfStoryConnection?: StoryConnectionLevel;
  /** @deprecated Use connectionType instead */
  othersStoryConnection?: StoryConnectionLevel;
  /** AI's top-3 planet classifications for this headline */
  aiPlanetRankings: PlanetId[];
  /** The round number when this headline was submitted */
  roundNo: number;
}

/**
 * Breakdown of scores for a single headline.
 */
export interface HeadlineScoreBreakdown {
  /** Baseline points (B) */
  baseline: number;
  /** Plausibility points (A1/A2/other) */
  plausibility: number;
  /** Connection score (0/1/3 based on NONE/SELF/OTHERS) */
  connectionScore: number;
  /** @deprecated Kept for backwards compatibility, always 0 */
  selfStory: number;
  /** @deprecated Kept for backwards compatibility, always 0 */
  othersStory: number;
  /** Planet bonus points (P1/P2/P3) */
  planetBonus: number;
  /** Total headline score */
  total: number;
}

/**
 * Player entry in the leaderboard.
 */
export interface PlayerScoreEntry {
  playerId: string;
  nickname: string;
  totalScore: number;
  rank: number;
}

/**
 * Full payload for headline evaluation from LLM/heuristic.
 */
export interface HeadlineEvaluationPayload extends HeadlineScoringInput {
  sessionId: string;
  playerId: string;
  headlineId: string;
}

/**
 * Result of applying a headline evaluation.
 */
export interface HeadlineEvaluationResult {
  breakdown: HeadlineScoreBreakdown;
  newTotalScore: number;
  leaderboard: PlayerScoreEntry[];
}


