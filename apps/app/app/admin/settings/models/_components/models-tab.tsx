"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from "@repo/design-system/components/ui/model-selector";
import { Tabs, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
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

type DefaultType = "text" | "file-image" | "speech-to-text" | "evaluation";
type MediaMode = "direct" | "multimodal";
type StandardCapability = "audio" | "documents";

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

interface DefaultModelRowConfig {
	capabilityGate?: StandardCapability;
	description: string;
	label: string;
	mediaModeDescriptions?: Record<MediaMode, string>;
	mediaModeKey?: "fileImageMode" | "speechToTextMode";
	placeholder: string;
	type: DefaultType;
}

const DEFAULT_MODEL_ROWS: DefaultModelRowConfig[] = [
	{
		description:
			"Erzeugt immer die finale Antwort. Eingaben, deren Fähigkeit unten angehakt ist, gehen direkt an dieses Modell.",
		label: "Standard-Modell",
		placeholder: "Standard-Modell auswählen",
		type: "text",
	},
	{
		capabilityGate: "documents",
		description:
			"Extrahiert PDF- oder Bildinhalte zu Text, bevor das Standard-Modell weiterarbeitet.",
		label: "Dokumenten-Modell",
		mediaModeDescriptions: {
			direct:
				"Direkt: Das Dokument wird ohne Text-Prompt gesendet — für dedizierte OCR-Modelle.",
			multimodal:
				"Multimodal: Das Dokument wird zusammen mit einem Extraktions-Prompt an ein multimodales Modell gesendet.",
		},
		mediaModeKey: "fileImageMode",
		placeholder: "Dokumenten-Modell auswählen",
		type: "file-image",
	},
	{
		capabilityGate: "audio",
		description:
			"Transkribiert Audioaufnahmen zu Text, bevor das Standard-Modell weiterarbeitet.",
		label: "Audio-Modell",
		mediaModeDescriptions: {
			direct:
				"Direkt: Die Aufnahme wird ohne Prompt an den Transkriptions-Endpoint des Providers gesendet.",
			multimodal:
				"Multimodal: Die Aufnahme wird zusammen mit einem Transkriptions-Prompt an ein Audio-fähiges Chat-Modell gesendet.",
		},
		mediaModeKey: "speechToTextMode",
		placeholder: "Audio-Modell auswählen",
		type: "speech-to-text",
	},
	{
		description: "Bewertet Playground- und Usage-Ausgaben.",
		label: "Evaluationsmodell",
		placeholder: "Evaluationsmodell auswählen",
		type: "evaluation",
	},
];

const StandardCapabilities = ({
	disabled,
	onToggle,
	supportsAudio,
	supportsDocuments,
}: {
	disabled: boolean;
	onToggle: (capability: StandardCapability, enabled: boolean) => void;
	supportsAudio: boolean;
	supportsDocuments: boolean;
}) => (
	<div className="space-y-2">
		<Label>Fähigkeiten des Standard-Modells</Label>
		<div className="flex flex-wrap gap-x-5 gap-y-2">
			<div className="flex items-center gap-2">
				<Checkbox checked disabled id="standard-capability-text" />
				<Label
					className="font-normal text-sm text-solarized-base01"
					htmlFor="standard-capability-text"
				>
					Text
				</Label>
			</div>
			<div className="flex items-center gap-2">
				<Checkbox
					checked={supportsDocuments}
					disabled={disabled}
					id="standard-capability-documents"
					onCheckedChange={(checked) => {
						onToggle("documents", checked === true);
					}}
				/>
				<Label
					className="font-normal text-sm text-solarized-base00"
					htmlFor="standard-capability-documents"
				>
					Dokumente
				</Label>
			</div>
			<div className="flex items-center gap-2">
				<Checkbox
					checked={supportsAudio}
					disabled={disabled}
					id="standard-capability-audio"
					onCheckedChange={(checked) => {
						onToggle("audio", checked === true);
					}}
				/>
				<Label
					className="font-normal text-sm text-solarized-base00"
					htmlFor="standard-capability-audio"
				>
					Audio
				</Label>
			</div>
		</div>
		<p className="text-solarized-base01 text-xs">
			Angehakte Eingaben werden dem Standard-Modell direkt übergeben. Für nicht angehakte
			Eingaben wird das jeweilige Modell unten zur Vorverarbeitung genutzt.
		</p>
	</div>
);

const MediaModeToggle = ({
	descriptions,
	disabled,
	onValueChange,
	value,
}: {
	descriptions: Record<MediaMode, string>;
	disabled: boolean;
	onValueChange: (value: MediaMode) => void;
	value: MediaMode;
}) => (
	<div className="space-y-2">
		<Tabs
			onValueChange={(nextValue) => {
				onValueChange(nextValue as MediaMode);
			}}
			value={value}
		>
			<TabsList className="h-auto max-w-full flex-wrap">
				<TabsTrigger disabled={disabled} value="direct">
					Direkt
				</TabsTrigger>
				<TabsTrigger disabled={disabled} value="multimodal">
					Multimodal mit Prompt
				</TabsTrigger>
			</TabsList>
		</Tabs>
		<p className="text-solarized-base01 text-xs">{descriptions[value]}</p>
	</div>
);

const DefaultModelRow = ({
	coveredByStandard,
	isUpdating,
	mediaMode,
	modelId,
	onClear,
	onMediaModeChange,
	onModelChange,
	onReasoningChange,
	renderCapabilities,
	row,
	selectedModel,
	selectorOptions,
	enabledModelOptions,
	reasoningEffort,
}: {
	coveredByStandard: boolean;
	enabledModelOptions: ModelOption[];
	isUpdating: boolean;
	mediaMode: MediaMode | null;
	modelId: string | null;
	onClear: () => void;
	onMediaModeChange: (value: MediaMode) => void;
	onModelChange: (value: string) => void;
	onReasoningChange: (value: ReasoningEffort) => void;
	reasoningEffort: ReasoningEffort;
	renderCapabilities?: () => React.ReactNode;
	row: DefaultModelRowConfig;
	selectedModel: AiModelData | null;
	selectorOptions: ModelOption[];
}) => {
	const supportsReasoning = supportsReasoningParameters(selectedModel);
	const selectorId = `default-${row.type}-model`;
	const rowDisabled = isUpdating || coveredByStandard;

	return (
		<div
			className={`grid gap-3 rounded-md border border-solarized-base2/70 bg-solarized-base3/50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] ${coveredByStandard ? "opacity-60" : ""}`}
		>
			<div className="space-y-2">
				<Label htmlFor={selectorId}>{row.label}</Label>
				<div className="flex gap-2">
					<ModelSelector
						className="border-solarized-base2 bg-solarized-base3"
						disabled={rowDisabled}
						id={selectorId}
						onValueChange={onModelChange}
						options={selectorOptions}
						placeholder={row.placeholder}
						value={getSafeSelectValue(modelId, enabledModelOptions)}
					/>
					<Button
						aria-label={`${row.label} entfernen`}
						className="shrink-0 border-solarized-base2 text-solarized-base01 hover:bg-solarized-base2/60 hover:text-solarized-base00"
						disabled={rowDisabled || !modelId}
						onClick={onClear}
						size="icon"
						type="button"
						variant="outline"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<p className="text-solarized-base01 text-xs">{row.description}</p>
				{coveredByStandard ? (
					<p className="text-solarized-base01 text-xs italic">
						Wird vom Standard-Modell direkt abgedeckt. Fähigkeit oben abwählen, um ein eigenes
						Modell zu nutzen.
					</p>
				) : null}
			</div>
			<div className="space-y-3">
				{row.mediaModeKey && row.mediaModeDescriptions && mediaMode ? (
					<MediaModeToggle
						descriptions={row.mediaModeDescriptions}
						disabled={rowDisabled}
						onValueChange={onMediaModeChange}
						value={mediaMode}
					/>
				) : null}
				<ReasoningEffortSelect
					disabled={rowDisabled || !supportsReasoning}
					label="Reasoning"
					onValueChange={onReasoningChange}
					showDescription={false}
					value={supportsReasoning ? reasoningEffort : "none"}
				/>
				{selectedModel && !supportsReasoning ? (
					<p className="text-solarized-base01 text-xs">
						Dieses Modell meldet keine Reasoning-Unterstützung. MDScribe sendet deshalb keine
						Reasoning-Optionen.
					</p>
				) : null}
				{renderCapabilities ? renderCapabilities() : null}
			</div>
		</div>
	);
};

export const ModelsTab = ({ connections }: ModelsTabProps) => {
	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;
	const defaultsKey = orpc.admin.providers.defaults.get.queryOptions().queryKey;

	const { data: defaults, isLoading: isDefaultsLoading } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const invalidateDefaults = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: defaultsKey });
		await queryClient.invalidateQueries({ queryKey: listKey });
	}, [defaultsKey, listKey, queryClient]);

	const setDefaultMutation = useMutation({
		mutationFn: (data: {
			defaultType: DefaultType;
			modelId: string | null;
			reasoningEffort: ReasoningEffort;
		}) => orpc.admin.providers.defaults.set.call(data),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler"),
		onSuccess: async () => {
			await invalidateDefaults();
			toast.success("Standardmodell aktualisiert");
		},
	});

	const setOptionsMutation = useMutation({
		mutationFn: (data: {
			fileImageMode?: MediaMode;
			speechToTextMode?: MediaMode;
			standardSupportsAudio?: boolean;
			standardSupportsDocuments?: boolean;
		}) => orpc.admin.providers.defaults.setOptions.call(data),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler"),
		onSuccess: async () => {
			await invalidateDefaults();
			toast.success("Modell-Einstellungen aktualisiert");
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

	const isUpdatingDefaults =
		isDefaultsLoading || setDefaultMutation.isPending || setOptionsMutation.isPending;

	const getDefaultModelId = useCallback(
		(defaultType: DefaultType): string | null => {
			switch (defaultType) {
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

	const handleCapabilityToggle = useCallback(
		(capability: StandardCapability, enabled: boolean) => {
			setOptionsMutation.mutate(
				capability === "documents"
					? { standardSupportsDocuments: enabled }
					: { standardSupportsAudio: enabled },
			);
		},
		[setOptionsMutation],
	);

	const handleMediaModeChange = useCallback(
		(mediaModeKey: "fileImageMode" | "speechToTextMode", value: MediaMode) => {
			setOptionsMutation.mutate({ [mediaModeKey]: value });
		},
		[setOptionsMutation],
	);

	const getMediaMode = (row: DefaultModelRowConfig): MediaMode | null => {
		if (row.mediaModeKey === "fileImageMode") {
			return defaults?.defaultFileImageMode ?? "multimodal";
		}
		if (row.mediaModeKey === "speechToTextMode") {
			return defaults?.defaultSpeechToTextMode ?? "direct";
		}
		return null;
	};

	const isCoveredByStandard = (row: DefaultModelRowConfig): boolean => {
		if (row.capabilityGate === "documents") {
			return defaults?.defaultStandardSupportsDocuments ?? false;
		}
		if (row.capabilityGate === "audio") {
			return defaults?.defaultStandardSupportsAudio ?? false;
		}
		return false;
	};

	return (
		<div className="space-y-4">
			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
				<CardHeader className="space-y-2 p-4 sm:p-6">
					<div className="flex items-center gap-2">
						<SlidersHorizontal className="h-4 w-4 text-solarized-base01" />
						<CardTitle className="text-base text-solarized-base00">Standardmodelle</CardTitle>
					</div>
					<CardDescription className="text-solarized-base01 text-sm">
						Wir prüfen keine Modalitäten automatisch. Bitte weisen Sie passende Modelle zu und
						wählen Sie die Fähigkeiten des Standard-Modells selbst.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
					{DEFAULT_MODEL_ROWS.map((row) => {
						const modelId = getDefaultModelId(row.type);
						const mediaMode = getMediaMode(row);
						return (
							<DefaultModelRow
								coveredByStandard={isCoveredByStandard(row)}
								enabledModelOptions={enabledModelOptions}
								isUpdating={isUpdatingDefaults}
								key={row.type}
								mediaMode={mediaMode}
								modelId={modelId}
								onClear={() => {
									setDefaultMutation.mutate({
										defaultType: row.type,
										modelId: null,
										reasoningEffort: "none",
									});
								}}
								onMediaModeChange={(value) => {
									if (row.mediaModeKey) {
										handleMediaModeChange(row.mediaModeKey, value);
									}
								}}
								onModelChange={(value) => {
									handleDefaultModelChange(row.type, value);
								}}
								onReasoningChange={(value) => {
									setDefaultMutation.mutate({
										defaultType: row.type,
										modelId,
										reasoningEffort: value,
									});
								}}
								reasoningEffort={getDefaultReasoningEffort(row.type)}
								renderCapabilities={
									row.type === "text"
										? () => (
												<StandardCapabilities
													disabled={isUpdatingDefaults}
													onToggle={handleCapabilityToggle}
													supportsAudio={defaults?.defaultStandardSupportsAudio ?? false}
													supportsDocuments={defaults?.defaultStandardSupportsDocuments ?? false}
												/>
											)
										: undefined
								}
								row={row}
								selectedModel={modelId ? (modelById.get(modelId) ?? null) : null}
								selectorOptions={selectorOptions}
							/>
						);
					})}
				</CardContent>
				<CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
					<div className="rounded-md border border-solarized-base2/80 bg-solarized-base2/20 p-3 text-solarized-base01 text-xs">
						<div>
							Standard-Modell: erzeugt immer die finale Antwort. Angehakte Fähigkeiten
							(Dokumente, Audio) werden ihm als native Eingaben übergeben.
						</div>
						<div>
							Dokumenten-Modell: extrahiert PDF/Bild zu Text, wenn die Fähigkeit Dokumente nicht
							angehakt ist — direkt (ohne Prompt) oder multimodal (mit Prompt).
						</div>
						<div>
							Audio-Modell: transkribiert Aufnahmen, wenn die Fähigkeit Audio nicht angehakt ist
							— direkt (Transkriptions-Endpoint) oder multimodal (Prompt + Audio).
						</div>
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
