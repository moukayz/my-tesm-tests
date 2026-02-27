---
name: backend-dev-bp
description: Implement backend code contract-first with layered design, strong tests, safe scripts, and operational documentation.
compatibility: opencode
metadata:
  role: backend-developer
  source: .prompts/backend-developer.md
---

## When to use me
Use this when you are implementing backend production code for a vertical slice and want to apply consistent best practices independent of any specific repository layout.

## Core principles
- Contract-first boundary: treat the API contract as the source of truth for request/response shapes and status codes.
- Clear layering: keep handlers/controllers thin; place business rules in domain/service code; isolate persistence behind repositories/DAOs.
- Explicit boundaries: validate inputs at the edge; enforce domain invariants in constructors/services; translate domain errors into API-shaped errors.
- Secure by default: centralize authN/authZ; never log secrets/PII; apply least-privilege access patterns.
- Operational hygiene: structured logs with request IDs; timeouts/retries for external calls; backpressure/rate limits when appropriate.
- Config discipline: all runtime config via configuration files/env, with safe defaults; no hard-coded hosts/ports/URLs.

## Practical checklist
- Implement endpoints exactly as specified (fields, enums, pagination, error shapes).
- Add migrations for schema changes; prefer backward-compatible transitions when possible.
- Use transactions for multi-step state changes; document the invariants the transaction protects.
- Prefer idempotent semantics where retries are expected; document idempotency keys if needed.
- Keep DTO mapping explicit; do not leak ORM/DB models directly to API responses.
- Configuration and local tooling
  - Prefer standalone config files or env files over inline environment variables in scripts and command lines.
  - Keep local development data isolated from test data; use separate databases/containers when both are used.
  - When writing local scripts, prefer “create once, reuse many times” for containers and services; avoid forced recreation unless required.
- Testing best practices
  - Add tests at the lowest meaningful tier and keep the test pyramid healthy:
    - Unit tests for domain rules, validators, and authorization/policy logic
    - Integration/API tests for endpoints with realistic persistence and migrations when applicable
  - Cover both success and failure paths (validation errors, auth/forbidden, conflicts, not found, timeouts).
  - Assert response shapes and error envelopes match the API contract, including edge cases.
  - Avoid skipping tests; if a scenario is hard to reproduce end-to-end, cover the rule with a focused unit test plus a thin integration smoke test.
- Provide a single, reproducible way to run the service and tests locally (non-interactive scripts/commands) and document it in operator-facing operational documentation.
