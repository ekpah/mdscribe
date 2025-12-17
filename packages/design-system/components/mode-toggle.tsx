"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/utils";

const themes = [
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
	{ label: "System", value: "system" },
];

export const ModeToggle = () => {
	const { setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="shrink-0 text-foreground"
				>
					<SunIcon className="dark:-rotate-90 h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:scale-0" />
					<MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{themes.map(({ label, value }) => (
					<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export const ModeToggleSwitch = ({ className }: { className?: string }) => {
	const { theme, setTheme } = useTheme();

	return (
		<div
			className={cn(
				"flex items-center rounded-md border bg-muted p-0.5 w-full",
				className,
			)}
		>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					theme === "light" && "bg-background shadow-sm",
				)}
				onClick={() => setTheme("light")}
			>
				<SunIcon className="h-4 w-4" />
				<span className="sr-only">Light mode</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					theme === "dark" && "bg-background shadow-sm",
				)}
				onClick={() => setTheme("dark")}
			>
				<MoonIcon className="h-4 w-4" />
				<span className="sr-only">Dark mode</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"h-7 flex-1 rounded-sm",
					theme === "system" && "bg-background shadow-sm",
				)}
				onClick={() => setTheme("system")}
			>
				<MonitorIcon className="h-4 w-4" />
				<span className="sr-only">System mode</span>
			</Button>
		</div>
	);
};
