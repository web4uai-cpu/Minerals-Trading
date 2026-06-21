'use client';

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

interface Mineral {
  id: string;
  name: string;
  gradeParams: string[];
}

interface Listing {
  id: string;
  mineralName?: string;
  mineralId: string;
  grade: Record<string, number>;
  quantityAvailable: number;
  unit: string;
  askPriceInPaise: number;
  location: { district: string; state: string };
  status: string;
  dispatchLeadDays: number;
}

const STATES = [
  'Odisha', 'Jharkhand', 'Karnataka', 'Chhattisgarh', 'Goa',
  'Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Andhra Pradesh',
];

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'default'> = {
  ACTIVE: 'verified',
  PAUSED: 'pending',
  DRAFT: 'default',
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    mineralId: '',
    grade: '{}',
    quantityAvailable: '',
    unit: 'MT',
    askPriceInPaise: '',
    district: '',
    state: 'Odisha',
    dispatchLeadDays: '7',
  });

  useEffect(() => {
    Promise.all([
      api<Listing[]>('/api/v1/listings').catch(() => []),
      api<Mineral[]>('/api/v1/catalog').catch(() => []),
    ]).then(([l, m]) => {
      setListings(l);
      setMinerals(m);
      if (m.length > 0 && !form.mineralId) {
        setForm((prev) => ({ ...prev, mineralId: m[0]?.id ?? '' }));
      }
    }).finally(() => setLoading(false));
  }, []);

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let grade: Record<string, number> = {};
      try {
        grade = JSON.parse(form.grade);
      } catch {
        setError('Grade must be valid JSON, e.g. {"Fe%": 62}');
        setSaving(false);
        return;
      }

      const listing = await api<Listing>('/api/v1/listings', {
        method: 'POST',
        body: JSON.stringify({
          mineralId: form.mineralId,
          grade,
          quantityAvailable: Number(form.quantityAvailable),
          unit: form.unit,
          askPriceInPaise: Number(form.askPriceInPaise),
          location: { district: form.district, state: form.state },
          dispatchLeadDays: Number(form.dispatchLeadDays),
        }),
      });
      setListings((prev) => [listing, ...prev]);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError('Failed to create listing');
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(listing: Listing) {
    const action = listing.status === 'ACTIVE' ? 'pause' : 'activate';
    try {
      const updated = await api<Listing>(`/api/v1/listings/${listing.id}/${action}`, {
        method: 'PATCH',
      });
      setListings((prev) => prev.map((l) => (l.id === listing.id ? updated : l)));
    } catch {
      // Silently fail — user sees no change
    }
  }

  const inputClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
  const selectClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-base-500 mt-1">Manage your mineral listings</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Listing'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create Listing</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Mineral</label>
                  <select value={form.mineralId} onChange={(e) => update('mineralId', e.target.value)} className={selectClass}>
                    {minerals.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Grade (JSON)</label>
                  <input value={form.grade} onChange={(e) => update('grade', e.target.value)} className={inputClass} placeholder='{"Fe%": 62}' />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Quantity</label>
                  <input type="number" value={form.quantityAvailable} onChange={(e) => update('quantityAvailable', e.target.value)} className={inputClass} placeholder="5000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Unit</label>
                  <select value={form.unit} onChange={(e) => update('unit', e.target.value)} className={selectClass}>
                    <option value="MT">MT</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Ask Price (paise/MT)</label>
                  <input type="number" value={form.askPriceInPaise} onChange={(e) => update('askPriceInPaise', e.target.value)} className={inputClass} placeholder="585000" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">District</label>
                  <input value={form.district} onChange={(e) => update('district', e.target.value)} className={inputClass} placeholder="Keonjhar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">State</label>
                  <select value={form.state} onChange={(e) => update('state', e.target.value)} className={selectClass}>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Dispatch Lead (days)</label>
                  <input type="number" value={form.dispatchLeadDays} onChange={(e) => update('dispatchLeadDays', e.target.value)} className={inputClass} placeholder="7" />
                </div>
              </div>
              <Button type="submit" isLoading={saving}>Create Listing</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {listings.length === 0 && !showForm && (
        <div className="text-center py-12 text-base-500">
          No listings yet. Click &quot;New Listing&quot; to create one.
        </div>
      )}

      <div className="space-y-3">
        {listings.map((listing) => (
          <Card key={listing.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{listing.mineralName ?? 'Mineral'}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[listing.status] ?? 'default'}>
                    {listing.status}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(listing)}>
                    {listing.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              </div>
              <CardDescription>
                {listing.location.district}, {listing.location.state} · {listing.dispatchLeadDays}d lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-base-500">Grade: </span>
                  <span className="font-mono">
                    {Object.entries(listing.grade).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-base-500">Qty: </span>
                  <span>{listing.quantityAvailable.toLocaleString()} {listing.unit}</span>
                </div>
                <div>
                  <span className="text-base-500">Price: </span>
                  <span className="text-accent-light">{formatPaise(listing.askPriceInPaise)}/{listing.unit}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
