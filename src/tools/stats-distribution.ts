import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStatsDistribution } from "../api/stats.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_stats_distribution",
    "Get alert distribution grouped by category or origin, with filtering, sorting, and pagination",
    {
      startDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter from"),
      endDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter until"),
      origin: z.string().optional()
        .describe("Filter by origin(s), comma-separated"),
      groupBy: z.enum(["category", "origin"]).optional()
        .describe("Group results by category or origin (default: category)"),
      category: z.string().optional()
        .describe("Filter by specific alert type (exact match)"),
      limit: z.coerce.number().int().min(1).max(100).optional()
        .describe("Number of categories to return (1-100, default 50)"),
      offset: z.coerce.number().int().min(0).optional()
        .describe("Number of results to skip"),
      sort: z.enum(["count", "category"]).optional()
        .describe("Sort by count or category (default: count)"),
      order: z.enum(["asc", "desc"]).optional()
        .describe("Sort direction (default: desc)"),
    },
    async (params) => {
      try {
        // The upstream API uses "label" as the sort field name, not "category"
        const apiParams = {
          ...params,
          sort: params.sort === "category" ? "label" : params.sort,
        };
        const data = await getStatsDistribution(apiParams);
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
