/**
/**
 * Type definitions for Corridor Route Simulation.
 * Strictly adheres to AGENTS.md:
 * - Speed profile derived from real OpenStreetMap tagged speed limits.
 * - Stopping at signals and slowing at junctions modeled as explicitly registered assumptions.
 * - Energy accounting per trip and per km using pure physics module.
 */

import type { EnergyLedger, EnvironmentConditions, SolarConfiguration, VehicleParameters } from "../physics/types";
import type { SupportedVehicleType } from "../registry/loader";

export interface GeoJsonCoordinate {
  longitude: number;
  latitude: number;
}

export interface RouteJunctionPoint {
  id: string;
  name: string | null;
  nameEn: string | null;
  ref: string | null;
  coordinates: [number, number]; // [lon, lat]
  distanceAlongRouteM: number;
}

export interface RouteTrafficSignalPoint {
  id: string;
  name: string | null;
  coordinates: [number, number]; // [lon, lat]
  distanceAlongRouteM: number;
}

export interface RouteSegment {
  id: string;
  osmId: number;
  name: string | null;
  nameEn: string | null;
  ref: string | null;
  highwayType: string;
  lengthM: number;
  taggedSpeedLimitKmh: number | null;
  effectiveCruiseSpeedKmh: number;
  effectiveCruiseSpeedMps: number;
  lanes: number | null;
  startDistanceM: number;
  endDistanceM: number;
  coordinates: [number, number][]; // [[lon, lat], ...]
  junctions: RouteJunctionPoint[];
  trafficSignals: RouteTrafficSignalPoint[];
}

export interface CorridorRoute {
  corridorId: string;
  name: string;
  totalLengthM: number;
  totalLengthKm: number;
  segments: RouteSegment[];
  junctionCount: number;
  trafficSignalCount: number;
  allJunctions: RouteJunctionPoint[];
  allTrafficSignals: RouteTrafficSignalPoint[];
}

export interface CoilSegmentPlacement {
  id?: string;
  startM: number;
  endM: number;
  coilPowerWatts?: number;
  couplingEfficiency?: number;
}

export interface SpeedProfileStep {
  stepIndex: number;
  segmentId: string;
  startDistanceM: number;
  endDistanceM: number;
  distanceDeltaM: number;
  vStartMps: number;
  vEndMps: number;
  vAvgMps: number;
  durationS: number;
  accelerationMps2: number;
  isCruise: boolean;
  isJunctionSlowdown: boolean;
  isSignalStop: boolean;
  isSignalWaitDwell: boolean;
  isOverCoil: boolean;
  coilActiveFraction?: number;
  activeCoilPowerWatts?: number;
  activeCouplingEfficiency?: number;
}

export interface SpeedProfile {
  steps: SpeedProfileStep[];
  totalDistanceM: number;
  totalDurationS: number;
  cruiseDurationS: number;
  stoppedDurationS: number;
  averageSpeedMps: number;
  averageSpeedKmh: number;
}

export interface RouteSimulationOptions {
  vehicleType: SupportedVehicleType;
  route: CorridorRoute;
  coils?: CoilSegmentPlacement[];
  rangeSelection?: "min" | "typical" | "max";
  vehicleOverrides?: Partial<VehicleParameters>;
  environmentOverrides?: Partial<EnvironmentConditions>;
  solarOverrides?: Partial<SolarConfiguration>;
  solarIrradianceWm2?: number; // 0 for night / no solar
  includeSignals?: boolean;
  includeJunctions?: boolean;
  signalStopProbability?: number; // defaults to assumptions registry value
  signalAverageWait_s?: number;   // defaults to assumptions registry value
  junctionSlowdownSpeed_kmh?: number; // defaults to assumptions registry value
  comfortableAccelMps2?: number; // defaults to 1.5 m/s²
  comfortableDecelMps2?: number; // defaults to 1.5 m/s²
}

export interface RouteSimulationResult {
  vehicleType: SupportedVehicleType;
  corridorId: string;
  totalDistanceM: number;
  totalDistanceKm: number;
  totalDurationS: number;
  averageSpeedKmh: number;
  speedProfile: SpeedProfile;
  ledgerPerTrip: EnergyLedger;
  ledgerPerKm: EnergyLedger;
  coilsSummary: {
    totalCoilSegments: number;
    totalCoilLengthM: number;
    coveragePct: number;
    totalCoilEnergyReceivedKwh: number;
  };
  assumptionsUsed: {
    vehicleMassKg: number;
    cdaM2: number;
    crr: number;
    driveEfficiency: number;
    regenEfficiency: number;
    auxWatts: number;
    signalStopProbability: number;
    signalAverageWait_s: number;
    junctionSlowdownSpeed_kmh: number;
    signalAssumptionNote: string;
  };
}
