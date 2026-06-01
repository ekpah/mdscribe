"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

interface AiModelData {
	id: string;
	providerId: string;
	modelId: string;
	displayName: string;
	supportedParameters?: string[];
	supportsReasoning: boolean;
}

interface ProviderData {
	id: string;
	name: string;
	protocol: string;
	baseUrl: string | null;
	hasApiKey: boolean;
	models: AiModelData[];
}

const PROTOCOL_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	"openai-compatible": "OpenAI-kompatibel",
	openrouter: "OpenRouter",
};

interface ConnectionCardProps {
	connection: ProviderData;
}

export const ConnectionCard = ({ connection }: ConnectionCardProps) => {
	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;
	const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

	const deleteMutation = useMutation({
		mutationFn: () =>
			orpc.admin.providers.connections.delete.call({ id: connection.id }),
		onError: (error) => {
			setIsDeleteConfirming(false);
			toast.error(error instanceof Error ? error.message : "Fehler");
		},
		onSuccess: async () => {
			setIsDeleteConfirming(false);
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("Provider gelöscht");
		},
	});

	const refreshModelsMutation = useMutation({
		mutationFn: () =>
			orpc.admin.providers.connections.refreshModels.call({
				id: connection.id,
			}),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Fehler"),
		onSuccess: async (data) => {
			const preview = data.models
				.slice(0, 3)
				.map((model) => model.displayName)
				.join(", ");
			toast.success("Modelle synchronisiert", {
				description: `${data.models.length} Modelle. ${preview ? `z.B. ${preview}` : ""}`,
			});
			await queryClient.invalidateQueries({ queryKey: listKey });
		},
	});

	const handleDeleteClick = useCallback(() => {
		if (!isDeleteConfirming) {
			setIsDeleteConfirming(true);
			return;
		}
		deleteMutation.mutate();
	}, [deleteMutation, isDeleteConfirming]);

	const handleCancelDelete = useCallback(() => {
		setIsDeleteConfirming(false);
	}, []);

	const handleRefreshModels = useCallback(() => {
		refreshModelsMutation.mutate();
	}, [refreshModelsMutation]);

	return (
		<Card className="border-solarized-base2">
			<CardHeader className="p-4 sm:p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<CardTitle className="text-sm sm:text-base">
							{connection.name}
						</CardTitle>
						<Badge variant="outline" className="text-[10px] sm:text-xs">
							{PROTOCOL_LABELS[connection.protocol] ?? connection.protocol}
						</Badge>
						{connection.hasApiKey && (
							<Badge variant="secondary" className="text-[10px] sm:text-xs">
								API Key
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2 self-end sm:self-auto">
						<Button
							size="sm"
							variant={isDeleteConfirming ? "destructive" : "ghost"}
							onClick={handleDeleteClick}
							disabled={deleteMutation.isPending}
						>
							{isDeleteConfirming ? (
								<span className="text-xs">Löschen bestätigen</span>
							) : (
								<Trash2 className="h-4 w-4 text-solarized-red" />
							)}
						</Button>
						{isDeleteConfirming && (
							<Button
								size="sm"
								variant="ghost"
								onClick={handleCancelDelete}
								disabled={deleteMutation.isPending}
							>
								Abbrechen
							</Button>
						)}
					</div>
				</div>
				{connection.baseUrl && (
					<p className="mt-1 break-all text-solarized-base01 text-xs">
						{connection.baseUrl}
					</p>
				)}
			</CardHeader>

			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-solarized-base01 text-sm">
						{connection.models.length} Modell
						{connection.models.length === 1 ? "" : "e"} bekannt
					</p>
					<Button
						size="sm"
						variant="outline"
						onClick={handleRefreshModels}
						disabled={refreshModelsMutation.isPending}
						className="w-full sm:w-auto"
					>
						{refreshModelsMutation.isPending ? (
							<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
						) : (
							<Download className="mr-1.5 h-4 w-4" />
						)}
						Modelle aktualisieren
					</Button>
				</div>

				{refreshModelsMutation.isSuccess && (
					<div className="mt-3 max-h-48 overflow-y-auto rounded border border-solarized-base2 bg-solarized-base3 p-3">
						<p className="mb-2 font-medium text-xs">
							Synchronisiert ({refreshModelsMutation.data.models.length}):
						</p>
						<div className="space-y-1">
							{refreshModelsMutation.data.models.slice(0, 3).map((model) => (
								<div
									key={model.modelId}
									className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between"
								>
									<span className="break-all font-mono text-solarized-base00">
										{model.modelId}
									</span>
									<span className="text-solarized-base01">
										{model.displayName}
									</span>
									{(model.supportedParameters ?? []).length > 0 ? (
										<span className="text-solarized-base01">
											{(model.supportedParameters ?? []).join(", ")}
										</span>
									) : null}
								</div>
							))}
							{refreshModelsMutation.data.models.length > 3 && (
								<p className="text-solarized-base01 text-xs">
									... und {refreshModelsMutation.data.models.length - 3} weitere
								</p>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
