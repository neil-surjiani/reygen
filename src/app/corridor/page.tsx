import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { parseCorridorGeoJSON } from "@/lib/route/profile";
import type { GeoJsonFeatureCollection } from "@/lib/route/profile";
import { CorridorExplorer } from "@/components/corridor/CorridorExplorer";

export const metadata: Metadata = {
  title: "Corridor Simulation | Dubai E311 Wireless Inductive Charging",
  description:
    "Interactive dynamic wireless road charging evaluation for Dubai's Sheikh Mohammed Bin Zayed Road (E311) corridor. Integrates verified OpenStreetMap geometry, physical energy ledgers, Monte Carlo sensitivity distributions, and DEWA grid tariffs.",
};

function loadCorridorData() {
  const geojsonPath = path.join(
    process.cwd(),
    "data",
    "processed",
    "e311.geojson"
  );
  const rawJson = fs.readFileSync(geojsonPath, "utf-8");
  const geojson: GeoJsonFeatureCollection = JSON.parse(rawJson);
  return parseCorridorGeoJSON(geojson);
}

export default function CorridorPage() {
  const route = loadCorridorData();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800/80">
            Corridor Evaluation
          </span>
          <span className="inline-flex items-center rounded-md bg-sky-950/80 px-2.5 py-0.5 text-xs font-medium text-sky-400 border border-sky-800/80">
            OpenStreetMap ODbL Grounded
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
            2,000 Monte Carlo Runs
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Sheikh Mohammed Bin Zayed Road (E311) Corridor
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Interactive digital twin and physical energy simulation evaluating dynamic wireless
          (inductive) road electrification along Dubai&apos;s primary arterial highway.
          Prepared for technical evaluation by Dubai&apos;s Roads and Transport Authority (RTA).
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Real Geometry: 29.22 km (14 ways)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>12 Interchanges Tagged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            <span>DEWA Slab Tariffs Grounded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/limits"
              className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-800"
            >
              Data Limits & Governance →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Interactive Corridor Simulation Experience */}
      <CorridorExplorer route={route} />

      {/* Methodological Context & Technical Footnotes */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-xs text-slate-400 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">
          Corridor Modeling Methodology & Data Standards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-slate-300 mb-1">
              Geometric Alignment & Cruise Speeds
            </h4>
            <p className="leading-relaxed">
              Extracted via OpenStreetMap Overpass API for E311 spanning Sharjah Border through
              Dubai Silicon Oasis to the southern arterial nodes. 100% of segments retain tagged
              maxspeed limits (100–110 km/h). No synthetic gap-filling is applied.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-300 mb-1">
              Inductive Power Transfer
            </h4>
            <p className="leading-relaxed">
              Dynamic wireless coils modeled per SAE J2954/2 heavy-duty / high-power standard
              (75 kW default, 80% magnetic coupling efficiency). Overlaps conserve exact segment
              meterage. Stationary 50 kW dwell pads modeled at interchange ramps.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-300 mb-1">
              Rigorous Uncertainty & Tariff Analysis
            </h4>
            <p className="leading-relaxed">
              Every parameter variation is sampled across 2,000 iterations using a seeded PRNG
              to output 5th, 50th, and 95th percentiles. Grid electricity operating costs are evaluated
              against official DEWA commercial tariffs (0.462 AED/kWh wholesale).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
