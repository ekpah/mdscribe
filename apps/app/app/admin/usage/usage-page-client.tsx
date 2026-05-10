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
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Loader2, Medal, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { EvaluationDetailsDialog } from "@/app/admin/_components/evaluation-details-dialog";
import { orpc } from "@/lib/orpc";

import { UsageEventDetail } from "./_components/usage-event-detail";
import { UsageTrendChart } from "./_components/usage-trend-chart";
import {
	buildPlaygroundUrl,
	createColumns,
	formatCost,
	formatDate,
	formatDuration,
	getPromptLabel,
	getUsageEvaluation,
	formatScore,
	formatStatTokensPerSecond,
	formatTokensPerSecond,
} from "./columns";
import type {
	StatsFilter,
	UsageDetailEvent,
	UsageEvaluation,
	UsageListEvent,
	UsageTrendMetric,
} from "./types";

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
				<span className={cn("hidden h-2 w-2 rounded-full", isActive && "inline-block", styles.dot)} />
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

export default function UsagePage() {
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [cursor, setCursor] = useState<string | undefined>();
	const [allItems, setAllItems] = useState<UsageListEvent[]>([]);
	const [evaluationByEventId, setEvaluationByEventId] = useState<Record<string, UsageEvaluation>>(
		{},
	);
	const [statsFilter, setStatsFilter] = useState<StatsFilter>("month");
	const [trendMetric, setTrendMetric] = useState<UsageTrendMetric>("events");
	const [timeZone, setTimeZone] = useState("UTC");
	const [searchFilter, setSearchFilter] = useState("");
	const statsQueryOptions = orpc.admin.usage.stats.queryOptions({
		input: { filter: statsFilter, timeZone },
	});

	// Stats query
	const { data: stats, isLoading: statsLoading } = useQuery(statsQueryOptions);

	useEffect(() => {
		setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
	}, []);

	// List query with pagination
	const {
		data,
		isLoading,
		isFetching: isFetchingList,
		error,
	} = useQuery({
		...orpc.admin.usage.list.queryOptions({
			input: {
				limit: 25,
				...(cursor && { cursor }),
			},
		}),
		placeholderData: (prev) => prev,
	});

	// Accumulate items when new data arrives
	useEffect(() => {
		if (data?.items) {
			if (cursor === undefined) {
				// First page
				setAllItems(data.items);
			} else {
				// Subsequent pages - append new items
				setAllItems((prev) => {
					const existingIds = new Set(prev.map((item) => item.id));
					const newItems = data.items.filter((item) => !existingIds.has(item.id));
					return [...prev, ...newItems];
				});
			}
		}
	}, [data?.items, cursor]);

	// Detail query (enabled when event selected)
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
				setAllItems((current) =>
					current.map((item) => {
						if (item.id !== eventId) {
							return item;
						}
						const metadata =
							item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
								? (item.metadata as Record<string, unknown>)
								: {};
						return {
							...item,
							metadata: {
								...metadata,
								usageEvaluation: evaluation,
							},
						};
					}),
				);
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

	const handleRowClick = useCallback((row: UsageListEvent) => {
		setSelectedEventId(row.id);
	}, []);

	const columns = useMemo(
		() =>
			createColumns({
				evaluatingEventId: evaluateMutation.isPending ? evaluateMutation.variables?.id : undefined,
				onEvaluate: handleEvaluateEvent,
			}),
		[evaluateMutation.isPending, evaluateMutation.variables?.id, handleEvaluateEvent],
	);

	const handleStatsFilterChange = useCallback((value: string) => {
		if (value) {
			setStatsFilter(value as StatsFilter);
		}
	}, []);

	const handleSearchFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSearchFilter(event.target.value);
	}, []);

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

	const handleDetailOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setSelectedEventId(null);
		}
	}, []);

	const selectedEventWithEvaluation = useMemo(() => {
		if (!selectedEvent) {
			return selectedEvent as UsageDetailEvent | null | undefined;
		}
		const evaluation = evaluationByEventId[selectedEvent.id];
		if (!evaluation) {
			return selectedEvent as UsageDetailEvent;
		}
		const metadata =
			selectedEvent.metadata &&
			typeof selectedEvent.metadata === "object" &&
			!Array.isArray(selectedEvent.metadata)
				? (selectedEvent.metadata as Record<string, unknown>)
				: {};
		return {
			...selectedEvent,
			metadata: {
				...metadata,
				usageEvaluation: evaluation,
			},
		} as UsageDetailEvent;
	}, [evaluationByEventId, selectedEvent]);

	// Filter items based on search - matches user name/email OR action name
	const filteredItems = useMemo(() => {
		if (!searchFilter.trim()) {
			return allItems;
		}
		const search = searchFilter.toLowerCase();
		return allItems.filter((item) => {
			const userName = item.user?.name?.toLowerCase() ?? "";
			const userEmail = item.user?.email?.toLowerCase() ?? "";
			const actionName = item.name?.toLowerCase() ?? "";
			return userName.includes(search) || userEmail.includes(search) || actionName.includes(search);
		});
	}, [allItems, searchFilter]);

	const handleEventSelectionById = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const item of filteredItems) {
			handlers[item.id] = () => {
				setSelectedEventId(item.id);
			};
		}
		return handlers;
	}, [filteredItems]);

	const errorMessage = (() => {
		if (error instanceof Error) {
			return error.message;
		}
		if (error) {
			return String(error);
		}
		return "Fehler beim Laden der Events";
	})();

	const totalCostLabel = (() => {
		if (statsLoading) {
			return <Loader2 className="h-4 w-4 animate-spin" />;
		}
		if (stats?.totalCost === undefined) {
			return "-";
		}
		return `$${stats.totalCost.toFixed(2)}`;
	})();

	const averageFirstTokenLabel = statsLoading ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : (
		formatDuration(stats?.averageTimeToFirstTokenMs)
	);
	const averageCompletionLabel = statsLoading ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : (
		formatDuration(stats?.averageTimeToCompletionMs)
	);
	const tokensPerSecondLabel = statsLoading ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : (
		formatStatTokensPerSecond(stats?.tokensPerSecond)
	);

	if (isLoading && allItems.length === 0) {
		return (
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
	}

	if (error && allItems.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-6xl">
					<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
						<div className="space-y-2 text-center">
							<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
							<h2 className="text-base font-semibold text-solarized-base00 sm:text-lg">
								Seite konnte nicht geladen werden
							</h2>
							<p className="text-sm text-solarized-base01 sm:text-base">{errorMessage}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
				{/* Header */}
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

				{/* Stats Card */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						{/* Filter Tabs */}
						<div className="mb-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
							{(Object.keys(filterLabels) as StatsFilter[]).map((filter) => {
								const isActive = statsFilter === filter;
								return (
									<Button
										key={filter}
										type="button"
										variant="outline"
										onClick={() => handleStatsFilterChange(filter)}
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

						{/* Stats Grid */}
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
							<StatsMetricButton
								isActive={trendMetric === "events"}
								label="Events"
								metric="events"
								onSelect={setTrendMetric}
								value={
									statsLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										(stats?.totalEvents?.toLocaleString("de-DE") ?? "-")
									)
								}
							/>
							<StatsMetricButton
								isActive={trendMetric === "tokens"}
								label="Tokens"
								metric="tokens"
								onSelect={setTrendMetric}
								value={
									statsLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										(stats?.totalTokens?.toLocaleString("de-DE") ?? "-")
									)
								}
							/>
							<StatsMetricButton
								isActive={trendMetric === "timeToFirstTokenMs"}
								label="Erster Token"
								metric="timeToFirstTokenMs"
								onSelect={setTrendMetric}
								value={averageFirstTokenLabel}
							/>
							<StatsMetricButton
								isActive={trendMetric === "timeToCompletionMs"}
								label="Dauer"
								metric="timeToCompletionMs"
								onSelect={setTrendMetric}
								value={averageCompletionLabel}
							/>
							<StatsMetricButton
								isActive={trendMetric === "tokensPerSecond"}
								label="Tokens/s"
								metric="tokensPerSecond"
								onSelect={setTrendMetric}
								value={tokensPerSecondLabel}
							/>
							<StatsMetricButton
								isActive={trendMetric === "cost"}
								label="Kosten"
								metric="cost"
								onSelect={setTrendMetric}
								value={totalCostLabel}
							/>
						</div>
					</CardContent>
				</Card>

				<UsageTrendChart
					activeMetric={trendMetric}
					filter={statsFilter}
					isLoading={statsLoading}
					timeZone={stats?.timeZone ?? timeZone}
					trend={stats?.trend ?? []}
					trendGranularity={
						stats?.trendGranularity ?? (statsFilter === "today" ? "hour" : "day")
					}
				/>

				{/* Events Table */}
				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">Nutzungs-Events</CardTitle>
						<CardDescription>
							Alle AI-Generierungen mit Details zu Kosten und Token-Nutzung
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3 md:hidden">
							<Input
								placeholder="Benutzer oder Aktion suchen..."
								value={searchFilter}
								onChange={handleSearchFilterChange}
							/>
							{filteredItems.length === 0 ? (
								<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 p-4 text-sm text-solarized-base01">
									Keine Events gefunden.
								</div>
							) : (
								filteredItems.map((item) => {
									const promptLabel = getPromptLabel(
										item.metadata as Record<string, unknown> | null,
									);
									const evaluation = getUsageEvaluation(item.metadata);
									const isEvaluatingItem =
										evaluateMutation.isPending && evaluateMutation.variables?.id === item.id;
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
													<p className="text-xs text-solarized-base01">
														{formatDate(item.timestamp)}
													</p>
													<p className="font-mono text-sm text-solarized-base00">
														{formatCost(item.cost)}
													</p>
												</div>
											</div>

											<div className="mt-3 flex flex-wrap gap-2">
												<Badge variant="outline">{item.name}</Badge>
												{promptLabel !== "-" && (
													<Badge variant="secondary" className="max-w-full truncate">
														{promptLabel}
													</Badge>
												)}
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
														{formatTokensPerSecond(item.outputTokens, item.timeToCompletionMs)}
													</p>
												</div>
												<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
													<p className="text-solarized-base01">Score</p>
													{evaluation ? (
														<EvaluationDetailsDialog
															canRegenerate={!isEvaluatingItem}
															evaluation={evaluation}
															isRegenerating={isEvaluatingItem}
															onRegenerate={() => handleEvaluateEvent(item.id)}
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
															onClick={() => handleEvaluateEvent(item.id)}
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
												<Button
													variant="outline"
													onClick={handleEventSelectionById[item.id]}
													className="w-full"
												>
													Details anzeigen
												</Button>
												<Button asChild className="w-full" variant="secondary">
													<Link href={buildPlaygroundUrl(item)}>Im Playground öffnen</Link>
												</Button>
											</div>
										</div>
									);
								})
							)}
						</div>

						<div className="hidden md:block">
							<DataTable
								columns={columns}
								data={filteredItems}
								onRowClick={handleRowClick}
								enablePagination={false}
								enableFiltering={false}
								emptyMessage="Keine Events gefunden"
								renderToolbar={renderUsageToolbar}
							/>
						</div>

						{/* Load More Button */}
						{data?.hasMore && (
							<div className="mt-4 flex justify-center">
								<Button
									variant="outline"
									onClick={handleLoadMore}
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
						)}
					</CardContent>
				</Card>
			</div>

			{/* Detail Sheet */}
			<UsageEventDetail
				event={selectedEventWithEvaluation}
				isEvaluating={
					evaluateMutation.isPending && evaluateMutation.variables?.id === selectedEventId
				}
				onEvaluate={handleEvaluateEvent}
				open={!!selectedEventId}
				onOpenChange={handleDetailOpenChange}
			/>
		</div>
	);
}
