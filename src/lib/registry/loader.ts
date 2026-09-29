/**
 * Assumptions registry loader and conversion utilities.
 * Loads verified baseline data and transforms them into physics simulation inputs.
 */

import assumptionsRaw from "./assumptions.json";
import type {
  AssumptionItem,
  AssumptionsRegistryData,
  CorridorAssumptions,
  EnvironmentAssumptions,
  RangeSelection,
  RegistryAuditReport,
  VehicleAssumptions,
} from "./types";
import type {
  EnvironmentConditions,
  RoadCoilConfiguration,
  SolarConfiguration,
  VehicleParameters,
} from "../physics/types";

export const assumptionsData: AssumptionsRegistryData =
  assumptionsRaw as unknown as AssumptionsRegistryData;

/**
 * Returns the complete typed assumptions registry.
 */
export function loadAssumptionsRegistry(): AssumptionsRegistryData {
  return assumptionsData;
}

/**
 * Extracts a numeric value from an assumption item given a range selection ("min" | "typical" | "max").
 * Throws an error if the item is unsourced (value is null).
 */
export function resolveAssumptionValue(
  item: AssumptionItem,
  selection: RangeSelection = "typical"
): number {
  if (item.confidence === "unsourced" || item.value === null) {
    throw new Error(
      `Cannot resolve numeric value for unsourced assumption: "${item.id}" (${item.name}). Sourcing required per AGENTS.md.`
    );
  }

  if (item.range && typeof item.range[selection] === "number") {
    return item.range[selection];
  }

  return item.value;
}

/**
 * Returns all assumptions in the registry as a flat array.
 */
export function getAllAssumptions(): AssumptionItem[] {
  const items: AssumptionItem[] = [];

  // Environment
  items.push(assumptionsData.environment.airDensity_kg_m3);

  // Corridor
  items.push(
    assumptionsData.corridor.costPerKm_USD,
    assumptionsData.corridor.coilPower_kW,
    assumptionsData.corridor.couplingEfficiency
  );

  // Transit Bus
  const bus = assumptionsData.vehicles.transit_bus;
  items.push(
    bus.mass_kg,
    bus.crr,
    bus.cda_m2,
    bus.motorEfficiency,
    bus.regenEfficiency,
    bus.regenCeiling_mps2,
    bus.auxiliaryLoad_W,
    bus.solarPanelArea_m2,
    bus.solarPanelEfficiency
  );

  // Passenger Taxi
  const taxi = assumptionsData.vehicles.passenger_taxi;
  items.push(
    taxi.mass_kg,
    taxi.crr,
    taxi.cda_m2,
    taxi.motorEfficiency,
    taxi.regenEfficiency,
    taxi.regenCeiling_mps2,
    taxi.auxiliaryLoad_W,
    taxi.solarPanelArea_m2,
    taxi.solarPanelEfficiency
  );

  // Scooter (if present)
  if (assumptionsData.vehicles.scooter) {
    const sc = assumptionsData.vehicles.scooter;
    items.push(
      sc.mass_kg,
      sc.crr,
      sc.cda_m2,
      sc.motorEfficiency,
      sc.regenEfficiency,
      sc.regenCeiling_mps2,
      sc.auxiliaryLoad_W,
      sc.solarPanelArea_m2,
      sc.solarPanelEfficiency
    );
  }

  // Traffic Control (if present)
  if (assumptionsData.trafficControl) {
    items.push(
      assumptionsData.trafficControl.signalStopProbability,
      assumptionsData.trafficControl.signalAverageWait_s,
      assumptionsData.trafficControl.junctionSlowdownSpeed_kmh
    );
  }

  // Speculative harvesters (if any)
  if (assumptionsData.speculativeHarvesters) {
    for (const specItem of Object.values(assumptionsData.speculativeHarvesters)) {
      items.push(specItem);
    }
  }

  return items;
}

/**
 * Looks up an assumption by its unique ID.
 */
export function getAssumptionById(id: string): AssumptionItem | undefined {
  return getAllAssumptions().find((item) => item.id === id);
}

export type SupportedVehicleType = "transit_bus" | "passenger_taxi" | "scooter";

/**
 * Retrieves vehicle assumptions for a given vehicle type.
 */
export function getVehicleAssumptions(
  vehicleType: SupportedVehicleType
): VehicleAssumptions {
  const v = assumptionsData.vehicles[vehicleType];
  if (!v) {
    throw new Error(`Unknown vehicle type: ${vehicleType}`);
  }
  return v;
}

/**
 * Retrieves corridor assumptions.
 */
export function getCorridorAssumptions(): CorridorAssumptions {
  return assumptionsData.corridor;
}

/**
 * Retrieves environment assumptions.
 */
export function getEnvironmentAssumptions(): EnvironmentAssumptions {
  return assumptionsData.environment;
}

/**
 * Retrieves traffic control assumptions.
 */
export function getTrafficControlAssumptions() {
  return assumptionsData.trafficControl;
}

function filterDefinedOverrides<T extends object>(overrides?: Partial<T>): Partial<T> {
  if (!overrides) return {};
  const cleaned: Partial<T> = {};
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== undefined && val !== null && !Number.isNaN(val as number)) {
      (cleaned as Record<string, unknown>)[key] = val;
    }
  }
  return cleaned;
}

/**
 * Converts vehicle assumptions into the physics engine VehicleParameters struct.
 */
export function toVehicleParameters(
  vehicleType: SupportedVehicleType,
  selection: RangeSelection = "typical",
  overrides?: Partial<VehicleParameters>
): VehicleParameters {
  const v = getVehicleAssumptions(vehicleType);

  return {
    mass: resolveAssumptionValue(v.mass_kg, selection),
    cdA: resolveAssumptionValue(v.cda_m2, selection),
    crr: resolveAssumptionValue(v.crr, selection),
    driveEfficiency: resolveAssumptionValue(v.motorEfficiency, selection),
    regenEfficiency: resolveAssumptionValue(v.regenEfficiency, selection),
    maxRegenDecel: resolveAssumptionValue(v.regenCeiling_mps2, selection),
    auxWatts: resolveAssumptionValue(v.auxiliaryLoad_W, selection),
    ...filterDefinedOverrides(overrides),
  };
}

/**
 * Converts environment assumptions into the physics engine EnvironmentConditions struct.
 */
export function toEnvironmentConditions(
  selection: RangeSelection = "typical",
  overrides?: Partial<EnvironmentConditions>
): EnvironmentConditions {
  const env = assumptionsData.environment;

  return {
    airDensity: resolveAssumptionValue(env.airDensity_kg_m3, selection),
    gradeAngleRad: 0,
    headwindSpeed: 0,
    solarIrradiance: 1000,
    ambientTemperature: 28,
    ...filterDefinedOverrides(overrides),
  };
}

/**
 * Converts solar assumptions into the physics engine SolarConfiguration struct.
 */
export function toSolarConfiguration(
  vehicleType: SupportedVehicleType,
  selection: RangeSelection = "typical",
  overrides?: Partial<SolarConfiguration>
): SolarConfiguration {
  const v = getVehicleAssumptions(vehicleType);

  return {
    areaM2: resolveAssumptionValue(v.solarPanelArea_m2, selection),
    cellEfficiency: resolveAssumptionValue(v.solarPanelEfficiency, selection),
    applyTemperatureDerating: true,
    ...filterDefinedOverrides(overrides),
  };
}

/**
 * Converts road coil assumptions into the physics engine RoadCoilConfiguration struct.
 */
export function toRoadCoilConfiguration(
  selection: RangeSelection = "typical",
  overrides?: Partial<RoadCoilConfiguration>
): RoadCoilConfiguration {
  const c = assumptionsData.corridor;

  // Coil power is stored in kW in the registry; convert to Watts for physics
  const coilPowerWatts = resolveAssumptionValue(c.coilPower_kW, selection) * 1000;
  const couplingEfficiency = resolveAssumptionValue(c.couplingEfficiency, selection);

  return {
    blockLengthM: 400,
    coverageRatio: 1.0,
    coilPowerWatts,
    couplingEfficiency,
    minSpeedThreshold: 0,
    ...filterDefinedOverrides(overrides),
  };
}

/**
 * Performs an audit of the entire registry, reporting counts, sources, and unsourced items.
 */
export function auditRegistry(): RegistryAuditReport {
  const all = getAllAssumptions();

  const measuredCount = all.filter((i) => i.confidence === "measured").length;
  const publishedCount = all.filter((i) => i.confidence === "published").length;
  const estimatedCount = all.filter((i) => i.confidence === "estimated").length;
  const unsourcedCount = all.filter((i) => i.confidence === "unsourced").length;

  const unsourcedItems = all
    .filter((i) => i.confidence === "unsourced" || i.value === null)
    .map((i) => `${i.id}: ${i.name}`);

  const allSources = all.map((i) => ({
    id: i.id,
    sourceName: i.sourceName,
    sourceUrl: i.sourceUrl,
    confidence: i.confidence,
  }));

  return {
    totalCount: all.length,
    measuredCount,
    publishedCount,
    estimatedCount,
    unsourcedCount,
    unsourcedItems,
    allSources,
  };
}
