import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Dubai RTA Dynamic Wireless Charging Corridor Analysis | REYGEN",
  description: "Evaluation of dynamic wireless road charging for electric vehicles on a proposed Dubai corridor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full light">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 antialiased">
        <ThemeProvider>
          <Navigation />
          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
