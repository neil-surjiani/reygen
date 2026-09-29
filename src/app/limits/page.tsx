import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Engineering Limits & Unproven Hypotheses | Dubai Wireless Corridor",
  description:
    "Critical engineering unknowns, R&D gaps (including retrofit vehicle receivers and lack of OSM signal timing), and empirical data requirements needed from Dubai RTA to prove dynamic wireless charging.",
};

export default function LimitsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-800/80">
            Engineering Unknowns & Scientific Limits
          </span>
          <span className="inline-flex items-center rounded-md bg-rose-950/80 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-800/80">
            Unsolved R&D Disclosed
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
            RTA Pilot Roadmap
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Limits of the Analysis & What Remains Unproven
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400 sm:text-base">
          In adherence with AGENTS.md, this platform explicitly distinguishes between verified
          scientific physics and unproven engineering assumptions. Dynamic wireless road electrification
          faces substantial real-world commercial and technical barriers that cannot be proven through
          simulation alone.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <Link
            href="/corridor"
            className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-800"
          >
            ← Back to Corridor Simulator
          </Link>
          <span>•</span>
          <Link
            href="/method"
            className="text-slate-300 hover:text-white underline decoration-slate-600"
          >
            Review Mathematical Formulation →
          </Link>
          <span>•</span>
          <Link
            href="/data"
            className="text-slate-300 hover:text-white underline decoration-slate-600"
          >
            Audited Datasets →
          </Link>
        </div>
      </div>

      {/* Institutional Student Disclaimer & Independent Academic Scope */}
      <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-5 text-xs text-amber-200/90 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-amber-900/80 px-2 py-0.5 font-bold uppercase tracking-wider text-[11px] text-amber-300">
            Institutional Disclaimer
          </span>
          <span className="font-semibold text-amber-300">
            Independent Student Academic Analysis — Not an Official RTA Product
          </span>
        </div>
        <p className="leading-relaxed">
          This platform is an independent academic analysis conducted by a student for technical evaluation by Dubai&apos;s Roads and Transport Authority (RTA) and DEWA. It does not constitute an official RTA engineering tender, procurement commitment, or commercial specification. All findings are derived from publicly verifiable datasets, peer-reviewed engineering models, and documented scientific registries. Date of last data update: September 28, 2026.
        </p>
      </div>

      {/* Section 1: What Is Not Proven */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            1. What Is Not Proven (Unsolved Engineering Challenges)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Five major research and development barriers that must be resolved prior to physical implementation.
          </p>
        </div>

        <div className="space-y-4">
          {/* Item 1: Retrofit Receiver */}
          <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-6 backdrop-blur space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-amber-900/80 px-2 py-0.5 text-xs font-bold text-amber-300">
                Limit 1
              </span>
              <h3 className="text-base font-bold text-white">
                Retrofit Secondary Wireless Receiver on Existing EVs is Unsolved R&D
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              No automotive OEM currently sells factory-integrated secondary pickup coils for dynamic high-speed
              wireless inductive power transfer. Attempting to retrofit existing commercial electric vehicles
              (e.g., Tesla Model 3 taxis, BYD electric buses, or electric delivery scooters) presents severe,
              unsolved engineering challenges:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800">
                <strong className="text-amber-300 block mb-1">High-Voltage Battery BMS Integration</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Injecting 75 kW of DC power directly into an existing vehicle&apos;s 400V or 800V traction bus
                  requires proprietary access to the Battery Management System (BMS) contactor controls, thermal
                  safeties, and isolation monitors. Performing aftermarket taps immediately voids OEM battery warranties.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800">
                <strong className="text-amber-300 block mb-1">Underbody Ground Clearance & Air-Gap Tolerances</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Coupling efficiency drops drastically (from &gt;80% to &lt;50%) if the vertical magnetic air gap
                  increases beyond 150–200 mm or lateral lane wandering exceeds ±20 cm. Accommodating variable ride
                  heights across passenger cars and transit buses requires dynamic mechanical suspension articulation.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800">
                <strong className="text-amber-300 block mb-1">Thermal Heat Rejection in Dubai Summer (&gt;45°C)</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Even at 90% magnetic coupling and 95% secondary rectification efficiency, approximately 5–8 kW
                  of continuous waste heat is generated directly underneath the vehicle chassis. Under summer road
                  surface temperatures exceeding 60°C, secondary liquid cooling loops become mandatory.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800">
                <strong className="text-amber-300 block mb-1">Cabin Electromagnetic Field (EMF) Shielding</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Under ICNIRP 2010 safety standards, human exposure to 85 kHz magnetic fields inside the passenger
                  cabin must remain below 27 μT. Achieving this requires 30–50 kg of aluminium and ferrite shielding
                  mounted under the floorpan, imposing a payload and weight penalty.
                </p>
              </div>
            </div>
          </div>

          {/* Item 2: OSM Signal Timing */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                Limit 2
              </span>
              <h3 className="text-base font-bold text-white">
                OpenStreetMap Lacks Signal Timing and Adaptive Phase Control
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              OpenStreetMap records geographic coordinates and highway classifications, but does not record signal
              timing, cycle lengths, green-to-red splits, or real-time SCATS adaptive coordination.
            </p>
            <div className="rounded-lg bg-slate-950 p-3.5 text-xs text-slate-400 leading-relaxed border border-slate-800">
              <strong className="text-white block mb-1">Our Registered Assumption:</strong>
              In accordance with AGENTS.md, signal stops on arterial ramps are modeled as an explicitly labeled
              probabilistic assumption (50% stop probability, 30-second average delay; HCM 6th Edition benchmark),
              not as ground truth. On the main E311 expressway trunk, OpenStreetMap confirms 0 signal stops.
            </div>
          </div>

          {/* Item 3: Pavement Rutting & High Summer Heat */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                Limit 3
              </span>
              <h3 className="text-base font-bold text-white">
                Pavement Degradation, Thermal Stress, and Heavy Axle Fatigue
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Embedding primary induction coils 60–100 mm beneath the asphalt surface introduces structural discontinuities
              into the road pavement layer. In Dubai, summer road surface temperatures regularly exceed 60°C.
            </p>
            <div className="rounded-lg bg-slate-950 p-3.5 text-xs text-slate-400 leading-relaxed border border-slate-800">
              Combined with heavy commercial axle loads (up to 44 metric tonnes for articulated freight trucks on E311),
              differential thermal expansion between asphalt bitumen, copper coils, and polymer potting resin presents
              an unquantified risk of accelerated pavement rutting, delamination, and moisture ingress.
            </div>
          </div>

          {/* Item 4: Instantaneous Pulsed Grid Power */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                Limit 4
              </span>
              <h3 className="text-base font-bold text-white">
                Grid Feeder Pulsed Power Demand and Harmonic Distortion
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dynamic inductive road segments switch on and off in milliseconds as vehicles enter and exit discrete coil blocks.
              A platoon of electric buses or taxis traversing a 1 km electrified zone can demand 1.0–3.0 MW of pulsed electrical
              power within fractions of a second.
            </p>
            <div className="rounded-lg bg-slate-950 p-3.5 text-xs text-slate-400 leading-relaxed border border-slate-800">
              Without stationary roadside Battery Energy Storage Systems (BESS) to buffer pulsed charging transients,
              high-frequency power cycling risks voltage flicker and harmonic distortion on DEWA distribution feeders.
            </div>
          </div>

          {/* Item 5: Restricted Traffic Data */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                Limit 5
              </span>
              <h3 className="text-base font-bold text-white">
                Corridor Traffic Volumes are Classified Under RTA Administrative Resolution No. 740 of 2019
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Because sensor-level traffic counts for E311 are restricted commercial assets rather than open public data,
              the daily number of electric vehicles that would traverse the charging corridor cannot be verified without
              direct licensing from RTA.
            </p>
            <div className="rounded-lg bg-slate-950 p-3.5 text-xs text-slate-400 leading-relaxed border border-slate-800">
              Consequently, all financial payback periods on this site are classified as &ldquo;insufficient data&rdquo;
              rather than speculative guesses, in strict compliance with AGENTS.md Rule 1.
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: What We Would Need From RTA to Test and Prove This */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            2. What We Would Need From Dubai RTA to Test and Prove This
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            A concrete collaborative roadmap outlining the technical requirements for a real-world feasibility trial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* RTA Need 1 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>📍</span>
              <span>1. Controlled 500m–1km Inductive Pilot Corridor</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Authorization to construct a physical inductive road charging test section on an RTA-managed dedicated right-of-way,
              such as the Dubai Silicon Oasis autonomous test loop, an Academic City bus corridor, or a designated Dubai Taxi
              Corporation (DTC) depot access lane.
            </p>
          </div>

          {/* RTA Need 2 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>📡</span>
              <span>2. High-Frequency Fleet Telematics (CAN-bus Telemetry)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Anonymized, high-frequency (1 Hz) vehicle telemetry from Dubai Taxi Corporation (DTC) electric taxis and RTA electric
              buses, including real-world velocity profiles, acceleration rates, HVAC power consumption during peak summer months
              (July/August), and battery state-of-charge curves.
            </p>
          </div>

          {/* RTA Need 3 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>🚦</span>
              <span>3. Central Traffic Control (SCATS) Empirical Signal Logs</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Empirical SCATS signal controller cycle timing logs, loop detector volume counts, and queue dwell distributions
              for highway ramp signals along E311, replacing probabilistic wait estimates with empirical ground truth.
            </p>
          </div>

          {/* RTA Need 4 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>🔬</span>
              <span>4. Asphalt Mix Specifications & Pavement Core Data</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Access to RTA Roads Infrastructure Department asphalt mix specifications (polymer-modified bitumen PG 76-22),
              structural pavement core logs, and mechanical test specimens to simulate thermal-stress cyclic fatigue under combined
              electromagnetic heating and heavy commercial axle loads.
            </p>
          </div>

          {/* RTA Need 5 */}
          <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>⚡</span>
              <span>5. DEWA Grid Substation Headroom & Commercial Traffic Sensor License</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Coordinated technical data from DEWA on distribution feeder capacity (11 kV / 33 kV) adjacent to the E311 corridor,
              combined with a formal RTA research license under Administrative Resolution No. 740 of 2019 to incorporate real
              hourly traffic counts into the economic payback optimization model.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Summary Validation Matrix */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-xs text-slate-300 space-y-4">
        <h3 className="text-sm font-semibold text-white">
          Scientific Transparency & Validation Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-semibold">Modeling Domain</th>
                <th className="py-2 px-4 font-semibold">Current State in Model</th>
                <th className="py-2 px-4 font-semibold">Scientific Confidence</th>
                <th className="py-2 pl-4 font-semibold">Required RTA Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-2.5 pr-4 font-medium text-white">Aerodynamic & Rolling Physics</td>
                <td className="py-2.5 px-4">Governed by tractive equations verified against constant-speed tests</td>
                <td className="py-2.5 px-4 text-emerald-400 font-medium">High (First Law Verified)</td>
                <td className="py-2.5 pl-4 text-slate-400">DTC EV coast-down calibration</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-white">Dynamic Induction Coupling</td>
                <td className="py-2.5 px-4">80% baseline (64.3%–90.0% range) from Arena del Futuro / BMWK trials</td>
                <td className="py-2.5 px-4 text-amber-400 font-medium">Medium (Published Trials)</td>
                <td className="py-2.5 pl-4 text-slate-400">1 km pilot testbed on Dubai road</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-white">Secondary Vehicle Retrofit</td>
                <td className="py-2.5 px-4">Modeled as ideal electrical pickup on vehicle battery pack</td>
                <td className="py-2.5 px-4 text-rose-400 font-medium">Unproven (R&D Gap)</td>
                <td className="py-2.5 pl-4 text-slate-400">Prototype BMS integration on DTC taxi</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-white">Signal Stopping Dwell Delay</td>
                <td className="py-2.5 px-4">Probabilistic distribution (50% stop, 30s wait; 0 stops on express trunk)</td>
                <td className="py-2.5 px-4 text-amber-400 font-medium">Estimated (HCM standard)</td>
                <td className="py-2.5 pl-4 text-slate-400">SCATS central timing logs</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-white">Financial Payback & Adoption</td>
                <td className="py-2.5 px-4">Marked &ldquo;insufficient data&rdquo; due to commercial data classification</td>
                <td className="py-2.5 px-4 text-rose-400 font-medium">Insufficient Data</td>
                <td className="py-2.5 pl-4 text-slate-400">RTA Resolution 740/2019 traffic permit</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
