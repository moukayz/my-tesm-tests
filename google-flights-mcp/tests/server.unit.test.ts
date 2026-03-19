import { afterEach, describe, expect, it, vi } from "vitest";

const registerTool = vi.fn();
const connect = vi.fn().mockResolvedValue(undefined);
const mockedServerInstance = { registerTool, connect };

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
	McpServer: vi.fn(() => mockedServerInstance),
}));

const searchFlightsWithSerpApi = vi.fn();
const toToolError = vi.fn((error: unknown) => ({
	isError: true,
	content: [{ type: "text", text: String(error) }],
}));

vi.mock("../src/flightSearch.js", () => ({
	searchInputSchema: { type: "schema" },
	searchFlightsWithSerpApi,
	toToolError,
}));

afterEach(() => {
	vi.clearAllMocks();
	delete process.env.SERPAPI_API_KEY;
});

describe("createGoogleFlightsServer", () => {
	it("registers search_flights tool and returns structured content on success", async () => {
		const { createGoogleFlightsServer } = await import("../src/server.js");

		const mockFlights = [{ type: "nonstop", total_duration: 100, flights: [] }];
		searchFlightsWithSerpApi.mockResolvedValueOnce(mockFlights);

		createGoogleFlightsServer("test-api-key");

		expect(registerTool).toHaveBeenCalledTimes(1);
		expect(registerTool.mock.calls[0]?.[0]).toBe("search_flights");

		const handler = registerTool.mock.calls[0]?.[2] as (input: unknown) => Promise<unknown>;
		const result = await handler({
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 2,
			max_results: 5,
		});

		expect(searchFlightsWithSerpApi).toHaveBeenCalledWith(
			{ departure_id: "SFO", arrival_id: "JFK", outbound_date: "2025-06-01", type: 2, max_results: 5 },
			"test-api-key",
		);
		expect(result).toEqual({
			content: [{ type: "text", text: JSON.stringify(mockFlights) }],
			structuredContent: { flights: mockFlights },
		});
	});

	it("falls back to SERPAPI_API_KEY env variable", async () => {
		const { createGoogleFlightsServer } = await import("../src/server.js");
		process.env.SERPAPI_API_KEY = "env-key";

		searchFlightsWithSerpApi.mockResolvedValueOnce([]);
		createGoogleFlightsServer();

		const handler = registerTool.mock.calls[0]?.[2] as (input: unknown) => Promise<unknown>;
		await handler({ departure_id: "A", arrival_id: "B", outbound_date: "2025-01-01", type: 2, max_results: 5 });

		expect(searchFlightsWithSerpApi).toHaveBeenCalledWith(expect.anything(), "env-key");
	});

	it("passes multi-city tool input through unchanged", async () => {
		const { createGoogleFlightsServer } = await import("../src/server.js");

		searchFlightsWithSerpApi.mockResolvedValueOnce([]);
		createGoogleFlightsServer("test-api-key");

		const handler = registerTool.mock.calls[0]?.[2] as (input: unknown) => Promise<unknown>;
		await handler({
			type: 3,
			multi_city_segments: [
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
			],
			max_results: 5,
		});

		expect(searchFlightsWithSerpApi).toHaveBeenCalledWith(
			{
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
				],
				max_results: 5,
			},
			"test-api-key",
		);
	});

	it("throws when no API key is provided", async () => {
		const { createGoogleFlightsServer } = await import("../src/server.js");

		expect(() => createGoogleFlightsServer()).toThrow("SERPAPI_API_KEY");
	});

	it("routes errors to toToolError", async () => {
		const { createGoogleFlightsServer } = await import("../src/server.js");

		const err = new Error("network failure");
		searchFlightsWithSerpApi.mockRejectedValueOnce(err);
		toToolError.mockReturnValueOnce({
			isError: true,
			content: [{ type: "text", text: "mapped error" }],
		});

		createGoogleFlightsServer("test-api-key");
		const handler = registerTool.mock.calls[0]?.[2] as (input: unknown) => Promise<unknown>;
		const result = await handler({});

		expect(toToolError).toHaveBeenCalledWith(err);
		expect(result).toEqual({
			isError: true,
			content: [{ type: "text", text: "mapped error" }],
		});
	});
});
