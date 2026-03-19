import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const E2E_PORT = 3099;
const E2E_HOST = "127.0.0.1";
const MCP_URL = new URL(`http://${E2E_HOST}:${E2E_PORT}/mcp`);

const API_KEY = process.env.SERPAPI_API_KEY ?? "";
const hasKey = Boolean(API_KEY);

function formatDate(daysFromNow: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + daysFromNow);
	return date.toISOString().slice(0, 10);
}

async function pollUntilReady(url: URL, timeoutMs = 15000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { method: "GET" });
			// Any response (including 405) means the server is up
			if (res.status < 600) return;
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

let serverProcess: ChildProcess;

beforeAll(async () => {
	if (!hasKey) return;

	serverProcess = spawn("pnpm", ["start"], {
		cwd: "/Users/bytedance/my-projects/my-team-test/google-flights-mcp",
		// Key is NOT passed here — the test client sends it via Authorization header
		env: { ...process.env, PORT: String(E2E_PORT), HOST: E2E_HOST, SERPAPI_API_KEY: "" },
		stdio: ["ignore", "pipe", "pipe"],
	});

	serverProcess.stderr?.on("data", (chunk: Buffer) => {
		process.stderr.write(`[server] ${chunk.toString()}`);
	});

	await pollUntilReady(MCP_URL);
}, 30000);

afterAll(async () => {
	if (serverProcess) {
		serverProcess.kill("SIGTERM");
		await new Promise<void>((resolve) => serverProcess.on("exit", () => resolve()));
	}
});

async function createClient(): Promise<Client> {
	const transport = new StreamableHTTPClientTransport(MCP_URL, {
		requestInit: {
			headers: { Authorization: `Bearer ${API_KEY}` },
		},
	});
	const client = new Client({ name: "google-flights-mcp-e2e-client", version: "1.0.0" });
	await client.connect(transport);
	return client;
}

const runIfKey = hasKey ? it : it.skip;

describe("google-flights-mcp HTTP e2e", () => {
	runIfKey("listTools includes search_flights", async () => {
		const client = await createClient();
		try {
			const tools = await client.listTools();
			expect(tools.tools.some((t) => t.name === "search_flights")).toBe(true);
		} finally {
			await client.close();
		}
	}, 30000);

	runIfKey("one-way search returns non-empty flights array", async () => {
		const client = await createClient();
		try {
			const result = await client.callTool({
				name: "search_flights",
				arguments: {
					departure_id: "SFO",
					arrival_id: "JFK",
					outbound_date: formatDate(45),
					type: 2,
					max_results: 3,
				},
			});

			expect("isError" in result && result.isError).toBe(false);
			expect("structuredContent" in result).toBe(true);

			const structured = result.structuredContent as { flights: unknown[] };
			expect(structured.flights.length).toBeGreaterThan(0);
		} finally {
			await client.close();
		}
	}, 60000);

	runIfKey("one-way search accepts exposed sort and filter options", async () => {
		const client = await createClient();
		try {
			const result = await client.callTool({
				name: "search_flights",
				arguments: {
					departure_id: "SFO",
					arrival_id: "JFK",
					outbound_date: formatDate(45),
					type: 2,
					sort_by: 2,
					max_stops: 1,
					outbound_times: "09,18",
					include_airlines: ["UA", "DL"],
					travel_class: 1,
					max_results: 2,
				},
			});

			expect("isError" in result && result.isError).toBe(false);
			const structured = result.structuredContent as { flights: unknown[] };
			expect(structured.flights.length).toBeGreaterThan(0);
			expect(structured.flights.length).toBeLessThanOrEqual(2);
		} finally {
			await client.close();
		}
	}, 60000);

	runIfKey("round-trip search returns flights with return_flights arrays", async () => {
		const client = await createClient();
		try {
			const result = await client.callTool({
				name: "search_flights",
				arguments: {
					departure_id: "SFO",
					arrival_id: "JFK",
					outbound_date: formatDate(45),
					type: 1,
					return_date: formatDate(52),
					max_results: 2,
				},
			});

			expect("isError" in result && result.isError).toBe(false);
			const structured = result.structuredContent as {
				flights: Array<{ return_flights?: unknown[] }>;
			};
			expect(structured.flights.length).toBeGreaterThan(0);
			for (const flight of structured.flights) {
				expect(Array.isArray(flight.return_flights)).toBe(true);
			}
		} finally {
			await client.close();
		}
	}, 60000);

	runIfKey("multi-city search returns first-leg flights with chained next_leg_flights", async () => {
		const client = await createClient();
		try {
			const result = await client.callTool({
				name: "search_flights",
				arguments: {
					type: 3,
					multi_city_segments: [
						{ departure_id: "SFO", arrival_id: "LAX", date: formatDate(45) },
						{ departure_id: "LAX", arrival_id: "LAS", date: formatDate(48) },
					],
					max_results: 2,
				},
			});

			expect("isError" in result && result.isError).toBe(false);
			const structured = result.structuredContent as {
				flights: Array<{ next_leg_flights?: unknown[] }>;
			};
			expect(structured.flights.length).toBeGreaterThan(0);
			expect(structured.flights.length).toBeLessThanOrEqual(2);
			for (const flight of structured.flights) {
				expect(Array.isArray(flight.next_leg_flights)).toBe(true);
				expect((flight.next_leg_flights ?? []).length).toBeLessThanOrEqual(3);
			}
		} finally {
			await client.close();
		}
	}, 60000);

	runIfKey("multi-city search accepts next_leg_sort_by override", async () => {
		const client = await createClient();
		try {
			const result = await client.callTool({
				name: "search_flights",
				arguments: {
					type: 3,
					multi_city_segments: [
						{ departure_id: "PVG", arrival_id: "CPH", date: "2027-01-30" },
						{ departure_id: "HEL", arrival_id: "PVG", date: "2027-02-09" },
					],
					sort_by: 2,
					next_leg_sort_by: 5,
					max_stops: 2,
					travel_class: 1,
					max_results: 2,
				},
			});

			expect("isError" in result && result.isError).toBe(false);
			const structured = result.structuredContent as {
				flights: Array<{ next_leg_flights?: unknown[] }>;
			};
			expect(structured.flights.length).toBeGreaterThan(0);
			expect(
				structured.flights.some((flight) => (flight.next_leg_flights ?? []).length > 0),
			).toBe(true);
			for (const flight of structured.flights) {
				expect(Array.isArray(flight.next_leg_flights)).toBe(true);
				expect((flight.next_leg_flights ?? []).length).toBeLessThanOrEqual(3);
			}
		} finally {
			await client.close();
		}
	}, 60000);
});
