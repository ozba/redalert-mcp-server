import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock socket.io-client
vi.mock("socket.io-client", () => {
  const createMockSocket = () => {
    const handlers: Record<string, Function[]> = {};
    const onceHandlers: Record<string, Function[]> = {};

    return {
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      once: vi.fn((event: string, handler: Function) => {
        if (!onceHandlers[event]) onceHandlers[event] = [];
        onceHandlers[event].push(handler);
      }),
      off: vi.fn((event: string, handler: Function) => {
        if (handlers[event]) {
          handlers[event] = handlers[event].filter((h) => h !== handler);
        }
        if (onceHandlers[event]) {
          onceHandlers[event] = onceHandlers[event].filter(
            (h) => h !== handler
          );
        }
      }),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      _handlers: handlers,
      _onceHandlers: onceHandlers,
      _emit: (event: string, ...args: unknown[]) => {
        handlers[event]?.forEach((h) => h(...args));
        const once = onceHandlers[event];
        if (once) {
          onceHandlers[event] = [];
          once.forEach((h) => h(...args));
        }
      },
    };
  };

  let latestSocket: ReturnType<typeof createMockSocket>;

  return {
    io: vi.fn((..._args: unknown[]) => {
      latestSocket = createMockSocket();
      queueMicrotask(() => {
        latestSocket._emit("connect");
      });
      return latestSocket;
    }),
    _getLatestSocket: () => latestSocket,
  };
});

// Mock fetch for REST tools
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
);

import { createServer } from "../server.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {}
) {
  const handler = (server as any)._registeredTools?.[toolName];
  if (!handler) {
    throw new Error(`Tool ${toolName} not found`);
  }
  return handler.handler(args);
}

describe("Real-time alert tools", () => {
  let server: McpServer;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the connectionManager singleton module
    const mod = await import("../realtime/connection-manager.js");
    // Disconnect any existing connection
    (mod.connectionManager as any).disconnect();
    server = createServer();
  });

  describe("subscribe_alerts", () => {
    it("should connect and return success", async () => {
      const result = await callTool(server, "subscribe_alerts", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("connected");
      expect(parsed.subscribedTypes.length).toBeGreaterThan(0);
    });

    it("should support test mode", async () => {
      const result = await callTool(server, "subscribe_alerts", {
        testMode: true,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.testMode).toBe(true);
    });

    it("should support filtering alert types", async () => {
      const result = await callTool(server, "subscribe_alerts", {
        alertTypes: ["missiles", "earthQuake"],
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.subscribedTypes).toEqual(["missiles", "earthQuake"]);
    });

    it("should return error for invalid alert types", async () => {
      const result = await callTool(server, "subscribe_alerts", {
        alertTypes: ["fakeAlertType"],
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid alert types");
    });
  });

  describe("poll_alerts", () => {
    it("should return error when not subscribed", async () => {
      const result = await callTool(server, "poll_alerts", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Not subscribed");
    });

    it("should return empty alerts after subscribing", async () => {
      await callTool(server, "subscribe_alerts", {});
      const result = await callTool(server, "poll_alerts", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.alertCount).toBe(0);
      expect(parsed.alerts).toEqual([]);
      expect(parsed.connected).toBe(true);
    });
  });

  describe("unsubscribe_alerts", () => {
    it("should disconnect and return status", async () => {
      await callTool(server, "subscribe_alerts", {});
      const result = await callTool(server, "unsubscribe_alerts", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("disconnected");
    });

    it("should succeed even when not connected", async () => {
      const result = await callTool(server, "unsubscribe_alerts", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("disconnected");
    });
  });

  describe("get_alert_subscription_status", () => {
    it("should return disconnected state when not subscribed", async () => {
      const result = await callTool(
        server,
        "get_alert_subscription_status",
        {}
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.connected).toBe(false);
      expect(parsed.subscribedTypes).toEqual([]);
    });

    it("should return connected state after subscribing", async () => {
      await callTool(server, "subscribe_alerts", {});
      const result = await callTool(
        server,
        "get_alert_subscription_status",
        {}
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.connected).toBe(true);
      expect(parsed.subscribedTypes.length).toBeGreaterThan(0);
    });
  });
});
