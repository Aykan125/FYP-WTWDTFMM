/**
 * Planet weighting and frequency-based tally logic for the scoring system.
 * Implements per-player planet priority tracking with tally-based selection.
 *
 * The concept: each player has a "priority planet" selected from the planets
 * with the lowest appearance count (least frequently appearing in AI evaluations).
 * If the AI's classification includes the priority planet in the top-3,
 * the player gets a flat bonus.
 */

import {
  PlanetId,
  ScoringConfig,
  DEFAULT_PLANETS,
  PlanetTallyState,
  LegacyPlanetUsageState,
  LegacyPlanetUsageEntry,
} from './scoringTypes.js';

// ============================================================================
// Re-exports for backwards compatibility
// ============================================================================

export type { PlanetTallyState, LegacyPlanetUsageState };

// Legacy type alias for backwards compatibility
export type PlanetUsageState = PlanetTallyState;
export type PlanetUsageEntry = LegacyPlanetUsageEntry;

// ============================================================================
// Planet Tally State Management (Pure Functions)
// ============================================================================

/**
 * Create initial planet tally state with all planets at count 0.
 *
 * @param allPlanets - List of planet IDs to track
 * @returns Initial tally state with zero counts and null priorities
 */
export function initialPlanetTallyState(
  allPlanets: PlanetId[] = DEFAULT_PLANETS
): PlanetTallyState {
  const tally: Record<PlanetId, number> = {};
  for (const planet of allPlanets) {
    tally[planet] = 0;
  }
  return {
    tally,
    previousPriority: null,
    currentPriority: null,
  };
}

/**
 * Legacy function alias for backwards compatibility.
 * @deprecated Use initialPlanetTallyState instead.
 */
export function initialPlanetUsageState(
  allPlanets: PlanetId[] = DEFAULT_PLANETS
): PlanetTallyState {
  return initialPlanetTallyState(allPlanets);
}

/**
 * Check if a state object is in the legacy LRU format.
 *
 * @param state - State object to check
 * @returns True if the state is in legacy format
 */
export function isLegacyState(state: unknown): state is LegacyPlanetUsageState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // Legacy state has planet IDs as keys with { lastUsedRound } values
  // New state has { tally, previousPriority, currentPriority }
  const obj = state as Record<string, unknown>;

  // If it has 'tally' key, it's the new format
  if ('tally' in obj) {
    return false;
  }

  // Check if any value has lastUsedRound property (legacy format)
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (
      value &&
      typeof value === 'object' &&
      'lastUsedRound' in (value as object)
    ) {
      return true;
    }
  }

  // Empty object or unknown format - treat as needing initialization
  return Object.keys(obj).length > 0;
}

/**
 * Convert legacy LRU state to new tally state.
 * All planets start at count 0 in the new system.
 *
 * @param legacyState - Legacy LRU state
 * @param allPlanets - List of all planets to include
 * @returns New tally state
 */
export function convertLegacyToTallyState(
  legacyState: LegacyPlanetUsageState,
  allPlanets: PlanetId[] = DEFAULT_PLANETS
): PlanetTallyState {
  const tally: Record<PlanetId, number> = {};

  // Initialize all planets to 0
  for (const planet of allPlanets) {
    tally[planet] = 0;
  }

  // Also include any planets from the legacy state that might not be in allPlanets
  for (const planet of Object.keys(legacyState)) {
    if (!(planet in tally)) {
      tally[planet] = 0;
    }
  }

  return {
    tally,
    previousPriority: null,
    currentPriority: null,
  };
}

/**
 * Migrate state from any format to the new tally format.
 * Handles: null, empty, legacy LRU, or already-new format.
 *
 * @param rawState - Raw state from database
 * @param allPlanets - List of all planets to include
 * @returns Valid PlanetTallyState
 */
export function migratePlanetState(
  rawState: unknown,
  allPlanets: PlanetId[] = DEFAULT_PLANETS
): PlanetTallyState {
  // Null or undefined - create fresh state
  if (!rawState) {
    return initialPlanetTallyState(allPlanets);
  }

  // Empty object - create fresh state
  if (typeof rawState === 'object' && Object.keys(rawState as object).length === 0) {
    return initialPlanetTallyState(allPlanets);
  }

  // Check for legacy format
  if (isLegacyState(rawState)) {
    return convertLegacyToTallyState(rawState, allPlanets);
  }

  // Assume it's already in the new format
  const state = rawState as PlanetTallyState;

  // Ensure all expected planets are in the tally
  const tally = { ...state.tally };
  for (const planet of allPlanets) {
    if (!(planet in tally)) {
      tally[planet] = 0;
    }
  }

  return {
    tally,
    previousPriority: state.previousPriority ?? null,
    currentPriority: state.currentPriority ?? null,
  };
}

// ============================================================================
// Priority Planet Selection
// ============================================================================

/**
 * Select a new priority planet from the bottom half of tally counts.
 *
 * Algorithm:
 * 1. Sort planets by tally count (ascending)
 * 2. Take bottom half (rounded up, at least 1)
 * 3. Exclude the previous priority planet
 * 4. Random selection from remaining candidates
 *
 * @param state - Current planet tally state
 * @param allPlanets - List of all planet IDs
 * @returns Selected priority planet, or null if no planets available
 */
export function selectPriorityPlanet(
  state: PlanetTallyState,
  allPlanets: PlanetId[] = DEFAULT_PLANETS
): PlanetId | null {
  if (allPlanets.length === 0) {
    return null;
  }

  // Sort planets by tally count (ascending)
  const sorted = [...allPlanets].sort(
    (a, b) => (state.tally[a] ?? 0) - (state.tally[b] ?? 0)
  );

  // Take bottom half (rounded up, at least 1)
  const bottomHalfCount = Math.max(1, Math.ceil(sorted.length / 2));
  const bottomHalf = sorted.slice(0, bottomHalfCount);

  // Exclude previous priority
  let candidates = bottomHalf.filter((p) => p !== state.previousPriority);

  // If no candidates after exclusion (edge case), use full bottom half
  if (candidates.length === 0) {
    candidates = [...bottomHalf];
  }

  // Random selection
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

/**
 * Legacy function alias for backwards compatibility.
 * Returns the current priority planet from state.
 * @deprecated Use state.currentPriority directly or selectPriorityPlanet.
 */
export function getPreferredPlanet(state: PlanetTallyState): PlanetId | null {
  return state.currentPriority;
}

// ============================================================================
// Tally Update Logic
// ============================================================================

/**
 * Increment tally counts for all planets in the AI's top-3 rankings.
 *
 * @param state - Current planet tally state
 * @param aiTop3 - AI's top-3 planet classifications
 * @returns New state with updated tally counts
 */
export function updatePlanetTally(
  state: PlanetTallyState,
  aiTop3: PlanetId[]
): PlanetTallyState {
  const newTally = { ...state.tally };

  for (const planet of aiTop3.slice(0, 3)) {
    newTally[planet] = (newTally[planet] ?? 0) + 1;
  }

  return {
    ...state,
    tally: newTally,
  };
}

/**
 * Legacy function - no longer needed in tally system.
 * @deprecated Use updatePlanetTally instead.
 */
export function applyPlanetUsage(
  state: PlanetTallyState,
  _used: PlanetId,
  _roundNo: number
): PlanetTallyState {
  // No-op in new system - tally updates happen via updatePlanetTally
  return state;
}

// ============================================================================
// Planet Bonus Calculation
// ============================================================================

/**
 * Result of planet bonus calculation.
 */
export interface PlanetBonusResult {
  /** Bonus points awarded */
  bonus: number;
  /** Position of priority planet in AI rankings (1, 2, 3) or null if not in top 3 */
  matchRank: 1 | 2 | 3 | null;
}

/**
 * Calculate planet bonus based on whether the player's priority planet
 * appears anywhere in the AI's top-3 classification for the headline.
 *
 * In the new tally system, this is a flat bonus when priority matches.
 *
 * @param priority - Player's current priority planet
 * @param aiRankings - AI's top-3 planet classifications for the headline
 * @param config - Scoring configuration
 * @returns Bonus points and match rank
 */
export function computePlanetBonus(
  priority: PlanetId | null,
  aiRankings: PlanetId[],
  config: ScoringConfig
): PlanetBonusResult {
  // No priority planet means no bonus
  if (priority === null) {
    return { bonus: 0, matchRank: null };
  }

  // Check top 3 positions only
  const top3 = aiRankings.slice(0, 3);
  const index = top3.indexOf(priority);

  if (index === -1) {
    // Priority planet not in top 3
    return { bonus: 0, matchRank: null };
  }

  // Flat bonus for any match in top-3
  const matchRank = (index + 1) as 1 | 2 | 3;
  return {
    bonus: config.planetBonus.match,
    matchRank,
  };
}

/**
 * Legacy function - determine which planet to mark as "used".
 * @deprecated No longer needed in tally system.
 */
export function determineUsedPlanet(
  preferred: PlanetId | null,
  aiRankings: PlanetId[],
  matchRank: 1 | 2 | 3 | null,
  _updateOnNoMatch: boolean
): PlanetId | null {
  // In the new system, we don't need this logic
  // Just return the matched planet or AI's top pick for display purposes
  if (matchRank !== null && preferred !== null) {
    return preferred;
  }
  return aiRankings[0] ?? null;
}

// ============================================================================
// Combined Planet Scoring & State Update
// ============================================================================

/**
 * Result of combined planet scoring and state update.
 */
export interface PlanetScoringResult {
  /** Bonus points awarded */
  bonus: number;
  /** Updated planet tally state */
  updatedState: PlanetTallyState;
  /** Position of priority planet in AI rankings, or null */
  matchRank: 1 | 2 | 3 | null;
  /** The planet that was used for scoring (for debugging/display) */
  usedPlanet: PlanetId | null;
}

/**
 * Combined function that:
 * 1. Checks if current priority planet matches AI's top-3
 * 2. Calculates the planet bonus
 * 3. Updates tally counts for all AI top-3 planets
 * 4. Selects a new priority planet
 *
 * This is the main entry point for planet scoring logic.
 *
 * @param state - Current planet tally state
 * @param aiRankings - AI's top planet classifications for the headline
 * @param _roundNo - Current round number (unused in tally system)
 * @param config - Scoring configuration
 * @returns Planet bonus, updated state, and match info
 */
export function applyPlanetScoringAndUsage(
  state: PlanetTallyState,
  aiRankings: PlanetId[],
  _roundNo: number,
  config: ScoringConfig
): PlanetScoringResult {
  // If state has no current priority, select one first
  let currentState = state;
  if (currentState.currentPriority === null) {
    const initialPriority = selectPriorityPlanet(currentState);
    currentState = {
      ...currentState,
      currentPriority: initialPriority,
    };
  }

  // Step 1: Calculate bonus based on current priority
  const { bonus, matchRank } = computePlanetBonus(
    currentState.currentPriority,
    aiRankings,
    config
  );

  // Step 2: Update tally with AI's top-3 planets
  const tallyUpdatedState = updatePlanetTally(currentState, aiRankings);

  // Step 3: Select new priority planet (old priority becomes previousPriority)
  const newPriority = selectPriorityPlanet(tallyUpdatedState);

  const finalState: PlanetTallyState = {
    tally: tallyUpdatedState.tally,
    previousPriority: currentState.currentPriority,
    currentPriority: newPriority,
  };

  return {
    bonus,
    updatedState: finalState,
    matchRank,
    usedPlanet: currentState.currentPriority,
  };
}
