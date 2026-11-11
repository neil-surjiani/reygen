import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Dubai RTA Dynamic Wireless Charging Corridor Analysis | REYGEN",
  description:
    "Evaluation of dynamic wireless road charging for electric vehicles on a proposed Dubai corridor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full light">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 antialiased">
        <Navigation />
        <main className="flex-1">
          <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-10">
            {children}
          </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
