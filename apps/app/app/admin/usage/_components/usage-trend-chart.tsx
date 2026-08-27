"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { cn } from "@repo/design-system/lib/utils";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	XAxis,
	YAxis,
} from "recharts";

import type { StatsFilter, UsageTrendMetric } from "../types";

type TrendGranularity = "day" | "hour";

interface PercentileStats {
	p50: number | null;
	p90: number | null;
	p95: number | null;
}

interface UsageTrendBucket {
	bucket: string;
	cost: number;
	costPerRequest: PercentileStats;
	events: number;
	timeToCompletionMs: PercentileStats;
	timeToFirstTokenMs: PercentileStats;
	tokens: number;
	tokensPerSecond: PercentileStats;
}

interface UsageTrendChartProps {
	activeMetric: UsageTrendMetric;
	filter: StatsFilter;
	isLoading: boolean;
	timeZone: string;
	trend: UsageTrendBucket[];
	trendGranularity: TrendGranularity;
}

interface MetricConfig {
	color: string;
	isPercentile?: boolean;
	label: string;
}

const metricConfig: Record<UsageTrendMetric, MetricConfig> = {
	cost: {
		color: "var(--solarized-green)",
		isPercentile: true,
		label: "Kosten pro Anfrage",
	},
	events: {
		color: "var(--solarized-blue)",
		label: "Events",
	},
	timeToCompletionMs: {
		color: "var(--solarized-violet)",
		isPercentile: true,
		label: "Dauer",
	},
	timeToFirstTokenMs: {
		color: "var(--solarized-blue)",
		isPercentile: true,
		label: "Erster Token",
	},
	tokens: {
		color: "var(--solarized-cyan)",
		label: "Tokens",
	},
	tokensPerSecond: {
		color: "var(--solarized-orange)",
		isPercentile: true,
		label: "Tokens/s",
	},
};

const aggregateChartConfig = {
	value: {
		color: "var(--solarized-blue)",
		label: "Wert",
	},
} satisfies ChartConfig;

const percentileChartConfig = {
	p50: {
		color: "var(--solarized-blue)",
		label: "p50",
	},
	p90: {
		color: "var(--solarized-orange)",
		label: "p90",
	},
	p95: {
		color: "var(--solarized-magenta)",
		label: "p95",
	},
} satisfies ChartConfig;

const periodTitleSuffix: Record<StatsFilter, string> = {
	all: "gesamt",
	month: "im Monatsverlauf",
	today: "heute",
	week: "der letzten Woche",
};

const shortWeekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const longWeekdayLabels = [
	"Sonntag",
	"Montag",
	"Dienstag",
	"Mittwoch",
	"Donnerstag",
	"Freitag",
	"Samstag",
];

// Parse the local bucket date (YYYY-MM-DD) in UTC so the weekday is not shifted
// by the viewer's timezone offset.
const getWeekdayIndex = (bucket: string): number =>
	new Date(
		Date.UTC(
			Number(bucket.slice(0, 4)),
			Number(bucket.slice(5, 7)) - 1,
			Number(bucket.slice(8, 10)),
		),
	).getUTCDay();

const isWeekendBucket = (bucket: string): boolean => {
	const weekday = getWeekdayIndex(bucket);
	return weekday === 0 || weekday === 6;
};

interface WeekendBand {
	key: string;
	x1: string;
	x2: string;
}

// Collapse consecutive weekend days (Sat/Sun) into contiguous bands so each
// weekend renders as a single shaded background area behind the trend.
const getWeekendBands = (buckets: string[]): WeekendBand[] => {
	const bands: WeekendBand[] = [];
	let runStart: string | null = null;
	let runEnd: string | null = null;
	for (const bucket of buckets) {
		if (isWeekendBucket(bucket)) {
			runStart ??= bucket;
			runEnd = bucket;
		} else if (runStart !== null && runEnd !== null) {
			bands.push({ key: runStart, x1: runStart, x2: runEnd });
			runStart = null;
			runEnd = null;
		}
	}
	if (runStart !== null && runEnd !== null) {
		bands.push({ key: runStart, x1: runStart, x2: runEnd });
	}
	return bands;
};

const formatTick = (
	bucket: string,
	granularity: TrendGranularity,
	showWeekday: boolean,
): string => {
	if (granularity === "hour") {
		return `${bucket.slice(11, 13)} Uhr`;
	}
	const dateLabel = `${bucket.slice(8, 10)}.${bucket.slice(5, 7)}.`;
	if (showWeekday) {
		return `${shortWeekdayLabels[getWeekdayIndex(bucket)] ?? ""} ${dateLabel}`.trim();
	}
	return dateLabel;
};

const formatTooltipLabel = (
	bucket: string,
	granularity: TrendGranularity,
	showWeekday: boolean,
): string => {
	const dateLabel = `${bucket.slice(8, 10)}.${bucket.slice(5, 7)}.${bucket.slice(0, 4)}`;
	if (granularity === "hour") {
		return `${dateLabel}, ${bucket.slice(11, 16)} Uhr`;
	}
	if (showWeekday) {
		return `${longWeekdayLabels[getWeekdayIndex(bucket)] ?? ""}, ${dateLabel}`;
	}
	return dateLabel;
};

const getAggregateValue = (bucket: UsageTrendBucket, metric: UsageTrendMetric): number => {
	if (metric === "cost") {
		return bucket.cost;
	}
	if (metric === "events") {
		return bucket.events;
	}
	if (metric === "tokens") {
		return bucket.tokens;
	}
	return 0;
};

const getPercentileValue = (
	bucket: UsageTrendBucket,
	metric: UsageTrendMetric,
	percentile: keyof PercentileStats,
): number | null => {
	if (metric === "cost") {
		return bucket.costPerRequest[percentile];
	}
	if (
		metric === "timeToCompletionMs" ||
		metric === "timeToFirstTokenMs" ||
		metric === "tokensPerSecond"
	) {
		return bucket[metric][percentile];
	}
	return null;
};

const formatTrendValue = (
	metric: UsageTrendMetric,
	value: number | string | (number | string)[] | undefined,
): string => {
	const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
	if (!Number.isFinite(numericValue)) {
		return "-";
	}

	if (metric === "cost") {
		return `$${numericValue.toFixed(4)}`;
	}
	if (metric === "tokens") {
		return numericValue.toLocaleString("de-DE");
	}
	if (metric === "timeToFirstTokenMs" || metric === "timeToCompletionMs") {
		if (numericValue < 1000) {
			return `${Math.round(numericValue).toLocaleString("de-DE")} ms`;
		}
		return `${(numericValue / 1000).toLocaleString("de-DE", {
			maximumFractionDigits: 2,
			minimumFractionDigits: 2,
		})} s`;
	}
	if (metric === "tokensPerSecond") {
		return `${numericValue.toLocaleString("de-DE", {
			maximumFractionDigits: 1,
			minimumFractionDigits: 1,
		})} Tok/s`;
	}
	return numericValue.toLocaleString("de-DE");
};

const formatAxisValue = (metric: UsageTrendMetric, value: number): string => {
	if (!Number.isFinite(value)) {
		return "";
	}
	if (metric === "cost") {
		return `$${value.toLocaleString("de-DE", {
			maximumFractionDigits: value < 1 ? 2 : 0,
		})}`;
	}
	if (metric === "tokens") {
		if (value >= 1_000_000) {
			return `${(value / 1_000_000).toLocaleString("de-DE", {
				maximumFractionDigits: 1,
			})}M`;
		}
		if (value >= 1000) {
			return `${(value / 1000).toLocaleString("de-DE", {
				maximumFractionDigits: 1,
			})}k`;
		}
		return Math.round(value).toLocaleString("de-DE");
	}
	if (metric === "timeToFirstTokenMs" || metric === "timeToCompletionMs") {
		if (value >= 1000) {
			return `${(value / 1000).toLocaleString("de-DE", {
				maximumFractionDigits: 1,
			})}s`;
		}
		return `${Math.round(value).toLocaleString("de-DE")}ms`;
	}
	if (metric === "tokensPerSecond") {
		return `${value.toLocaleString("de-DE", {
			maximumFractionDigits: 0,
		})}/s`;
	}
	return Math.round(value).toLocaleString("de-DE");
};

export const UsageTrendChart = ({
	activeMetric,
	filter,
	isLoading,
	timeZone,
	trend,
	trendGranularity,
}: UsageTrendChartProps) => {
	const metric = metricConfig[activeMetric];
	const isPercentile = Boolean(metric.isPercentile);
	const showWeekday = filter === "week" && trendGranularity === "day";
	const chartTitle = `${metric.label} ${periodTitleSuffix[filter]}`;
	const grainLabel = trendGranularity === "hour" ? "Stunde" : "Tag";
	const grainPrefix = grainLabel === "Stunde" ? "Stündliche" : "Tägliche";
	let chartDescription: string;
	if (isPercentile && activeMetric === "tokensPerSecond") {
		chartDescription = `${grainPrefix} Perzentile – p90/p95 zeigen das langsame Ende (niedrigere Werte sind schlechter).`;
	} else if (isPercentile) {
		chartDescription = `${grainPrefix} p50-, p90- und p95-Werte.`;
	} else {
		chartDescription = `${grainPrefix} Werte für ${metric.label.toLowerCase()}.`;
	}
	const aggregateData = trend.map((bucket) => ({
		bucket: bucket.bucket,
		value: getAggregateValue(bucket, activeMetric),
	}));
	const percentileData = trend.map((bucket) => ({
		bucket: bucket.bucket,
		p50: getPercentileValue(bucket, activeMetric, "p50"),
		p90: getPercentileValue(bucket, activeMetric, "p90"),
		p95: getPercentileValue(bucket, activeMetric, "p95"),
	}));
	const hasPercentileData = percentileData.some(
		(bucket) => bucket.p50 !== null || bucket.p90 !== null || bucket.p95 !== null,
	);
	const weekendBands =
		trendGranularity === "day" ? getWeekendBands(trend.map((bucket) => bucket.bucket)) : [];
	const renderWeekendBands = () =>
		weekendBands.map((band) => (
			<ReferenceArea
				key={band.key}
				x1={band.x1}
				x2={band.x2}
				fill="var(--solarized-base2)"
				fillOpacity={0.6}
				stroke="none"
				ifOverflow="extendDomain"
			/>
		));

	if (isLoading) {
		return (
			<Card className="border-solarized-base2">
				<CardHeader className="pb-3">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-4 w-72" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-[260px] w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-solarized-base2">
			<CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="text-base text-solarized-base00">{chartTitle}</CardTitle>
					<p className="text-sm text-solarized-base01">{chartDescription}</p>
				</div>
				<div
					className={cn(
						"inline-flex h-7 w-fit items-center rounded-full border px-2.5 font-medium text-xs",
						isPercentile
							? "border-solarized-cyan/30 bg-solarized-cyan/10 text-solarized-cyan"
							: "border-solarized-base2 bg-solarized-base3 text-solarized-base01",
					)}
					title={`Zeitzone: ${timeZone}`}
				>
					<span>{isPercentile ? `${grainLabel} / Perzentile` : grainLabel}</span>
					<span className="ml-1 hidden sm:inline">· {timeZone}</span>
				</div>
			</CardHeader>
			<CardContent>
				{(() => {
					if (trend.length === 0) {
						return (
							<div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 text-sm text-solarized-base01">
								Keine Trenddaten im gewählten Zeitraum.
							</div>
						);
					}
					if (isPercentile && !hasPercentileData) {
						return (
							<div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 px-4 text-center text-sm text-solarized-base01">
								Keine Perzentilwerte im gewählten Zeitraum. Diese Ansicht benötigt Events mit
								gespeicherten Laufzeitmessungen.
							</div>
						);
					}
					if (isPercentile) {
						return (
							<div className="space-y-2">
								<ChartContainer config={percentileChartConfig} className="h-[260px] w-full">
									<LineChart accessibilityLayer data={percentileData}>
										<CartesianGrid vertical={false} />
										{renderWeekendBands()}
										<XAxis
											dataKey="bucket"
											tickLine={false}
											axisLine={false}
											tickMargin={10}
											minTickGap={28}
											tickFormatter={(value: string) =>
												formatTick(value, trendGranularity, showWeekday)
											}
										/>
										<YAxis
											axisLine={false}
											domain={[0, "auto"]}
											tickFormatter={(value: number) => formatAxisValue(activeMetric, value)}
											tickLine={false}
											tickMargin={8}
											width={56}
										/>
										<ChartTooltip
											content={
												<ChartTooltipContent
													indicator="line"
													labelFormatter={(value) =>
														value
															? formatTooltipLabel(String(value), trendGranularity, showWeekday)
															: ""
													}
													valueFormatter={(value) => formatTrendValue(activeMetric, value)}
												/>
											}
										/>
										<Line
											type="monotone"
											dataKey="p50"
											stroke="var(--color-p50)"
											strokeWidth={2.5}
											dot={{ r: 2, strokeWidth: 1 }}
											connectNulls
										/>
										<Line
											type="monotone"
											dataKey="p90"
											stroke="var(--color-p90)"
											strokeWidth={2.5}
											dot={{ r: 2, strokeWidth: 1 }}
											connectNulls
										/>
										<Line
											type="monotone"
											dataKey="p95"
											stroke="var(--color-p95)"
											strokeWidth={2.5}
											dot={{ r: 2, strokeWidth: 1 }}
											connectNulls
										/>
									</LineChart>
								</ChartContainer>
								<div className="flex justify-end gap-3 text-xs">
									<span className="inline-flex items-center gap-1.5 font-medium text-solarized-blue">
										<span className="h-0.5 w-4 rounded-full bg-solarized-blue" />
										p50
									</span>
									<span className="inline-flex items-center gap-1.5 font-medium text-solarized-orange">
										<span className="h-0.5 w-4 rounded-full bg-solarized-orange" />
										p90
									</span>
									<span className="inline-flex items-center gap-1.5 font-medium text-solarized-magenta">
										<span className="h-0.5 w-4 rounded-full bg-solarized-magenta" />
										p95
									</span>
								</div>
							</div>
						);
					}
					return (
						<ChartContainer
							config={{
								...aggregateChartConfig,
								value: {
									...aggregateChartConfig.value,
									color: metric.color,
									label: metric.label,
								},
							}}
							className="h-[260px] w-full"
						>
							<AreaChart accessibilityLayer data={aggregateData}>
								<CartesianGrid vertical={false} />
								{renderWeekendBands()}
								<XAxis
									dataKey="bucket"
									tickLine={false}
									axisLine={false}
									tickMargin={10}
									minTickGap={28}
									tickFormatter={(value: string) =>
										formatTick(value, trendGranularity, showWeekday)
									}
								/>
								<YAxis
									axisLine={false}
									domain={[0, "auto"]}
									tickFormatter={(value: number) => formatAxisValue(activeMetric, value)}
									tickLine={false}
									tickMargin={8}
									width={56}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											hideIndicator
											labelFormatter={(value) =>
												value
													? formatTooltipLabel(String(value), trendGranularity, showWeekday)
													: ""
											}
											valueFormatter={(value) => formatTrendValue(activeMetric, value)}
										/>
									}
								/>
								<defs>
									<linearGradient id="usage-trend-fill" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
										<stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.03} />
									</linearGradient>
								</defs>
								<Area
									type="monotone"
									dataKey="value"
									stroke="var(--color-value)"
									fill="url(#usage-trend-fill)"
									strokeWidth={2.5}
									dot={false}
								/>
							</AreaChart>
						</ChartContainer>
					);
				})()}
			</CardContent>
		</Card>
	);
};
