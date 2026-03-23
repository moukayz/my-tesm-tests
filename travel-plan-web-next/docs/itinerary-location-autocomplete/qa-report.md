# QA Report - Itinerary Location Autocomplete

- Date: 2026-03-23
- Feature: `itinerary-location-autocomplete`
- Verdict: Acceptable

## Scope Validated

- Add/edit stay autocomplete component behavior
- Custom raw-text fallback behavior
- Backend `GET /api/locations/search` contract and normalization path
- Stay persistence for resolved metadata vs custom fallback
- Legacy city-only read/edit normalization
- Previously failing frontend build and smoke-path regression

## Environment Notes

- Validation ran from `travel-plan-web-next`
- Production build now succeeds locally
- Targeted Playwright smoke now starts and passes end to end
- Live GeoNames/provider-backed behavior is still not separately revalidated from tracked `.env*` because provider credentials are not present in-repo; backend contract and degraded handling remain covered in Jest/integration tests

## Commands Run

```bash
npm run build
npm test -- --runInBand __tests__/unit/locationSearch.test.ts __tests__/unit/locationSearch.service.test.ts __tests__/unit/locationSearch.geonamesProvider.test.ts __tests__/unit/itineraryEditor.test.ts __tests__/integration/api-location-search.test.ts __tests__/integration/api-itineraries.test.ts __tests__/components/LocationAutocompleteField.test.tsx __tests__/components/StaySheet.test.tsx __tests__/components/ItineraryWorkspace.test.tsx
ITINERARY_DATA_DIR="data/itineraries-qa-autocomplete-$(date +%s)" npm run test:e2e:local -- __tests__/e2e/itinerary-creation-workspace.spec.ts
npm test -- --runInBand
npm test -- --runInBand __tests__/components/ItineraryPanel.test.tsx
```

## Results

| Area | Result | Notes |
|---|---|---|
| Production build | PASS | `npm run build` completed successfully; prior `LocationAutocompleteField.tsx` typecheck blocker is cleared |
| Focused autocomplete/unit/integration/component coverage | PASS | 9 suites, 45 tests passed including the stale `__tests__/unit/itineraryEditor.test.ts` expectation update |
| Backend location search route | PASS | Auth, validation, normalized resolved payloads, and degraded handling covered in `__tests__/integration/api-location-search.test.ts` |
| Resolved metadata persistence | PASS | `__tests__/integration/api-itineraries.test.ts` verified resolved save + nights-only edit preserves metadata |
| Custom fallback + stale metadata clearing | PASS | `__tests__/components/StaySheet.test.tsx` and `__tests__/integration/api-itineraries.test.ts` verified text-edit downgrade to `custom` |
| Legacy city-only handling | PASS | `__tests__/integration/api-itineraries.test.ts` verified read normalization to `location.kind = custom` |
| Browser smoke path | PASS | `__tests__/e2e/itinerary-creation-workspace.spec.ts` passed (2 tests) with isolated itinerary data dir |
| Full Jest suite | FAIL | Non-feature failure remains in `__tests__/components/ItineraryPanel.test.tsx`; feature-adjacent `__tests__/unit/itineraryEditor.test.ts` is now green |

## Feature Findings

- No open feature-specific blockers were reproduced in this revalidation pass.
- The previously reported frontend build blocker in `components/LocationAutocompleteField.tsx` is resolved.
- The previously reported feature-adjacent stale expectation in `__tests__/unit/itineraryEditor.test.ts` is resolved.
- Backend-owned location autocomplete is acceptable for merge from a QA perspective based on build, focused contract coverage, persistence checks, and the recovered browser smoke path.

## Separate Unrelated Repo Issues

### Unrelated failing suite

- File: `__tests__/components/ItineraryPanel.test.tsx`
- Current failure: cannot find accessible button `Open itinerary Paris Week` in cards-view test (`1 failed, 4 passed`)
- Scope assessment: unrelated to the location autocomplete feature; does not block accepting `itinerary-location-autocomplete`

### Local environment note

- `npm run db:init` could not be rerun on this machine because `psql` is not installed in the local shell.
- This did not block feature smoke validation because `npm run test:e2e:local -- __tests__/e2e/itinerary-creation-workspace.spec.ts` still passed against the existing local DB setup.

## Acceptance Summary

- The backend-owned location autocomplete feature is now acceptable.
- The prior build/smoke blocker is cleared, targeted feature coverage is green, and the browser smoke path executes successfully.
- Remaining repo noise is unrelated to this feature and should be tracked separately.
