# Khanij Nexus — Documentation Set

Complete file placement guide for the project.

## File placement

```
khanij-nexus/
├── README.md                              ← project entry point
├── CLAUDE.md                              ← Claude Code master context (auto-loaded)
├── ARCHITECTURE.md                        ← system design + rationale
├── SECURITY.md                            ← security model + PII rules
├── CONTRIBUTING.md                        ← dev workflow + Definition of Done
├── PRD.md                                 ← product requirements, personas, feature list
├── APP_FLOW.md                            ← all user journeys, screen inventory, API map
├── AI_AGENTS.md                           ← 8 AI agents fully specified
├── DATA_FLOW.md                           ← 11 data flow diagrams
├── .env.example                           ← copy to .env, fill secrets
│
├── docs/
│   ├── DEV_PROMPT.md                      ← sequenced build prompts (Foundation → Arbitration)
│   ├── ADR.md                             ← 15 architecture decision records
│   ├── FRONTEND.md                        ← Next.js + R3F + Framer Motion dev guide
│   ├── BACKEND.md                         ← NestJS patterns, all endpoints, DB patterns
│   ├── ANIMATION_3D.md                    ← 3D scene implementations (Globe, Gauge, etc.)
│   ├── UI_COMPONENTS.md                   ← component library spec + shadcn/ui list
│   ├── AI_AGENTS.md                       ← AI subsystem technical implementation
│   ├── TESTING.md                         ← test strategy, pyramid, key test cases
│   └── DEPLOYMENT.md                      ← Docker → K8s → EKS guide
│
├── .claude/
│   ├── settings.json                      ← Claude Code project permissions
│   └── skills/
│       ├── compliance-rules/SKILL.md      ← verification state machine + TrustScore rules
│       ├── deal-workflow/SKILL.md         ← deal state machine + escrow ledger rules
│       ├── frontend-ui/SKILL.md           ← 3D scenes, animation patterns, design tokens
│       ├── ai-agents/SKILL.md             ← AiService contract, prompt conventions, guardrails
│       ├── backend-api/SKILL.md           ← NestJS module template, guard order, error classes
│       └── data-security/SKILL.md        ← PII encryption, money integrity, JWT, audit
│
└── .claude-mem/                           ← Claude's persistent in-project memory
    ├── README.md                          ← how the memory system works
    ├── CONTEXT.md                         ← one-page project snapshot (read first)
    ├── DECISIONS.md                       ← append-only log of significant decisions
    ├── PROGRESS.md                        ← module completion status tracker
    ├── OPEN_QUESTIONS.md                  ← unresolved design questions
    └── PATTERNS.md                        ← validated code patterns
```

## What each file does

| File | Audience | Purpose |
|------|----------|---------|
| **README.md** | Everyone | Quickstart, tech stack, doc map |
| **CLAUDE.md** | Claude Code | 10 non-negotiables, AI rules, scope guardrails — most critical |
| **PRD.md** | Product + Eng | Feature phases, personas, NFRs, success metrics |
| **APP_FLOW.md** | Eng + Design | Every user journey, screen inventory, API + WS event map |
| **AI_AGENTS.md** | Eng + AI | 8 agents: Search, Deal Co-Pilot, Compliance, Arbitration, Price, Fraud, Document, Notification |
| **DATA_FLOW.md** | Eng | 11 flows: request lifecycle, PII, money, search, real-time, audit, BullMQ, token rotation |
| **ARCHITECTURE.md** | Eng | System design, polyglot persistence rationale, module boundaries |
| **SECURITY.md** | Eng + Auditors | Zero-trust, PII encryption rules, money integrity, vuln reporting |
| **CONTRIBUTING.md** | Contributors | Branching, conventions, testing, Definition of Done |
| **docs/ADR.md** | Eng | 15 architecture decision records — the *why* behind every major choice |
| **docs/FRONTEND.md** | Frontend devs | Project structure, state management, API client, auth flow, route protection |
| **docs/BACKEND.md** | Backend devs | Module map, all endpoints, DB patterns, Redis keys, env vars |
| **docs/ANIMATION_3D.md** | Frontend devs | R3F globe, TrustGauge, MilestoneTrack, GSAP hero, Lottie, perf budget |
| **docs/UI_COMPONENTS.md** | Frontend devs | Every component, its props, usage rules, shadcn/ui install list |
| **docs/AI_AGENTS.md** | Backend + AI devs | AiService contract, prompt file convention, PII stripping, mock mode |
| **docs/TESTING.md** | All devs | Test pyramid, test cases by module, fixture patterns, CI config |
| **docs/DEPLOYMENT.md** | DevOps | Docker images, K8s manifests, DB migration strategy, CI/CD pipeline |
| **.claude/settings.json** | Claude Code | Allowed/denied shell commands |
| **.claude/skills/** | Claude Code | 6 domain skills auto-loaded when working on relevant code |
| **.claude-mem/** | Claude Code | Persistent in-project memory — context, decisions, progress, patterns |

## Why `.claude-mem/` matters

Claude Code doesn't retain memory between conversations by default. `.claude-mem/CONTEXT.md`
gives Claude an instant project snapshot so it doesn't re-derive context from scratch.
`DECISIONS.md` prevents reversing settled choices. `PATTERNS.md` keeps code consistent
across sessions. Claude appends to these files; humans review in PRs.

## Still to fill in

- Replace `security@khanijnexus.example` in `SECURITY.md` with a real address.
- Seed real compliance requirements for pilot state (Rajasthan) in the compliance-rules skill.
- Tune TrustScore weights and document the final choice as an ADR amendment.
- Answer open questions in `.claude-mem/OPEN_QUESTIONS.md` before building arbitration module.
- Add `docs/COMPLIANCE.md` (regulatory mapping) once arbitration legal model is decided.
