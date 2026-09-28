# Project Guidelines: Dubai RTA Dynamic Wireless Charging Corridor Analysis

This website evaluates dynamic wireless (inductive) road charging for electric vehicles on a proposed Dubai corridor, intended for presentation to Dubai's Roads and Transport Authority (RTA).

## Core Rules

1. NO FABRICATED DATA. Every number shown on the site must come from (a) a real dataset fetched by a script in /pipeline, (b) a published source recorded in the assumptions registry, or (c) a calculation from those. If you cannot find a real source for a value, do NOT invent one. Mark it status "unsourced" and show "No data" in the UI.
2. NO INVENTED CITATIONS. Only cite URLs you have actually opened in the browser and confirmed contain the number. Record the exact page and the date accessed.
3. Every value has: value, unit, source name, source URL, date accessed, confidence ("measured" | "published" | "estimated" | "unsourced"), and a one-line note.
4. Estimated numbers are always shown as ranges with the range's basis stated.
5. Stack: Next.js (App Router), TypeScript strict mode, Tailwind, Vitest, MapLibre GL, Recharts. Data pipeline in Python under /pipeline. No backend server.
6. Never use placeholder or lorem-ipsum content. If something is not built yet, leave it out.
7. After each task, list what you did, what you could not verify, and any assumption you made.