"use client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { InfoStoreProvider } from "@/state/infoStoreProvider";

export default function Providers({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <InfoStoreProvider>{children}</InfoStoreProvider>
    </ThemeProvider>
  );
}
