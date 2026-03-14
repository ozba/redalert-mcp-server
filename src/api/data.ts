import { apiGet } from "./client.js";

export interface DataCitiesParams {
  search?: string;
  zone?: string;
  limit?: number;
  offset?: number;
  include?: string;
}

export async function getDataCities(params?: DataCitiesParams): Promise<unknown> {
  return apiGet("/api/data/cities", params);
}
