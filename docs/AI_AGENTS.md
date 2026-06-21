# AI Agents — Technical Implementation Reference

> Companion to root `AI_AGENTS.md` (which has agent specs).  
> This doc covers the code-level implementation of the AI subsystem.

---

## AiService (Singleton — Global Module)

**File:** `apps/api/src/ai/ai.service.ts`

```typescript
@Injectable()
export class AiService {
  private readonly client: Anthropic;
  private readonly logger: LoggerService;
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    logger: LoggerService,
    redis: Redis,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }

  async complete<T extends ZodSchema>(options: AiCallOptions<T>): Promise<z.infer<T>> {
    // 1. Rate limit check
    await this.checkRateLimit(options.orgId, options.agentName);

    // 2. Audit start
    const callId = crypto.randomUUID();

    // 3. Call Anthropic
    let raw: Anthropic.Message;
    try {
      raw = await Promise.race([
        this.client.messages.create({
          model: options.model ?? this.configService.get('AI_MODEL'),
          max_tokens: options.maxTokens ?? 2048,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: options.userContent }],
          // Use tool-use to force JSON when available
        }),
        sleep(options.timeoutMs ?? 30_000).then(() => { throw new AiTimeoutError(); }),
      ]);
    } catch (err) {
      if (err instanceof AiTimeoutError) throw err;
      throw new AiUnavailableError(err);
    }

    // 4. Extract text
    const content = raw.content[0];
    if (content.type !== 'text') throw new AiResponseError('UNEXPECTED_CONTENT_TYPE');

    // 5. Parse JSON
    let parsed: unknown;
    try { parsed = JSON.parse(content.text); }
    catch { throw new AiResponseError('NOT_JSON', content.text.slice(0, 200)); }

    // 6. Zod validate
    const result = options.outputSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.error({ issues: result.error.issues, callId }, 'AI schema mismatch');
      throw new AiResponseError('SCHEMA_INVALID');
    }

    // 7. Audit
    await this.auditService.log({
      actor: options.actorUserId ?? 'system',
      action: `ai.${options.agentName}`,
      afterHash: sha256(JSON.stringify(result.data)),
    });

    return result.data;
  }

  private async checkRateLimit(orgId: string | undefined, agentName: string) {
    if (!orgId) return;
    const key = `khanij:ratelimit:org:${orgId}:${agentName}`;
    const limit = AI_RATE_LIMITS[agentName] ?? 60;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > limit) throw new AiRateLimitError(agentName, limit);
  }
}
```

---

## Prompt Files Convention

```typescript
// apps/api/src/ai/prompts/search-intent-parser.ts
import { z } from 'zod';

export const SearchIntentInputSchema = z.object({
  query: z.string().max(500),
});

export const SearchIntentOutputSchema = z.object({
  mineralName: z.string().optional(),
  gradeConstraints: z.record(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  quantityMT: z.number().positive().optional(),
  state: z.string().optional(),
  deadlineDays: z.number().positive().optional(),
  confidence: z.number().min(0).max(1),
});

export type SearchIntentOutput = z.infer<typeof SearchIntentOutputSchema>;

export const SEARCH_INTENT_SYSTEM_PROMPT = `
You are a parsing assistant for Khanij Nexus, India's B2B minerals trading platform.

TASK: Parse a buyer's search query into structured JSON for Elasticsearch.

MINERAL TYPES: Iron Ore, Coal, Bauxite, Copper Ore, Limestone, Manganese, Chromite, Lead-Zinc, Rock Phosphate, Dolomite, Silica Sand, Feldspar

GRADE PARAMETERS BY MINERAL:
- Iron Ore: Fe% (iron content), SiO2% (silica), Al2O3% (alumina), moisture%
- Coal: GCV (kcal/kg), ash%, moisture%, sulfur%
- Bauxite: Al2O3%, SiO2%, Fe2O3%, moisture%

RULES:
1. Return ONLY valid JSON. No markdown, no explanation.
2. Extract only what is explicitly stated. Do not infer state from district names.
3. If the query is too vague, return { "confidence": 0.3 } with what you can extract.
4. Grade constraints: "at least 62% Fe" → gradeConstraints: { "Fe%": { "min": 62 } }
5. "needed in 30 days" or "by end of month" → deadlineDays: 30

OUTPUT SCHEMA:
{ mineralName?: string, gradeConstraints?: Record<string,{min?:number,max?:number}>, quantityMT?: number, state?: string, deadlineDays?: number, confidence: number }
` as const;
```

---

## Adding a New Agent (Checklist)

1. **Create prompt file** at `apps/api/src/ai/prompts/{agent-name}.ts`
   - Export: InputSchema, OutputSchema, SYSTEM_PROMPT constant
   - OutputSchema must include `isDecisionSupport: z.literal(true)` if result shown to users

2. **Add rate limit** in `apps/api/src/ai/ai.service.ts`:
   ```typescript
   const AI_RATE_LIMITS: Record<string, number> = {
     'search-intent-parser': 200,
     'deal-copilot': 60,
     'new-agent-name': 30,  // ← add here
   };
   ```

3. **Inject in service**:
   ```typescript
   // In the calling service:
   constructor(private readonly ai: AiService) {}

   async doThing(input: Input, actor: JwtPayload) {
     const sanitized = sanitizeForPrompt(input.userText, 500);
     return this.ai.complete({
       agentName: 'new-agent-name',
       systemPrompt: NEW_AGENT_SYSTEM_PROMPT,
       userContent: JSON.stringify({ ...input, userText: sanitized }),
       outputSchema: NewAgentOutputSchema,
       orgId: actor.orgId,
       actorUserId: actor.userId,
     });
   }
   ```

4. **Mock in tests**:
   ```typescript
   const mockAiService = { complete: jest.fn<Promise<OutputType>, [AiCallOptions]>() };
   mockAiService.complete.mockResolvedValue(fixture);
   ```

5. **Add to AI_AGENTS.md** (root) with full spec.

---

## Error Codes

```typescript
// apps/api/src/ai/ai.errors.ts

export class AiTimeoutError extends KhanijError {
  constructor() { super('AI_TIMEOUT', 'AI service timed out', 503); }
}

export class AiUnavailableError extends KhanijError {
  constructor(cause?: unknown) { super('AI_UNAVAILABLE', 'AI service unavailable', 503); }
}

export class AiRateLimitError extends KhanijError {
  constructor(agentName: string, limit: number) {
    super('AI_RATE_LIMITED', `Rate limit of ${limit}/hour exceeded for ${agentName}`, 429);
  }
}

export class AiResponseError extends KhanijError {
  constructor(code: string, detail?: string) {
    super(`AI_RESPONSE_${code}`, `AI response invalid: ${code}`, 500);
  }
}
```

---

## AI Module Registration

```typescript
// apps/api/src/ai/ai.module.ts
@Global()
@Module({
  providers: [AiService, AuditService],
  exports: [AiService],
})
export class AiModule {}
```

`@Global()` means any module can inject `AiService` without importing `AiModule`.

---

## Mock Mode (Development / Testing)

Set `AI_MOCK=true` in `.env.test` to bypass real Anthropic calls:

```typescript
// In AiService.complete():
if (this.configService.get('AI_MOCK') === 'true') {
  const fixture = AI_MOCK_FIXTURES[options.agentName];
  if (!fixture) throw new Error(`No AI fixture for agent: ${options.agentName}`);
  return options.outputSchema.parse(fixture);
}
```

Fixtures in: `apps/api/src/ai/fixtures/`

---

## Prompt Versioning

Each prompt constant includes a version comment:
```typescript
// Version: 1.0 | Last updated: 2026-06-15 | Model tested: claude-sonnet-4-6
export const DEAL_COPILOT_SYSTEM_PROMPT = `...` as const;
```

When updating a prompt, increment the version and note the change in the comment.
Test the new prompt against existing fixtures before deploying.
