import { describe, it, expect } from "vitest";
import {
  calculateRollingResistance,
  calculateAeroDrag,
  calculateGradeForce,
  calculateInertialForce,
  calculateTractiveForces,
} from "./forces";
import { calculateWheelPower, calculatePowertrainPower } from "./powertrain";
import {
  calculateSolarPower,
  calculateRoadCoilPower,
  isOverRoadCoil,
} from "./external";
import { stepPhysics, createEmptyLedger, accumulateLedger } from "./step";
import { VEHICLE_PRESETS, GRAVITATIONAL_ACCELERATION, gradePercentToRadians } from "./constants";
import { SimulationStepInput } from "./types";

describe("Physics Engine - Fundamental Forces", () => {
  const car = VEHICLE_PRESETS.car;

  it("calculates rolling resistance according to m * g * Crr * cos(theta)", () => {
    // Flat road: cos(0) = 1
    const flatRoll = calculateRollingResistance(car.mass, car.crr, 0);
    const expectedFlat = 1350 * 9.81 * 0.014 * 1;
    expect(flatRoll).toBeCloseTo(expectedFlat, 4);

    // Incline: 10% grade = atan(0.1) rad
    const theta10 = gradePercentToRadians(10);
    const inclinedRoll = calculateRollingResistance(car.mass, car.crr, theta10);
    const expectedInclined = 1350 * 9.81 * 0.014 * Math.cos(theta10);
    expect(inclinedRoll).toBeCloseTo(expectedInclined, 4);
    expect(inclinedRoll).toBeLessThan(flatRoll);
  });

  it("calculates aerodynamic drag according to 0.5 * rho * CdA * v^2", () => {
    const rho = 1.204;
    const speed = 25; // 90 km/h in m/s
    const drag = calculateAeroDrag(rho, car.cdA, speed);
    const expected = 0.5 * 1.204 * 0.65 * 25 * 25;
    expect(drag).toBeCloseTo(expected, 4);

    // Speed 0 gives 0 drag
    expect(calculateAeroDrag(rho, car.cdA, 0)).toBe(0);

    // Headwind adds to effective speed
    const headwind = 5;
    const dragWithWind = calculateAeroDrag(rho, car.cdA, speed, headwind);
    const expectedWind = 0.5 * 1.204 * 0.65 * 30 * 30;
    expect(dragWithWind).toBeCloseTo(expectedWind, 4);
  });

  it("calculates grade force according to m * g * sin(theta)", () => {
    const thetaUphill = gradePercentToRadians(5);
    const fUphill = calculateGradeForce(car.mass, thetaUphill);
    expect(fUphill).toBeCloseTo(1350 * 9.81 * Math.sin(thetaUphill), 4);
    expect(fUphill).toBeGreaterThan(0);

    const thetaDownhill = gradePercentToRadians(-5);
    const fDownhill = calculateGradeForce(car.mass, thetaDownhill);
    expect(fDownhill).toBeCloseTo(1350 * 9.81 * Math.sin(thetaDownhill), 4);
    expect(fDownhill).toBeLessThan(0);
  });

  it("calculates inertial force according to m * a", () => {
    expect(calculateInertialForce(car.mass, 2.0)).toBe(1350 * 2.0);
    expect(calculateInertialForce(car.mass, -1.5)).toBe(1350 * -1.5);
    expect(calculateInertialForce(car.mass, 0)).toBe(0);
  });

  it("calculates tractive force as the exact sum of all 4 resistance components", () => {
    const rho = 1.204;
    const speed = 20;
    const accel = 1.2;
    const theta = gradePercentToRadians(3);

    const result = calculateTractiveForces(
      car.mass,
      car.cdA,
      car.crr,
      speed,
      accel,
      theta,
      rho,
      0,
      GRAVITATIONAL_ACCELERATION
    );

    const expectedSum =
      result.rollingResistance +
      result.aeroDrag +
      result.gradeForce +
      result.inertialForce;

    expect(result.tractiveForce).toBeCloseTo(expectedSum, 6);
  });
});

describe("Powertrain - Power Flows and Efficiency", () => {
  const car = VEHICLE_PRESETS.car;

  it("calculates wheel power as force * speed", () => {
    expect(calculateWheelPower(1000, 20)).toBe(20000);
    expect(calculateWheelPower(-500, 15)).toBe(-7500);
  });

  it("calculates driving battery power = wheel power / drive efficiency", () => {
    const tractiveForce = 1500; // N
    const speed = 20; // m/s -> P_wheel = 30000 W
    const result = calculatePowertrainPower(tractiveForce, speed, car);

    expect(result.wheelPower).toBe(30000);
    expect(result.electricalDriveDraw).toBeCloseTo(30000 / car.driveEfficiency, 4);
    expect(result.drivetrainLossPower).toBeCloseTo(
      30000 / car.driveEfficiency - 30000,
      4
    );
    expect(result.electricalRegenReturn).toBe(0);
    expect(result.frictionHeatPower).toBe(0);
  });

  it("recovers 100% of braking via regen when under deceleration ceiling", () => {
    // Car mass = 1350 kg, maxRegenDecel = 2.0 m/s^2 -> max regen force = 2700 N
    // Command a moderate braking retarding force of 1500 N
    const retardingTractiveForce = -1500;
    const speed = 20;
    const result = calculatePowertrainPower(retardingTractiveForce, speed, car);

    expect(result.regenForce).toBe(1500);
    expect(result.frictionForce).toBe(0);
    expect(result.frictionHeatPower).toBe(0);

    const expectedMechRegen = 1500 * 20; // 30000 W
    expect(result.electricalRegenReturn).toBeCloseTo(
      expectedMechRegen * car.regenEfficiency,
      4
    );
    expect(result.drivetrainLossPower).toBeCloseTo(
      expectedMechRegen * (1 - car.regenEfficiency),
      4
    );
  });

  it("caps regen at deceleration ceiling and diverts excess to friction heat", () => {
    // Car mass = 1350 kg, maxRegenDecel = 2.0 m/s^2 -> max regen force = 2700 N
    // Command emergency braking force of 5000 N
    const hardBrakingForce = -5000;
    const speed = 20;
    const result = calculatePowertrainPower(hardBrakingForce, speed, car);

    const maxRegenForce = 1350 * 2.0; // 2700 N
    const expectedFrictionForce = 5000 - maxRegenForce; // 2300 N

    expect(result.regenForce).toBe(maxRegenForce);
    expect(result.frictionForce).toBe(expectedFrictionForce);

    // Friction heat is friction force * speed
    expect(result.frictionHeatPower).toBe(expectedFrictionForce * 20);

    // Regen recovers capped portion * round-trip efficiency
    expect(result.electricalRegenReturn).toBe(
      maxRegenForce * 20 * car.regenEfficiency
    );
    expect(result.drivetrainLossPower).toBe(
      maxRegenForce * 20 * (1 - car.regenEfficiency)
    );
  });
});

describe("External Power Sources", () => {
  it("calculates solar power according to area * efficiency * irradiance", () => {
    const power = calculateSolarPower(
      { areaM2: 2.0, cellEfficiency: 0.22 },
      800
    );
    expect(power).toBeCloseTo(2.0 * 0.22 * 800, 4); // 352 W
  });

  it("determines active road coil positioning on repeating blocks", () => {
    const trackConfig = {
      blockLengthM: 400,
      coverageRatio: 0.25, // 100m of each 400m block is energized
      coilPowerWatts: 30000,
      couplingEfficiency: 0.85,
    };

    // At 50m (within first 100m) -> active
    expect(isOverRoadCoil(50, trackConfig)).toBe(true);

    // At 150m (past first 100m) -> inactive
    expect(isOverRoadCoil(150, trackConfig)).toBe(false);

    // At 450m (in next block: 450 % 400 = 50m) -> active
    expect(isOverRoadCoil(450, trackConfig)).toBe(true);

    // At 750m (in second block: 750 % 400 = 350m) -> inactive
    expect(isOverRoadCoil(750, trackConfig)).toBe(false);
  });

  it("calculates road coil power when active with coupling efficiency", () => {
    const trackConfig = {
      blockLengthM: 400,
      coverageRatio: 0.25,
      coilPowerWatts: 40000, // 40 kW
      couplingEfficiency: 0.85,
    };

    const active = calculateRoadCoilPower(50, trackConfig);
    expect(active.isOverCoil).toBe(true);
    expect(active.powerWatts).toBe(40000 * 0.85); // 34 kW

    const inactive = calculateRoadCoilPower(200, trackConfig);
    expect(inactive.isOverCoil).toBe(false);
    expect(inactive.powerWatts).toBe(0);
  });
});

describe("stepPhysics and Energy Ledger Integration", () => {
  const baseVehicle = VEHICLE_PRESETS.car;

  const defaultInput: SimulationStepInput = {
    dt: 1.0,
    initialSpeed: 20, // m/s (~72 km/h)
    acceleration: 0,
    distance: 50,
    vehicle: baseVehicle,
    environment: {
      airDensity: 1.204,
      gradeAngleRad: 0,
      headwindSpeed: 0,
      solarIrradiance: 800,
      ambientTemperature: 30,
    },
    solar: {
      areaM2: 2.0,
      cellEfficiency: 0.2,
    },
    roadCoil: {
      blockLengthM: 400,
      coverageRatio: 0.5,
      coilPowerWatts: 30000,
      couplingEfficiency: 0.85,
    },
  };

  it("returns a complete energy ledger for steady-state cruising", () => {
    const result = stepPhysics(defaultInput);
    const ledger = result.energyStep;

    expect(result.finalSpeed).toBe(20);
    expect(result.stepDistance).toBe(20);

    // Check all energy fields exist and are positive/valid numbers
    expect(ledger.aeroLoss).toBeGreaterThan(0);
    expect(ledger.rollingLoss).toBeGreaterThan(0);
    expect(ledger.gradeWork).toBe(0); // flat road
    expect(ledger.frictionHeat).toBe(0); // cruising, no braking
    expect(ledger.drivetrainLoss).toBeGreaterThan(0);
    expect(ledger.consumed).toBeGreaterThan(0);
    expect(ledger.solar).toBeCloseTo(2.0 * 0.2 * 800 * 1.0, 2);
    expect(ledger.roadCoil).toBeCloseTo(30000 * 0.85 * 1.0, 2);

    // Net battery change formula check: (regen + solar + coil) - consumed
    const expectedNet = (ledger.regenReturned + ledger.solar + ledger.roadCoil) - ledger.consumed;
    expect(ledger.netBatteryChange).toBeCloseTo(expectedNet, 6);
  });

  it("subtracts continuous auxiliary electrical load continuously", () => {
    const stationaryInput: SimulationStepInput = {
      ...defaultInput,
      initialSpeed: 0,
      acceleration: 0,
      solar: undefined,
      roadCoil: undefined,
    };

    const result = stepPhysics(stationaryInput);
    expect(result.stepDistance).toBe(0);
    expect(result.energyStep.aeroLoss).toBe(0);
    expect(result.energyStep.consumed).toBe(baseVehicle.auxWatts * 1.0); // only aux drained
    expect(result.energyStep.netBatteryChange).toBe(-baseVehicle.auxWatts * 1.0);
  });

  it("accumulates multiple time steps into an aggregated ledger", () => {
    let cumulativeLedger = createEmptyLedger();
    let currentInput = { ...defaultInput };

    for (let step = 0; step < 5; step++) {
      const result = stepPhysics(currentInput);
      cumulativeLedger = accumulateLedger(cumulativeLedger, result.energyStep);
      currentInput = {
        ...currentInput,
        initialSpeed: result.finalSpeed,
        distance: result.newDistance,
      };
    }

    expect(cumulativeLedger.consumed).toBeGreaterThan(0);
    expect(cumulativeLedger.rollingLoss).toBeGreaterThan(0);
    expect(cumulativeLedger.aeroLoss).toBeGreaterThan(0);
  });
});
