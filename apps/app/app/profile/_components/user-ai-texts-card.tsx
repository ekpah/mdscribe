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
import { buildCustomFormPath } from "@/lib/aiscribe-paths";
import { useSession } from "@/lib/auth-client";
import { DEFAULT_AI_TEXT_DESCRIPTION, slugifyAiScribeFormName } from "@/lib/ai-scribe-forms";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

const NONE_VALUE = "__none__";
const FIELD_EXPLANATIONS = {
	prompt: "Der Basis-Prompt legt Inhalt, Ton und Struktur der Generierung fest.",
	template:
		"Das Template gibt Stil, Format und Zielstruktur des erzeugten Textes vor. Eigene und favorisierte Templates können ebenfalls ausgewählt werden.",
	visibility:
		"Öffentliche AI Vorlagen können alle Nutzer sehen und verwenden. Private AI Vorlagen sind eine Plus-Funktion.",
} as const;

type AiTextVisibility = "public" | "private";
type UserScribeFormEditorContext = Awaited<ReturnType<typeof orpc.scribeForms.editorContext.call>>;
type UserScribeFormList = Awaited<ReturnType<typeof orpc.scribeForms.list.call>>;
type UserScribeFormRecord = UserScribeFormList[number];

interface PromptHarnessOption {
	id: string;
	label: string;
}

interface FormDraft {
	description: string;
	enabled: boolean;
	id?: string;
	name: string;
	promptHarness: PromptHarnessId | "";
	slug?: string;
	templateId: string;
	visibility: AiTextVisibility;
}

const createEmptyDraft = (): FormDraft => ({
	description: "",
	enabled: true,
	name: "",
	promptHarness: "",
	templateId: NONE_VALUE,
	visibility: "public",
});

const toDraft = (form: UserScribeFormRecord): FormDraft => ({
	description: form.description ?? "",
	enabled: form.enabled,
	id: form.id,
	name: form.name,
	promptHarness: form.promptHarness as PromptHarnessId,
	slug: form.slug,
	templateId: form.templateId ?? NONE_VALUE,
	visibility: form.visibility === "private" ? "private" : "public",
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
	visibility,
}: {
	description: string | null;
	enabled: boolean;
	name: string;
	promptHarness: PromptHarnessId;
	slug: string;
	templateId: string | null;
	visibility: AiTextVisibility;
}) => ({
	description: description?.trim() || null,
	enabled,
	name: name.trim(),
	promptHarness,
	slug,
	templateId,
	visibility,
});

const getPromptHarnessOptions = (
	editorContext: UserScribeFormEditorContext | undefined,
): PromptHarnessOption[] =>
	editorContext?.promptHarnesses ??
	editorContext?.promptNames.map((promptName) => ({
		id: promptName,
		label: promptName,
	})) ??
	[];

const getSessionUsername = (
	session: { user?: { username?: string | null } } | null | undefined,
): string | null => session?.user?.username ?? null;

export const UserAiTextsCard = () => {
	const queryClient = useQueryClient();
	const sessionQuery = useSession();
	const username = getSessionUsername(sessionQuery.data);
	const formsQueryOptions = orpc.scribeForms.list.queryOptions();
	const editorContextQueryOptions = orpc.scribeForms.editorContext.queryOptions();
	const {
		data: forms = [],
		error: formsError,
		isLoading: isFormsLoading,
	} = useQuery(formsQueryOptions);
	const { data: editorContext } = useQuery(editorContextQueryOptions);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState<FormDraft>(createEmptyDraft());
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const listKey = formsQueryOptions.queryKey;
	const availableFormsKey = orpc.scribeForms.listAvailable.queryOptions().queryKey;
	const workspaceEditorContextKey =
		orpc.scribeWorkspaces.editorContext.queryOptions().queryKey;
	const resolvedDraftSlug = resolveDraftSlug(draft);
	const routePreview = buildCustomFormPath(
		resolvedDraftSlug || "ai-text",
		username,
	);
	const promptHarnessOptions = getPromptHarnessOptions(editorContext);
	const templates = editorContext?.templates ?? [];
	const canCreatePrivateAiScribeForms = Boolean(editorContext?.canCreatePrivateAiScribeForms);
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
				visibility: currentDraft.visibility,
			});

			if (currentDraft.id) {
				return orpc.scribeForms.update.call({
					id: currentDraft.id,
					...payload,
				});
			}

			return orpc.scribeForms.create.call(payload);
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({ queryKey: availableFormsKey }),
				queryClient.invalidateQueries({ queryKey: workspaceEditorContextKey }),
			]);
			toast.success("AI Vorlage gespeichert");
			setDialogOpen(false);
			setDraft(createEmptyDraft());
			setPendingDeleteId(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.scribeForms.delete.call({ id }),
		onError: (error) => {
			setPendingDeleteId(null);
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({ queryKey: availableFormsKey }),
				queryClient.invalidateQueries({ queryKey: workspaceEditorContextKey }),
			]);
			setPendingDeleteId(null);
			toast.success("AI Vorlage gelöscht");
		},
	});

	const toggleEnabledMutation = useMutation({
		mutationFn: ({ enabled, form }: { enabled: boolean; form: UserScribeFormRecord }) =>
			orpc.scribeForms.update.call({
				id: form.id,
				...buildFormMutationInput({
					description: form.description,
					enabled,
					name: form.name,
					promptHarness: form.promptHarness as PromptHarnessId,
					slug: form.slug,
					templateId: form.templateId,
					visibility: form.visibility === "private" ? "private" : "public",
				}),
			}),
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSettled: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({ queryKey: availableFormsKey }),
				queryClient.invalidateQueries({ queryKey: workspaceEditorContextKey }),
			]);
		},
	});

	const handleOpenCreate = useCallback(() => {
		setDraft(createEmptyDraft());
		setPendingDeleteId(null);
		setDialogOpen(true);
	}, []);

	const handleOpenEdit = useCallback((form: UserScribeFormRecord) => {
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

	const handleDraftVisibilityChange = useCallback(
		(value: string) => {
			if (value === "private" && !canCreatePrivateAiScribeForms) {
				toast.error(USER_MESSAGES.privateAiScribeFormRequiresPlus);
				return;
			}

			setDraft((current) => ({
				...current,
				visibility: value === "private" ? "private" : "public",
			}));
		},
		[canCreatePrivateAiScribeForms],
	);

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
			<Card>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
				</CardContent>
			</Card>
		);
	}

	if (formsError) {
		return (
			<Card className="border-solarized-red/20 bg-solarized-red/10">
				<CardContent className="p-4 text-center text-solarized-red text-sm">
					{formsError instanceof Error
						? formsError.message
						: "Fehler beim Laden der AI Vorlagen"}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-solarized-cyan/10 p-2 text-solarized-cyan">
							<FileText className="h-4 w-4" />
						</div>
						<CardTitle>AI Vorlagen</CardTitle>
					</div>
					<CardDescription>
						Personalisiere die Vorlagen, um mit dem AIScribe noch bessere Dokumentation zu erstellen
					</CardDescription>
				</div>
				<Button onClick={handleOpenCreate} size="sm" type="button">
					<Plus className="mr-1.5 h-4 w-4" />
					Neue AI Vorlage
				</Button>
			</CardHeader>

			<CardContent className="space-y-4">
				{forms.length === 0 ? (
					<div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
						Noch keine AI Vorlagen vorhanden.
					</div>
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
								<div
									key={form.id}
									className="rounded-lg border border-solarized-base2 bg-solarized-base3/80"
								>
									<div className="space-y-2 p-6 pb-3">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 space-y-1">
												{form.enabled ? (
													<Link
														className="inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-solarized-cyan"
														href={buildCustomFormPath(form.slug, username)}
														rel="noreferrer"
														target="_blank"
													>
														<CardTitle className="truncate text-base">{form.name}</CardTitle>
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
													className="text-solarized-base01 text-xs"
													htmlFor={`user-scribe-form-enabled-card-${form.id}`}
												>
													Aktiviert
												</Label>
												<Switch
													checked={form.enabled}
													disabled={isTogglingCurrentForm}
													id={`user-scribe-form-enabled-card-${form.id}`}
													onCheckedChange={handleEnabledToggle}
												/>
											</div>
										</div>
									</div>
									<div className="space-y-3 p-6 pt-0">
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
														className="inline-flex max-w-full items-center gap-1.5 underline underline-offset-4 hover:text-solarized-cyan"
														href={`/templates/${form.template.id}`}
														rel="noreferrer"
														target="_blank"
													>
														<span className="break-words">{form.template.title}</span>
														<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
													</Link>
												) : (
													"Keins"
												)}
											</div>

											<SectionLabelWithInfo info={FIELD_EXPLANATIONS.visibility}>
												Sichtbarkeit
											</SectionLabelWithInfo>
											<div className="min-w-0 break-words">
												{form.visibility === "private" ? "Privat" : "Öffentlich"}
											</div>
										</div>
										<div className="flex justify-end gap-2">
											<Button
												onClick={handleOpenEditClick}
												size="sm"
												type="button"
												variant="outline"
											>
												Bearbeiten
											</Button>
											<div className="flex w-[176px] justify-end gap-2">
												{isDeleteConfirming ? (
													<>
														<Button
															disabled={deleteMutation.isPending}
															onClick={handlePendingDeleteCancel}
															size="sm"
															type="button"
															variant="outline"
														>
															Abbrechen
														</Button>
														<Button
															disabled={deleteMutation.isPending}
															onClick={handleConfirmDelete}
															size="sm"
															type="button"
															variant="destructive"
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
															className="w-8 px-0"
															disabled={deleteMutation.isPending}
															onClick={handleRequestDelete}
															size="sm"
															type="button"
															variant="ghost"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>{draft.id ? "AI Vorlage bearbeiten" : "Neue AI Vorlage"}</DialogTitle>
							<DialogDescription>
								Konfigurieren Sie eine persönliche AI Vorlage für AIScribe.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-5 py-2">
							<div className="space-y-2">
								<Label htmlFor="user-scribe-form-name">Name</Label>
								<Input
									id="user-scribe-form-name"
									onChange={handleDraftNameChange}
									placeholder="z. B. Echo-Befund"
									value={draft.name}
								/>
								<p className="text-solarized-base01 text-xs">
									Pfad: <span className="font-mono">{routePreview}</span>
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="user-scribe-form-description">
									Kurzbeschreibung für `/aiscribe`
								</Label>
								<Textarea
									className="min-h-24"
									id="user-scribe-form-description"
									onChange={handleDraftDescriptionChange}
									placeholder={DEFAULT_AI_TEXT_DESCRIPTION}
									value={draft.description}
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<LabelWithInfo info={FIELD_EXPLANATIONS.prompt}>Basis-Prompt</LabelWithInfo>
									<Select
										onValueChange={handleDraftPromptHarnessChange}
										value={draft.promptHarness}
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

								<div className="space-y-2">
									<LabelWithInfo info={FIELD_EXPLANATIONS.visibility}>Sichtbarkeit</LabelWithInfo>
									<Select onValueChange={handleDraftVisibilityChange} value={draft.visibility}>
										<SelectTrigger id="user-scribe-form-visibility">
											<SelectValue placeholder="Sichtbarkeit wählen" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="public">Öffentlich</SelectItem>
											<SelectItem disabled={!canCreatePrivateAiScribeForms} value="private">
												Privat
											</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-solarized-base01 text-xs">
										{draft.visibility === "public"
											? USER_MESSAGES.publicAiScribeFormVisibilityWarning
											: "Privat: Nur Sie können diese AI Vorlage sehen und verwenden."}
									</p>
								</div>

								<div className="flex items-center justify-between pt-2">
									<Label htmlFor="user-scribe-form-enabled">Aktiviert</Label>
									<Switch
										checked={draft.enabled}
										id="user-scribe-form-enabled"
										onCheckedChange={handleDraftEnabledChange}
									/>
								</div>
							</div>
						</div>

						<DialogFooter>
							<Button
								disabled={saveMutation.isPending}
								onClick={handleDialogClose}
								type="button"
								variant="outline"
							>
								Abbrechen
							</Button>
							<Button
								disabled={
									saveMutation.isPending ||
									!draft.name.trim() ||
									!draft.promptHarness ||
									!resolvedDraftSlug
								}
								onClick={handleSaveDraft}
								type="button"
							>
								{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Speichern
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
};
