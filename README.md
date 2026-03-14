# RedAlert MCP Server

An MCP (Model Context Protocol) server for Israel's RedAlert emergency alert system. Provides real-time rocket alerts, historical statistics, shelter search, and city data through 12 MCP tools.

## Features

- **Real-time alerts** via Socket.IO with buffered polling model
- **Historical statistics** - summaries, per-city stats, alert history, distribution
- **Shelter search** - find nearby shelters by coordinates or city name
- **City catalog** - lookup cities with translations, coordinates, and countdown times
- **Test mode** - connect to the test server for simulated alerts

## Tools

### REST API Tools (8)

| Tool | Description |
|------|-------------|
| `get_active_alerts` | Real-time snapshot of cities currently under alert |
| `get_stats_summary` | Alert totals, top cities/zones/origins, timeline, peak hour |
| `get_stats_cities` | Per-city alert statistics with pagination and search |
| `get_stats_history` | Historical alert records with city filtering |
| `get_stats_distribution` | Alert distribution by category or origin |
| `search_shelters` | Find nearby shelters by coordinates or city name |
| `get_cities` | City catalog with translations, coordinates, countdown |
| `health_check` | API health check |

### Real-time Tools (4)

| Tool | Description |
|------|-------------|
| `subscribe_alerts` | Connect to Socket.IO and start receiving alerts |
| `poll_alerts` | Retrieve buffered alerts (peek or acknowledge) |
| `unsubscribe_alerts` | Disconnect and clear buffer |
| `get_alert_subscription_status` | Check connection state and buffer size |

## Setup

### Prerequisites

- Node.js 18+
- A RedAlert API key (get one at [redalert.orielhaim.com](https://redalert.orielhaim.com))

### Install & Build

```bash
npm install
npm run build
```

### Configure in Claude Code

Add to `~/.claude.json` under your project's `mcpServers`:

```json
{
  "redalert": {
    "type": "stdio",
    "command": "node",
    "args": ["<path-to>/dist/index.js"],
    "env": {
      "REDALERT_API_KEY": "your-api-key-here"
    }
  }
}
```

### Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "redalert": {
      "command": "node",
      "args": ["<path-to>/dist/index.js"],
      "env": {
        "REDALERT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask Claude:

- "Show me active alerts right now"
- "Find all missile alerts in Kfar Saba in the last 24 hours"
- "Search for shelters near Tel Aviv"
- "Get alert statistics summary with top cities"
- "Subscribe to test alerts and poll for updates"

## Testing

```bash
# Unit tests (91 tests)
npm test

# E2E tests against live API (56 tests)
REDALERT_API_KEY=your-key node e2e/run-e2e.mjs
```

## Architecture

```
src/
  api/          # HTTP client and API endpoint wrappers
  tools/        # MCP tool handlers (one per endpoint)
  realtime/     # Socket.IO connection manager and alert buffer
  __tests__/    # Unit tests (vitest)
  config.ts     # Configuration and API key
  errors.ts     # Error handling and MCP error mapping
  server.ts     # MCP server setup
  index.ts      # Entry point with stdio transport
e2e/            # End-to-end test runner and test plans
```

## API Reference

Based on [RedAlert API](https://redalert.orielhaim.com/docs/api-reference) by Oriel Haim.

## License

MIT
