---
name: serpapi-google-flights-api
description: Query one-way, round-trip, and multi-city flight search with SerpApi Google Flights. Use when users ask for SerpApi Google Flights  API usages.
compatibility: claude-code
---

## When to use me

Use this skill when a user asks to fetch flight options from Google Flights through SerpApi, including one-way, round-trip, and multi-city searches.

## API endpoint

- Base endpoint: `https://serpapi.com/search`
- Engine parameter: `engine=google_flights` (required)
- Auth parameter: `api_key=<SERPAPI_API_KEY>` (required)

## Sample request body JSON

Use these JSON objects as parameter payload templates.

### One-way

```json
{
  "engine": "google_flights",
  "api_key": "<SERPAPI_API_KEY>",
  "departure_id": "SFO",
  "arrival_id": "JFK",
  "type": "2",
  "outbound_date": "2026-04-15",
  "travel_class": "1",
  "adults": "1",
  "currency": "USD",
  "hl": "en",
  "gl": "us"
}
```

### Round-trip (first call)

```json
{
  "engine": "google_flights",
  "api_key": "<SERPAPI_API_KEY>",
  "departure_id": "SFO",
  "arrival_id": "LHR",
  "type": "1",
  "outbound_date": "2026-05-10",
  "return_date": "2026-05-20",
  "travel_class": "1",
  "adults": "1",
  "currency": "USD",
  "hl": "en",
  "gl": "us"
}
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

Sample second-call body:

```json
{
  "engine": "google_flights",
  "api_key": "<SERPAPI_API_KEY>",
  "departure_token": "<token_from_outbound_results>"
}
```

### 2) Multi-city itinerary

For `type=3`, pass `multi_city_json` as a JSON string.

Sample body:

```json
{
  "engine": "google_flights",
  "api_key": "<SERPAPI_API_KEY>",
  "type": "3",
  "multi_city_json": "[{\"departure_id\":\"CDG\",\"arrival_id\":\"NRT\",\"date\":\"2026-05-05\"},{\"departure_id\":\"NRT\",\"arrival_id\":\"LAX\",\"date\":\"2026-05-12\"}]",
  "currency": "USD",
  "hl": "en",
  "gl": "us"
}
```

Use `departure_token` from leg N to fetch leg N+1 options.

## Useful response fields

- Request status: `search_metadata.status` (`Processing`, `Success`, `Error`)
- API error text: top-level `error`
- Main result sets: `best_flights`, `other_flights`
- Trend data: `price_insights` (for example `lowest_price`, `price_history`)
- Follow-up tokens: `departure_token`

Sample response fields:

```json
{
  "search_metadata": {
    "status": "Success"
  },
  "best_flights": [
    {
      "price": 742,
      "total_duration": 640,
      "departure_token": "<token>"
    }
  ],
  "price_insights": {
    "lowest_price": 699
  }
}
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
