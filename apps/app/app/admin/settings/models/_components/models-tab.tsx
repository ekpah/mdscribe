"use client";

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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { ReasoningEffortSelect } from "@/app/admin/_components/reasoning-effort-select";
import { supportsReasoningParameters } from "@/app/admin/_lib/reasoning";
import type { ReasoningEffort } from "@/app/admin/_lib/reasoning";
import { orpc } from "@/lib/orpc";

interface AiModelData {
	id: string;
	providerId: string;
	modelId: string;
	displayName: string;
	supportedParameters?: string[];
	supportsReasoning: boolean;
}

interface ProviderData {
	id: string;
	name: string;
	models: AiModelData[];
}

interface ModelsTabProps {
	connections: ProviderData[];
}

interface ModelOption {
	value: string;
	label: string;
	group: string;
	keywords: string[];
}

type DefaultType = "multimodal" | "text" | "file-image" | "speech-to-text" | "evaluation";

const NONE_VALUE = "__none__";

const getSafeSelectValue = (value: string | null | undefined, options: ModelOption[]): string => {
	if (!value) {
		return NONE_VALUE;
	}
	return options.some((option) => option.value === value) ? value : NONE_VALUE;
};

const makeSelectorOptions = (options: ModelOption[]): ModelOption[] => [
	{
		group: "",
		keywords: ["none", "kein", "standard"],
		label: "Kein Standard",
		value: NONE_VALUE,
	},
	...options,
];

const DEFAULT_MODEL_ROWS: {
	description: string;
	label: string;
	placeholder: string;
	type: DefaultType;
}[] = [
	{
		description:
			"Optional. Wenn gesetzt, nutzt MDScribe dieses Modell direkt für Audio sowie Datei-/Bild-Eingaben. Reiner Text nutzt weiterhin das Standard-Textmodell.",
		label: "Multi-modales Modell",
		placeholder: "Multi-modales Modell auswählen",
		type: "multimodal",
	},
	{
		description:
			"Erzeugt die finale Antwort für reine Texteingaben und für vorverarbeitete Medien, wenn kein multi-modales Standardmodell greift.",
		label: "Standard-Textmodell",
		placeholder: "Textmodell auswählen",
		type: "text",
	},
	{
		description:
			"Extrahiert Datei-, PDF- oder Bildinhalte zu Text, bevor das Standard-Textmodell weiterarbeitet.",
		label: "OCR/File/Image-Modell",
		placeholder: "OCR/File/Image-Modell auswählen",
		type: "file-image",
	},
	{
		description:
			"Transkribiert Audioaufnahmen zu Text, wenn kein multi-modales Standardmodell für Medien gesetzt ist.",
		label: "Audio-Transkriptionsmodell",
		placeholder: "Speech-to-Text-Modell auswählen",
		type: "speech-to-text",
	},
	{
		description: "Bewertet Playground- und Usage-Ausgaben.",
		label: "Evaluationsmodell",
		placeholder: "Evaluationsmodell auswählen",
		type: "evaluation",
	},
];

export const ModelsTab = ({ connections }: ModelsTabProps) => {
	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;
	const defaultsKey = orpc.admin.providers.defaults.get.queryOptions().queryKey;

	const { data: defaults, isLoading: isDefaultsLoading } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const setDefaultMutation = useMutation({
		mutationFn: (data: {
			defaultType: DefaultType;
			modelId: string | null;
			reasoningEffort: ReasoningEffort;
		}) => orpc.admin.providers.defaults.set.call(data),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler"),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: defaultsKey });
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("Standardmodell aktualisiert");
		},
	});

	const enabledModelOptions = connections.flatMap((provider) =>
		provider.models.map((model) => ({
			group: provider.name,
			keywords: [provider.name, model.modelId, model.displayName],
			label: model.displayName,
			value: model.id,
		})),
	);
	const modelById = useMemo(
		() =>
			new Map(
				connections.flatMap((provider) =>
					provider.models.map((model) => [model.id, model] as const),
				),
			),
		[connections],
	);
	const selectorOptions = makeSelectorOptions(enabledModelOptions);

	const isUpdatingDefaults = isDefaultsLoading || setDefaultMutation.isPending;

	const getDefaultModelId = useCallback(
		(defaultType: DefaultType): string | null => {
			switch (defaultType) {
				case "multimodal": {
					return defaults?.defaultMultimodalModelId ?? null;
				}
				case "text": {
					return defaults?.defaultTextModelId ?? null;
				}
				case "file-image": {
					return defaults?.defaultFileImageModelId ?? null;
				}
				case "speech-to-text": {
					return defaults?.defaultSpeechToTextModelId ?? null;
				}
				case "evaluation": {
					return defaults?.defaultEvaluationModel ?? null;
				}
				default: {
					return null;
				}
			}
		},
		[defaults],
	);

	const getDefaultReasoningEffort = useCallback(
		(defaultType: DefaultType): ReasoningEffort => {
			switch (defaultType) {
				case "multimodal": {
					return defaults?.defaultMultimodalReasoningEffort ?? "none";
				}
				case "text": {
					return defaults?.defaultTextReasoningEffort ?? "none";
				}
				case "file-image": {
					return defaults?.defaultFileImageReasoningEffort ?? "none";
				}
				case "speech-to-text": {
					return defaults?.defaultSpeechToTextReasoningEffort ?? "none";
				}
				case "evaluation": {
					return defaults?.defaultEvaluationReasoningEffort ?? "none";
				}
				default: {
					return "none";
				}
			}
		},
		[defaults],
	);

	const handleDefaultModelChange = useCallback(
		(defaultType: DefaultType, value: string) => {
			const modelId = value === NONE_VALUE ? null : value;
			const selectedModel = modelId ? modelById.get(modelId) : null;
			const currentReasoningEffort = getDefaultReasoningEffort(defaultType);
			setDefaultMutation.mutate({
				defaultType,
				modelId,
				reasoningEffort: supportsReasoningParameters(selectedModel)
					? currentReasoningEffort
					: "none",
			});
		},
		[getDefaultReasoningEffort, modelById, setDefaultMutation],
	);

	const handleClearDefaultModel = useCallback(
		(defaultType: DefaultType) => {
			setDefaultMutation.mutate({
				defaultType,
				modelId: null,
				reasoningEffort: "none",
			});
		},
		[setDefaultMutation],
	);

	const handleDefaultReasoningChange = useCallback(
		(defaultType: DefaultType, reasoningEffort: ReasoningEffort) => {
			setDefaultMutation.mutate({
				defaultType,
				modelId: getDefaultModelId(defaultType),
				reasoningEffort,
			});
		},
		[getDefaultModelId, setDefaultMutation],
	);

	return (
		<div className="space-y-4">
			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
				<CardHeader className="space-y-2 p-4 sm:p-6">
					<div className="flex items-center gap-2">
						<SlidersHorizontal className="h-4 w-4 text-solarized-base01" />
						<CardTitle className="text-base text-solarized-base00">Standardmodelle</CardTitle>
					</div>
					<CardDescription className="text-solarized-base01 text-sm">
						Wir prüfen keine Modalitäten automatisch. Bitte weisen Sie passende Modelle je
						Standardtyp zu.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
					{DEFAULT_MODEL_ROWS.map((row) => {
						const modelId = getDefaultModelId(row.type);
						const selectedModel = modelId ? modelById.get(modelId) : null;
						const supportsReasoning = supportsReasoningParameters(selectedModel);
						const selectorId = `default-${row.type}-model`;
						return (
							<div
								key={row.type}
								className="grid gap-3 rounded-md border border-solarized-base2/70 bg-solarized-base3/50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]"
							>
								<div className="space-y-2">
									<Label htmlFor={selectorId}>{row.label}</Label>
									<div className="flex gap-2">
										<ModelSelector
											className="border-solarized-base2 bg-solarized-base3"
											disabled={isUpdatingDefaults}
											id={selectorId}
											onValueChange={(value) => {
												handleDefaultModelChange(row.type, value);
											}}
											options={selectorOptions}
											placeholder={row.placeholder}
											value={getSafeSelectValue(modelId, enabledModelOptions)}
										/>
										<Button
											aria-label={`${row.label} entfernen`}
											className="shrink-0 border-solarized-base2 text-solarized-base01 hover:bg-solarized-base2/60 hover:text-solarized-base00"
											disabled={isUpdatingDefaults || !modelId}
											onClick={() => {
												handleClearDefaultModel(row.type);
											}}
											size="icon"
											type="button"
											variant="outline"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
									<p className="text-solarized-base01 text-xs">{row.description}</p>
								</div>
								<div className="space-y-2">
									<ReasoningEffortSelect
										disabled={isUpdatingDefaults || !supportsReasoning}
										label="Reasoning"
										onValueChange={(value) => {
											handleDefaultReasoningChange(row.type, value);
										}}
										showDescription={false}
										value={supportsReasoning ? getDefaultReasoningEffort(row.type) : "none"}
									/>
									{selectedModel && !supportsReasoning ? (
										<p className="text-solarized-base01 text-xs">
											Dieses Modell meldet keine Reasoning-Unterstützung. MDScribe sendet deshalb
											keine Reasoning-Optionen.
										</p>
									) : null}
								</div>
							</div>
						);
					})}
				</CardContent>
				<CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
					<div className="rounded-md border border-solarized-base2/80 bg-solarized-base2/20 p-3 text-solarized-base01 text-xs">
						<div>
							Multi-modal: Modell muss Text plus Audio und Datei/Bild direkt verstehen; wird
							nur bei Medieninput bevorzugt.
						</div>
						<div>
							Text: Modell muss Text-Generierung unterstützen; wird immer für reine
							Texteingaben genutzt.
						</div>
						<div>
							OCR/File/Image: Modell muss Datei- oder Bild-Eingaben (z.B. PDF/OCR) in Text
							überführen.
						</div>
						<div>Audio-Transkription: Modell muss Audio zu Text transkribieren.</div>
						<div>Evaluation: Modell wird für Playground-Bewertung (Score) genutzt.</div>
					</div>
				</CardContent>
			</Card>

			{enabledModelOptions.length === 0 && (
				<p className="text-solarized-base01 text-sm">
					Keine Modelle synchronisiert. Unter &quot;Verbindungen&quot; zuerst Provider prüfen und
					Modelle aktualisieren.
				</p>
			)}
		</div>
	);
};
