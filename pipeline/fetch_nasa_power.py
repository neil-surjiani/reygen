"""
NASA POWER Solar Irradiance and Temperature Pipeline for Dubai.

Fetches solar irradiance (ALLSKY_SFC_SW_DWN) and ambient temperature (T2M, T2M_MIN, T2M_MAX)
from the NASA POWER public API for Dubai Silicon Oasis / Dubai corridor coordinates.
Saves raw data and processed datasets with complete metadata and license information.
"""

import os
import sys
import json
import datetime
from typing import Dict, Any

# Ensure parent directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from pipeline.utils import fetch_url

# Standard Dubai Silicon Oasis coordinates from corridor geocoding
DUBAI_LAT = 25.1217
DUBAI_LON = 55.3855

CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"

LICENCE = "NASA Open Data Policy (Public Domain / Free for all research and commercial use: https://open.nasa.gov/open-data/)"
SOURCE_NAME = "NASA Prediction Of Worldwide Energy Resources (POWER) Project"


def fetch_nasa_power_data(output_dir_raw: str = "data/raw", output_dir_processed: str = "data/processed") -> Dict[str, Any]:
    print("[*] Querying NASA POWER Climatology API for Dubai (Lat 25.1217, Lon 55.3855)...")
    climatology_params = {
        "parameters": "ALLSKY_SFC_SW_DWN,T2M,T2M_MAX,T2M_MIN",
        "community": "RE",
        "longitude": str(DUBAI_LON),
        "latitude": str(DUBAI_LAT),
        "format": "JSON",
    }
    raw_climatology = fetch_url(CLIMATOLOGY_URL, params=climatology_params, timeout=45)

    print("[*] Querying NASA POWER Monthly Time Series (2020-2024)...")
    monthly_params = {
        "parameters": "ALLSKY_SFC_SW_DWN,T2M,T2M_MAX,T2M_MIN",
        "community": "RE",
        "longitude": str(DUBAI_LON),
        "latitude": str(DUBAI_LAT),
        "start": "2020",
        "end": "2024",
        "format": "JSON",
    }
    raw_monthly = fetch_url(MONTHLY_URL, params=monthly_params, timeout=45)

    retrieval_date = datetime.datetime.now(datetime.timezone.utc).isoformat()

    os.makedirs(output_dir_raw, exist_ok=True)
    os.makedirs(output_dir_processed, exist_ok=True)

    # 1. Save raw data
    raw_combined = {
        "location": {"latitude": DUBAI_LAT, "longitude": DUBAI_LON, "name": "Dubai Silicon Oasis, UAE"},
        "retrieval_date": retrieval_date,
        "climatology_raw": raw_climatology,
        "monthly_raw": raw_monthly,
    }
    raw_data_path = os.path.join(output_dir_raw, "nasa_power_solar_temperature_dubai.json")
    with open(raw_data_path, "w", encoding="utf-8") as f:
        json.dump(raw_combined, f, indent=2)

    # Raw metadata
    metadata = {
        "dataset_name": "Dubai Solar Irradiance and Ambient Temperature",
        "source": SOURCE_NAME,
        "source_urls": [CLIMATOLOGY_URL, MONTHLY_URL],
        "retrieval_date": retrieval_date,
        "licence": LICENCE,
        "location": {
            "name": "Dubai Silicon Oasis, Dubai, UAE",
            "latitude": DUBAI_LAT,
            "longitude": DUBAI_LON,
        },
        "date_ranges": {
            "climatology": "2001-01 to 2020-12 (20-year meteorological climatology)",
            "monthly_time_series": "2020-01 to 2024-12",
        },
        "parameters": {
            "ALLSKY_SFC_SW_DWN": "All Sky Surface Shortwave Downward Irradiance (Global Horizontal Irradiance, kWh/m²/day)",
            "T2M": "Air Temperature at 2 Meters (°C)",
            "T2M_MAX": "Maximum Air Temperature at 2 Meters (°C)",
            "T2M_MIN": "Minimum Air Temperature at 2 Meters (°C)",
        },
        "status": "found",
        "notes": "Official public data from NASA Langley Research Center POWER Project.",
    }
    raw_meta_path = os.path.join(output_dir_raw, "nasa_power_solar_temperature_dubai_metadata.json")
    with open(raw_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # 2. Process into structured model format
    clim_params = raw_climatology.get("properties", {}).get("parameter", {})
    t2m_clim = clim_params.get("T2M", {})
    t2m_max_clim = clim_params.get("T2M_MAX", {})
    t2m_min_clim = clim_params.get("T2M_MIN", {})
    solar_clim = clim_params.get("ALLSKY_SFC_SW_DWN", {})

    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    monthly_climatology_processed = []

    for idx, m in enumerate(months, start=1):
        ghi_kwh = solar_clim.get(m)
        # Average continuous daytime flux estimate (kWh/m2/day * 1000 / 24 hours = average hourly W/m^2 over 24h)
        # Peak daytime insolation is approximately (ghi_kwh / peak_sun_hours * 1000)
        monthly_climatology_processed.append({
            "month_index": idx,
            "month_code": m,
            "t2m_avg_c": t2m_clim.get(m),
            "t2m_max_c": t2m_max_clim.get(m),
            "t2m_min_c": t2m_min_clim.get(m),
            "solar_ghi_kwh_per_m2_day": ghi_kwh,
            "average_insolation_w_per_m2": round(ghi_kwh * 1000.0 / 24.0, 2) if ghi_kwh else None,
        })

    # Process monthly time series
    month_params = raw_monthly.get("properties", {}).get("parameter", {})
    t2m_series = month_params.get("T2M", {})
    solar_series = month_params.get("ALLSKY_SFC_SW_DWN", {})

    time_series_processed = []
    for key, val in sorted(t2m_series.items()):
        if key.endswith("13"):  # NASA uses 13 for annual average
            continue
        solar_val = solar_series.get(key)
        time_series_processed.append({
            "year_month": f"{key[:4]}-{key[4:]}",
            "t2m_avg_c": val if val != -999.0 else None,
            "solar_ghi_kwh_per_m2_day": solar_val if solar_val != -999.0 else None,
        })

    processed_data = {
        "metadata": metadata,
        "climatology_summary": {
            "annual_avg_t2m_c": t2m_clim.get("ANN"),
            "annual_avg_solar_ghi_kwh_m2_day": solar_clim.get("ANN"),
            "monthly_climatology": monthly_climatology_processed,
        },
        "monthly_time_series": time_series_processed,
    }

    processed_path = os.path.join(output_dir_processed, "solar_temperature_dubai.json")
    with open(processed_path, "w", encoding="utf-8") as f:
        json.dump(processed_data, f, indent=2)

    proc_meta_path = os.path.join(output_dir_processed, "solar_temperature_dubai_metadata.json")
    with open(proc_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[✓] Saved raw data to: {raw_data_path}")
    print(f"[✓] Saved processed data to: {processed_path}")
    print(f"[✓] Saved metadata to: {proc_meta_path}")

    return metadata


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    fetch_nasa_power_data()
