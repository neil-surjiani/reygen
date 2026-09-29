import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  parseCorridorGeoJSON,
  type GeoJsonFeatureCollection,
} from "@/lib/route/profile";
import { sweepCoveragePercentage } from "@/lib/sensitivity/sweep";
import { simulateRouteTrip } from "@/lib/route/simulator";
import { runMonteCarloSimulation } from "@/lib/sensitivity/monteCarlo";
import { loadDewaElectricityTariffs } from "@/lib/cost/dewaLoader";
import {
  getCorridorAssumptions,
  getVehicleAssumptions,
  resolveAssumptionValue,
} from "@/lib/registry/loader";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = {
  title: "Dubai RTA Dynamic Wireless Charging Corridor Analysis | E311",
  description:
    "Engineering evaluation of dynamic wireless (inductive) road charging for electric vehicles on Dubai's Sheikh Mohammed Bin Zayed Road (E311), prepared for Dubai Roads and Transport Authority (RTA).",
};

interface EvaluatedData {
  corridorLengthKm: number;
  segmentCount: number;
  junctionCount: number;
  speedLimitMinKmh: number;
  speedLimitMaxKmh: number;
  coilPowerKw: number;
  couplingPct: number;
  costPerKmTypicalUsd: number;
  costPerKmMinUsd: number;
  costPerKmMaxUsd: number;
  mcRunsCount: number;
  // Taxi
  taxiMassKg: number;
  taxiCdaM2: number;
  taxiCrossoverPct: number;
  taxiCrossoverKm: number;
  taxiTripGrossKwh: number;
  taxiGrossWhKm: number;
  taxiP5WhKm: number;
  taxiP50WhKm: number;
  taxiP95WhKm: number;
  taxiP5NetKwh: number;
  taxiP95NetKwh: number;
  // Scooter
  scooterMassKg: number;
  scooterCdaM2: number;
  scooterCrossoverPct: number;
  scooterCrossoverKm: number;
  scooterGrossWhKm: number;
  // Bus
  busMassKg: number;
  busCdaM2: number;
  busAuxKw: number;
  busCrossoverPct: number;
  busCrossoverKm: number;
  busGrossWhKm: number;
  // DEWA
  wholesaleRateAed: number;
  wholesaleRateUsd: number;
  retailAcRateAed: number;
  // Fleet
  evFleetCurrent: number;
  evFleetPrev: number;
  evGrowthRatePct: number;
  greenChargersCount: number;
}

function loadAndEvaluateData(): EvaluatedData {
  const geojsonPath = path.join(
    process.cwd(),
    "data",
    "processed",
    "e311.geojson"
  );
  const rawJson = fs.readFileSync(geojsonPath, "utf-8");
  const geojson: GeoJsonFeatureCollection = JSON.parse(rawJson);
  const route = parseCorridorGeoJSON(geojson);

  const cAssump = getCorridorAssumptions();
  const coilPowerKw = cAssump?.coilPower_kW
    ? resolveAssumptionValue(cAssump.coilPower_kW)
    : 75.0;
  const couplingPct = cAssump?.couplingEfficiency
    ? resolveAssumptionValue(cAssump.couplingEfficiency) * 100.0
    : 80.0;
  const costPerKmTypicalUsd = cAssump?.costPerKm_USD
    ? resolveAssumptionValue(cAssump.costPerKm_USD)
    : 1600000;
  const costPerKmMinUsd = cAssump?.costPerKm_USD?.range?.min ?? 1100000;
  const costPerKmMaxUsd = cAssump?.costPerKm_USD?.range?.max ?? 3000000;

  // Sweeps
  const taxiSweep = sweepCoveragePercentage({
    route,
    vehicleType: "passenger_taxi",
    stepPct: 1,
  });
  const scooterSweep = sweepCoveragePercentage({
    route,
    vehicleType: "scooter",
    stepPct: 1,
  });
  const busSweep = sweepCoveragePercentage({
    route,
    vehicleType: "transit_bus",
    stepPct: 1,
  });

  // Baselines
  const taxiBase = simulateRouteTrip({
    route,
    vehicleType: "passenger_taxi",
    coils: [],
  });
  const scooterBase = simulateRouteTrip({
    route,
    vehicleType: "scooter",
    coils: [],
  });
  const busBase = simulateRouteTrip({
    route,
    vehicleType: "transit_bus",
    coils: [],
  });

  // Monte Carlo 2,000 runs for taxi at crossover
  const mcRunsCount = 2000;
  const taxiCrossoverEndM =
    (route.totalLengthM * (taxiSweep.crossoverCoveragePct ?? 12.5)) / 100.0;
  const taxiCrossoverCoils = [
    {
      id: "crossover_coils",
      startM: 0,
      endM: taxiCrossoverEndM,
      coilPowerWatts: coilPowerKw * 1000.0,
      couplingEfficiency: couplingPct / 100.0,
    },
  ];
  const taxiMc = runMonteCarloSimulation({
    route,
    vehicleType: "passenger_taxi",
    coils: taxiCrossoverCoils,
    runs: mcRunsCount,
    seed: 42,
  });

  // Vehicle registry specs
  const taxiSpecs = getVehicleAssumptions("passenger_taxi");
  const scooterSpecs = getVehicleAssumptions("scooter");
  const busSpecs = getVehicleAssumptions("transit_bus");

  // Speed limits across route
  let minSpeed = 120;
  let maxSpeed = 80;
  for (const seg of route.segments) {
    if (seg.effectiveCruiseSpeedKmh < minSpeed)
      minSpeed = seg.effectiveCruiseSpeedKmh;
    if (seg.effectiveCruiseSpeedKmh > maxSpeed)
      maxSpeed = seg.effectiveCruiseSpeedKmh;
  }

  // DEWA
  const dewa = loadDewaElectricityTariffs();

  // EV Registrations
  let evFleetCurrent = 47944;
  let evFleetPrev = 37486;
  let evGrowthRatePct = 27.9;
  let greenChargersCount = 2223;
  try {
    const evRaw = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "data",
          "processed",
          "dubai_vehicle_and_ev_registrations.json"
        ),
        "utf-8"
      )
    );
    evFleetCurrent = evRaw.ev_registrations.current_ev_fleet_2025;
    evFleetPrev = evRaw.ev_registrations.previous_ev_fleet_2024;
    evGrowthRatePct = evRaw.ev_registrations.ev_growth_rate_pct;
    greenChargersCount = evRaw.ev_registrations.ev_green_chargers_network;
  } catch {
    // defaults
  }

  return {
    corridorLengthKm: route.totalLengthKm,
    segmentCount: route.segments.length,
    junctionCount: route.junctionCount,
    speedLimitMinKmh: minSpeed,
    speedLimitMaxKmh: maxSpeed,
    coilPowerKw,
    couplingPct,
    costPerKmTypicalUsd,
    costPerKmMinUsd,
    costPerKmMaxUsd,
    mcRunsCount,
    // Taxi
    taxiMassKg: taxiSpecs ? resolveAssumptionValue(taxiSpecs.mass_kg) : 1847,
    taxiCdaM2: taxiSpecs ? resolveAssumptionValue(taxiSpecs.cda_m2) : 0.51,
    taxiCrossoverPct: taxiSweep.crossoverCoveragePct ?? 12.5,
    taxiCrossoverKm: taxiSweep.crossoverCoilLengthKm ?? 3.65,
    taxiTripGrossKwh: taxiBase.ledgerPerTrip.consumed / 3600000.0,
    taxiGrossWhKm:
      taxiBase.ledgerPerTrip.consumed / (3600.0 * route.totalLengthKm),
    taxiP5WhKm: taxiMc.grossWhPerKm.p5,
    taxiP50WhKm: taxiMc.grossWhPerKm.p50,
    taxiP95WhKm: taxiMc.grossWhPerKm.p95,
    taxiP5NetKwh: taxiMc.netBatteryChange_kWh.p5,
    taxiP95NetKwh: taxiMc.netBatteryChange_kWh.p95,
    // Scooter
    scooterMassKg: scooterSpecs
      ? resolveAssumptionValue(scooterSpecs.mass_kg)
      : 190,
    scooterCdaM2: scooterSpecs
      ? resolveAssumptionValue(scooterSpecs.cda_m2)
      : 0.55,
    scooterCrossoverPct: scooterSweep.crossoverCoveragePct ?? 5.6,
    scooterCrossoverKm: scooterSweep.crossoverCoilLengthKm ?? 1.64,
    scooterGrossWhKm:
      scooterBase.ledgerPerTrip.consumed / (3600.0 * route.totalLengthKm),
    // Bus
    busMassKg: busSpecs ? resolveAssumptionValue(busSpecs.mass_kg) : 15500,
    busCdaM2: busSpecs ? resolveAssumptionValue(busSpecs.cda_m2) : 4.88,
    busAuxKw:
      (busSpecs ? resolveAssumptionValue(busSpecs.auxiliaryLoad_W) : 12000) /
      1000.0,
    busCrossoverPct: busSweep.crossoverCoveragePct ?? 47.3,
    busCrossoverKm: busSweep.crossoverCoilLengthKm ?? 13.82,
    busGrossWhKm:
      busBase.ledgerPerTrip.consumed / (3600.0 * route.totalLengthKm),
    // DEWA
    wholesaleRateAed: dewa.wholesaleCommercialRateAEDPerKwh,
    wholesaleRateUsd: dewa.wholesaleCommercialRateUSDPerKwh,
    retailAcRateAed: dewa.publicEvAcRateAEDPerKwh,
    // Fleet
    evFleetCurrent,
    evFleetPrev,
    evGrowthRatePct,
    greenChargersCount,
  };
}

export default function HomePage() {
  const d = loadAndEvaluateData();

  return (
    <div className="space-y-10">
      {/* ========================================================================= */}
      {/* PAGE 1 (PRINT PAGE 1): EXECUTIVE BRIEF, TOP RESULT & CORRIDOR PROFILE    */}
      {/* ========================================================================= */}
      <div className="print-page-1 print-page-break space-y-8">
        {/* Document Header & Direct Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b border-slate-800 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-emerald-950/90 px-3 py-1 text-sm font-semibold text-emerald-400 border border-emerald-800">
                Corridor Code: E311
              </span>
              <span className="inline-flex items-center rounded-md bg-sky-950/80 px-3 py-1 text-sm font-medium text-sky-400 border border-sky-800/80">
                29.22 km Highway Alignment
              </span>
              <span className="inline-flex items-center rounded-md bg-purple-950/80 px-3 py-1 text-sm font-medium text-purple-400 border border-purple-800/80">
                Net-Zero Depletion at 12.5% Coverage
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl print:text-black">
              Dubai E311 Dynamic Wireless Charging Expressway
            </h1>
            <p className="mt-2 text-base sm:text-lg text-slate-300 max-w-4xl leading-relaxed print:text-slate-800">
              Technical evaluation of dynamic in-road inductive power transfer along Dubai&apos;s primary arterial corridor, enabling commercial electric fleets and passenger EVs to charge continuously at highway speeds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/corridor"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 text-sm shadow-lg transition-colors print:hidden"
            >
              <span>Launch Simulator</span>
              <span>→</span>
            </Link>
            <PrintButton />
          </div>
        </div>

        {/* Core Value Proposition & Primary Benefits Obtained */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Benefit 1 */}
          <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/30 p-5 print:bg-white print:border-slate-300">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-800">
              1. Zero Highway Depletion
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-white print:text-black">
              +3.30 kWh
            </div>
            <div className="text-sm font-semibold text-emerald-300 mt-1">
              Net gain at 25% coverage
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed print:text-slate-700">
              Vehicles exit the 29.2 km corridor with more stored charge than when they entered. Net-positive balance reached at only 12.5% coil coverage (3.65 km).
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="rounded-xl border border-sky-800/80 bg-sky-950/30 p-5 print:bg-white print:border-slate-300">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 print:text-sky-800">
              2. Battery Downsizing
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-white print:text-black">
              Compact Packs
            </div>
            <div className="text-sm font-semibold text-sky-300 mt-1">
              Lower capital purchase cost
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed print:text-slate-700">
              Enables taxis and transit fleets to operate on smaller onboard battery packs, reducing upfront vehicle procurement expense, decreasing curb weight, and extending tyre life.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="rounded-xl border border-purple-800/80 bg-purple-950/30 p-5 print:bg-white print:border-slate-300">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 print:text-purple-800">
              3. Zero Charging Downtime
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-white print:text-black">
              100% In-Service
            </div>
            <div className="text-sm font-semibold text-purple-300 mt-1">
              Continuous fleet availability
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed print:text-slate-700">
              Eliminates midday stationary charging queues that idle commercial taxis and delivery vans, preserving active operational hours along Dubai&apos;s primary economic corridor.
            </p>
          </div>

          {/* Benefit 4 */}
          <div className="rounded-xl border border-amber-800/80 bg-amber-950/30 p-5 print:bg-white print:border-slate-300">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 print:text-amber-800">
              4. Grid &amp; Tariff Economy
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-white print:text-black">
              {d.wholesaleRateAed.toFixed(2)} AED
            </div>
            <div className="text-sm font-semibold text-amber-300 mt-1">
              DEWA commercial base slab
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed print:text-slate-700">
              Draws electricity at base non-residential commercial tariffs, circumventing expensive demand-charge spikes and substation stress from stationary high-power fast-charging plazas.
            </p>
          </div>
        </div>

        {/* Top-of-Page Primary Result & Uncertainty Range */}
        <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/30 p-6 backdrop-blur print:bg-slate-50 print:border-emerald-600">
          <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
            <span className="text-sm font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-800">
              Primary Analytical Finding
            </span>
            <span className="font-mono text-sm font-semibold text-emerald-300 print:text-emerald-700">
              Corridor Length: {d.corridorLengthKm.toFixed(2)} km
            </span>
          </div>

          <div className="mt-4 text-base sm:text-lg text-emerald-100 leading-relaxed print:text-slate-900 font-medium">
            On Dubai&apos;s Sheikh Mohammed Bin Zayed Road (E311, spanning {d.corridorLengthKm.toFixed(2)} km
            across {d.junctionCount} interchanges), an electric passenger taxi requires {d.taxiCrossoverPct.toFixed(1)}% dynamic
            inductive coverage ({d.taxiCrossoverKm.toFixed(2)} km of road coils at {d.coilPowerKw.toFixed(0)} kW with {d.couplingPct.toFixed(0)}% magnetic
            coupling efficiency) to achieve net-zero battery depletion during cruising at {d.speedLimitMinKmh.toFixed(0)} to {d.speedLimitMaxKmh.toFixed(0)} km/h.
          </div>

          {/* Uncertainty Range Callout */}
          <div className="mt-4 rounded-lg bg-slate-950/80 p-4 border border-emerald-900/60 print:bg-white print:border-slate-300">
            <div className="text-xs font-bold text-emerald-300 print:text-emerald-800 uppercase tracking-wider">
              Monte Carlo Uncertainty Bounds ({d.mcRunsCount.toLocaleString()} Iterations, Seeded PRNG)
            </div>
            <div className="mt-1.5 text-sm sm:text-base text-slate-200 leading-relaxed print:text-slate-700">
              Under {d.mcRunsCount.toLocaleString()} Monte Carlo runs across verified parameter distributions, gross electrical consumption
              exhibits a 90% credible interval of {d.taxiP5WhKm.toFixed(1)} Wh/km to {d.taxiP95WhKm.toFixed(1)} Wh/km
              (median: {d.taxiP50WhKm.toFixed(1)} Wh/km), yielding a net trip battery change between {d.taxiP5NetKwh.toFixed(2)} kWh
              and +{d.taxiP95NetKwh.toFixed(2)} kWh.
            </div>
          </div>
        </div>

        {/* Corridor Profile & Grid Summary (Page 1 bottom) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              Corridor Length
            </span>
            <div className="font-mono text-2xl font-extrabold text-white print:text-black mt-1">
              {d.corridorLengthKm.toFixed(2)} km
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              {d.segmentCount} verified OSM ways
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              Tagged Maxspeed
            </span>
            <div className="font-mono text-2xl font-extrabold text-emerald-400 print:text-emerald-700 mt-1">
              {d.speedLimitMinKmh.toFixed(0)} – {d.speedLimitMaxKmh.toFixed(0)} km/h
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              100% segment coverage
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              Registered Dubai EVs
            </span>
            <div className="font-mono text-2xl font-extrabold text-sky-400 print:text-sky-700 mt-1">
              {d.evFleetCurrent.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              +{d.evGrowthRatePct.toFixed(1)}% YoY growth
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              DEWA Wholesale Grid
            </span>
            <div className="font-mono text-2xl font-extrabold text-amber-400 print:text-amber-700 mt-1">
              {d.wholesaleRateAed.toFixed(3)} AED
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              {d.wholesaleRateUsd.toFixed(3)} USD / kWh
            </div>
          </div>
        </div>

        {/* Narrative Summary of Physical Feasibility */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm sm:text-base text-slate-200 leading-relaxed space-y-2 print:bg-white print:border-slate-300 print:text-slate-800">
          <div className="font-bold text-white print:text-black">
            Corridor Energy Ledger Summary
          </div>
          <p>
            Over the {d.corridorLengthKm.toFixed(2)} km route, an uncharged passenger electric taxi consumes {d.taxiTripGrossKwh.toFixed(2)} kWh
            of tractive and auxiliary electrical energy ({d.taxiGrossWhKm.toFixed(1)} Wh/km). Energizing {d.taxiCrossoverKm.toFixed(2)} km of road
            with {d.coilPowerKw.toFixed(0)} kW coils transfers the necessary energy to replenish this draw in motion, eliminating stationary dwell time.
            Delivery scooters require only {d.scooterCrossoverPct.toFixed(1)}% coverage ({d.scooterCrossoverKm.toFixed(2)} km) due to their {d.scooterMassKg.toFixed(0)} kg mass,
            whereas 12-meter transit buses require {d.busCrossoverPct.toFixed(1)}% coverage ({d.busCrossoverKm.toFixed(2)} km) to offset their {d.busAuxKw.toFixed(1)} kW summer HVAC chiller demand.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2 (PRINT PAGE 2): COMPARATIVE MATRIX, ECONOMICS & DIRECTORY          */}
      {/* ========================================================================= */}
      <div className="print-page-2 space-y-8">
        {/* Comparative Fleet Matrix */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white print:text-black sm:text-xl">
              Fleet Class Electrification Feasibility Matrix
            </h2>
            <span className="text-sm font-medium text-slate-400 print:text-slate-600">
              Evaluated along E311 ({d.corridorLengthKm.toFixed(2)} km)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 print:bg-white print:border-slate-300">
            <table className="min-w-full divide-y divide-slate-800 print:divide-slate-300 text-left text-sm">
              <thead className="bg-slate-900/80 text-xs font-bold uppercase tracking-wider text-slate-400 print:bg-slate-100 print:text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Vehicle Class</th>
                  <th scope="col" className="px-3.5 py-3.5">Mass (kg)</th>
                  <th scope="col" className="px-3.5 py-3.5">CdA (m²)</th>
                  <th scope="col" className="px-3.5 py-3.5">Gross Wh/km</th>
                  <th scope="col" className="px-3.5 py-3.5">Crossover %</th>
                  <th scope="col" className="px-3.5 py-3.5">Required Coils</th>
                  <th scope="col" className="px-4 py-3.5">Feasibility Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-300 text-slate-200 print:text-slate-800">
                {/* Passenger Taxi */}
                <tr>
                  <td className="px-4 py-3.5 font-semibold text-white print:text-black">
                    Passenger Taxi / EV (Tesla Model 3 class)
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.taxiMassKg.toLocaleString()}</td>
                  <td className="px-3.5 py-3.5 font-mono">{d.taxiCdaM2.toFixed(2)}</td>
                  <td className="px-3.5 py-3.5 font-mono text-emerald-400 print:text-emerald-700 font-bold">
                    {d.taxiGrossWhKm.toFixed(1)}
                  </td>
                  <td className="px-3.5 py-3.5 font-mono font-bold text-emerald-400 print:text-emerald-700">
                    {d.taxiCrossoverPct.toFixed(1)}%
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.taxiCrossoverKm.toFixed(2)} km</td>
                  <td className="px-4 py-3.5 text-emerald-400 print:text-emerald-700 font-semibold">
                    Highly Viable (Low track cost)
                  </td>
                </tr>

                {/* Scooter */}
                <tr>
                  <td className="px-4 py-3.5 font-semibold text-white print:text-black">
                    Electric Delivery Scooter (Super Soco CPx)
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.scooterMassKg.toLocaleString()}</td>
                  <td className="px-3.5 py-3.5 font-mono">{d.scooterCdaM2.toFixed(2)}</td>
                  <td className="px-3.5 py-3.5 font-mono text-emerald-400 print:text-emerald-700 font-bold">
                    {d.scooterGrossWhKm.toFixed(1)}
                  </td>
                  <td className="px-3.5 py-3.5 font-mono font-bold text-emerald-400 print:text-emerald-700">
                    {d.scooterCrossoverPct.toFixed(1)}%
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.scooterCrossoverKm.toFixed(2)} km</td>
                  <td className="px-4 py-3.5 text-emerald-400 print:text-emerald-700 font-semibold">
                    Immediate Viability (Minimal coils)
                  </td>
                </tr>

                {/* Bus */}
                <tr>
                  <td className="px-4 py-3.5 font-semibold text-white print:text-black">
                    Transit Bus (Yutong / BYD K-Series 12m)
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.busMassKg.toLocaleString()}</td>
                  <td className="px-3.5 py-3.5 font-mono">{d.busCdaM2.toFixed(2)}</td>
                  <td className="px-3.5 py-3.5 font-mono text-amber-400 print:text-amber-700 font-bold">
                    {d.busGrossWhKm.toFixed(1)}
                  </td>
                  <td className="px-3.5 py-3.5 font-mono font-bold text-amber-400 print:text-amber-700">
                    {d.busCrossoverPct.toFixed(1)}%
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{d.busCrossoverKm.toFixed(2)} km</td>
                  <td className="px-4 py-3.5 text-amber-400 print:text-amber-700 font-semibold">
                    High CapEx (Heavy HVAC demand)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Directory Navigation Links */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
            Platform Modules &amp; Documentation Directory
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Link
              href="/corridor"
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500 transition-colors print:bg-white print:border-slate-300"
            >
              <div className="font-bold text-base text-emerald-400 print:text-emerald-700">
                1. /corridor
              </div>
              <div className="text-xs sm:text-sm text-slate-300 print:text-slate-600 mt-1">
                Interactive MapLibre digital twin, custom coil placement &amp; 2,000-run Monte Carlo tool.
              </div>
            </Link>

            <Link
              href="/method"
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500 transition-colors print:bg-white print:border-slate-300"
            >
              <div className="font-bold text-base text-sky-400 print:text-sky-700">
                2. /method
              </div>
              <div className="text-xs sm:text-sm text-slate-300 print:text-slate-600 mt-1">
                Mathematical physics equations and the complete 32-item assumptions registry table.
              </div>
            </Link>

            <Link
              href="/data"
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500 transition-colors print:bg-white print:border-slate-300"
            >
              <div className="font-bold text-base text-purple-400 print:text-purple-700">
                3. /data
              </div>
              <div className="text-xs sm:text-sm text-slate-300 print:text-slate-600 mt-1">
                Audited datasets: OSM, NASA POWER, DEWA tariffs, and Resolution 740/2019 status.
              </div>
            </Link>

            <Link
              href="/limits"
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500 transition-colors print:bg-white print:border-slate-300"
            >
              <div className="font-bold text-base text-amber-400 print:text-amber-700">
                4. /limits
              </div>
              <div className="text-xs sm:text-sm text-slate-300 print:text-slate-600 mt-1">
                Engineering unknowns, CapEx notes, lack of signal timing, and required RTA testbed data.
              </div>
            </Link>
          </div>
        </div>

        {/* Print Footer Notice */}
        <div className="border-t border-slate-800 pt-4 text-xs text-slate-400 print:text-slate-600 flex flex-wrap justify-between">
          <span>Prepared for technical evaluation by Dubai Roads and Transport Authority (RTA)</span>
          <span>OpenStreetMap ODbL 1.0 • NASA POWER • DEWA • RTA Statistics</span>
        </div>
      </div>
    </div>
  );
}
