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
) : string => {
	if (!value) {return NONE_VALUE;}
	return options.some((option) => option.value === value) ? value : NONE_VALUE;
};

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

	const selectorOptions: ModelOption[] = [
		{
			group: "",
			keywords: ["none", "kein", "standard"],
			label: "Kein Standard",
			value: NONE_VALUE,
		},
		...enabledModelOptions,
	];

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
						Auswahl aus synchronisierten Modellen aller Provider.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="default-text-model">Standard-Textmodell</Label>
						<ModelSelector
							id="default-text-model"
							options={selectorOptions}
								value={getSafeSelectValue(
									defaults?.defaultTextModelId,
									enabledModelOptions,
								)}
								onValueChange={handleTextModelChange}
								disabled={isUpdatingDefaults}
								placeholder="Textmodell auswählen"
								className="border-solarized-base2 bg-solarized-base3"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="default-file-image-model">
							Standard-File/Image-Modell
						</Label>
						<ModelSelector
							id="default-file-image-model"
							options={selectorOptions}
								value={getSafeSelectValue(
									defaults?.defaultFileImageModelId,
									enabledModelOptions,
								)}
								onValueChange={handleFileImageModelChange}
								disabled={isUpdatingDefaults}
								placeholder="File/Image-Modell auswählen"
								className="border-solarized-base2 bg-solarized-base3"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="default-speech-model">
							Standard-Spracherkennung
						</Label>
						<ModelSelector
							id="default-speech-model"
							options={selectorOptions}
								value={getSafeSelectValue(
									defaults?.defaultSpeechToTextModelId,
									enabledModelOptions,
								)}
								onValueChange={handleSpeechModelChange}
								disabled={isUpdatingDefaults}
								placeholder="Speech-Modell auswählen"
								className="border-solarized-base2 bg-solarized-base3"
						/>
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
