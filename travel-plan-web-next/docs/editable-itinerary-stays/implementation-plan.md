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
| S0-BE-2 | Update `routeStore.test.ts` — test both keys resolve to isolated stores; seed-copy behaviour for test key. | Tier 1 |
| S0-BE-3 | Update `plan-update` handler to accept optional `tabKey` (default `"route"`); pass to `getRouteStore`. | Tier 2 |
| S0-BE-4 | Update `api-plan-update.test.ts` — add test for `tabKey="route-test"` isolation. | Tier 2 |

### Gate
Tier 0 + Tier 1 pass. `routeStore.test.ts` covers dual-key isolation.

---

## Slice S1 — Itinerary (Test) Tab

**Goal:** Second tab visible, labelled "(Test)", backed by `route-test` key, fully isolated.  
**Owner:** FE + BE (S0 must complete first)

### Tasks

| # | Task | Tier |
|---|------|------|
| S1-FE-1 | Add `tabKey: 'route' | 'route-test'` prop to `ItineraryTab`. Pass through all `plan-update` calls. | Tier 1 |
| S1-FE-2 | Add "Itinerary (Test)" tab to `TravelPlan` tab switcher. Mount both tabs; use `hidden` toggle (existing pattern). | Tier 1 |
| S1-FE-3 | Update `TravelPlan.test.tsx` — assert both tabs render; assert `tabKey` prop is passed correctly. | Tier 1 |
| S1-FE-4 | Update `ItineraryTab.test.tsx` — snapshot/behaviour tests pass `tabKey`. | Tier 1 |
| S1-E2E-1 | E2E: both tabs visible and labelled correctly; edit in Test tab does not affect Itinerary tab. | Tier 3 |

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
| S2-BE-2 | Unit-test `stayUtils.ts` — shrink, extend, min-night, next-exhausted, last-stay, conservation. | Tier 1 |
| S2-BE-3 | Implement `app/api/stay-update/route.ts` — auth check, validate body, call `stayUtils`, call `getRouteStore(tabKey)`, return `updatedDays`. | Tier 2 |
| S2-BE-4 | Integration-test `api-stay-update.test.ts` — all error paths, both tabKeys, conservation check. | Tier 2 |

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
| S3-FE-2 | Unit-test `StayEditOverlay` — render, validation messages, Enter/Escape, disabled on last stay. | Tier 1 |
| S3-FE-3 | Wire `StayEditOverlay` into `ItineraryTab` overnight cells. Add edit affordance (pencil icon / double-click — FE LLD). Hide on last stay. | Tier 1 |
| S3-FE-4 | Implement optimistic update in `ItineraryTab`: snapshot state → apply local mutation → POST `stay-update` → on failure revert snapshot + show error toast. | Tier 2 |
| S3-FE-5 | Update `ItineraryTab.test.tsx` — stay edit render, optimistic update, revert on mock 500. | Tier 2 |

### Gate
Tier 0 + Tier 1 + Tier 2 pass (mocked network). Error toast renders on API failure.

---

## Slice S4 — Integration & E2E

**Goal:** FE + BE wired; all ACs from feature-analysis validated end-to-end.  
**Owner:** QA / both leads

### Tasks

| # | Task | AC |
|---|------|----|
| S4-E2E-1 | E2E: shrink stay — City A nights decrease, City B nights increase, total unchanged, persists on reload. | AC-3 |
| S4-E2E-2 | E2E: extend stay — City A nights increase, City B nights decrease. | AC-4 |
| S4-E2E-3 | E2E: validation — 0 nights rejected with message. | AC-5 |
| S4-E2E-4 | E2E: validation — next stay at 1 night blocks extend. | AC-6 |
| S4-E2E-5 | E2E: last city block has no edit affordance. | AC-7 |
| S4-E2E-6 | E2E: API-fail revert — mock network error, verify UI reverts and toast appears. | AC-8 |
| S4-E2E-7 | E2E: Test tab isolated — edit in route-test; reload; original itinerary unchanged. | AC-1 |

### Gate
All Tier 3 E2E tests pass. Feature declared done.

---

## Test Tiers Summary

| Tier | Tooling | When gate runs |
|------|---------|----------------|
| 0 | `next lint` + `tsc` | Every PR |
| 1 | Jest + RTL | Before slice merge |
| 2 | Jest (API integration, mocked store) | Before slice integration |
| 3 | Playwright E2E | Before feature release |

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
| R-A | `UpstashRouteStore` uses `ROUTE_REDIS_KEY` env var globally — switching per-request is a new pattern | New `getRouteStore(tabKey)` signature; validated in S0 tests |
| R-B | `FileRouteStore` for test key may not auto-seed in all test environments | S0-BE-2 covers; `.env.test` sets `ROUTE_TEST_DATA_PATH` explicitly |
| R-C | Optimistic update and revert logic increases `ItineraryTab` state complexity | Snapshot-before-send pattern is simple; covered by Tier 2 component tests |
| R-D | E2E tests may interfere across tabs if `ROUTE_REDIS_KEY` / `ROUTE_TEST_REDIS_KEY` are shared in CI | Use unique keys per test run (existing `route:e2e` pattern; extend to `route-test:e2e`) |
