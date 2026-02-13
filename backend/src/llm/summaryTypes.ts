/**
 * Types for round summary generation.
 * Defines the structure for AI-generated narrative summaries displayed during BREAK phase.
 */

// ============================================================================
// Output Types (LLM Response)
// ============================================================================

/**
 * A highlighted headline from the round with context about its significance.
 */
export interface HighlightedHeadline {
  headline: string;
  source: string;
  significance: string;
}

/**
 * Round statistics for context.
 */
export interface RoundStats {
  headlineCount: number;
  playerCount: number;
}

/**
 * Full summary output structure from the LLM.
 */
export interface RoundSummaryOutput {
  /** 2-3 paragraph engaging narrative recap */
  narrative: string;
  /** Top 3 themes from the round (max) */
  themes: string[];
  /** Top 2 standout headlines with context */
  highlightedHeadlines: HighlightedHeadline[];
  /** Top 3 planets this round */
  dominantPlanets: string[];
  /** Round statistics */
  roundStats: RoundStats;
}

// ============================================================================
// Input Types (For prompt building)
// ============================================================================

/**
 * A single headline with metadata for the summary prompt.
 */
export interface RoundHeadlineInput {
  headline: string;
  player: string;
  plausibilityLevel: number;
  plausibilityLabel: string;
  planets: string[];
  storyDirection: string;
}

/**
 * Full input for building the summary prompt.
 */
export interface SummaryPromptInput {
  roundNo: number;
  totalRounds: number;
  headlines: RoundHeadlineInput[];
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Parameters for generating a round summary.
 */
export interface GenerateSummaryParams {
  sessionId: string;
  roundNo: number;
  maxRounds: number;
}

/**
 * Result from summary generation.
 */
export interface SummaryResult {
  summary: RoundSummaryOutput;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Status of a round summary in the database.
 */
export type SummaryStatus = 'pending' | 'generating' | 'completed' | 'error';

/**
 * Database row for round_summaries table.
 */
export interface RoundSummaryRow {
  id: string;
  session_id: string;
  round_no: number;
  summary_data: RoundSummaryOutput;
  status: SummaryStatus;
  error_message: string | null;
  llm_model: string | null;
  llm_input_tokens: number | null;
  llm_output_tokens: number | null;
  created_at: Date;
  completed_at: Date | null;
}
