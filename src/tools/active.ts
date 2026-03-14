import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getActiveAlerts } from "../api/active.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_active_alerts",
    "Get real-time snapshot of cities currently under alert, grouped by alert type (missiles, earthquakes, etc.)",
    {},
    async () => {
      try {
        const data = await getActiveAlerts();
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
