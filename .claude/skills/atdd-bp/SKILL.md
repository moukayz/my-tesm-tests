---
name: atdd-bp
description: Drive development from acceptance tests by specifying user-visible behavior first and layering lower-level tests underneath.
compatibility: opencode
metadata:
  practice: atdd
---

## When to use me
Use this when implementing a user journey or a cross-component feature where the definition of done is best expressed as acceptance criteria.

## Core principles
- Start from acceptance criteria: define observable outcomes and error cases before designing internals.
- Keep acceptance tests few, stable, and high-signal; cover critical paths, not every edge.
- Push detailed coverage down the pyramid: unit tests for business rules, integration tests for boundaries, acceptance tests for end-to-end confidence.
- Design for testability: explicit boundaries, deterministic behavior, and configurable dependencies.

## Practical checklist
- Define acceptance criteria as scenarios:
  - Given initial state and permissions
  - When the user performs an action
  - Then the system responds with observable outcomes
- Turn the highest-value scenarios into automated acceptance tests.
- For each scenario, identify lower-level rules and add unit tests to cover:
  - Validation rules and invariants
  - Authorization/policy decisions
  - Error mapping and edge cases
- Keep acceptance tests deterministic:
  - Explicit setup/teardown and isolated data
  - Stable selectors and stable API boundaries
  - No arbitrary sleeps; wait on observable states

## Test maintenance rules
- If acceptance tests are flaky, fix root causes (isolation, timing, data) rather than adding broad retries.
- If acceptance tests fail for reasons unrelated to the scenario intent, refactor the test to assert on more stable signals.
- Keep a small smoke set for gating changes; run longer suites on a slower cadence.
