---
name: backend-lld-bp
description: Produce backend low-level design with clear layering, contract-first API shapes, data schema, and test strategy.
compatibility: opencode
metadata:
  role: backend-tech-lead
  source: .prompts/backend-tech-lead.md
---

## When to use me
Use this when you need an implementable backend low-level design (LLD) before production code starts, especially to enable multiple developers to build in parallel with minimal ambiguity.

## Design principles
- Contract-first boundary: define request/response shapes, status codes, and error envelopes explicitly and treat changes as spec changes.
- Clear layering: API layer (transport + auth + orchestration) → domain/service (business rules) → persistence (data access).
- Explicit validation: validate at the request boundary, enforce domain invariants in domain code, and define persistence constraints as a backstop.
- Stable interfaces: define service interfaces and repository contracts that express business intent, not storage details.
- Vertical slices: design modules around features with explicit integration points to reduce cross-module coupling.

## What a good backend LLD contains
- **Overview**
  - Scope, non-goals, assumptions, risks, open questions
  - Key flows and data flow diagrams (use a diagram when it adds clarity)
- **API behavior**
  - Endpoint-by-endpoint behavior, including edge cases
  - Status codes, error mapping rules, pagination/filtering/sorting conventions
  - Idempotency semantics and retry-safe behaviors where needed
- **Domain model**
  - Entities/value objects, invariants, state transitions, domain errors
  - Authorization policies as business rules (who can do what, when, and why)
- **Persistence**
  - Schema/tables/collections, constraints, indexes, and query patterns
  - Migration strategy and backward-compatibility notes
  - Transaction boundaries and isolation assumptions for multi-step operations
- **Reliability & security**
  - Timeouts/retries, rate limits, partial-failure handling/compensation
  - Data classification and redaction rules for logs and telemetry
  - Browser boundary considerations when relevant (cookies/CORS/CSRF)
- **Test strategy**
  - Tiered approach: lint/typecheck → unit tests (domain/policies) → integration/API tests (endpoints + DB + migrations)
  - Coverage expectations for success and failure paths (validation, auth, conflicts, not found)
