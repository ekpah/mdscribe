"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Loader2, Medal } from "lucide-react";

import { EvaluationDetailsDialog } from "@/app/admin/_components/evaluation-details-dialog";
import {
	allScribeDocTypes,
	isScribeDocType,
	scribeDocTypeUi,
} from "@/app/admin/playground/_lib/scribe-doc-types";
import type { DocumentType } from "@/orpc/scribe/types";

import type { UsageEvaluation, UsageListEvent } from "./types";

const promptNameToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

const inferDocumentType = (metadata: Record<string, unknown> | null): DocumentType | undefined => {
	if (!metadata) {
		return undefined;
	}

	const { endpoint } = metadata;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		if (isScribeDocType(endpoint)) {
			return endpoint;
		}
	}

	const { promptName } = metadata;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptNameToDocumentType.get(promptName);
	}

	return undefined;
};

export const formatDate = (date: Date | string) => {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
	}).format(dateObj);
};

export const formatCost = (cost: unknown): string => {
	if (cost === null || cost === undefined) {
		return "-";
	}
	const num = typeof cost === "number" ? cost : Number(cost);
	if (Number.isNaN(num)) {
		return "-";
	}
	return `$${num.toFixed(4)}`;
};

export const formatDuration = (durationMs: number | null | undefined): string => {
	if (durationMs === null || durationMs === undefined) {
		return "-";
	}
	if (durationMs < 1000) {
		return `${durationMs.toLocaleString("de-DE")} ms`;
	}
	return `${(durationMs / 1000).toLocaleString("de-DE", {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	})} s`;
};

const formatTokensPerSecondValue = (tokensPerSecond: number | null): string => {
	if (tokensPerSecond === null) {
		return "-";
	}
	return `${tokensPerSecond.toLocaleString("de-DE", {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
	})} Tok/s`;
};

const calculateTokensPerSecond = (
	outputTokens: number | null | undefined,
	durationMs: number | null | undefined,
): number | null => {
	if (!outputTokens || !durationMs || durationMs <= 0) {
		return null;
	}
	return outputTokens / (durationMs / 1000);
};

export const formatTokensPerSecond = (
	outputTokens: number | null | undefined,
	durationMs: number | null | undefined,
): string => formatTokensPerSecondValue(calculateTokensPerSecond(outputTokens, durationMs));

export const formatStatTokensPerSecond = (
	tokensPerSecond: number | null | undefined,
): string => formatTokensPerSecondValue(tokensPerSecond ?? null);

export const getUsageEvaluation = (metadata: unknown): UsageEvaluation | null => {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	const evaluation = (metadata as Record<string, unknown>).usageEvaluation;
	if (!evaluation || typeof evaluation !== "object" || Array.isArray(evaluation)) {
		return null;
	}
	const totalScore = (evaluation as Record<string, unknown>).totalScore;
	if (typeof totalScore !== "number" || !Number.isFinite(totalScore)) {
		return null;
	}
	return evaluation as UsageEvaluation;
};

export const formatScore = (score: number | undefined): string =>
	score === undefined ? "-" : score.toFixed(1);

export const getPromptLabel = (metadata: Record<string, unknown> | null): string => {
	if (!metadata) {
		return "-";
	}
	const endpoint = metadata.endpoint as string | undefined;
	const promptName = metadata.promptName as string | undefined;
	return endpoint ?? promptName ?? "-";
};

export const buildPlaygroundUrl = (event: UsageListEvent): string => {
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
		const modelConfig = metadata.modelConfig as Record<string, unknown> | undefined;
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
};

const columnHelper = createColumnHelper<UsageListEvent>();

interface CreateColumnsOptions {
	evaluatingEventId?: string;
	onEvaluate?: (id: string) => void;
}

export const createColumns = ({ evaluatingEventId, onEvaluate }: CreateColumnsOptions = {}) => [
	columnHelper.accessor("timestamp", {
		cell: (info) => (
			<span className="whitespace-nowrap text-xs sm:text-sm">{formatDate(info.getValue())}</span>
		),
		header: ({ column }) => <DataTableColumnHeader column={column} title="Zeitpunkt" />,
		id: "timestamp",
	}),
	columnHelper.accessor("user", {
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
					<span className="hidden text-xs text-solarized-base01 sm:block">{user.email}</span>
				</div>
			);
		},
		enableSorting: false,
		filterFn: (row, id, filterValue: string) => {
			const user = row.getValue(id) as {
				name: string | null;
				email: string;
			} | null;
			if (!user) {
				return false;
			}
			const search = filterValue.toLowerCase();
			return (
				(user.name?.toLowerCase().includes(search) ?? false) ||
				user.email.toLowerCase().includes(search)
			);
		},
		header: "Benutzer",
		id: "user",
	}),
	columnHelper.accessor("name", {
		cell: (info) => (
			<Badge variant="outline" className="hidden whitespace-nowrap sm:inline-flex">
				{info.getValue()}
			</Badge>
		),
		enableSorting: false,
		filterFn: (row, id, filterValue: string) => {
			const name = row.getValue(id) as string;
			return name.toLowerCase().includes(filterValue.toLowerCase());
		},
		header: () => <span className="hidden sm:inline">Aktion</span>,
		id: "action",
	}),
	columnHelper.accessor("metadata", {
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
		header: () => <span className="hidden lg:inline">Prompt</span>,
		id: "prompt",
	}),
	columnHelper.accessor("model", {
		cell: (info) => (
			<span className="hidden font-mono text-xs md:inline">
				{info.getValue()?.split("/").pop() || "-"}
			</span>
		),
		enableSorting: false,
		header: () => <span className="hidden md:inline">Modell</span>,
		id: "model",
	}),
	columnHelper.accessor("totalTokens", {
		cell: (info) => (
			<span className="hidden font-mono text-xs sm:inline">
				{info.getValue()?.toLocaleString("de-DE") ?? "-"}
			</span>
		),
		enableSorting: false,
		header: ({ column }) => (
			<span className="hidden sm:inline">
				<DataTableColumnHeader column={column} title="Tokens" />
			</span>
		),
		id: "tokens",
	}),
	columnHelper.accessor("timeToCompletionMs", {
		cell: (info) => (
			<span className="hidden whitespace-nowrap font-mono text-xs xl:inline">
				{formatDuration(info.getValue())}
			</span>
		),
		enableSorting: false,
		header: ({ column }) => (
			<span className="hidden xl:inline">
				<DataTableColumnHeader column={column} title="Dauer" />
			</span>
		),
		id: "duration",
	}),
	columnHelper.display({
		cell: (info) => (
			<span className="hidden whitespace-nowrap font-mono text-xs xl:inline">
				{formatTokensPerSecond(
					info.row.original.outputTokens,
					info.row.original.timeToCompletionMs,
				)}
			</span>
		),
		enableSorting: false,
		header: () => <span className="hidden xl:inline">Tok/s</span>,
		id: "tokensPerSecond",
	}),
	columnHelper.accessor("cost", {
		cell: (info) => (
			<span className="whitespace-nowrap font-mono text-xs">{formatCost(info.getValue())}</span>
		),
		enableSorting: false,
		header: ({ column }) => <DataTableColumnHeader column={column} title="Kosten" />,
		id: "cost",
	}),
	columnHelper.accessor("metadata", {
		cell: (info) => {
			const evaluation = getUsageEvaluation(info.getValue());
			const event = info.row.original;
			const isEvaluating = evaluatingEventId === event.id;
			const canEvaluate = Boolean(onEvaluate && !isEvaluating);

			if (!evaluation || evaluation.categories.length === 0) {
				return (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={!canEvaluate}
						onClick={(event_) => {
							event_.stopPropagation();
							onEvaluate?.(event.id);
						}}
						className="h-6 gap-1 px-1 font-mono text-xs text-solarized-base00"
					>
						{isEvaluating ? (
							<Loader2 className="h-3 w-3 animate-spin text-solarized-orange" />
						) : (
							<Medal className="h-3 w-3 text-solarized-yellow" />
						)}
						{isEvaluating ? "..." : "-"}
					</Button>
				);
			}

			return (
				<EvaluationDetailsDialog
					canRegenerate={canEvaluate}
					evaluation={evaluation}
					isRegenerating={isEvaluating}
					onRegenerate={() => onEvaluate?.(event.id)}
					trigger={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={(event_) => event_.stopPropagation()}
							className="h-6 gap-1 px-1 font-mono text-xs text-solarized-base00"
						>
							<Medal className="h-3 w-3 text-solarized-yellow" />
							{formatScore(evaluation.totalScore)}
						</Button>
					}
				/>
			);
		},
		enableSorting: false,
		header: "Score",
		id: "score",
	}),
];
