---
name: frontend-dev-bp
description: Implement frontend slices contract-first with strict TypeScript, accessible UI states, robust tests, and operational documentation.
compatibility: opencode
metadata:
  role: frontend-developer
  source: .prompts/frontend-developer.md
---

## When to use me
Use this when you are implementing frontend production code for a vertical slice and want consistent best practices independent of any specific repository layout.

## Core principles
- Contract-first boundary: treat the API contract and generated client/types as the source of truth for shared DTOs.
- Thin routes, testable logic: keep pages/routes focused on composition and orchestration; move non-trivial logic into hooks/services.
- Explicit UX states: design and implement loading, empty, error, and success states deliberately for each flow.
- Accessible by default: use semantic HTML; ensure labels, focus management, keyboard navigation, and visible focus states.
- Safe data handling: normalize errors into a user-facing model; never display raw stack traces; treat URLs and user input as untrusted.
- Config discipline: no hard-coded service base URLs/hosts/ports; use environment/configuration with safe defaults.

## Practical checklist
- Use generated client/types; avoid redefining shared DTOs locally.
- Centralize network calls and error normalization; avoid ad-hoc fetch scattered across components.
- Prefer derived values over duplicated state; keep effect dependencies correct; avoid conditional hooks.
- Use stable keys for lists and stable selectors (e.g., `data-testid`) for integration/E2E targets.
- Feature flags and cleanup
  - Use feature flags to ship incomplete flows safely; remove dead code and flags after rollout.
- Configuration and local tooling
  - Do not hard-code service base URLs/hosts/ports in app code or tests; use environment/configuration.
  - Prefer standalone config files or env files over inline environment variables in scripts and command lines.
- Testing best practices
  - Add tests at the lowest meaningful tier:
    - Unit tests for components, hooks, and utilities
    - Integration tests for key routes/forms with contract-shaped network mocks
  - Test the state matrix for each flow: success, loading, empty, and error; include permission/auth variants when relevant.
  - Prefer behavior-focused assertions (rendered state + side effects) over implementation details.
  - Keep selectors resilient: prefer roles/labels, and use test IDs for non-semantic UI.
  - Keep tests environment-agnostic: no coupling to fixed hosts/ports; use configuration overrides for base URLs in tests.
- Provide a single, reproducible way to run the app and tests locally (non-interactive commands) and document it in operator-facing operational documentation.
