#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { connectionManager } from "./realtime/connection-manager.js";

async function main(): Promise<void> {
  console.error("RedAlert MCP Server starting...");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("RedAlert MCP Server running on stdio transport");
}

process.on("SIGINT", () => {
  console.error("Shutting down...");
  connectionManager.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down...");
  connectionManager.disconnect();
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
