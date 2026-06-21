# Risk Register — Khanij Nexus

> Known risks with likelihood, impact, and mitigation strategies.

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-001 | **RBI licensing** — real escrow/payment rails require PA/PA-C licence | High | High | PaymentProvider is a stub interface. No real money moves in MVP. Licence application is a business track, not engineering. |
| R-002 | **DPDP Act compliance** — evolving regulation may add new requirements | Medium | High | Data residency in ap-south-1 by architecture. PII encrypted at rest. Consent framework not yet built — needed before production. |
| R-003 | **Aadhaar Act constraints** — storing Aadhaar numbers has strict legal requirements | Medium | High | SandboxKycProvider only. Real eKYC deferred. Aadhaar never stored after verification — only status + timestamp. |
| R-004 | **Single-region AWS** — ap-south-1 outage affects all users | Low | High | Multi-AZ deployments. No cross-region data. Accept single-region risk per DPDP Act. |
| R-005 | **AI hallucination in contracts** — Claude may generate incorrect legal text | Medium | Medium | AI output labeled as decision-support. Human signs. Zod validation of all AI output. AiDisclaimer component. |
| R-006 | **Sandbox/real provider drift** — sandbox implementations may not match real API behaviour | Medium | Medium | Interface contracts define exact input/output. Test both against same test suite when real provider available. |
| R-007 | **Elasticsearch consistency lag** — ES index lags Postgres by BullMQ job latency | Low | Low | Postgres is authoritative. ES is derived index. Can rebuild. Acceptable for search (not financial). |
| R-008 | **Key rotation complexity** — rotating ENCRYPTION_KEY requires re-encrypting all PII | Low | Medium | Build re-encryption migration job. Test in staging. Schedule quarterly. |
| R-009 | **Monorepo scale** — as team grows, single repo may slow CI | Low | Medium | Turborepo caching mitigates. Can split into multi-repo if needed post-launch. |

## Risk Levels

- **High likelihood + High impact** — requires active mitigation plan
- **Medium** — monitored, mitigation in place or planned
- **Low** — accepted risk with documented rationale
