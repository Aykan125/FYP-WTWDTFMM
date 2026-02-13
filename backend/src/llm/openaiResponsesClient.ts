/**
 * OpenAI Responses API client wrapper.
 * Uses fetch (injectable for testing) to call the Responses API with JSON schema enforcement.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the OpenAI client.
 */
export interface OpenAIClientConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /** Inject a custom fetch for testing */
  fetchFn?: typeof fetch;
}

/**
 * JSON Schema object for response_format.
 */
export interface JsonSchemaDefinition {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

/**
 * Request options for a Responses API call.
 */
export interface ResponsesApiRequest {
  /** The input prompt/messages */
  input: string;
  /** JSON schema to enforce on the output */
  jsonSchema?: JsonSchemaDefinition;
  /** Optional instructions (system message) */
  instructions?: string;
}

/**
 * Parsed result from the Responses API.
 */
export interface ResponsesApiResult<T> {
  /** The parsed JSON output */
  output: T;
  /** Raw text before parsing (for debugging) */
  rawText: string;
  /** Model used */
  model: string;
  /** Usage stats */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Error Classes
// ============================================================================

export class OpenAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

// ============================================================================
// Client Implementation
// ============================================================================

const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_BASE_URL = 'https://api.openai.com';

/**
 * Create an OpenAI Responses API client.
 */
export function createOpenAIClient(config: OpenAIClientConfig) {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    fetchFn = fetch,
  } = config;

  if (!apiKey) {
    throw new OpenAIError('OPENAI_API_KEY is required', 'MISSING_API_KEY');
  }

  /**
   * Call the Responses API and return parsed JSON.
   */
  async function callResponsesApi<T>(
    request: ResponsesApiRequest
  ): Promise<ResponsesApiResult<T>> {
    const url = `${baseUrl}/v1/responses`;

    // Build request body
    const body: Record<string, unknown> = {
      model,
      input: request.input,
    };

    // Add instructions if provided
    if (request.instructions) {
      body.instructions = request.instructions;
    }

    // Add JSON schema format if provided
    if (request.jsonSchema) {
      body.text = {
        format: {
          type: 'json_schema',
          name: request.jsonSchema.name,
          strict: request.jsonSchema.strict ?? true,
          schema: request.jsonSchema.schema,
        },
      };
    }

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new OpenAIError(
        `Network error calling OpenAI: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR'
      );
    }

    if (!response.ok) {
      let errorMessage = `OpenAI API returned ${response.status}`;
      try {
        const errorBody = (await response.json()) as {
          error?: { message?: string };
        };
        if (errorBody?.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // Ignore JSON parse errors for error response
      }
      throw new OpenAIError(errorMessage, 'API_ERROR', response.status);
    }

    let responseData: any;
    try {
      responseData = await response.json();
    } catch (err) {
      throw new OpenAIError(
        'Failed to parse OpenAI response as JSON',
        'INVALID_RESPONSE'
      );
    }

    // Extract the output text from the Responses API structure
    // The Responses API returns: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    let rawText: string;
    try {
      const outputItems = responseData.output;
      if (!Array.isArray(outputItems) || outputItems.length === 0) {
        throw new Error('No output items');
      }

      // Find the message output
      const messageOutput = outputItems.find(
        (item: any) => item.type === 'message'
      );
      if (!messageOutput) {
        throw new Error('No message output found');
      }

      // Find the text content
      const textContent = messageOutput.content?.find(
        (c: any) => c.type === 'output_text'
      );
      if (!textContent?.text) {
        throw new Error('No text content found');
      }

      rawText = textContent.text;
    } catch (err) {
      throw new OpenAIError(
        `Unexpected Responses API structure: ${err instanceof Error ? err.message : String(err)}`,
        'INVALID_RESPONSE_STRUCTURE'
      );
    }

    // Parse the text as JSON
    let parsedOutput: T;
    try {
      parsedOutput = JSON.parse(rawText);
    } catch (err) {
      throw new OpenAIError(
        `Failed to parse model output as JSON: ${rawText.substring(0, 200)}...`,
        'INVALID_JSON_OUTPUT'
      );
    }

    // Extract usage if available
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    if (responseData.usage) {
      usage = {
        inputTokens: responseData.usage.input_tokens ?? 0,
        outputTokens: responseData.usage.output_tokens ?? 0,
      };
    }

    return {
      output: parsedOutput,
      rawText,
      model: responseData.model ?? model,
      usage,
    };
  }

  return {
    callResponsesApi,
  };
}

/**
 * Type for the client returned by createOpenAIClient.
 */
export type OpenAIClient = ReturnType<typeof createOpenAIClient>;

