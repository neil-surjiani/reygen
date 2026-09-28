"""
Shared utilities for the OpenStreetMap and Overpass data pipeline.
"""

import math
import ssl
import time
import urllib.parse
import urllib.request
import json
from typing import Dict, Any, List, Tuple, Optional

USER_AGENT = "DubaiRTA-CorridorAnalysis/1.0 (Research analysis for Dubai RTA dynamic wireless charging corridor; contact: rta-project@corridor.ae)"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]


def _get_ssl_context() -> ssl.SSLContext:
    """
    Creates an SSL context that tolerates Windows / enterprise proxy inspection
    if default certificate verification fails.
    """
    try:
        ctx = ssl.create_default_context()
        return ctx
    except Exception:
        ctx = ssl._create_unverified_context()
        return ctx


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two (lat, lon) points in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def calculate_line_length_m(coordinates: List[Tuple[float, float]]) -> float:
    """
    Calculates total length of a polyline given as [(lat, lon), ...] in meters.
    """
    if len(coordinates) < 2:
        return 0.0
    total = 0.0
    for i in range(len(coordinates) - 1):
        lat1, lon1 = coordinates[i]
        lat2, lon2 = coordinates[i + 1]
        total += haversine_distance_m(lat1, lon1, lat2, lon2)
    return total


def fetch_url(
    url: str,
    params: Optional[Dict[str, str]] = None,
    post_data: Optional[bytes] = None,
    timeout: int = 40,
    as_json: bool = True,
    retries: int = 3,
) -> Any:
    """
    Fetches response from an HTTP endpoint with appropriate headers, retries, and SSL fallback.
    Returns parsed JSON dict/list if as_json=True, else returns raw bytes or string.
    """
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    req = urllib.request.Request(
        url,
        data=post_data,
        headers={"User-Agent": USER_AGENT},
    )

    last_error = None
    for attempt in range(retries):
        for use_unverified in (False, True):
            try:
                ctx = ssl._create_unverified_context() if use_unverified else _get_ssl_context()
                with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
                    raw_bytes = response.read()
                    if as_json:
                        return json.loads(raw_bytes.decode("utf-8"))
                    return raw_bytes
            except Exception as e:
                last_error = e
                time.sleep(1.0 * (attempt + 1))
                continue

    raise RuntimeError(f"Failed to fetch {url} after {retries} retries. Last error: {last_error}")


def query_overpass(query_str: str) -> Dict[str, Any]:
    """
    Queries Overpass API with automatic fallback across mirrors and robust SSL handling.
    """
    post_body = f"data={urllib.parse.quote(query_str)}".encode("utf-8")
    last_err = None

    for endpoint in OVERPASS_ENDPOINTS:
        for use_unverified in (False, True):
            try:
                ctx = ssl._create_unverified_context() if use_unverified else _get_ssl_context()
                req = urllib.request.Request(
                    endpoint,
                    data=post_body,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                )
                with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                    raw_text = resp.read().decode("utf-8")
                    data = json.loads(raw_text)
                    if "elements" in data:
                        return data
            except Exception as e:
                last_err = e
                time.sleep(0.5)
                continue

    raise RuntimeError(f"All Overpass API endpoints failed. Last error: {last_err}")
