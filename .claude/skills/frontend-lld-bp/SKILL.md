---
name: frontend-lld-bp
description: Produce frontend low-level design with slice-first structure, contract-driven data flows, UI states, a11y, and test strategy.
compatibility: opencode
metadata:
  role: frontend-tech-lead
  source: .prompts/frontend-tech-lead.md
---

## When to use me
Use this when you need an implementable frontend low-level design before any production code starts, especially for parallel development across feature slices.

## Design principles
- Contract-first boundary: planned API usage matches the contract; treat shared boundary changes like spec changes.
- Slice-first structure: organize the design around feature slices to minimize cross-team conflicts.
- Explicit state boundaries: define what is server state vs local UI state vs cross-route state (and who owns it).
- Stable component APIs: minimal props surface, typed data contracts, explicit events/callbacks.
- Status UX as a first-class concern: define loading/empty/error/success per flow; normalize errors into human text with actions.
- Accessibility and performance up-front: focus management, keyboard order, semantics, code-splitting, and memoization-friendly props.

## What a good frontend LLD contains
- **Overview**
  - Scope, non-goals, assumptions, risks, open questions
  - Key user journeys and a route map
- **Information architecture**
  - Page/route structure and navigation rules
  - Component breakdown per route (what composes what)
- **Data flows**
  - For each flow: data sources, caching rules, invalidation, optimistic updates, and error handling
  - A single standard query layer (generated client + query library) and a consistent error normalization path
- **UX states**
  - Loading strategy (skeleton/spinner), empty-state definitions, error-state rules, retry/back actions
  - Form behaviors: validation schema, field-level errors, submit pending/disabled rules
- **Interfaces**
  - Component props/events contracts, shared hooks contracts, and cross-slice integration points
- **Test strategy**
  - Tiered approach: lint/typecheck → unit tests (components/hooks) → integration tests (key flows with contract-shaped mocks)
  - Coverage expectations across success/loading/empty/error and permission/auth variations when relevant
