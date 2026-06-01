"use client";

import { createAudioSubmissionFile } from "@repo/design-system/components/inputs/audio-submission";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from "@repo/design-system/components/ui/model-selector";
import type { ModelSelectorOption } from "@repo/design-system/components/ui/model-selector";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AudioLines, Loader2, Mic, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AudioInput } from "@/app/_components/input-context/inputs/audio/audio-input";
import type { AudioRecording } from "@/app/_components/input-context/types";
import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";
import { orpc } from "@/lib/orpc";

interface AudioModelOption extends ModelSelectorOption {
	modelId: string;
	providerName: string;
	providerProtocol: string;
}

interface TranscriptResult {
	modelName: string;
	transcript: string;
	transcripts: string[];
}

const createModelOptions = (
	models: Awaited<ReturnType<typeof orpc.admin.models.list.call>> | undefined,
): AudioModelOption[] =>
	(models ?? []).map((model) => ({
		group: model.providerName,
		keywords: [
			model.name,
			model.modelId,
			model.providerName,
			model.providerProtocol,
			"audio",
			"transkription",
			"speech-to-text",
		],
		label: model.name,
		modelId: model.modelId,
		providerName: model.providerName,
		providerProtocol: model.providerProtocol,
		value: model.id,
	}));

const getRecordingTotalBytes = (recordings: AudioRecording[]) =>
	recordings.reduce((total, recording) => total + recording.blob.size, 0);

export const AudioPlaygroundClient = () => {
	const [recordings, setRecordings] = useState<AudioRecording[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const [result, setResult] = useState<TranscriptResult | null>(null);

	const { data: models, isLoading: isLoadingModels } = useQuery(
		orpc.admin.models.list.queryOptions(),
	);
	const { data: defaults, isLoading: isLoadingDefaults } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const modelOptions = useMemo(() => createModelOptions(models), [models]);
	const selectedModel = useMemo(
		() => modelOptions.find((option) => option.value === selectedModelId) ?? null,
		[modelOptions, selectedModelId],
	);

	useEffect(() => {
		if (selectedModelId || !defaults?.defaultSpeechToTextModelId) {
			return;
		}
		setSelectedModelId(defaults.defaultSpeechToTextModelId);
	}, [defaults?.defaultSpeechToTextModelId, selectedModelId]);

	useEffect(() => {
		if (!selectedModelId || modelOptions.length === 0) {
			return;
		}
		if (!modelOptions.some((option) => option.value === selectedModelId)) {
			setSelectedModelId(null);
		}
	}, [modelOptions, selectedModelId]);

	const handleRecordingsChange = useCallback((nextRecordings: AudioRecording[]) => {
		setRecordings(nextRecordings);
		setResult(null);
	}, []);

	const transcribeMutation = useMutation({
		mutationFn: async () => {
			if (!selectedModelId) {
				throw new Error("Bitte zuerst ein Transkriptionsmodell auswählen.");
			}
			if (recordings.length === 0) {
				throw new Error("Bitte zuerst eine Audioaufnahme erstellen.");
			}

			for (const [index, recording] of recordings.entries()) {
				if (recording.blob.size > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
					throw new Error(
						`Aufnahme ${index + 1} ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
					);
				}
			}

			if (
				getRecordingTotalBytes(recordings) > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal
			) {
				throw new Error(
					`Audioaufnahmen sind zusammen zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)} möglich.`,
				);
			}

			const audioFiles = await Promise.all(
				recordings.map(async (recording) => {
					const payload = await createAudioSubmissionFile(recording.blob);
					return {
						data: payload.data,
						mimeType: payload.mimeType,
					};
				}),
			);

			return orpc.admin.scribe.transcribeAudio.call({
				audioFiles,
				modelId: selectedModelId,
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Transkription fehlgeschlagen");
		},
		onSuccess: (nextResult) => {
			setResult(nextResult);
			toast.success("Audio transkribiert");
		},
	});

	const isBusy = transcribeMutation.isPending;
	const canTranscribe = recordings.length > 0 && Boolean(selectedModelId) && !isBusy;

	return (
		<div className="space-y-4">
			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
				<CardHeader className="space-y-2 p-4 sm:p-6">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-solarized-base00">
								<Sparkles className="h-4 w-4 text-solarized-blue" />
								Transkriptionsmodell
							</CardTitle>
							<CardDescription className="text-solarized-base01">
								Wähle ein Audio-zu-Text-fähiges Modell. MDScribe prüft die Modalität nicht
								automatisch.
							</CardDescription>
						</div>
						{defaults?.defaultSpeechToTextModelId &&
						selectedModelId === defaults.defaultSpeechToTextModelId ? (
							<Badge className="w-fit bg-solarized-blue/10 text-solarized-blue hover:bg-solarized-blue/10">
								Standard-Audiomodell
							</Badge>
						) : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)]">
					<div className="space-y-2">
						<Label htmlFor="audio-playground-model">Modell</Label>
						<ModelSelector<AudioModelOption>
							className="border-solarized-base2 bg-solarized-base3"
							emptyMessage="Keine Modelle synchronisiert."
							id="audio-playground-model"
							isLoading={isLoadingModels || isLoadingDefaults}
							onValueChange={setSelectedModelId}
							options={modelOptions}
							placeholder="Transkriptionsmodell auswählen"
							renderOption={(option) => (
								<div className="min-w-0">
									<span className="block truncate">{option.label}</span>
									<span className="block truncate text-muted-foreground text-xs">
										{option.providerName} · {option.modelId}
									</span>
								</div>
							)}
							renderSelected={(option) =>
								option ? (
									<div className="min-w-0">
										<span className="block truncate">{option.label}</span>
										<span className="block truncate text-muted-foreground text-xs">
											{option.providerName} · {option.modelId}
										</span>
									</div>
								) : null
							}
							searchPlaceholder="Modell suchen..."
							value={selectedModelId}
						/>
					</div>
					<div className="rounded-md border border-solarized-base2/80 bg-solarized-base2/20 p-3 text-solarized-base01 text-xs">
						<div className="font-medium text-solarized-base00">Aktuelle Auswahl</div>
						<div className="mt-1">
							{selectedModel
								? `${selectedModel.providerName} · ${selectedModel.modelId}`
								: "Kein Modell ausgewählt"}
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
				<Card className="border-solarized-base2 bg-solarized-base3">
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="flex items-center gap-2 text-solarized-base00">
							<Mic className="h-4 w-4 text-solarized-blue" />
							Audio aufnehmen
						</CardTitle>
						<CardDescription className="text-solarized-base01">
							Nimm eine Aufnahme auf und transkribiere sie mit dem ausgewählten Modell. Maximal{" "}
							{formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro
							Aufnahme.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
						<AudioInput
							disabled={isBusy}
							maxRecordings={1}
							onValueChange={handleRecordingsChange}
							value={recordings}
						/>
						<Button
							className="w-full"
							disabled={!canTranscribe}
							onClick={() => {
								transcribeMutation.mutate();
							}}
							type="button"
						>
							{isBusy ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Wird transkribiert...
								</>
							) : (
								<>
									<AudioLines className="mr-2 h-4 w-4" />
									Transkribieren
								</>
							)}
						</Button>
					</CardContent>
				</Card>

				<Card className="min-h-[420px] border-solarized-base2 bg-solarized-base3">
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="flex items-center gap-2 text-solarized-base00">
							<AudioLines className="h-4 w-4 text-solarized-blue" />
							Transkript
						</CardTitle>
						<CardDescription className="text-solarized-base01">
							{result
								? `Erzeugt mit ${result.modelName}`
								: "Das Transkript erscheint nach der Verarbeitung hier."}
						</CardDescription>
					</CardHeader>
					<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
						<Textarea
							className="min-h-[320px] resize-y border-solarized-base2 bg-solarized-base2/20 text-solarized-base00 placeholder:text-solarized-base01 focus:border-solarized-blue focus:ring-solarized-blue/20"
							placeholder="Noch kein Transkript vorhanden."
							readOnly
							value={result?.transcript ?? ""}
						/>
						{result && result.transcripts.length > 1 ? (
							<p className="mt-2 text-solarized-base01 text-xs">
								{result.transcripts.length} Aufnahmen wurden zu einem Transkript zusammengeführt.
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
