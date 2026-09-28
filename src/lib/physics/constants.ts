import { VehicleParameters } from "./types";

/**
 * Standard physical constants
 */
export const GRAVITATIONAL_ACCELERATION = 9.81; // m/s²
export const STANDARD_AIR_DENSITY = 1.204; // kg/m³ (dry air at 20°C, 101.325 kPa)

/**
 * Unit conversion utilities
 */
export function joulesToWh(joules: number): number {
  return joules / 3600;
}

export function whToJoules(wh: number): number {
  return wh * 3600;
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

export function gradePercentToRadians(gradePercent: number): number {
  return Math.atan(gradePercent / 100);
}

/**
 * Vehicle presets extracted from the simulator in Regen Model.html
 */
export const VEHICLE_PRESETS: Record<"scooter" | "car", VehicleParameters> = {
  scooter: {
    mass: 170, // kg (typical Activa-class EV + rider)
    cdA: 0.42, // m²
    crr: 0.018,
    driveEfficiency: 0.85,
    regenEfficiency: 0.55,
    maxRegenDecel: 1.0, // m/s²
    maxRegenPower: 2500, // W
    auxWatts: 15, // W
  },
  car: {
    mass: 1350, // kg (typical compact hatchback / Nexon EV class)
    cdA: 0.65, // m²
    crr: 0.014,
    driveEfficiency: 0.88,
    regenEfficiency: 0.65,
    maxRegenDecel: 2.0, // m/s²
    maxRegenPower: 28000, // W
    auxWatts: 120, // W
  },
};
