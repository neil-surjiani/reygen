/**
 * Corridor Route Physics Simulator.
 * Integrates kinematic speed profile with the validated pure TypeScript physics engine.
 * Computes energy ledgers per trip and per km for passenger taxis, electric scooters, and transit buses.
 */

import {
  accumulateLedger,
  createEmptyLedger,
  stepPhysics,
} from "../physics";
import type {
  EnergyLedger,
  EnvironmentConditions,
  RoadCoilConfiguration,
  SolarConfiguration,
  VehicleParameters,
} from "../physics/types";
import {
  getTrafficControlAssumptions,
  resolveAssumptionValue,
  toEnvironmentConditions,
  toRoadCoilConfiguration,
  toSolarConfiguration,
  toVehicleParameters,
} from "../registry/loader";
import { generateSpeedProfile } from "./profile";
import type { RouteSimulationOptions, RouteSimulationResult } from "./types";

/**
 * Divides an energy ledger by distance in kilometers to produce a per-km ledger.
 */
export function calculateLedgerPerKm(
  ledger: EnergyLedger,
  distanceKm: number
): EnergyLedger {
  const d = distanceKm > 0 ? distanceKm : 1.0;

  return {
    consumed: ledger.consumed / d,
    aeroLoss: ledger.aeroLoss / d,
    rollingLoss: ledger.rollingLoss / d,
    gradeWork: ledger.gradeWork / d,
    frictionHeat: ledger.frictionHeat / d,
    drivetrainLoss: ledger.drivetrainLoss / d,
    regenReturned: ledger.regenReturned / d,
    solar: ledger.solar / d,
    roadCoil: ledger.roadCoil / d,
    netBatteryChange: ledger.netBatteryChange / d,
  };
}

/**
 * Simulates a full trip along a corridor route for a chosen vehicle.
 */
export function simulateRouteTrip(
  options: RouteSimulationOptions
): RouteSimulationResult {
  const selection = options.rangeSelection ?? "typical";
  const vehicleType = options.vehicleType;

  // 1. Resolve vehicle, environment, solar, and baseline coil configurations
  const vehicleParams: VehicleParameters = toVehicleParameters(
    vehicleType,
    selection,
    options.vehicleOverrides
  );

  const envConditions: EnvironmentConditions = toEnvironmentConditions(
    selection,
    {
      ...options.environmentOverrides,
      solarIrradiance: options.solarIrradianceWm2 ?? 1000,
    }
  );

  const solarConfig: SolarConfiguration = toSolarConfiguration(
    vehicleType,
    selection,
    options.solarOverrides
  );

  const baselineRoadCoil: RoadCoilConfiguration = toRoadCoilConfiguration(
    selection
  );

  // 2. Generate distance-conserving speed profile across the corridor
  const speedProfile = generateSpeedProfile(options.route, {
    includeSignals: options.includeSignals,
    includeJunctions: options.includeJunctions,
    signalStopProbability: options.signalStopProbability,
    signalAverageWait_s: options.signalAverageWait_s,
    junctionSlowdownSpeed_kmh: options.junctionSlowdownSpeed_kmh,
    comfortableAccelMps2: options.comfortableAccelMps2,
    comfortableDecelMps2: options.comfortableDecelMps2,
    coils: options.coils,
  });

  // 3. Step physics engine across every step of the profile
  let totalLedger = createEmptyLedger();
  let totalCoilEnergyReceivedJ = 0;

  for (const step of speedProfile.steps) {
    const isOverCoil = step.isOverCoil;
    const baseCoilPowerWatts =
      step.activeCoilPowerWatts ?? baselineRoadCoil.coilPowerWatts;
    const coilPowerWatts =
      baseCoilPowerWatts * (step.coilActiveFraction ?? 1.0);
    const couplingEfficiency =
      step.activeCouplingEfficiency ?? baselineRoadCoil.couplingEfficiency;

    const stepCoilConfig: RoadCoilConfiguration | undefined = isOverCoil
      ? {
          blockLengthM: 1_000_000_000,
          coverageRatio: 1.0,
          coilPowerWatts,
          couplingEfficiency,
        }
      : undefined;

    const stepResult = stepPhysics({
      dt: step.durationS,
      initialSpeed: step.vStartMps,
      acceleration: step.accelerationMps2,
      distance: step.startDistanceM,
      vehicle: vehicleParams,
      environment: envConditions,
      solar: solarConfig,
      roadCoil: stepCoilConfig,
    });

    totalLedger = accumulateLedger(totalLedger, stepResult.energyStep);
    totalCoilEnergyReceivedJ += stepResult.energyStep.roadCoil;
  }

  const totalDistanceM = speedProfile.totalDistanceM;
  const totalDistanceKm = totalDistanceM / 1000.0;
  const ledgerPerKm = calculateLedgerPerKm(totalLedger, totalDistanceKm);

  // Compute coil summary
  const coils = options.coils ?? [];
  let totalCoilLengthM = 0;
  for (const c of coils) {
    totalCoilLengthM += Math.max(0, c.endM - c.startM);
  }
  const coveragePct =
    totalDistanceM > 0 ? (totalCoilLengthM / totalDistanceM) * 100.0 : 0.0;

  const tc = getTrafficControlAssumptions();

  return {
    vehicleType,
    corridorId: options.route.corridorId,
    totalDistanceM,
    totalDistanceKm,
    totalDurationS: speedProfile.totalDurationS,
    averageSpeedKmh: speedProfile.averageSpeedKmh,
    speedProfile,
    ledgerPerTrip: totalLedger,
    ledgerPerKm,
    coilsSummary: {
      totalCoilSegments: coils.length,
      totalCoilLengthM,
      coveragePct: Math.min(100.0, coveragePct),
      totalCoilEnergyReceivedKwh: totalCoilEnergyReceivedJ / 3600000.0,
    },
    assumptionsUsed: {
      vehicleMassKg: vehicleParams.mass,
      cdaM2: vehicleParams.cdA,
      crr: vehicleParams.crr,
      driveEfficiency: vehicleParams.driveEfficiency,
      regenEfficiency: vehicleParams.regenEfficiency,
      auxWatts: vehicleParams.auxWatts,
      signalStopProbability:
        options.signalStopProbability ??
        (tc ? resolveAssumptionValue(tc.signalStopProbability, selection) : 0.5),
      signalAverageWait_s:
        options.signalAverageWait_s ??
        (tc ? resolveAssumptionValue(tc.signalAverageWait_s, selection) : 30.0),
      junctionSlowdownSpeed_kmh:
        options.junctionSlowdownSpeed_kmh ??
        (tc
          ? resolveAssumptionValue(tc.junctionSlowdownSpeed_kmh, selection)
          : 60.0),
      signalAssumptionNote:
        tc?.signalStopProbability.note ??
        "Explicitly labeled assumption: probability of encountering a red signal phase with uniform delay wait time.",
    },
  };
}
