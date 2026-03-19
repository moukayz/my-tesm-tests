import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createGoogleFlightsServer, type CallerContext } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = createMcpExpressApp({ host: HOST });

interface SessionEntry {
	transport: StreamableHTTPServerTransport;
	callerContext: CallerContext;
}

// Session map: one transport+server pair per session ID
const sessions = new Map<string, SessionEntry>();

function firstHeader(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

function getClientIp(req: Request): string | undefined {
	const forwardedFor = firstHeader(req.headers["x-forwarded-for"]);
	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim();
	}
	return req.socket.remoteAddress;
}

function logEvent(event: string, payload: Record<string, unknown>): void {
	console.error(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;

	if (sessionId && sessions.has(sessionId)) {
		// Existing session — reuse transport
		const session = sessions.get(sessionId)!;
		logEvent("mcp.http.request", {
			method: req.method,
			path: req.path,
			session_id: sessionId,
			client_ip: session.callerContext.clientIp,
			user_agent: session.callerContext.userAgent,
		});
		await session.transport.handleRequest(req, res, req.body);
		return;
	}

	// Extract API key from Authorization: Bearer <key> header
	const auth = req.headers["authorization"];
	const apiKey = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
	const callerContext: CallerContext = {
		clientIp: getClientIp(req),
		forwardedFor: firstHeader(req.headers["x-forwarded-for"]),
		userAgent: firstHeader(req.headers["user-agent"]),
	};
	logEvent("mcp.http.request", {
		method: req.method,
		path: req.path,
		session_id: "new",
		client_ip: callerContext.clientIp,
		user_agent: callerContext.userAgent,
	});

	// New session — create a fresh transport + server pair
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (id) => {
			callerContext.sessionId = id;
			sessions.set(id, { transport, callerContext });
			logEvent("mcp.session.initialized", {
				session_id: id,
				client_ip: callerContext.clientIp,
				user_agent: callerContext.userAgent,
			});
		},
	});

	transport.onclose = () => {
		if (transport.sessionId) {
			sessions.delete(transport.sessionId);
			logEvent("mcp.session.closed", { session_id: transport.sessionId });
		}
	};

	const server = createGoogleFlightsServer(apiKey, callerContext);
	await server.connect(transport);
	await transport.handleRequest(req, res, req.body);
}

app.post("/mcp", (req, res) => { void handleMcpPost(req, res); });
app.get("/mcp", (req, res) => {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;
	const session = sessionId ? sessions.get(sessionId) : undefined;
	if (session) {
		logEvent("mcp.http.request", {
			method: req.method,
			path: req.path,
			session_id: sessionId,
			client_ip: session.callerContext.clientIp,
			user_agent: session.callerContext.userAgent,
		});
		void session.transport.handleRequest(req, res);
	} else {
		res.status(404).json({ error: "Session not found" });
	}
});
app.delete("/mcp", (req, res) => {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;
	const session = sessionId ? sessions.get(sessionId) : undefined;
	if (session) {
		logEvent("mcp.http.request", {
			method: req.method,
			path: req.path,
			session_id: sessionId,
			client_ip: session.callerContext.clientIp,
			user_agent: session.callerContext.userAgent,
		});
		void session.transport.handleRequest(req, res);
	} else {
		res.status(404).json({ error: "Session not found" });
	}
});

app.listen(PORT, HOST, () => {
	console.error(`google-flights-mcp on http://${HOST}:${PORT}/mcp`);
});
