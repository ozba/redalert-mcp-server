import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStatsSummary, getStatsCities, getStatsDistribution } from "../api/stats.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "get_stats_summary",
    "Get high-level overview of the alert system: totals, unique cities/zones, and optional top cities/zones/origins/timeline/peak data",
    {
      startDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter from"),
      endDate: z.string().datetime().optional()
        .describe("ISO 8601 date to filter until"),
      origin: z.string().optional()
        .describe("Filter by origin(s), comma-separated (e.g. 'gaza,lebanon')"),
      include: z.string().optional()
        .describe("Comma-separated optional sections: topCities, topZones, topOrigins, timeline, peak"),
      topLimit: z.coerce.number().int().min(1).max(50).optional()
        .describe("Number of items in topCities/topZones (1-50, default 5)"),
      timelineGroup: z.enum(["hour", "day", "week", "month"]).optional()
        .describe("Grouping interval for timeline (default: hour)"),
    },
    async (params) => {
      try {
        // The upstream /api/stats/summary endpoint does not support the "origin"
        // parameter (returns 500). Work around by fetching cities+distribution
        // with the origin filter and assembling a summary ourselves.
        if (params.origin) {
          return formatSuccessResult(await buildOriginFilteredSummary(params));
        }
        const data = await getStatsSummary(params);
        return formatSuccessResult(data);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}

async function buildOriginFilteredSummary(params: {
  startDate?: string;
  endDate?: string;
  origin?: string;
  include?: string;
  topLimit?: number;
}): Promise<Record<string, unknown>> {
  const dateFilter = {
    startDate: params.startDate,
    endDate: params.endDate,
    origin: params.origin,
  };

  const includes = new Set((params.include || "").split(",").map((s) => s.trim()).filter(Boolean));
  const topLimit = params.topLimit ?? 5;

  // Fetch cities data to compute totals and unique counts
  const citiesData = await getStatsCities({
    ...dateFilter,
    limit: 500,
  }) as {
    data?: Array<{ city?: string; cityZone?: string; count?: number }>;
    pagination?: { total?: number };
  };

  const cities = citiesData.data || [];
  const totalAlerts = cities.reduce((sum, c) => sum + (c.count || 0), 0);
  const uniqueCities = cities.length;
  const uniqueZones = new Set(cities.map((c) => c.cityZone).filter(Boolean)).size;

  const summary: Record<string, unknown> = {
    totals: { range: totalAlerts },
    uniqueCities,
    uniqueZones,
  };

  if (includes.has("topCities")) {
    summary.topCities = cities
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, topLimit)
      .map((c) => ({ city: c.city, zone: c.cityZone, count: c.count }));
  }

  if (includes.has("topZones")) {
    const zoneMap = new Map<string, number>();
    for (const c of cities) {
      if (c.cityZone) {
        zoneMap.set(c.cityZone, (zoneMap.get(c.cityZone) || 0) + (c.count || 0));
      }
    }
    summary.topZones = [...zoneMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
      .map(([zone, count]) => ({ zone, count }));
  }

  return summary;
}
