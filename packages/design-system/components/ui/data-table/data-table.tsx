"use client";

import {
	type ColumnDef,
	type Table as TanStackTable,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnFiltersState,
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

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table columns have mixed value types
interface DataTableProps<TData> {
	columns: ColumnDef<TData, any>[];
	data: TData[];
	onRowClick?: (row: TData) => void;
	enablePagination?: boolean;
	enableSorting?: boolean;
	enableFiltering?: boolean;
	enableColumnVisibility?: boolean;
	renderToolbar?: (table: TanStackTable<TData>) => React.ReactNode;
	renderPagination?: (table: TanStackTable<TData>) => React.ReactNode;
	emptyMessage?: string;
}

function DataTable<TData>({
	columns,
	data,
	onRowClick,
	enablePagination = true,
	enableSorting = true,
	enableFiltering = true,
	enableColumnVisibility = true,
	renderToolbar,
	renderPagination,
	emptyMessage = "Keine Ergebnisse.",
}: DataTableProps<TData>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] =
		React.useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
		...(enableSorting && {
			onSortingChange: setSorting,
			getSortedRowModel: getSortedRowModel(),
		}),
		...(enableFiltering && {
			onColumnFiltersChange: setColumnFilters,
			getFilteredRowModel: getFilteredRowModel(),
		}),
		...(enableColumnVisibility && {
			onColumnVisibilityChange: setColumnVisibility,
		}),
		state: {
			...(enableSorting && { sorting }),
			...(enableFiltering && { columnFilters }),
			...(enableColumnVisibility && { columnVisibility }),
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
									onClick={() => onRowClick?.(row.original)}
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

export { DataTable, type DataTableProps };
