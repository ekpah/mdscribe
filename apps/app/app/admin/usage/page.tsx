"use client";

import { useState, useEffect } from "react";
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	createColumnHelper,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/design-system/components/ui/table";
import { Activity, Eye, Loader2, XCircle } from "lucide-react";
import { UsageEventDetail } from "./_components/UsageEventDetail";
import type { Prisma } from "@repo/database";

type UsageEventWithUser = Prisma.UsageEventGetPayload<{
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

type StatsFilter = "today" | "week" | "month" | "all";

const filterLabels: Record<StatsFilter, string> = {
	today: "Heute",
	week: "Woche",
	month: "Monat",
	all: "Gesamt",
};

const columnHelper = createColumnHelper<UsageEventWithUser>();

export default function UsagePage() {
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const [allItems, setAllItems] = useState<UsageEventWithUser[]>([]);
	const [statsFilter, setStatsFilter] = useState<StatsFilter>("month");

	// Stats query
	const { data: stats, isLoading: statsLoading } = useQuery(
		orpc.admin.usage.stats.queryOptions({ input: { filter: statsFilter } }),
	);

	// List query with pagination
	const { data, isLoading, isFetching, error } = useQuery({
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
					const newItems = data.items.filter(
						(item) => !existingIds.has(item.id),
					);
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

	const handleLoadMore = () => {
		if (data?.nextCursor) {
			setCursor(data.nextCursor);
		}
	};

	const columns = [
		columnHelper.accessor("timestamp", {
			header: "Zeitpunkt",
			cell: (info) => (
				<span className="whitespace-nowrap text-xs sm:text-sm">
					{formatDate(info.getValue())}
				</span>
			),
		}),
		columnHelper.accessor("user", {
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
		}),
		columnHelper.accessor("name", {
			header: () => <span className="hidden sm:inline">Aktion</span>,
			cell: (info) => (
				<Badge
					variant="outline"
					className="hidden whitespace-nowrap sm:inline-flex"
				>
					{info.getValue()}
				</Badge>
			),
		}),
		columnHelper.accessor("model", {
			header: () => <span className="hidden md:inline">Modell</span>,
			cell: (info) => (
				<span className="hidden font-mono text-xs md:inline">
					{info.getValue()?.split("/").pop() || "-"}
				</span>
			),
		}),
		columnHelper.accessor("cost", {
			header: "Kosten",
			cell: (info) => (
				<span className="whitespace-nowrap font-mono text-xs">
					{formatCost(info.getValue())}
				</span>
			),
		}),
		columnHelper.accessor("totalTokens", {
			header: () => <span className="hidden sm:inline">Tokens</span>,
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
						setSelectedEventId(row.original.id);
					}}
					className="h-8 w-8"
				>
					<Eye className="h-4 w-4" />
				</Button>
			),
		}),
	];

	const table = useReactTable({
		data: allItems,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const errorMessage =
		error instanceof Error
			? error.message
			: error
				? String(error)
				: "Fehler beim Laden der Events";

	if (isLoading && allItems.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-6xl">
					<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
						<div className="flex items-center gap-2 text-solarized-base01">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span className="text-sm sm:text-base">
								Events werden geladen...
							</span>
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
							<p className="text-sm text-solarized-base01 sm:text-base">
								{errorMessage}
							</p>
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
						<ToggleGroup
							type="single"
							value={statsFilter}
							variant="outline"
							onValueChange={(value) => {
								if (value) setStatsFilter(value as StatsFilter);
							}}
							className="mb-4 w-full"
						>
							{(Object.keys(filterLabels) as StatsFilter[]).map((filter) => (
								<ToggleGroupItem key={filter} value={filter} className="flex-1">
									{filterLabels[filter]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>

						{/* Stats Grid */}
						<div className="grid grid-cols-3 gap-4 sm:gap-6">
							<div className="space-y-1">
								<p className="text-xs font-medium text-solarized-base01 sm:text-sm">
									Events
								</p>
								<p className="text-base font-semibold text-solarized-base00 sm:text-lg">
									{statsLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										(stats?.totalEvents?.toLocaleString("de-DE") ?? "-")
									)}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-solarized-base01 sm:text-sm">
									Tokens
								</p>
								<p className="text-base font-semibold text-solarized-cyan sm:text-lg">
									{statsLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										(stats?.totalTokens?.toLocaleString("de-DE") ?? "-")
									)}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-solarized-base01 sm:text-sm">
									Kosten
								</p>
								<p className="text-base font-semibold text-solarized-green sm:text-lg">
									{statsLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : stats?.totalCost !== undefined ? (
										`$${stats.totalCost.toFixed(2)}`
									) : (
										"-"
									)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Events Table */}
				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							Nutzungs-Events
						</CardTitle>
						<CardDescription>
							Alle AI-Generierungen mit Details zu Kosten und Token-Nutzung
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									{table.getHeaderGroups().map((headerGroup) => (
										<TableRow key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<TableHead
													key={header.id}
													className="text-solarized-base00"
												>
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</TableHead>
											))}
										</TableRow>
									))}
								</TableHeader>
								<TableBody>
									{table.getRowModel().rows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={columns.length}
												className="text-center text-solarized-base01"
											>
												Keine Events gefunden
											</TableCell>
										</TableRow>
									) : (
										table.getRowModel().rows.map((row) => (
											<TableRow
												key={row.id}
												onClick={() => setSelectedEventId(row.original.id)}
												className="cursor-pointer hover:bg-solarized-base2/50"
											>
												{row.getVisibleCells().map((cell) => (
													<TableCell key={cell.id}>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												))}
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>

						{/* Load More Button */}
						{data?.hasMore && (
							<div className="mt-4 flex justify-center">
								<Button
									variant="outline"
									onClick={handleLoadMore}
									disabled={isFetching}
									className="border-solarized-base2"
								>
									{isFetching ? (
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
				event={selectedEvent}
				open={!!selectedEventId}
				onOpenChange={(open) => {
					if (!open) setSelectedEventId(null);
				}}
			/>
		</div>
	);
}
