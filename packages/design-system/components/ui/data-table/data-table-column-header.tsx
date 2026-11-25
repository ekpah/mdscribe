"use client";

import { type Column, Subscribe } from "@tanstack/react-table";

import type { DataTableFeatures } from "./data-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../dropdown-menu";

interface DataTableColumnHeaderProps<TData extends object, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<DataTableFeatures, TData, TValue>;
	title: string;
}

function DataTableColumnHeader<TData extends object, TValue>({
	column,
	title,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<div className={cn("flex items-center space-x-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8 data-open:bg-accent"
					>
						<span>{title}</span>
						{/* Subscribed, so the arrow follows sorting even when this header is memoized. */}
						<Subscribe source={column.table.atoms.sorting}>
							{() =>
								column.getIsSorted() === "desc" ? (
									<ArrowDown className="ml-2 h-4 w-4" />
								) : column.getIsSorted() === "asc" ? (
									<ArrowUp className="ml-2 h-4 w-4" />
								) : (
									<ChevronsUpDown className="ml-2 h-4 w-4" />
								)
							}
						</Subscribe>
					</Button>}
				/>
				<DropdownMenuContent align="start">
					<DropdownMenuItem onClick={() => column.toggleSorting(false)}>
						<ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
						Aufsteigend
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => column.toggleSorting(true)}>
						<ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
						Absteigend
					</DropdownMenuItem>
					{column.getCanHide() && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
								<EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
								Ausblenden
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export { DataTableColumnHeader };
