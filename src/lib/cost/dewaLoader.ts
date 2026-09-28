/**
 * DEWA Electricity Tariff and Traffic Volume Status Loader.
 * Directly sources data from the verified pipeline outputs in /data/processed.
 */

import dewaTariffRaw from "../../../data/processed/dewa_electricity_tariffs.json";
import trafficVolumeRaw from "../../../data/processed/traffic_volume_status.json";
import type { DewaTariffData } from "./types";

export interface TrafficVolumeStatus {
  metric: string;
  status: "found" | "not found";
  retrievalDate: string;
  governanceNote: string;
}

/**
 * Returns official published DEWA electricity tariff schedule.
 */
export function loadDewaElectricityTariffs(): DewaTariffData {
  const d = dewaTariffRaw;
  const commercial = d.commercial_road_power_tariffs;
  const publicEv = d.public_ev_charging_tariffs.rates;

  const acRate =
    publicEv.find((r: { service: string }) => r.service.includes("AC"))
      ?.total_rate_aed_kwh ?? 0.672;

  const dcRate =
    publicEv.find((r: { service: string }) => r.service.includes("DC"))
      ?.total_rate_aed_kwh ?? 1.197;

  return {
    status: "found",
    wholesaleCommercialRateAEDPerKwh:
      commercial.corridor_substation_typical_effective_rate_aed_kwh,
    wholesaleCommercialRateUSDPerKwh:
      commercial.corridor_substation_typical_effective_rate_usd_kwh,
    publicEvAcRateAEDPerKwh: acRate,
    publicEvDcRateAEDPerKwh: dcRate,
    fuelSurchargeAEDPerKwh: d.fuel_surcharge.rate_aed_per_kwh,
    sourceName: d.metadata.source,
    sourceUrl: d.metadata.source_urls[0],
    retrievalDate: d.metadata.retrieval_date,
    effectivePeriod: d.metadata.date_ranges.effective_period,
    note: d.metadata.notes,
  };
}

/**
 * Returns corridor traffic volume status and governance notes.
 */
export function loadTrafficVolumeStatus(): TrafficVolumeStatus {
  const t = trafficVolumeRaw;
  return {
    metric: t.metric,
    status: t.status as "found" | "not found",
    retrievalDate: t.retrieval_date,
    governanceNote: t.governance_note,
  };
}
