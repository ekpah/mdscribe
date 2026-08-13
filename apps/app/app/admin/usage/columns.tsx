"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { cn } from "@repo/design-system/lib/utils";
import { createColumnHelper } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

import { isScribeDocType } from "@/app/admin/playground/_lib/scribe-doc-types";
import { AI_SCRIBE_GENERATION_EVENT_NAME } from "@/lib/usage-event-names";
import { isByokUsageMetadata } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";

import type { UsageListEvent } from "./types";

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

// Tokens the model generated, reasoning tokens included. Mirrors the SQL in
// orpc/admin/usage.ts: a trustworthy total/input split already accounts for
// reasoning, otherwise fall back to output + reasoning.
const getGeneratedTokens = (
	event: Pick<UsageListEvent, "inputTokens" | "outputTokens" | "reasoningTokens" | "totalTokens">,
): number => {
	const { inputTokens, outputTokens, reasoningTokens, totalTokens } = event;
	if (totalTokens !== null && inputTokens !== null && totalTokens > inputTokens) {
		return totalTokens - inputTokens;
	}
	return (outputTokens ?? 0) + (reasoningTokens ?? 0);
};

const calculateTokensPerSecond = (
	generatedTokens: number | null | undefined,
	durationMs: number | null | undefined,
): number | null => {
	if (!generatedTokens || !durationMs || durationMs <= 0) {
		return null;
	}
	return generatedTokens / (durationMs / 1000);
};

export const formatTokensPerSecond = (
	event: Pick<UsageListEvent, "inputTokens" | "outputTokens" | "reasoningTokens" | "totalTokens">,
	durationMs: number | null | undefined,
): string =>
	formatTokensPerSecondValue(calculateTokensPerSecond(getGeneratedTokens(event), durationMs));

export const formatStatTokensPerSecond = (tokensPerSecond: number | null | undefined): string =>
	formatTokensPerSecondValue(tokensPerSecond ?? null);

export const UsageModelName = ({
	className,
	compact = false,
	metadata,
	model,
}: {
	className?: string;
	compact?: boolean;
	metadata: unknown;
	model: string | null;
}) => {
	const modelLabel = compact ? model?.split("/").pop() : model;
	return (
		<span className={cn("flex min-w-0 items-center gap-1.5", className)}>
			<span className="truncate font-mono text-solarized-base00">{modelLabel || "-"}</span>
			{isByokUsageMetadata(metadata) && (
				<Badge className="shrink-0 border-solarized-violet/40 bg-solarized-violet/10 px-1.5 py-0 text-[10px] text-solarized-violet">
					{USER_MESSAGES.byok.usageBadge}
				</Badge>
			)}
		</span>
	);
};

const getPromptLabel = (metadata: Record<string, unknown> | null): string => {
	if (!metadata) {
		return "-";
	}
	const endpoint = metadata.endpoint as string | undefined;
	const promptLabel = metadata.promptLabel as string | undefined;
	const promptName = metadata.promptName as string | undefined;
	return endpoint ?? promptLabel ?? promptName ?? "-";
};

const promptPrefixStyles = {
	"built-in": "border-solarized-blue/30 bg-solarized-blue/10 text-solarized-blue",
	custom: "border-solarized-violet/30 bg-solarized-violet/10 text-solarized-violet",
	"generate-section": "border-solarized-cyan/30 bg-solarized-cyan/10 text-solarized-cyan",
	"scribe-agent": "border-solarized-orange/30 bg-solarized-orange/10 text-solarized-orange",
} as const;

type PromptPrefix = keyof typeof promptPrefixStyles;

const formatPromptPart = (value: string): string =>
	value === "generateSection" ? "generate-section" : value;

const splitPromptLabel = (
	metadata: Record<string, unknown> | null,
): { prefixes: PromptPrefix[]; value: string } => {
	const label = getPromptLabel(metadata);
	if (label === "-") {
		return { prefixes: [], value: "-" };
	}

	const parts = label.split(":").filter(Boolean).map(formatPromptPart);
	const prefixes: PromptPrefix[] = [];
	let remainingParts = parts;

	for (const prefix of ["custom", "built-in", "scribe-agent", "generate-section"] as const) {
		if (remainingParts[0] === prefix) {
			prefixes.push(prefix);
			remainingParts = remainingParts.slice(1);
		}
	}

	if (label === "scribe-agent" && prefixes.length === 1) {
		const eventType = metadata?.agentEventType;
		return {
			prefixes,
			value:
				typeof eventType === "string" && eventType.length > 0
					? formatPromptPart(eventType)
					: "chat",
		};
	}

	return {
		prefixes,
		value: remainingParts.length > 0 ? remainingParts.join(":") : label,
	};
};

export const UsagePromptBadge = ({
	className,
	metadata,
}: {
	className?: string;
	metadata: Record<string, unknown> | null;
}) => {
	const { prefixes, value } = splitPromptLabel(metadata);
	if (value === "-") {
		return <span className={cn("font-mono text-xs text-solarized-base01", className)}>-</span>;
	}

	const fullLabel = getPromptLabel(metadata);

	return (
		<Badge
			variant="secondary"
			title={fullLabel}
			className={cn(
				"min-w-0 max-w-full gap-1 overflow-hidden px-1.5 py-0.5 font-mono text-xs",
				className,
			)}
		>
			{prefixes.map((prefix) => (
				<span
					key={prefix}
					className={cn(
						"shrink-0 rounded border px-1.5 py-0.5 text-[10px]",
						promptPrefixStyles[prefix],
					)}
				>
					{prefix}
				</span>
			))}
			<span className="min-w-0 truncate">{value}</span>
		</Badge>
	);
};

export const getToolSectionId = (metadata: unknown): string | null => {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	const { sectionId } = metadata as Record<string, unknown>;
	return typeof sectionId === "string" ? sectionId : null;
};

const toolPromptVerbs: Record<string, string> = {
	editSection: "edit",
	generateSection: "generate",
};

const getToolPromptLabel = (name: string, sectionId: string | null): string => {
	const verb = toolPromptVerbs[name] ?? name;
	return sectionId ? `${verb}: ${sectionId}` : verb;
};

export const buildPlaygroundUrl = (event: UsageListEvent): string => {
	const params = new URLSearchParams();
	params.set("referenceUsageEvent", event.id);

	if (event.model) {
		params.set("model", event.model);
	}

	const metadata = event.metadata as Record<string, unknown> | null;
	const endpoint = metadata?.endpoint;
	const promptName = metadata?.promptName;
	let documentType: string | undefined;
	if (typeof endpoint === "string" && isScribeDocType(endpoint)) {
		documentType = endpoint;
	} else if (typeof promptName === "string") {
		documentType = resolvePromptHarnessId(promptName);
	}
	if (documentType) {
		params.set("documentType", documentType);
	}

	const modelConfig = metadata?.modelConfig;
	if (modelConfig && typeof modelConfig === "object" && !Array.isArray(modelConfig)) {
		const config = modelConfig as Record<string, unknown>;
		for (const key of ["maxTokens", "temperature"] as const) {
			const value = config[key];
			if (typeof value === "number" && Number.isFinite(value)) {
				params.set(key, String(value));
			}
		}
		if (typeof config.thinking === "boolean") {
			params.set("thinking", String(config.thinking));
		}
	}

	const reasoningEffort = metadata?.reasoningEffort;
	if (typeof reasoningEffort === "string") {
		params.set("reasoningEffort", reasoningEffort);
	}

	return `/admin/playground?${params.toString()}`;
};

export const canOpenInPlayground = (event: Pick<UsageListEvent, "name" | "rowKind">): boolean => {
	const rowKind = event.rowKind ?? "event";
	return event.name === AI_SCRIBE_GENERATION_EVENT_NAME && rowKind === "event";
};

const columnHelper = createColumnHelper<UsageListEvent>();

export const createColumns = () => [
	columnHelper.accessor("timestamp", {
		cell: (info) => {
			const { row } = info;
			return (
				<div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 12}px` }}>
					{row.getCanExpand() ? (
						<Button
							aria-label={row.getIsExpanded() ? "Ablauf einklappen" : "Ablauf ausklappen"}
							className="size-6 shrink-0"
							onClick={(event) => {
								event.stopPropagation();
								row.toggleExpanded();
							}}
							size="icon"
							type="button"
							variant="ghost"
						>
							<ChevronRight
								className={cn("size-4 transition-transform", row.getIsExpanded() && "rotate-90")}
							/>
						</Button>
					) : (
						<span className="size-6 shrink-0" />
					)}
					<span className="whitespace-nowrap text-xs sm:text-sm">
						{formatDate(info.getValue())}
					</span>
				</div>
			);
		},
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
		cell: (info) => {
			const isTrace = info.row.original.rowKind === "trace";
			const isTool = info.row.original.rowKind === "tool";
			return (
				<Badge
					variant={info.row.original.rowKind === "observation" || isTool ? "secondary" : "outline"}
					className={cn(
						"hidden whitespace-nowrap sm:inline-flex",
						isTrace && "border-solarized-green/50 bg-solarized-green/10 text-solarized-green",
						isTool && "border-solarized-cyan/50 bg-solarized-cyan/10 text-solarized-cyan",
					)}
				>
					{isTool ? "Tool-Aufruf" : info.getValue()}
				</Badge>
			);
		},
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
			const sectionId = getToolSectionId(metadata);
			if (info.row.original.rowKind === "tool") {
				return (
					<Badge
						variant="secondary"
						className="hidden max-w-[190px] font-mono text-xs lg:inline-flex"
					>
						{getToolPromptLabel(info.row.original.name, sectionId)}
					</Badge>
				);
			}
			if (info.row.original.rowKind === "observation") {
				return sectionId ? (
					<Badge
						variant="secondary"
						className="hidden max-w-[190px] font-mono text-xs lg:inline-flex"
					>
						Abschnitt: {sectionId}
					</Badge>
				) : (
					<span className="hidden font-mono text-xs text-solarized-base01 lg:inline">-</span>
				);
			}
			return (
				<UsagePromptBadge metadata={metadata} className="hidden max-w-[190px] lg:inline-flex" />
			);
		},
		enableSorting: false,
		header: () => <span className="hidden lg:inline">Prompt</span>,
		id: "prompt",
	}),
	columnHelper.accessor("model", {
		cell: (info) => (
			<UsageModelName
				className="hidden text-xs md:flex"
				compact
				metadata={info.row.original.metadata}
				model={info.getValue()}
			/>
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
				{formatTokensPerSecond(info.row.original, info.row.original.timeToCompletionMs)}
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
];
