import { RoadCoilConfiguration, SolarConfiguration } from "./types";

/**
 * Calculates solar photovoltaic power output in Watts.
 * Primary formula: P_solar = Area * CellEfficiency * Irradiance
 *
 * Optionally applies standard photovoltaic thermal derating:
 * - T_cell = T_amb + 25 * (Irradiance / 800)
 * - Derate = max(0.5, 1 - 0.004 * max(0, T_cell - 25))
 *
 * @param solar Solar configuration
 * @param irradiance Solar irradiance in W/m² (default: 0)
 * @param ambientTemp Ambient air temperature in °C (default: 25)
 */
export function calculateSolarPower(
  solar?: SolarConfiguration,
  irradiance: number = 0,
  ambientTemp: number = 25
): number {
  if (!solar || solar.areaM2 <= 0 || solar.cellEfficiency <= 0 || irradiance <= 0) {
    return 0;
  }

  const basePower = solar.areaM2 * solar.cellEfficiency * irradiance;

  if (!solar.applyTemperatureDerating) {
    return basePower;
  }

  // Optional thermal derate extracted from Regen Model.html (standard silicon temperature coefficient -0.4%/°C)
  const cellTemp = ambientTemp + 25 * (irradiance / 800);
  const tempDerate = Math.max(0.5, 1 - 0.004 * Math.max(0, cellTemp - 25));

  return basePower * tempDerate;
}

/**
 * Determines whether a vehicle at a given distance is positioned over an energized road coil segment.
 *
 * In inductive roadways, coils are laid out in repeating blocks (e.g. 400 m block length).
 * The energized portion spans from 0 to (blockLengthM * coverageRatio).
 *
 * @param distance Cumulative vehicle distance along the corridor in meters (m)
 * @param roadCoil Road coil configuration
 * @param speed Vehicle speed in m/s
 */
export function isOverRoadCoil(
  distance: number,
  roadCoil: RoadCoilConfiguration,
  speed: number = 0
): boolean {
  if (
    roadCoil.blockLengthM <= 0 ||
    roadCoil.coverageRatio <= 0 ||
    roadCoil.coilPowerWatts <= 0
  ) {
    return false;
  }

  // If a speed threshold is configured, enforce it
  if (
    roadCoil.minSpeedThreshold !== undefined &&
    speed < roadCoil.minSpeedThreshold
  ) {
    return false;
  }

  const normalizedDist = ((distance % roadCoil.blockLengthM) + roadCoil.blockLengthM) % roadCoil.blockLengthM;
  const activeLength = roadCoil.blockLengthM * Math.min(1.0, roadCoil.coverageRatio);

  return normalizedDist < activeLength;
}

/**
 * Calculates received electrical power from road coils in Watts.
 * Formula: P_road = P_coil * couplingEfficiency (when over active coil)
 *
 * @param distance Cumulative distance along track in meters (m)
 * @param roadCoil Road coil configuration
 * @param speed Vehicle forward speed in m/s
 */
export function calculateRoadCoilPower(
  distance: number,
  roadCoil?: RoadCoilConfiguration,
  speed: number = 0
): { powerWatts: number; isOverCoil: boolean } {
  if (!roadCoil) {
    return { powerWatts: 0, isOverCoil: false };
  }

  const isOver = isOverRoadCoil(distance, roadCoil, speed);
  if (!isOver) {
    return { powerWatts: 0, isOverCoil: false };
  }

  const couplingEff = Math.max(0, Math.min(1.0, roadCoil.couplingEfficiency));
  const receivedPower = roadCoil.coilPowerWatts * couplingEff;

  return { powerWatts: receivedPower, isOverCoil: true };
}
