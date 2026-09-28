/**
 * Type definitions for the assumptions registry.
 * Strictly adheres to AGENTS.md:
 * - Every value has: value, unit, source name, source URL, date accessed, confidence, and a one-line note.
 * - Confidence is one of: "measured" | "published" | "estimated" | "unsourced".
 * - Estimated and measured numbers specify ranges (min, typical, max) with the range's basis stated.
 * - Unsourced entries must have value: null and range: null.
 */

export type AssumptionConfidence = "measured" | "published" | "estimated" | "unsourced";

export type RangeSelection = "min" | "typical" | "max";

export interface ValueRange {
  min: number;
  typical: number;
  max: number;
}

export interface AssumptionItem {
  id: string;
  name: string;
  category: "vehicle" | "corridor" | "environment" | "speculative" | "traffic_control";
  vehicleType?: "transit_bus" | "passenger_taxi" | "scooter";
  value: number | null;
  range: ValueRange | null;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  dateAccessed: string;
  confidence: AssumptionConfidence;
  note: string;
  rangeBasis?: string;
}

export interface VehicleAssumptions {
  mass_kg: AssumptionItem;
  crr: AssumptionItem;
  cda_m2: AssumptionItem;
  motorEfficiency: AssumptionItem;
  regenEfficiency: AssumptionItem;
  regenCeiling_mps2: AssumptionItem;
  auxiliaryLoad_W: AssumptionItem;
  solarPanelArea_m2: AssumptionItem;
  solarPanelEfficiency: AssumptionItem;
}

export interface TrafficControlAssumptions {
  signalStopProbability: AssumptionItem;
  signalAverageWait_s: AssumptionItem;
  junctionSlowdownSpeed_kmh: AssumptionItem;
}

export interface CorridorAssumptions {
  costPerKm_USD: AssumptionItem;
  coilPower_kW: AssumptionItem;
  couplingEfficiency: AssumptionItem;
}

export interface EnvironmentAssumptions {
  airDensity_kg_m3: AssumptionItem;
}

export interface AssumptionsRegistryData {
  metadata: {
    title: string;
    version: string;
    lastUpdated: string;
    description: string;
    jurisdiction: string;
  };
  environment: EnvironmentAssumptions;
  corridor: CorridorAssumptions;
  trafficControl?: TrafficControlAssumptions;
  vehicles: {
    transit_bus: VehicleAssumptions;
    passenger_taxi: VehicleAssumptions;
    scooter?: VehicleAssumptions;
  };
  speculativeHarvesters?: Record<string, AssumptionItem>;
}

export interface RegistryAuditReport {
  totalCount: number;
  measuredCount: number;
  publishedCount: number;
  estimatedCount: number;
  unsourcedCount: number;
  unsourcedItems: string[];
  allSources: Array<{
    id: string;
    sourceName: string;
    sourceUrl: string;
    confidence: AssumptionConfidence;
  }>;
}
