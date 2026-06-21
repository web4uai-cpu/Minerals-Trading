'use client';

import { cn } from '@khanij/ui';

interface Milestone {
  id: string;
  type: string;
  status: string;
  completedAt: string | null;
}

interface MilestoneStepperProps {
  milestones: Milestone[];
  onComplete?: (type: string) => void;
}

const STEP_ORDER = ['AGREEMENT', 'ESCROW', 'SAMPLING', 'DISPATCH', 'DELIVERY', 'PAYMENT'];

const STEP_LABELS: Record<string, string> = {
  AGREEMENT: 'Contract',
  ESCROW: 'Escrow',
  SAMPLING: 'Sampling',
  DISPATCH: 'Dispatch',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment',
};

export function MilestoneStepper({ milestones, onComplete }: MilestoneStepperProps) {
  const milestoneMap = new Map(milestones.map((m) => [m.type, m]));

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEP_ORDER.map((type, idx) => {
        const milestone = milestoneMap.get(type);
        const status = milestone?.status ?? 'PENDING';
        const isDone = status === 'DONE' || status === 'COMPLETED';
        const isActive = status === 'IN_PROGRESS';

        return (
          <div key={type} className="flex items-center">
            <div className="flex flex-col items-center min-w-[72px]">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  isDone && 'bg-sage/20 border-sage text-sage',
                  isActive && 'bg-accent/20 border-accent text-accent animate-pulse',
                  !isDone && !isActive && 'bg-white/5 border-white/20 text-base-500',
                )}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={cn(
                'text-[10px] mt-1.5 font-medium text-center',
                isDone ? 'text-sage' : isActive ? 'text-accent-light' : 'text-base-500',
              )}>
                {STEP_LABELS[type] ?? type}
              </span>
              {!isDone && onComplete && (
                <button
                  onClick={() => onComplete(type)}
                  className="text-[9px] text-accent-light hover:underline mt-0.5"
                >
                  Complete
                </button>
              )}
            </div>
            {idx < STEP_ORDER.length - 1 && (
              <div className={cn(
                'h-0.5 w-6 mx-0.5',
                isDone ? 'bg-sage/50' : 'bg-white/10',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
