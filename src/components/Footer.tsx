export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-xs text-slate-400 print:hidden">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-10 space-y-2">
        <div
          id="data-attributions"
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          <span className="font-semibold text-slate-300">
            Data Attributions & Legal:
          </span>
          <span>
            Map data &copy;{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline"
            >
              OpenStreetMap
            </a>{" "}
            contributors (ODbL 1.0)
          </span>
          <span>•</span>
          <span>
            Base map tiles &copy;{" "}
            <a
              href="https://www.esri.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline"
            >
              Esri
            </a>
          </span>
          <span>•</span>
          <span>
            Solar &amp; Climate data:{" "}
            <a
              href="https://power.larc.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline"
            >
              NASA POWER Project
            </a>
          </span>
          <span>•</span>
          <span>
            Electricity Tariffs:{" "}
            <a
              href="https://www.dewa.gov.ae/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline"
            >
              DEWA
            </a>
          </span>
          <span>•</span>
          <span>
            Fleet Statistics:{" "}
            <a
              href="https://www.rta.ae/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline"
            >
              RTA Dubai
            </a>
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          Prepared for technical evaluation by Dubai Roads and Transport
          Authority (RTA). Adheres strictly to AGENTS.md data governance rules.
        </div>
      </div>
    </footer>
  );
}
