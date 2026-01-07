"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Columns2, FlaskConical, Loader2, Square, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { orpc } from "@/lib/orpc";
import { PlaygroundPanel } from "./_components/PlaygroundPanel";
import type { PlaygroundModel, PlaygroundParameters } from "./_lib/types";
import { DEFAULT_PARAMETERS } from "./_lib/types";

// Fetch models from our API
async function fetchModels(): Promise<PlaygroundModel[]> {
	const response = await fetch("/api/admin/models");
	if (!response.ok) {
		throw new Error("Failed to fetch models");
	}
	const data = await response.json();
	return data.data;
}

function PlaygroundContent() {
	const searchParams = useSearchParams();
	const [comparisonMode, setComparisonMode] = useState(false);

	// Synced state for comparison mode
	const [syncedPrompt, setSyncedPrompt] = useState("");
	const [syncedSystemPrompt, setSyncedSystemPrompt] = useState("");

	// Fetch models
	const {
		data: models = [],
		isLoading: modelsLoading,
		error: modelsError,
	} = useQuery({
		queryKey: ["admin", "models"],
		queryFn: fetchModels,
		staleTime: 60 * 60 * 1000, // 1 hour
	});

	// Parse preset from URL params (from usage tracking jump-off)
	const preset = useMemo(() => {
		const eventId = searchParams.get("eventId");
		const model = searchParams.get("model");
		// URLSearchParams.get() already decodes the value
		const prompt = searchParams.get("prompt");
		const systemPrompt = searchParams.get("systemPrompt");
		const temperature = searchParams.get("temperature");
		const maxTokens = searchParams.get("maxTokens");
		const thinking = searchParams.get("thinking");
		const thinkingBudget = searchParams.get("thinkingBudget");

		return {
			eventId,
			model,
			prompt: prompt || undefined,
			systemPrompt: systemPrompt || undefined,
			parameters: {
				temperature: temperature ? Number.parseFloat(temperature) : undefined,
				maxTokens: maxTokens ? Number.parseInt(maxTokens) : undefined,
				thinking: thinking === "true",
				thinkingBudget: thinkingBudget
					? Number.parseInt(thinkingBudget)
					: undefined,
			} as Partial<PlaygroundParameters>,
		};
	}, [searchParams]);

	// Initialize synced prompts from preset
	useEffect(() => {
		if (preset.prompt) {
			setSyncedPrompt(preset.prompt);
		}
		if (preset.systemPrompt) {
			setSyncedSystemPrompt(preset.systemPrompt);
		}
	}, [preset.prompt, preset.systemPrompt]);

	if (modelsError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center p-6">
				<div className="space-y-2 text-center">
					<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
					<h2 className="font-semibold text-base text-solarized-base00">
						Fehler beim Laden der Modelle
					</h2>
					<p className="text-sm text-solarized-base01">
						{modelsError instanceof Error
							? modelsError.message
							: "Unbekannter Fehler"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
			<div className="mx-auto flex h-full w-full max-w-[1800px] flex-col gap-4 overflow-hidden">
				{/* Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-violet/10 sm:h-12 sm:w-12">
							<FlaskConical className="h-5 w-5 text-solarized-violet sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">
								AI Playground
							</h1>
							<p className="text-sm text-solarized-base01">
								Experimentiere mit verschiedenen Modellen und Einstellungen
							</p>
						</div>
					</div>

					{/* View Mode Toggle */}
					<div className="flex items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<ToggleGroup
									type="single"
									value={comparisonMode ? "compare" : "single"}
									onValueChange={(value) =>
										setComparisonMode(value === "compare")
									}
									className="border border-solarized-base2 rounded-lg"
								>
									<ToggleGroupItem
										value="single"
										className="gap-2 px-3"
										aria-label="Einzelansicht"
									>
										<Square className="h-4 w-4" />
										<span className="hidden sm:inline">Einzeln</span>
									</ToggleGroupItem>
									<ToggleGroupItem
										value="compare"
										className="gap-2 px-3"
										aria-label="Vergleichsansicht"
									>
										<Columns2 className="h-4 w-4" />
										<span className="hidden sm:inline">Vergleich</span>
									</ToggleGroupItem>
								</ToggleGroup>
							</TooltipTrigger>
							<TooltipContent>
								{comparisonMode
									? "Zwei Modelle parallel vergleichen"
									: "Einzelnes Modell testen"}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				{/* Main Content */}
				<div className="min-h-0 flex-1 overflow-hidden">
					{comparisonMode ? (
						<div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
							<div className="overflow-hidden rounded-lg border border-solarized-blue/30 p-2">
								<PlaygroundPanel
									models={models}
									isLoadingModels={modelsLoading}
									presetModel={preset.model ?? undefined}
									presetSystemPrompt={preset.systemPrompt}
									presetUserPrompt={preset.prompt}
									presetParameters={preset.parameters}
									panelId="A"
									syncedPrompt={syncedPrompt}
									onPromptChange={setSyncedPrompt}
									syncedSystemPrompt={syncedSystemPrompt}
									onSystemPromptChange={setSyncedSystemPrompt}
								/>
							</div>
							<div className="overflow-hidden rounded-lg border border-solarized-green/30 p-2">
								<PlaygroundPanel
									models={models}
									isLoadingModels={modelsLoading}
									panelId="B"
									syncedPrompt={syncedPrompt}
									onPromptChange={setSyncedPrompt}
									syncedSystemPrompt={syncedSystemPrompt}
									onSystemPromptChange={setSyncedSystemPrompt}
								/>
							</div>
						</div>
					) : (
						<PlaygroundPanel
							models={models}
							isLoadingModels={modelsLoading}
							presetModel={preset.model ?? undefined}
							presetSystemPrompt={preset.systemPrompt}
							presetUserPrompt={preset.prompt}
							presetParameters={preset.parameters}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

export default function PlaygroundPage() {
	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center p-6">
					<div className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>Lade Playground...</span>
					</div>
				</div>
			}
		>
			<PlaygroundContent />
		</Suspense>
	);
}
