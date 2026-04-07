/**
 * Dice roll module for headline band selection.
 * Handles random roll generation and mapping to plausibility bands.
 */

import { HeadlineBands, PlausibilityBand } from '../llm/jurorPrompt.js';

// ============================================================================
// Types
// ============================================================================

export interface DiceRollResult {
  /** Raw roll value 1-100 */
  roll: number;
  /** Mapped band 1-5 */
  band: PlausibilityBand;
}

// ============================================================================
// Band Boundaries
// ============================================================================

/**
 * Band boundaries for mapping roll to band.
 * Target distribution: 10% / 35% / 40% / 12% / 3%
 *
 * Roll range is 1-100 (100 values total) so each percent maps cleanly:
 * Band 1: 1-10   (10 values, 10%) - inevitable
 * Band 2: 11-45  (35 values, 35%) - probable
 * Band 3: 46-85  (40 values, 40%) - plausible
 * Band 4: 86-97  (12 values, 12%) - possible
 * Band 5: 98-100 (3 values,  3%)  - preposterous
 */
const BAND_BOUNDARIES: { min: number; max: number; band: PlausibilityBand }[] = [
  { min: 1, max: 10, band: 1 },
  { min: 11, max: 45, band: 2 },
  { min: 46, max: 85, band: 3 },
  { min: 86, max: 97, band: 4 },
  { min: 98, max: 100, band: 5 },
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Map a roll value (1-100) to a plausibility band (1-5).
 *
 * @param roll - Roll value between 1 and 100 inclusive
 * @returns The corresponding plausibility band 1-5
 * @throws Error if roll is outside valid range
 */
export function mapRollToBand(roll: number): PlausibilityBand {
  if (roll < 1 || roll > 100) {
    throw new Error(`Roll must be between 1 and 100, got ${roll}`);
  }

  for (const boundary of BAND_BOUNDARIES) {
    if (roll >= boundary.min && roll <= boundary.max) {
      return boundary.band;
    }
  }

  // Should never reach here if boundaries are correct
  throw new Error(`Failed to map roll ${roll} to band`);
}

/**
 * Generate a random dice roll and map it to a band.
 *
 * @returns DiceRollResult with raw roll (1-100) and mapped band (1-5)
 */
export function rollDice(): DiceRollResult {
  // Generate random integer 1-100 inclusive
  const roll = Math.floor(Math.random() * 100) + 1;
  const band = mapRollToBand(roll);

  return { roll, band };
}

/**
 * Select a headline from the bands based on the given band number.
 *
 * @param bands - The headline bands object with band1-band5
 * @param band - The band number to select (1-5)
 * @returns The headline text for the selected band
 */
export function selectHeadline(bands: HeadlineBands, band: PlausibilityBand): string {
  const bandKey = `band${band}` as keyof HeadlineBands;
  return bands[bandKey];
}

/**
 * Perform a complete dice roll and headline selection.
 *
 * @param bands - The headline bands from LLM evaluation
 * @returns Object with roll details and selected headline
 */
export function rollAndSelectHeadline(bands: HeadlineBands): {
  roll: number;
  band: PlausibilityBand;
  selectedHeadline: string;
} {
  const { roll, band } = rollDice();
  const selectedHeadline = selectHeadline(bands, band);

  return {
    roll,
    band,
    selectedHeadline,
  };
}
