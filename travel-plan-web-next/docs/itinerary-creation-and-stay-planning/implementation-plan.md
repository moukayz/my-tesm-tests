# Implementation Plan - Itinerary Creation and Stay Planning

**Feature ID:** itinerary-creation-and-stay-planning  
**Date:** 2026-03-21  
**Refs:** [system-design.md](./system-design.md) · [feature-analysis.md](./feature-analysis.md)

## Slice Plan

| Slice | Goal | FE | BE | Gate |
|---|---|---|---|---|
| S0 | Contract and persistence foundation | review payloads | create itinerary store + contract tests | Tier 0 + Tier 1 |
| S1 | New itinerary shell flow | modal + route/query sync | `POST/GET /api/itineraries` | Tier 0 + Tier 1 + Tier 2 |
| S2 | Empty workspace to first stay | empty state + add-stay sheet | append-stay API + day generation | Tier 0 + Tier 1 + Tier 2 |
| S3 | Edit stay city and nights | edit sheet + inline nights polish | stay patch API + last-stay rules | Tier 0 + Tier 1 + Tier 2 |
| S4 | Repoint existing editor writes | `ItineraryTab` plan saves by `itineraryId` | day-plan patch API | Tier 0 + Tier 1 + Tier 2 |
| S5 | Critical-path verification | component + E2E coverage | integration coverage | Tier 3 |

## Slice Details

### S0 - Contract And Store

- Author `packages/contracts/openapi.yaml` for the new itinerary-scoped APIs.
- Introduce `ItineraryStore` with metadata lookup, `createShell`, `getById`, `listByOwner`, and `updateDays`.
- Preserve `RouteDay[]` as the editor-facing shape.

### S1 - Shell Creation

- Add `New itinerary` trigger in the authenticated itinerary area.
- Create a minimal modal with `name` optional and `startDate` required.
- After success, navigate to `/?tab=itinerary&itineraryId=<id>` and render empty workspace guidance.

### S2 - Add Stay Progressively

- Build one reusable stay sheet for `Add first stay` and `Add next stay`.
- Append-only insertion for MVP.
- Server generates blank `RouteDay` rows and recomputes dates from `startDate`.

### S3 - Edit Stay

- Add workspace-level `Edit stay` action with `city` and `nights` fields.
- Keep the existing inline nights control for fast numeric edits.
- Support last-stay expand/shrink with server-side protection against deleting authored trailing content.

### S4 - Existing Editor Integration

- Pass `itineraryId` into `ItineraryTab` fetches.
- Keep plan editing behavior and optimistic patterns aligned with the current editor.
- Defer train-editor API repointing unless this feature needs it to preserve parity for newly generated days.

### S5 - Verification

- FE Tier 1: modal, empty state, stay sheet, query-param selection.
- BE Tier 1: store behavior, date regeneration, stay mutation rules.
- Tier 2: auth, ownership, create/read/append/edit API routes.
- Tier 3: create shell -> add first stay -> add next stay -> edit city/nights -> reload.

## Ownership Split

- FE lead: shell UX, workspace state, stay sheet, `ItineraryTab` integration.
- BE lead: itinerary store, route handlers, ownership checks, date/stay mutation logic.
- QA: happy path, auth rejection, not-found recovery, last-stay shrink guard.

## Open Risks

- Existing train-edit behavior on newly added blank days may need a small follow-up if parity is required in the same release.
- If local file persistence needs multi-itinerary support for tests, seed/fixture tooling should land in S0, not later.
