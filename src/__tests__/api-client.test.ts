import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RedAlertApiError } from "../errors.js";

// We test apiGet by mocking global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking fetch
const { apiGet } = await import("../api/client.js");

describe("apiGet", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should make a GET request to the correct URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    await apiGet("/api/health");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/health");
  });

  it("should append query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiGet("/api/stats/summary", {
      startDate: "2024-01-01",
      limit: 10,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("startDate=2024-01-01");
    expect(url).toContain("limit=10");
  });

  it("should skip undefined parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiGet("/api/data/cities", {
      search: "tel",
      zone: undefined,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("search=tel");
    expect(url).not.toContain("zone");
  });

  it("should return parsed JSON on success", async () => {
    const data = { missiles: ["CityA", "CityB"] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await apiGet("/api/active");
    expect(result).toEqual(data);
  });

  it("should throw RedAlertApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("rate limit exceeded"),
    });

    try {
      await apiGet("/api/active");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RedAlertApiError);
      expect((err as RedAlertApiError).status).toBe(429);
      expect((err as RedAlertApiError).statusText).toBe("Too Many Requests");
    }
  });

  it("should throw RedAlertApiError with body text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("server crash"),
    });

    try {
      await apiGet("/api/health");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RedAlertApiError);
      expect((err as RedAlertApiError).body).toBe("server crash");
    }
  });

  it("should handle text() failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: () => Promise.reject(new Error("stream error")),
    });

    try {
      await apiGet("/api/health");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RedAlertApiError);
      expect((err as RedAlertApiError).body).toBe("");
    }
  });

  it("should include AbortSignal for timeout", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiGet("/api/health");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.signal).toBeDefined();
  });
});
