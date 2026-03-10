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
import {
	DataTable,
	DataTablePagination,
	type DataTableRenderToolbarProps,
	DataTableViewOptions,
} from "@repo/design-system/components/ui/data-table";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { columns, getUserDisplayName } from "./columns";
import type { AdminTemplateRow } from "./columns";

type EmbeddingFilter = "all" | "with" | "without";
type MigrationMode = "missing" | "all";

const formatDuration = (seconds: number): string => {
	if (seconds < 60) {
		return `~${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `~${minutes}m ${remainingSeconds}s`;
};

const TemplateTableToolbar = ({
	table,
}: {
	table: DataTableRenderToolbarProps<AdminTemplateRow>["table"];
}) => {
	const handleTemplateFilterChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			table
				.getColumn("template")
				?.setFilterValue(event.target.value);
		},
		[table],
	);

	return (
		<div className="flex items-center justify-between gap-2">
			<Input
				placeholder="Vorlage, Kategorie oder Autor suchen..."
				value={
					(table
						.getColumn("template")
						?.getFilterValue() as string) ?? ""
				}
				onChange={handleTemplateFilterChange}
				className="max-w-sm"
			/>
			<DataTableViewOptions table={table} />
		</div>
	);
};

export default function AdminTemplatesPage() {
	const queryClient = useQueryClient();
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();
	const statsQueryOptions = orpc.admin.embeddings.stats.queryOptions();

	const {
		data: templates = [],
		isLoading: isLoadingTemplates,
		isFetching: isFetchingTemplates,
		error: templatesError,
	} = useQuery(templatesQueryOptions);

	const templateRows = templates as AdminTemplateRow[];

	const {
		data: embeddingStats,
		isLoading: isLoadingStats,
		isFetching: isFetchingStats,
		error: statsError,
	} = useQuery(statsQueryOptions);

	const [selectedAuthorId, setSelectedAuthorId] = useState("all");
	const [selectedFavouriteOfUserId, setSelectedFavouriteOfUserId] =
		useState("all");
	const [embeddingFilter, setEmbeddingFilter] =
		useState<EmbeddingFilter>("all");
	const [batchSize, setBatchSize] = useState(10);
	const [delayBetweenBatches, setDelayBetweenBatches] = useState(1000);
	const [migrationMode, setMigrationMode] = useState<MigrationMode>("missing");

	const authorOptions = useMemo(() => {
		const map = new Map<string, { id: string; label: string }>();

		for (const item of templateRows) {
			if (!item.author) {
				continue;
			}

			map.set(item.author.id, {
				id: item.author.id,
				label: getUserDisplayName(item.author),
			});
		}

		return [...map.values()].toSorted((a, b) =>
			a.label.localeCompare(b.label, "de-DE"),
		);
	}, [templateRows]);

	const favouriteUserOptions = useMemo(() => {
		const map = new Map<string, { id: string; label: string }>();

		for (const item of templateRows) {
			for (const favUser of item.favouriteOf) {
				map.set(favUser.id, {
					id: favUser.id,
					label: getUserDisplayName(favUser),
				});
			}
		}

		return [...map.values()].toSorted((a, b) =>
			a.label.localeCompare(b.label, "de-DE"),
		);
	}, [templateRows]);

	const totalTemplates = embeddingStats?.totalTemplates ?? templateRows.length;
	const templatesWithEmbeddings =
		embeddingStats?.templatesWithEmbeddings ??
		templateRows.filter((item) => item.hasEmbedding).length;
	const templatesWithoutEmbeddings =
		embeddingStats?.templatesWithoutEmbeddings ??
		templateRows.filter((item) => !item.hasEmbedding).length;
	const totalFavourites = templateRows.reduce(
		(sum, item) => sum + item._count.favouriteOf,
		0,
	);
	const estimatedMigrationSeconds = useMemo(() => {
		const templatesToProcess =
			migrationMode === "missing" ? templatesWithoutEmbeddings : totalTemplates;
		if (templatesToProcess <= 0) {
			return 0;
		}

		const safeBatchSize = Math.max(1, batchSize);
		const safeDelay = Math.max(0, delayBetweenBatches);
		const numberOfBatches = Math.ceil(templatesToProcess / safeBatchSize);
		const totalDelayMs = Math.max(0, numberOfBatches - 1) * safeDelay;
		const estimatedEmbeddingMs = templatesToProcess * 2000;
		return Math.round((totalDelayMs + estimatedEmbeddingMs) / 1000);
	}, [
		batchSize,
		delayBetweenBatches,
		migrationMode,
		templatesWithoutEmbeddings,
		totalTemplates,
	]);

	const filteredTemplates = useMemo(
		() =>
			templateRows.filter((item) => {
				if (
					selectedAuthorId !== "all" &&
					item.author?.id !== selectedAuthorId
				) {
					return false;
				}

				if (
					selectedFavouriteOfUserId !== "all" &&
					!item.favouriteOf.some(
						(favUser) => favUser.id === selectedFavouriteOfUserId,
					)
				) {
					return false;
				}

				if (embeddingFilter === "with" && !item.hasEmbedding) {
					return false;
				}

				if (embeddingFilter === "without" && item.hasEmbedding) {
					return false;
				}

				return true;
			}),
		[
			embeddingFilter,
			selectedAuthorId,
			selectedFavouriteOfUserId,
			templateRows,
		],
	);

	const refreshOverview = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: templatesQueryOptions.queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: statsQueryOptions.queryKey,
			}),
		]);
		toast.success("Vorlagenübersicht aktualisiert");
	}, [queryClient, statsQueryOptions.queryKey, templatesQueryOptions.queryKey]);

	const migrateMutation = useMutation({
		mutationFn: (input: {
			mode: MigrationMode;
			batchSize: number;
			delayBetweenBatches: number;
		}) => orpc.admin.embeddings.migrate.call(input),
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Migration konnte nicht ausgeführt werden",
			);
		},
		onSuccess: async (result) => {
			toast.success(result.message ?? "Embedding-Migration abgeschlossen");
			await refreshOverview();
		},
	});

	const handleRunMigration = useCallback(() => {
		const templatesToProcess =
			migrationMode === "missing" ? templatesWithoutEmbeddings : totalTemplates;

		if (templatesToProcess === 0) {
			toast.error("Keine Vorlagen für die gewählte Migration verfügbar");
			return;
		}

		const actionText =
			migrationMode === "missing"
				? `Embeddings für ${templatesToProcess} Vorlagen ohne Embeddings generieren`
				: `Embeddings für alle ${templatesToProcess} Vorlagen neu generieren`;

		if (
			!confirm(
				`${actionText}? Dieser Vorgang kann je nach Umfang mehrere Minuten dauern.`,
			)
		) {
			return;
		}

		migrateMutation.mutate({
			batchSize: Math.max(1, batchSize),
			delayBetweenBatches: Math.max(0, delayBetweenBatches),
			mode: migrationMode,
		});
	}, [
		batchSize,
		delayBetweenBatches,
		migrateMutation,
		migrationMode,
		templatesWithoutEmbeddings,
		totalTemplates,
	]);

	const handleMigrationModeChange = useCallback((value: string) => {
		setMigrationMode(value as MigrationMode);
	}, []);

	const handleBatchSizeChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setBatchSize(Number.parseInt(event.target.value, 10) || 10);
		},
		[],
	);

	const handleDelayBetweenBatchesChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setDelayBetweenBatches(
				Number.parseInt(event.target.value, 10) || 0,
			);
		},
		[],
	);

	const handleEmbeddingFilterChange = useCallback((value: string) => {
		setEmbeddingFilter(value as EmbeddingFilter);
	}, []);

	const renderTableToolbar = useCallback(
		(table: DataTableRenderToolbarProps<AdminTemplateRow>["table"]) => (
			<TemplateTableToolbar table={table} />
		),
		[],
	);

	const renderTablePagination = useCallback(
		(table: DataTableRenderToolbarProps<AdminTemplateRow>["table"]) => (
			<DataTablePagination table={table} />
		),
		[],
	);

	const isInitialLoading =
		(isLoadingTemplates && templateRows.length === 0) ||
		(isLoadingStats && !embeddingStats);
	const queryError = templatesError ?? statsError;

	const queryErrorMessage =
		queryError instanceof Error
			? queryError.message
			: (queryError
				? String(queryError)
				: "Seite konnte nicht geladen werden");

	if (isInitialLoading) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-7xl">
					<div className="flex min-h-[320px] items-center justify-center">
						<div className="flex items-center gap-2 text-solarized-base01">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span>Vorlagenverwaltung wird geladen...</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (queryError) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-7xl">
					<div className="flex min-h-[320px] items-center justify-center">
						<div className="space-y-2 text-center">
							<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
							<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
								Seite konnte nicht geladen werden
							</h2>
							<p className="text-sm text-solarized-base01 sm:text-base">
								{queryErrorMessage}
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
								<Database className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
							</div>
							<div>
								<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
									Vorlagenverwaltung
								</h1>
								<p className="text-sm text-solarized-base01 sm:text-base">
									Übersicht aller Vorlagen inklusive Embedding-Verwaltung
								</p>
							</div>
						</div>
						<Button
							variant="outline"
							onClick={refreshOverview}
							disabled={
								isFetchingTemplates ||
								isFetchingStats ||
								migrateMutation.isPending
							}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${
									isFetchingTemplates || isFetchingStats ? "animate-spin" : ""
								}`}
							/>
							Aktualisieren
						</Button>
					</div>
				</div>

				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-5">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Vorlagen gesamt
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{totalTemplates}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Mit Embedding
								</p>
								<p className="font-semibold text-base text-solarized-green sm:text-lg">
									{templatesWithEmbeddings}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Ohne Embedding
								</p>
								<p className="font-semibold text-base text-solarized-orange sm:text-lg">
									{templatesWithoutEmbeddings}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Favoriten gesamt
								</p>
								<p className="font-semibold text-base text-solarized-cyan sm:text-lg">
									{totalFavourites}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Autoren
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{authorOptions.length}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							Embedding-Verwaltung
						</CardTitle>
						<CardDescription>
							Fehlende Embeddings generieren oder alle Embeddings neu erstellen
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 lg:grid-cols-3">
							<div className="space-y-2">
								<Label>Migrationsmodus</Label>
								<Select
									value={migrationMode}
									onValueChange={handleMigrationModeChange}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="missing">
											Nur fehlende Embeddings ({templatesWithoutEmbeddings})
										</SelectItem>
										<SelectItem value="all">
											Alle Embeddings neu generieren ({totalTemplates})
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="embedding-batch-size">Batch-Größe</Label>
								<Input
									id="embedding-batch-size"
									type="number"
									min={1}
									max={50}
									value={batchSize}
									onChange={handleBatchSizeChange}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="embedding-delay">Batch-Verzögerung (ms)</Label>
								<Input
									id="embedding-delay"
									type="number"
									min={0}
									value={delayBetweenBatches}
									onChange={handleDelayBetweenBatchesChange}
								/>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-3 text-sm">
							<Badge variant="outline" className="text-solarized-blue">
								Geschätzte Dauer: {formatDuration(estimatedMigrationSeconds)}
							</Badge>
							<Badge variant="outline" className="text-solarized-base01">
								Verarbeitung:{" "}
								{migrationMode === "missing"
									? templatesWithoutEmbeddings
									: totalTemplates}{" "}
								Vorlagen
							</Badge>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Button
								onClick={handleRunMigration}
								disabled={migrateMutation.isPending}
							>
								{migrateMutation.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Migration starten
							</Button>
							{migrateMutation.data && (
								<div className="text-sm text-solarized-base01">
									{migrateMutation.data.successfulEmbeddings} erfolgreich,{" "}
									{migrateMutation.data.failedEmbeddings} fehlgeschlagen
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							Template-Übersicht
						</CardTitle>
						<CardDescription>
							Filterbar nach Autor und Favorisiert-von sowie Embedding-Status
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="space-y-2">
								<Label>Autor</Label>
								<Select
									value={selectedAuthorId}
									onValueChange={setSelectedAuthorId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Alle Autoren" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Alle Autoren</SelectItem>
										{authorOptions.map((option) => (
											<SelectItem key={option.id} value={option.id}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Favorisiert von</Label>
								<Select
									value={selectedFavouriteOfUserId}
									onValueChange={setSelectedFavouriteOfUserId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Alle Nutzer" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Alle Nutzer</SelectItem>
										{favouriteUserOptions.map((option) => (
											<SelectItem key={option.id} value={option.id}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Embedding</Label>
								<Select
									value={embeddingFilter}
									onValueChange={handleEmbeddingFilterChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Alle" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Alle</SelectItem>
										<SelectItem value="with">Mit Embedding</SelectItem>
										<SelectItem value="without">Ohne Embedding</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="text-sm text-solarized-base01">
							{filteredTemplates.length} von {templateRows.length} Vorlagen
						</div>

						<DataTable
							columns={columns}
							data={filteredTemplates}
							emptyMessage="Keine Vorlagen für die aktuellen Filter gefunden."
							renderToolbar={renderTableToolbar}
							renderPagination={renderTablePagination}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
