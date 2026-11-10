import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/corridor", label: "Simulation" },
  { href: "/", label: "Research" },
  { href: "/method", label: "Method" },
  { href: "/data", label: "Data" },
  { href: "/limits", label: "Limits" },
];

export function Navigation() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur print:hidden sticky top-0 z-50 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-emerald-500/40 bg-slate-950 p-1 shadow-md transition-transform group-hover:scale-105">
              <Image
                src="/reygen-logo.png"
                alt="REYGEN Logo"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                REYGEN
              </span>
              <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400 -mt-0.5">
                Dubai RTA Wireless Corridor
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center space-x-3 sm:space-x-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs sm:text-sm font-medium text-slate-300 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-l border-slate-700/60 pl-3 sm:pl-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
