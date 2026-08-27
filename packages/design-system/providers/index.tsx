import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TooltipProvider } from "@repo/design-system/components/ui/tooltip";
import type { ThemeProviderProps } from "next-themes";

import { ThemeProvider } from "./theme";
type DesignSystemProviderProperties = ThemeProviderProps;

export const DesignSystemProvider = ({
	children,
	...properties
}: DesignSystemProviderProperties) => (
	<ThemeProvider {...properties}>
		<TooltipProvider>{children}</TooltipProvider>
		<Toaster />
	</ThemeProvider>
);
