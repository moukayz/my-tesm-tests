import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlightDetailsModel, SerpApiFlightsResponse } from "../src/flightSearch.js";
import {
	fetchOutboundFlights,
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
