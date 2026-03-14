import { CONFIG } from "../config.js";
import { RedAlertApiError } from "../errors.js";

export async function apiGet<T>(
  path: string,
  params?: object,
): Promise<T> {
  const url = new URL(path, CONFIG.BASE_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (CONFIG.API_KEY) {
    headers["Authorization"] = `Bearer ${CONFIG.API_KEY}`;
  }

  const response = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new RedAlertApiError(response.status, response.statusText, body);
  }

  return response.json() as Promise<T>;
}
