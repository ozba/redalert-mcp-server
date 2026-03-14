# Infrastructure Architecture: Error Handling, Auth, and Transport

## 1. Package Dependencies

```json
{
  "name": "redalert-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "socket.io-client": "^4.8.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Rationale:**
- `@modelcontextprotocol/sdk` - Official MCP SDK for TypeScript, provides `McpServer`, stdio transport, tool/resource registration
- `socket.io-client` - Required by the RedAlert API for real-time alert subscriptions
- `zod` - Already a dependency of the MCP SDK; use for input validation on tool parameters
- No HTTP client library needed - use Node.js built-in `fetch` (available in Node 18+)

## 2. Authentication Flow

### API Key Management

The RedAlert API key is provided to the MCP server via **environment variable**:

```
REDALERT_API_KEY=mcpoJDEwCBjfiNjPgSMifQIiErLBeybAEQcBzkZshNpYuqSKeheviXVedazVVxvSobL
```

**On startup**, the server reads `process.env.REDALERT_API_KEY`. If missing, the server logs an error to stderr and exits with code 1. The key is stored in a module-level constant and shared across all API calls.

### Where the API Key Is Used

1. **Socket.IO connection** - Passed in the `auth` object:
   ```typescript
   io('https://redalert.orielhaim.com', {
     auth: { apiKey: API_KEY }
   });
   ```

2. **REST API calls** - The docs indicate REST endpoints are publicly accessible. Pass the API key as a query parameter `apiKey` on all REST requests for rate-limit tracking purposes. If the API later requires auth headers, this is the single place to change.

### Configuration Constants

```typescript
const CONFIG = {
  BASE_URL: 'https://redalert.orielhaim.com',
  API_KEY: process.env.REDALERT_API_KEY,
  SOCKET_RECONNECT_ATTEMPTS: 10,
  SOCKET_RECONNECT_DELAY_MS: 2000,
  REQUEST_TIMEOUT_MS: 15000,
} as const;
```

No additional config file is needed. All configuration is via environment variables and sensible defaults.

## 3. Transport Layer

### MCP Transport: stdio

The server uses **stdio transport** exclusively. This is the standard for local MCP servers invoked by Claude Desktop, VS Code, and other MCP clients.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'redalert',
  version: '1.0.0',
});

// ... register tools and resources ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Important:** All diagnostic/debug logging goes to **stderr** (not stdout), since stdout is reserved for the MCP JSON-RPC protocol.

### User Configuration (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "redalert": {
      "command": "node",
      "args": ["path/to/redalert-mcp-server/dist/index.js"],
      "env": {
        "REDALERT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 4. Error Handling Strategy

### 4.1 HTTP Request Errors (REST API calls)

All REST API calls go through a single `fetchRedAlert` helper function:

```typescript
async function fetchRedAlert(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(path, CONFIG.BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      `RedAlert API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
```

**Error mapping to MCP errors:**

| Scenario | MCP Error Code | User-facing message |
|----------|---------------|---------------------|
| HTTP 400 | `InvalidParams` | "Invalid request parameters: {details}" |
| HTTP 401/403 | `InternalError` | "Authentication failed - check REDALERT_API_KEY" |
| HTTP 404 | `InvalidParams` | "Endpoint or resource not found" |
| HTTP 429 | `InternalError` | "Rate limited by RedAlert API - try again later" |
| HTTP 5xx | `InternalError` | "RedAlert API server error - try again later" |
| Network error | `InternalError` | "Failed to connect to RedAlert API" |
| Timeout | `InternalError` | "Request to RedAlert API timed out" |

### 4.2 Input Validation Errors

Each MCP tool defines its input schema using Zod. The MCP SDK automatically validates inputs against the schema and returns `InvalidParams` errors. No additional validation layer is needed.

For parameters with specific constraints (e.g., `limit` must be 1-100, `lat` must be valid latitude), encode these in the Zod schema:

```typescript
{
  lat: z.number().min(-90).max(90).describe("Latitude"),
  lon: z.number().min(-180).max(180).describe("Longitude"),
  limit: z.number().int().min(1).max(100).optional().describe("Max results"),
}
```

### 4.3 Socket.IO Connection Errors

The Socket.IO client handles reconnection automatically. Configuration:

```typescript
const socket = io(CONFIG.BASE_URL, {
  auth: { apiKey: CONFIG.API_KEY },
  reconnection: true,
  reconnectionAttempts: CONFIG.SOCKET_RECONNECT_ATTEMPTS,
  reconnectionDelay: CONFIG.SOCKET_RECONNECT_DELAY_MS,
  reconnectionDelayMax: 30000,
  timeout: 20000,
});
```

**Error events to handle:**
- `connect_error` - Log to stderr, rely on auto-reconnect
- `disconnect` - Log to stderr, rely on auto-reconnect
- `reconnect_failed` - After all attempts exhausted, update resource state to indicate disconnection

The Socket.IO connection is **lazy** - it is only established when a client subscribes to alert resources, not on server startup. This avoids unnecessary connections when only REST tools are used.

### 4.4 Rate Limiting Awareness

The RedAlert API shares rate limits across all endpoints and connections. Strategy:

- **No client-side rate limiting** - Let the API enforce limits and handle 429 responses gracefully
- **On 429 response**: Return a clear MCP error message telling the user to wait before retrying
- **No automatic retry on 429** - The MCP client (Claude) can decide whether to retry

### 4.5 Graceful Shutdown

```typescript
process.on('SIGINT', async () => {
  socket?.disconnect();
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  socket?.disconnect();
  await server.close();
  process.exit(0);
});
```

## 5. Project Structure

```
redalert-mcp-server/
  src/
    index.ts          # Entry point: create server, register tools/resources, start stdio transport
    config.ts         # CONFIG constant, API key validation
    api.ts            # fetchRedAlert helper, error mapping
    tools/            # One file per tool group
      active.ts       # get_active_alerts tool
      stats.ts        # get_summary_stats, get_city_stats, get_history, get_distribution tools
      shelter.ts      # search_shelters tool
      cities.ts       # get_cities tool
      health.ts       # check_health tool
    resources/
      alerts.ts       # Socket.IO connection management, alert subscription resource
  dist/               # Compiled output
  package.json
  tsconfig.json
```

## 6. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

## 7. Logging Strategy

All logs go to **stderr** using `console.error()`:

- **Startup**: Log server name, version, and whether API key is configured
- **REST errors**: Log the URL, status code, and error body
- **Socket.IO events**: Log connect, disconnect, reconnect attempts, and errors
- **No verbose logging by default** - Keep stderr clean for production use

## 8. Summary of Key Design Decisions

1. **Environment variable for API key** - Standard practice for secrets, works naturally with MCP client config
2. **stdio transport only** - Simplest, most compatible option for MCP servers
3. **Single `fetchRedAlert` helper** - Centralizes error handling, timeout, and URL construction
4. **Lazy Socket.IO connection** - Only connect when real-time alerts are needed
5. **Zod for input validation** - Already a dependency, integrates with MCP SDK natively
6. **No retry logic** - Keep it simple; let the MCP client (Claude) decide on retries
7. **Node.js built-in fetch** - No extra HTTP dependency needed
8. **15-second request timeout** - Generous enough for API calls, prevents hanging
