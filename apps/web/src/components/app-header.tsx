'use client';

import { useAuth } from '@/context/auth-context';
import { Badge, Button } from '@khanij/ui';

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 h-14 border-b border-base-300 bg-base-50/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <Badge variant={user?.role === 'ADMIN' ? 'info' : 'default'}>
          {user?.role ?? 'USER'}
        </Badge>
        <span className="text-sm text-base-500 max-w-[200px] truncate">
          {user?.email ?? ''}
        </span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
