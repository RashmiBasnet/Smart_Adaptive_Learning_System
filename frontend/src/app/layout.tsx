// App shell only. The Next server renders nothing data-driven: every page is a
// client component talking to the separate Express API. SSR features (server
// components fetching data, API routes, server actions, middleware auth) are
// deliberately unused — the architecture keeps frontend and backend separated,
// with Next chosen for familiarity/timeline, not for its server features.

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../providers/query-provider";
import { AuthProvider } from "../providers/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SALS — Smart Adaptive Learning System",
  description:
    "Adaptive learning for data structures with transparent recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-screen bg-slate-50">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
