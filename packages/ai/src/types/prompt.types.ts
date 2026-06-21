/**
 * Prompt template types for the Khanij Nexus AI subsystem.
 *
 * A PromptTemplate is a versioned, typed builder that converts a strongly-typed
 * context object into a plain-text prompt string. Versioning allows safe
 * iteration on prompts while keeping evaluation results traceable.
 */

export interface PromptTemplate<TContext = Record<string, unknown>> {
  /** Unique name matching the agent it serves, e.g. "draft-contract". */
  name: string;

  /**
   * Semantic version string (e.g. "1.0.0").
   * Bump when prompt wording changes to keep eval results traceable.
   */
  version: string;

  /** Builds the raw prompt string from a typed context object. */
  build: (context: TContext) => string;
}
