# Implementation Plan — Editable Itinerary Stays

**Feature ID:** editable-itinerary-stays  
**Date:** 2026-03-19  
**Refs:** [system-design.md](./system-design.md) · [feature-analysis.md](./feature-analysis.md)

---

## Slice Overview

Slices are vertically independent; FE and BE can proceed in parallel after Slice 0.

| Slice | Name | FE | BE | Gate |
|-------|------|----|----|------|
| S0 | Contract & persistence foundation | — | ✓ | Tier 0 + Tier 1 pass |
| S1 | Itinerary (Test) tab | ✓ | ✓ | Tier 0+1 pass; tab visible + isolated |
| S2 | Stay-edit API endpoint | — | ✓ | Tier 0+1+2 pass |
| S3 | Stay-edit UI | ✓ | — | Tier 0+1+2 pass |
| S4 | Integration + E2E | ✓ | ✓ | Tier 3 critical paths pass |

---

## Slice S0 — Contract & Persistence Foundation

**Goal:** Extend `RouteStore` to support a `tabKey` and wire up the `route-test` key in both backends.  
**Owner:** BE

### Tasks

| # | Task | Tier |
|---|------|------|
| S0-BE-1 | Add `tabKey: 'route' | 'route-test'` param to `getRouteStore(tabKey)`. `FileRouteStore` uses `ROUTE_TEST_DATA_PATH` (default `data/route-test.json`); seed from `route.json` if absent. `UpstashRouteStore` uses `ROUTE_TEST_REDIS_KEY` (default `route-test`). | Tier 1 |
| S0-BE-2 | Add backend validation proving both keys resolve to isolated stores and that the test key seeds correctly on first use. | Tier 1 |
| S0-BE-3 | Update `plan-update` handler to accept optional `tabKey` (default `"route"`); pass to `getRouteStore`. | Tier 2 |
| S0-BE-4 | Add contract-level validation that `plan-update` preserves backward compatibility and writes to the correct persistence target when `tabKey` is supplied. | Tier 2 |

### Gate
Tier 0 + Tier 1 pass. Dual-key persistence behavior is validated before slice handoff.

---

## Slice S1 — Itinerary (Test) Tab

**Goal:** Second tab visible, labelled "(Test)", backed by `route-test` key, fully isolated.  
**Owner:** FE + BE (S0 must complete first)

### Tasks

| # | Task | Tier |
|---|------|------|
| S1-FE-1 | Add `tabKey: 'route' | 'route-test'` prop to `ItineraryTab`. Pass through all `plan-update` calls. | Tier 1 |
| S1-FE-2 | Add "Itinerary (Test)" tab to `TravelPlan` tab switcher. Mount both tabs; use `hidden` toggle (existing pattern). | Tier 1 |
| S1-FE-3 | Add UI validation that both itinerary tabs render with the correct labels and route requests to the intended tab context. | Tier 1 |
| S1-FE-4 | Add component-level validation that itinerary behaviors remain stable when `tabKey` is present. | Tier 1 |
| S1-E2E-1 | Validate that the test tab is visible, clearly labelled, and isolated from the primary itinerary experience. | Tier 3 |

### Gate
Tier 0 + Tier 1 pass. Manual smoke: edit in Test tab; Itinerary tab unaffected after reload.

---

## Slice S2 — Stay-Update API Endpoint

**Goal:** `POST /api/stay-update` implemented, validated, tested.  
**Owner:** BE (parallel with S1)

### Tasks

| # | Task | Tier |
|---|------|------|
| S2-BE-1 | Implement `stayUtils.ts` — pure functions: `getStays(days)`, `applyStayEdit(days, stayIndex, newNights)` returning new `RouteDay[]`. Enforce invariants and throw typed errors. | Tier 1 |
| S2-BE-2 | Add domain validation for stay mutation rules, including shrink/extend behavior, minimum-night constraints, terminal-stay restrictions, and day conservation. | Tier 1 |
| S2-BE-3 | Implement `app/api/stay-update/route.ts` — auth check, validate body, call `stayUtils`, call `getRouteStore(tabKey)`, return `updatedDays`. | Tier 2 |
| S2-BE-4 | Add integration validation covering auth enforcement, tab targeting, invariant protection, and error handling for the new endpoint. | Tier 2 |

### Gate
Tier 0 + Tier 1 + Tier 2 pass. All error codes from error model covered by tests.

---

## Slice S3 — Stay-Edit UI

**Goal:** Edit affordance on overnight cells; optimistic update + revert on failure.  
**Owner:** FE (parallel with S2; mock API until S2 lands)

### Tasks

| # | Task | Tier |
|---|------|------|
| S3-FE-1 | Implement `StayEditOverlay` component (inline input or popover — FE LLD decision). Props: `currentNights`, `maxNights` (next stay nights), `onConfirm(newNights)`, `onCancel()`. | Tier 1 |
| S3-FE-2 | Add component validation for rendering, keyboard handling, validation messaging, and the non-editable terminal stay state. | Tier 1 |
| S3-FE-3 | Wire `StayEditOverlay` into `ItineraryTab` overnight cells. Add edit affordance (pencil icon / double-click — FE LLD). Hide on last stay. | Tier 1 |
| S3-FE-4 | Implement optimistic update in `ItineraryTab`: snapshot state → apply local mutation → POST `stay-update` → on failure revert snapshot + show error toast. | Tier 2 |
| S3-FE-5 | Add feature-level validation for optimistic updates, rollback on failed save, and user-visible failure handling. | Tier 2 |

### Gate
Tier 0 + Tier 1 + Tier 2 pass (mocked network). Error toast renders on API failure.

---

## Slice S4 — Integration & E2E

**Goal:** FE + BE wired; all ACs from feature-analysis validated end-to-end.  
**Owner:** QA / both leads

### Tasks

| # | Task | AC |
|---|------|----|
| S4-E2E-1 | Validate the stay-shrink journey, including day conservation and persisted state after reload. | AC-3 |
| S4-E2E-2 | Validate the stay-extend journey and reassignment to the adjacent stay. | AC-4 |
| S4-E2E-3 | Validate rejection of invalid stay lengths with clear user feedback. | AC-5 |
| S4-E2E-4 | Validate protection against exhausting the following stay. | AC-6 |
| S4-E2E-5 | Validate that the terminal stay remains non-editable. | AC-7 |
| S4-E2E-6 | Validate rollback and recovery messaging when save requests fail. | AC-8 |
| S4-E2E-7 | Validate that edits in the test itinerary remain isolated from the primary itinerary. | AC-1 |

### Gate
All Tier 3 E2E tests pass. Feature declared done.

---

## Validation Tiers Summary

| Tier | Scope | When gate runs |
|------|-------|----------------|
| 0 | Static quality checks | Every PR |
| 1 | Unit and component validation | Before slice merge |
| 2 | API and feature integration validation | Before slice integration |
| 3 | End-to-end user journey validation | Before feature release |

---

## Open Questions (carry-forward from brief)

| # | Question | Owner | Needed by |
|---|----------|-------|-----------|
| Q4 | Inline cell edit vs popover for stay edit control? | FE lead | S3-FE-1 |
| Q6 | Date/weekday columns re-computed after stay edit? (Assumed no for MVP) | Tech lead | S2 start |

---

## Risk Register

| ID | Risk | Mitigation |
|----|------|-----------|
| R-A | `UpstashRouteStore` uses `ROUTE_REDIS_KEY` env var globally — switching per-request is a new pattern | New `getRouteStore(tabKey)` signature; validate tab-scoped persistence before rollout |
| R-B | `FileRouteStore` for test key may not auto-seed in all environments | Validate first-read seeding in environment-specific checks before slice completion |
| R-C | Optimistic update and revert logic increases `ItineraryTab` state complexity | Use a snapshot-before-send pattern and validate rollback behavior before integration |
| R-D | End-to-end validation may interfere across tabs if persistence keys are shared in CI | Use unique keys per run so tab-isolation checks stay deterministic |
