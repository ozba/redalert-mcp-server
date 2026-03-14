function getApiKey(): string {
  const key = process.env.REDALERT_API_KEY;
  if (!key) {
    console.error("Warning: REDALERT_API_KEY environment variable is not set. Some endpoints may not work.");
    return "";
  }
  return key;
}

export const CONFIG = {
  BASE_URL: "https://redalert.orielhaim.com",
  get API_KEY() { return getApiKey(); },
  SOCKET_URL: "https://redalert.orielhaim.com",
  SOCKET_RECONNECT_ATTEMPTS: 10,
  SOCKET_RECONNECT_DELAY_MS: 2000,
  REQUEST_TIMEOUT_MS: 15000,
} as const;
