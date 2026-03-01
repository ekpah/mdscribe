"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, RefreshCw, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import { AddProviderDialog } from "./_components/AddConnectionDialog";
import { ConnectionCard } from "./_components/ConnectionCard";
import { ModelsTab } from "./_components/ModelsTab";

export default function ModelsSettingsPage() {
	const queryClient = useQueryClient();
	const {
		data: connections,
		isLoading,
		isFetching,
		error,
	} = useQuery(orpc.admin.providers.connections.list.queryOptions());

	const totalProviders = connections?.length ?? 0;
	const totalModels =
		connections?.reduce((sum, provider) => sum + provider.models.length, 0) ??
		0;

	const handleRefresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.admin.providers.connections.list.queryOptions().queryKey,
		});
		toast.success("Provider aktualisiert");
	};

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-yellow/10 sm:h-12 sm:w-12">
								<Settings className="h-5 w-5 text-solarized-yellow sm:h-6 sm:w-6" />
							</div>
							<div>
								<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
									KI-Provider & Modelle
								</h1>
								<p className="text-sm text-solarized-base01 sm:text-base">
									Provider konfigurieren und globale Standardmodelle verwalten
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
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
				</div>

				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Provider
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{totalProviders}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Modelle
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{totalModels}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
					</div>
				) : error ? (
					<Card className="border-solarized-red/20 bg-solarized-red/10">
						<CardContent className="p-4 text-center text-sm text-solarized-red">
							Fehler beim Laden:{" "}
							{error instanceof Error ? error.message : "Unbekannter Fehler"}
						</CardContent>
					</Card>
				) : !connections || connections.length === 0 ? (
					<Card className="border-solarized-base2 border-dashed bg-solarized-base3">
						<CardContent className="p-8 text-center">
							<Settings className="mx-auto mb-3 h-8 w-8 text-solarized-base01" />
							<p className="font-medium text-solarized-base00">
								Keine Provider konfiguriert
							</p>
							<p className="mt-1 text-sm text-solarized-base01">
								Erstellen Sie einen Provider, um KI-Modelle zu nutzen.
							</p>
							<div className="mt-4">
								<AddProviderDialog />
							</div>
						</CardContent>
					</Card>
				) : (
					<Tabs
						defaultValue="connections"
						className="gap-4 md:flex-row md:items-start"
					>
						<TabsList className="grid w-full grid-cols-2 md:sticky md:top-6 md:flex md:w-56 md:flex-col md:gap-1">
							<TabsTrigger
								value="connections"
								className="w-full justify-start gap-2 text-left"
							>
								<Database className="h-4 w-4" />
								Verbindungen
							</TabsTrigger>
							<TabsTrigger
								value="models"
								className="w-full justify-start gap-2 text-left"
							>
								<Sparkles className="h-4 w-4" />
								Modelle
							</TabsTrigger>
						</TabsList>

						<div className="min-w-0 flex-1">
							<TabsContent value="connections" className="mt-0 space-y-4">
								<div className="flex justify-end">
									<AddProviderDialog />
								</div>
								<div className="space-y-4">
									{connections.map((connection) => (
										<ConnectionCard
											key={connection.id}
											connection={connection}
										/>
									))}
								</div>
							</TabsContent>

							<TabsContent value="models" className="mt-0">
								<ModelsTab connections={connections} />
							</TabsContent>
						</div>
					</Tabs>
				)}
			</div>
		</div>
	);
}
