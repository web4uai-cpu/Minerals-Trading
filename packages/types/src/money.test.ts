import { Money } from './money';

describe('Money', () => {
  describe('creation', () => {
    it('creates from paise', () => {
      const m = Money.fromPaise(15050);
      expect(m.toPaise()).toBe(15050n);
    });

    it('creates from bigint paise', () => {
      const m = Money.fromPaise(15050n);
      expect(m.toPaise()).toBe(15050n);
    });

    it('creates from rupees', () => {
      const m = Money.fromRupees(150.50);
      expect(m.toPaise()).toBe(15050n);
    });

    it('handles rupee rounding correctly', () => {
      // 19.99 * 100 in float = 1998.9999...
      const m = Money.fromRupees(19.99);
      expect(m.toPaise()).toBe(1999n);
    });

    it('creates zero', () => {
      expect(Money.zero().isZero()).toBe(true);
    });

    it('rejects non-finite values', () => {
      expect(() => Money.fromRupees(Infinity)).toThrow();
      expect(() => Money.fromRupees(NaN)).toThrow();
    });
  });

  describe('arithmetic', () => {
    it('adds correctly', () => {
      const a = Money.fromPaise(1000);
      const b = Money.fromPaise(2500);
      expect(a.add(b).toPaise()).toBe(3500n);
    });

    it('subtracts correctly', () => {
      const a = Money.fromPaise(5000);
      const b = Money.fromPaise(2000);
      expect(a.subtract(b).toPaise()).toBe(3000n);
    });

    it('multiplies by scalar', () => {
      const m = Money.fromPaise(1000);
      expect(m.multiply(3).toPaise()).toBe(3000n);
    });

    it('multiply handles fractional quantities', () => {
      const m = Money.fromPaise(1000);
      expect(m.multiply(1.5).toPaise()).toBe(1500n);
    });
  });

  describe('comparisons', () => {
    const small = Money.fromPaise(100);
    const large = Money.fromPaise(500);

    it('equals', () => {
      expect(small.equals(Money.fromPaise(100))).toBe(true);
      expect(small.equals(large)).toBe(false);
    });

    it('greaterThan', () => {
      expect(large.greaterThan(small)).toBe(true);
      expect(small.greaterThan(large)).toBe(false);
    });

    it('lessThan', () => {
      expect(small.lessThan(large)).toBe(true);
    });

    it('signs', () => {
      expect(Money.fromPaise(100).isPositive()).toBe(true);
      expect(Money.fromPaise(-100).isNegative()).toBe(true);
      expect(Money.zero().isZero()).toBe(true);
    });
  });

  describe('formatting', () => {
    it('converts to rupees', () => {
      expect(Money.fromPaise(15050).toRupees()).toBe(150.50);
    });

    it('formats as INR', () => {
      const formatted = Money.fromPaise(150050).format('en-IN');
      expect(formatted).toContain('1,500.50');
    });

    it('serializes to JSON as paise string', () => {
      expect(Money.fromPaise(12345).toJSON()).toBe('12345');
    });

    it('toString for debugging', () => {
      expect(Money.fromPaise(100).toString()).toBe('Money(100 paise)');
    });
  });

  describe('toPaiseNumber', () => {
    it('works for safe values', () => {
      expect(Money.fromPaise(99999).toPaiseNumber()).toBe(99999);
    });
  });
});
