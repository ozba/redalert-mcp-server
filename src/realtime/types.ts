export const ALL_ALERT_TYPES = [
  "missiles",
  "earthQuake",
  "tsunami",
  "hostileAircraftIntrusion",
  "hazardousMaterials",
  "terroristInfiltration",
  "newsFlash",
  "unconventionalWarfare",
  "radiologicalEvent",
  "generalAlert",
  // Drills
  "missilesDrill",
  "radiologicalEventDrill",
  "earthQuakeDrill",
  "tsunamiDrill",
  "hostileAircraftIntrusionDrill",
  "hazardousMaterialsDrill",
  "terroristInfiltrationDrill",
] as const;

export type AlertType = (typeof ALL_ALERT_TYPES)[number];

export interface AlertPayload {
  type: string;
  title: string;
  cities: string[];
  instructions: string;
}

export interface BufferedAlert {
  receivedAt: string;
  type: string;
  title: string;
  cities: string[];
  instructions: string;
}

export interface ConnectionState {
  connected: boolean;
  subscribedTypes: string[];
  testMode: boolean;
  connectedSince: string | null;
  totalAlertsReceived: number;
}
