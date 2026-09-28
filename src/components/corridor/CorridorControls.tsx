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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
      {/* 1. Vehicle Selection */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Target Vehicle Fleet Class
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {vehicleOptions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onVehicleChange(v.id)}
              className={`rounded-lg border p-3 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                vehicleType === v.id
                  ? "border-emerald-500 bg-emerald-950/40 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <div className="text-sm font-semibold">{v.name}</div>
              <div className="mt-1 text-[11px] text-slate-400">{v.specs}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Coverage Percentage Slider */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="coverage-slider"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Corridor Inductive Coverage
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-emerald-400">
              {coveragePct.toFixed(0)}%
            </span>
            <span className="text-xs text-slate-400">
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
          className="mt-2 h-2 w-full appearance-none rounded-lg bg-slate-800 accent-emerald-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Electrified roadway coverage percentage slider"
        />

        {/* Quick select presets */}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => onCoverageChange(0)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            0% (Baseline)
          </button>
          {crossoverCoveragePct !== null && (
            <button
              type="button"
              onClick={() => onCoverageChange(Math.round(crossoverCoveragePct))}
              className="rounded border border-emerald-600 bg-emerald-950/60 px-2.5 py-1 font-medium text-emerald-300 hover:bg-emerald-900/60"
            >
              ★ Net-Positive ({crossoverCoveragePct.toFixed(1)}%)
            </button>
          )}
          <button
            type="button"
            onClick={() => onCoverageChange(25)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            25%
          </button>
          <button
            type="button"
            onClick={() => onCoverageChange(50)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            50%
          </button>
          <button
            type="button"
            onClick={() => onCoverageChange(100)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            100% (Full)
          </button>
        </div>
      </div>

      {/* 3. Discrete Coil Segments & Stationary Pads Toggles */}
      <div className="border-t border-slate-800 pt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Corridor Segment Activation & Infrastructure
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {activeZones.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-xs text-slate-300 hover:bg-slate-800/40 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={zone.active}
                onChange={() => onToggleZone(zone.id)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <div className="font-medium text-slate-200">{zone.name}</div>
                <div className="text-[11px] text-slate-400">
                  km {zone.startKm} to {zone.endKm} ({zone.endKm - zone.startKm} km)
                </div>
              </div>
            </label>
          ))}

          {/* Stationary Signal-Pad Location Toggle */}
          <label className="col-span-full flex items-center gap-3 rounded-lg border border-purple-950/80 bg-purple-950/20 p-2.5 text-xs text-purple-200 hover:bg-purple-950/30 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSignalPads}
              onChange={(e) => onToggleSignalPads(e.target.checked)}
              className="h-4 w-4 rounded border-purple-700 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-purple-300">
                Stationary Wireless Pads at Signalized Ramps & Dwells
              </div>
              <div className="text-[11px] text-purple-400/80">
                Transfers 50 kW stationary induction power during traffic signal red phases and dwell stops
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Fine-Tuning Registry Parameters (Collapsible Accordion) */}
      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-emerald-400 focus:outline-none"
            aria-expanded={showAdvanced}
          >
            <span>{showAdvanced ? "▼" : "▶"}</span>
            <span>Registry Parameters Inspector & Sensitivity Overrides</span>
          </button>
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-slate-400 hover:text-amber-400 underline decoration-slate-600"
          >
            Reset to Verified Defaults
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs sm:grid-cols-2">
            {/* Vehicle Mass */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Vehicle Mass</span>
                <span className="font-mono text-emerald-400">
                  {overrides.massKg ?? (vehicleType === "passenger_taxi" ? 1847 : vehicleType === "scooter" ? 190 : 15500)} kg
                </span>
              </div>
              <input
                type="range"
                min={vehicleType === "passenger_taxi" ? 1610 : vehicleType === "scooter" ? 170 : 13500}
                max={vehicleType === "passenger_taxi" ? 2060 : vehicleType === "scooter" ? 220 : 18000}
                step={vehicleType === "scooter" ? 1 : 10}
                value={overrides.massKg ?? (vehicleType === "passenger_taxi" ? 1847 : vehicleType === "scooter" ? 190 : 15500)}
                onChange={(e) => onOverrideChange("massKg", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Rolling Resistance */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rolling Resistance (Crr)</span>
                <span className="font-mono text-emerald-400">
                  {overrides.crr ?? (vehicleType === "passenger_taxi" ? 0.0088 : vehicleType === "scooter" ? 0.015 : 0.006)}
                </span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.020"
                step="0.0005"
                value={overrides.crr ?? (vehicleType === "passenger_taxi" ? 0.0088 : vehicleType === "scooter" ? 0.015 : 0.006)}
                onChange={(e) => onOverrideChange("crr", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Coil Power */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coil Transmitter Power</span>
                <span className="font-mono text-emerald-400">
                  {overrides.coilPowerKw ?? 75} kW
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={overrides.coilPowerKw ?? 75}
                onChange={(e) => onOverrideChange("coilPowerKw", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Coupling Efficiency */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Magnetic Coupling Efficiency</span>
                <span className="font-mono text-emerald-400">
                  {((overrides.couplingEfficiency ?? 0.80) * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0.643"
                max="0.900"
                step="0.005"
                value={overrides.couplingEfficiency ?? 0.80}
                onChange={(e) => onOverrideChange("couplingEfficiency", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Auxiliary HVAC Power */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Auxiliary / HVAC Load</span>
                <span className="font-mono text-emerald-400">
                  {overrides.auxWatts ?? (vehicleType === "passenger_taxi" ? 2000 : vehicleType === "scooter" ? 45 : 12000)} W
                </span>
              </div>
              <input
                type="range"
                min={vehicleType === "scooter" ? 20 : 400}
                max={vehicleType === "scooter" ? 80 : vehicleType === "transit_bus" ? 22000 : 4500}
                step={vehicleType === "scooter" ? 5 : 50}
                value={overrides.auxWatts ?? (vehicleType === "passenger_taxi" ? 2000 : vehicleType === "scooter" ? 45 : 12000)}
                onChange={(e) => onOverrideChange("auxWatts", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Air Density */}
            <div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ambient Air Density</span>
                <span className="font-mono text-emerald-400">
                  {overrides.airDensity ?? 1.184} kg/m³
                </span>
              </div>
              <input
                type="range"
                min="1.116"
                max="1.225"
                step="0.005"
                value={overrides.airDensity ?? 1.184}
                onChange={(e) => onOverrideChange("airDensity", parseFloat(e.target.value))}
                className="mt-1 w-full h-1.5 bg-slate-800 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
