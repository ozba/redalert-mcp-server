import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally before importing modules
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock socket.io-client to prevent real connections
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

import { createServer } from "../server.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function makeSuccessResponse(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  };
}

function makeErrorResponse(status: number, statusText: string, body = "") {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
  };
}

// Helper to call a tool on the server by inspecting registered tools
async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {}
) {
  // Use the server's internal tool handler
  const handler = (server as any)._registeredTools?.[toolName];
  if (!handler) {
    throw new Error(`Tool ${toolName} not found`);
  }
  return handler.handler(args);
}

describe("REST API tool handlers", () => {
  let server: McpServer;

  beforeEach(() => {
    mockFetch.mockReset();
    server = createServer();
  });

  describe("get_active_alerts", () => {
    it("should return active alerts data", async () => {
      const alertData = { missiles: ["CityA", "CityB"], earthQuake: ["CityC"] };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(alertData));

      const result = await callTool(server, "get_active_alerts");
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(alertData);
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrorResponse(500, "Internal Server Error")
      );

      const result = await callTool(server, "get_active_alerts");
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("server error");
    });
  });

  describe("get_stats_summary", () => {
    it("should pass parameters correctly", async () => {
      const summaryData = {
        totals: { range: 100, last24h: 5, last7d: 30, last30d: 80 },
        uniqueCities: 15,
        uniqueZones: 4,
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(summaryData));

      const result = await callTool(server, "get_stats_summary", {
        include: "topCities,timeline",
        topLimit: 10,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("include=topCities%2Ctimeline");
      expect(url).toContain("topLimit=10");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.totals.range).toBe(100);
    });

    it("should handle rate limiting", async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrorResponse(429, "Too Many Requests")
      );

      const result = await callTool(server, "get_stats_summary");
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Rate limited");
    });
  });

  describe("get_stats_cities", () => {
    it("should return city stats with pagination", async () => {
      const citiesData = {
        data: [{ city: "Tel Aviv", cityZone: "Dan", count: 50 }],
        pagination: { total: 100, limit: 5, offset: 0, hasMore: true },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(citiesData));

      const result = await callTool(server, "get_stats_cities", {
        limit: 5,
        search: "tel",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data).toHaveLength(1);
      expect(parsed.pagination.hasMore).toBe(true);
    });
  });

  describe("get_stats_history", () => {
    it("should return historical alerts", async () => {
      const historyData = {
        data: [
          {
            id: 1,
            timestamp: "2024-01-01T00:00:00Z",
            type: "missiles",
            origin: "gaza",
            cities: [{ id: 1, name: "CityA" }],
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(historyData));

      const result = await callTool(server, "get_stats_history", {
        category: "missiles",
        sort: "timestamp",
        order: "desc",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data[0].type).toBe("missiles");
    });

    it("should filter cities when search param is used", async () => {
      const historyData = {
        data: [
          {
            id: 1,
            timestamp: "2024-01-01T00:00:00Z",
            type: "missiles",
            origin: "gaza",
            cities: [
              { id: 1, name: "אילת" },
              { id: 2, name: "באר שבע" },
              { id: 3, name: "תל אביב" },
            ],
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(historyData));

      const result = await callTool(server, "get_stats_history", {
        search: "אילת",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data[0].cities).toHaveLength(1);
      expect(parsed.data[0].cities[0].name).toBe("אילת");
    });

    it("should filter cities when cityName param is used", async () => {
      const historyData = {
        data: [
          {
            id: 1,
            timestamp: "2024-01-01T00:00:00Z",
            type: "missiles",
            origin: "gaza",
            cities: [
              { id: 1, name: "אילת" },
              { id: 2, name: "באר שבע" },
            ],
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(historyData));

      const result = await callTool(server, "get_stats_history", {
        cityName: "באר שבע",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data[0].cities).toHaveLength(1);
      expect(parsed.data[0].cities[0].name).toBe("באר שבע");
    });

    it("should filter cities when cityId param is used", async () => {
      const historyData = {
        data: [
          {
            id: 1,
            timestamp: "2024-01-01T00:00:00Z",
            type: "missiles",
            origin: "gaza",
            cities: [
              { id: 10, name: "אילת" },
              { id: 20, name: "באר שבע" },
              { id: 30, name: "תל אביב" },
            ],
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(historyData));

      const result = await callTool(server, "get_stats_history", {
        cityId: 20,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data[0].cities).toHaveLength(1);
      expect(parsed.data[0].cities[0].id).toBe(20);
    });

    it("should NOT filter cities when no city filter is used", async () => {
      const historyData = {
        data: [
          {
            id: 1,
            timestamp: "2024-01-01T00:00:00Z",
            type: "missiles",
            origin: "gaza",
            cities: [
              { id: 1, name: "CityA" },
              { id: 2, name: "CityB" },
              { id: 3, name: "CityC" },
            ],
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(historyData));

      const result = await callTool(server, "get_stats_history", {
        category: "missiles",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data[0].cities).toHaveLength(3);
    });
  });

  describe("get_stats_distribution", () => {
    it("should return distribution data", async () => {
      const distData = {
        data: [
          { category: "missiles", count: 500 },
          { category: "earthQuake", count: 10 },
        ],
        totalAlerts: 510,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(distData));

      const result = await callTool(server, "get_stats_distribution", {
        groupBy: "category",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.totalAlerts).toBe(510);
      expect(parsed.data).toHaveLength(2);
    });
  });

  describe("search_shelters", () => {
    it("should return shelter results with lat/lon", async () => {
      const shelterData = {
        success: true,
        count: 1,
        results: [
          {
            id: 1,
            address: "123 Main St",
            city: "Tel Aviv",
            lat: 32.0853,
            lon: 34.7818,
            distance_m: 150,
            distance_km: 0.15,
            wheelchair_accessible: true,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(shelterData));

      const result = await callTool(server, "search_shelters", {
        lat: 32.0853,
        lon: 34.7818,
        limit: 5,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.results[0].city).toBe("Tel Aviv");
    });

    it("should resolve city name to coordinates when lat/lon not provided", async () => {
      // First call: cities API to resolve coordinates
      const citiesData = {
        data: [{ id: 840, name: "כפר סבא", lat: 32.1715, lng: 34.9078 }],
        pagination: { total: 1, limit: 1, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(citiesData));

      // Second call: shelter search with resolved coordinates
      const shelterData = {
        success: true,
        count: 1,
        results: [
          { id: 1, lat: 32.172, lon: 34.911, distance_m: 330 },
        ],
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(shelterData));

      const result = await callTool(server, "search_shelters", {
        city: "כפר סבא",
        limit: 5,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      // Verify the cities API was called first
      expect(mockFetch.mock.calls[0][0]).toContain("/api/data/cities");
      // Verify shelter search was called with resolved coords
      expect(mockFetch.mock.calls[1][0]).toContain("/api/shelter/search");
      expect(mockFetch.mock.calls[1][0]).toContain("lat=32.1715");
      expect(mockFetch.mock.calls[1][0]).toContain("lon=34.9078");
    });

    it("should return error when city not found", async () => {
      const citiesData = { data: [], pagination: { total: 0 } };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(citiesData));

      const result = await callTool(server, "search_shelters", {
        city: "NonExistentCity",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Could not find coordinates");
    });

    it("should return error when neither lat/lon nor city provided", async () => {
      const result = await callTool(server, "search_shelters", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Either lat/lon or city");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      const result = await callTool(server, "search_shelters", {
        lat: 32.0,
        lon: 34.0,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to connect");
    });

    it("should fallback to base city name for compound names with ' - '", async () => {
      // First call: search for "תל אביב - יפו" returns no coords
      const emptyData = { data: [], pagination: { total: 0, limit: 1, offset: 0, hasMore: false } };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(emptyData));

      // Second call: search for "תל אביב" (base name) returns coords
      const baseCityData = {
        data: [{ id: 1, name: "תל אביב - דרום העיר ויפו", lat: 32.0853, lng: 34.7818 }],
        pagination: { total: 1, limit: 1, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(baseCityData));

      // Third call: shelter search with resolved coordinates
      const shelterData = {
        success: true,
        count: 1,
        results: [{ id: 1, lat: 32.085, lon: 34.782, distance_m: 100 }],
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(shelterData));

      const result = await callTool(server, "search_shelters", {
        city: "תל אביב - יפו",
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      // Verify first call was the full compound name
      expect(mockFetch.mock.calls[0][0]).toContain("/api/data/cities");
      // Verify second call was the base name
      expect(mockFetch.mock.calls[1][0]).toContain("/api/data/cities");
      // Verify shelter search used resolved coords
      expect(mockFetch.mock.calls[2][0]).toContain("/api/shelter/search");
      expect(mockFetch.mock.calls[2][0]).toContain("lat=32.0853");
      expect(mockFetch.mock.calls[2][0]).toContain("lon=34.7818");
    });

    it("should pass wheelchairOnly as wheelchair param to API", async () => {
      const shelterData = {
        success: true,
        count: 1,
        results: [{ id: 1, wheelchair_accessible: true }],
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(shelterData));

      await callTool(server, "search_shelters", {
        lat: 32.0853,
        lon: 34.7818,
        wheelchairOnly: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("wheelchair=true");
      expect(url).not.toContain("wheelchairOnly");
    });
  });

  describe("get_cities", () => {
    it("should return city catalog", async () => {
      const citiesData = {
        data: [
          { id: 1, name: "City1", zone: "Zone1" },
          { id: 2, name: "City2", zone: null },
        ],
        pagination: { total: 2, limit: 100, offset: 0, hasMore: false },
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(citiesData));

      const result = await callTool(server, "get_cities", {
        include: "translations,coords",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data).toHaveLength(2);
    });
  });

  describe("health_check", () => {
    it("should return health status", async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse({ status: "ok" }));

      const result = await callTool(server, "health_check");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("ok");
    });

    it("should handle authentication errors", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401, "Unauthorized"));

      const result = await callTool(server, "health_check");
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Authentication failed");
    });

    it("should handle plain text OK response from health endpoint", async () => {
      // The health endpoint returns plain text "OK" instead of JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const result = await callTool(server, "health_check");
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("ok");
    });
  });
});
