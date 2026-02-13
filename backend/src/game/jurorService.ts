/**
 * Juror service for evaluating headlines via OpenAI.
 * This module orchestrates the OpenAI call and validates the response.
 */

import {
  createOpenAIClient,
  OpenAIClient,
  OpenAIError,
} from '../llm/openaiResponsesClient.js';
import {
  buildJurorPrompt,
  buildJurorInstructions,
  jurorJsonSchema,
  JurorPromptInput,
  JurorEvaluationOutput,
  PlausibilityBand,
  BAND_LABELS,
} from '../llm/jurorPrompt.js';

// ============================================================================
// Types
// ============================================================================

export interface JurorEvaluationRequest extends JurorPromptInput {
  // Inherits storyDirection, headlinesList, planetList
}

export interface JurorEvaluationResult {
  /** The validated evaluation output */
  evaluation: JurorEvaluationOutput;
  /** Model used for the evaluation */
  model: string;
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Raw request sent to LLM (for logging) */
  rawRequest: {
    storyDirection: string;
    headlinesList: unknown[];
    planetList: unknown[];
    instructions: string;
  };
  /** Raw response text from LLM (for logging) */
  rawResponse: string;
}

// ============================================================================
// Error Classes
// ============================================================================

export class JurorValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'JurorValidationError';
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that the evaluation output meets all invariants.
 */
function validateEvaluationOutput(output: JurorEvaluationOutput): void {
  // 1. Validate LINKED has exactly 3 entries
  if (!Array.isArray(output.LINKED) || output.LINKED.length !== 3) {
    throw new JurorValidationError(
      `LINKED must have exactly 3 entries, got ${output.LINKED?.length ?? 0}`,
      'INVALID_LINKED_COUNT',
      { count: output.LINKED?.length }
    );
  }

  // 2. Validate PLANETS.top3 has exactly 3 entries
  if (!Array.isArray(output.PLANETS?.top3) || output.PLANETS.top3.length !== 3) {
    throw new JurorValidationError(
      `PLANETS.top3 must have exactly 3 entries, got ${output.PLANETS?.top3?.length ?? 0}`,
      'INVALID_PLANETS_COUNT',
      { count: output.PLANETS?.top3?.length }
    );
  }

  // 3. Validate PLAUSIBILITY band matches label
  const plausibilityBand = output.PLAUSIBILITY?.band as PlausibilityBand;
  const expectedLabel = BAND_LABELS[plausibilityBand];
  if (output.PLAUSIBILITY?.label !== expectedLabel) {
    throw new JurorValidationError(
      `PLAUSIBILITY.label does not match band (expected ${expectedLabel} for band ${plausibilityBand})`,
      'PLAUSIBILITY_LABEL_MISMATCH',
      {
        band: plausibilityBand,
        expectedLabel,
        actualLabel: output.PLAUSIBILITY?.label,
      }
    );
  }

  // 4. Validate planet ranks are 1, 2, 3
  const ranks = output.PLANETS.top3.map((p) => p.rank).sort();
  if (ranks[0] !== 1 || ranks[1] !== 2 || ranks[2] !== 3) {
    throw new JurorValidationError(
      'PLANETS.top3 must have ranks 1, 2, and 3',
      'INVALID_PLANET_RANKS',
      { ranks: output.PLANETS.top3.map((p) => p.rank) }
    );
  }

  // 5. Validate all bands have non-empty headlines
  const bands = output.HEADLINES.bands;
  for (let i = 1; i <= 5; i++) {
    const key = `band${i}` as keyof typeof bands;
    if (!bands[key] || typeof bands[key] !== 'string' || bands[key].trim() === '') {
      throw new JurorValidationError(
        `HEADLINES.bands.${key} must be a non-empty string`,
        'EMPTY_HEADLINE_BAND',
        { band: i }
      );
    }
  }
}

// ============================================================================
// Service Implementation
// ============================================================================

/** Singleton client instance */
let clientInstance: OpenAIClient | null = null;

/**
 * Get or create the OpenAI client.
 * Uses environment variables for configuration.
 */
function getClient(): OpenAIClient {
  if (!clientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new OpenAIError(
        'OPENAI_API_KEY environment variable is not set',
        'MISSING_API_KEY'
      );
    }

    clientInstance = createOpenAIClient({
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-5.2',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    });
  }

  return clientInstance;
}

/**
 * Reset the client instance (for testing).
 */
export function resetJurorClient(): void {
  clientInstance = null;
}

/**
 * Set a custom client instance (for testing).
 */
export function setJurorClient(client: OpenAIClient): void {
  clientInstance = client;
}

/**
 * Evaluate a story direction using the OpenAI juror.
 *
 * @param request - The evaluation request containing story direction, headlines, and planets
 * @returns The validated evaluation result
 * @throws {OpenAIError} If the API call fails
 * @throws {JurorValidationError} If the response fails invariant validation
 */
export async function evaluateJuror(
  request: JurorEvaluationRequest
): Promise<JurorEvaluationResult> {
  const client = getClient();

  // Build the prompt
  const prompt = buildJurorPrompt(request);
  const instructions = buildJurorInstructions();

  // Call the OpenAI API
  const result = await client.callResponsesApi<JurorEvaluationOutput>({
    input: prompt,
    instructions,
    jsonSchema: jurorJsonSchema,
  });

  // Validate the output
  validateEvaluationOutput(result.output);

  return {
    evaluation: result.output,
    model: result.model,
    usage: result.usage,
    rawRequest: {
      storyDirection: request.storyDirection,
      headlinesList: request.headlinesList,
      planetList: request.planetList,
      instructions,
    },
    rawResponse: result.rawText,
  };
}

// Re-export types for convenience
export type { JurorEvaluationOutput } from '../llm/jurorPrompt.js';

