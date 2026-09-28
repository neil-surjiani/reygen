import type { Metadata } from "next";
import Link from "next/link";
import { getAllAssumptions } from "@/lib/registry/loader";
import { AssumptionsRegistryTable } from "@/components/method/AssumptionsRegistryTable";

export const metadata: Metadata = {
  title: "Methodology & Physical Equations | Dubai Wireless Charging Corridor",
  description:
    "Mathematical equations and physics derivations for the Dubai RTA dynamic wireless inductive road charging analysis, with the complete audited assumptions registry.",
};

export default function MethodPage() {
  const assumptions = getAllAssumptions();

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800/80">
            Physical Principles
          </span>
          <span className="inline-flex items-center rounded-md bg-sky-950/80 px-2.5 py-0.5 text-xs font-medium text-sky-400 border border-sky-800/80">
            First Law of Thermodynamics
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
            {assumptions.length} Verified Assumptions
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Physical Formulation & Modeling Methodology
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Every simulation calculation on this platform is executed by a pure TypeScript physics engine
          governed by the laws of motion and thermodynamics. Energy conservation is enforced on every
          time step to within 0.1%, with zero synthetic or placeholder data.
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
            href="/data"
            className="text-slate-300 hover:text-white underline decoration-slate-600"
          >
            Review Source Datasets →
          </Link>
          <span>•</span>
          <Link
            href="/limits"
            className="text-slate-300 hover:text-white underline decoration-slate-600"
          >
            Read Unsolved Engineering Limits →
          </Link>
        </div>
      </div>

      {/* Part 1: Governing Mathematical Equations */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            1. Governing Physics Equations
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Formulated per discrete kinematic step along the road corridor geometry.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Equation 1: Tractive Force */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.1
              </span>
              <span className="text-xs text-slate-400">Tractive Force Breakdown</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              F_tractive = F_roll + F_aero + F_grade + F_inertial
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                <strong className="text-white font-mono">F_roll = m · g · C_rr · cos(θ)</strong> — Tyre rolling resistance on asphalt pavement.
              </p>
              <p>
                <strong className="text-white font-mono">F_aero = 0.5 · ρ · (C_d · A) · (v + v_wind)²</strong> — Aerodynamic drag resisting vehicle forward motion.
              </p>
              <p>
                <strong className="text-white font-mono">F_grade = m · g · sin(θ)</strong> — Gravitational incline resistance (0 on flat expressways).
              </p>
              <p>
                <strong className="text-white font-mono">F_inertial = m · a</strong> — Inertial force required during longitudinal acceleration or deceleration.
              </p>
            </div>
          </div>

          {/* Equation 2: Wheel & Drivetrain Power */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.2
              </span>
              <span className="text-xs text-slate-400">Mechanical Wheel Power</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              P_wheel = F_tractive · v
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                When <strong className="text-emerald-400 font-mono">P_wheel &gt; 0</strong> (driving propulsion):
                <br />
                <code className="text-slate-300 font-mono">P_battery_draw = P_wheel / η_motor</code>
                <br />
                <code className="text-slate-400 font-mono">P_drivetrain_loss = P_battery_draw - P_wheel</code>
              </p>
              <p className="text-[11px] text-slate-400">
                Electrical energy drawn from the pack is scaled by motor and inverter transmission efficiency (η_motor = 91–92%).
              </p>
            </div>
          </div>

          {/* Equation 3: Regenerative Braking & Friction Blending */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.3
              </span>
              <span className="text-xs text-slate-400">Regenerative Braking Blending</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              F_regen_max = m · a_regen_ceiling<br />
              F_regen = min(|F_tractive|, F_regen_max)<br />
              F_friction = |F_tractive| - F_regen<br />
              P_regen_return = F_regen · v · η_regen<br />
              P_friction_heat = F_friction · v
            </div>
            <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
              <p>
                When decelerating (<strong className="text-amber-400 font-mono">P_wheel &lt; 0</strong>),
                the kinetic energy recaptured is bounded by the driver comfort ceiling (a_regen_ceiling = 2.0 m/s²).
                Excess deceleration above this ceiling is dissipated as waste heat by friction disc brakes.
              </p>
            </div>
          </div>

          {/* Equation 4: Dynamic Wireless Power Transfer */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.4
              </span>
              <span className="text-xs text-slate-400">Dynamic Road Coil Induction</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              P_coil = P_nominal · η_coupling · f_active
            </div>
            <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
              <p>
                <strong className="text-white font-mono">P_nominal</strong> — Transmitter coil power rating (75 kW baseline per SAE J2954/2).
              </p>
              <p>
                <strong className="text-white font-mono">η_coupling</strong> — Magnetic air-gap transmission efficiency (80% typical, range 64.3%–90.0%).
              </p>
              <p>
                <strong className="text-white font-mono">f_active</strong> — Fraction of the kinematic segment length actively overlapping energized primary coils.
              </p>
            </div>
          </div>

          {/* Equation 5: Auxiliary HVAC Load */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.5
              </span>
              <span className="text-xs text-slate-400">Continuous Auxiliary & HVAC Load</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              E_aux = P_aux · Δt
            </div>
            <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
              <p>
                Auxiliary power is subtracted continuously regardless of vehicle velocity.
                Calibrated to withstand Dubai summer thermal loads (2.0 kW for passenger EV cabin AC; 12.0 kW for transit bus dual rooftop AC chillers).
              </p>
            </div>
          </div>

          {/* Equation 6: Photovoltaic Harvester */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Equation 1.6
              </span>
              <span className="text-xs text-slate-400">Rooftop Photovoltaic Harvester</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              P_solar = A_panel · η_solar · G_irradiance
            </div>
            <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
              <p>
                <strong className="text-white font-mono">A_panel</strong> — Usable rooftop solar panel area (1.8 m² car, 16.0 m² bus).
              </p>
              <p>
                <strong className="text-white font-mono">η_solar</strong> — Silicon PV module conversion efficiency (21.5% typical).
              </p>
              <p>
                <strong className="text-white font-mono">G_irradiance</strong> — Global Horizontal Irradiance (GHI) in W/m² (NASA POWER Dubai climatology).
              </p>
            </div>
          </div>
        </div>

        {/* Energy Conservation Banner */}
        <div className="rounded-xl border border-emerald-900/80 bg-emerald-950/20 p-5 text-xs text-emerald-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-emerald-300 text-sm">
            <span>⚖️</span>
            <span>First Law of Thermodynamics Energy Conservation Rule</span>
          </div>
          <p className="leading-relaxed">
            At every integration time step <code className="font-mono text-emerald-300">Δt</code>, the net change in battery stored energy strictly satisfies:
          </p>
          <div className="rounded bg-slate-950/80 p-3 font-mono text-xs text-emerald-300 overflow-x-auto">
            ΔE_battery = E_regen_returned + E_solar + E_road_coil - E_consumed - E_aux
          </div>
          <p className="text-[11px] text-emerald-400/80">
            Vitest test suites run continuous integrity checks: energy drawn plus external input must match energy delivered to the wheels plus all thermodynamic losses within 0.1%. Tests immediately fail if this threshold is violated.
          </p>
        </div>
      </section>

      {/* Part 2: Monte Carlo Uncertainty Formulation */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            2. Monte Carlo Uncertainty Propagation
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Quantifying real-world variance across 2,000 seeded iterations.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Deterministic simulations provide an idealized point estimate. However, vehicle curb weights,
            tyre rolling coefficients, ambient temperatures, and magnetic coupling efficiencies fluctuate
            under dynamic road conditions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800">
              <div className="font-semibold text-white mb-1">Triangular Sampling</div>
              <p className="text-[11px] text-slate-400">
                Parameters with published ranges [min, typical, max] are sampled using asymmetric triangular probability density functions centered at the verified typical value.
              </p>
            </div>
            <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800">
              <div className="font-semibold text-white mb-1">Seeded Mulberry32 PRNG</div>
              <p className="text-[11px] text-slate-400">
                To guarantee strict reproducibility across client sessions and testing environments, a deterministic Mulberry32 pseudo-random generator is initialized with seed 42.
              </p>
            </div>
            <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800">
              <div className="font-semibold text-white mb-1">90% Credible Interval</div>
              <p className="text-[11px] text-slate-400">
                Outputs report the 5th percentile (p5), median (p50), and 95th percentile (p95), establishing a rigorous 90% confidence range for net energy and Wh/km.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Part 3: Full Audited Assumptions Registry Table */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            3. Full Assumptions Registry
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Dynamically loaded from <code className="font-mono text-emerald-400">src/lib/registry/assumptions.json</code>.
            Every value has an accessed date, confidence classification, and confirmed source citation.
          </p>
        </div>

        <AssumptionsRegistryTable assumptions={assumptions} />
      </section>
    </div>
  );
}
