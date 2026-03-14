import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CONFIG } from "../config.js";

describe("CONFIG", () => {
  const originalEnv = process.env.REDALERT_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REDALERT_API_KEY = originalEnv;
    } else {
      delete process.env.REDALERT_API_KEY;
    }
  });

  it("should have a BASE_URL", () => {
    expect(CONFIG.BASE_URL).toBe("https://redalert.orielhaim.com");
  });

  it("should have a SOCKET_URL", () => {
    expect(CONFIG.SOCKET_URL).toBe("https://redalert.orielhaim.com");
  });

  it("should read API_KEY from environment variable", () => {
    process.env.REDALERT_API_KEY = "test-key-123";
    expect(CONFIG.API_KEY).toBe("test-key-123");
  });

  it("should return empty string when REDALERT_API_KEY is not set", () => {
    delete process.env.REDALERT_API_KEY;
    expect(CONFIG.API_KEY).toBe("");
  });

  it("should have reasonable timeout", () => {
    expect(CONFIG.REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("should have reconnect settings", () => {
    expect(CONFIG.SOCKET_RECONNECT_ATTEMPTS).toBeGreaterThan(0);
    expect(CONFIG.SOCKET_RECONNECT_DELAY_MS).toBeGreaterThan(0);
  });
});
