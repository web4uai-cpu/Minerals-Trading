# Open Questions

> Things that need a decision before implementing. Claude appends questions here when
> blocked on an ambiguous requirement. Answer by appending below the question.

---

## UX / Product

### Q1: Arbitrator assignment — automatic or admin-assigned?
**Asked:** 2026-06-15  
**Context:** ADR-014 says "Arbitrator assigned from panel (round-robin or skill match)".
Should arbitrators be auto-assigned by the system (round-robin by mineral specialty),
or should an admin manually pick from the panel?  
**Blocks:** Arbitration module design  
**Answer:** *(pending)*

---

### Q2: Deal room — does the seller see the buyer's TrustScore (and vice versa)?
**Asked:** 2026-06-15  
**Context:** TrustScore is an org-level signal. Showing it in the deal room would
increase transparency but may cause friction (low-TrustScore buyer gets rejected).  
**Blocks:** Deal room UI spec  
**Answer:** *(pending)*

---

### Q3: Multiple users per org — invite flow?
**Asked:** 2026-06-15  
**Context:** The data model supports multiple `User` records per `Organization`, but
there's no invitation flow implemented. A single org might have a procurement head
(BUYER role) and a finance person (BUYER role) who both need access.  
**Blocks:** Auth module expansion  
**Answer:** *(pending)*

---

## Technical

### Q4: WebSocket auth — token in handshake header or query param?
**Asked:** 2026-06-15  
**Context:** Socket.io supports auth via `{ auth: { token } }` in handshake, which
avoids the token appearing in server logs. But some proxy configurations strip
custom handshake auth. Query param is simpler but exposes token in logs.  
**Blocks:** WebSocket gateway implementation  
**Answer:** Use `{ auth: { token } }` in Socket.io handshake. Token in httpOnly cookie
is not accessible to JS, so pass the in-memory access token here. *(Claude, 2026-06-15)*

---

### Q5: MongoDB — which data goes in Mongo vs Postgres?
**Asked:** 2026-06-15  
**Context:** The stack includes MongoDB (per `docker-compose.yml` and ARCHITECTURE.md)
but no Prisma schema for it. What specifically goes in Mongo?  
**Blocks:** Deal module design, Arbitration module  
**Proposed answer:** Mongo stores deal contract documents (rich text, amendment history,
clause-level edit tracking) and arbitration evidence metadata (not the files — those
go to S3). Postgres stores structured deal data. *(pending confirmation)*

---

### Q6: Grade parameters — who defines them and can sellers add custom params?
**Asked:** 2026-06-15  
**Context:** `Mineral.gradeParams` is a JSON schema defining valid grade parameter
names and ranges. Currently seeded by admin. Can sellers add `Al2O3%` to a listing
even if the mineral's `gradeParams` doesn't include it?  
**Blocks:** Listings service validation  
**Answer:** *(pending)*

---

### Q7: Elasticsearch re-index strategy — full rebuild or incremental?
**Asked:** 2026-06-15  
**Context:** If the Elasticsearch index gets out of sync (e.g., crash during BullMQ
job processing), we need a way to rebuild it. Options: (a) full re-index from Postgres
on demand via admin endpoint, (b) compare-and-sync on startup.  
**Blocks:** ListingIndexProcessor design  
**Answer:** Implement an admin endpoint `POST /admin/search/reindex` that queues a
BullMQ job to full re-index all ACTIVE listings from Postgres. *(Claude, 2026-06-15)*

---

<!-- Claude: append new questions above this line with date and blocking context -->
