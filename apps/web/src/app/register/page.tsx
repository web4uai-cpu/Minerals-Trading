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

  const inputClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
  const selectClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">⬡</span>
          <h1 className="text-2xl font-bold mt-2 bg-gradient-to-r from-accent-light to-accent bg-clip-text text-transparent">
            Khanij Nexus
          </h1>
          <p className="text-base-500 text-sm mt-1">Create your organization account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-base-300 bg-base-50 p-6 space-y-4"
        >
          {error && (
            <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="legalName" className="block text-sm font-medium text-base-500 mb-1.5">
              Organization Legal Name
            </label>
            <input
              id="legalName"
              type="text"
              required
              value={form.legalName}
              onChange={(e) => update('legalName', e.target.value)}
              className={inputClass}
              placeholder="Acme Mining Pvt. Ltd."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="orgType" className="block text-sm font-medium text-base-500 mb-1.5">
                Organization Type
              </label>
              <select
                id="orgType"
                value={form.orgType}
                onChange={(e) => update('orgType', e.target.value)}
                className={selectClass}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-base-500 mb-1.5">
                State
              </label>
              <select
                id="state"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className={selectClass}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-base-500 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={inputClass}
              placeholder="contact@acme-mining.in"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-base-500 mb-1.5">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
              placeholder="+919876543210"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-base-500 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className={inputClass}
              placeholder="Min. 8 characters"
            />
          </div>

          <Button type="submit" className="w-full" isLoading={loading}>
            Create Account
          </Button>

          <p className="text-center text-sm text-base-500">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-light hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
