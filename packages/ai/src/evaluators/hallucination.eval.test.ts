import { checkHallucination } from './hallucination.eval';

describe('checkHallucination', () => {
  it('passes when AI output matches ground truth for all checked fields', () => {
    const result = checkHallucination({
      aiOutput: { mineralName: 'Iron Ore', quantity: 500, unit: 'MT' },
      groundTruth: { mineralName: 'Iron Ore', quantity: 500, unit: 'MT' },
      fieldsToCheck: ['mineralName', 'quantity', 'unit'],
    });

    expect(result.passed).toBe(true);
    expect(result.hallucinations).toHaveLength(0);
  });

  it('detects a field value mismatch as a hallucination', () => {
    const result = checkHallucination({
      aiOutput: { mineralName: 'Copper Ore', quantity: 500 },
      groundTruth: { mineralName: 'Iron Ore', quantity: 500 },
      fieldsToCheck: ['mineralName', 'quantity'],
    });

    expect(result.passed).toBe(false);
    expect(result.hallucinations).toHaveLength(1);
    expect(result.hallucinations[0]).toEqual({
      field: 'mineralName',
      aiValue: 'Copper Ore',
      truthValue: 'Iron Ore',
    });
  });

  it('detects a field present in AI output but absent from ground truth as fabrication', () => {
    const result = checkHallucination({
      aiOutput: { mineralName: 'Iron Ore', inventedField: 'fake-data' },
      groundTruth: { mineralName: 'Iron Ore' },
      fieldsToCheck: ['mineralName', 'inventedField'],
    });

    expect(result.passed).toBe(false);
    expect(result.hallucinations).toHaveLength(1);
    expect(result.hallucinations[0]).toEqual({
      field: 'inventedField',
      aiValue: 'fake-data',
      truthValue: undefined,
    });
  });

  it('handles nested dot-notation fields correctly', () => {
    const result = checkHallucination({
      aiOutput: {
        deal: { mineralName: 'Manganese', quantity: 100 },
      },
      groundTruth: {
        deal: { mineralName: 'Iron Ore', quantity: 100 },
      },
      fieldsToCheck: ['deal.mineralName', 'deal.quantity'],
    });

    expect(result.passed).toBe(false);
    expect(result.hallucinations).toHaveLength(1);
    expect(result.hallucinations[0]).toEqual({
      field: 'deal.mineralName',
      aiValue: 'Manganese',
      truthValue: 'Iron Ore',
    });
  });

  it('passes when a checked field is null in both AI output and ground truth', () => {
    const result = checkHallucination({
      aiOutput: { mineralName: 'Iron Ore', neededBy: null },
      groundTruth: { mineralName: 'Iron Ore', neededBy: null },
      fieldsToCheck: ['mineralName', 'neededBy'],
    });

    expect(result.passed).toBe(true);
    expect(result.hallucinations).toHaveLength(0);
  });

  it('does not flag omissions (field missing from AI output) as hallucinations', () => {
    const result = checkHallucination({
      aiOutput: { mineralName: 'Iron Ore' },
      groundTruth: { mineralName: 'Iron Ore', quantity: 500 },
      fieldsToCheck: ['mineralName', 'quantity'],
    });

    expect(result.passed).toBe(true);
    expect(result.hallucinations).toHaveLength(0);
  });

  it('handles deeply nested objects with matching values', () => {
    const result = checkHallucination({
      aiOutput: {
        deal: { grade: { 'Fe%': 62, 'SiO2%': 3.5 } },
      },
      groundTruth: {
        deal: { grade: { 'Fe%': 62, 'SiO2%': 3.5 } },
      },
      fieldsToCheck: ['deal.grade'],
    });

    expect(result.passed).toBe(true);
    expect(result.hallucinations).toHaveLength(0);
  });

  it('detects mismatch in deeply nested object values', () => {
    const result = checkHallucination({
      aiOutput: {
        deal: { grade: { 'Fe%': 65 } },
      },
      groundTruth: {
        deal: { grade: { 'Fe%': 62 } },
      },
      fieldsToCheck: ['deal.grade'],
    });

    expect(result.passed).toBe(false);
    expect(result.hallucinations).toHaveLength(1);
    expect(result.hallucinations[0]?.field).toBe('deal.grade');
  });
});
