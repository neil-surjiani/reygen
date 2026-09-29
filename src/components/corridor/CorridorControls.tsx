"use client";

import React, { useState } from "react";
import type { SupportedVehicleType } from "@/lib/registry/loader";
import type { ActiveCoilZone } from "./CorridorMap";

export interface RegistryOverrides {
  massKg?: number;
  crr?: number;
  cdaM2?: number;
  motorEfficiency?: number;
  regenEfficiency?: number;
  maxRegenDecel?: number;
  auxWatts?: number;
  coilPowerKw?: number;
  couplingEfficiency?: number;
  airDensity?: number;
  solarIrradianceWm2?: number;
}

interface CorridorControlsProps {
  vehicleType: SupportedVehicleType;
  onVehicleChange: (v: SupportedVehicleType) => void;
  coveragePct: number;
  onCoverageChange: (c: number) => void;
  crossoverCoveragePct: number | null;
  activeZones: ActiveCoilZone[];
  onToggleZone: (zoneId: string) => void;
  enableSignalPads: boolean;
  onToggleSignalPads: (enable: boolean) => void;
  overrides: RegistryOverrides;
  onOverrideChange: (key: keyof RegistryOverrides, val: number) => void;
  onResetOverrides: () => void;
}

export function CorridorControls({
  vehicleType,
  onVehicleChange,
  coveragePct,
  onCoverageChange,
  crossoverCoveragePct,
  activeZones,
  onToggleZone,
  enableSignalPads,
  onToggleSignalPads,
  overrides,
  onOverrideChange,
  onResetOverrides,
}: CorridorControlsProps) {
  // Open by default so users can change any values immediately
  const [showAdvanced, setShowAdvanced] = useState(true);

  const vehicleOptions: { id: SupportedVehicleType; name: string; specs: string }[] = [
    {
      id: "passenger_taxi",
      name: "Passenger Taxi / EV",
      specs: "Tesla Model 3 class (1,847 kg, CdA 0.51 m²)",
    },
    {
      id: "scooter",
      name: "Delivery Scooter",
      specs: "NIU NQi GTS class (190 kg, CdA 0.55 m²)",
    },
    {
      id: "transit_bus",
      name: "12m Transit Bus",
      specs: "BYD K-Series (15,500 kg, CdA 4.88 m²)",
    },
  ];

  // Default values based on current vehicle type
  const defaultMass = vehicleType === "passenger_taxi" ? 1847 : vehicleType === "scooter" ? 190 : 15500;
  const defaultCda = vehicleType === "passenger_taxi" ? 0.51 : vehicleType === "scooter" ? 0.55 : 4.88;
  const defaultCrr = vehicleType === "passenger_taxi" ? 0.0088 : vehicleType === "scooter" ? 0.015 : 0.006;
  const defaultMotorEff = vehicleType === "passenger_taxi" ? 0.92 : vehicleType === "scooter" ? 0.85 : 0.91;
  const defaultRegenEff = vehicleType === "passenger_taxi" ? 0.72 : vehicleType === "scooter" ? 0.50 : 0.70;
  const defaultRegenDecel = vehicleType === "passenger_taxi" ? 2.0 : vehicleType === "scooter" ? 1.5 : 1.8;
  const defaultAux = vehicleType === "passenger_taxi" ? 2000 : vehicleType === "scooter" ? 45 : 12000;
  const defaultCoilPower = 75;
  const defaultCoupling = 0.80;
  const defaultSolar = 1000;
  const defaultAirDensity = 1.184;

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
      {/* 1. Vehicle Selection */}
      <div>
        <label className="mb-2.5 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
          Target Vehicle Fleet Class
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {vehicleOptions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onVehicleChange(v.id)}
              className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                vehicleType === v.id
                  ? "border-emerald-500 bg-emerald-950/40 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <div className="text-sm sm:text-base font-bold">{v.name}</div>
              <div className="mt-1 text-xs text-slate-400 leading-snug">{v.specs}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Coverage Percentage Slider & Quick Presets */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="coverage-slider"
            className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300"
          >
            Corridor Inductive Coverage
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-extrabold text-emerald-400">
              {coveragePct.toFixed(0)}%
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-300">
              ({((29.217 * coveragePct) / 100).toFixed(1)} km of 29.2 km)
            </span>
          </div>
        </div>

        <input
          id="coverage-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={coveragePct}
          onChange={(e) => onCoverageChange(parseFloat(e.target.value))}
          className="mt-2.5 h-2.5 w-full appearance-none rounded-lg bg-slate-800 accent-emerald-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Electrified roadway coverage percentage slider"
        />

        {/* Quick select presets */}
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => onCoverageChange(0)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700 hover:text-white font-medium"
          >
            0% (Baseline)
          </button>
          {crossoverCoveragePct !== null && (
            <button
              type="button"
              onClick={() => onCoverageChange(Math.round(crossoverCoveragePct))}
              className="rounded-lg border border-emerald-600 bg-emerald-950/60 px-3 py-1.5 font-bold text-emerald-300 hover:bg-emerald-900/60"
            >
              ★ Net-Positive ({crossoverCoveragePct.toFixed(1)}%)
            </button>
          )}
          <button
            type="button"
            onClick={() => onCoverageChange(25)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700 hover:text-white font-medium"
          >
            25%
          </button>
          <button
            type="button"
            onClick={() => onCoverageChange(50)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700 hover:text-white font-medium"
          >
            50%
          </button>
          <button
            type="button"
            onClick={() => onCoverageChange(100)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700 hover:text-white font-medium"
          >
            100% (Full)
          </button>
        </div>
      </div>

      {/* 3. Sectional Zone Switches & Signal Pads */}
      <div>
        <label className="mb-2.5 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
          Corridor Segment Activation &amp; Infrastructure
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeZones.map((zone) => (
            <label
              key={zone.id}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-xs sm:text-sm cursor-pointer transition-all ${
                zone.active
                  ? "border-emerald-500/80 bg-emerald-950/30 text-white"
                  : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={zone.active}
                onChange={() => onToggleZone(zone.id)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-200">{zone.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  km {zone.startKm} to {zone.endKm} ({zone.endKm - zone.startKm} km)
                </div>
              </div>
            </label>
          ))}

          {/* Stationary Signal-Pad Location Toggle */}
          <label className="col-span-full flex items-center gap-3.5 rounded-xl border border-purple-950/80 bg-purple-950/20 p-3.5 text-xs sm:text-sm text-purple-200 hover:bg-purple-950/30 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSignalPads}
              onChange={(e) => onToggleSignalPads(e.target.checked)}
              className="h-4 w-4 rounded border-purple-700 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="font-bold text-purple-300 text-sm">
                Stationary Wireless Pads at Signalized Ramps &amp; Dwells
              </div>
              <div className="text-xs text-purple-300/80 mt-0.5">
                Transfers 50 kW stationary induction power during traffic signal red phases and dwell stops
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Complete Interactive Physics Parameter Controls (Instant Simulation on Change) */}
      <div className="border-t border-slate-800 pt-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-emerald-400 hover:text-emerald-300 focus:outline-none"
            aria-expanded={showAdvanced}
          >
            <span>{showAdvanced ? "▼" : "▶"}</span>
            <span>Interactive Physics &amp; Sensitivity Controls (Real-Time Simulation)</span>
          </button>
          {hasOverrides && (
            <button
              type="button"
              onClick={onResetOverrides}
              className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              Reset to Defaults
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Vehicle Mass */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Vehicle Mass (m)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overrides.massKg ?? defaultMass}
                    onChange={(e) => onOverrideChange("massKg", parseFloat(e.target.value) || defaultMass)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">kg</span>
                </div>
              </div>
              <input
                type="range"
                min={vehicleType === "passenger_taxi" ? 1000 : vehicleType === "scooter" ? 80 : 8000}
                max={vehicleType === "passenger_taxi" ? 2800 : vehicleType === "scooter" ? 350 : 25000}
                step={vehicleType === "scooter" ? 1 : 10}
                value={overrides.massKg ?? defaultMass}
                onChange={(e) => onOverrideChange("massKg", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 2. Drag Area CdA */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Drag Area (Cd·A)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={overrides.cdaM2 ?? defaultCda}
                    onChange={(e) => onOverrideChange("cdaM2", parseFloat(e.target.value) || defaultCda)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">m²</span>
                </div>
              </div>
              <input
                type="range"
                min={vehicleType === "transit_bus" ? 2.0 : 0.2}
                max={vehicleType === "transit_bus" ? 8.0 : 1.5}
                step="0.01"
                value={overrides.cdaM2 ?? defaultCda}
                onChange={(e) => onOverrideChange("cdaM2", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 3. Rolling Resistance Crr */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Rolling Resistance (Crr)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.0005"
                    value={overrides.crr ?? defaultCrr}
                    onChange={(e) => onOverrideChange("crr", parseFloat(e.target.value) || defaultCrr)}
                    className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="range"
                min="0.004"
                max="0.025"
                step="0.0005"
                value={overrides.crr ?? defaultCrr}
                onChange={(e) => onOverrideChange("crr", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 4. Motor Efficiency */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Motor Efficiency (η_motor)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    value={Math.round((overrides.motorEfficiency ?? defaultMotorEff) * 100)}
                    onChange={(e) => onOverrideChange("motorEfficiency", (parseFloat(e.target.value) || 90) / 100)}
                    className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.65"
                max="0.98"
                step="0.01"
                value={overrides.motorEfficiency ?? defaultMotorEff}
                onChange={(e) => onOverrideChange("motorEfficiency", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 5. Regen Efficiency */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Regen Efficiency (η_regen)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    value={Math.round((overrides.regenEfficiency ?? defaultRegenEff) * 100)}
                    onChange={(e) => onOverrideChange("regenEfficiency", (parseFloat(e.target.value) || 70) / 100)}
                    className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.90"
                step="0.01"
                value={overrides.regenEfficiency ?? defaultRegenEff}
                onChange={(e) => onOverrideChange("regenEfficiency", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 6. Regen Decel Ceiling */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Regen Ceiling (a_max)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={overrides.maxRegenDecel ?? defaultRegenDecel}
                    onChange={(e) => onOverrideChange("maxRegenDecel", parseFloat(e.target.value) || defaultRegenDecel)}
                    className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">m/s²</span>
                </div>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.5"
                step="0.1"
                value={overrides.maxRegenDecel ?? defaultRegenDecel}
                onChange={(e) => onOverrideChange("maxRegenDecel", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 7. Auxiliary / HVAC Load */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Aux / HVAC Load (P_aux)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="50"
                    value={overrides.auxWatts ?? defaultAux}
                    onChange={(e) => onOverrideChange("auxWatts", parseFloat(e.target.value) || defaultAux)}
                    className="w-18 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">W</span>
                </div>
              </div>
              <input
                type="range"
                min={vehicleType === "scooter" ? 10 : 200}
                max={vehicleType === "scooter" ? 150 : vehicleType === "transit_bus" ? 22000 : 5000}
                step={vehicleType === "scooter" ? 5 : 50}
                value={overrides.auxWatts ?? defaultAux}
                onChange={(e) => onOverrideChange("auxWatts", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 8. Coil Transmitter Power */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Coil Power (P_coil)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="5"
                    value={overrides.coilPowerKw ?? defaultCoilPower}
                    onChange={(e) => onOverrideChange("coilPowerKw", parseFloat(e.target.value) || defaultCoilPower)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">kW</span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                step="5"
                value={overrides.coilPowerKw ?? defaultCoilPower}
                onChange={(e) => onOverrideChange("coilPowerKw", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 9. Magnetic Coupling Efficiency */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Coupling Efficiency (η_c)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    value={Math.round((overrides.couplingEfficiency ?? defaultCoupling) * 100)}
                    onChange={(e) => onOverrideChange("couplingEfficiency", (parseFloat(e.target.value) || 80) / 100)}
                    className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.01"
                value={overrides.couplingEfficiency ?? defaultCoupling}
                onChange={(e) => onOverrideChange("couplingEfficiency", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 10. Solar Irradiance */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Solar Irradiance (G_irr)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="50"
                    value={overrides.solarIrradianceWm2 ?? defaultSolar}
                    onChange={(e) => onOverrideChange("solarIrradianceWm2", parseFloat(e.target.value) || 0)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">W/m²</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1200"
                step="50"
                value={overrides.solarIrradianceWm2 ?? defaultSolar}
                onChange={(e) => onOverrideChange("solarIrradianceWm2", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* 11. Ambient Air Density */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Air Density (ρ)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.005"
                    value={overrides.airDensity ?? defaultAirDensity}
                    onChange={(e) => onOverrideChange("airDensity", parseFloat(e.target.value) || defaultAirDensity)}
                    className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">kg/m³</span>
                </div>
              </div>
              <input
                type="range"
                min="1.05"
                max="1.25"
                step="0.005"
                value={overrides.airDensity ?? defaultAirDensity}
                onChange={(e) => onOverrideChange("airDensity", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
