"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, Loader2, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { LabelWithInfo, SectionLabelWithInfo } from "@/app/_components/ai-text-forms/info-labels";
import { TemplateSelector } from "@/app/_components/template-selector";
import type { BuiltInAiscribeOverrideKey } from "@/lib/aiscribe-built-ins";
import { orpc } from "@/lib/orpc";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

const NONE_VALUE = "__none__";
const FIELD_EXPLANATIONS = {
	prompt:
		"Der Basis-Prompt ist das Prompt-Harness, das Inhalt, Ton und Struktur der Generierung vorgibt.",
	template:
		"Das Template gibt Stil, Format und Zielstruktur des erzeugten Textes vor. Eigene und favorisierte Templates können ebenfalls ausgewählt werden.",
} as const;

type BuiltInFormList = Awaited<ReturnType<typeof orpc.admin.scribeForms.listBuiltIn.call>>;
type BuiltInFormRecord = BuiltInFormList[number];

interface BuiltInFormDraft {
	enabled: boolean;
	key: BuiltInAiscribeOverrideKey;
	path: string;
	promptHarness: PromptHarnessId | "";
	templateId: string;
	title: string;
}

const toNullableSelectValue = (value: string): string | null =>
	value === NONE_VALUE ? null : value;

const toDraft = (form: BuiltInFormRecord): BuiltInFormDraft => ({
	enabled: form.override?.enabled ?? false,
	key: form.key,
	path: form.path,
	promptHarness: (form.override?.promptHarness ?? form.defaultPromptHarness) as PromptHarnessId,
	templateId: form.override?.templateId ?? NONE_VALUE,
	title: form.title,
});

export const BuiltInScribeModesSection = () => {
	const queryClient = useQueryClient();
	const builtInFormsQueryOptions = orpc.admin.scribeForms.listBuiltIn.queryOptions();
	const promptsQueryOptions = orpc.admin.scribe.prompts.list.queryOptions({
		input: { limit: 200 },
	});
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();

	const {
		data: builtInForms = [],
		error: builtInFormsError,
		isLoading: isBuiltInFormsLoading,
	} = useQuery(builtInFormsQueryOptions);
	const { data: prompts } = useQuery(promptsQueryOptions);
	const { data: templates = [] } = useQuery(templatesQueryOptions);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState<BuiltInFormDraft | null>(null);

	const builtInListKey = builtInFormsQueryOptions.queryKey;
	const promptHarnessOptions: { id: string; label: string }[] =
		prompts?.options ??
		prompts?.items.map((promptName) => ({ id: promptName, label: promptName })) ??
		[];
	const availablePromptNames = new Set<string>(promptHarnessOptions.map((option) => option.id));
	const promptHarnessLabelById = new Map<string, string>(
		promptHarnessOptions.map((option) => [option.id, option.label]),
	);
	const saveMutation = useMutation({
		mutationFn: (currentDraft: BuiltInFormDraft) => {
			if (!currentDraft.promptHarness) {
				throw new Error("Bitte Basis-Prompt auswählen");
			}

			return orpc.admin.scribeForms.upsertBuiltIn.call({
				enabled: currentDraft.enabled,
				key: currentDraft.key,
				promptHarness: currentDraft.promptHarness,
				templateId: toNullableSelectValue(currentDraft.templateId),
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: builtInListKey });
			toast.success("Schneller Modus gespeichert");
			setDialogOpen(false);
			setDraft(null);
		},
	});

	const toggleEnabledMutation = useMutation({
		mutationFn: ({ enabled, form }: { enabled: boolean; form: BuiltInFormRecord }) =>
			orpc.admin.scribeForms.upsertBuiltIn.call({
				enabled,
				key: form.key,
				promptHarness: (form.override?.promptHarness ??
					form.defaultPromptHarness) as PromptHarnessId,
				templateId: form.override?.templateId ?? null,
			}),
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: builtInListKey });
		},
	});

	const handleOpenEdit = useCallback((form: BuiltInFormRecord) => {
		setDraft(toDraft(form));
		setDialogOpen(true);
	}, []);

	const openEditHandlers = useMemo(() => {
		const handlers = new Map<string, () => void>();
		for (const form of builtInForms) {
			handlers.set(form.key, () => {
				handleOpenEdit(form);
			});
		}
		return handlers;
	}, [builtInForms, handleOpenEdit]);

	const builtInEnabledToggleHandlers = useMemo(() => {
		const handlers = new Map<string, (checked: boolean) => void>();
		for (const form of builtInForms) {
			handlers.set(form.key, (checked: boolean) => {
				toggleEnabledMutation.mutate({
					enabled: checked,
					form,
				});
			});
		}
		return handlers;
	}, [builtInForms, toggleEnabledMutation]);

	const handleDraftPromptHarnessChange = useCallback((value: string) => {
		setDraft((current) => {
			if (!current) {
				return current;
			}
			return {
				...current,
				promptHarness: value as PromptHarnessId,
			};
		});
	}, []);

	const handleDraftTemplateChange = useCallback((value: string) => {
		setDraft((current) => {
			if (!current) {
				return current;
			}
			return { ...current, templateId: value };
		});
	}, []);

	const handleDraftEnabledChange = useCallback((checked: boolean) => {
		setDraft((current) => {
			if (!current) {
				return current;
			}
			return { ...current, enabled: checked };
		});
	}, []);

	const handleSaveDraft = useCallback(() => {
		if (!draft) {
			return;
		}
		saveMutation.mutate(draft);
	}, [draft, saveMutation]);

	const draftPromptHarness = draft?.promptHarness;
	const hasUnavailableDraftPrompt =
		draftPromptHarness !== undefined && !availablePromptNames.has(draftPromptHarness);

	if (isBuiltInFormsLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
			</div>
		);
	}

	if (builtInFormsError) {
		return (
			<Card className="border-solarized-red/20 bg-solarized-red/10">
				<CardContent className="p-4 text-center text-solarized-red text-sm">
					{builtInFormsError instanceof Error
						? builtInFormsError.message
						: "Fehler beim Laden der Standardmodi"}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/40">
				<CardHeader className="gap-3">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<div className="rounded-lg bg-solarized-yellow/10 p-2 text-solarized-yellow">
								<WandSparkles className="h-4 w-4" />
							</div>
							<CardTitle>Schnelle Dokument-Generierung</CardTitle>
						</div>
						<CardDescription>
							Verwalten Sie Prompt, Template und Modell der festen Standardmodi (`/aiscribe/er`,
							`/aiscribe/icu`, ...). Ohne aktive Konfiguration bleibt der bisherige hardcoded
							Standard aktiv.
						</CardDescription>
					</div>
				</CardHeader>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				{builtInForms.map((form) => {
					const promptHarness = form.override?.promptHarness ?? form.defaultPromptHarness;
					const isPromptAvailable = availablePromptNames.has(promptHarness);
					const promptHarnessLabel = promptHarnessLabelById.get(promptHarness) ?? promptHarness;
					const handleOpenEditClick = openEditHandlers.get(form.key);
					const handleEnabledToggle = builtInEnabledToggleHandlers.get(form.key);
					const isTogglingCurrentForm =
						toggleEnabledMutation.isPending &&
						toggleEnabledMutation.variables?.form.key === form.key;
					if (!handleOpenEditClick || !handleEnabledToggle) {
						return null;
					}

					return (
						<Card key={form.key} className="border-solarized-base2 bg-solarized-base3/80">
							<CardHeader className="space-y-2">
								<div className="flex items-start justify-between gap-4">
									<div className="space-y-1">
										<Link
											href={form.path}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1.5 transition-colors hover:text-solarized-cyan"
										>
											<CardTitle className="text-base">{form.title}</CardTitle>
											<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
										</Link>
										<CardDescription>{form.description}</CardDescription>
									</div>
									<div className="flex items-center gap-2 pt-0.5">
										<Label
											htmlFor={`builtin-form-enabled-card-${form.key}`}
											className="text-solarized-base01 text-xs"
										>
											Aktiviert
										</Label>
										<Switch
											id={`builtin-form-enabled-card-${form.key}`}
											checked={form.override?.enabled ?? false}
											onCheckedChange={handleEnabledToggle}
											disabled={isTogglingCurrentForm}
										/>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-3 pt-0">
								<div className="grid gap-x-4 gap-y-2 rounded-md border border-solarized-base2/70 bg-solarized-base2/15 p-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
									<SectionLabelWithInfo info={FIELD_EXPLANATIONS.prompt}>
										Basis-Prompt
									</SectionLabelWithInfo>
									<span
										className={`min-w-0 break-words ${
											isPromptAvailable ? "text-solarized-base00" : "text-solarized-base01"
										}`}
									>
										{promptHarnessLabel}
										{isPromptAvailable ? "" : " (nicht verfügbar)"}
									</span>

									<SectionLabelWithInfo info={FIELD_EXPLANATIONS.template}>
										Template
									</SectionLabelWithInfo>
									<span className="min-w-0 break-words">
										{form.override?.template ? (
											<Link
												href={`/templates/${form.override.template.id}`}
												target="_blank"
												rel="noreferrer"
												className="inline-flex max-w-full items-center gap-1.5 underline underline-offset-4 hover:text-solarized-cyan"
											>
												<span className="break-words">{form.override.template.title}</span>
												<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
											</Link>
										) : (
											"Keins"
										)}
									</span>
								</div>
								<div className="flex justify-end">
									<Button onClick={handleOpenEditClick} size="sm" variant="outline">
										Konfigurieren
									</Button>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>
							{draft ? `Standardmodus bearbeiten: ${draft.title}` : "Standardmodus bearbeiten"}
						</DialogTitle>
						<DialogDescription>
							Wenn deaktiviert, nutzt der Modus wieder das hardcoded Standardverhalten.
						</DialogDescription>
					</DialogHeader>

					{draft ? (
						<div className="space-y-5 py-2">
							<div className="space-y-1">
								<Label>Route</Label>
								<p className="font-mono text-solarized-base01 text-xs">{draft.path}</p>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<LabelWithInfo info={FIELD_EXPLANATIONS.prompt}>Basis-Prompt</LabelWithInfo>
									<Select
										value={draft.promptHarness}
										onValueChange={handleDraftPromptHarnessChange}
									>
										<SelectTrigger>
											<SelectValue placeholder="Basis-Prompt wählen" />
										</SelectTrigger>
										<SelectContent>
											{hasUnavailableDraftPrompt ? (
												<SelectItem value={draft.promptHarness}>
													{draft.promptHarness} (nicht verfügbar)
												</SelectItem>
											) : null}
											{promptHarnessOptions.map((promptHarness) => (
												<SelectItem key={promptHarness.id} value={promptHarness.id}>
													{promptHarness.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<LabelWithInfo info={FIELD_EXPLANATIONS.template}>Template</LabelWithInfo>
									<TemplateSelector
										noneValue={NONE_VALUE}
										onValueChange={handleDraftTemplateChange}
										templates={templates}
										value={draft.templateId}
									/>
								</div>

								<div className="flex items-center justify-between pt-2 md:col-span-2">
									<Label htmlFor="builtin-form-enabled">Override aktivieren</Label>
									<Switch
										id="builtin-form-enabled"
										checked={draft.enabled}
										onCheckedChange={handleDraftEnabledChange}
									/>
								</div>
							</div>
						</div>
					) : null}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setDialogOpen(false);
							}}
							disabled={saveMutation.isPending}
						>
							Abbrechen
						</Button>
						<Button
							onClick={handleSaveDraft}
							disabled={saveMutation.isPending || !draft?.promptHarness}
						>
							{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Speichern
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
