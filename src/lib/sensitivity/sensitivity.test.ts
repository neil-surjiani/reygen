/**
 * Vitest tests for Sensitivity, Monte Carlo, and Coverage Sweep Module.
 * Strictly adheres to AGENTS.md:
 * 1. Seeded random generator ensures 100% reproducible results.
 * 2. Samples published and estimated parameters across registry ranges for >= 2,000 runs.
 * 3. Evaluates 5th, 50th, and 95th percentiles of net battery change and Wh/km.
 * 4. Sweeps coverage percentage from 0 to 100 showing net-positive crossover threshold.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseCorridorGeoJSON, type GeoJsonFeatureCollection } from "../route/profile";
import type { CoilSegmentPlacement } from "../route/types";
import { runMonteCarloSimulation } from "./monteCarlo";
import {
  computeDistributionStats,
  computePercentile,
  createSeededRandom,
  sampleTriangular,
  sampleUniform,
} from "./random";
import { sweepCoveragePercentage } from "./sweep";

const e311Path = path.resolve(__dirname, "../../../data/processed/e311.geojson");
const e311GeoJson = JSON.parse(
  fs.readFileSync(e311Path, "utf-8")
) as GeoJsonFeatureCollection;
const route = parseCorridorGeoJSON(e311GeoJson);

describe("Sensitivity and Monte Carlo Module", () => {
  // -------------------------------------------------------------------------
  // 1. Seeded Random Number Generator Tests
  // -------------------------------------------------------------------------
  it("generates deterministic, 100% reproducible random sequences given the same seed", () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(12345);

    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());

    expect(seq1).toEqual(seq2);

    // Different seed must produce different sequence
    const rng3 = createSeededRandom(99999);
    const seq3 = Array.from({ length: 100 }, () => rng3());
    expect(seq1).not.toEqual(seq3);
  });

  it("samples uniform and triangular distributions strictly within bounded ranges", () => {
    const rng = createSeededRandom(42);

    for (let i = 0; i < 500; i++) {
      const u = sampleUniform(rng, 10.0, 20.0);
      expect(u).toBeGreaterThanOrEqual(10.0);
      expect(u).toBeLessThanOrEqual(20.0);

      const t = sampleTriangular(rng, 10.0, 15.0, 20.0);
      expect(t).toBeGreaterThanOrEqual(10.0);
      expect(t).toBeLessThanOrEqual(20.0);
    }
  });

  it("correctly computes 5th, 50th, and 95th percentiles with linear interpolation", () => {
    // Array with values 1 to 100
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    const p5 = computePercentile(values, 5);
    const p50 = computePercentile(values, 50);
    const p95 = computePercentile(values, 95);

    expect(p5).toBeCloseTo(5.95, 1);
    expect(p50).toBeCloseTo(50.5, 1);
    expect(p95).toBeCloseTo(95.05, 1);

    const stats = computeDistributionStats(values);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(100);
    expect(stats.mean).toBeCloseTo(50.5, 1);
    expect(stats.p50).toBeCloseTo(50.5, 1);
  });

  // -------------------------------------------------------------------------
  // 2. Monte Carlo Simulation (>= 2,000 Runs)
  // -------------------------------------------------------------------------
  it("executes at least 2,000 Monte Carlo runs and computes reproducible 5th, 50th, 95th percentiles for a car", () => {
    const coils: CoilSegmentPlacement[] = [
      {
        id: "coil_zone_1",
        startM: 5000.0,
        endM: 10000.0,
        coilPowerWatts: 75000.0,
        couplingEfficiency: 0.80,
      },
    ];

    const result1 = runMonteCarloSimulation({
      vehicleType: "passenger_taxi",
      route,
      coils,
      runs: 2000,
      seed: 42,
      distribution: "triangular",
    });

    // Enforce runs >= 2,000
    expect(result1.runs).toBe(2000);
    expect(result1.sampledParametersCount).toBeGreaterThanOrEqual(10);
    expect(result1.sampledParameterNames).toContain("taxi_mass");
    expect(result1.sampledParameterNames).toContain("taxi_crr");
    expect(result1.sampledParameterNames).toContain("taxi_cda");
    expect(result1.sampledParameterNames).toContain("corridor_coil_power");
    expect(result1.sampledParameterNames).toContain("corridor_coupling_efficiency");

    // Monotonic percentiles: p5 <= p50 <= p95
    expect(result1.netBatteryChange_kWh.p5).toBeLessThanOrEqual(
      result1.netBatteryChange_kWh.p50
    );
    expect(result1.netBatteryChange_kWh.p50).toBeLessThanOrEqual(
      result1.netBatteryChange_kWh.p95
    );

    expect(result1.grossWhPerKm.p5).toBeLessThanOrEqual(
      result1.grossWhPerKm.p50
    );
    expect(result1.grossWhPerKm.p50).toBeLessThanOrEqual(
      result1.grossWhPerKm.p95
    );

    // Exact reproducibility check: identical seed produces identical results
    const result2 = runMonteCarloSimulation({
      vehicleType: "passenger_taxi",
      route,
      coils,
      runs: 2000,
      seed: 42,
      distribution: "triangular",
    });

    expect(result1.netBatteryChange_kWh.p50).toBe(
      result2.netBatteryChange_kWh.p50
    );
    expect(result1.netBatteryChange_kWh.p5).toBe(
      result2.netBatteryChange_kWh.p5
    );
    expect(result1.netBatteryChange_kWh.p95).toBe(
      result2.netBatteryChange_kWh.p95
    );
    expect(result1.grossWhPerKm.p50).toBe(result2.grossWhPerKm.p50);
  });

  it("executes Monte Carlo simulation for an electric scooter across 2,000 runs", () => {
    const result = runMonteCarloSimulation({
      vehicleType: "scooter",
      route,
      coils: [], // Uncharged baseline
      runs: 2000,
      seed: 101,
      distribution: "triangular",
    });

    expect(result.runs).toBe(2000);
    expect(result.sampledParameterNames).toContain("scooter_mass");
    expect(result.sampledParameterNames).toContain("scooter_crr");
    expect(result.sampledParameterNames).toContain("scooter_cda");

    // Without coils, net battery change is strictly negative
    expect(result.netBatteryChange_kWh.p95).toBeLessThan(0);
    expect(result.probabilityOfNetPositive).toBe(0);

    // Scooter consumption is much lower than car (typical ~50-70 Wh/km)
    expect(result.grossWhPerKm.p50).toBeGreaterThan(30);
    expect(result.grossWhPerKm.p50).toBeLessThan(120);
  });

  // -------------------------------------------------------------------------
  // 3. Coverage Percentage Sweep (0% to 100%)
  // -------------------------------------------------------------------------
  it("sweeps coverage percentage from 0% to 100% and solves exact net-positive crossover for a car", () => {
    const sweep = sweepCoveragePercentage({
      vehicleType: "passenger_taxi",
      route,
      stepPct: 5,
      coilPowerWatts: 75000.0,
      couplingEfficiency: 0.80,
    });

    expect(sweep.steps.length).toBeGreaterThanOrEqual(21);
    expect(sweep.steps[0].coveragePct).toBe(0);
    expect(sweep.steps[sweep.steps.length - 1].coveragePct).toBe(100);

    // At 0% coverage, vehicle is net consumer (negative battery change)
    expect(sweep.steps[0].isNetPositive).toBe(false);
    expect(sweep.steps[0].netBatteryChange_kWh).toBeLessThan(0);

    // At 100% coverage, vehicle is significantly net positive
    expect(sweep.steps[sweep.steps.length - 1].isNetPositive).toBe(true);
    expect(sweep.steps[sweep.steps.length - 1].netBatteryChange_kWh).toBeGreaterThan(0);

    // Crossover is reached
    expect(sweep.netPositiveReached).toBe(true);
    expect(sweep.crossoverCoveragePct).not.toBeNull();
    // For a car on E311, crossover occurs at ~12.5% coverage (~3.65 km of electrified roadway)
    expect(sweep.crossoverCoveragePct!).toBeGreaterThan(10);
    expect(sweep.crossoverCoveragePct!).toBeLessThan(20);
    expect(sweep.crossoverCoilLengthKm!).toBeGreaterThan(3);
    expect(sweep.crossoverCoilLengthKm!).toBeLessThan(6);
    expect(sweep.summaryNote).toContain("Net-positive energy balance is reached");
  });

  it("sweeps coverage percentage for an electric scooter and demonstrates lower crossover threshold", () => {
    const sweep = sweepCoveragePercentage({
      vehicleType: "scooter",
      route,
      stepPct: 5,
      coilPowerWatts: 75000.0,
      couplingEfficiency: 0.80,
    });

    expect(sweep.netPositiveReached).toBe(true);
    expect(sweep.crossoverCoveragePct).not.toBeNull();

    // A scooter consumes much less energy, so it reaches net-positive at a lower coverage % than a car
    expect(sweep.crossoverCoveragePct!).toBeGreaterThan(2);
    expect(sweep.crossoverCoveragePct!).toBeLessThan(15);
  });
});
