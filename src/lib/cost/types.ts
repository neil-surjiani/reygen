/**
 * Types and interfaces for Corridor Capital Expenditure and Payback Analysis.
 * Strictly adheres to AGENTS.md:
 * - Real cost per km from assumptions registry.
 * - Real electricity tariff from DEWA published rates.
 * - Returns "insufficient data" whenever required data (traffic volume) is unsourced.
 */

export interface CostPerKmData {
  value: number;
  unit: string;
  range: {
    min: number;
    typical: number;
    max: number;
  };
  sourceName: string;
  sourceUrl: string;
  confidence: "measured" | "published" | "estimated" | "unsourced";
  note: string;
}

export interface DewaTariffData {
  status: "found" | "not found";
  wholesaleCommercialRateAEDPerKwh: number;
  wholesaleCommercialRateUSDPerKwh: number;
  publicEvAcRateAEDPerKwh: number;
  publicEvDcRateAEDPerKwh: number;
  fuelSurchargeAEDPerKwh: number;
  sourceName: string;
  sourceUrl: string;
  retrievalDate: string;
  effectivePeriod: string;
  note: string;
}

export interface VehiclesServedData {
  status: "available" | "insufficient data";
  vehiclesPerDay: number | "insufficient data";
  annualVehicles: number | "insufficient data";
  isScenario: boolean;
  sourceStatus: "found" | "not found";
  note: string;
}

export interface PaybackEstimateData {
  status: "available" | "insufficient data";
  paybackYears: number | "insufficient data";
  annualEnergyDeliveredKwh: number | "insufficient data";
  annualElectricityCostAED: number | "insufficient data";
  annualElectricityCostUSD: number | "insufficient data";
  annualRevenueAED: number | "insufficient data";
  annualRevenueUSD: number | "insufficient data";
  annualMaintenanceCostAED: number | "insufficient data";
  annualNetCashFlowAED: number | "insufficient data";
  retailPricePerKwhAED: number;
  reason?: string;
}

export interface CorridorCostOptions {
  corridorId?: string;
  corridorLengthKm: number;
  coveragePct: number;
  /** Optional override for cost per lane-km in USD */
  costPerKmOverrideUSD?: number;
  /**
   * Optional exploratory scenario override for vehicles served per day.
   * If omitted, module enforces AGENTS.md and sets vehiclesServed to "insufficient data"
   * because corridor traffic volume was not found in open public datasets.
   */
  scenarioVehiclesPerDay?: number;
  /** Energy delivered per vehicle trip in kWh (default: from simulation or 15 kWh) */
  energyDeliveredPerTripKwh?: number;
  /** Retail charging tariff charged to vehicle operators in AED/kWh (default: 0.672 from DEWA AC rate) */
  retailPricePerKwhAED?: number;
  /** Annual infrastructure maintenance rate as fraction of CapEx (default: 0.02) */
  annualMaintenanceRate?: number;
}

export interface CorridorCostResult {
  corridorId: string;
  corridorLengthKm: number;
  coveragePct: number;
  installedCoilLengthKm: number;
  costPerKmUSD: CostPerKmData;
  totalCapExUSD: {
    value: number;
    range: {
      min: number;
      typical: number;
      max: number;
    };
  };
  totalCapExAED: {
    value: number;
    range: {
      min: number;
      typical: number;
      max: number;
    };
  };
  dewaElectricityTariff: DewaTariffData;
  vehiclesServed: VehiclesServedData;
  payback: PaybackEstimateData;
  governanceComplianceNote: string;
}
