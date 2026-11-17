"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
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
import { Switch } from "@repo/design-system/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, Loader2, Plus, Trash2 } from "lucide-react";
import type { TagInspectorEditor } from "markdoc-md-editor/tag-inspector/tag-inspector";
import type { MarkdocTemplateDiagnostic } from "markdoc-md/parse";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { trackEvent } from "@/lib/analytics";
import { orpc } from "@/lib/orpc";
import { formatMarkdocTagDiagnostic, USER_MESSAGES } from "@/lib/user-messages";
import type { TemplateSections } from "@/orpc/template-agent/types";

import { TagInspector, TagInspectorSheet } from "./tag-inspector-dynamic";
import { TemplateEditorSidebar } from "./template-editor-sidebar";
import TipTap from "./tip-tap-dynamic";

const MAX_TEMPLATE_EXAMPLES = 10;
const SAVE_TOAST_ID = "template-save";
type TemplateVisibility = "public" | "private";

const isActionableError = (error: unknown): error is Error => error instanceof Error;

const hasMarkdocValidationErrors = (diagnostics: MarkdocTemplateDiagnostic[] | null): boolean =>
	diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;

const isTemplateFormValid = ({
	hasMarkdocErrors,
	isValidationPending,
	name,
}: {
	hasMarkdocErrors: boolean;
	isValidationPending: boolean;
	name: string;
}): boolean => name.trim() !== "" && !hasMarkdocErrors && !isValidationPending;

const getSaveButtonLabel = ({
	hasMarkdocErrors,
	isFormValid,
	isSubmitting,
	isValidationPending,
}: {
	hasMarkdocErrors: boolean;
	isFormValid: boolean;
	isSubmitting: boolean;
	isValidationPending: boolean;
}): string => {
	if (isSubmitting) {
		return "Textbaustein speichern...";
	}
	if (hasMarkdocErrors) {
		return USER_MESSAGES.resolveTemplateTagErrors;
	}
	if (isValidationPending) {
		return USER_MESSAGES.checkingTemplateTags;
	}
	if (!isFormValid) {
		return "Name erforderlich";
	}
	return "Textbaustein speichern";
};

const MarkdocValidationMessage = ({
	diagnostics,
}: {
	diagnostics: MarkdocTemplateDiagnostic[] | null;
}) => {
	if (!diagnostics || diagnostics.length === 0) {
		return null;
	}

	const hasErrors = hasMarkdocValidationErrors(diagnostics);
	return (
		<div
			className={cn(
				"rounded-md border p-3 text-sm",
				hasErrors
					? "border-solarized-red/40 bg-solarized-red/5"
					: "border-solarized-yellow/40 bg-solarized-yellow/5",
			)}
			role={hasErrors ? "alert" : "status"}
		>
			<p className={cn("font-medium", hasErrors ? "text-solarized-red" : "text-solarized-yellow")}>
				{hasErrors
					? `${USER_MESSAGES.invalidTemplateTags} Bitte korrigieren Sie die folgenden Punkte.`
					: "Hinweise zu den Tags im Textbaustein:"}
			</p>
			<ul className="mt-2 list-disc space-y-1 pl-5 text-foreground">
				{diagnostics.map((diagnostic, index) => (
					<li key={`${diagnostic.code}-${index}`}>{formatMarkdocTagDiagnostic(diagnostic)}</li>
				))}
			</ul>
		</div>
	);
};

const TemplateExamplesTab = ({
	examples,
	hasExampleCapacity,
	onAddExample,
	onChangeExampleByIndex,
	onRemoveExampleByIndex,
}: {
	examples: string[];
	hasExampleCapacity: boolean;
	onAddExample: () => void;
	onChangeExampleByIndex: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void)[];
	onRemoveExampleByIndex: (() => void)[];
}) => (
	<TabsContent className="mt-0 min-h-0 grow overflow-y-auto rounded-md border p-3" value="examples">
		<div className="mb-3 flex items-center justify-between gap-2">
			<div>
				<p className="font-medium text-sm">Beispiele</p>
				<p className="text-muted-foreground text-xs">
					Beispiele von guten Epikrisen, an denen man sich orientieren sollte ({examples.length}/
					{MAX_TEMPLATE_EXAMPLES})
				</p>
			</div>
			<Button
				disabled={!hasExampleCapacity}
				onClick={onAddExample}
				type="button"
				variant="secondary"
			>
				<Plus className="mr-2 h-4 w-4" />
				Beispiel hinzufügen
			</Button>
		</div>

		{examples.length === 0 ? (
			<p className="text-muted-foreground text-sm">Noch keine Beispiele hinzugefügt.</p>
		) : (
			<div className="space-y-3">
				{examples.map((example, index) => (
					<div className="space-y-2" key={`template-example-${index}`}>
						<div className="flex items-center justify-between">
							<Label htmlFor={`template-example-${index}`}>Beispiel {index + 1}</Label>
							<Button
								onClick={onRemoveExampleByIndex[index]}
								size="icon"
								type="button"
								variant="ghost"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
						<Textarea
							className="min-h-[25dvh]"
							id={`template-example-${index}`}
							onChange={onChangeExampleByIndex[index]}
							placeholder="Beispiel eingeben"
							value={example}
						/>
					</div>
				))}
			</div>
		)}
	</TabsContent>
);

const TemplateInformationTab = ({
	information,
	onChange,
}: {
	information: string;
	onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) => (
	<TabsContent
		className="mt-0 min-h-0 grow overflow-y-auto rounded-md border p-3"
		value="information"
	>
		<div className="space-y-3">
			<div>
				<Label htmlFor="template-information">{USER_MESSAGES.templateInformationLabel}</Label>
				<p className="mt-1 text-muted-foreground text-xs">
					{USER_MESSAGES.templateInformationDescription}
				</p>
			</div>
			<Textarea
				className="min-h-[35dvh]"
				id="template-information"
				maxLength={10_000}
				onChange={onChange}
				placeholder={USER_MESSAGES.templateInformationPlaceholder}
				value={information}
			/>
		</div>
	</TabsContent>
);

const DeleteTemplateButton = ({
	disabled,
	id,
	name,
}: {
	disabled: boolean;
	id?: string;
	name: string;
}) => {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const deleteMutation = useMutation(orpc.templates.delete.mutationOptions());

	const handleDelete = async () => {
		if (!id) {
			return;
		}

		try {
			await deleteMutation.mutateAsync({ id });
			queryClient.removeQueries({
				queryKey: orpc.templates.get.queryOptions({ input: { id } }).queryKey,
			});
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.templates.list.queryOptions().queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.templates.authored.queryOptions().queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.templates.editorContext.queryOptions().queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.user.collections.list.queryOptions().queryKey,
				}),
			]);
			toast.success("Textbaustein gelöscht");
			router.push("/templates");
		} catch (error) {
			toast.error(
				isActionableError(error) ? error.message : "Fehler beim Löschen des Textbausteins",
			);
		}
	};

	if (!id) {
		return null;
	}

	return (
		<>
			<Button
				aria-label="Textbaustein löschen"
				className="mt-2"
				disabled={disabled || deleteMutation.isPending}
				onClick={() => {
					setDialogOpen(true);
				}}
				size="icon"
				title="Textbaustein löschen"
				type="button"
				variant="destructive"
			>
				<Trash2 className="h-4 w-4" />
			</Button>
			<Dialog
				onOpenChange={(open) => {
					if (!deleteMutation.isPending) {
						setDialogOpen(open);
					}
				}}
				open={dialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="pr-6">Textbaustein wirklich löschen?</DialogTitle>
						<DialogDescription>
							Der Textbaustein „{name}“ wird unwiderruflich gelöscht.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={deleteMutation.isPending}
							onClick={() => {
								setDialogOpen(false);
							}}
							type="button"
							variant="outline"
						>
							Abbrechen
						</Button>
						<Button
							disabled={deleteMutation.isPending}
							onClick={handleDelete}
							type="button"
							variant="destructive"
						>
							{deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
							Unwiderruflich löschen
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default function Editor({
	tit,
	note,
	examples: initialExamples = [],
	information: initialInformation,
	id,
	canCreatePrivateTemplates = false,
	isTemplateAgentEnabled = false,
	visibility: initialVisibility = "public",
}: {
	tit: string;
	note: string;
	examples?: string[];
	information: string;
	id?: string;
	canCreatePrivateTemplates?: boolean;
	isTemplateAgentEnabled?: boolean;
	visibility?: TemplateVisibility;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [name, setName] = useState(tit);
	const [content, setContent] = useState(note ? JSON.parse(note) : "");
	const [examples, setExamples] = useState<string[]>(
		initialExamples.slice(0, MAX_TEMPLATE_EXAMPLES),
	);
	const [information, setInformation] = useState(initialInformation);
	const [visibility, setVisibility] = useState<TemplateVisibility>(initialVisibility);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editorInstance, setEditorInstance] = useState<TagInspectorEditor | null>(null);
	const [markdocDiagnostics, setMarkdocDiagnostics] = useState<MarkdocTemplateDiagnostic[] | null>(
		null,
	);

	const handleTemplateChange = useCallback((update: Partial<TemplateSections>) => {
		if (update.content !== undefined) {
			setContent(update.content);
		}
		if (update.examples !== undefined) {
			setExamples(update.examples);
		}
		if (update.information !== undefined) {
			setInformation(update.information);
		}
	}, []);

	const createMutation = useMutation(orpc.templates.create.mutationOptions());
	const updateMutation = useMutation(orpc.templates.update.mutationOptions());
	const hasMarkdocErrors = hasMarkdocValidationErrors(markdocDiagnostics);
	const isValidationPending = markdocDiagnostics === null;

	const invalidateTemplateQueries = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.templates.list.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.templates.authored.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.templates.editorContext.queryOptions().queryKey,
			}),
		]);
	}, [queryClient]);

	const isFormValid = isTemplateFormValid({ hasMarkdocErrors, isValidationPending, name });

	const hasExampleCapacity = examples.length < MAX_TEMPLATE_EXAMPLES;

	const handleAddExample = useCallback(() => {
		setExamples((currentExamples) => {
			if (currentExamples.length >= MAX_TEMPLATE_EXAMPLES) {
				return currentExamples;
			}

			return [...currentExamples, ""];
		});
	}, []);

	const handleRemoveExample = useCallback((indexToRemove: number) => {
		setExamples((currentExamples) => currentExamples.filter((_, index) => index !== indexToRemove));
	}, []);

	const handleExampleChange = useCallback((indexToUpdate: number, value: string) => {
		setExamples((currentExamples) =>
			currentExamples.map((example, index) => (index === indexToUpdate ? value : example)),
		);
	}, []);

	const handleRemoveExampleByIndex = useMemo(
		() => examples.map((_, index) => () => handleRemoveExample(index)),
		[examples, handleRemoveExample],
	);

	const handleChangeExampleByIndex = useMemo(
		() =>
			examples.map(
				(_, index) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
					handleExampleChange(index, event.target.value),
			),
		[examples, handleExampleChange],
	);

	const handleCreateError = useCallback((error: unknown) => {
		toast.error(
			isActionableError(error) ? error.message : "Fehler beim Speichern des Textbausteins",
			{
				action: {
					label: "Im Editor bleiben",
					onClick: () => {
						toast.dismiss(SAVE_TOAST_ID);
					},
				},
				id: SAVE_TOAST_ID,
			},
		);
	}, []);

	const handleEditError = useCallback((error: unknown, templateId: string) => {
		toast.error(
			isActionableError(error) ? error.message : "Fehler beim Speichern des Textbausteins",
			{
				action: {
					label: "Zurück zum Editor",
					onClick: () => {
						window.location.assign(`/templates/${templateId}/edit`);
					},
				},
				id: SAVE_TOAST_ID,
			},
		);
	}, []);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!isFormValid) {
				return;
			}

			setIsSubmitting(true);
			const sanitizedExamples = examples
				.map((example) => example.trim())
				.filter((example) => example.length > 0)
				.slice(0, MAX_TEMPLATE_EXAMPLES);

			if (id) {
				toast.loading("Änderungen werden im Hintergrund gespeichert...", {
					id: SAVE_TOAST_ID,
				});

				const savePromise = updateMutation.mutateAsync({
					content,
					examples: sanitizedExamples,
					id,
					information: information.trim(),
					name,
					visibility,
				});

				router.push(`/templates/${id}`);

				const finalizeTemplateUpdate = async () => {
					try {
						const updatedTemplate = await savePromise;
						await invalidateTemplateQueries();
						await queryClient.invalidateQueries({
							queryKey: orpc.templates.get.queryOptions({
								input: { id: updatedTemplate.id },
							}).queryKey,
						});
						toast.success("Textbaustein aktualisiert", { id: SAVE_TOAST_ID });
						router.refresh();
					} catch (error) {
						handleEditError(error, id);
					} finally {
						setIsSubmitting(false);
					}
				};

				finalizeTemplateUpdate();
				return;
			}

			toast.loading("Textbaustein wird gespeichert...", { id: SAVE_TOAST_ID });
			try {
				const newTemplate = await createMutation.mutateAsync({
					content,
					examples: sanitizedExamples,
					information: information.trim(),
					name,
					visibility,
				});

				trackEvent("template-created");
				await invalidateTemplateQueries();
				await queryClient.invalidateQueries({
					queryKey: orpc.templates.get.queryOptions({
						input: { id: newTemplate.id },
					}).queryKey,
				});
				toast.success("Textbaustein erstellt", { id: SAVE_TOAST_ID });
				router.push(`/templates/${newTemplate.id}`);
			} catch (error) {
				handleCreateError(error);
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			content,
			createMutation,
			examples,
			handleCreateError,
			handleEditError,
			id,
			information,
			invalidateTemplateQueries,
			isFormValid,
			name,
			queryClient,
			router,
			updateMutation,
			visibility,
		],
	);

	const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);
	const handleInformationChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInformation(event.target.value);
	}, []);

	const handlePublicChange = useCallback(
		(isPublic: boolean) => {
			if (!isPublic && canCreatePrivateTemplates === false) {
				toast.error(USER_MESSAGES.privateTemplateRequiresPlus);
				return;
			}
			setVisibility(isPublic ? "public" : "private");
		},
		[canCreatePrivateTemplates],
	);

	const isNameValid = name.trim() !== "";
	const nameValidationMessage = isNameValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Name ist erforderlich</p>
	);

	return (
		<div className="flex h-[calc(100dvh-(--spacing(16))-(--spacing(6)))] gap-4">
			{/* Main Editor Card */}
			<Card className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
				<form onSubmit={handleSubmit} className="flex min-h-0 grow flex-col gap-2">
					<div className="mb-4 flex shrink-0 flex-col gap-4 md:flex-row md:gap-2">
						<div className="flex-1">
							<Label htmlFor="name">
								Name <span className="text-solarized-red">*</span>
							</Label>
							<Input
								id="name"
								name="name"
								onChange={handleNameChange}
								placeholder="Vorlagenname eingeben"
								value={name}
								className={isNameValid ? "" : "border-solarized-red"}
							/>
							{nameValidationMessage}
						</div>
						<div className="shrink-0">
							<div className="mb-2 flex items-center gap-1.5">
								<Label htmlFor="template-visibility">Sichtbarkeit</Label>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												aria-label="Hinweis zur Sichtbarkeit"
												className="size-4 text-muted-foreground"
												size="icon-xs"
												variant="ghost"
											>
												<InfoIcon className="h-3 w-3" />
											</Button>
										}
									/>
									<TooltipContent align="start" className="max-w-80" side="bottom">
										<div className="space-y-1 text-xs">
											<p>{USER_MESSAGES.publicTemplateVisibilityWarning}</p>
											{canCreatePrivateTemplates ? null : (
												<p>{USER_MESSAGES.privateTemplateRequiresPlus}</p>
											)}
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<div className="flex h-9 items-center gap-2">
								<Switch
									checked={visibility === "public"}
									id="template-visibility"
									onCheckedChange={handlePublicChange}
								/>
								<span className="text-sm">{visibility === "public" ? "Öffentlich" : "Privat"}</span>
							</div>
						</div>
					</div>

					<Tabs className="min-h-0 grow" defaultValue="template">
						<TabsList className="mb-2 grid w-fit grid-cols-3">
							<TabsTrigger value="template">Template</TabsTrigger>
							<TabsTrigger value="examples">Beispiele</TabsTrigger>
							<TabsTrigger value="information">
								{USER_MESSAGES.templateInformationLabel}
							</TabsTrigger>
						</TabsList>

						<TabsContent className="mt-0 flex min-h-0 grow flex-col gap-2" value="template">
							<div
								aria-invalid={hasMarkdocErrors}
								className={cn(
									"min-h-0 flex-1 w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
									hasMarkdocErrors && "border-solarized-red",
								)}
							>
								<TipTap
									note={content}
									onEditorChange={setEditorInstance}
									onValidationChange={setMarkdocDiagnostics}
									setContent={setContent}
								/>
							</div>
							<MarkdocValidationMessage diagnostics={markdocDiagnostics} />
						</TabsContent>

						<TemplateExamplesTab
							examples={examples}
							hasExampleCapacity={hasExampleCapacity}
							onAddExample={handleAddExample}
							onChangeExampleByIndex={handleChangeExampleByIndex}
							onRemoveExampleByIndex={handleRemoveExampleByIndex}
						/>
						<TemplateInformationTab information={information} onChange={handleInformationChange} />
					</Tabs>
					<div className="flex shrink-0 flex-row gap-2">
						<Button
							className="mt-2 min-w-0 flex-1"
							disabled={isSubmitting || !isFormValid}
							type="submit"
						>
							{getSaveButtonLabel({
								hasMarkdocErrors,
								isFormValid,
								isSubmitting,
								isValidationPending,
							})}
						</Button>
						<DeleteTemplateButton disabled={isSubmitting} id={id} name={name} />
					</div>
				</form>
			</Card>

			{/* Tag inspector: sidebar on xl+, bottom sheet below */}
			<div className={cn("hidden xl:block", isTemplateAgentEnabled ? "w-96" : "w-80")}>
				{isTemplateAgentEnabled ? (
					<TemplateEditorSidebar
						template={{ content, examples, information }}
						editor={editorInstance}
						onTemplateChange={handleTemplateChange}
					/>
				) : (
					<TagInspector editor={editorInstance} />
				)}
			</div>
			<TagInspectorSheet editor={editorInstance} />
		</div>
	);
}
