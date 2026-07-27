"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { DataTable, DataTableViewOptions } from "@repo/design-system/components/ui/data-table";
import type { DataTableRenderToolbarProps } from "@repo/design-system/components/ui/data-table";
import { Input } from "@repo/design-system/components/ui/input";
import { SearchableSelect } from "@repo/design-system/components/ui/searchable-select";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Loader2, Medal, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { EvaluationDetailsDialog } from "@/app/admin/_components/evaluation-details-dialog";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

import { UsageEventDetail } from "./_components/usage-event-detail";
import { UsageTrendChart } from "./_components/usage-trend-chart-dynamic";
import {
	buildPlaygroundUrl,
	canOpenInPlayground,
	createColumns,
	formatCost,
	formatDate,
	formatDuration,
	getToolSectionId,
	getUsageEvaluation,
	formatScore,
	formatStatTokensPerSecond,
	formatTokensPerSecond,
	UsagePromptBadge,
} from "./columns";
import type {
	StatsFilter,
	UsageDetailEvent,
	UsageEvaluation,
	UsageListEvent,
	UsageTrendMetric,
} from "./types";

interface UsageFilters {
	action?: string;
	model?: string;
	prompt?: string;
	userId?: string;
}

interface UsageFilterOptions {
	actions: string[];
	models: string[];
	prompts: string[];
}

const filterLabels: Record<StatsFilter, string> = {
	all: "Gesamt",
	month: "Monat",
	today: "Heute",
	week: "Woche",
};

const trendMetricStyles: Record<
	UsageTrendMetric,
	{
		active: string;
		dot: string;
		text: string;
		value: string;
	}
> = {
	cost: {
		active: "border-solarized-green/50 bg-solarized-green/10",
		dot: "bg-solarized-green",
		text: "text-solarized-green",
		value: "text-solarized-green",
	},
	events: {
		active: "border-solarized-blue/50 bg-solarized-blue/10",
		dot: "bg-solarized-blue",
		text: "text-solarized-blue",
		value: "text-solarized-base00",
	},
	timeToCompletionMs: {
		active: "border-solarized-violet/50 bg-solarized-violet/10",
		dot: "bg-solarized-violet",
		text: "text-solarized-violet",
		value: "text-solarized-violet",
	},
	timeToFirstTokenMs: {
		active: "border-solarized-blue/50 bg-solarized-blue/10",
		dot: "bg-solarized-blue",
		text: "text-solarized-blue",
		value: "text-solarized-blue",
	},
	tokens: {
		active: "border-solarized-cyan/50 bg-solarized-cyan/10",
		dot: "bg-solarized-cyan",
		text: "text-solarized-cyan",
		value: "text-solarized-cyan",
	},
	tokensPerSecond: {
		active: "border-solarized-orange/50 bg-solarized-orange/10",
		dot: "bg-solarized-orange",
		text: "text-solarized-orange",
		value: "text-solarized-orange",
	},
};

const StatsMetricButton = ({
	isActive,
	label,
	metric,
	onSelect,
	value,
}: {
	isActive: boolean;
	label: string;
	metric: UsageTrendMetric;
	onSelect: (metric: UsageTrendMetric) => void;
	value: ReactNode;
}) => {
	const styles = trendMetricStyles[metric];

	return (
		<button
			type="button"
			onClick={() => onSelect(metric)}
			className={cn(
				"min-h-[58px] rounded-md border border-transparent p-2 text-left transition-colors hover:border-solarized-base2 hover:bg-solarized-base3/70",
				isActive && styles.active,
			)}
		>
			<p
				className={cn(
					"text-xs font-medium text-solarized-base01 sm:text-sm",
					isActive && styles.text,
				)}
			>
				{label}
			</p>
			<p
				className={cn(
					"mt-1 inline-flex items-center gap-1.5 text-base font-semibold sm:text-lg",
					styles.value,
					isActive && styles.text,
				)}
			>
				<span
					className={cn("hidden h-2 w-2 rounded-full", isActive && "inline-block", styles.dot)}
				/>
				{value}
			</p>
		</button>
	);
};

const UsageToolbar = ({
	table,
	searchFilter,
	onSearchFilterChange,
}: {
	table: DataTableRenderToolbarProps<UsageListEvent>["table"];
	searchFilter: string;
	onSearchFilterChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) => (
	<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
		<Input
			placeholder="Benutzer oder Aktion suchen..."
			value={searchFilter}
			onChange={onSearchFilterChange}
			className="w-full md:max-w-sm"
		/>
		<div className="hidden md:block">
			<DataTableViewOptions table={table} />
		</div>
	</div>
);

const UsageFilterSelect = ({
	items,
	label,
	onValueChange,
	placeholder,
	value,
}: {
	items: { label: string; value: string }[];
	label: string;
	onValueChange: (value: string) => void;
	placeholder: string;
	value?: string;
}) => (
	<div className="min-w-0">
		<label
			className="mb-1 block text-xs font-medium text-solarized-base01"
			htmlFor={`usage-filter-${label}`}
		>
			{label}
		</label>
		<SearchableSelect
			className="bg-solarized-base3"
			emptyMessage={USER_MESSAGES.searchableSelect.empty}
			id={`usage-filter-${label}`}
			onValueChange={onValueChange}
			options={[{ label: "Alle", value: "all" }, ...items]}
			placeholder={placeholder}
			searchPlaceholder={USER_MESSAGES.searchableSelect.search}
			value={value ?? "all"}
		/>
	</div>
);

const UsageFilterControls = ({
	filters,
	onFiltersChange,
	options,
	users,
}: {
	filters: UsageFilters;
	onFiltersChange: (filters: UsageFilters) => void;
	options?: UsageFilterOptions;
	users: { email: string; id: string; name: string | null }[];
}) => {
	const updateFilter = (key: keyof UsageFilters, value: string) => {
		onFiltersChange({ ...filters, [key]: value === "all" ? undefined : value });
	};

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<UsageFilterSelect
				label="Benutzer"
				placeholder="Benutzer auswählen"
				value={filters.userId}
				onValueChange={(value) => updateFilter("userId", value)}
				items={users.map((currentUser) => ({
					label: currentUser.name
						? `${currentUser.name} (${currentUser.email})`
						: currentUser.email,
					value: currentUser.id,
				}))}
			/>
			<UsageFilterSelect
				label="Aktion"
				placeholder="Aktion auswählen"
				value={filters.action}
				onValueChange={(value) => updateFilter("action", value)}
				items={(options?.actions ?? []).map((value) => ({ label: value, value }))}
			/>
			<UsageFilterSelect
				label="Prompt"
				placeholder="Prompt auswählen"
				value={filters.prompt}
				onValueChange={(value) => updateFilter("prompt", value)}
				items={(options?.prompts ?? []).map((value) => ({ label: value, value }))}
			/>
			<UsageFilterSelect
				label="Modell"
				placeholder="Modell auswählen"
				value={filters.model}
				onValueChange={(value) => updateFilter("model", value)}
				items={(options?.models ?? []).map((value) => ({ label: value, value }))}
			/>
		</div>
	);
};

const LoadingMetricValue = () => <Loader2 className="h-4 w-4 animate-spin" />;

const formatLoadedNumber = (isLoading: boolean, value?: number | null) => {
	if (isLoading) {
		return <LoadingMetricValue />;
	}
	return value?.toLocaleString("de-DE") ?? "-";
};

const formatLoadedCost = (isLoading: boolean, value?: number | null) => {
	if (isLoading) {
		return <LoadingMetricValue />;
	}
	if (value === undefined || value === null) {
		return "-";
	}
	return `$${value.toFixed(2)}`;
};

const formatLoadedDuration = (isLoading: boolean, value?: number | null) => {
	if (isLoading) {
		return <LoadingMetricValue />;
	}
	return formatDuration(value);
};

const formatLoadedTokensPerSecond = (isLoading: boolean, value?: number | null) => {
	if (isLoading) {
		return <LoadingMetricValue />;
	}
	return formatStatTokensPerSecond(value);
};

const UsageLoadingState = () => (
	<div className="p-4 sm:p-6">
		<div className="mx-auto max-w-6xl">
			<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
				<div className="flex items-center gap-2 text-solarized-base01">
					<Loader2 className="h-5 w-5 animate-spin" />
					<span className="text-sm sm:text-base">Events werden geladen...</span>
				</div>
			</div>
		</div>
	</div>
);

const UsageErrorState = ({ message }: { message: string }) => (
	<div className="p-4 sm:p-6">
		<div className="mx-auto max-w-6xl">
			<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
				<div className="space-y-2 text-center">
					<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
					<h2 className="text-base font-semibold text-solarized-base00 sm:text-lg">
						Seite konnte nicht geladen werden
					</h2>
					<p className="text-sm text-solarized-base01 sm:text-base">{message}</p>
				</div>
			</div>
		</div>
	</div>
);

const UsageStatsCard = ({
	averageCompletionLabel,
	averageFirstTokenLabel,
	onStatsFilterChange,
	onTrendMetricChange,
	statsFilter,
	tokensPerSecondLabel,
	totalCostLabel,
	totalEventsLabel,
	totalTokensLabel,
	trendMetric,
}: {
	averageCompletionLabel: ReactNode;
	averageFirstTokenLabel: ReactNode;
	onStatsFilterChange: (value: string) => void;
	onTrendMetricChange: (metric: UsageTrendMetric) => void;
	statsFilter: StatsFilter;
	tokensPerSecondLabel: ReactNode;
	totalCostLabel: ReactNode;
	totalEventsLabel: ReactNode;
	totalTokensLabel: ReactNode;
	trendMetric: UsageTrendMetric;
}) => (
	<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
		<CardContent className="p-4 sm:pt-6">
			<div className="mb-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
				{(Object.keys(filterLabels) as StatsFilter[]).map((filter) => {
					const isActive = statsFilter === filter;
					return (
						<Button
							key={filter}
							type="button"
							variant="outline"
							onClick={() => onStatsFilterChange(filter)}
							className={cn(
								"h-9 w-full border-solarized-base2 bg-solarized-base3 text-solarized-base01 shadow-none hover:border-solarized-blue/40 hover:bg-solarized-blue/10 hover:text-solarized-blue",
								isActive &&
									"border-solarized-blue bg-solarized-blue/10 text-solarized-blue hover:border-solarized-blue hover:bg-solarized-blue/10 hover:text-solarized-blue",
							)}
						>
							{filterLabels[filter]}
						</Button>
					);
				})}
			</div>

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
				<StatsMetricButton
					isActive={trendMetric === "events"}
					label="Events"
					metric="events"
					onSelect={onTrendMetricChange}
					value={totalEventsLabel}
				/>
				<StatsMetricButton
					isActive={trendMetric === "tokens"}
					label="Tokens"
					metric="tokens"
					onSelect={onTrendMetricChange}
					value={totalTokensLabel}
				/>
				<StatsMetricButton
					isActive={trendMetric === "timeToFirstTokenMs"}
					label="Erster Token"
					metric="timeToFirstTokenMs"
					onSelect={onTrendMetricChange}
					value={averageFirstTokenLabel}
				/>
				<StatsMetricButton
					isActive={trendMetric === "timeToCompletionMs"}
					label="Dauer"
					metric="timeToCompletionMs"
					onSelect={onTrendMetricChange}
					value={averageCompletionLabel}
				/>
				<StatsMetricButton
					isActive={trendMetric === "tokensPerSecond"}
					label="Tokens/s"
					metric="tokensPerSecond"
					onSelect={onTrendMetricChange}
					value={tokensPerSecondLabel}
				/>
				<StatsMetricButton
					isActive={trendMetric === "cost"}
					label="Kosten"
					metric="cost"
					onSelect={onTrendMetricChange}
					value={totalCostLabel}
				/>
			</div>
		</CardContent>
	</Card>
);

const UsageMobileCards = ({
	evaluatingEventId,
	isEvaluating,
	items,
	onEvaluate,
	onSelectById,
}: {
	evaluatingEventId?: string;
	isEvaluating: boolean;
	items: UsageListEvent[];
	onEvaluate: (id: string) => void;
	onSelectById: Record<string, () => void>;
}) => (
	<div className="space-y-3 md:hidden">
		{items.length === 0 ? (
			<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 p-4 text-sm text-solarized-base01">
				Keine Events gefunden.
			</div>
		) : (
			items.map((item) => {
				const promptMetadata = item.metadata as Record<string, unknown> | null;
				const evaluation = getUsageEvaluation(item.metadata);
				const isEvaluatingItem = isEvaluating && evaluatingEventId === item.id;
				const canUsePlayground = canOpenInPlayground(item);
				const modelLabel = item.model?.split("/").pop() || "-";

				return (
					<div
						key={item.id}
						className="rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-4"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate font-medium text-solarized-base00">
									{item.user?.name || "Unbekannt"}
								</p>
								<p className="truncate text-xs text-solarized-base01">
									{item.user?.email || "Kein Benutzer"}
								</p>
							</div>
							<div className="text-right">
								<p className="text-xs text-solarized-base01">{formatDate(item.timestamp)}</p>
								<p className="font-mono text-sm text-solarized-base00">{formatCost(item.cost)}</p>
							</div>
						</div>

						<div className="mt-3 flex flex-wrap gap-2">
							<Badge variant="outline">{item.name}</Badge>
							<UsagePromptBadge metadata={promptMetadata} />
						</div>

						<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
							<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
								<p className="text-solarized-base01">Modell</p>
								<p className="truncate font-mono text-solarized-base00">{modelLabel}</p>
							</div>
							<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
								<p className="text-solarized-base01">Tokens</p>
								<p className="font-mono text-solarized-base00">
									{item.totalTokens?.toLocaleString("de-DE") ?? "-"}
								</p>
							</div>
							<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
								<p className="text-solarized-base01">Dauer</p>
								<p className="font-mono text-solarized-base00">
									{formatDuration(item.timeToCompletionMs)}
								</p>
							</div>
							<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
								<p className="text-solarized-base01">Tokens/s</p>
								<p className="font-mono text-solarized-base00">
									{formatTokensPerSecond(item, item.timeToCompletionMs)}
								</p>
							</div>
							<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
								<p className="text-solarized-base01">Score</p>
								{evaluation ? (
									<EvaluationDetailsDialog
										canRegenerate={!isEvaluatingItem}
										evaluation={evaluation}
										isRegenerating={isEvaluatingItem}
										onRegenerate={() => onEvaluate(item.id)}
										trigger={
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 gap-1 px-0 font-mono text-xs text-solarized-base00"
											>
												<Medal className="h-3 w-3 text-solarized-yellow" />
												{formatScore(evaluation.totalScore)}
											</Button>
										}
									/>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={isEvaluatingItem}
										onClick={() => onEvaluate(item.id)}
										className="h-6 gap-1 px-0 font-mono text-xs text-solarized-base00"
									>
										{isEvaluatingItem ? (
											<Loader2 className="h-3 w-3 animate-spin text-solarized-orange" />
										) : (
											<Medal className="h-3 w-3 text-solarized-yellow" />
										)}
										{isEvaluatingItem ? "..." : "-"}
									</Button>
								)}
							</div>
						</div>

						<div className="mt-3 flex flex-col gap-2">
							<Button variant="outline" onClick={onSelectById[item.id]} className="w-full">
								Details anzeigen
							</Button>
							{canUsePlayground ? (
								<Button className="w-full" variant="secondary" render={<Link href={buildPlaygroundUrl(item)}>Im Playground öffnen</Link>} />
							) : null}
						</div>
					</div>
				);
			})
		)}
	</div>
);

const UsageEventsCard = ({
	columns,
	evaluatingEventId,
	filters,
	filteredItems,
	hasMore,
	isEvaluating,
	isFetchingList,
	onEvaluate,
	onFiltersChange,
	onLoadMore,
	onRowClick,
	onSearchFilterChange,
	onSelectById,
	renderToolbar,
	searchFilter,
	filterOptions,
	users,
}: {
	columns: ReturnType<typeof createColumns>;
	evaluatingEventId?: string;
	filters: UsageFilters;
	filteredItems: UsageListEvent[];
	hasMore?: boolean;
	isEvaluating: boolean;
	isFetchingList: boolean;
	onEvaluate: (id: string) => void;
	onFiltersChange: (filters: UsageFilters) => void;
	onLoadMore: () => void;
	onRowClick: (
		row: UsageListEvent,
		tableRow: { getCanExpand: () => boolean; toggleExpanded: () => void },
	) => void;
	onSearchFilterChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onSelectById: Record<string, () => void>;
	renderToolbar: (table: DataTableRenderToolbarProps<UsageListEvent>["table"]) => ReactNode;
	searchFilter: string;
	filterOptions?: UsageFilterOptions;
	users: { email: string; id: string; name: string | null }[];
}) => (
	<Card className="border-solarized-base2">
		<CardHeader>
			<CardTitle className="text-solarized-base00">Nutzungs-Events</CardTitle>
			<CardDescription>
				Alle AI-Generierungen mit Details zu Kosten und Token-Nutzung
			</CardDescription>
		</CardHeader>
		<CardContent className="space-y-4">
			<UsageFilterControls
				filters={filters}
				onFiltersChange={onFiltersChange}
				options={filterOptions}
				users={users}
			/>
			<div className="space-y-3 md:hidden">
				<Input
					placeholder="Benutzer oder Aktion suchen..."
					value={searchFilter}
					onChange={onSearchFilterChange}
				/>
				<UsageMobileCards
					evaluatingEventId={evaluatingEventId}
					isEvaluating={isEvaluating}
					items={filteredItems}
					onEvaluate={onEvaluate}
					onSelectById={onSelectById}
				/>
			</div>

			<div className="hidden md:block">
				<DataTable
					columns={columns}
					data={filteredItems}
					getSubRows={(row) => row.children}
					onRowClick={onRowClick}
					enablePagination={false}
					enableFiltering={false}
					emptyMessage="Keine Events gefunden"
					renderToolbar={renderToolbar}
				/>
			</div>

			{hasMore ? (
				<div className="mt-4 flex justify-center">
					<Button
						variant="outline"
						onClick={onLoadMore}
						disabled={isFetchingList}
						className="border-solarized-base2"
					>
						{isFetchingList ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Lädt...
							</>
						) : (
							"Mehr laden"
						)}
					</Button>
				</div>
			) : null}
		</CardContent>
	</Card>
);

const mergeUsageItems = (
	currentItems: UsageListEvent[],
	nextItems: UsageListEvent[],
	cursor: string | undefined,
) => {
	if (cursor === undefined) {
		return nextItems;
	}

	const existingIds = new Set(currentItems.map((item) => item.id));
	const newItems = nextItems.filter((item) => !existingIds.has(item.id));
	return [...currentItems, ...newItems];
};

interface UsageTraceObservation {
	endedAt: Date | string | null;
	id: string;
	inputData: unknown;
	metadata: unknown;
	name: string;
	outputData: unknown;
	parentObservationId: string | null;
	startedAt: Date | string;
	status: string;
	type: string;
	usageEventId: string | null;
}

interface UsageTracePayload {
	endedAt: Date | string | null;
	id: string;
	name: string;
	observations: UsageTraceObservation[];
	startedAt: Date | string;
	status: string;
}

interface SelectedToolPayload {
	inputData: unknown;
	name: string;
	outputData: unknown;
	sectionId: string | null;
}

const toDateMs = (value: Date | string | null | undefined): number | null => {
	if (!value) {
		return null;
	}
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : null;
};

const sumTraceNumber = (
	events: UsageListEvent[],
	selector: (event: UsageListEvent) => number | string | null,
): number | null => {
	let hasValue = false;
	let total = 0;
	for (const event of events) {
		const value = selector(event);
		if (value === null || value === "") {
			continue;
		}
		const numericValue = Number(value);
		if (Number.isFinite(numericValue)) {
			hasValue = true;
			total += numericValue;
		}
	}
	return hasValue ? total : null;
};

const buildTraceRows = ({
	events,
	traces,
}: {
	events: UsageListEvent[];
	traces: UsageTracePayload[];
}): UsageListEvent[] => {
	const eventsByTrace = new Map<string, UsageListEvent[]>();
	for (const event of events) {
		if (!event.traceId) {
			continue;
		}
		const traceEvents = eventsByTrace.get(event.traceId) ?? [];
		traceEvents.push(event);
		eventsByTrace.set(event.traceId, traceEvents);
	}

	return traces.flatMap((trace) => {
		const traceEvents = eventsByTrace.get(trace.id) ?? [];
		const eventsById = new Map(traceEvents.map((event) => [event.id, event]));
		const rootObservation = trace.observations.find(
			(observation) => !observation.parentObservationId,
		);
		const rootEvent = rootObservation?.usageEventId
			? eventsById.get(rootObservation.usageEventId)
			: traceEvents.find((event) => event.name === "ai_scribe_agent");
		if (!rootEvent) {
			return [];
		}

		const buildObservationRow = (
			observation: UsageTraceObservation,
			includeChildren = true,
		): UsageListEvent => {
			const linkedEvent = observation.usageEventId
				? eventsById.get(observation.usageEventId)
				: undefined;
			const generationObservation =
				observation.type === "tool"
					? trace.observations.find(
							(candidate) =>
								candidate.parentObservationId === observation.id && candidate.type === "generation",
						)
					: undefined;
			const generationEvent = generationObservation?.usageEventId
				? eventsById.get(generationObservation.usageEventId)
				: undefined;
			const eventForRow = linkedEvent ?? generationEvent;
			const isTool = observation.type === "tool";
			const observationStartedMs = toDateMs(observation.startedAt);
			const observationEndedMs = toDateMs(observation.endedAt);
			let rowKind: UsageListEvent["rowKind"] = "observation";
			if (isTool) {
				rowKind = "tool";
			} else if (linkedEvent) {
				rowKind = "event";
			}
			return {
				...(eventForRow ?? {
					cost: null,
					id: observation.id,
					inputTokens: null,
					metadata: observation.metadata,
					model: null,
					name: observation.name,
					outputTokens: null,
					reasoningTokens: null,
					timeToCompletionMs:
						observationStartedMs !== null && observationEndedMs !== null
							? Math.max(0, observationEndedMs - observationStartedMs)
							: null,
					timeToFirstTokenMs: null,
					timestamp: observation.startedAt,
					totalTokens: null,
					traceId: trace.id,
					user: rootEvent.user,
				}),
				...(includeChildren
					? {
						children: trace.observations
							.filter(
								(candidate) =>
									candidate.parentObservationId === observation.id && candidate !== generationObservation,
							)
							.map((child) => buildObservationRow(child)),
					}
					: {}),
				...(isTool
					? {
						id: observation.id,
						linkedUsageEventId: generationEvent?.id,
						metadata: observation.metadata,
						name: observation.name,
						observationId: observation.id,
						toolInputData: observation.inputData,
						toolOutputData: observation.outputData,
					}
					: {}),
				rowKind,
			};
		};

		const children = rootObservation
			? [
					buildObservationRow(rootObservation, false),
					...trace.observations
						.filter((observation) => observation.parentObservationId === rootObservation.id)
						.map((observation) => buildObservationRow(observation)),
				]
			: [];
		const startedAt = toDateMs(trace.startedAt);
		const endedAt = toDateMs(trace.endedAt);
		return [
			{
				...rootEvent,
				children,
				cost: sumTraceNumber(traceEvents, (event) => event.cost),
				id: trace.id,
				inputTokens: sumTraceNumber(traceEvents, (event) => event.inputTokens),
				metadata: null,
				model: null,
				name: "Agent",
				outputTokens: sumTraceNumber(traceEvents, (event) => event.outputTokens),
				reasoningTokens: sumTraceNumber(traceEvents, (event) => event.reasoningTokens),
				rowKind: "trace",
				timeToCompletionMs:
					startedAt !== null && endedAt !== null ? Math.max(0, endedAt - startedAt) : null,
				timestamp: trace.startedAt,
				totalTokens: sumTraceNumber(traceEvents, (event) => event.totalTokens),
			},
		];
	});
};

const getMetadataRecord = (metadata: unknown): Record<string, unknown> => {
	if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
		return metadata as Record<string, unknown>;
	}
	return {};
};

const applyUsageEvaluationToItems = (
	items: UsageListEvent[],
	eventId: string,
	evaluation: UsageEvaluation,
) =>
	items.map((item) => {
		if (item.id !== eventId) {
			return item;
		}
		return {
			...item,
			metadata: {
				...getMetadataRecord(item.metadata),
				usageEvaluation: evaluation,
			},
		};
	});

const resolveSelectedEventWithEvaluation = (
	selectedEvent: UsageDetailEvent | null | undefined,
	evaluationByEventId: Record<string, UsageEvaluation>,
): UsageDetailEvent | null | undefined => {
	if (!selectedEvent) {
		return selectedEvent;
	}

	const evaluation = evaluationByEventId[selectedEvent.id];
	if (!evaluation) {
		return selectedEvent;
	}

	return {
		...selectedEvent,
		metadata: {
			...getMetadataRecord(selectedEvent.metadata),
			usageEvaluation: evaluation,
		},
	};
};

const filterUsageItems = (items: UsageListEvent[], searchFilter: string) => {
	const search = searchFilter.trim().toLowerCase();
	if (!search) {
		return items;
	}

	return items.filter((item) => {
		const userName = item.user?.name?.toLowerCase() ?? "";
		const userEmail = item.user?.email?.toLowerCase() ?? "";
		const actionName = item.name?.toLowerCase() ?? "";
		return userName.includes(search) || userEmail.includes(search) || actionName.includes(search);
	});
};

const getUsageErrorMessage = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	if (error) {
		return String(error);
	}
	return "Fehler beim Laden der Events";
};

const getFallbackTrendGranularity = (statsFilter: StatsFilter) =>
	statsFilter === "today" ? "hour" : "day";

const useUsageStatsState = (filters: UsageFilters) => {
	const [statsFilter, setStatsFilter] = useState<StatsFilter>("month");
	const [trendMetric, setTrendMetric] = useState<UsageTrendMetric>("events");
	const [timeZone, setTimeZone] = useState("UTC");
	const statsQueryOptions = orpc.admin.usage.stats.queryOptions({
		input: { filter: statsFilter, timeZone, ...filters },
	});
	const { data: stats, isLoading: statsLoading } = useQuery(statsQueryOptions);

	useEffect(() => {
		setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
	}, []);

	const handleStatsFilterChange = useCallback((value: string) => {
		if (value) {
			setStatsFilter(value as StatsFilter);
		}
	}, []);

	return {
		averageCompletionLabel: formatLoadedDuration(statsLoading, stats?.averageTimeToCompletionMs),
		averageFirstTokenLabel: formatLoadedDuration(statsLoading, stats?.averageTimeToFirstTokenMs),
		handleStatsFilterChange,
		setTrendMetric,
		stats,
		statsFilter,
		statsLoading,
		timeZone,
		tokensPerSecondLabel: formatLoadedTokensPerSecond(statsLoading, stats?.tokensPerSecond),
		totalCostLabel: formatLoadedCost(statsLoading, stats?.totalCost),
		totalEventsLabel: formatLoadedNumber(statsLoading, stats?.totalEvents),
		totalTokensLabel: formatLoadedNumber(statsLoading, stats?.totalTokens),
		trendMetric,
	};
};

const useUsageEventsState = (filters: UsageFilters, statsFilter: StatsFilter, timeZone: string) => {
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [selectedToolPayload, setSelectedToolPayload] = useState<SelectedToolPayload | null>(null);
	const [cursor, setCursor] = useState<string | undefined>();
	const [allItems, setAllItems] = useState<UsageListEvent[]>([]);
	const [allTraceEvents, setAllTraceEvents] = useState<UsageListEvent[]>([]);
	const [allTraces, setAllTraces] = useState<UsageTracePayload[]>([]);
	const [evaluationByEventId, setEvaluationByEventId] = useState<Record<string, UsageEvaluation>>(
		{},
	);
	const [searchFilter, setSearchFilter] = useState("");
	const {
		data,
		error,
		isFetching: isFetchingList,
		isLoading,
	} = useQuery({
		...orpc.admin.usage.list.queryOptions({
			input: {
				filter: statsFilter,
				limit: 25,
				timeZone,
				...filters,
				...(cursor && { cursor }),
			},
		}),
		placeholderData: (prev) => prev,
	});

	useEffect(() => {
		setCursor(undefined);
		setAllItems([]);
		setAllTraceEvents([]);
		setAllTraces([]);
		setSelectedEventId(null);
		setSelectedToolPayload(null);
	}, [filters, statsFilter, timeZone]);
	useEffect(() => {
		if (data?.items) {
			setAllItems((current) => mergeUsageItems(current, data.items, cursor));
		}
	}, [data?.items, cursor]);
	useEffect(() => {
		if (data?.traceEvents) {
			setAllTraceEvents((current) => mergeUsageItems(current, data.traceEvents, cursor));
		}
	}, [data?.traceEvents, cursor]);
	useEffect(() => {
		if (data?.traces) {
			setAllTraces((current) => {
				const merged = new Map(current.map((trace) => [trace.id, trace]));
				for (const trace of data.traces as UsageTracePayload[]) {
					merged.set(trace.id, trace);
				}
				return [...merged.values()];
			});
		}
	}, [data?.traces]);

	const { data: selectedEvent } = useQuery({
		...orpc.admin.usage.get.queryOptions({
			input: { id: selectedEventId ?? "" },
		}),
		enabled: !!selectedEventId,
	});

	const evaluateMutation = useMutation(
		orpc.admin.usage.evaluate.mutationOptions({
			onSuccess: (evaluation, variables) => {
				const eventId = variables.id;
				setEvaluationByEventId((current) => ({
					...current,
					[eventId]: evaluation,
				}));
				setAllItems((current) => applyUsageEvaluationToItems(current, eventId, evaluation));
			},
		}),
	);

	const handleLoadMore = useCallback(() => {
		if (data?.nextCursor) {
			setCursor(data.nextCursor);
		}
	}, [data?.nextCursor]);
	const handleEvaluateEvent = useCallback(
		(id: string) => {
			evaluateMutation.mutate({ id });
		},
		[evaluateMutation],
	);
	const handleRowClick = useCallback(
		(
			row: UsageListEvent,
			tableRow: { getCanExpand: () => boolean; toggleExpanded: () => void },
		) => {
			if (tableRow.getCanExpand()) {
				tableRow.toggleExpanded();
				return;
			}
			if (row.rowKind === "observation") {
				return;
			}
			if (row.rowKind === "tool") {
				// editSection has no linked UsageEvent — the sheet opens on the
				// tool payload alone; generateSection additionally loads its
				// generation event.
				setSelectedToolPayload({
					inputData: row.toolInputData,
					name: row.name,
					outputData: row.toolOutputData,
					sectionId: getToolSectionId(row.metadata),
				});
				setSelectedEventId(row.linkedUsageEventId ?? null);
				return;
			}
			setSelectedToolPayload(null);
			setSelectedEventId(row.id);
		},
		[],
	);
	const handleSearchFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSearchFilter(event.target.value);
	}, []);
	const handleDetailOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setSelectedEventId(null);
			setSelectedToolPayload(null);
		}
	}, []);
	const columns = useMemo(
		() =>
			createColumns({
				evaluatingEventId: evaluateMutation.isPending ? evaluateMutation.variables?.id : undefined,
				onEvaluate: handleEvaluateEvent,
			}),
		[evaluateMutation.isPending, evaluateMutation.variables?.id, handleEvaluateEvent],
	);
	const renderUsageToolbar = useCallback(
		(table: DataTableRenderToolbarProps<UsageListEvent>["table"]) => (
			<UsageToolbar
				table={table}
				searchFilter={searchFilter}
				onSearchFilterChange={handleSearchFilterChange}
			/>
		),
		[handleSearchFilterChange, searchFilter],
	);
	const selectedEventWithEvaluation = useMemo(
		() => resolveSelectedEventWithEvaluation(selectedEvent, evaluationByEventId),
		[evaluationByEventId, selectedEvent],
	);
	const filteredItems = useMemo(
		() =>
			filterUsageItems(
				[
					...buildTraceRows({ events: allTraceEvents, traces: allTraces }),
					...allItems.filter((item) => !item.traceId),
				].toSorted(
					(left, right) => (toDateMs(right.timestamp) ?? 0) - (toDateMs(left.timestamp) ?? 0),
				),
				searchFilter,
			),
		[allItems, allTraceEvents, allTraces, searchFilter],
	);
	const handleEventSelectionById = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const item of filteredItems) {
			handlers[item.id] = () => {
				setSelectedToolPayload(null);
				setSelectedEventId(item.id);
			};
		}
		return handlers;
	}, [filteredItems]);

	return {
		allItems,
		columns,
		data,
		error,
		errorMessage: getUsageErrorMessage(error),
		evaluateMutation,
		filteredItems,
		handleDetailOpenChange,
		handleEvaluateEvent,
		handleEventSelectionById,
		handleLoadMore,
		handleRowClick,
		handleSearchFilterChange,
		isFetchingList,
		isLoading,
		renderUsageToolbar,
		searchFilter,
		selectedEventId,
		selectedEventWithEvaluation,
		selectedToolPayload,
	};
};

export default function UsagePage() {
	const searchParams = useSearchParams();
	const [filters, setFilters] = useState<UsageFilters>(() => {
		const userId = searchParams.get("user");
		return userId ? { userId } : {};
	});
	const { data: filterOptions } = useQuery(orpc.admin.usage.filterOptions.queryOptions());
	const { data: users = [] } = useQuery(orpc.admin.users.list.queryOptions());
	const statsState = useUsageStatsState(filters);
	const eventsState = useUsageEventsState(filters, statsState.statsFilter, statsState.timeZone);

	if (eventsState.isLoading && eventsState.allItems.length === 0) {
		return <UsageLoadingState />;
	}

	if (eventsState.error && eventsState.allItems.length === 0) {
		return <UsageErrorState message={eventsState.errorMessage} />;
	}

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-green/10 sm:h-12 sm:w-12">
							<Activity className="h-5 w-5 text-solarized-green sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="text-xl font-bold text-solarized-base00 sm:text-2xl md:text-3xl">
								Nutzungsstatistik
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								Übersicht aller AI-Generierungen auf der Plattform
							</p>
						</div>
					</div>
				</div>

				<UsageStatsCard
					averageCompletionLabel={statsState.averageCompletionLabel}
					averageFirstTokenLabel={statsState.averageFirstTokenLabel}
					onStatsFilterChange={statsState.handleStatsFilterChange}
					onTrendMetricChange={statsState.setTrendMetric}
					statsFilter={statsState.statsFilter}
					tokensPerSecondLabel={statsState.tokensPerSecondLabel}
					totalCostLabel={statsState.totalCostLabel}
					totalEventsLabel={statsState.totalEventsLabel}
					totalTokensLabel={statsState.totalTokensLabel}
					trendMetric={statsState.trendMetric}
				/>

				<UsageTrendChart
					activeMetric={statsState.trendMetric}
					filter={statsState.statsFilter}
					isLoading={statsState.statsLoading}
					timeZone={statsState.stats?.timeZone ?? statsState.timeZone}
					trend={statsState.stats?.trend ?? []}
					trendGranularity={
						statsState.stats?.trendGranularity ??
						getFallbackTrendGranularity(statsState.statsFilter)
					}
				/>

				<UsageEventsCard
					columns={eventsState.columns}
					evaluatingEventId={eventsState.evaluateMutation.variables?.id}
					filters={filters}
					filteredItems={eventsState.filteredItems}
					hasMore={eventsState.data?.hasMore}
					isEvaluating={eventsState.evaluateMutation.isPending}
					isFetchingList={eventsState.isFetchingList}
					onEvaluate={eventsState.handleEvaluateEvent}
					onFiltersChange={setFilters}
					onLoadMore={eventsState.handleLoadMore}
					onRowClick={eventsState.handleRowClick}
					onSearchFilterChange={eventsState.handleSearchFilterChange}
					onSelectById={eventsState.handleEventSelectionById}
					renderToolbar={eventsState.renderUsageToolbar}
					searchFilter={eventsState.searchFilter}
					filterOptions={filterOptions}
					users={users}
				/>
			</div>

			<UsageEventDetail
				event={eventsState.selectedEventWithEvaluation}
				isEvaluating={
					eventsState.evaluateMutation.isPending &&
					eventsState.evaluateMutation.variables?.id === eventsState.selectedEventId
				}
				onEvaluate={eventsState.handleEvaluateEvent}
				open={!!eventsState.selectedEventId || !!eventsState.selectedToolPayload}
				onOpenChange={eventsState.handleDetailOpenChange}
				toolPayload={eventsState.selectedToolPayload}
			/>
		</div>
	);
}
