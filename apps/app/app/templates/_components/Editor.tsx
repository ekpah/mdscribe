"use client";

import Markdoc from "@markdoc/markdoc";
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
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export default function Editor({
	cat,
	categorySuggestions = [],
	tit,
	note,
	id,
	canEditSource = false,
}: {
	cat: string;
	categorySuggestions?: string[];
	tit: string;
	note: string;
	id?: string;
	canEditSource?: boolean;
}) {
	const router = useRouter();
	const [category, setCategory] = useState<string>(cat);
	const [name, setName] = useState(tit);
	const [content, setContent] = useState(note ? JSON.parse(note) : "");
	const [newCategory, setNewCategory] = useState("");
	const [showSource, setShowSource] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	// Counter to force TipTap remount when switching from source view
	const editorKeyRef = useRef(0);

	// Validation for required fields
	const isFormValid = (() => {
		const finalCategory = category === "new" ? newCategory : category;
		return finalCategory.trim() !== "" && name.trim() !== "";
	})();
	const fallbackCategories = [
		"Kardiologie",
		"Gastroenterologie",
		"Diverses",
		"Onkologie",
	];
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

		for (const value of fallbackCategories) {
			if (result.length >= limit) {
				break;
			}
			addCategory(value);
		}

		return result.slice(0, limit);
	}, [cat, categorySuggestions]);

	const isMarkdocValid = (contentToValidate: string) => {
		try {
			const ast = Markdoc.parse(contentToValidate);
			const validation = Markdoc.validate(ast, markdocConfig);
			return !validation.some((result) => result.type === "error");
		} catch {
			return false;
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isFormValid) {
			return;
		}

		if (!isMarkdocValid(content)) {
			toast.error("Bitte behebe die Markdoc-Fehler vor dem Speichern");
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
									onToggleSource={
										canEditSource ? () => setShowSource(true) : undefined
									}
									setContent={setContent}
									showSource={showSource}
								/>
							)}
						</div>
					</div>
					<div className="flex shrink-0 flex-row gap-2">
						<Button
							className="mt-2 w-full"
							disabled={isSubmitting || !isFormValid}
							type="submit"
						>
							{(() => {
								if (isSubmitting) {
									return "Textbaustein speichern...";
								}
								if (!isFormValid) {
									return "Kategorie und Name erforderlich";
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
