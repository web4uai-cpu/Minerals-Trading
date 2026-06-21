'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, ApiRequestError } from '@/context/auth-context';
import { Button } from '@khanij/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="no-underline hover:no-underline">
            <span className="text-4xl">⬡</span>
            <h1 className="text-2xl font-bold mt-2 text-gradient-gold">Khanij Nexus</h1>
          </Link>
          <p className="text-base-500 text-sm mt-2">Sign in to your trading account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong p-7 space-y-5">
          {error && (
            <div className="glass px-4 py-3 text-sm text-red-400 border-red-800/30">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-base-500 mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm text-white placeholder:text-base-400"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full !py-3 !text-base" isLoading={loading}>
            Sign In
          </Button>

          <p className="text-center text-sm text-base-500 pt-2">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-accent-light font-medium">
              Register
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
