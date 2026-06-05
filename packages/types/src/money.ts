/**
 * Money value object — all monetary amounts stored as integer paise (BIGINT).
 * Never use floats for financial calculations. This is a non-negotiable.
 *
 * Usage:
 *   const price = Money.fromRupees(1500.50);  // 150050 paise
 *   price.toPaise();     // 150050n
 *   price.toRupees();    // 1500.50
 *   price.format();      // "₹1,500.50"
 *   price.add(other);    // new Money
 */
export class Money {
  private readonly paise: bigint;

  private constructor(paise: bigint) {
    this.paise = paise;
  }

  /** Create from paise (integer). Primary constructor. */
  static fromPaise(paise: bigint | number): Money {
    const value = typeof paise === 'number' ? BigInt(Math.round(paise)) : paise;
    return new Money(value);
  }

  /** Create from rupees (decimal). Converts to paise internally. */
  static fromRupees(rupees: number): Money {
    if (!Number.isFinite(rupees)) {
      throw new Error('Money.fromRupees: value must be a finite number');
    }
    // Round to avoid floating-point artifacts
    const paise = BigInt(Math.round(rupees * 100));
    return new Money(paise);
  }

  /** Zero value. */
  static zero(): Money {
    return new Money(0n);
  }

  /** Get paise as bigint. */
  toPaise(): bigint {
    return this.paise;
  }

  /** Get paise as number (for JSON/DB serialization). Throws if > Number.MAX_SAFE_INTEGER. */
  toPaiseNumber(): number {
    if (this.paise > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Money.toPaiseNumber: value exceeds safe integer range');
    }
    return Number(this.paise);
  }

  /** Convert to rupees (decimal number). */
  toRupees(): number {
    return Number(this.paise) / 100;
  }

  /** Format as INR string. */
  format(locale = 'en-IN'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toRupees());
  }

  /** Add two Money values. */
  add(other: Money): Money {
    return new Money(this.paise + other.paise);
  }

  /** Subtract. Result can be negative (for refunds, adjustments). */
  subtract(other: Money): Money {
    return new Money(this.paise - other.paise);
  }

  /** Multiply by a scalar (e.g., quantity). */
  multiply(factor: number): Money {
    return Money.fromPaise(BigInt(Math.round(Number(this.paise) * factor)));
  }

  /** Check if zero. */
  isZero(): boolean {
    return this.paise === 0n;
  }

  /** Check if positive. */
  isPositive(): boolean {
    return this.paise > 0n;
  }

  /** Check if negative. */
  isNegative(): boolean {
    return this.paise < 0n;
  }

  /** Equals comparison. */
  equals(other: Money): boolean {
    return this.paise === other.paise;
  }

  /** Greater than comparison. */
  greaterThan(other: Money): boolean {
    return this.paise > other.paise;
  }

  /** Less than comparison. */
  lessThan(other: Money): boolean {
    return this.paise < other.paise;
  }

  /** Greater than or equal to. */
  greaterThanOrEqual(other: Money): boolean {
    return this.paise >= other.paise;
  }

  /** JSON serialization — always serialize as paise string to avoid precision loss. */
  toJSON(): string {
    return this.paise.toString();
  }

  /** String representation for debugging. */
  toString(): string {
    return `Money(${this.paise} paise)`;
  }
}
