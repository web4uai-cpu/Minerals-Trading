/**
 * Agent definition types for the Khanij Nexus AI subsystem.
 *
 * An AgentDefinition describes a logical AI agent — its purpose, the schemas
 * it consumes/produces, and the guardrails that constrain its behaviour.
 * These definitions live in the domain package; AiService in apps/api
 * references them at runtime for prompt routing and validation setup.
 */

export interface AgentDefinition {
  /** Unique kebab-case identifier, e.g. "search-intent-parser". */
  name: string;

  /** Human-readable one-liner explaining what this agent does. */
  description: string;

  /** Tags describing what the agent can do (for discoverability). */
  capabilities: string[];

  /** Name of the Zod schema (in @khanij/types) that validates input context. */
  inputSchema: string;

  /** Name of the Zod schema (in @khanij/types) that validates AI output. */
  outputSchema: string;

  /**
   * Guardrail identifiers applied when this agent is invoked.
   *
   * Common guardrails:
   * - xml-data-tags          — user data wrapped in XML tags to prevent injection
   * - zod-output-validation  — output must pass Zod schema
   * - no-pii-in-prompt       — PII stripped before sending to Claude
   * - no-pii-in-output       — PII must not appear in AI output
   * - grounded-in-deal-data  — AI must only reference provided deal data
   * - grounded-in-price-data — AI must only reference provided price data
   * - no-price-invention     — AI must never fabricate prices
   * - no-state-transitions   — AI must not trigger deal state changes
   * - labeled-non-binding    — output must be labeled as non-legally-binding
   * - max-length-enforcement  — output must respect character limits
   */
  guardrails: string[];
}
