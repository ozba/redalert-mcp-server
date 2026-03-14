import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionManager } from "../realtime/connection-manager.js";

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
      // Expose for test manipulation
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
    io: vi.fn(() => {
      latestSocket = createMockSocket();
      // Auto-connect after a microtask
      queueMicrotask(() => {
        latestSocket._emit("connect");
      });
      return latestSocket;
    }),
    _getLatestSocket: () => latestSocket,
  };
});

describe("ConnectionManager", () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
    vi.clearAllMocks();
  });

  describe("getStatus", () => {
    it("should return disconnected state initially", () => {
      const status = manager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.subscribedTypes).toEqual([]);
      expect(status.testMode).toBe(false);
      expect(status.bufferedAlerts).toBe(0);
      expect(status.connectedSince).toBeNull();
      expect(status.totalAlertsReceived).toBe(0);
    });
  });

  describe("subscribe", () => {
    it("should connect and return status", async () => {
      const result = await manager.subscribe({});
      expect(result.status).toBe("connected");
      expect(result.subscribedTypes.length).toBeGreaterThan(0);
      expect(result.testMode).toBe(false);
      expect(result.message).toContain("Subscribed");
    });

    it("should filter by specified alert types", async () => {
      const result = await manager.subscribe({
        alertTypes: ["missiles", "earthQuake"],
      });
      expect(result.subscribedTypes).toEqual(["missiles", "earthQuake"]);
    });

    it("should reject invalid alert types", async () => {
      await expect(
        manager.subscribe({ alertTypes: ["invalidType"] })
      ).rejects.toThrow("Invalid alert types");
    });

    it("should accept testMode flag", async () => {
      const result = await manager.subscribe({ testMode: true });
      expect(result.testMode).toBe(true);
    });

    it("should disconnect existing connection before reconnecting", async () => {
      await manager.subscribe({});
      const statusBefore = manager.getStatus();
      expect(statusBefore.connected).toBe(true);

      // Re-subscribe
      await manager.subscribe({ alertTypes: ["missiles"] });
      const result = manager.getStatus();
      expect(result.subscribedTypes).toEqual(["missiles"]);
    });

    it("should fail if socket connection fails", async () => {
      const { io } = await import("socket.io-client");
      // Override io to emit connect_error instead
      vi.mocked(io).mockImplementationOnce((..._args: unknown[]) => {
        const handlers: Record<string, Function[]> = {};
        const onceHandlers: Record<string, Function[]> = {};
        const socket = {
          on: vi.fn((event: string, handler: Function) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
          }),
          once: vi.fn((event: string, handler: Function) => {
            if (!onceHandlers[event]) onceHandlers[event] = [];
            onceHandlers[event].push(handler);
          }),
          off: vi.fn(),
          disconnect: vi.fn(),
          removeAllListeners: vi.fn(),
        };
        queueMicrotask(() => {
          onceHandlers["connect_error"]?.forEach((h) =>
            h(new Error("auth failed"))
          );
        });
        return socket as any;
      });

      await expect(manager.subscribe({})).rejects.toThrow(
        "Failed to connect"
      );
    });
  });

  describe("pollAlerts", () => {
    it("should throw if not subscribed", () => {
      expect(() => manager.pollAlerts()).toThrow("Not subscribed");
    });

    it("should return empty alerts after subscribing", async () => {
      await manager.subscribe({});
      const result = manager.pollAlerts();
      expect(result.alertCount).toBe(0);
      expect(result.alerts).toEqual([]);
      expect(result.connected).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should return disconnected status", () => {
      const result = manager.disconnect();
      expect(result.status).toBe("disconnected");
      expect(result.message).toContain("Unsubscribed");
    });

    it("should reset state after disconnect", async () => {
      await manager.subscribe({});
      manager.disconnect();
      const status = manager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.subscribedTypes).toEqual([]);
      expect(status.bufferedAlerts).toBe(0);
    });
  });
});
