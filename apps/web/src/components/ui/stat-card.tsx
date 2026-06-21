'use client';

import { GlassCard } from './glass-card';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, suffix, trend }: StatCardProps) {
  return (
    <GlassCard className="p-5 text-center">
      <div className="text-xs uppercase tracking-wider text-base-500 mb-2">{label}</div>
      <div className="font-mono-nums text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm text-base-500 ml-1">{suffix}</span>}
      </div>
      {trend && (
        <div className={`text-xs mt-1 ${trend === 'up' ? 'text-sage' : trend === 'down' ? 'text-red-400' : 'text-base-500'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
        </div>
      )}
    </GlassCard>
  );
}
