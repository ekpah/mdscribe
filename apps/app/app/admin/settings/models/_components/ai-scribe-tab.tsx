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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";

const NONE = "none";

/** Runs the one-time conversion of the old AI Vorlagen and Brief-Baukästen. */
const ConvertAiScribeFormsCard = () => {
	const queryClient = useQueryClient();
	const pending = useQuery(
		orpc.admin.templates.convertAiScribeForms.queryOptions({ input: { dryRun: true } }),
	);
	const convert = useMutation(
		orpc.admin.templates.convertAiScribeForms.mutationOptions({
			onError: (error) => toast.error(error.message || "Übernahme fehlgeschlagen."),
			onSuccess: async ({ entries: created }) => {
				await queryClient.invalidateQueries({
					queryKey: orpc.admin.templates.convertAiScribeForms.key(),
				});
				toast.success(`Übernommen: ${created.length}`);
			},
		}),
	);
	const entries = pending.data?.entries ?? [];
	const missingStandards = pending.data?.missingStandards ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Vorlagen und Brief-Baukästen übernehmen</CardTitle>
				<CardDescription>
					Wandelt die bisherigen AI Vorlagen und Brief-Baukästen einmalig in Textvorlagen um. Alte
					Links leiten danach auf die neue Vorlage weiter; globale Einträge gehören danach Ihnen.
					Bereits übernommene Einträge werden übersprungen.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{pending.isSuccess && entries.length === 0 ? (
					<p className="text-muted-foreground text-sm">Alles übernommen.</p>
				) : null}
				{entries.length > 0 ? (
					<>
						<ul className="list-inside list-disc text-muted-foreground text-sm">
							{entries.map((entry) => (
								<li key={entry.id}>
									{entry.title}
									{entry.visibility === "private" ? " (privat)" : ""}
								</li>
							))}
						</ul>
						{missingStandards.length > 0 ? (
							<p className="text-solarized-red text-sm" role="alert">
								Zuerst oben die AI Scribe Sammlung mit den Standardvorlagen wählen. Es fehlen:{" "}
								{missingStandards.join(", ")}.
							</p>
						) : null}
						<Button
							disabled={convert.isPending || missingStandards.length > 0}
							onClick={() => convert.mutate({ dryRun: false })}
						>
							Jetzt übernehmen ({entries.length})
						</Button>
					</>
				) : null}
			</CardContent>
		</Card>
	);
};

/** Chooses which of the admin's collections `/aiscribe` offers by default. */
export const AiScribeTab = () => {
	const queryClient = useQueryClient();
	const createStandard = useMutation(
		orpc.admin.templates.createAiScribeStandard.mutationOptions({
			onError: (error) =>
				toast.error(error.message || "Standardvorlagen konnten nicht angelegt werden."),
			onSuccess: async ({ created }) => {
				// New templates, a new collection and a new AI Scribe collection: refresh them all.
				await queryClient.invalidateQueries();
				toast.success(`${created} Standardvorlagen angelegt`);
			},
		}),
	);
	const current = useQuery(orpc.admin.templates.aiScribeCollection.queryOptions());
	const collections = useQuery(orpc.user.collections.list.queryOptions());
	const save = useMutation(
		orpc.admin.templates.setAiScribeCollection.mutationOptions({
			onError: () => toast.error("Sammlung konnte nicht gespeichert werden."),
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: orpc.admin.templates.aiScribeCollection.queryKey(),
					}),
					// The conversion's dry run depends on the collection's standard templates.
					queryClient.invalidateQueries({
						queryKey: orpc.admin.templates.convertAiScribeForms.key(),
					}),
				]);
				toast.success("AI Scribe Sammlung gespeichert");
			},
		}),
	);
	const selected = collections.data?.find(
		(collection) => collection.id === current.data?.collectionId,
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>AI Scribe Standardvorlagen</CardTitle>
					<CardDescription>
						Die Vorlagen dieser Sammlung erscheinen auf der AI Scribe Seite. Vorlagen mit mehreren
						Abschnitten öffnen sich als Brief-Editor. Die Sammlung selbst bearbeiten Sie unter{" "}
						<Link className="underline" href="/collections">
							Sammlungen
						</Link>
						.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<Select
						disabled={current.isLoading || collections.isLoading || save.isPending}
						onValueChange={(value) =>
							save.mutate({ collectionId: value && value !== NONE ? value : null })
						}
						value={current.data?.collectionId ?? NONE}
					>
						<SelectTrigger className="w-full sm:w-96">
							<SelectValue placeholder="Sammlung auswählen" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE}>Keine Sammlung</SelectItem>
							{collections.data?.map((collection) => (
								<SelectItem key={collection.id} value={collection.id}>
									{collection.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{current.isSuccess && !current.data.collectionId ? (
						<div className="space-y-2 rounded-md border border-dashed p-3">
							<p className="text-muted-foreground text-sm">
								Noch keine Sammlung gewählt. Legt einmalig die Sammlung „AI Scribe Standard“ mit den
								10 Standardvorlagen an (Briefe und einzelne Abschnitte, öffentlich) und wählt sie
								hier aus.
							</p>
							<Button disabled={createStandard.isPending} onClick={() => createStandard.mutate({})}>
								Standardvorlagen anlegen
							</Button>
						</div>
					) : null}
					{selected ? (
						<ul className="list-inside list-disc text-muted-foreground text-sm">
							{selected.templates.map((template) => (
								<li key={template.id}>{template.title}</li>
							))}
						</ul>
					) : null}
				</CardContent>
			</Card>
			<ConvertAiScribeFormsCard />
		</div>
	);
};
