"use client";

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

/** Chooses which of the admin's collections `/aiscribe` offers by default. */
export const AiScribeTab = () => {
	const queryClient = useQueryClient();
	const current = useQuery(orpc.admin.templates.aiScribeCollection.queryOptions());
	const collections = useQuery(orpc.user.collections.list.queryOptions());
	const save = useMutation(
		orpc.admin.templates.setAiScribeCollection.mutationOptions({
			onError: () => toast.error("Sammlung konnte nicht gespeichert werden."),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.admin.templates.aiScribeCollection.queryKey(),
				});
				toast.success("AI Scribe Sammlung gespeichert");
			},
		}),
	);
	const selected = collections.data?.find(
		(collection) => collection.id === current.data?.collectionId,
	);

	return (
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
				{selected ? (
					<ul className="list-inside list-disc text-muted-foreground text-sm">
						{selected.templates.map((template) => (
							<li key={template.id}>{template.title}</li>
						))}
					</ul>
				) : null}
			</CardContent>
		</Card>
	);
};
