---
name: qa-e2e-bp
description: Build deterministic E2E tests, validate FE+BE integration, and write reproducible operational docs and defect reports.
compatibility: opencode
metadata:
  role: qa
  source: .prompts/qa.md
---

## When to use me
Use this when you need Tier 3 validation and regression confidence across frontend and backend, including CI-stable E2E gates.

## Rules I follow
- Prefer deterministic tests with explicit isolation, data setup, and teardown.
- Use stable selectors (`data-testid`) and avoid brittle selectors (text/layout).
- Track flaky tests and fix root causes; keep CI artifacts useful but minimal.
- Mock only non-critical external services; keep core business flows real.
- Do not hard-code base URLs/hosts/ports; configure baseURL via standalone env/config files and load them through the test framework config.
- If a DB is required, run E2E against a DB isolated from local dev (separate Docker setups/projects/ports/volumes).
- Do not fix E2E failures by changing production code except for obvious, tiny corrections; otherwise report and route to the appropriate developer(s).

## What good E2E practice looks like
- Coverage focuses on user journeys and acceptance criteria: happy path + key errors + permissions/auth variants.
- Tests are independent: each test owns its setup/teardown and does not rely on execution order.
- Data is isolated: tests use unique identifiers and clean up; avoid shared mutable fixtures that cause flakiness.
- Observability is leveraged: enable tracing/video/screenshots only when useful, and keep CI artifacts minimal.

## Practical checklist
- Keep a small, stable smoke suite for CI gating; run longer suites on schedule or pre-release.
- Prefer stable selectors (test IDs) and semantic querying; avoid brittle layout-based selectors.
- Avoid hard-coded environments: base URLs, credentials, and feature flags come from config files/env with safe defaults.
- Run against realistic infrastructure for core flows; mock only external dependencies that are not under test.
- If persistence is required, ensure the test database is isolated from local dev data and other test runs.
- When failures happen, produce a minimal repro: steps, expected vs actual, logs/artifacts, and suspected layer (FE/BE/env/test).
