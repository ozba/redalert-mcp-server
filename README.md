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
- "Compare missile alerts between Kfar Saba and Shoham in the last 2 months"

### Example: City Comparison

> **Prompt:** "Compare the missile alerts in the last 2 months between Kfar Saba and Shoham"

```
┌──────────────────────────┬───────────────┬───────────────┐
│                          │   Kfar Saba   │    Shoham     │
├──────────────────────────┼───────────────┼───────────────┤
│ Zone                     │ Sharon        │ Yarkon        │
├──────────────────────────┼───────────────┼───────────────┤
│ Missile alerts           │ 64            │ 77            │
├──────────────────────────┼───────────────┼───────────────┤
│ Total alerts (all types) │ 205           │ 217           │
├──────────────────────────┼───────────────┼───────────────┤
│ Last missile alert       │ Mar 14, 12:43 │ Mar 13, 21:22 │
└──────────────────────────┴───────────────┴───────────────┘

Shoham had ~20% more missile alerts than Kfar Saba over this period (77 vs 64).
Both cities had a similar ratio of missile alerts to total alerts (~31-35%).
```

Claude automatically uses `get_stats_cities` and `get_stats_history` to gather and compare data across cities.

### Example: Weekly Alert Summary (Hebrew)

> **Prompt:** "תראה לי את כל ההתראות שהיו לכפר סבא בשבוע האחרון"

```
הנה כל ההתראות בכפר סבא בשבוע האחרון (7-14 במרץ):

| תאריך ושעה (UTC) | סוג התראה            |
|-------------------|----------------------|
| 14/3, 13:04       | טילים               |
| 14/3, 12:43       | טילים               |
| 14/3, 12:39       | ידיעה מקדימה         |
| 14/3, 00:30       | ידיעה מקדימה         |
| 13/3, 21:22       | טילים               |
| 13/3, 17:31       | טילים               |
| 13/3, 17:26       | ידיעה מקדימה         |
| 13/3, 14:58       | ידיעה מקדימה         |
| 13/3, 11:26       | ידיעה מקדימה         |
| 13/3, 08:49       | חדירת כלי טיס עוין   |
| 12/3, 19:42       | טילים               |
| 12/3, 19:38       | ידיעה מקדימה         |
| 12/3, 15:19       | חדירת כלי טיס עוין   |
| 12/3, 13:03       | טילים               |
| 12/3, 12:57       | ידיעה מקדימה         |
| 12/3, 07:22       | ידיעה מקדימה         |
| 12/3, 02:13       | טילים               |
| 12/3, 02:07       | ידיעה מקדימה         |

סיכום השבוע בכפר סבא:
- 8 התראות טילים
- 8 ידיעות מקדימות
- 2 חדירות כלי טיס עוין
```

Claude uses `get_stats_history` with Hebrew city search, automatically filtering results to show only Kfar Saba. Works in any language.

### Example: Nearest Shelters

> **Prompt:** "תראה לי את שלושת המקלטים הכי קרובים לתיאטרון הבימה בתל אביב"

```
שלושת המקלטים הקרובים ביותר לתיאטרון הבימה:

| # | מרחק   | כתובת                     | שם                   | סוג                  | שטח       |
|---|--------|---------------------------|----------------------|----------------------|-----------|
| 1 | 143 מ' | הוברמן 4 (כיכר הבימה)      | הבימה/שד' בן ציון     | מקלט בשטח חניון       | 2,000 מ"ר |
| 2 | 154 מ' | הוברמן 1                  | היכל התרבות           | חניון מחסה לציבור     | 37,200 מ"ר|
| 3 | 260 מ' | ביל"ו 54                  | -                    | מקלט ציבורי          | 92 מ"ר    |

- מקלט 1 - ממש בכיכר הבימה, גישה ציבורית
- מקלט 2 - היכל התרבות, החניון הגדול משמש כמחסה לציבור
- מקלט 3 - ביל"ו 54 פינת מרמורק 20, מתחת לבית כנסת
```

Claude resolves the landmark to coordinates and uses `search_shelters` to find the nearest shelters with full details.

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
