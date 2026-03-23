# Implementation Plan - Itinerary Location Autocomplete

**Feature ID:** itinerary-location-autocomplete  
**Date:** 2026-03-23  
**Refs:** [system-design.md](./system-design.md) · [`../../packages/contracts/openapi.yaml`](../../packages/contracts/openapi.yaml) · [../api/error-model.md](../api/error-model.md)

## Slice Plan

| Slice | Goal | FE | BE | Gate |
|---|---|---|---|---|
| S0 | Contract lock | switch stay-sheet types to `location` payloads | author lookup route + stay schema changes in contract | Tier 0 |
| S1 | Backend lookup path | replace direct provider client with same-origin fetcher | add `/api/location-autocomplete`, service, provider adapter, telemetry | Tier 0 + Tier 1 |
| S2 | Save and reload semantics | submit custom vs resolved location payloads; keep custom option local | persist additive `location` on day/stay payloads; canonicalize resolved saves | Tier 0 + Tier 1 + Tier 2 |
| S3 | Legacy and edit safety | clear resolved selection when text changes | treat city-only records as `custom`; reject invalid/expired suggestion ids safely | Tier 0 + Tier 1 + Tier 2 |
| S4 | Critical path confidence | component and E2E coverage for add/edit/reload/fallback | route/service integration coverage | Tier 3 |

## Delivery Notes

### S0 - Contract First

- Update `packages/contracts/openapi.yaml` before subsystem LLDs.
- Lock the provider-agnostic `StayLocationInput`, `StayLocation`, and `LocationAutocompleteResponse` schemas.
- Keep the custom raw-text option as frontend-local UI, not an API result.

### S1 - Lookup Endpoint

- Frontend replaces GeoNames fetch code with one shared `GET /api/location-autocomplete` client.
- Backend owns query validation, max result count, provider credentials, provider mapping, and generic failure responses.
- Backend/frontend agree that `suggestionId` is opaque and never parsed client-side.

### S2 - Persistence Update

- Additive persistence only: keep `overnight` / `city` labels for current rendering while adding `location` metadata.
- Save flows submit `location.kind='custom'` or `location.kind='resolved'`.
- Workspace reads return canonical saved location metadata so edit sheets can rehydrate existing resolved stays.

### S3 - Backward Compatibility

- Existing city-only stays load as `custom` without migration.
- Editing text after a resolved selection must clear that selection until a new backend suggestion is chosen.
- Invalid lookup tokens must not block the user from saving a custom location.

### S4 - Verification

- Tier 1 FE: debounce, loading, stale response discard, custom-option default, token handling, edit reset behavior.
- Tier 1 BE: query validation, provider result normalization, unavailable mapping, token resolution.
- Tier 2: lookup route integration and stay round-trip for `custom`, `resolved`, and legacy records.
- Tier 3: add-first-stay, add-next-stay, edit-resolved-stay, edit-to-custom, reload persistence, provider-unavailable fallback.

## Handoff Notes

- Backend tech lead should produce a small LLD for route/service/provider-adapter boundaries and token strategy.
- Frontend tech lead should produce an LLD for stay-sheet state transitions around custom vs resolved selection and degraded lookup UX.
- Any provider swap must happen behind the backend service without FE contract changes.

## Open Risks

- Token lifetime/verification must cover realistic typing->selection->save timing without introducing server-side session stickiness.
- If itinerary payload growth becomes noticeable, a later normalization pass may be needed, but it is explicitly out of scope for this feature.
