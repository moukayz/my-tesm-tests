import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createGoogleFlightsServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = createMcpExpressApp({ host: HOST });

// Session map: one transport+server pair per session ID
const sessions = new Map<string, StreamableHTTPServerTransport>();

async function handleMcpPost(req: Request, res: Response): Promise<void> {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;

	if (sessionId && sessions.has(sessionId)) {
		// Existing session — reuse transport
		const transport = sessions.get(sessionId)!;
		await transport.handleRequest(req, res, req.body);
		return;
	}

	// Extract API key from Authorization: Bearer <key> header
	const auth = req.headers["authorization"];
	const apiKey = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

	// New session — create a fresh transport + server pair
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (id) => {
			sessions.set(id, transport);
		},
	});

	transport.onclose = () => {
		if (transport.sessionId) {
			sessions.delete(transport.sessionId);
		}
	};

	const server = createGoogleFlightsServer(apiKey);
	await server.connect(transport);
	await transport.handleRequest(req, res, req.body);
}

app.post("/mcp", (req, res) => { void handleMcpPost(req, res); });
app.get("/mcp", (req, res) => {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;
	const transport = sessionId ? sessions.get(sessionId) : undefined;
	if (transport) {
		void transport.handleRequest(req, res);
	} else {
		res.status(404).json({ error: "Session not found" });
	}
});
app.delete("/mcp", (req, res) => {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;
	const transport = sessionId ? sessions.get(sessionId) : undefined;
	if (transport) {
		void transport.handleRequest(req, res);
	} else {
		res.status(404).json({ error: "Session not found" });
	}
});

app.listen(PORT, HOST, () => {
	console.error(`google-flights-mcp on http://${HOST}:${PORT}/mcp`);
});
