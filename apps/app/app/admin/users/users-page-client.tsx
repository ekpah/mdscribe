"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { DataTable, DataTablePagination, DataTableViewOptions } from '@repo/design-system/components/ui/data-table';
import type { DataTableRenderToolbarProps } from '@repo/design-system/components/ui/data-table';
import { Input } from "@repo/design-system/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle,
	Loader2,
	Mail,
	Star,
	User,
	Users,
	XCircle,
} from "lucide-react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { orpc } from "@/lib/orpc";
import { columns, formatDate, getSubscriptionLabel } from './columns';
import type { UserData } from './columns';

const UsersTableToolbar = ({
	onSearchFilterChange,
	searchFilter,
	table,
}: {
	onSearchFilterChange: (event: ChangeEvent<HTMLInputElement>) => void;
	searchFilter: string;
	table: DataTableRenderToolbarProps<UserData>["table"];
}) => {
	const handleUserFilterChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onSearchFilterChange(event);
		},
		[onSearchFilterChange],
	);

	return (
		<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
			<Input
				placeholder="Benutzer suchen..."
				value={searchFilter}
				onChange={handleUserFilterChange}
				className="w-full md:max-w-sm"
			/>
			<div className="hidden md:block">
				<DataTableViewOptions table={table} />
			</div>
		</div>
	);
};

export default function UsersPageClient() {
	const [searchFilter, setSearchFilter] = useState("");

	const {
		data: users = [],
		isLoading,
		error,
	} = useQuery(orpc.admin.users.list.queryOptions());

	const handleSearchFilterChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSearchFilter(event.target.value);
		},
		[],
	);

	const renderToolbar = useCallback(
		(table: DataTableRenderToolbarProps<UserData>["table"]) => (
			<UsersTableToolbar
				table={table}
				searchFilter={searchFilter}
				onSearchFilterChange={handleSearchFilterChange}
			/>
		),
		[handleSearchFilterChange, searchFilter],
	);

	const renderPagination = useCallback(
		(table: DataTableRenderToolbarProps<UserData>["table"]) => (
			<DataTablePagination table={table} />
		),
		[],
	);

	const errorMessage = (() => {
		if (error instanceof Error) {
			return error.message;
		}
		if (error) {
			return String(error);
		}
		return "Fehler beim Laden der Benutzer";
	})();
	const totalGenerations = users.reduce(
		(sum, user) => sum + Number(user._count.usageEvents ?? 0),
		0,
	);
	const plusUsers = users.filter((user) => user.hasActiveSubscription).length;
	const freeUsers = users.length - plusUsers;
	const filteredUsers = useMemo(() => {
		const normalizedSearch = searchFilter.trim().toLowerCase();
		if (!normalizedSearch) {
			return users;
		}

		return users.filter((user) => {
			const userName = user.name?.toLowerCase() ?? "";
			const userEmail = user.email.toLowerCase();
			return (
				userName.includes(normalizedSearch) ||
				userEmail.includes(normalizedSearch)
			);
		});
	}, [searchFilter, users]);

	if (isLoading && users.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-6xl">
					<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
						<div className="flex items-center gap-2 text-solarized-base01">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span className="text-sm sm:text-base">
								Benutzer werden geladen...
							</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error && users.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-6xl">
					<div className="flex min-h-[300px] items-center justify-center sm:min-h-[400px]">
						<div className="space-y-2 text-center">
							<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
							<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
								Seite konnte nicht geladen werden
							</h2>
							<p className="text-sm text-solarized-base01 sm:text-base">
								{errorMessage || "Zugriff auf diese Seite nicht möglich"}
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
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-cyan/10 sm:h-12 sm:w-12">
							<Users className="h-5 w-5 text-solarized-cyan sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
								Benutzerverwaltung
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								Verwalten Sie alle Benutzerkonten auf der Plattform
							</p>
						</div>
					</div>
				</div>

				{/* Stats Card */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-6">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Gesamt
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{users.length}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Verifiziert
								</p>
								<p className="font-semibold text-base text-solarized-green sm:text-lg">
									{users.filter((u) => u.emailVerified).length}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Nicht verifiziert
								</p>
								<p className="font-semibold text-base text-solarized-orange sm:text-lg">
									{users.filter((u) => !u.emailVerified).length}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									KI-Nutzung (Monat)
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{totalGenerations}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Free
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{freeUsers}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Plus
								</p>
								<p className="font-semibold text-base text-solarized-violet sm:text-lg">
									{plusUsers}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Users Table */}
				<Card className="border-solarized-base2">
					<CardHeader>
						<CardTitle className="text-solarized-base00">
							Benutzerliste
						</CardTitle>
						<CardDescription>
							Übersicht aller registrierten Benutzer auf der Plattform
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3 md:hidden">
							<Input
								placeholder="Benutzer suchen..."
								value={searchFilter}
								onChange={handleSearchFilterChange}
							/>
							{filteredUsers.length === 0 ? (
								<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 p-4 text-sm text-solarized-base01">
									Keine Benutzer gefunden.
								</div>
							) : (
								filteredUsers.map((user) => (
									<div
										key={user.id}
										className="rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-4"
									>
										<div className="flex items-start gap-3">
											{user.image ? (
												<Image
													src={user.image}
													alt={user.name || user.email}
													width={40}
													height={40}
													className="h-10 w-10 rounded-full"
													unoptimized
												/>
											) : (
												<div className="flex h-10 w-10 items-center justify-center rounded-full bg-solarized-base2">
													<User className="h-5 w-5 text-solarized-base01" />
												</div>
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-solarized-base00">
													{user.name || "Kein Name"}
												</p>
												<p className="truncate text-xs text-solarized-base01">
													{user.email}
												</p>
											</div>
										</div>

										<div className="mt-3 flex flex-wrap gap-2">
											<Badge
												variant="outline"
												className={
													user.emailVerified
														? "border-solarized-green text-solarized-green"
														: "border-solarized-orange text-solarized-orange"
												}
											>
												{user.emailVerified ? (
													<CheckCircle className="mr-1 h-3 w-3" />
												) : (
													<Mail className="mr-1 h-3 w-3" />
												)}
												{user.emailVerified ? "Verifiziert" : "Nicht verifiziert"}
											</Badge>
											<Badge
												variant="outline"
												className={
													user.hasActiveSubscription
														? "border-solarized-violet text-solarized-violet"
														: "border-solarized-base1 text-solarized-base01"
												}
											>
												<Star className="mr-1 h-3 w-3" />
												{getSubscriptionLabel(user)}
											</Badge>
										</div>

										<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
											<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
												<p className="text-solarized-base01">Vorlagen</p>
												<p className="font-medium text-solarized-base00">
													{user._count.templates}
												</p>
											</div>
											<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
												<p className="text-solarized-base01">Favoriten</p>
												<p className="font-medium text-solarized-base00">
													{user._count.favourites}
												</p>
											</div>
											<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
												<p className="text-solarized-base01">KI-Nutzung (Monat)</p>
												<p className="font-medium text-solarized-base00">
													{user._count.usageEvents}
												</p>
											</div>
										</div>

										<p className="mt-3 text-xs text-solarized-base01">
											Registriert {formatDate(user.createdAt)}
										</p>
									</div>
								))
							)}
						</div>

						<div className="hidden md:block">
							<DataTable
								columns={columns}
								data={filteredUsers as UserData[]}
								emptyMessage="Keine Benutzer gefunden"
								renderToolbar={renderToolbar}
								renderPagination={renderPagination}
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
