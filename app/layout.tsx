import { cn } from "@/lib/utils";
import "@/public/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Menubar from "./_components/Menubar";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MDScribe",
  description: "A powerful, flexible, Markdown-based authoring framework",
};

// If loading a variable font, you don't need to specify the font weight
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shouldInjectToolbar = process.env.NODE_ENV === "development";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="referrer" content="strict-origin" />

        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} font-sans` + "items-center"}>
        <Providers>
          <Toaster position="bottom-center" />
          <div key="Body" className="h-screen w-screen flex">
            <nav className="fixed bottom-[calc(100vh-theme(spacing.16))] h-16 left-0 right-0 top-0 z-30">
              {/*ModeWatcher track="true" />*/}
              <Menubar />
            </nav>
            <div
              key="Content"
              className="sticky w-full top-16 h-[calc(100vh-theme(spacing.16))] flex items-center justify-center"
            >
              {children}
            </div>
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
        {shouldInjectToolbar && <VercelToolbar />}
      </body>
    </html>
  );
}
