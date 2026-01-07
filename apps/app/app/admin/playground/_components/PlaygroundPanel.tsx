"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { useEffect } from "react";
import type { PlaygroundModel, PlaygroundParameters } from "../_lib/types";
import { usePlayground } from "../_lib/use-playground";
import { ModelSelector } from "./ModelSelector";
import { MultimodalInputs } from "./MultimodalInputs";
import { ParameterControls } from "./ParameterControls";
import { ResultDisplay } from "./ResultDisplay";

interface PlaygroundPanelProps {
	models: PlaygroundModel[];
	isLoadingModels?: boolean;
	// Optional preset values from usage tracking
	presetModel?: string;
	presetSystemPrompt?: string;
	presetUserPrompt?: string;
	presetParameters?: Partial<PlaygroundParameters>;
	// For comparison mode
	panelId?: string;
	syncedPrompt?: string;
	onPromptChange?: (prompt: string) => void;
	syncedSystemPrompt?: string;
	onSystemPromptChange?: (prompt: string) => void;
}

export function PlaygroundPanel({
	models,
	isLoadingModels,
	presetModel,
	presetSystemPrompt,
	presetUserPrompt,
	presetParameters,
	panelId,
	syncedPrompt,
	onPromptChange,
	syncedSystemPrompt,
	onSystemPromptChange,
}: PlaygroundPanelProps) {
	const playground = usePlayground({
		initialSystemPrompt: presetSystemPrompt,
		initialUserPrompt: presetUserPrompt,
		initialParameters: presetParameters
			? {
					temperature: presetParameters.temperature ?? 1,
					maxTokens: presetParameters.maxTokens ?? 4096,
					thinking: presetParameters.thinking ?? false,
					thinkingBudget: presetParameters.thinkingBudget ?? 8000,
					topP: presetParameters.topP,
					topK: presetParameters.topK,
					frequencyPenalty: presetParameters.frequencyPenalty,
					presencePenalty: presetParameters.presencePenalty,
				}
			: undefined,
	});

	// Set preset model when models load
	useEffect(() => {
		if (presetModel && models.length > 0 && !playground.model) {
			const model = models.find((m) => m.id === presetModel);
			if (model) {
				playground.setModel(model);
			}
		}
	}, [presetModel, models, playground]);

	// Sync prompts for comparison mode
	useEffect(() => {
		if (syncedPrompt !== undefined && syncedPrompt !== playground.userPrompt) {
			playground.setUserPrompt(syncedPrompt);
		}
	}, [syncedPrompt, playground]);

	useEffect(() => {
		if (
			syncedSystemPrompt !== undefined &&
			syncedSystemPrompt !== playground.systemPrompt
		) {
			playground.setSystemPrompt(syncedSystemPrompt);
		}
	}, [syncedSystemPrompt, playground]);

	// Update completion result
	useEffect(() => {
		playground.updateResult();
	}, [playground.completion, playground]);

	const handleUserPromptChange = (value: string) => {
		playground.setUserPrompt(value);
		onPromptChange?.(value);
	};

	const handleSystemPromptChange = (value: string) => {
		playground.setSystemPrompt(value);
		onSystemPromptChange?.(value);
	};

	return (
		<div className="flex h-full flex-col gap-4 lg:flex-row">
			{/* Left Panel - Configuration */}
			<Card className="w-full border-solarized-base2 lg:w-[400px] lg:shrink-0">
				<CardHeader className="border-b border-solarized-base2 pb-3">
					<CardTitle className="text-base text-solarized-base00">
						Konfiguration
						{panelId && (
							<span className="ml-2 font-normal text-solarized-base01">
								({panelId})
							</span>
						)}
					</CardTitle>
				</CardHeader>
				<ScrollArea className="h-[calc(100%-60px)]">
					<CardContent className="space-y-6 p-4">
						{/* Model Selection */}
						<div className="space-y-2">
							<Label className="text-sm text-solarized-base01">Modell</Label>
							<ModelSelector
								models={models}
								isLoading={isLoadingModels}
								selectedModel={playground.model}
								onSelect={playground.setModel}
								disabled={playground.isGenerating}
							/>
						</div>

						<Separator className="bg-solarized-base2" />

						{/* Parameters */}
						<div className="space-y-2">
							<Label className="text-sm text-solarized-base01">Parameter</Label>
							<ParameterControls
								parameters={playground.parameters}
								onChange={playground.setParameters}
								modelId={playground.model?.id}
								disabled={playground.isGenerating}
							/>
						</div>

						<Separator className="bg-solarized-base2" />

						{/* System Prompt */}
						<div className="space-y-2">
							<Label className="text-sm text-solarized-base01">
								System Prompt
							</Label>
							<Textarea
								value={playground.systemPrompt}
								onChange={(e) => handleSystemPromptChange(e.target.value)}
								placeholder="Optional: Instruktionen für das Modell..."
								className="min-h-[100px] resize-none border-solarized-base2 bg-solarized-base3 text-sm"
								disabled={playground.isGenerating}
							/>
						</div>

						<Separator className="bg-solarized-base2" />

						{/* Multimodal Inputs */}
						<div className="space-y-2">
							<Label className="text-sm text-solarized-base01">
								Multimodale Eingabe
							</Label>
							<MultimodalInputs
								capabilities={playground.model?.capabilities}
								audioFiles={playground.audioFiles}
								imageFiles={playground.imageFiles}
								documentFiles={playground.documentFiles}
								isRecording={playground.isRecording}
								disabled={playground.isGenerating}
								onStartRecording={playground.startRecording}
								onStopRecording={playground.stopRecording}
								onRemoveAudio={playground.removeAudioFile}
								onAddImages={playground.addImageFiles}
								onRemoveImage={playground.removeImageFile}
								onAddDocuments={playground.addDocumentFiles}
								onRemoveDocument={playground.removeDocumentFile}
							/>
						</div>
					</CardContent>
				</ScrollArea>
			</Card>

			{/* Right Panel - Input & Output */}
			<div className="flex flex-1 flex-col gap-4 overflow-hidden">
				{/* User Prompt */}
				<Card className="border-solarized-base2">
					<CardHeader className="border-b border-solarized-base2 pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="text-base text-solarized-base00">
								Prompt
							</CardTitle>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={playground.reset}
									disabled={playground.isGenerating}
									className="gap-2 border-solarized-base2"
								>
									<RotateCcw className="h-4 w-4" />
									Zurücksetzen
								</Button>
								{playground.isGenerating ? (
									<Button
										variant="destructive"
										size="sm"
										onClick={playground.stop}
										className="gap-2"
									>
										<Square className="h-4 w-4" />
										Stopp
									</Button>
								) : (
									<Button
										size="sm"
										onClick={playground.generate}
										disabled={!playground.model}
										className="gap-2 bg-solarized-blue hover:bg-solarized-blue/90"
									>
										<Play className="h-4 w-4" />
										Ausführen
									</Button>
								)}
							</div>
						</div>
					</CardHeader>
					<CardContent className="p-4">
						<Textarea
							value={playground.userPrompt}
							onChange={(e) => handleUserPromptChange(e.target.value)}
							placeholder="Geben Sie Ihren Prompt hier ein..."
							className="min-h-[120px] resize-none border-solarized-base2 bg-solarized-base3 text-sm"
							disabled={playground.isGenerating}
						/>
					</CardContent>
				</Card>

				{/* Results */}
				<div className="min-h-0 flex-1">
					<ResultDisplay
						result={
							playground.result || playground.completion
								? {
										text: playground.completion || "",
										metrics: playground.result?.metrics || { latencyMs: 0 },
										isStreaming: playground.isGenerating,
										reasoning: playground.result?.reasoning,
										error: playground.result?.error,
									}
								: null
						}
						modelName={playground.model?.name}
					/>
				</div>
			</div>
		</div>
	);
}
