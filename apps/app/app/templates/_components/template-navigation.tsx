"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { entryHref, searchEntries, useLibrary } from "./use-library";
import type { Collection, LibraryEntry } from "./use-library";

const NavigationResults = ({
	library,
	collectionId,
	collection,
	query,
	returnTo,
	entry,
	aiscribe,
}: {
	library: ReturnType<typeof useLibrary>;
	collectionId?: string;
	collection?: Collection;
	query: string;
	returnTo: string;
	entry: LibraryEntry;
	aiscribe: boolean;
}) => {
	if (library.loading) {
		return <output className="block p-3 text-sm text-muted-foreground">Wird geladen…</output>;
	}
	if (library.error) {
		return (
			<p role="alert" className="p-3 text-sm">
				Vorlagen konnten nicht geladen werden.
			</p>
		);
	}
	if (collectionId && !collection) {
		return (
			<p role="alert" className="p-3 text-sm">
				Sammlung nicht gefunden oder kein Zugriff.
			</p>
		);
	}
	const options = searchEntries(collection?.entries ?? library.entries, query).filter(
		(item) => !aiscribe || item.kind === "text",
	);
	return (
		<>
			{options.map((item) => (
				<DropdownMenuItem
					key={`${item.kind}:${item.id}`}
					render={
						<Link
							href={
								aiscribe
									? `/aiscribe/${item.id}${collectionId ? `?collection=${encodeURIComponent(collectionId)}` : ""}`
									: entryHref(item, collectionId, returnTo)
							}
						/>
					}
				>
					<span className="flex-1 whitespace-normal">{item.title}</span>
					<span className="text-xs text-muted-foreground">
						{item.kind === "pdf" ? "PDF" : "Text"}
						{item.id === entry.id && item.kind === entry.kind ? " ✓" : ""}
					</span>
				</DropdownMenuItem>
			))}
			{!options.length && (
				<p className="p-3 text-sm text-muted-foreground">Keine Vorlagen gefunden.</p>
			)}
		</>
	);
};

/** The breadcrumb's collection: "Alle Vorlagen" or a collection, switched from its menu. */
const CollectionCrumb = ({
	collection,
	collectionId,
	collections,
	loading,
	onOpen,
	returnTo,
	signedIn,
}: {
	collection?: Collection;
	collectionId?: string;
	collections: ReturnType<typeof useLibrary>["collections"];
	loading: boolean;
	onOpen: () => void;
	returnTo: string;
	signedIn: boolean;
}) => {
	const pathname = usePathname();
	return signedIn ? (
		<DropdownMenu onOpenChange={(open) => open && onOpen()}>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						className="max-w-32 shrink-0 text-muted-foreground sm:max-w-56"
						aria-label="Sammlung wechseln"
					>
						<span className="truncate">{collection?.name || "Alle Vorlagen"}</span>
						<ChevronDown className="size-4 shrink-0" />
					</Button>
				}
			/>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuItem render={<Link href={pathname} />}>
					<span className="flex-1">Alle Vorlagen</span>
					{!collectionId && <Check className="size-4" />}
				</DropdownMenuItem>
				{loading && (
					<output className="block p-2 text-sm text-muted-foreground">Wird geladen…</output>
				)}
				{collections.data?.map((item) => (
					<DropdownMenuItem
						key={item.id}
						render={<Link href={`${pathname}?collection=${encodeURIComponent(item.id)}`} />}
					>
						<span className="flex-1 truncate">{item.name}</span>
						{item.id === collectionId && <Check className="size-4" />}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem render={<Link href={returnTo} />}>
					{collection ? "Sammlung öffnen" : "Bibliothek öffnen"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	) : (
		<Button
			variant="ghost"
			size="sm"
			className="shrink-0 text-muted-foreground"
			render={<Link href={returnTo} />}
		>
			Vorlagen
		</Button>
	);
};

/**
 * A breadcrumb: the collection, switchable or opened from its menu, then a switcher between
 * its templates; `aiscribe` switches between their AI Scribe pages.
 */
export const TemplateNavigation = ({
	aiscribe = false,
	entry,
}: {
	aiscribe?: boolean;
	entry: LibraryEntry;
}) => {
	const params = useSearchParams();
	const collectionId = params.get("collection") ?? undefined;
	// The template lists load once a dropdown first opens, not with every page.
	const [hasOpened, setHasOpened] = useState(false);
	const library = useLibrary(collectionId ? "collections" : "templates", hasOpened);
	const { collections, session } = library;
	const collection = collections.data?.find((item) => item.id === collectionId);
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const requestedReturn = params.get("returnTo") ?? "";
	let returnTo = collectionId
		? `/collections?collection=${encodeURIComponent(collectionId)}`
		: "/templates";
	if (/^\/(collections|templates)(\?|$)/.test(requestedReturn)) {
		returnTo = requestedReturn;
	}
	return (
		<nav aria-label="Brotkrumen" className="flex min-w-0 items-center gap-0.5">
			<CollectionCrumb
				collection={collection}
				collectionId={collectionId}
				collections={collections}
				loading={hasOpened && collections.isPending}
				onOpen={() => setHasOpened(true)}
				returnTo={returnTo}
				signedIn={Boolean(session?.user)}
			/>
			<span aria-hidden="true" className="text-muted-foreground">
				/
			</span>
			<DropdownMenu
				onOpenChange={(open) => {
					setQuery("");
					setHasOpened((opened) => opened || open);
				}}
				onOpenChangeComplete={(open) => {
					if (open) {
						searchRef.current?.focus();
					}
				}}
			>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							className="min-w-0 shrink justify-start text-left"
							aria-label="Template wechseln"
						>
							<span className="truncate">{entry.title}</span>
							<ChevronDown className="size-4 shrink-0" />
						</Button>
					}
				/>
				<DropdownMenuContent
					align="start"
					className="max-h-[70dvh] w-80 max-w-[90vw] overflow-y-auto"
				>
					<div className="p-2">
						<Input
							ref={searchRef}
							aria-label="Template zum Wechseln suchen"
							placeholder={collection ? `In ${collection.name} suchen…` : "Vorlagen suchen…"}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (!["Escape", "Tab", "ArrowDown", "ArrowUp"].includes(event.key)) {
									event.stopPropagation();
								}
							}}
						/>
					</div>
					<NavigationResults
						library={library}
						collectionId={collectionId}
						collection={collection}
						query={query}
						returnTo={returnTo}
						entry={entry}
						aiscribe={aiscribe}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
		</nav>
	);
};
