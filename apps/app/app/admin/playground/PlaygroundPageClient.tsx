"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, XCircle } from "lucide-react";
import {
	parseAsBoolean,
	parseAsFloat,
	parseAsInteger,
	parseAsString,
	useQueryStates,
} from "nuqs";
import { useMemo } from "react";
import { orpc } from "@/lib/orpc";
import type { DocumentType } from "@/orpc/scribe/types";
import { PlaygroundPanel } from "./_components/PlaygroundPanel";
import { allScribeDocTypes, scribeDocTypeUi } from "./_lib/scribe-doc-types";
import type { PlaygroundParameters } from "./_lib/types";

const playgroundSearchParams = {
	referenceUsageEvent: parseAsString,
	model: parseAsString,
	documentType: parseAsString,
	temperature: parseAsFloat,
	maxTokens: parseAsInteger,
	thinking: parseAsBoolean,
	thinkingBudget: parseAsInteger,
};

const promptNameToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

function inferDocumentType(
	metadata: Record<string, unknown> | null,
): DocumentType | undefined {
	if (!metadata) return undefined;

	const endpoint = metadata.endpoint;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		return endpoint as DocumentType;
	}

	const promptName = metadata.promptName;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptNameToDocumentType.get(promptName);
	}

	return undefined;
}

function PlaygroundContent() {
	const [searchParams] = useQueryStates(playgroundSearchParams);

	// Fetch models using oRPC
	const {
		data: models = [],
		isLoading: modelsLoading,
		error: modelsError,
	} = useQuery(orpc.admin.models.list.queryOptions());

	// Fetch top models based on usage in the past 30 days
	const { data: topModelIds = [] } = useQuery(
		orpc.admin.models.topModels.queryOptions({ input: { limit: 5 } }),
	);

	// Parse preset from URL params (from usage tracking jump-off)
	const preset = useMemo(() => {
		return {
			referenceUsageEvent: searchParams.referenceUsageEvent,
			model: searchParams.model,
			documentType: (searchParams.documentType || undefined) as
				| DocumentType
				| undefined,
			parameters: {
				temperature: searchParams.temperature ?? undefined,
				maxTokens: searchParams.maxTokens ?? undefined,
				thinking: searchParams.thinking ?? false,
				thinkingBudget: searchParams.thinkingBudget ?? undefined,
			} as Partial<PlaygroundParameters>,
		};
	}, [searchParams]);

	const { data: usageEvent } = useQuery({
		...orpc.admin.usage.get.queryOptions({
			input: { id: preset.referenceUsageEvent ?? "" },
		}),
		enabled: Boolean(preset.referenceUsageEvent),
	});

	const presetFromUsage = useMemo(() => {
		if (!usageEvent) return null;
		const metadata = usageEvent.metadata as Record<string, unknown> | null;
		const inferredDocumentType = inferDocumentType(metadata);

		const inputData = usageEvent.inputData as Record<string, unknown> | null;

		return {
			documentType: inferredDocumentType,
			variables: inputData ?? undefined,
			model: usageEvent.model ?? undefined,
			parameters:
				(metadata?.modelConfig as Partial<PlaygroundParameters>) ?? undefined,
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
		<div className="flex h-full flex-col overflow-hidden p-3">
			<div className="mx-auto flex h-full w-full flex-col gap-2 overflow-hidden">
				{/* Header - compact */}
				<div className="flex shrink-0 items-center gap-2">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-solarized-violet/10">
						<FlaskConical className="h-4 w-4 text-solarized-violet" />
					</div>
					<div>
						<h1 className="font-semibold text-base text-solarized-base00">
							AI Playground
						</h1>
					</div>
				</div>

				{/* Main Content - takes all remaining space */}
				<div className="min-h-0 flex-1 overflow-hidden">
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
}

export default function PlaygroundPage() {
	return <PlaygroundContent />;
}
