import { apiGet } from "./client.js";

export async function getActiveAlerts(): Promise<Record<string, string[]>> {
  return apiGet<Record<string, string[]>>("/api/active");
}
