/**
 * Types and interfaces for the vehicle dynamics and inductive charging physics model.
 */

export interface VehicleParameters {
  /** Total vehicle plus passenger/cargo mass in kilograms (kg) */
  mass: number;
  /** Aerodynamic drag area (Cd * A) in square meters (m²) */
  cdA: number;
  /** Rolling resistance coefficient (dimensionless) */
  crr: number;
  /** Motor and inverter drive efficiency when propelling (0 to 1) */
  driveEfficiency: number;
  /** Round-trip regenerative braking efficiency (0 to 1) */
  regenEfficiency: number;
  /** Maximum regenerative deceleration ceiling in m/s² */
  maxRegenDecel: number;
  /** Maximum regenerative electrical power limit in Watts (W), optional */
  maxRegenPower?: number;
  /** Continuous auxiliary electronics/HVAC base electrical power in Watts (W) */
  auxWatts: number;
}

export interface EnvironmentConditions {
  /** Air density in kg/m³ (default: 1.204 at 20°C sea level) */
  airDensity: number;
  /** Road grade angle in radians (positive = uphill, negative = downhill) */
  gradeAngleRad: number;
  /** Headwind speed in m/s (positive = opposing vehicle motion, negative = tailwind) */
  headwindSpeed?: number;
  /** Solar irradiance normal/global in W/m² */
  solarIrradiance?: number;
  /** Ambient air temperature in °C */
  ambientTemperature?: number;
}

export interface SolarConfiguration {
  /** Active photovoltaic collector area in square meters (m²) */
  areaM2: number;
  /** Nominal cell efficiency at 25°C (0 to 1) */
  cellEfficiency: number;
  /** Whether to apply PV temperature derating factor */
  applyTemperatureDerating?: boolean;
}

export interface RoadCoilConfiguration {
  /** Length of the repeating track block in meters (e.g. 400 m) */
  blockLengthM: number;
  /** Coverage ratio of energized coils within each block (0 to 1) */
  coverageRatio: number;
  /** Active wireless power transmitted by coil in Watts (W) */
  coilPowerWatts: number;
  /** Magnetic induction coupling efficiency from grid/coil to onboard battery (0 to 1) */
  couplingEfficiency: number;
  /** Optional minimum speed in m/s required for dynamic charging (default: 0) */
  minSpeedThreshold?: number;
}

export interface SimulationStepInput {
  /** Time step duration in seconds (s) */
  dt: number;
  /** Vehicle initial speed at start of step in m/s */
  initialSpeed: number;
  /** Commanded vehicle acceleration in m/s² (positive = accel, negative = decel) */
  acceleration: number;
  /** Current cumulative travel distance in meters (m) */
  distance: number;
  /** Vehicle mechanical and electrical parameters */
  vehicle: VehicleParameters;
  /** Ambient and roadway environmental conditions */
  environment: EnvironmentConditions;
  /** Optional rooftop solar configuration */
  solar?: SolarConfiguration;
  /** Optional dynamic roadway wireless inductive charging configuration */
  roadCoil?: RoadCoilConfiguration;
}

export interface ForceBreakdown {
  /** Rolling resistance force in Newtons (N): m * g * Crr * cos(theta) */
  rollingResistance: number;
  /** Aerodynamic drag force in Newtons (N): 0.5 * rho * CdA * v_rel^2 */
  aeroDrag: number;
  /** Gravitational grade force in Newtons (N): m * g * sin(theta) */
  gradeForce: number;
  /** Inertial force in Newtons (N): m * a */
  inertialForce: number;
  /** Net tractive force at wheel rim in Newtons (N): sum of all 4 forces */
  tractiveForce: number;
}

export interface EnergyLedger {
  /** Total electrical energy drawn from the battery (propulsion electrical draw + aux) in Joules (J) */
  consumed: number;
  /** Mechanical work dissipated by aerodynamic drag in Joules (J) */
  aeroLoss: number;
  /** Mechanical work dissipated by tyre rolling resistance in Joules (J) */
  rollingLoss: number;
  /**
   * Work done against gravity in Joules (J).
   * Positive when climbing (energy stored as gravitational potential).
   * Negative when descending (gravitational potential released to vehicle).
   */
  gradeWork: number;
  /** Kinetic energy dissipated as heat by mechanical friction brake pads in Joules (J) */
  frictionHeat: number;
  /** Inverter, motor, and transmission conversion losses (both traction and regeneration) in Joules (J) */
  drivetrainLoss: number;
  /** Electrical energy recovered back into the battery via regenerative braking in Joules (J) */
  regenReturned: number;
  /** Electrical energy received from solar photovoltaic panels into the battery in Joules (J) */
  solar: number;
  /** Electrical energy received from road dynamic wireless charging coils into the battery in Joules (J) */
  roadCoil: number;
  /**
   * Net battery energy change in Joules (J).
   * Positive = net charge gain (battery ends step higher).
   * Negative = net discharge drain (battery ends step lower).
   * Formula: (regenReturned + solar + roadCoil) - consumed
   */
  netBatteryChange: number;
}

export interface SimulationStepResult {
  /** Final speed at end of time step in m/s */
  finalSpeed: number;
  /** Average speed over the step in m/s */
  averageSpeed: number;
  /** Distance traveled during this step in meters (m) */
  stepDistance: number;
  /** Cumulative distance after this step in meters (m) */
  newDistance: number;
  /** Instantaneous forces acting on the vehicle in Newtons (N) */
  forces: ForceBreakdown;
  /** Instantaneous mechanical wheel power in Watts (W): F_tractive * v */
  wheelPower: number;
  /** Electrical power drawn from or delivered to battery by the powertrain in Watts (W) */
  powertrainElectricalPower: number;
  /** Continuous auxiliary electrical power in Watts (W) */
  auxPower: number;
  /** Solar power into battery in Watts (W) */
  solarPower: number;
  /** Road inductive coil power into battery in Watts (W) */
  roadCoilPower: number;
  /** Whether the vehicle is currently positioned over an active energized road coil */
  isOverActiveCoil: boolean;
  /** Net battery electrical power in Watts (W): negative = drain, positive = charge */
  netBatteryPower: number;
  /** Integrated energy ledger for this time step in Joules (J) */
  energyStep: EnergyLedger;
}
