/**
 * Monte Carlo Sensitivity Analysis Engine.
 * Strictly adheres to AGENTS.md:
 * - Samples published and estimated parameters across verified registry ranges.
 * - Seeded PRNG for reproducible 5th, 50th, and 95th percentiles.
 * - Enforces minimum 2,000 simulation runs.
 */

import type { AssumptionItem } from "../registry/types";
import {
  getCorridorAssumptions,
  getEnvironmentAssumptions,
  getTrafficControlAssumptions,
  getVehicleAssumptions,
} from "../registry/loader";
import { simulateRouteTrip } from "../route/simulator";
import type { CoilSegmentPlacement } from "../route/types";
import {
  computeDistributionStats,
  createSeededRandom,
  sampleTriangular,
  sampleUniform,
} from "./random";
import type {
  MonteCarloOptions,
  MonteCarloResult,
  MonteCarloRunRecord,
  SamplingDistribution,
} from "./types";

interface SamplerTarget {
  id: string;
  name: string;
  min: number;
  typical: number;
  max: number;
}

function extractSamplerTarget(
  item: AssumptionItem | undefined
): SamplerTarget | null {
  if (!item || !item.range || item.confidence === "unsourced") {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    min: item.range.min,
    typical: item.range.typical,
    max: item.range.max,
  };
}

function sampleItem(
  target: SamplerTarget,
  rng: () => number,
  dist: SamplingDistribution
): number {
  if (dist === "uniform") {
    return sampleUniform(rng, target.min, target.max);
  }
  return sampleTriangular(rng, target.min, target.typical, target.max);
}

/**
 * Executes a Monte Carlo simulation sampling all estimated and published inputs
 * across their registry ranges for a minimum of 2,000 iterations.
 */
export function runMonteCarloSimulation(
  options: MonteCarloOptions
): MonteCarloResult {
  const runs = Math.max(2000, options.runs ?? 2000);
  const seed = options.seed ?? 42;
  const distribution: SamplingDistribution = options.distribution ?? "triangular";
  const rng = createSeededRandom(seed);

  // 1. Gather assumptions targets from the registry
  const envAssumptions = getEnvironmentAssumptions();
  const vAssumptions = getVehicleAssumptions(options.vehicleType);
  const corridorAssumptions = getCorridorAssumptions();
  const tcAssumptions = getTrafficControlAssumptions();

  const airDensityTarget = extractSamplerTarget(envAssumptions?.airDensity_kg_m3);
  const massTarget = extractSamplerTarget(vAssumptions?.mass_kg);
  const crrTarget = extractSamplerTarget(vAssumptions?.crr);
  const cdaTarget = extractSamplerTarget(vAssumptions?.cda_m2);
  const motorEffTarget = extractSamplerTarget(vAssumptions?.motorEfficiency);
  const regenEffTarget = extractSamplerTarget(vAssumptions?.regenEfficiency);
  const regenCeilTarget = extractSamplerTarget(vAssumptions?.regenCeiling_mps2);
  const auxLoadTarget = extractSamplerTarget(vAssumptions?.auxiliaryLoad_W);
  const solarAreaTarget = extractSamplerTarget(vAssumptions?.solarPanelArea_m2);
  const solarEffTarget = extractSamplerTarget(vAssumptions?.solarPanelEfficiency);

  const coilPowerTarget = extractSamplerTarget(corridorAssumptions?.coilPower_kW);
  const couplingEffTarget = extractSamplerTarget(
    corridorAssumptions?.couplingEfficiency
  );

  const sigProbTarget = extractSamplerTarget(
    tcAssumptions?.signalStopProbability
  );
  const sigWaitTarget = extractSamplerTarget(
    tcAssumptions?.signalAverageWait_s
  );
  const juncSpeedTarget = extractSamplerTarget(
    tcAssumptions?.junctionSlowdownSpeed_kmh
  );

  const sampledTargets = [
    airDensityTarget,
    massTarget,
    crrTarget,
    cdaTarget,
    motorEffTarget,
    regenEffTarget,
    regenCeilTarget,
    auxLoadTarget,
    solarAreaTarget,
    solarEffTarget,
    coilPowerTarget,
    couplingEffTarget,
    sigProbTarget,
    sigWaitTarget,
    juncSpeedTarget,
  ].filter((t): t is SamplerTarget => t !== null);

  const sampledParameterNames = sampledTargets.map((t) => t.id);

  // 2. Run simulation loop
  const netBatteryChange_kWh_arr: number[] = new Array(runs);
  const netBatteryChange_J_arr: number[] = new Array(runs);
  const grossWhPerKm_arr: number[] = new Array(runs);
  const netWhPerKm_arr: number[] = new Array(runs);
  const sampleRuns: MonteCarloRunRecord[] = [];

  let netPositiveCount = 0;
  const baseCoils = options.coils ?? [];

  for (let i = 0; i < runs; i++) {
    // Sample vehicle parameters
    const mass = massTarget
      ? sampleItem(massTarget, rng, distribution)
      : undefined;
    const crr = crrTarget
      ? sampleItem(crrTarget, rng, distribution)
      : undefined;
    const cdA = cdaTarget
      ? sampleItem(cdaTarget, rng, distribution)
      : undefined;
    const driveEfficiency = motorEffTarget
      ? sampleItem(motorEffTarget, rng, distribution)
      : undefined;
    const regenEfficiency = regenEffTarget
      ? sampleItem(regenEffTarget, rng, distribution)
      : undefined;
    const maxRegenDecel = regenCeilTarget
      ? sampleItem(regenCeilTarget, rng, distribution)
      : undefined;
    const auxWatts = auxLoadTarget
      ? sampleItem(auxLoadTarget, rng, distribution)
      : undefined;

    // Sample environment
    const airDensity = airDensityTarget
      ? sampleItem(airDensityTarget, rng, distribution)
      : undefined;

    // Sample solar
    const solarArea = solarAreaTarget
      ? sampleItem(solarAreaTarget, rng, distribution)
      : undefined;
    const solarEff = solarEffTarget
      ? sampleItem(solarEffTarget, rng, distribution)
      : undefined;

    // Sample coil power & coupling
    const coilPowerKw = coilPowerTarget
      ? sampleItem(coilPowerTarget, rng, distribution)
      : 75.0;
    const couplingEff = couplingEffTarget
      ? sampleItem(couplingEffTarget, rng, distribution)
      : 0.80;

    // Build active coil configuration for this run
    const runCoils: CoilSegmentPlacement[] = baseCoils.map((c) => ({
      ...c,
      coilPowerWatts: (coilPowerKw ?? 75.0) * 1000.0,
      couplingEfficiency: couplingEff,
    }));

    // Sample traffic control
    const signalStopProbability = sigProbTarget
      ? sampleItem(sigProbTarget, rng, distribution)
      : undefined;
    const signalAverageWait_s = sigWaitTarget
      ? sampleItem(sigWaitTarget, rng, distribution)
      : undefined;
    const junctionSlowdownSpeed_kmh = juncSpeedTarget
      ? sampleItem(juncSpeedTarget, rng, distribution)
      : undefined;

    const simResult = simulateRouteTrip({
      vehicleType: options.vehicleType,
      route: options.route,
      coils: runCoils,
      solarIrradianceWm2: options.solarIrradianceWm2 ?? 0,
      includeSignals: options.includeSignals ?? true,
      includeJunctions: options.includeJunctions ?? true,
      signalStopProbability,
      signalAverageWait_s,
      junctionSlowdownSpeed_kmh,
      vehicleOverrides: {
        mass,
        crr,
        cdA,
        driveEfficiency,
        regenEfficiency,
        maxRegenDecel,
        auxWatts,
      },
      environmentOverrides: {
        airDensity,
      },
      solarOverrides: {
        areaM2: solarArea,
        cellEfficiency: solarEff,
      },
    });

    const netJ = simResult.ledgerPerTrip.netBatteryChange;
    const netKwh = netJ / 3600000.0;
    const distKm = simResult.totalDistanceKm > 0 ? simResult.totalDistanceKm : 1.0;
    const grossWhKm = (simResult.ledgerPerTrip.consumed / 3600.0) / distKm;
    const netWhKm = (-netJ / 3600.0) / distKm;

    netBatteryChange_J_arr[i] = netJ;
    netBatteryChange_kWh_arr[i] = netKwh;
    grossWhPerKm_arr[i] = grossWhKm;
    netWhPerKm_arr[i] = netWhKm;

    if (netJ >= 0) {
      netPositiveCount++;
    }

    if (i < 25) {
      sampleRuns.push({
        runIndex: i + 1,
        netBatteryChange_J: netJ,
        netBatteryChange_kWh: netKwh,
        grossWhPerKm: grossWhKm,
        netWhPerKm: netWhKm,
        consumed_kWh: simResult.ledgerPerTrip.consumed / 3600000.0,
        roadCoil_kWh: simResult.ledgerPerTrip.roadCoil / 3600000.0,
        regenReturned_kWh: simResult.ledgerPerTrip.regenReturned / 3600000.0,
      });
    }
  }

  return {
    vehicleType: options.vehicleType,
    corridorId: options.route.corridorId,
    totalDistanceKm: options.route.totalLengthKm,
    runs,
    seed,
    distribution,
    sampledParametersCount: sampledTargets.length,
    sampledParameterNames,
    netBatteryChange_kWh: computeDistributionStats(netBatteryChange_kWh_arr),
    netBatteryChange_J: computeDistributionStats(netBatteryChange_J_arr),
    grossWhPerKm: computeDistributionStats(grossWhPerKm_arr),
    netWhPerKm: computeDistributionStats(netWhPerKm_arr),
    probabilityOfNetPositive: netPositiveCount / runs,
    sampleRuns,
  };
}
