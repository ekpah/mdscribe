"use client";

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
import { SlidersHorizontal } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";

interface AiModelData {
	id: string;
	providerId: string;
	modelId: string;
	displayName: string;
	supportsReasoning: boolean;
	inputModes: string[];
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

type DefaultType = "text" | "file-image" | "speech-to-text";

const NONE_VALUE = "__none__";

const getSafeSelectValue = (
	value: string | null | undefined,
	options: ModelOption[],
): string => {
	if (!value) {
		return NONE_VALUE;
	}
	return options.some((option) => option.value === value)
		? value
		: NONE_VALUE;
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

export const ModelsTab = ({ connections }: ModelsTabProps) => {
	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;
	const defaultsKey = orpc.admin.providers.defaults.get.queryOptions().queryKey;

	const { data: defaults, isLoading: isDefaultsLoading } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const setDefaultMutation = useMutation({
		mutationFn: (data: { defaultType: DefaultType; modelId: string | null }) =>
			orpc.admin.providers.defaults.set.call(data),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Fehler"),
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
	const selectorOptions = makeSelectorOptions(enabledModelOptions);

	const isUpdatingDefaults = isDefaultsLoading || setDefaultMutation.isPending;

	const handleDefaultModelChange = useCallback(
		(defaultType: DefaultType, value: string) => {
			setDefaultMutation.mutate({
				defaultType,
				modelId: value === NONE_VALUE ? null : value,
			});
		},
		[setDefaultMutation],
	);

	const handleTextModelChange = useCallback(
		(value: string) => {
			handleDefaultModelChange("text", value);
		},
		[handleDefaultModelChange],
	);

	const handleFileImageModelChange = useCallback(
		(value: string) => {
			handleDefaultModelChange("file-image", value);
		},
		[handleDefaultModelChange],
	);

	const handleSpeechModelChange = useCallback(
		(value: string) => {
			handleDefaultModelChange("speech-to-text", value);
		},
		[handleDefaultModelChange],
	);

	return (
		<div className="space-y-4">
			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
				<CardHeader className="space-y-2 p-4 sm:p-6">
					<div className="flex items-center gap-2">
						<SlidersHorizontal className="h-4 w-4 text-solarized-base01" />
						<CardTitle className="text-base text-solarized-base00">
							Standardmodelle
						</CardTitle>
					</div>
					<CardDescription className="text-solarized-base01 text-sm">
						Wir prüfen keine Modalitäten automatisch. Bitte weisen Sie passende Modelle je
						Standardtyp zu.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="default-text-model">Standard-Textmodell</Label>
						<ModelSelector
							className="border-solarized-base2 bg-solarized-base3"
							disabled={isUpdatingDefaults}
							id="default-text-model"
							onValueChange={handleTextModelChange}
							options={selectorOptions}
							placeholder="Textmodell auswählen"
							value={getSafeSelectValue(
								defaults?.defaultTextModelId,
								enabledModelOptions,
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="default-file-image-model">
							Standard-File/Image-Modell
						</Label>
						<ModelSelector
							className="border-solarized-base2 bg-solarized-base3"
							disabled={isUpdatingDefaults}
							id="default-file-image-model"
							onValueChange={handleFileImageModelChange}
							options={selectorOptions}
							placeholder="File/Image-Modell auswählen"
							value={getSafeSelectValue(
								defaults?.defaultFileImageModelId,
								enabledModelOptions,
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="default-speech-model">
							Standard-Spracherkennung
						</Label>
						<ModelSelector
							className="border-solarized-base2 bg-solarized-base3"
							disabled={isUpdatingDefaults}
							id="default-speech-model"
							onValueChange={handleSpeechModelChange}
							options={selectorOptions}
							placeholder="Speech-Modell auswählen"
							value={getSafeSelectValue(
								defaults?.defaultSpeechToTextModelId,
								enabledModelOptions,
							)}
						/>
					</div>
				</CardContent>
				<CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
					<div className="rounded-md border border-solarized-base2/80 bg-solarized-base2/20 p-3 text-solarized-base01 text-xs">
						<div>Text: Modell muss Text-Generierung unterstützen.</div>
						<div>File/Image: Modell muss Datei- oder Bild-Eingaben (z.B. PDF/OCR) verstehen.</div>
						<div>Spracherkennung: Modell muss Audio-Eingaben unterstützen; bei llama.cpp ggf. mit `mmproj` starten.</div>
					</div>
				</CardContent>
			</Card>

			{enabledModelOptions.length === 0 && (
				<p className="text-solarized-base01 text-sm">
					Keine Modelle synchronisiert. Unter &quot;Verbindungen&quot; zuerst Provider
					prüfen und Modelle aktualisieren.
				</p>
			)}
		</div>
	);
};
