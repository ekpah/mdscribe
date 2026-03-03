"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { DataTableColumnHeader } from "@repo/design-system/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle, Mail, Star, User } from "lucide-react";
import Image from "next/image";

export interface UserData {
	id: string;
	name: string | null;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
	subscriptionPlan: string | null;
	subscriptionStatus: string | null;
	hasActiveSubscription: boolean;
	_count: {
		templates: number;
		favourites: number;
		usageEvents: number;
	};
}

const columnHelper = createColumnHelper<UserData>();

const getSubscriptionLabel = (user: UserData) => {
	if (user.hasActiveSubscription) {
		const plan = (user.subscriptionPlan ?? "plus").toLowerCase();
		return plan === "plus" ? "Plus" : plan.charAt(0).toUpperCase() + plan.slice(1);
	}

	return "Free";
};

const formatDate = (date: Date | string) => {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(dateObj);
};

export const columns = [
	columnHelper.accessor(
		(row) => ({ email: row.email, image: row.image, name: row.name }),
		{
			cell: ({ getValue }) => {
				const { name, email, image } = getValue();
				return (
					<div className="flex items-center gap-3">
						{image ? (
							<Image
								src={image}
								alt={name || email}
								width={32}
								height={32}
								className="h-8 w-8 rounded-full"
								unoptimized
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
			header: "Benutzer",
			id: "user",
		},
	),
	columnHelper.accessor("emailVerified", {
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
		header: "Status",
		id: "status",
	}),
	columnHelper.accessor((row) => row, {
		cell: ({ getValue }) => {
			const user = getValue();
			const isPlus = user.hasActiveSubscription;
			const label = getSubscriptionLabel(user);

			return (
				<Badge
					variant="outline"
					className={
						isPlus
							? "border-solarized-violet text-solarized-violet"
							: "border-solarized-base1 text-solarized-base01"
					}
				>
					<Star className="mr-1 h-3 w-3" />
					{label}
				</Badge>
			);
		},
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Abo" />
		),
		id: "subscription",
		sortingFn: (rowA, rowB) => {
			const a = getSubscriptionLabel(rowA.original);
			const b = getSubscriptionLabel(rowB.original);
			return a.localeCompare(b);
		},
	}),
	columnHelper.accessor("_count.templates", {
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Vorlagen" />
		),
		id: "templates",
	}),
	columnHelper.accessor("_count.favourites", {
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Favoriten" />
		),
		id: "favourites",
	}),
	columnHelper.accessor("_count.usageEvents", {
		cell: ({ getValue }) => (
			<span className="text-solarized-base00">{getValue()}</span>
		),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Generierungen" />
		),
		id: "generations",
	}),
	columnHelper.accessor("createdAt", {
		cell: ({ getValue }) => (
			<span className="text-xs text-solarized-base01">
				{formatDate(getValue())}
			</span>
		),
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Registriert" />
		),
		id: "createdAt",
	}),
];
