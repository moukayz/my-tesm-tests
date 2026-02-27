---
name: tdd-bp
description: Practice test-driven development with small cycles, clear intent, and maintainable tests that support refactoring.
compatibility: opencode
metadata:
  practice: tdd
---

## When to use me
Use this when you are implementing new behavior or fixing a bug and want to drive the design through tests.

## Core principles
- Write tests to describe behavior, not implementation details.
- Use short cycles (Red → Green → Refactor) with the smallest meaningful step each time.
- Keep production code simple and test-driven; refactor only when the test suite is green.
- Prefer tests that are deterministic, isolated, and fast.

## Red → Green → Refactor checklist
- Red
  - Write a failing test that expresses one observable behavior.
  - Name the test using “given/when/then” phrasing or an equivalent structure.
  - If the behavior is ambiguous, encode the simplest interpretation and record the open question in the task notes.
- Green
  - Make the test pass with the simplest correct change.
  - Avoid over-engineering; keep changes minimal and local.
- Refactor
  - Improve names, boundaries, and duplication in both tests and production code.
  - Strengthen the tests only if they improve clarity or reduce brittleness.

## Test design best practices
- Arrange/Act/Assert structure; one primary assertion per test when possible.
- Cover success and failure paths; include edge cases that historically regress.
- Avoid brittle coupling:
  - Avoid asserting on private/internal calls unless that call is the behavior.
  - Prefer asserting on outputs, state changes, and externally visible effects.
- Use explicit fakes/stubs for slow or non-deterministic dependencies (network, clock, randomness, external systems).
- Prefer table-driven tests for input/output matrices and boundary coverage.
- Use property-based tests when invariants are clearer than examples (e.g., sorting, parsing, encoding).

## Refactoring safety rules
- If a refactor breaks tests, treat it as a signal: either the refactor changed behavior or tests are too coupled.
- Keep tests readable: duplication is acceptable when it improves intent and reduces hidden dependencies.
- Aim for stable boundaries: push logic into pure functions/modules and keep adapters thin.

## Common failure modes to avoid
- Writing tests after the fact and calling it TDD.
- Writing broad “does everything” tests that are hard to debug.
- Using excessive mocking that mirrors implementation and breaks on refactors.
- Leaving flaky or slow tests in the main feedback loop.
