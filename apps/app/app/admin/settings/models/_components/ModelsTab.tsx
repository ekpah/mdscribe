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

function getSafeSelectValue(
	value: string | null | undefined,
	options: ModelOption[],
): string {
	if (!value) return NONE_VALUE;
	return options.some((option) => option.value === value) ? value : NONE_VALUE;
}

export function ModelsTab({ connections }: ModelsTabProps) {
	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;
	const defaultsKey = orpc.admin.providers.defaults.get.queryOptions().queryKey;

	const { data: defaults, isLoading: isDefaultsLoading } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const setDefaultMutation = useMutation({
		mutationFn: (data: { defaultType: DefaultType; modelId: string | null }) =>
			orpc.admin.providers.defaults.set.call(data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: defaultsKey });
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("Standardmodell aktualisiert");
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Fehler"),
	});

	const enabledModelOptions = connections.flatMap((provider) =>
		provider.models.map((model) => ({
			value: model.id,
			label: model.displayName,
			group: provider.name,
			keywords: [provider.name, model.modelId, model.displayName],
		})),
	);

	const selectorOptions: ModelOption[] = [
		{
			value: NONE_VALUE,
			label: "Kein Standard",
			group: "",
			keywords: ["none", "kein", "standard"],
		},
		...enabledModelOptions,
	];

	const isUpdatingDefaults = isDefaultsLoading || setDefaultMutation.isPending;

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
							onValueChange={(value) =>
								setDefaultMutation.mutate({
									defaultType: "text",
									modelId: value === NONE_VALUE ? null : value,
								})
							}
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
							onValueChange={(value) =>
								setDefaultMutation.mutate({
									defaultType: "file-image",
									modelId: value === NONE_VALUE ? null : value,
								})
							}
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
							onValueChange={(value) =>
								setDefaultMutation.mutate({
									defaultType: "speech-to-text",
									modelId: value === NONE_VALUE ? null : value,
								})
							}
							disabled={isUpdatingDefaults}
							placeholder="Speech-Modell auswählen"
							className="border-solarized-base2 bg-solarized-base3"
						/>
					</div>
				</CardContent>
			</Card>

			{enabledModelOptions.length === 0 && (
				<p className="text-solarized-base01 text-sm">
					Keine Modelle synchronisiert. Unter "Verbindungen" zuerst Provider
					prüfen und Modelle aktualisieren.
				</p>
			)}
		</div>
	);
}
