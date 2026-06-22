'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, ApiRequestError } from '@/context/auth-context';
import { Button } from '@khanij/ui';

const ORG_TYPES = [
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SELLER', label: 'Seller / Mine Owner' },
  { value: 'TRADER', label: 'Trader' },
];

const STATES = [
  'Odisha', 'Jharkhand', 'Karnataka', 'Chhattisgarh', 'Goa',
  'Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Andhra Pradesh',
  'Tamil Nadu', 'Telangana', 'West Bengal', 'Gujarat',
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    legalName: '',
    orgType: 'BUYER',
    state: 'Odisha',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-mineral-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="no-underline hover:no-underline">
            <span className="text-4xl">⬡</span>
            <h1 className="text-2xl font-bold mt-2 text-gradient-gold">Mineral Trade</h1>
          </Link>
          <p className="text-base-500 text-sm mt-2">Create your organization account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong p-7 space-y-5">
          {error && (
            <div className="glass px-4 py-3 text-sm text-red-400 border-red-800/30">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
              Organization Legal Name
            </label>
            <input
              type="text"
              required
              value={form.legalName}
              onChange={(e) => update('legalName', e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
              placeholder="Acme Mining Pvt. Ltd."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
                Type
              </label>
              <select
                value={form.orgType}
                onChange={(e) => update('orgType', e.target.value)}
                className="glass-input w-full px-4 py-3 text-sm text-white"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-base-200 text-white">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
                State
              </label>
              <select
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className="glass-input w-full px-4 py-3 text-sm text-white"
              >
                {STATES.map((s) => (
                  <option key={s} value={s} className="bg-base-200 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
              placeholder="contact@acme-mining.in"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
                Phone
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
                placeholder="+919876543210"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
                placeholder="Min. 8 characters"
              />
            </div>
          </div>

          <Button type="submit" className="w-full !py-3 !text-base" isLoading={loading}>
            Create Account
          </Button>

          <p className="text-center text-sm text-base-500 pt-2">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-light font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
