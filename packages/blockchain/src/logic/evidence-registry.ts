import { createHash } from 'crypto';

export interface EvidenceAnchor {
  disputeId: string;
  evidenceId: string;
  contentHash: string;
  anchoredAt: string;
  anchorHash: string;
}

/**
 * Creates a timestamped, hashed anchor for a piece of dispute evidence.
 * The anchorHash covers all fields to detect any tampering.
 */
export function createEvidenceAnchor(
  disputeId: string,
  evidenceId: string,
  contentHash: string,
): EvidenceAnchor {
  const anchoredAt = new Date().toISOString();

  const payload = JSON.stringify({
    contentHash,
    disputeId,
    evidenceId,
    anchoredAt,
  });
  const anchorHash = createHash('sha256').update(payload).digest('hex');

  return {
    disputeId,
    evidenceId,
    contentHash,
    anchoredAt,
    anchorHash,
  };
}

/**
 * Verifies an evidence anchor by re-computing the hash and comparing.
 */
export function verifyEvidenceAnchor(anchor: EvidenceAnchor): boolean {
  const payload = JSON.stringify({
    contentHash: anchor.contentHash,
    disputeId: anchor.disputeId,
    evidenceId: anchor.evidenceId,
    anchoredAt: anchor.anchoredAt,
  });
  const expected = createHash('sha256').update(payload).digest('hex');
  return expected === anchor.anchorHash;
}
