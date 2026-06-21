import { ShipmentStatus } from '@khanij/types';

const TERMINAL_STATES: ShipmentStatus[] = [
  ShipmentStatus.CONFIRMED,
  ShipmentStatus.CANCELLED,
];

const LEGAL_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DISPATCHED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DELIVERED]: [ShipmentStatus.CONFIRMED],
  [ShipmentStatus.CONFIRMED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

export interface ShipmentTransitionContext {
  hasWeightAtDestination?: boolean;
}

export type ShipmentTransitionResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export function validateShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  context?: ShipmentTransitionContext,
): ShipmentTransitionResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      code: 'SHIPMENT_TERMINAL_STATE',
      message: `Shipment is in terminal state ${from} — no further transitions allowed`,
    };
  }

  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      code: 'ILLEGAL_SHIPMENT_TRANSITION',
      message: `Cannot transition shipment from ${from} to ${to}`,
    };
  }

  if (to === ShipmentStatus.CONFIRMED && !context?.hasWeightAtDestination) {
    return {
      valid: false,
      code: 'WEIGHT_NOT_RECORDED',
      message: 'Weight at destination must be recorded before confirming delivery',
    };
  }

  return { valid: true };
}

export function getLegalNextShipmentStates(from: ShipmentStatus): ShipmentStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}

export function isTerminalShipmentState(status: ShipmentStatus): boolean {
  return TERMINAL_STATES.includes(status);
}
