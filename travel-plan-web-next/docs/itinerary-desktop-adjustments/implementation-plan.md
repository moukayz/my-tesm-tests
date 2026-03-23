# Implementation Plan - Itinerary Desktop Adjustments

**Feature ID:** itinerary-desktop-adjustments  
**Date:** 2026-03-22  
**Refs:** [system-design.md](./system-design.md)

## Slice Plan

| Slice | Goal | FE | BE/server | Gate |
|---|---|---|---|---|
| S0 | Lock desktop target model | add union selection model and URL rules | confirm seeded-card composition source in `app/page.tsx` | Tier 0 + Tier 1 |
| S1 | Larger left-aligned cards | replace centered grid with left-aligned card rail and starter section | expose seeded-card metadata in initial page props | Tier 0 + Tier 1 |
| S2 | Seeded route opens in detail shell | route starter card to `legacyTabKey=route` and render `ItineraryTab` in detail shell | reuse existing `getRouteStore('route')` read path | Tier 0 + Tier 1 + Tier 2 |
| S3 | Detail width parity | apply shared desktop width rail to header + workspace so main itinerary detail matches `Itinerary (Test)` | no new API work | Tier 0 + Tier 1 |
| S4 | Regression confidence | verify back-to-cards, create flow, mixed cards ordering, and unchanged user-itinerary opens | verify no changes to itinerary ownership or persistence rules | Tier 2 + Tier 3 |

## Delivery Notes

### S0

- Canonical detail target types: `itineraryId` or `legacyTabKey=route`.
- Back action always clears both detail-target params.
- `itineraryId` keeps precedence if an old URL somehow includes both params.

### S1

- Cards view becomes a single desktop stack aligned to the left edge of the content rail.
- Add a `Starter route` section with one seeded card.
- Keep `Your itineraries` sorted by `updatedAt desc` and otherwise unchanged.

### S2

- Seeded card opens the existing primary `route` detail experience inside the normal itinerary detail shell.
- No writes to `ItineraryStore` when the starter route is opened or edited.
- Saved itineraries continue to use `ItineraryWorkspace` and `/api/itineraries/:id/*` only.

### S3

- Introduce one desktop content-width utility/token shared by cards and detail shells.
- Align back button, itinerary header, and planning table to the same width rail.
- Do not redesign table internals in this slice.

### S4

- FE Tier 1: cards sections, starter-card click, saved-card click, width class coverage, URL normalization.
- Server Tier 1: seeded metadata derivation and non-regression for saved-itinerary list ordering.
- Tier 2: authenticated SSR page state with both sections present and both detail targets reachable.
- Tier 3: desktop E2E for open starter route -> back -> open saved itinerary -> back -> create itinerary.

## Ownership Split

- FE: cards layout, detail-shell target switch, shared width rail, target-aware query-state handling.
- BE/server: seeded-card view-model composition in `app/page.tsx`; verify no impact on itinerary APIs or ownership checks.
- QA: desktop navigation between starter route and saved itineraries, plus no-regression coverage for create/open/back flows.

## Open Follow-ups

- If product later wants seeded-route parity in client-refetched cards data, mirror the same synthetic-card composition in `GET /api/itineraries` as a follow-up slice.
- If seeded route should eventually become user-owned, plan that as a separate migration feature rather than folding it into this desktop polish slice.
