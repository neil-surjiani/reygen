import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/corridor", label: "Corridor" },
  { href: "/method", label: "Method" },
  { href: "/data", label: "Data" },
  { href: "/limits", label: "Limits" },
];

export function Navigation() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-base font-semibold tracking-tight text-white hover:text-slate-200">
            Dubai RTA Wireless Corridor Analysis
          </Link>
        </div>
        <nav className="flex items-center space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
