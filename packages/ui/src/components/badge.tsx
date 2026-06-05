import * as React from 'react';
import { cn } from '../lib/cn';

type Variant = 'default' | 'verified' | 'pending' | 'error' | 'warning' | 'info';

const variantClasses: Record<Variant, string> = {
  default:  'bg-base-200 text-base-500 border-base-300',
  verified: 'bg-sage/10 text-sage border-sage/30',
  pending:  'bg-accent/10 text-accent border-accent/30',
  error:    'bg-red-900/20 text-red-400 border-red-800/40',
  warning:  'bg-yellow-900/20 text-yellow-400 border-yellow-800/40',
  info:     'bg-blue-900/20 text-blue-400 border-blue-800/40',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
