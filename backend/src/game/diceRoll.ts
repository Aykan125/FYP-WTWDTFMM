/**
 * Dice roll module for headline band selection.
 * Handles random roll generation and mapping to plausibility bands.
 */

import { HeadlineBands, PlausibilityBand } from '../llm/jurorPrompt.js';

// ============================================================================
// Types
// ============================================================================

export interface DiceRollResult {
  /** Raw roll value 0-100 */
  roll: number;
  /** Mapped band 1-5 */
  band: PlausibilityBand;
}

// ============================================================================
// Band Boundaries (weighted: 3:5:8:3:1 ratio)
// ============================================================================

/**
 * Band boundaries for mapping roll to band.
 * Weighted to favor middle bands (plausible most common, preposterous rare).
 *
 * Ratios: 3:5:8:3:1 = 20 parts total
 * Band 1: 3/20 = 15% → 0-14   (15 values) - inevitable
 * Band 2: 5/20 = 25% → 15-39  (25 values) - probable
 * Band 3: 8/20 = 40% → 40-79  (40 values) - plausible
 * Band 4: 3/20 = 15% → 80-94  (15 values) - possible
 * Band 5: 1/20 = 5%  → 95-100 (6 values)  - preposterous
 */
const BAND_BOUNDARIES: { min: number; max: number; band: PlausibilityBand }[] = [
  { min: 0, max: 14, band: 1 },
  { min: 15, max: 39, band: 2 },
  { min: 40, max: 79, band: 3 },
  { min: 80, max: 94, band: 4 },
  { min: 95, max: 100, band: 5 },
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Map a roll value (0-100) to a plausibility band (1-5).
 * Uses equal-width bands of 20 each (except band 5 which includes 100).
 *
 * @param roll - Roll value between 0 and 100 inclusive
 * @returns The corresponding plausibility band 1-5
 * @throws Error if roll is outside valid range
 */
export function mapRollToBand(roll: number): PlausibilityBand {
  if (roll < 0 || roll > 100) {
    throw new Error(`Roll must be between 0 and 100, got ${roll}`);
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
 * @returns DiceRollResult with raw roll (0-100) and mapped band (1-5)
 */
export function rollDice(): DiceRollResult {
  // Generate random integer 0-100 inclusive
  const roll = Math.floor(Math.random() * 101);
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
