"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export type Collection = NonNullable<ReturnType<typeof useLibrary>["collections"]["data"]>[number];
export interface LibraryEntry {
	id: string;
	title: string;
	kind: "text" | "pdf";
}

/** Loads templates and private collections; `loading`/`error` describe whichever of the two `scope` needs. */
export const useLibrary = (scope: "collections" | "templates", enabled = true) => {
	const { data: session, isPending: sessionPending } = useSession();
	const collections = useQuery({
		...orpc.user.collections.list.queryOptions(),
		// The current collection's name is shown before any list is opened.
		enabled: Boolean(session?.user) && (enabled || scope === "collections"),
		select: (items) =>
			items.map((collection) => ({
				...collection,
				entries: collection.templates.map((entry) => ({ ...entry, kind: "text" as const })),
			})),
	});
	const texts = useQuery({ ...orpc.templates.list.queryOptions(), enabled });
	const documents = useQuery({ ...orpc.documents.templates.list.queryOptions(), enabled });
	const entries: LibraryEntry[] = [
		...(texts.data ?? []).map((entry) => ({ ...entry, kind: "text" as const })),
		...(documents.data ?? []).map((entry) => ({ ...entry, kind: "pdf" as const })),
	];
	const status =
		scope === "collections"
			? {
					error: collections.error,
					loading: sessionPending || (Boolean(session?.user) && collections.isPending),
				}
			: { error: texts.error || documents.error, loading: texts.isPending || documents.isPending };
	return { collections, documents, entries, session, texts, ...status };
};

/** Runs a collection change, toasts failures and refreshes the collection list. */
export const useCollectionMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (action: () => Promise<unknown>) => action(),
		onError: (error) => toast.error(error.message || "Änderung fehlgeschlagen"),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: orpc.user.collections.list.queryOptions().queryKey,
			}),
	});
};

export const searchEntries = (entries: LibraryEntry[], query: string) => {
	const term = query.trim().toLocaleLowerCase("de");
	return entries
		.filter((entry) => entry.title.toLocaleLowerCase("de").includes(term))
		.toSorted((a, b) => a.title.localeCompare(b.title, "de"));
};

export const entryHref = (entry: LibraryEntry, collectionId?: string, returnTo?: string) => {
	const params = new URLSearchParams();
	if (collectionId) {
		params.set("collection", collectionId);
	}
	if (returnTo) {
		params.set("returnTo", returnTo);
	}
	const query = params.toString();
	return `/${entry.kind === "pdf" ? "documents" : "templates"}/${entry.id}${query ? `?${query}` : ""}`;
};
