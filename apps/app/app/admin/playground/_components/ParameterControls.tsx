"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Slider } from "@repo/design-system/components/ui/slider";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Brain, HelpCircle, Settings2 } from "lucide-react";
import type { PlaygroundParameters } from "../_lib/types";
import { requiresThinking, supportsThinking } from "../_lib/types";

interface ParameterControlsProps {
	parameters: PlaygroundParameters;
	onChange: (params: PlaygroundParameters) => void;
	modelId?: string;
	disabled?: boolean;
}

export function ParameterControls({
	parameters,
	onChange,
	modelId,
	disabled,
}: ParameterControlsProps) {
	const thinkingSupported = modelId ? supportsThinking(modelId) : false;
	const thinkingRequired = modelId ? requiresThinking(modelId) : false;

	const updateParam = <K extends keyof PlaygroundParameters>(
		key: K,
		value: PlaygroundParameters[K],
	) => {
		onChange({ ...parameters, [key]: value });
	};

	return (
		<div className="space-y-4">
			{/* Thinking Mode (prominent if supported) */}
			{thinkingSupported && (
				<div className="rounded-lg border border-solarized-violet/30 bg-solarized-violet/10 p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Brain className="h-4 w-4 text-solarized-violet" />
							<Label className="font-medium text-solarized-base00">
								Thinking Mode
							</Label>
							{thinkingRequired && (
								<span className="rounded-sm bg-solarized-violet/20 px-1.5 py-0.5 text-[10px] font-medium text-solarized-violet">
									Pflicht
								</span>
							)}
							<Tooltip>
								<TooltipTrigger asChild>
									<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
								</TooltipTrigger>
								<TooltipContent className="max-w-[250px]">
									<p>
										{thinkingRequired
											? "Dieses Modell hat Pflicht-Reasoning. Thinking kann nicht deaktiviert werden."
											: "Aktiviert den Reasoning-Modus des Modells für komplexere Aufgaben. Das Modell zeigt seinen Denkprozess."}
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<Switch
							checked={thinkingRequired || parameters.thinking}
							onCheckedChange={(checked) => updateParam("thinking", checked)}
							disabled={disabled || thinkingRequired}
						/>
					</div>

					{(thinkingRequired || parameters.thinking) && (
						<div className="mt-3 space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm text-solarized-base01">
									Thinking Budget
								</Label>
								<span className="font-mono text-sm text-solarized-base00">
									{parameters.thinkingBudget.toLocaleString()} tokens
								</span>
							</div>
							<Slider
								value={[parameters.thinkingBudget]}
								onValueChange={([value]) =>
									updateParam("thinkingBudget", value)
								}
								min={1000}
								max={50000}
								step={1000}
								disabled={disabled}
								className="w-full"
							/>
						</div>
					)}
				</div>
			)}

			{/* Basic Parameters */}
			<div className="space-y-4">
				{/* Temperature */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Label className="text-sm text-solarized-base01">
								Temperature
							</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
								</TooltipTrigger>
								<TooltipContent className="max-w-[250px]">
									<p>
										Höhere Werte (z.B. 1.5) machen die Ausgabe kreativer,
										niedrigere Werte (z.B. 0.2) machen sie deterministischer.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<span className="font-mono text-sm text-solarized-base00">
							{parameters.temperature.toFixed(2)}
						</span>
					</div>
					<Slider
						value={[parameters.temperature]}
						onValueChange={([value]) => updateParam("temperature", value)}
						min={0}
						max={2}
						step={0.01}
						disabled={disabled}
						className="w-full"
					/>
				</div>

				{/* Max Tokens */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Label className="text-sm text-solarized-base01">
								Max Tokens
							</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
								</TooltipTrigger>
								<TooltipContent className="max-w-[250px]">
									<p>
										Maximale Anzahl an Tokens in der Antwort. 1 Token entspricht
										ca. 4 Zeichen.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<span className="font-mono text-sm text-solarized-base00">
							{parameters.maxTokens.toLocaleString()}
						</span>
					</div>
					<Slider
						value={[parameters.maxTokens]}
						onValueChange={([value]) => updateParam("maxTokens", value)}
						min={256}
						max={128000}
						step={256}
						disabled={disabled}
						className="w-full"
					/>
				</div>
			</div>

			{/* Advanced Parameters */}
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value="advanced" className="border-solarized-base2">
					<AccordionTrigger className="py-2 text-sm text-solarized-base01 hover:text-solarized-base00 hover:no-underline">
						<div className="flex items-center gap-2">
							<Settings2 className="h-4 w-4" />
							<span>Erweiterte Parameter</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-4 pt-2">
						{/* Top P */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Label className="text-sm text-solarized-base01">Top P</Label>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
										</TooltipTrigger>
										<TooltipContent className="max-w-[250px]">
											<p>
												Nucleus Sampling - berücksichtigt nur die
												wahrscheinlichsten Tokens bis zur kumulativen
												Wahrscheinlichkeit.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Input
									type="number"
									value={parameters.topP ?? ""}
									onChange={(e) =>
										updateParam(
											"topP",
											e.target.value
												? Number.parseFloat(e.target.value)
												: undefined,
										)
									}
									min={0}
									max={1}
									step={0.01}
									placeholder="1.0"
									disabled={disabled}
									className="h-7 w-20 text-right font-mono text-sm"
								/>
							</div>
						</div>

						{/* Top K */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Label className="text-sm text-solarized-base01">Top K</Label>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
										</TooltipTrigger>
										<TooltipContent className="max-w-[250px]">
											<p>
												Begrenzt die Auswahl auf die K wahrscheinlichsten
												Tokens.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Input
									type="number"
									value={parameters.topK ?? ""}
									onChange={(e) =>
										updateParam(
											"topK",
											e.target.value
												? Number.parseInt(e.target.value)
												: undefined,
										)
									}
									min={0}
									placeholder="-"
									disabled={disabled}
									className="h-7 w-20 text-right font-mono text-sm"
								/>
							</div>
						</div>

						{/* Frequency Penalty */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Label className="text-sm text-solarized-base01">
										Frequency Penalty
									</Label>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
										</TooltipTrigger>
										<TooltipContent className="max-w-[250px]">
											<p>
												Positive Werte reduzieren Wiederholungen basierend auf
												bisheriger Häufigkeit.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Input
									type="number"
									value={parameters.frequencyPenalty ?? ""}
									onChange={(e) =>
										updateParam(
											"frequencyPenalty",
											e.target.value
												? Number.parseFloat(e.target.value)
												: undefined,
										)
									}
									min={-2}
									max={2}
									step={0.1}
									placeholder="0"
									disabled={disabled}
									className="h-7 w-20 text-right font-mono text-sm"
								/>
							</div>
						</div>

						{/* Presence Penalty */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Label className="text-sm text-solarized-base01">
										Presence Penalty
									</Label>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
										</TooltipTrigger>
										<TooltipContent className="max-w-[250px]">
											<p>
												Positive Werte fördern neue Themen, negative Werte
												fokussieren auf bereits genannte Themen.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Input
									type="number"
									value={parameters.presencePenalty ?? ""}
									onChange={(e) =>
										updateParam(
											"presencePenalty",
											e.target.value
												? Number.parseFloat(e.target.value)
												: undefined,
										)
									}
									min={-2}
									max={2}
									step={0.1}
									placeholder="0"
									disabled={disabled}
									className="h-7 w-20 text-right font-mono text-sm"
								/>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
