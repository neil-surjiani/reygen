"use client";

import React, { useState, useMemo } from "react";
import type { AssumptionConfidence, AssumptionItem } from "@/lib/registry/types";

interface AssumptionsRegistryTableProps {
  assumptions: AssumptionItem[];
}

function formatNumber(val: number): string {
  if (Number.isInteger(val)) {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return val.toString();
}

export function AssumptionsRegistryTable({
  assumptions,
}: AssumptionsRegistryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedConfidence, setSelectedConfidence] = useState<string>("all");

  const categories = useMemo(() => {
    return [
      { id: "all", label: "All Categories" },
      { id: "corridor", label: "Corridor Infrastructure" },
      { id: "passenger_taxi", label: "Passenger Taxi" },
      { id: "scooter", label: "Electric Scooter" },
      { id: "transit_bus", label: "Transit Bus" },
      { id: "environment", label: "Environment & Climate" },
      { id: "traffic_control", label: "Traffic Control" },
    ];
  }, []);

  const confidences: { id: string; label: string; color: string }[] = [
    { id: "all", label: "All Confidence", color: "bg-slate-800 text-slate-300" },
    { id: "published", label: "Published", color: "bg-sky-950 text-sky-300 border-sky-800" },
    { id: "estimated", label: "Estimated", color: "bg-amber-950 text-amber-300 border-amber-800" },
    { id: "measured", label: "Measured", color: "bg-emerald-950 text-emerald-300 border-emerald-800" },
    { id: "unsourced", label: "Unsourced", color: "bg-rose-950 text-rose-300 border-rose-800" },
  ];

  const filteredAssumptions = useMemo(() => {
    return assumptions.filter((item) => {
      // 1. Search filter
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        term === "" ||
        item.name.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        item.sourceName.toLowerCase().includes(term) ||
        item.note.toLowerCase().includes(term) ||
        item.unit.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Category filter
      if (selectedCategory !== "all") {
        if (
          selectedCategory === "passenger_taxi" ||
          selectedCategory === "scooter" ||
          selectedCategory === "transit_bus"
        ) {
          if (item.vehicleType !== selectedCategory) return false;
        } else if (item.category !== selectedCategory) {
          return false;
        }
      }

      // 3. Confidence filter
      if (
        selectedConfidence !== "all" &&
        item.confidence !== selectedConfidence
      ) {
        return false;
      }

      return true;
    });
  }, [assumptions, searchTerm, selectedCategory, selectedConfidence]);

  const getConfidenceBadge = (confidence: AssumptionConfidence) => {
    switch (confidence) {
      case "published":
        return (
          <span className="inline-flex items-center rounded-md border border-sky-800 bg-sky-950/80 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Published
          </span>
        );
      case "measured":
        return (
          <span className="inline-flex items-center rounded-md border border-emerald-800 bg-emerald-950/80 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            Measured
          </span>
        );
      case "estimated":
        return (
          <span className="inline-flex items-center rounded-md border border-amber-800 bg-amber-950/80 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            Estimated
          </span>
        );
      case "unsourced":
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-rose-800 bg-rose-950/80 px-2 py-0.5 text-[11px] font-medium text-rose-300">
            Unsourced
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            id="search-assumptions"
            name="search"
            type="text"
            placeholder="Search parameter, ID, unit, or source name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Search assumptions registry"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cat-select" className="text-xs text-slate-400">
            Category:
          </label>
          <select
            id="cat-select"
            name="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <label htmlFor="conf-select" className="text-xs text-slate-400 ml-2">
            Confidence:
          </label>
          <select
            id="conf-select"
            name="confidence"
            value={selectedConfidence}
            onChange={(e) => setSelectedConfidence(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {confidences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result counter */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing{" "}
          <span className="font-semibold text-white">
            {filteredAssumptions.length}
          </span>{" "}
          of {assumptions.length} registered parameters
        </div>
        <div className="text-[11px] text-slate-500">
          Generated directly from assumptions registry (AGENTS.md Rule 1 & Rule 3 compliant)
        </div>
      </div>

      {/* Registry Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3.5">
                Parameter & Identifier
              </th>
              <th scope="col" className="px-3 py-3.5">
                Scope / Vehicle
              </th>
              <th scope="col" className="px-3 py-3.5">
                Typical Value
              </th>
              <th scope="col" className="px-3 py-3.5">
                Range [Min – Max]
              </th>
              <th scope="col" className="px-3 py-3.5">
                Confidence
              </th>
              <th scope="col" className="px-4 py-3.5">
                Source & Verification Citation
              </th>
              <th scope="col" className="px-4 py-3.5">
                Technical Note & Basis
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950 font-normal text-slate-300">
            {filteredAssumptions.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-xs text-slate-500"
                >
                  No registered parameters match your current filters.
                </td>
              </tr>
            ) : (
              filteredAssumptions.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-slate-900/40"
                >
                  {/* Parameter & Identifier */}
                  <td className="px-4 py-3 font-medium text-white">
                    <div>{item.name}</div>
                    <code className="text-[10px] text-slate-500 font-mono">
                      {item.id}
                    </code>
                  </td>

                  {/* Scope / Vehicle */}
                  <td className="px-3 py-3 capitalize text-slate-300">
                    {item.vehicleType
                      ? item.vehicleType.replace("_", " ")
                      : item.category.replace("_", " ")}
                  </td>

                  {/* Typical Value */}
                  <td className="px-3 py-3 font-mono font-medium text-emerald-400 whitespace-nowrap">
                    {item.value !== null ? (
                      <>
                        {formatNumber(item.value)}{" "}
                        <span className="text-[11px] font-sans text-slate-400">
                          {item.unit}
                        </span>
                      </>
                    ) : (
                      <span className="text-rose-400 italic">No data</span>
                    )}
                  </td>

                  {/* Range [Min - Max] */}
                  <td className="px-3 py-3 font-mono text-slate-300 whitespace-nowrap">
                    {item.range ? (
                      <div>
                        <span>
                          [{formatNumber(item.range.min)} –{" "}
                          {formatNumber(item.range.max)}]
                        </span>
                        {item.rangeBasis && (
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5 max-w-[140px] truncate" title={item.rangeBasis}>
                            {item.rangeBasis}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Confidence Badge */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {getConfidenceBadge(item.confidence)}
                  </td>

                  {/* Source Citation Link */}
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium text-slate-200 truncate" title={item.sourceName}>
                      {item.sourceName}
                    </div>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline decoration-emerald-800/80 truncate block"
                        title={item.sourceUrl}
                      >
                        Verified Source ↗
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">Unspecified</span>
                    )}
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Accessed: {item.dateAccessed}
                    </div>
                  </td>

                  {/* Technical Note */}
                  <td className="px-4 py-3 max-w-[260px] text-slate-400 text-[11px] leading-relaxed">
                    <p>{item.note}</p>
                    {item.confidence === "estimated" && item.rangeBasis && (
                      <p className="mt-1 text-[10px] text-amber-400/80">
                        <span className="font-semibold">Range Basis:</span> {item.rangeBasis}
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
