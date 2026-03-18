"use client";

import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
	Database,
	FileText,
	Loader2,
	Settings,
	Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";

import { orpc } from "@/lib/orpc";
import { AddProviderDialog } from "./_components/add-connection-dialog";
import { ConnectionCard } from "./_components/connection-card";

const ModelsTab = dynamic(
	async () => {
		const mod = await import("./_components/models-tab");
		return mod.ModelsTab;
	},
	{
		loading: () => (
			<div className="flex items-center justify-center py-10 text-solarized-base01">
				<Loader2 className="h-5 w-5 animate-spin" />
			</div>
		),
	},
);

const ScribeFormsTab = dynamic(
	async () => {
		const mod = await import("./_components/ScribeFormsTab");
		return mod.ScribeFormsTab;
	},
	{
		loading: () => (
			<div className="flex items-center justify-center py-10 text-solarized-base01">
				<Loader2 className="h-5 w-5 animate-spin" />
			</div>
		),
	},
);

export default function ModelsSettingsPageClient() {
	const {
		data: connections,
		isLoading,
		error,
	} = useQuery(orpc.admin.providers.connections.list.queryOptions());
	const safeConnections = connections ?? [];

	const totalProviders = safeConnections.length;
	const totalModels =
		safeConnections.reduce((sum, provider) => sum + provider.models.length, 0);
	const loadingOrContent = (() => {
		if (isLoading) {
			return (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
				</div>
			);
		}

		if (error) {
			return (
				<Card className="border-solarized-red/20 bg-solarized-red/10">
					<CardContent className="p-4 text-center text-sm text-solarized-red">
						Fehler beim Laden:{" "}
						{error instanceof Error ? error.message : "Unbekannter Fehler"}
					</CardContent>
				</Card>
			);
		}

		return (
			<Tabs
				defaultValue="connections"
				className="gap-4 md:flex-row md:items-start"
			>
				<TabsList className="flex w-full gap-1 overflow-x-auto p-1 md:sticky md:top-6 md:w-56 md:flex-col md:overflow-visible">
					<TabsTrigger
						value="connections"
						className="min-w-[138px] shrink-0 justify-center gap-2 text-center md:w-full md:justify-start md:text-left"
					>
						<Database className="h-4 w-4" />
						Verbindungen
					</TabsTrigger>
					<TabsTrigger
						value="models"
						className="min-w-[138px] shrink-0 justify-center gap-2 text-center md:w-full md:justify-start md:text-left"
					>
						<Sparkles className="h-4 w-4" />
						Modelle
					</TabsTrigger>
					<TabsTrigger
						value="scribe-forms"
						className="min-w-[138px] shrink-0 justify-center gap-2 text-center md:w-full md:justify-start md:text-left"
					>
						<FileText className="h-4 w-4" />
						AI Textbausteine
					</TabsTrigger>
				</TabsList>

				<div className="min-w-0 flex-1">
					<TabsContent value="connections" className="mt-0 space-y-4">
						<div className="flex justify-end">
							<AddProviderDialog />
						</div>
						{safeConnections.length === 0 ? (
							<Card className="border-solarized-base2 border-dashed bg-solarized-base3">
								<CardContent className="p-8 text-center">
									<Settings className="mx-auto mb-3 h-8 w-8 text-solarized-base01" />
									<p className="font-medium text-solarized-base00">
										Keine Provider konfiguriert
									</p>
									<p className="mt-1 text-sm text-solarized-base01">
										Erstellen Sie einen Provider, um KI-Modelle zu nutzen.
									</p>
								</CardContent>
							</Card>
						) : (
							<div className="space-y-4">
								{safeConnections.map((connection) => (
									<ConnectionCard
										key={connection.id}
										connection={connection}
									/>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="models" className="mt-0">
						<ModelsTab connections={safeConnections} />
					</TabsContent>

					<TabsContent value="scribe-forms" className="mt-0">
						<ScribeFormsTab />
					</TabsContent>
				</div>
			</Tabs>
		);
	})();

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="space-y-2">
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

				{loadingOrContent}
			</div>
		</div>
	);
}
