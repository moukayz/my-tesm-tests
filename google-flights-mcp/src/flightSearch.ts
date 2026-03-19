import { z } from "zod";

const airportCodeSchema = z.string().trim().toUpperCase();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const maxResultsSchema = z.number().int().positive().max(20).default(5);
const sortBySchema = z.union([
	z.literal(1), // top flights
	z.literal(2), // price
	z.literal(3), // departure time
	z.literal(4), // arrival time
	z.literal(5), // duration
]);
const maxStopsSchema = z.union([
	z.literal(0), // Any number of stops
	z.literal(1), // Nonstop only
	z.literal(2), // 1 stop or fewer
	z.literal(3), // 2 stops or fewer
]);
const travelClassSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const commonOptionsSchema = z
	.object({
		max_results: maxResultsSchema,
		sort_by: sortBySchema.optional(),
		max_stops: maxStopsSchema.optional(),
		outbound_times: z.string().trim().min(1).optional(),
		return_times: z.string().trim().min(1).optional(),
		include_airlines: z.array(z.string().trim().toUpperCase()).min(1).optional(),
		exclude_airlines: z.array(z.string().trim().toUpperCase()).min(1).optional(),
		travel_class: travelClassSchema.optional(),
	});

const oneWaySchema = z
	.object({
		type: z.literal(2),
		departure_id: airportCodeSchema,
		arrival_id: airportCodeSchema,
		outbound_date: dateSchema,
	})
	.merge(commonOptionsSchema);

const roundTripSchema = z
	.object({
		type: z.literal(1),
		departure_id: airportCodeSchema,
		arrival_id: airportCodeSchema,
		outbound_date: dateSchema,
		return_date: dateSchema,
	})
	.merge(commonOptionsSchema);

const multiCitySegmentSchema = z.object({
	departure_id: airportCodeSchema,
	arrival_id: airportCodeSchema,
	date: dateSchema,
});

const multiCitySchema = z
	.object({
		type: z.literal(3),
		multi_city_segments: z.array(multiCitySegmentSchema).length(2, "Exactly 2 segments are required"),
		next_leg_sort_by: sortBySchema.optional(),
	})
	.merge(commonOptionsSchema);

export const searchInputSchema = z
	.discriminatedUnion("type", [roundTripSchema, oneWaySchema, multiCitySchema])
	.superRefine((value, ctx) => {
		if (value.include_airlines && value.exclude_airlines) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "include_airlines and exclude_airlines cannot both be provided",
			});
		}
	});

export type SearchInput = z.infer<typeof searchInputSchema>;

export interface AirportInfo {
	name: string;
	id: string;
	time: string;
}

export interface FlightModel {
	// departure_airport: AirportInfo;
	// arrival_airport: AirportInfo;
	duration: number;
	airplane: string;
	airline: string;
	airline_logo: string;
	travel_class: string;
	flight_number: string;
	// extensions: string[];
	// ticket_also_sold_by?: string[];
	// legroom?: string;
	overnight?: boolean;
	often_delayed_by_over_30_min?: boolean;
	// plane_and_crew_by?: string;
}

const ALLOWED_FLIGHT_MODEL_KEYS = [
	"duration",
	"airplane",
	"airline",
	"airline_logo",
	"travel_class",
	"flight_number",
	"overnight",
	"often_delayed_by_over_30_min",
] as const;

function sanitizeFlightModel(flight: FlightModel): FlightModel {
	const sanitized: Partial<FlightModel> = {};
	for (const key of ALLOWED_FLIGHT_MODEL_KEYS) {
		if (key in flight) {
			(sanitized as Record<string, unknown>)[key] = (flight as unknown as Record<string, unknown>)[key];
		}
	}
	return sanitized as FlightModel;
}

function sanitizeFlightModelsInResult(flightDetails: FlightDetailsModel): FlightDetailsModel {
	const sanitized: FlightDetailsModel = {
		...flightDetails,
		flights: Array.isArray(flightDetails.flights)
			? flightDetails.flights.map((flight) => sanitizeFlightModel(flight))
			: [],
	};

	if (Array.isArray(flightDetails.return_flights)) {
		sanitized.return_flights = flightDetails.return_flights.map((flight) =>
			sanitizeFlightModelsInResult(flight),
		);
	}

	if (Array.isArray(flightDetails.next_leg_flights)) {
		sanitized.next_leg_flights = flightDetails.next_leg_flights.map((flight) =>
			sanitizeFlightModelsInResult(flight),
		);
	}

	return sanitized;
}

export interface LayoverModel {
	duration: number;
	name: string;
	id: string;
	overnight?: boolean;
}

export interface FlightDetailsModel {
	[key: string]: unknown;
	flights: FlightModel[];
	layovers?: LayoverModel[];
	total_duration: number;
	price?: number;
	type: string;
	airline_logo?: string;
	// extensions?: string[];
	// departure_token?: string;
	// booking_token?: string;
	return_flights?: FlightDetailsModel[];
	next_leg_flights?: FlightDetailsModel[];
}

export interface SerpApiFlightsResponse {
	best_flights?: FlightDetailsModel[];
	other_flights?: FlightDetailsModel[];
}

function applyOptionalSerpApiParams(
	params: URLSearchParams,
	input: SearchInput,
	overrides?: { sortBy?: number },
): void {
	const resolvedSortBy = overrides?.sortBy ?? input.sort_by;
	if (resolvedSortBy !== undefined) {
		params.set("sort_by", String(resolvedSortBy));
	}

	if (input.max_stops !== undefined) {
		params.set("stops", String(input.max_stops));
	}
	if (input.type !== 3 && input.outbound_times) {
		params.set("outbound_times", normalizeTimeRange(input.outbound_times));
	}
	if (input.type !== 3 && input.return_times) {
		params.set("return_times", normalizeTimeRange(input.return_times));
	}
	if (input.include_airlines?.length) {
		params.set("include_airlines", input.include_airlines.join(","));
	}
	if (input.exclude_airlines?.length) {
		params.set("exclude_airlines", input.exclude_airlines.join(","));
	}
	if (input.travel_class !== undefined) {
		params.set("travel_class", String(input.travel_class));
	}
}

function parseHourToken(rawToken: string): number {
	const token = rawToken.trim();
	if (/^\d{1,2}$/.test(token)) {
		const hour = Number(token);
		if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
			return hour;
		}
		throw new Error(`Invalid hour token: ${rawToken}`);
	}

	const match = token.match(/^(\d{1,2}):(\d{1,2})$/);
	if (!match) {
		throw new Error(`Invalid time token: ${rawToken}`);
	}

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
		throw new Error(`Invalid hour token: ${rawToken}`);
	}
	if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
		throw new Error(`Invalid minute token: ${rawToken}`);
	}

	return hour;
}

function normalizeTimeRange(value: string): string {
	const tokens = value
		.split(",")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

	if (tokens.length !== 2 && tokens.length !== 4) {
		throw new Error(
			`Invalid time range format: ${value}. Expected 2 or 4 comma-separated values (e.g. 4,18 or 4,18,3,19).`,
		);
	}

	const normalized = tokens.map((token) => String(parseHourToken(token)));
	return normalized.join(",");
}

function buildMultiCityJson(
	input: Extract<SearchInput, { type: 3 }>,
): Array<{ departure_id: string; arrival_id: string; date: string; times?: string }> {
	return input.multi_city_segments.map((segment, index) => {
		if (index === 0 && input.outbound_times) {
			return { ...segment, times: normalizeTimeRange(input.outbound_times) };
		}
		if (index === 1 && input.return_times) {
			return { ...segment, times: normalizeTimeRange(input.return_times) };
		}
		return { ...segment };
	});
}

export function buildSerpApiParams(
	input: SearchInput,
	apiKey: string,
	departureToken?: string,
	overrides?: { sortBy?: number },
): URLSearchParams {
	const params = new URLSearchParams();
	params.set("engine", "google_flights");
	params.set("api_key", apiKey);
	params.set("currency", "CNY");
	params.set("gl", "sg");
	params.set("type", String(input.type));

	if (input.type === 3) {
		params.set("multi_city_json", JSON.stringify(buildMultiCityJson(input)));
	} else {
		params.set("departure_id", input.departure_id);
		params.set("arrival_id", input.arrival_id);
		params.set("outbound_date", input.outbound_date);
		if (input.type === 1) {
			params.set("return_date", input.return_date);
		}
	}

	if (departureToken) {
		params.set("departure_token", departureToken);
	}

	applyOptionalSerpApiParams(params, input, overrides);
	return params;
}

export async function fetchFromSerpApi(params: URLSearchParams): Promise<SerpApiFlightsResponse> {
	const url = `https://serpapi.com/search.json?${params.toString()}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`SerpApi request failed with status ${response.status}: ${response.statusText}`);
	}
	return response.json() as Promise<SerpApiFlightsResponse>;
}

export async function fetchOutboundFlights(
	input: SearchInput,
	apiKey: string,
): Promise<FlightDetailsModel[]> {
	const params = buildSerpApiParams(input, apiKey);
	const data = await fetchFromSerpApi(params);
	return [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
}

export async function fetchReturnFlights(
	input: Extract<SearchInput, { type: 1 }>,
	apiKey: string,
	departureToken: string,
): Promise<FlightDetailsModel[]> {
	const params = buildSerpApiParams(input, apiKey, departureToken);
	const data = await fetchFromSerpApi(params);
	return [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
}

export async function fetchNextLegFlights(
	input: Extract<SearchInput, { type: 3 }>,
	apiKey: string,
	departureToken: string,
): Promise<FlightDetailsModel[]> {
	const nextLegSortBy = input.next_leg_sort_by ?? input.sort_by;
	const params = buildSerpApiParams(input, apiKey, departureToken, {
		sortBy: nextLegSortBy,
	});
	const data = await fetchFromSerpApi(params);
	return [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
}

export async function searchFlightsWithSerpApi(
	input: SearchInput,
	apiKey: string,
): Promise<FlightDetailsModel[]> {
	const outbound = await fetchOutboundFlights(input, apiKey);
	const sliced = outbound.slice(0, input.max_results);

	if (input.type === 1) {
		await Promise.all(
			sliced.map(async (flight) => {
				const departureToken =
					typeof flight.departure_token === "string" ? flight.departure_token : undefined;
				if (!departureToken) {
					flight.return_flights = [];
					return;
				}
				try {
					flight.return_flights = await fetchReturnFlights(input, apiKey, departureToken);
				} catch {
					flight.return_flights = [];
				}
			}),
		);
	}

	if (input.type === 3) {
		await Promise.all(
			sliced.map(async (flight) => {
				const departureToken =
					typeof flight.departure_token === "string" ? flight.departure_token : undefined;
				if (!departureToken) {
					flight.next_leg_flights = [];
					return;
				}
				try {
					const nextLegFlights = await fetchNextLegFlights(input, apiKey, departureToken);
					flight.next_leg_flights = nextLegFlights.slice(0, 3);
				} catch {
					flight.next_leg_flights = [];
				}
			}),
		);
	}

	return sliced.map((flight) => sanitizeFlightModelsInResult(flight));
}

export function toToolError(error: unknown): {
	content: Array<{ type: "text"; text: string }>;
	isError: true;
} {
	if (error instanceof Error) {
		return { content: [{ type: "text", text: error.message }], isError: true };
	}
	return {
		content: [{ type: "text", text: String(error) }],
		isError: true,
	};
}
