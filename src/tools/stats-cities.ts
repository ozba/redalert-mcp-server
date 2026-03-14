import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStatsCities } from "../api/stats.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_stats_cities",
    "Get city-level alert statistics with pagination, search, and optional translations/coordinates",
    {
      startDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter from"),
      endDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter until"),
      limit: z.coerce.number().int().min(1).optional()
        .describe("Number of cities to return (default 5)"),
      offset: z.coerce.number().int().min(0).optional()
        .describe("Number of results to skip for pagination"),
      origin: z.string().optional()
        .describe("Filter by origin(s), comma-separated"),
      search: z.string().optional()
        .describe("Search cities by name (partial match)"),
      include: z.string().optional()
        .describe("Comma-separated: translations, coords"),
    },
    async (params) => {
      try {
        const data = await getStatsCities(params);
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
