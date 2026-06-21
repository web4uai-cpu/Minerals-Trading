# SKILL: AI Agents — Patterns, Rules & Implementation Guide

> Consult before writing any code that calls `AiService` or adding prompts in `apps/api/src/ai/prompts/`.  
> Read alongside `AI_AGENTS.md` for agent-by-agent specifications.

---

## The One Rule

**All Claude calls go through `apps/api/src/ai/ai.service.ts`.** Never call `@anthropic-ai/sdk` directly from a controller, service, job, or guard. Never call it from the web frontend.

---

## AiService Contract

```typescript
// apps/api/src/ai/ai.service.ts

interface AiCallOptions {
  agentName: string;          // for audit log + rate limit key
  systemPrompt: string;       // from prompts/ — never inline
  userContent: string;        // sanitized caller-supplied content
  outputSchema: ZodSchema;    // validates the response
  orgId?: string;             // for per-org rate limiting
  timeoutMs?: number;         // default 30_000
}

// Returns: z.infer<typeof outputSchema> | throws typed AiError
```

---

## Prompt File Convention

Each agent has one file in `apps/api/src/ai/prompts/`:

```typescript
// apps/api/src/ai/prompts/my-agent.ts

import { z } from 'zod';

export const MyAgentInputSchema = z.object({ ... });
export const MyAgentOutputSchema = z.object({ ... });

export const MY_AGENT_SYSTEM_PROMPT = `
You are an assistant for Khanij Nexus, India's minerals trading platform.

TASK: [specific task description]

RULES:
- Return ONLY valid JSON matching this schema: [schema summary]
- Do not include markdown, explanations, or commentary
- If you cannot produce a valid response, return: {"error": "CANNOT_PROCESS"}
- Never fabricate prices, compliance status, or org details
` as const;
```

---

## Prompt Injection Guard (mandatory)

Before passing any user-supplied string to a prompt, call `sanitizeForPrompt()`:

```typescript
// apps/api/src/ai/prompt-injection.guard.ts

const INJECTION_PATTERNS = [
  /<\//,           // HTML close tags
  /system:/i,      // System role injection
  /\[INST\]/,      // Llama-style instruction
  /Human:/,        // Multi-turn role injection
  /Assistant:/,    // Role injection
  /ignore previous/i,
  /disregard/i,
  /\x00/,          // Null bytes
];

export function sanitizeForPrompt(input: string, maxLength: number): string {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      throw new BadRequestException({ code: 'PROMPT_INJECTION_DETECTED' });
    }
  }
  return input.slice(0, maxLength).trim();
}
```

---

## Output Validation (mandatory)

```typescript
const rawResponse = await this.anthropicClient.messages.create({ ... });
const content = rawResponse.content[0];
if (content.type !== 'text') throw new AiError('UNEXPECTED_CONTENT_TYPE');

let parsed: unknown;
try {
  parsed = JSON.parse(content.text);
} catch {
  throw new AiError('RESPONSE_NOT_JSON');
}

const result = MyAgentOutputSchema.safeParse(parsed);
if (!result.success) {
  this.logger.error({ issues: result.error.issues }, 'AI response schema mismatch');
  throw new AiError('RESPONSE_SCHEMA_INVALID');
}

return result.data;
```

---

## Rate Limiting

Per-org limits enforced in Redis (key: `ai:ratelimit:{orgId}:{agentName}`):

| Agent | Limit |
|-------|-------|
| search-intent-parser | 200/hour per org |
| deal-copilot | 60/hour per org |
| compliance-reviewer | 20/hour per org (admin only) |
| arbitration-brief | 5/hour per case |
| price-advisor | 100/hour per org |
| fraud-detector | System-only (no user limit) |
| document-extractor | 30/hour per org |
| notification-writer | System-only |

---

## AI Audit Log

Every `AiService` call appends an audit log entry:

```typescript
await this.auditService.log({
  actor: ctx.userId ?? 'system',
  actorOrgId: ctx.orgId,
  action: `ai.${agentName}`,
  entityType: options.entityType,
  entityId: options.entityId,
  afterHash: sha256(JSON.stringify(result)),
  traceId: ctx.traceId,
});
```

---

## Decision-Support Labeling

Any agent that returns content shown to users MUST include `isDecisionSupport: true` in its output schema. The frontend MUST render this as a visible disclaimer badge (use `<AiDisclaimer>` component).

**Never remove this field from the schema — it is an audit requirement.**

---

## PII Stripping Before AI Calls

Before passing any text to an AI prompt, strip PII patterns:

```typescript
// apps/api/src/ai/pii-stripper.ts

export function stripPii(text: string): string {
  return text
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR REDACTED]')  // Aadhaar
    .replace(/[A-Z]{5}\d{4}[A-Z]/g, '[PAN REDACTED]')              // PAN
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]/g, '[GSTIN REDACTED]')
    .replace(/\b[6-9]\d{9}\b/g, '[PHONE REDACTED]');               // Indian mobile
}
```

Apply `stripPii()` to ALL text fields (messages, statements, document excerpts) before inserting into prompts.

---

## Model Selection

| Use case | Model |
|----------|-------|
| All current agents | `claude-sonnet-4-6` |
| Arbitration brief (complex reasoning) | `claude-opus-4-8` (when needed) |
| Simple classification / extraction | `claude-haiku-4-5-20251001` |

Set via `AI_MODEL` env var for each agent type — do not hardcode in prompts.

---

## Fallback Strategy

```typescript
// Timeout → typed error, never silent null
// Schema mismatch → typed error, log the raw response at DEBUG level
// Rate limit → return 429 with { code: 'AI_RATE_LIMITED', retryAfterSeconds }
// Model unavailable → return 503 with { code: 'AI_UNAVAILABLE' }
```

**Never return partially validated AI output.** If Zod fails, the AI call failed.

---

## Structured Output Mode

When the Anthropic SDK supports it, use `response_format: { type: 'json_object' }` (or tool use with a single tool) to force JSON output. This reduces schema mismatch rate.

Example using tool-use forcing:
```typescript
const response = await this.client.messages.create({
  model: AI_MODEL,
  max_tokens: 1024,
  tools: [{
    name: 'output',
    description: 'Return the structured output',
    input_schema: zodToJsonSchema(MyAgentOutputSchema),
  }],
  tool_choice: { type: 'tool', name: 'output' },
  messages: [{ role: 'user', content: userContent }],
  system: systemPrompt,
});
```

---

## Testing AI Agents

Unit tests for agents MUST mock `AiService.complete()` — never make real API calls in tests.

```typescript
// In test setup:
const mockAiService = { complete: jest.fn() };
mockAiService.complete.mockResolvedValue(validFixtureOutput);

// Test happy path + schema mismatch case + rate limit case
```

Integration tests: use `AI_MOCK=true` env flag → AiService returns canned fixture responses.
