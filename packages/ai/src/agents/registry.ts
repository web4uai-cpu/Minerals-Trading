/**
 * Agent registry — the canonical list of AI agents available in Khanij Nexus.
 *
 * Each entry describes an agent's purpose, its input/output schemas (by name,
 * resolved at runtime from @khanij/types), and the guardrails enforced when
 * the agent is invoked via AiService.
 *
 * Adding a new agent? Add an entry here, create the corresponding prompt
 * template in ../prompts/, and register the Zod schemas in @khanij/types.
 */

import { AgentDefinition } from '../types/agent.types';

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    name: 'search-intent-parser',
    description:
      'Parses natural-language buyer query into structured search filters',
    capabilities: [
      'mineral-matching',
      'grade-parsing',
      'location-parsing',
      'date-parsing',
    ],
    inputSchema: 'SearchQuerySchema',
    outputSchema: 'SearchIntentSchema',
    guardrails: ['xml-data-tags', 'zod-output-validation', 'no-pii-in-prompt'],
  },
  {
    name: 'deal-contract-drafter',
    description:
      'Drafts deal contract from deal data, grade specs, fair price band, and standard clauses',
    capabilities: [
      'contract-drafting',
      'clause-generation',
      'mmdr-references',
    ],
    inputSchema: 'ContractDraftContextSchema',
    outputSchema: 'ContractDraftOutputSchema',
    guardrails: [
      'xml-data-tags',
      'zod-output-validation',
      'no-pii-in-prompt',
      'labeled-non-binding',
    ],
  },
  {
    name: 'deal-copilot',
    description:
      'Answers questions about a deal grounded in deal data and reference prices',
    capabilities: [
      'question-answering',
      'risk-surfacing',
      'clause-interpretation',
    ],
    inputSchema: 'DealCopilotContextSchema',
    outputSchema: 'DealCopilotResponseSchema',
    guardrails: [
      'xml-data-tags',
      'grounded-in-deal-data',
      'no-price-invention',
      'no-state-transitions',
    ],
  },
  {
    name: 'compliance-reviewer',
    description:
      'Pre-screens uploaded compliance documents for completeness and red flags',
    capabilities: [
      'document-review',
      'field-extraction',
      'red-flag-detection',
    ],
    inputSchema: 'ComplianceReviewContextSchema',
    outputSchema: 'ComplianceReviewOutputSchema',
    guardrails: [
      'xml-data-tags',
      'zod-output-validation',
      'no-pii-in-prompt',
      'no-pii-in-output',
    ],
  },
  {
    name: 'price-advisor',
    description:
      'Contextualizes proposed price vs market reference band',
    capabilities: ['price-analysis', 'market-comparison', 'trend-summary'],
    inputSchema: 'PriceAdvisorContextSchema',
    outputSchema: 'PriceAdvisorOutputSchema',
    guardrails: [
      'xml-data-tags',
      'grounded-in-price-data',
      'no-price-invention',
    ],
  },
  {
    name: 'notification-writer',
    description: 'Generates concise push/email notification text',
    capabilities: ['text-generation', 'subject-line', 'body-summary'],
    inputSchema: 'NotificationContextSchema',
    outputSchema: 'NotificationOutputSchema',
    guardrails: ['max-length-enforcement', 'no-pii-in-output'],
  },
] as const;

/**
 * Look up an agent definition by name.
 * Returns undefined if no agent matches.
 */
export function getAgentDefinition(
  name: string,
): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name);
}
