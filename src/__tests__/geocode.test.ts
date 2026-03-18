import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally before importing modules
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Need fresh module for each test to reset cache and lastRequestTime
let reverseGeocode: typeof import("../api/geocode.js").reverseGeocode;
let enrichShelterAddresses: typeof import("../api/geocode.js").enrichShelterAddresses;

beforeEach(async () => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  // Reset module to clear cache between tests
  vi.resetModules();
  const mod = await import("../api/geocode.js");
  reverseGeocode = mod.reverseGeocode;
  enrichShelterAddresses = mod.enrichShelterAddresses;
});

afterEach(() => {
  vi.useRealTimers();
});

function makeNominatimResponse(address: Record<string, string>) {
  return {
    ok: true,
    json: () => Promise.resolve({ address }),
  };
}

// Helper to run enrichShelterAddresses and advance timers until it resolves
async function enrichWithTimers(data: unknown): Promise<unknown> {
  const p = enrichShelterAddresses(data);
  // Advance enough time for up to 5 rate-limited requests (1100ms each)
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(1200);
  }
  return p;
}

describe("reverseGeocode", () => {
  it("should return formatted address from Nominatim", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({
        road: "רחוב הרצל",
        house_number: "5",
        city: "תל אביב",
      })
    );

    const result = await reverseGeocode(32.0853, 34.7818);
    expect(result.address).toBe("רחוב הרצל 5");
    expect(result.city).toBe("תל אביב");
  });

  it("should use town when city is not available", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({
        road: "דרך הים",
        town: "נהריה",
      })
    );

    const result = await reverseGeocode(33.005, 35.095);
    expect(result.address).toBe("דרך הים");
    expect(result.city).toBe("נהריה");
  });

  it("should use village when city and town are not available", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({
        road: "רחוב ראשי",
        village: "כפר קרע",
      })
    );

    const result = await reverseGeocode(32.5, 35.1);
    expect(result.address).toBe("רחוב ראשי");
    expect(result.city).toBe("כפר קרע");
  });

  it("should fallback to suburb when no road", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({
        suburb: "נווה שאנן",
        city: "חיפה",
      })
    );

    const result = await reverseGeocode(32.8, 34.98);
    expect(result.address).toBe("נווה שאנן");
    expect(result.city).toBe("חיפה");
  });

  it("should fallback to neighbourhood when no road or suburb", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({ neighbourhood: "שכונה ד", city: "באר שבע" })
    );

    const result = await reverseGeocode(31.25, 34.79);
    expect(result.address).toBe("שכונה ד");
  });

  it("should format address with street only (no house number)", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({ road: "רחוב דיזנגוף", city: "תל אביב" })
    );

    const result = await reverseGeocode(32.081, 34.771);
    expect(result.address).toBe("רחוב דיזנגוף");
  });

  it("should return empty on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await reverseGeocode(32.0, 34.0);
    expect(result.address).toBe("");
    expect(result.city).toBe("");
  });

  it("should return empty on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const result = await reverseGeocode(32.0, 34.0);
    expect(result.address).toBe("");
    expect(result.city).toBe("");
  });

  it("should return empty when no address in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await reverseGeocode(32.0, 34.0);
    expect(result.address).toBe("");
    expect(result.city).toBe("");
  });

  it("should cache results for same coordinates", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({ road: "כביש 1", city: "ירושלים" })
    );

    const result1 = await reverseGeocode(31.7683, 35.2137);
    await vi.advanceTimersByTimeAsync(2000);
    const result2 = await reverseGeocode(31.7683, 35.2137);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(result2);
  });

  it("should cache error results", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    // First call - will fail and cache the empty result
    const p1 = reverseGeocode(32.002, 34.002);
    await vi.runAllTimersAsync();
    const result1 = await p1;
    expect(result1.address).toBe("");
    expect(result1.city).toBe("");
  });

  it("should pass accept-language=he to Nominatim", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({ road: "test", city: "test" })
    );

    await reverseGeocode(32.0, 34.0);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("accept-language=he");
  });

  it("should send correct User-Agent header", async () => {
    mockFetch.mockResolvedValueOnce(
      makeNominatimResponse({ road: "test", city: "test" })
    );

    await reverseGeocode(32.001, 34.001);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["User-Agent"]).toContain("redalert-mcp-server");
  });

  it("should enforce rate limiting between sequential requests", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "רחוב", city: "עיר" })
    );

    // First request
    const p1 = reverseGeocode(32.0, 34.0);
    await vi.advanceTimersByTimeAsync(0);
    await p1;

    // Second request with different coords should be delayed
    const p2 = reverseGeocode(33.0, 35.0);

    // After 500ms, second request should not have fired yet (rate limit is 1100ms)
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After full rate limit period, second request completes
    await vi.advanceTimersByTimeAsync(700);
    await p2;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("enrichShelterAddresses", () => {
  it("should geocode shelters with 'Unknown address'", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({
        road: "רחוב בן גוריון",
        house_number: "10",
        city: "רמת גן",
      })
    );

    const data = {
      data: [
        { id: 1, address: "Unknown address", lat: 32.08, lon: 34.81 },
        { id: 2, address: "Known St", city: "Haifa", lat: 32.8, lon: 34.98 },
      ],
    };

    const result = (await enrichWithTimers(data)) as typeof data;
    expect(result.data[0].address).toBe("רחוב בן גוריון 10");
    expect(result.data[0]).toHaveProperty("geocoded", true);
    // Second shelter already had an address, should not be modified
    expect(result.data[1].address).toBe("Known St");
  });

  it("should geocode shelters with empty address", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "שדרות רוטשילד", city: "תל אביב" })
    );

    const data = {
      data: [{ id: 1, address: "", lat: 32.063, lon: 34.773 }],
    };

    const result = (await enrichWithTimers(data)) as typeof data;
    expect(result.data[0].address).toBe("שדרות רוטשילד");
    expect(result.data[0]).toHaveProperty("geocoded", true);
  });

  it("should geocode shelters with whitespace-only addresses", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "רחוב", city: "ירושלים" })
    );

    const data = {
      data: [{ id: 1, address: "   ", lat: 31.77, lon: 35.23 }],
    };

    const result = (await enrichWithTimers(data)) as typeof data;
    expect(result.data[0].address).toBe("רחוב");
    expect(result.data[0]).toHaveProperty("geocoded", true);
  });

  it("should skip shelters that already have valid addresses", async () => {
    const data = {
      data: [
        { id: 1, address: "רחוב הרצל 10", city: "תל אביב", lat: 32.08, lon: 34.78 },
        { id: 2, address: "רחוב דיזנגוף 5", city: "תל אביב", lat: 32.09, lon: 34.77 },
      ],
    };

    const result = await enrichShelterAddresses(data);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  it("should skip shelters without lat/lon", async () => {
    const data = {
      data: [{ id: 1, address: "Unknown address" }],
    };

    const result = (await enrichShelterAddresses(data)) as typeof data;
    expect(result.data[0].address).toBe("Unknown address");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle raw array format", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "רחוב יפו", city: "ירושלים" })
    );

    const data = [
      { id: 1, address: "Unknown address", lat: 31.78, lon: 35.22 },
    ];

    const result = (await enrichWithTimers(data)) as typeof data;
    expect(result[0].address).toBe("רחוב יפו");
  });

  it("should limit geocoding to MAX_GEOCODE_PER_REQUEST (5)", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "רחוב", city: "עיר" })
    );

    const shelters = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      address: "Unknown address",
      lat: 32.0 + i * 0.01,
      lon: 34.0 + i * 0.01,
    }));

    await enrichWithTimers({ data: shelters });

    // Should only geocode 5 shelters max
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("should return data as-is for unknown shape", async () => {
    const data = "not an object";
    const result = await enrichShelterAddresses(data);
    expect(result).toBe(data);
  });

  it("should return null/undefined as-is", async () => {
    const result1 = await enrichShelterAddresses(null);
    expect(result1).toBeNull();

    const result2 = await enrichShelterAddresses(undefined);
    expect(result2).toBeUndefined();
  });

  it("should not break when geocoding fails", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const data = {
      data: [
        { id: 1, address: "Unknown address", lat: 32.0, lon: 34.0 },
      ],
    };

    // Should not throw
    const result = (await enrichWithTimers(data)) as typeof data;
    // Address should remain unchanged since geocoding returned empty
    expect(result.data[0].address).toBe("Unknown address");
  });

  it("should not overwrite address when geocoding returns empty result", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const data = {
      data: [{ id: 1, address: "", lat: 32.0, lon: 34.0 }],
    };

    const result = (await enrichWithTimers(data)) as typeof data & {
      data: Array<{ geocoded?: boolean }>;
    };
    // address stays empty, geocoded flag not set
    expect(result.data[0].address).toBe("");
    expect(result.data[0].geocoded).toBeUndefined();
  });

  it("should only geocode shelters needing it in a mixed list", async () => {
    mockFetch.mockResolvedValue(
      makeNominatimResponse({ road: "רחוב חדש", city: "תל אביב" })
    );

    const data = {
      data: [
        { id: 1, address: "רחוב קיים", lat: 32.08, lon: 34.78 },     // valid - skip
        { id: 2, address: "", lat: 32.09, lon: 34.77 },                // needs geocoding
        { id: 3, address: "Unknown address", lat: 32.10, lon: 34.76 }, // needs geocoding
        { id: 4, address: "כתובת תקינה", lat: 32.11, lon: 34.75 },    // valid - skip
      ],
    };

    const result = (await enrichWithTimers(data)) as typeof data;

    // Only 2 fetch calls for the 2 shelters needing geocoding
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Valid addresses untouched
    expect(result.data[0].address).toBe("רחוב קיים");
    expect(result.data[3].address).toBe("כתובת תקינה");

    // Geocoded shelters updated
    expect(result.data[1].address).toBe("רחוב חדש");
    expect(result.data[2].address).toBe("רחוב חדש");
  });
});
