import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectionManager } from "./connection-manager.js";
import { ALL_ALERT_TYPES } from "./types.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function registerRealtimeTools(server: McpServer): void {
  // subscribe_alerts
  server.tool(
    "subscribe_alerts",
    "Connect to RedAlert Socket.IO server and start receiving real-time emergency alerts. Optionally filter by alert types and enable test mode for simulated alerts.",
    {
      alertTypes: z
        .array(z.string())
        .optional()
        .describe(
          `Alert types to subscribe to. If omitted, subscribes to all. Valid types: ${ALL_ALERT_TYPES.join(", ")}`
        ),
      testMode: z
        .boolean()
        .optional()
        .describe(
          "If true, connect to test server with simulated alerts instead of live alerts"
        ),
      timing: z
        .string()
        .optional()
        .describe(
          'Interval between alerts from test server, e.g. "5s", "1m" (minimum 1s)'
        ),
    },
    async ({ alertTypes, testMode, timing }) => {
      try {
        const result = await connectionManager.subscribe({
          alertTypes,
          testMode,
          timing,
        });
        return formatSuccessResult(result);
      } catch (error) {
        return formatErrorResult(error);
      }
    }
  );

  // poll_alerts
  server.tool(
    "poll_alerts",
    "Retrieve buffered real-time alerts that arrived since the last poll. Must call subscribe_alerts first.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of alerts to return (default 50, max 200)"),
      acknowledge: z
        .boolean()
        .optional()
        .describe(
          "If true (default), clear returned alerts from buffer. If false, peek without consuming."
        ),
    },
    async ({ limit, acknowledge }) => {
      try {
        const result = connectionManager.pollAlerts(
          limit ?? 50,
          acknowledge ?? true
        );
        return formatSuccessResult(result);
      } catch (error) {
        return formatErrorResult(error);
      }
    }
  );

  // unsubscribe_alerts
  server.tool(
    "unsubscribe_alerts",
    "Disconnect from RedAlert Socket.IO server and stop receiving real-time alerts. Clears the alert buffer.",
    {},
    async () => {
      try {
        const result = connectionManager.disconnect();
        return formatSuccessResult(result);
      } catch (error) {
        return formatErrorResult(error);
      }
    }
  );

  // get_alert_subscription_status
  server.tool(
    "get_alert_subscription_status",
    "Check the current real-time alert subscription status including connection state, subscribed types, and buffer size.",
    {},
    async () => {
      const result = connectionManager.getStatus();
      return formatSuccessResult(result);
    }
  );
}
