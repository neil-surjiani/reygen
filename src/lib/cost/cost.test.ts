/**
 * Vitest tests for Infrastructure Cost, DEWA Tariffs, and Payback Analysis Module.
 * Strictly adheres to AGENTS.md:
 * 1. Verifies cost per km is sourced from registry ($1,600,000 USD/lane-km).
 * 2. Verifies DEWA electricity tariffs from pipeline data (0.462 AED/kWh wholesale).
 * 3. Enforces "insufficient data" when corridor traffic volume is unsourced.
 * 4. Verifies exploratory scenario calculation when vehicles served is provided.
 */

import { describe, it, expect } from "vitest";
import { calculateCorridorCost } from "./cost";
import { loadDewaElectricityTariffs, loadTrafficVolumeStatus } from "./dewaLoader";

describe("Infrastructure Cost, DEWA Tariffs, and Payback Module", () => {
  it("loads official DEWA tariffs matching verified pipeline records", () => {
    const tariff = loadDewaElectricityTariffs();

    expect(tariff.status).toBe("found");
    expect(tariff.wholesaleCommercialRateAEDPerKwh).toBe(0.462);
    expect(tariff.wholesaleCommercialRateUSDPerKwh).toBeCloseTo(0.1258, 4);
    expect(tariff.publicEvAcRateAEDPerKwh).toBe(0.672);
    expect(tariff.publicEvDcRateAEDPerKwh).toBe(1.197);
    expect(tariff.fuelSurchargeAEDPerKwh).toBe(0.06);
    expect(tariff.sourceName).toContain("Dubai Electricity and Water Authority");
    expect(tariff.sourceUrl).toBe("https://www.dewa.gov.ae/en/consumer/billing/slab-tariff");
  });

  it("loads traffic volume status confirming corridor-specific data was not found in public open data", () => {
    const status = loadTrafficVolumeStatus();

    expect(status.status).toBe("not found");
    expect(status.governanceNote).toContain("Resolution No. 740 of 2019");
  });

  it("calculates CapEx from registry and returns 'insufficient data' for payback when traffic volume is unsourced", () => {
    // 29.217 km E311 corridor with 35% coverage (~10.22 km of electrified roadway)
    const result = calculateCorridorCost({
      corridorId: "E311",
      corridorLengthKm: 29.217,
      coveragePct: 35.0,
    });

    // 1. CapEx calculations
    expect(result.installedCoilLengthKm).toBeCloseTo(10.226, 2);
    expect(result.costPerKmUSD.value).toBe(1600000);
    expect(result.costPerKmUSD.unit).toBe("USD/lane-km");

    // CapEx = 10.22595 km * 1,600,000 USD/km = 16,361,520 USD
    expect(result.totalCapExUSD.value).toBeCloseTo(16361520, 0);
    // CapEx in AED = 16,361,520 * 3.6725 = 60,087,682 AED
    expect(result.totalCapExAED.value).toBeCloseTo(60087682, 0);

    // Range checks
    expect(result.totalCapExUSD.range.min).toBeLessThan(result.totalCapExUSD.value);
    expect(result.totalCapExUSD.range.max).toBeGreaterThan(result.totalCapExUSD.value);

    // 2. Vehicles served check: must be "insufficient data" per AGENTS.md
    expect(result.vehiclesServed.status).toBe("insufficient data");
    expect(result.vehiclesServed.vehiclesPerDay).toBe("insufficient data");
    expect(result.vehiclesServed.annualVehicles).toBe("insufficient data");
    expect(result.vehiclesServed.isScenario).toBe(false);
    expect(result.vehiclesServed.note).toContain("Resolution No. 740 of 2019");

    // 3. Payback check: must return "insufficient data" instead of a fabricated number
    expect(result.payback.status).toBe("insufficient data");
    expect(result.payback.paybackYears).toBe("insufficient data");
    expect(result.payback.annualRevenueAED).toBe("insufficient data");
    expect(result.payback.annualElectricityCostAED).toBe("insufficient data");
    expect(result.payback.reason).toContain("required input 'number of vehicles served' is unsourced");
  });

  it("evaluates exploratory payback when user provides an explicit vehicles served scenario", () => {
    // 10 km electrified corridor, 5,000 EV trips per day scenario
    const result = calculateCorridorCost({
      corridorId: "E311",
      corridorLengthKm: 29.217,
      coveragePct: 34.227, // exactly 10.0 km
      scenarioVehiclesPerDay: 5000,
      energyDeliveredPerTripKwh: 15.0,
      retailPricePerKwhAED: 0.672, // DEWA AC Green Charger retail rate
    });

    expect(result.installedCoilLengthKm).toBeCloseTo(10.0, 1);
    expect(result.vehiclesServed.status).toBe("available");
    expect(result.vehiclesServed.isScenario).toBe(true);
    expect(result.vehiclesServed.vehiclesPerDay).toBe(5000);
    expect(result.vehiclesServed.annualVehicles).toBe(5000 * 365); // 1,825,000

    // Annual energy = 1,825,000 * 15 kWh = 27,375,000 kWh
    expect(result.payback.status).toBe("available");
    expect(result.payback.annualEnergyDeliveredKwh).toBe(27375000);

    // Wholesale electricity purchase from DEWA = 27,375,000 * 0.462 AED = 12,647,250 AED
    expect(result.payback.annualElectricityCostAED).toBe(12647250);

    // Retail revenue at 0.672 AED/kWh = 27,375,000 * 0.672 = 18,396,000 AED
    expect(result.payback.annualRevenueAED).toBe(18396000);

    // Gross electricity margin = 18,396,000 - 12,647,250 = 5,748,750 AED
    // Annual maintenance (2% of ~58.76M AED CapEx) = ~1,175,200 AED
    // Net operational cash flow = ~4,573,550 AED
    // Payback period = CapEx / Net cash flow ≈ 12.8 years
    expect(typeof result.payback.paybackYears).toBe("number");
    const pb = result.payback.paybackYears as number;
    expect(pb).toBeGreaterThan(5);
    expect(pb).toBeLessThan(25);
  });
});
