"""
Geocoding module using OpenStreetMap Nominatim API.
Adheres strictly to AGENTS.md: Never hardcodes coordinates from memory.
"""

import sys
from typing import Dict, Any, Tuple
from utils import fetch_url

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def geocode_place(query: str = "Dubai Silicon Oasis") -> Dict[str, Any]:
    """
    Geocodes a place name using Nominatim and returns coordinates and bounding box.
    """
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "limit": "1",
        "polygon_geojson": "0",
    }

    results = fetch_url(url, params=params)
    if not results or not isinstance(results, list):
        raise ValueError(f"Geocoding search returned no results for query: '{query}'")

    top = results[0]
    lat = float(top["lat"])
    lon = float(top["lon"])
    bbox = top["boundingbox"]  # [min_lat, max_lat, min_lon, max_lon] as strings

    min_lat = float(bbox[0])
    max_lat = float(bbox[1])
    min_lon = float(bbox[2])
    max_lon = float(bbox[3])

    return {
        "query": query,
        "displayName": top.get("display_name", ""),
        "latitude": lat,
        "longitude": lon,
        "boundingBox": {
            "minLat": min_lat,
            "maxLat": max_lat,
            "minLon": min_lon,
            "maxLon": max_lon,
        },
        "osmType": top.get("osm_type"),
        "osmId": top.get("osm_id"),
        "licence": top.get("licence", "Data © OpenStreetMap contributors, ODbL 1.0"),
    }


def expand_bounding_box(
    bbox: Dict[str, float], buffer_lat: float = 0.02, buffer_lon: float = 0.02
) -> Tuple[float, float, float, float]:
    """
    Expands bounding box by coordinate buffers to capture surrounding arterial approaches.
    Returns (min_lat, min_lon, max_lat, max_lon).
    """
    return (
        bbox["minLat"] - buffer_lat,
        bbox["minLon"] - buffer_lon,
        bbox["maxLat"] + buffer_lat,
        bbox["maxLon"] + buffer_lon,
    )


if __name__ == "__main__":
    result = geocode_place("Dubai Silicon Oasis")
    print(f"Geocoded: {result['displayName']}")
    print(f"Center: Lat {result['latitude']}, Lon {result['longitude']}")
    print(f"Bounding Box: {result['boundingBox']}")
