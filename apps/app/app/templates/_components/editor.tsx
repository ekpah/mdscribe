"use client";

import Markdoc, { type ValidateError } from "@markdoc/markdoc";
import { EditorSidebar } from "@repo/design-system/components/editor/_components/EditorSidebar";
import PlainEditor from "@repo/design-system/components/editor/PlainEditor";
import TipTap from "@repo/design-system/components/editor/TipTap";
import type {
	MarkdocTagName,
	MarkdocValidationHighlight,
} from "@repo/design-system/components/editor/tiptap-extension";
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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import markdocConfig from "@repo/markdoc-md/markdoc-config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

const FALLBACK_CATEGORIES = [
	"Kardiologie",
	"Gastroenterologie",
	"Diverses",
	"Onkologie",
] as const;
const MAX_TEMPLATE_EXAMPLES = 10;
const SAVE_TOAST_ID = "template-save";
const MARKDOC_TAG_REGEX = /{%\s*(\/?)([A-Za-z][\w-]*)[^%]*?%}/g;
const MARKDOC_TAG_NAMES: MarkdocTagName[] = ["info", "score", "switch", "case"];
const MARKDOC_TAG_NAME_SET = new Set<MarkdocTagName>(MARKDOC_TAG_NAMES);

interface TagOccurrence {
	tagName: MarkdocTagName;
	index: number;
	startOffset: number;
	endOffset: number;
}

interface MarkdocErrorLocation {
	start?: {
		line?: number;
	};
}

const isMarkdocTagName = (value: string): value is MarkdocTagName =>
	MARKDOC_TAG_NAME_SET.has(value as MarkdocTagName);

const buildLineStartOffsets = (source: string) => {
	const offsets = [0];

	for (let index = 0; index < source.length; index += 1) {
		if (source[index] === "\n") {
			offsets.push(index + 1);
		}
	}

	return offsets;
};

const getOffsetFromLocation = (
	lineStarts: number[],
	location: MarkdocErrorLocation | undefined,
	contentLength: number,
) => {
	const line = location?.start?.line;

	if (!line) {
		return null;
	}

	const lineIndex = line - 1;
	const lineStart = lineStarts[lineIndex];

	if (lineStart === undefined) {
		return null;
	}

	return Math.min(lineStart, contentLength);
};

const findTagOccurrences = (source: string): TagOccurrence[] => {
	const occurrences: TagOccurrence[] = [];
	const counts: Record<MarkdocTagName, number> = {
		info: 0,
		score: 0,
		switch: 0,
		case: 0,
	};

	MARKDOC_TAG_REGEX.lastIndex = 0;
	let match = MARKDOC_TAG_REGEX.exec(source);

	while (match) {
		const isClosingTag = match[1] === "/";
		const rawTagName = match[2];

		if (!isClosingTag && rawTagName) {
			const normalizedTagName = rawTagName.toLowerCase();

			if (isMarkdocTagName(normalizedTagName)) {
				const index = counts[normalizedTagName];

				occurrences.push({
					tagName: normalizedTagName,
					index,
					startOffset: match.index,
					endOffset: match.index + match[0].length,
				});

				counts[normalizedTagName] = index + 1;
			}
		}

		match = MARKDOC_TAG_REGEX.exec(source);
	}

	return occurrences;
};

const formatValidationMessage = (error: ValidateError) => {
	const message = error.error?.message ?? "Unbekannter Validierungsfehler";
	const line = error.error?.location?.start?.line;

	if (!line) {
		return message;
	}

	return `${message} (Zeile ${line})`;
};

const buildValidationHighlights = (
	source: string,
	errors: ValidateError[],
): MarkdocValidationHighlight[] => {
	if (errors.length === 0 || source.trim() === "") {
		return [];
	}

	const occurrences = findTagOccurrences(source);
	if (occurrences.length === 0) {
		return [];
	}

	const lineStarts = buildLineStartOffsets(source);
	const highlightsByKey = new Map<string, MarkdocValidationHighlight>();

	for (const error of errors) {
		const offset = getOffsetFromLocation(
			lineStarts,
			error.error?.location,
			source.length,
		);

		if (offset === null) {
			continue;
		}

		const matchedOccurrence = occurrences.find(
			(occurrence) =>
				offset >= occurrence.startOffset && offset <= occurrence.endOffset,
		);

		if (!matchedOccurrence) {
			continue;
		}

		const message = formatValidationMessage(error);
		const key = `${matchedOccurrence.tagName}:${matchedOccurrence.index}`;
		const existingHighlight = highlightsByKey.get(key);

		if (existingHighlight) {
			highlightsByKey.set(key, {
				...existingHighlight,
				message: `${existingHighlight.message}\n${message}`,
			});
		} else {
			highlightsByKey.set(key, {
				tagName: matchedOccurrence.tagName,
				index: matchedOccurrence.index,
				message,
			});
		}
	}

	return Array.from(highlightsByKey.values());
};

const isActionableError = (error: unknown): error is Error => error instanceof Error;

export default function Editor({
	cat,
	categorySuggestions = [],
	tit,
	note,
	examples: initialExamples = [],
	id,
	canEditSource = false,
}: {
	cat: string;
	categorySuggestions?: string[];
	tit: string;
	note: string;
	examples?: string[];
	id?: string;
	canEditSource?: boolean;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [category, setCategory] = useState<string>(cat);
	const [name, setName] = useState(tit);
	const [content, setContent] = useState(note ? JSON.parse(note) : "");
	const [examples, setExamples] = useState<string[]>(
		initialExamples.slice(0, MAX_TEMPLATE_EXAMPLES),
	);
	const [newCategory, setNewCategory] = useState("");
	const [showSource, setShowSource] = useState(false);
	const [validationErrors, setValidationErrors] = useState<ValidateError[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const validationTimerRef = useRef<number | null>(null);
	// Counter to force TipTap remount when switching from source view
	const editorKeyRef = useRef(0);

	const createMutation = useMutation(orpc.templates.create.mutationOptions());
	const updateMutation = useMutation(orpc.templates.update.mutationOptions());

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

	// Validation for required fields
	const isFormValid = (() => {
		const finalCategory = category === "new" ? newCategory : category;
		return finalCategory.trim() !== "" && name.trim() !== "";
	})();

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
		setExamples((currentExamples) =>
			currentExamples.filter((_, index) => index !== indexToRemove),
		);
	}, []);

	const handleExampleChange = useCallback((indexToUpdate: number, value: string) => {
		setExamples((currentExamples) =>
			currentExamples.map((example, index) =>
				index === indexToUpdate ? value : example,
			),
		);
	}, []);

	const validateContent = useCallback((source: string): ValidateError[] => {
		try {
			const ast = Markdoc.parse(source);
			const validation = Markdoc.validate(ast, markdocConfig);
			return validation.filter((result) => result.type === "error");
		} catch (parseError) {
			const syntheticError: ValidateError = {
				type: "error" as const,
				error: {
					id: "parse-error",
					level: "error",
					message:
						parseError instanceof Error
							? parseError.message
							: "Unbekannter Parse-Fehler",
					location: {
						start: { line: 1 },
						end: { line: 1 },
					},
				},
				lines: [],
			};

			return [syntheticError];
		}
	}, []);

	const validationHighlights = useMemo(
		() => buildValidationHighlights(content, validationErrors),
		[content, validationErrors],
	);

	useEffect(() => {
		if (validationTimerRef.current !== null) {
			window.clearTimeout(validationTimerRef.current);
		}

		validationTimerRef.current = window.setTimeout(() => {
			setValidationErrors(validateContent(content));
		}, 300);

		return () => {
			if (validationTimerRef.current !== null) {
				window.clearTimeout(validationTimerRef.current);
			}
		};
	}, [content, validateContent]);

	const checkContent = useCallback(() => {
		const checkErrors = validateContent(content);
		setValidationErrors(checkErrors);

		if (checkErrors.length > 0) {
			toast.error(`${checkErrors.length} Fehler in der Markdoc-Syntax gefunden`);
		} else {
			toast.success("Markdoc-Syntax ist korrekt");
		}
	}, [content, validateContent]);

	const handleCreateError = useCallback((error: unknown) => {
		toast.error(
			isActionableError(error)
				? error.message
				: "Fehler beim Speichern des Textbausteins",
			{
				action: {
					label: "Im Editor bleiben",
					onClick: () => undefined,
				},
				id: SAVE_TOAST_ID,
			},
		);
	}, []);

	const handleEditError = useCallback(
		(error: unknown, templateId: string) => {
			toast.error(
				isActionableError(error)
					? error.message
					: "Fehler beim Speichern des Textbausteins",
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
		},
		[],
	);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!isFormValid) {
				return;
			}

			const checkErrors = validateContent(content);
			if (checkErrors.length > 0) {
				setValidationErrors(checkErrors);
				toast.error("Bitte behebe die Markdoc-Fehler vor dem Speichern");
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
					name,
				});

				router.push(`/templates/${id}`);

				void (async () => {
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
				})();
				return;
			}

			toast.loading("Textbaustein wird gespeichert...", { id: SAVE_TOAST_ID });
			try {
				const newTemplate = await createMutation.mutateAsync({
					category: finalCategory,
					content,
					examples: sanitizedExamples,
					name,
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
			invalidateTemplateQueries,
			isFormValid,
			name,
			newCategory,
			queryClient,
			router,
			updateMutation,
			validateContent,
		],
	);

	const handleNewCategoryChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setNewCategory(event.target.value);
		},
		[],
	);

	const handleNameChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setName(event.target.value);
		},
		[],
	);

	const handleSwitchToVisualEditor = useCallback(() => {
		editorKeyRef.current += 1;
		setShowSource(false);
	}, []);

	const handleSwitchToSource = useCallback(() => {
		setShowSource(true);
	}, []);

	return (
		<div className="flex h-[calc(100vh-(--spacing(16))-(--spacing(6)))] gap-4">
			{/* Main Editor Card */}
			<Card className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
				<form
					onSubmit={handleSubmit}
					className="flex min-h-0 grow flex-col gap-2"
				>
					<div className="mb-4 flex shrink-0 flex-col gap-4 md:flex-row md:gap-2">
						<div className="w-full flex-1">
							<Label htmlFor="category">
								Kategorie <span className="text-solarized-red">*</span>
							</Label>
							<input
								name="category"
								type="hidden"
								value={category === "new" ? newCategory : category}
							/>
							<Select onValueChange={setCategory} value={category}>
								<SelectTrigger
									className={
										(category === "new" ? newCategory : category).trim() === ""
											? "border-solarized-red"
											: ""
									}
								>
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
							{(category === "new" ? newCategory : category).trim() === "" && (
								<p className="mt-1 text-solarized-red text-xs">
									Kategorie ist erforderlich
								</p>
							)}
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
									className={
										newCategory.trim() === "" ? "border-solarized-red" : ""
									}
								/>
								{newCategory.trim() === "" && (
									<p className="mt-1 text-solarized-red text-xs">
										Neue Kategorie ist erforderlich
									</p>
								)}
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
								className={name.trim() === "" ? "border-solarized-red" : ""}
							/>
							{name.trim() === "" && (
								<p className="mt-1 text-solarized-red text-xs">
									Name ist erforderlich
								</p>
							)}
						</div>
					</div>

					<Tabs className="min-h-0 grow" defaultValue="template">
						<TabsList className="mb-2 grid w-fit grid-cols-2">
							<TabsTrigger value="template">Template</TabsTrigger>
							<TabsTrigger value="examples">Beispiele</TabsTrigger>
						</TabsList>

						<TabsContent className="mt-0 flex min-h-0 grow flex-col gap-2" value="template">
							<div className="min-h-0 flex-1 w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
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
										onToggleSource={canEditSource ? handleSwitchToSource : undefined}
										setContent={setContent}
										showSource={showSource}
										validationHighlights={validationHighlights}
									/>
								)}
							</div>

							{validationErrors.length > 0 && (
								<div className="mt-2 max-h-32 shrink-0 space-y-2 overflow-y-auto">
									<div className="rounded-md border border-solarized-red bg-solarized-red/10 p-3">
										<div className="flex items-center space-x-2 font-medium text-sm text-solarized-red">
											<AlertCircle className="h-4 w-4" />
											<span>Fehler ({validationErrors.length})</span>
										</div>
										<ul className="mt-2 space-y-1 text-sm text-solarized-red/80">
											{validationErrors.map((error, index) => (
												<li
													className="flex items-start space-x-2"
													key={`error-${error.error?.message || "unknown"}-${index}`}
												>
													<span className="text-solarized-red">•</span>
													<div className="flex-1">
														<div className="flex items-center space-x-2">
															{error.error?.location && (
																<span className="rounded bg-solarized-red/20 px-2 py-1 font-mono text-solarized-red text-xs">
																	Zeile {error.error.location.start?.line || "unknown"}
																</span>
															)}
															<span className="font-medium text-solarized-red">
																{error.type === "error" ? "Fehler" : "Warnung"}
															</span>
														</div>
														<p className="mt-1 text-solarized-red/90">
															{error.error?.message || "Unbekannter Validierungsfehler"}
														</p>
													</div>
												</li>
											))}
										</ul>
									</div>
								</div>
							)}
						</TabsContent>

						<TabsContent className="mt-0 min-h-0 grow overflow-y-auto rounded-md border p-3" value="examples">
							<div className="mb-3 flex items-center justify-between gap-2">
								<div>
									<p className="font-medium text-sm">Beispiel-Ausgaben</p>
									<p className="text-muted-foreground text-xs">
										Finale Ausgaben fuer Few-Shot Guidance ({examples.length}/
										{MAX_TEMPLATE_EXAMPLES})
									</p>
								</div>
								<Button
									disabled={!hasExampleCapacity}
									onClick={handleAddExample}
									type="button"
									variant="secondary"
								>
									<Plus className="mr-2 h-4 w-4" />
									Beispiel hinzufuegen
								</Button>
							</div>

							{examples.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Noch keine Beispiele hinzugefuegt.
								</p>
							) : (
								<div className="space-y-3">
									{examples.map((example, index) => (
										<div className="space-y-2" key={`template-example-${index}`}>
											<div className="flex items-center justify-between">
												<Label htmlFor={`template-example-${index}`}>
													Beispiel {index + 1}
												</Label>
												<Button
													onClick={() => {
														handleRemoveExample(index);
													}}
													size="icon"
													type="button"
													variant="ghost"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
											<Textarea
												id={`template-example-${index}`}
												onChange={(event) => {
													handleExampleChange(index, event.target.value);
												}}
												placeholder="Finale Beispiel-Ausgabe eingeben"
												rows={4}
												value={example}
											/>
										</div>
									))}
								</div>
							)}
						</TabsContent>
					</Tabs>
					<div className="flex shrink-0 flex-row gap-2">
						<Button
							className="mt-2 w-1/10"
							onClick={checkContent}
							type="button"
							variant="secondary"
						>
							Prüfen
						</Button>
						<Button
							className="mt-2 w-full"
							disabled={isSubmitting || validationErrors.length > 0 || !isFormValid}
							type="submit"
						>
							{(() => {
								if (isSubmitting) {
									return "Textbaustein speichern...";
								}
								if (!isFormValid) {
									return "Kategorie und Name erforderlich";
								}
								if (validationErrors.length > 0) {
									return "Behebe Fehler um zu speichern";
								}
								return "Textbaustein speichern";
							})()}
						</Button>
					</div>
				</form>
			</Card>

			{/* Sidebar */}
			<div className="hidden w-80 xl:block">
				<EditorSidebar />
			</div>
		</div>
	);
}
