# System Architecture - travel-plan-web-next

## System Shape

Next.js 15 App Router remains the only deployable app. UI, authenticated APIs, location-provider integration, and storage access stay inside the same Vercel-hosted monolith.

```mermaid
flowchart LR
    Browser[Browser]
    Next[Next.js app\nRSC + Client Components + Route Handlers]
    Auth[NextAuth Google session]
    Lookup[Location provider API\nbackend-internal]
    Store[ItineraryStore\nUpstash in prod / file store in local]
    PG[PostgreSQL / Neon\ntrain + analytics datasets]

    Browser --> Next
    Next --> Auth
    Next --> Lookup
    Next --> Store
    Next --> PG
```

## MVP Architecture Decisions

- Keep the existing itinerary editor as the primary workspace; do not add a separate planner app.
- Make the authenticated `Itinerary` tab a two-step flow: cards library first, existing editor second.
- Introduce an itinerary-scoped persistence boundary instead of the current single seeded `route` record.
- Keep the legacy seeded `route` available as a separate starter card inside the cards library instead of migrating it into user-owned itinerary storage.
- Store each itinerary as metadata plus `RouteDay[]` so `ItineraryTab` can keep its current rendering and plan-edit behavior.
- Add itinerary-scoped route handlers under `/api/itineraries*`; legacy flat write routes can be retained only as migration shims.
- Keep deployment, auth provider, logging stack, and serverless model unchanged.
- Keep third-party location lookup behind a backend-owned same-origin API so the frontend stays provider-agnostic.

## Component Boundaries

```mermaid
flowchart TD
    Page[app/page.tsx]
    TravelPlan[components/TravelPlan.tsx]
    Cards[Itinerary cards view]
    Workspace[Itinerary workspace shell]
    Starter[Seeded route detail\nlegacy route target]
    Tab[components/ItineraryTab.tsx]
    ApiList[GET /api/itineraries]
    StaySheet[Stay create/edit sheet]
    ApiCreate[POST /api/itineraries]
    ApiRead[GET /api/itineraries/:id]
    ApiStayCreate[POST /api/itineraries/:id/stays]
    ApiStayPatch[PATCH /api/itineraries/:id/stays/:stayIndex]
    ApiPlan[PATCH /api/itineraries/:id/days/:dayIndex/plan]
    ApiLookup[GET /api/location-autocomplete]
    SearchSvc[Location search service]
    Provider[Provider adapter\ninternal]
    Store[ItineraryStore]

    Page --> TravelPlan
    TravelPlan --> Cards
    TravelPlan --> Workspace
    TravelPlan --> Starter
    Cards --> ApiList
    Cards --> ApiRead
    Workspace --> Tab
    Starter --> Tab
    Workspace --> StaySheet
    Workspace --> ApiCreate
    Workspace --> ApiRead
    Workspace --> ApiStayCreate
    Workspace --> ApiStayPatch
    StaySheet --> ApiLookup
    ApiLookup --> SearchSvc
    SearchSvc --> Provider
    Tab --> ApiPlan
    ApiCreate --> Store
    ApiRead --> Store
    ApiStayCreate --> Store
    ApiStayPatch --> Store
    ApiPlan --> Store
```

## Storage Model

- `itinerary metadata`: `id`, `ownerEmail`, `name`, `startDate`, `status`, `createdAt`, `updatedAt`
- `itinerary days`: full `RouteDay[]` blob keyed by `itineraryId`
- `user itinerary index`: ordered list of itinerary ids per owner for latest-itinerary lookup
- `stays`: derived from contiguous `RouteDay.overnight` blocks; no separate stay table in MVP

## Navigation Model

- `/` stays the main authenticated entry.
- `?tab=itinerary` opens the itinerary cards view for authenticated users.
- `?tab=itinerary&itineraryId=<id>` opens the existing itinerary workspace for the selected itinerary.
- `?tab=itinerary&legacyTabKey=route` opens the original seeded route inside the same detail shell.
- If `itineraryId` is absent, the app stays in cards view; if none exist, cards view renders the empty library state with `New itinerary`.
- The cards view may include one synthetic starter card backed by the legacy `route` store plus the user's persisted itineraries.
- `New itinerary` opens a lightweight create modal and redirects into the new workspace after success.

## Operational Baseline

- AuthN/AuthZ: existing NextAuth session; every itinerary API checks ownership by `ownerEmail`.
- Legacy seeded-route access stays inside the authenticated monolith and does not change user-itinerary ownership rules.
- Logging: structured `info/warn/error` logs with `itineraryId`, route name, user email, and validation code.
- Metrics: request count, p95 latency, create success rate, stay mutation failure rate.
- Third-party lookup: backend-owned location autocomplete exposed as `GET /api/location-autocomplete`; frontend adds debounce, request cancellation, max 5 results, and custom-location fallback on any failure.
- Security: keep provider credentials server-side; frontend never receives provider usernames, keys, or provider-specific query parameters.
- Backward compatibility: current editor data shape stays `RouteDay[]`; FE/BE migrate to itinerary-scoped APIs before removing legacy single-route flows.
