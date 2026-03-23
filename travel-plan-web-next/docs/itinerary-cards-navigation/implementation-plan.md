# Implementation Plan - Itinerary Cards Navigation

**Feature ID:** itinerary-cards-navigation  
**Date:** 2026-03-22  
**Refs:** [system-design.md](./system-design.md) · [feature-analysis.md](./feature-analysis.md)

## Slice Plan

| Slice | Goal | FE | BE | Gate |
|---|---|---|---|---|
| S0 | Lock contract and query-state rules | shell state review | add `GET /api/itineraries` contract | Tier 0 + Tier 1 |
| S1 | Default cards library state | cards component + empty/loading/error states | list endpoint + summary mapping | Tier 0 + Tier 1 + Tier 2 |
| S2 | Card-to-workspace navigation | query-param selection + deep-link compatibility | verify existing detail endpoint still fits | Tier 0 + Tier 1 + Tier 2 |
| S3 | In-app return to cards | persistent back affordance + not-found recovery path | none beyond regression checks | Tier 0 + Tier 1 + Tier 2 |
| S4 | End-to-end confidence | critical desktop flow coverage | auth/order/error integration coverage | Tier 3 |

## Slice Details

### S0 - Contract And Routing

- Author `GET /api/itineraries` in `packages/contracts/openapi.yaml`.
- Confirm canonical state rule: no `itineraryId` means cards view; selected `itineraryId` means detail view.
- Keep `/` as the only page route.

### S1 - Cards Library

- Add a dedicated cards-view component under the authenticated `Itinerary` tab.
- Render populated, empty, loading, and request-error states inside the cards area.
- Expose `New itinerary` from cards view without changing modal behavior.

### S2 - Open Existing Workspace

- Card click updates the query string to `?tab=itinerary&itineraryId=<id>`.
- Reuse `ItineraryWorkspace` and `ItineraryTab` as-is for the selected itinerary.
- Preserve direct-load and reload behavior for deep-linked detail URLs.

### S3 - Back Navigation

- Add a visible desktop back control in the detail workspace header.
- Back action clears `itineraryId` and returns to cards without a full-page redirect.
- Reuse the same return path from detail-level error states.

### S4 - Verification

- FE Tier 1: cards rendering, card click routing, back action, empty/error states, dirty-state guard behavior.
- BE Tier 1: list ordering, summary derivation, auth rejection.
- Tier 2: `GET /api/itineraries` contract, detail deep link, forbidden/not-found recovery.
- Tier 3: open Itinerary tab -> choose card -> edit workspace entry point still loads -> back to cards -> choose another card.

## Ownership Split

- FE lead: tab shell state, cards component, workspace back affordance, desktop UX polish.
- BE lead: list endpoint, summary mapping, auth/logging coverage, no-regression validation on detail reads.
- QA: cards-first entry, deep-link behavior, back recovery, empty state, list-load failure, forbidden/not-found handling.

## Open Risks

- If any code path still assumes latest-itinerary auto-selection, cards view can flash or be skipped; remove that assumption early in S1.
- If card clicks are allowed during unsaved detail edits, users may lose changes; align with the current workspace guard instead of creating a special case.
