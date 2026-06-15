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
import { Blocks, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { getPromptHarnessTargetField } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

type WorkspaceRecord = Awaited<
	ReturnType<typeof orpc.admin.aiScribeWorkspaces.list.call>
>[number];
type FormRecord = Awaited<
	ReturnType<typeof orpc.admin.scribeForms.list.call>
>[number];

// Sentinel for "no form selected" → the section uses the standard template.
const DEFAULT_VALUE = "__default__";

type FormFieldKey = "diagnosisFormId" | "anamneseFormId" | "epikriseFormId";

// One field per prompt-harness section; each slot only accepts forms whose
// harness targets that section. Befunde stays on the default for now.
const FORM_FIELDS: { key: FormFieldKey; label: string; harness: PromptHarnessId }[] =
	[
		{ harness: "diagnosis", key: "diagnosisFormId", label: "Diagnosen" },
		{ harness: "anamnese", key: "anamneseFormId", label: "Anamnese" },
		{ harness: "epikrise", key: "epikriseFormId", label: "Epikrise" },
	];

type Visibility = "public" | "private";

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

export const AiScribeWorkspacesTab = () => {
	const queryClient = useQueryClient();
	const sessionQuery = useSession();
	const currentUserId = sessionQuery.data?.user?.id ?? null;
	const listQueryOptions = orpc.admin.aiScribeWorkspaces.list.queryOptions();
	const formsQueryOptions = orpc.admin.scribeForms.list.queryOptions();

	const {
		data: workspaces = [],
		isLoading,
		error,
	} = useQuery(listQueryOptions);
	const { data: forms = [] } = useQuery(formsQueryOptions);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState<WorkspaceDraft>(createEmptyDraft());
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const listKey = listQueryOptions.queryKey;
	const formNameById = useMemo(
		() => new Map(forms.map((form) => [form.id, form.name])),
		[forms],
	);

	// Forms eligible for each slot: harness must target the slot's section.
	const formsByField = useMemo(() => {
		const map = new Map<FormFieldKey, FormRecord[]>();
		for (const field of FORM_FIELDS) {
			const target = getPromptHarnessTargetField(field.harness);
			map.set(
				field.key,
				forms.filter(
					(form) => getPromptHarnessTargetField(form.promptHarness) === target,
				),
			);
		}
		return map;
	}, [forms]);

	const fieldsWithoutForms = FORM_FIELDS.filter(
		(field) => (formsByField.get(field.key) ?? []).length === 0,
	);

	const saveMutation = useMutation({
		mutationFn: (currentDraft: WorkspaceDraft) => {
			const name = currentDraft.name.trim();
			if (!name) {
				throw new Error("Bitte einen Namen eingeben.");
			}

			const payload = {
				anamneseFormId: currentDraft.anamneseFormId,
				description: currentDraft.description.trim() || null,
				diagnosisFormId: currentDraft.diagnosisFormId,
				enabled: currentDraft.enabled,
				epikriseFormId: currentDraft.epikriseFormId,
				name,
				visibility: currentDraft.visibility,
			};

			if (currentDraft.id) {
				return orpc.admin.aiScribeWorkspaces.update.call({
					id: currentDraft.id,
					...payload,
				});
			}
			return orpc.admin.aiScribeWorkspaces.create.call(payload);
		},
		onError: (mutationError) => {
			toast.error(
				mutationError instanceof Error ? mutationError.message : "Fehler",
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("Brief-Baukasten gespeichert");
			setDialogOpen(false);
			setDraft(createEmptyDraft());
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			orpc.admin.aiScribeWorkspaces.delete.call({ id }),
		onError: (mutationError) => {
			setPendingDeleteId(null);
			toast.error(
				mutationError instanceof Error ? mutationError.message : "Fehler",
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			setPendingDeleteId(null);
			toast.success("Brief-Baukasten gelöscht");
		},
	});

	const handleOpenCreate = useCallback(() => {
		setDraft(createEmptyDraft());
		setDialogOpen(true);
	}, []);

	const handleOpenEdit = useCallback((workspace: WorkspaceRecord) => {
		setDraft(toDraft(workspace));
		setDialogOpen(true);
	}, []);

	const handleFieldChange = useCallback(
		(key: FormFieldKey, value: string) => {
			setDraft((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const handleSave = useCallback(() => {
		saveMutation.mutate(draft);
	}, [draft, saveMutation]);

	const myWorkspaces = workspaces.filter(
		(workspace) => Boolean(currentUserId) && workspace.authorId === currentUserId,
	);
	const otherWorkspaces = workspaces.filter(
		(workspace) => !(Boolean(currentUserId) && workspace.authorId === currentUserId),
	);

	const renderWorkspaceCard = (workspace: WorkspaceRecord) => (
		<Card key={workspace.id}>
			<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
				<div className="min-w-0">
					<CardTitle className="text-base">{workspace.name}</CardTitle>
					{workspace.description ? (
						<CardDescription>{workspace.description}</CardDescription>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{workspace.visibility === "private" ? (
						<span className="text-solarized-base01 text-xs">Privat</span>
					) : null}
					{workspace.enabled ? null : (
						<span className="text-solarized-base01 text-xs">Deaktiviert</span>
					)}
					<Button
						onClick={() => handleOpenEdit(workspace)}
						size="sm"
						variant="outline"
					>
						Bearbeiten
					</Button>
					{pendingDeleteId === workspace.id ? (
						<div className="flex items-center gap-1">
							<Button
								disabled={deleteMutation.isPending}
								onClick={() => deleteMutation.mutate(workspace.id)}
								size="sm"
								variant="destructive"
							>
								Löschen
							</Button>
							<Button
								onClick={() => setPendingDeleteId(null)}
								size="sm"
								variant="ghost"
							>
								Abbrechen
							</Button>
						</div>
					) : (
						<Button
							aria-label="Löschen"
							onClick={() => setPendingDeleteId(workspace.id)}
							size="icon"
							variant="ghost"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<dl className="space-y-1 text-sm">
					{FORM_FIELDS.map((field) => (
						<div className="flex items-center gap-2" key={field.key}>
							<dt className="w-24 shrink-0 text-solarized-base01">
								{field.label}
							</dt>
							<dd className="text-solarized-base00">
								{formNameById.get(workspace[field.key] ?? "") ??
									"Standard-Vorlage"}
							</dd>
						</div>
					))}
					<div className="flex items-center gap-2">
						<dt className="w-24 shrink-0 text-solarized-base01">Befunde</dt>
						<dd className="text-solarized-base01">Standard</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-10 text-solarized-base01">
				<Loader2 className="h-5 w-5 animate-spin" />
			</div>
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
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<div>
					<h2 className="font-semibold text-base text-solarized-base00">
						Brief-Baukasten
					</h2>
					<p className="text-solarized-base01 text-sm">
						Editor-Seiten aus AI Vorlagen zusammenstellen. Jeder Abschnitt nutzt
						eine AI Vorlage mit dem passenden Prompt-Harness.
					</p>
				</div>
				<Button onClick={handleOpenCreate} size="sm">
					<Plus className="h-4 w-4" />
					Neuer Baukasten
				</Button>
			</div>

			{fieldsWithoutForms.length === 0 ? null : (
				<Card className="border-solarized-yellow/30 bg-solarized-yellow/10">
					<CardContent className="p-4 text-sm text-solarized-base00">
						Für folgende Abschnitte fehlt noch eine passende AI Vorlage:{" "}
						{fieldsWithoutForms.map((field) => field.label).join(", ")}. Lege sie
						zuerst unter „AI Vorlagen“ mit dem passenden Basis-Prompt an. Diese
						Abschnitte nutzen sonst die Standard-Vorlage.
					</CardContent>
				</Card>
			)}

			{workspaces.length === 0 ? (
				<Card className="border-solarized-base2 border-dashed bg-solarized-base3">
					<CardContent className="p-8 text-center">
						<Blocks className="mx-auto mb-3 h-8 w-8 text-solarized-base01" />
						<p className="font-medium text-solarized-base00">
							Noch kein Brief-Baukasten vorhanden.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					<section className="space-y-3">
						<h3 className="font-medium text-solarized-base01 text-xs uppercase tracking-wide">
							Meine Brief-Baukästen
						</h3>
						{myWorkspaces.length === 0 ? (
							<p className="text-solarized-base01 text-sm">
								Du hast noch keinen eigenen Brief-Baukasten erstellt.
							</p>
						) : (
							myWorkspaces.map(renderWorkspaceCard)
						)}
					</section>

					{otherWorkspaces.length === 0 ? null : (
						<section className="space-y-3">
							<h3 className="font-medium text-solarized-base01 text-xs uppercase tracking-wide">
								Weitere
							</h3>
							{otherWorkspaces.map(renderWorkspaceCard)}
						</section>
					)}
				</div>
			)}

			<Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{draft.id ? "Brief-Baukasten bearbeiten" : "Neuer Brief-Baukasten"}
						</DialogTitle>
						<DialogDescription>
							Wähle pro Abschnitt die zugrunde liegende AI Vorlage. Befunde
							verwendet vorerst die Standard-Vorlage.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="ws-name">Name</Label>
							<Input
								id="ws-name"
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										name: event.target.value,
									}))
								}
								placeholder="z. B. Notaufnahme"
								value={draft.name}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="ws-description">Beschreibung (optional)</Label>
							<Textarea
								id="ws-description"
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								placeholder="Kurzbeschreibung des Editors"
								value={draft.description}
							/>
						</div>

						<div className="flex items-center justify-between">
							<Label htmlFor="ws-enabled">Aktiviert</Label>
							<Switch
								checked={draft.enabled}
								id="ws-enabled"
								onCheckedChange={(checked) =>
									setDraft((current) => ({ ...current, enabled: checked }))
								}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="ws-visibility">Sichtbarkeit</Label>
							<Select
								onValueChange={(value) =>
									setDraft((current) => ({
										...current,
										visibility: value === "private" ? "private" : "public",
									}))
								}
								value={draft.visibility}
							>
								<SelectTrigger id="ws-visibility">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="public">Öffentlich</SelectItem>
									<SelectItem value="private">Privat</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-3">
							<Label>Abschnitte</Label>
							{FORM_FIELDS.map((field) => {
								const fieldForms = formsByField.get(field.key) ?? [];
								return (
									<div className="space-y-1.5" key={field.key}>
										<Label className="text-xs" htmlFor={`ws-${field.key}`}>
											{field.label}
										</Label>
										<Select
											onValueChange={(value) =>
												handleFieldChange(
													field.key,
													value === DEFAULT_VALUE ? "" : value,
												)
											}
											value={draft[field.key] || DEFAULT_VALUE}
										>
											<SelectTrigger id={`ws-${field.key}`}>
												<SelectValue placeholder="Standard-Vorlage" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={DEFAULT_VALUE}>
													Standard-Vorlage
												</SelectItem>
												{fieldForms.map((form) => (
													<SelectItem key={form.id} value={form.id}>
														{form.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								);
							})}
							<p className="text-solarized-base01 text-xs">
								Ohne Auswahl wird die Standard-Vorlage verwendet. Befunde nutzt
								vorerst immer die Standard-Vorlage.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							onClick={() => setDialogOpen(false)}
							type="button"
							variant="ghost"
						>
							Abbrechen
						</Button>
						<Button
							disabled={saveMutation.isPending}
							onClick={handleSave}
							type="button"
						>
							{saveMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							Speichern
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
