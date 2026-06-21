'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@khanij/ui';

interface LedgerEntry {
  id: string;
  type: string;
  amountPaise: number;
  createdAt: string;
}

interface EscrowPanelProps {
  dealId: string;
  ledger: LedgerEntry[];
  onUpdate: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  HOLD: 'text-accent-light',
  HELD: 'text-accent-light',
  RELEASE: 'text-sage',
  RELEASED: 'text-sage',
  REFUND: 'text-red-400',
  REFUNDED: 'text-red-400',
};

export function EscrowPanel({ dealId, ledger, onUpdate }: EscrowPanelProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalHeld = ledger
    .filter((e) => e.type === 'HOLD' || e.type === 'HELD')
    .reduce((sum, e) => sum + e.amountPaise, 0);
  const totalReleased = ledger
    .filter((e) => e.type === 'RELEASE' || e.type === 'RELEASED')
    .reduce((sum, e) => sum + e.amountPaise, 0);
  const balance = totalHeld - totalReleased;

  async function holdEscrow(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/v1/deals/${dealId}/escrow/hold`, {
        method: 'POST',
        body: JSON.stringify({ amountPaise: Number(amount) }),
      });
      setAmount('');
      onUpdate();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Held</div>
          <div className="font-mono-nums text-sm font-semibold text-accent-light">{formatPaise(totalHeld)}</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Released</div>
          <div className="font-mono-nums text-sm font-semibold text-sage">{formatPaise(totalReleased)}</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Balance</div>
          <div className="font-mono-nums text-sm font-bold text-white">{formatPaise(balance)}</div>
        </GlassCard>
      </div>

      {/* Hold Form */}
      <form onSubmit={holdEscrow} className="flex gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="glass-input flex-1 px-3 py-2 text-sm text-white font-mono-nums"
          placeholder="Amount in paise"
        />
        <Button size="sm" type="submit" isLoading={loading}>Hold Funds</Button>
      </form>
      {error && <div className="text-xs text-red-400">{error}</div>}

      {/* Ledger */}
      {ledger.length > 0 && (
        <GlassCard className="divide-y divide-white/5">
          {ledger.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className={`font-medium ${TYPE_COLORS[entry.type] ?? 'text-white'}`}>{entry.type}</span>
                <span className="text-base-500 ml-2 text-xs">
                  {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
              <span className={`font-mono-nums font-medium ${TYPE_COLORS[entry.type] ?? ''}`}>
                {formatPaise(entry.amountPaise)}
              </span>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
