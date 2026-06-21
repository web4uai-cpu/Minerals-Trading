'use client';

import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';
import Link from 'next/link';

interface QuickAction {
  label: string;
  href: string;
  description: string;
  roles?: string[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Browse Marketplace',
    href: '/marketplace',
    description: 'Search minerals and discover verified sellers',
  },
  {
    label: 'My Listings',
    href: '/listings',
    description: 'Manage your mineral listings',
    roles: ['SELLER', 'TRADER'],
  },
  {
    label: 'Active Deals',
    href: '/deals',
    description: 'Track ongoing deals, milestones, and payments',
  },
  {
    label: 'Compliance',
    href: '/compliance',
    description: 'Upload documents and check verification status',
  },
  {
    label: 'Trade Applications',
    href: '/trade',
    description: 'Manage export/import clearance applications',
    roles: ['SELLER', 'BUYER', 'TRADER'],
  },
  {
    label: 'Disputes',
    href: '/disputes',
    description: 'File or review dispute cases',
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';

  const actions = QUICK_ACTIONS.filter(
    (a) => !a.roles || a.roles.includes(role),
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-base-500 mt-1">
          Welcome back. You are signed in as{' '}
          <Badge variant={role === 'ADMIN' ? 'info' : role === 'SELLER' ? 'verified' : 'pending'}>
            {role}
          </Badge>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full hover:border-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>{action.label}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs text-accent-light">Open &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
