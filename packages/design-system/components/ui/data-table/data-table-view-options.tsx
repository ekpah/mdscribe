"use client";

import { Settings2 } from "lucide-react";

import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import type { DataTableRenderToolbarProps } from "./data-table";

interface DataTableViewOptionsProps<TData extends object> {
	table: DataTableRenderToolbarProps<TData>["table"];
}

function DataTableViewOptions<TData extends object>({
	table,
}: DataTableViewOptionsProps<TData>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" className="ml-auto h-8 lg:flex">
					<Settings2 className="mr-2 h-4 w-4" />
					Spalten
				</Button>} />
			<DropdownMenuContent align="end" className="w-[150px]">
				<DropdownMenuLabel>Spalten anzeigen</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<table.Subscribe selector={(state) => state.columnVisibility}>
					{() =>
						table
					.getAllColumns()
					.filter(
						(column) =>
							typeof column.accessorFn !== "undefined" && column.getCanHide(),
					)
					.map((column) => {
						return (
							<DropdownMenuCheckboxItem
								key={column.id}
								className="capitalize"
								checked={column.getIsVisible()}
								onCheckedChange={(value) => column.toggleVisibility(!!value)}
							>
								{column.id}
							</DropdownMenuCheckboxItem>
						);
					})
					}
				</table.Subscribe>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { DataTableViewOptions };
