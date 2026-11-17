"use client";

import { useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

import { orpc } from "@/lib/orpc";
import { TEXT_INPUT_IDS } from "@/orpc/scribe/prompts/template";

import { PlaygroundPanel } from "./_components/playground-panel";
import type { PlaygroundPreset } from "./_components/playground-panel";
import type { PlaygroundParameters, ReasoningEffort } from "./_lib/types";

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim() ? value : undefined;

const asNumber = (value: unknown): number | undefined => {
	const number = typeof value === "number" ? value : Number(value ?? Number.NaN);
	return Number.isFinite(number) ? number : undefined;
};

export default function PlaygroundPageClient() {
	// Usage events link here to replay a generation with its template, input and model.
	const [referenceUsageEvent] = useQueryState("referenceUsageEvent", parseAsString);
	const models = useQuery(orpc.admin.models.list.queryOptions());
	const { data: topModelIds = [] } = useQuery(
		orpc.admin.models.topModels.queryOptions({ input: { limit: 5 } }),
	);
	const { data: event } = useQuery({
		...orpc.admin.usage.get.queryOptions({ input: { id: referenceUsageEvent ?? "" } }),
		enabled: Boolean(referenceUsageEvent),
	});

	const preset = useMemo<PlaygroundPreset>(() => {
		if (!event) {
			return {};
		}
		const metadata = (event.metadata ?? {}) as Record<string, unknown>;
		const input = (event.inputData ?? {}) as Record<string, unknown>;
		return {
			model: event.model ?? undefined,
			parameters: {
				...(metadata.modelConfig as Partial<PlaygroundParameters> | undefined),
				reasoningEffort: asString(metadata.reasoningEffort) as ReasoningEffort | undefined,
			},
			referenceResult: event.result
				? {
						isStreaming: false,
						metrics: {
							cost: asNumber(event.cost),
							inputTokens: asNumber(event.inputTokens),
							latencyMs: asNumber(event.timeToCompletionMs) ?? 0,
							outputTokens: asNumber(event.outputTokens),
							reasoningTokens: asNumber(event.reasoningTokens),
							totalTokens: asNumber(event.totalTokens),
						},
						modelLabel: event.model ?? undefined,
						reasoning: event.reasoning ?? undefined,
						text: event.result,
					}
				: null,
			templateId: asString(metadata.templateId),
			textContext: Object.fromEntries(
				TEXT_INPUT_IDS.flatMap((id) => (asString(input[id]) ? [[id, input[id]]] : [])),
			),
		};
	}, [event]);

	if (models.isLoading || (referenceUsageEvent && !event)) {
		return <p className="p-6 text-muted-foreground text-sm">Lade Playground …</p>;
	}

	if (models.error) {
		return (
			<div className="flex min-h-[400px] items-center justify-center p-6 text-center">
				<div className="space-y-2">
					<XCircle className="mx-auto h-8 w-8 text-solarized-red" />
					<p className="text-sm">Fehler beim Laden der Modelle: {models.error.message}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto">
			<PlaygroundPanel models={models.data ?? []} preset={preset} topModelIds={topModelIds} />
		</div>
	);
}
