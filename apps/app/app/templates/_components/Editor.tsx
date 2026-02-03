"use client";

import Markdoc, { type ValidateError } from "@markdoc/markdoc";
import { EditorSidebar } from "@repo/design-system/components/editor/_components/EditorSidebar";
import PlainEditor from "@repo/design-system/components/editor/PlainEditor";
import TipTap from "@repo/design-system/components/editor/TipTap";
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
import markdocConfig from "@repo/markdoc-md/markdoc-config";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export default function Editor({
	cat,
	categorySuggestions = [],
	tit,
	note,
	id,
	author,
}: {
	cat: string;
	categorySuggestions?: string[];
	tit: string;
	note: string;
	id?: string;
	author: { id: string; email: string };
}) {
	const router = useRouter();
	const [category, setCategory] = useState<string>(cat);
	const [name, setName] = useState(tit);
	const [content, setContent] = useState(note ? JSON.parse(note) : "");
	const [newCategory, setNewCategory] = useState("");
	const [showSource, setShowSource] = useState(false);
	const [validationErrors, setValidationErrors] = useState<ValidateError[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	// Counter to force TipTap remount when switching from source view
	const editorKeyRef = useRef(0);

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

		return result.slice(0, limit);
	}, [cat, categorySuggestions]);

	const handleValidationChange = useCallback(
		(errors: ValidateError[]) => {
			try {
				const ast = Markdoc.parse(content);
				const validation = Markdoc.validate(ast, markdocConfig);

				setValidationErrors(validation);

				console.log("Validation results:", {
					errors: validation,
					tiptapErrors: errors,
				});
			} catch (parseError) {
				console.error("Parse error:", parseError);
				// Create a synthetic error for parse failures
				const syntheticError = {
					type: "error" as const,
					error: {
						message:
							parseError instanceof Error
								? parseError.message
								: "Unbekannter Parse-Fehler",
						location: {
							start: { line: 1 },
							end: { line: 1 },
						},
					},
				} as ValidateError;
				setValidationErrors([syntheticError]);
			}
		},
		[content],
	);

	const checkContent = () => {
		try {
			const ast = Markdoc.parse(content);
			const validation = Markdoc.validate(ast, markdocConfig);

			// Separate errors and warnings
			const checkErrors = validation.filter(
				(v: ValidateError) => v.type === "error",
			);

			setValidationErrors(checkErrors);

			if (checkErrors.length > 0) {
				toast.error(
					`${checkErrors.length} Fehler in der Markdoc-Syntax gefunden`,
				);
			} else {
				toast.success("Markdoc-Syntax ist korrekt");
			}

			console.log("Validation results:", {
				errors: checkErrors,
				ast,
			});
		} catch (parseError) {
			console.error("Parse error:", parseError);
			toast.error(
				`Parse-Fehler: ${parseError instanceof Error ? parseError.message : "Unbekannter Fehler"}`,
			);

			// Create a synthetic error for parse failures
			const syntheticError = {
				type: "error" as const,
				error: {
					message:
						parseError instanceof Error
							? parseError.message
							: "Unbekannter Parse-Fehler",
					location: {
						start: { line: 1 },
						end: { line: 1 },
					},
				},
			} as ValidateError;
			setValidationErrors([syntheticError]);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isFormValid || validationErrors.length > 0) {
			return;
		}

		setIsSubmitting(true);
		const finalCategory = category === "new" ? newCategory : category;

		try {
			if (id) {
				// Update existing template
				const updatedTemplate = await orpc.templates.update.call({
					id,
					category: finalCategory,
					name,
					content,
				});
				toast.success("Textbaustein aktualisiert");
				router.push(`/templates/${updatedTemplate.id}`);
			} else {
				// Create new template
				const newTemplate = await orpc.templates.create.call({
					category: finalCategory,
					name,
					content,
				});
				toast.success("Textbaustein erstellt");
				router.push(`/templates/${newTemplate.id}`);
			}
		} catch (error) {
			console.error("Error saving template:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Fehler beim Speichern des Textbausteins",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

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
									onChange={(e) => setNewCategory(e.target.value)}
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
								onChange={(e) => setName(e.target.value)}
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

					<div className="flex min-h-0 grow flex-col gap-2">
						<div className="min-h-0 flex-1 w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
							{showSource ? (
								<PlainEditor
									note={content}
									onToggleSource={() => {
										editorKeyRef.current += 1;
										setShowSource(false);
									}}
									setContent={setContent}
									showSource={showSource}
								/>
							) : (
								<TipTap
									key={`tiptap-${editorKeyRef.current}`}
									note={content}
									onToggleSource={() => setShowSource(true)}
									onValidationChange={handleValidationChange}
									setContent={setContent}
									showSource={showSource}
								/>
							)}
						</div>

						{/* Error Display Panel */}
						{validationErrors.length > 0 && (
							<div className="mt-2 max-h-32 shrink-0 space-y-2 overflow-y-auto">
								{validationErrors.length > 0 && (
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
																	Zeile{" "}
																	{error.error.location.start?.line ||
																		"unknown"}
																</span>
															)}
															<span className="font-medium text-solarized-red">
																{error.type === "error" ? "Fehler" : "Warnung"}
															</span>
														</div>
														<p className="mt-1 text-solarized-red/90">
															{error.error?.message ||
																"Unbekannter Validierungsfehler"}
														</p>
													</div>
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}
					</div>
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
