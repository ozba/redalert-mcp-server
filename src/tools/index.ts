import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerActive } from "./active.js";
import { register as registerStatsSummary } from "./stats-summary.js";
import { register as registerStatsCities } from "./stats-cities.js";
import { register as registerStatsHistory } from "./stats-history.js";
import { register as registerStatsDistribution } from "./stats-distribution.js";
import { register as registerShelterSearch } from "./shelter-search.js";
import { register as registerGetCities } from "./get-cities.js";
import { register as registerHealthCheck } from "./health-check.js";

export function registerTools(server: McpServer): void {
  registerActive(server);
  registerStatsSummary(server);
  registerStatsCities(server);
  registerStatsHistory(server);
  registerStatsDistribution(server);
  registerShelterSearch(server);
  registerGetCities(server);
  registerHealthCheck(server);
}
