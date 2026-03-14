import { apiGet } from "./client.js";

export interface StatsSummaryParams {
  startDate?: string;
  endDate?: string;
  origin?: string;
  include?: string;
  topLimit?: number;
  timelineGroup?: string;
}

export async function getStatsSummary(params?: StatsSummaryParams): Promise<unknown> {
  return apiGet("/api/stats/summary", params);
}

export interface StatsCitiesParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  origin?: string;
  search?: string;
  include?: string;
}

export async function getStatsCities(params?: StatsCitiesParams): Promise<unknown> {
  return apiGet("/api/stats/cities", params);
}

export interface StatsHistoryParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  cityId?: number;
  cityName?: string;
  search?: string;
  category?: string;
  origin?: string;
  sort?: string;
  order?: string;
  include?: string;
}

export async function getStatsHistory(params?: StatsHistoryParams): Promise<unknown> {
  return apiGet("/api/stats/history", params);
}

export interface StatsDistributionParams {
  startDate?: string;
  endDate?: string;
  origin?: string;
  groupBy?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: string;
}

export async function getStatsDistribution(params?: StatsDistributionParams): Promise<unknown> {
  return apiGet("/api/stats/distribution", params);
}
