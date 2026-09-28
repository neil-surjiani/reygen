"""
OpenStreetMap Data Pipeline for Dubai Silicon Oasis Charging Corridor Analysis.
Strictly adheres to AGENTS.md:
- Uses dynamic geocoding (no hardcoded coordinates).
- Fetches real geometry, maxspeeds, lane counts, traffic signals, and junctions from Overpass API.
- Never fabricates or fills in missing tags.
- Records exact query, timestamp, and OSM ODbL attribution in metadata.
"""

import argparse
import datetime
import json
import os
import re
import sys
from typing import Dict, Any, List, Tuple, Set, Optional

from geocode import geocode_place, expand_bounding_box
from utils import (
    haversine_distance_m,
    calculate_line_length_m,
    query_overpass,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ODBL_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright"


def canonicalize_corridor_key(tags: Dict[str, str]) -> Tuple[str, str]:
    """
    Determines canonical corridor ID and display label from OSM tags.
    """
    ref = tags.get("ref", "").strip()
    name_en = tags.get("name:en", "").strip()
    name_ar = tags.get("name", "").strip()

    # Normalization of common Dubai motorway/trunk refs
    clean_ref = re.sub(r"\s+", "", ref).upper()
    if "E311" in clean_ref or "311" in clean_ref:
        return "E311", "Sheikh Mohammed Bin Zayed Road (E311)"
    if "E66" in clean_ref or "66" in clean_ref:
        return "E66", "Dubai - Al Ain Road (E66)"
    if "D54" in clean_ref or "54" in clean_ref:
        return "D54", "Sheikh Zayed Bin Hamdan Al Nahyan Street (D54)"
    if "D67" in clean_ref or "67" in clean_ref:
        return "D67", "Manama Street / Academic City Road (D67)"

    # Fallback to English/Arabic names
    if name_en:
        norm = name_en.lower()
        if "mohammed bin zayed" in norm:
            return "E311", "Sheikh Mohammed Bin Zayed Road (E311)"
        if "al ain" in norm:
            return "E66", "Dubai - Al Ain Road (E66)"
        if "zayed bin hamdan" in norm:
            return "D54", "Sheikh Zayed Bin Hamdan Al Nahyan Street (D54)"
        if "academic city" in norm:
            return "Academic_City_Rd", f"Academic City Road ({name_en})"
        if "silicon" in norm:
            return "DSO_Internal", f"Dubai Silicon Oasis Internal - {name_en}"
        return re.sub(r"[^\w]+", "_", name_en), name_en

    if name_ar:
        if "محمد بن زايد" in name_ar:
            return "E311", "Sheikh Mohammed Bin Zayed Road (E311)"
        if "العين" in name_ar:
            return "E66", "Dubai - Al Ain Road (E66)"
        if "حمدان" in name_ar:
            return "D54", "Sheikh Zayed Bin Hamdan Al Nahyan Street (D54)"
        return re.sub(r"[^\w]+", "_", name_ar), name_ar

    if ref:
        return re.sub(r"[^\w]+", "_", ref), f"Road {ref}"

    return "unnamed_arterial", "Unnamed Arterial"


def discover_candidate_corridors(
    place_name: str = "Dubai Silicon Oasis", buffer_deg: float = 0.02
) -> Dict[str, Any]:
    """
    Locates Dubai Silicon Oasis via geocoding and queries Overpass for all arterial roads.
    Returns structured list of candidate corridors with lengths and segment details.
    """
    print(f"[*] Geocoding '{place_name}' via OpenStreetMap Nominatim...")
    geo = geocode_place(place_name)
    bbox = geo["boundingBox"]
    print(f"    Found: {geo['displayName']}")
    print(f"    Center: Lat {geo['latitude']:.6f}, Lon {geo['longitude']:.6f}")

    min_lat, min_lon, max_lat, max_lon = expand_bounding_box(bbox, buffer_deg, buffer_deg)
    print(
        f"[*] Querying Overpass API within expanded bounding box: "
        f"[{min_lat:.4f}, {min_lon:.4f}] to [{max_lat:.4f}, {max_lon:.4f}]..."
    )

    overpass_query = f"""[out:json][timeout:60];
(
  way["highway"~"^(motorway|trunk|primary|secondary)"]({min_lat},{min_lon},{max_lat},{max_lon});
);
out body geom;
"""
    result = query_overpass(overpass_query)
    elements = result.get("elements", [])
    print(f"    Received {len(elements)} OSM road ways from Overpass.")

    corridors: Dict[str, Dict[str, Any]] = {}

    for el in elements:
        if el.get("type") != "way":
            continue

        tags = el.get("tags", {})
        geom = el.get("geometry", [])
        if not geom:
            continue

        coords = [(pt["lat"], pt["lon"]) for pt in geom]
        length_m = calculate_line_length_m(coords)
        length_km = length_m / 1000.0

        corridor_id, corridor_label = canonicalize_corridor_key(tags)

        if corridor_id not in corridors:
            corridors[corridor_id] = {
                "id": corridor_id,
                "label": corridor_label,
                "highwayTypes": set(),
                "refs": set(),
                "namesEn": set(),
                "namesAr": set(),
                "totalLengthKm": 0.0,
                "segmentCount": 0,
                "maxspeeds": set(),
                "lanes": set(),
                "segmentsWithMaxspeed": 0,
                "segmentsMissingMaxspeed": 0,
                "ways": [],
            }

        c = corridors[corridor_id]
        c["totalLengthKm"] += length_km
        c["segmentCount"] += 1
        c["ways"].append(el)

        hw = tags.get("highway")
        if hw:
            c["highwayTypes"].add(hw)

        rf = tags.get("ref")
        if rf:
            c["refs"].add(rf)

        ne = tags.get("name:en")
        if ne:
            c["namesEn"].add(ne)

        na = tags.get("name")
        if na:
            c["namesAr"].add(na)

        ms = tags.get("maxspeed")
        if ms:
            c["maxspeeds"].add(ms)
            c["segmentsWithMaxspeed"] += 1
        else:
            c["segmentsMissingMaxspeed"] += 1

        ln = tags.get("lanes")
        if ln:
            c["lanes"].add(ln)

    # Convert sets to sorted lists for serialization
    processed_candidates = []
    for cid, c in corridors.items():
        processed_candidates.append({
            "id": c["id"],
            "label": c["label"],
            "totalLengthKm": round(c["totalLengthKm"], 2),
            "segmentCount": c["segmentCount"],
            "highwayTypes": sorted(list(c["highwayTypes"])),
            "refs": sorted(list(c["refs"])),
            "namesEn": sorted(list(c["namesEn"])),
            "namesAr": sorted(list(c["namesAr"])),
            "maxspeedTags": sorted(list(c["maxspeeds"])),
            "laneTags": sorted(list(c["lanes"])),
            "segmentsWithMaxspeed": c["segmentsWithMaxspeed"],
            "segmentsMissingMaxspeed": c["segmentsMissingMaxspeed"],
        })

    # Sort by total arterial length descending
    processed_candidates.sort(key=lambda x: x["totalLengthKm"], reverse=True)

    return {
        "geocoding": geo,
        "searchBoundingBox": {
            "minLat": min_lat,
            "minLon": min_lon,
            "maxLat": max_lat,
            "maxLon": max_lon,
        },
        "query": overpass_query,
        "candidates": processed_candidates,
    }


def fetch_and_process_corridor(
    corridor_id: str,
    place_name: str = "Dubai Silicon Oasis",
    output_dir_raw: str = "data/raw",
    output_dir_processed: str = "data/processed",
    buffer_deg: float = 0.03,
) -> Dict[str, Any]:
    """
    Fetches full corridor geometry, maxspeed, lanes, junctions, and traffic signals.
    Saves raw and processed GeoJSON with full metadata and ODbL attribution.
    """
    print(f"[*] Geocoding '{place_name}'...")
    geo = geocode_place(place_name)
    bbox = geo["boundingBox"]
    min_lat, min_lon, max_lat, max_lon = expand_bounding_box(bbox, buffer_deg, buffer_deg)

    print(f"[*] Constructing detailed Overpass query for corridor '{corridor_id}'...")

    # Define query filter based on chosen corridor
    id_upper = corridor_id.upper()
    if id_upper == "E311":
        way_filter = """
          way["highway"~"^(motorway|trunk|primary)"]["ref"~"311"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary)"]["name:en"~"Mohammed Bin Zayed",i]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary)"]["name"~"محمد بن زايد"]({min_lat},{min_lon},{max_lat},{max_lon});
        """
    elif id_upper == "E66":
        way_filter = """
          way["highway"~"^(motorway|trunk|primary)"]["ref"~"66"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary)"]["name:en"~"Al Ain",i]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary)"]["name"~"العين"]({min_lat},{min_lon},{max_lat},{max_lon});
        """
    elif id_upper == "D54":
        way_filter = """
          way["highway"~"^(motorway|trunk|primary)"]["ref"~"54"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary)"]["name:en"~"Zayed Bin Hamdan",i]({min_lat},{min_lon},{max_lat},{max_lon});
        """
    elif id_upper in ("D67", "MANAMA"):
        way_filter = """
          way["highway"~"^(primary|secondary)"]["ref"~"67"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(primary|secondary)"]["name:en"~"Manama|Academic City",i]({min_lat},{min_lon},{max_lat},{max_lon});
        """
    else:
        # Generic name search
        way_filter = f"""
          way["highway"~"^(motorway|trunk|primary|secondary)"]["name:en"~"{corridor_id}",i]({min_lat},{min_lon},{max_lat},{max_lon});
          way["highway"~"^(motorway|trunk|primary|secondary)"]["ref"~"{corridor_id}",i]({min_lat},{min_lon},{max_lat},{max_lon});
        """

    way_filter_formatted = way_filter.format(
        min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon
    )

    detailed_query = f"""[out:json][timeout:90];
(
  {way_filter_formatted}
)->.corridor_ways;

(
  .corridor_ways;
  node(w.corridor_ways)["highway"="traffic_signals"];
  node(w.corridor_ways)["highway"="motorway_junction"];
);
out body geom;
"""

    print("[*] Fetching corridor ways, signals, and junctions from Overpass API...")
    overpass_data = query_overpass(detailed_query)
    elements = overpass_data.get("elements", [])
    print(f"    Received {len(elements)} raw elements from Overpass.")

    # Separate elements into ways and nodes
    ways = [el for el in elements if el.get("type") == "way"]
    nodes = [el for el in elements if el.get("type") == "node"]

    if not ways:
        raise ValueError(
            f"No road ways found for corridor '{corridor_id}'. Check query filter or candidate list."
        )

    # Calculate statistics
    total_length_m = 0.0
    segments_with_maxspeed = 0
    segments_missing_maxspeed = 0
    traffic_signal_count = 0
    junction_count = 0

    features = []

    # Process road segments into LineString GeoJSON features
    for w in ways:
        tags = w.get("tags", {})
        geom = w.get("geometry", [])
        if not geom or len(geom) < 2:
            continue

        coords = [(pt["lon"], pt["lat"]) for pt in geom]  # GeoJSON expects [lon, lat]
        latlon_pairs = [(pt["lat"], pt["lon"]) for pt in geom]
        seg_length_m = calculate_line_length_m(latlon_pairs)
        total_length_m += seg_length_m

        has_maxspeed = "maxspeed" in tags
        if has_maxspeed:
            segments_with_maxspeed += 1
        else:
            segments_missing_maxspeed += 1

        feature = {
            "type": "Feature",
            "id": f"way/{w['id']}",
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "osm_id": w["id"],
                "osm_type": "way",
                "name": tags.get("name"),
                "name_en": tags.get("name:en"),
                "ref": tags.get("ref"),
                "highway": tags.get("highway"),
                "lanes": tags.get("lanes"),
                "maxspeed": tags.get("maxspeed"),
                "has_maxspeed": has_maxspeed,
                "oneway": tags.get("oneway"),
                "surface": tags.get("surface"),
                "bridge": tags.get("bridge"),
                "tunnel": tags.get("tunnel"),
                "length_m": round(seg_length_m, 2),
            },
        }
        features.append(feature)

    # Process nodes into Point GeoJSON features
    for n in nodes:
        tags = n.get("tags", {})
        node_hw = tags.get("highway")
        point_type = "node"

        if node_hw == "traffic_signals":
            traffic_signal_count += 1
            point_type = "traffic_signal"
        elif node_hw == "motorway_junction" or "junction" in tags:
            junction_count += 1
            point_type = "junction"

        feature = {
            "type": "Feature",
            "id": f"node/{n['id']}",
            "geometry": {
                "type": "Point",
                "coordinates": [n["lon"], n["lat"]],
            },
            "properties": {
                "osm_id": n["id"],
                "osm_type": "node",
                "point_type": point_type,
                "highway": node_hw,
                "name": tags.get("name"),
                "name_en": tags.get("name:en"),
                "ref": tags.get("ref"),
            },
        }
        features.append(feature)

    total_segments = len(ways)
    missing_pct = (
        (segments_missing_maxspeed / total_segments * 100.0) if total_segments > 0 else 0.0
    )

    metadata = {
        "corridorId": corridor_id,
        "placeName": place_name,
        "geocoding": geo,
        "searchBoundingBox": {
            "minLat": min_lat,
            "minLon": min_lon,
            "maxLat": max_lat,
            "maxLon": max_lon,
        },
        "query": detailed_query.strip(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "attribution": ODBL_ATTRIBUTION,
        "statistics": {
            "totalSegments": total_segments,
            "totalLengthKm": round(total_length_m / 1000.0, 3),
            "segmentsWithMaxspeed": segments_with_maxspeed,
            "segmentsMissingMaxspeed": segments_missing_maxspeed,
            "segmentsMissingMaxspeedPct": round(missing_pct, 2),
            "trafficSignalsCount": traffic_signal_count,
            "junctionsCount": junction_count,
            "governanceNote": "Per AGENTS.md, missing tags are preserved as null/empty without invented gap-filling.",
        },
    }

    # Ensure output directories exist
    os.makedirs(output_dir_raw, exist_ok=True)
    os.makedirs(output_dir_processed, exist_ok=True)

    slug = re.sub(r"[^\w\-]+", "_", corridor_id.lower())

    # 1. Save raw Overpass response JSON
    raw_overpass_path = os.path.join(output_dir_raw, f"{slug}_overpass_raw.json")
    with open(raw_overpass_path, "w", encoding="utf-8") as f:
        json.dump(overpass_data, f, indent=2, ensure_ascii=False)

    # 2. Save raw GeoJSON representation
    raw_geojson = {
        "type": "FeatureCollection",
        "metadata": metadata,
        "features": features,
    }
    raw_geojson_path = os.path.join(output_dir_raw, f"{slug}.geojson")
    with open(raw_geojson_path, "w", encoding="utf-8") as f:
        json.dump(raw_geojson, f, indent=2, ensure_ascii=False)

    raw_meta_path = os.path.join(output_dir_raw, f"{slug}_metadata.json")
    with open(raw_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    # 3. Save processed GeoJSON representation
    processed_geojson = {
        "type": "FeatureCollection",
        "metadata": metadata,
        "features": features,
    }

    proc_path = os.path.join(output_dir_processed, f"{slug}.geojson")
    with open(proc_path, "w", encoding="utf-8") as f:
        json.dump(processed_geojson, f, indent=2, ensure_ascii=False)

    proc_meta_path = os.path.join(output_dir_processed, f"{slug}_metadata.json")
    with open(proc_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"[✓] Saved raw Overpass API response to: {raw_overpass_path}")
    print(f"[✓] Saved raw GeoJSON to: {raw_geojson_path}")
    print(f"[✓] Saved processed GeoJSON to: {proc_path}")
    print(f"[✓] Saved metadata to: {proc_meta_path}")

    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="OpenStreetMap Overpass data pipeline for Dubai charging corridors"
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Locate Dubai Silicon Oasis and list candidate arterial corridors with lengths",
    )
    parser.add_argument(
        "--fetch",
        type=str,
        help="Corridor identifier to fetch and process (e.g. E311, E66, D54)",
    )
    parser.add_argument(
        "--place",
        type=str,
        default="Dubai Silicon Oasis",
        help="Place name for geocoding anchor (default: 'Dubai Silicon Oasis')",
    )

    args = parser.parse_args()

    if args.discover or (not args.fetch and not args.discover):
        result = discover_candidate_corridors(args.place)
        print("\n" + "=" * 70)
        print("  CANDIDATE ARTERIAL CORRIDORS AROUND DUBAI SILICON OASIS")
        print("=" * 70)
        print(f"Anchor: {result['geocoding']['displayName']}")
        print(
            f"Center: Lat {result['geocoding']['latitude']:.6f}, "
            f"Lon {result['geocoding']['longitude']:.6f}"
        )
        print("-" * 70)

        for i, c in enumerate(result["candidates"], start=1):
            hw_types = ", ".join(c["highwayTypes"])
            maxspeeds = ", ".join(c["maxspeedTags"]) if c["maxspeedTags"] else "None tagged"
            lanes = ", ".join(c["laneTags"]) if c["laneTags"] else "None tagged"
            refs = ", ".join(c["refs"]) if c["refs"] else "No ref"

            print(f"[{i}] Corridor ID: {c['id']}")
            print(f"    Label:       {c['label']}")
            print(f"    Ref:         {refs}")
            print(f"    Class:       {hw_types}")
            print(f"    Length:      {c['totalLengthKm']:.2f} km across {c['segmentCount']} OSM segments")
            print(f"    Maxspeed:    {maxspeeds}")
            print(f"    Lanes:       {lanes}")
            print(
                f"    Tag Status:  {c['segmentsWithMaxspeed']} segments with maxspeed, "
                f"{c['segmentsMissingMaxspeed']} segments missing maxspeed"
            )
            print("-" * 70)

        print("\nPlease choose a candidate corridor from the list above to confirm.")
        print("Example next step: run with --fetch <CORRIDOR_ID> (e.g., E311, E66, or D54).")

    elif args.fetch:
        metadata = fetch_and_process_corridor(args.fetch, place_name=args.place)
        stats = metadata["statistics"]
        print("\n" + "=" * 70)
        print(f"  CORRIDOR '{args.fetch}' FETCH & PROCESSING REPORT")
        print("=" * 70)
        print(f"Total Corridor Length:        {stats['totalLengthKm']:.3f} km")
        print(f"Total OSM Road Segments:      {stats['totalSegments']}")
        print(f"Segments with maxspeed tag:   {stats['segmentsWithMaxspeed']}")
        print(
            f"Segments lacking maxspeed:    {stats['segmentsMissingMaxspeed']} "
            f"({stats['segmentsMissingMaxspeedPct']:.1f}%)"
        )
        print(f"Traffic Signals Identified:   {stats['trafficSignalsCount']}")
        print(f"Motorway/Arterial Junctions:  {stats['junctionsCount']}")
        print(f"ODbL Attribution:             {metadata['attribution']}")
        print(f"Governance Note:              {stats['governanceNote']}")
        print("=" * 70)


if __name__ == "__main__":
    main()
