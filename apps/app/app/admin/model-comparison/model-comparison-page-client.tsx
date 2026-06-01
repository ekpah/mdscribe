"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from "@repo/design-system/components/ui/model-selector";
import type { ModelSelectorOption } from "@repo/design-system/components/ui/model-selector";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Switch } from "@repo/design-system/components/ui/switch";
import { cn } from "@repo/design-system/lib/utils";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	BarChart3,
	CheckCircle2,
	EyeOff,
	Loader2,
	Play,
	RefreshCcw,
	Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { toast } from "sonner";

import { ParameterControls } from "@/app/admin/playground/_components/parameter-controls";
import { isScribeDocType, scribeDocTypeUi } from "@/app/admin/playground/_lib/scribe-doc-types";
import type { PlaygroundModel, PlaygroundParameters } from "@/app/admin/playground/_lib/types";
import { orpc } from "@/lib/orpc";
import type { DocumentType } from "@/orpc/scribe/types";

const DEFAULT_PARAMETERS: PlaygroundParameters = {
	frequencyPenalty: undefined,
	maxTokens: 8000,
	presencePenalty: undefined,
	reasoningEffort: "none",
	temperature: 0.3,
	thinking: false,
	thinkingExplicit: false,
	topK: undefined,
	topP: undefined,
};

const PROVIDER_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	cohere: "Cohere",
	deepseek: "DeepSeek",
	google: "Google",
	"meta-llama": "Meta Llama",
	mistralai: "Mistral AI",
	openai: "OpenAI",
	qwen: "Qwen",
	"x-ai": "xAI",
	"z-ai": "Zhipu AI",
};

const EMPTY_MODELS: PlaygroundModel[] = [];
const EMPTY_TOP_MODEL_IDS: string[] = [];
const USAGE_POOL_LIMIT = 100;
const SAMPLE_FETCH_LIMIT = 40;
const SAMPLE_DISPLAY_LIMIT = 10;

type ComparisonSide = "a" | "b";
type RunStatus = "idle" | "running" | "success" | "error";

interface ReplayableUsageEvent {
	id: string;
	inputData: unknown;
	metadata: unknown;
	model: string | null;
	name: string;
	timestamp: Date | string;
}

interface ComparisonSample {
	documentType: DocumentType;
	id: string;
	inputData: Record<string, unknown>;
	inputSections: InputSection[];
	originalModel: string | null;
	promptName: string;
	templateId: string | null;
	timestamp: Date | string;
}

interface InputSection {
	key: string;
	label: string;
	value: string;
}

interface ComparisonRunMetrics {
	cost?: number;
	inputTokens?: number;
	latencyMs: number;
	outputTokens?: number;
	reasoningTokens?: number;
	tokensPerSecond?: number;
	totalTokens?: number;
}

interface ComparisonRunResult {
	error?: string;
	finishReason?: string;
	metrics?: ComparisonRunMetrics;
	modelId?: string;
	requestId?: string;
	status: RunStatus;
	text?: string;
}

type ComparisonResults = Record<string, Partial<Record<ComparisonSide, ComparisonRunResult>>>;

interface PlaygroundModelSelectorOption extends ModelSelectorOption {
	isTop: boolean;
	model: PlaygroundModel;
	providerLabel: string;
}

interface ComparisonSummarySide {
	averageCost: number | null;
	averageInputTokens: number | null;
	averageInputTokensPerSecond: number | null;
	averageLatencyMs: number | null;
	averageOutputTokens: number | null;
	averageTotalTokens: number | null;
	averageTokensPerSecond: number | null;
	label: string;
	modelId: string;
	runCount: number;
	side: ComparisonSide;
	totalCost: number | null;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalReasoningTokens: number;
	totalTokens: number;
	wins: number;
}

interface ComparisonSummary {
	generatedAt: Date;
	sides: ComparisonSummarySide[];
	totalRows: number;
}

const promptNameToDocumentType = new Map(
	Object.entries(scribeDocTypeUi).map(([documentType, config]) => [
		config.defaultPromptName,
		documentType as DocumentType,
	]),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toMetadataRecord = (metadata: unknown): Record<string, unknown> =>
	isRecord(metadata) ? metadata : {};

const inferDocumentType = (
	eventName: string,
	metadata: Record<string, unknown>,
): DocumentType | null => {
	const { endpoint } = metadata;
	if (typeof endpoint === "string" && isScribeDocType(endpoint)) {
		return endpoint;
	}

	const { promptName } = metadata;
	if (typeof promptName === "string") {
		return promptNameToDocumentType.get(promptName) ?? null;
	}

	return isScribeDocType(eventName) ? eventName : null;
};

const hasNonEmptyInput = (value: unknown): boolean => {
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some(hasNonEmptyInput);
	}
	if (isRecord(value)) {
		return Object.values(value).some(hasNonEmptyInput);
	}
	return false;
};

const formatInputValue = (value: unknown): string => {
	if (typeof value === "string") {
		return value.trim();
	}

	return JSON.stringify(value, null, 2);
};

const formatInputLabel = (key: string): string => {
	const labels: Record<string, string> = {
		anamnese: "Anamnese",
		befunde: "Befunde",
		diagnoseblock: "Diagnoseblock",
		notes: "Notizen",
	};

	return labels[key] ?? key;
};

const buildInputSections = (inputData: Record<string, unknown>): InputSection[] => {
	const preferredKeys = ["notes", "diagnoseblock", "anamnese", "befunde"];
	const orderedKeys = [
		...preferredKeys,
		...Object.keys(inputData)
			.filter((key) => !preferredKeys.includes(key))
			.toSorted((a, b) => a.localeCompare(b)),
	];

	return orderedKeys.flatMap((key) => {
		const value = inputData[key];
		if (!hasNonEmptyInput(value)) {
			return [];
		}

		const formatted = formatInputValue(value);
		if (!formatted) {
			return [];
		}

		return {
			key,
			label: formatInputLabel(key),
			value: formatted,
		};
	});
};

const pickString = (inputData: Record<string, unknown>, ...keys: string[]): string => {
	for (const key of keys) {
		const value = inputData[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}
	return "";
};

const assignCanonicalString = (
	inputData: Record<string, unknown>,
	key: string,
	value: string,
): void => {
	if (value.trim().length > 0) {
		inputData[key] = value;
	}
};

const normalizeReplayVariables = (
	documentType: DocumentType,
	inputData: Record<string, unknown>,
): Record<string, unknown> => {
	const replayInput = { ...inputData };

	switch (documentType) {
		case "discharge":
		case "outpatient": {
			assignCanonicalString(
				replayInput,
				"notes",
				pickString(inputData, "notes", "dischargeNotes", "consultationNotes"),
			);
			assignCanonicalString(
				replayInput,
				"diagnoseblock",
				pickString(inputData, "diagnoseblock", "vordiagnosen"),
			);
			assignCanonicalString(replayInput, "anamnese", pickString(inputData, "anamnese"));
			assignCanonicalString(replayInput, "befunde", pickString(inputData, "befunde"));
			break;
		}
		case "procedures": {
			assignCanonicalString(replayInput, "notes", pickString(inputData, "notes", "procedureNotes"));
			break;
		}
		case "anamnese": {
			assignCanonicalString(replayInput, "notes", pickString(inputData, "notes"));
			assignCanonicalString(replayInput, "befunde", pickString(inputData, "befunde"));
			assignCanonicalString(
				replayInput,
				"diagnoseblock",
				pickString(inputData, "diagnoseblock", "vordiagnosen"),
			);
			break;
		}
		case "diagnosis":
		case "icu-transfer": {
			assignCanonicalString(replayInput, "notes", pickString(inputData, "notes"));
			assignCanonicalString(replayInput, "anamnese", pickString(inputData, "anamnese"));
			assignCanonicalString(replayInput, "befunde", pickString(inputData, "befunde"));
			assignCanonicalString(
				replayInput,
				"diagnoseblock",
				pickString(inputData, "diagnoseblock", "vordiagnosen"),
			);
			break;
		}
		case "befunde": {
			assignCanonicalString(replayInput, "notes", pickString(inputData, "notes"));
			assignCanonicalString(replayInput, "anamnese", pickString(inputData, "anamnese"));
			assignCanonicalString(
				replayInput,
				"diagnoseblock",
				pickString(inputData, "diagnoseblock", "vordiagnosen"),
			);
			break;
		}
		default: {
			break;
		}
	}

	return replayInput;
};

const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: string[];
	title: string;
}): string => {
	const sections = [
		"## Ausgewaehlte Vorlage (Referenz)",
		`Titel: ${templateData.title}`,
		templateData.content,
	];

	if (templateData.examples.length > 0) {
		sections.push("## Beispiele");
		for (const example of templateData.examples) {
			sections.push(example);
		}
	}

	return sections.join("\n\n");
};

const buildReplayVariables = (
	sample: ComparisonSample,
	templateReference: string | undefined,
): Record<string, unknown> => {
	const variables = normalizeReplayVariables(sample.documentType, sample.inputData);
	if (templateReference?.trim()) {
		variables.relevantTemplate = templateReference;
	}
	return variables;
};

const toComparisonSample = (
	event: ReplayableUsageEvent | null | undefined,
): ComparisonSample | null => {
	if (!event) {
		return null;
	}

	if (!isRecord(event.inputData) || !hasNonEmptyInput(event.inputData)) {
		return null;
	}

	const metadata = toMetadataRecord(event.metadata);
	const documentType = inferDocumentType(event.name, metadata);
	if (!documentType) {
		return null;
	}

	return {
		documentType,
		id: event.id,
		inputData: event.inputData,
		inputSections: buildInputSections(event.inputData),
		originalModel: event.model,
		promptName:
			typeof metadata.promptName === "string"
				? metadata.promptName
				: scribeDocTypeUi[documentType].defaultPromptName,
		templateId: typeof metadata.templateId === "string" ? metadata.templateId : null,
		timestamp: event.timestamp,
	};
};

const getProviderFromModelId = (modelId: string): string => modelId.split("/")[0] || "other";

const getProviderGroup = (model: PlaygroundModel): string =>
	model.providerProtocol ?? model.connectionProtocol ?? getProviderFromModelId(model.modelId);

const formatModelGroupLabel = (group: string): string =>
	PROVIDER_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);

const formatDate = (date: Date | string): string => {
	const parsed = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
	}).format(parsed);
};

const formatCost = (cost: number | null | undefined): string => {
	if (cost === null || cost === undefined) {
		return "-";
	}
	return `$${cost.toFixed(6)}`;
};

const formatDuration = (durationMs: number | null | undefined): string => {
	if (durationMs === null || durationMs === undefined) {
		return "-";
	}
	if (durationMs < 1000) {
		return `${durationMs.toLocaleString("de-DE")} ms`;
	}
	return `${(durationMs / 1000).toLocaleString("de-DE", {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	})} s`;
};

const formatTokens = (tokens: number | null | undefined): string =>
	tokens === null || tokens === undefined ? "-" : tokens.toLocaleString("de-DE");

const formatTokensPerSecond = (tokensPerSecond: number | null | undefined): string =>
	tokensPerSecond === null || tokensPerSecond === undefined
		? "-"
		: `${tokensPerSecond.toLocaleString("de-DE", {
				maximumFractionDigits: 1,
				minimumFractionDigits: 1,
			})} Tok/s`;

const getModelLabel = (model: PlaygroundModel | null): string => model?.name ?? "Kein Modell";

const shuffleArray = <T,>(items: T[]): T[] => {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
};

const buildDisplayOrder = (
	samples: ComparisonSample[],
	blindMode: boolean,
): Record<string, ComparisonSide[]> => {
	const nextOrder: Record<string, ComparisonSide[]> = {};
	for (const sample of samples) {
		nextOrder[sample.id] = blindMode && Math.random() > 0.5 ? ["b", "a"] : ["a", "b"];
	}
	return nextOrder;
};

const getCompletedResult = (
	results: ComparisonResults,
	sampleId: string,
	side: ComparisonSide,
): ComparisonRunResult | null => {
	const result = results[sampleId]?.[side];
	return result?.status === "success" ? result : null;
};

const asFiniteMetricNumber = (value: unknown): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
};

const parseRunMetricsFromMetadata = (metadata: unknown): Partial<ComparisonRunMetrics> => {
	if (!metadata || typeof metadata !== "object") {
		return {};
	}

	const value = metadata as Record<string, unknown>;
	const parsed: Partial<ComparisonRunMetrics> = {};
	const cost = asFiniteMetricNumber(value.cost);
	if (cost !== undefined) {
		parsed.cost = cost;
	}
	const inputTokens = asFiniteMetricNumber(value.inputTokens);
	if (inputTokens !== undefined) {
		parsed.inputTokens = inputTokens;
	}
	const outputTokens = asFiniteMetricNumber(value.outputTokens);
	if (outputTokens !== undefined) {
		parsed.outputTokens = outputTokens;
	}
	const reasoningTokens = asFiniteMetricNumber(value.reasoningTokens);
	if (reasoningTokens !== undefined) {
		parsed.reasoningTokens = reasoningTokens;
	}
	const totalTokens = asFiniteMetricNumber(value.totalTokens);
	if (totalTokens !== undefined) {
		parsed.totalTokens = totalTokens;
	}
	return parsed;
};

const getAssistantTextFromMessages = (
	messages: { role: string; parts?: { type: string; text?: string }[] }[],
): string =>
	messages
		.findLast((message) => message.role === "assistant")
		?.parts?.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text ?? "")
		.join("") ?? "";

const getTextFromUnknownParts = (value: unknown): string => {
	if (!Array.isArray(value)) {
		return "";
	}

	const chunks: string[] = [];
	for (const entry of value) {
		if (typeof entry === "string") {
			chunks.push(entry);
			continue;
		}
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const part = entry as { type?: unknown; text?: unknown };
		if (part.type === "text" && typeof part.text === "string") {
			chunks.push(part.text);
		}
	}
	return chunks.join("");
};

const getTextFromUiMessage = (message: unknown): string => {
	if (!message || typeof message !== "object") {
		return "";
	}

	const candidate = message as {
		content?: unknown;
		parts?: { type?: string; text?: unknown }[];
	};

	const partsText = getTextFromUnknownParts(candidate.parts);
	if (partsText.trim().length > 0) {
		return partsText;
	}
	if (typeof candidate.content === "string") {
		return candidate.content;
	}
	return getTextFromUnknownParts(candidate.content);
};

const calculateSummary = ({
	modelA,
	modelB,
	preferences,
	results,
	samples,
}: {
	modelA: PlaygroundModel | null;
	modelB: PlaygroundModel | null;
	preferences: Record<string, ComparisonSide>;
	results: ComparisonResults;
	samples: ComparisonSample[];
}): ComparisonSummary => {
	const sides = [
		{ label: getModelLabel(modelA), modelId: modelA?.modelId ?? "-", side: "a" as const },
		{ label: getModelLabel(modelB), modelId: modelB?.modelId ?? "-", side: "b" as const },
	];

	return {
		generatedAt: new Date(),
		sides: sides.map((sideConfig) => {
			let totalCost = 0;
			let hasCost = false;
			let totalInputTokens = 0;
			let totalLatencyMs = 0;
			let totalOutputTokens = 0;
			let totalReasoningTokens = 0;
			let totalTokens = 0;
			let runCount = 0;

			for (const sample of samples) {
				const result = getCompletedResult(results, sample.id, sideConfig.side);
				if (!result?.metrics) {
					continue;
				}

				runCount += 1;
				totalLatencyMs += result.metrics.latencyMs;
				totalInputTokens += result.metrics.inputTokens ?? 0;
				totalOutputTokens += result.metrics.outputTokens ?? 0;
				totalReasoningTokens += result.metrics.reasoningTokens ?? 0;
				totalTokens += result.metrics.totalTokens ?? 0;
				if (result.metrics.cost !== undefined) {
					hasCost = true;
					totalCost += result.metrics.cost;
				}
			}

			return {
				averageCost: hasCost && runCount > 0 ? totalCost / runCount : null,
				averageInputTokens: runCount > 0 ? Math.round(totalInputTokens / runCount) : null,
				averageInputTokensPerSecond:
					totalLatencyMs > 0
						? Number((totalInputTokens / (totalLatencyMs / 1000)).toFixed(1))
						: null,
				averageLatencyMs: runCount > 0 ? Math.round(totalLatencyMs / runCount) : null,
				averageOutputTokens: runCount > 0 ? Math.round(totalOutputTokens / runCount) : null,
				averageTokensPerSecond:
					totalLatencyMs > 0
						? Number((totalOutputTokens / (totalLatencyMs / 1000)).toFixed(1))
						: null,
				averageTotalTokens: runCount > 0 ? Math.round(totalTokens / runCount) : null,
				label: sideConfig.label,
				modelId: sideConfig.modelId,
				runCount,
				side: sideConfig.side,
				totalCost: hasCost ? totalCost : null,
				totalInputTokens,
				totalOutputTokens,
				totalReasoningTokens,
				totalTokens,
				wins: samples.filter((sample) => preferences[sample.id] === sideConfig.side).length,
			};
		}),
		totalRows: samples.length,
	};
};

const renderSelectedModelOption = (selected: PlaygroundModelSelectorOption | null) => {
	if (!selected) {
		return <span className="text-solarized-base01">Modell auswählen...</span>;
	}

	return (
		<div className="min-w-0">
			<p className="truncate font-medium text-solarized-base00">{selected.model.name}</p>
			<p className="truncate text-solarized-base01 text-xs">{selected.providerLabel}</p>
		</div>
	);
};

const renderModelSelectorOption = (option: PlaygroundModelSelectorOption) => (
	<div className="flex min-w-0 items-start justify-between gap-3">
		<div className="min-w-0 space-y-1">
			<p className="truncate font-medium text-solarized-base00">{option.model.name}</p>
			<p className="truncate text-solarized-base01 text-xs">{option.model.modelId}</p>
		</div>
		<div className="flex shrink-0 items-center gap-1">
			{option.isTop ? (
				<Badge
					variant="outline"
					className="border-solarized-violet/30 bg-solarized-violet/10 text-solarized-violet"
				>
					Top
				</Badge>
			) : null}
			{option.model.supportsReasoning ? (
				<Badge
					variant="outline"
					className="border-solarized-cyan/30 bg-solarized-cyan/10 text-solarized-cyan"
				>
					Reasoning
				</Badge>
			) : null}
		</div>
	</div>
);

const InputSectionsAccordion = ({ sections }: { sections: InputSection[] }) => (
	<Accordion
		type="multiple"
		defaultValue={sections.slice(0, 1).map((section) => section.key)}
		className="rounded-md border border-solarized-base2 bg-solarized-base3"
	>
		{sections.map((section) => (
			<AccordionItem key={section.key} value={section.key} className="border-solarized-base2 px-3">
				<AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
					<span className="min-w-0 flex-1">
						<span className="block font-medium text-solarized-base00 text-xs">{section.label}</span>
					</span>
				</AccordionTrigger>
				<AccordionContent className="pb-3">
					<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-solarized-base2 bg-solarized-base3/70 p-3 text-solarized-base00 text-xs leading-relaxed">
						{section.value}
					</pre>
				</AccordionContent>
			</AccordionItem>
		))}
	</Accordion>
);

interface ComparisonRunCellProps {
	blindMode: boolean;
	displayIndex: number;
	isSelected: boolean;
	model: PlaygroundModel | null;
	onPreferenceChange: (sampleId: string, side: ComparisonSide) => void;
	onResultChange: (sampleId: string, side: ComparisonSide, result: ComparisonRunResult) => void;
	parameters: PlaygroundParameters;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	sample: ComparisonSample;
	shouldMaskUntilRowDone: boolean;
	showMetrics: boolean;
	side: ComparisonSide;
	templateReference: string | undefined;
}

const ComparisonRunCell = ({
	blindMode,
	displayIndex,
	isSelected,
	model,
	onPreferenceChange,
	onResultChange,
	parameters,
	runTriggersRef,
	sample,
	shouldMaskUntilRowDone,
	showMetrics,
	side,
	templateReference,
}: ComparisonRunCellProps) => {
	const runId = `${sample.id}-${side}`;
	const payloadRef = useRef<null | Parameters<typeof orpc.admin.scribe.run.call>[0]>(null);
	const runStartedAtRef = useRef<number | null>(null);
	const latestCompletionRef = useRef("");
	const [localResult, setLocalResult] = useState<ComparisonRunResult>({
		status: "idle",
	});

	const publishResult = useCallback(
		(result: ComparisonRunResult) => {
			setLocalResult(result);
			onResultChange(sample.id, side, result);
		},
		[onResultChange, sample.id, side],
	);

	const { messages, sendMessage, status, setMessages } = useChat({
		id: `admin-model-comparison-${runId}`,
		onError: (error) => {
			runStartedAtRef.current = null;
			publishResult({
				error: error.message,
				status: "error",
			});
		},
		onFinish: ({ message, messages: finishedMessages }) => {
			const startedAt = runStartedAtRef.current;
			const latencyMs = startedAt === null ? 0 : Math.max(0, Date.now() - startedAt);
			runStartedAtRef.current = null;
			const { metadata } = message as { metadata?: unknown };
			const parsedMetrics = parseRunMetricsFromMetadata(metadata);
			const responseText =
				getTextFromUiMessage(message) ||
				getAssistantTextFromMessages(
					finishedMessages as {
						role: string;
						parts?: { type: string; text?: string }[];
					}[],
				) ||
				latestCompletionRef.current;

			publishResult({
				metrics: {
					latencyMs,
					...parsedMetrics,
					tokensPerSecond:
						parsedMetrics.outputTokens && latencyMs > 0
							? Number((parsedMetrics.outputTokens / (latencyMs / 1000)).toFixed(1))
							: undefined,
				},
				modelId: model?.modelId,
				requestId: payloadRef.current?.requestId,
				status: "success",
				text: responseText,
			});
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				if (!payloadRef.current) {
					throw new Error("Missing payload");
				}
				return eventIteratorToUnproxiedDataStream(
					await orpc.admin.scribe.run.call(payloadRef.current, {
						signal: options.abortSignal,
					}),
				);
			},
		},
	});

	const { completion } = useMemo(() => {
		const lastAssistant = messages.findLast((message) => message.role === "assistant");
		if (!lastAssistant?.parts) {
			return { completion: "" };
		}
		const textParts = lastAssistant.parts
			.filter((part) => part.type === "text")
			.map((part) => (part as { type: "text"; text: string }).text)
			.join("");
		return { completion: textParts };
	}, [messages]);

	useEffect(() => {
		latestCompletionRef.current = completion;
		if (status === "streaming" || status === "submitted") {
			setLocalResult((current) => ({
				...current,
				status: "running",
				text: completion,
			}));
		}
	}, [completion, status]);

	const startRun = useCallback(async () => {
		if (!model) {
			publishResult({
				error: "Bitte Modell auswählen",
				status: "error",
			});
			return;
		}
		if (sample.templateId && !templateReference) {
			publishResult({
				error: "Vorlage konnte nicht geladen werden",
				status: "error",
			});
			return;
		}

		const requestId = crypto.randomUUID();
		publishResult({
			requestId,
			status: "running",
			text: "",
		});

		try {
			const variables = buildReplayVariables(sample, templateReference);
			const compiledPrompt = await orpc.admin.scribe.compilePrompt.call({
				documentType: sample.documentType,
				promptName: sample.promptName,
				variables,
			});
			const compiledMessagesOverride = (compiledPrompt.compiledMessages ?? []).map((message) => ({
				content:
					typeof message.content === "string" ? message.content : JSON.stringify(message.content),
				role: message.role,
			}));

			payloadRef.current = {
				compiledMessagesOverride,
				documentType: sample.documentType,
				model: model.id,
				parameters,
				promptName: sample.promptName,
				requestId,
				variables,
			};
			runStartedAtRef.current = Date.now();
			setMessages([]);
			await sendMessage({ text: "run" });
		} catch (error) {
			runStartedAtRef.current = null;
			publishResult({
				error: error instanceof Error ? error.message : "Prompt konnte nicht kompiliert werden",
				status: "error",
			});
		}
	}, [model, parameters, publishResult, sample, sendMessage, setMessages, templateReference]);

	useEffect(() => {
		const runTriggers = runTriggersRef.current;
		runTriggers.set(runId, startRun);
		return () => {
			runTriggers.delete(runId);
		};
	}, [runId, runTriggersRef, startRun]);

	let title = `Antwort ${displayIndex + 1}`;
	if (blindMode) {
		title = `Antwort ${displayIndex + 1}`;
	} else {
		title = side === "a" ? "Modell A" : "Modell B";
	}
	const modelLabel = getModelLabel(model);
	const visibleStatus = shouldMaskUntilRowDone ? "running" : localResult.status;

	return (
		<button
			type="button"
			className={cn(
				"flex min-h-[18rem] min-w-0 flex-col rounded-lg border bg-solarized-base3/30 p-3 text-left transition",
				isSelected
					? "border-solarized-green bg-solarized-green/10 ring-2 ring-solarized-green/20"
					: "border-solarized-base2 hover:border-solarized-blue/60",
				visibleStatus !== "success" && "cursor-default hover:border-solarized-base2",
			)}
			disabled={visibleStatus !== "success"}
			onClick={() => {
				onPreferenceChange(sample.id, side);
			}}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="font-semibold text-sm text-solarized-base00">{title}</p>
					<p className="truncate font-mono text-solarized-base01 text-xs">
						{blindMode ? "Verblindet" : modelLabel}
					</p>
				</div>
				{isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-solarized-green" /> : null}
			</div>

			<div className="mt-3 min-h-0 flex-1 whitespace-pre-wrap text-sm text-solarized-base00 leading-relaxed">
				{visibleStatus === "idle" ? (
					<span className="text-solarized-base01">Noch nicht generiert</span>
				) : null}
				{visibleStatus === "running" ? (
					<span className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-4 w-4 animate-spin" />
						Generiert...
					</span>
				) : null}
				{visibleStatus === "error" ? (
					<span className="flex items-start gap-2 text-solarized-red">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{localResult.error}</span>
					</span>
				) : null}
				{visibleStatus === "success" ? localResult.text : null}
			</div>

			{showMetrics && localResult.metrics ? (
				<div className="mt-3 grid grid-cols-2 gap-2 border-solarized-base2 border-t pt-3 text-xs">
					<div>
						<p className="text-solarized-base01">Zeit</p>
						<p className="font-medium text-solarized-base00">
							{formatDuration(localResult.metrics.latencyMs)}
						</p>
					</div>
					<div>
						<p className="text-solarized-base01">Kosten</p>
						<p className="font-medium text-solarized-base00">
							{formatCost(localResult.metrics.cost)}
						</p>
					</div>
					<div>
						<p className="text-solarized-base01">Tokens</p>
						<p className="font-medium text-solarized-base00">
							{formatTokens(localResult.metrics.totalTokens)}
						</p>
					</div>
					<div>
						<p className="text-solarized-base01">Tempo</p>
						<p className="font-medium text-solarized-base00">
							{formatTokensPerSecond(localResult.metrics.tokensPerSecond)}
						</p>
					</div>
				</div>
			) : null}
		</button>
	);
};

const ModelConfigCard = ({
	disabled,
	isLoading,
	model,
	modelId,
	modelSelectorOptions,
	onModelChange,
	onParametersChange,
	parameters,
	side,
}: {
	disabled: boolean;
	isLoading: boolean;
	model: PlaygroundModel | null;
	modelId: string | null;
	modelSelectorOptions: PlaygroundModelSelectorOption[];
	onModelChange: (value: string) => void;
	onParametersChange: (parameters: PlaygroundParameters) => void;
	parameters: PlaygroundParameters;
	side: ComparisonSide;
}) => (
	<Card className="border-solarized-base2">
		<CardHeader className="p-4">
			<CardTitle className="text-base text-solarized-base00">
				Modell {side === "a" ? "A" : "B"}
			</CardTitle>
			<CardDescription className="text-solarized-base01 text-sm">
				{model?.modelId ?? "Noch kein Modell ausgewählt"}
			</CardDescription>
		</CardHeader>
		<CardContent className="space-y-4 p-4 pt-0">
			<div className="space-y-2">
				<Label>KI-Modell</Label>
				<ModelSelector
					className="min-h-11 border-solarized-base2 bg-solarized-base3 py-2"
					emptyMessage="Keine Modelle gefunden."
					formatGroupLabel={formatModelGroupLabel}
					isLoading={isLoading}
					loadingMessage="Lade Modelle..."
					onValueChange={onModelChange}
					options={modelSelectorOptions}
					placeholder="Modell auswählen..."
					popoverClassName="sm:w-[28rem]"
					renderOption={renderModelSelectorOption}
					renderSelected={renderSelectedModelOption}
					searchPlaceholder="Modell oder Anbieter suchen..."
					value={modelId}
				/>
			</div>
			<Separator className="bg-solarized-base2" />
			<ParameterControls
				disabled={disabled}
				model={model}
				onChange={onParametersChange}
				parameters={parameters}
			/>
		</CardContent>
	</Card>
);

const ComparisonSampleRow = ({
	blindMode,
	displayOrder,
	index,
	modelA,
	modelB,
	onPreferenceChange,
	onResultChange,
	parametersA,
	parametersB,
	preferences,
	results,
	runTriggersRef,
	sample,
	showMetrics,
	templateReferenceById,
}: {
	blindMode: boolean;
	displayOrder: Record<string, ComparisonSide[]>;
	index: number;
	modelA: PlaygroundModel | null;
	modelB: PlaygroundModel | null;
	onPreferenceChange: (sampleId: string, side: ComparisonSide) => void;
	onResultChange: (sampleId: string, side: ComparisonSide, result: ComparisonRunResult) => void;
	parametersA: PlaygroundParameters;
	parametersB: PlaygroundParameters;
	preferences: Record<string, ComparisonSide>;
	results: ComparisonResults;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	sample: ComparisonSample;
	showMetrics: boolean;
	templateReferenceById: Map<string, string>;
}) => {
	const order = blindMode
		? (displayOrder[sample.id] ?? ["a", "b"])
		: (["a", "b"] as ComparisonSide[]);
	const docUi = scribeDocTypeUi[sample.documentType];
	const rowResults = results[sample.id];
	const rowStatuses = [rowResults?.a?.status, rowResults?.b?.status];
	const rowHasStarted = rowStatuses.some(
		(status) => status === "running" || status === "success" || status === "error",
	);
	const rowIsDone = rowStatuses.every((status) => status === "success" || status === "error");
	const runConfigBySide: Record<
		ComparisonSide,
		{
			model: PlaygroundModel | null;
			parameters: PlaygroundParameters;
		}
	> = {
		a: { model: modelA, parameters: parametersA },
		b: { model: modelB, parameters: parametersB },
	};
	const templateReference = sample.templateId
		? templateReferenceById.get(sample.templateId)
		: undefined;

	return (
		<div className="grid gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/20 p-3 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
			<div className="min-w-0 space-y-3">
				<div className="flex items-center justify-between gap-2">
					<Badge
						variant="outline"
						className="border-solarized-blue/30 bg-solarized-blue/10 text-solarized-blue"
					>
						#{index + 1}
					</Badge>
					<span className="text-solarized-base01 text-xs">{formatDate(sample.timestamp)}</span>
				</div>
				<div>
					<p className="font-medium text-sm text-solarized-base00">
						{docUi?.label ?? sample.documentType}
					</p>
					<p className="truncate font-mono text-solarized-base01 text-xs">{sample.promptName}</p>
				</div>
				<InputSectionsAccordion sections={sample.inputSections} />
			</div>
			{order.map((side, responseIndex) => (
				<ComparisonRunCell
					key={side}
					blindMode={blindMode}
					displayIndex={responseIndex}
					isSelected={preferences[sample.id] === side}
					model={runConfigBySide[side].model}
					onPreferenceChange={onPreferenceChange}
					onResultChange={onResultChange}
					parameters={runConfigBySide[side].parameters}
					runTriggersRef={runTriggersRef}
					sample={sample}
					shouldMaskUntilRowDone={rowHasStarted && !rowIsDone}
					showMetrics={showMetrics}
					side={side}
					templateReference={templateReference}
				/>
			))}
		</div>
	);
};

const ComparisonRunsSection = ({
	blindMode,
	displayOrder,
	isLoadingSamples,
	modelA,
	modelB,
	onPreferenceChange,
	onResultChange,
	parametersA,
	parametersB,
	preferences,
	results,
	runTriggersRef,
	samples,
	selectedCount,
	showMetrics,
	templateReferenceById,
}: {
	blindMode: boolean;
	displayOrder: Record<string, ComparisonSide[]>;
	isLoadingSamples: boolean;
	modelA: PlaygroundModel | null;
	modelB: PlaygroundModel | null;
	onPreferenceChange: (sampleId: string, side: ComparisonSide) => void;
	onResultChange: (sampleId: string, side: ComparisonSide, result: ComparisonRunResult) => void;
	parametersA: PlaygroundParameters;
	parametersB: PlaygroundParameters;
	preferences: Record<string, ComparisonSide>;
	results: ComparisonResults;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	samples: ComparisonSample[];
	selectedCount: number;
	showMetrics: boolean;
	templateReferenceById: Map<string, string>;
}) => (
	<div className="space-y-3">
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex items-center gap-2">
				<BarChart3 className="h-4 w-4 text-solarized-base01" />
				<h2 className="font-semibold text-lg text-solarized-base00">Vergleichsruns</h2>
			</div>
			<Badge variant="outline" className="border-solarized-base2 text-solarized-base01">
				{selectedCount}/{samples.length} gewählt
			</Badge>
		</div>

		{isLoadingSamples ? (
			<div className="flex min-h-48 items-center justify-center rounded-lg border border-solarized-base2 bg-solarized-base3/40">
				<Loader2 className="h-5 w-5 animate-spin text-solarized-base01" />
			</div>
		) : null}

		{!isLoadingSamples && samples.length === 0 ? (
			<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/40 p-6 text-center text-sm text-solarized-base01">
				Keine wiederverwendbaren scribe-kompatiblen Usage Events gefunden.
			</div>
		) : null}

		{samples.map((sample, index) => (
			<ComparisonSampleRow
				key={sample.id}
				blindMode={blindMode}
				displayOrder={displayOrder}
				index={index}
				modelA={modelA}
				modelB={modelB}
				onPreferenceChange={onPreferenceChange}
				onResultChange={onResultChange}
				parametersA={parametersA}
				parametersB={parametersB}
				preferences={preferences}
				results={results}
				runTriggersRef={runTriggersRef}
				sample={sample}
				showMetrics={showMetrics}
				templateReferenceById={templateReferenceById}
			/>
		))}
	</div>
);

const ComparisonFooter = ({
	canCompare,
	onCompare,
	sampleCount,
	selectedCount,
}: {
	canCompare: boolean;
	onCompare: () => void;
	sampleCount: number;
	selectedCount: number;
}) => (
	<div className="sticky bottom-0 z-10 -mx-4 border-solarized-base2 border-t bg-solarized-base3/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
		<div className="mx-auto flex max-w-[96rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="text-sm text-solarized-base01">
				{canCompare
					? "Alle Präferenzen erfasst"
					: `${selectedCount}/${sampleCount} Präferenzen erfasst`}
			</div>
			<Button type="button" className="gap-2" onClick={onCompare} disabled={!canCompare}>
				<Trophy className="h-4 w-4" />
				Vergleichen
			</Button>
		</div>
	</div>
);

const ComparisonSummaryCard = ({ summary }: { summary: ComparisonSummary | null }) => {
	if (!summary) {
		return null;
	}

	const summaryMaxWins = Math.max(...summary.sides.map((side) => side.wins));

	return (
		<Card className="border-solarized-green/30 bg-solarized-green/5">
			<CardHeader className="p-4">
				<CardTitle className="text-base text-solarized-base00">Ergebnis</CardTitle>
				<CardDescription className="text-solarized-base01 text-sm">
					{formatDate(summary.generatedAt)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 p-4 pt-0 lg:grid-cols-2">
				{summary.sides.map((sideSummary) => (
					<div
						key={sideSummary.side}
						className="rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-4"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="font-semibold text-solarized-base00">
									Modell {sideSummary.side === "a" ? "A" : "B"} · {sideSummary.label}
								</p>
								<p className="truncate font-mono text-solarized-base01 text-xs">
									{sideSummary.modelId}
								</p>
							</div>
							<Badge
								variant="outline"
								className={cn(
									"shrink-0 border px-2 py-1",
									sideSummary.wins === summaryMaxWins
										? "border-solarized-green/40 bg-solarized-green/15 text-solarized-green"
										: "border-solarized-base2 bg-solarized-base2/40 text-solarized-base00",
								)}
							>
								{sideSummary.wins === summaryMaxWins ? "Gewinner · " : ""}
								{sideSummary.wins}/{summary.totalRows}
							</Badge>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-3 text-sm">
							<div>
								<p className="text-solarized-base01">Ø Zeit</p>
								<p className="font-medium text-solarized-base00">
									{formatDuration(sideSummary.averageLatencyMs)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Kosten</p>
								<p className="font-medium text-solarized-base00">
									{formatCost(sideSummary.averageCost)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Tokens</p>
								<p className="font-medium text-solarized-base00">
									{formatTokens(sideSummary.averageTotalTokens)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Output-Tempo</p>
								<p className="font-medium text-solarized-base00">
									{formatTokensPerSecond(sideSummary.averageTokensPerSecond)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Input</p>
								<p className="font-medium text-solarized-base00">
									{formatTokens(sideSummary.averageInputTokens)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Output</p>
								<p className="font-medium text-solarized-base00">
									{formatTokens(sideSummary.averageOutputTokens)}
								</p>
							</div>
							<div>
								<p className="text-solarized-base01">Ø Input-Tempo</p>
								<p className="font-medium text-solarized-base00">
									{formatTokensPerSecond(sideSummary.averageInputTokensPerSecond)}
								</p>
							</div>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
};

const ModelComparisonHeader = ({
	blindMode,
	canGenerate,
	isGenerating,
	isLoadingReplayContext,
	isRefreshingSamples,
	onBlindModeChange,
	onGenerateAll,
	onRefreshSamples,
	sampleCount,
}: {
	blindMode: boolean;
	canGenerate: boolean;
	isGenerating: boolean;
	isLoadingReplayContext: boolean;
	isRefreshingSamples: boolean;
	onBlindModeChange: (checked: boolean) => void;
	onGenerateAll: () => void;
	onRefreshSamples: () => void;
	sampleCount: number;
}) => (
	<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 className="font-semibold text-2xl text-solarized-base00">AI-Modell-Vergleich</h1>
			<p className="text-sm text-solarized-base01">{sampleCount} zufällige Usage Events</p>
		</div>
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-2 rounded-md border border-solarized-base2 bg-solarized-base3 px-3 py-2">
				<EyeOff className="h-4 w-4 text-solarized-base01" />
				<Label htmlFor="blind-mode" className="text-sm">
					Blind
				</Label>
				<Switch
					id="blind-mode"
					checked={blindMode}
					onCheckedChange={onBlindModeChange}
					disabled={isGenerating}
				/>
			</div>
			<Button
				type="button"
				variant="outline"
				className="gap-2"
				onClick={onRefreshSamples}
				disabled={isRefreshingSamples || isGenerating}
			>
				<RefreshCcw className={cn("h-4 w-4", isRefreshingSamples && "animate-spin")} />
				Neue Stichprobe
			</Button>
			<Button
				type="button"
				className="gap-2"
				onClick={onGenerateAll}
				disabled={!canGenerate || isGenerating || isLoadingReplayContext}
			>
				{isGenerating || isLoadingReplayContext ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Play className="h-4 w-4" />
				)}
				{isLoadingReplayContext ? "Lade Kontext..." : "Generieren"}
			</Button>
		</div>
	</div>
);

export const ModelComparisonPageClient = () => {
	const queryClient = useQueryClient();
	const runTriggersRef = useRef<Map<string, () => Promise<void>>>(new Map());
	const [modelAId, setModelAId] = useState<string | null>(null);
	const [modelBId, setModelBId] = useState<string | null>(null);
	const [parametersA, setParametersA] = useState<PlaygroundParameters>(DEFAULT_PARAMETERS);
	const [parametersB, setParametersB] = useState<PlaygroundParameters>(DEFAULT_PARAMETERS);
	const [blindMode, setBlindMode] = useState(true);
	const [displayOrder, setDisplayOrder] = useState<Record<string, ComparisonSide[]>>({});
	const [isGenerating, setIsGenerating] = useState(false);
	const [preferences, setPreferences] = useState<Record<string, ComparisonSide>>({});
	const [results, setResults] = useState<ComparisonResults>({});
	const [sampledIds, setSampledIds] = useState<string[]>([]);
	const [summary, setSummary] = useState<ComparisonSummary | null>(null);

	const modelsQuery = useQuery(orpc.admin.models.list.queryOptions());
	const topModelsQuery = useQuery(
		orpc.admin.models.topModels.queryOptions({
			input: { limit: 5 },
		}),
	);
	const usageListQueryOptions = useMemo(
		() =>
			orpc.admin.usage.list.queryOptions({
				input: { limit: USAGE_POOL_LIMIT, name: "ai_scribe_generation" },
			}),
		[],
	);
	const usageListQuery = useQuery(usageListQueryOptions);
	const usageDetailQueries = useQueries({
		combine: (queries) => ({
			data: queries.map((query) => query.data),
			isFetching: queries.some((query) => query.isFetching),
			isLoading: queries.some((query) => query.isLoading),
		}),
		queries: sampledIds.map((id) =>
			orpc.admin.usage.get.queryOptions({
				input: { id },
			}),
		),
	});

	const models = modelsQuery.data ?? EMPTY_MODELS;
	const topModelIds = topModelsQuery.data ?? EMPTY_TOP_MODEL_IDS;
	const samples = useMemo(
		() =>
			usageDetailQueries.data
				.map(toComparisonSample)
				.filter((sample): sample is ComparisonSample => sample !== null)
				.slice(0, SAMPLE_DISPLAY_LIMIT),
		[usageDetailQueries.data],
	);
	const templateIds = useMemo(
		() => [
			...new Set(
				samples
					.map((sample) => sample.templateId)
					.filter((templateId): templateId is string => typeof templateId === "string"),
			),
		],
		[samples],
	);
	const templateDetailQueries = useQueries({
		queries: templateIds.map((id) =>
			orpc.templates.get.queryOptions({
				input: { id },
			}),
		),
	});
	const templateReferenceById = useMemo(() => {
		const references = new Map<string, string>();
		for (const [index, query] of templateDetailQueries.entries()) {
			const template = query.data;
			if (!template) {
				continue;
			}
			references.set(
				templateIds[index],
				buildSelectedTemplateReference({
					content: template.content,
					examples: template.examples ?? [],
					title: template.title,
				}),
			);
		}
		return references;
	}, [templateDetailQueries, templateIds]);
	const isLoadingReplayContext = templateDetailQueries.some(
		(query) => query.isLoading || query.isFetching,
	);
	const sampleIdsKey = samples.map((sample) => sample.id).join("|");
	const modelById = useMemo(
		() => new Map(models.map((model) => [model.id, model] as const)),
		[models],
	);
	const modelA = modelAId ? (modelById.get(modelAId) ?? null) : null;
	const modelB = modelBId ? (modelById.get(modelBId) ?? null) : null;

	useEffect(() => {
		if (models.length === 0) {
			return;
		}
		setModelAId((current) => current ?? models[0]?.id ?? null);
		setModelBId((current) => current ?? models[1]?.id ?? models[0]?.id ?? null);
	}, [models]);

	useEffect(() => {
		const ids = usageListQuery.data?.items.map((item) => item.id) ?? [];
		if (ids.length === 0) {
			setSampledIds([]);
			return;
		}
		setSampledIds(shuffleArray(ids).slice(0, SAMPLE_FETCH_LIMIT));
	}, [usageListQuery.data]);

	useEffect(() => {
		setDisplayOrder(buildDisplayOrder(samples, blindMode));
		setPreferences({});
		setResults({});
		setSummary(null);
	}, [blindMode, sampleIdsKey, samples]);

	const modelSelectorOptions = useMemo<PlaygroundModelSelectorOption[]>(() => {
		const topModelIdSet = new Set(topModelIds);
		return models.map((model) => {
			const provider = getProviderGroup(model);
			const providerLabel = formatModelGroupLabel(provider);
			return {
				group: provider,
				isTop: topModelIdSet.has(model.modelId),
				keywords: [model.modelId, model.name, provider, providerLabel],
				label: model.name,
				model,
				providerLabel,
				value: model.id,
			};
		});
	}, [models, topModelIds]);

	const setRunResult = useCallback(
		(sampleId: string, side: ComparisonSide, result: ComparisonRunResult) => {
			setResults((current) => ({
				...current,
				[sampleId]: {
					...current[sampleId],
					[side]: result,
				},
			}));
		},
		[],
	);

	const clearComparisonState = useCallback(() => {
		setPreferences({});
		setResults({});
		setSummary(null);
	}, []);

	const handleRefreshSamples = useCallback(async () => {
		clearComparisonState();
		setSampledIds([]);
		await queryClient.invalidateQueries({ queryKey: usageListQueryOptions.queryKey });
		const refreshed = await usageListQuery.refetch();
		const ids = refreshed.data?.items.map((item) => item.id) ?? [];
		setSampledIds(shuffleArray(ids).slice(0, SAMPLE_FETCH_LIMIT));
	}, [clearComparisonState, queryClient, usageListQuery, usageListQueryOptions.queryKey]);

	const handleBlindModeChange = useCallback((checked: boolean) => {
		setBlindMode(checked);
	}, []);

	const handleGenerateAll = useCallback(async () => {
		if (!modelA || !modelB) {
			toast.error("Bitte zwei Modelle auswählen");
			return;
		}
		if (samples.length === 0) {
			toast.error("Keine wiederverwendbaren Usage Events gefunden");
			return;
		}
		if (isLoadingReplayContext) {
			toast.error("Replay-Kontext wird noch geladen");
			return;
		}

		setIsGenerating(true);
		setPreferences({});
		setSummary(null);
		setDisplayOrder(buildDisplayOrder(samples, blindMode));
		setResults({});
		const triggers = samples.flatMap((sample) => [
			runTriggersRef.current.get(`${sample.id}-a`),
			runTriggersRef.current.get(`${sample.id}-b`),
		]);

		await Promise.allSettled(triggers.map((trigger) => (trigger ? trigger() : Promise.resolve())));
		setIsGenerating(false);
	}, [blindMode, isLoadingReplayContext, modelA, modelB, samples]);

	const handlePreferenceChange = useCallback((sampleId: string, side: ComparisonSide) => {
		setPreferences((current) => ({
			...current,
			[sampleId]: side,
		}));
		setSummary(null);
	}, []);

	const allSamplesHaveRuns = samples.every(
		(sample) =>
			results[sample.id]?.a?.status === "success" && results[sample.id]?.b?.status === "success",
	);
	const selectedCount = samples.filter((sample) => preferences[sample.id]).length;
	const canCompare =
		samples.length > 0 && allSamplesHaveRuns && selectedCount === samples.length && !isGenerating;

	const handleCompare = useCallback(() => {
		if (!canCompare) {
			return;
		}
		setSummary(
			calculateSummary({
				modelA,
				modelB,
				preferences,
				results,
				samples,
			}),
		);
	}, [canCompare, modelA, modelB, preferences, results, samples]);

	const isLoadingSamples =
		usageListQuery.isLoading || usageDetailQueries.isLoading || usageDetailQueries.isFetching;
	const canGenerateAll = Boolean(modelA && modelB && samples.length > 0);

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-[96rem] space-y-6">
				<ModelComparisonHeader
					blindMode={blindMode}
					canGenerate={canGenerateAll}
					isGenerating={isGenerating}
					isLoadingReplayContext={isLoadingReplayContext}
					isRefreshingSamples={usageListQuery.isFetching}
					onBlindModeChange={handleBlindModeChange}
					onGenerateAll={handleGenerateAll}
					onRefreshSamples={handleRefreshSamples}
					sampleCount={samples.length}
				/>

				<div className="grid gap-4 lg:grid-cols-2">
					<ModelConfigCard
						disabled={isGenerating}
						isLoading={modelsQuery.isLoading}
						model={modelA}
						modelId={modelAId}
						modelSelectorOptions={modelSelectorOptions}
						onModelChange={setModelAId}
						onParametersChange={setParametersA}
						parameters={parametersA}
						side="a"
					/>
					<ModelConfigCard
						disabled={isGenerating}
						isLoading={modelsQuery.isLoading}
						model={modelB}
						modelId={modelBId}
						modelSelectorOptions={modelSelectorOptions}
						onModelChange={setModelBId}
						onParametersChange={setParametersB}
						parameters={parametersB}
						side="b"
					/>
				</div>

				<ComparisonRunsSection
					blindMode={blindMode}
					displayOrder={displayOrder}
					isLoadingSamples={isLoadingSamples}
					modelA={modelA}
					modelB={modelB}
					onPreferenceChange={handlePreferenceChange}
					onResultChange={setRunResult}
					parametersA={parametersA}
					parametersB={parametersB}
					preferences={preferences}
					results={results}
					runTriggersRef={runTriggersRef}
					samples={samples}
					selectedCount={selectedCount}
					showMetrics={Boolean(summary)}
					templateReferenceById={templateReferenceById}
				/>

				<ComparisonFooter
					canCompare={canCompare}
					onCompare={handleCompare}
					sampleCount={samples.length}
					selectedCount={selectedCount}
				/>

				<ComparisonSummaryCard summary={summary} />
			</div>
		</div>
	);
};
