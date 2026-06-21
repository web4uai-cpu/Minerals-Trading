# Frontend Development Guide — Khanij Nexus

> Stack: Next.js 14 (App Router) · Tailwind · shadcn/ui · Framer Motion · R3F  
> Read alongside `.claude/skills/frontend-ui/SKILL.md` before writing any UI code.

---

## Project Structure (target)

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # Public routes group
│   │   │   ├── page.tsx              # Landing
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/              # Authenticated routes group
│   │   │   ├── layout.tsx            # Dashboard shell (sidebar + topnav)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── discover/page.tsx
│   │   │   ├── listings/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── rfqs/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── inbox/page.tsx    # Seller view
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── quote/page.tsx
│   │   │   ├── deals/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx     # Deal Room
│   │   │   ├── compliance/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── (admin)/                  # Admin routes group
│   │   │   ├── layout.tsx
│   │   │   ├── admin/page.tsx
│   │   │   ├── admin/compliance/page.tsx
│   │   │   ├── admin/orgs/page.tsx
│   │   │   └── admin/audit/page.tsx
│   │   ├── (arbitration)/            # Arbitrator routes
│   │   │   ├── arbitration/page.tsx
│   │   │   └── arbitration/[id]/page.tsx
│   │   └── layout.tsx                # Root layout (fonts, providers)
│   │
│   ├── components/
│   │   ├── 3d/                       # R3F scenes (lazy-loaded)
│   │   │   ├── Globe.tsx
│   │   │   ├── TrustGauge.tsx
│   │   │   ├── MineralCard3D.tsx
│   │   │   ├── MilestoneTrack.tsx
│   │   │   └── PriceSurface.tsx
│   │   ├── layout/
│   │   │   ├── TopNav.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── DashboardShell.tsx
│   │   │   └── PageTransition.tsx
│   │   ├── compliance/
│   │   │   ├── ComplianceChecklist.tsx
│   │   │   ├── ComplianceItemRow.tsx
│   │   │   └── DocumentUpload.tsx
│   │   ├── deal/
│   │   │   ├── DealRoom.tsx
│   │   │   ├── DealChat.tsx
│   │   │   ├── DealMilestones.tsx
│   │   │   ├── EscrowPanel.tsx
│   │   │   └── AiCopilotInput.tsx
│   │   ├── discovery/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   └── ListingCard.tsx
│   │   └── shared/
│   │       ├── AiDisclaimer.tsx
│   │       ├── MoneyDisplay.tsx
│   │       ├── TrustScoreBadge.tsx
│   │       ├── DealStatusPill.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Auth state, login, logout
│   │   ├── useDeal.ts                # WebSocket deal room
│   │   ├── useCompliance.ts          # Compliance checklist state
│   │   ├── useSearch.ts              # Discovery search
│   │   └── useMoneyFormat.ts         # Paise → ₹ display
│   │
│   ├── lib/
│   │   ├── api-client.ts             # Typed fetch wrapper
│   │   ├── ws-client.ts              # WebSocket client
│   │   ├── auth.ts                   # JWT token management
│   │   └── money.ts                  # Re-export from @khanij/types
│   │
│   ├── store/                        # Zustand state stores
│   │   ├── auth.store.ts
│   │   ├── deal.store.ts
│   │   └── notification.store.ts
│   │
│   └── types/
│       └── api.ts                    # API response types (re-export from @khanij/types)
```

---

## State Management

**Zustand** for client-side state (auth, deal room, notifications).  
**React Query (TanStack Query)** for server state (listings, compliance, RFQs).  
**No Redux** — overkill for this app.

```typescript
// store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  user: JwtPayload | null;
  accessToken: string | null;
  setAuth: (user: JwtPayload, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: 'khanij-auth', partialize: (s) => ({ user: s.user }) }
  )
);
// accessToken stored in memory only (not persisted)
```

---

## API Client Pattern

```typescript
// lib/api-client.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest<T>(
  path: string,
  options?: RequestInit & { schema?: ZodSchema<T> }
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',  // for httpOnly refresh token cookie
  });

  if (res.status === 401) {
    // Attempt token refresh, retry once
    await refreshAccessToken();
    return apiRequest(path, options);
  }

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(error.code, error.message, res.status);
  }

  const data = await res.json();
  return options?.schema ? options.schema.parse(data) : data;
}
```

---

## WebSocket Client (Deal Room)

```typescript
// lib/ws-client.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getDealSocket(token: string): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/deals`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
  }
  return socket;
}
```

---

## Authentication Flow (Web)

```
Login form → POST /auth/login
  │  Response: { accessToken, user }
  │  Cookie set by server: httpOnly refresh token
  │
  ▼
AuthStore.setAuth(user, accessToken)
  │  accessToken in memory (not localStorage — XSS protection)
  │
  ▼
Protected routes: middleware.ts checks accessToken presence
  │  On 401: call /auth/refresh (cookie sent automatically)
  │  On refresh success: retry original request
  │  On refresh failure: redirect to /login
```

---

## Route Protection

```typescript
// middleware.ts (Next.js)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/about'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Check for auth cookie presence (actual validation happens at API)
  const refreshToken = request.cookies.get('refresh_token');
  if (!refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] };
```

---

## 3D Scene Integration Pattern

```tsx
// components/3d/Globe.tsx
'use client';
import dynamic from 'next/dynamic';

// Never SSR 3D scenes
const GlobeScene = dynamic(() => import('./GlobeScene'), { ssr: false });

export function Globe({ onStateSelect }: { onStateSelect: (state: string) => void }) {
  return (
    <div className="w-full h-[500px]" aria-hidden="true">
      <Suspense fallback={<GlobeSkeleton />}>
        <GlobeScene onStateSelect={onStateSelect} />
      </Suspense>
    </div>
  );
}
```

---

## Form Validation Pattern

```tsx
// Use react-hook-form + Zod resolver
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateListingSchema } from '@khanij/types';

export function ListingForm() {
  const form = useForm({
    resolver: zodResolver(CreateListingSchema),
    defaultValues: { ... },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await apiRequest('/listings', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
  });

  return <form onSubmit={onSubmit}> ... </form>;
}
```

---

## Error Handling UI

```tsx
// Global error boundary
<ErrorBoundary fallback={<ErrorPage />}>
  {children}
</ErrorBoundary>

// Per-query error
const { data, error } = useQuery({ queryKey: ['listings'], queryFn: fetchListings });
if (error) return <InlineError code={error.code} message={error.message} />;

// Form field errors
<FormMessage>{form.formState.errors.mineralId?.message}</FormMessage>
```

---

## Performance Checklist

- [ ] All 3D scenes: `dynamic` import with `ssr: false`
- [ ] Images: `next/image` with explicit `width` and `height`
- [ ] Heavy data tables: virtualized with `@tanstack/react-virtual`
- [ ] Deal chat: paginated (load last 50 messages, scroll-to-load-more)
- [ ] Search results: debounced (300ms) + React Query cache
- [ ] Fonts: loaded via `next/font/google` — no external requests at runtime
- [ ] Bundle: `@next/bundle-analyzer` in CI to catch regressions
