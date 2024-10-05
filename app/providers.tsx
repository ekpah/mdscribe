"use client";
import { InfoStoreProvider } from "@/state/infoStoreProvider";
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "./_components/ThemeProvider";
export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <InfoStoreProvider>{children}</InfoStoreProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
