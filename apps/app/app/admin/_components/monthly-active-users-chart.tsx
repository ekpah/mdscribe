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
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface MonthlyActiveUsersBucket {
	activeUsers: number;
	bucket: string;
}

interface MonthlyActiveUsersChartProps {
	timeZone: string;
	trend: MonthlyActiveUsersBucket[];
}

const chartConfig = {
	activeUsers: {
		color: "var(--solarized-blue)",
		label: "Aktive Nutzer",
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

const getMonthIndex = (bucket: string) => Number(bucket.slice(5, 7)) - 1;

const formatMonthTick = (bucket: string): string => {
	const monthLabel = shortMonthLabels[getMonthIndex(bucket)] ?? bucket.slice(5, 7);
	return `${monthLabel} ${bucket.slice(2, 4)}`;
};

const formatTooltipLabel = (bucket: string): string => {
	const monthLabel = longMonthLabels[getMonthIndex(bucket)] ?? bucket.slice(5, 7);
	return `${monthLabel} ${bucket.slice(0, 4)}`;
};

const toNumericValue = (
	value: number | string | (number | string)[] | undefined,
): number | null => {
	const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
	return Number.isFinite(numericValue) ? numericValue : null;
};

const formatActiveUsers = (
	value: number | string | (number | string)[] | undefined,
): string => toNumericValue(value)?.toLocaleString("de-DE") ?? "-";

export const MonthlyActiveUsersChart = ({ timeZone, trend }: MonthlyActiveUsersChartProps) => {
	const hasData = trend.some((bucket) => bucket.activeUsers > 0);

	return (
		<Card className="border-solarized-base2">
			<CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="text-base text-solarized-base00">
						Monatlich aktive Nutzer
					</CardTitle>
					<CardDescription>
						Einzigartige Nutzer pro Kalendermonat über den gesamten Zeitraum.
					</CardDescription>
				</div>
				<div
					className="inline-flex h-7 w-fit items-center rounded-full border border-solarized-base2 bg-solarized-base3 px-2.5 font-medium text-solarized-base01 text-xs"
					title={`Zeitzone: ${timeZone}`}
				>
					Monat
					<span className="ml-1 hidden sm:inline">· {timeZone}</span>
				</div>
			</CardHeader>
			<CardContent>
				{hasData ? (
					<ChartContainer config={chartConfig} className="h-[260px] w-full">
						<AreaChart accessibilityLayer data={trend}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="bucket"
								tickLine={false}
								axisLine={false}
								tickMargin={10}
								minTickGap={28}
								tickFormatter={(value: string) => formatMonthTick(value)}
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
							<ChartTooltip
								content={
									<ChartTooltipContent
										hideIndicator
										labelFormatter={(value) => (value ? formatTooltipLabel(String(value)) : "")}
										valueFormatter={(value) => formatActiveUsers(value)}
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
								type="monotone"
								dataKey="activeUsers"
								stroke="var(--color-activeUsers)"
								fill="url(#monthly-active-users-fill)"
								strokeWidth={2.5}
								dot={false}
							/>
						</AreaChart>
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
