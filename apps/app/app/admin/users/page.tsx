"use client";

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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Users, XCircle } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { columns } from './columns';
import type { UserData } from './columns';

const UsersTableToolbar = ({ table }: DataTableRenderToolbarProps<UserData>) => {
	const handleUserFilterChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			table.getColumn("user")?.setFilterValue(event.target.value);
		},
		[table],
	);

	return (
		<div className="flex items-center justify-between gap-2">
			<Input
				placeholder="Benutzer suchen..."
				value={(table.getColumn("user")?.getFilterValue() as string) ?? ""}
				onChange={handleUserFilterChange}
				className="max-w-sm"
			/>
			<DataTableViewOptions table={table} />
		</div>
	);
};

export default function UsersPage() {
	const queryClient = useQueryClient();

	const {
		data: users = [],
		isLoading,
		isFetching,
		error,
	} = useQuery(orpc.admin.users.list.queryOptions());

	const handleRefresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.admin.users.list.queryOptions().queryKey,
		});
		toast.success("Benutzerliste aktualisiert");
	}, [queryClient]);

	const renderToolbar = useCallback(
		(table: DataTableRenderToolbarProps<UserData>["table"]) => (
			<UsersTableToolbar table={table} />
		),
		[],
	);

	const renderPagination = useCallback(
		(table: DataTableRenderToolbarProps<UserData>["table"]) => (
			<DataTablePagination table={table} />
		),
		[],
	);

	const errorMessage =
		error instanceof Error
			? error.message
			: (error
				? String(error)
				: "Fehler beim Laden der Benutzer");
	const totalGenerations = users.reduce(
		(sum, user) => sum + Number(user._count.usageEvents ?? 0),
		0,
	);
	const plusUsers = users.filter((user) => user.hasActiveSubscription).length;
	const freeUsers = users.length - plusUsers;

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
					<div className="flex items-center justify-between">
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
						<Button
							variant="outline"
							onClick={handleRefresh}
							disabled={isFetching}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
							/>
							<span className="hidden sm:inline">Aktualisieren</span>
						</Button>
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
									Generierungen
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
					<CardContent>
							<DataTable
								columns={columns}
								data={users as UserData[]}
								emptyMessage="Keine Benutzer gefunden"
								renderToolbar={renderToolbar}
								renderPagination={renderPagination}
							/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
