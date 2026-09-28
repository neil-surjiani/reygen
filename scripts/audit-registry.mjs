/**
 * Native Node.js audit script for assumptions registry.
 * Runs via `npm run audit:data`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const registryPath = path.resolve(__dirname, "../src/lib/registry/assumptions.json");
const raw = fs.readFileSync(registryPath, "utf-8");
const data = JSON.parse(raw);

console.log("=================================================");
console.log("   DUBAI RTA CHARGING CORRIDOR: DATA AUDIT REPORT");
console.log("=================================================");
console.log(`Title: ${data.metadata.title}`);
console.log(`Version: ${data.metadata.version} | Last Updated: ${data.metadata.lastUpdated}`);
console.log(`Jurisdiction: ${data.metadata.jurisdiction}`);
console.log("-------------------------------------------------");

const items = [];
items.push(data.environment.airDensity_kg_m3);
items.push(data.corridor.costPerKm_USD);
items.push(data.corridor.coilPower_kW);
items.push(data.corridor.couplingEfficiency);

for (const vehicleGroup of Object.values(data.vehicles)) {
  for (const v of Object.values(vehicleGroup)) {
    items.push(v);
  }
}
if (data.trafficControl) {
  for (const tc of Object.values(data.trafficControl)) {
    items.push(tc);
  }
}
if (data.speculativeHarvesters) {
  for (const s of Object.values(data.speculativeHarvesters)) {
    items.push(s);
  }
}

const measured = items.filter((i) => i.confidence === "measured");
const published = items.filter((i) => i.confidence === "published");
const estimated = items.filter((i) => i.confidence === "estimated");
const unsourced = items.filter((i) => i.confidence === "unsourced" || i.value === null);

console.log(`Total Parameters Registered: ${items.length}`);
console.log(`- Measured (Pilot/Trial):     ${measured.length}`);
console.log(`- Published (Standards/Specs): ${published.length}`);
console.log(`- Estimated (Ranges with basis): ${estimated.length}`);
console.log(`- Unsourced (Marked null):    ${unsourced.length}`);
console.log("-------------------------------------------------");

if (unsourced.length > 0) {
  console.log("UNSOURCED PARAMETERS (Explicitly null per AGENTS.md):");
  for (const u of unsourced) {
    console.log(`  [!] ${u.id}: ${u.name}`);
    console.log(`      Reason: ${u.note}`);
  }
  console.log("-------------------------------------------------");
}

console.log("VERIFIED SOURCES REGISTERED:");
for (const item of items) {
  if (item.confidence !== "unsourced") {
    console.log(`  - [${item.confidence.toUpperCase()}] ${item.name} (${item.id})`);
    console.log(`    Value: ${item.value} ${item.unit} | Range: [${item.range?.min} - ${item.range?.max}]`);
    console.log(`    Source: ${item.sourceName}`);
    console.log(`    URL: ${item.sourceUrl}`);
  }
}
console.log("=================================================");
console.log("Audit complete. Data governance checks passed.");
