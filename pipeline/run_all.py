"""
Master Data Pipeline Runner for Dubai Charging Corridor Analysis.

Executes all data acquisition scripts in /pipeline:
1. NASA POWER: Solar irradiance and temperature
2. DEWA: Official electricity tariffs and EV charging rates
3. Registrations & Traffic: RTA fleet statistics, DEWA EV counts, and traffic volume status audit
"""

import os
import sys

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.fetch_nasa_power import fetch_nasa_power_data
from pipeline.fetch_dewa_tariffs import fetch_dewa_tariffs
from pipeline.fetch_traffic_and_ev_registrations import process_traffic_and_ev_data


def run_all_pipelines():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    print("======================================================================")
    print("  RUNNING DUBAI CHARGING CORRIDOR DATA PIPELINE")
    print("======================================================================")

    print("\n[1/3] Fetching NASA POWER solar and temperature data...")
    fetch_nasa_power_data()

    print("\n[2/3] Fetching DEWA official electricity tariff schedule...")
    fetch_dewa_tariffs()

    print("\n[3/3] Fetching vehicle registrations and auditing traffic volumes...")
    process_traffic_and_ev_data()

    print("\n======================================================================")
    print("  ALL PIPELINES EXECUTED SUCCESSFULLY")
    print("======================================================================")


if __name__ == "__main__":
    run_all_pipelines()
