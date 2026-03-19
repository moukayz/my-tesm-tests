import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchFlightsWithSerpApi, searchInputSchema, toToolError } from "./flightSearch.js";

export interface CallerContext {
	sessionId?: string;
	clientIp?: string;
	forwardedFor?: string;
	userAgent?: string;
}

function logEvent(event: string, payload: Record<string, unknown>): void {
	console.error(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

function getPreviewCount(): number {
	const raw = Number(process.env.MCP_LOG_PREVIEW_COUNT ?? 2);
	if (!Number.isFinite(raw) || raw < 0) {
		return 2;
	}
	return Math.floor(raw);
}

export function createGoogleFlightsServer(apiKey?: string, callerContext: CallerContext = {}): McpServer {
	const resolvedKey = apiKey ?? process.env.SERPAPI_API_KEY;
	if (!resolvedKey) {
		throw new Error(
			"Missing SERPAPI_API_KEY. Set it in the environment before starting the MCP server.",
		);
	}

	const server = new McpServer({
		name: "google-flights-mcp",
		version: "1.0.0",
	});

	server.registerTool(
		"search_flights",
		{
			description: `Search flights using Google Flights via SerpApi.

Input parameters (types):
- type (int, required): 1 | 2 | 3
- max_results (int, optional): 1..20, default 5
- sort_by (int, optional): 1 | 2 | 3 | 4 | 5
- max_stops (int, optional): 0 | 1 | 2 | 3
- outbound_times (string, optional)
- return_times (string, optional)
- include_airlines (string[], optional)
- exclude_airlines (string[], optional)
- travel_class (int, optional): 1 | 2 | 3 | 4
- next_leg_sort_by (int, optional, type=3 only): 1 | 2 | 3 | 4 | 5

Trip types:
- type=2: one-way
- type=1: round-trip
- type=3: multi-city (exactly 2 segments in multi_city_segments)

Sorting:
- sort_by=1: top flights
- sort_by=2: price
- sort_by=3: departure time
- sort_by=4: arrival time
- sort_by=5: duration
- next_leg_sort_by (type=3 only): sort for next-leg token lookups; defaults to sort_by when omitted

Filters:
- max_stops (SerpApi stops mapping):
  - 0: any number of stops (default)
  - 1: nonstop only
  - 2: 1 stop or fewer
  - 3: 2 stops or fewer
- outbound_times, return_times, e.g.:
	4,18: 4:00 AM - 7:00 PM departure
	0,18: 12:00 AM - 7:00 PM departure
	19,23: 7:00 PM - 12:00 AM departure
	4,18,3,19: 4:00 AM - 7:00 PM departure, 3:00 AM - 8:00 PM arrival
	0,23,3,19: unrestricted departure, 3:00 AM - 8:00 PM arrival
- include_airlines OR exclude_airlines (mutually exclusive)
- travel_class: 1 economy, 2 premium economy, 3 business, 4 first

Result behavior:
- max_results limits first-leg flights (best_flights first, then other_flights)
- round-trip attaches return_flights per outbound flight
- multi-city attaches next_leg_flights per first-leg flight (max 3 each)`,
			inputSchema: searchInputSchema,
		},
		async (input) => {
		logEvent("mcp.tool.call", {
			tool: "search_flights",
			session_id: callerContext.sessionId,
			client_ip: callerContext.clientIp,
			forwarded_for: callerContext.forwardedFor,
			user_agent: callerContext.userAgent,
			input,
		});

			try {
				const results = await searchFlightsWithSerpApi(input, resolvedKey);
				logEvent("mcp.tool.success", {
					tool: "search_flights",
					session_id: callerContext.sessionId,
					success: true,
				});
				return {
					content: [{ type: "text", text: JSON.stringify(results) }],
					structuredContent: { flights: results },
				};
			} catch (error: unknown) {
				logEvent("mcp.tool.error", {
					tool: "search_flights",
					session_id: callerContext.sessionId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
				return toToolError(error);
			}
		},
	);

	return server;
}
