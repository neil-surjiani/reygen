"use client";

import React, { useState, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { SupportedVehicleType } from "@/lib/registry/loader";
import type {
  CoilSegmentPlacement,
  CorridorRoute,
  RouteSimulationResult,
} from "@/lib/route/types";
import { simulateRouteTrip } from "@/lib/route/simulator";
import { sweepCoveragePercentage } from "@/lib/sensitivity/sweep";
import { runMonteCarloSimulation } from "@/lib/sensitivity/monteCarlo";
import { calculateCorridorCost } from "@/lib/cost/cost";
import { CorridorControls, type RegistryOverrides } from "./CorridorControls";
import { CorridorResults } from "./CorridorResults";
import type { ActiveCoilZone } from "./CorridorMap";

// Client-only dynamic import of MapLibre vector map component
const CorridorMap = dynamic(() => import("./CorridorMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[480px] w-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-400"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
      <p className="text-sm font-medium text-slate-300">
        Loading MapLibre Vector Map Engine...
      </p>
      <p className="text-xs text-slate-500 mt-1">
        Rendering Dubai E311 Corridor, junctions & inductive coil overlays
      </p>
    </div>
  ),
});

const INITIAL_ZONES: ActiveCoilZone[] = [
  {
    id: "zone-1",
    name: "Zone 1: Northern Approach (Sharjah Border to Academic City)",
    startKm: 0.0,
    endKm: 7.0,
    active: false,
  },
  {
    id: "zone-2",
    name: "Zone 2: Dubai Silicon Oasis Core",
    startKm: 7.0,
    endKm: 15.0,
    active: false,
  },
  {
    id: "zone-3",
    name: "Zone 3: Central Arterial (DSO to City of Arabia)",
    startKm: 15.0,
    endKm: 22.0,
    active: false,
  },
  {
    id: "zone-4",
    name: "Zone 4: Southern Arterial (City of Arabia to Al Yalayis)",
    startKm: 22.0,
    endKm: 29.2,
    active: false,
  },
];

const emptySubscribe = () => () => {};

interface CorridorExplorerProps {
  route: CorridorRoute;
}

export function CorridorExplorer({ route }: CorridorExplorerProps) {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // 1. Interactive Control States
  const [vehicleType, setVehicleType] =
    useState<SupportedVehicleType>("passenger_taxi");
  const [coveragePct, setCoveragePct] = useState<number>(25);
  const [activeZones, setActiveZones] =
    useState<ActiveCoilZone[]>(INITIAL_ZONES);
  const [enableSignalPads, setEnableSignalPads] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<RegistryOverrides>({});
  const [scenarioVehiclesPerDay, setScenarioVehiclesPerDay] = useState<
    number | undefined
  >(undefined);

  // 2. Zone & Coverage Handlers
  const handleToggleZone = (zoneId: string) => {
    setActiveZones((prev) => {
      const updated = prev.map((z) =>
        z.id === zoneId ? { ...z, active: !z.active } : z
      );
      const activeLengthKm = updated
        .filter((z) => z.active)
        .reduce((sum, z) => sum + (z.endKm - z.startKm), 0);

      if (updated.some((z) => z.active)) {
        setCoveragePct(
          Math.min(
            100,
            Math.round((activeLengthKm / route.totalLengthKm) * 100)
          )
        );
      } else {
        setCoveragePct(0);
      }
      return updated;
    });
  };

  const handleCoverageChange = (newPct: number) => {
    setCoveragePct(newPct);
    // When using continuous coverage slider, clear discrete zone selections
    setActiveZones((prev) => prev.map((z) => ({ ...z, active: false })));
  };

  const handleOverrideChange = (key: keyof RegistryOverrides, val: number) => {
    setOverrides((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetOverrides = () => {
    setOverrides({});
  };

  // 3. Coil Segments Placement Construction
  const coils: CoilSegmentPlacement[] = useMemo(() => {
    const activePresetZones = activeZones.filter((z) => z.active);
    const coilPowerWatts = (overrides.coilPowerKw ?? 75) * 1000.0;
    const couplingEfficiency = overrides.couplingEfficiency ?? 0.8;

    const result: CoilSegmentPlacement[] = [];

    if (activePresetZones.length > 0) {
      for (const z of activePresetZones) {
        result.push({
          id: z.id,
          startM: z.startKm * 1000.0,
          endM: Math.min(route.totalLengthM, z.endKm * 1000.0),
          coilPowerWatts,
          couplingEfficiency,
        });
      }
    } else if (coveragePct > 0) {
      const coilEndM = (route.totalLengthM * coveragePct) / 100.0;
      result.push({
        id: "continuous_coils",
        startM: 0,
        endM: coilEndM,
        coilPowerWatts,
        couplingEfficiency,
      });
    }

    if (enableSignalPads) {
      // Add stationary 50 kW induction pads at key interchange ramps & dwell nodes
      const sampleJunctions = route.allJunctions.slice(0, 6);
      sampleJunctions.forEach((j, i) => {
        result.push({
          id: `signal_pad_${i + 1}`,
          startM: Math.max(0, j.distanceAlongRouteM - 25),
          endM: Math.min(route.totalLengthM, j.distanceAlongRouteM + 25),
          coilPowerWatts: 50000.0,
          couplingEfficiency: 0.85,
        });
      });
    }

    return result;
  }, [
    activeZones,
    coveragePct,
    enableSignalPads,
    overrides.coilPowerKw,
    overrides.couplingEfficiency,
    route.totalLengthM,
    route.allJunctions,
  ]);

  // 4. Coverage Sweep to find exact net-positive crossover
  const sweepResult = useMemo(() => {
    return sweepCoveragePercentage({
      route,
      vehicleType,
      coilPowerWatts: (overrides.coilPowerKw ?? 75) * 1000.0,
      couplingEfficiency: overrides.couplingEfficiency ?? 0.8,
      stepPct: 1,
    });
  }, [route, vehicleType, overrides.coilPowerKw, overrides.couplingEfficiency]);

  const crossoverCoveragePct = sweepResult.crossoverCoveragePct;
  const crossoverCoilLengthKm = sweepResult.crossoverCoilLengthKm;

  // 5. High-fidelity Deterministic Route Simulation
  const simulation: RouteSimulationResult = useMemo(() => {
    return simulateRouteTrip({
      route,
      vehicleType,
      coils,
      solarIrradianceWm2: overrides.solarIrradianceWm2,
      vehicleOverrides: {
        ...(overrides.massKg !== undefined && { mass: overrides.massKg }),
        ...(overrides.crr !== undefined && { crr: overrides.crr }),
        ...(overrides.cdaM2 !== undefined && { cdA: overrides.cdaM2 }),
        ...(overrides.motorEfficiency !== undefined && { driveEfficiency: overrides.motorEfficiency }),
        ...(overrides.regenEfficiency !== undefined && { regenEfficiency: overrides.regenEfficiency }),
        ...(overrides.auxWatts !== undefined && { auxWatts: overrides.auxWatts }),
      },
      environmentOverrides: {
        ...(overrides.airDensity !== undefined && { airDensity: overrides.airDensity }),
      },
    });
  }, [route, vehicleType, coils, overrides]);

  // 6. Monte Carlo Uncertainty Analysis (2,000 runs, seeded PRNG)
  const monteCarlo = useMemo(() => {
    return runMonteCarloSimulation({
      route,
      vehicleType,
      coils,
      runs: 2000,
      seed: 42,
    });
  }, [route, vehicleType, coils]);

  // 7. Capital Expenditure & Payback Calculation
  const cost = useMemo(() => {
    const tripGrossKwh = simulation.ledgerPerTrip.consumed / 3600000.0;
    return calculateCorridorCost({
      corridorId: route.corridorId,
      corridorLengthKm: route.totalLengthKm,
      coveragePct,
      scenarioVehiclesPerDay,
      energyDeliveredPerTripKwh: tripGrossKwh,
    });
  }, [
    route.corridorId,
    route.totalLengthKm,
    coveragePct,
    scenarioVehiclesPerDay,
    simulation.ledgerPerTrip.consumed,
  ]);

  if (!isMounted) {
    return (
      <div className="flex h-96 w-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
        <p className="text-sm font-medium text-slate-300">
          Initializing Digital Twin & Physics Engine...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Loading verified corridor geometry and assumptions registry
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Corridor Header Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Corridor Route
          </span>
          <div className="font-mono text-base font-bold text-sky-400 truncate">
            {route.name}
          </div>
          <div className="text-[11px] text-slate-500">
            Expressway Highway E311
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Length
          </span>
          <div className="font-mono text-base font-bold text-white">
            {route.totalLengthKm.toFixed(2)} km
          </div>
          <div className="text-[11px] text-slate-500">
            14 verified OSM LineStrings
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Speed Limits
          </span>
          <div className="font-mono text-base font-bold text-emerald-400">
            100 – 110 km/h
          </div>
          <div className="text-[11px] text-slate-500">
            100% tagged OSM maxspeed
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Interchanges
          </span>
          <div className="font-mono text-base font-bold text-amber-400">
            {route.junctionCount} Nodes
          </div>
          <div className="text-[11px] text-slate-500">
            Click map junctions for exits
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Interactive Controls & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <CorridorControls
            vehicleType={vehicleType}
            onVehicleChange={setVehicleType}
            coveragePct={coveragePct}
            onCoverageChange={handleCoverageChange}
            crossoverCoveragePct={crossoverCoveragePct}
            activeZones={activeZones}
            onToggleZone={handleToggleZone}
            enableSignalPads={enableSignalPads}
            onToggleSignalPads={setEnableSignalPads}
            overrides={overrides}
            onOverrideChange={handleOverrideChange}
            onResetOverrides={handleResetOverrides}
          />

          {/* Methodological Context Note */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-xs text-slate-400 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>📋</span>
              <span>RTA Dubai Evaluation Protocol</span>
            </div>
            <p>
              In accordance with AGENTS.md, all vehicle physics, air densities,
              induction transfer efficiencies, and capital costs are strictly
              grounded in published technical standards and verified datasheets.
            </p>
            <p className="text-[11px] text-slate-500">
              Corridor traffic volumes remain classified under Dubai RTA
              Administrative Resolution No. 740 of 2019. Payback estimates
              default to &ldquo;insufficient data&rdquo; unless an exploratory
              scenario is entered.
            </p>
          </div>
        </div>

        {/* Right Column: Map & Results Analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Map Section */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Corridor Geographic Alignment & Inductive Coil Layer
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Coils:{" "}
                {((route.totalLengthKm * coveragePct) / 100).toFixed(1)} km (
                {coveragePct.toFixed(0)}%)
              </span>
            </div>
            <CorridorMap
              route={route}
              coveragePct={coveragePct}
              activeZones={activeZones}
              enableSignalPads={enableSignalPads}
            />
          </div>

          {/* Results Section */}
          <CorridorResults
            simulation={simulation}
            monteCarlo={monteCarlo}
            cost={cost}
            crossoverCoveragePct={crossoverCoveragePct}
            crossoverCoilLengthKm={crossoverCoilLengthKm}
            scenarioVehiclesPerDay={scenarioVehiclesPerDay}
            onScenarioVehiclesChange={setScenarioVehiclesPerDay}
          />
        </div>
      </div>
    </div>
  );
}
