import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchIntent, SearchIntentSchema } from '@khanij/types';
import { buildParseSearchPrompt, ParseSearchPromptContext } from './prompts/parse-search';

/**
 * AI Service — the ONLY place Claude is called.
 *
 * Single abstraction for all AI operations.
 * Currently: search intent parsing.
 * Future: document extraction, dispute summarization, etc.
 *
 * Fallback: returns null if API key is missing or parse fails.
 * The AI never invents sellers or prices — it only parses intent;
 * ranking and data come from our DB.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('AI_MODEL', 'claude-sonnet-4-6');
    this.maxTokens = this.config.get<number>('AI_MAX_TOKENS', 2000);

    if (!this.apiKey || this.apiKey === 'sk-ant-xxxxxxxx') {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI features will return null (fallback mode)');
    }
  }

  /**
   * Parse a natural-language search query into a structured SearchIntent.
   *
   * Returns null if:
   * - API key is missing
   * - Claude returns invalid JSON
   * - Zod validation fails
   * - Any error occurs (fail open for search)
   */
  async parseSearchIntent(
    query: string,
    context: ParseSearchPromptContext,
  ): Promise<SearchIntent | null> {
    if (!this.apiKey || this.apiKey === 'sk-ant-xxxxxxxx') {
      this.logger.log('AI unavailable — returning null intent (fallback mode)');
      return null;
    }

    const prompt = buildParseSearchPrompt(query, context);

    try {
      // Dynamic import to avoid loading Anthropic SDK when not needed
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: this.apiKey });

      const response = await client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('');

      if (!text) {
        this.logger.warn('Claude returned empty response');
        return null;
      }

      // Strip any markdown code fences Claude might add despite instructions
      const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        this.logger.warn(`Claude returned invalid JSON: ${cleaned.substring(0, 200)}`);
        return null;
      }

      // Zod-validate
      const result = SearchIntentSchema.safeParse(parsed);
      if (!result.success) {
        this.logger.warn(`SearchIntent validation failed: ${result.error.message}`);
        return null;
      }

      this.logger.log(`AI parsed intent: mineral=${result.data.mineralName}, state=${result.data.state}`);
      return result.data;
    } catch (error) {
      this.logger.error(
        `AI parseSearchIntent failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
