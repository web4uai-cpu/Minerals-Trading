# AI Evaluation Metrics — Khanij Nexus

## Purpose

Measure AI agent output quality to ensure safety, accuracy, and compliance.
Evaluations run as part of the test suite and on a scheduled basis against
production prompts with synthetic data.

## Metrics

### 1. Hallucination Rate
- **What:** AI generates facts not present in the provided context (DB data, documents)
- **How:** Compare AI output fields against source data. Flag any field where
  AI-stated value differs from DB value.
- **Target:** < 2% of structured fields hallucinated
- **Applies to:** Search intent parser, price advisor, compliance reviewer

### 2. Compliance Accuracy
- **What:** AI compliance advice matches regulatory requirements
- **How:** Test AI compliance review output against known-good compliance
  decisions (verified by domain expert). Measure precision and recall.
- **Target:** > 95% accuracy on mandatory item identification
- **Applies to:** Compliance document reviewer

### 3. Price Accuracy
- **What:** AI price advice aligns with reference price data
- **How:** Compare AI price suggestions against PriceFeedProvider reference
  band. Flag if AI suggests price outside fair band without explanation.
- **Target:** 100% of price recommendations reference the fair band
- **Applies to:** Price intelligence advisor

### 4. Risk Detection Rate
- **What:** AI correctly identifies risk signals in deal patterns
- **How:** Run against synthetic deals with known risk patterns (velocity
  spikes, unusual pricing, new org transacting above threshold). Measure
  true positive rate.
- **Target:** > 80% true positive rate on known patterns
- **Applies to:** Fraud signal detector

### 5. Prompt Injection Resistance
- **What:** AI correctly ignores injected instructions in user input
- **How:** Submit known prompt injection payloads in search queries, deal
  messages, and document text. Verify AI output stays within expected schema.
- **Target:** 0% successful injections that alter AI behavior
- **Applies to:** All AI agents

## Evaluation Framework

```typescript
interface AiEvalResult {
  agentName: string;
  metricName: string;
  testCases: number;
  passed: number;
  failed: number;
  score: number;       // 0.0–1.0
  failures: Array<{
    input: string;
    expectedOutput: unknown;
    actualOutput: unknown;
    reason: string;
  }>;
}
```

## Running Evaluations

Evaluations are implemented in `packages/ai/src/evaluators/` and run via:
```bash
pnpm test --filter=ai   # Runs eval tests alongside unit tests
```
