"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, RefreshCw, XCircle } from "lucide-react";
import {
	parseAsBoolean,
	parseAsFloat,
	parseAsInteger,
	parseAsString,
	useQueryStates,
} from "nuqs";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import type { DocumentType } from "@/orpc/scribe/types";
import { PlaygroundPanel } from "./_components/playground-panel";
import {
	allScribeDocTypes,
	isScribeDocType,
	scribeDocTypeUi,
} from "./_lib/scribe-doc-types";
import type { PlaygroundParameters } from "./_lib/types";

const playgroundSearchParams = {
	documentType: parseAsString,
	maxTokens: parseAsInteger,
	model: parseAsString,
	referenceUsageEvent: parseAsString,
	temperature: parseAsFloat,
	thinking: parseAsBoolean,
	thinkingBudget: parseAsInteger,
};

const promptNameToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

const inferDocumentType = (
	metadata: Record<string, unknown> | null,
): DocumentType | undefined => {
	if (!metadata) {return undefined;}

	const {endpoint} = metadata;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		return isScribeDocType(endpoint) ? endpoint : undefined;
	}

	const {promptName} = metadata;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptNameToDocumentType.get(promptName);
	}

	return undefined;
};

const PlaygroundContent = () => {
	const queryClient = useQueryClient();
	const [searchParams] = useQueryStates(playgroundSearchParams);
	const modelsQueryOptions = orpc.admin.models.list.queryOptions();
	const topModelsQueryOptions = orpc.admin.models.topModels.queryOptions({
		input: { limit: 5 },
	});

	// Fetch models using oRPC
	const {
		data: models = [],
		isLoading: modelsLoading,
		isFetching: isFetchingModels,
		error: modelsError,
	} = useQuery(modelsQueryOptions);

	// Fetch top models based on usage in the past 30 days
	const { data: topModelIds = [], isFetching: isFetchingTopModels } = useQuery(
		topModelsQueryOptions,
	);

	const handleRefresh = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: modelsQueryOptions.queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: topModelsQueryOptions.queryKey,
			}),
		]);
		toast.success("Modelle aktualisiert");
	}, [queryClient, modelsQueryOptions.queryKey, topModelsQueryOptions.queryKey]);

	// Parse preset from URL params (from usage tracking jump-off)
	const preset = useMemo(() => ({
			documentType: (searchParams.documentType || undefined) as
				| DocumentType
				| undefined,
			model: searchParams.model,
			parameters: {
				maxTokens: searchParams.maxTokens ?? undefined,
				temperature: searchParams.temperature ?? undefined,
				thinking: searchParams.thinking ?? false,
				thinkingBudget: searchParams.thinkingBudget ?? undefined,
			} as Partial<PlaygroundParameters>,
			referenceUsageEvent: searchParams.referenceUsageEvent,
		}), [searchParams]);

	const { data: usageEvent } = useQuery({
		...orpc.admin.usage.get.queryOptions({
			input: { id: preset.referenceUsageEvent ?? "" },
		}),
		enabled: Boolean(preset.referenceUsageEvent),
	});

	const presetFromUsage = useMemo(() => {
		if (!usageEvent) {return null;}
		const metadata = usageEvent.metadata as Record<string, unknown> | null;
		const inferredDocumentType = inferDocumentType(metadata);

		const inputData = usageEvent.inputData as Record<string, unknown> | null;

		return {
			documentType: inferredDocumentType,
			model: usageEvent.model ?? undefined,
			parameters:
				(metadata?.modelConfig as Partial<PlaygroundParameters>) ?? undefined,
			variables: inputData ?? undefined,
		};
	}, [usageEvent]);

	if (modelsError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center p-6">
				<div className="space-y-2 text-center">
					<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
					<h2 className="font-semibold text-base text-solarized-base00">
						Fehler beim Laden der Modelle
					</h2>
					<p className="text-sm text-solarized-base01">
						{modelsError instanceof Error
							? modelsError.message
							: "Unbekannter Fehler"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto p-2 sm:p-3 lg:overflow-hidden">
			<div className="mx-auto flex h-full w-full min-w-0 flex-col gap-2 lg:overflow-hidden">
				{/* Header - compact */}
				<div className="flex shrink-0 items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-solarized-violet/10">
							<FlaskConical className="h-4 w-4 text-solarized-violet" />
						</div>
						<div>
							<h1 className="font-semibold text-base text-solarized-base00">
								AI Playground
							</h1>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isFetchingModels || isFetchingTopModels}
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${
								isFetchingModels || isFetchingTopModels ? "animate-spin" : ""
							}`}
						/>
						<span className="hidden sm:inline">Aktualisieren</span>
					</Button>
				</div>

				{/* Main Content - takes all remaining space */}
				<div className="min-h-0 min-w-0 flex-1 lg:overflow-hidden">
					<PlaygroundPanel
						models={models}
						topModelIds={topModelIds}
						isLoadingModels={modelsLoading}
						presetModel={presetFromUsage?.model ?? preset.model ?? undefined}
						presetParameters={
							presetFromUsage?.parameters ?? preset.parameters ?? undefined
						}
						presetDocumentType={
							presetFromUsage?.documentType ?? preset.documentType
						}
						presetVariables={presetFromUsage?.variables}
					/>
				</div>
			</div>
		</div>
	);
};

export default function PlaygroundPage() {
	return <PlaygroundContent />;
}
