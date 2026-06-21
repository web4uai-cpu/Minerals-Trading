# Prompt Registry — Khanij Nexus

> Single source of truth for all AI prompts. No hardcoded prompts allowed
> outside registered entries. Every prompt must have a Zod-validated output
> schema.

## Registry

| Name | Path | Version | Purpose | Input Schema | Output Schema |
|------|------|---------|---------|--------------|---------------|
| `parse-search` | `packages/ai/src/prompts/parse-search.prompt.ts` | 1.0 | Parse natural-language buyer query into structured search filters | `SearchQuerySchema` | `SearchIntentSchema` |

## Rules

1. **All prompts live in `packages/ai/src/prompts/`** — never inline prompts in
   services or controllers.
2. **Every prompt file exports**: a template function, an input Zod schema, and
   an output Zod schema.
3. **Output is always Zod-validated** — if the AI returns malformed JSON, the
   caller gets `null` or a typed error, never raw text.
4. **Versioning** — increment version when prompt text changes materially.
   Keep the old version commented or in git history for rollback.
5. **Prompt injection defense** — user-supplied strings are wrapped in XML data
   tags (`<user_query>`, `<document_text>`) and the system prompt explicitly
   instructs the model to treat them as data, not instructions.
6. **No PII in prompts** — strip Aadhaar, PAN, bank details, phone numbers
   before including any user-supplied content.
7. **Update this registry** when adding a new prompt.

## Planned Prompts (not yet implemented)

| Name | Phase | Purpose |
|------|-------|---------|
| `draft-contract` | 6 | Generate deal contract draft from quote + terms |
| `arbitration-brief` | 9 | Synthesize dispute brief from deal evidence |
| `price-advisor` | 11 | Contextualize price vs. market reference band |
| `compliance-review` | 11 | Pre-screen uploaded compliance documents |
| `fraud-signal` | 11 | Analyze behavioral patterns for risk signals |
| `notification-content` | 6 | Generate concise push/email notification text |
