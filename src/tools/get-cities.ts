import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDataCities } from "../api/data.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_cities",
    "Get city catalog for lookups - raw location records with optional translations, coordinates, and countdown times",
    {
      search: z.string().min(1).max(100).optional()
        .describe("Search by city name (partial match)"),
      zone: z.string().optional()
        .describe("Filter by zone/region name (exact match)"),
      limit: z.coerce.number().int().min(1).max(500).optional()
        .describe("Number of cities to return (1-500, default 100)"),
      offset: z.coerce.number().int().min(0).optional()
        .describe("Number of results to skip"),
      include: z.string().optional()
        .describe("Comma-separated: translations, coords, countdown"),
    },
    async (params) => {
      try {
        const data = await getDataCities(params);
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
