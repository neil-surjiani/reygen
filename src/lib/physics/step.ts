import { GRAVITATIONAL_ACCELERATION } from "./constants";
import { calculateRoadCoilPower, calculateSolarPower } from "./external";
import { calculateTractiveForces } from "./forces";
import { calculatePowertrainPower } from "./powertrain";
import {
  EnergyLedger,
  SimulationStepInput,
  SimulationStepResult,
} from "./types";

/**
 * Creates an empty EnergyLedger initialized to zero.
 */
export function createEmptyLedger(): EnergyLedger {
  return {
    consumed: 0,
    aeroLoss: 0,
    rollingLoss: 0,
    gradeWork: 0,
    frictionHeat: 0,
    drivetrainLoss: 0,
    regenReturned: 0,
    solar: 0,
    roadCoil: 0,
    netBatteryChange: 0,
  };
}

/**
 * Combines two energy ledgers (accumulates a step into a cumulative trip ledger).
 */
export function accumulateLedger(
  target: EnergyLedger,
  addition: EnergyLedger
): EnergyLedger {
  return {
    consumed: target.consumed + addition.consumed,
    aeroLoss: target.aeroLoss + addition.aeroLoss,
    rollingLoss: target.rollingLoss + addition.rollingLoss,
    gradeWork: target.gradeWork + addition.gradeWork,
    frictionHeat: target.frictionHeat + addition.frictionHeat,
    drivetrainLoss: target.drivetrainLoss + addition.drivetrainLoss,
    regenReturned: target.regenReturned + addition.regenReturned,
    solar: target.solar + addition.solar,
    roadCoil: target.roadCoil + addition.roadCoil,
    netBatteryChange: target.netBatteryChange + addition.netBatteryChange,
  };
}

/**
 * Executes a single discrete time-step physics integration for the vehicle.
 *
 * Implements:
 * 1. Tractive force = rolling resistance (m*g*Crr*cosθ) + aero drag (0.5*rho*CdA*v²) + grade (m*g*sinθ) + inertia (m*a).
 * 2. Wheel power = force * speed.
 * 3. Battery power = wheel power / drivetrain efficiency (driving);
 *    regen recovers up to deceleration ceiling * round-trip efficiency (braking);
 *    braking beyond ceiling goes to friction heat.
 * 4. Continuous auxiliary electrical load subtracted.
 * 5. External inputs: solar = area * cell efficiency * irradiance;
 *    road coil = coil power * coupling efficiency (only while over active segment).
 * 6. Returns complete EnergyLedger for the step.
 */
export function stepPhysics(input: SimulationStepInput): SimulationStepResult {
  const { dt, initialSpeed, acceleration, distance, vehicle, environment, solar, roadCoil } = input;

  if (dt <= 0) {
    throw new Error("stepPhysics: dt must be strictly greater than 0");
  }

  // 1. Kinematics integration across the step
  // Handle deceleration stopping condition to prevent negative speed overshoot
  let actualDt = dt;
  let finalSpeed = initialSpeed + acceleration * dt;

  if (finalSpeed < 0) {
    // Stopped during this time step
    actualDt = acceleration !== 0 ? Math.max(0, -initialSpeed / acceleration) : 0;
    finalSpeed = 0;
  }

  const averageSpeed = (initialSpeed + finalSpeed) / 2;
  const stepDistance = averageSpeed * actualDt;
  const newDistance = distance + stepDistance;

  // 2. Force calculations at average speed over the time step
  const forces = calculateTractiveForces(
    vehicle.mass,
    vehicle.cdA,
    vehicle.crr,
    averageSpeed,
    acceleration,
    environment.gradeAngleRad,
    environment.airDensity,
    environment.headwindSpeed ?? 0,
    GRAVITATIONAL_ACCELERATION
  );

  // 3. Powertrain power resolution (driving vs braking)
  const powertrain = calculatePowertrainPower(forces.tractiveForce, averageSpeed, vehicle);

  // 4. External Energy Inputs
  const solarPower = calculateSolarPower(
    solar,
    environment.solarIrradiance ?? 0,
    environment.ambientTemperature ?? 25
  );

  // Average position along block during the step
  const midDistance = distance + stepDistance / 2;
  const { powerWatts: roadCoilPower, isOverCoil } = calculateRoadCoilPower(
    midDistance,
    roadCoil,
    averageSpeed
  );

  const auxPower = vehicle.auxWatts;

  // 5. Energy Ledger Integration (Joules)
  // Distance-based mechanical losses
  const aeroLoss = forces.aeroDrag * stepDistance;
  const rollingLoss = forces.rollingResistance * stepDistance;
  const gradeWork = forces.gradeForce * stepDistance;
  const frictionHeat = powertrain.frictionHeatPower * actualDt;

  // Conversion losses in motor/inverter
  const drivetrainLoss = powertrain.drivetrainLossPower * actualDt;

  // Electrical propulsion draw and aux consumption
  const driveElecEnergy = powertrain.electricalDriveDraw * actualDt;
  const auxEnergy = auxPower * dt; // Aux drains for the full time step even if vehicle halts early
  const consumed = driveElecEnergy + auxEnergy;

  // Energy receipts into the battery
  const regenReturned = powertrain.electricalRegenReturn * actualDt;
  const solarEnergy = solarPower * dt;
  const roadCoilEnergy = roadCoilPower * actualDt;

  // Net battery change: (receipts) - (consumption)
  // Positive = net charge into battery, Negative = net energy drawn from battery
  const netBatteryChange = (regenReturned + solarEnergy + roadCoilEnergy) - consumed;

  const energyStep: EnergyLedger = {
    consumed,
    aeroLoss,
    rollingLoss,
    gradeWork,
    frictionHeat,
    drivetrainLoss,
    regenReturned,
    solar: solarEnergy,
    roadCoil: roadCoilEnergy,
    netBatteryChange,
  };

  // Instantaneous battery power in Watts: positive = charging, negative = discharging
  const netBatteryPower =
    (powertrain.electricalRegenReturn + solarPower + roadCoilPower) -
    (powertrain.electricalDriveDraw + auxPower);

  return {
    finalSpeed,
    averageSpeed,
    stepDistance,
    newDistance,
    forces,
    wheelPower: powertrain.wheelPower,
    powertrainElectricalPower:
      powertrain.electricalDriveDraw > 0
        ? -powertrain.electricalDriveDraw
        : powertrain.electricalRegenReturn,
    auxPower,
    solarPower,
    roadCoilPower,
    isOverActiveCoil: isOverCoil,
    netBatteryPower,
    energyStep,
  };
}
