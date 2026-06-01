"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { Brain, HelpCircle } from "lucide-react";

import {
	REASONING_EFFORT_OPTIONS,
	type ReasoningEffort,
} from "@/app/admin/_lib/reasoning";

interface ReasoningEffortSelectProps {
	className?: string;
	disabled?: boolean;
	label?: string;
	onValueChange: (value: ReasoningEffort) => void;
	showDescription?: boolean;
	value: ReasoningEffort;
}

export const ReasoningEffortSelect = ({
	className,
	disabled,
	label = "Reasoning Effort Level",
	onValueChange,
	showDescription = true,
	value,
}: ReasoningEffortSelectProps) => (
	<div className={cn("rounded-lg border border-primary/40 bg-accent p-3", className)}>
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Brain className="h-4 w-4 text-primary" />
				<Label className="font-medium text-solarized-base00">{label}</Label>
				<Tooltip>
					<TooltipTrigger asChild>
						<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
					</TooltipTrigger>
					<TooltipContent className="max-w-[250px]">
						<p>
							OpenRouter ordnet den Effort-Level auf passende Reasoning-Tokens oder
							native Thinking-Level des Modells ab.
						</p>
					</TooltipContent>
				</Tooltip>
			</div>
			<div className="grid grid-cols-3 overflow-hidden rounded-md border border-solarized-base2 sm:grid-cols-6">
				{REASONING_EFFORT_OPTIONS.map((option) => {
					const isSelected = value === option.value;
					return (
						<Button
							key={option.value}
							type="button"
							variant="ghost"
							size="sm"
							aria-pressed={isSelected}
							disabled={disabled}
							onClick={() => {
								onValueChange(option.value);
							}}
							className={cn(
								"h-auto min-w-0 flex-col gap-0.5 rounded-none border-solarized-base2 border-l px-2 py-2 text-xs first:border-l-0 hover:bg-primary/10 hover:text-primary",
								isSelected &&
									"border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
							)}
						>
							<span>{option.label}</span>
							<span
								className={cn(
									"font-normal text-[10px] text-solarized-base01",
									isSelected && "text-primary/80",
								)}
							>
								{option.description}
							</span>
						</Button>
					);
				})}
			</div>
			{showDescription ? (
				<p className="text-solarized-base01 text-xs">
					Aus deaktiviert Reasoning. OpenRouter mappt Effort-Level bei Bedarf auf ein
					Token-Budget.
				</p>
			) : null}
		</div>
	</div>
);
