# Error Model - travel-plan-web-next

## Envelope

Itinerary APIs return JSON errors in the shape `{ "error": "CODE" }` plus a user-safe message handled in the UI.

## Shared Rules

- `400`: request shape or domain validation failed.
- `401`: no authenticated session.
- `403`: session exists but does not own the itinerary.
- `404`: itinerary or stay target does not exist.
- `409`: request targets stale or non-editable state.
- `503`: dependent service is temporarily unavailable but the app may offer a degraded fallback.
- `500`: unexpected storage or server failure.

## MVP Itinerary Codes

| Code | Status | Meaning | UI handling |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | User is not signed in | redirect to login or show auth prompt |
| `ITINERARY_FORBIDDEN` | 403 | Signed-in user does not own the itinerary | toast and leave current view unchanged |
| `ITINERARY_NOT_FOUND` | 404 | `itineraryId` does not exist | show recoverable error state with return-to-cards CTA |
| `INVALID_START_DATE` | 400 | Missing or invalid shell start date | inline form error |
| `INVALID_ITINERARY_NAME` | 400 | Name exceeds MVP length rules | inline form error |
| `STAY_CITY_REQUIRED` | 400 | City is blank after trim | inline form error |
| `STAY_NIGHTS_MIN` | 400 | Nights is less than `1` | inline form error |
| `STAY_LOCATION_INVALID` | 400 | Structured location payload is malformed | inline form error |
| `STAY_LOCATION_LABEL_MISMATCH` | 400 | Transitional `city` field does not match `location.label` | inline form error |
| `STAY_INDEX_INVALID` | 404 | Requested stay index no longer exists | reload workspace and reopen editor |
| `STAY_TRAILING_DAYS_LOCKED` | 409 | Last-stay shrink would delete days that already have plan or train details | ask user to clear trailing details first |
| `STAY_MUTATION_INVALID` | 400 | Server rejected an impossible stay transition | revert optimistic update and show toast |
| `WORKSPACE_STALE` | 409 | Client edited a stale itinerary snapshot | refetch workspace and ask user to retry |
| `LOCATION_QUERY_TOO_SHORT` | 400 | Search query has fewer than 2 non-space characters | suppress request and keep custom option |
| `LOCATION_QUERY_TOO_LONG` | 400 | Search query exceeds backend max length | keep input editable and show local validation |
| `LOCATION_LIMIT_INVALID` | 400 | Search `limit` is missing or outside the allowed range | client bug; retry with default limit |
| `INTERNAL_ERROR` | 500 | Unhandled storage/server error | toast and preserve last known client state |

## UX Mapping

- Cards-view load failures use the shared request-level pattern: inline error panel with retry, while keeping the user inside the `Itinerary` tab.
- Desktop starter-route card failures reuse the existing legacy route-store failure handling; show a recoverable inline detail error with the same back-to-cards CTA and no new error code.
- Shell create errors stay inline inside the modal.
- Selected-itinerary open failures (`ITINERARY_NOT_FOUND`, `ITINERARY_FORBIDDEN`) show a recoverable detail-state error with an in-app back action to cards view.
- Stay create/edit errors stay inline when field-level, toast when request-level.
- Plan-edit errors reuse the current inline-save failure pattern in `ItineraryTab`.

## Lookup UX States

These states remain local to the stay-sheet experience even though autocomplete now calls a backend API.

| State | Trigger | UI handling |
|---|---|---|
| `LOOKUP_IDLE` | fewer than 2 non-space chars | hide remote suggestions; allow raw custom value |
| `LOOKUP_LOADING` | active debounced same-origin autocomplete request | keep typing responsive; show lightweight loading row |
| `LOOKUP_EMPTY` | backend returns zero resolved candidates | show custom option only |
| `LOOKUP_FAILED` | network failure or backend degraded response (`LOOKUP_CONFIG_MISSING`, `LOOKUP_UNAVAILABLE`, `LOOKUP_RATE_LIMITED`) | show custom option only plus compact non-blocking hint |
| `LOOKUP_STALE_SELECTION` | user edits text after selecting a geocoded place | clear selected place metadata before save |

Legacy itinerary stays with only `city` / `overnight` data and no structured location metadata are treated as custom locations on read and edit.

Provider-specific causes such as timeout, rate limiting, upstream quota issues, or missing server config are logged internally and should map to `LOCATION_LOOKUP_UNAVAILABLE` rather than leaking provider details to the frontend.
