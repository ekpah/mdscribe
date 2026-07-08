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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Switch } from "@repo/design-system/components/ui/switch";
import { cn } from "@repo/design-system/lib/utils";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	BarChart3,
	Bot,
	CheckCircle2,
	EyeOff,
	Loader2,
	Play,
	RefreshCcw,
	RotateCcw,
	Sparkles,
	Trophy,
	UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { toast } from "sonner";

import { ParameterControls } from "@/app/admin/playground/_components/parameter-controls";
import { isScribeDocType, scribeDocTypeUi } from "@/app/admin/playground/_lib/scribe-doc-types";
import type { PlaygroundModel, PlaygroundParameters } from "@/app/admin/playground/_lib/types";
import { orpc } from "@/lib/orpc";
import { buildSelectedTemplateReference } from "@/orpc/scribe/context/template/compose";
import { PROMPT_HARNESS_OPTIONS, resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";
import type { DocumentType } from "@/orpc/scribe/types";

const DEFAULT_PARAMETERS: PlaygroundParameters = {
	frequencyPenalty: undefined,
	maxTokens: undefined,
	presencePenalty: undefined,
	reasoningEffort: "none",
	temperature: 1,
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
const DEFAULT_SAMPLE_COUNT = 5;
const SAMPLE_COUNT_OPTIONS = [1, 2, 3, 5, 10, 20] as const;
const ALL_HARNESSES = "all" as const;
// Sentinel for "use the template that the original usage event used".
const ORIGINAL_TEMPLATE = "__original__" as const;

type HarnessFilter = PromptHarnessId | typeof ALL_HARNESSES;

// Ambulanzkontakt and ICU-Verlegungsbrief are no longer standalone harnesses;
// they generate via the shared epikrise prompt. They are not offered as their
// own filter options and instead fold into the epikrise filter.
const EPIKRISE_GROUPED_HARNESS_IDS = new Set<PromptHarnessId>([
	"epikrise",
	"icu-transfer",
	"outpatient",
]);
const HARNESS_FILTER_OPTIONS = PROMPT_HARNESS_OPTIONS.filter(
	(option) => option.id === "epikrise" || !EPIKRISE_GROUPED_HARNESS_IDS.has(option.id),
);

interface TemplateOption {
	category: string | null;
	id: string;
	title: string;
}

type ComparisonSide = "a" | "b";
type PreferenceSource = "ai" | "human";
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

interface ComparisonPreference {
	note?: string;
	side: ComparisonSide;
	source: PreferenceSource;
}

type ComparisonPreferences = Record<string, ComparisonPreference>;

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
		return resolvePromptHarnessId(promptName) ?? null;
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

const buildEvaluationInputs = (
	sample: ComparisonSample,
	templateReference: string | undefined,
): Record<string, unknown> => ({
	promptName: sample.promptName,
	variables: buildReplayVariables(sample, templateReference),
});

const usageEventMatchesHarness = (metadata: unknown, filter: HarnessFilter): boolean => {
	if (filter === ALL_HARNESSES) {
		return true;
	}
	const { promptName } = toMetadataRecord(metadata);
	if (typeof promptName !== "string") {
		return false;
	}
	const resolved = resolvePromptHarnessId(promptName);
	if (!resolved) {
		return false;
	}
	if (filter === "epikrise") {
		return EPIKRISE_GROUPED_HARNESS_IDS.has(resolved);
	}
	return resolved === filter;
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
				? (resolvePromptHarnessId(metadata.promptName) ?? metadata.promptName)
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

const areParametersEqual = (
	left: PlaygroundParameters,
	right: PlaygroundParameters,
): boolean =>
	left.frequencyPenalty === right.frequencyPenalty &&
	left.maxTokens === right.maxTokens &&
	left.presencePenalty === right.presencePenalty &&
	left.reasoningEffort === right.reasoningEffort &&
	left.temperature === right.temperature &&
	left.thinking === right.thinking &&
	left.thinkingExplicit === right.thinkingExplicit &&
	left.topK === right.topK &&
	left.topP === right.topP;

const shuffleArray = <T,>(items: T[]): T[] => {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
};

const buildDisplayOrder = (
	sampleIds: string[],
	blindMode: boolean,
): Record<string, ComparisonSide[]> => {
	const nextOrder: Record<string, ComparisonSide[]> = {};
	for (const sampleId of sampleIds) {
		nextOrder[sampleId] = blindMode && Math.random() > 0.5 ? ["b", "a"] : ["a", "b"];
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
	preferences: ComparisonPreferences;
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
				wins: samples.filter((sample) => preferences[sample.id]?.side === sideConfig.side).length,
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
		<span className="block min-w-0 truncate font-medium text-solarized-base00">
			{selected.label}
		</span>
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
		defaultValue={sections.slice(0, 1).map((section) => section.key)}
		multiple
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

const PreferenceSourceBadge = ({ preference }: { preference: ComparisonPreference }) => {
	if (preference.source === "ai") {
		return (
			<span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-1 font-medium text-solarized-orange text-xs">
				<Bot aria-hidden="true" className="h-3.5 w-3.5" />
				KI-Vorschlag
			</span>
		);
	}

	return (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-solarized-green/25 bg-solarized-green/10 px-2 py-1 font-medium text-solarized-green text-xs">
			<UserCheck aria-hidden="true" className="h-3.5 w-3.5" />
			Manuell gewählt
		</span>
	);
};

const SelectionIndicator = ({
	isSelected,
	preference,
}: {
	isSelected: boolean;
	preference: ComparisonPreference | undefined;
}) => {
	if (!(isSelected && preference)) {
		return null;
	}

	const selectedByAi = preference.source === "ai";

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<PreferenceSourceBadge preference={preference} />
			<CheckCircle2
				className={cn(
					"h-4 w-4 shrink-0",
					selectedByAi ? "text-solarized-orange" : "text-solarized-green",
				)}
			/>
		</div>
	);
};

const ResponseStatusContent = ({
	result,
	status,
}: {
	result: ComparisonRunResult;
	status: RunStatus;
}) => {
	if (status === "idle") {
		return <span className="text-solarized-base01">Noch nicht generiert</span>;
	}

	if (status === "running") {
		return (
			<span className="flex items-center gap-2 text-solarized-base01">
				<Loader2 className="h-4 w-4 animate-spin" />
				Generiert...
			</span>
		);
	}

	if (status === "error") {
		return (
			<span className="flex items-start gap-2 text-solarized-red">
				<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
				<span>{result.error}</span>
			</span>
		);
	}

	return result.text;
};

const AiPreferenceNote = ({ preference }: { preference: ComparisonPreference | undefined }) => {
	if (preference?.source !== "ai" || !preference.note) {
		return null;
	}

	return (
		<div className="mt-3 rounded-md border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-1.5 text-left text-solarized-orange text-xs">
			<div className="flex items-start gap-2">
				<Bot aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
				<div className="min-w-0">
					<p className="font-medium">KI-Begründung</p>
					<p className="mt-0.5 text-solarized-orange/90">{preference.note}</p>
				</div>
			</div>
		</div>
	);
};

interface ComparisonRunCellProps {
	blindMode: boolean;
	displayIndex: number;
	model: PlaygroundModel | null;
	onPreferenceChange: (sampleId: string, side: ComparisonSide) => void;
	onResultChange: (sampleId: string, side: ComparisonSide, result: ComparisonRunResult) => void;
	overrideTemplateId: string | null;
	parameters: PlaygroundParameters;
	preference: ComparisonPreference | undefined;
	storedResult: ComparisonRunResult | undefined;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	sample: ComparisonSample;
	shouldMaskUntilRowDone: boolean;
	showMetrics: boolean;
	side: ComparisonSide;
	templateReferenceById: Map<string, string>;
}

const ComparisonRunCell = ({
	blindMode,
	displayIndex,
	model,
	onPreferenceChange,
	onResultChange,
	overrideTemplateId,
	parameters,
	preference,
	storedResult,
	runTriggersRef,
	sample,
	shouldMaskUntilRowDone,
	showMetrics,
	side,
	templateReferenceById,
}: ComparisonRunCellProps) => {
	const runId = `${sample.id}-${side}`;
	// A per-side template override wins; otherwise fall back to the template the
	// original usage event used.
	const effectiveTemplateId = overrideTemplateId ?? sample.templateId;
	const templateReference = effectiveTemplateId
		? templateReferenceById.get(effectiveTemplateId)
		: undefined;
	const payloadRef = useRef<null | Parameters<typeof orpc.admin.scribe.run.call>[0]>(null);
	const runStartedAtRef = useRef<number | null>(null);
	const latestCompletionRef = useRef("");
	const [localResult, setLocalResult] = useState<ComparisonRunResult>({
		status: "idle",
	});

	useEffect(() => {
		if (!storedResult) {
			setLocalResult({ status: "idle" });
		}
	}, [storedResult]);

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
		if (effectiveTemplateId && !templateReference) {
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
	}, [
		effectiveTemplateId,
		model,
		parameters,
		publishResult,
		sample,
		sendMessage,
		setMessages,
		templateReference,
	]);

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
	const isSelected = preference?.side === side;

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
				<SelectionIndicator isSelected={isSelected} preference={preference} />
			</div>

			<div className="mt-3 min-h-0 flex-1 whitespace-pre-wrap text-sm text-solarized-base00 leading-relaxed">
				<ResponseStatusContent result={localResult} status={visibleStatus} />
			</div>

			<AiPreferenceNote preference={isSelected ? preference : undefined} />

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
	isGeneratingSide,
	isLoading,
	isLoadingTemplates,
	model,
	modelId,
	modelSelectorOptions,
	onModelChange,
	onParametersChange,
	onRegenerateSide,
	onTemplateOverrideChange,
	parameters,
	side,
	templateOptions,
	templateOverrideId,
}: {
	disabled: boolean;
	isGeneratingSide: boolean;
	isLoading: boolean;
	isLoadingTemplates: boolean;
	model: PlaygroundModel | null;
	modelId: string | null;
	modelSelectorOptions: PlaygroundModelSelectorOption[];
	onModelChange: (value: string) => void;
	onParametersChange: (parameters: PlaygroundParameters) => void;
	onRegenerateSide: () => void;
	onTemplateOverrideChange: (value: string | null) => void;
	parameters: PlaygroundParameters;
	side: ComparisonSide;
	templateOptions: TemplateOption[];
	templateOverrideId: string | null;
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
			<div className="space-y-2">
				<Label>Vorlage</Label>
				<Select
					disabled={disabled || isLoadingTemplates}
					onValueChange={(value) =>
						onTemplateOverrideChange(value === ORIGINAL_TEMPLATE ? null : value)
					}
					value={templateOverrideId ?? ORIGINAL_TEMPLATE}
				>
					<SelectTrigger className="min-h-11 border-solarized-base2 bg-solarized-base3">
						<SelectValue placeholder="Vorlage auswählen..." />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ORIGINAL_TEMPLATE}>Aus Usage Event</SelectItem>
						{templateOptions.map((option) => (
							<SelectItem key={option.id} value={option.id}>
								{option.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-solarized-base01 text-xs">
					Ohne Auswahl wird die Vorlage des jeweiligen Usage Events verwendet.
				</p>
			</div>
			<Separator className="bg-solarized-base2" />
			<ParameterControls
				disabled={disabled}
				model={model}
				onChange={onParametersChange}
				parameters={parameters}
			/>
			<Button
				type="button"
				variant="outline"
				className="w-full gap-2"
				onClick={onRegenerateSide}
				disabled={disabled || !model || isGeneratingSide}
			>
				{isGeneratingSide ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<RotateCcw className="h-4 w-4" />
				)}
				Nur Modell {side === "a" ? "A" : "B"} regenerieren
			</Button>
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
	templateOverrideIdA,
	templateOverrideIdB,
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
	preferences: ComparisonPreferences;
	results: ComparisonResults;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	sample: ComparisonSample;
	showMetrics: boolean;
	templateOverrideIdA: string | null;
	templateOverrideIdB: string | null;
	templateReferenceById: Map<string, string>;
}) => {
	const order = blindMode
		? (displayOrder[sample.id] ?? ["a", "b"])
		: (["a", "b"] as ComparisonSide[]);
	const docUi = scribeDocTypeUi[sample.documentType];
	const rowResults = results[sample.id];
	const rowStatuses = [rowResults?.a?.status, rowResults?.b?.status];
	const rowHasRunning = rowStatuses.some((status) => status === "running");
	const rowIsDone = rowStatuses.every((status) => status === "success" || status === "error");
	const runConfigBySide: Record<
		ComparisonSide,
		{
			model: PlaygroundModel | null;
			overrideTemplateId: string | null;
			parameters: PlaygroundParameters;
		}
	> = {
		a: { model: modelA, overrideTemplateId: templateOverrideIdA, parameters: parametersA },
		b: { model: modelB, overrideTemplateId: templateOverrideIdB, parameters: parametersB },
	};

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
					model={runConfigBySide[side].model}
					onPreferenceChange={onPreferenceChange}
					onResultChange={onResultChange}
					overrideTemplateId={runConfigBySide[side].overrideTemplateId}
					parameters={runConfigBySide[side].parameters}
					preference={preferences[sample.id]}
					runTriggersRef={runTriggersRef}
					sample={sample}
					shouldMaskUntilRowDone={rowHasRunning && !rowIsDone}
					showMetrics={showMetrics}
					side={side}
					storedResult={rowResults?.[side]}
					templateReferenceById={templateReferenceById}
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
	templateOverrideIdA,
	templateOverrideIdB,
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
	preferences: ComparisonPreferences;
	results: ComparisonResults;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
	samples: ComparisonSample[];
	selectedCount: number;
	showMetrics: boolean;
	templateOverrideIdA: string | null;
	templateOverrideIdB: string | null;
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
				templateOverrideIdA={templateOverrideIdA}
				templateOverrideIdB={templateOverrideIdB}
				templateReferenceById={templateReferenceById}
			/>
		))}
	</div>
);

const ComparisonFooter = ({
	canAutoEvaluate,
	canCompare,
	isAutoEvaluating,
	onAutoEvaluate,
	onCompare,
	sampleCount,
	selectedCount,
}: {
	canAutoEvaluate: boolean;
	canCompare: boolean;
	isAutoEvaluating: boolean;
	onAutoEvaluate: () => void;
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
			<div className="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					variant="secondary"
					className="gap-2"
					onClick={onAutoEvaluate}
					disabled={!canAutoEvaluate || isAutoEvaluating}
				>
					{isAutoEvaluating ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Sparkles className="h-4 w-4" />
					)}
					Automatisch bewerten
				</Button>
				<Button type="button" className="gap-2" onClick={onCompare} disabled={!canCompare}>
					<Trophy className="h-4 w-4" />
					Vergleichen
				</Button>
			</div>
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
	harnessFilter,
	isAutoEvaluating,
	isGenerating,
	isLoadingReplayContext,
	isRefreshingSamples,
	onBlindModeChange,
	onGenerateAll,
	onHarnessFilterChange,
	onRefreshSamples,
	onSampleCountChange,
	sampleCountLimit,
	sampleCount,
}: {
	blindMode: boolean;
	canGenerate: boolean;
	harnessFilter: HarnessFilter;
	isAutoEvaluating: boolean;
	isGenerating: boolean;
	isLoadingReplayContext: boolean;
	isRefreshingSamples: boolean;
	onBlindModeChange: (checked: boolean) => void;
	onGenerateAll: () => void;
	onHarnessFilterChange: (value: HarnessFilter) => void;
	onRefreshSamples: () => void;
	onSampleCountChange: (sampleCount: number) => void;
	sampleCountLimit: number;
	sampleCount: number;
}) => (
	<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 className="font-semibold text-2xl text-solarized-base00">AI-Modell-Vergleich</h1>
			<p className="text-sm text-solarized-base01">
				{sampleCount}/{sampleCountLimit} zufällige Usage Events
			</p>
		</div>
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-2 rounded-md border border-solarized-base2 bg-solarized-base3 px-3 py-2">
				<Label htmlFor="harness-filter" className="text-sm">
					Vorlagentyp
				</Label>
				<Select
					value={harnessFilter}
					onValueChange={(value) => onHarnessFilterChange(value as HarnessFilter)}
					disabled={isGenerating || isAutoEvaluating}
				>
					<SelectTrigger id="harness-filter" className="h-8 w-48 bg-background">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_HARNESSES}>Alle</SelectItem>
						{HARNESS_FILTER_OPTIONS.map((option) => (
							<SelectItem key={option.id} value={option.id}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-2 rounded-md border border-solarized-base2 bg-solarized-base3 px-3 py-2">
				<Label htmlFor="sample-count" className="text-sm">
					Stichprobe
				</Label>
				<Select
					value={String(sampleCountLimit)}
					onValueChange={(value) => onSampleCountChange(Number(value))}
					disabled={isGenerating || isAutoEvaluating}
				>
					<SelectTrigger id="sample-count" className="h-8 w-24 bg-background">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SAMPLE_COUNT_OPTIONS.map((option) => (
							<SelectItem key={option} value={String(option)}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-2 rounded-md border border-solarized-base2 bg-solarized-base3 px-3 py-2">
				<EyeOff className="h-4 w-4 text-solarized-base01" />
				<Label htmlFor="blind-mode" className="text-sm">
					Blind
				</Label>
				<Switch
					id="blind-mode"
					checked={blindMode}
					onCheckedChange={onBlindModeChange}
					disabled={isGenerating || isAutoEvaluating}
				/>
			</div>
			<Button
				type="button"
				variant="outline"
				className="gap-2"
				onClick={onRefreshSamples}
				disabled={isRefreshingSamples || isGenerating || isAutoEvaluating}
			>
				<RefreshCcw className={cn("h-4 w-4", isRefreshingSamples && "animate-spin")} />
				Neue Stichprobe
			</Button>
			<Button
				type="button"
				className="gap-2"
				onClick={onGenerateAll}
				disabled={!canGenerate || isGenerating || isLoadingReplayContext || isAutoEvaluating}
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
	const [harnessFilter, setHarnessFilter] = useState<HarnessFilter>(ALL_HARNESSES);
	const [templateOverrideIdA, setTemplateOverrideIdA] = useState<string | null>(null);
	const [templateOverrideIdB, setTemplateOverrideIdB] = useState<string | null>(null);
	const [displayOrder, setDisplayOrder] = useState<Record<string, ComparisonSide[]>>({});
	const [isAutoEvaluating, setIsAutoEvaluating] = useState(false);
	const [generatingSide, setGeneratingSide] = useState<ComparisonSide | "all" | null>(null);
	const [preferences, setPreferences] = useState<ComparisonPreferences>({});
	const [results, setResults] = useState<ComparisonResults>({});
	const [sampleCountLimit, setSampleCountLimit] = useState(DEFAULT_SAMPLE_COUNT);
	const [sampledIds, setSampledIds] = useState<string[]>([]);
	const [summary, setSummary] = useState<ComparisonSummary | null>(null);

	const modelsQuery = useQuery(orpc.admin.models.list.queryOptions());
	const templatesQuery = useQuery(orpc.admin.templates.list.queryOptions());
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
				.slice(0, sampleCountLimit),
		[sampleCountLimit, usageDetailQueries.data],
	);
	const templateOptions = useMemo<TemplateOption[]>(
		() =>
			(templatesQuery.data ?? []).map((item) => ({
				category: item.category,
				id: item.id,
				title: item.title,
			})),
		[templatesQuery.data],
	);
	const templateIds = useMemo(
		() => [
			...new Set(
				[
					...samples.map((sample) => sample.templateId),
					templateOverrideIdA,
					templateOverrideIdB,
				].filter((templateId): templateId is string => typeof templateId === "string"),
			),
		],
		[samples, templateOverrideIdA, templateOverrideIdB],
	);
	const templateDetailQueries = useQueries({
		queries: templateIds.map((id) =>
			orpc.admin.templates.get.queryOptions({
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
	const isGenerating = generatingSide !== null;

	useEffect(() => {
		if (models.length === 0) {
			return;
		}
		setModelAId((current) => current ?? models[0]?.id ?? null);
		setModelBId((current) => current ?? models[1]?.id ?? models[0]?.id ?? null);
	}, [models]);

	useEffect(() => {
		const ids =
			usageListQuery.data?.items
				.filter((item) => usageEventMatchesHarness(item.metadata, harnessFilter))
				.map((item) => item.id) ?? [];
		if (ids.length === 0) {
			setSampledIds([]);
			return;
		}
		setSampledIds(shuffleArray(ids).slice(0, SAMPLE_FETCH_LIMIT));
	}, [harnessFilter, usageListQuery.data]);

	useEffect(() => {
		const sampleIds = sampleIdsKey ? sampleIdsKey.split("|") : [];
		setDisplayOrder(buildDisplayOrder(sampleIds, blindMode));
	}, [blindMode, sampleIdsKey]);

	useEffect(() => {
		setPreferences({});
		setResults({});
		setSummary(null);
	}, [sampleIdsKey]);

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

	const reshuffleDisplayOrder = useCallback(() => {
		setDisplayOrder(
			buildDisplayOrder(
				samples.map((sample) => sample.id),
				blindMode,
			),
		);
	}, [blindMode, samples]);

	const clearSideComparisonState = useCallback(
		(side: ComparisonSide) => {
			setPreferences({});
			setSummary(null);
			reshuffleDisplayOrder();
			setResults((current) => {
				const next: ComparisonResults = {};
				for (const [sampleId, sampleResults] of Object.entries(current)) {
					const nextSampleResults =
						side === "a"
							? ({ b: sampleResults.b } satisfies Partial<
									Record<ComparisonSide, ComparisonRunResult>
								>)
							: ({ a: sampleResults.a } satisfies Partial<
									Record<ComparisonSide, ComparisonRunResult>
								>);
					if (nextSampleResults.a || nextSampleResults.b) {
						next[sampleId] = nextSampleResults;
					}
				}
				return next;
			});
		},
		[reshuffleDisplayOrder],
	);

	const handleRefreshSamples = useCallback(async () => {
		clearComparisonState();
		setSampledIds([]);
		await queryClient.invalidateQueries({ queryKey: usageListQueryOptions.queryKey });
		const refreshed = await usageListQuery.refetch();
		const ids =
			refreshed.data?.items
				.filter((item) => usageEventMatchesHarness(item.metadata, harnessFilter))
				.map((item) => item.id) ?? [];
		setSampledIds(shuffleArray(ids).slice(0, SAMPLE_FETCH_LIMIT));
	}, [
		clearComparisonState,
		harnessFilter,
		queryClient,
		usageListQuery,
		usageListQueryOptions.queryKey,
	]);

	const handleBlindModeChange = useCallback((checked: boolean) => {
		setBlindMode(checked);
	}, []);

	const handleSampleCountChange = useCallback((sampleCount: number) => {
		if (!SAMPLE_COUNT_OPTIONS.some((option) => option === sampleCount)) {
			return;
		}
		setSampleCountLimit(sampleCount);
	}, []);

	const handleSideModelChange = useCallback(
		(side: ComparisonSide, value: string) => {
			const currentValue = side === "a" ? modelAId : modelBId;
			if (currentValue === value) {
				return;
			}
			if (side === "a") {
				setModelAId(value);
			} else {
				setModelBId(value);
			}
			clearSideComparisonState(side);
		},
		[clearSideComparisonState, modelAId, modelBId],
	);

	const handleSideParametersChange = useCallback(
		(side: ComparisonSide, parameters: PlaygroundParameters) => {
			const currentParameters = side === "a" ? parametersA : parametersB;
			if (areParametersEqual(currentParameters, parameters)) {
				return;
			}
			if (side === "a") {
				setParametersA(parameters);
			} else {
				setParametersB(parameters);
			}
			clearSideComparisonState(side);
		},
		[clearSideComparisonState, parametersA, parametersB],
	);

	const handleSideTemplateOverrideChange = useCallback(
		(side: ComparisonSide, value: string | null) => {
			const currentValue = side === "a" ? templateOverrideIdA : templateOverrideIdB;
			if (currentValue === value) {
				return;
			}
			if (side === "a") {
				setTemplateOverrideIdA(value);
			} else {
				setTemplateOverrideIdB(value);
			}
			clearSideComparisonState(side);
		},
		[clearSideComparisonState, templateOverrideIdA, templateOverrideIdB],
	);

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

		setGeneratingSide("all");
		setPreferences({});
		setSummary(null);
		reshuffleDisplayOrder();
		setResults({});
		const triggers = samples.flatMap((sample) => [
			runTriggersRef.current.get(`${sample.id}-a`),
			runTriggersRef.current.get(`${sample.id}-b`),
		]);

		await Promise.allSettled(triggers.map((trigger) => (trigger ? trigger() : Promise.resolve())));
		setGeneratingSide(null);
	}, [isLoadingReplayContext, modelA, modelB, reshuffleDisplayOrder, samples]);

	const handleGenerateSide = useCallback(
		async (side: ComparisonSide) => {
			const model = side === "a" ? modelA : modelB;
			if (!model) {
				toast.error(`Bitte Modell ${side === "a" ? "A" : "B"} auswählen`);
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

			setGeneratingSide(side);
			clearSideComparisonState(side);
			const triggers = samples.map((sample) => runTriggersRef.current.get(`${sample.id}-${side}`));

			await Promise.allSettled(
				triggers.map((trigger) => (trigger ? trigger() : Promise.resolve())),
			);
			setGeneratingSide(null);
		},
		[clearSideComparisonState, isLoadingReplayContext, modelA, modelB, samples],
	);

	const handlePreferenceChange = useCallback((sampleId: string, side: ComparisonSide) => {
		setPreferences((current) => ({
			...current,
			[sampleId]: {
				side,
				source: "human",
			},
		}));
		setSummary(null);
	}, []);

	const allSamplesHaveRuns = samples.every(
		(sample) =>
			results[sample.id]?.a?.status === "success" && results[sample.id]?.b?.status === "success",
	);
	const selectedCount = samples.filter((sample) => preferences[sample.id]).length;
	const canCompare =
		samples.length > 0 &&
		allSamplesHaveRuns &&
		selectedCount === samples.length &&
		!isGenerating &&
		!isAutoEvaluating;
	const canAutoEvaluate =
		samples.length > 0 &&
		allSamplesHaveRuns &&
		!isGenerating &&
		!isAutoEvaluating &&
		!isLoadingReplayContext;

	const handleAutoEvaluate = useCallback(async () => {
		if (samples.length === 0) {
			toast.error("Keine wiederverwendbaren Usage Events gefunden");
			return;
		}
		if (!allSamplesHaveRuns) {
			toast.error("Bitte zuerst alle Antworten generieren");
			return;
		}
		if (isLoadingReplayContext) {
			toast.error("Replay-Kontext wird noch geladen");
			return;
		}

		setIsAutoEvaluating(true);
		setSummary(null);

		try {
			const evaluationResults = await Promise.allSettled(
				samples.map(async (sample) => {
					const responseA = results[sample.id]?.a?.text?.trim();
					const responseB = results[sample.id]?.b?.text?.trim();
					if (!responseA || !responseB) {
						throw new Error(`Antworten fuer ${sample.id} fehlen`);
					}

					const templateReference = sample.templateId
						? templateReferenceById.get(sample.templateId)
						: undefined;
					if (sample.templateId && !templateReference) {
						throw new Error(`Vorlage fuer ${sample.id} konnte nicht geladen werden`);
					}

					const evaluation = await orpc.admin.scribe.evaluateComparison.call({
						documentType: sample.documentType,
						inputs: buildEvaluationInputs(sample, templateReference),
						responses: {
							a: responseA,
							b: responseB,
						},
					});

					return {
						note: evaluation.note,
						preferredResponse: evaluation.preferredResponse,
						sampleId: sample.id,
					};
				}),
			);

			const nextPreferences: ComparisonPreferences = {};
			let failedCount = 0;
			for (const result of evaluationResults) {
				if (result.status === "fulfilled") {
					nextPreferences[result.value.sampleId] = {
						note: result.value.note,
						side: result.value.preferredResponse,
						source: "ai",
					};
				} else {
					failedCount += 1;
				}
			}

			if (Object.keys(nextPreferences).length > 0) {
				setPreferences((current) => ({
					...current,
					...nextPreferences,
				}));
			}

			if (failedCount > 0) {
				toast.error(
					`Automatische Bewertung teilweise fehlgeschlagen (${failedCount}/${samples.length})`,
				);
				return;
			}

			toast.success("Automatische Bewertung abgeschlossen");
		} finally {
			setIsAutoEvaluating(false);
		}
	}, [allSamplesHaveRuns, isLoadingReplayContext, results, samples, templateReferenceById]);

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
					harnessFilter={harnessFilter}
					isAutoEvaluating={isAutoEvaluating}
					isGenerating={isGenerating}
					isLoadingReplayContext={isLoadingReplayContext}
					isRefreshingSamples={usageListQuery.isFetching}
					onBlindModeChange={handleBlindModeChange}
					onGenerateAll={handleGenerateAll}
					onHarnessFilterChange={setHarnessFilter}
					onRefreshSamples={handleRefreshSamples}
					onSampleCountChange={handleSampleCountChange}
					sampleCount={samples.length}
					sampleCountLimit={sampleCountLimit}
				/>

				<div className="grid gap-4 lg:grid-cols-2">
					<ModelConfigCard
						disabled={isGenerating}
						isGeneratingSide={generatingSide === "a"}
						isLoading={modelsQuery.isLoading}
						isLoadingTemplates={templatesQuery.isLoading}
						model={modelA}
						modelId={modelAId}
						modelSelectorOptions={modelSelectorOptions}
						onModelChange={(value) => handleSideModelChange("a", value)}
						onParametersChange={(parameters) => handleSideParametersChange("a", parameters)}
						onRegenerateSide={() => handleGenerateSide("a")}
						onTemplateOverrideChange={(value) => handleSideTemplateOverrideChange("a", value)}
						parameters={parametersA}
						side="a"
						templateOptions={templateOptions}
						templateOverrideId={templateOverrideIdA}
					/>
					<ModelConfigCard
						disabled={isGenerating}
						isGeneratingSide={generatingSide === "b"}
						isLoading={modelsQuery.isLoading}
						isLoadingTemplates={templatesQuery.isLoading}
						model={modelB}
						modelId={modelBId}
						modelSelectorOptions={modelSelectorOptions}
						onModelChange={(value) => handleSideModelChange("b", value)}
						onParametersChange={(parameters) => handleSideParametersChange("b", parameters)}
						onRegenerateSide={() => handleGenerateSide("b")}
						onTemplateOverrideChange={(value) => handleSideTemplateOverrideChange("b", value)}
						parameters={parametersB}
						side="b"
						templateOptions={templateOptions}
						templateOverrideId={templateOverrideIdB}
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
					templateOverrideIdA={templateOverrideIdA}
					templateOverrideIdB={templateOverrideIdB}
					templateReferenceById={templateReferenceById}
				/>

				<ComparisonFooter
					canAutoEvaluate={canAutoEvaluate}
					canCompare={canCompare}
					isAutoEvaluating={isAutoEvaluating}
					onAutoEvaluate={handleAutoEvaluate}
					onCompare={handleCompare}
					sampleCount={samples.length}
					selectedCount={selectedCount}
				/>

				<ComparisonSummaryCard summary={summary} />
			</div>
		</div>
	);
};
