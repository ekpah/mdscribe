/** Shared tag surfaces for compact chips and expanded editors. */
export const TAG_COLORS = {
	blue: {
		hover: "hover:border-solarized-blue hover:bg-solarized-blue/10",
		selected: "border-solarized-blue bg-solarized-blue/10 ring-2 ring-solarized-blue/35",
		surface: "border-solarized-blue/80 bg-solarized-blue/5",
	},
	cyan: {
		hover: "hover:border-solarized-cyan hover:bg-solarized-cyan/10",
		selected: "border-solarized-cyan bg-solarized-cyan/10 ring-2 ring-solarized-cyan/35",
		surface: "border-solarized-cyan/80 bg-solarized-cyan/5",
	},
	green: {
		hover: "hover:border-solarized-green hover:bg-solarized-green/10",
		selected: "border-solarized-green bg-solarized-green/10 ring-2 ring-solarized-green/35",
		surface: "border-solarized-green/80 bg-solarized-green/5",
	},
	orange: {
		hover: "hover:border-solarized-orange hover:bg-solarized-orange/10",
		selected: "border-solarized-orange bg-solarized-orange/10 ring-2 ring-solarized-orange/35",
		surface: "border-solarized-orange/80 bg-solarized-orange/5",
	},
} as const;
