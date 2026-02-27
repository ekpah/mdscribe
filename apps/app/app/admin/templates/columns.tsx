"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle2, Users, XCircle } from "lucide-react";

export interface AdminTemplateRow {
	id: string;
	title: string;
	category: string;
	authorId: string;
	updatedAt: Date | string;
	hasEmbedding: boolean;
	author: {
		id: string;
		name: string | null;
		email: string;
	} | null;
	favouriteOf: Array<{
		id: string;
		name: string | null;
		email: string;
	}>;
	_count: {
		favouriteOf: number;
	};
}

export function getUserDisplayName(user: {
	name: string | null;
	email: string;
}): string {
	const trimmedName = user.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}

	return user.email;
}

function formatTimestamp(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return date.toLocaleString("de-DE", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

const columnHelper = createColumnHelper<AdminTemplateRow>();

export const columns = [
	columnHelper.accessor("title", {
		id: "template",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Vorlage" />
		),
		cell: ({ row, getValue }) => (
			<div className="space-y-1">
				<div className="font-medium text-solarized-base00">{getValue()}</div>
				<div className="text-solarized-base01 text-xs">
					{row.original.category}
				</div>
			</div>
		),
		filterFn: (row, id, filterValue: string) => {
			const title = (row.getValue(id) as string).toLowerCase();
			const category = row.original.category.toLowerCase();
			const author = getUserDisplayName(
				row.original.author ?? { name: null, email: "" },
			).toLowerCase();
			const search = filterValue.toLowerCase();

			return (
				title.includes(search) ||
				category.includes(search) ||
				author.includes(search)
			);
		},
	}),
	columnHelper.accessor("author", {
		id: "author",
		header: "Autor",
		cell: ({ getValue }) => {
			const author = getValue();
			if (!author) {
				return <span className="text-solarized-base01 text-xs">Unbekannt</span>;
			}

			return (
				<div className="space-y-1">
					<div className="font-medium text-solarized-base00">
						{getUserDisplayName(author)}
					</div>
					<div className="text-solarized-base01 text-xs">{author.email}</div>
				</div>
			);
		},
		enableSorting: false,
	}),
	columnHelper.accessor("_count.favouriteOf", {
		id: "favourites",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Favoriten" />
		),
		cell: ({ row, getValue }) => {
			const visibleFavouriteUsers = row.original.favouriteOf.slice(0, 2);
			const remainingFavourites = Math.max(
				0,
				row.original.favouriteOf.length - visibleFavouriteUsers.length,
			);

			return (
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Users className="h-3.5 w-3.5 text-solarized-base01" />
						<span className="font-medium text-solarized-base00">
							{getValue()}
						</span>
					</div>
					{visibleFavouriteUsers.length > 0 && (
						<div className="text-solarized-base01 text-xs">
							{visibleFavouriteUsers
								.map((favUser) => getUserDisplayName(favUser))
								.join(", ")}
							{remainingFavourites > 0 ? ` +${remainingFavourites}` : ""}
						</div>
					)}
				</div>
			);
		},
	}),
	columnHelper.accessor("hasEmbedding", {
		id: "embedding",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Embedding" />
		),
		cell: ({ getValue }) =>
			getValue() ? (
				<Badge
					variant="outline"
					className="border-solarized-green/40 text-solarized-green"
				>
					<CheckCircle2 className="mr-1 h-3.5 w-3.5" />
					Vorhanden
				</Badge>
			) : (
				<Badge
					variant="outline"
					className="border-solarized-orange/40 text-solarized-orange"
				>
					<XCircle className="mr-1 h-3.5 w-3.5" />
					Fehlt
				</Badge>
			),
	}),
	columnHelper.accessor("updatedAt", {
		id: "updatedAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Aktualisiert" />
		),
		cell: ({ getValue }) => (
			<span className="text-solarized-base01 text-xs">
				{formatTimestamp(getValue())}
			</span>
		),
	}),
];
