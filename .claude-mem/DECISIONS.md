# Significant Decisions Log

> Append-only. Most recent at top. See `docs/ADR.md` for formal ADRs.
> Use this for smaller day-to-day decisions that don't warrant a full ADR.

---

## 2026-06-15

### Documentation ecosystem created
Decided to create a comprehensive documentation ecosystem before proceeding with
feature code. Rationale: the web frontend is essentially empty (placeholder page
only), and building features without a clear spec risks divergence.

Files created:
- `PRD.md`, `APP_FLOW.md`, `AI_AGENTS.md`, `DATA_FLOW.md` (root)
- `docs/{ADR,FRONTEND,BACKEND,ANIMATION_3D,UI_COMPONENTS,TESTING,DEPLOYMENT,AI_AGENTS}.md`
- `.claude/settings.json` (project-level Claude Code permissions)
- `.claude/skills/{frontend-ui,ai-agents,backend-api,data-security}/SKILL.md` (4 new skills)
- `.claude-mem/` (this directory — in-project persistent memory)

### UI approach settled: 3D-accented dark-first institutional design
Decided on dark (`base-950` background), mineral amber/gold accent, three key 3D
scenes: India globe on discovery page, TrustScore gauge on dashboard, milestone
track in deal room. 3D is decorative and `aria-hidden`; all data available as text.

Libraries chosen: Framer Motion (layout/transitions), R3F + drei (3D), GSAP (hero
timelines), Lottie (micro-animations), Recharts (2D charts), D3 (custom viz).

### `.claude-mem/` over `.claude/memory/` for in-project memory
Chose `.claude-mem/` as the top-level directory name over nesting inside `.claude/`
because it makes the memory store more discoverable and distinct from Claude Code
configuration (`settings.json`, `skills/`).

---

### IMPLEMENTATION.md created as the canonical agent build plan
One file lists every phase in order with exact files to create, known bugs to fix
first (escrow BigInt bug in `escrow.service.ts`), and Definition of Done per phase.
Agents should read `.claude-mem/CONTEXT.md` → `IMPLEMENTATION.md` → start at Phase 5A.

### Dual-signature approach for deal SIGNED state
Chose Option B (append-only `deal_signatures` table) over Option A (two nullable
datetime columns on Deal) for the dual-signature requirement. Cleaner audit trail,
each signature is a separate immutable row with IP. Migration name:
`20260615000005_deal_signatures`. Documented in IMPLEMENTATION.md Phase 5D.

<!-- Claude: append new entries above this line -->
