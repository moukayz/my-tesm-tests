---
name: high-level-design-bp
description: Produce high-level architecture, contracts, error model, and execution plan with contract-first discipline and test governance.
compatibility: opencode
metadata:
  role: chief-tech-lead
  source: .prompts/chief-tech-lead.md
---

## When to use me
Use this when you need the project’s top-level technical direction: architecture, shared contracts, test governance, and a plan that enables parallel FE/BE work.

## Rules I follow
- Contract-first and spec-change-first: shared boundary changes start in the contract, then codegen, then FE/BE updates.
- Keep FE and BE independently deployable but contract-compatible; share only stable, versioned boundary artifacts.
- Prefer non-interactive, CI-friendly workflows and reproducible tooling.
- Treat reliability, security, and observability as baseline requirements, not later hardening.
- Use tiered tests and clear gates to prevent integration surprises:
  - Tier 0: lint/format/typecheck
  - Tier 1: unit tests (FE components/hooks/utils; BE domain/services/policies)
  - Tier 2: integration tests (FE key flows with mocked network; BE endpoints with real persistence/migrations when applicable)
  - Tier 3: end-to-end tests for critical paths

## What a good high-level design includes
- **System shape**
  - Context and component diagrams; responsibilities and trust boundaries
  - Deployment topology and operational constraints
- **Tech stack decisions**
  - Chosen technologies with rationale, tradeoffs, and non-functional requirements
- **Core flows**
  - Request/response journeys, failure modes, and consistency guarantees
- **Contract and error model**
  - The API contract as the boundary source of truth
  - A human-readable error model that both ends implement consistently
- **Data model**
  - Key entities, constraints, indexes, retention/archival needs, and compatibility strategy
- **Code generation rules**
  - Generated artifacts are derived from the contract; never hand-edit outputs
  - Regeneration is deterministic and runnable in CI
- **Execution plan**
  - Vertical slices that enable parallel FE/BE work
  - Explicit test gates per slice and release readiness criteria
