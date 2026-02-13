/**
 * Juror prompt builder and JSON schema for the OpenAI Responses API.
 * This module builds the prompt for headline evaluation and defines the expected output structure.
 */

import { JsonSchemaDefinition } from './openaiResponsesClient.js';

// ============================================================================
// Types for Input
// ============================================================================

export interface HeadlineEntry {
  id?: string;
  text: string;
}

export interface PlanetEntry {
  id: string;
  description: string;
}

export interface JurorPromptInput {
  storyDirection: string;
  headlinesList: HeadlineEntry[] | string[];
  planetList: PlanetEntry[];
}

// ============================================================================
// Types for Output (what we expect from the model)
// ============================================================================

export type PlausibilityBand = 1 | 2 | 3 | 4 | 5;
export type PlausibilityLabel =
  | 'inevitable'
  | 'probable'
  | 'plausible'
  | 'possible'
  | 'preposterous';
export type LinkStrength = 'STRONG' | 'WEAK';

export interface PlausibilityResult {
  band: PlausibilityBand;
  label: PlausibilityLabel;
  rationale: string;
}

export interface PlanetRanking {
  id: string;
  rank: 1 | 2 | 3;
  rationale: string;
}

export interface PlanetsResult {
  top3: PlanetRanking[];
}

export interface LinkedHeadline {
  headline: string;
  strength: LinkStrength;
  rationale: string;
}

export interface HeadlineBands {
  band1: string;
  band2: string;
  band3: string;
  band4: string;
  band5: string;
}

export interface HeadlinesResult {
  bands: HeadlineBands;
}

export interface JurorEvaluationOutput {
  PLAUSIBILITY: PlausibilityResult;
  PLANETS: PlanetsResult;
  LINKED: LinkedHeadline[];
  HEADLINES: HeadlinesResult;
}

// ============================================================================
// Band Labels (mapping)
// ============================================================================

export const BAND_LABELS: Record<PlausibilityBand, PlausibilityLabel> = {
  1: 'inevitable',
  2: 'probable',
  3: 'plausible',
  4: 'possible',
  5: 'preposterous',
};

// ============================================================================
// JSON Schema for Responses API
// ============================================================================

/**
 * JSON Schema that enforces the structure of the juror evaluation output.
 * Used with the OpenAI Responses API response_format.
 */
export const jurorJsonSchema: JsonSchemaDefinition = {
  name: 'juror_evaluation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      PLAUSIBILITY: {
        type: 'object',
        properties: {
          band: {
            type: 'integer',
            enum: [1, 2, 3, 4, 5],
            description:
              'Plausibility band: 1=inevitable, 2=probable, 3=plausible, 4=possible, 5=preposterous',
          },
          label: {
            type: 'string',
            enum: ['inevitable', 'probable', 'plausible', 'possible', 'preposterous'],
          },
          rationale: {
            type: 'string',
            description: 'Brief explanation of why this band was chosen',
          },
        },
        required: ['band', 'label', 'rationale'],
        additionalProperties: false,
      },
      PLANETS: {
        type: 'object',
        properties: {
          top3: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Planet ID from the provided list' },
                rank: { type: 'integer', enum: [1, 2, 3] },
                rationale: { type: 'string' },
              },
              required: ['id', 'rank', 'rationale'],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ['top3'],
        additionalProperties: false,
      },
      LINKED: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: {
              type: 'string',
              description: 'The text of the linked headline from headlines_list',
            },
            strength: { type: 'string', enum: ['STRONG', 'WEAK'] },
            rationale: { type: 'string' },
          },
          required: ['headline', 'strength', 'rationale'],
          additionalProperties: false,
        },
        minItems: 3,
        maxItems: 3,
      },
      HEADLINES: {
        type: 'object',
        properties: {
          bands: {
            type: 'object',
            properties: {
              band1: { type: 'string', description: 'Headline for band 1 (inevitable)' },
              band2: { type: 'string', description: 'Headline for band 2 (probable)' },
              band3: { type: 'string', description: 'Headline for band 3 (plausible)' },
              band4: { type: 'string', description: 'Headline for band 4 (possible)' },
              band5: { type: 'string', description: 'Headline for band 5 (preposterous)' },
            },
            required: ['band1', 'band2', 'band3', 'band4', 'band5'],
            additionalProperties: false,
          },
        },
        required: ['bands'],
        additionalProperties: false,
      },
    },
    required: ['PLAUSIBILITY', 'PLANETS', 'LINKED', 'HEADLINES'],
    additionalProperties: false,
  },
};

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build the juror prompt from the input data.
 */
export function buildJurorPrompt(input: JurorPromptInput): string {
  const { storyDirection, headlinesList, planetList } = input;

  // Format headlines list
  const formattedHeadlines = headlinesList
    .map((h, i) => {
      const text = typeof h === 'string' ? h : h.text;
      const id = typeof h === 'string' ? `headline_${i + 1}` : h.id ?? `headline_${i + 1}`;
      return `- [${id}] ${text}`;
    })
    .join('\n');

  // Format planet list
  const formattedPlanets = planetList
    .map((p) => `- ${p.id}: ${p.description}`)
    .join('\n');

  return `You are an assistant for a game which builds a narrative about future developments and impacts of AI in coming years and decades, told through a sequence of dated 'headlines'. You will be provided with a file of the headlines that have so far been accepted into the timeline, along with a new 'story direction' which needs to be expressed in a new headline. Your role is to analyze the story direction for purposes of scoring, and to compose text for the new headline.

There are two important concepts that you need to understand: plausibility levels and planetary alignments.

We consider five levels of plausibility of future developments, taking into account what has already happened in the timeline, and the likelihood and pace of scientific developments and social change. The levels are: inevitable, probable, plausible, possible and preposterous.

=== PLANET LIST ===
${formattedPlanets}

=== HEADLINES LIST (Timeline so far) ===
${formattedHeadlines}

=== STORY DIRECTION (New headline to evaluate) ===
${storyDirection}

=== YOUR TASKS ===

In precise detail, your tasks are:

1. **Classify Plausibility**: Classify the provided story direction into one of five plausibility bands using a strict, objective epistemic scale.

2. **Classify Planets**: Considering the planet_list and the description of each planet within the planet_list, which three planets does this headline most closely associate with.

3. **Link Headlines**: Reviewing the headlines_list, identify the three headlines that link most closely to the current story direction given. Of those three, state whether it is a STRONG connection or a WEAK connection to the current story direction.

4. **Generate Five Headline Variations**: Generate five headline variations, one for each band (1–5), representing different levels of certainty, verification, and grounding in observable evidence. Keep the story direction identical across all five headlines.

If helpful to you, please discuss your reasoning before you complete these tasks, but end your output with a JSON structure with all the required elements using these keys: PLAUSIBILITY, PLANETS, LINKED, HEADLINES.`;
}

/**
 * Build the system instructions for the juror.
 */
export function buildJurorInstructions(): string {
  return `You are a game juror evaluating AI future headlines. You must:
1. Be objective and consistent in plausibility assessments
2. Consider the existing timeline context when making judgments
3. Generate headlines that maintain the same core story but vary in certainty language
4. You may discuss your reasoning before outputting JSON, but always end with valid JSON`;
}

