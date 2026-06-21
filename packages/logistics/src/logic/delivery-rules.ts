export interface WeightVerification {
  weightAtOriginKg: number;
  weightAtDestinationKg: number;
  tolerancePercent: number; // default 2%
}

export interface WeightVerificationResult {
  passed: boolean;
  originKg: number;
  destinationKg: number;
  differenceKg: number;
  differencePercent: number;
  tolerancePercent: number;
  withinTolerance: boolean;
}

export function verifyWeight(input: WeightVerification): WeightVerificationResult {
  const differenceKg = Math.abs(input.weightAtOriginKg - input.weightAtDestinationKg);
  const differencePercent =
    input.weightAtOriginKg > 0
      ? (differenceKg / input.weightAtOriginKg) * 100
      : differenceKg > 0
        ? 100
        : 0;
  const withinTolerance = differencePercent <= input.tolerancePercent;

  return {
    passed: withinTolerance,
    originKg: input.weightAtOriginKg,
    destinationKg: input.weightAtDestinationKg,
    differenceKg,
    differencePercent,
    tolerancePercent: input.tolerancePercent,
    withinTolerance,
  };
}
