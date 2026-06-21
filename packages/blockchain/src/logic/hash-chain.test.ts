import {
  computeAnchorHash,
  createAnchorProof,
  verifyAnchorProof,
  verifyChain,
  AnchorRecord,
} from './hash-chain';

function makeRecord(overrides: Partial<AnchorRecord> = {}): AnchorRecord {
  return {
    entityType: 'Deal',
    entityId: 'deal-001',
    contentHash: 'abc123',
    previousAnchorHash: null,
    timestamp: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('hash-chain', () => {
  describe('computeAnchorHash', () => {
    it('is deterministic — same input produces same hash', () => {
      const record = makeRecord();
      expect(computeAnchorHash(record)).toBe(computeAnchorHash(record));
    });

    it('produces different hash for different content', () => {
      const a = makeRecord({ contentHash: 'aaa' });
      const b = makeRecord({ contentHash: 'bbb' });
      expect(computeAnchorHash(a)).not.toBe(computeAnchorHash(b));
    });
  });

  describe('createAnchorProof', () => {
    it('returns a valid proof', () => {
      const proof = createAnchorProof(makeRecord());
      expect(proof.anchorHash).toBeTruthy();
      expect(proof.record).toEqual(makeRecord());
      expect(verifyAnchorProof(proof)).toBe(true);
    });
  });

  describe('verifyAnchorProof', () => {
    it('returns true for a valid proof', () => {
      const proof = createAnchorProof(makeRecord());
      expect(verifyAnchorProof(proof)).toBe(true);
    });

    it('returns false for a tampered proof', () => {
      const proof = createAnchorProof(makeRecord());
      proof.record.contentHash = 'tampered';
      expect(verifyAnchorProof(proof)).toBe(false);
    });
  });

  describe('verifyChain', () => {
    it('validates a valid chain', () => {
      const r1 = makeRecord();
      const p1 = createAnchorProof(r1);

      const r2 = makeRecord({
        entityId: 'deal-002',
        previousAnchorHash: p1.anchorHash,
        timestamp: '2024-01-02T00:00:00.000Z',
      });
      const p2 = createAnchorProof(r2);

      const r3 = makeRecord({
        entityId: 'deal-003',
        previousAnchorHash: p2.anchorHash,
        timestamp: '2024-01-03T00:00:00.000Z',
      });
      const p3 = createAnchorProof(r3);

      expect(verifyChain([p1, p2, p3])).toEqual({ valid: true });
    });

    it('detects a broken chain link', () => {
      const r1 = makeRecord();
      const p1 = createAnchorProof(r1);

      const r2 = makeRecord({
        entityId: 'deal-002',
        previousAnchorHash: 'wrong-hash',
        timestamp: '2024-01-02T00:00:00.000Z',
      });
      const p2 = createAnchorProof(r2);

      expect(verifyChain([p1, p2])).toEqual({ valid: false, brokenAt: 1 });
    });

    it('returns valid for an empty chain', () => {
      expect(verifyChain([])).toEqual({ valid: true });
    });
  });
});
