"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Loader2, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { orpc } from "@/lib/orpc";
import { PlaygroundPanel } from "./_components/PlaygroundPanel";
import type { PlaygroundModel, PlaygroundParameters } from "./_lib/types";
import type { DocumentType } from "@/orpc/scribe/types";

function PlaygroundContent() {
	const searchParams = useSearchParams();

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
		const eventId = searchParams.get("eventId");
		const model = searchParams.get("model");
		const documentTypeParam = searchParams.get("documentType");
		const temperature = searchParams.get("temperature");
		const maxTokens = searchParams.get("maxTokens");
		const thinking = searchParams.get("thinking");
		const thinkingBudget = searchParams.get("thinkingBudget");

		return {
			eventId,
			model,
			documentType: (documentTypeParam || undefined) as DocumentType | undefined,
			parameters: {
				temperature: temperature ? Number.parseFloat(temperature) : undefined,
				maxTokens: maxTokens ? Number.parseInt(maxTokens) : undefined,
				thinking: thinking === "true",
				thinkingBudget: thinkingBudget
					? Number.parseInt(thinkingBudget)
					: undefined,
			} as Partial<PlaygroundParameters>,
		};
	}, [searchParams]);

	const { data: usageEvent } = useQuery({
		...orpc.admin.usage.get.queryOptions({ input: { id: preset.eventId ?? "" } }),
		enabled: Boolean(preset.eventId),
	});

	const presetFromUsage = useMemo(() => {
		if (!usageEvent) return null;
		const metadata = usageEvent.metadata as Record<string, unknown> | null;
		const endpoint = metadata?.endpoint;
		const inferredDocumentType =
			typeof endpoint === "string" ? (endpoint as DocumentType) : undefined;

		const inputData = usageEvent.inputData as Record<string, unknown> | null;

		return {
			documentType: inferredDocumentType,
			variables: inputData ?? undefined,
			model: usageEvent.model ?? undefined,
			parameters: (metadata?.modelConfig as Partial<PlaygroundParameters>) ?? undefined,
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
		<div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
			<div className="mx-auto flex h-full w-full max-w-[1800px] flex-col gap-4 overflow-hidden">
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-violet/10 sm:h-12 sm:w-12">
						<FlaskConical className="h-5 w-5 text-solarized-violet sm:h-6 sm:w-6" />
					</div>
					<div>
						<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">
							AI Playground
						</h1>
						<p className="text-sm text-solarized-base01">
							Experimentiere mit verschiedenen Modellen und Einstellungen
						</p>
					</div>
				</div>

				{/* Main Content */}
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
	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center p-6">
					<div className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>Lade Playground...</span>
					</div>
				</div>
			}
		>
			<PlaygroundContent />
		</Suspense>
	);
}
