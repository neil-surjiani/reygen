"use client";

import React, { useState } from "react";

export interface ProvenanceDetails {
  title?: string;
  sourceName: string;
  sourceUrl: string;
  dateAccessed: string;
  confidence: "measured" | "published" | "estimated" | "unsourced";
  note: string;
  range?: string | { min: number; typical: number; max: number };
  rangeBasis?: string;
}

interface ProvenancePopoverProps {
  label: string;
  value: string | number;
  unit?: string;
  provenance: ProvenanceDetails;
  className?: string;
}

export function ProvenancePopover({
  label,
  value,
  unit,
  provenance,
  className = "",
}: ProvenancePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const confidenceBadge = {
    measured: "bg-emerald-950 text-emerald-300 border-emerald-800",
    published: "bg-blue-950 text-blue-300 border-blue-800",
    estimated: "bg-amber-950 text-amber-300 border-amber-800",
    unsourced: "bg-red-950 text-red-300 border-red-800",
  }[provenance.confidence];

  const rangeDisplay =
    typeof provenance.range === "object" && provenance.range !== null
      ? `[${provenance.range.min} - ${provenance.range.max}]`
      : provenance.range;

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono font-medium text-slate-100">
        {provenance.confidence === "unsourced" || value === null || value === undefined ? (
          <span className="text-rose-400 italic font-sans text-xs">No data</span>
        ) : (
          <>
            {value}
            {unit && <span className="ml-1 text-xs text-slate-400 font-sans">{unit}</span>}
          </>
        )}
      </span>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        aria-label={`View data provenance and citation for ${label}`}
        aria-expanded={isOpen}
        className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>

      {isOpen && (
        <div
          role="tooltip"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-xl backdrop-blur transition-opacity animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="font-semibold text-white">{provenance.title || label}</div>
              <div className="text-[11px] text-slate-400">
                Current value: <span className="font-mono text-emerald-400">{value} {unit}</span>
              </div>
            </div>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${confidenceBadge}`}
            >
              {provenance.confidence}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
            <div>
              <span className="text-slate-400">Source: </span>
              <span className="text-slate-200">{provenance.sourceName}</span>
            </div>

            {provenance.sourceUrl && (
              <div>
                <span className="text-slate-400">Citation URL: </span>
                <a
                  href={provenance.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline decoration-emerald-600 underline-offset-2 hover:text-emerald-300 break-all"
                >
                  {provenance.sourceUrl}
                </a>
              </div>
            )}

            <div>
              <span className="text-slate-400">Date Accessed: </span>
              <span className="font-mono text-slate-300">{provenance.dateAccessed}</span>
            </div>

            {rangeDisplay && (
              <div>
                <span className="text-slate-400">Verified Range: </span>
                <span className="font-mono text-amber-300">{rangeDisplay}</span>
              </div>
            )}

            {provenance.rangeBasis && (
              <div>
                <span className="text-slate-400">Range Basis: </span>
                <span className="text-slate-300 italic">{provenance.rangeBasis}</span>
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-1.5 text-slate-300">
              {provenance.note}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
