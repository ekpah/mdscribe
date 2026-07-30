"use client";

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
	DataTableViewOptions,
} from "@repo/design-system/components/ui/data-table";
import type { DataTableRenderToolbarProps } from "@repo/design-system/components/ui/data-table";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { SearchableSelect } from "@repo/design-system/components/ui/searchable-select";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Database, Loader2, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

import { columns, formatTimestamp, getUserDisplayName } from "./columns";
import type { AdminTemplateRow } from "./columns";

const TemplateTableToolbar = ({
	onSearchFilterChange,
	searchFilter,
	table,
}: {
	onSearchFilterChange: (event: ChangeEvent<HTMLInputElement>) => void;
	searchFilter: string;
	table: DataTableRenderToolbarProps<AdminTemplateRow>["table"];
}) => (
	<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
		<Input
			className="w-full md:max-w-sm"
			onChange={onSearchFilterChange}
			placeholder={USER_MESSAGES.adminTemplates.searchPlaceholder}
			value={searchFilter}
		/>
		<div className="hidden md:block">
			<DataTableViewOptions table={table} />
		</div>
	</div>
);

export default function AdminTemplatesPageClient() {
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();
	const { data: templates = [], error, isLoading } = useQuery(templatesQueryOptions);
	const templateRows = templates as AdminTemplateRow[];

	const [searchFilter, setSearchFilter] = useState("");
	const [selectedAuthorId, setSelectedAuthorId] = useState("all");
	const [selectedFavouriteOfUserId, setSelectedFavouriteOfUserId] = useState("all");

	const authorOptions = useMemo(() => {
		const options = new Map<string, { id: string; label: string }>();

		for (const item of templateRows) {
			if (item.author) {
				options.set(item.author.id, {
					id: item.author.id,
					label: getUserDisplayName(item.author),
				});
			}
		}

		return [...options.values()].toSorted((a, b) => a.label.localeCompare(b.label, "de-DE"));
	}, [templateRows]);

	const favouriteUserOptions = useMemo(() => {
		const options = new Map<string, { id: string; label: string }>();

		for (const item of templateRows) {
			for (const favouriteUser of item.favouriteOf) {
				options.set(favouriteUser.id, {
					id: favouriteUser.id,
					label: getUserDisplayName(favouriteUser),
				});
			}
		}

		return [...options.values()].toSorted((a, b) => a.label.localeCompare(b.label, "de-DE"));
	}, [templateRows]);

	const totalFavourites = templateRows.reduce((sum, item) => sum + item._count.favouriteOf, 0);

	const filteredTemplates = useMemo(() => {
		const normalizedSearch = searchFilter.trim().toLowerCase();

		return templateRows.filter((item) => {
			if (selectedAuthorId !== "all" && item.author?.id !== selectedAuthorId) {
				return false;
			}

			if (
				selectedFavouriteOfUserId !== "all" &&
				!item.favouriteOf.some((favouriteUser) => favouriteUser.id === selectedFavouriteOfUserId)
			) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			const authorLabel = item.author ? getUserDisplayName(item.author).toLowerCase() : "";

			return (
				item.title.toLowerCase().includes(normalizedSearch) ||
				item.category.toLowerCase().includes(normalizedSearch) ||
				authorLabel.includes(normalizedSearch)
			);
		});
	}, [searchFilter, selectedAuthorId, selectedFavouriteOfUserId, templateRows]);

	const handleSearchFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSearchFilter(event.target.value);
	}, []);

	const renderTableToolbar = useCallback(
		(table: DataTableRenderToolbarProps<AdminTemplateRow>["table"]) => (
			<TemplateTableToolbar
				onSearchFilterChange={handleSearchFilterChange}
				searchFilter={searchFilter}
				table={table}
			/>
		),
		[handleSearchFilterChange, searchFilter],
	);

	const renderTablePagination = useCallback(
		(table: DataTableRenderToolbarProps<AdminTemplateRow>["table"]) => (
			<DataTablePagination table={table} />
		),
		[],
	);

	if (isLoading && templateRows.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[320px] max-w-7xl items-center justify-center">
					<div className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>{USER_MESSAGES.adminTemplates.loading}</span>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		const errorMessage =
			error instanceof Error ? error.message : USER_MESSAGES.adminTemplates.loadError;

		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[320px] max-w-7xl items-center justify-center">
					<div className="space-y-2 text-center">
						<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
						<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
							{USER_MESSAGES.adminTemplates.loadError}
						</h2>
						<p className="text-sm text-solarized-base01 sm:text-base">{errorMessage}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
						<Database className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
					</div>
					<div>
						<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
							{USER_MESSAGES.adminTemplates.title}
						</h1>
						<p className="text-sm text-solarized-base01 sm:text-base">
							{USER_MESSAGES.adminTemplates.description}
						</p>
					</div>
				</div>

				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-3 gap-4 sm:gap-6">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									{USER_MESSAGES.adminTemplates.totalTemplates}
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{templateRows.length}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									{USER_MESSAGES.adminTemplates.totalFavourites}
								</p>
								<p className="font-semibold text-base text-solarized-cyan sm:text-lg">
									{totalFavourites}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									{USER_MESSAGES.adminTemplates.authors}
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
							{USER_MESSAGES.adminTemplates.overviewTitle}
						</CardTitle>
						<CardDescription>{USER_MESSAGES.adminTemplates.overviewDescription}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="template-author-filter">
									{USER_MESSAGES.adminTemplates.author}
								</Label>
								<SearchableSelect
									emptyMessage={USER_MESSAGES.searchableSelect.userEmpty}
									id="template-author-filter"
									onValueChange={setSelectedAuthorId}
									options={[
										{
											label: USER_MESSAGES.adminTemplates.allAuthors,
											value: "all",
										},
										...authorOptions.map((option) => ({
											label: option.label,
											value: option.id,
										})),
									]}
									placeholder={USER_MESSAGES.adminTemplates.allAuthors}
									searchPlaceholder={USER_MESSAGES.searchableSelect.userSearch}
									value={selectedAuthorId}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="template-favourite-user-filter">
									{USER_MESSAGES.adminTemplates.favouritedBy}
								</Label>
								<SearchableSelect
									emptyMessage={USER_MESSAGES.searchableSelect.userEmpty}
									id="template-favourite-user-filter"
									onValueChange={setSelectedFavouriteOfUserId}
									options={[
										{
											label: USER_MESSAGES.adminTemplates.allUsers,
											value: "all",
										},
										...favouriteUserOptions.map((option) => ({
											label: option.label,
											value: option.id,
										})),
									]}
									placeholder={USER_MESSAGES.adminTemplates.allUsers}
									searchPlaceholder={USER_MESSAGES.searchableSelect.userSearch}
									value={selectedFavouriteOfUserId}
								/>
							</div>
						</div>

						<div className="text-sm text-solarized-base01">
							{filteredTemplates.length} {USER_MESSAGES.adminTemplates.of} {templateRows.length}{" "}
							{USER_MESSAGES.adminTemplates.templates}
						</div>

						<div className="space-y-3 md:hidden">
							<Input
								onChange={handleSearchFilterChange}
								placeholder={USER_MESSAGES.adminTemplates.searchPlaceholder}
								value={searchFilter}
							/>
							{filteredTemplates.length === 0 ? (
								<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 p-4 text-sm text-solarized-base01">
									{USER_MESSAGES.adminTemplates.empty}
								</div>
							) : (
								filteredTemplates.map((item) => (
									<div
										className="rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-4"
										key={item.id}
									>
										<p className="truncate font-medium text-solarized-base00">{item.title}</p>
										<p className="text-xs text-solarized-base01">{item.category}</p>

										<div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
											<div>
												<p className="text-xs text-solarized-base01">
													{USER_MESSAGES.adminTemplates.author}
												</p>
												<p className="text-solarized-base00">
													{item.author
														? getUserDisplayName(item.author)
														: USER_MESSAGES.adminTemplates.unknown}
												</p>
											</div>
											<div>
												<p className="text-xs text-solarized-base01">
													{USER_MESSAGES.adminTemplates.favourites}
												</p>
												<p className="text-solarized-base00">{item._count.favouriteOf}</p>
											</div>
										</div>

										<div className="mt-3 flex items-center gap-2 text-xs text-solarized-base01">
											<Clock3 className="h-3.5 w-3.5" />
											<span>
												{USER_MESSAGES.adminTemplates.updated} {formatTimestamp(item.updatedAt)}
											</span>
										</div>
									</div>
								))
							)}
						</div>

						<div className="hidden md:block">
							<DataTable
								columns={columns}
								data={filteredTemplates}
								emptyMessage={USER_MESSAGES.adminTemplates.empty}
								renderPagination={renderTablePagination}
								renderToolbar={renderTableToolbar}
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
