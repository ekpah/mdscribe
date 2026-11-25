"use client";

import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnVisibilityState,
	type ExpandedState,
	type ReactTable,
	type Row,
	type SortingState,
	columnFilteringFeature,
	columnVisibilityFeature,
	createExpandedRowModel,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	createTableHook,
	filterFn_includesString,
	flexRender,
	globalFilteringFeature,
	rowExpandingFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
} from "@tanstack/react-table";
import * as React from "react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../table";

// Every feature the props can turn on; the props switch them off per table with
// `enable*` and `manual*` options, which keeps this feature set stable.
const dataTableFeatures = tableFeatures({
	columnFilteringFeature,
	columnVisibilityFeature,
	globalFilteringFeature,
	rowExpandingFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	expandedRowModel: createExpandedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: { includesString: filterFn_includesString },
	// The sort functions `sortFn: "auto"` picks from, as in TanStack Table 8.
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
});

type DataTableFeatures = typeof dataTableFeatures;

// The admin tables' shared conventions: column definitions made with
// `createDataTableColumnHelper` are typed for exactly these features.
const { createAppColumnHelper: createDataTableColumnHelper, useAppTable } = createTableHook({
	features: dataTableFeatures,
});

interface DataTableRenderToolbarProps<TData extends object> {
	table: ReactTable<DataTableFeatures, TData>;
}

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table columns have mixed value types
interface DataTableProps<TData extends object> {
	columns: ColumnDef<DataTableFeatures, TData, any>[];
	data: TData[];
	onRowClick?: (row: TData, tableRow: Row<DataTableFeatures, TData>) => void;
	enablePagination?: boolean;
	enableSorting?: boolean;
	enableFiltering?: boolean;
	enableGlobalFilter?: boolean;
	globalFilter?: string;
	onGlobalFilterChange?: (value: string) => void;
	enableColumnVisibility?: boolean;
	renderToolbar?: (
		table: DataTableRenderToolbarProps<TData>["table"],
	) => React.ReactNode;
	renderPagination?: (
		table: DataTableRenderToolbarProps<TData>["table"],
	) => React.ReactNode;
	emptyMessage?: string;
	getSubRows?: (row: TData) => TData[] | undefined;
}

function DataTable<TData extends object>({
	columns,
	data,
	onRowClick,
	enablePagination = true,
	enableSorting = true,
	enableFiltering = true,
	enableGlobalFilter = false,
	globalFilter,
	onGlobalFilterChange,
	enableColumnVisibility = true,
	renderToolbar,
	renderPagination,
	emptyMessage = "Keine Ergebnisse.",
	getSubRows,
}: DataTableProps<TData>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [expanded, setExpanded] = React.useState<ExpandedState>({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<ColumnVisibilityState>({});
	const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("");

	// Use controlled global filter if provided, otherwise use internal state
	const actualGlobalFilter = globalFilter ?? internalGlobalFilter;
	const setActualGlobalFilter = onGlobalFilterChange ?? setInternalGlobalFilter;

	const table = useAppTable({
		data,
		columns,
		// Without these, the v8 table had no row model for the stage.
		manualExpanding: !getSubRows,
		manualFiltering: !(enableFiltering || enableGlobalFilter),
		manualPagination: !enablePagination,
		enableSorting,
		enableColumnFilters: enableFiltering,
		enableGlobalFilter,
		enableHiding: enableColumnVisibility,
		...(getSubRows && { getSubRows, onExpandedChange: setExpanded }),
		...(enableSorting && { onSortingChange: setSorting }),
		...(enableFiltering && { onColumnFiltersChange: setColumnFilters }),
		...(enableGlobalFilter && {
			onGlobalFilterChange: setActualGlobalFilter,
			globalFilterFn: "includesString",
		}),
		...(enableColumnVisibility && {
			onColumnVisibilityChange: setColumnVisibility,
		}),
		state: {
			...(enableSorting && { sorting }),
			...(enableFiltering && { columnFilters }),
			...(enableGlobalFilter && { globalFilter: actualGlobalFilter }),
			...(enableColumnVisibility && { columnVisibility }),
			...(getSubRows && { expanded }),
		},
	});

	return (
		<div className="space-y-4">
			{renderToolbar?.(table)}
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
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
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
								onClick={() => onRowClick?.(row.original, row)}
									className={onRowClick ? "cursor-pointer" : undefined}
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
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									{emptyMessage}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			{enablePagination && renderPagination?.(table)}
		</div>
	);
}

export {
	createDataTableColumnHelper,
	DataTable,
	type DataTableFeatures,
	type DataTableRenderToolbarProps,
};
