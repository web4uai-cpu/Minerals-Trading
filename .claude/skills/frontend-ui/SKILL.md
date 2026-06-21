# SKILL: Frontend UI — 3D, Animation & Component Patterns

> Consult this skill before writing any code in `apps/web/` or `packages/ui/`.  
> This is the visual design system for an institutional-grade minerals trading platform.

---

## Design Philosophy

Khanij Nexus targets procurement heads and compliance officers at large organisations — not consumers. The UI must convey **institutional credibility** while using progressive 3D and animation to differentiate from legacy portals.

**Design principles:**
1. **Data first** — Every screen's primary job is communicating structured information clearly.
2. **Trust signals prominent** — TrustScore, verification badges, compliance status always visible.
3. **Animation with purpose** — Motion communicates state change, not decoration. No gratuitous effects.
4. **Dark-first** — Dark background with mineral-palette accents (see tokens below).
5. **Accessible** — WCAG 2.1 AA. Reduced-motion respects `prefers-reduced-motion`.

---

## Color Tokens (tailwind.config.js)

```js
colors: {
  // Base (dark-first)
  'base-950': '#0A0B0D',   // page background
  'base-900': '#12141A',   // card background
  'base-800': '#1C1F28',   // elevated surface
  'base-700': '#252934',   // border, divider
  'base-500': '#6B7280',   // muted text
  'base-300': '#9CA3AF',   // secondary text
  'base-100': '#E5E7EB',   // primary text
  'base-50':  '#F9FAFB',   // bright text / light mode

  // Accent — iron ore amber / molten gold
  'accent':       '#D97706',   // primary CTA, TrustScore high
  'accent-light': '#FCD34D',   // gradient end, highlights
  'accent-dark':  '#92400E',   // hover states

  // Semantic
  'sage':         '#10B981',   // verified / success
  'crimson':      '#EF4444',   // error / rejected / disputed
  'cobalt':       '#3B82F6',   // info / AI messages
  'amber':        '#F59E0B',   // warning / pending

  // Mineral palette
  'iron':   '#6B7280',
  'copper': '#B45309',
  'coal':   '#374151',
  'bauxite':'#92400E',
}
```

---

## Typography Scale

```js
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
  display: ['Cal Sans', 'Inter', 'sans-serif'],  // hero headings only
}
```

| Class | Use |
|-------|-----|
| `text-xs` | Labels, metadata, badges |
| `text-sm` | Table cells, secondary content |
| `text-base` | Body copy |
| `text-lg` | Card titles |
| `text-xl` | Section headings |
| `text-2xl–4xl` | Page headings |
| `text-5xl–7xl` | Hero / landing only (display font) |

---

## Animation Library Stack

| Library | Purpose | Install |
|---------|---------|---------|
| **Framer Motion** | Page transitions, layout animations, gesture-driven UI | `framer-motion` |
| **React Three Fiber (R3F)** | 3D scenes: globe, mineral visualizer, price chart surface | `@react-three/fiber` + `@react-three/drei` + `three` |
| **GSAP** | Complex timeline sequences (landing hero, onboarding steps) | `gsap` + `@gsap/react` |
| **Lottie React** | Micro-animations: loading states, success/error, empty states | `lottie-react` |
| **Recharts** | 2D data charts (TrustScore history, price trends) | `recharts` |
| **D3.js** | Custom visualizations (compliance radar, mineral heatmap) | `d3` |

**Rule:** Import 3D/animation libraries lazily with `next/dynamic` and `ssr: false`.

---

## 3D Scene Specifications

### 3.1 Landing Globe (`components/3d/Globe.tsx`)
- Earth globe (ap-south-1 centered on India) with animated mineral deposit markers
- Mining state clusters (Odisha, Rajasthan, Jharkhand, Goa) glow based on activity
- Click on state → filter discovery results
- Implemented with R3F + `@react-three/drei` `<Globe>` or custom sphere geometry
- Particle effect: ore dust particles float upward from active mines
- **Performance:** LOD — high-poly desktop, low-poly mobile. Suspend with `<Suspense>`.

### 3.2 TrustScore Gauge (`components/3d/TrustGauge.tsx`)
- 3D arc-gauge (not flat SVG) — mineral-textured arc fills 0–100
- Needle sweeps on score change (spring animation via Framer Motion / GSAP)
- Color: crimson (0–40) → amber (40–70) → sage (70–100)
- Particle burst on score increase

### 3.3 Mineral 3D Card (`components/3d/MineralCard.tsx`)
- Listing card with 3D tilt effect on hover (CSS `perspective` + JS mouse-tracking)
- Mineral texture overlaid (iron ore = rusty red, coal = dark grey, copper = bronze)
- Not R3F — pure CSS 3D transform for performance

### 3.4 Deal Room Timeline (`components/3d/MilestoneTrack.tsx`)
- Horizontal 3D track with 6 milestone nodes
- Completed nodes: glowing sage orb
- Current node: pulsing amber orb
- Overdue: crimson with shake animation
- Connecting track: animated laser-line progress

### 3.5 Price Surface (`components/3d/PriceSurface.tsx`)
- 3D mesh surface chart showing price × time × grade
- Rotatable, zoomable
- R3F with custom shader for gradient coloring
- Only shown on Listing Detail and Price Advisor panel

---

## Framer Motion Patterns

### Page Transitions
```tsx
// Every page wraps content in:
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
```

### Card Hover
```tsx
<motion.div
  whileHover={{ scale: 1.02, y: -4 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
>
```

### List Stagger (search results, compliance items)
```tsx
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } }
}
const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
}
```

### Deal Status Change
```tsx
// Animate between status labels with layout animation
<AnimatePresence mode="wait">
  <motion.span key={status} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}>
    {statusLabel}
  </motion.span>
</AnimatePresence>
```

---

## Component Library Rules

### From `packages/ui/src/components/`
- `Button` — variants: `primary | secondary | ghost | danger`. Always has `disabled` and `loading` states.
- `Badge` — variants: `verified | pending | rejected | ai | deal-status`. Includes icon slot.
- `Card` — variants: `default | elevated | bordered`. Accepts `interactive` prop for hover effects.

### New shared components (add to `packages/ui`):
- `TrustScoreBadge` — shows score + trend arrow
- `ComplianceStatus` — traffic-light indicator per item
- `MineralIcon` — SVG icon per mineral type
- `DealStatusPill` — animated status chip
- `AiDisclaimer` — mustard banner: "AI-generated decision-support. Not legally binding."
- `MoneyDisplay` — formats paise to ₹ display string, never renders raw number

### shadcn/ui components to install:
```
Dialog, Sheet, Tabs, Table, Select, Input, Textarea, 
Tooltip, Toast, Skeleton, Progress, Avatar, DropdownMenu,
Accordion, Command (for search), Calendar, DatePicker
```

---

## Page Layout Templates

### Dashboard Layout
```
┌─────────────────────────────────────────────────────┐
│ TopNav: Logo | Search | Notifications | Profile     │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│ (240px)  │  ┌──────────┬──────────┬──────────┐    │
│ Nav links│  │ Metric 1 │ Metric 2 │ Metric 3 │    │
│          │  └──────────┴──────────┴──────────┘    │
│ TrustScore│  ┌─────────────────────────────────┐  │
│  Gauge   │  │ Primary table / content          │  │
│          │  └─────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────┘
```

### Deal Room Layout
```
┌─────────────────────────────────────────────────────┐
│ Deal Header: status, parties, value, actions        │
├───────────────────┬─────────────────────────────────┤
│  Milestone Track  │                                 │
│  (3D timeline)    │  Chat / Messages                │
├───────────────────┤  ├── Buyer messages             │
│  Deal Details     │  ├── Seller messages            │
│  - Grade spec     │  └── AI co-pilot messages       │
│  - Escrow balance │                                 │
│  - Documents      │  [ Message Input + /ai trigger ]│
└───────────────────┴─────────────────────────────────┘
```

---

## Performance Constraints

- All 3D scenes use `<Suspense>` + skeleton fallback while loading
- Globe loads only on `/discover` route — lazy import
- `prefers-reduced-motion` → disable all spring/inertia animations, keep opacity fades
- Target: LCP < 2.5s, FID < 100ms, CLS < 0.1
- 3D canvas elements have explicit `width` and `height` to prevent CLS
- Use `useInView` (react-intersection-observer) to start animations only when in viewport

---

## Accessibility

- All interactive elements: minimum 44×44px touch target
- Color is never the only indicator (always pair with icon or label)
- All 3D decorative elements have `aria-hidden="true"`
- Keyboard navigation: Tab order follows visual order
- Focus ring: `ring-2 ring-accent ring-offset-2 ring-offset-base-950`
- Screen reader: all charts have `<caption>` or `aria-label` describing the data
