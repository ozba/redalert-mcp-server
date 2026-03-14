import { describe, it, expect, vi } from "vitest";

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

// Mock fetch
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
);

import { createServer } from "../server.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("createServer", () => {
  it("should return an McpServer instance", () => {
    const server = createServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it("should register all expected tools", () => {
    const server = createServer();
    const tools = (server as any)._registeredTools;

    const expectedTools = [
      "get_active_alerts",
      "get_stats_summary",
      "get_stats_cities",
      "get_stats_history",
      "get_stats_distribution",
      "search_shelters",
      "get_cities",
      "health_check",
      "subscribe_alerts",
      "poll_alerts",
      "unsubscribe_alerts",
      "get_alert_subscription_status",
    ];

    for (const toolName of expectedTools) {
      expect(tools).toHaveProperty(
        toolName,
        expect.objectContaining({
          handler: expect.any(Function),
        })
      );
    }
  });

  it("should have descriptions for all tools", () => {
    const server = createServer();
    const tools = (server as any)._registeredTools;

    for (const [name, tool] of Object.entries(tools)) {
      expect(
        (tool as any).description,
        `Tool ${name} should have a description`
      ).toBeTruthy();
    }
  });
});
