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
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { LabelWithInfo, SectionLabelWithInfo } from "@/app/_components/ai-text-forms/info-labels";
import { TemplateSelector } from "@/app/_components/template-selector";
import { DEFAULT_AI_TEXT_DESCRIPTION, slugifyAiScribeFormName } from "@/lib/ai-scribe-forms";
import { orpc } from "@/lib/orpc";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

import { BuiltInScribeModesSection } from "./built-in-scribe-modes-section";

const NONE_VALUE = "__none__";
const FIELD_EXPLANATIONS = {
	prompt:
		"Der Basis-Prompt ist das Prompt-Harness, das Inhalt, Ton und Struktur der Generierung vorgibt.",
	template:
		"Das Template gibt Stil, Format und Zielstruktur des erzeugten Textes vor. Eigene und favorisierte Templates können ebenfalls ausgewählt werden.",
} as const;

type ScribeFormList = Awaited<ReturnType<typeof orpc.admin.scribeForms.list.call>>;
type ScribeFormRecord = ScribeFormList[number];

interface FormDraft {
	description: string;
	enabled: boolean;
	id?: string;
	name: string;
	promptHarness: PromptHarnessId | "";
	slug?: string;
	templateId: string;
}

const createEmptyDraft = (): FormDraft => ({
	description: "",
	enabled: true,
	name: "",
	promptHarness: "",
	templateId: NONE_VALUE,
});

const toDraft = (form: ScribeFormRecord): FormDraft => ({
	description: form.description ?? "",
	enabled: form.enabled,
	id: form.id,
	name: form.name,
	promptHarness: form.promptHarness as PromptHarnessId,
	slug: form.slug,
	templateId: form.templateId ?? NONE_VALUE,
});

const toNullableSelectValue = (value: string): string | null =>
	value === NONE_VALUE ? null : value;

const resolveDraftSlug = (draft: Pick<FormDraft, "id" | "name" | "slug">): string =>
	draft.id ? (draft.slug?.trim() ?? "") : slugifyAiScribeFormName(draft.name);

const buildFormMutationInput = ({
	description,
	enabled,
	name,
	promptHarness,
	slug,
	templateId,
}: {
	description: string | null;
	enabled: boolean;
	name: string;
	promptHarness: PromptHarnessId;
	slug: string;
	templateId: string | null;
}) => ({
	description: description?.trim() || null,
	enabled,
	name: name.trim(),
	promptHarness,
	slug,
	templateId,
});

export const ScribeFormsTab = () => {
	const queryClient = useQueryClient();
	const formsQueryOptions = orpc.admin.scribeForms.list.queryOptions();
	const promptsQueryOptions = orpc.admin.scribe.prompts.list.queryOptions({
		input: { limit: 200 },
	});
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();

	const {
		data: forms = [],
		isLoading: isFormsLoading,
		error: formsError,
	} = useQuery(formsQueryOptions);
	const { data: prompts } = useQuery(promptsQueryOptions);
	const { data: templates = [] } = useQuery(templatesQueryOptions);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState<FormDraft>(createEmptyDraft());
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const listKey = formsQueryOptions.queryKey;
	const resolvedDraftSlug = resolveDraftSlug(draft);
	const routePreview = `/aiscribe/custom/${resolvedDraftSlug || "ai-text"}`;
	const promptHarnessOptions: { id: string; label: string }[] =
		prompts?.options ??
		prompts?.items.map((promptName) => ({ id: promptName, label: promptName })) ??
		[];
	const availablePromptNames = new Set<string>(promptHarnessOptions.map((option) => option.id));
	const promptHarnessLabelById = new Map<string, string>(
		promptHarnessOptions.map((option) => [option.id, option.label]),
	);
	const hasUnavailableDraftPrompt =
		Boolean(draft.promptHarness) && !availablePromptNames.has(draft.promptHarness);
	const saveMutation = useMutation({
		mutationFn: (currentDraft: FormDraft) => {
			const trimmedName = currentDraft.name.trim();
			const slug = resolveDraftSlug(currentDraft);

			if (!trimmedName) {
				throw new Error("Bitte Namen eingeben");
			}

			if (!currentDraft.promptHarness) {
				throw new Error("Bitte Basis-Prompt auswählen");
			}

			if (!slug) {
				throw new Error("Aus dem Namen konnte kein gültiger Pfad erzeugt werden");
			}

			const payload = buildFormMutationInput({
				description: currentDraft.description,
				enabled: currentDraft.enabled,
				name: trimmedName,
				promptHarness: currentDraft.promptHarness,
				slug,
				templateId: toNullableSelectValue(currentDraft.templateId),
			});

			if (currentDraft.id) {
				return orpc.admin.scribeForms.update.call({
					id: currentDraft.id,
					...payload,
				});
			}

			return orpc.admin.scribeForms.create.call(payload);
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("AI Text gespeichert");
			setDialogOpen(false);
			setDraft(createEmptyDraft());
			setPendingDeleteId(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.admin.scribeForms.delete.call({ id }),
		onError: (error) => {
			setPendingDeleteId(null);
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			setPendingDeleteId(null);
			toast.success("AI Text gelöscht");
		},
	});

	const toggleEnabledMutation = useMutation({
		mutationFn: ({ enabled, form }: { enabled: boolean; form: ScribeFormRecord }) =>
			orpc.admin.scribeForms.update.call({
				id: form.id,
				...buildFormMutationInput({
					description: form.description,
					enabled,
					name: form.name,
					promptHarness: form.promptHarness as PromptHarnessId,
					slug: form.slug,
					templateId: form.templateId,
				}),
			}),
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
		},
	});

	const handleOpenCreate = useCallback(() => {
		setDraft(createEmptyDraft());
		setPendingDeleteId(null);
		setDialogOpen(true);
	}, []);

	const handleOpenEdit = useCallback((form: ScribeFormRecord) => {
		setDraft(toDraft(form));
		setPendingDeleteId(null);
		setDialogOpen(true);
	}, []);

	const handlePendingDeleteCancel = useCallback(() => {
		setPendingDeleteId(null);
	}, []);

	const handleDialogClose = useCallback(() => {
		setDialogOpen(false);
	}, []);

	const handleDraftNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setDraft((current) => ({
			...current,
			name: event.target.value,
		}));
	}, []);

	const handleDraftDescriptionChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setDraft((current) => ({
			...current,
			description: event.target.value,
		}));
	}, []);

	const handleDraftPromptHarnessChange = useCallback((value: string) => {
		setDraft((current) => ({
			...current,
			promptHarness: value as PromptHarnessId,
		}));
	}, []);

	const handleDraftTemplateChange = useCallback((value: string) => {
		setDraft((current) => ({ ...current, templateId: value }));
	}, []);

	const handleDraftEnabledChange = useCallback((checked: boolean) => {
		setDraft((current) => ({ ...current, enabled: checked }));
	}, []);

	const handleSaveDraft = useCallback(() => {
		saveMutation.mutate(draft);
	}, [draft, saveMutation]);

	const formEnabledToggleHandlers = useMemo(() => {
		const handlers = new Map<string, (checked: boolean) => void>();
		for (const form of forms) {
			handlers.set(form.id, (checked: boolean) => {
				toggleEnabledMutation.mutate({
					enabled: checked,
					form,
				});
			});
		}
		return handlers;
	}, [forms, toggleEnabledMutation]);

	const openEditHandlers = useMemo(() => {
		const handlers = new Map<string, () => void>();
		for (const form of forms) {
			handlers.set(form.id, () => {
				handleOpenEdit(form);
			});
		}
		return handlers;
	}, [forms, handleOpenEdit]);

	const confirmDeleteHandlers = useMemo(() => {
		const handlers = new Map<string, () => void>();
		for (const form of forms) {
			handlers.set(form.id, () => {
				deleteMutation.mutate(form.id);
			});
		}
		return handlers;
	}, [deleteMutation, forms]);

	const requestDeleteHandlers = useMemo(() => {
		const handlers = new Map<string, () => void>();
		for (const form of forms) {
			handlers.set(form.id, () => {
				setPendingDeleteId(form.id);
			});
		}
		return handlers;
	}, [forms]);

	if (isFormsLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
			</div>
		);
	}

	if (formsError) {
		return (
			<Card className="border-solarized-red/20 bg-solarized-red/10">
				<CardContent className="p-4 text-center text-solarized-red text-sm">
					{formsError instanceof Error
						? formsError.message
						: "Fehler beim Laden der AI Textbausteine"}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<BuiltInScribeModesSection />

			<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/40">
				<CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<div className="rounded-lg bg-solarized-cyan/10 p-2 text-solarized-cyan">
								<FileText className="h-4 w-4" />
							</div>
							<CardTitle>AI Textbausteine</CardTitle>
						</div>
						<CardDescription>
							Zusätzliche AIScribe-Texte mit festem klinischem Kontext (Diagnoseblock, Anamnese,
							Befunde und Notizen).
						</CardDescription>
					</div>
					<Button onClick={handleOpenCreate} size="sm">
						<Plus className="mr-1.5 h-4 w-4" />
						Neuer AI Text
					</Button>
				</CardHeader>
			</Card>

			{forms.length === 0 ? (
				<Card className="border-solarized-base2 border-dashed bg-solarized-base3">
					<CardContent className="p-8 text-center text-solarized-base01 text-sm">
						Noch keine AI Textbausteine vorhanden.
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 xl:grid-cols-2">
					{forms.map((form) => {
						const isPromptAvailable = availablePromptNames.has(form.promptHarness);
						const promptHarnessLabel =
							promptHarnessLabelById.get(form.promptHarness) ?? form.promptHarness;
						const isDeleteConfirming = pendingDeleteId === form.id;
						const isDeletingCurrentForm = deleteMutation.isPending && isDeleteConfirming;
						const isTogglingCurrentForm =
							toggleEnabledMutation.isPending &&
							toggleEnabledMutation.variables?.form.id === form.id;
						const handleEnabledToggle = formEnabledToggleHandlers.get(form.id);
						const handleOpenEditClick = openEditHandlers.get(form.id);
						const handleConfirmDelete = confirmDeleteHandlers.get(form.id);
						const handleRequestDelete = requestDeleteHandlers.get(form.id);
						if (
							!handleEnabledToggle ||
							!handleOpenEditClick ||
							!handleConfirmDelete ||
							!handleRequestDelete
						) {
							return null;
						}

						return (
							<Card key={form.id} className="border-solarized-base2 bg-solarized-base3/80">
								<CardHeader className="space-y-2">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-1">
											{form.enabled ? (
												<Link
													href={`/aiscribe/custom/${form.slug}`}
													target="_blank"
													rel="noreferrer"
													className="inline-flex items-center gap-1.5 transition-colors hover:text-solarized-cyan"
												>
													<CardTitle className="text-base">{form.name}</CardTitle>
													<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
												</Link>
											) : (
												<CardTitle className="text-base">{form.name}</CardTitle>
											)}
											<CardDescription>
												{form.description ?? DEFAULT_AI_TEXT_DESCRIPTION}
											</CardDescription>
										</div>
										<div className="flex items-center gap-2 pt-0.5">
											<Label
												htmlFor={`scribe-form-enabled-card-${form.id}`}
												className="text-solarized-base01 text-xs"
											>
												Aktiviert
											</Label>
											<Switch
												id={`scribe-form-enabled-card-${form.id}`}
												checked={form.enabled}
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
										<div
											className={`min-w-0 break-words ${
												isPromptAvailable ? "text-solarized-base00" : "text-solarized-base01"
											}`}
										>
											{promptHarnessLabel}
											{isPromptAvailable ? "" : " (nicht verfügbar)"}
										</div>

										<SectionLabelWithInfo info={FIELD_EXPLANATIONS.template}>
											Template
										</SectionLabelWithInfo>
										<div className="min-w-0 break-words">
											{form.template ? (
												<Link
													href={`/templates/${form.template.id}`}
													target="_blank"
													rel="noreferrer"
													className="inline-flex max-w-full items-center gap-1.5 underline underline-offset-4 hover:text-solarized-cyan"
												>
													<span className="break-words">{form.template.title}</span>
													<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
												</Link>
											) : (
												"Keins"
											)}
										</div>
									</div>
									<div className="flex justify-end gap-2">
										<Button onClick={handleOpenEditClick} size="sm" variant="outline">
											Bearbeiten
										</Button>
										<div className="flex w-[176px] justify-end gap-2">
											{isDeleteConfirming ? (
												<>
													<Button
														onClick={handlePendingDeleteCancel}
														size="sm"
														variant="outline"
														disabled={deleteMutation.isPending}
													>
														Abbrechen
													</Button>
													<Button
														onClick={handleConfirmDelete}
														size="sm"
														variant="destructive"
														disabled={deleteMutation.isPending}
													>
														{isDeletingCurrentForm ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : null}
														Löschen
													</Button>
												</>
											) : (
												<>
													<div className="w-[80px]" />
													<Button
														onClick={handleRequestDelete}
														size="sm"
														variant="ghost"
														className="w-8 px-0"
														disabled={deleteMutation.isPending}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{draft.id ? "AI Text bearbeiten" : "Neuer AI Text"}</DialogTitle>
						<DialogDescription>
							Konfigurieren Sie einen zusätzlichen AI Textbaustein für die AIScribe-Übersicht.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-5 py-2">
						<div className="space-y-2">
							<Label htmlFor="scribe-form-name">Name</Label>
							<Input
								id="scribe-form-name"
								value={draft.name}
								onChange={handleDraftNameChange}
								placeholder="z. B. Echo-Befund"
							/>
							<p className="text-solarized-base01 text-xs">
								Pfad: <span className="font-mono">{routePreview}</span>
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="scribe-form-description">Kurzbeschreibung für `/aiscribe`</Label>
							<Textarea
								id="scribe-form-description"
								value={draft.description}
								onChange={handleDraftDescriptionChange}
								placeholder={DEFAULT_AI_TEXT_DESCRIPTION}
								className="min-h-24"
							/>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<LabelWithInfo info={FIELD_EXPLANATIONS.prompt}>Basis-Prompt</LabelWithInfo>
								<Select value={draft.promptHarness} onValueChange={handleDraftPromptHarnessChange}>
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
								<Label htmlFor="scribe-form-enabled">Aktiviert</Label>
								<Switch
									id="scribe-form-enabled"
									checked={draft.enabled}
									onCheckedChange={handleDraftEnabledChange}
								/>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={handleDialogClose} disabled={saveMutation.isPending}>
							Abbrechen
						</Button>
						<Button
							onClick={handleSaveDraft}
							disabled={
								saveMutation.isPending ||
								!draft.name.trim() ||
								!draft.promptHarness ||
								!resolvedDraftSlug
							}
						>
							{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Speichern
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
