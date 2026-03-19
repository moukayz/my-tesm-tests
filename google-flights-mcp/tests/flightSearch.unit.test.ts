import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlightDetailsModel, SerpApiFlightsResponse } from "../src/flightSearch.js";
import {
	buildSerpApiParams,
	fetchOutboundFlights,
	searchInputSchema,
	searchFlightsWithSerpApi,
	toToolError,
} from "../src/flightSearch.js";

const TEST_API_KEY = "test-key";

function makeFlight(overrides: Partial<FlightDetailsModel> = {}): FlightDetailsModel {
	return {
		flights: [],
		total_duration: 120,
		type: "nonstop",
		departure_token: "token-abc",
		...overrides,
	};
}

function makeSerpResponse(overrides: Partial<SerpApiFlightsResponse> = {}): SerpApiFlightsResponse {
	return {
		best_flights: [],
		other_flights: [],
		...overrides,
	};
}

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockFetch = vi.fn();
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function okResponse(data: unknown) {
	return Promise.resolve({
		ok: true,
		status: 200,
		statusText: "OK",
		json: () => Promise.resolve(data),
	});
}

describe("searchFlightsWithSerpApi — one-way", () => {
	it("calls SerpApi once and returns flights without return_flights", async () => {
		const flight = makeFlight({ departure_token: undefined });
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [flight] })));

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 2 as const,
			max_results: 5,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(results).toHaveLength(1);
		expect(results[0]?.return_flights).toBeUndefined();
	});

	it("returns only FlightModel-defined fields inside flights[]", async () => {
		const flight = makeFlight({
			flights: [
				{
					duration: 120,
					airplane: "A320",
					airline: "UA",
					airline_logo: "logo",
					travel_class: "Economy",
					flight_number: "UA100",
					overnight: false,
					often_delayed_by_over_30_min: false,
					departure_airport: { id: "SFO" },
					extensions: ["wifi"],
					ticket_also_sold_by: ["XX"],
				} as unknown as never,
			],
		});

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [flight] })));

		const results = await searchFlightsWithSerpApi(
			{
				departure_id: "SFO",
				arrival_id: "JFK",
				outbound_date: "2025-06-01",
				type: 2,
				max_results: 5,
			},
			TEST_API_KEY,
		);

		expect(results[0]?.flights[0]).toEqual({
			duration: 120,
			airplane: "A320",
			airline: "UA",
			airline_logo: "logo",
			travel_class: "Economy",
			flight_number: "UA100",
			overnight: false,
			often_delayed_by_over_30_min: false,
		});
	});
});

describe("searchFlightsWithSerpApi — round-trip", () => {
	it("fetches outbound then return flights for each flight", async () => {
		const flight1 = makeFlight({ departure_token: "tok1" });
		const flight2 = makeFlight({ departure_token: "tok2" });
		const returnFlight = makeFlight({ departure_token: undefined });

		// First call: outbound
		mockFetch.mockReturnValueOnce(
			okResponse(makeSerpResponse({ best_flights: [flight1, flight2] })),
		);
		// Return for flight1
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [returnFlight] })));
		// Return for flight2
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [returnFlight] })));

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 1 as const,
			return_date: "2025-06-10",
			max_results: 5,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		// 1 outbound + 2 return fetches
		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(results).toHaveLength(2);
		expect(results[0]?.return_flights).toHaveLength(1);
		expect(results[1]?.return_flights).toHaveLength(1);
	});

	it("slices to max_results before fetching return flights", async () => {
		const flights = [
			makeFlight({ departure_token: "tok1" }),
			makeFlight({ departure_token: "tok2" }),
			makeFlight({ departure_token: "tok3" }),
		];

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: flights })));
		// Only 2 return fetches (max_results=2)
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [] })));
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [] })));

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 1 as const,
			return_date: "2025-06-10",
			max_results: 2,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		// 1 outbound + 2 return (not 3)
		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(results).toHaveLength(2);
	});

	it("skips return fetch when departure_token is missing", async () => {
		const flight = makeFlight({ departure_token: undefined });

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [flight] })));

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 1 as const,
			return_date: "2025-06-10",
			max_results: 5,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(results[0]?.return_flights).toEqual([]);
	});

	it("silences return-fetch network failures and sets return_flights to []", async () => {
		const flight = makeFlight({ departure_token: "tok1" });

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [flight] })));
		mockFetch.mockReturnValueOnce(Promise.reject(new Error("network error")));

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 1 as const,
			return_date: "2025-06-10",
			max_results: 5,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		expect(results[0]?.return_flights).toEqual([]);
	});
});

describe("searchFlightsWithSerpApi — multi-city", () => {
	it("fetches first leg then chains next-leg flights per first-leg result", async () => {
		const bestFlight = makeFlight({ departure_token: "best1" });
		const otherFlight = makeFlight({ departure_token: "other1" });
		const nextLegA = makeFlight({ departure_token: undefined });
		const nextLegB = makeFlight({ departure_token: undefined });
		const nextLegC = makeFlight({ departure_token: undefined });
		const nextLegD = makeFlight({ departure_token: undefined });

		mockFetch.mockReturnValueOnce(
			okResponse(makeSerpResponse({ best_flights: [bestFlight], other_flights: [otherFlight] })),
		);
		mockFetch.mockReturnValueOnce(
			okResponse(makeSerpResponse({ best_flights: [nextLegA, nextLegB], other_flights: [nextLegC] })),
		);
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [nextLegD] })));

		const input = {
			type: 3 as const,
			multi_city_segments: [
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
			],
			max_results: 2,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(results).toHaveLength(2);
		expect(results[0]?.departure_token).toBe("best1");
		expect(results[0]?.next_leg_flights).toHaveLength(3);
		expect(results[1]?.next_leg_flights).toHaveLength(1);
	});

	it("limits next_leg_flights to 3 per first-leg result", async () => {
		const firstLeg = makeFlight({ departure_token: "tok1" });
		const nextLegFlights = [
			makeFlight({ departure_token: undefined }),
			makeFlight({ departure_token: undefined }),
			makeFlight({ departure_token: undefined }),
			makeFlight({ departure_token: undefined }),
		];

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [firstLeg] })));
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: nextLegFlights })));

		const input = {
			type: 3 as const,
			multi_city_segments: [
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
			],
			max_results: 1,
		};

		const results = await searchFlightsWithSerpApi(input, TEST_API_KEY);
		expect(results[0]?.next_leg_flights).toHaveLength(3);
	});

	it("uses multi-city query context with departure_token for next-leg lookups", async () => {
		const firstLeg = makeFlight({ departure_token: "tok1" });

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [firstLeg] })));
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [] })));

		const input = {
			type: 3 as const,
			multi_city_segments: [
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
			],
			max_results: 1,
		};

		await searchFlightsWithSerpApi(input, TEST_API_KEY);

		const secondUrl = mockFetch.mock.calls[1]?.[0] as string;
		expect(secondUrl).toContain("departure_token=tok1");
		expect(secondUrl).toContain("type=3");
		expect(secondUrl).toContain("multi_city_json=");
		expect(secondUrl).not.toContain("departure_id=");
		expect(secondUrl).not.toContain("arrival_id=");
		expect(secondUrl).not.toContain("outbound_date=");
	});

	it("uses next_leg_sort_by when provided", async () => {
		const firstLeg = makeFlight({ departure_token: "tok1" });

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [firstLeg] })));
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [] })));

		await searchFlightsWithSerpApi(
			{
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
				],
				sort_by: 2,
				next_leg_sort_by: 5,
				max_results: 1,
			},
			TEST_API_KEY,
		);

		const secondUrl = mockFetch.mock.calls[1]?.[0] as string;
		expect(secondUrl).toContain("sort_by=5");
	});

	it("inherits first-leg sort_by for next-leg lookups", async () => {
		const firstLeg = makeFlight({ departure_token: "tok1" });

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [firstLeg] })));
		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [] })));

		await searchFlightsWithSerpApi(
			{
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
				],
				sort_by: 4,
				max_results: 1,
			},
			TEST_API_KEY,
		);

		const secondUrl = mockFetch.mock.calls[1]?.[0] as string;
		expect(secondUrl).toContain("sort_by=4");
	});

	it("sends multi_city_json for type=3", () => {
		const input = {
			type: 3 as const,
			multi_city_segments: [
				{ departure_id: "sfo", arrival_id: "lax", date: "2025-06-01" },
				{ departure_id: "lax", arrival_id: "las", date: "2025-06-04" },
			],
			outbound_times: "08,12",
			return_times: "14,20",
			max_results: 3,
		};

		const parsedInput = searchInputSchema.parse(input);
		const params = buildSerpApiParams(parsedInput, TEST_API_KEY);

		expect(params.get("type")).toBe("3");
		expect(params.get("departure_id")).toBeNull();
		expect(params.get("arrival_id")).toBeNull();
		expect(params.get("outbound_date")).toBeNull();
		expect(params.get("outbound_times")).toBeNull();
		expect(params.get("return_times")).toBeNull();
		expect(params.get("multi_city_json")).toBe(
			JSON.stringify([
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01", times: "8,12" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04", times: "14,20" },
			]),
		);
	});

	it("normalizes HH:MM time formats for multi-city segment times", () => {
		const params = buildSerpApiParams(
			searchInputSchema.parse({
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
				],
				outbound_times: "08:30,11:45",
				return_times: "13:05,21:55",
				max_results: 2,
			}),
			TEST_API_KEY,
		);

		expect(params.get("multi_city_json")).toBe(
			JSON.stringify([
				{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01", times: "8,11" },
				{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04", times: "13,21" },
			]),
		);
	});

	it("validates multi-city input shape", () => {
		expect(() =>
			searchInputSchema.parse({
				type: 3,
				multi_city_segments: [{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" }],
			}),
		).toThrow("Exactly 2 segments are required");

		expect(() =>
			searchInputSchema.parse({
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
					{ departure_id: "LAS", arrival_id: "SEA", date: "2025-06-07" },
				],
			}),
		).toThrow("Exactly 2 segments are required");

		expect(() =>
			searchInputSchema.parse({
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025/06/04" },
				],
			}),
		).toThrow("Must be YYYY-MM-DD");

		expect(() =>
			searchInputSchema.parse({
				type: 3,
				multi_city_segments: [
					{ departure_id: "SFO", arrival_id: "LAX", date: "2025-06-01" },
					{ departure_id: "LAX", arrival_id: "LAS", date: "2025-06-04" },
				],
				include_airlines: ["UA"],
				exclude_airlines: ["AA"],
			}),
		).toThrow("include_airlines and exclude_airlines cannot both be provided");
	});
});

describe("buildSerpApiParams", () => {
	it("maps supported sort and filter options", () => {
		const params = buildSerpApiParams(
			searchInputSchema.parse({
				type: 2,
				departure_id: "sfo",
				arrival_id: "jfk",
				outbound_date: "2025-06-01",
				sort_by: 3,
				max_stops: 1,
				outbound_times: "09,18",
				return_times: "10,20",
				include_airlines: ["ua", "dl"],
				travel_class: 2,
				max_results: 5,
			}),
			TEST_API_KEY,
		);

		expect(params.get("sort_by")).toBe("3");
		expect(params.get("stops")).toBe("1");
		expect(params.get("outbound_times")).toBe("9,18");
		expect(params.get("return_times")).toBe("10,20");
		expect(params.get("include_airlines")).toBe("UA,DL");
		expect(params.get("travel_class")).toBe("2");
	});

	it("maps max_stops to SerpApi stops parameter", async () => {
		const params = buildSerpApiParams(
			searchInputSchema.parse({
				type: 2,
				departure_id: "SFO",
				arrival_id: "JFK",
				outbound_date: "2025-06-01",
				max_stops: 0,
				max_results: 5,
			}),
			TEST_API_KEY,
		);

		expect(params.get("stops")).toBe("0");

		mockFetch.mockReturnValueOnce(okResponse(makeSerpResponse({ best_flights: [makeFlight()] })));
		await fetchOutboundFlights(
			searchInputSchema.parse({
				type: 2,
				departure_id: "SFO",
				arrival_id: "JFK",
				outbound_date: "2025-06-01",
				max_stops: 2,
				max_results: 5,
			}),
			TEST_API_KEY,
		);
		const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
		expect(calledUrl).toContain("stops=2");
	});
});

describe("fetchOutboundFlights", () => {
	it("throws on non-2xx SerpApi response", async () => {
		mockFetch.mockReturnValueOnce(
			Promise.resolve({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				json: () => Promise.resolve({}),
			}),
		);

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 2 as const,
			max_results: 5,
		};

		await expect(fetchOutboundFlights(input, TEST_API_KEY)).rejects.toThrow("401");
	});

	it("merges best_flights and other_flights", async () => {
		const best = makeFlight({ departure_token: "best1" });
		const other = makeFlight({ departure_token: "other1" });

		mockFetch.mockReturnValueOnce(
			okResponse(makeSerpResponse({ best_flights: [best], other_flights: [other] })),
		);

		const input = {
			departure_id: "SFO",
			arrival_id: "JFK",
			outbound_date: "2025-06-01",
			type: 2 as const,
			max_results: 5,
		};

		const results = await fetchOutboundFlights(input, TEST_API_KEY);
		expect(results).toHaveLength(2);
	});
});

describe("toToolError", () => {
	it("wraps Error instance", () => {
		const result = toToolError(new Error("something went wrong"));
		expect(result).toEqual({
			content: [{ type: "text", text: "something went wrong" }],
			isError: true,
		});
	});

	it("wraps non-Error value", () => {
		const result = toToolError("plain string error");
		expect(result).toEqual({
			content: [{ type: "text", text: "plain string error" }],
			isError: true,
		});
	});
});
