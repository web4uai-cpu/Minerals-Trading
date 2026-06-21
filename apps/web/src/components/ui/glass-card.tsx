'use client';

import { cn } from '@khanij/ui';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glow?: boolean;
  strong?: boolean;
}

export function GlassCard({
  hoverable = false,
  glow = false,
  strong = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        hoverable && 'glass-hover cursor-pointer transition-all duration-200',
        glow && 'animate-glow',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
