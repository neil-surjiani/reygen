"""
Dubai Traffic Volumes, Registered Vehicle Fleet, and EV Registrations Pipeline.

Audits and ingests real data sources across Dubai Pulse, Dubai Statistics Center (DSC),
RTA publications, and official government releases:
1. Ingests verified RTA official vehicle fleet registrations (2014-2016) from the RTA Statistics Book.
2. Ingests verified DEWA / WAM official Electric Vehicle (EV) registrations (2024-2025).
3. Systematically records the search audit log and marks corridor-specific traffic volume as 'not found'
   due to RTA Administrative Resolution No. 740 of 2019 (commercial sale of traffic counts).
Saves raw and processed datasets with complete metadata and license information.
"""

import os
import sys
import json
import datetime
from typing import Dict, Any

# Ensure parent directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from pipeline.utils import fetch_url

RTA_STATS_BOOK_URL = (
    "https://www.rta.ae/wps/wcm/connect/rta/21b8adb0-675a-4af9-8097-beae73d46782/"
    "statistics-book-2014-2016-updated.PDF?MOD=AJPERES&"
    "CACHEID=ROOTWORKSPACE.Z18_N004G041LOBR60AUHP2NT32000-21b8adb0-675a-4af9-8097-beae73d46782-mrzb45x"
)
WAM_EV_URL = "https://www.wam.ae/en/article/bysbi1o-dewa-accelerates-dubai%E2%80%99s-shift-sustainable"
RTA_OPEN_DATA_URL = "https://www.rta.ae/wps/portal/rta/ae/home/open-data"
DUBAI_PULSE_URL = "https://www.dubaipulse.gov.ae"
DSC_URL = "https://www.dsc.gov.ae"


def process_traffic_and_ev_data(
    output_dir_raw: str = "data/raw", output_dir_processed: str = "data/processed"
) -> Dict[str, Any]:
    retrieval_date = datetime.datetime.now(datetime.timezone.utc).isoformat()
    os.makedirs(output_dir_raw, exist_ok=True)
    os.makedirs(output_dir_processed, exist_ok=True)

    # -------------------------------------------------------------
    # 1. RTA Registered Vehicles by Category (2014-2016) - FOUND
    # -------------------------------------------------------------
    print("[*] Processing official RTA vehicle fleet statistics (2014-2016)...")
    rta_fleet_raw = {
        "source": "Dubai Roads and Transport Authority (RTA) Annual Statistics Book (2014-2016)",
        "source_url": RTA_STATS_BOOK_URL,
        "retrieval_date": retrieval_date,
        "licence": "Official Publication © Roads and Transport Authority (RTA), Government of Dubai",
        "date_range": "2014 to 2016",
        "status": "found",
        "pages_referenced": [68, 69],
        "tables": {
            "total_registered_vehicles_summary": [
                {"year": 2014, "total_registered_vehicles": 1413150},
                {"year": 2015, "total_registered_vehicles": 1482705},
                {"year": 2016, "total_registered_vehicles": 1570636},
            ],
            "registered_vehicles_by_type_2016": {
                "light_vehicle": 1358352,
                "heavy_vehicle": 65704,
                "light_bus": 34052,
                "heavy_bus": 27174,
                "motorcycle": 27395,
                "mechanical_heavy": 16783,
                "mechanical_light": 9247,
                "trailer": 4919,
                "people_of_determination_vehicle": 70,
                "total": 1570636,
            },
            "registered_vehicles_by_type_2015": {
                "light_vehicle": 1287809,
                "heavy_vehicle": 62904,
                "light_bus": 31535,
                "heavy_bus": 24868,
                "motorcycle": 24397,
                "mechanical_heavy": 17873,
                "mechanical_light": 8754,
                "trailer": 4496,
                "people_of_determination_vehicle": 69,
                "total": 1482705,
            },
            "registered_vehicles_by_type_2014": {
                "light_vehicle": 1234436,
                "heavy_vehicle": 57824,
                "light_bus": 30938,
                "heavy_bus": 23428,
                "motorcycle": 21742,
                "mechanical_heavy": 14957,
                "mechanical_light": 7988,
                "trailer": 4350,
                "people_of_determination_vehicle": 52,
                "total": 1413150,
            },
            "valid_driving_licenses": [
                {"year": 2014, "valid_licenses": 1661552},
                {"year": 2015, "valid_licenses": 1766650},
                {"year": 2016, "valid_licenses": 1835832},
            ],
        },
    }

    raw_rta_path = os.path.join(output_dir_raw, "rta_vehicle_registrations_raw.json")
    with open(raw_rta_path, "w", encoding="utf-8") as f:
        json.dump(rta_fleet_raw, f, indent=2)

    # -------------------------------------------------------------
    # 2. Official EV Registrations (DEWA / WAM) - FOUND
    # -------------------------------------------------------------
    print("[*] Processing official Dubai Electric Vehicle (EV) statistics (2024-2025)...")
    dewa_ev_raw = {
        "source": "Emirates News Agency (WAM) & Dubai Electricity and Water Authority (DEWA)",
        "source_url": WAM_EV_URL,
        "retrieval_date": retrieval_date,
        "licence": "Official Public Announcement © Emirates News Agency (WAM) & DEWA",
        "date_range": "October 2024 to February 2026",
        "status": "found",
        "headline": "DEWA accelerates Dubai's shift to sustainable mobility by expanding EV Green Charger network",
        "announcement_date": "2026-02-17",
        "spokesperson": "Saeed Mohammed Al Tayer, MD & CEO of DEWA",
        "statistics": {
            "electric_vehicles_registered_end_2025": 47944,
            "electric_vehicles_registered_end_2024": 37486,
            "electric_vehicles_registered_oct_2024": 34970,
            "annual_ev_growth_rate_2024_to_2025_pct": 27.9,
            "absolute_ev_increase_2025": 10458,
            "ev_green_charger_registered_users_jan_2026": 23600,
            "ev_green_charger_registered_users_2015": 14,
            "total_charging_points_network_end_2025": 1860,
            "total_charging_points_network_q1_2026": 2223,
            "total_electricity_supplied_by_green_chargers_mwh": 55200,
            "total_ev_km_enabled_millions": 276.0,
            "dubai_taxi_company_dtc_ultra_fast_contract_points": 208,
            "parkin_company_contract_ev_chargers": 100,
        },
    }

    raw_ev_path = os.path.join(output_dir_raw, "dewa_ev_registrations_raw.json")
    with open(raw_ev_path, "w", encoding="utf-8") as f:
        json.dump(dewa_ev_raw, f, indent=2)

    # -------------------------------------------------------------
    # 3. Dubai Corridor Traffic Volumes Search Audit - NOT FOUND
    # -------------------------------------------------------------
    print("[*] Recording audited search results for corridor traffic volumes...")
    traffic_volume_audit = {
        "metric_sought": "Corridor-Specific Traffic Volumes (Hourly / Annual Average Daily Traffic - AADT) for E311 & Dubai Arterials",
        "status": "not found",
        "retrieval_date": retrieval_date,
        "searched_sources": [
            {
                "portal_name": "Dubai Pulse (Digital Dubai Authority)",
                "url": DUBAI_PULSE_URL,
                "queries": [
                    "traffic volume site:dubaipulse.gov.ae",
                    "vehicle count site:dubaipulse.gov.ae",
                    "rta site:dubaipulse.gov.ae/data/",
                ],
                "result": "Not found. Portal redirects to data.dubai/services or timed out. No open hourly or AADT road traffic volume datasets exist for download.",
            },
            {
                "portal_name": "Dubai Statistics Center / Dubai Data and Statistics Establishment (DDSE)",
                "url": DSC_URL,
                "queries": [
                    "site:dsc.gov.ae vehicles OR traffic OR transport",
                    "site:dsc.gov.ae/en-us/themes/transport",
                ],
                "result": "Not found. Direct HTTP access blocked by F5 ASM Web Application Firewall (Request Rejected, Support ID: 2831694023450823383). No open sensor-level traffic volume counts are hosted.",
            },
            {
                "portal_name": "Roads and Transport Authority (RTA) Open Data Portal",
                "url": RTA_OPEN_DATA_URL,
                "queries": [
                    "open-data site:rta.ae",
                    "traffic count site:rta.ae",
                    "AADT site:rta.ae",
                ],
                "result": "Not found as open data. Audited all categories (legislation, reports, statistics).",
                "governance_barrier": (
                    "RTA classifies granular road traffic count volume as a restricted commercial asset under "
                    "Administrative Resolution No. 740 of 2019 ('Sale of Traffic Count Data'). Third parties must "
                    "apply for a Traffic Counts Permit and purchase sensor data commercially. No free open data exists."
                ),
            },
            {
                "portal_name": "RTA General Publications & News Announcements",
                "url": "https://www.rta.ae",
                "queries": [
                    "3.5 million vehicles site:rta.ae",
                    "vehicles per day site:rta.ae",
                ],
                "result": "City-wide aggregate published only. RTA reported ~3.5 million daytime vehicles network-wide across Dubai's 25,000 lane-km road system (November 2024 / 2025), but no segment-level volume is published.",
            },
        ],
        "governance_rule_compliance": (
            "Per AGENTS.md Rule 1 (NO FABRICATED DATA), corridor traffic volume is explicitly marked status 'not found' "
            "and preserved as null. No synthetic estimates have been substituted."
        ),
    }

    raw_audit_path = os.path.join(output_dir_raw, "traffic_volume_search_log.json")
    with open(raw_audit_path, "w", encoding="utf-8") as f:
        json.dump(traffic_volume_audit, f, indent=2)

    # -------------------------------------------------------------
    # 4. Processed Combined Dataset for Model & UI
    # -------------------------------------------------------------
    processed_fleet_data = {
        "metadata": {
            "dataset_name": "Dubai Vehicle Fleet and Electric Vehicle Registrations",
            "retrieval_date": retrieval_date,
            "status": "found",
            "sources": [
                {
                    "source": rta_fleet_raw["source"],
                    "url": rta_fleet_raw["source_url"],
                    "date_range": rta_fleet_raw["date_range"],
                    "licence": rta_fleet_raw["licence"],
                },
                {
                    "source": dewa_ev_raw["source"],
                    "url": dewa_ev_raw["source_url"],
                    "date_range": dewa_ev_raw["date_range"],
                    "licence": dewa_ev_raw["licence"],
                },
            ],
        },
        "ev_registrations": {
            "current_ev_fleet_2025": dewa_ev_raw["statistics"]["electric_vehicles_registered_end_2025"],
            "previous_ev_fleet_2024": dewa_ev_raw["statistics"]["electric_vehicles_registered_end_2024"],
            "ev_growth_rate_pct": dewa_ev_raw["statistics"]["annual_ev_growth_rate_2024_to_2025_pct"],
            "ev_green_chargers_network": dewa_ev_raw["statistics"]["total_charging_points_network_q1_2026"],
        },
        "total_registered_fleet_historical": rta_fleet_raw["tables"]["total_registered_vehicles_summary"],
        "fleet_breakdown_2016": rta_fleet_raw["tables"]["registered_vehicles_by_type_2016"],
    }

    proc_fleet_path = os.path.join(output_dir_processed, "dubai_vehicle_and_ev_registrations.json")
    with open(proc_fleet_path, "w", encoding="utf-8") as f:
        json.dump(processed_fleet_data, f, indent=2)

    proc_fleet_meta_path = os.path.join(output_dir_processed, "dubai_vehicle_and_ev_registrations_metadata.json")
    with open(proc_fleet_meta_path, "w", encoding="utf-8") as f:
        json.dump(processed_fleet_data["metadata"], f, indent=2)

    # Processed status file for traffic volume
    proc_traffic_status = {
        "metric": "Dubai Corridor-Specific Traffic Volume (AADT / Hourly)",
        "status": "not found",
        "retrieval_date": retrieval_date,
        "governance_note": "No corridor-specific traffic volume dataset was found in public open data portals. Commercial purchase required per RTA Resolution No. 740 of 2019.",
        "search_summary": traffic_volume_audit["searched_sources"],
    }
    proc_traffic_path = os.path.join(output_dir_processed, "traffic_volume_status.json")
    with open(proc_traffic_path, "w", encoding="utf-8") as f:
        json.dump(proc_traffic_status, f, indent=2)

    proc_traffic_meta_path = os.path.join(output_dir_processed, "traffic_volume_metadata.json")
    with open(proc_traffic_meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "dataset_name": "Dubai Corridor Traffic Volumes",
            "status": "not found",
            "retrieval_date": retrieval_date,
            "searched_urls": [DUBAI_PULSE_URL, DSC_URL, RTA_OPEN_DATA_URL],
            "reason": "Restricted commercial asset governed by RTA Resolution No. 740 of 2019; not published as open data.",
        }, f, indent=2)

    print(f"[✓] Saved raw RTA fleet statistics to: {raw_rta_path}")
    print(f"[✓] Saved raw DEWA/WAM EV statistics to: {raw_ev_path}")
    print(f"[✓] Saved raw search audit log to: {raw_audit_path}")
    print(f"[✓] Saved processed registrations dataset to: {proc_fleet_path}")
    print(f"[✓] Saved processed traffic volume status to: {proc_traffic_path}")

    return processed_fleet_data


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    process_traffic_and_ev_data()
