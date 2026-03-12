import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import "./globals.css";
import "./phase2.css";
import "./mobile.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Commodity HQ — Global Trading Analysis",
  description:
    "Professional-grade commodity trading analysis tool covering global exchanges (COMEX, NYMEX, LME, ICE, CBOT) and Indian MCX markets. Real-time prices, F&O, Open Interest, and deep multi-factor analysis.",
  keywords: [
    "commodity trading",
    "MCX",
    "COMEX",
    "gold price",
    "crude oil",
    "silver",
    "commodity analysis",
    "open interest",
    "futures options",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PreferencesProvider>
            <AuthProvider>{children}</AuthProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
