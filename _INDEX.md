# Khanij Nexus — Documentation Set

Drop these into your repo root (preserving paths). Here's what each is and where it goes.

## File placement

```
khanij-nexus/
├── README.md                              ← project entry point
├── CLAUDE.md                              ← Claude Code auto-loads this
├── ARCHITECTURE.md                        ← system design + rationale
├── SECURITY.md                            ← security model + PII rules
├── CONTRIBUTING.md                        ← dev workflow + Definition of Done
├── .env.example                           ← copy to .env, fill secrets
├── docs/
│   └── DEV_PROMPT.md                      ← (the dev prompt from earlier) put it here
└── .claude/
    └── skills/
        ├── compliance-rules/SKILL.md      ← verification + TrustScore rules
        └── deal-workflow/SKILL.md         ← deal state machine + escrow rules
```

## What each file does

| File | Audience | Purpose |
|------|----------|---------|
| **README.md** | everyone | What the project is, quickstart, doc map, the "intentionally stubbed" warning |
| **CLAUDE.md** | Claude Code | Pinned context: stack, 10 non-negotiables, AI rules, scope guardrails. The most important file for AI-assisted dev |
| **ARCHITECTURE.md** | engineers | Why each datastore, module boundaries, the provider abstraction, open questions |
| **SECURITY.md** | engineers + auditors | Zero-trust model, PII handling, money integrity, vuln reporting |
| **CONTRIBUTING.md** | contributors | Branching, conventions, testing, Definition of Done, PR checklist |
| **.env.example** | engineers | Every env var documented; providers default to `sandbox` |
| **.claude/skills/** | Claude Code | Domain rules the agent applies automatically on relevant tasks |

## Why the skills matter most

`CLAUDE.md` keeps the agent aligned on *engineering* rules. The **skills** keep it
aligned on *domain* rules — the things it would otherwise reinvent (and get wrong)
every session: what makes an org verified, how TrustScore decays, which deal state
transitions are legal, when escrow freezes. Add a new skill whenever you add a
domain (logistics, insurance, export, arbitration-procedure). That's how the
system stays consistent as it grows.

## Still yours to fill in

- Replace `security@khanijnexus.example` with a real address.
- Seed **real** compliance requirements for your pilot state + mineral (the skill
  lists a generic national set — jurisdictions differ).
- Tune the TrustScore weights and document the choice in an ADR.
- Add `docs/COMPLIANCE.md` (regulatory mapping) and `docs/DATA_MODEL.md` (data
  dictionary) — referenced by README; create them as the schema settles.
- Decide the arbitration legal model before building award enforcement.
