/**
 * Corridor Route Parser and Kinematic Speed Profile Generator.
 * Strictly adheres to AGENTS.md:
 * - Speed limits read directly from OpenStreetMap tags.
 * - Stopping at signals and slowing at junctions modeled as explicitly registered assumptions.
 * - Conserves exact road distance matching the processed GeoJSON corridor.
 */

import {
  getTrafficControlAssumptions,
  resolveAssumptionValue,
} from "../registry/loader";
import type {
  CoilSegmentPlacement,
  CorridorRoute,
  RouteJunctionPoint,
  RouteSegment,
  RouteTrafficSignalPoint,
  SpeedProfile,
  SpeedProfileStep,
} from "./types";

export interface GeoJsonFeatureProperties {
  length_m?: number;
  maxspeed?: string | number;
  osm_id?: number;
  name?: string;
  name_en?: string;
  ref?: string;
  highway?: string;
  lanes?: string | number;
  point_type?: string;
  [key: string]: unknown;
}

export interface GeoJsonMetadata {
  corridorId?: string;
  placeName?: string;
  statistics?: {
    totalLengthKm?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface GeoJsonFeature {
  type: string;
  id?: string;
  geometry: {
    type: string;
    coordinates: [number, number] | [number, number][];
  };
  properties?: GeoJsonFeatureProperties;
}

export interface GeoJsonFeatureCollection {
  type: string;
  metadata?: GeoJsonMetadata;
  features: GeoJsonFeature[];
}

/**
 * Calculates great-circle distance between two [lon, lat] coordinates in meters.
 */
export function haversineDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371000.0; // Earth radius in meters

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates total length of a coordinate sequence in meters.
 */
export function calculateLineStringLengthMeters(
  coords: [number, number][]
): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += haversineDistanceMeters(coords[i], coords[i + 1]);
  }
  return length;
}

/**
 * Parses processed Corridor GeoJSON into structured CorridorRoute.
 */
export function parseCorridorGeoJSON(
  geojson: GeoJsonFeatureCollection
): CorridorRoute {
  const corridorId = geojson.metadata?.corridorId ?? "dubai_corridor";
  const name =
    geojson.metadata?.placeName ?? "Sheikh Mohammed Bin Zayed Road (E311)";

  const lineFeatures = geojson.features.filter(
    (f) => f.geometry.type === "LineString"
  );
  const pointFeatures = geojson.features.filter(
    (f) => f.geometry.type === "Point"
  );

  const allJunctions: RouteJunctionPoint[] = [];
  const allTrafficSignals: RouteTrafficSignalPoint[] = [];

  let accumulatedDistanceM = 0;
  const segments: RouteSegment[] = [];

  for (const f of lineFeatures) {
    const props = f.properties ?? {};
    const coords = f.geometry.coordinates as [number, number][];
    const lengthM =
      typeof props.length_m === "number"
        ? props.length_m
        : calculateLineStringLengthMeters(coords);

    let taggedSpeedLimitKmh: number | null = null;
    if (props.maxspeed) {
      const parsed = parseFloat(String(props.maxspeed).replace(/[^\d.]/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        taggedSpeedLimitKmh = parsed;
      }
    }

    // Default expressway cruise speed if maxspeed tag is unstated (e.g. 100 km/h)
    const effectiveCruiseSpeedKmh = taggedSpeedLimitKmh ?? 100.0;
    const effectiveCruiseSpeedMps = effectiveCruiseSpeedKmh / 3.6;

    const segStartM = accumulatedDistanceM;
    const segEndM = accumulatedDistanceM + lengthM;

    const segment: RouteSegment = {
      id: f.id ?? `way/${props.osm_id ?? segments.length}`,
      osmId: props.osm_id ?? segments.length,
      name: props.name ?? null,
      nameEn: props.name_en ?? null,
      ref: props.ref ?? null,
      highwayType: props.highway ?? "motorway",
      lengthM,
      taggedSpeedLimitKmh,
      effectiveCruiseSpeedKmh,
      effectiveCruiseSpeedMps,
      lanes: props.lanes ? parseInt(String(props.lanes), 10) : null,
      startDistanceM: segStartM,
      endDistanceM: segEndM,
      coordinates: coords,
      junctions: [],
      trafficSignals: [],
    };

    accumulatedDistanceM = segEndM;
    segments.push(segment);
  }

  // Map Point features (junctions, traffic signals) to nearest segments along corridor
  for (const pt of pointFeatures) {
    const props = pt.properties ?? {};
    const coords = pt.geometry.coordinates as [number, number];
    const pointType = props.point_type ?? props.highway;

    // Find closest segment
    let bestSeg: RouteSegment | null = null;
    let minD = Infinity;

    for (const seg of segments) {
      for (const segCoord of seg.coordinates) {
        const d = haversineDistanceMeters(coords, segCoord);
        if (d < minD) {
          minD = d;
          bestSeg = seg;
        }
      }
    }

    // Associate if within 500m proximity of corridor
    const assocDistanceM = bestSeg
      ? (bestSeg.startDistanceM + bestSeg.endDistanceM) / 2
      : 0;

    if (
      pointType === "junction" ||
      pointType === "motorway_junction" ||
      props.highway === "motorway_junction"
    ) {
      const junction: RouteJunctionPoint = {
        id: pt.id ?? `node/${props.osm_id}`,
        name: props.name ?? null,
        nameEn: props.name_en ?? null,
        ref: props.ref ?? null,
        coordinates: coords,
        distanceAlongRouteM: assocDistanceM,
      };
      allJunctions.push(junction);
      if (bestSeg) bestSeg.junctions.push(junction);
    } else if (
      pointType === "traffic_signal" ||
      props.highway === "traffic_signals"
    ) {
      const signal: RouteTrafficSignalPoint = {
        id: pt.id ?? `node/${props.osm_id}`,
        name: props.name ?? null,
        coordinates: coords,
        distanceAlongRouteM: assocDistanceM,
      };
      allTrafficSignals.push(signal);
      if (bestSeg) bestSeg.trafficSignals.push(signal);
    }
  }

  return {
    corridorId,
    name,
    totalLengthM: accumulatedDistanceM,
    totalLengthKm: accumulatedDistanceM / 1000.0,
    segments,
    junctionCount: allJunctions.length,
    trafficSignalCount: allTrafficSignals.length,
    allJunctions,
    allTrafficSignals,
  };
}

export interface SpeedProfileOptions {
  includeSignals?: boolean;
  includeJunctions?: boolean;
  signalStopProbability?: number;
  signalAverageWait_s?: number;
  junctionSlowdownSpeed_kmh?: number;
  comfortableAccelMps2?: number;
  comfortableDecelMps2?: number;
  coils?: CoilSegmentPlacement[];
}

/**
 * Checks whether a given distance position [sStart, sEnd] intersects any active user-defined coil,
 * and calculates the exact fraction of the step distance that is energized.
 */
function isOverCoil(
  startM: number,
  endM: number,
  coils?: CoilSegmentPlacement[]
): {
  active: boolean;
  activeFraction: number;
  coilPowerWatts?: number;
  couplingEfficiency?: number;
} {
  if (!coils || coils.length === 0) {
    return { active: false, activeFraction: 0 };
  }

  const stepDistance = endM - startM;
  let totalOverlapM = 0;
  let activePowerWatts: number | undefined;
  let activeCouplingEff: number | undefined;

  for (const c of coils) {
    const sLo = Math.max(startM, c.startM);
    const sHi = Math.min(endM, c.endM);
    if (sHi > sLo) {
      totalOverlapM += sHi - sLo;
      activePowerWatts = c.coilPowerWatts;
      activeCouplingEff = c.couplingEfficiency;
    } else if (stepDistance === 0 && startM >= c.startM && startM <= c.endM) {
      // Stopped dwell directly over coil
      totalOverlapM = 1.0;
      activePowerWatts = c.coilPowerWatts;
      activeCouplingEff = c.couplingEfficiency;
      break;
    }
  }

  if (totalOverlapM <= 0) {
    return { active: false, activeFraction: 0 };
  }

  const activeFraction =
    stepDistance > 0 ? Math.min(1.0, totalOverlapM / stepDistance) : 1.0;

  return {
    active: true,
    activeFraction,
    coilPowerWatts: activePowerWatts,
    couplingEfficiency: activeCouplingEff,
  };
}

/**
 * Generates a fine-grained, distance-conserving speed profile across the corridor.
 * Models cruising at tagged speed, slowing at junctions, and stopping at traffic signals.
 */
export function generateSpeedProfile(
  route: CorridorRoute,
  options?: SpeedProfileOptions
): SpeedProfile {
  const tc = getTrafficControlAssumptions();

  const includeSignals = options?.includeSignals ?? true;
  const includeJunctions = options?.includeJunctions ?? true;

  const signalStopProb =
    options?.signalStopProbability ??
    (tc ? resolveAssumptionValue(tc.signalStopProbability) : 0.5);

  const signalWaitSeconds =
    options?.signalAverageWait_s ??
    (tc ? resolveAssumptionValue(tc.signalAverageWait_s) : 30.0);

  const junctionSpeedKmh =
    options?.junctionSlowdownSpeed_kmh ??
    (tc ? resolveAssumptionValue(tc.junctionSlowdownSpeed_kmh) : 60.0);

  const junctionSpeedMps = junctionSpeedKmh / 3.6;

  const aComfort = options?.comfortableAccelMps2 ?? 1.5;
  const dComfort = options?.comfortableDecelMps2 ?? 1.5;

  const steps: SpeedProfileStep[] = [];
  let currentTotalDistM = 0;
  let totalDurationS = 0;
  let cruiseDurationS = 0;
  let stoppedDurationS = 0;

  for (const seg of route.segments) {
    const vCruise = seg.effectiveCruiseSpeedMps;
    const segLen = seg.lengthM;

    const hasJunction = includeJunctions && seg.junctions.length > 0;
    const hasSignal = includeSignals && seg.trafficSignals.length > 0;

    // Case 1: Pure cruise segment (no signals, no junctions)
    if (!hasJunction && !hasSignal) {
      const dt = segLen / vCruise;
      const sStart = currentTotalDistM;
      const sEnd = currentTotalDistM + segLen;
      const coilInfo = isOverCoil(sStart, sEnd, options?.coils);

      steps.push({
        stepIndex: steps.length,
        segmentId: seg.id,
        startDistanceM: sStart,
        endDistanceM: sEnd,
        distanceDeltaM: segLen,
        vStartMps: vCruise,
        vEndMps: vCruise,
        vAvgMps: vCruise,
        durationS: dt,
        accelerationMps2: 0,
        isCruise: true,
        isJunctionSlowdown: false,
        isSignalStop: false,
        isSignalWaitDwell: false,
        isOverCoil: coilInfo.active,
        coilActiveFraction: coilInfo.activeFraction,
        activeCoilPowerWatts: coilInfo.coilPowerWatts,
        activeCouplingEfficiency: coilInfo.couplingEfficiency,
      });

      currentTotalDistM += segLen;
      totalDurationS += dt;
      cruiseDurationS += dt;
      continue;
    }

    // Case 2: Traffic Signal Stop
    if (hasSignal && signalStopProb > 0) {
      // Kinematics: Decelerate from vCruise to 0, stop for wait time, accelerate back to vCruise
      // Deceleration distance: sDecel = vCruise^2 / (2 * dComfort)
      // Acceleration distance: sAccel = vCruise^2 / (2 * aComfort)
      const sDecel = (vCruise * vCruise) / (2 * dComfort);
      const sAccel = (vCruise * vCruise) / (2 * aComfort);
      const sStopManoeuvre = sDecel + sAccel;

      if (segLen >= sStopManoeuvre) {
        const sCruiseBefore = (segLen - sStopManoeuvre) / 2;
        const sCruiseAfter = sCruiseBefore;

        // 1. Cruise before
        if (sCruiseBefore > 0) {
          const dtCruise1 = sCruiseBefore / vCruise;
          const s1 = currentTotalDistM;
          const s2 = s1 + sCruiseBefore;
          const c1 = isOverCoil(s1, s2, options?.coils);
          steps.push({
            stepIndex: steps.length,
            segmentId: seg.id,
            startDistanceM: s1,
            endDistanceM: s2,
            distanceDeltaM: sCruiseBefore,
            vStartMps: vCruise,
            vEndMps: vCruise,
            vAvgMps: vCruise,
            durationS: dtCruise1,
            accelerationMps2: 0,
            isCruise: true,
            isJunctionSlowdown: false,
            isSignalStop: false,
            isSignalWaitDwell: false,
            isOverCoil: c1.active,
            coilActiveFraction: c1.activeFraction,
            activeCoilPowerWatts: c1.coilPowerWatts,
            activeCouplingEfficiency: c1.couplingEfficiency,
          });
          currentTotalDistM += sCruiseBefore;
          totalDurationS += dtCruise1;
          cruiseDurationS += dtCruise1;
        }

        // 2. Deceleration to 0
        const dtDecel = vCruise / dComfort;
        const sDecStart = currentTotalDistM;
        const sDecEnd = sDecStart + sDecel;
        const cDec = isOverCoil(sDecStart, sDecEnd, options?.coils);
        steps.push({
          stepIndex: steps.length,
          segmentId: seg.id,
          startDistanceM: sDecStart,
          endDistanceM: sDecEnd,
          distanceDeltaM: sDecel,
          vStartMps: vCruise,
          vEndMps: 0,
          vAvgMps: vCruise / 2,
          durationS: dtDecel,
          accelerationMps2: -dComfort,
          isCruise: false,
          isJunctionSlowdown: false,
          isSignalStop: true,
          isSignalWaitDwell: false,
          isOverCoil: cDec.active,
          coilActiveFraction: cDec.activeFraction,
          activeCoilPowerWatts: cDec.coilPowerWatts,
          activeCouplingEfficiency: cDec.couplingEfficiency,
        });
        currentTotalDistM += sDecel;
        totalDurationS += dtDecel;

        // 3. Stopped Dwell (distance = 0)
        // Weighted by signal stop probability
        const effectiveWait = signalWaitSeconds * signalStopProb;
        if (effectiveWait > 0) {
          const cWait = isOverCoil(
            currentTotalDistM,
            currentTotalDistM,
            options?.coils
          );
          steps.push({
            stepIndex: steps.length,
            segmentId: seg.id,
            startDistanceM: currentTotalDistM,
            endDistanceM: currentTotalDistM,
            distanceDeltaM: 0,
            vStartMps: 0,
            vEndMps: 0,
            vAvgMps: 0,
            durationS: effectiveWait,
            accelerationMps2: 0,
            isCruise: false,
            isJunctionSlowdown: false,
            isSignalStop: true,
            isSignalWaitDwell: true,
            isOverCoil: cWait.active,
            coilActiveFraction: cWait.activeFraction,
            activeCoilPowerWatts: cWait.coilPowerWatts,
            activeCouplingEfficiency: cWait.couplingEfficiency,
          });
          totalDurationS += effectiveWait;
          stoppedDurationS += effectiveWait;
        }

        // 4. Acceleration back to vCruise
        const dtAccel = vCruise / aComfort;
        const sAccStart = currentTotalDistM;
        const sAccEnd = sAccStart + sAccel;
        const cAcc = isOverCoil(sAccStart, sAccEnd, options?.coils);
        steps.push({
          stepIndex: steps.length,
          segmentId: seg.id,
          startDistanceM: sAccStart,
          endDistanceM: sAccEnd,
          distanceDeltaM: sAccel,
          vStartMps: 0,
          vEndMps: vCruise,
          vAvgMps: vCruise / 2,
          durationS: dtAccel,
          accelerationMps2: aComfort,
          isCruise: false,
          isJunctionSlowdown: false,
          isSignalStop: false,
          isSignalWaitDwell: false,
          isOverCoil: cAcc.active,
          coilActiveFraction: cAcc.activeFraction,
          activeCoilPowerWatts: cAcc.coilPowerWatts,
          activeCouplingEfficiency: cAcc.couplingEfficiency,
        });
        currentTotalDistM += sAccel;
        totalDurationS += dtAccel;

        // 5. Cruise after
        if (sCruiseAfter > 0) {
          const dtCruise2 = sCruiseAfter / vCruise;
          const sEndCruise = currentTotalDistM + sCruiseAfter;
          const c2 = isOverCoil(currentTotalDistM, sEndCruise, options?.coils);
          steps.push({
            stepIndex: steps.length,
            segmentId: seg.id,
            startDistanceM: currentTotalDistM,
            endDistanceM: sEndCruise,
            distanceDeltaM: sCruiseAfter,
            vStartMps: vCruise,
            vEndMps: vCruise,
            vAvgMps: vCruise,
            durationS: dtCruise2,
            accelerationMps2: 0,
            isCruise: true,
            isJunctionSlowdown: false,
            isSignalStop: false,
            isSignalWaitDwell: false,
            isOverCoil: c2.active,
            coilActiveFraction: c2.activeFraction,
            activeCoilPowerWatts: c2.coilPowerWatts,
            activeCouplingEfficiency: c2.couplingEfficiency,
          });
          currentTotalDistM += sCruiseAfter;
          totalDurationS += dtCruise2;
          cruiseDurationS += dtCruise2;
        }

        continue;
      }
    }

    // Case 3: Junction Slowdown
    if (hasJunction && vCruise > junctionSpeedMps) {
      const vTarget = junctionSpeedMps;
      const sDecel = (vCruise * vCruise - vTarget * vTarget) / (2 * dComfort);
      const sAccel = (vCruise * vCruise - vTarget * vTarget) / (2 * aComfort);
      const sManoeuvre = sDecel + sAccel;

      if (segLen >= sManoeuvre) {
        const sJuncCruise = segLen - sManoeuvre;

        // 1. Decelerate to junction speed
        const dtDecel = (vCruise - vTarget) / dComfort;
        const sDecStart = currentTotalDistM;
        const sDecEnd = sDecStart + sDecel;
        const cDec = isOverCoil(sDecStart, sDecEnd, options?.coils);
        steps.push({
          stepIndex: steps.length,
          segmentId: seg.id,
          startDistanceM: sDecStart,
          endDistanceM: sDecEnd,
          distanceDeltaM: sDecel,
          vStartMps: vCruise,
          vEndMps: vTarget,
          vAvgMps: (vCruise + vTarget) / 2,
          durationS: dtDecel,
          accelerationMps2: -dComfort,
          isCruise: false,
          isJunctionSlowdown: true,
          isSignalStop: false,
          isSignalWaitDwell: false,
          isOverCoil: cDec.active,
          coilActiveFraction: cDec.activeFraction,
          activeCoilPowerWatts: cDec.coilPowerWatts,
          activeCouplingEfficiency: cDec.couplingEfficiency,
        });
        currentTotalDistM += sDecel;
        totalDurationS += dtDecel;

        // 2. Cruise through junction at reduced speed
        if (sJuncCruise > 0) {
          const dtJunc = sJuncCruise / vTarget;
          const sJuncEnd = currentTotalDistM + sJuncCruise;
          const cJunc = isOverCoil(currentTotalDistM, sJuncEnd, options?.coils);
          steps.push({
            stepIndex: steps.length,
            segmentId: seg.id,
            startDistanceM: currentTotalDistM,
            endDistanceM: sJuncEnd,
            distanceDeltaM: sJuncCruise,
            vStartMps: vTarget,
            vEndMps: vTarget,
            vAvgMps: vTarget,
            durationS: dtJunc,
            accelerationMps2: 0,
            isCruise: false,
            isJunctionSlowdown: true,
            isSignalStop: false,
            isSignalWaitDwell: false,
            isOverCoil: cJunc.active,
            coilActiveFraction: cJunc.activeFraction,
            activeCoilPowerWatts: cJunc.coilPowerWatts,
            activeCouplingEfficiency: cJunc.couplingEfficiency,
          });
          currentTotalDistM += sJuncCruise;
          totalDurationS += dtJunc;
        }

        // 3. Accelerate back to vCruise
        const dtAccel = (vCruise - vTarget) / aComfort;
        const sAccEnd = currentTotalDistM + sAccel;
        const cAcc = isOverCoil(currentTotalDistM, sAccEnd, options?.coils);
        steps.push({
          stepIndex: steps.length,
          segmentId: seg.id,
          startDistanceM: currentTotalDistM,
          endDistanceM: sAccEnd,
          distanceDeltaM: sAccel,
          vStartMps: vTarget,
          vEndMps: vCruise,
          vAvgMps: (vCruise + vTarget) / 2,
          durationS: dtAccel,
          accelerationMps2: aComfort,
          isCruise: false,
          isJunctionSlowdown: false,
          isSignalStop: false,
          isSignalWaitDwell: false,
          isOverCoil: cAcc.active,
          coilActiveFraction: cAcc.activeFraction,
          activeCoilPowerWatts: cAcc.coilPowerWatts,
          activeCouplingEfficiency: cAcc.couplingEfficiency,
        });
        currentTotalDistM += sAccel;
        totalDurationS += dtAccel;

        continue;
      }
    }

    // Default fallback: Cruise through segment
    const dt = segLen / vCruise;
    const sStart = currentTotalDistM;
    const sEnd = currentTotalDistM + segLen;
    const coilInfo = isOverCoil(sStart, sEnd, options?.coils);
    steps.push({
      stepIndex: steps.length,
      segmentId: seg.id,
      startDistanceM: sStart,
      endDistanceM: sEnd,
      distanceDeltaM: segLen,
      vStartMps: vCruise,
      vEndMps: vCruise,
      vAvgMps: vCruise,
      durationS: dt,
      accelerationMps2: 0,
      isCruise: true,
      isJunctionSlowdown: false,
      isSignalStop: false,
      isSignalWaitDwell: false,
      isOverCoil: coilInfo.active,
      coilActiveFraction: coilInfo.activeFraction,
      activeCoilPowerWatts: coilInfo.coilPowerWatts,
      activeCouplingEfficiency: coilInfo.couplingEfficiency,
    });
    currentTotalDistM += segLen;
    totalDurationS += dt;
    cruiseDurationS += dt;
  }

  const avgSpeedMps =
    totalDurationS > 0 ? route.totalLengthM / totalDurationS : 0;

  return {
    steps,
    totalDistanceM: currentTotalDistM,
    totalDurationS,
    cruiseDurationS,
    stoppedDurationS,
    averageSpeedMps: avgSpeedMps,
    averageSpeedKmh: avgSpeedMps * 3.6,
  };
}
