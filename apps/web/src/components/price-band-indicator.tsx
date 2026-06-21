'use client';

import { formatPaise } from '@/lib/format';

interface PriceBandProps {
  price: number;
  fairLow: number;
  fairHigh: number;
}

export function PriceBandIndicator({ price, fairLow, fairHigh }: PriceBandProps) {
  const range = fairHigh - fairLow;
  const position = range > 0 ? Math.min(Math.max((price - fairLow) / range, -0.2), 1.2) : 0.5;
  const percent = Math.round(position * 100);

  const label = price < fairLow ? 'Below Market' : price > fairHigh ? 'Above Market' : 'Fair Price';
  const color = price < fairLow ? 'text-sage' : price > fairHigh ? 'text-red-400' : 'text-accent-light';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-base-500 font-mono-nums">
        <span>{formatPaise(fairLow)}</span>
        <span className={`font-semibold ${color}`}>{label}</span>
        <span>{formatPaise(fairHigh)}</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-base-300">
        <div className="absolute inset-0 bg-gradient-to-r from-sage/60 via-accent/60 to-red-500/60 rounded-full" />
        <div
          className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg"
          style={{ left: `${Math.min(Math.max(percent, 2), 98)}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
}
