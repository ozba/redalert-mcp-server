import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerRealtimeTools } from "./realtime/tools.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "redalert",
    version: "1.0.0",
    description: "Israel RedAlert emergency alerts - real-time alerts, statistics, shelter search, and city data",
  });

  registerTools(server);
  registerRealtimeTools(server);

  return server;
}
