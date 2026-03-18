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
import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { PlaygroundModel, PlaygroundParameters } from "@/app/admin/playground/_lib/types";
import { supportsThinking } from "@/app/admin/playground/_lib/types";

interface ParameterControlsProps {
	parameters: PlaygroundParameters;
	onChange: (params: PlaygroundParameters) => void;
	model?: PlaygroundModel | null;
	disabled?: boolean;
}

type DirectEditParameter = "maxTokens" | "temperature" | "thinkingBudget";

export const ParameterControls = ({
	parameters,
	onChange,
	model,
	disabled,
}: ParameterControlsProps) => {
	const thinkingSupported = model ? supportsThinking(model) : false;
	const [activeDirectEdit, setActiveDirectEdit] =
		useState<DirectEditParameter | null>(null);
	const [directValueDrafts, setDirectValueDrafts] = useState<Record<DirectEditParameter, string>>({
		maxTokens: String(parameters.maxTokens),
		temperature: String(parameters.temperature),
		thinkingBudget: String(parameters.thinkingBudget),
	});
	const clampNumber = useCallback(
		(value: number, min: number, max: number) =>
			Math.min(Math.max(value, min), max),
		[],
	);

	useEffect(() => {
		setDirectValueDrafts((previous) => {
			const next = {
				maxTokens:
					activeDirectEdit === "maxTokens"
						? previous.maxTokens
						: String(parameters.maxTokens),
				temperature:
					activeDirectEdit === "temperature"
						? previous.temperature
						: String(parameters.temperature),
				thinkingBudget:
					activeDirectEdit === "thinkingBudget"
						? previous.thinkingBudget
						: String(parameters.thinkingBudget),
			};
			if (
				next.maxTokens === previous.maxTokens &&
				next.temperature === previous.temperature &&
				next.thinkingBudget === previous.thinkingBudget
			) {
				return previous;
			}
			return next;
		});
	}, [
		activeDirectEdit,
		parameters.maxTokens,
		parameters.temperature,
		parameters.thinkingBudget,
	]);

	const updateParam = useCallback(<K extends keyof PlaygroundParameters>(
		key: K,
		value: PlaygroundParameters[K],
	) => {
		onChange({ ...parameters, [key]: value });
	}, [onChange, parameters]);

	const handleThinkingChange = useCallback((checked: boolean) => {
		onChange({
			...parameters,
			thinking: checked,
			thinkingExplicit: true,
		});
	}, [onChange, parameters]);

	const handleThinkingBudgetChange = useCallback((values: number[]) => {
		const [value] = values;
		updateParam("thinkingBudget", value);
	}, [updateParam]);
	const handleTemperatureChange = useCallback((values: number[]) => {
		const [value] = values;
		updateParam("temperature", value);
	}, [updateParam]);
	const handleMaxTokensChange = useCallback((values: number[]) => {
		const [value] = values;
		updateParam("maxTokens", value);
	}, [updateParam]);

	const setDirectDraft = useCallback((key: DirectEditParameter, value: string) => {
		setDirectValueDrafts((previous) => ({
			...previous,
			[key]: value,
		}));
	}, []);

	const handleDirectEditFocus = useCallback((key: DirectEditParameter) => {
		setActiveDirectEdit(key);
	}, []);

	const commitDirectEdit = useCallback((key: DirectEditParameter) => {
		if (key === "thinkingBudget") {
			const parsed = Number.parseInt(directValueDrafts.thinkingBudget, 10);
			if (Number.isNaN(parsed)) {
				setDirectDraft("thinkingBudget", String(parameters.thinkingBudget));
				return;
			}
			const clamped = clampNumber(parsed, 1000, 50_000);
			updateParam("thinkingBudget", clamped);
			setDirectDraft("thinkingBudget", String(clamped));
			return;
		}

		if (key === "temperature") {
			const parsed = Number.parseFloat(directValueDrafts.temperature);
			if (Number.isNaN(parsed)) {
				setDirectDraft("temperature", String(parameters.temperature));
				return;
			}
			const clamped = clampNumber(parsed, 0, 2);
			updateParam("temperature", clamped);
			setDirectDraft("temperature", String(clamped));
			return;
		}

		const parsed = Number.parseInt(directValueDrafts.maxTokens, 10);
		if (Number.isNaN(parsed)) {
			setDirectDraft("maxTokens", String(parameters.maxTokens));
			return;
		}
		const clamped = clampNumber(parsed, 256, 128_000);
		updateParam("maxTokens", clamped);
		setDirectDraft("maxTokens", String(clamped));
	}, [
		clampNumber,
		directValueDrafts.maxTokens,
		directValueDrafts.temperature,
		directValueDrafts.thinkingBudget,
		parameters.maxTokens,
		parameters.temperature,
		parameters.thinkingBudget,
		setDirectDraft,
		updateParam,
	]);

	const cancelDirectEdit = useCallback((key: DirectEditParameter) => {
		if (key === "thinkingBudget") {
			setDirectDraft("thinkingBudget", String(parameters.thinkingBudget));
			return;
		}
		if (key === "temperature") {
			setDirectDraft("temperature", String(parameters.temperature));
			return;
		}
		setDirectDraft("maxTokens", String(parameters.maxTokens));
	}, [parameters.maxTokens, parameters.temperature, parameters.thinkingBudget, setDirectDraft]);

	const handleDirectEditBlur = useCallback((key: DirectEditParameter) => {
		commitDirectEdit(key);
		setActiveDirectEdit((previous) => (previous === key ? null : previous));
	}, [commitDirectEdit]);

	const handleDirectEditKeyDown = useCallback(
		(key: DirectEditParameter, event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				commitDirectEdit(key);
				setActiveDirectEdit((previous) => (previous === key ? null : previous));
				event.currentTarget.blur();
				return;
			}
			if (event.key === "Escape") {
				cancelDirectEdit(key);
				setActiveDirectEdit((previous) => (previous === key ? null : previous));
				event.currentTarget.blur();
			}
		},
		[cancelDirectEdit, commitDirectEdit],
	);

	const handleTopPChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateParam(
				"topP",
				event.target.value
					? Number.parseFloat(event.target.value)
					: undefined,
			);
		},
		[updateParam],
	);

	const handleTopKChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateParam(
				"topK",
				event.target.value
					? Number.parseInt(event.target.value, 10)
					: undefined,
			);
		},
		[updateParam],
	);

	const handleFrequencyPenaltyChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateParam(
				"frequencyPenalty",
				event.target.value
					? Number.parseFloat(event.target.value)
					: undefined,
			);
		},
		[updateParam],
	);

	const handlePresencePenaltyChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateParam(
				"presencePenalty",
				event.target.value
					? Number.parseFloat(event.target.value)
					: undefined,
			);
		},
		[updateParam],
	);

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
							<Tooltip>
								<TooltipTrigger asChild>
									<HelpCircle className="h-3.5 w-3.5 text-solarized-base01" />
								</TooltipTrigger>
								<TooltipContent className="max-w-[250px]">
									<p>
										Aktiviert den Reasoning-Modus des Modells fuer komplexere
										Aufgaben. Das Modell zeigt seinen Denkprozess.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
							<Switch
								checked={parameters.thinking}
								onCheckedChange={handleThinkingChange}
								disabled={disabled}
							/>
					</div>

					{parameters.thinking && (
						<div className="mt-3 space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm text-solarized-base01">
									Thinking Budget
								</Label>
								<div className="flex items-center gap-2">
									<Input
										type="number"
										value={directValueDrafts.thinkingBudget}
										onChange={(event) => {
											setDirectDraft("thinkingBudget", event.target.value);
										}}
										onFocus={() => {
											handleDirectEditFocus("thinkingBudget");
										}}
										onBlur={() => {
											handleDirectEditBlur("thinkingBudget");
										}}
										onKeyDown={(event) => {
											handleDirectEditKeyDown("thinkingBudget", event);
										}}
										min={1000}
										max={50_000}
										step={1000}
										disabled={disabled}
										className="h-7 w-28 text-right font-mono text-sm"
									/>
									<span className="text-xs text-solarized-base01">tokens</span>
								</div>
							</div>
								<Slider
									value={[parameters.thinkingBudget]}
									onValueChange={handleThinkingBudgetChange}
								min={1000}
								max={50_000}
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
						<div className="font-mono text-sm text-solarized-base00">
							<Input
								type="number"
								value={directValueDrafts.temperature}
								onChange={(event) => {
									setDirectDraft("temperature", event.target.value);
								}}
								onFocus={() => {
									handleDirectEditFocus("temperature");
								}}
								onBlur={() => {
									handleDirectEditBlur("temperature");
								}}
								onKeyDown={(event) => {
									handleDirectEditKeyDown("temperature", event);
								}}
								min={0}
								max={2}
								step={0.01}
								disabled={disabled}
								className="h-7 w-24 text-right font-mono text-sm"
							/>
						</div>
					</div>
						<Slider
							value={[parameters.temperature]}
							onValueChange={handleTemperatureChange}
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
						<div className="font-mono text-sm text-solarized-base00">
							<Input
								type="number"
								value={directValueDrafts.maxTokens}
								onChange={(event) => {
									setDirectDraft("maxTokens", event.target.value);
								}}
								onFocus={() => {
									handleDirectEditFocus("maxTokens");
								}}
								onBlur={() => {
									handleDirectEditBlur("maxTokens");
								}}
								onKeyDown={(event) => {
									handleDirectEditKeyDown("maxTokens", event);
								}}
								min={256}
								max={128_000}
								step={256}
								disabled={disabled}
								className="h-7 w-28 text-right font-mono text-sm"
							/>
						</div>
					</div>
						<Slider
							value={[parameters.maxTokens]}
							onValueChange={handleMaxTokensChange}
						min={256}
						max={128_000}
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
										onChange={handleTopPChange}
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
										onChange={handleTopKChange}
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
										onChange={handleFrequencyPenaltyChange}
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
										onChange={handlePresencePenaltyChange}
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
};
