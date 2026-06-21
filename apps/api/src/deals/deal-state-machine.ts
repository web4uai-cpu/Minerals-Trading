import { BadRequestException } from '@nestjs/common';
import { DealStatus } from '@khanij/types';
import {
  validateDealTransition,
  getLegalNextStates as _getLegalNextStates,
  isTerminalState as _isTerminalState,
  type TransitionContext,
} from '@khanij/deals';

export type { TransitionContext };
export { _getLegalNextStates as getLegalNextStates, _isTerminalState as isTerminalState };

export function assertDealTransition(
  from: DealStatus,
  to: DealStatus,
  context: TransitionContext = {},
): void {
  const result = validateDealTransition(from, to, context);
  if (!result.valid) {
    throw new BadRequestException({ code: result.code, message: result.message });
  }
}
