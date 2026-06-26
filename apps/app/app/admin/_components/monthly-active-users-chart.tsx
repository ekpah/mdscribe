"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { USER_MESSAGES } from "@/lib/user-messages";
import { getCurrentWeekUsageProjection } from "@/lib/weekly-usage-projection";
import type { WeeklyUsageProjection } from "@/lib/weekly-usage-projection";

interface MonthlyActiveUsersBucket {
	activeUsers: number;
	bucket: string;
}

interface WeeklyRequestsBucket {
	bucket: string;
	requests: number;
}

interface MonthlyActiveUsersChartProps {
	timeZone: string;
	trend: MonthlyActiveUsersBucket[];
	weeklyRequests: WeeklyRequestsBucket[];
}

const chartConfig = {
	activeUsers: {
		color: "var(--solarized-blue)",
		label: "Aktive Nutzer (Monat)",
	},
	projectedRequests: {
		color: "var(--solarized-orange)",
		label: USER_MESSAGES.weeklyUsageProjectionLabel,
	},
	requests: {
		color: "var(--solarized-orange)",
		label: "KI-Anfragen (Woche)",
	},
} satisfies ChartConfig;

const shortMonthLabels = [
	"Jan.",
	"Feb.",
	"März",
	"Apr.",
	"Mai",
	"Juni",
	"Juli",
	"Aug.",
	"Sept.",
	"Okt.",
	"Nov.",
	"Dez.",
];

const longMonthLabels = [
	"Januar",
	"Februar",
	"März",
	"April",
	"Mai",
	"Juni",
	"Juli",
	"August",
	"September",
	"Oktober",
	"November",
	"Dezember",
];

// Parse the local bucket date (YYYY-MM-DD) in UTC so points are placed on the
// shared time axis without being shifted by the viewer's timezone offset.
const bucketToEpoch = (bucket: string): number =>
	Date.UTC(
		Number(bucket.slice(0, 4)),
		Number(bucket.slice(5, 7)) - 1,
		Number(bucket.slice(8, 10)),
	);

const formatAxisTick = (value: number): string => {
	const date = new Date(value);
	const monthLabel = shortMonthLabels[date.getUTCMonth()] ?? "";
	return `${monthLabel} ${String(date.getUTCFullYear()).slice(2)}`;
};

const formatTooltipLabel = (value: number | string): string => {
	const date = new Date(Number(value));
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const monthLabel = longMonthLabels[date.getUTCMonth()] ?? "";
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${day}. ${monthLabel} ${date.getUTCFullYear()}`;
};

const toNumericValue = (
	value: number | string | (number | string)[] | undefined,
): number | null => {
	const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
	return Number.isFinite(numericValue) ? numericValue : null;
};

const formatCount = (
	value: number | string | (number | string)[] | undefined,
): string => toNumericValue(value)?.toLocaleString("de-DE") ?? "-";

interface ChartPoint {
	activeUsers?: number;
	projectedRequests?: number;
	requests?: number;
	x: number;
}

const buildChartData = (
	trend: MonthlyActiveUsersBucket[],
	weeklyRequests: WeeklyRequestsBucket[],
	projection: WeeklyUsageProjection | null,
): ChartPoint[] => {
	const pointByX = new Map<number, ChartPoint>();
	const ensurePoint = (x: number): ChartPoint => {
		const existing = pointByX.get(x);
		if (existing) {
			return existing;
		}
		const created: ChartPoint = { x };
		pointByX.set(x, created);
		return created;
	};

	for (const bucket of trend) {
		ensurePoint(bucketToEpoch(bucket.bucket)).activeUsers = bucket.activeUsers;
	}
	const orderedWeeklyRequests = [...weeklyRequests].toSorted(
		(first, second) => bucketToEpoch(first.bucket) - bucketToEpoch(second.bucket),
	);
	for (const [index, bucket] of orderedWeeklyRequests.entries()) {
		const point = ensurePoint(bucketToEpoch(bucket.bucket));
		if (bucket.bucket !== projection?.bucket) {
			point.requests = bucket.requests;
			continue;
		}

		point.projectedRequests = projection.requests;
		const previousWeek = orderedWeeklyRequests[index - 1];
		if (previousWeek) {
			ensurePoint(bucketToEpoch(previousWeek.bucket)).projectedRequests = previousWeek.requests;
		}
	}

	return [...pointByX.values()].toSorted((a, b) => a.x - b.x);
};

export const MonthlyActiveUsersChart = ({
	timeZone,
	trend,
	weeklyRequests,
}: MonthlyActiveUsersChartProps) => {
	const projection = getCurrentWeekUsageProjection(weeklyRequests, timeZone);
	const data = buildChartData(trend, weeklyRequests, projection);
	// One tick per month, placed exactly at the monthly active-users data points,
	// so the weekly requests don't repeat the same month label across the axis.
	const monthTicks = trend.map((bucket) => bucketToEpoch(bucket.bucket));
	const hasData =
		trend.some((bucket) => bucket.activeUsers > 0) ||
		weeklyRequests.some((bucket) => bucket.requests > 0);

	return (
		<Card className="border-solarized-base2">
			<CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="text-base text-solarized-base00">
						Monatlich aktive Nutzer
					</CardTitle>
					<CardDescription>
						Einzigartige Nutzer pro Kalendermonat (linke Achse) und KI-Anfragen pro Woche (rechte
						Achse). {projection ? USER_MESSAGES.weeklyUsageProjectionHint : null}
					</CardDescription>
				</div>
				<div
					className="inline-flex h-7 w-fit items-center rounded-full border border-solarized-base2 bg-solarized-base3 px-2.5 font-medium text-solarized-base01 text-xs"
					title={`Zeitzone: ${timeZone}`}
				>
					Monat / Woche
					<span className="ml-1 hidden sm:inline">· {timeZone}</span>
				</div>
			</CardHeader>
			<CardContent>
				{hasData ? (
					<ChartContainer config={chartConfig} className="h-[260px] w-full">
						<ComposedChart accessibilityLayer data={data}>
							<CartesianGrid vertical={false} />
							<XAxis
								axisLine={false}
								dataKey="x"
								domain={["dataMin", "dataMax"]}
								minTickGap={28}
								scale="time"
								tickFormatter={formatAxisTick}
								tickLine={false}
								tickMargin={10}
								ticks={monthTicks}
								type="number"
							/>
							<YAxis
								allowDecimals={false}
								axisLine={false}
								domain={[0, "auto"]}
								tickFormatter={(value: number) => value.toLocaleString("de-DE")}
								tickLine={false}
								tickMargin={8}
								width={48}
							/>
							<YAxis
								allowDecimals={false}
								axisLine={false}
								domain={[0, "auto"]}
								orientation="right"
								tickFormatter={(value: number) => value.toLocaleString("de-DE")}
								tickLine={false}
								tickMargin={8}
								width={48}
								yAxisId="requests"
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											label === undefined ? "" : formatTooltipLabel(label)
										}
										valueFormatter={(value) => formatCount(value)}
									/>
								}
							/>
							<defs>
								<linearGradient id="monthly-active-users-fill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="var(--color-activeUsers)" stopOpacity={0.3} />
									<stop offset="95%" stopColor="var(--color-activeUsers)" stopOpacity={0.03} />
								</linearGradient>
							</defs>
							<Area
								connectNulls
								dataKey="activeUsers"
								dot={false}
								fill="url(#monthly-active-users-fill)"
								stroke="var(--color-activeUsers)"
								strokeWidth={2.5}
								type="monotone"
							/>
							<Line
								connectNulls
								dataKey="requests"
								dot={false}
								stroke="var(--color-requests)"
								strokeWidth={2.5}
								type="monotone"
								yAxisId="requests"
							/>
							{projection ? (
								<Line
									connectNulls
									dataKey="projectedRequests"
									activeDot={false}
									dot={false}
									stroke="var(--color-projectedRequests)"
									strokeDasharray="6 4"
									strokeWidth={2.5}
									type="monotone"
									yAxisId="requests"
								/>
							) : null}
						</ComposedChart>
					</ChartContainer>
				) : (
					<div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 px-4 text-center text-sm text-solarized-base01">
						Keine Nutzungsdaten vorhanden.
					</div>
				)}
			</CardContent>
		</Card>
	);
};
