"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { Eye } from "lucide-react";
import type { Prisma } from "@repo/database";

export type UsageEventWithUser = Prisma.UsageEventGetPayload<{
	include: { user: { select: { id: true; name: true; email: true } } };
}>;

function formatDate(date: Date | string) {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(dateObj);
}

function formatCost(cost: unknown): string {
	if (cost === null || cost === undefined) return "-";
	const num = typeof cost === "number" ? cost : Number(cost);
	if (Number.isNaN(num)) return "-";
	return `$${num.toFixed(4)}`;
}

const columnHelper = createColumnHelper<UsageEventWithUser>();

export const createColumns = (
	onViewDetails: (id: string) => void,
) => [
	columnHelper.accessor("timestamp", {
		id: "timestamp",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Zeitpunkt" />
		),
		cell: (info) => (
			<span className="whitespace-nowrap text-xs sm:text-sm">
				{formatDate(info.getValue())}
			</span>
		),
	}),
	columnHelper.accessor("user", {
		id: "user",
		header: "Benutzer",
		cell: (info) => {
			const user = info.getValue();
			return (
				<div className="flex flex-col">
					<span className="max-w-[120px] truncate font-medium text-solarized-base00 sm:max-w-none">
						{user.name || "Kein Name"}
					</span>
					<span className="hidden text-xs text-solarized-base01 sm:block">
						{user.email}
					</span>
				</div>
			);
		},
		filterFn: (row, id, filterValue: string) => {
			const user = row.getValue(id) as { name: string | null; email: string };
			const search = filterValue.toLowerCase();
			return (
				(user.name?.toLowerCase().includes(search) ?? false) ||
				user.email.toLowerCase().includes(search)
			);
		},
		enableSorting: false,
	}),
	columnHelper.accessor("name", {
		id: "action",
		header: () => <span className="hidden sm:inline">Aktion</span>,
		cell: (info) => (
			<Badge
				variant="outline"
				className="hidden whitespace-nowrap sm:inline-flex"
			>
				{info.getValue()}
			</Badge>
		),
		filterFn: (row, id, filterValue: string) => {
			const name = row.getValue(id) as string;
			return name.toLowerCase().includes(filterValue.toLowerCase());
		},
		enableSorting: false,
	}),
	columnHelper.accessor("model", {
		id: "model",
		header: () => <span className="hidden md:inline">Modell</span>,
		cell: (info) => (
			<span className="hidden font-mono text-xs md:inline">
				{info.getValue()?.split("/").pop() || "-"}
			</span>
		),
		enableSorting: false,
	}),
	columnHelper.accessor("cost", {
		id: "cost",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Kosten" />
		),
		cell: (info) => (
			<span className="whitespace-nowrap font-mono text-xs">
				{formatCost(info.getValue())}
			</span>
		),
	}),
	columnHelper.accessor("totalTokens", {
		id: "tokens",
		header: ({ column }) => (
			<span className="hidden sm:inline">
				<DataTableColumnHeader column={column} title="Tokens" />
			</span>
		),
		cell: (info) => (
			<span className="hidden font-mono text-xs sm:inline">
				{info.getValue()?.toLocaleString("de-DE") ?? "-"}
			</span>
		),
	}),
	columnHelper.display({
		id: "actions",
		header: "",
		cell: ({ row }) => (
			<Button
				variant="ghost"
				size="icon"
				onClick={(e) => {
					e.stopPropagation();
					onViewDetails(row.original.id);
				}}
				className="h-8 w-8"
			>
				<Eye className="h-4 w-4" />
			</Button>
		),
	}),
];
