"use client";

import {
	type ColumnDef,
	type Row,
	type Table as TanStackTable,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnFiltersState,
	type ExpandedState,
	type SortingState,
	type VisibilityState,
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

interface DataTableRenderToolbarProps<TData> {
	table: TanStackTable<TData>;
}

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table columns have mixed value types
interface DataTableProps<TData> {
	columns: ColumnDef<TData, any>[];
	data: TData[];
	onRowClick?: (row: TData, tableRow: Row<TData>) => void;
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

function DataTable<TData>({
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
		React.useState<VisibilityState>({});
	const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("");

	// Use controlled global filter if provided, otherwise use internal state
	const actualGlobalFilter = globalFilter ?? internalGlobalFilter;
	const setActualGlobalFilter = onGlobalFilterChange ?? setInternalGlobalFilter;

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		...(getSubRows && { getExpandedRowModel: getExpandedRowModel(), getSubRows }),
		...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
		...(enableSorting && {
			onSortingChange: setSorting,
			getSortedRowModel: getSortedRowModel(),
		}),
		...(enableFiltering && {
			onColumnFiltersChange: setColumnFilters,
			getFilteredRowModel: getFilteredRowModel(),
		}),
		...(getSubRows && { onExpandedChange: setExpanded }),
		...(enableGlobalFilter && {
			onGlobalFilterChange: setActualGlobalFilter,
			getFilteredRowModel: getFilteredRowModel(),
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

export { DataTable,  type DataTableRenderToolbarProps };
