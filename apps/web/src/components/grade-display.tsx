'use client';

interface GradeDisplayProps {
  grade: Record<string, number>;
  compact?: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  'Fe%': 'bg-accent',
  'Mn%': 'bg-purple-500',
  'silica%': 'bg-red-400',
  'alumina%': 'bg-blue-400',
  'Cr2O3%': 'bg-emerald-500',
};

export function GradeDisplay({ grade, compact = false }: GradeDisplayProps) {
  const entries = Object.entries(grade);

  if (compact) {
    return (
      <div className="flex gap-1.5 flex-wrap">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono-nums bg-white/5 border border-white/10"
          >
            <span className="text-base-500">{key}</span>
            <span className="text-white font-medium">{value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const maxVal = key.includes('Fe') ? 70 : key.includes('Mn') || key.includes('Cr') ? 50 : 20;
        const percent = Math.min((value / maxVal) * 100, 100);
        const barColor = GRADE_COLORS[key] ?? 'bg-accent/60';

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-base-500 w-16 text-right font-mono-nums">{key}</span>
            <div className="flex-1 h-2 rounded-full bg-base-300 overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs font-mono-nums text-white w-10">{value}%</span>
          </div>
        );
      })}
    </div>
  );
}
