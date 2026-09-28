/**
 * Corridor Inductive Coverage Percentage Sweep Engine.
 * Strictly adheres to AGENTS.md:
 * - Sweeps coverage percentage from 0% to 100%.
 * - Evaluates net battery energy balance per trip and per km.
 * - Solves exact crossover threshold where net-positive is achieved.
 */

import {
  getCorridorAssumptions,
  resolveAssumptionValue,
} from "../registry/loader";
import { simulateRouteTrip } from "../route/simulator";
import type { CoilSegmentPlacement } from "../route/types";
import type {
  CoverageSweepOptions,
  CoverageSweepResult,
  CoverageSweepStep,
} from "./types";

/**
 * Sweeps dynamic wireless charging coverage from 0% to 100% of the corridor,
 * calculating energy ledger metrics and locating the exact net-positive crossover threshold.
 */
export function sweepCoveragePercentage(
  options: CoverageSweepOptions
): CoverageSweepResult {
  const stepPct = Math.max(1, Math.min(25, options.stepPct ?? 5));
  const corridorAssumptions = getCorridorAssumptions();

  const defaultCoilPowerWatts = corridorAssumptions?.coilPower_kW
    ? resolveAssumptionValue(corridorAssumptions.coilPower_kW) * 1000.0
    : 75000.0;

  const defaultCouplingEfficiency = corridorAssumptions?.couplingEfficiency
    ? resolveAssumptionValue(corridorAssumptions.couplingEfficiency)
    : 0.80;

  const coilPowerWatts = options.coilPowerWatts ?? defaultCoilPowerWatts;
  const couplingEfficiency =
    options.couplingEfficiency ?? defaultCouplingEfficiency;

  const totalLengthM = options.route.totalLengthM;
  const totalDistanceKm = options.route.totalLengthKm;

  const steps: CoverageSweepStep[] = [];

  for (let coverage = 0; coverage <= 100; coverage += stepPct) {
    const coilLengthM = (totalLengthM * coverage) / 100.0;
    const coilLengthKm = coilLengthM / 1000.0;

    const coils: CoilSegmentPlacement[] =
      coverage > 0
        ? [
            {
              id: `sweep_coil_${coverage}pct`,
              startM: 0,
              endM: coilLengthM,
              coilPowerWatts,
              couplingEfficiency,
            },
          ]
        : [];

    const sim = simulateRouteTrip({
      vehicleType: options.vehicleType,
      route: options.route,
      coils,
      solarIrradianceWm2: options.solarIrradianceWm2 ?? 0,
      includeSignals: options.includeSignals ?? true,
      includeJunctions: options.includeJunctions ?? true,
    });

    const netJ = sim.ledgerPerTrip.netBatteryChange;
    const netKwh = netJ / 3600000.0;
    const grossWhKm =
      (sim.ledgerPerTrip.consumed / 3600.0) /
      (totalDistanceKm > 0 ? totalDistanceKm : 1.0);
    const netWhKm =
      (-netJ / 3600.0) / (totalDistanceKm > 0 ? totalDistanceKm : 1.0);
    const roadCoilKwh = sim.ledgerPerTrip.roadCoil / 3600000.0;
    const isNetPositive = netJ >= 0;

    steps.push({
      coveragePct: coverage,
      coilLengthM,
      coilLengthKm,
      netBatteryChange_J: netJ,
      netBatteryChange_kWh: netKwh,
      grossWhPerKm: grossWhKm,
      netWhPerKm: netWhKm,
      roadCoil_kWh: roadCoilKwh,
      isNetPositive,
    });
  }

  // Ensure 100% point is included if step size didn't land exactly on 100
  if (steps[steps.length - 1].coveragePct < 100) {
    const coverage = 100;
    const coilLengthM = totalLengthM;
    const coilLengthKm = totalDistanceKm;

    const sim = simulateRouteTrip({
      vehicleType: options.vehicleType,
      route: options.route,
      coils: [
        {
          id: `sweep_coil_100pct`,
          startM: 0,
          endM: coilLengthM,
          coilPowerWatts,
          couplingEfficiency,
        },
      ],
      solarIrradianceWm2: options.solarIrradianceWm2 ?? 0,
      includeSignals: options.includeSignals ?? true,
      includeJunctions: options.includeJunctions ?? true,
    });

    const netJ = sim.ledgerPerTrip.netBatteryChange;
    const netKwh = netJ / 3600000.0;
    const grossWhKm =
      (sim.ledgerPerTrip.consumed / 3600.0) /
      (totalDistanceKm > 0 ? totalDistanceKm : 1.0);
    const netWhKm =
      (-netJ / 3600.0) / (totalDistanceKm > 0 ? totalDistanceKm : 1.0);
    const roadCoilKwh = sim.ledgerPerTrip.roadCoil / 3600000.0;
    const isNetPositive = netJ >= 0;

    steps.push({
      coveragePct: coverage,
      coilLengthM,
      coilLengthKm,
      netBatteryChange_J: netJ,
      netBatteryChange_kWh: netKwh,
      grossWhPerKm: grossWhKm,
      netWhPerKm: netWhKm,
      roadCoil_kWh: roadCoilKwh,
      isNetPositive,
    });
  }

  // Locate crossover where netBatteryChange transitions from negative to positive
  let netPositiveReached = false;
  let crossoverCoveragePct: number | null = null;
  let crossoverCoilLengthKm: number | null = null;

  if (steps[0].isNetPositive) {
    // Already net-positive at 0% coverage (e.g. regenerative/solar surplus)
    netPositiveReached = true;
    crossoverCoveragePct = 0;
    crossoverCoilLengthKm = 0;
  } else {
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].isNetPositive) {
        netPositiveReached = true;
        const prev = steps[i - 1];
        const curr = steps[i];

        // Linear interpolation between prev and curr to find root (netBatteryChange == 0)
        const y0 = prev.netBatteryChange_J;
        const y1 = curr.netBatteryChange_J;
        const x0 = prev.coveragePct;
        const x1 = curr.coveragePct;

        const rootX = x0 + (0 - y0) * ((x1 - x0) / (y1 - y0));
        crossoverCoveragePct = Math.round(rootX * 10) / 10;
        crossoverCoilLengthKm =
          Math.round(((totalDistanceKm * crossoverCoveragePct) / 100.0) * 100) /
          100.0;
        break;
      }
    }
  }

  let summaryNote = "";
  if (netPositiveReached && crossoverCoveragePct !== null) {
    summaryNote = `Net-positive energy balance is reached at ${crossoverCoveragePct.toFixed(1)}% dynamic coil coverage (${crossoverCoilLengthKm?.toFixed(2)} km of electrified roadway). Beyond this threshold, vehicle battery state of charge increases during transit.`;
  } else {
    summaryNote = `Net-positive energy balance is not reached within 100% corridor coverage at current coil specifications (${(coilPowerWatts / 1000).toFixed(0)} kW, ${(couplingEfficiency * 100).toFixed(0)}% coupling).`;
  }

  return {
    vehicleType: options.vehicleType,
    corridorId: options.route.corridorId,
    totalDistanceKm,
    steps,
    netPositiveReached,
    crossoverCoveragePct,
    crossoverCoilLengthKm,
    summaryNote,
  };
}
