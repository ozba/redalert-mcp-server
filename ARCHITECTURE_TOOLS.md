# RedAlert MCP Server - Architecture & Tool Definitions

## Overview

A TypeScript MCP server that exposes Israel's RedAlert emergency alert system as MCP tools and resources. Built with `@modelcontextprotocol/sdk` using the Streamable HTTP transport.

---

## Project Structure

```
C:/redAlert/
├── package.json
├── tsconfig.json
├── API_DOCS.md
├── ARCHITECTURE_TOOLS.md
├── src/
│   ├── index.ts                  # Entry point: create & start MCP server
│   ├── server.ts                 # MCP server setup, tool/resource registration
│   ├── config.ts                 # API base URL, API key, constants
│   ├── api/
│   │   ├── client.ts             # Shared HTTP client (fetch wrapper with base URL, error handling)
│   │   ├── active.ts             # GET /api/active
│   │   ├── stats.ts              # GET /api/stats/* (summary, cities, history, distribution)
│   │   ├── shelter.ts            # GET /api/shelter/search
│   │   ├── data.ts               # GET /api/data/cities
│   │   └── health.ts             # GET /api/health
│   ├── tools/
│   │   ├── index.ts              # Registers all tools with the MCP server
│   │   ├── active.ts             # get_active_alerts tool
│   │   ├── stats-summary.ts      # get_stats_summary tool
│   │   ├── stats-cities.ts       # get_stats_cities tool
│   │   ├── stats-history.ts      # get_stats_history tool
│   │   ├── stats-distribution.ts # get_stats_distribution tool
│   │   ├── shelter-search.ts     # search_shelters tool
│   │   ├── get-cities.ts         # get_cities tool
│   │   └── health-check.ts       # health_check tool
│   ├── realtime/
│   │   ├── socket-manager.ts     # Socket.IO connection lifecycle management
│   │   └── alerts-resource.ts    # MCP resource for real-time alert subscriptions
│   └── errors.ts                 # Custom error types and error-to-MCP-result mapping
```

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^3.23",
    "socket.io-client": "^4.7"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "@types/node": "^20",
    "tsx": "^4"
  }
}
```

---

## MCP Tools

### 1. `get_active_alerts`
**Maps to:** `GET /api/active`

Returns a real-time snapshot of cities currently under alert, grouped by alert type.

**Input Schema (Zod):**
```typescript
// No parameters
z.object({})
```

**Returns:** JSON object with alert types as keys and arrays of city names as values.

---

### 2. `get_stats_summary`
**Maps to:** `GET /api/stats/summary`

High-level overview of the alert system with totals, unique counts, and optional sections.

**Input Schema (Zod):**
```typescript
z.object({
  startDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter from"),
  endDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter until"),
  origin: z.string().optional()
    .describe("Filter by origin(s), comma-separated (e.g. 'gaza,lebanon')"),
  include: z.string().optional()
    .describe("Comma-separated optional sections: topCities, topZones, topOrigins, timeline, peak"),
  topLimit: z.number().int().min(1).max(50).optional()
    .describe("Number of items in topCities/topZones (1-50, default 5)"),
  timelineGroup: z.enum(["hour", "day", "week", "month"]).optional()
    .describe("Grouping interval for timeline (default: hour)"),
})
```

---

### 3. `get_stats_cities`
**Maps to:** `GET /api/stats/cities`

City-level alert statistics with pagination and search.

**Input Schema (Zod):**
```typescript
z.object({
  startDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter from"),
  endDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter until"),
  limit: z.number().int().min(1).optional()
    .describe("Number of cities to return (default 5)"),
  offset: z.number().int().min(0).optional()
    .describe("Number of results to skip for pagination"),
  origin: z.string().optional()
    .describe("Filter by origin(s), comma-separated"),
  search: z.string().optional()
    .describe("Search cities by name (partial match)"),
  include: z.string().optional()
    .describe("Comma-separated: translations, coords"),
})
```

---

### 4. `get_stats_history`
**Maps to:** `GET /api/stats/history`

Detailed historical alert records with full city data.

**Input Schema (Zod):**
```typescript
z.object({
  startDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter from"),
  endDate: z.string().datetime().optional()
    .describe("ISO 8601 date to filter until"),
  limit: z.number().int().min(1).max(100).optional()
    .describe("Number of alerts to return (1-100, default 20)"),
  offset: z.number().int().min(0).optional()
    .describe("Number of results to skip for pagination"),
  cityId: z.number().int().optional()
    .describe("Filter by city ID (exact match)"),
  cityName: z.string().optional()
    .describe("Filter by city name in Hebrew (exact match)"),
  search: z.string().optional()
    .describe("Search by city name (partial match)"),
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
})
```

---

### 5. `get_stats_distribution`
**Maps to:** `GET /api/stats/distribution`

Alert distribution by category or origin.

**Input Schema (Zod):**
```typescript
z.object({
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
  limit: z.number().int().min(1).max(100).optional()
    .describe("Number of categories to return (1-100, default 50)"),
  offset: z.number().int().min(0).optional()
    .describe("Number of results to skip"),
  sort: z.enum(["count", "category"]).optional()
    .describe("Sort by count or category (default: count)"),
  order: z.enum(["asc", "desc"]).optional()
    .describe("Sort direction (default: desc)"),
})
```

---

### 6. `search_shelters`
**Maps to:** `GET /api/shelter/search`

Find nearby shelters by location with optional filters.

**Input Schema (Zod):**
```typescript
z.object({
  lat: z.number().min(-90).max(90)
    .describe("Latitude of search center"),
  lon: z.number().min(-180).max(180)
    .describe("Longitude of search center"),
  limit: z.number().int().min(1).optional()
    .describe("Number of shelters to return (default 10)"),
  radius: z.number().positive().optional()
    .describe("Search radius in kilometers"),
  wheelchairOnly: z.boolean().optional()
    .describe("Filter wheelchair accessible shelters only"),
  shelterType: z.string().optional()
    .describe("Filter by shelter type (e.g. 'public', 'private')"),
  city: z.string().optional()
    .describe("Filter by city name"),
})
```

---

### 7. `get_cities`
**Maps to:** `GET /api/data/cities`

City catalog for lookups - raw location records without alert statistics.

**Input Schema (Zod):**
```typescript
z.object({
  search: z.string().min(1).max(100).optional()
    .describe("Search by city name (partial match)"),
  zone: z.string().optional()
    .describe("Filter by zone/region name (exact match)"),
  limit: z.number().int().min(1).max(500).optional()
    .describe("Number of cities to return (1-500, default 100)"),
  offset: z.number().int().min(0).optional()
    .describe("Number of results to skip"),
  include: z.string().optional()
    .describe("Comma-separated: translations, coords, countdown"),
})
```

---

### 8. `health_check`
**Maps to:** `GET /api/health`

Health check for the RedAlert API.

**Input Schema (Zod):**
```typescript
z.object({})
```

---

## Real-time Alerts (Socket.IO)

### MCP Resource: `redalert://alerts/live`

A subscribable MCP resource that provides real-time alert updates via Socket.IO.

**Implementation approach:**
- `socket-manager.ts` manages a singleton Socket.IO connection to `https://redalert.orielhaim.com`
- Authenticates with the API key via `auth: { apiKey }`
- Subscribes to all alert type events (missiles, earthQuake, tsunami, etc.)
- On each alert event, updates an in-memory latest-alerts buffer
- Exposes as an MCP resource with `subscribe` support so clients get notified of updates

### MCP Tool: `subscribe_alerts` (optional convenience tool)

If the MCP client doesn't support resource subscriptions, expose a polling tool:

```typescript
z.object({
  alertTypes: z.string().optional()
    .describe("Comma-separated alert types to filter (e.g. 'missiles,earthQuake'). Default: all"),
})
```

Returns the latest alerts from the in-memory buffer.

---

## API Client Design (`src/api/client.ts`)

```typescript
const API_BASE = "https://redalert.orielhaim.com";

async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, API_BASE);
  // Append only defined params as query string
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return response.json() as Promise<T>;
}
```

---

## Error Handling Strategy

Each tool handler wraps its API call in a try/catch and returns MCP-formatted results:

- **Success:** `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }`
- **API Error (4xx/5xx):** `{ content: [{ type: "text", text: error.message }], isError: true }`
- **Validation Error:** Zod handles input validation automatically before the handler runs
- **Network Error:** `{ content: [{ type: "text", text: "Network error: ..." }], isError: true }`

---

## Server Setup (`src/server.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "redalert",
  version: "1.0.0",
  description: "Israel RedAlert emergency alerts - real-time alerts, statistics, shelter search, and city data",
});

// Register all tools (from tools/index.ts)
registerTools(server);

// Register real-time resource (from realtime/alerts-resource.ts)
registerAlertResource(server);

// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Config (`src/config.ts`)

```typescript
export const CONFIG = {
  API_BASE: "https://redalert.orielhaim.com",
  API_KEY: process.env.REDALERT_API_KEY || "mcpoJDEwCBjfiNjPgSMifQIiErLBeybAEQcBzkZshNpYuqSKeheviXVedazVVxvSobL",
  SOCKET_URL: "https://redalert.orielhaim.com",
} as const;
```

---

## Implementation Notes

1. **Transport:** Use stdio transport for standard MCP client compatibility. The server runs as a subprocess.
2. **Tool naming:** All tools use snake_case (MCP convention).
3. **Zod schemas:** The `@modelcontextprotocol/sdk` `McpServer.tool()` method accepts Zod schemas directly for input validation.
4. **Each tool file** exports a function `register(server: McpServer)` that calls `server.tool(name, description, schema, handler)`.
5. **No authentication needed** for REST endpoints per the API docs. The API key is only needed for Socket.IO.
6. **JSON output:** All tools return data as formatted JSON text content.
