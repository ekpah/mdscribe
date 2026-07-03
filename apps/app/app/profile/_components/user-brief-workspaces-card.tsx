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
import { Blocks, ExternalLinkIcon, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { LabelWithInfo, SectionLabelWithInfo } from "@/app/_components/ai-text-forms/info-labels";
import { buildWorkspacePath } from "@/lib/aiscribe-paths";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";
import { getPromptHarnessTargetField } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

const DEFAULT_VALUE = "__default__";

type Visibility = "public" | "private";
type FormFieldKey = "diagnosisFormId" | "anamneseFormId" | "epikriseFormId";
type WorkspaceRecord = Awaited<ReturnType<typeof orpc.scribeWorkspaces.list.call>>[number];
type WorkspaceEditorContext = Awaited<
	ReturnType<typeof orpc.scribeWorkspaces.editorContext.call>
>;
type FormRecord = WorkspaceEditorContext["forms"][number];

const EMPTY_FORMS: FormRecord[] = [];

const FORM_FIELDS: { key: FormFieldKey; label: string; harness: PromptHarnessId }[] =
	[
		{ harness: "diagnosis", key: "diagnosisFormId", label: "Diagnosen" },
		{ harness: "anamnese", key: "anamneseFormId", label: "Anamnese" },
		{ harness: "epikrise", key: "epikriseFormId", label: "Epikrise" },
	];

const FIELD_EXPLANATIONS = {
	sections:
		"Jeder Abschnitt kann eine passende AI Vorlage verwenden. Ohne Auswahl nutzt der Abschnitt die Standard-Vorlage.",
	visibility:
		"Öffentliche Brief-Baukästen können alle Nutzer sehen und verwenden. Private Brief-Baukästen sind eine Plus-Funktion.",
} as const;

interface WorkspaceDraft {
	anamneseFormId: string;
	description: string;
	diagnosisFormId: string;
	enabled: boolean;
	epikriseFormId: string;
	id?: string;
	name: string;
	visibility: Visibility;
}

const createEmptyDraft = (): WorkspaceDraft => ({
	anamneseFormId: "",
	description: "",
	diagnosisFormId: "",
	enabled: true,
	epikriseFormId: "",
	name: "",
	visibility: "public",
});

const toDraft = (workspace: WorkspaceRecord): WorkspaceDraft => ({
	anamneseFormId: workspace.anamneseFormId ?? "",
	description: workspace.description ?? "",
	diagnosisFormId: workspace.diagnosisFormId ?? "",
	enabled: workspace.enabled,
	epikriseFormId: workspace.epikriseFormId ?? "",
	id: workspace.id,
	name: workspace.name,
	visibility: workspace.visibility === "private" ? "private" : "public",
});

const getSessionUsername = (
	session: { user?: { username?: string | null } } | null | undefined,
): string | null => session?.user?.username ?? null;

const buildWorkspaceMutationInput = (draft: WorkspaceDraft) => ({
	anamneseFormId: draft.anamneseFormId,
	description: draft.description.trim() || null,
	diagnosisFormId: draft.diagnosisFormId,
	enabled: draft.enabled,
	epikriseFormId: draft.epikriseFormId,
	name: draft.name.trim(),
	visibility: draft.visibility,
});

export const UserBriefWorkspacesCard = () => {
	const queryClient = useQueryClient();
	const sessionQuery = useSession();
	const username = getSessionUsername(sessionQuery.data);
	const listQueryOptions = orpc.scribeWorkspaces.list.queryOptions();
	const editorContextQueryOptions = orpc.scribeWorkspaces.editorContext.queryOptions();
	const {
		data: workspaces = [],
		error,
		isLoading,
	} = useQuery(listQueryOptions);
	const { data: editorContext } = useQuery({
		...editorContextQueryOptions,
		refetchInterval: 30_000,
	});

	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState<WorkspaceDraft>(createEmptyDraft());
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const canCreatePrivateAiScribeForms = Boolean(editorContext?.canCreatePrivateAiScribeForms);
	const forms = editorContext?.forms ?? EMPTY_FORMS;
	const listKey = listQueryOptions.queryKey;
	const formNameById = useMemo(
		() => new Map(forms.map((form) => [form.id, form.name])),
		[forms],
	);
	const routePreview = draft.id
		? buildWorkspacePath(workspaces.find((workspace) => workspace.id === draft.id)?.slug ?? "", username)
		: "Pfad wird beim Speichern erzeugt";

	const formsByField = useMemo(() => {
		const map = new Map<FormFieldKey, FormRecord[]>();
		for (const field of FORM_FIELDS) {
			const target = getPromptHarnessTargetField(field.harness);
			map.set(
				field.key,
				forms.filter(
					(form) => getPromptHarnessTargetField(form.promptHarness as PromptHarnessId) === target,
				),
			);
		}
		return map;
	}, [forms]);

	const saveMutation = useMutation({
		mutationFn: (currentDraft: WorkspaceDraft) => {
			if (!currentDraft.name.trim()) {
				throw new Error("Bitte Namen eingeben");
			}
			const payload = buildWorkspaceMutationInput(currentDraft);
			if (currentDraft.id) {
				return orpc.scribeWorkspaces.update.call({
					id: currentDraft.id,
					...payload,
				});
			}
			return orpc.scribeWorkspaces.create.call(payload);
		},
		onError: (mutationError) => {
			toast.error(mutationError instanceof Error ? mutationError.message : "Fehler");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await queryClient.invalidateQueries({
				queryKey: orpc.scribeWorkspaces.listAvailable.queryOptions().queryKey,
			});
			toast.success("Brief-Baukasten gespeichert");
			setDialogOpen(false);
			setDraft(createEmptyDraft());
			setPendingDeleteId(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.scribeWorkspaces.delete.call({ id }),
		onError: (mutationError) => {
			setPendingDeleteId(null);
			toast.error(mutationError instanceof Error ? mutationError.message : "Fehler");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await queryClient.invalidateQueries({
				queryKey: orpc.scribeWorkspaces.listAvailable.queryOptions().queryKey,
			});
			setPendingDeleteId(null);
			toast.success("Brief-Baukasten gelöscht");
		},
	});

	const toggleEnabledMutation = useMutation({
		mutationFn: ({ enabled, workspace }: { enabled: boolean; workspace: WorkspaceRecord }) =>
			orpc.scribeWorkspaces.update.call({
				id: workspace.id,
				...buildWorkspaceMutationInput({
					anamneseFormId: workspace.anamneseFormId ?? "",
					description: workspace.description ?? "",
					diagnosisFormId: workspace.diagnosisFormId ?? "",
					enabled,
					epikriseFormId: workspace.epikriseFormId ?? "",
					name: workspace.name,
					visibility: workspace.visibility === "private" ? "private" : "public",
				}),
			}),
		onError: (mutationError) => {
			toast.error(mutationError instanceof Error ? mutationError.message : "Fehler");
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await queryClient.invalidateQueries({
				queryKey: orpc.scribeWorkspaces.listAvailable.queryOptions().queryKey,
			});
		},
	});

	const handleOpenCreate = useCallback(() => {
		setDraft(createEmptyDraft());
		setPendingDeleteId(null);
		setDialogOpen(true);
	}, []);

	const handleOpenEdit = useCallback((workspace: WorkspaceRecord) => {
		setDraft(toDraft(workspace));
		setPendingDeleteId(null);
		setDialogOpen(true);
	}, []);

	const handleDraftVisibilityChange = useCallback(
		(value: string) => {
			if (value === "private" && !canCreatePrivateAiScribeForms) {
				toast.error(USER_MESSAGES.privateAiScribeWorkspaceRequiresPlus);
				return;
			}

			setDraft((current) => ({
				...current,
				visibility: value === "private" ? "private" : "public",
			}));
		},
		[canCreatePrivateAiScribeForms],
	);

	const handleDraftFieldChange = useCallback((key: FormFieldKey, value: string) => {
		setDraft((current) => ({
			...current,
			[key]: value === DEFAULT_VALUE ? "" : value,
		}));
	}, []);

	const handleSaveDraft = useCallback(() => {
		saveMutation.mutate(draft);
	}, [draft, saveMutation]);

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className="border-solarized-red/20 bg-solarized-red/10">
				<CardContent className="p-4 text-center text-sm text-solarized-red">
					Fehler beim Laden der Brief-Baukästen
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-solarized-violet/10 p-2 text-solarized-violet">
							<Blocks className="h-4 w-4" />
						</div>
						<CardTitle>Brief-Baukästen</CardTitle>
					</div>
					<CardDescription>
						Stelle eigene Arztbrief-Editoren aus mehreren AI Vorlagen zusammen.
					</CardDescription>
				</div>
				<Button onClick={handleOpenCreate} size="sm" type="button">
					<Plus className="mr-1.5 h-4 w-4" />
					Neuer Brief-Baukasten
				</Button>
			</CardHeader>

			<CardContent className="space-y-4">
				{workspaces.length === 0 ? (
					<div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
						Noch keine Brief-Baukästen vorhanden.
					</div>
				) : (
					<div className="grid gap-4 xl:grid-cols-2">
						{workspaces.map((workspace) => {
							const isDeleteConfirming = pendingDeleteId === workspace.id;
							const isDeletingCurrent = deleteMutation.isPending && isDeleteConfirming;
							const isTogglingCurrent =
								toggleEnabledMutation.isPending &&
								toggleEnabledMutation.variables?.workspace.id === workspace.id;
							return (
								<div
									className="rounded-lg border border-solarized-base2 bg-solarized-base3/80"
									key={workspace.id}
								>
									<div className="space-y-2 p-6 pb-3">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 space-y-1">
												{workspace.enabled ? (
													<Link
														className="inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-solarized-violet"
														href={buildWorkspacePath(workspace.slug, username)}
														rel="noreferrer"
														target="_blank"
													>
														<CardTitle className="truncate text-base">{workspace.name}</CardTitle>
														<ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
													</Link>
												) : (
													<CardTitle className="text-base">{workspace.name}</CardTitle>
												)}
												<CardDescription>
													{workspace.description ??
														"Aus AI Vorlagen zusammengestellter Arztbrief-Editor."}
												</CardDescription>
											</div>
											<div className="flex items-center gap-2 pt-0.5">
												<Label
													className="text-solarized-base01 text-xs"
													htmlFor={`user-workspace-enabled-${workspace.id}`}
												>
													Aktiviert
												</Label>
												<Switch
													checked={workspace.enabled}
													disabled={isTogglingCurrent}
													id={`user-workspace-enabled-${workspace.id}`}
													onCheckedChange={(enabled) => {
														toggleEnabledMutation.mutate({ enabled, workspace });
													}}
												/>
											</div>
										</div>
									</div>
									<div className="space-y-3 p-6 pt-0">
										<div className="grid gap-x-4 gap-y-2 rounded-md border border-solarized-base2/70 bg-solarized-base2/15 p-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
											<SectionLabelWithInfo info={FIELD_EXPLANATIONS.sections}>
												Abschnitte
											</SectionLabelWithInfo>
											<div className="space-y-1">
												{FORM_FIELDS.map((field) => (
													<div className="flex gap-2" key={field.key}>
														<span className="w-24 shrink-0 text-solarized-base01">
															{field.label}
														</span>
														<span>
															{formNameById.get(workspace[field.key] ?? "") ??
																"Standard-Vorlage"}
														</span>
													</div>
												))}
												<div className="flex gap-2">
													<span className="w-24 shrink-0 text-solarized-base01">Befunde</span>
													<span>Standard-Vorlage</span>
												</div>
											</div>

											<SectionLabelWithInfo info={FIELD_EXPLANATIONS.visibility}>
												Sichtbarkeit
											</SectionLabelWithInfo>
											<div>{workspace.visibility === "private" ? "Privat" : "Öffentlich"}</div>
										</div>
										<div className="flex justify-end gap-2">
											<Button
												onClick={() => {
													handleOpenEdit(workspace);
												}}
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
															onClick={() => {
																setPendingDeleteId(null);
															}}
															size="sm"
															type="button"
															variant="outline"
														>
															Abbrechen
														</Button>
														<Button
															disabled={deleteMutation.isPending}
															onClick={() => {
																deleteMutation.mutate(workspace.id);
															}}
															size="sm"
															type="button"
															variant="destructive"
														>
															{isDeletingCurrent ? (
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
															onClick={() => {
																setPendingDeleteId(workspace.id);
															}}
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
					<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>
								{draft.id ? "Brief-Baukasten bearbeiten" : "Neuer Brief-Baukasten"}
							</DialogTitle>
							<DialogDescription>
								Wähle pro Abschnitt die zugrunde liegende AI Vorlage. Befunde verwendet
								vorerst die Standard-Vorlage.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-5 py-2">
							<div className="space-y-2">
								<Label htmlFor="user-workspace-name">Name</Label>
								<Input
									id="user-workspace-name"
									onChange={(event: ChangeEvent<HTMLInputElement>) => {
										setDraft((current) => ({ ...current, name: event.target.value }));
									}}
									placeholder="z. B. Ambulanz-Brief"
									value={draft.name}
								/>
								<p className="text-solarized-base01 text-xs">
									Pfad: <span className="font-mono">{routePreview}</span>
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="user-workspace-description">Kurzbeschreibung</Label>
								<Textarea
									id="user-workspace-description"
									onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
										setDraft((current) => ({
											...current,
											description: event.target.value,
										}));
									}}
									placeholder="Kurzbeschreibung des Editors"
									value={draft.description}
								/>
							</div>

							<div className="flex items-center justify-between">
								<Label htmlFor="user-workspace-enabled">Aktiviert</Label>
								<Switch
									checked={draft.enabled}
									id="user-workspace-enabled"
									onCheckedChange={(enabled) => {
										setDraft((current) => ({ ...current, enabled }));
									}}
								/>
							</div>

							<div className="space-y-2">
								<LabelWithInfo info={FIELD_EXPLANATIONS.visibility}>Sichtbarkeit</LabelWithInfo>
								<Select onValueChange={handleDraftVisibilityChange} value={draft.visibility}>
									<SelectTrigger id="user-workspace-visibility">
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
										? USER_MESSAGES.publicAiScribeWorkspaceVisibilityWarning
										: "Privat: Nur Sie können diesen Brief-Baukasten sehen und verwenden."}
								</p>
							</div>

							<div className="space-y-3">
								<LabelWithInfo info={FIELD_EXPLANATIONS.sections}>Abschnitte</LabelWithInfo>
								{FORM_FIELDS.map((field) => {
									const fieldForms = formsByField.get(field.key) ?? [];
									return (
										<div className="space-y-1.5" key={field.key}>
											<Label className="text-xs" htmlFor={`user-workspace-${field.key}`}>
												{field.label}
											</Label>
											<Select
												onValueChange={(value) => {
													handleDraftFieldChange(field.key, value);
												}}
												value={draft[field.key] || DEFAULT_VALUE}
											>
												<SelectTrigger id={`user-workspace-${field.key}`}>
													<SelectValue placeholder="Standard-Vorlage" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={DEFAULT_VALUE}>Standard-Vorlage</SelectItem>
													{fieldForms.map((form) => (
														<SelectItem key={form.id} value={form.id}>
															{form.name}
															{form.authorId ? "" : " · MDScribe"}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									);
								})}
							</div>
						</div>

						<DialogFooter>
							<Button
								disabled={saveMutation.isPending}
								onClick={() => {
									setDialogOpen(false);
								}}
								type="button"
								variant="outline"
							>
								Abbrechen
							</Button>
							<Button
								disabled={saveMutation.isPending || !draft.name.trim()}
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
