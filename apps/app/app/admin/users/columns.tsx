"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@repo/design-system/components/ui/badge";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { CheckCircle, Mail, User } from "lucide-react";

export interface UserData {
	id: string;
	name: string | null;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
	_count: {
		templates: number;
		favourites: number;
		usageEvents: number;
	};
}

const columnHelper = createColumnHelper<UserData>();

function formatDate(date: Date | string) {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(dateObj);
}

export const columns = [
	columnHelper.accessor(
		(row) => ({ name: row.name, email: row.email, image: row.image }),
		{
			id: "user",
			header: "Benutzer",
			cell: ({ getValue }) => {
				const { name, email, image } = getValue();
				return (
					<div className="flex items-center gap-3">
						{image ? (
							<img
								src={image}
								alt={name || email}
								className="h-8 w-8 rounded-full"
							/>
						) : (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-solarized-base2">
								<User className="h-4 w-4 text-solarized-base01" />
							</div>
						)}
						<div className="flex flex-col">
							<span className="font-medium text-solarized-base00">
								{name || "Kein Name"}
							</span>
							<span className="text-xs text-solarized-base01">{email}</span>
						</div>
					</div>
				);
			},
			enableSorting: false,
			filterFn: (row, id, filterValue: string) => {
				const { name, email } = row.getValue(id) as {
					name: string | null;
					email: string;
				};
				const search = filterValue.toLowerCase();
				return (
					(name?.toLowerCase().includes(search) ?? false) ||
					email.toLowerCase().includes(search)
				);
			},
		},
	),
	columnHelper.accessor("emailVerified", {
		id: "status",
		header: "Status",
		cell: ({ getValue }) => {
			const verified = getValue();
			return verified ? (
				<Badge
					variant="outline"
					className="border-solarized-green text-solarized-green"
				>
					<CheckCircle className="mr-1 h-3 w-3" />
					Verifiziert
				</Badge>
			) : (
				<Badge
					variant="outline"
					className="border-solarized-orange text-solarized-orange"
				>
					<Mail className="mr-1 h-3 w-3" />
					Nicht verifiziert
				</Badge>
			);
		},
		enableSorting: false,
	}),
	columnHelper.accessor("_count.templates", {
		id: "templates",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Vorlagen" />
		),
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
	}),
	columnHelper.accessor("_count.favourites", {
		id: "favourites",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Favoriten" />
		),
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
	}),
	columnHelper.accessor("_count.usageEvents", {
		id: "generations",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Generierungen" />
		),
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
	}),
	columnHelper.accessor("createdAt", {
		id: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Registriert" />
		),
		cell: ({ getValue }) => (
			<span className="text-xs text-solarized-base01">
				{formatDate(getValue())}
			</span>
		),
	}),
];
