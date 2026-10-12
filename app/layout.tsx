import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolarSaathi — Will your battery last tonight?",
  description:
    "AI planner for Pakistani solar homes: reads your inverter, your load-shedding schedule and tomorrow's weather, then tells you exactly what to switch off or move so your battery lasts.",
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
