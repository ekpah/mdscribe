"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
	audioCapableModels,
	modelDetails,
	modelOptions,
} from "@/lib/ai-models";
import {
	defaultAppSettings,
	type AppSettings,
} from "@/lib/app-settings";
import { orpc } from "@/lib/orpc";
import { supportedModels, type SupportedModel } from "@/orpc/scribe/types";

const settingsQueryKey = orpc.admin.settings.get.queryOptions().queryKey;
const publicSettingsQueryKey = orpc.settings.get.queryOptions().queryKey;

const toModelOptions = (models: SupportedModel[]) =>
	modelOptions.filter((option) => models.includes(option.id));

export default function AdminSettingsPage() {
	const queryClient = useQueryClient();
	const { data, isLoading, error } = useQuery(
		orpc.admin.settings.get.queryOptions(),
	);
	const [draft, setDraft] = useState<AppSettings>(defaultAppSettings);

	useEffect(() => {
		if (data) {
			setDraft(data);
		}
	}, [data]);

	const updateMutation = useMutation(
		orpc.admin.settings.update.mutationOptions({
			onSuccess: (updated) => {
				queryClient.setQueryData(settingsQueryKey, updated);
				queryClient.setQueryData(publicSettingsQueryKey, updated);
			},
		}),
	);

	const isDirty = useMemo(() => {
		if (!data) {
			return false;
		}
		return JSON.stringify(data) !== JSON.stringify(draft);
	}, [data, draft]);

	const handleModeChange = (value: "multi" | "single") => {
		setDraft((prev) => {
			if (prev.modelSelection.mode === value) {
				return prev;
			}

			if (value === "single") {
				const primaryModel =
					prev.modelSelection.mode === "multi"
						? prev.modelSelection.defaultModel
						: prev.modelSelection.primaryModel;

				return {
					...prev,
					modelSelection: {
						mode: "single",
						primaryModel,
					},
				};
			}

			const defaultModel =
				prev.modelSelection.mode === "single"
					? prev.modelSelection.primaryModel
					: prev.modelSelection.defaultModel;

			return {
				...prev,
				modelSelection: {
					mode: "multi",
					defaultModel,
					availableModels: [...supportedModels],
				},
			};
		});
	};

	const handleAvailableModelToggle = (model: SupportedModel) => {
		setDraft((prev) => {
			if (prev.modelSelection.mode !== "multi") {
				return prev;
			}

			const isSelected = prev.modelSelection.availableModels.includes(model);
			if (isSelected && prev.modelSelection.availableModels.length === 1) {
				toast.error("Mindestens ein Modell muss aktiv bleiben.");
				return prev;
			}

			const nextAvailable = isSelected
				? prev.modelSelection.availableModels.filter(
						(item) => item !== model,
					)
				: [...prev.modelSelection.availableModels, model];

			const nextDefault = nextAvailable.includes(prev.modelSelection.defaultModel)
				? prev.modelSelection.defaultModel
				: nextAvailable[0];

			return {
				...prev,
				modelSelection: {
					...prev.modelSelection,
					availableModels: nextAvailable,
					defaultModel: nextDefault,
				},
			};
		});
	};

	const handleDefaultModelChange = (value: SupportedModel) => {
		setDraft((prev) => {
			if (prev.modelSelection.mode !== "multi") {
				return prev;
			}

			return {
				...prev,
				modelSelection: {
					...prev.modelSelection,
					defaultModel: value,
				},
			};
		});
	};

	const handlePrimaryModelChange = (value: SupportedModel) => {
		setDraft((prev) => {
			if (prev.modelSelection.mode !== "single") {
				return prev;
			}

			return {
				...prev,
				modelSelection: {
					...prev.modelSelection,
					primaryModel: value,
				},
			};
		});
	};

	const handleAudioModelChange = (value: string) => {
		setDraft((prev) => {
			if (prev.modelSelection.mode !== "single") {
				return prev;
			}

			const audioModel = value === "none" ? undefined : (value as SupportedModel);

			return {
				...prev,
				modelSelection: {
					...prev.modelSelection,
					audioModel,
				},
			};
		});
	};

	const handleSave = async () => {
		try {
			await updateMutation.mutateAsync(draft);
			toast.success("Einstellungen gespeichert");
		} catch (updateError) {
			const message =
				updateError instanceof Error
					? updateError.message
					: "Einstellungen konnten nicht gespeichert werden";
			toast.error(message);
		}
	};

	const errorMessage =
		error instanceof Error
			? error.message
			: error
				? String(error)
				: "Einstellungen konnten nicht geladen werden";

	if (isLoading && !data) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[400px] max-w-5xl items-center justify-center">
					<div className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span className="text-sm sm:text-base">
							Einstellungen werden geladen...
						</span>
					</div>
				</div>
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[400px] max-w-5xl items-center justify-center">
					<div className="space-y-2 text-center">
						<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
							Systemeinstellungen nicht verfügbar
						</h2>
						<p className="text-sm text-solarized-base01 sm:text-base">
							{errorMessage}
						</p>
					</div>
				</div>
			</div>
		);
	}

	const selection = draft.modelSelection;
	const availableModels =
		selection.mode === "multi" ? selection.availableModels : [];
	const audioOptions = toModelOptions(audioCapableModels);
	const defaultOptions =
		selection.mode === "multi" ? toModelOptions(selection.availableModels) : [];

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-solarized-yellow/10 sm:h-12 sm:w-12">
						<Settings2 className="h-5 w-5 text-solarized-yellow sm:h-6 sm:w-6" />
					</div>
					<div>
						<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">
							Systemeinstellungen
						</h1>
						<p className="text-sm text-solarized-base01 sm:text-base">
							Verwalten Sie globale KI- und Plattform-Einstellungen
						</p>
					</div>
				</div>

				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							LLM-Provider
						</CardTitle>
						<CardDescription>
							Derzeit ist nur OpenRouter verfugbar. Weitere Provider folgen
							spater.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-blue/10 text-solarized-blue">
								OpenRouter
							</Badge>
							<span className="text-sm text-solarized-base01">
								Standard-Provider
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							AI Scribe Modelle
						</CardTitle>
						<CardDescription>
							Steuern Sie, ob Nutzer ein Modell wahlen konnen oder ob ein
							festes Modell verwendet wird.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-3">
							<Label className="text-sm text-solarized-base00">
								Modus
							</Label>
							<RadioGroup
								className="grid gap-3 sm:grid-cols-2"
								onValueChange={(value) =>
									handleModeChange(value as "multi" | "single")
								}
								value={selection.mode}
							>
								<div className="flex items-start gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/60 p-4">
									<RadioGroupItem id="mode-multi" value="multi" />
									<div className="space-y-1">
										<Label htmlFor="mode-multi" className="text-sm">
											Mehrere Modelle
										</Label>
										<p className="text-solarized-base01 text-xs">
											Nutzer sehen den Modell-Selector in AI Scribe.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/60 p-4">
									<RadioGroupItem id="mode-single" value="single" />
									<div className="space-y-1">
										<Label htmlFor="mode-single" className="text-sm">
											Ein Modell
										</Label>
										<p className="text-solarized-base01 text-xs">
											Der Model-Selector wird ausgeblendet.
										</p>
									</div>
								</div>
							</RadioGroup>
						</div>

						{selection.mode === "multi" ? (
							<div className="space-y-6">
								<div className="space-y-3">
									<Label className="text-sm text-solarized-base00">
										Verfugbare Modelle
									</Label>
									<div className="grid gap-3 sm:grid-cols-2">
										{modelOptions.map((option) => {
											const isSelected = availableModels.includes(option.id);
											return (
												<div
													key={option.id}
													className="flex items-start gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-3"
												>
													<Checkbox
														id={`model-${option.id}`}
														checked={isSelected}
														onCheckedChange={() =>
															handleAvailableModelToggle(option.id)
														}
													/>
													<div className="space-y-1">
														<Label
															htmlFor={`model-${option.id}`}
															className="text-sm text-solarized-base00"
														>
															{option.name}
														</Label>
														{option.supportsAudio && (
															<p className="text-xs text-solarized-green">
																Audio-Unterstutzung
															</p>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>

								<div className="space-y-3">
									<Label className="text-sm text-solarized-base00">
										Standardmodell
									</Label>
									<Select
										value={selection.defaultModel}
										onValueChange={(value) =>
											handleDefaultModelChange(value as SupportedModel)
										}
									>
										<SelectTrigger className="max-w-md">
											<SelectValue placeholder="Standardmodell auswahlen" />
										</SelectTrigger>
										<SelectContent>
											{defaultOptions.map((option) => (
												<SelectItem key={option.id} value={option.id}>
													{option.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						) : (
							<div className="space-y-6">
								<div className="space-y-3">
									<Label className="text-sm text-solarized-base00">
										Standardmodell
									</Label>
									<Select
										value={selection.primaryModel}
										onValueChange={(value) =>
											handlePrimaryModelChange(value as SupportedModel)
										}
									>
										<SelectTrigger className="max-w-md">
											<SelectValue placeholder="Standardmodell auswahlen" />
										</SelectTrigger>
										<SelectContent>
											{modelOptions.map((option) => (
												<SelectItem key={option.id} value={option.id}>
													{option.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-3">
									<Label className="text-sm text-solarized-base00">
										Audio-Modell (optional)
									</Label>
									<Select
										value={selection.audioModel ?? "none"}
										onValueChange={handleAudioModelChange}
									>
										<SelectTrigger className="max-w-md">
											<SelectValue placeholder="Audio-Modell auswahlen" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Kein Audio-Modell</SelectItem>
											{audioOptions.map((option) => (
												<SelectItem key={option.id} value={option.id}>
													{option.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-xs text-solarized-base01">
										Wenn aktiviert, wird dieses Modell bei Audio-Aufnahmen
										verwendet.
									</p>
								</div>
							</div>
						)}
					</CardContent>
					<CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t border-solarized-base2 bg-solarized-base3/40">
						<div className="text-xs text-solarized-base01">
							Aktives Modell:{" "}
							<span className="font-medium text-solarized-base00">
								{selection.mode === "multi"
									? modelDetails[selection.defaultModel].name
									: modelDetails[selection.primaryModel].name}
							</span>
						</div>
						<Button
							className="min-w-[160px]"
							disabled={!isDirty || updateMutation.isPending}
							onClick={handleSave}
							type="button"
						>
							{updateMutation.isPending ? (
								<span className="flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Speichern...
								</span>
							) : (
								"Einstellungen speichern"
							)}
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
