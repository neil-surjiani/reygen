# Dubai RTA Dynamic Wireless Charging Corridor Analysis

An engineering and techno-economic evaluation platform for dynamic wireless (inductive) road charging along Dubai's primary arterial corridor—the Sheikh Mohammed Bin Zayed Road (E311)—prepared for presentation to Dubai's Roads and Transport Authority (RTA).

> **Institutional Disclosure:** This platform is an independent student academic analysis conducted as part of an advanced transportation engineering investigation. It is not an official publication, product, or operational commitment of the Dubai Roads and Transport Authority (RTA) or the Dubai Electricity and Water Authority (DEWA). All data was last verified and updated on **September 28, 2026**.

---

## 1. Executive Summary

This platform implements a high-fidelity digital twin and physical simulation engine for evaluating dynamic in-road inductive power transfer (IPT) along a **29.22 km** corridor of the E311 highway surrounding Dubai Silicon Oasis (DSO).

Every quantitative figure presented on this platform adheres strictly to the project engineering constitution:
1. **Zero Fabricated Data:** Every number originates from a published peer-reviewed source, an official regulatory datasheet, or verified OpenStreetMap/NASA/DEWA datasets. Unquantified theoretical concepts (such as road piezoelectricity or vehicle wind turbines) are explicitly designated with confidence `"unsourced"` and displayed as `"No data"`.
2. **First Law of Thermodynamics:** Energy conservation is strictly verified across every simulation step:
   $$\Delta E_{\text{battery}} + E_{\text{external}} = E_{\text{wheels}} + E_{\text{losses}}$$
   Total conservation error is strictly enforced to less than $0.1\%$.
3. **Rigorous Uncertainty Bounds:** All estimated parameters are subjected to a **2,000-iteration Monte Carlo simulation** using a deterministic seeded Pseudo-Random Number Generator (PRNG), publishing reproducible 5th, 50th, and 95th percentile distributions.

---

## 2. Platform Architecture

```
├── data/
│   ├── raw/                 # Unmodified raw JSON/GeoJSON fetched from external APIs
│   │   ├── osm_e311_corridor_raw.json      # OpenStreetMap Overpass API corridor geometry
│   │   ├── nasa_power_dubai_meteorology.json # NASA POWER solar irradiance & ambient temperature
│   │   ├── dewa_tariffs_raw.json           # DEWA slab tariff documentation & metadata
│   │   └── rta_traffic_dubai_raw.json      # Dubai Pulse / RTA open data traffic telemetry
│   └── processed/           # Normalized, validated datasets consumed by the simulator
│       ├── e311.geojson                     # 14 LineString ways, 12 interchanges, speed limits
│       ├── solar_temperature_dubai.json     # Monthly GHI (kWh/m²/day) & dry-bulb temperatures
│       ├── dewa_electricity_tariffs.json    # Commercial slab tariffs (0.23, 0.28, 0.32, 0.38 AED/kWh)
│       └── dubai_vehicle_and_ev_registrations.json # EV registrations & corridor traffic audit
├── pipeline/                # Python data acquisition pipelines (standard library urllib)
│   ├── fetch_corridor_osm.py                # Overpass API highway extractor for E311 corridor
│   ├── fetch_nasa_solar.py                  # NASA POWER API solar/temperature fetcher
│   ├── fetch_dewa_tariff.py                 # DEWA tariff pipeline & metadata registry
│   └── fetch_dubai_traffic.py               # Dubai Open Data & RTA publication scanner
├── src/
│   ├── app/                 # Next.js 16 App Router (React 19, Tailwind CSS, TypeScript strict)
│   │   ├── page.tsx                         # Executive summary & Uncertainty KPIs
│   │   ├── corridor/page.tsx                # Interactive MapLibre GL digital twin & simulation
│   │   ├── method/page.tsx                  # Physics derivations & live Assumptions Registry
│   │   ├── data/page.tsx                    # Verifiable dataset provenance & coverage audit
│   │   └── limits/page.tsx                  # Unsolved engineering limits & RTA testing protocol
│   ├── components/          # Accessible, responsive UI components
│   │   ├── corridor/                        # MapLibre GL vector map, controls, Monte Carlo charts
│   │   └── method/                          # Filterable assumptions table with source links
│   └── lib/                 # Core deterministic TypeScript simulation libraries
│       ├── physics/                         # Tractive force, regenerative braking, inductive IPT
│       ├── registry/                        # Typed assumptions loader, schema, and provenance validator
│       ├── route/                           # Speed profiling, deceleration ramps, kinematic integration
│       ├── sensitivity/                     # 2,000-run seeded Monte Carlo & coverage sweep
│       └── cost/                            # DEWA tariff cost, coil CAPEX, and payback model
└── tests/                   # Vitest unit & integration test suites
    ├── physics.test.ts                      # Thermodynamic conservation, hand calculations, monotonicity
    ├── route.test.ts                        # Kinematic velocity profile, signal stops, distance checks
    ├── sensitivity.test.ts                  # Seeded PRNG reproducibility & Monte Carlo convergence
    └── cost.test.ts                         # Infrastructure CAPEX & DEWA electricity tariff accounting
```

---

## 3. Physical Model & Equations

The simulation executes on $1.0\text{ m}$ discrete kinematic steps along the corridor.

### 3.1 Tractive Force ($F_{\text{tractive}}$)
$$F_{\text{tractive}} = F_{\text{roll}} + F_{\text{aero}} + F_{\text{grade}} + F_{\text{inertial}}$$
- **Rolling Resistance:** $F_{\text{roll}} = m \cdot g \cdot C_{\text{rr}} \cdot \cos\theta$
- **Aerodynamic Drag:** $F_{\text{aero}} = 0.5 \cdot \rho_{\text{air}} \cdot (C_{\text{d}} \cdot A) \cdot (v + v_{\text{wind}})^2$
- **Grade Resistance:** $F_{\text{grade}} = m \cdot g \cdot \sin\theta$ (evaluated from road elevation profiles)
- **Longitudinal Inertia:** $F_{\text{inertial}} = m \cdot a$

### 3.2 Propulsion vs. Regenerative Braking
- **Driving Propulsion ($P_{\text{wheel}} > 0$):**
  $$P_{\text{battery\_draw}} = \frac{P_{\text{wheel}}}{\eta_{\text{motor}}}$$
  $$P_{\text{drivetrain\_loss}} = P_{\text{battery\_draw}} - P_{\text{wheel}}$$
- **Regenerative Braking ($P_{\text{wheel}} < 0$):**
  $$F_{\text{regen\_max}} = m \cdot a_{\text{regen\_ceiling}} \quad (a_{\text{regen\_ceiling}} \approx 2.0\text{ m/s}^2)$$
  $$F_{\text{regen}} = \min(|F_{\text{tractive}}|, F_{\text{regen\_max}})$$
  $$F_{\text{friction}} = |F_{\text{tractive}}| - F_{\text{regen}}$$
  $$P_{\text{regen\_return}} = F_{\text{regen}} \cdot v \cdot \eta_{\text{regen}}$$
  Any braking requirement beyond $a_{\text{regen\_ceiling}}$ is dissipated into mechanical friction heat:
  $$P_{\text{friction\_heat}} = F_{\text{friction}} \cdot v$$

### 3.3 Inductive Road Power & Solar Gains
- **Dynamic Road Coils:**
  $$P_{\text{road}} = P_{\text{coil}} \cdot \eta_{\text{coupling}} \quad \text{(active only over energized segments)}$$
- **Rooftop Solar PV:**
  $$P_{\text{solar}} = A_{\text{panel}} \cdot \eta_{\text{cell}} \cdot G_{\text{irradiance}}$$
- **Net Battery Power:**
  $$P_{\text{net}} = P_{\text{road}} + P_{\text{solar}} + P_{\text{regen\_return}} - P_{\text{propulsion}} - P_{\text{auxiliary}}$$

---

## 4. Reproducing the Data Pipelines

All data acquisition scripts reside in `/pipeline` and execute under standard Python 3 (3.8+) without external third-party dependencies.

### Step 1: OpenStreetMap Corridor Acquisition
Fetches the continuous highway geometry, lane counts, maxspeed tags, and interchange nodes for the E311 highway corridor:
```bash
python pipeline/fetch_corridor_osm.py
```
*Outputs: `data/raw/osm_e311_corridor_raw.json` and `data/processed/e311.geojson`.*

### Step 2: NASA POWER Solar & Temperature Retrieval
Retrieves 10-year monthly averaged global horizontal irradiance (GHI) and 2-meter air temperature for Dubai coordinates ($25.12^\circ\text{N}, 55.38^\circ\text{E}$):
```bash
python pipeline/fetch_nasa_solar.py
```
*Outputs: `data/raw/nasa_power_dubai_meteorology.json` and `data/processed/solar_temperature_dubai.json`.*

### Step 3: DEWA Electricity Tariff Structuring
Parses Dubai Electricity and Water Authority (DEWA) commercial slab rates and slab thresholds:
```bash
python pipeline/fetch_dewa_tariff.py
```
*Outputs: `data/raw/dewa_tariffs_raw.json` and `data/processed/dewa_electricity_tariffs.json`.*

### Step 4: Dubai Pulse & RTA Traffic Statistics
Audits Dubai Open Data Portal (Dubai Pulse) and RTA statistical yearbooks for highway volume counts:
```bash
python pipeline/fetch_dubai_traffic.py
```
*Outputs: `data/raw/rta_traffic_dubai_raw.json` and `data/processed/dubai_vehicle_and_ev_registrations.json`.*

---

## 5. Verification & Testing Suite

The testing pipeline incorporates Vitest and static audit verifiers.

### Run All Test Suites
```bash
npm test
```
*Executes 65 unit and integration tests across 7 suites, verifying:*
1. **Thermodynamic Conservation:** Verifies $\Delta E_{\text{battery}} + E_{\text{ext}} = E_{\text{mech}} + E_{\text{loss}}$ within $\pm 0.1\%$ across all test scenarios.
2. **Hand Calculations:** Matches analytical steady-state tractive force arithmetic step-by-step.
3. **Kinetic Energy Limits:** Ensures regenerative braking never recovers more energy than $\frac{1}{2} m v^2$.
4. **Monotonicity:** Confirms that increasing vehicle mass, aerodynamic drag, or rolling resistance never decreases energy consumption.
5. **Monte Carlo Seeded PRNG Reproducibility:** Verifies that repeated 2,000-run simulations yield identical numeric percentiles down to $10^{-6}\text{ Wh/km}$.

### Run TypeScript & Lint Checks
```bash
npm run typecheck
npm run lint
```

### Run Automated Data Audit
```bash
npm run audit:data
```
The data audit script (`scripts/audit-data.mjs`):
- Ingests all 36 parameters from `src/lib/registry/assumptions.json`.
- Ingests all numeric values from processed datasets (`e311.geojson`, `dewa_electricity_tariffs.json`, `dubai_vehicle_and_ev_registrations.json`, `solar_temperature_dubai.json`).
- Recursively parses all JSX/TSX components in `src/app` and `src/components`.
- Verifies that **zero ungrounded or synthetic numeric literals** are rendered in the UI.
- Confirms all unsourced parameters (`spec_piezoelectric_road`, `spec_vehicle_wind_turbine`) have `value: null` and render `"No data"`.

---

## 6. Local Development & Production Build

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Optimized Production Build
```bash
npm run build
npm start
```

---

## 7. Deployment to Vercel

The project is configured for deployment on [Vercel](https://vercel.com):

1. **Deploy via Vercel CLI:**
   ```bash
   npx vercel
   npx vercel --prod
   ```
2. **Deploy via GitHub Integration:**
   - Push the repository to GitHub.
   - Import the repository in the Vercel Dashboard.
   - Framework preset: **Next.js**.
   - Build command: `npm run build`.
   - Output directory: `.next`.
   - Environment variables: None required (all datasets are prerendered and statically integrated).

---

## 8. Data Attribution & Licences

- **OpenStreetMap Data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licensed under the [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1.0/).
- **Basemap Tiles:** © [Esri](https://www.esri.com), using Esri World Dark Gray Canvas.
- **Meteorological & Solar Data:** NASA Langley Research Center (LaRC) POWER Project, open public data.
- **Electricity Tariffs:** [Dubai Electricity and Water Authority (DEWA)](https://www.dewa.gov.ae/en/consumer/billing/slab-tariff), official published commercial slab tariff schedule.
- **Corridor & Fleet Data:** Dubai Open Data Portal ([Dubai Pulse](https://www.dubaipulse.gov.ae/)) & RTA Annual Statistical Reports.
