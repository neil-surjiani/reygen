"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map, StyleSpecification, MapLayerMouseEvent } from "maplibre-gl";
import type { CorridorRoute } from "@/lib/route/types";

export interface ActiveCoilZone {
  id: string;
  name: string;
  startKm: number;
  endKm: number;
  active: boolean;
}

interface GeoJsonLineFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: Record<string, unknown>;
}

interface CorridorMapProps {
  route: CorridorRoute;
  coveragePct: number;
  activeZones: ActiveCoilZone[];
  enableSignalPads: boolean;
  className?: string;
}

const lightMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    "esri-light": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "esri-light-layer",
      type: "raster",
      source: "esri-light",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export default function CorridorMap({
  route,
  coveragePct,
  activeZones,
  enableSignalPads,
  className = "",
}: CorridorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Bounds for Dubai E311 corridor around Dubai Silicon Oasis
    const bounds: [number, number, number, number] = [
      55.32, 25.07, 55.44, 25.17,
    ];

    if (typeof window !== "undefined") {
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: lightMapStyle,
      center: [55.38, 25.12],
      zoom: 11.5,
      maxBounds: [55.15, 24.95, 55.65, 25.35],
      keyboard: true,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    map.on("load", () => {
      // 1. Add Corridor Line GeoJSON
      const corridorFeatures = route.segments.map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: s.coordinates,
        },
        properties: {
          id: s.id,
          name: s.nameEn || s.name || "E311 Sheikh Mohammed Bin Zayed Road",
          speedLimit: s.taggedSpeedLimitKmh ?? 100,
          lanes: s.lanes ?? 4,
          startKm: (s.startDistanceM / 1000).toFixed(1),
          endKm: (s.endDistanceM / 1000).toFixed(1),
        },
      }));

      map.addSource("corridor-line-src", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: corridorFeatures,
        },
      });

      // Corridor base casing
      map.addLayer({
        id: "corridor-casing",
        type: "line",
        source: "corridor-line-src",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.4,
        },
      });

      // Corridor core line
      map.addLayer({
        id: "corridor-core",
        type: "line",
        source: "corridor-line-src",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#111111",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      // 2. Add Coil Segments Source & Layer
      map.addSource("coil-segments-src", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "coil-glow",
        type: "line",
        source: "coil-segments-src",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#14532d",
          "line-width": 10,
          "line-opacity": 0.4,
          "line-blur": 3,
        },
      });

      map.addLayer({
        id: "coil-core",
        type: "line",
        source: "coil-segments-src",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#14532d",
          "line-width": 4,
          "line-opacity": 1.0,
        },
      });

      // 3. Add Motorway Junctions
      const junctionFeatures = route.allJunctions.map((j) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: j.coordinates,
        },
        properties: {
          id: j.id,
          name: j.nameEn || j.name || "Motorway Interchange",
          ref: j.ref || "Exit",
          distanceKm: (j.distanceAlongRouteM / 1000).toFixed(1),
        },
      }));

      map.addSource("junctions-src", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: junctionFeatures,
        },
      });

      map.addLayer({
        id: "junctions-outer",
        type: "circle",
        source: "junctions-src",
        paint: {
          "circle-radius": 7,
          "circle-color": "#14532d",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "junctions-inner",
        type: "circle",
        source: "junctions-src",
        paint: {
          "circle-radius": 3,
          "circle-color": "#fff",
        },
      });

      // 4. Add Signal Charging Pads Source
      map.addSource("signal-pads-src", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "signal-pads-outer",
        type: "circle",
        source: "signal-pads-src",
        paint: {
          "circle-radius": 8,
          "circle-color": "#14532d",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "signal-pads-inner",
        type: "circle",
        source: "signal-pads-src",
        paint: {
          "circle-radius": 4,
          "circle-color": "#ffffff",
        },
      });

      // Click on junction
      map.on("click", "junctions-outer", (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const props = feat.properties as {
          id: string;
          name: string;
          ref: string;
          distanceKm: string;
        };
        const coords = (
          feat.geometry as unknown as { coordinates: [number, number] }
        ).coordinates;

        new maplibregl.Popup({ closeButton: true, className: "custom-popup" })
          .setLngLat(coords)
          .setHTML(
            `<div style="color: #111111; padding: 4px; font-family: sans-serif;">
              <strong style="display: block; font-size: 13px; color: #14532d;">${props.name}</strong>
              <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">
                Position: ${props.distanceKm} km along corridor<br/>
                Reference: ${props.ref}<br/>
                OSM ID: ${props.id}
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "junctions-outer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "junctions-outer", () => {
        map.getCanvas().style.cursor = "";
      });

      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 30 }
      );

      mapRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Update dynamic coil segments when coverage or active zones change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const coilSrc = map.getSource("coil-segments-src") as
      maplibregl.GeoJSONSource | undefined;
    if (!coilSrc) return;

    // Collect active electrified ranges in meters
    const activeRanges: [number, number][] = [];

    // 1. Check if discrete zones are active
    const activePresetZones = activeZones.filter((z) => z.active);
    if (activePresetZones.length > 0) {
      for (const z of activePresetZones) {
        activeRanges.push([z.startKm * 1000.0, z.endKm * 1000.0]);
      }
    } else if (coveragePct > 0) {
      // 2. Otherwise use continuous coverage slider
      const coilEndM = (route.totalLengthM * coveragePct) / 100.0;
      activeRanges.push([0, coilEndM]);
    }

    // Build sub-LineStrings along route segments overlapping activeRanges
    const coilFeatures: GeoJsonLineFeature[] = [];

    for (const [rStart, rEnd] of activeRanges) {
      for (const seg of route.segments) {
        if (seg.startDistanceM < rEnd && seg.endDistanceM > rStart) {
          // Segment intersects active range: extract overlapping coordinates
          const segStart = seg.startDistanceM;
          const segEnd = seg.endDistanceM;
          const coords = seg.coordinates;

          if (coords.length >= 2) {
            const f1 = Math.max(0, (rStart - segStart) / (segEnd - segStart));
            const f2 = Math.min(1, (rEnd - segStart) / (segEnd - segStart));

            const idx1 = Math.floor(f1 * (coords.length - 1));
            const idx2 = Math.min(
              coords.length - 1,
              Math.ceil(f2 * (coords.length - 1))
            );

            const slice = coords.slice(idx1, idx2 + 1);
            if (slice.length >= 2) {
              coilFeatures.push({
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: slice,
                },
                properties: {},
              });
            }
          }
        }
      }
    }

    coilSrc.setData({
      type: "FeatureCollection",
      features: coilFeatures,
    });
  }, [coveragePct, activeZones, mapLoaded, route]);

  // Update stationary signal charging pads
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const padsSrc = map.getSource("signal-pads-src") as
      maplibregl.GeoJSONSource | undefined;
    if (!padsSrc) return;

    if (!enableSignalPads) {
      padsSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    // Place stationary pads at junction nodes / signalized locations
    const padFeatures = route.allJunctions.slice(0, 6).map((j, i) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: j.coordinates,
      },
      properties: {
        id: `pad_${i + 1}`,
        name: `Stationary Dwell Pad: ${j.nameEn || j.name || "Interchange"}`,
        power: "50 kW",
      },
    }));

    padsSrc.setData({
      type: "FeatureCollection",
      features: padFeatures,
    });
  }, [enableSignalPads, mapLoaded, route]);

  const fitCorridor = () => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [55.32, 25.07],
        [55.44, 25.17],
      ],
      { padding: 40, duration: 1000 }
    );
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl ${className}`}
    >
      {/* Map canvas container */}
      <div
        ref={mapContainerRef}
        className="h-[480px] w-full"
        aria-label="MapLibre dynamic wireless corridor map"
        role="region"
      />

      {/* Floating map controls & legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={fitCorridor}
          className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-md backdrop-blur hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          aria-label="Reset map view to corridor bounds"
        >
          ⤢ Fit Corridor View
        </button>
      </div>

      {/* Corridor Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-[11px] text-slate-300 shadow-xl backdrop-blur">
        <div className="mb-2 font-semibold text-white">
          Corridor Layer Legend
        </div>
        <div className="space-y-1.5 font-sans">
          <div className="flex items-center gap-2">
            <span className="h-1 w-5 rounded bg-black"></span>
            <span>Sheikh Mohammed Bin Zayed Rd (E311) - 29.2 km</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-5 rounded bg-emerald-900"></span>
            <span>
              Active Dynamic Wireless Coils ({coveragePct.toFixed(0)}% Coverage)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-white bg-emerald-900"></span>
            <span>OSM Motorway Interchanges (12 Junctions)</span>
          </div>
          {enableSignalPads && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-white bg-emerald-900"></span>
              <span>Stationary Dwell Charging Pads (Active)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
