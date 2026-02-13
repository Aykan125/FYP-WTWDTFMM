/**
 * Headline Transformation Service.
 * Orchestrates the full flow: LLM evaluation -> dice roll -> headline selection.
 */

import {
  HeadlineEntry,
  PlanetEntry,
  PlausibilityBand,
  PlausibilityResult,
  PlanetsResult,
  LinkedHeadline,
  HeadlineBands,
} from '../llm/jurorPrompt.js';
import { evaluateJuror, JurorEvaluationResult } from './jurorService.js';
import { rollDice, selectHeadline } from './diceRoll.js';

// ============================================================================
// Types
// ============================================================================

export interface TransformationInput {
  /** The player's story direction / headline concept */
  storyDirection: string;
  /** Existing headlines in the timeline */
  headlinesList: HeadlineEntry[] | string[];
  /** Available planets for classification */
  planetList: PlanetEntry[];
}

export interface TransformationResult {
  // From LLM evaluation
  /** Plausibility assessment of the story direction */
  plausibility: PlausibilityResult;
  /** Top 3 planet alignments */
  planets: PlanetsResult;
  /** Top 3 linked headlines with connection strength */
  linked: LinkedHeadline[];
  /** All 5 headline variants (one per band) */
  allBands: HeadlineBands;

  // From backend dice roll
  /** Raw dice roll value (0-100) */
  diceRoll: number;
  /** The band selected by dice roll (1-5) */
  selectedBand: PlausibilityBand;
  /** The final headline text after dice selection */
  selectedHeadline: string;

  // Metadata
  /** Model used for LLM evaluation */
  model: string;
  /** Token usage from LLM call */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };

  // Raw LLM data for logging
  /** Raw request sent to LLM */
  llmRequest: Record<string, unknown>;
  /** Raw response from LLM */
  llmResponse: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Transform a story direction into a final headline.
 *
 * Flow:
 * 1. Call LLM juror to evaluate story direction and generate 5 headline variants
 * 2. Roll dice (0-100) and map to band (1-5)
 * 3. Select the headline from the rolled band
 * 4. Return combined result with all data for storage
 *
 * @param input - Story direction, existing headlines, and planet list
 * @returns Complete transformation result including LLM evaluation and dice roll
 */
export async function transformHeadline(
  input: TransformationInput
): Promise<TransformationResult> {
  // Step 1: Call LLM juror for evaluation and headline generation
  const jurorResult: JurorEvaluationResult = await evaluateJuror({
    storyDirection: input.storyDirection,
    headlinesList: input.headlinesList,
    planetList: input.planetList,
  });

  const evaluation = jurorResult.evaluation;

  // Step 2: Roll dice and map to band
  const { roll, band } = rollDice();

  // Step 3: Select headline from the rolled band
  const selectedHeadline = selectHeadline(evaluation.HEADLINES.bands, band);

  // Step 4: Return combined result
  return {
    // LLM evaluation results
    plausibility: evaluation.PLAUSIBILITY,
    planets: evaluation.PLANETS,
    linked: evaluation.LINKED,
    allBands: evaluation.HEADLINES.bands,

    // Dice roll results
    diceRoll: roll,
    selectedBand: band,
    selectedHeadline,

    // Metadata
    model: jurorResult.model,
    usage: jurorResult.usage,

    // Raw LLM data for logging
    llmRequest: jurorResult.rawRequest,
    llmResponse: jurorResult.rawResponse,
  };
}

/**
 * Transform a story direction with a predetermined dice roll.
 * Useful for testing or when dice roll is provided externally.
 *
 * @param input - Story direction, existing headlines, and planet list
 * @param predeterminedRoll - The dice roll value to use (0-100)
 * @returns Complete transformation result
 */
export async function transformHeadlineWithRoll(
  input: TransformationInput,
  predeterminedRoll: number
): Promise<TransformationResult> {
  // Validate roll
  if (predeterminedRoll < 0 || predeterminedRoll > 100) {
    throw new Error(`Roll must be between 0 and 100, got ${predeterminedRoll}`);
  }

  // Import mapRollToBand for predetermined roll
  const { mapRollToBand } = await import('./diceRoll.js');

  // Step 1: Call LLM juror
  const jurorResult: JurorEvaluationResult = await evaluateJuror({
    storyDirection: input.storyDirection,
    headlinesList: input.headlinesList,
    planetList: input.planetList,
  });

  const evaluation = jurorResult.evaluation;

  // Step 2: Map predetermined roll to band
  const band = mapRollToBand(predeterminedRoll);

  // Step 3: Select headline
  const selectedHeadline = selectHeadline(evaluation.HEADLINES.bands, band);

  // Step 4: Return combined result
  return {
    plausibility: evaluation.PLAUSIBILITY,
    planets: evaluation.PLANETS,
    linked: evaluation.LINKED,
    allBands: evaluation.HEADLINES.bands,

    diceRoll: predeterminedRoll,
    selectedBand: band,
    selectedHeadline,

    model: jurorResult.model,
    usage: jurorResult.usage,

    // Raw LLM data for logging
    llmRequest: jurorResult.rawRequest,
    llmResponse: jurorResult.rawResponse,
  };
}

// Re-export types for convenience
export type {
  HeadlineEntry,
  PlanetEntry,
  PlausibilityBand,
  PlausibilityResult,
  PlanetsResult,
  LinkedHeadline,
  HeadlineBands,
} from '../llm/jurorPrompt.js';
