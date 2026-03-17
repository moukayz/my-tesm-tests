import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchFlightsWithSerpApi, searchInputSchema, toToolError } from "./flightSearch.js";

export function createGoogleFlightsServer(apiKey?: string): McpServer {
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
			description:
				"Search flights using Google Flights via SerpApi. Supports one-way and round-trip searches. For round trips, each outbound flight includes return_flights. Returns up to max_results outbound flights (default 5, max 20).",
			inputSchema: searchInputSchema,
		},
		async (input) => {
			try {
				const results = await searchFlightsWithSerpApi(input, resolvedKey);
				return {
					content: [{ type: "text", text: JSON.stringify(results) }],
					structuredContent: { flights: results },
				};
			} catch (error: unknown) {
				return toToolError(error);
			}
		},
	);

	return server;
}
