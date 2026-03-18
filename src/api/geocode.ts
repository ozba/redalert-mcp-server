const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "redalert-mcp-server/1.1.0 (https://github.com/ozba/redalert-mcp-server)";
const RATE_LIMIT_MS = 1100; // slightly over 1s to respect Nominatim 1 req/sec
const TIMEOUT_MS = 3000;
const MAX_GEOCODE_PER_REQUEST = 5;

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

interface GeocodedAddress {
  address: string;
  city: string;
}

function formatAddress(addr: NominatimAddress): GeocodedAddress {
  const street = addr.road;
  const number = addr.house_number;
  const city = addr.city || addr.town || addr.village || "";

  let address = street || "";
  if (number && street) address = `${street} ${number}`;
  if (!address) address = addr.suburb || addr.neighbourhood || "";

  return { address, city };
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

const cache = new Map<string, GeocodedAddress>();

let lastRequestTime = 0;

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodedAddress> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const empty: GeocodedAddress = { address: "", city: "" };

  try {
    await rateLimitedDelay();

    const url = `${NOMINATIM_BASE}?lat=${lat}&lon=${lon}&format=json&accept-language=he&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // Don't cache transient HTTP errors — a retry may succeed
      return empty;
    }

    const data = (await res.json()) as NominatimResponse;
    if (!data.address) {
      // Valid response with no address data — safe to cache
      cache.set(key, empty);
      return empty;
    }

    const result = formatAddress(data.address);
    cache.set(key, result);
    return result;
  } catch {
    // Don't cache network/timeout errors — they are transient
    return empty;
  }
}

interface Shelter {
  address?: string;
  city?: string | null;
  building_name?: string | null;
  lat?: number;
  lon?: number;
  geocoded?: boolean;
  [key: string]: unknown;
}

function needsGeocoding(shelter: Shelter): boolean {
  if (shelter.lat == null || shelter.lon == null) return false;
  const addr = shelter.address;
  if (!addr || addr === "Unknown address" || addr.trim() === "") return true;
  return false;
}

export async function enrichShelterAddresses(data: unknown): Promise<unknown> {
  try {
    // Handle both { data: [...] } wrapper and raw array
    let shelters: Shelter[];
    let wrapped = false;
    if (
      data &&
      typeof data === "object" &&
      "data" in data &&
      Array.isArray((data as { data: unknown }).data)
    ) {
      shelters = (data as { data: Shelter[] }).data;
      wrapped = true;
    } else if (Array.isArray(data)) {
      shelters = data as Shelter[];
    } else {
      return data; // unknown shape, return as-is
    }

    // Find shelters needing geocoding, prioritize closest (they come first from the API)
    const toGeocode = shelters
      .map((s, i) => ({ shelter: s, index: i }))
      .filter(({ shelter }) => needsGeocoding(shelter))
      .slice(0, MAX_GEOCODE_PER_REQUEST);

    // Geocode sequentially (rate limited)
    for (const { shelter } of toGeocode) {
      const result = await reverseGeocode(shelter.lat!, shelter.lon!);
      if (result.address) {
        shelter.address = result.address;
        shelter.geocoded = true;
      }
      if (result.city) {
        shelter.city = result.city;
      }
    }

    return wrapped ? data : shelters;
  } catch {
    // Geocoding must never break shelter search
    return data;
  }
}
