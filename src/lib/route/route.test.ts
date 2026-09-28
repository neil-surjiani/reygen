/**
 * Vitest tests for the Route Simulation Module.
 * Strictly adheres to AGENTS.md:
 * 1. A route with no signals and no coils must match the constant-speed hand calculation.
 * 2. Total distance must match the GeoJSON length.
 * 3. Shows full arithmetic in comments.
 * 4. Verifies simulation for both electric car and scooter with user-defined coils.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  parseCorridorGeoJSON,
  type GeoJsonFeatureCollection,
} from "./profile";
import { simulateRouteTrip } from "./simulator";
import type { CoilSegmentPlacement, CorridorRoute } from "./types";

const e311Path = path.resolve(__dirname, "../../../data/processed/e311.geojson");
const e311GeoJson = JSON.parse(
  fs.readFileSync(e311Path, "utf-8")
) as GeoJsonFeatureCollection;

describe("Route Simulation Module", () => {
  // -------------------------------------------------------------------------
  // Hand-Calculated Constant Speed Route Benchmark
  // -------------------------------------------------------------------------
  // Synthetic Flat Route:
  // - Total distance L = 10,000.0 m (10 km)
  // - Cruise speed v = 100 km/h = 100 / 3.6 = 27.77777777777778 m/s
  // - Headwind = 0 m/s, Grade theta = 0 rad, Solar irradiance = 0 W/m²
  // - Traffic signals = 0, Motorway junctions = 0, Coils = 0
  //
  // Vehicle 1: Passenger Car (passenger_taxi)
  // - Mass m = 1847 kg
  // - g = 9.81 m/s² (GRAVITATIONAL_ACCELERATION from physics module)
  // - Crr = 0.0088
  // - CdA = 0.5106 m²
  // - Air density rho = 1.184 kg/m³
  // - Motor efficiency eta = 0.92
  // - Auxiliary load P_aux = 2000 W
  //
  // Step-by-step arithmetic:
  // 1. Rolling resistance force:
  //    F_roll = m * g * Crr = 1847 * 9.81 * 0.0088 = 159.447816 N
  // 2. Aerodynamic drag force:
  //    F_aero = 0.5 * rho * CdA * v^2
  //           = 0.5 * 1.184 * 0.5106 * (27.77777777777778)^2
  //           = 0.3022752 * 771.60493827 = 233.237033 N
  // 3. Total tractive force:
  //    F_tractive = F_roll + F_aero = 159.447816 + 233.237033 = 392.684849 N
  // 4. Wheel mechanical energy over 10,000 m:
  //    E_wheel = F_tractive * 10000 = 3,926,848.49 J
  //    - Rolling loss = 159.447816 * 10000 = 1,594,478.16 J
  //    - Aero loss = 233.237033 * 10000 = 2,332,370.33 J
  // 5. Motor electrical energy consumed:
  //    E_motor = E_wheel / eta = 3,926,848.49 / 0.92 = 4,268,313.576 J
  //    - Drivetrain loss = E_motor - E_wheel = 4,268,313.576 - 3,926,848.49 = 341,465.086 J
  // 6. Time duration:
  //    t = L / v = 10000 / (100 / 3.6) = 360.0 s
  // 7. Auxiliary energy:
  //    E_aux = P_aux * t = 2000 * 360.0 = 720,000.0 J
  // 8. Total consumed energy:
  //    E_total = E_motor + E_aux = 4,268,313.576 + 720,000 = 4,988,313.576 J
  //    (or 1.38564 kWh total; 138.56 Wh/km)
  // 9. Net battery change = -4,988,313.576 J
  // -------------------------------------------------------------------------
  it("matches the hand-calculated flat route constant-speed energy benchmark for a car within 0.1%", () => {
    const syntheticCarRoute: CorridorRoute = {
      corridorId: "benchmark_flat_10km",
      name: "Synthetic 10km Constant-Speed Route",
      totalLengthM: 10000.0,
      totalLengthKm: 10.0,
      junctionCount: 0,
      trafficSignalCount: 0,
      allJunctions: [],
      allTrafficSignals: [],
      segments: [
        {
          id: "seg_1",
          osmId: 1,
          name: "Segment 1",
          nameEn: "Segment 1",
          ref: null,
          highwayType: "motorway",
          lengthM: 10000.0,
          taggedSpeedLimitKmh: 100.0,
          effectiveCruiseSpeedKmh: 100.0,
          effectiveCruiseSpeedMps: 100.0 / 3.6,
          lanes: 4,
          startDistanceM: 0,
          endDistanceM: 10000.0,
          coordinates: [
            [55.30, 25.10],
            [55.40, 25.10],
          ],
          junctions: [],
          trafficSignals: [],
        },
      ],
    };

    const result = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route: syntheticCarRoute,
      solarIrradianceWm2: 0, // Night / solar turned off
      includeSignals: false,
      includeJunctions: false,
      coils: [], // No coils
    });

    // 1. Distance check
    expect(result.totalDistanceM).toBeCloseTo(10000.0, 1);
    expect(result.totalDistanceKm).toBeCloseTo(10.0, 3);
    expect(result.totalDurationS).toBeCloseTo(360.0, 1);

    // 2. Physical force and energy breakdown checks against hand calculations
    const ledger = result.ledgerPerTrip;

    // Rolling loss: 1,594,478 J
    expect(ledger.rollingLoss).toBeCloseTo(1594478.2, 0);

    // Aerodynamic drag loss: 2,332,370 J
    expect(ledger.aeroLoss).toBeCloseTo(2332370.3, 0);

    // Drivetrain loss: 341,465 J
    expect(ledger.drivetrainLoss).toBeCloseTo(341465.1, 0);

    // Auxiliary energy: 720,000 J
    const auxEnergy =
      ledger.consumed -
      (ledger.rollingLoss + ledger.aeroLoss + ledger.drivetrainLoss);
    expect(auxEnergy).toBeCloseTo(720000.0, 0);

    // Total consumed: 4,988,314 J
    expect(ledger.consumed).toBeCloseTo(4988313.6, 0);

    // Net battery change: -4,988,314 J
    expect(ledger.netBatteryChange).toBeCloseTo(-4988313.6, 0);

    // Per-km ledger check
    const perKm = result.ledgerPerKm;
    expect(perKm.consumed).toBeCloseTo(498831.4, 0);
    expect(perKm.rollingLoss).toBeCloseTo(159447.8, 0);
    expect(perKm.aeroLoss).toBeCloseTo(233237.0, 0);
  });

  // -------------------------------------------------------------------------
  // Hand-Calculated Constant Speed Route Benchmark for Scooter
  // -------------------------------------------------------------------------
  // Scooter parameters:
  // - Mass m = 190 kg
  // - Crr = 0.015
  // - CdA = 0.55 m²
  // - Cruise speed v = 60 km/h = 16.666667 m/s
  // - Air density rho = 1.184 kg/m³
  // - Motor efficiency eta = 0.85
  // - Auxiliary load P_aux = 45 W
  // - L = 10,000 m
  //
  // Arithmetic:
  // 1. F_roll = 190 * 9.81 * 0.015 = 27.9585 N
  //    Rolling loss = 27.9585 * 10000 = 279,585.0 J
  // 2. F_aero = 0.5 * 1.184 * 0.55 * (16.666667)^2 = 90.444445 N
  //    Aero loss = 90.444445 * 10000 = 904,444.4 J
  // 3. Wheel work = F_tractive * 10000 = 1,184,029.45 J
  // 4. Motor energy = 1,184,029.45 / 0.85 = 1,392,975.82 J
  // 5. Drivetrain loss = 1,392,975.82 - 1,184,029.45 = 208,946.37 J
  // 6. Time t = 10000 / 16.666667 = 600.0 s
  // 7. Aux energy = 45 * 600 = 27,000 J
  // 8. Total consumed = 1,392,975.82 + 27,000 = 1,419,975.82 J
  // -------------------------------------------------------------------------
  it("matches the hand-calculated flat route constant-speed energy benchmark for a scooter within 0.1%", () => {
    const syntheticScooterRoute: CorridorRoute = {
      corridorId: "scooter_benchmark_10km",
      name: "Synthetic 10km Scooter Route",
      totalLengthM: 10000.0,
      totalLengthKm: 10.0,
      junctionCount: 0,
      trafficSignalCount: 0,
      allJunctions: [],
      allTrafficSignals: [],
      segments: [
        {
          id: "seg_scooter_1",
          osmId: 2,
          name: "Urban Corridor",
          nameEn: "Urban Corridor",
          ref: null,
          highwayType: "primary",
          lengthM: 10000.0,
          taggedSpeedLimitKmh: 60.0,
          effectiveCruiseSpeedKmh: 60.0,
          effectiveCruiseSpeedMps: 60.0 / 3.6,
          lanes: 2,
          startDistanceM: 0,
          endDistanceM: 10000.0,
          coordinates: [
            [55.30, 25.10],
            [55.40, 25.10],
          ],
          junctions: [],
          trafficSignals: [],
        },
      ],
    };

    const result = simulateRouteTrip({
      vehicleType: "scooter",
      route: syntheticScooterRoute,
      solarIrradianceWm2: 0,
      includeSignals: false,
      includeJunctions: false,
      coils: [],
    });

    expect(result.totalDistanceM).toBeCloseTo(10000.0, 1);
    expect(result.totalDurationS).toBeCloseTo(600.0, 1);

    const ledger = result.ledgerPerTrip;
    expect(ledger.rollingLoss).toBeCloseTo(279585.0, 0);
    expect(ledger.aeroLoss).toBeCloseTo(904444.4, 0);
    expect(ledger.drivetrainLoss).toBeCloseTo(208946.4, 0);
    const auxEnergy =
      ledger.consumed -
      (ledger.rollingLoss + ledger.aeroLoss + ledger.drivetrainLoss);
    expect(auxEnergy).toBeCloseTo(27000.0, 0);
    expect(ledger.consumed).toBeCloseTo(1419975.8, 0);
    expect(ledger.netBatteryChange).toBeCloseTo(-1419975.8, 0);
  });

  // -------------------------------------------------------------------------
  // Real Dubai Corridor (E311) Validation
  // -------------------------------------------------------------------------
  it("parses the real Dubai E311 corridor GeoJSON and preserves exact road distance", () => {
    const route = parseCorridorGeoJSON(e311GeoJson);

    expect(route.corridorId).toBe("E311");
    expect(route.segments.length).toBe(14);
    expect(route.junctionCount).toBe(12);

    // Verify distance strictly matches the metadata length (29.217 km)
    const expectedLengthKm = e311GeoJson.metadata?.statistics?.totalLengthKm;
    expect(route.totalLengthKm).toBeCloseTo(expectedLengthKm!, 2);

    // Verify sum of segments matches total
    const sumSegments = route.segments.reduce((acc, s) => acc + s.lengthM, 0);
    expect(route.totalLengthM).toBeCloseTo(sumSegments, 1);
  });

  it("simulates the full Dubai E311 corridor for both car and scooter with exact distance conservation", () => {
    const route = parseCorridorGeoJSON(e311GeoJson);

    // 1. Car trip simulation
    const carResult = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route,
      solarIrradianceWm2: 0,
      includeJunctions: true,
      includeSignals: true,
    });

    // Total distance strictly conserved
    expect(carResult.totalDistanceM).toBeCloseTo(route.totalLengthM, 1);
    expect(carResult.totalDistanceKm).toBeCloseTo(route.totalLengthKm, 2);
    expect(carResult.ledgerPerTrip.consumed).toBeGreaterThan(0);
    expect(carResult.ledgerPerKm.consumed).toBeGreaterThan(0);
    expect(carResult.averageSpeedKmh).toBeGreaterThan(60);

    // 2. Scooter trip simulation
    const scooterResult = simulateRouteTrip({
      vehicleType: "scooter",
      route,
      solarIrradianceWm2: 0,
      includeJunctions: true,
      includeSignals: true,
    });

    expect(scooterResult.totalDistanceM).toBeCloseTo(route.totalLengthM, 1);
    expect(scooterResult.totalDistanceKm).toBeCloseTo(route.totalLengthKm, 2);
    expect(scooterResult.ledgerPerTrip.consumed).toBeGreaterThan(0);
    // A scooter consumes significantly less energy than a 1,847 kg car
    expect(scooterResult.ledgerPerTrip.consumed).toBeLessThan(
      carResult.ledgerPerTrip.consumed
    );
  });

  // -------------------------------------------------------------------------
  // Dynamic Wireless Charging Coil Placement Tests
  // -------------------------------------------------------------------------
  it("delivers dynamic wireless power only along user-defined coil intervals", () => {
    const route = parseCorridorGeoJSON(e311GeoJson);

    // Place a 5 km coil segment between 10,000m and 15,000m
    const coils: CoilSegmentPlacement[] = [
      {
        id: "coil_zone_1",
        startM: 10000.0,
        endM: 15000.0,
        coilPowerWatts: 75000.0, // 75 kW nominal
        couplingEfficiency: 0.80, // 80% coupling
      },
    ];

    const unchargedTrip = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route,
      solarIrradianceWm2: 0,
      coils: [],
    });

    const chargedTrip = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route,
      solarIrradianceWm2: 0,
      coils,
    });

    // Distance and travel duration remain identical
    expect(chargedTrip.totalDistanceM).toBeCloseTo(unchargedTrip.totalDistanceM, 1);
    expect(chargedTrip.totalDurationS).toBeCloseTo(unchargedTrip.totalDurationS, 1);

    // Road coil energy received must be positive
    expect(chargedTrip.ledgerPerTrip.roadCoil).toBeGreaterThan(0);
    expect(unchargedTrip.ledgerPerTrip.roadCoil).toBe(0);

    // Net battery change with coils is much less negative (or positive) than without coils
    expect(chargedTrip.ledgerPerTrip.netBatteryChange).toBeGreaterThan(
      unchargedTrip.ledgerPerTrip.netBatteryChange
    );

    // Check coil coverage summary
    expect(chargedTrip.coilsSummary.totalCoilLengthM).toBe(5000.0);
    expect(chargedTrip.coilsSummary.coveragePct).toBeCloseTo(
      (5000.0 / route.totalLengthM) * 100.0,
      1
    );
  });

  it("computes comprehensive per-trip and per-km ledgers for car and scooter on Dubai E311 with user-defined coils", () => {
    const route = parseCorridorGeoJSON(e311GeoJson);

    // User-defined coil placement: two 5 km segments
    const userCoils: CoilSegmentPlacement[] = [
      {
        id: "coil_zone_1",
        startM: 5000.0,
        endM: 10000.0,
        coilPowerWatts: 75000.0, // 75 kW
        couplingEfficiency: 0.80, // 80%
      },
      {
        id: "coil_zone_2",
        startM: 18000.0,
        endM: 23000.0,
        coilPowerWatts: 75000.0,
        couplingEfficiency: 0.80,
      },
    ];

    // Simulate Passenger Taxi
    const carSim = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route,
      coils: userCoils,
      includeJunctions: true,
      includeSignals: true,
    });

    // Simulate Electric Scooter
    const scooterSim = simulateRouteTrip({
      vehicleType: "scooter",
      route,
      coils: userCoils,
      includeJunctions: true,
      includeSignals: true,
    });

    expect(carSim.totalDistanceM).toBeCloseTo(29217.0, 0);
    expect(scooterSim.totalDistanceM).toBeCloseTo(29217.0, 0);

    expect(carSim.ledgerPerTrip.consumed).toBeGreaterThan(0);
    expect(carSim.ledgerPerTrip.roadCoil).toBeGreaterThan(0);
    expect(carSim.ledgerPerKm.consumed).toBeGreaterThan(0);
    expect(carSim.ledgerPerKm.roadCoil).toBeGreaterThan(0);

    expect(scooterSim.ledgerPerTrip.consumed).toBeGreaterThan(0);
    expect(scooterSim.ledgerPerTrip.roadCoil).toBeGreaterThan(0);
    expect(scooterSim.ledgerPerKm.consumed).toBeGreaterThan(0);
    expect(scooterSim.ledgerPerKm.roadCoil).toBeGreaterThan(0);

    // Scooter consumption per km is much smaller than passenger car
    expect(scooterSim.ledgerPerKm.consumed).toBeLessThan(carSim.ledgerPerKm.consumed);
  });

  // -------------------------------------------------------------------------
  // Traffic Signal Assumption Tests
  // -------------------------------------------------------------------------
  it("models traffic signal stop delay as an explicit registered assumption", () => {
    // Synthetic urban route with 2 traffic signals
    const urbanRouteWithSignals: CorridorRoute = {
      corridorId: "urban_route_signals",
      name: "Urban Route with Signals",
      totalLengthM: 2000.0,
      totalLengthKm: 2.0,
      junctionCount: 0,
      trafficSignalCount: 2,
      allJunctions: [],
      allTrafficSignals: [
        {
          id: "sig_1",
          name: "Signal 1",
          coordinates: [55.35, 25.12],
          distanceAlongRouteM: 500.0,
        },
        {
          id: "sig_2",
          name: "Signal 2",
          coordinates: [55.36, 25.13],
          distanceAlongRouteM: 1500.0,
        },
      ],
      segments: [
        {
          id: "seg_sig_1",
          osmId: 101,
          name: "Urban Way 1",
          nameEn: "Urban Way 1",
          ref: null,
          highwayType: "primary",
          lengthM: 1000.0,
          taggedSpeedLimitKmh: 60.0,
          effectiveCruiseSpeedKmh: 60.0,
          effectiveCruiseSpeedMps: 60.0 / 3.6,
          lanes: 3,
          startDistanceM: 0,
          endDistanceM: 1000.0,
          coordinates: [
            [55.35, 25.12],
            [55.36, 25.125],
          ],
          junctions: [],
          trafficSignals: [
            {
              id: "sig_1",
              name: "Signal 1",
              coordinates: [55.35, 25.12],
              distanceAlongRouteM: 500.0,
            },
          ],
        },
        {
          id: "seg_sig_2",
          osmId: 102,
          name: "Urban Way 2",
          nameEn: "Urban Way 2",
          ref: null,
          highwayType: "primary",
          lengthM: 1000.0,
          taggedSpeedLimitKmh: 60.0,
          effectiveCruiseSpeedKmh: 60.0,
          effectiveCruiseSpeedMps: 60.0 / 3.6,
          lanes: 3,
          startDistanceM: 1000.0,
          endDistanceM: 2000.0,
          coordinates: [
            [55.36, 25.125],
            [55.37, 25.13],
          ],
          junctions: [],
          trafficSignals: [
            {
              id: "sig_2",
              name: "Signal 2",
              coordinates: [55.36, 25.13],
              distanceAlongRouteM: 1500.0,
            },
          ],
        },
      ],
    };

    // Run without signals
    const noSignalTrip = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route: urbanRouteWithSignals,
      includeSignals: false,
    });

    // Run with registered signal assumption (prob = 0.5, wait = 30s)
    const signalTrip = simulateRouteTrip({
      vehicleType: "passenger_taxi",
      route: urbanRouteWithSignals,
      includeSignals: true,
      signalStopProbability: 0.5,
      signalAverageWait_s: 30.0,
    });

    // Total distance is strictly conserved
    expect(signalTrip.totalDistanceM).toBeCloseTo(urbanRouteWithSignals.totalLengthM, 1);
    expect(noSignalTrip.totalDistanceM).toBeCloseTo(urbanRouteWithSignals.totalLengthM, 1);

    // Duration is strictly higher with signals due to deceleration, dwell, and acceleration
    expect(signalTrip.totalDurationS).toBeGreaterThan(noSignalTrip.totalDurationS);

    // Stopped duration must reflect 2 signals * 0.5 probability * 30s = 30s
    expect(signalTrip.speedProfile.stoppedDurationS).toBeCloseTo(30.0, 1);

    // Auxiliary energy consumed is higher because vehicle spent extra time waiting at signals
    expect(signalTrip.ledgerPerTrip.consumed).toBeGreaterThan(
      noSignalTrip.ledgerPerTrip.consumed
    );

    // Verify assumption metadata note is present
    expect(signalTrip.assumptionsUsed.signalAssumptionNote).toBeDefined();
    expect(signalTrip.assumptionsUsed.signalStopProbability).toBe(0.5);
    expect(signalTrip.assumptionsUsed.signalAverageWait_s).toBe(30.0);
  });
});
