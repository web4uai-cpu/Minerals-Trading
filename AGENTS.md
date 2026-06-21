# AI Agent Customization Guide - Minerals-Trading

> **DEPRECATED** — This file is superseded by `.ai/guardrails/AGENTS.md`.
> See `.ai/` for the current repository operating system.

## Project Overview

**Minerals-Trading** is a universal mineral trading marketplace with arbitration capabilities. The platform enables buyers and sellers to trade mineral commodities, dispute resolution, and fair marketplace operations.

## Core Purpose

Build a comprehensive web-based arbitration platform where:
- Buyers and sellers can list and trade mineral commodities
- Transactions are facilitated with transparent pricing
- Disputes are resolved through a structured arbitration process
- Trust and transparency are maintained through audit trails

## Technology Stack Expectations

When scaffolding or building features, use:
- **Backend**: Node.js/Express or Python/FastAPI (TBD - agent should ask for preference)
- **Frontend**: React/TypeScript for modern, type-safe UI
- **Database**: PostgreSQL for transactional data, Redis for caching/sessions
- **API**: RESTful with potential GraphQL layer
- **Auth**: JWT tokens with role-based access control (RBAC)

## Directory Structure

Once established, follow this structure:
```
.
├── backend/          # Backend API and business logic
├── frontend/         # React web application
├── shared/           # Shared types, constants, utilities
├── docs/             # Documentation
├── .github/          # GitHub configuration and workflows
└── tests/            # Integration and E2E tests
```

## Key Modules to Implement

### Phase 1: Foundation
- [ ] User authentication (registration, login, roles)
- [ ] User profiles (sellers, buyers, arbitrators)
- [ ] Mineral commodity catalog
- [ ] Basic marketplace UI

### Phase 2: Core Trading
- [ ] Listing creation and management
- [ ] Offer/bid system
- [ ] Transaction management
- [ ] Payment integration (escrow)

### Phase 3: Arbitration
- [ ] Dispute filing workflow
- [ ] Arbitrator assignment
- [ ] Evidence upload and review
- [ ] Resolution and settlement

### Phase 4: Platform Enhancement
- [ ] Analytics and reporting
- [ ] Audit logging
- [ ] Advanced search and filtering
- [ ] Notifications and messaging

## Development Conventions

### Code Style
- Use TypeScript for type safety
- Follow consistent naming: camelCase for variables/functions, PascalCase for classes/types
- Write clear, self-documenting code with comments on complex logic
- Keep functions focused and under 50 lines when possible

### Database Patterns
- Use migrations for all schema changes
- Follow entity naming: `users`, `listings`, `transactions`, `disputes`
- Index frequently queried columns
- Use soft deletes for audit trails

### API Design
- RESTful endpoints: `/api/v1/{resource}`
- Consistent error responses with status codes and error IDs
- Request validation and sanitization
- Comprehensive API documentation

### Testing
- Unit tests for business logic (aim for >80% coverage)
- Integration tests for API endpoints
- Test files colocated with source: `feature.test.ts`

### Security
- No secrets in code; use environment variables
- Validate and sanitize all user inputs
- Implement rate limiting on API endpoints
- Use CORS properly
- Hash passwords with bcrypt
- Log sensitive operations without storing secrets

## Common Pitfalls to Avoid

1. **Untracked Disputes**: Every transaction should link to dispute tracking
2. **Missing Audit Logs**: Maintain immutable records of all marketplace actions
3. **Insufficient Escrow Logic**: Payment should be held during transactions
4. **Permission Gaps**: Always verify user roles before allowing actions
5. **Race Conditions**: Use database transactions for multi-step operations

## Build and Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build
npm run build

# Tests
npm test

# Linting
npm run lint
```

## Documentation Links

- **Architecture**: See `docs/ARCHITECTURE.md` when created
- **API Reference**: See `docs/API.md` when created
- **Database Schema**: See `docs/SCHEMA.md` when created
- **Contributing**: See `CONTRIBUTING.md` when created

## How AI Agents Should Approach Tasks

1. **Before creating new features**, check the existing structure and follow established patterns
2. **When unsure about architecture**, reference the Phase breakdown and suggest next steps
3. **For database work**, propose migrations with proper versioning
4. **For API endpoints**, follow the `/api/v1/{resource}` convention
5. **When implementing security**, apply the security checklist above
6. **Before merging code**, verify tests pass and code follows conventions

## Questions for Agent Clarification

When implementing features, clarify:
- What payment gateway should we integrate? (Stripe, PayPal, crypto?)
- Should arbitration be AI-assisted or human-only?
- What mineral commodities should be in the initial catalog?
- What are the dispute resolution SLAs?
- How should transaction history be exposed to users?
