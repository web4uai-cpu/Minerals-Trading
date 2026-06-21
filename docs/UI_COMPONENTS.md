# UI Component Library — Khanij Nexus

> Canonical list of components, their props, and usage rules.  
> Components in `packages/ui/src/` are shared web-only.  
> Components in `apps/web/src/components/` are app-specific.

---

## Shared Components (`packages/ui/`)

### Button
```tsx
<Button
  variant="primary" | "secondary" | "ghost" | "danger"
  size="sm" | "md" | "lg"
  loading={boolean}
  disabled={boolean}
  leftIcon={ReactNode}
  rightIcon={ReactNode}
/>
```
- Never disable a button without showing why (tooltip or inline message)
- `loading` shows spinner and prevents double-submit

### Badge
```tsx
<Badge
  variant="verified" | "pending" | "rejected" | "ai" | "suspended"
  size="sm" | "md"
  icon={ReactNode}
/>
```

### Card
```tsx
<Card
  variant="default" | "elevated" | "bordered"
  interactive={boolean}  // hover effect + cursor pointer
  padding="sm" | "md" | "lg"
/>
```

---

## App-Specific Components

### TrustScoreBadge
```tsx
<TrustScoreBadge
  score={72}           // 0–100
  previousScore={68}   // for trend arrow
  size="sm" | "md" | "lg"
  showLabel={boolean}
/>
```

**Rendering rules:**
- 0–39: crimson badge, "Low Trust"
- 40–69: amber badge, "Building Trust"
- 70–89: sage badge, "Trusted"
- 90–100: accent badge, "Highly Trusted"

### MoneyDisplay
```tsx
<MoneyDisplay
  paise={62500000n}    // always BigInt
  currency="INR"       // only INR supported
  compact={boolean}    // "₹6.25L" vs "₹6,25,000.00"
/>
```
**Never** render a money value without this component. Never pass a Number.

### DealStatusPill
```tsx
<DealStatusPill
  status="CREATED" | "AGREEMENT_DRAFT" | "SIGNED" | "ESCROW_PENDING" |
         "IN_FULFILMENT" | "COMPLETED" | "DISPUTED" | "CANCELLED"
  animated={boolean}  // pulse animation on IN_FULFILMENT
/>
```

### AiDisclaimer
```tsx
<AiDisclaimer
  variant="banner" | "inline" | "tooltip"
  message="AI-generated decision-support. Not legally binding."
/>
```
**Required** on every screen that shows AI-generated content.

### ComplianceStatus
```tsx
<ComplianceStatus
  type="MINING_LEASE" | "ENV_CLEARANCE" | ... 
  status="MISSING" | "UPLOADED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  validUntil={Date | undefined}
  onUpload={() => void}
/>
```

Traffic light: MISSING=grey, UPLOADED=blue, UNDER_REVIEW=amber, VERIFIED=sage, REJECTED=crimson, EXPIRED=red-orange.

### MineralIcon
```tsx
<MineralIcon
  mineral="iron_ore" | "coal" | "copper" | "bauxite" | "limestone" | "manganese" | ...
  size={16 | 24 | 32 | 48}
/>
```
SVG icons with mineral-appropriate colors. Used in listing cards and search results.

### ListingCard
```tsx
<ListingCard
  listing={ListingResponseDto}
  onSendRFQ={() => void}
  highlighted={boolean}   // top result highlight
  animate={boolean}       // stagger entrance animation
/>
```

Card shows: mineral icon, mineral name, grade summary, price per MT (₹), quantity, lead days, seller TrustScore badge, state location.

---

## Layout Components

### TopNav
```tsx
<TopNav
  user={JwtPayload}
  notificationCount={number}
  onNotificationsClick={() => void}
/>
```

Slots: left=logo, center=search (desktop), right=notifications+avatar dropdown.

### Sidebar
```tsx
<Sidebar
  role={UserRole}    // Renders role-appropriate nav items
  collapsed={boolean}
  onToggle={() => void}
/>
```

Nav items by role:
- BUYER: Dashboard, Discover, My RFQs, My Deals, Compliance, Profile
- SELLER: Dashboard, My Listings, RFQ Inbox, My Deals, Compliance, Profile
- ADMIN: Dashboard, Review Queue, Organizations, Disputes, Audit Log
- ARBITRATOR: My Cases, Profile
- REGULATOR_READONLY: Analytics, Organizations

### DashboardShell
```tsx
<DashboardShell>
  {/* Renders TopNav + Sidebar + main content area with page transition */}
</DashboardShell>
```

---

## Form Components

### DocumentUpload
```tsx
<DocumentUpload
  itemType="MINING_LEASE" | ...
  accept=".pdf,.jpg,.jpeg,.png,.webp"
  maxSizeMB={10}
  onUpload={(file: File) => Promise<void>}
  currentStatus={ComplianceItemStatus}
  existingDocumentUrl={string | undefined}
/>
```

Features:
- Drag-and-drop zone with animated border on hover
- File size + type validation client-side before upload
- Upload progress bar
- Preview for images, PDF icon for PDFs
- Replace existing document flow

### GradeParamsInput
```tsx
<GradeParamsInput
  mineral={Mineral}         // defines available grade params
  value={Record<string, number>}
  onChange={(v) => void}
/>
```

Dynamic fields based on `mineral.gradeParams` schema. Validated against schema ranges.

### SearchBar (Discovery)
```tsx
<SearchBar
  onSearch={(query: string) => void}
  isLoading={boolean}
  placeholder="e.g. 62% Fe iron ore, 5000 MT, Rajasthan"
  suggestions={string[]}
/>
```

Features:
- Command palette style (⌘K opens)
- Recent searches from localStorage
- AI-parsed intent preview below input

---

## Data Display Components

### ComplianceChecklist
```tsx
<ComplianceChecklist
  items={ComplianceItem[]}
  trustScore={number}
  onUpload={(type: ComplianceItemType) => void}
  readOnly={boolean}
/>
```

Renders all 12 compliance items grouped by category (mandatory/optional). Shows TrustScoreGauge at top.

### EscrowPanel
```tsx
<EscrowPanel
  dealId={string}
  entries={EscrowLedger[]}
  totalValuePaise={bigint}
/>
```

Shows: current balance, HELD/RELEASED/REFUNDED breakdown, timeline of entries. All amounts via `<MoneyDisplay>`.

### DealChat
```tsx
<DealChat
  dealId={string}
  messages={DealMessage[]}
  currentUser={JwtPayload}
  onSend={(content: string) => Promise<void>}
  aiEnabled={boolean}
/>
```

Message threading: buyer messages right-aligned (accent), seller messages left-aligned (sage), AI messages center with `<AiDisclaimer>` inline.

---

## shadcn/ui Components (install as needed)

Add via: `npx shadcn-ui@latest add {component}`

| Component | Used in |
|-----------|---------|
| `dialog` | Confirm modals, document preview |
| `sheet` | Mobile sidebar drawer |
| `tabs` | Deal room tabs (Chat / Docs / Escrow) |
| `table` | Listings, RFQs, audit log |
| `select` | Mineral picker, state picker |
| `input` | All text inputs |
| `textarea` | RFQ notes, dispute statement |
| `tooltip` | Badge explanations, TrustScore breakdown |
| `toast` | Success/error notifications |
| `skeleton` | Loading states for all data-fetching components |
| `progress` | File upload progress |
| `avatar` | User avatar in TopNav + deal chat |
| `dropdown-menu` | User profile menu, listing actions |
| `accordion` | Compliance checklist grouping |
| `command` | Search bar command palette |
| `calendar` | RFQ neededBy date picker |
| `popover` | Date pickers, filter dropdowns |

---

## Icon System

**Lucide React** for all icons (already included with shadcn/ui).

```tsx
import { Shield, TrendingUp, Package, FileText, Scale } from 'lucide-react';
```

Custom SVG icons (minerals): in `apps/web/src/components/icons/`.

---

## Spacing & Layout Tokens

```tsx
// Standard inner padding
'p-4'    // Card content
'p-6'    // Page sections
'p-8'    // Dashboard areas
'gap-4'  // Between cards
'gap-6'  // Between sections

// Responsive containers
'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'

// Grid layouts
'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'   // Card grids
'grid grid-cols-1 lg:grid-cols-3 gap-6'                   // 2/3 + 1/3 split
```
