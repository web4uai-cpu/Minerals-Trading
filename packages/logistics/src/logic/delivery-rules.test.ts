import { verifyWeight } from './delivery-rules';

describe('delivery-rules / verifyWeight', () => {
  it('passes when weight is within 2% tolerance', () => {
    const result = verifyWeight({
      weightAtOriginKg: 1000,
      weightAtDestinationKg: 985,
      tolerancePercent: 2,
    });
    expect(result.passed).toBe(true);
    expect(result.withinTolerance).toBe(true);
    expect(result.differenceKg).toBe(15);
    expect(result.differencePercent).toBeCloseTo(1.5);
  });

  it('fails when weight is outside tolerance', () => {
    const result = verifyWeight({
      weightAtOriginKg: 1000,
      weightAtDestinationKg: 950,
      tolerancePercent: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.withinTolerance).toBe(false);
    expect(result.differenceKg).toBe(50);
    expect(result.differencePercent).toBeCloseTo(5.0);
  });

  it('passes on exact match', () => {
    const result = verifyWeight({
      weightAtOriginKg: 500,
      weightAtDestinationKg: 500,
      tolerancePercent: 2,
    });
    expect(result.passed).toBe(true);
    expect(result.differenceKg).toBe(0);
    expect(result.differencePercent).toBe(0);
  });

  it('respects custom tolerance', () => {
    const result = verifyWeight({
      weightAtOriginKg: 1000,
      weightAtDestinationKg: 950,
      tolerancePercent: 5,
    });
    expect(result.passed).toBe(true);
    expect(result.tolerancePercent).toBe(5);
    expect(result.differencePercent).toBeCloseTo(5.0);
  });
});
