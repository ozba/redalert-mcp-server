# Real-Time Alerts Architecture

## Overview

This document defines how the RedAlert MCP server bridges Socket.IO real-time alerts with the MCP protocol's request/response model. The core challenge is that MCP clients communicate via request/response, while alerts arrive asynchronously via Socket.IO push events. Our solution uses a **buffered polling model**: the MCP server maintains a persistent Socket.IO connection internally, buffers incoming alerts, and exposes tools that let clients subscribe, poll for alerts, and unsubscribe.

---

## 1. Design Approach: Buffered Polling

### Why Not Direct Push?

MCP (Model Context Protocol) is fundamentally request/response over stdio. There is no mechanism for the server to push unsolicited messages to the client. Therefore, real-time alerts must be:

1. **Received** by an internal Socket.IO client running inside the MCP server process
2. **Buffered** in an in-memory ring buffer
3. **Polled** by the MCP client using a dedicated tool

### Architecture Diagram

```
MCP Client (Claude, etc.)
    |  (stdio: request/response)
    v
MCP Server Process
    |-- REST API Tools (direct HTTP fetch)
    |-- Real-Time Module:
    |     |-- Socket.IO Client (persistent connection)
    |     |-- Alert Buffer (in-memory ring buffer)
    |     |-- Subscription State (alert type filters)
    |
    v
RedAlert Socket.IO Server (redalert.orielhaim.com)
```

---

## 2. MCP Tools for Real-Time Alerts

### 2.1 `subscribe_alerts` - Start Listening

**Purpose:** Connect to the RedAlert Socket.IO server and begin receiving alerts.

**Input Schema:**
```typescript
{
  alertTypes?: string[]  // Optional filter: ["missiles", "earthQuake", etc.]
                         // If omitted, subscribe to ALL alert types
  testMode?: boolean     // If true, connect to test server instead
  timing?: string        // Interval between alerts, e.g. "5s", "1m" (min 1s)
}
```

**Behavior:**
- If already connected, update the subscription filters (disconnect and reconnect with new params)
- Establishes Socket.IO connection to `https://redalert.orielhaim.com` (or `/test` endpoint if testMode)
- Passes `apiKey` from server config in the `auth` object
- Passes `alerts` (comma-joined alertTypes) and `timing` in the `query` object
- Registers event listeners for each alert type
- Clears any existing alert buffer
- Returns confirmation with connection status

**Output:**
```json
{
  "status": "connected",
  "subscribedTypes": ["missiles", "earthQuake"],
  "testMode": false,
  "message": "Subscribed to real-time alerts. Use poll_alerts to retrieve incoming alerts."
}
```

### 2.2 `poll_alerts` - Retrieve Buffered Alerts

**Purpose:** Retrieve any alerts that have arrived since the last poll (or since subscription started).

**Input Schema:**
```typescript
{
  limit?: number        // Max alerts to return (default: 50, max: 200)
  acknowledge?: boolean // If true (default), clear returned alerts from buffer
                        // If false, peek without consuming
}
```

**Behavior:**
- Returns alerts from the ring buffer, oldest first
- By default, removes returned alerts from the buffer (acknowledge=true)
- If not subscribed, returns an error suggesting to call `subscribe_alerts` first

**Output:**
```json
{
  "connected": true,
  "alertCount": 2,
  "bufferSize": 0,
  "alerts": [
    {
      "receivedAt": "2024-01-15T10:30:00.000Z",
      "type": "missiles",
      "title": "Rocket/Missile Alert",
      "cities": ["City1", "City2"],
      "instructions": "Enter shelter immediately"
    },
    {
      "receivedAt": "2024-01-15T10:30:05.000Z",
      "type": "earthQuake",
      "title": "Earthquake",
      "cities": ["City3"],
      "instructions": "Move to open area"
    }
  ]
}
```

### 2.3 `unsubscribe_alerts` - Disconnect

**Purpose:** Disconnect from the Socket.IO server and stop receiving alerts.

**Input Schema:**
```typescript
{}  // No parameters
```

**Behavior:**
- Disconnects the Socket.IO client
- Clears the alert buffer
- Resets subscription state

**Output:**
```json
{
  "status": "disconnected",
  "message": "Unsubscribed from real-time alerts. Buffer cleared."
}
```

### 2.4 `get_alert_subscription_status` - Check State

**Purpose:** Check the current subscription status without modifying anything.

**Input Schema:**
```typescript
{}  // No parameters
```

**Output:**
```json
{
  "connected": true,
  "subscribedTypes": ["missiles", "earthQuake"],
  "testMode": false,
  "bufferedAlerts": 3,
  "connectedSince": "2024-01-15T10:25:00.000Z",
  "totalAlertsReceived": 15
}
```

---

## 3. Socket.IO Connection Lifecycle

### 3.1 Connection Manager Module

File: `src/realtime/connection-manager.ts`

```typescript
interface ConnectionState {
  socket: SocketIOClient | null;
  connected: boolean;
  subscribedTypes: string[];
  testMode: boolean;
  connectedSince: Date | null;
  totalAlertsReceived: number;
}
```

The connection manager is a **singleton** within the MCP server process. Only one Socket.IO connection is active at a time.

### 3.2 Connection Flow

```
subscribe_alerts called
  -> If already connected: disconnect existing socket
  -> Create new socket.io-client instance
  -> Connect with auth: { apiKey }
  -> Set query params: { alerts, timing }
  -> Register event handlers for alert types
  -> On 'connect': update state, resolve
  -> On 'connect_error': reject with error details
  -> On 'disconnect': update state, attempt reconnect
```

### 3.3 Reconnection Strategy

Use socket.io-client's built-in reconnection with these settings:

```typescript
{
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,      // Start at 1s
  reconnectionDelayMax: 30000,  // Cap at 30s
  timeout: 10000                // Connection timeout 10s
}
```

The connection manager tracks disconnection events. If the socket disconnects unexpectedly, socket.io-client handles reconnection automatically. The `connected` flag in state reflects the actual connection status.

### 3.4 Cleanup on Server Shutdown

When the MCP server process exits (stdin closes / SIGTERM), the Socket.IO connection must be cleanly disconnected. Register a cleanup handler:

```typescript
process.on('SIGTERM', () => connectionManager.disconnect());
process.on('SIGINT', () => connectionManager.disconnect());
// Also on MCP server close event
```

---

## 4. Alert Buffer

### 4.1 Ring Buffer Design

File: `src/realtime/alert-buffer.ts`

```typescript
interface BufferedAlert {
  receivedAt: string;  // ISO timestamp when MCP server received it
  type: string;
  title: string;
  cities: string[];
  instructions: string;
}
```

- **Max capacity:** 500 alerts (configurable)
- **Overflow policy:** Drop oldest alerts when buffer is full (ring buffer)
- **Thread safety:** Not needed (Node.js single-threaded event loop)
- **Implementation:** Simple array with push/splice, or a lightweight circular buffer

### 4.2 Buffer Operations

```typescript
class AlertBuffer {
  private buffer: BufferedAlert[] = [];
  private maxSize: number = 500;

  push(alert: BufferedAlert): void;        // Add alert, evict oldest if full
  poll(limit: number): BufferedAlert[];    // Remove and return oldest N alerts
  peek(limit: number): BufferedAlert[];    // Return oldest N without removing
  clear(): void;                            // Empty the buffer
  size(): number;                           // Current count
}
```

---

## 5. Alert Type Event Registration

When the Socket.IO connection is established, register listeners for all subscribed alert types. Each alert type is a separate Socket.IO event name.

```typescript
const ALL_ALERT_TYPES = [
  'missiles', 'earthQuake', 'tsunami', 'hostileAircraftIntrusion',
  'hazardousMaterials', 'terroristInfiltration', 'newsFlash',
  'unconventionalWarfare', 'radiologicalEvent', 'generalAlert',
  // Drills
  'missilesDrill', 'radiologicalEventDrill', 'earthQuakeDrill',
  'tsunamiDrill', 'hostileAircraftIntrusionDrill',
  'hazardousMaterialsDrill', 'terroristInfiltrationDrill'
];

// Register listeners for subscribed types (or all if none specified)
const typesToListen = subscribedTypes.length > 0 ? subscribedTypes : ALL_ALERT_TYPES;

for (const alertType of typesToListen) {
  socket.on(alertType, (data: AlertPayload) => {
    alertBuffer.push({
      receivedAt: new Date().toISOString(),
      type: data.type,
      title: data.title,
      cities: data.cities,
      instructions: data.instructions
    });
    connectionState.totalAlertsReceived++;
  });
}
```

**Note:** The `alerts` query parameter is also passed to the server during connection, so the server itself may filter. The client-side listeners are a secondary filter for defense-in-depth.

---

## 6. Test Server Integration

The RedAlert API provides a test endpoint at `https://redalert.orielhaim.com/test` that sends simulated alerts.

- When `testMode: true` is passed to `subscribe_alerts`, connect to the test URL
- The test server uses the same Socket.IO protocol and alert format
- This is useful for development, demos, and verifying the integration works

**Connection URL logic:**
```typescript
const baseUrl = 'https://redalert.orielhaim.com';
const url = testMode ? `${baseUrl}/test` : baseUrl;
```

---

## 7. File Structure

```
src/
  realtime/
    connection-manager.ts   // Socket.IO connection lifecycle (singleton)
    alert-buffer.ts         // Ring buffer for incoming alerts
    types.ts                // Alert types, interfaces, constants
    tools.ts                // MCP tool handler registrations for the 4 tools
```

The `tools.ts` file exports a function that registers the 4 real-time tools on the MCP server instance. This is called from the main server setup alongside the REST API tools.

---

## 8. Dependencies

- `socket.io-client` (v4.x) - Socket.IO client for Node.js
- Already using `@modelcontextprotocol/sdk` and `zod` from the REST API side

---

## 9. Edge Cases and Error Handling

| Scenario | Handling |
|----------|----------|
| `poll_alerts` called before `subscribe_alerts` | Return error: "Not subscribed. Call subscribe_alerts first." |
| Socket.IO connection fails | Return error with details from connect_error event |
| Socket disconnects mid-session | Auto-reconnect via socket.io-client; `connected` flag reflects real state |
| Buffer overflow (>500 alerts) | Drop oldest silently; buffer always has most recent alerts |
| `subscribe_alerts` called while already connected | Disconnect old, connect new (full reset) |
| Invalid alert type passed | Validate against known types list; return error for unknown types |
| Rate limiting from server | Surface the error from Socket.IO; suggest increasing `timing` parameter |
| API key not configured | Fail with clear error message at subscribe time |

---

## 10. Usage Flow Example

A typical interaction from an MCP client:

```
1. Client calls: subscribe_alerts({ alertTypes: ["missiles"], testMode: true })
   -> Server connects to test Socket.IO, returns "connected"

2. (Time passes, test alerts arrive and are buffered)

3. Client calls: poll_alerts({})
   -> Returns 3 buffered missile alerts, clears buffer

4. Client calls: poll_alerts({})
   -> Returns 0 alerts (none since last poll)

5. Client calls: get_alert_subscription_status({})
   -> Returns connected=true, bufferedAlerts=0, totalAlertsReceived=3

6. Client calls: unsubscribe_alerts({})
   -> Disconnects, clears buffer
```

This pattern allows any MCP client to work with real-time alerts using only standard request/response tool calls, without requiring any push notification support.
