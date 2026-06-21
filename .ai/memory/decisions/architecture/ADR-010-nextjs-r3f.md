# ADR-010: Next.js App Router + React Three Fiber for 3D UI

**Status:** Accepted
**Date:** 2026-06-15
**Category:** architecture

## Context
B2B platform needs to differentiate from legacy portals. 3D visualizations communicate data effectively. Need SSR + heavy client-side 3D.

## Decision
Next.js 14 App Router for server components. React Three Fiber for 3D scenes (lazy-loaded, never SSR). Framer Motion for layout animations. GSAP for timeline sequences.

## Consequences
- (+) Server components keep TTFB fast
- (-) Three.js adds ~800KB — mitigated by lazy loading
- **Rule:** `prefers-reduced-motion` must disable animations
