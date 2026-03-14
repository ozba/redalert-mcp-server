import { describe, it, expect } from "vitest";
import { ALL_ALERT_TYPES } from "../realtime/types.js";

describe("ALL_ALERT_TYPES", () => {
  it("should include standard alert types", () => {
    expect(ALL_ALERT_TYPES).toContain("missiles");
    expect(ALL_ALERT_TYPES).toContain("earthQuake");
    expect(ALL_ALERT_TYPES).toContain("tsunami");
    expect(ALL_ALERT_TYPES).toContain("hostileAircraftIntrusion");
    expect(ALL_ALERT_TYPES).toContain("hazardousMaterials");
    expect(ALL_ALERT_TYPES).toContain("terroristInfiltration");
    expect(ALL_ALERT_TYPES).toContain("newsFlash");
    expect(ALL_ALERT_TYPES).toContain("unconventionalWarfare");
    expect(ALL_ALERT_TYPES).toContain("radiologicalEvent");
    expect(ALL_ALERT_TYPES).toContain("generalAlert");
  });

  it("should include drill alert types", () => {
    expect(ALL_ALERT_TYPES).toContain("missilesDrill");
    expect(ALL_ALERT_TYPES).toContain("earthQuakeDrill");
    expect(ALL_ALERT_TYPES).toContain("tsunamiDrill");
    expect(ALL_ALERT_TYPES).toContain("hostileAircraftIntrusionDrill");
    expect(ALL_ALERT_TYPES).toContain("hazardousMaterialsDrill");
    expect(ALL_ALERT_TYPES).toContain("terroristInfiltrationDrill");
    expect(ALL_ALERT_TYPES).toContain("radiologicalEventDrill");
  });

  it("should have 17 total alert types", () => {
    expect(ALL_ALERT_TYPES).toHaveLength(17);
  });

  it("should not have duplicates", () => {
    const unique = new Set(ALL_ALERT_TYPES);
    expect(unique.size).toBe(ALL_ALERT_TYPES.length);
  });
});
