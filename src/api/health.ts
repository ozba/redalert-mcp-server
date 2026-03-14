import { CONFIG } from "../config.js";
import { RedAlertApiError } from "../errors.js";

export async function getHealth(): Promise<{ status: string }> {
  const url = new URL("/api/health", CONFIG.BASE_URL);

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

  // Try JSON first; health endpoint may return plain text "OK"
  try {
    const data = await response.json();
    return data as { status: string };
  } catch {
    // Response was not JSON (e.g. plain text "OK")
    return { status: "ok" };
  }
}
