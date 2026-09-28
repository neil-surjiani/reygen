import { GRAVITATIONAL_ACCELERATION } from "./constants";
import { ForceBreakdown } from "./types";

/**
 * Calculates tyre rolling resistance force in Newtons.
 * Formula: F_roll = m * g * Crr * cos(theta)
 *
 * @param mass Vehicle mass in kg
 * @param crr Rolling resistance coefficient
 * @param thetaRad Road incline angle in radians (default: 0)
 * @param g Gravitational acceleration in m/s² (default: 9.81)
 */
export function calculateRollingResistance(
  mass: number,
  crr: number,
  thetaRad: number = 0,
  g: number = GRAVITATIONAL_ACCELERATION
): number {
  if (mass <= 0 || crr <= 0) return 0;
  return mass * g * crr * Math.cos(thetaRad);
}

/**
 * Calculates aerodynamic drag force in Newtons.
 * Formula: F_drag = 0.5 * rho * CdA * v_rel²
 *
 * @param rho Air density in kg/m³
 * @param cdA Drag area product (Cd * A) in m²
 * @param speed Vehicle forward speed in m/s
 * @param headwindSpeed Headwind component in m/s (positive opposes vehicle motion)
 */
export function calculateAeroDrag(
  rho: number,
  cdA: number,
  speed: number,
  headwindSpeed: number = 0
): number {
  if (rho <= 0 || cdA <= 0) return 0;
  const vRel = Math.max(0, speed + headwindSpeed);
  return 0.5 * rho * cdA * vRel * vRel;
}

/**
 * Calculates gravitational grade force in Newtons.
 * Formula: F_grade = m * g * sin(theta)
 * Positive when climbing uphill (resisting vehicle motion).
 * Negative when descending downhill (pulling vehicle forward).
 *
 * @param mass Vehicle mass in kg
 * @param thetaRad Incline angle in radians
 * @param g Gravitational acceleration in m/s² (default: 9.81)
 */
export function calculateGradeForce(
  mass: number,
  thetaRad: number,
  g: number = GRAVITATIONAL_ACCELERATION
): number {
  if (mass <= 0) return 0;
  return mass * g * Math.sin(thetaRad);
}

/**
 * Calculates inertial force in Newtons.
 * Formula: F_inertia = m * a
 * Positive when accelerating (requires forward thrust).
 * Negative when decelerating (provides forward inertial push).
 *
 * @param mass Vehicle mass in kg
 * @param acceleration Acceleration in m/s²
 */
export function calculateInertialForce(
  mass: number,
  acceleration: number
): number {
  return mass * acceleration;
}

/**
 * Calculates the total tractive force and its individual components.
 * Formula: F_tractive = F_roll + F_drag + F_grade + F_inertia
 */
export function calculateTractiveForces(
  mass: number,
  cdA: number,
  crr: number,
  speed: number,
  acceleration: number,
  thetaRad: number,
  rho: number,
  headwindSpeed: number = 0,
  g: number = GRAVITATIONAL_ACCELERATION
): ForceBreakdown {
  // A stationary vehicle at rest on flat ground with no impending motion experiences 0 rolling resistance
  const isStationaryAtRest = speed <= 0 && acceleration <= 0 && thetaRad === 0;
  const rollingResistance = isStationaryAtRest
    ? 0
    : calculateRollingResistance(mass, crr, thetaRad, g);
  const aeroDrag = calculateAeroDrag(rho, cdA, speed, headwindSpeed);
  const gradeForce = calculateGradeForce(mass, thetaRad, g);
  const inertialForce = calculateInertialForce(mass, acceleration);
  const tractiveForce = rollingResistance + aeroDrag + gradeForce + inertialForce;

  return {
    rollingResistance,
    aeroDrag,
    gradeForce,
    inertialForce,
    tractiveForce,
  };
}
