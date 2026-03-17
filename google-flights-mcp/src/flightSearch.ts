import { z } from "zod";

export const searchInputSchema = z.object({
	departure_id: z.string().trim().toUpperCase(),
	arrival_id: z.string().trim().toUpperCase(),
	outbound_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
	type: z.union([z.literal(1), z.literal(2)]),
	return_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
		.optional(),
	max_results: z.number().int().positive().max(20).default(5),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export interface AirportInfo {
	name: string;
	id: string;
	time: string;
}

export interface FlightModel {
	departure_airport: AirportInfo;
	arrival_airport: AirportInfo;
	duration: number;
	airplane: string;
	airline: string;
	airline_logo: string;
	travel_class: string;
	flight_number: string;
	extensions: string[];
	ticket_also_sold_by?: string[];
	legroom?: string;
	overnight?: boolean;
	often_delayed_by_over_30_min?: boolean;
	plane_and_crew_by?: string;
}

export interface LayoverModel {
	duration: number;
	name: string;
	id: string;
	overnight?: boolean;
}

export interface FlightDetailsModel {
	flights: FlightModel[];
	layovers?: LayoverModel[];
	total_duration: number;
	price?: number;
	type: string;
	airline_logo?: string;
	extensions?: string[];
	departure_token?: string;
	booking_token?: string;
	return_flights?: FlightDetailsModel[];
}

export interface SerpApiFlightsResponse {
	best_flights?: FlightDetailsModel[];
	other_flights?: FlightDetailsModel[];
}

export function buildSerpApiParams(
	input: SearchInput,
	apiKey: string,
	departureToken?: string,
): URLSearchParams {
	const params = new URLSearchParams();
	params.set("engine", "google_flights");
	params.set("api_key", apiKey);
	params.set("departure_id", input.departure_id);
	params.set("arrival_id", input.arrival_id);
	params.set("outbound_date", input.outbound_date);
	params.set("type", String(input.type));
	if (input.return_date) {
		params.set("return_date", input.return_date);
	}
	if (departureToken) {
		params.set("departure_token", departureToken);
	}
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
	input: SearchInput,
	apiKey: string,
	departureToken: string,
): Promise<FlightDetailsModel[]> {
	const params = buildSerpApiParams(input, apiKey, departureToken);
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
				if (!flight.departure_token) {
					flight.return_flights = [];
					return;
				}
				try {
					flight.return_flights = await fetchReturnFlights(input, apiKey, flight.departure_token);
				} catch {
					flight.return_flights = [];
				}
			}),
		);
	}

	return sliced;
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
