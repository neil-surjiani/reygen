import { describe, it, expect } from "vitest";
import {
  loadAssumptionsRegistry,
  getAllAssumptions,
  getAssumptionById,
  getVehicleAssumptions,
  getCorridorAssumptions,
  getEnvironmentAssumptions,
  toVehicleParameters,
  toEnvironmentConditions,
  toSolarConfiguration,
  toRoadCoilConfiguration,
  auditRegistry,
  resolveAssumptionValue,
} from "./loader";
import { stepPhysics } from "../physics";

describe("Assumptions Registry", () => {
  it("loads registry metadata correctly", () => {
    const registry = loadAssumptionsRegistry();
    expect(registry.metadata.title).toContain("Dubai RTA");
    expect(registry.metadata.version).toBeDefined();
    expect(registry.metadata.lastUpdated).toBe("2026-09-28");
  });

  it("contains all 13 required inputs for physics modeling", () => {
    const bus = getVehicleAssumptions("transit_bus");
    const taxi = getVehicleAssumptions("passenger_taxi");
    const corridor = getCorridorAssumptions();
    const env = getEnvironmentAssumptions();

    // 1. Vehicle mass
    expect(bus.mass_kg.value).toBe(15500);
    expect(taxi.mass_kg.value).toBe(1847);

    // 2. Rolling resistance (Crr)
    expect(bus.crr.value).toBe(0.006);
    expect(taxi.crr.value).toBe(0.0088);

    // 3. Drag area (CdA)
    expect(bus.cda_m2.value).toBe(4.875);
    expect(taxi.cda_m2.value).toBe(0.5106);

    // 4. Air density
    expect(env.airDensity_kg_m3.value).toBe(1.184);

    // 5. Motor efficiency
    expect(bus.motorEfficiency.value).toBe(0.91);
    expect(taxi.motorEfficiency.value).toBe(0.92);

    // 6. Regen efficiency
    expect(bus.regenEfficiency.value).toBe(0.7);
    expect(taxi.regenEfficiency.value).toBe(0.75);

    // 7. Regen ceiling
    expect(bus.regenCeiling_mps2.value).toBe(2.0);
    expect(taxi.regenCeiling_mps2.value).toBe(2.0);

    // 8. Auxiliary load
    expect(bus.auxiliaryLoad_W.value).toBe(12000);
    expect(taxi.auxiliaryLoad_W.value).toBe(2000);

    // 9. Solar panel area and efficiency
    expect(bus.solarPanelArea_m2.value).toBe(16.0);
    expect(bus.solarPanelEfficiency.value).toBe(0.215);
    expect(taxi.solarPanelArea_m2.value).toBe(1.8);
    expect(taxi.solarPanelEfficiency.value).toBe(0.215);

    // 10. Coil power
    expect(corridor.coilPower_kW.value).toBe(75);

    // 11. Coupling efficiency
    expect(corridor.couplingEfficiency.value).toBe(0.8);

    // 12. Cost per km of electrified road
    expect(corridor.costPerKm_USD.value).toBe(1600000);
  });

  it("strictly enforces AGENTS.md data governance standards on every item", () => {
    const all = getAllAssumptions();
    expect(all.length).toBeGreaterThanOrEqual(13);

    for (const item of all) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.unit).toBeTruthy();
      expect(item.sourceName).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.dateAccessed).toBe("2026-09-28");
      expect(["measured", "published", "estimated", "unsourced"]).toContain(
        item.confidence
      );
      expect(item.note.length).toBeGreaterThan(10);

      if (item.confidence === "unsourced") {
        expect(item.value).toBeNull();
        expect(item.range).toBeNull();
      } else {
        expect(typeof item.value).toBe("number");
        expect(item.value).toBeGreaterThan(0);

        if (item.range) {
          expect(item.range.min).toBeLessThanOrEqual(item.range.typical);
          expect(item.range.typical).toBeLessThanOrEqual(item.range.max);
        }

        if (item.confidence === "estimated") {
          expect(item.rangeBasis).toBeDefined();
          expect(item.rangeBasis!.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("allows looking up individual items by ID", () => {
    const busMass = getAssumptionById("bus_mass");
    expect(busMass).toBeDefined();
    expect(busMass?.value).toBe(15500);

    const unknown = getAssumptionById("non_existent_id");
    expect(unknown).toBeUndefined();
  });

  it("resolves values correctly across min, typical, and max selections", () => {
    const bus = getVehicleAssumptions("transit_bus");
    expect(resolveAssumptionValue(bus.mass_kg, "min")).toBe(13500);
    expect(resolveAssumptionValue(bus.mass_kg, "typical")).toBe(15500);
    expect(resolveAssumptionValue(bus.mass_kg, "max")).toBe(18000);
  });

  it("throws descriptive error when attempting to resolve an unsourced assumption", () => {
    const unsourced = getAssumptionById("spec_piezoelectric_road");
    expect(unsourced).toBeDefined();
    expect(unsourced?.confidence).toBe("unsourced");

    expect(() => resolveAssumptionValue(unsourced!, "typical")).toThrowError(
      /Cannot resolve numeric value for unsourced assumption/
    );
  });

  it("converts registry parameters to physics engine structs and runs simulation", () => {
    const busParams = toVehicleParameters("transit_bus", "typical");
    const envConditions = toEnvironmentConditions("typical");
    const solarConfig = toSolarConfiguration("transit_bus", "typical");
    const coilConfig = toRoadCoilConfiguration("typical");

    expect(busParams.mass).toBe(15500);
    expect(busParams.auxWatts).toBe(12000);
    expect(coilConfig.coilPowerWatts).toBe(75000); // 75 kW -> 75,000 W

    // Run a real physics step with registry parameters
    const stepResult = stepPhysics({
      dt: 1.0,
      initialSpeed: 20.0,
      acceleration: 0.0,
      distance: 100.0,
      vehicle: busParams,
      environment: envConditions,
      solar: solarConfig,
      roadCoil: coilConfig,
    });

    expect(stepResult.finalSpeed).toBe(20.0);
    expect(stepResult.roadCoilPower).toBe(75000 * 0.8); // 60,000 W transferred
    expect(stepResult.energyStep.roadCoil).toBe(75000 * 0.8 * 1.0); // 60,000 J
    expect(stepResult.energyStep.consumed).toBeGreaterThan(0);
  });

  it("audits the registry and catalogs all sources and unsourced items", () => {
    const report = auditRegistry();
    expect(report.totalCount).toBeGreaterThanOrEqual(13);
    expect(report.measuredCount).toBeGreaterThanOrEqual(1); // coupling efficiency
    expect(report.publishedCount).toBeGreaterThanOrEqual(10);
    expect(report.estimatedCount).toBeGreaterThanOrEqual(2);
    expect(report.unsourcedCount).toBe(2); // speculative harvesters

    expect(report.unsourcedItems).toContain(
      "spec_piezoelectric_road: Roadway Piezoelectric Harvester Power Output"
    );
    expect(report.unsourcedItems).toContain(
      "spec_vehicle_wind_turbine: Vehicle-Mounted Wind Turbine Net Power"
    );
  });
});
