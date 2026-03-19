---
description: Compare selected multi-city options (economy + business)
---
Search multi-city flights using `google-flights-mcp` MCP server.

Run exactly these 3 query setups (do not run other variants):

1) Lufthansa baseline
- Route 1: PVG -> CPH on 2027-01-30
- Route 2: HEL -> PVG on 2027-02-09
- Max stops: 1
- Sort by total duration
- Restrict to Lufthansa (`LH`) itineraries only
- Departure time window: first leg in 00:00-11:00, second leg in 12:00-24:00

2) Emirates from Hangzhou (with time windows)
- Route 1: HGH -> CPH on 2027-01-30
- Route 2: HEL -> HGH on 2027-02-09
- Max stops: 1
- Sort by total duration
- Restrict to Emirates (`EK`)
- Departure time window: first leg in 00:00-12:00, second leg in 12:00-24:00

3) Qatar variant with earlier outbound date
- Route 1: HGH -> CPH on 2027-01-29
- Route 2: HEL -> HGH on 2027-02-09
- Max stops: 1
- Sort by total duration
- Restrict to Qatar Airways only (`QR`)
- Departure time window: first leg in 20:00-24:00, second leg in 12:00-24:00

4) Turkish variant with earlier outbound date
- Route 1: PVG -> CPH on 2027-01-29
- Route 2: HEL -> PVG on 2027-02-09
- Max stops: 1
- Sort by total duration
- Restrict to Turkish Airlines only (`TK`)
- Departure time window: first leg in 20:00-24:00, second leg in 12:00-24:00

For each setup, run twice:
1) Economy class
2) Business class

Return results in a single comparison table including:
- Cabin
- Price
- Departure/arrival local times for each segment
- Flight number for each segment
- Duration of each segment
- Layover duration for each connection
- Total trip duration
