"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import {
	DataTable,
	DataTablePagination,
	DataTableViewOptions,
} from "@repo/design-system/components/ui/data-table";
import { Loader2, Users, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { columns, type UserData } from "./columns";

export default function UsersPage() {
	const queryClient = useQueryClient();

	const {
		data: users = [],
		isLoading,
		error,
	} = useQuery(orpc.admin.users.list.queryOptions());

	const handleRefresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.admin.users.list.queryOptions().queryKey,
		});
		toast.success("Benutzerliste aktualisiert");
	};

	const errorMessage =
		error instanceof Error
			? error.message
			: error
				? String(error)
				: "Fehler beim Laden der Benutzer";

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
						<button
							onClick={handleRefresh}
							disabled={isLoading}
							className="flex items-center gap-2 rounded-lg border border-solarized-base2 bg-solarized-base3 px-3 py-2 text-sm font-medium text-solarized-base00 transition-colors hover:bg-solarized-base2 disabled:opacity-50 sm:px-4"
						>
							<Loader2
								className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
							/>
							<span className="hidden sm:inline">Aktualisieren</span>
						</button>
					</div>
				</div>

				{/* Stats Card */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
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
									{users.reduce((sum, u) => sum + u._count.usageEvents, 0)}
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
							renderToolbar={(table) => (
								<div className="flex items-center justify-between gap-2">
									<Input
										placeholder="Benutzer suchen..."
										value={
											(table.getColumn("user")?.getFilterValue() as string) ??
											""
										}
										onChange={(event) =>
											table
												.getColumn("user")
												?.setFilterValue(event.target.value)
										}
										className="max-w-sm"
									/>
									<DataTableViewOptions table={table} />
								</div>
							)}
							renderPagination={(table) => (
								<DataTablePagination table={table} />
							)}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
