import { createHash } from 'crypto';

export interface AnchorRecord {
  entityType: string;
  entityId: string;
  contentHash: string;
  previousAnchorHash: string | null;
  timestamp: string;
}

export interface AnchorProof {
  anchorHash: string;
  record: AnchorRecord;
}

/**
 * Deterministic SHA-256 hash of an AnchorRecord.
 * Keys are sorted to ensure determinism regardless of insertion order.
 */
export function computeAnchorHash(record: AnchorRecord): string {
  const sorted = JSON.stringify(record, Object.keys(record).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

export function createAnchorProof(record: AnchorRecord): AnchorProof {
  return { anchorHash: computeAnchorHash(record), record };
}

export function verifyAnchorProof(proof: AnchorProof): boolean {
  return computeAnchorHash(proof.record) === proof.anchorHash;
}

/**
 * Verifies a chain of anchor proofs:
 * 1. Each proof's hash is valid
 * 2. Each proof's previousAnchorHash matches the prior proof's anchorHash
 */
export function verifyChain(proofs: AnchorProof[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < proofs.length; i++) {
    const current = proofs[i]!;

    // Verify the proof's own hash
    if (!verifyAnchorProof(current)) {
      return { valid: false, brokenAt: i };
    }

    // Verify chain linkage
    if (i === 0) {
      if (current.record.previousAnchorHash !== null) {
        return { valid: false, brokenAt: i };
      }
    } else {
      if (current.record.previousAnchorHash !== proofs[i - 1]!.anchorHash) {
        return { valid: false, brokenAt: i };
      }
    }
  }

  return { valid: true };
}
