"use client";

import React from "react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 print:hidden"
      title="Print or export two-page PDF brief (Ctrl+P / Cmd+P)"
    >
      <svg
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.72 13.829c-.24-1.07-.367-2.18-.367-3.329 0-4.032 2.667-7.5 6.4-8.5m6.88 8.5c0 1.15-.128 2.26-.367 3.33m-13.026 0A9.003 9.003 0 0012 21a9.003 9.003 0 006.12-2.171m-13.026 0A8.966 8.966 0 0112 16.5c1.782 0 3.428.517 4.88 1.409M6 6h12v3H6V6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"
        />
      </svg>
      <span>Export 2-Page PDF</span>
    </button>
  );
}
