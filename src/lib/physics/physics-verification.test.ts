import { describe, it, expect } from "vitest";
import { stepPhysics, createEmptyLedger, accumulateLedger } from "./step";
import { VehicleParameters, EnvironmentConditions, SimulationStepInput } from "./types";
import { gradePercentToRadians } from "./constants";

describe("Physics Verification Test Suite", () => {
  const standardCar: VehicleParameters = {
    mass: 1200, // kg
    cdA: 0.60, // m²
    crr: 0.015,
    driveEfficiency: 0.85,
    regenEfficiency: 0.65,
    maxRegenDecel: 2.0, // m/s²
    maxRegenPower: 30000, // W
    auxWatts: 150, // W
  };

  const standardEnv: EnvironmentConditions = {
    airDensity: 1.200, // kg/m³
    gradeAngleRad: 0,
    headwindSpeed: 0,
    solarIrradiance: 0,
    ambientTemperature: 25,
  };

  // =========================================================================
  // Requirement 1: Energy Conservation on Every Scenario
  // "On every scenario, energy drawn from the battery plus external input must
  // equal energy delivered to the wheels plus all losses. Fail if it differs
  // by more than 0.1%."
  // =========================================================================
  describe("1. Energy Conservation (< 0.1% discrepancy)", () => {
    interface ScenarioTestConfig {
      name: string;
      input: SimulationStepInput;
    }

    const scenarios: ScenarioTestConfig[] = [
      {
        name: "Steady-state cruising on flat road",
        input: {
          dt: 1.0,
          initialSpeed: 25,
          acceleration: 0,
          distance: 100,
          vehicle: standardCar,
          environment: standardEnv,
        },
      },
      {
        name: "Forward acceleration on flat road",
        input: {
          dt: 2.0,
          initialSpeed: 10,
          acceleration: 1.5,
          distance: 50,
          vehicle: standardCar,
          environment: standardEnv,
        },
      },
      {
        name: "Climbing a 6% uphill incline",
        input: {
          dt: 1.0,
          initialSpeed: 18,
          acceleration: 0,
          distance: 200,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            gradeAngleRad: gradePercentToRadians(6),
          },
        },
      },
      {
        name: "Accelerating uphill on a 4% incline",
        input: {
          dt: 1.5,
          initialSpeed: 12,
          acceleration: 1.0,
          distance: 80,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            gradeAngleRad: gradePercentToRadians(4),
          },
        },
      },
      {
        name: "High aerodynamic resistance with 10 m/s headwind",
        input: {
          dt: 1.0,
          initialSpeed: 28,
          acceleration: 0,
          distance: 300,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            headwindSpeed: 10,
          },
        },
      },
      {
        name: "Gentle regenerative braking on flat road",
        input: {
          dt: 1.0,
          initialSpeed: 20,
          acceleration: -1.0, // within 2.0 m/s² ceiling
          distance: 400,
          vehicle: standardCar,
          environment: standardEnv,
        },
      },
      {
        name: "Emergency hard braking exceeding regen ceiling (friction heat active)",
        input: {
          dt: 1.0,
          initialSpeed: 25,
          acceleration: -5.0, // well beyond 2.0 m/s² ceiling
          distance: 500,
          vehicle: standardCar,
          environment: standardEnv,
        },
      },
      {
        name: "Descending a -5% downhill grade with regeneration",
        input: {
          dt: 1.0,
          initialSpeed: 22,
          acceleration: -0.5,
          distance: 600,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            gradeAngleRad: gradePercentToRadians(-5),
          },
        },
      },
      {
        name: "Cruising with active rooftop solar input",
        input: {
          dt: 1.0,
          initialSpeed: 20,
          acceleration: 0,
          distance: 700,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            solarIrradiance: 850,
          },
          solar: {
            areaM2: 2.5,
            cellEfficiency: 0.21,
          },
        },
      },
      {
        name: "Cruising over active dynamic wireless road coils",
        input: {
          dt: 1.0,
          initialSpeed: 20,
          acceleration: 0,
          distance: 50, // within 400m * 0.5 = 200m active coil segment
          vehicle: standardCar,
          environment: standardEnv,
          roadCoil: {
            blockLengthM: 400,
            coverageRatio: 0.5,
            coilPowerWatts: 45000,
            couplingEfficiency: 0.85,
          },
        },
      },
      {
        name: "Combined solar and inductive dynamic wireless charging",
        input: {
          dt: 1.0,
          initialSpeed: 20,
          acceleration: 0,
          distance: 60,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            solarIrradiance: 900,
          },
          solar: {
            areaM2: 2.0,
            cellEfficiency: 0.20,
          },
          roadCoil: {
            blockLengthM: 400,
            coverageRatio: 0.4,
            coilPowerWatts: 40000,
            couplingEfficiency: 0.88,
          },
        },
      },
    ];

    scenarios.forEach(({ name, input }) => {
      it(`conserves energy in scenario: ${name}`, () => {
        const result = stepPhysics(input);
        const { energyStep: ledger, finalSpeed, stepDistance } = result;
        const initialSpeed = input.initialSpeed;
        const mass = input.vehicle.mass;

        // Kinetic energy change over this step (positive = speed increased, negative = speed decreased)
        const deltaKE = 0.5 * mass * (finalSpeed * finalSpeed - initialSpeed * initialSpeed);

        if (result.forces.tractiveForce > 0) {
          // --- Driving Mode ---
          // Energy delivered to the wheels from powertrain:
          // E_wheel = F_tractive * stepDistance = deltaKE + aeroLoss + rollingLoss + gradeWork
          const energyDeliveredToWheels = result.wheelPower * result.stepDistance / (result.averageSpeed || 1);
          const mechanicalWorkSinks = deltaKE + ledger.aeroLoss + ledger.rollingLoss + ledger.gradeWork;

          // 1. Wheel-level mechanical conservation:
          // Energy delivered to wheels must equal the sum of kinetic acceleration, aero, roll, and grade work
          expect(Math.abs(energyDeliveredToWheels - mechanicalWorkSinks) / Math.max(1, energyDeliveredToWheels)).toBeLessThan(0.001);

          // 2. Battery electrical-to-wheel conversion:
          // Energy drawn from battery for driving = Energy delivered to wheels + Drivetrain losses
          const driveElecDraw = ledger.consumed - (input.vehicle.auxWatts * input.dt);
          const powertrainDestination = energyDeliveredToWheels + ledger.drivetrainLoss;
          expect(Math.abs(driveElecDraw - powertrainDestination) / Math.max(1, driveElecDraw)).toBeLessThan(0.001);

          // 3. Full system balance:
          // Energy drawn from battery + external input = Energy delivered to wheels + all losses + external credit
          const totalInput = ledger.consumed + ledger.solar + ledger.roadCoil;
          const totalOutput =
            energyDeliveredToWheels +
            ledger.drivetrainLoss +
            (input.vehicle.auxWatts * input.dt) +
            ledger.solar +
            ledger.roadCoil;

          const diffRel = Math.abs(totalInput - totalOutput) / Math.max(1, totalInput);
          expect(diffRel).toBeLessThan(0.001); // Under 0.1% tolerance
        } else {
          // --- Braking / Retardation Mode ---
          // Vehicle momentum (kinetic energy released: -deltaKE) and gravity provide the mechanical retarding work:
          const kineticEnergyReleased = -deltaKE;
          const retardingMechanicalEnergy = Math.abs(result.forces.tractiveForce) * stepDistance;

          // Retarding mechanical energy absorbed by wheel brakes = Friction heat + Drivetrain loss + Regen electrical return
          const brakeSinks = ledger.frictionHeat + ledger.drivetrainLoss + ledger.regenReturned;
          expect(Math.abs(retardingMechanicalEnergy - brakeSinks) / Math.max(1, retardingMechanicalEnergy)).toBeLessThan(0.001);

          // Kinetic energy released balance:
          // -deltaKE = aeroLoss + rollingLoss + gradeWork + frictionHeat + drivetrainLoss + regenReturned
          const totalDissipationAndRecovery =
            ledger.aeroLoss +
            ledger.rollingLoss +
            ledger.gradeWork +
            ledger.frictionHeat +
            ledger.drivetrainLoss +
            ledger.regenReturned;

          expect(Math.abs(kineticEnergyReleased - totalDissipationAndRecovery) / Math.max(1, kineticEnergyReleased)).toBeLessThan(0.001);
        }
      });
    });
  });

  // =========================================================================
  // Requirement 2: Constant Speed on Flat Road (Hand-Calculated Verification)
  // =========================================================================
  describe("2. Constant speed on flat road (hand-calculated arithmetic)", () => {
    it("matches exact manual hand calculation step-by-step", () => {
      /**
       * =====================================================================
       * HAND CALCULATION DERIVATION:
       * =====================================================================
       * Parameters:
       *   m          = 1200.0 kg
       *   g          = 9.81 m/s²
       *   Crr        = 0.015 (dimensionless)
       *   CdA        = 0.60 m²
       *   rho        = 1.200 kg/m³
       *   theta      = 0 rad (flat road)
       *   eta_drive  = 0.85 (85% drivetrain efficiency)
       *   P_aux      = 150.0 W
       *   v          = 25.0 m/s (90.0 km/h)
       *   a          = 0.0 m/s²
       *   dt         = 10.0 s
       *
       * Step 1: Distance
       *   s = v * dt = 25.0 m/s * 10.0 s = 250.0 m
       *
       * Step 2: Rolling Resistance Force & Energy
       *   F_roll = m * g * Crr * cos(0)
       *          = 1200.0 * 9.81 * 0.015 * 1.0
       *          = 176.58 N
       *   E_roll = F_roll * s = 176.58 N * 250.0 m = 44145.0 J
       *
       * Step 3: Aerodynamic Drag Force & Energy
       *   F_drag = 0.5 * rho * CdA * v²
       *          = 0.5 * 1.200 * 0.60 * (25.0)²
       *          = 0.36 * 625.0
       *          = 225.0 N
       *   E_drag = F_drag * s = 225.0 N * 250.0 m = 56250.0 J
       *
       * Step 4: Grade Force & Inertial Force
       *   F_grade   = m * g * sin(0) = 0.0 N  => E_grade = 0.0 J
       *   F_inertia = m * a = 1200 * 0 = 0.0 N => deltaKE = 0.0 J
       *
       * Step 5: Total Tractive Force
       *   F_tractive = F_roll + F_drag + F_grade + F_inertia
       *              = 176.58 + 225.0 + 0.0 + 0.0
       *              = 401.58 N
       *
       * Step 6: Wheel Mechanical Power & Energy
       *   P_wheel = F_tractive * v = 401.58 N * 25.0 m/s = 10039.5 W
       *   E_wheel = P_wheel * dt   = 10039.5 W * 10.0 s   = 100395.0 J
       *   (Check: E_roll + E_drag = 44145.0 + 56250.0 = 100395.0 J)
       *
       * Step 7: Electrical Drive Power & Energy
       *   P_elec_drive = P_wheel / eta_drive
       *                = 10039.5 W / 0.85
       *                = 11811.176470588236 W
       *   E_elec_drive = P_elec_drive * dt
       *                = 118111.76470588236 J
       *
       * Step 8: Drivetrain Loss
       *   E_loss = E_elec_drive - E_wheel
       *          = 118111.76470588236 J - 100395.0 J
       *          = 17716.76470588236 J
       *
       * Step 9: Auxiliary Electrical Energy
       *   E_aux = P_aux * dt = 150.0 W * 10.0 s = 1500.0 J
       *
       * Step 10: Total Energy Consumed from Battery
       *   E_consumed = E_elec_drive + E_aux
       *              = 118111.76470588236 J + 1500.0 J
       *              = 119611.76470588236 J
       *
       * Step 11: Net Battery Energy Change
       *   netBatteryChange = -E_consumed = -119611.76470588236 J
       * =====================================================================
       */

      const input: SimulationStepInput = {
        dt: 10.0,
        initialSpeed: 25.0,
        acceleration: 0.0,
        distance: 0.0,
        vehicle: standardCar,
        environment: standardEnv,
      };

      const result = stepPhysics(input);
      const ledger = result.energyStep;

      // Distance
      expect(result.stepDistance).toBeCloseTo(250.0, 5);

      // Forces
      expect(result.forces.rollingResistance).toBeCloseTo(176.58, 4);
      expect(result.forces.aeroDrag).toBeCloseTo(225.0, 4);
      expect(result.forces.gradeForce).toBe(0.0);
      expect(result.forces.inertialForce).toBe(0.0);
      expect(result.forces.tractiveForce).toBeCloseTo(401.58, 4);

      // Powers
      expect(result.wheelPower).toBeCloseTo(10039.5, 4);
      expect(result.auxPower).toBe(150.0);

      // Energy Ledger components
      expect(ledger.rollingLoss).toBeCloseTo(44145.0, 2);
      expect(ledger.aeroLoss).toBeCloseTo(56250.0, 2);
      expect(ledger.gradeWork).toBe(0.0);
      expect(ledger.frictionHeat).toBe(0.0);
      expect(ledger.regenReturned).toBe(0.0);
      expect(ledger.drivetrainLoss).toBeCloseTo(17716.7647, 2);
      expect(ledger.consumed).toBeCloseTo(119611.7647, 2);
      expect(ledger.netBatteryChange).toBeCloseTo(-119611.7647, 2);
    });
  });

  // =========================================================================
  // Requirement 3: Zero-Speed Idle
  // "Zero-speed idle: only auxiliary load is consumed."
  // =========================================================================
  describe("3. Zero-speed idle", () => {
    it("consumes only auxiliary load when stationary", () => {
      const idleTimeSeconds = 60.0;
      const input: SimulationStepInput = {
        dt: idleTimeSeconds,
        initialSpeed: 0,
        acceleration: 0,
        distance: 500,
        vehicle: standardCar,
        environment: standardEnv,
        solar: undefined,
        roadCoil: undefined,
      };

      const result = stepPhysics(input);
      const ledger = result.energyStep;

      // Vehicle must remain stationary with zero travel
      expect(result.finalSpeed).toBe(0);
      expect(result.averageSpeed).toBe(0);
      expect(result.stepDistance).toBe(0);
      expect(result.newDistance).toBe(500);

      // Motion forces must be zero
      expect(result.forces.aeroDrag).toBe(0);
      expect(result.forces.rollingResistance).toBe(0);
      expect(result.forces.inertialForce).toBe(0);
      expect(result.forces.gradeForce).toBe(0);
      expect(result.forces.tractiveForce).toBe(0);
      expect(result.wheelPower).toBe(0);

      // All motion losses must be exactly zero
      expect(ledger.aeroLoss).toBe(0);
      expect(ledger.rollingLoss).toBe(0);
      expect(ledger.gradeWork).toBe(0);
      expect(ledger.frictionHeat).toBe(0);
      expect(ledger.drivetrainLoss).toBe(0);
      expect(ledger.regenReturned).toBe(0);
      expect(ledger.solar).toBe(0);
      expect(ledger.roadCoil).toBe(0);

      // Consumed energy must equal exactly P_aux * dt
      const expectedAuxJoules = standardCar.auxWatts * idleTimeSeconds; // 150 W * 60 s = 9000 J
      expect(ledger.consumed).toBe(expectedAuxJoules);
      expect(ledger.netBatteryChange).toBe(-expectedAuxJoules);
      expect(result.netBatteryPower).toBe(-standardCar.auxWatts);
    });
  });

  // =========================================================================
  // Requirement 4: Regen Kinetic Energy Bound
  // "Regen can never return more than the kinetic energy available."
  // =========================================================================
  describe("4. Regen kinetic energy bound", () => {
    it("verifies regen returned is strictly less than initial kinetic energy in single-step stop", () => {
      const vInitial = 30.0; // m/s (~108 km/h)
      const aDecel = -2.0; // m/s² (exactly at car's 2.0 m/s² regen ceiling)
      const availableKE = 0.5 * standardCar.mass * vInitial * vInitial; // 0.5 * 1200 * 900 = 540,000 J

      const input: SimulationStepInput = {
        dt: 15.0, // dt long enough to decelerate from 30 to 0 (15 s)
        initialSpeed: vInitial,
        acceleration: aDecel,
        distance: 0,
        vehicle: standardCar,
        environment: standardEnv,
      };

      const result = stepPhysics(input);
      expect(result.finalSpeed).toBe(0);

      // Regen returned must be strictly <= available kinetic energy
      expect(result.energyStep.regenReturned).toBeLessThanOrEqual(availableKE);

      // Because regen efficiency is 65% and road/drag friction absorbs part of the KE,
      // regen returned must be substantially less than available KE
      expect(result.energyStep.regenReturned).toBeLessThan(availableKE * standardCar.regenEfficiency);
    });

    it("verifies regen returned is strictly less than available KE across a multi-step braking trajectory", () => {
      let currentSpeed = 33.33; // ~120 km/h
      const initialTotalKE = 0.5 * standardCar.mass * currentSpeed * currentSpeed;
      let totalRegenReturned = 0;
      let distance = 0;
      const dt = 0.5;
      const decel = -1.8;

      while (currentSpeed > 0.01) {
        const result = stepPhysics({
          dt,
          initialSpeed: currentSpeed,
          acceleration: decel,
          distance,
          vehicle: standardCar,
          environment: standardEnv,
        });

        totalRegenReturned += result.energyStep.regenReturned;
        currentSpeed = result.finalSpeed;
        distance = result.newDistance;

        // At every intermediate step, cumulative regen must not exceed initial KE
        expect(totalRegenReturned).toBeLessThan(initialTotalKE);
      }

      // Final audit: total recovered electrical energy must strictly obey the Second Law of Thermodynamics
      expect(totalRegenReturned).toBeLessThan(initialTotalKE * standardCar.regenEfficiency);
    });

    it("never exceeds kinetic energy even in hard braking beyond regen ceiling", () => {
      const vInitial = 25.0;
      const availableKE = 0.5 * standardCar.mass * vInitial * vInitial;

      const result = stepPhysics({
        dt: 3.57, // stopping time at -7.0 m/s²
        initialSpeed: vInitial,
        acceleration: -7.0, // emergency stop, 3.5x the regen ceiling
        distance: 0,
        vehicle: standardCar,
        environment: standardEnv,
      });

      expect(result.energyStep.regenReturned).toBeLessThan(availableKE);
      // Friction brakes must have dissipated the majority of kinetic energy
      expect(result.energyStep.frictionHeat).toBeGreaterThan(result.energyStep.regenReturned);
    });
  });

  // =========================================================================
  // Requirement 5: Monotonic Checks
  // "Monotonic checks: higher mass, drag or rolling resistance never lowers
  // energy use."
  // =========================================================================
  describe("5. Monotonic checks (higher resistance never lowers energy use)", () => {
    const baseCruiseInput: SimulationStepInput = {
      dt: 10.0,
      initialSpeed: 22.0,
      acceleration: 0.0,
      distance: 0,
      vehicle: standardCar,
      environment: standardEnv,
    };

    it("increases energy consumed monotonically with increasing mass", () => {
      const masses = [800, 1000, 1200, 1500, 2000, 2500]; // kg
      const consumedEnergies = masses.map((m) => {
        const res = stepPhysics({
          ...baseCruiseInput,
          vehicle: { ...standardCar, mass: m },
        });
        return res.energyStep.consumed;
      });

      for (let i = 1; i < consumedEnergies.length; i++) {
        expect(consumedEnergies[i]).toBeGreaterThan(consumedEnergies[i - 1]);
      }
    });

    it("increases energy consumed monotonically with increasing mass under acceleration", () => {
      const masses = [900, 1200, 1600, 2200];
      const accelEnergies = masses.map((m) => {
        const res = stepPhysics({
          ...baseCruiseInput,
          acceleration: 1.5,
          vehicle: { ...standardCar, mass: m },
        });
        return res.energyStep.consumed;
      });

      for (let i = 1; i < accelEnergies.length; i++) {
        expect(accelEnergies[i]).toBeGreaterThan(accelEnergies[i - 1]);
      }
    });

    it("increases energy consumed monotonically with increasing aerodynamic drag (CdA)", () => {
      const cdAs = [0.30, 0.45, 0.60, 0.85, 1.20, 1.60]; // m²
      const consumedEnergies = cdAs.map((cdA) => {
        const res = stepPhysics({
          ...baseCruiseInput,
          vehicle: { ...standardCar, cdA },
        });
        return res.energyStep.consumed;
      });

      for (let i = 1; i < consumedEnergies.length; i++) {
        expect(consumedEnergies[i]).toBeGreaterThan(consumedEnergies[i - 1]);
      }
    });

    it("increases energy consumed monotonically with increasing rolling resistance (Crr)", () => {
      const crrs = [0.008, 0.012, 0.015, 0.020, 0.028];
      const consumedEnergies = crrs.map((crr) => {
        const res = stepPhysics({
          ...baseCruiseInput,
          vehicle: { ...standardCar, crr },
        });
        return res.energyStep.consumed;
      });

      for (let i = 1; i < consumedEnergies.length; i++) {
        expect(consumedEnergies[i]).toBeGreaterThan(consumedEnergies[i - 1]);
      }
    });
  });

  // =========================================================================
  // Requirement 6: Net-Positive is Impossible with All External Inputs Off
  // "Net-positive is impossible with all external inputs off."
  // =========================================================================
  describe("6. Net-positive is impossible without external inputs", () => {
    it("is strictly net-negative in flat road cruising", () => {
      const result = stepPhysics({
        dt: 10.0,
        initialSpeed: 20.0,
        acceleration: 0.0,
        distance: 0,
        vehicle: standardCar,
        environment: standardEnv,
        solar: undefined,
        roadCoil: undefined,
      });

      expect(result.energyStep.solar).toBe(0);
      expect(result.energyStep.roadCoil).toBe(0);
      expect(result.energyStep.netBatteryChange).toBeLessThan(0);
    });

    it("is strictly net-negative across a complete acceleration-to-stop drive cycle", () => {
      // Vehicle starts from 0, accelerates to 60 km/h (16.67 m/s), cruises, and brakes to a halt.
      // With external charging off, round-trip powertrain efficiency and drag make net energy gain impossible.
      let speed = 0;
      let dist = 0;
      let tripLedger = createEmptyLedger();

      // Phase 1: Accelerate 0 -> 16.67 m/s at 1.5 m/s² (11.11 s)
      const accelDt = 1.0;
      for (let t = 0; t < 11; t++) {
        const step = stepPhysics({
          dt: accelDt,
          initialSpeed: speed,
          acceleration: 1.5,
          distance: dist,
          vehicle: standardCar,
          environment: standardEnv,
        });
        tripLedger = accumulateLedger(tripLedger, step.energyStep);
        speed = step.finalSpeed;
        dist = step.newDistance;
      }

      // Phase 2: Cruise at 16.5 m/s for 15 seconds
      for (let t = 0; t < 15; t++) {
        const step = stepPhysics({
          dt: 1.0,
          initialSpeed: speed,
          acceleration: 0,
          distance: dist,
          vehicle: standardCar,
          environment: standardEnv,
        });
        tripLedger = accumulateLedger(tripLedger, step.energyStep);
        speed = step.finalSpeed;
        dist = step.newDistance;
      }

      // Phase 3: Regenerative brake back to a complete stop at -1.5 m/s²
      while (speed > 0.01) {
        const step = stepPhysics({
          dt: 1.0,
          initialSpeed: speed,
          acceleration: -1.5,
          distance: dist,
          vehicle: standardCar,
          environment: standardEnv,
        });
        tripLedger = accumulateLedger(tripLedger, step.energyStep);
        speed = step.finalSpeed;
        dist = step.newDistance;
      }

      // Final speed is 0; vehicle returned to rest
      expect(speed).toBe(0);

      // External inputs are 0
      expect(tripLedger.solar).toBe(0);
      expect(tripLedger.roadCoil).toBe(0);

      // Net battery change must be strictly negative (battery discharged)
      expect(tripLedger.netBatteryChange).toBeLessThan(0);
      expect(tripLedger.consumed).toBeGreaterThan(tripLedger.regenReturned);
    });

    it("is strictly net-negative on a closed elevation circuit (climb hill then descend to start)", () => {
      // Vehicle starts at elevation 0, climbs a 5% grade hill for 1 km, then turns around and descends back to 0.
      const speed = 18.0; // constant speed 18 m/s
      let dist = 0;
      let circuitLedger = createEmptyLedger();

      // Leg 1: Uphill 5% grade for 500 meters
      while (dist < 500) {
        const step = stepPhysics({
          dt: 1.0,
          initialSpeed: speed,
          acceleration: 0,
          distance: dist,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            gradeAngleRad: gradePercentToRadians(5),
          },
        });
        circuitLedger = accumulateLedger(circuitLedger, step.energyStep);
        dist = step.newDistance;
      }

      // Leg 2: Downhill -5% grade for 500 meters back to starting elevation
      const summitDist = dist;
      while (dist < summitDist + 500) {
        const step = stepPhysics({
          dt: 1.0,
          initialSpeed: speed,
          acceleration: 0,
          distance: dist,
          vehicle: standardCar,
          environment: {
            ...standardEnv,
            gradeAngleRad: gradePercentToRadians(-5),
          },
        });
        circuitLedger = accumulateLedger(circuitLedger, step.energyStep);
        dist = step.newDistance;
      }

      // Net gravitational work over a closed vertical loop is exactly 0
      expect(circuitLedger.gradeWork).toBeCloseTo(0, 3);

      // External inputs are 0
      expect(circuitLedger.solar).toBe(0);
      expect(circuitLedger.roadCoil).toBe(0);

      // Net battery change over the closed elevation loop MUST be strictly negative
      expect(circuitLedger.netBatteryChange).toBeLessThan(0);
    });
  });
});
