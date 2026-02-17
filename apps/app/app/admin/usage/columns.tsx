"use client";

import type { UsageEvent, User } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { createColumnHelper } from "@tanstack/react-table";
import { FlaskConical, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { DocumentType } from "@/orpc/scribe/types";
import {
	allScribeDocTypes,
	scribeDocTypeUi,
} from "../playground/_lib/scribe-doc-types";

export type UsageEventWithUser = UsageEvent & {
	user: Pick<User, "id" | "name" | "email"> | null;
};

const promptNameToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

function inferDocumentType(
	metadata: Record<string, unknown> | null,
): DocumentType | undefined {
	if (!metadata) return undefined;

	const endpoint = metadata.endpoint;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		return endpoint as DocumentType;
	}

	const promptName = metadata.promptName;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptNameToDocumentType.get(promptName);
	}

	return undefined;
}

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

function getPromptLabel(metadata: Record<string, unknown> | null): string {
	if (!metadata) return "-";
	const endpoint = metadata.endpoint as string | undefined;
	const promptName = metadata.promptName as string | undefined;
	return endpoint ?? promptName ?? "-";
}

function buildPlaygroundUrl(event: UsageEventWithUser): string {
	const params = new URLSearchParams();
	params.set("referenceUsageEvent", event.id);

	if (event.model) {
		params.set("model", event.model);
	}

	const metadata = event.metadata as Record<string, unknown> | null;
	const documentType = inferDocumentType(metadata);
	if (documentType) {
		params.set("documentType", documentType);
	}

	if (metadata) {
		const modelConfig = metadata.modelConfig as
			| Record<string, unknown>
			| undefined;
		if (modelConfig?.temperature !== undefined) {
			params.set("temperature", String(modelConfig.temperature));
		}
		if (modelConfig?.maxTokens !== undefined) {
			params.set("maxTokens", String(modelConfig.maxTokens));
		}
		if (metadata.thinkingEnabled) {
			params.set("thinking", "true");
			if (metadata.thinkingBudget !== undefined) {
				params.set("thinkingBudget", String(metadata.thinkingBudget));
			}
		}
	}

	return `/admin/playground?${params.toString()}`;
}

const columnHelper = createColumnHelper<UsageEventWithUser>();

export const createColumns = (onViewDetails: (id: string) => void) => [
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
			if (!user) {
				return <span className="text-solarized-base01">Unbekannt</span>;
			}
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
			const user = row.getValue(id) as {
				name: string | null;
				email: string;
			} | null;
			if (!user) return false;
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
	columnHelper.accessor("metadata", {
		id: "prompt",
		header: () => <span className="hidden lg:inline">Prompt</span>,
		cell: (info) => {
			const metadata = info.getValue() as Record<string, unknown> | null;
			return (
				<Badge
					variant="secondary"
					className="hidden max-w-[120px] truncate whitespace-nowrap font-mono text-xs lg:inline-flex"
				>
					{getPromptLabel(metadata)}
				</Badge>
			);
		},
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
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={(e) => e.stopPropagation()}
						className="h-8 w-8"
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onClick={(e) => {
							e.stopPropagation();
							onViewDetails(row.original.id);
						}}
					>
						Details anzeigen
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link
							href={buildPlaygroundUrl(row.original)}
							onClick={(e) => e.stopPropagation()}
							className="flex items-center gap-2"
						>
							<FlaskConical className="h-4 w-4" />
							Im Playground öffnen
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		),
	}),
];
