---
name: vuejs-bp
description: Build maintainable Vue apps with predictable reactivity, clear state boundaries, accessible UI, and testable patterns.
compatibility: opencode
metadata:
  stack: vue
---

## When to use me
Use this when you are designing or implementing Vue components, composables, routing, and client-side state for a feature.

## Core principles
- Prefer Composition API for modular logic and reuse via composables.
- Keep state ownership explicit: component-local vs shared store vs server-fetched data.
- Treat reactivity as a tool, not magic: avoid implicit coupling via watchers where possible.
- Accessibility and UX states (loading/empty/error/success) are part of the feature, not polish.

## Practical checklist
- Component design
  - Keep components small and focused; extract common UI primitives early.
  - Prefer props + emits with typed contracts over shared mutable state.
  - Avoid overusing `provide/inject`; use it for truly cross-cutting concerns only.
- Reactivity and composables
  - Use `ref`/`reactive` intentionally and keep reactive scope minimal.
  - Prefer computed values over duplicating state.
  - Use watchers sparingly; document why a watcher is needed and what invariants it maintains.
  - Keep composables pure and testable; avoid direct DOM access unless necessary.
- Data fetching and errors
  - Centralize networking behind a client module and a single query/cache approach.
  - Normalize errors into a user-facing model with actionable messages.
  - Implement explicit loading/empty/error/success states per route and major component.
- Performance
  - Avoid expensive computed chains on large reactive objects; keep reactive data structures small.
  - Use keyed rendering correctly and avoid unnecessary reactivity in large lists.
- Security and UX hygiene
  - Never render untrusted HTML without sanitization.
  - Treat URLs and user input as untrusted; validate/normalize at boundaries.
  - Manage focus and scroll intentionally for route changes and dialogs.

## Testing best practices
- Prefer behavior tests over implementation details.
- Test flows across state matrices: success, loading, empty, error, and permission/auth variants when applicable.
- Keep tests deterministic and isolate network at the boundary.
