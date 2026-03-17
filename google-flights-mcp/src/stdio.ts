import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGoogleFlightsServer } from "./server.js";

const server = createGoogleFlightsServer();
const transport = new StdioServerTransport();
await server.connect(transport);
