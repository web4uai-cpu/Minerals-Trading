export {
  validateShipmentTransition,
  getLegalNextShipmentStates,
  isTerminalShipmentState,
  type ShipmentTransitionContext,
  type ShipmentTransitionResult,
} from './logic/shipment-state-machine';

export {
  verifyWeight,
  type WeightVerification,
  type WeightVerificationResult,
} from './logic/delivery-rules';

export {
  buildTrackingTimeline,
  type TrackingTimeline,
} from './logic/tracking-events';
