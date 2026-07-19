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
	DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";

interface TextSnippet {
	id: string;
	key: string;
	snippet: string;
	createdAt: Date;
	updatedAt: Date;
}

export const SnippetsCard = () => {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingSnippet, setEditingSnippet] = useState<TextSnippet | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [formData, setFormData] = useState({ key: "", snippet: "" });
	const queryClient = useQueryClient();

	const { data: snippets = [], isLoading } = useQuery(orpc.user.snippets.list.queryOptions());

	const createMutation = useMutation(
		orpc.user.snippets.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.user.snippets.list.queryOptions().queryKey,
				});
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.user.snippets.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.user.snippets.list.queryOptions().queryKey,
				});
			},
		}),
	);

	const deleteMutation = useMutation(
		orpc.user.snippets.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.user.snippets.list.queryOptions().queryKey,
				});
			},
		}),
	);

	const handleOpenDialog = useCallback((snippet?: TextSnippet) => {
		if (snippet) {
			setEditingSnippet(snippet);
			setFormData({ key: snippet.key, snippet: snippet.snippet });
		} else {
			setEditingSnippet(null);
			setFormData({ key: "", snippet: "" });
		}
		setIsDialogOpen(true);
	}, []);

	const handleCloseDialog = useCallback(() => {
		setIsDialogOpen(false);
		setEditingSnippet(null);
		setFormData({ key: "", snippet: "" });
	}, []);

	const handleSave = useCallback(async () => {
		if (!(formData.key.trim() && formData.snippet.trim())) {
			toast.error("Bitte füllen Sie alle Felder aus");
			return;
		}

		try {
			if (editingSnippet) {
				await updateMutation.mutateAsync({
					id: editingSnippet.id,
					key: formData.key,
					snippet: formData.snippet,
				});
				toast.success("Text-Snippet aktualisiert");
			} else {
				await createMutation.mutateAsync({
					key: formData.key,
					snippet: formData.snippet,
				});
				toast.success("Text-Snippet erstellt");
			}
			handleCloseDialog();
		} catch (error) {
			console.error("Error saving snippet:", error);
			toast.error(
				editingSnippet
					? "Fehler beim Aktualisieren des Text-Snippets"
					: "Fehler beim Erstellen des Text-Snippets",
			);
		}
	}, [
		createMutation,
		editingSnippet,
		formData.key,
		formData.snippet,
		handleCloseDialog,
		updateMutation,
	]);

	const handleDelete = useCallback(
		async (id: string) => {
			try {
				await deleteMutation.mutateAsync({ id });
				toast.success("Text-Snippet gelöscht");
			} catch (error) {
				console.error("Error deleting snippet:", error);
				toast.error("Fehler beim Löschen des Text-Snippets");
			} finally {
				setPendingDeleteId(null);
			}
		},
		[deleteMutation],
	);

	const handleCreateSnippetClick = useCallback(() => {
		handleOpenDialog();
	}, [handleOpenDialog]);

	const handleDeleteRequest = useCallback((id: string) => {
		setPendingDeleteId(id);
	}, []);

	const handleDeleteCancel = useCallback(() => {
		setPendingDeleteId(null);
	}, []);

	const handleSnippetKeyChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setFormData((previous) => ({ ...previous, key: event.target.value }));
	}, []);

	const handleSnippetTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setFormData((previous) => ({ ...previous, snippet: event.target.value }));
	}, []);

	const editSnippetHandlers = useMemo(() => {
		const handlers: Record<string, () => void> = {};
		for (const snippet of snippets) {
			handlers[snippet.id] = () => {
				handleOpenDialog(snippet);
			};
		}
		return handlers;
	}, [handleOpenDialog, snippets]);

	const deleteConfirmHandlers = useMemo(() => {
		const handlers: Record<string, () => Promise<void>> = {};
		for (const snippet of snippets) {
			handlers[snippet.id] = async () => {
				try {
					await handleDelete(snippet.id);
				} catch (error) {
					console.error("Error deleting snippet:", error);
				}
			};
		}
		return handlers;
	}, [handleDelete, snippets]);

	const deleteRequestHandlers = useMemo(() => {
		const handlers: Record<string, () => void> = {};
		for (const snippet of snippets) {
			handlers[snippet.id] = () => {
				handleDeleteRequest(snippet.id);
			};
		}
		return handlers;
	}, [handleDeleteRequest, snippets]);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Text-Snippets</CardTitle>
						<CardDescription>
							Verwalten Sie Ihre persönlichen Text-Snippets für schnellen Zugriff mit{" "}
							<kbd className="rounded bg-muted px-1 text-xs">Shift+F2</kbd>
						</CardDescription>
					</div>
					<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
						<DialogTrigger render={<Button onClick={handleCreateSnippetClick} size="sm" type="button">
								<Plus className="mr-2 h-4 w-4" />
								Hinzufügen
							</Button>} />
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									{editingSnippet ? "Text-Snippet bearbeiten" : "Neues Text-Snippet"}
								</DialogTitle>
								<DialogDescription>
									Erstellen Sie ein Kürzel, das Sie später mit Shift+F2 einfügen können.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="key">Kürzel</Label>
									<Input
										id="key"
										maxLength={50}
										onChange={handleSnippetKeyChange}
										placeholder="z.B. ty"
										value={formData.key}
									/>
									<p className="text-muted-foreground text-xs">
										Das Kürzel, das Sie eingeben, um das Text-Snippet zu verwenden
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="snippet">Text</Label>
									<Textarea
										className="min-h-[150px]"
										id="snippet"
										maxLength={5000}
										onChange={handleSnippetTextChange}
										placeholder="z.B. Vielen Dank für Ihre Zeit"
										value={formData.snippet}
									/>
									<p className="text-muted-foreground text-xs">
										Der Text, der eingefügt wird, wenn Sie das Kürzel aufrufen
									</p>
								</div>
							</div>
							<DialogFooter>
								<Button onClick={handleCloseDialog} type="button" variant="outline">
									Abbrechen
								</Button>
								<Button onClick={handleSave} type="button">
									{editingSnippet ? "Aktualisieren" : "Erstellen"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading && (
					<div className="py-8 text-center text-muted-foreground">Lade Text-Snippets...</div>
				)}
				{!isLoading && snippets?.length === 0 && (
					<div className="py-8 text-center text-muted-foreground">
						<p>Keine Text-Snippets vorhanden</p>
						<p className="mt-2 text-sm">Erstellen Sie Ihr erstes Text-Snippet, um loszulegen</p>
					</div>
				)}
				{!isLoading && snippets && snippets.length > 0 && (
					<div className="space-y-2">
						{snippets.map((snippet) => {
							const isDeletePending = pendingDeleteId === snippet.id;
							const handleEditSnippet = editSnippetHandlers[snippet.id];
							const handleDeleteConfirm = deleteConfirmHandlers[snippet.id];
							const handleDeleteRequestClick = deleteRequestHandlers[snippet.id];
							if (!handleEditSnippet || !handleDeleteConfirm || !handleDeleteRequestClick) {
								return null;
							}

							return (
								<div
									className="flex items-start justify-between rounded-lg border p-3"
									key={snippet.id}
								>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 font-mono text-sm">
												{snippet.key}
											</code>
										</div>
										<p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
											{snippet.snippet}
										</p>
									</div>
									<div className="flex gap-1">
										<Button onClick={handleEditSnippet} size="sm" type="button" variant="ghost">
											<Edit2 className="h-4 w-4" />
										</Button>
										{isDeletePending ? (
											<>
												<Button
													onClick={handleDeleteConfirm}
													size="sm"
													type="button"
													variant="destructive"
												>
													Löschen
												</Button>
												<Button
													onClick={handleDeleteCancel}
													size="sm"
													type="button"
													variant="ghost"
												>
													Abbrechen
												</Button>
											</>
										) : (
											<Button
												onClick={handleDeleteRequestClick}
												size="sm"
												type="button"
												variant="ghost"
											>
												<Trash2 className="h-4 w-4 text-solarized-red" />
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
