"use client";

import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";

import { USER_MESSAGES } from "@/lib/user-messages";

export interface AdminTemplateRow {
	id: string;
	title: string;
	category: string;
	authorId: string;
	updatedAt: Date | string;
	author: {
		id: string;
		name: string | null;
		email: string;
	} | null;
}

export const getUserDisplayName = (user: { name: string | null; email: string }): string => {
	const trimmedName = user.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}

	return user.email;
};

export const formatTimestamp = (value: Date | string): string => {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return date.toLocaleString("de-DE", {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

const columnHelper = createColumnHelper<AdminTemplateRow>();

export const columns = [
	columnHelper.accessor("title", {
		cell: ({ row, getValue }) => (
			<div className="space-y-1">
				<div className="font-medium text-solarized-base00">{getValue()}</div>
				<div className="text-solarized-base01 text-xs">{row.original.category}</div>
			</div>
		),
		filterFn: (row, id, filterValue: string) => {
			const title = (row.getValue(id) as string).toLowerCase();
			const category = row.original.category.toLowerCase();
			const author = getUserDisplayName(
				row.original.author ?? { email: "", name: null },
			).toLowerCase();
			const search = filterValue.toLowerCase();

			return title.includes(search) || category.includes(search) || author.includes(search);
		},
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={USER_MESSAGES.adminTemplates.template} />
		),
		id: "template",
	}),
	columnHelper.accessor("author", {
		cell: ({ getValue }) => {
			const author = getValue();
			if (!author) {
				return (
					<span className="text-solarized-base01 text-xs">
						{USER_MESSAGES.adminTemplates.unknown}
					</span>
				);
			}

			return (
				<div className="space-y-1">
					<div className="font-medium text-solarized-base00">{getUserDisplayName(author)}</div>
					<div className="text-solarized-base01 text-xs">{author.email}</div>
				</div>
			);
		},
		enableSorting: false,
		header: USER_MESSAGES.adminTemplates.author,
		id: "author",
	}),
	columnHelper.accessor("updatedAt", {
		cell: ({ getValue }) => (
			<span className="text-solarized-base01 text-xs">{formatTimestamp(getValue())}</span>
		),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={USER_MESSAGES.adminTemplates.updated} />
		),
		id: "updatedAt",
	}),
];
