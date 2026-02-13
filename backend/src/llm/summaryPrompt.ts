/**
 * Summary prompt builder and JSON schema for round summary generation.
 * Builds the prompt for AI-generated narrative summaries displayed during BREAK phase.
 */

import { JsonSchemaDefinition } from './openaiResponsesClient.js';
import { SummaryPromptInput, RoundHeadlineInput } from './summaryTypes.js';

// ============================================================================
// JSON Schema for Responses API
// ============================================================================

/**
 * JSON Schema that enforces the structure of the round summary output.
 * Used with the OpenAI Responses API response_format.
 */
export const summaryJsonSchema: JsonSchemaDefinition = {
  name: 'round_summary',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      narrative: {
        type: 'string',
        description: '2-3 paragraph narrative summary of events as if they really happened',
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
        description: 'Top 3 themes from this period',
      },
      highlightedHeadlines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: {
              type: 'string',
              description: 'The headline text',
            },
            source: {
              type: 'string',
              description: 'The news source or correspondent who reported this',
            },
            significance: {
              type: 'string',
              description: 'The historical significance or impact of this event',
            },
          },
          required: ['headline', 'source', 'significance'],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 2,
        description: 'Top 2 most significant headlines from this period',
      },
      dominantPlanets: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
        description: 'Top 3 planetary themes/influences this period',
      },
      roundStats: {
        type: 'object',
        properties: {
          headlineCount: {
            type: 'integer',
            description: 'Total number of developments reported',
          },
          playerCount: {
            type: 'integer',
            description: 'Number of sources/correspondents',
          },
        },
        required: ['headlineCount', 'playerCount'],
        additionalProperties: false,
      },
    },
    required: ['narrative', 'themes', 'highlightedHeadlines', 'dominantPlanets', 'roundStats'],
    additionalProperties: false,
  },
};

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Format a single headline for the prompt.
 */
function formatHeadline(headline: RoundHeadlineInput, index: number): string {
  const planetStr = headline.planets.length > 0
    ? headline.planets.join(', ')
    : 'none';

  return `${index + 1}. "${headline.headline}" by ${headline.player}
   - Plausibility: ${headline.plausibilityLabel} (${headline.plausibilityLevel}/5)
   - Planets: ${planetStr}
   - Story direction: ${headline.storyDirection}`;
}

/**
 * Build the summary prompt from the input data.
 */
export function buildSummaryPrompt(input: SummaryPromptInput): string {
  const { roundNo, totalRounds, headlines } = input;

  // Format all headlines
  const formattedHeadlines = headlines.length > 0
    ? headlines.map((h, i) => formatHeadline(h, i)).join('\n\n')
    : 'No headlines were submitted this round.';

  // Count unique players
  const uniquePlayers = new Set(headlines.map(h => h.player));
  const playerCount = uniquePlayers.size;

  // Count planet occurrences
  const planetCounts: Record<string, number> = {};
  for (const h of headlines) {
    for (const planet of h.planets) {
      planetCounts[planet] = (planetCounts[planet] || 0) + 1;
    }
  }

  return `You are a future historian summarizing events from a timeline where AI has transformed society. Round ${roundNo} of ${totalRounds} has just ended.

=== HEADLINES FROM THIS ROUND ===
${formattedHeadlines}

=== ROUND STATISTICS ===
- Total headlines: ${headlines.length}
- Contributors: ${playerCount}

=== YOUR TASK ===
Create a narrative summary as if these headlines represent REAL EVENTS that have happened in this alternate future timeline. Write as a historian or journalist recapping actual news, NOT as a game show host discussing player submissions.

1. **Narrative**: Write 2-3 paragraphs summarizing the events as if they actually occurred. Weave the headlines together into a coherent story of what happened in this period. Use phrases like "This period saw...", "Major developments included...", "The world witnessed...", etc. Do NOT mention players, submissions, or the game itself.

2. **Themes**: Identify the top 3 themes that emerged (e.g., "AI in Healthcare", "Robot Rights", "Space Colonization").

3. **Highlighted Headlines**: Pick the top 2 most significant headlines. For each, explain their historical significance or impact on society - NOT why they were creative game submissions.

4. **Dominant Planets**: List the top 3 planetary themes/influences that appeared across events.

5. **Round Stats**: Include the headline count and contributor count (but frame it as "reports" or "developments" rather than game submissions).

Write in a journalistic or documentary style. The tone should be informative and immersive, making it feel like a real historical recap of future events.`;
}

/**
 * Build the system instructions for the summary generator.
 */
export function buildSummaryInstructions(): string {
  return `You are a future historian documenting events from an alternate timeline where AI has transformed society.

Your role is to create immersive narrative summaries that:
- Treat the headlines as REAL events that actually happened
- Weave multiple headlines into a coherent historical narrative
- Explain the significance and impact of key developments
- NEVER mention players, game mechanics, submissions, or creativity

Write as if you're a journalist or documentarian looking back at this period in history.
Keep the narrative to 2-3 paragraphs.
Always output valid JSON matching the required schema.`;
}
