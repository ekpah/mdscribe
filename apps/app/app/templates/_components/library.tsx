"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
	ArrowLeft,
	ArrowRight,
	ChevronDown,
	Ellipsis,
	FileText,
	Folder,
	Plus,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import { serializeCollection } from "@/lib/template-exchange";

import { CopyTemplateMenu } from "./copy-template-menu";
import { ImportTemplatesButton } from "./import-templates-dialog";
import { entryHref, searchEntries, useCollectionMutation, useLibrary } from "./use-library";
import type { Collection, LibraryEntry } from "./use-library";

const EntryRow = ({
	entry,
	collection,
	returnTo,
	adding,
	mutation,
}: {
	entry: LibraryEntry;
	collection?: Collection;
	returnTo: string;
	adding: boolean;
	mutation: ReturnType<typeof useCollectionMutation>;
}) => {
	const href = entryHref(entry, collection?.id, returnTo);
	const input = collection && { collectionId: collection.id, templateId: entry.id };
	return (
		// The title link covers the whole row, so the row itself opens the entry for filling in.
		<div className="relative flex flex-wrap items-center gap-2 px-3 py-1.5 hover:bg-muted/40">
			<FileText className="hidden size-4 shrink-0 text-primary sm:block" />
			<Link
				className="min-w-0 flex-1 rounded-sm text-sm font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
				href={href}
			>
				{entry.title}
			</Link>
			<Badge variant="secondary">{entry.kind === "text" ? "Textvorlage" : "PDF-Formular"}</Badge>
			{adding ? (
				<Button
					className="relative"
					size="sm"
					variant="outline"
					disabled={mutation.isPending || !input}
					onClick={() => {
						if (input) {
							mutation.mutate(() => orpc.user.collections.addTemplate.call(input), {
								onSuccess: () => toast.success("Zur Sammlung hinzugefügt"),
							});
						}
					}}
				>
					<Plus className="size-4" />
					Hinzufügen
				</Button>
			) : (
				<>
					{entry.kind === "text" && (
						<Button
							className="relative"
							size="sm"
							variant="outline"
							aria-label={`${entry.title} mit KI ausfüllen`}
							render={<Link href={`/aiscribe/${entry.id}`} />}
						>
							<Sparkles className="size-4" />
							<span className="max-sm:sr-only">Mit KI ausfüllen</span>
						</Button>
					)}
					{input && (
						<Button
							className="relative"
							size="icon"
							variant="ghost"
							aria-label={`${entry.title} aus Sammlung entfernen`}
							disabled={mutation.isPending}
							onClick={() =>
								mutation.mutate(() => orpc.user.collections.removeTemplate.call(input))
							}
						>
							<X className="size-4" />
						</Button>
					)}
				</>
			)}
		</div>
	);
};

const EntryTable = ({
	state: { collection, returnTo },
	items,
	searching,
	adding = false,
}: {
	state: LibraryState;
	items: LibraryEntry[];
	searching: boolean;
	adding?: boolean;
}) => {
	const mutation = useCollectionMutation();
	return (
		<div className="divide-y rounded-lg border">
			{items.map((entry) => (
				<EntryRow
					key={`${entry.kind}:${entry.id}`}
					entry={entry}
					collection={collection}
					returnTo={returnTo}
					adding={adding}
					mutation={mutation}
				/>
			))}
			{!items.length && (
				<p className="p-8 text-center text-sm text-muted-foreground">
					{searching
						? "Keine passenden Vorlagen gefunden."
						: "Noch keine Vorlagen. Füge eine vorhandene hinzu oder erstelle eine neue."}
				</p>
			)}
		</div>
	);
};

const useLibraryState = (view: "collections" | "templates") => {
	const params = useSearchParams();
	const pathname = usePathname();
	const collectionId = params.get("collection");
	const showCollections = view === "collections" && !collectionId;
	const library = useLibrary(showCollections || collectionId ? "collections" : "templates");
	const collection = library.collections.data?.find((item) => item.id === collectionId);
	const query = params.get(collectionId ? "filter" : "query") ?? "";
	const kind = collectionId ? "all" : (params.get("type") ?? "all");
	const [dialog, setDialog] = useState<"create" | "edit" | "delete" | "add" | null>(null);
	const updateParam = (key: string, value: string) => {
		const next = new URLSearchParams(window.location.search);
		if (value) {
			next.set(key, value);
		} else {
			next.delete(key);
		}
		window.history.replaceState(null, "", `${pathname}?${next}${window.location.hash}`);
	};
	const returnTo = `${pathname}${params.size ? `?${params}` : ""}`;
	return {
		...library,
		collection,
		collectionId,
		dialog,
		kind,
		query,
		returnTo,
		setDialog,
		showCollections,
		updateParam,
	};
};

type LibraryState = ReturnType<typeof useLibraryState>;

/** Copies the open collection in the exchange format, to paste into another installation. */
const CopyCollectionMenu = ({ collection }: { collection: Collection }) => (
	<CopyTemplateMenu
		label="Sammlung kopieren"
		loadText={async () => {
			const exported = await orpc.user.collections.export.call({ id: collection.id });
			return serializeCollection(
				{ description: exported.description ?? undefined, title: exported.name },
				exported.templates,
			);
		}}
		size="default"
		successMessage="Sammlung kopiert"
		title={collection.name}
	/>
);

/** Paste templates into the library, or copy the open collection. */
const ExchangeActions = ({ state }: { state: LibraryState }) => {
	const { collection, collectionId, session } = state;
	if (collection?.entries.length) {
		return <CopyCollectionMenu collection={collection} />;
	}
	return session?.user && !collectionId ? <ImportTemplatesButton /> : null;
};

const LibraryHeader = ({ state }: { state: LibraryState }) => {
	const { collection, collectionId, showCollections, session, setDialog } = state;
	let title = collectionId ? "Sammlung" : "Vorlagen";
	if (showCollections) {
		title = "Meine Sammlungen";
	}
	return (
		<header className="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">{collection?.name ?? title}</h1>
				<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
					{collection?.description ||
						(showCollections
							? "Deine privaten Sammlungen für den Klinikalltag."
							: "Textvorlagen und PDF-Formulare an einem Ort.")}
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<ExchangeActions state={state} />
				{showCollections && session?.user && (
					<Button onClick={() => setDialog("create")}>
						<Plus className="size-4" />
						Sammlung erstellen
					</Button>
				)}
				{!showCollections && (!collectionId || collection) && session?.user && (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button>
									<Plus className="size-4" />
									Vorlage
									<ChevronDown className="size-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							{collection && (
								<>
									<DropdownMenuItem onClick={() => setDialog("add")}>
										Vorhandene hinzufügen
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem render={<Link href="/templates/create" />}>
								Textvorlage erstellen
							</DropdownMenuItem>
							<DropdownMenuItem render={<Link href="/documents/create" />}>
								PDF-Formular erstellen
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				{collection && (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="outline" size="icon" aria-label="Sammlung verwalten">
									<Ellipsis className="size-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setDialog("edit")}>
								Name und Beschreibung ändern
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setDialog("delete")}>
								Sammlung löschen
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</header>
	);
};

const LibraryFilters = ({ state }: { state: LibraryState }) => {
	const { collectionId, query, kind, updateParam } = state;
	const searchLabel = collectionId ? "In dieser Sammlung suchen" : "Vorlagen suchen";
	return (
		<div className="flex flex-wrap items-center gap-3">
			<div className="relative min-w-48 flex-1">
				<Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
				<Input
					className="pl-9"
					aria-label={searchLabel}
					placeholder={`${searchLabel}…`}
					type="search"
					value={query}
					onChange={(event) => updateParam(collectionId ? "filter" : "query", event.target.value)}
				/>
			</div>
			{!collectionId && (
				<Select value={kind} onValueChange={(value) => updateParam("type", value)}>
					<SelectTrigger aria-label="Vorlagentyp" className="w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Alle Typen</SelectItem>
						<SelectItem value="text">Textvorlagen</SelectItem>
						<SelectItem value="pdf">PDF-Formulare</SelectItem>
					</SelectContent>
				</Select>
			)}
		</div>
	);
};

const CollectionResults = ({ state }: { state: LibraryState }) => {
	const { collections, session } = state;
	if (!session?.user) {
		return (
			<p className="py-8 text-sm">
				Bitte{" "}
				<Link className="text-primary underline" href="/sign-in?redirect=%2Fcollections">
					anmelden
				</Link>
				, um Sammlungen zu verwenden.
			</p>
		);
	}
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{collections.data?.map((item) => (
				<Link
					className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
					href={`/collections?collection=${encodeURIComponent(item.id)}`}
					key={item.id}
				>
					<Folder className="mt-1 size-5 shrink-0 text-primary" />
					<div className="min-w-0 flex-1">
						<h2 className="font-medium">{item.name}</h2>
						<p className="mt-1 text-xs text-muted-foreground">{item.entries.length} Vorlagen</p>
						<p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
					</div>
					<ArrowRight className="mt-1 size-4 shrink-0" />
				</Link>
			))}
			{!collections.data?.length && (
				<p className="py-8 text-sm text-muted-foreground">
					Noch keine Sammlungen. Erstelle deine erste private Sammlung.
				</p>
			)}
		</div>
	);
};

const TemplateResults = ({ state }: { state: LibraryState }) => {
	const { collection, entries, kind, query } = state;
	const visibleEntries = searchEntries(
		(collection?.entries ?? entries).filter((entry) => kind === "all" || entry.kind === kind),
		query,
	);
	return (
		<>
			<p className="text-xs text-muted-foreground">{visibleEntries.length} Vorlagen</p>
			<EntryTable state={state} items={visibleEntries} searching={Boolean(query)} />
		</>
	);
};

const AddCollectionEntries = ({ state }: { state: LibraryState }) => {
	const { collection, entries, texts, documents } = state;
	const [query, setQuery] = useState("");
	if (texts.isPending || documents.isPending) {
		return <output>Wird geladen…</output>;
	}
	if (texts.error || documents.error) {
		return <p role="alert">Vorlagen konnten nicht geladen werden.</p>;
	}
	const items = searchEntries(
		entries.filter(
			(entry) => entry.kind === "text" && !collection?.entries.some((item) => item.id === entry.id),
		),
		query,
	);
	return (
		<>
			<Input
				aria-label="Vorlage zum Hinzufügen suchen"
				type="search"
				placeholder="Vorlagen suchen…"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<EntryTable state={state} items={items} searching={Boolean(query)} adding />
		</>
	);
};

const dialogCopy = {
	add: ["Vorlagen hinzufügen", "Vorhandene Textvorlagen auswählen."],
	create: ["Sammlung erstellen", "Name und Beschreibung helfen dir beim Wiederfinden."],
	delete: [
		"Sammlung löschen?",
		"Nur die Sammlung wird gelöscht. Die enthaltenen Vorlagen bleiben erhalten.",
	],
	edit: ["Sammlung bearbeiten", "Name und Beschreibung helfen dir beim Wiederfinden."],
} as const;

const CollectionDialog = ({
	state,
	dialog,
}: {
	state: LibraryState;
	dialog: NonNullable<LibraryState["dialog"]>;
}) => {
	const { collection, setDialog } = state;
	const router = useRouter();
	const [name, setName] = useState(dialog === "edit" ? (collection?.name ?? "") : "");
	const [description, setDescription] = useState(
		dialog === "edit" ? (collection?.description ?? "") : "",
	);
	const [confirmName, setConfirmName] = useState("");
	const mutation = useCollectionMutation();
	const [title, dialogDescription] = dialogCopy[dialog];
	return (
		<Dialog open onOpenChange={() => setDialog(null)}>
			<DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{dialogDescription}</DialogDescription>
				</DialogHeader>
				{mutation.error && (
					<p role="alert">{mutation.error.message || "Änderung fehlgeschlagen"}</p>
				)}
				{dialog === "add" && <AddCollectionEntries state={state} />}
				{dialog === "delete" && collection && (
					// Typing the name confirms which collection goes.
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							mutation.mutate(async () => {
								await orpc.user.collections.delete.call({ id: collection.id });
								setDialog(null);
								router.push("/collections");
							});
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="collection-delete-name">
								Zur Bestätigung „{collection.name}“ eingeben
							</Label>
							<Input
								autoComplete="off"
								id="collection-delete-name"
								onChange={(event) => setConfirmName(event.target.value)}
								value={confirmName}
							/>
						</div>
						<Button
							type="submit"
							variant="destructive"
							disabled={mutation.isPending || confirmName.trim() !== collection.name.trim()}
						>
							Sammlung endgültig löschen
						</Button>
					</form>
				)}
				{(dialog === "create" || dialog === "edit") && (
					<form
						className="space-y-4"
						onSubmit={async (event) => {
							event.preventDefault();
							const input = { description: description.trim(), name: name.trim() };
							try {
								await mutation.mutateAsync(async () => {
									if (dialog === "create") {
										const created = await orpc.user.collections.create.call(input);
										router.push(`/collections?collection=${encodeURIComponent(created.id)}`);
									} else if (collection) {
										await orpc.user.collections.update.call({ ...input, id: collection.id });
									}
								});
								setDialog(null);
							} catch {
								// The mutation already reports the error.
							}
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="collection-name">Name</Label>
							<Input
								id="collection-name"
								disabled={mutation.isPending}
								required
								maxLength={100}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="collection-description">Beschreibung</Label>
							<Textarea
								id="collection-description"
								disabled={mutation.isPending}
								maxLength={500}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</div>
						<Button type="submit" disabled={mutation.isPending || !name.trim()}>
							Speichern
						</Button>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
};

const LibraryResults = ({ state }: { state: LibraryState }) => {
	const { loading, error, collectionId, collection, showCollections } = state;
	if (loading) {
		return <output className="block py-8 text-sm text-muted-foreground">Wird geladen…</output>;
	}
	if (error) {
		return (
			<p role="alert">Die Bibliothek konnte nicht geladen werden. Bitte lade die Seite erneut.</p>
		);
	}
	if (collectionId && !collection) {
		return (
			<p role="alert">
				Sammlung nicht gefunden oder kein Zugriff. Melde dich mit einem berechtigten Konto an.
			</p>
		);
	}
	return showCollections ? <CollectionResults state={state} /> : <TemplateResults state={state} />;
};

export const Library = ({ view }: { view: "collections" | "templates" }) => {
	const state = useLibraryState(view);
	const { collectionId, dialog, showCollections } = state;
	return (
		<div className="h-full w-full overflow-y-auto rounded-xl border bg-background">
			<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
				{collectionId && (
					<Button size="sm" variant="ghost" render={<Link href="/collections" />}>
						<ArrowLeft className="size-4" />
						Sammlungen
					</Button>
				)}
				<LibraryHeader state={state} />
				{!showCollections && <LibraryFilters state={state} />}
				<LibraryResults state={state} />
			</div>
			{dialog && (
				<CollectionDialog key={`${collectionId}:${dialog}`} state={state} dialog={dialog} />
			)}
		</div>
	);
};
