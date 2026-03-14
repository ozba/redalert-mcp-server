import { apiGet } from "./client.js";

export interface ShelterSearchParams {
  lat: number;
  lon: number;
  limit?: number;
  radius?: number;
  wheelchairOnly?: boolean;
  shelterType?: string;
  city?: string;
}

export async function searchShelters(params: ShelterSearchParams): Promise<unknown> {
  // Map wheelchairOnly to the API's expected "wheelchair" parameter name
  const { wheelchairOnly, ...rest } = params;
  const apiParams: Record<string, unknown> = { ...rest };
  if (wheelchairOnly !== undefined) {
    apiParams.wheelchair = wheelchairOnly;
  }
  return apiGet("/api/shelter/search", apiParams);
}
