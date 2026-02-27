---
name: reactjs-bp
description: Build maintainable React apps with clear state boundaries, predictable components, accessibility, and testable patterns.
compatibility: opencode
metadata:
  stack: react
---

## When to use me
Use this when you are designing or implementing React components, routes, and client-side state for a feature.

## Core principles
- Prefer simple component composition over deep prop drilling or large “god” components.
- Keep rendering pure: isolate side effects in hooks and keep effect dependencies correct.
- Make state boundaries explicit: server state vs local UI state vs cross-route state.
- Treat user input and URLs as untrusted; validate/normalize at boundaries.
- Accessibility is a feature: semantic HTML first, ARIA only to fill gaps, keyboard support by default.

## Practical checklist
- Component structure
  - Keep components single-purpose; extract reusable UI primitives when patterns repeat.
  - Prefer controlled boundaries: container components orchestrate; presentational components render.
  - Avoid storing derived state; compute from props/query results when possible.
- Hooks and effects
  - Never call hooks conditionally; keep hook order stable.
  - Keep effects minimal; prefer event handlers and derived values over “syncing state” effects.
  - Use memoization only for measured hot paths; avoid premature `useMemo`/`useCallback`.
- Data fetching and errors
  - Centralize networking behind a client module and a single query/cache layer.
  - Normalize errors into a typed, user-facing model with actionable messages.
  - Always implement explicit loading/empty/error/success states per flow.
- Performance
  - Use stable list keys; never use array index keys for reorderable lists.
  - Code-split large routes and heavy components; lazy-load rarely used UI.
  - Avoid unnecessary rerenders by keeping props stable and colocating state.
- Security and UX hygiene
  - Never inject unsanitized HTML.
  - Avoid storing secrets in client code; assume the client is hostile.
  - Handle focus and scroll intentionally for route changes and dialogs.

## Testing best practices
- Prefer behavior tests over implementation tests.
- Test state matrices: success, loading, empty, error, and permission/auth variants when applicable.
- Use deterministic selectors; reserve test IDs for cases where role/label queries are insufficient.
- Mock network at the boundary (client layer) and keep UI tests focused on visible behavior.
