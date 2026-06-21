/**
 * Hallucination evaluator.
 *
 * Compares AI output fields against ground-truth data to detect
 * fabricated or mismatched values. Used by AiService and in eval
 * pipelines to verify that AI responses are grounded in source data.
 */

export interface HallucinationCheckInput {
  /** The AI-generated output object. */
  aiOutput: Record<string, unknown>;
  /** The ground-truth data to compare against. */
  groundTruth: Record<string, unknown>;
  /** Dot-notation field paths to check (e.g. ["mineralName", "deal.quantity"]). */
  fieldsToCheck: string[];
}

export interface HallucinationEntry {
  field: string;
  aiValue: unknown;
  truthValue: unknown;
}

export interface HallucinationCheckResult {
  /** True if no hallucinations were detected. */
  passed: boolean;
  /** List of fields where AI output diverged from ground truth. */
  hallucinations: HallucinationEntry[];
}

/**
 * Resolves a dot-notation path on an object.
 * Returns undefined if the path does not exist.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Checks whether a dot-notation path exists on an object
 * (the value may be null/undefined, but the key must be present).
 */
function hasNestedPath(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return false;
    }
    if (typeof current !== 'object') {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (!(part in record)) {
      return false;
    }
    current = record[part];
  }

  return true;
}

/**
 * Deep equality check for comparing AI output values against ground truth.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => deepEqual(val, b[idx]));
    }

    if (Array.isArray(a) || Array.isArray(b)) return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Compare AI output against ground truth for the specified fields.
 *
 * A hallucination is reported when:
 * 1. The field exists in both but the values differ.
 * 2. The field exists in aiOutput but not in groundTruth (fabricated data).
 *
 * Fields missing from aiOutput are NOT reported as hallucinations
 * (that is an omission, not a fabrication).
 */
export function checkHallucination(
  input: HallucinationCheckInput,
): HallucinationCheckResult {
  const { aiOutput, groundTruth, fieldsToCheck } = input;
  const hallucinations: HallucinationEntry[] = [];

  for (const field of fieldsToCheck) {
    const aiValue = getNestedValue(aiOutput, field);
    const truthValue = getNestedValue(groundTruth, field);

    const aiHasField = hasNestedPath(aiOutput, field);
    const truthHasField = hasNestedPath(groundTruth, field);

    // Skip if AI did not produce this field (omission, not hallucination)
    if (!aiHasField) {
      continue;
    }

    // Fabrication: AI produced a value for a field not in ground truth
    if (aiHasField && !truthHasField) {
      hallucinations.push({ field, aiValue, truthValue: undefined });
      continue;
    }

    // Mismatch: both have the field but values differ
    if (!deepEqual(aiValue, truthValue)) {
      hallucinations.push({ field, aiValue, truthValue });
    }
  }

  return {
    passed: hallucinations.length === 0,
    hallucinations,
  };
}
