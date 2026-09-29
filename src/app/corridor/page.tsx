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
          <span className="inline-flex items-center rounded-md bg-emerald-950/80 px-3 py-1 text-sm font-semibold text-emerald-400 border border-emerald-800/80">
            Corridor Evaluation
          </span>
          <span className="inline-flex items-center rounded-md bg-sky-950/80 px-3 py-1 text-sm font-medium text-sky-400 border border-sky-800/80">
            OpenStreetMap ODbL Grounded
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 border border-slate-700">
            2,000 Monte Carlo Runs
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Sheikh Mohammed Bin Zayed Road (E311) Corridor
        </h1>
        <p className="mt-3 max-w-4xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Interactive digital twin and physical energy simulation evaluating dynamic wireless
          (inductive) road electrification along Dubai&apos;s primary arterial highway.
          Prepared for technical evaluation by Dubai&apos;s Roads and Transport Authority (RTA).
        </p>

        <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="font-medium">Real Geometry: 29.22 km (14 ways)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="font-medium">12 Interchanges Tagged</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
            <span className="font-medium">DEWA Slab Tariffs Grounded</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/limits"
              className="font-medium text-emerald-400 hover:text-emerald-300 underline decoration-emerald-800"
            >
              Data Limits & Governance →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Interactive Corridor Simulation Experience */}
      <CorridorExplorer route={route} />
    </div>
  );
}
