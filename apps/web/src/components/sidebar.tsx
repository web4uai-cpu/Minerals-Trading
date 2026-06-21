'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@khanij/ui';

interface NavItem {
  label: string;
  href: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'My Listings', href: '/listings', roles: ['SELLER', 'TRADER'] },
  { label: 'RFQs', href: '/rfqs' },
  { label: 'Auctions', href: '/auctions' },
  { label: 'Deals', href: '/deals' },
  { label: 'Shipments', href: '/shipments' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Trade', href: '/trade', roles: ['SELLER', 'BUYER', 'TRADER'] },
  { label: 'Disputes', href: '/disputes' },
  { label: 'Admin', href: '/admin', roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role ?? '';

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-base-300 bg-base-50 flex flex-col">
      <div className="p-5 border-b border-base-300">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">⬡</span>
          <span className="text-lg font-bold bg-gradient-to-r from-accent-light to-accent bg-clip-text text-transparent">
            Khanij Nexus
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-base-500 hover:bg-base-200 hover:text-white',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-base-300">
        <div className="text-xs text-base-500">
          <span className="px-2 py-0.5 rounded-full bg-base-200 border border-base-300">
            Pre-Alpha
          </span>
        </div>
      </div>
    </aside>
  );
}
