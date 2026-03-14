import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHealth } from "../api/health.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "health_check",
    "Check the health status of the RedAlert API",
    {},
    async () => {
      try {
        const data = await getHealth();
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
