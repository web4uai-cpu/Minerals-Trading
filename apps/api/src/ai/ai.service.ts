import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  SearchIntent,
  SearchIntentSchema,
  ContractDraftOutput,
  ContractDraftOutputSchema,
  PriceAdvisorOutput,
  PriceAdvisorOutputSchema,
  FraudSignalOutput,
  FraudSignalOutputSchema,
  ComplianceReviewOutput,
  ComplianceReviewOutputSchema,
} from '@khanij/types';
import { buildParseSearchPrompt, ParseSearchPromptContext } from './prompts/parse-search';
import {
  buildContractDraftPrompt,
  ContractDraftContext,
  buildPriceAdvisorPrompt,
  PriceAdvisorContext,
  buildFraudSignalPrompt,
  FraudSignalContext,
  buildComplianceReviewPrompt,
  ComplianceReviewContext,
} from '@khanij/ai';

/**
 * AI Service — the ONLY place Claude is called.
 *
 * Single abstraction for all AI operations.
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
   * Shared helper — handles API key check, Claude call, JSON parse,
   * code fence stripping, optional disclaimer injection, and Zod validation.
   */
  private async callClaude<T>(
    prompt: string,
    schema: z.ZodType<T>,
    agentName: string,
    defaultDisclaimer?: string,
  ): Promise<T | null> {
    if (!this.apiKey || this.apiKey === 'sk-ant-xxxxxxxx') {
      this.logger.log(`AI unavailable — returning null for ${agentName} (fallback mode)`);
      return null;
    }

    try {
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
        this.logger.warn(`Claude returned empty response for ${agentName}`);
        return null;
      }

      // Strip any markdown code fences Claude might add despite instructions
      const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        this.logger.warn(`Claude returned invalid JSON for ${agentName}: ${cleaned.substring(0, 200)}`);
        return null;
      }

      // Inject the mandatory disclaimer if Claude omitted it
      if (defaultDisclaimer) {
        parsed = {
          ...(parsed as Record<string, unknown>),
          disclaimer: (parsed as Record<string, unknown>).disclaimer ?? defaultDisclaimer,
        };
      }

      // Zod-validate
      const result = schema.safeParse(parsed);
      if (!result.success) {
        this.logger.warn(`${agentName} validation failed: ${result.error.message}`);
        return null;
      }

      return result.data;
    } catch (error) {
      this.logger.error(
        `AI ${agentName} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Parse a natural-language search query into a structured SearchIntent.
   */
  async parseSearchIntent(
    query: string,
    context: ParseSearchPromptContext,
  ): Promise<SearchIntent | null> {
    const prompt = buildParseSearchPrompt(query, context);
    const result = await this.callClaude(prompt, SearchIntentSchema, 'parseSearchIntent');
    if (result) {
      this.logger.log(`AI parsed intent: mineral=${result.mineralName}, state=${result.state}`);
    }
    return result;
  }

  /**
   * Draft a contract from structured deal data.
   * The output is always labeled AI-DRAFTED — NOT LEGALLY BINDING.
   */
  async draftContract(
    context: ContractDraftContext,
  ): Promise<ContractDraftOutput | null> {
    const prompt = buildContractDraftPrompt(context);
    const result = await this.callClaude(
      prompt,
      ContractDraftOutputSchema,
      'draftContract',
      'AI-DRAFTED — NOT LEGALLY BINDING — REQUIRES HUMAN REVIEW AND SIGNATURE',
    );
    if (result) {
      this.logger.log(`AI drafted contract for deal context: mineral=${context.deal.mineralName}`);
    }
    return result;
  }

  /**
   * Advise on pricing by analyzing a proposed price against market data.
   * Output is advisory only — not financial advice.
   */
  async advisePricing(
    context: PriceAdvisorContext,
  ): Promise<PriceAdvisorOutput | null> {
    const prompt = buildPriceAdvisorPrompt(context);
    const result = await this.callClaude(
      prompt,
      PriceAdvisorOutputSchema,
      'advisePricing',
      'AI-generated price analysis — NOT financial advice. Verify with independent market data before making trading decisions.',
    );
    if (result) {
      this.logger.log(`AI price advice: assessment=${result.assessment}, deviation=${result.deviationPercent}%`);
    }
    return result;
  }

  /**
   * Detect potential fraud signals from org behavioral data.
   * Output requires human investigation — not a fraud determination.
   */
  async detectFraudSignals(
    context: FraudSignalContext,
  ): Promise<FraudSignalOutput | null> {
    const prompt = buildFraudSignalPrompt(context);
    const result = await this.callClaude(
      prompt,
      FraudSignalOutputSchema,
      'detectFraudSignals',
      'AI-generated risk assessment — requires human investigation. Not a fraud determination.',
    );
    if (result) {
      this.logger.log(`AI fraud check: orgId=${context.orgId}, risk=${result.riskLevel}`);
    }
    return result;
  }

  /**
   * Review a compliance document for completeness and red flags.
   * Output is AI pre-screening — requires human verification.
   */
  async reviewComplianceDocument(
    context: ComplianceReviewContext,
  ): Promise<ComplianceReviewOutput | null> {
    const prompt = buildComplianceReviewPrompt(context);
    const result = await this.callClaude(
      prompt,
      ComplianceReviewOutputSchema,
      'reviewComplianceDocument',
      'AI pre-screening — requires human verification. This assessment does not constitute legal or regulatory approval.',
    );
    if (result) {
      this.logger.log(`AI compliance review: type=${context.documentType}, rec=${result.recommendation}`);
    }
    return result;
  }
}
