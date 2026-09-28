/**
 * Types and interfaces for Sensitivity, Monte Carlo, and Coverage Sweep Analysis.
 * Strictly adheres to AGENTS.md:
 * - Samples across published and estimated registry ranges.
 * - Seeded random generator for reproducible results.
 * - Distance-conserving physics along the corridor.
 */

import type { SupportedVehicleType } from "../registry/loader";
import type { CoilSegmentPlacement, CorridorRoute } from "../route/types";

export type SamplingDistribution = "triangular" | "uniform";

export interface PercentileStats {
  /** 5th percentile value */
  p5: number;
  /** 50th percentile (median) value */
  p50: number;
  /** 95th percentile value */
  p95: number;
  /** Arithmetic sample mean */
  mean: number;
  /** Minimum observed sample value */
  min: number;
  /** Maximum observed sample value */
  max: number;
  /** Sample standard deviation */
  stdDev: number;
}

export interface MonteCarloRunRecord {
  runIndex: number;
  netBatteryChange_J: number;
  netBatteryChange_kWh: number;
  grossWhPerKm: number;
  netWhPerKm: number;
  consumed_kWh: number;
  roadCoil_kWh: number;
  regenReturned_kWh: number;
}

export interface MonteCarloOptions {
  /** Vehicle class to simulate */
  vehicleType: SupportedVehicleType;
  /** Corridor route geometry and segment data */
  route: CorridorRoute;
  /** User-defined coil placement along corridor (optional) */
  coils?: CoilSegmentPlacement[];
  /** Total Monte Carlo iterations (default: 2000, minimum: 2000) */
  runs?: number;
  /** PRNG seed for deterministic reproducibility (default: 42) */
  seed?: number;
  /** Statistical distribution across [min, typical, max] (default: "triangular") */
  distribution?: SamplingDistribution;
  /** Solar irradiance in W/m² (default: 0 for night / baseline) */
  solarIrradianceWm2?: number;
  /** Whether to simulate signal stop cycles (default: true) */
  includeSignals?: boolean;
  /** Whether to simulate junction slowdowns (default: true) */
  includeJunctions?: boolean;
}

export interface MonteCarloResult {
  vehicleType: SupportedVehicleType;
  corridorId: string;
  totalDistanceKm: number;
  runs: number;
  seed: number;
  distribution: SamplingDistribution;
  /** Number of parameters actively varied in the Monte Carlo sampling */
  sampledParametersCount: number;
  /** List of parameter IDs actively varied */
  sampledParameterNames: string[];
  /** Net battery energy change percentiles in kilowatt-hours (kWh) */
  netBatteryChange_kWh: PercentileStats;
  /** Net battery energy change percentiles in Joules (J) */
  netBatteryChange_J: PercentileStats;
  /** Gross electrical consumption percentiles in Wh/km */
  grossWhPerKm: PercentileStats;
  /** Net electrical consumption percentiles in Wh/km (negative = net energy surplus) */
  netWhPerKm: PercentileStats;
  /** Empirical probability of achieving net-positive battery change (0 to 1) */
  probabilityOfNetPositive: number;
  /** Sample runs (first 25 records for inspection) */
  sampleRuns: MonteCarloRunRecord[];
}

export interface CoverageSweepStep {
  /** Coverage percentage (0% to 100%) */
  coveragePct: number;
  /** Total energized coil length along corridor in meters */
  coilLengthM: number;
  /** Total energized coil length along corridor in kilometers */
  coilLengthKm: number;
  /** Net battery energy change over full trip in Joules (J) */
  netBatteryChange_J: number;
  /** Net battery energy change over full trip in kilowatt-hours (kWh) */
  netBatteryChange_kWh: number;
  /** Gross electrical energy drawn from battery per km in Wh/km */
  grossWhPerKm: number;
  /** Net energy per km in Wh/km (negative when net positive) */
  netWhPerKm: number;
  /** Dynamic wireless energy received into vehicle battery in kWh */
  roadCoil_kWh: number;
  /** Whether vehicle finishes trip with net equal or higher energy */
  isNetPositive: boolean;
}

export interface CoverageSweepOptions {
  /** Vehicle class to simulate */
  vehicleType: SupportedVehicleType;
  /** Corridor route */
  route: CorridorRoute;
  /** Step increment for sweep (e.g. 5 for 0, 5, 10 ... 100; default: 5) */
  stepPct?: number;
  /** Inductive coil transmission power in Watts (default from registry: 75,000 W) */
  coilPowerWatts?: number;
  /** Transmission coupling efficiency (default from registry: 0.80) */
  couplingEfficiency?: number;
  /** Solar irradiance in W/m² (default: 0) */
  solarIrradianceWm2?: number;
  /** Whether to include signal stops */
  includeSignals?: boolean;
  /** Whether to include junction slowdowns */
  includeJunctions?: boolean;
}

export interface CoverageSweepResult {
  vehicleType: SupportedVehicleType;
  corridorId: string;
  totalDistanceKm: number;
  /** Discrete sweep evaluation points from 0% to 100% */
  steps: CoverageSweepStep[];
  /** Whether net-positive energy is achieved at any coverage within [0%, 100%] */
  netPositiveReached: boolean;
  /** Exact interpolated crossover coverage percentage where netBatteryChange == 0 */
  crossoverCoveragePct: number | null;
  /** Corresponding coil length in kilometers required to reach net-positive */
  crossoverCoilLengthKm: number | null;
  /** Analytical summary note */
  summaryNote: string;
}
