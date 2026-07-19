"use client";

import { useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { parseAsBoolean, parseAsFloat, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";

import { orpc } from "@/lib/orpc";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import type { DocumentType } from "@/orpc/scribe/types";

import { PlaygroundPanel } from "./_components/playground-panel";
import { isScribeDocType } from "./_lib/scribe-doc-types";
import type { PlaygroundParameters, PlaygroundResult } from "./_lib/types";

const playgroundSearchParams = {
	documentType: parseAsString,
	maxTokens: parseAsInteger,
	model: parseAsString,
	reasoningEffort: parseAsString,
	referenceUsageEvent: parseAsString,
	temperature: parseAsFloat,
	thinking: parseAsBoolean,
};

const inferDocumentType = (metadata: Record<string, unknown> | null): DocumentType | undefined => {
	if (!metadata) {
		return undefined;
	}

	const { endpoint } = metadata;
	if (typeof endpoint === "string" && endpoint.trim().length > 0 && isScribeDocType(endpoint)) {
		return endpoint;
	}

	const { promptName } = metadata;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return resolvePromptHarnessId(promptName);
	}

	return undefined;
};

const getStringMetadataValue = (
	metadata: Record<string, unknown> | null,
	key: string,
): string | undefined => {
	const value = metadata?.[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const toNumber = (value: unknown): number | undefined => {
	if (value === null || value === undefined) {
		return undefined;
	}
	const numberValue = typeof value === "number" ? value : Number(value);
	return Number.isFinite(numberValue) ? numberValue : undefined;
};

const PlaygroundContent = () => {
	const [searchParams] = useQueryStates(playgroundSearchParams);
	const modelsQueryOptions = orpc.admin.models.list.queryOptions();
	const topModelsQueryOptions = orpc.admin.models.topModels.queryOptions({
		input: { limit: 5 },
	});

	// Fetch models using oRPC
	const {
		data: models = [],
		isLoading: modelsLoading,
		error: modelsError,
	} = useQuery(modelsQueryOptions);

	// Fetch top models based on usage in the past 30 days
	const { data: topModelIds = [] } = useQuery(topModelsQueryOptions);

	// Parse preset from URL params (from usage tracking jump-off)
	const preset = useMemo(
		() => ({
			documentType: (searchParams.documentType || undefined) as DocumentType | undefined,
			model: searchParams.model,
			parameters: {
				maxTokens: searchParams.maxTokens ?? undefined,
				reasoningEffort:
					(searchParams.reasoningEffort as PlaygroundParameters["reasoningEffort"] | null) ??
					undefined,
				temperature: searchParams.temperature ?? undefined,
				thinking: searchParams.thinking ?? false,
			} as Partial<PlaygroundParameters>,
			referenceUsageEvent: searchParams.referenceUsageEvent,
		}),
		[searchParams],
	);

	const { data: usageEvent } = useQuery({
		...orpc.admin.usage.get.queryOptions({
			input: { id: preset.referenceUsageEvent ?? "" },
		}),
		enabled: Boolean(preset.referenceUsageEvent),
	});

	const presetFromUsage = useMemo(() => {
		if (!usageEvent) {
			return null;
		}
		const metadata = usageEvent.metadata as Record<string, unknown> | null;
		const inferredDocumentType = inferDocumentType(metadata);

		const inputData = usageEvent.inputData as Record<string, unknown> | null;

		return {
			documentType: inferredDocumentType,
			model: usageEvent.model ?? undefined,
			parameters: {
				...(metadata?.modelConfig as Partial<PlaygroundParameters> | undefined),
				reasoningEffort:
					typeof metadata?.reasoningEffort === "string"
						? (metadata.reasoningEffort as PlaygroundParameters["reasoningEffort"])
						: undefined,
			},
			promptName: getStringMetadataValue(metadata, "promptName"),
			templateId: getStringMetadataValue(metadata, "templateId"),
			variables: inputData ?? undefined,
		};
	}, [usageEvent]);

	const referenceResult = useMemo<PlaygroundResult | null>(() => {
		if (!usageEvent?.result) {
			return null;
		}
		return {
			isStreaming: false,
			metrics: {
				cost: toNumber(usageEvent.cost),
				inputTokens: toNumber(usageEvent.inputTokens),
				latencyMs: toNumber(usageEvent.timeToCompletionMs) ?? 0,
				outputTokens: toNumber(usageEvent.outputTokens),
				reasoningTokens: toNumber(usageEvent.reasoningTokens),
				totalTokens: toNumber(usageEvent.totalTokens),
			},
			modelLabel: usageEvent.model ?? undefined,
			reasoning: usageEvent.reasoning ?? undefined,
			sourceLabel: "Usage Event",
			text: usageEvent.result,
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
						{modelsError instanceof Error ? modelsError.message : "Unbekannter Fehler"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto p-2 sm:p-3 lg:overflow-hidden">
			<div className="mx-auto flex h-full w-full min-w-0 flex-col gap-2 lg:overflow-hidden">
				{/* Main Content - takes all remaining space */}
				<div className="min-h-0 min-w-0 flex-1 lg:overflow-hidden">
					<PlaygroundPanel
						models={models}
						topModelIds={topModelIds}
						isLoadingModels={modelsLoading}
						presetModel={presetFromUsage?.model ?? preset.model ?? undefined}
						presetParameters={presetFromUsage?.parameters ?? preset.parameters ?? undefined}
						presetDocumentType={presetFromUsage?.documentType ?? preset.documentType}
						presetPromptName={presetFromUsage?.promptName}
						presetTemplateId={presetFromUsage?.templateId}
						presetVariables={presetFromUsage?.variables}
						referenceResult={referenceResult}
					/>
				</div>
			</div>
		</div>
	);
};

export default function PlaygroundPage() {
	return <PlaygroundContent />;
}
