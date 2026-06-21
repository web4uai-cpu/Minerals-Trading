import {
  createEvidenceAnchor,
  verifyEvidenceAnchor,
} from './evidence-registry';

describe('evidence-registry', () => {
  it('creates a valid evidence anchor', () => {
    const anchor = createEvidenceAnchor('dispute-1', 'evidence-1', 'contenthash123');
    expect(anchor.disputeId).toBe('dispute-1');
    expect(anchor.evidenceId).toBe('evidence-1');
    expect(anchor.contentHash).toBe('contenthash123');
    expect(anchor.anchoredAt).toBeTruthy();
    expect(anchor.anchorHash).toBeTruthy();
  });

  it('verifies a valid evidence anchor', () => {
    const anchor = createEvidenceAnchor('dispute-1', 'evidence-1', 'contenthash123');
    expect(verifyEvidenceAnchor(anchor)).toBe(true);
  });

  it('detects a tampered evidence anchor', () => {
    const anchor = createEvidenceAnchor('dispute-1', 'evidence-1', 'contenthash123');
    anchor.contentHash = 'tampered';
    expect(verifyEvidenceAnchor(anchor)).toBe(false);
  });
});
