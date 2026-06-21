# Decision Log — Khanij Nexus

> Lightweight decisions that don't warrant a full ADR. For significant
> architectural choices, write an ADR in `.ai/memory/decisions/`.

| Date | Decision | Context | Decided By |
|------|----------|---------|------------|
| 2026-06-20 | Adopt RepoOS structure with `.ai/` governance layer | Need consistent rules for all AI agents and contributors | Architecture review |
| 2026-06-20 | Domain packages as hybrid workspace packages (pure logic + docs) | Domain logic coupled to NestJS needed decoupling for portability | Architecture review |
| 2026-06-20 | Bidding/Auction is a separate system alongside RFQ/Quote | RFQ is direct negotiation; Auction is competitive price discovery | Product decision |
| 2026-06-20 | Keep locked stack, add new capabilities alongside | Existing code works; new domains (blockchain, logistics, finance) added incrementally | Architecture review |
