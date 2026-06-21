// @khanij/ai — AI agent system
//
// Prompt templates, evaluators, and agent definitions for the Khanij Nexus
// AI subsystem. Does NOT contain AiService (that stays in apps/api).
//
// This package provides prompt templates imported by AiService, and AI output
// evaluation functions for validating structured responses.

// --- Types ---
export type { AgentDefinition } from './types/agent.types';
export type { PromptTemplate } from './types/prompt.types';

// --- Agent registry ---
export { AGENT_REGISTRY, getAgentDefinition } from './agents/registry';

// --- Prompt templates ---
export {
  buildContractDraftPrompt,
  contractDraftPromptTemplate,
} from './prompts/draft-contract.prompt';
export type { ContractDraftContext } from './prompts/draft-contract.prompt';

export {
  buildNotificationPrompt,
  notificationPromptTemplate,
} from './prompts/notification-content.prompt';
export type { NotificationContext } from './prompts/notification-content.prompt';

export {
  buildPriceAdvisorPrompt,
  priceAdvisorPromptTemplate,
} from './prompts/price-advisor.prompt';
export type { PriceAdvisorContext } from './prompts/price-advisor.prompt';

export {
  buildFraudSignalPrompt,
  fraudSignalPromptTemplate,
} from './prompts/fraud-signal.prompt';
export type { FraudSignalContext } from './prompts/fraud-signal.prompt';

export {
  buildComplianceReviewPrompt,
  complianceReviewPromptTemplate,
} from './prompts/compliance-review.prompt';
export type { ComplianceReviewContext } from './prompts/compliance-review.prompt';

// --- Evaluators ---
export { checkHallucination } from './evaluators/hallucination.eval';
export type {
  HallucinationCheckInput,
  HallucinationCheckResult,
  HallucinationEntry,
} from './evaluators/hallucination.eval';
