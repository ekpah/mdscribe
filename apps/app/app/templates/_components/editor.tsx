"use client";

import PlainEditor from "@repo/design-system/components/editor/plain-editor";
import type { TagInspectorEditor } from "@repo/design-system/components/editor/tag-inspector/tag-inspector";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type { MarkdocTagDiagnostic } from "@repo/markdoc-md/parse/validate-markdoc-tag-contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import { formatMarkdocTagDiagnostic, USER_MESSAGES } from "@/lib/user-messages";

import { TagInspector, TagInspectorSheet } from "./tag-inspector-dynamic";
import TipTap from "./tip-tap-dynamic";

const FALLBACK_CATEGORIES = ["Kardiologie", "Gastroenterologie", "Diverses", "Onkologie"] as const;
const MAX_TEMPLATE_EXAMPLES = 10;
const SAVE_TOAST_ID = "template-save";
const TEMPLATE_VISIBILITIES = ["public", "private"] as const;
type TemplateVisibility = (typeof TEMPLATE_VISIBILITIES)[number];

const isActionableError = (error: unknown): error is Error => error instanceof Error;

const hasMarkdocValidationErrors = (diagnostics: MarkdocTagDiagnostic[] | null): boolean =>
	diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;

const isTemplateFormValid = ({
	category,
	hasMarkdocErrors,
	isValidationPending,
	name,
	newCategory,
}: {
	category: string;
	hasMarkdocErrors: boolean;
	isValidationPending: boolean;
	name: string;
	newCategory: string;
}): boolean => {
	const resolvedCategory = category === "new" ? newCategory : category;
	return (
		resolvedCategory.trim() !== "" &&
		name.trim() !== "" &&
		!hasMarkdocErrors &&
		!isValidationPending
	);
};

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
		return "Kategorie und Name erforderlich";
	}
	return "Textbaustein speichern";
};

const MarkdocValidationMessage = ({
	diagnostics,
}: {
	diagnostics: MarkdocTagDiagnostic[] | null;
}) => {
	if (!diagnostics || diagnostics.length === 0) {
		return null;
	}

	return (
		<div
			className="rounded-md border border-solarized-red/40 bg-solarized-red/5 p-3 text-sm"
			role="alert"
		>
			<p className="font-medium text-solarized-red">{USER_MESSAGES.invalidTemplateTags}</p>
			<ul className="mt-2 list-disc space-y-1 pl-5 text-foreground">
				{diagnostics.map((diagnostic, index) => (
					<li key={`${diagnostic.code}-${diagnostic.primary}-${index}`}>
						{formatMarkdocTagDiagnostic(diagnostic)}
					</li>
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

export default function Editor({
	cat,
	categorySuggestions = [],
	tit,
	note,
	examples: initialExamples = [],
	information: initialInformation,
	id,
	canEditSource = false,
	canCreatePrivateTemplates = false,
	visibility: initialVisibility = "public",
}: {
	cat: string;
	categorySuggestions?: string[];
	tit: string;
	note: string;
	examples?: string[];
	information: string;
	id?: string;
	canEditSource?: boolean;
	canCreatePrivateTemplates?: boolean;
	visibility?: TemplateVisibility;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [category, setCategory] = useState<string>(cat);
	const [name, setName] = useState(tit);
	const [content, setContent] = useState(note ? JSON.parse(note) : "");
	const [examples, setExamples] = useState<string[]>(
		initialExamples.slice(0, MAX_TEMPLATE_EXAMPLES),
	);
	const [information, setInformation] = useState(initialInformation);
	const [newCategory, setNewCategory] = useState("");
	const [visibility, setVisibility] = useState<TemplateVisibility>(initialVisibility);
	const [showSource, setShowSource] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editorInstance, setEditorInstance] = useState<TagInspectorEditor | null>(null);
	const [markdocDiagnostics, setMarkdocDiagnostics] = useState<MarkdocTagDiagnostic[] | null>(null);
	// Counter to force TipTap remount when switching from source view
	const editorKeyRef = useRef(0);

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
				queryKey: orpc.templates.favourites.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.templates.authored.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.templates.editorContext.queryOptions().queryKey,
			}),
		]);
	}, [queryClient]);

	const isFormValid = isTemplateFormValid({
		category,
		hasMarkdocErrors,
		isValidationPending,
		name,
		newCategory,
	});

	const suggestedCategories = useMemo(() => {
		const limit = 10;
		const result: string[] = [];
		const seen = new Set<string>();

		const addCategory = (value: string) => {
			const normalized = value.trim();
			if (!normalized) {
				return;
			}

			const key = normalized.toLowerCase();
			if (seen.has(key)) {
				return;
			}

			seen.add(key);
			result.push(normalized);
		};

		if (cat.trim()) {
			addCategory(cat);
		}

		for (const value of categorySuggestions) {
			if (result.length >= limit) {
				break;
			}
			addCategory(value);
		}

		for (const value of FALLBACK_CATEGORIES) {
			if (result.length >= limit) {
				break;
			}
			addCategory(value);
		}

		return result.slice(0, limit);
	}, [cat, categorySuggestions]);

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
			const finalCategory = category === "new" ? newCategory : category;
			const sanitizedExamples = examples
				.map((example) => example.trim())
				.filter((example) => example.length > 0)
				.slice(0, MAX_TEMPLATE_EXAMPLES);

			if (id) {
				toast.loading("Änderungen werden im Hintergrund gespeichert...", {
					id: SAVE_TOAST_ID,
				});

				const savePromise = updateMutation.mutateAsync({
					category: finalCategory,
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
					category: finalCategory,
					content,
					examples: sanitizedExamples,
					information: information.trim(),
					name,
					visibility,
				});

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
			category,
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
			newCategory,
			queryClient,
			router,
			updateMutation,
			visibility,
		],
	);

	const handleNewCategoryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setNewCategory(event.target.value);
	}, []);

	const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);
	const handleInformationChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInformation(event.target.value);
	}, []);

	const handleVisibilityChange = useCallback(
		(value: string) => {
			if (value === "private" && canCreatePrivateTemplates === false) {
				toast.error(USER_MESSAGES.privateTemplateRequiresPlus);
				setVisibility("public");
				return;
			}

			if (TEMPLATE_VISIBILITIES.includes(value as TemplateVisibility)) {
				setVisibility(value as TemplateVisibility);
			}
		},
		[canCreatePrivateTemplates],
	);

	const handleSwitchToVisualEditor = useCallback(() => {
		editorKeyRef.current += 1;
		setMarkdocDiagnostics(null);
		setShowSource(false);
	}, []);

	const handleSwitchToSource = useCallback(() => {
		setShowSource(true);
	}, []);
	const resolvedCategory = category === "new" ? newCategory : category;
	const isCategoryValid = resolvedCategory.trim() !== "";
	const isNewCategoryValid = newCategory.trim() !== "";
	const isNameValid = name.trim() !== "";
	const categoryValidationMessage = isCategoryValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Kategorie ist erforderlich</p>
	);
	const newCategoryValidationMessage = isNewCategoryValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Neue Kategorie ist erforderlich</p>
	);
	const nameValidationMessage = isNameValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Name ist erforderlich</p>
	);

	return (
		<div className="flex h-[calc(100vh-(--spacing(16))-(--spacing(6)))] gap-4">
			{/* Main Editor Card */}
			<Card className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
				<form onSubmit={handleSubmit} className="flex min-h-0 grow flex-col gap-2">
					<div className="mb-4 flex shrink-0 flex-col gap-4 md:flex-row md:gap-2">
						<div className="w-full flex-1">
							<Label htmlFor="category">
								Kategorie <span className="text-solarized-red">*</span>
							</Label>
							<input name="category" type="hidden" value={resolvedCategory} />
							<Select onValueChange={setCategory} value={category}>
								<SelectTrigger className={isCategoryValid ? "" : "border-solarized-red"}>
									<SelectValue placeholder="Kategorie auswählen" />
								</SelectTrigger>
								<SelectContent>
									{suggestedCategories.map((categoryOption) => (
										<SelectItem key={categoryOption} value={categoryOption}>
											{categoryOption}
										</SelectItem>
									))}
									<SelectItem value="new">Neue Kategorie hinzufügen</SelectItem>
								</SelectContent>
							</Select>
							{categoryValidationMessage}
						</div>
						{category === "new" && (
							<div className="flex-1">
								<Label htmlFor="newCategory">
									Neue Kategorie <span className="text-solarized-red">*</span>
								</Label>
								<Input
									id="newCategory"
									onChange={handleNewCategoryChange}
									placeholder="Füge eine Kategorie hinzu"
									value={newCategory}
									className={isNewCategoryValid ? "" : "border-solarized-red"}
								/>
								{newCategoryValidationMessage}
							</div>
						)}
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
						<div className="flex-1">
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
												<p>Private Textbausteine sind in Plus enthalten.</p>
											)}
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<Select onValueChange={handleVisibilityChange} value={visibility}>
								<SelectTrigger id="template-visibility">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="public">Öffentlich</SelectItem>
									<SelectItem disabled={canCreatePrivateTemplates === false} value="private">
										Privat
									</SelectItem>
								</SelectContent>
							</Select>
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
								{showSource ? (
									<PlainEditor
										note={content}
										onToggleSource={handleSwitchToVisualEditor}
										setContent={setContent}
										showSource={showSource}
									/>
								) : (
									<TipTap
										key={`tiptap-${editorKeyRef.current}`}
										note={content}
										onEditorChange={setEditorInstance}
										onToggleSource={canEditSource ? handleSwitchToSource : undefined}
										onValidationChange={setMarkdocDiagnostics}
										setContent={setContent}
										showSource={showSource}
									/>
								)}
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
						<Button className="mt-2 w-full" disabled={isSubmitting || !isFormValid} type="submit">
							{getSaveButtonLabel({
								hasMarkdocErrors,
								isFormValid,
								isSubmitting,
								isValidationPending,
							})}
						</Button>
					</div>
				</form>
			</Card>

			{/* Tag inspector: sidebar on xl+, bottom sheet below */}
			<div className="hidden w-80 xl:block">
				<TagInspector editor={editorInstance} />
			</div>
			<TagInspectorSheet editor={editorInstance} />
		</div>
	);
}
