"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

export const ModeToggleSwitch = ({ className }: { className?: string }) => {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const handleSetLightTheme = useCallback(() => {
		setTheme("light");
	}, [setTheme]);
	const handleSetDarkTheme = useCallback(() => {
		setTheme("dark");
	}, [setTheme]);
	const handleSetSystemTheme = useCallback(() => {
		setTheme("system");
	}, [setTheme]);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div className={cn("flex items-center rounded-md border bg-muted p-0.5 w-full", className)}>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					mounted && theme === "light" && "bg-background shadow-sm",
				)}
				onClick={handleSetLightTheme}
			>
				<SunIcon className="h-4 w-4" />
				<span className="sr-only">Light mode</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					mounted && theme === "dark" && "bg-background shadow-sm",
				)}
				onClick={handleSetDarkTheme}
			>
				<MoonIcon className="h-4 w-4" />
				<span className="sr-only">Dark mode</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					mounted && theme === "system" && "bg-background shadow-sm",
				)}
				onClick={handleSetSystemTheme}
			>
				<MonitorIcon className="h-4 w-4" />
				<span className="sr-only">System mode</span>
			</Button>
		</div>
	);
};
