# Physics Engine: Extracted Formulas & Analysis

This document catalogs the physical models extracted from `Regen Model.html`, details their mathematical implementation in `/src/lib/physics`, and highlights inconsistencies, questionable assumptions, and physical discrepancies identified in the original HTML simulator.

---

## 1. Catalog of Extracted Physics Formulas

### 1.1 Tractive Resistance Forces
Per time step, total tractive force at the wheels is the algebraic sum of four components:
$$F_{\text{tractive}} = F_{\text{roll}} + F_{\text{drag}} + F_{\text{grade}} + F_{\text{inertia}}$$

1. **Rolling Resistance ($F_{\text{roll}}$):**
   $$F_{\text{roll}} = m \cdot g \cdot C_{rr} \cdot \cos\theta$$
   - $m$: Total vehicle + payload mass (kg)
   - $g$: Gravitational acceleration ($9.81\ \text{m/s}^2$)
   - $C_{rr}$: Tyre-road rolling resistance coefficient (dimensionless)
   - $\theta$: Incline angle ($\text{rad}$), derived from $\theta = \arctan(\text{grade\%} / 100)$

2. **Aerodynamic Drag ($F_{\text{drag}}$):**
   $$F_{\text{drag}} = \frac{1}{2} \cdot \rho \cdot C_d A \cdot v_{\text{rel}}^2$$
   - $\rho$: Ambient air density ($1.204\ \text{kg/m}^3$ at $20^\circ\text{C}$, sea level)
   - $C_d A$: Drag area product ($m^2$)
   - $v_{\text{rel}}$: Relative airspeed: $\max(0, v + v_{\text{headwind}})$

3. **Gravitational Grade Force ($F_{\text{grade}}$):**
   $$F_{\text{grade}} = m \cdot g \cdot \sin\theta$$
   - Positive when ascending uphill (resisting vehicle motion)
   - Negative when descending downhill (pulling vehicle forward)

4. **Inertial Force ($F_{\text{inertia}}$):**
   $$F_{\text{inertia}} = m \cdot a$$
   - $a$: Linear acceleration ($\text{m/s}^2$)

---

### 1.2 Powertrain & Wheel Power

1. **Mechanical Wheel Power ($P_{\text{wheel}}$):**
   $$P_{\text{wheel}} = F_{\text{tractive}} \cdot v$$

2. **Propulsion / Driving Mode ($F_{\text{tractive}} > 0$):**
   - Electrical power drawn from battery:
     $$P_{\text{battery, drive}} = \frac{P_{\text{wheel}}}{\eta_{\text{drive}}}$$
   - Inverter/motor/transmission dissipation loss:
     $$P_{\text{loss, drive}} = P_{\text{battery, drive}} - P_{\text{wheel}} = P_{\text{wheel}} \cdot \left(\frac{1}{\eta_{\text{drive}}} - 1\right)$$
   - Friction brake dissipation: $P_{\text{friction}} = 0$
   - Regenerative recovery: $P_{\text{regen, elec}} = 0$

3. **Braking / Deceleration Mode ($F_{\text{tractive}} \le 0$):**
   - Required retarding wheel force: $F_{\text{retard}} = |F_{\text{tractive}}|$
   - Regen deceleration ceiling limit:
     $$F_{\text{regen, max}} = m \cdot a_{\text{regen, ceiling}}$$
   - Regen mechanical force captured:
     $$F_{\text{regen}} = \min(F_{\text{retard}}, F_{\text{regen, max}})$$
   - Excess retarding force absorbed by friction brakes:
     $$F_{\text{friction}} = \max(0, F_{\text{retard}} - F_{\text{regen}})$$
   - Mechanical power split:
     $$P_{\text{regen, mech}} = F_{\text{regen}} \cdot v, \quad P_{\text{friction, heat}} = F_{\text{friction}} \cdot v$$
   - Electrical energy recovered into battery:
     $$P_{\text{regen, elec}} = P_{\text{regen, mech}} \cdot \eta_{\text{regen}}$$
   - Conversion losses in generator and power electronics:
     $$P_{\text{loss, regen}} = P_{\text{regen, mech}} \cdot (1 - \eta_{\text{regen}})$$

---

### 1.3 Continuous Auxiliary Load
Continuous base electrical load (lighting, control electronics, onboard computing, HVAC):
$$P_{\text{aux}} = \text{const} \quad (\text{e.g., } 15\ \text{W for 2-wheeler, } 120\ \text{W for passenger EV, } 1500\text{--}3000\ \text{W for transit bus})$$
Energy consumed per time step: $E_{\text{aux}} = P_{\text{aux}} \cdot \Delta t$.

---

### 1.4 External Energy Inputs

1. **Rooftop Solar PV ($P_{\text{solar}}$):**
   - Primary formula:
     $$P_{\text{solar}} = A_{\text{pv}} \cdot \eta_{\text{cell}} \cdot I_{\text{solar}}$$
   - Optional thermal derate:
     $$T_{\text{cell}} = T_{\text{amb}} + 25 \cdot \left(\frac{I_{\text{solar}}}{800}\right)$$
     $$f_{\text{derate}} = \max\left(0.5,\; 1 - 0.004 \cdot \max(0, T_{\text{cell}} - 25)\right)$$
     $$P_{\text{solar, derated}} = P_{\text{solar}} \cdot f_{\text{derate}}$$

2. **Roadway Inductive Dynamic Wireless Charging ($P_{\text{roadCoil}}$):**
   - Track block geometry: Block length $L_{\text{block}}$ (e.g., $400\ \text{m}$), active coverage ratio $f_{\text{cov}}$ ($0 \le f_{\text{cov}} \le 1$).
   - Active position within block:
     $$s_{\text{block}} = d \pmod{L_{\text{block}}}$$
     $$\text{isOverCoil} = (s_{\text{block}} < L_{\text{block}} \cdot f_{\text{cov}})$$
   - Power delivered to battery:
     $$P_{\text{roadCoil}} = \begin{cases} P_{\text{coil, rated}} \cdot \eta_{\text{coupling}} & \text{if } \text{isOverCoil} \\ 0 & \text{otherwise} \end{cases}$$

---

### 1.5 Integrated Energy Ledger (Joules)
For each time step $\Delta t$ with distance increment $\Delta d = v_{\text{avg}} \cdot \Delta t$:

| Ledger Key | Physical Meaning | Formula |
| :--- | :--- | :--- |
| `consumed` | Total battery energy drawn | $E_{\text{elec, drive}} + E_{\text{aux}}$ |
| `aeroLoss` | Aerodynamic drag dissipation | $F_{\text{drag}} \cdot \Delta d$ |
| `rollingLoss` | Rolling resistance dissipation | $F_{\text{roll}} \cdot \Delta d$ |
| `gradeWork` | Gravitational potential work | $F_{\text{grade}} \cdot \Delta d$ (+$=$ climb, - $=$ descent) |
| `frictionHeat` | Mechanical brake disc heat | $F_{\text{friction}} \cdot \Delta d$ |
| `drivetrainLoss`| Inverter/motor/gear conversion loss| $E_{\text{loss, drive}} + E_{\text{loss, regen}}$ |
| `regenReturned`| Electrical energy recovered to battery| $P_{\text{regen, elec}} \cdot \Delta t$ |
| `solar` | Solar PV energy into battery | $P_{\text{solar}} \cdot \Delta t$ |
| `roadCoil` | Inductive road energy into battery | $P_{\text{roadCoil}} \cdot \Delta t$ |
| `netBatteryChange`| Net battery state of charge delta | $(E_{\text{regen}} + E_{\text{solar}} + E_{\text{roadCoil}}) - E_{\text{consumed}}$ |

---

## 2. Dubious and Inconsistent Formulas Flagged in `Regen Model.html`

The following discrepancies, unphysical assumptions, and inconsistencies were identified in `Regen Model.html`. None were adopted silently; they are explicitly flagged below:

### Flag 1: Incomplete Rolling Resistance Normal Force
- **In HTML:** `var fRoll = vPrev > 0.05 ? crr * mass * G : 0;`
- **Issue:** The HTML omitted the cosine of the road incline angle ($\cos\theta$). On an incline, normal force is $F_N = m \cdot g \cdot \cos\theta$. While $\cos\theta \approx 1$ for small angles ($<3^\circ$), for steeper ramps (e.g., flyovers, $6\text{--}10\%$), omitting $\cos\theta$ overstates normal force and tyre friction.
- **Resolution in TypeScript:** Corrected to $F_{\text{roll}} = m \cdot g \cdot C_{rr} \cdot \cos\theta$.

### Flag 2: Artificial Speed Cutoff for Road Coil Charging ($v > 0.4\ \text{m/s}$)
- **In HTML:** `isOverRoadCoil = ... && (v > 0.4);`
- **Issue:** The HTML arbitrarily shut off dynamic wireless road coil charging whenever speed dropped below $0.4\ \text{m/s}$ ($\approx 1.4\ \text{km/h}$). Inductive power transfer depends on magnetic coupling between ground coils and the vehicle pickup pad, not vehicle speed. In congested stop-and-go traffic over active coils, vehicles continue to receive power.
- **Resolution in TypeScript:** By default, coil activation is purely spatial ($s_{\text{block}} < L_{\text{block}} \cdot f_{\text{cov}}$). An optional `minSpeedThreshold` parameter is provided if a specific RTA operational constraint requires speed gating, but it is not hardcoded.

### Flag 3: Bespoke "Downhill Retarder" (`totDownhill`) Conflating Gravitational Work
- **In HTML:** Lines 564–585 introduce a bespoke `fRetard` and separate `totDownhill` ledger line:
  ```javascript
  var fExcessGravity = Math.max(0, fGravityPull - fDrag - fRoll);
  var fRetard = Math.min(fExcessGravity, fRetardLimit);
  ```
- **Issue:** Gravity is a conservative mechanical field. When descending, $F_{\text{grade}} < 0$, which releases gravitational potential energy into forward vehicle thrust. That thrust naturally offsets resistive forces and either accelerates the vehicle or is captured by the vehicle's regenerative braking. Splitting grade descent into a bespoke "downhill retarder" separate from normal regen creates double-counting risks and non-standard ledger accounting.
- **Resolution in TypeScript:** Unified into standard longitudinal dynamics. Negative grade work enters the vehicle mechanical equation naturally; any excess mechanical power is recovered via the regenerative braking subsystem up to the deceleration ceiling.

### Flag 4: Vehicle-Mounted Wind Turbine Violating Betz's Law / Thermodynamics
- **In HTML:**
  ```javascript
  fTurbDrag = 0.5 * rho * aTurb * vRel * vRel * 0.85;
  curTurbineNetW = 0.5 * rho * aTurb * Math.pow(vRel, 3) * 0.28 * 0.70;
  ```
- **Issue:** Mounting a wind turbine on an automobile or scooter to generate electricity from forward vehicle motion creates aerodynamic drag on the vehicle ($F_{\text{drag}} \cdot v$) that strictly exceeds the electrical power generated by the turbine due to the Betz limit ($C_p \le 16/27 \approx 59.3\%$) and generator/inverter inefficiencies ($\approx 20\text{--}40\%$). The net energy change of such a system is always strictly negative. In the HTML, turbine power was credited directly to the battery while vehicle traction paid the drag. To avoid misleading RTA officials with "perpetual motion" harvesting concepts, this is flagged as unviable.
- **Resolution in TypeScript:** Omitted from the default pure powertrain physics. Documented here as non-viable.

### Flag 5: Heuristic Harvesters (Suspension, Thermoelectric, Piezoelectric, Wake)
- **In HTML:**
  ```javascript
  curSuspensionW = (suspBase + suspScale * Math.min(1.0, vAvgAll / 14)) * (regenEff / 0.65);
  curThermoW = (tegBase + tegScale * Math.min(1.0, vAvgAll / 14)) * (regenEff / 0.65);
  curPiezoW = (piezoBase + piezoScale * Math.min(1.0, vAvgAll / 14));
  curWakeW = (wakeBase + wakeScale * Math.min(1.0, vAvgAll / 14));
  ```
- **Issue:** These harvesters are represented as crude empirical linear functions clamped at $14\ \text{m/s}$ ($\approx 50\ \text{km/h}$) without real physical parameters (e.g., road roughness ISO 8608, damper dissipation rates, Seebeck coefficient $\Delta T$, fluid boundary layer energy). Per **Rule 1 of AGENTS.md** ("NO FABRICATED DATA"), ungrounded heuristic numbers cannot be presented to Dubai RTA as verified engineering calculations.
- **Resolution in TypeScript:** Excluded from the core physical equations.

### Flag 6: Hardcoded Solar PV Derating Factors
- **In HTML:** `return irr * area * panelEff * tempDerate * 0.92;`
- **Issue:** The $0.92$ coefficient (8% balance-of-system/wiring/soiling loss) and temperature rise model $T_{\text{cell}} = T_{\text{amb}} + 25 \cdot (I / 800)$ were hardcoded magic numbers without parameterization or data source attribution.
- **Resolution in TypeScript:** The core formula is $P_{\text{solar}} = A \cdot \eta_{\text{cell}} \cdot I_{\text{solar}}$. The temperature derate model is retained as an optional, explicitly parameterized flag (`applyTemperatureDerating`).

### Flag 7: Numerical Integration Drift between Driving vs Braking
- **In HTML:** When braking, the time step was conditionally shortened (`actualDt = Math.min(dt, vPrev / aTotalDecel)`), but aerodynamic drag and rolling resistance were computed at $v_{\text{prev}}$ instead of the interval average $v_{\text{avg}}$. In driving mode, work was computed as $F_{\text{forward}} \cdot v_{\text{avg}} \cdot \Delta t$, creating an asymmetry.
- **Resolution in TypeScript:** All forces and energy integrals are consistently integrated using the average velocity over the actual duration $\Delta t_{\text{eff}}$ of the step, ensuring strict numerical conservation of energy.
