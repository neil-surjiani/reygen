import { VehicleParameters } from "./types";

export interface PowertrainPowerResult {
  /** Mechanical power at the wheel in Watts (W). Positive = propulsion, negative = braking */
  wheelPower: number;
  /** Electrical power into the motor from battery in Watts (W) during propulsion (>= 0) */
  electricalDriveDraw: number;
  /** Electrical power returned into battery from regenerative braking in Watts (W) (>= 0) */
  electricalRegenReturn: number;
  /** Rate of mechanical energy dissipated as heat by friction brakes in Watts (W) (>= 0) */
  frictionHeatPower: number;
  /** Electrical and mechanical transmission losses in Watts (W) (>= 0) */
  drivetrainLossPower: number;
  /** Mechanical force captured by regenerative braking in Newtons (N) */
  regenForce: number;
  /** Mechanical force dissipated by friction brakes in Newtons (N) */
  frictionForce: number;
}

/**
 * Calculates instantaneous mechanical wheel power.
 * Formula: P_wheel = Force * speed
 *
 * @param tractiveForce Total tractive force in Newtons (N)
 * @param speed Vehicle speed in m/s
 */
export function calculateWheelPower(tractiveForce: number, speed: number): number {
  return tractiveForce * speed;
}

/**
 * Resolves driving and braking power flows according to drivetrain efficiency,
 * regenerative deceleration ceiling, round-trip efficiency, and friction braking.
 *
 * Per requirements:
 * - Battery power = wheel power / motor-drivetrain efficiency when driving.
 * - When braking, regen recovers only up to the regen deceleration ceiling,
 *   multiplied by round-trip efficiency.
 * - Braking beyond the ceiling goes to friction heat.
 */
export function calculatePowertrainPower(
  tractiveForce: number,
  speed: number,
  vehicle: VehicleParameters,
  options?: { enforcePowerCeiling?: boolean }
): PowertrainPowerResult {
  const wheelPower = calculateWheelPower(tractiveForce, speed);

  if (speed <= 0) {
    return {
      wheelPower: 0,
      electricalDriveDraw: 0,
      electricalRegenReturn: 0,
      frictionHeatPower: 0,
      drivetrainLossPower: 0,
      regenForce: 0,
      frictionForce: 0,
    };
  }

  // 1. Driving / Propulsion Mode (Tractive Force > 0)
  if (tractiveForce > 0) {
    const driveEff = Math.max(0.01, Math.min(1.0, vehicle.driveEfficiency));
    const electricalDriveDraw = wheelPower / driveEff;
    const drivetrainLossPower = electricalDriveDraw - wheelPower;

    return {
      wheelPower,
      electricalDriveDraw,
      electricalRegenReturn: 0,
      frictionHeatPower: 0,
      drivetrainLossPower,
      regenForce: 0,
      frictionForce: 0,
    };
  }

  // 2. Braking / Retardation Mode (Tractive Force <= 0)
  // Required retarding wheel force is the magnitude of negative tractive force
  const retardingForce = Math.abs(tractiveForce);

  // Maximum regen force bounded by deceleration ceiling: F_ceiling = mass * maxRegenDecel
  const maxRegenDecelForce = vehicle.mass * Math.max(0, vehicle.maxRegenDecel);

  // By default, the regen deceleration ceiling governs. If power ceiling is optionally specified and smaller, it can be enforced.
  let maxRegenForce = maxRegenDecelForce;
  if (
    options?.enforcePowerCeiling &&
    vehicle.maxRegenPower !== undefined &&
    vehicle.maxRegenPower > 0
  ) {
    const powerLimitedForce = vehicle.maxRegenPower / Math.max(0.1, speed);
    maxRegenForce = Math.min(maxRegenDecelForce, powerLimitedForce);
  }

  // Regen force captured
  const regenForce = Math.min(retardingForce, maxRegenForce);

  // Any braking force beyond the regen ceiling is absorbed by friction brakes
  const frictionForce = Math.max(0, retardingForce - regenForce);

  // Mechanical power split
  const regenMechPower = regenForce * speed;
  const frictionHeatPower = frictionForce * speed;

  // Electrical regen returned: P_regen_elec = P_regen_mech * regenEfficiency
  const regenEff = Math.max(0.0, Math.min(1.0, vehicle.regenEfficiency));
  const electricalRegenReturn = regenMechPower * regenEff;

  // Conversion loss in generator and power electronics during regen
  const drivetrainLossPower = regenMechPower * (1.0 - regenEff);

  return {
    wheelPower,
    electricalDriveDraw: 0,
    electricalRegenReturn,
    frictionHeatPower,
    drivetrainLossPower,
    regenForce,
    frictionForce,
  };
}
