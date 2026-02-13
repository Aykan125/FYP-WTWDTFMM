/**
 * Summary service for generating AI-powered round recaps.
 * Generates narrative summaries displayed during BREAK phase.
 */

import pool from '../db/pool.js';
import {
  createOpenAIClient,
  OpenAIClient,
  OpenAIError,
} from '../llm/openaiResponsesClient.js';
import {
  buildSummaryPrompt,
  buildSummaryInstructions,
  summaryJsonSchema,
} from '../llm/summaryPrompt.js';
import {
  GenerateSummaryParams,
  SummaryResult,
  RoundSummaryOutput,
  RoundHeadlineInput,
  SummaryStatus,
} from '../llm/summaryTypes.js';

// ============================================================================
// Plausibility Level Mapping
// ============================================================================

const PLAUSIBILITY_LABELS: Record<number, string> = {
  1: 'inevitable',
  2: 'probable',
  3: 'plausible',
  4: 'possible',
  5: 'preposterous',
};

// ============================================================================
// Client Management
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
export function resetSummaryClient(): void {
  clientInstance = null;
}

/**
 * Set a custom client instance (for testing).
 */
export function setSummaryClient(client: OpenAIClient): void {
  clientInstance = client;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch all headlines for a specific round.
 */
async function fetchRoundHeadlines(
  sessionId: string,
  roundNo: number
): Promise<RoundHeadlineInput[]> {
  const result = await pool.query(
    `SELECT
      h.id,
      COALESCE(h.selected_headline, h.headline_text) as headline,
      h.headline_text as story_direction,
      h.plausibility_level,
      h.planet_1,
      h.planet_2,
      h.planet_3,
      p.nickname as player
    FROM game_session_headlines h
    JOIN session_players p ON h.player_id = p.id
    WHERE h.session_id = $1 AND h.round_no = $2
    ORDER BY h.created_at ASC`,
    [sessionId, roundNo]
  );

  return result.rows.map((row) => ({
    headline: row.headline || row.story_direction,
    player: row.player,
    plausibilityLevel: row.plausibility_level || 3,
    plausibilityLabel: PLAUSIBILITY_LABELS[row.plausibility_level] || 'plausible',
    planets: [row.planet_1, row.planet_2, row.planet_3].filter(Boolean),
    storyDirection: row.story_direction,
  }));
}

/**
 * Create or update a summary record with 'generating' status.
 */
async function markSummaryGenerating(sessionId: string, roundNo: number): Promise<string> {
  const result = await pool.query(
    `INSERT INTO round_summaries (session_id, round_no, status, summary_data)
     VALUES ($1, $2, 'generating', '{}')
     ON CONFLICT (session_id, round_no)
     DO UPDATE SET status = 'generating', error_message = NULL
     RETURNING id`,
    [sessionId, roundNo]
  );
  return result.rows[0].id;
}

/**
 * Update a summary record with completed data.
 */
async function markSummaryCompleted(
  summaryId: string,
  summaryData: RoundSummaryOutput,
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  llmRequest: Record<string, unknown>,
  llmResponse: string
): Promise<void> {
  await pool.query(
    `UPDATE round_summaries
     SET status = 'completed',
         summary_data = $2,
         llm_model = $3,
         llm_input_tokens = $4,
         llm_output_tokens = $5,
         llm_request = $6,
         llm_response = $7,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      summaryId,
      JSON.stringify(summaryData),
      model,
      inputTokens ?? null,
      outputTokens ?? null,
      JSON.stringify(llmRequest),
      llmResponse,
    ]
  );
}

/**
 * Update a summary record with error status.
 */
async function markSummaryError(summaryId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE round_summaries
     SET status = 'error',
         error_message = $2,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [summaryId, errorMessage]
  );
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Generate a round summary using AI.
 *
 * @param params - Session ID, round number, and max rounds
 * @returns The generated summary with metadata
 * @throws {OpenAIError} If the API call fails
 */
export async function generateRoundSummary(
  params: GenerateSummaryParams
): Promise<SummaryResult> {
  const { sessionId, roundNo, maxRounds } = params;

  // Mark as generating before starting
  const summaryId = await markSummaryGenerating(sessionId, roundNo);

  try {
    // Fetch headlines for this round
    const headlines = await fetchRoundHeadlines(sessionId, roundNo);

    // Build the prompt
    const prompt = buildSummaryPrompt({
      roundNo,
      totalRounds: maxRounds,
      headlines,
    });
    const instructions = buildSummaryInstructions();

    // Call OpenAI
    const client = getClient();
    const result = await client.callResponsesApi<RoundSummaryOutput>({
      input: prompt,
      instructions,
      jsonSchema: summaryJsonSchema,
    });

    // Mark as completed
    await markSummaryCompleted(
      summaryId,
      result.output,
      result.model,
      result.usage?.inputTokens,
      result.usage?.outputTokens,
      { prompt, instructions },
      result.rawText
    );

    return {
      summary: result.output,
      model: result.model,
      usage: result.usage,
    };
  } catch (error) {
    // Mark as error
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSummaryError(summaryId, errorMessage);
    throw error;
  }
}

/**
 * Get an existing round summary from the database.
 *
 * @param sessionId - The session ID
 * @param roundNo - The round number
 * @returns The summary data and status, or null if not found
 */
export async function getRoundSummary(
  sessionId: string,
  roundNo: number
): Promise<{
  status: SummaryStatus;
  summary: RoundSummaryOutput | null;
  error: string | null;
} | null> {
  const result = await pool.query(
    `SELECT status, summary_data, error_message
     FROM round_summaries
     WHERE session_id = $1 AND round_no = $2`,
    [sessionId, roundNo]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    status: row.status as SummaryStatus,
    summary: row.status === 'completed' ? row.summary_data : null,
    error: row.error_message,
  };
}

/**
 * Get session ID from join code.
 *
 * @param joinCode - The session join code
 * @returns The session ID or null if not found
 */
export async function getSessionIdFromJoinCode(joinCode: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT id FROM game_sessions WHERE join_code = $1`,
    [joinCode]
  );

  return result.rows.length > 0 ? result.rows[0].id : null;
}
