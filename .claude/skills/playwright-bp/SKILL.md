---
name: playwright-bp
description: Write stable Playwright E2E tests with deterministic data, resilient selectors, parallel-friendly design, and actionable failures.
compatibility: opencode
metadata:
  stack: playwright
---

## When to use me
Use this when you are adding or maintaining Playwright tests for end-to-end and integration flows.

## Core principles
- Tests must be deterministic: explicit setup/teardown, no hidden dependencies, no reliance on execution order.
- Prefer user-facing interactions: assert on visible behavior and outcomes, not implementation details.
- Keep selectors resilient: prioritize roles/labels and stable test IDs over brittle CSS or text-only selectors.
- Make failures actionable: minimal repro steps, clear assertions, and useful artifacts.

## Practical checklist
- Test design
  - One test validates one user journey or scenario; keep tests short and focused.
  - Avoid shared mutable fixtures; generate unique data per test when possible.
  - Separate smoke tests (CI gate) from longer regression suites.
- Selectors and assertions
  - Prefer `getByRole`/label-based queries; use test IDs for non-semantic UI.
  - Assert on outcomes that matter: navigation, visible state, persisted changes, permissions.
  - Avoid arbitrary sleeps; wait on expected UI states or network conditions.
- Environment and configuration
  - Do not hard-code base URLs, credentials, or feature flags in tests.
  - Keep configuration in environment/config files with safe defaults.
- Parallelization and stability
  - Ensure tests can run in parallel without clashing (isolated users/data, isolated storage/state).
  - Quarantine and fix flakes by addressing root causes, not by adding retries everywhere.
- Debuggability
  - Capture traces/screenshots/videos on failure as needed; keep artifacts minimal for CI cost.
  - Log only what helps debug; avoid leaking secrets/PII into artifacts.
