import { ShipmentStatus } from '@khanij/types';
import {
  validateShipmentTransition,
  getLegalNextShipmentStates,
  isTerminalShipmentState,
} from './shipment-state-machine';

describe('shipment-state-machine', () => {
  it('CREATED → DISPATCHED (happy)', () => {
    const result = validateShipmentTransition(ShipmentStatus.CREATED, ShipmentStatus.DISPATCHED);
    expect(result).toEqual({ valid: true });
  });

  it('DISPATCHED → IN_TRANSIT (happy)', () => {
    const result = validateShipmentTransition(ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT);
    expect(result).toEqual({ valid: true });
  });

  it('IN_TRANSIT → DELIVERED (happy)', () => {
    const result = validateShipmentTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED);
    expect(result).toEqual({ valid: true });
  });

  it('DELIVERED → CONFIRMED (happy, weight present)', () => {
    const result = validateShipmentTransition(
      ShipmentStatus.DELIVERED,
      ShipmentStatus.CONFIRMED,
      { hasWeightAtDestination: true },
    );
    expect(result).toEqual({ valid: true });
  });

  it('DELIVERED → CONFIRMED rejects without weight', () => {
    const result = validateShipmentTransition(
      ShipmentStatus.DELIVERED,
      ShipmentStatus.CONFIRMED,
    );
    expect(result).toEqual({
      valid: false,
      code: 'WEIGHT_NOT_RECORDED',
      message: 'Weight at destination must be recorded before confirming delivery',
    });
  });

  it('rejects illegal transition', () => {
    const result = validateShipmentTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('ILLEGAL_SHIPMENT_TRANSITION');
    }
  });

  it('rejects transitions from terminal states', () => {
    const confirmed = validateShipmentTransition(ShipmentStatus.CONFIRMED, ShipmentStatus.CREATED);
    expect(confirmed.valid).toBe(false);
    if (!confirmed.valid) expect(confirmed.code).toBe('SHIPMENT_TERMINAL_STATE');

    const cancelled = validateShipmentTransition(ShipmentStatus.CANCELLED, ShipmentStatus.CREATED);
    expect(cancelled.valid).toBe(false);
    if (!cancelled.valid) expect(cancelled.code).toBe('SHIPMENT_TERMINAL_STATE');
  });

  it('getLegalNextShipmentStates returns valid next states', () => {
    expect(getLegalNextShipmentStates(ShipmentStatus.CREATED)).toEqual([
      ShipmentStatus.DISPATCHED,
      ShipmentStatus.CANCELLED,
    ]);
    expect(getLegalNextShipmentStates(ShipmentStatus.CONFIRMED)).toEqual([]);
  });

  it('isTerminalShipmentState identifies terminal states', () => {
    expect(isTerminalShipmentState(ShipmentStatus.CONFIRMED)).toBe(true);
    expect(isTerminalShipmentState(ShipmentStatus.CANCELLED)).toBe(true);
    expect(isTerminalShipmentState(ShipmentStatus.CREATED)).toBe(false);
    expect(isTerminalShipmentState(ShipmentStatus.IN_TRANSIT)).toBe(false);
  });
});
