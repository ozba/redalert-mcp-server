import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchShelters } from "../api/shelter.js";
import { getDataCities } from "../api/data.js";
import { enrichShelterAddresses } from "../api/geocode.js";
import { formatSuccessResult, formatErrorResult } from "../errors.js";

export function register(server: McpServer): void {
  server.tool(
    "search_shelters",
    "Find nearby shelters. Provide lat/lon directly, or just a city name to auto-resolve coordinates.",
    {
      lat: z.coerce.number().min(-90).max(90).optional()
        .describe("Latitude of search center (optional if city is provided)"),
      lon: z.coerce.number().min(-180).max(180).optional()
        .describe("Longitude of search center (optional if city is provided)"),
      city: z.string().optional()
        .describe("City name (Hebrew or English) - auto-resolves to coordinates if lat/lon not provided"),
      limit: z.coerce.number().int().min(1).optional()
        .describe("Number of shelters to return (default 10)"),
      radius: z.coerce.number().positive().optional()
        .describe("Search radius in kilometers"),
      wheelchairOnly: z.boolean().optional()
        .describe("Filter wheelchair accessible shelters only"),
      shelterType: z.string().optional()
        .describe("Filter by shelter type (e.g. 'public', 'private')"),
    },
    async (params) => {
      try {
        let { lat, lon } = params;

        // If no coordinates but city name provided, resolve via cities API
        if (lat === undefined || lon === undefined) {
          if (!params.city) {
            return formatErrorResult(new Error("Either lat/lon or city name must be provided"));
          }

          let citiesData = await getDataCities({
            search: params.city,
            limit: 1,
            include: "coords",
          }) as { data?: Array<{ lat?: number; lng?: number; name?: string }> };

          let city = citiesData.data?.[0];

          // If no results, try the base city name (before " - ") for compound names
          if ((!city || city.lat == null || city.lng == null) && params.city.includes(" - ")) {
            const baseName = params.city.split(" - ")[0].trim();
            citiesData = await getDataCities({
              search: baseName,
              limit: 1,
              include: "coords",
            }) as { data?: Array<{ lat?: number; lng?: number; name?: string }> };
            city = citiesData.data?.[0];
          }

          if (!city || city.lat == null || city.lng == null) {
            return formatErrorResult(new Error(`Could not find coordinates for city: ${params.city}`));
          }

          lat = city.lat;
          lon = city.lng;
        }

        const { city: _city, ...rest } = params;
        const data = await searchShelters({ ...rest, lat, lon });
        const enriched = await enrichShelterAddresses(data);
        return formatSuccessResult(enriched);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );
}
