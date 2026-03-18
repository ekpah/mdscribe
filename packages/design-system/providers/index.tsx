import type { ThemeProviderProps } from "next-themes";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { ThemeProvider } from "./theme";

import { TooltipProvider } from "@repo/design-system/components/ui/tooltip";
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
