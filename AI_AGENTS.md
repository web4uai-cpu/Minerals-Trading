# Khanij Nexus — AI Agents Specification

> All agents call through `apps/api/src/ai/ai.service.ts`.  
> Prompts live in `apps/api/src/ai/prompts/`.  
> Every agent output is Zod-validated before use.  
> Agents are **decision-support only** — no auto-binding actions.

---

## Agent Architecture

```
User Action / System Event
        │
        ▼
 NestJS Service (e.g., DiscoveryService, DealService)
        │
        ▼
   AiService.complete(prompt, context)
        │  - Injects system instructions
        │  - Sanitizes user input (prompt injection guard)
        │  - Calls Anthropic Claude SDK
        │  - Parses + Zod-validates response
        │
        ▼
 Agent Response (typed, validated)
        │
        ▼
 Business logic acts on structured output
        │
        ▼
 Audit log entry (AI action recorded)
```

**Model:** `claude-sonnet-4-6` for all agents (balance of speed + quality).  
**Fallback:** If AI unavailable, surface a `AI_UNAVAILABLE` typed error — never silently degrade.

---

## Agent 1: Search Intent Parser

**File:** `apps/api/src/ai/prompts/parse-search.ts`  
**Trigger:** `POST /discovery/search` with a natural-language query  
**Service:** `DiscoveryService.search()`

### Purpose
Parse a free-text buyer query into a structured search specification, then hand off to Elasticsearch.

### Input Schema
```typescript
// Zod schema in packages/types/src/schemas.ts
SearchIntentSchema = z.object({
  query: z.string().max(500),
})
```

### Output Schema
```typescript
ParsedSearchSchema = z.object({
  mineralName: z.string().optional(),
  gradeConstraints: z.record(z.object({ min: z.number().optional(), max: z.number().optional() })).optional(),
  quantityMT: z.number().optional(),
  state: z.string().optional(),
  deadlineDays: z.number().optional(),
  priceMaxPaise: z.number().optional(),
  confidence: z.number().min(0).max(1),
})
```

### System Prompt (summary)
> "You parse Indian minerals trade queries. Extract structured search parameters.
> Return only valid JSON matching the schema. Never invent data not in the query."

### Guardrails
- User query is HTML-stripped and truncated to 500 chars before injection
- If confidence < 0.5, fall back to full-text Elasticsearch query

---

## Agent 2: Deal Co-Pilot

**File:** `apps/api/src/ai/prompts/deal-copilot.ts`  
**Trigger:** Buyer or seller sends a message to deal room containing `/ai` prefix OR deal enters `AGREEMENT_DRAFT`  
**Service:** `DealService.getAiMessage()`

### Purpose
- Draft agreement clauses from deal parameters
- Interpret uploaded contract language on request
- Flag risk terms (one-sided penalty clauses, jurisdiction traps)
- Summarize deal progress

### Input Context
```typescript
DealContextSchema = z.object({
  dealId: z.string(),
  mineralName: z.string(),
  grade: z.record(z.number()),
  quantityMT: z.number(),
  totalValuePaise: z.bigint(),
  buyerState: z.string(),
  sellerState: z.string(),
  arbitrationSeat: z.string().optional(),
  milestones: z.array(MilestoneSchema),
  userMessage: z.string().max(1000),
  senderRole: z.enum(['BUYER', 'SELLER']),
})
```

### Output Schema
```typescript
DealCopilotResponseSchema = z.object({
  content: z.string(),
  isDecisionSupport: z.literal(true),  // always true — label must appear in UI
  suggestedNextAction: z.enum([
    'REVIEW_CLAUSE', 'SIGN_AGREEMENT', 'FUND_ESCROW',
    'MARK_MILESTONE', 'FILE_DISPUTE', 'NONE'
  ]).optional(),
  riskFlags: z.array(z.string()).optional(),
})
```

### Guardrails
- All messages stored as `senderType=AI` in `DealMessage`
- User messages sanitized: strip HTML, reject if > 1000 chars
- AI cannot trigger state transitions — only suggest them
- Contract text from uploads is never passed to AI without user consent
- Every AI response includes `isDecisionSupport: true`, surfaced in UI as a disclaimer badge

---

## Agent 3: Compliance Document Reviewer

**File:** `apps/api/src/ai/prompts/compliance-reviewer.ts`  
**Trigger:** Admin clicks "AI Pre-Screen" on uploaded document  
**Service:** `ComplianceService.aiPreScreen()`

### Purpose
Pre-screen uploaded documents (OCR'd text) for:
- Document type match (e.g., confirm "MINING_LEASE" is actually a mining lease)
- Validity dates extraction
- Issuing authority validity
- Obvious red flags (expired on face, wrong jurisdiction)

### Input Schema
```typescript
CompliancePreScreenSchema = z.object({
  documentType: ComplianceItemTypeSchema,
  ocrText: z.string().max(5000),
  orgName: z.string(),
  orgState: z.string(),
})
```

### Output Schema
```typescript
CompliancePreScreenResultSchema = z.object({
  documentMatchesType: z.boolean(),
  extractedValidFrom: z.string().optional(),  // ISO date string
  extractedValidUntil: z.string().optional(),
  issuingAuthority: z.string().optional(),
  redFlags: z.array(z.string()),
  recommendedAction: z.enum(['APPROVE', 'REJECT', 'MANUAL_REVIEW']),
  confidence: z.number().min(0).max(1),
})
```

### Guardrails
- AI recommendation is advisory — admin always makes final decision
- OCR text is never logged in plaintext if it contains PII patterns
- Confidence < 0.7 → always routes to `MANUAL_REVIEW`
- Compliance status is written only by admin, never by AI directly

---

## Agent 4: Arbitration Brief Generator

**File:** `apps/api/src/ai/prompts/arbitration-brief.ts`  
**Trigger:** Arbitrator clicks "Generate AI Brief" in case detail  
**Service:** `ArbitrationService.generateBrief()`

### Purpose
Synthesize a structured dispute brief from:
- Deal parameters (grade, quantity, value)
- Milestone completion records
- Deal-room message history
- Evidence documents (OCR'd text)
- Claimant and respondent statements

### Input Schema
```typescript
ArbitrationBriefInputSchema = z.object({
  disputeId: z.string(),
  dealSummary: DealSummarySchema,
  claimantStatement: z.string().max(3000),
  respondentStatement: z.string().max(3000).optional(),
  milestoneTimeline: z.array(MilestoneSummarySchema),
  evidenceSummaries: z.array(z.string().max(500)),  // summaries, not full docs
})
```

### Output Schema
```typescript
ArbitrationBriefSchema = z.object({
  caseNumber: z.string(),
  partiesSummary: z.string(),
  disputedFacts: z.array(z.string()),
  agreedFacts: z.array(z.string()),
  claimantArguments: z.array(z.string()),
  respondentArguments: z.array(z.string()),
  evidenceHighlights: z.array(z.string()),
  potentialAwards: z.array(z.object({
    type: z.enum(['BUYER_WINS', 'SELLER_WINS', 'SPLIT']),
    rationale: z.string(),
  })),
  disclaimer: z.literal('AI-generated decision-support. Not legally binding. Arbitrator exercises independent judgment.'),
})
```

### Guardrails
- Brief is labeled prominently as AI-generated in the UI
- Award is issued by the human arbitrator, never by this agent
- PII (Aadhaar, PAN, phone numbers) is stripped from deal messages before passing to AI
- Full document text never passed — only admin-generated summaries

---

## Agent 5: Price Intelligence Advisor

**File:** `apps/api/src/ai/prompts/price-advisor.ts`  
**Trigger:** Seller creates/updates a listing, or buyer reviews a quote  
**Service:** `PriceFeedService.getAiInsight()`

### Purpose
Contextualize a proposed price relative to:
- Sandbox price feed data (no live LME/MCX in MVP)
- Recent deal prices for same mineral/grade (from DB)
- Seasonal patterns (seeded historical data)

### Input Schema
```typescript
PriceAdvisorInputSchema = z.object({
  mineralName: z.string(),
  grade: z.record(z.number()),
  quantityMT: z.number(),
  proposedPricePaise: z.bigint(),
  sellerState: z.string(),
  recentDealPrices: z.array(z.bigint()),  // from DB, max 10
  sandboxMarketPrice: z.bigint(),
})
```

### Output Schema
```typescript
PriceAdvisorOutputSchema = z.object({
  assessment: z.enum(['BELOW_MARKET', 'AT_MARKET', 'ABOVE_MARKET']),
  marketRangePaise: z.object({ min: z.bigint(), max: z.bigint() }),
  narrative: z.string().max(300),
  isDecisionSupport: z.literal(true),
})
```

### Guardrails
- Never states specific prices as facts — all from DB or sandbox feed
- Clearly labeled as advisory in UI
- Does not access real LME/MCX APIs in MVP

---

## Agent 6: Fraud Signal Detector

**File:** `apps/api/src/ai/prompts/fraud-detector.ts`  
**Trigger:** Background job on deal creation and on each message in deal room  
**Service:** `FraudDetectionService.analyzeSignals()`

### Purpose
Detect behavioral patterns suggesting fraud:
- Unusual price deviation (>> market)
- Messaging patterns (urgency pressure, off-platform payment requests)
- Velocity anomalies (too many deals, sudden listing dumps)
- Cross-org relationship flags (buyer/seller same PAN — SQL check first)

### Input Schema
```typescript
FraudSignalInputSchema = z.object({
  orgId: z.string(),
  recentDealCount: z.number(),
  recentMessageSamples: z.array(z.string().max(200)),  // max 5 messages, truncated
  priceDeviationPct: z.number(),
  trustScoreHistory: z.array(z.number()),
})
```

### Output Schema
```typescript
FraudSignalOutputSchema = z.object({
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  signals: z.array(z.string()),
  recommendedAction: z.enum(['NONE', 'FLAG_FOR_REVIEW', 'PAUSE_ORG']),
})
```

### Guardrails
- `PAUSE_ORG` recommendation triggers a human admin review queue item — never auto-executes
- Message samples stripped of PII patterns before analysis
- SQL heuristics run first (same-PAN check, velocity counts) — AI only if SQL triggers MEDIUM+

---

## Agent 7: Document Extraction Agent

**File:** `apps/api/src/ai/prompts/document-extractor.ts`  
**Trigger:** Document uploaded to compliance checklist  
**Service:** `DocumentAiService.extract()` (via SandboxDocumentAiProvider in MVP)

### Purpose
Extract structured metadata from uploaded documents:
- Mining lease: lease number, area, mineral, valid dates, issuing authority
- EC certificate: project number, conditions, valid dates
- IBM returns: year, quantity reported, mineral type

### Input Schema
```typescript
DocumentExtractionInputSchema = z.object({
  documentType: ComplianceItemTypeSchema,
  ocrText: z.string().max(8000),
})
```

### Output Schema
```typescript
DocumentExtractionResultSchema = z.object({
  fields: z.record(z.string()),  // extracted key-value pairs
  confidence: z.number().min(0).max(1),
})
```

### Guardrails
- Extracted data is pre-fill only — admin must confirm before saving
- OCR text containing Aadhaar patterns (12-digit numbers) is redacted before AI call
- In MVP, uses SandboxDocumentAiProvider (no real OCR) — returns seeded fixture data

---

## Agent 8: Notification Content Generator

**File:** `apps/api/src/ai/prompts/notification-writer.ts`  
**Trigger:** BullMQ notification jobs  
**Service:** `NotificationService.generateContent()`

### Purpose
Write concise, contextual notification messages (push + email subject lines) in plain English.

### Input Schema
```typescript
NotificationInputSchema = z.object({
  eventType: z.enum([
    'DEAL_CREATED', 'MILESTONE_OVERDUE', 'COMPLIANCE_EXPIRING',
    'DISPUTE_FILED', 'AWARD_ISSUED', 'QUOTE_RECEIVED'
  ]),
  recipientRole: z.enum(['BUYER', 'SELLER', 'ARBITRATOR', 'ADMIN']),
  context: z.record(z.string()),  // event-specific fields
})
```

### Output Schema
```typescript
NotificationOutputSchema = z.object({
  pushTitle: z.string().max(60),
  pushBody: z.string().max(120),
  emailSubject: z.string().max(80),
  emailPreview: z.string().max(200),
})
```

### Guardrails
- No PII in notification content (no Aadhaar, no PAN, no phone numbers)
- Template fallbacks available if AI unavailable (typed `NOTIFICATION_TEMPLATE` map)

---

## Common Agent Guardrails (apply to all)

1. **Input sanitization:** Strip HTML tags, remove null bytes, truncate to schema max length before any AI call.
2. **Prompt injection:** Reject inputs containing `</`, `system:`, `[INST]`, or `Human:` patterns.
3. **Zod validation:** Every response is parsed with `schema.safeParse()`. On failure, throw `AI_RESPONSE_INVALID`.
4. **No facts fabricated:** DB is the source of truth for prices, compliance status, org details. AI only interprets or drafts text.
5. **Audit logging:** Every AI call creates an audit entry with `action: ai.<agent_name>`, `entityId`, and response hash.
6. **Decision-support label:** Any AI output shown to users includes a visible disclaimer. Never auto-execute based solely on AI output.
7. **Rate limiting:** AI calls are rate-limited per org: 60/hour for deal copilot, 20/hour for search parser.
8. **Timeout:** All AI calls have a 30-second timeout. On timeout, surface `AI_TIMEOUT` typed error.
