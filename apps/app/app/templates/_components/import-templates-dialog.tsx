"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import type { ParsedExchange } from "@/lib/template-exchange";
import { ExchangeFormatError, looksLikeExchange, parseExchange } from "@/lib/template-exchange";

const isEditableTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const Problem = ({ children }: { children: string }) => (
	<p className="flex gap-2 text-destructive text-sm" role="alert">
		<TriangleAlert className="mt-0.5 size-4 shrink-0" />
		<span>{children}</span>
	</p>
);

/**
 * Paste a copied template or collection into this installation. Ctrl+V outside input fields
 * opens it with the clipboard text; the button opens it empty for pasting or picking a file.
 */
export const ImportTemplatesButton = () => {
	const queryClient = useQueryClient();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [preview, setPreview] = useState<ParsedExchange | null>(null);
	const [selected, setSelected] = useState<boolean[]>([]);
	const [error, setError] = useState<string | null>(null);

	const read = (raw: string) => {
		setText(raw);
		setOpen(true);
		try {
			const parsed = parseExchange(raw);
			setPreview(parsed);
			setSelected(parsed.entries.map((entry) => entry.ok));
			setError(null);
		} catch (error_) {
			setPreview(null);
			setError(
				error_ instanceof ExchangeFormatError
					? error_.message
					: "Der Text konnte nicht gelesen werden.",
			);
		}
	};

	const close = () => {
		setOpen(false);
		setText("");
		setPreview(null);
		setError(null);
	};

	useEffect(() => {
		const handlePaste = (event: ClipboardEvent) => {
			const pasted = event.clipboardData?.getData("text/plain") ?? "";
			if (open || isEditableTarget(event.target) || !looksLikeExchange(pasted)) {
				return;
			}
			event.preventDefault();
			read(pasted);
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	});

	const templates = (preview?.entries ?? []).flatMap((entry, index) =>
		entry.ok && selected[index] ? [entry.template] : [],
	);

	const importMutation = useMutation(
		orpc.templates.import.mutationOptions({
			onError: (error_) => toast.error(error_.message || "Import fehlgeschlagen"),
			onSuccess: async ({ collectionId, templateIds }) => {
				await Promise.all(
					[orpc.templates.list, orpc.templates.authored, orpc.user.collections.list].map((query) =>
						queryClient.invalidateQueries({ queryKey: query.queryOptions().queryKey }),
					),
				);
				toast.success(
					templateIds.length === 1
						? "Vorlage importiert"
						: `${templateIds.length} Vorlagen importiert`,
				);
				close();
				// Open what was pasted: the new collection, or the single template.
				router.push(
					collectionId
						? `/collections?collection=${encodeURIComponent(collectionId)}`
						: `/templates/${templateIds[0]}`,
				);
			},
		}),
	);

	const startImport = () =>
		importMutation.mutate({
			collection: preview?.collection
				? {
						description: preview.collection.description,
						name: preview.collection.title.slice(0, 100),
					}
				: null,
			templates,
		});

	let title = "Vorlagen einfügen";
	if (preview?.collection) {
		title = `Sammlung „${preview.collection.title}“ einfügen`;
	} else if (preview) {
		title = "Vorlage einfügen";
	}

	return (
		<>
			<Button onClick={() => setOpen(true)} type="button" variant="outline">
				<ClipboardPaste className="size-4" />
				Vorlagen einfügen
			</Button>
			<Dialog onOpenChange={(next) => (next ? setOpen(true) : close())} open={open}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>
							{preview
								? "Hinweise und Beispiele werden mit übernommen."
								: "Füge eine kopierte Vorlage oder Sammlung ein, oder wähle eine heruntergeladene .md-Datei."}
						</DialogDescription>
					</DialogHeader>

					{error && <Problem>{error}</Problem>}

					{preview ? (
						<div className="grid min-w-0 gap-3">
							{preview.problems.map((problem) => (
								<Problem key={problem}>
									{`${problem} Kopiere die Sammlung neu oder importiere nur die vollständigen Vorlagen.`}
								</Problem>
							))}
							<ul className="max-h-80 divide-y overflow-y-auto rounded-lg border px-3">
								{preview.entries.map((entry, index) => (
									// Entries have no id; their position in the pasted text is stable.
									// oxlint-disable-next-line react/no-array-index-key
									<li className="grid gap-1 py-2" key={index}>
										<label className="flex min-w-0 items-center gap-2">
											<Checkbox
												checked={entry.ok && selected[index]}
												disabled={!entry.ok}
												onCheckedChange={(checked) =>
													setSelected((current) =>
														current.map((value, i) => (i === index ? checked : value)),
													)
												}
											/>
											<span className="min-w-0 flex-1 truncate">
												{entry.ok ? entry.template.title : (entry.title ?? "Unbekannte Vorlage")}
											</span>
											{entry.ok ? (
												<span className="text-muted-foreground text-xs">
													{entry.template.examples.length}{" "}
													{entry.template.examples.length === 1 ? "Beispiel" : "Beispiele"}
												</span>
											) : (
												<Badge variant="destructive">Unvollständig</Badge>
											)}
										</label>
										{!entry.ok && <p className="pl-6 text-destructive text-sm">{entry.error}</p>}
									</li>
								))}
							</ul>
						</div>
					) : (
						<div className="grid gap-3">
							<Textarea
								aria-label="Kopierter Text"
								className="max-h-60 min-h-32 font-mono text-xs"
								onChange={(event) => setText(event.target.value)}
								placeholder={"---\nmdscribe: template/v1\n…"}
								value={text}
							/>
							<input
								accept=".md,.markdown,.txt,text/markdown,text/plain"
								className="text-sm"
								onChange={async (event) => {
									const file = event.target.files?.[0];
									if (file) {
										read(await file.text());
									}
								}}
								type="file"
							/>
						</div>
					)}

					<DialogFooter>
						{preview ? (
							<>
								<Button onClick={() => setPreview(null)} type="button" variant="outline">
									Zurück
								</Button>
								<Button
									disabled={templates.length === 0 || importMutation.isPending}
									onClick={startImport}
									type="button"
								>
									{importMutation.isPending
										? "Importiere…"
										: `${templates.length} ${templates.length === 1 ? "Vorlage" : "Vorlagen"} importieren`}
								</Button>
							</>
						) : (
							<Button disabled={!text.trim()} onClick={() => read(text)} type="button">
								Vorschau
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};
