---
name: serpapi-google-flights-api
description: Query flight search, multi-city legs, and booking options with SerpApi Google Flights. Use when users ask for live Google Flights data via API.
compatibility: claude-code
---

## When to use me

Use this skill when a user asks to fetch flight options from Google Flights through SerpApi, including one-way, round-trip, multi-city, or booking follow-ups.

## API endpoint

- Base endpoint: `https://serpapi.com/search`
- Engine parameter: `engine=google_flights` (required)
- Auth parameter: `api_key=<SERPAPI_API_KEY>` (required)

## Prerequisites

- Export API key in environment:

```bash
export SERPAPI_API_KEY="<your_key>"
```

- Use `curl` for requests and `jq` to inspect response fields.

## Core request template

```bash
curl -sG "https://serpapi.com/search" \
  --data-urlencode "engine=google_flights" \
  --data-urlencode "api_key=$SERPAPI_API_KEY" \
  --data-urlencode "departure_id=SFO" \
  --data-urlencode "arrival_id=JFK" \
  --data-urlencode "type=2" \
  --data-urlencode "outbound_date=2026-04-15" \
  --data-urlencode "currency=USD" \
  --data-urlencode "hl=en" \
  --data-urlencode "gl=us"
```

## Trip types

- `type=1` round trip (default) -> requires `return_date`
- `type=2` one way
- `type=3` multi-city -> use `multi_city_json`

## Common parameters

- Route/date: `departure_id`, `arrival_id`, `outbound_date`, `return_date`
- Cabin/passengers: `travel_class`, `adults`, `children`, `infants_in_seat`, `infants_on_lap`
- Sorting/filters: `sort_by`, `stops`, `max_price`, `max_duration`, `outbound_times`, `return_times`
- Airline constraints: `include_airlines` or `exclude_airlines` (never both)
- Quality/performance: `deep_search=true` for browser-like parity, slower response
- Cache behavior: `no_cache=true` to bypass 1-hour cache

## Advanced flow patterns

### 1) Round-trip: outbound then return options

1. Request outbound flights (`type=1`, no token).
2. Read `best_flights[].departure_token` (or from `other_flights[]`).
3. Make second call with `departure_token=<token>` to fetch return choices.

Example second call:

```bash
curl -sG "https://serpapi.com/search" \
  --data-urlencode "engine=google_flights" \
  --data-urlencode "api_key=$SERPAPI_API_KEY" \
  --data-urlencode "departure_token=<token_from_outbound>"
```

### 2) Multi-city itinerary

For `type=3`, pass `multi_city_json` as JSON string:

```bash
curl -sG "https://serpapi.com/search" \
  --data-urlencode "engine=google_flights" \
  --data-urlencode "api_key=$SERPAPI_API_KEY" \
  --data-urlencode "type=3" \
  --data-urlencode 'multi_city_json=[{"departure_id":"CDG","arrival_id":"NRT","date":"2026-05-05"},{"departure_id":"NRT","arrival_id":"LAX","date":"2026-05-12"}]'
```

Use `departure_token` from leg N to fetch leg N+1 options.

### 3) Booking options for selected flights

Use `booking_token` from a result to retrieve booking offers:

```bash
curl -sG "https://serpapi.com/search" \
  --data-urlencode "engine=google_flights" \
  --data-urlencode "api_key=$SERPAPI_API_KEY" \
  --data-urlencode "booking_token=<booking_token_from_results>"
```

`booking_token` and `departure_token` are mutually exclusive.

## Useful response fields

- Request status: `search_metadata.status` (`Processing`, `Success`, `Error`)
- API error text: top-level `error`
- Main result sets: `best_flights`, `other_flights`
- Trend data: `price_insights` (for example `lowest_price`, `price_history`)
- Follow-up tokens: `departure_token`, `booking_token`

Quick extraction examples:

```bash
# Show top 5 best flight prices with first segment details
jq '.best_flights[:5] | map({price, total_duration, first_leg: .flights[0]})'

# Pull departure tokens for chaining
jq -r '.best_flights[]?.departure_token // empty'

# Check status and possible error
jq '{status: .search_metadata.status, error: .error}'
```

## Validation rules and caveats

- `return_date` is required for `type=1`.
- `exclude_basic=true` currently applies only for US domestic economy searches (`gl=us`, `travel_class=1`).
- `include_airlines` and `exclude_airlines` cannot be combined.
- `async=true` cannot be combined with `no_cache=true`.
- `deep_search=true` improves similarity with browser Google Flights results but increases latency.

## Troubleshooting

- Empty results: widen `max_duration`, relax `stops`, remove strict airline filters.
- Token call returns unexpected data: ensure you are not sending conflicting route/date filter params with token-based follow-up.
- Missing required fields: always inspect `search_parameters` and `search_metadata` in the response before assuming failure.

## Source

- SerpApi docs: `https://serpapi.com/google-flights-api`
