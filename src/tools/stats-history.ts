import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStatsHistory } from "../api/stats.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_stats_history",
    "Get detailed historical alert records with full city data, filtering, sorting, and pagination",
    {
      startDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter from"),
      endDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter until"),
      limit: z.coerce.number().int().min(1).max(100).optional()
        .describe("Number of alerts to return (1-100, default 20)"),
      offset: z.coerce.number().int().min(0).optional()
        .describe("Number of results to skip for pagination"),
      cityId: z.coerce.number().int().optional()
        .describe("Filter by city ID (exact match)"),
      cityName: z.string().optional()
        .describe("Filter by city name in Hebrew (exact match)"),
      search: z.string().min(1).max(100).optional()
        .describe("Search by city name (partial match, 1-100 chars)"),
      category: z.string().optional()
        .describe("Filter by alert type (e.g. missiles, drones, earthquakes)"),
      origin: z.string().optional()
        .describe("Filter by origin(s), comma-separated"),
      sort: z.enum(["timestamp", "type", "origin"]).optional()
        .describe("Sort results by field (default: timestamp)"),
      order: z.enum(["asc", "desc"]).optional()
        .describe("Sort direction (default: desc)"),
      include: z.string().optional()
        .describe("Comma-separated: translations, coords, polygons"),
    },
    async (params) => {
      try {
        const data = await getStatsHistory(params) as {
          data?: Array<{ cities?: Array<{ id?: number; name?: string }> }>;
          [key: string]: unknown;
        };

        // The API returns complete alert objects with ALL cities per alert,
        // even when filtering by city. Post-process to keep only matching
        // cities, drastically reducing response size.
        if (data.data && (params.search || params.cityName || params.cityId !== undefined)) {
          for (const alert of data.data) {
            if (!alert.cities) continue;
            alert.cities = alert.cities.filter((c) => {
              if (params.cityId !== undefined && c.id === params.cityId) return true;
              if (params.cityName && c.name === params.cityName) return true;
              if (params.search && c.name?.includes(params.search)) return true;
              return false;
            });
          }
        }

        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
