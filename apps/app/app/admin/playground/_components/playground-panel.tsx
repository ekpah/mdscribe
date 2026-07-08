"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from "@repo/design-system/components/ui/model-selector";
import type { ModelSelectorOption } from "@repo/design-system/components/ui/model-selector";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Copy, Info, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MutableRefObject } from "react";
import { toast } from "sonner";

import { useInputContextState } from "@/app/_components/input-context/input-context-controls";
import type { InputContextSubmission } from "@/app/_components/input-context/types";
import { TemplateSelector } from "@/app/_components/template-selector";
import { allScribeDocTypes, scribeDocTypeUi } from "@/app/admin/playground/_lib/scribe-doc-types";
import type { PlaygroundDocumentType } from "@/app/admin/playground/_lib/scribe-doc-types";
import { resolvePlaygroundComparisonReference } from "@/app/admin/playground/_lib/comparison-reference";
import type { PlaygroundComparisonReference } from "@/app/admin/playground/_lib/comparison-reference";
import type {
	PlaygroundModel,
	PlaygroundParameters,
	PlaygroundResult,
} from "@/app/admin/playground/_lib/types";
import { AiscribeTemplateInputSection } from "@/app/aiscribe/_components/aiscribe-template-input-section";
import { orpc } from "@/lib/orpc";
import { buildSelectedTemplateReference } from "@/orpc/scribe/context/template/compose";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import type { DocumentType } from "@/orpc/scribe/types";

import { ParameterControls } from "./parameter-controls";
import { ResultDisplay } from "./result-display";

interface PlaygroundPanelProps {
	models: PlaygroundModel[];
	topModelIds?: string[];
	isLoadingModels?: boolean;
	// Optional preset values from admin usage
	presetModel?: string;
	presetParameters?: Partial<PlaygroundParameters>;
	presetDocumentType?: DocumentType;
	presetPromptName?: string;
	presetTemplateId?: string | null;
	presetVariables?: Record<string, unknown>;
	referenceResult?: PlaygroundResult | null;
}

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

/**
 * Reverse mapping from stored usage input back to form field names.
 * Normalization happens centrally now; we keep these mappings for UI hydration.
 */
const parseVariablesToFormFields = (
	documentType: DocumentType,
	variables: Record<string, unknown>,
): { main: string; additional: Record<string, string> } => {
	const v = variables as Record<string, unknown>;

	const pickString = (...keys: string[]): string => {
		for (const key of keys) {
			const value = v[key];
			if (typeof value === "string" && value.trim().length > 0) {
				return value;
			}
		}
		return "";
	};

	const result: { main: string; additional: Record<string, string> } = {
		additional: {},
		main: "",
	};

	switch (documentType) {
		case "discharge":
		case "outpatient": {
			result.main = pickString("notes", "dischargeNotes", "consultationNotes");
			result.additional = {
				anamnese: pickString("anamnese"),
				befunde: pickString("befunde"),
				diagnoseblock: pickString("diagnoseblock", "vordiagnosen"),
			};
			break;
		}

		case "procedures": {
			result.main = pickString("notes", "procedureNotes");
			break;
		}

		case "anamnese": {
			result.main = pickString("notes");
			result.additional = {
				befunde: pickString("befunde"),
				diagnoseblock: pickString("diagnoseblock", "vordiagnosen"),
			};
			break;
		}

		case "diagnosis":
		case "icu-transfer": {
			result.main = pickString("notes");
			result.additional = {
				anamnese: pickString("anamnese"),
				befunde: pickString("befunde"),
				diagnoseblock: pickString("diagnoseblock", "vordiagnosen"),
			};
			break;
		}

		case "befunde": {
			result.main = pickString("notes");
			result.additional = {
				anamnese: pickString("anamnese"),
				diagnoseblock: pickString("diagnoseblock", "vordiagnosen"),
			};
			break;
		}

		default: {
			result.main = pickString("notes", "dischargeNotes", "procedureNotes");
		}
	}

	return result;
};

const isPlaygroundDocumentType = (
	documentType: DocumentType,
): documentType is PlaygroundDocumentType => documentType in scribeDocTypeUi;

interface ModelRunConfig {
	id: string;
	model: PlaygroundModel | null;
	parameters: PlaygroundParameters;
}

interface RunState {
	text: string;
	isStreaming: boolean;
	error?: string;
	comparison?: PlaygroundResult["comparison"];
	metrics: {
		latencyMs: number;
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
		reasoningTokens?: number;
		cost?: number;
	};
	reasoning?: string;
	requestId?: string;
}

interface PromptVersion {
	id: string;
	label: string;
	messages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	promptName: string;
}

interface PlaygroundModelSelectorOption extends ModelSelectorOption {
	model: PlaygroundModel;
	isTop: boolean;
	providerLabel: string;
}

interface DirtySelectorLabelProps {
	info?: string;
	isDirty: boolean;
	label: string;
}

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

const getProviderFromModelId = (modelId: string): string => modelId.split("/")[0] || "other";

const getProviderGroup = (model: PlaygroundModel): string =>
	model.providerName ??
	model.providerProtocol ??
	model.connectionProtocol ??
	getProviderFromModelId(model.modelId);

const PLAYGROUND_EDITOR_TEXTAREA_CLASS = "font-mono text-xs leading-[1.35]";
const TEMPLATE_SELECTOR_INFO =
	"Das Template gibt Stil, Format und Zielstruktur des erzeugten Textes vor. Eigene und favorisierte Templates können ebenfalls ausgewählt werden.";

const DirtySelectorLabel = ({ info, isDirty, label }: DirtySelectorLabelProps) => (
	<div className="flex min-h-7 flex-col justify-start sm:w-24 sm:shrink-0">
		<div className="flex items-center gap-1.5">
			<Label className="text-sm leading-4 text-solarized-base01">{label}</Label>
			{info ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							aria-label={info}
							className="inline-flex h-4 w-4 items-center justify-center rounded-full text-solarized-base01 transition-colors hover:text-solarized-base00"
							type="button"
						>
							<Info className="h-3.5 w-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent className="max-w-64 text-xs leading-relaxed">{info}</TooltipContent>
				</Tooltip>
			) : null}
		</div>
		<span
			className={cn(
				"h-3 text-[9px] leading-3 transition-opacity",
				isDirty ? "text-solarized-orange opacity-100" : "text-solarized-base01/60 opacity-0",
			)}
		>
			Geändert
		</span>
	</div>
);

type PlaygroundView = "config" | "inputs" | "models" | "results";
type PromptVariableSource = "input" | "runtime";

interface PromptPreviewVariable {
	key: string;
	label: string;
	source: PromptVariableSource;
	value: string;
}

const PLAYGROUND_VIEW_META: Record<PlaygroundView, { description: string; label: string }> = {
	config: {
		description: "Prompt, Template und kompilierte Nachrichten",
		label: "Prompt",
	},
	inputs: {
		description: "Quelltexte, Zusatzfelder und Spracheingabe",
		label: "Inputs",
	},
	models: {
		description: "Modelle und Parameter für Vergleichsruns",
		label: "Models",
	},
	results: {
		description: "Alle Modellantworten und Streaming-Ausgaben",
		label: "Results",
	},
};

const NONE_TEMPLATE_VALUE = "__none__";

const resolveDocumentTypeFromPromptHarness = (
	promptHarness: string,
): PlaygroundDocumentType | undefined => {
	const resolvedPromptHarnessId = resolvePromptHarnessId(promptHarness);
	if (!resolvedPromptHarnessId || !(resolvedPromptHarnessId in scribeDocTypeUi)) {
		return undefined;
	}

	return resolvedPromptHarnessId;
};

// Builds the promptJson payload from the shared form inputs for a given document
// type's field mapping. Shared by Prompt A and Prompt B so each side can map the
// same inputs onto its own (possibly different) document type.
const buildPlaygroundPromptJson = (
	docUi: (typeof scribeDocTypeUi)[PlaygroundDocumentType],
	formMain: string,
	formAdditional: Record<string, string>,
	templateReference: string,
): string => {
	const data: Record<string, unknown> = {
		[docUi.mainField.name]: formMain,
	};
	for (const field of docUi.additionalFields) {
		const value = formAdditional[field.name];
		if (value !== undefined) {
			data[field.name] = value;
		}
	}
	if (templateReference.length > 0) {
		data.relevantTemplate = templateReference;
	}
	return JSON.stringify(data);
};

const asFiniteMetricNumber = (value: unknown): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
};

const parseRunMetricsFromMetadata = (metadata: unknown): Partial<RunState["metrics"]> => {
	if (!metadata || typeof metadata !== "object") {
		return {};
	}

	const value = metadata as Record<string, unknown>;
	const parsed: Partial<RunState["metrics"]> = {};

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

	const contentPartsText = getTextFromUnknownParts(candidate.content);
	if (contentPartsText.trim().length > 0) {
		return contentPartsText;
	}

	return "";
};

const serializePromptVariable = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (value === null || value === undefined) {
		return "";
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
};

/**
 * Section-based prompt highlighting: compiled prompts are XML-structured, so the
 * highlight boundaries are the section tags themselves (stable while editing),
 * not exact-value matches that break as soon as the text changes.
 */
type PromptSectionKind = "patient" | "template" | "user" | "shared" | "runtime";

type PromptHighlightSource = PromptSectionKind | "plain";

interface PromptHighlightSegment {
	source: PromptHighlightSource;
	text: string;
}

// Top-level XML tags in compiled messages mapped to their composition origin
// (see orpc/scribe/context/* and prompts/core/*). Unlisted tags belong to the
// prompt family itself and stay unhighlighted as editable instructions.
const PROMPT_SECTION_TAGS: Record<string, PromptSectionKind> = {
	patient_context: "patient",
	template_context: "template",
	uncertainty_handling: "shared",
	user_context: "user",
};

const PROMPT_DATE_LINE_REGEX = /Das heutige Datum ist der [^\n]*/g;

const PROMPT_SECTION_META: Record<
	PromptSectionKind,
	{ badgeClassName: string; highlightClassName: string; label: string }
> = {
	patient: {
		badgeClassName: "border-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue",
		highlightClassName: "rounded-[3px] bg-solarized-blue/12",
		label: "Patient-Kontext",
	},
	runtime: {
		badgeClassName: "border-solarized-orange/40 bg-solarized-orange/10 text-solarized-orange",
		highlightClassName: "rounded-[3px] bg-solarized-orange/15",
		label: "Datum (Laufzeit)",
	},
	shared: {
		badgeClassName:
			"border-(--solarized-violet)/40 bg-(--solarized-violet)/10 text-(--solarized-violet)",
		highlightClassName: "rounded-[3px] bg-(--solarized-violet)/12",
		label: "Geteilter Baustein",
	},
	template: {
		badgeClassName: "border-solarized-green/40 bg-solarized-green/10 text-solarized-green",
		highlightClassName: "rounded-[3px] bg-solarized-green/12",
		label: "Template-Kontext",
	},
	user: {
		badgeClassName: "border-(--solarized-cyan)/40 bg-(--solarized-cyan)/10 text-(--solarized-cyan)",
		highlightClassName: "rounded-[3px] bg-(--solarized-cyan)/12",
		label: "Arzt-Kontext",
	},
};

const getSegmentHighlightClassName = (source: PromptHighlightSegment["source"]): string =>
	source === "plain" ? "" : PROMPT_SECTION_META[source].highlightClassName;

const getPromptMessageRoleBadgeClassName = (role: "system" | "user" | "assistant"): string => {
	if (role === "system") {
		return "border-solarized-blue/40 bg-solarized-blue/12 text-solarized-blue";
	}
	if (role === "user") {
		return "border-solarized-green/40 bg-solarized-green/12 text-solarized-green";
	}
	return "border-solarized-base01/35 bg-solarized-base01/10 text-solarized-base00";
};

const arePromptMessagesEqual = (
	left: { role: "system" | "user" | "assistant"; content: string }[],
	right: { role: "system" | "user" | "assistant"; content: string }[],
): boolean => {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		const leftMessage = left[index];
		const rightMessage = right[index];
		if (!leftMessage || !rightMessage) {
			return false;
		}
		if (leftMessage.role !== rightMessage.role || leftMessage.content !== rightMessage.content) {
			return false;
		}
	}
	return true;
};

const applyHarnessPlaceholders = (
	content: string,
	placeholderValues: Record<string, string>,
): string => {
	let next = content;
	for (const [placeholder, value] of Object.entries(placeholderValues)) {
		if (!value) {
			continue;
		}
		next = next.split(placeholder).join(value);
	}
	return next;
};

interface PromptSectionRange {
	end: number;
	kind: PromptSectionKind;
	start: number;
}

// A section is only a complete innermost pair: an opening tag followed by its
// closing tag with no further opening of the same tag in between. Unpaired
// inline mentions like "… aus <template_context> und <patient_context> …" in
// instruction text therefore never open a section, and in
// "<template_context><template_context></template_context>" only the last two
// tags form one.
const PROMPT_SECTION_PATTERNS = Object.entries(PROMPT_SECTION_TAGS).map(([tag, kind]) => ({
	kind,
	regex: new RegExp(`<${tag}>(?:(?!<${tag}>)[\\s\\S])*?</${tag}>`, "g"),
}));

const collectPromptSectionRanges = (content: string): PromptSectionRange[] => {
	const ranges: PromptSectionRange[] = [];

	for (const { kind, regex } of PROMPT_SECTION_PATTERNS) {
		for (const match of content.matchAll(regex)) {
			ranges.push({
				end: match.index + match[0].length,
				kind,
				start: match.index,
			});
		}
	}

	for (const match of content.matchAll(PROMPT_DATE_LINE_REGEX)) {
		ranges.push({
			end: match.index + match[0].length,
			kind: "runtime",
			start: match.index,
		});
	}

	return ranges.toSorted((a, b) => a.start - b.start);
};

const buildPromptHighlightSegments = (content: string): PromptHighlightSegment[] => {
	if (content.length === 0) {
		return [{ source: "plain", text: "" }];
	}

	const segments: PromptHighlightSegment[] = [];
	let cursor = 0;
	for (const range of collectPromptSectionRanges(content)) {
		if (range.start < cursor) {
			continue;
		}
		if (range.start > cursor) {
			segments.push({ source: "plain", text: content.slice(cursor, range.start) });
		}
		segments.push({ source: range.kind, text: content.slice(range.start, range.end) });
		cursor = range.end;
	}
	if (cursor < content.length) {
		segments.push({ source: "plain", text: content.slice(cursor) });
	}
	return segments;
};

const getPromptMessageSectionKinds = (content: string): PromptSectionKind[] => {
	const kinds: PromptSectionKind[] = [];
	for (const range of collectPromptSectionRanges(content)) {
		if (!kinds.includes(range.kind)) {
			kinds.push(range.kind);
		}
	}
	return kinds;
};

const HighlightedPromptEditor = ({
	onChange,
	value,
}: {
	onChange: (value: string) => void;
	value: string;
}) => {
	const segments = useMemo(() => buildPromptHighlightSegments(value), [value]);

	const handleValueChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onChange(event.target.value);
		},
		[onChange],
	);

	// CSS-only autosize (`field-sizing: content` lacks Safari/Firefox support):
	// the highlight mirror is the in-flow element and sizes the container; the
	// textarea is stretched over it. Both render the identical string with
	// identical box metrics (transparent border mirrors the textarea border),
	// so their heights always match and the textarea never needs to scroll.
	return (
		<div className="relative">
			<div
				aria-hidden
				className={cn(
					"pointer-events-none min-h-32 whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 text-solarized-base00",
					PLAYGROUND_EDITOR_TEXTAREA_CLASS,
				)}
			>
				{segments.map((segment, index) => (
					<span
						className={cn(getSegmentHighlightClassName(segment.source))}
						// biome-ignore lint/suspicious/noArrayIndexKey: segments are derived positional slices without stable ids
						key={`${segment.source}-${index}`}
					>
						{segment.text}
					</span>
				))}
				{/* Keeps a trailing newline visible so the mirror matches the textarea height. */}
				{"\u200B"}
			</div>
			{/* The textarea paints above the mirror so caret and selection stay visible; the text itself is transparent, so the caret needs an explicit color (theme-aware via the solarized neutral swap). */}
			<textarea
				value={value}
				onChange={handleValueChange}
				spellCheck={false}
				className={cn(
					"border-input placeholder:text-solarized-base01/70 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive absolute inset-0 block h-full w-full resize-none overflow-hidden break-words rounded-md border border-solarized-base2 bg-transparent px-3 py-2 text-transparent caret-(--solarized-base00) shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
					PLAYGROUND_EDITOR_TEXTAREA_CLASS,
				)}
			/>
		</div>
	);
};

const PromptHarnessPreview = ({
	messages,
	onMessageChange,
}: {
	messages: { role: "system" | "user" | "assistant"; content: string }[];
	onMessageChange: (index: number, content: string) => void;
}) => {
	const copyMessageHandlers = useMemo(
		() =>
			messages.map((message) => async () => {
				await navigator.clipboard.writeText(message.content);
				toast.success("Kopiert!");
			}),
		[messages],
	);

	const messageChangeHandlers = useMemo(
		() => messages.map((_, index) => (content: string) => onMessageChange(index, content)),
		[messages, onMessageChange],
	);

	if (messages.length === 0) {
		return (
			<div className="flex min-h-24 items-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/50 p-4 text-sm text-solarized-base01">
				Kompiliere den Prompt, um Harness, dynamische Inserts und gerenderte Nachrichten zu sehen.
			</div>
		);
	}

	return (
		<div className="flex flex-col rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-3">
			<div className="flex flex-col gap-2">
				{messages.map((message, index) => {
					const copyMessageHandler = copyMessageHandlers[index];
					const messageChangeHandler = messageChangeHandlers[index];
					if (!copyMessageHandler || !messageChangeHandler) {
						return null;
					}

					const sectionKinds = getPromptMessageSectionKinds(message.content);

					return (
						<div
							className="flex flex-col rounded-lg border border-solarized-base2 bg-solarized-base3 p-2"
							key={`${message.role}-${index}`}
						>
							<div className="flex flex-wrap items-center justify-between gap-1.5">
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className={cn(
											"font-mono text-[11px] uppercase",
											getPromptMessageRoleBadgeClassName(message.role),
										)}
									>
										{message.role}
									</Badge>
								</div>
								<div className="flex items-center gap-1.5">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 gap-1.5 text-solarized-base01 hover:text-solarized-base00"
										onClick={copyMessageHandler}
									>
										<Copy className="h-3.5 w-3.5" />
										Copy
									</Button>
								</div>
							</div>

							{sectionKinds.length > 0 ? (
								<div className="mt-1 flex flex-wrap gap-1.5">
									{sectionKinds.map((kind) => (
										<Badge
											key={`${message.role}-${index}-${kind}`}
											variant="outline"
											className={cn("text-[10px]", PROMPT_SECTION_META[kind].badgeClassName)}
										>
											{PROMPT_SECTION_META[kind].label}
										</Badge>
									))}
								</div>
							) : null}

							<div className="mt-2">
								<HighlightedPromptEditor
									value={message.content}
									onChange={messageChangeHandler}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export const PlaygroundPanel = ({
	models,
	topModelIds,
	isLoadingModels,
	presetModel,
	presetParameters,
	presetDocumentType,
	presetPromptName,
	presetTemplateId,
	presetVariables,
	referenceResult,
}: PlaygroundPanelProps) => {
	const [activeView, setActiveView] = useState<PlaygroundView>("config");
	const inputContextController = useInputContextState();
	const mainTextareaRef = useRef<HTMLTextAreaElement>(null);

	const resolvedPresetDocumentType = presetDocumentType ?? "discharge";
	const initialDocType: PlaygroundDocumentType = isPlaygroundDocumentType(
		resolvedPresetDocumentType,
	)
		? resolvedPresetDocumentType
		: "discharge";
	const [documentType, setDocumentType] = useState<PlaygroundDocumentType>(initialDocType);

	// Parse preset variables from usage event into form fields
	const parsedPreset = useMemo(() => {
		if (!presetVariables || Object.keys(presetVariables).length === 0) {
			return null;
		}
		return parseVariablesToFormFields(initialDocType, presetVariables);
	}, [presetVariables, initialDocType]);

	// Form input state (used to build promptJson)
	const docUi = scribeDocTypeUi[documentType];
	const [formMain, setFormMain] = useState(parsedPreset?.main ?? "");
	const [formAdditional, setFormAdditional] = useState<Record<string, string>>(
		parsedPreset?.additional ?? {},
	);
	const hasAppliedPresetDocTypeRef = useRef(false);
	const hasAppliedPresetFieldsRef = useRef(false);
	const hasAppliedPresetPromptNameRef = useRef(false);
	const hasAppliedPresetTemplateRef = useRef(false);

	// Apply async preset document type once (usage -> playground jump-off).
	useEffect(() => {
		if (hasAppliedPresetDocTypeRef.current) {
			return;
		}
		if (!presetDocumentType) {
			return;
		}
		if (!isPlaygroundDocumentType(presetDocumentType)) {
			return;
		}

		setDocumentType(presetDocumentType);
		hasAppliedPresetDocTypeRef.current = true;
	}, [presetDocumentType]);

	// Apply async preset variables once (usage -> playground jump-off).
	useEffect(() => {
		if (hasAppliedPresetFieldsRef.current) {
			return;
		}
		if (!parsedPreset) {
			return;
		}

		setFormMain(parsedPreset.main);
		setFormAdditional(parsedPreset.additional);
		hasAppliedPresetFieldsRef.current = true;
	}, [parsedPreset]);

	const promptHarnessQueryOptions = orpc.admin.scribe.prompts.list.queryOptions({
		input: { limit: 200 },
	});
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();
	const { data: promptHarnessesData } = useQuery(promptHarnessQueryOptions);
	const { data: templateOptions = [] } = useQuery(templatesQueryOptions);

	// Prompt selection / compilation
	const initialPromptName =
		resolvePromptHarnessId(presetPromptName) ?? presetPromptName ?? docUi.defaultPromptName;
	const [promptName, setPromptName] = useState<string>(initialPromptName);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
		presetTemplateId ?? NONE_TEMPLATE_VALUE,
	);
	const [promptHarnessDraftMessages, setPromptHarnessDraftMessages] = useState<
		{ role: "system" | "user" | "assistant"; content: string }[]
	>([]);
	const [templateDraftContent, setTemplateDraftContent] = useState("");
	const [templateDraftExamples, setTemplateDraftExamples] = useState<string[]>([]);
	const [compiledMessages, setCompiledMessages] = useState<
		{ role: "system" | "user" | "assistant"; content: string }[]
	>([]);
	const [compiledOverride, setCompiledOverride] = useState<
		| {
				role: "system" | "user" | "assistant";
				content: string;
		  }[]
		| null
	>(null);
	const [promptRuntimeVariables, setPromptRuntimeVariables] = useState<Record<string, unknown>>({});
	const compileRequestRef = useRef(0);
	const loadedPromptHarnessNameRef = useRef<string | null>(null);
	const loadedTemplateIdRef = useRef<string | null>(null);

	// Prompt B is an independent comparison version with its own base-prompt and
	// template selection. It reuses the shared inputs but compiles separately so
	// different prompt/template combinations can be tested side by side.
	const [isComparisonEnabled, setIsComparisonEnabled] = useState(false);
	const [promptNameB, setPromptNameB] = useState<string>(initialPromptName);
	const [selectedTemplateIdB, setSelectedTemplateIdB] = useState<string>(NONE_TEMPLATE_VALUE);
	const [compiledMessagesB, setCompiledMessagesB] = useState<
		{ role: "system" | "user" | "assistant"; content: string }[]
	>([]);
	const [compiledOverrideB, setCompiledOverrideB] = useState<
		{ role: "system" | "user" | "assistant"; content: string }[] | null
	>(null);
	const compileRequestRefB = useRef(0);

	useEffect(() => {
		if (hasAppliedPresetPromptNameRef.current || !presetPromptName) {
			return;
		}

		setPromptName(resolvePromptHarnessId(presetPromptName) ?? presetPromptName);
		hasAppliedPresetPromptNameRef.current = true;
	}, [presetPromptName]);

	useEffect(() => {
		if (hasAppliedPresetTemplateRef.current || !presetTemplateId) {
			return;
		}

		setSelectedTemplateId(presetTemplateId);
		hasAppliedPresetTemplateRef.current = true;
	}, [presetTemplateId]);

	const promptHarnessOptions = useMemo(() => {
		const fetchedOptions = promptHarnessesData?.options ?? [];
		if (fetchedOptions.length > 0) {
			return fetchedOptions;
		}
		return allScribeDocTypes.map((docType) => ({
			id: scribeDocTypeUi[docType].defaultPromptName,
			label: scribeDocTypeUi[docType].label,
		}));
	}, [promptHarnessesData?.options]);

	const promptHarnessOptionIds = useMemo(
		() => promptHarnessOptions.map((option) => option.id),
		[promptHarnessOptions],
	);

	const promptHarnessDetailsQueryOptions = orpc.admin.scribe.prompts.get.queryOptions({
		input: { name: promptName },
	});
	const { data: selectedPromptHarnessDetails } = useQuery({
		...promptHarnessDetailsQueryOptions,
		enabled: promptName.trim().length > 0,
	});

	const templateDetailsQueryOptions = orpc.templates.get.queryOptions({
		input: {
			id: selectedTemplateId === NONE_TEMPLATE_VALUE ? "" : selectedTemplateId,
		},
	});
	const { data: selectedTemplateDetails, isFetching: isFetchingSelectedTemplate } = useQuery({
		...templateDetailsQueryOptions,
		enabled: selectedTemplateId !== NONE_TEMPLATE_VALUE,
	});

	const promptHarnessBaseMessages = useMemo(
		() =>
			(selectedPromptHarnessDetails?.messages ?? []).map((message) => ({
				content: serializePromptVariable(message.content),
				role: message.role,
			})),
		[selectedPromptHarnessDetails?.messages],
	);

	useEffect(() => {
		const currentPromptName = selectedPromptHarnessDetails?.name ?? null;
		if (currentPromptName === null) {
			if (loadedPromptHarnessNameRef.current !== null) {
				setPromptHarnessDraftMessages([]);
				loadedPromptHarnessNameRef.current = null;
			}
			return;
		}

		if (loadedPromptHarnessNameRef.current === currentPromptName) {
			return;
		}

		setPromptHarnessDraftMessages(promptHarnessBaseMessages);
		loadedPromptHarnessNameRef.current = currentPromptName;
	}, [promptHarnessBaseMessages, selectedPromptHarnessDetails?.name]);

	const isPromptHarnessDirty = useMemo(
		() =>
			promptHarnessBaseMessages.length > 0 &&
			!arePromptMessagesEqual(promptHarnessDraftMessages, promptHarnessBaseMessages),
		[promptHarnessDraftMessages, promptHarnessBaseMessages],
	);

	useEffect(() => {
		if (!selectedTemplateDetails) {
			if (loadedTemplateIdRef.current !== null) {
				setTemplateDraftContent("");
				setTemplateDraftExamples([]);
				loadedTemplateIdRef.current = null;
			}
			return;
		}

		const currentTemplateId = selectedTemplateDetails.id;
		if (loadedTemplateIdRef.current === currentTemplateId) {
			return;
		}

		setTemplateDraftContent(selectedTemplateDetails.content);
		setTemplateDraftExamples(selectedTemplateDetails.examples ?? []);
		loadedTemplateIdRef.current = currentTemplateId;
	}, [selectedTemplateDetails?.id, selectedTemplateDetails]);

	const isTemplateDirty = useMemo(() => {
		if (!selectedTemplateDetails) {
			return false;
		}
		if (templateDraftContent !== selectedTemplateDetails.content) {
			return true;
		}
		const baseExamples = selectedTemplateDetails.examples ?? [];
		if (templateDraftExamples.length !== baseExamples.length) {
			return true;
		}
		for (let index = 0; index < baseExamples.length; index += 1) {
			if (templateDraftExamples[index] !== baseExamples[index]) {
				return true;
			}
		}
		return false;
	}, [selectedTemplateDetails, templateDraftContent, templateDraftExamples]);

	const selectedTemplateReference = useMemo(() => {
		if (!selectedTemplateDetails) {
			return "";
		}

		return buildSelectedTemplateReference({
			content: templateDraftContent,
			examples: templateDraftExamples,
			title: selectedTemplateDetails.title,
		});
	}, [selectedTemplateDetails, templateDraftContent, templateDraftExamples]);

	const promptJson = useMemo(
		() => buildPlaygroundPromptJson(docUi, formMain, formAdditional, selectedTemplateReference),
		[docUi, formMain, formAdditional, selectedTemplateReference],
	);

	const compilePrompt = useCallback(async () => {
		const requestId = compileRequestRef.current + 1;
		compileRequestRef.current = requestId;
		try {
			const res = await orpc.admin.scribe.compilePrompt.call({
				documentType,
				promptJson,
				promptName,
			});

			if (compileRequestRef.current !== requestId) {
				return;
			}

			setCompiledMessages(
				(res.compiledMessages ?? []).map((m) => ({
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					role: m.role,
				})),
			);
			setCompiledOverride(null);
			setPromptRuntimeVariables(
				res.promptVariables ? ({ ...res.promptVariables } as Record<string, unknown>) : {},
			);
		} catch (error) {
			if (compileRequestRef.current !== requestId) {
				return;
			}
			toast.error(error instanceof Error ? error.message : "Fehler beim Kompilieren");
		}
	}, [documentType, promptJson, promptName]);

	useEffect(() => {
		if (
			selectedTemplateId !== NONE_TEMPLATE_VALUE &&
			(isFetchingSelectedTemplate || !selectedTemplateDetails)
		) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			const runCompilePrompt = async () => {
				try {
					await compilePrompt();
				} catch (error) {
					console.error("Error compiling prompt:", error);
				}
			};
			runCompilePrompt();
		}, 250);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [compilePrompt, isFetchingSelectedTemplate, selectedTemplateDetails, selectedTemplateId]);

	// --- Prompt B: independent prompt/template compilation ---
	const documentTypeB = useMemo(
		() => resolveDocumentTypeFromPromptHarness(promptNameB) ?? documentType,
		[documentType, promptNameB],
	);
	const docUiB = scribeDocTypeUi[documentTypeB];

	const templateDetailsBQueryOptions = orpc.templates.get.queryOptions({
		input: {
			id: selectedTemplateIdB === NONE_TEMPLATE_VALUE ? "" : selectedTemplateIdB,
		},
	});
	const { data: selectedTemplateDetailsB, isFetching: isFetchingSelectedTemplateB } = useQuery({
		...templateDetailsBQueryOptions,
		enabled: isComparisonEnabled && selectedTemplateIdB !== NONE_TEMPLATE_VALUE,
	});

	const selectedTemplateReferenceB = useMemo(() => {
		if (!selectedTemplateDetailsB) {
			return "";
		}
		return buildSelectedTemplateReference({
			content: selectedTemplateDetailsB.content,
			examples: selectedTemplateDetailsB.examples ?? [],
			title: selectedTemplateDetailsB.title,
		});
	}, [selectedTemplateDetailsB]);

	const promptJsonB = useMemo(
		() => buildPlaygroundPromptJson(docUiB, formMain, formAdditional, selectedTemplateReferenceB),
		[docUiB, formMain, formAdditional, selectedTemplateReferenceB],
	);

	const compilePromptB = useCallback(async () => {
		const requestId = compileRequestRefB.current + 1;
		compileRequestRefB.current = requestId;
		try {
			const res = await orpc.admin.scribe.compilePrompt.call({
				documentType: documentTypeB,
				promptJson: promptJsonB,
				promptName: promptNameB,
			});

			if (compileRequestRefB.current !== requestId) {
				return;
			}

			setCompiledMessagesB(
				(res.compiledMessages ?? []).map((m) => ({
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					role: m.role,
				})),
			);
			setCompiledOverrideB(null);
		} catch (error) {
			if (compileRequestRefB.current !== requestId) {
				return;
			}
			toast.error(error instanceof Error ? error.message : "Fehler beim Kompilieren (Prompt B)");
		}
	}, [documentTypeB, promptJsonB, promptNameB]);

	useEffect(() => {
		if (!isComparisonEnabled) {
			return;
		}
		if (
			selectedTemplateIdB !== NONE_TEMPLATE_VALUE &&
			(isFetchingSelectedTemplateB || !selectedTemplateDetailsB)
		) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			const runCompilePromptB = async () => {
				try {
					await compilePromptB();
				} catch (error) {
					console.error("Error compiling prompt B:", error);
				}
			};
			runCompilePromptB();
		}, 250);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [
		compilePromptB,
		isComparisonEnabled,
		isFetchingSelectedTemplateB,
		selectedTemplateDetailsB,
		selectedTemplateIdB,
	]);

	const [modelRuns, setModelRuns] = useState<ModelRunConfig[]>(() => [
		{
			id: crypto.randomUUID(),
			model: null,
			parameters: {
				frequencyPenalty: presetParameters?.frequencyPenalty ?? DEFAULT_PARAMETERS.frequencyPenalty,
				maxTokens: presetParameters?.maxTokens ?? DEFAULT_PARAMETERS.maxTokens,
				presencePenalty: presetParameters?.presencePenalty ?? DEFAULT_PARAMETERS.presencePenalty,
				reasoningEffort: presetParameters?.reasoningEffort ?? DEFAULT_PARAMETERS.reasoningEffort,
				temperature: presetParameters?.temperature ?? DEFAULT_PARAMETERS.temperature,
				thinking: presetParameters?.thinking ?? DEFAULT_PARAMETERS.thinking,
				thinkingExplicit: presetParameters?.thinkingExplicit ?? DEFAULT_PARAMETERS.thinkingExplicit,
				topK: presetParameters?.topK ?? DEFAULT_PARAMETERS.topK,
				topP: presetParameters?.topP ?? DEFAULT_PARAMETERS.topP,
			},
		},
	]);

	// Apply preset model when models load (first run config only)
	useEffect(() => {
		if (!presetModel || models.length === 0) {
			return;
		}
		setModelRuns((prev) => {
			const first = prev.at(0);
			if (!first || first.model) {
				return prev;
			}
			const match = models.find((m) => m.id === presetModel || m.modelId === presetModel);
			if (!match) {
				return prev;
			}
			return [
				{
					...first,
					model: match,
					parameters: first.parameters,
				},
				...prev.slice(1),
			];
		});
	}, [presetModel, models]);

	// Keep promptName in sync with document type unless user changed it
	useEffect(() => {
		const resolvedPresetPromptName = resolvePromptHarnessId(presetPromptName) ?? presetPromptName;
		const nextPromptName =
			resolvedPresetPromptName &&
			resolveDocumentTypeFromPromptHarness(resolvedPresetPromptName) === documentType
				? resolvedPresetPromptName
				: scribeDocTypeUi[documentType].defaultPromptName;
		setPromptName(nextPromptName);
		setCompiledMessages([]);
		setCompiledOverride(null);
		setPromptRuntimeVariables({});
	}, [documentType, presetPromptName]);

	const [runStates, setRunStates] = useState<Record<string, RunState>>({});

	const setRunState = useCallback((id: string, patch: Partial<RunState>) => {
		setRunStates((prev) => {
			const base: RunState = prev[id] ?? {
				isStreaming: false,
				metrics: { latencyMs: 0 },
				text: "",
			};

			return {
				...prev,
				[id]: {
					...base,
					...patch,
					metrics: {
						...base.metrics,
						...patch.metrics,
					},
				},
			};
		});
	}, []);

	const clearComparisons = useCallback(() => {
		setRunStates((previous) => {
			const next: Record<string, RunState> = {};
			for (const [runId, runState] of Object.entries(previous)) {
				next[runId] = {
					...runState,
					comparison: undefined,
				};
			}
			return next;
		});
	}, []);

	// Ref to store run trigger functions for each model
	const runTriggersRef = useRef<Map<string, () => Promise<void>>>(new Map());

	const modelById = useMemo(
		() => new Map(models.map((model) => [model.id, model] as const)),
		[models],
	);

	const modelSelectorOptions = useMemo<PlaygroundModelSelectorOption[]>(() => {
		const topModelIdSet = new Set(topModelIds);
		return models.map((model) => {
			const provider = getProviderGroup(model);
			const isTop = topModelIdSet.has(model.modelId);
			const providerLabel =
				PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
			return {
				group: provider,
				isTop,
				keywords: [model.modelId, model.name, provider, providerLabel],
				label: model.name,
				model,
				providerLabel,
				value: model.id,
			};
		});
	}, [models, topModelIds]);

	const formatModelGroupLabel = useCallback(
		(group: string) => PROVIDER_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1),
		[],
	);

	const renderSelectedModelOption = useCallback(
		(selected: PlaygroundModelSelectorOption | null) => {
			if (!selected) {
				return <span className="text-solarized-base01">Modell auswählen...</span>;
			}

			return (
				<div className="min-w-0">
					<p className="truncate font-medium text-solarized-base00">{selected.model.name}</p>
					<p className="truncate text-solarized-base01 text-xs">{selected.providerLabel}</p>
				</div>
			);
		},
		[],
	);

	const renderModelSelectorOption = useCallback(
		(option: PlaygroundModelSelectorOption) => (
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
		),
		[],
	);

	const inputPreviewItems = useMemo<PromptPreviewVariable[]>(
		() => [
			{
				key: docUi.mainField.name,
				label: docUi.mainField.label,
				source: "input",
				value: formMain,
			},
			...docUi.additionalFields.map((field) => ({
				key: field.name,
				label: field.label,
				source: "input" as const,
				value: formAdditional[field.name] ?? "",
			})),
		],
		[docUi, formAdditional, formMain],
	);

	const harnessPlaceholderValues = useMemo(
		() => ({
			"<patient_context></patient_context>": serializePromptVariable(
				promptRuntimeVariables.contextXml,
			),
			"[Anamnese]": formAdditional.anamnese ?? "",
			"[Befunde]": formAdditional.befunde ?? "",
			"[Diagnoseblock]": formAdditional.diagnoseblock ?? "",
			"[Notizen]": formMain,
			"[Relevante Vorlage]": selectedTemplateReference,
		}),
		[
			formAdditional.anamnese,
			formAdditional.befunde,
			formAdditional.diagnoseblock,
			formMain,
			promptRuntimeVariables.contextXml,
			selectedTemplateReference,
		],
	);

	const promptHarnessExperimentMessages = useMemo(() => {
		if (!isPromptHarnessDirty || promptHarnessDraftMessages.length === 0) {
			return null;
		}
		return promptHarnessDraftMessages.map((message) => ({
			...message,
			content: applyHarnessPlaceholders(message.content, harnessPlaceholderValues),
		}));
	}, [harnessPlaceholderValues, isPromptHarnessDirty, promptHarnessDraftMessages]);

	const effectiveCompiledMessages = useMemo(
		() => compiledOverride ?? promptHarnessExperimentMessages ?? compiledMessages,
		[compiledMessages, compiledOverride, promptHarnessExperimentMessages],
	);

	const promptComparisonMessages = useMemo(
		() => (isComparisonEnabled ? (compiledOverrideB ?? compiledMessagesB) : null),
		[compiledMessagesB, compiledOverrideB, isComparisonEnabled],
	);

	const promptVersions = useMemo<PromptVersion[]>(() => {
		const versions: PromptVersion[] = [
			{
				id: "prompt-a",
				label: "Prompt A",
				messages: effectiveCompiledMessages,
				promptName,
			},
		];
		if (promptComparisonMessages) {
			versions.push({
				id: "prompt-b",
				label: "Prompt B",
				messages: promptComparisonMessages,
				promptName: promptNameB,
			});
		}
		return versions;
	}, [effectiveCompiledMessages, promptComparisonMessages, promptName, promptNameB]);

	const comparisonRuns = useMemo(
		() =>
			modelRuns.flatMap((modelRun) =>
				promptVersions.map((promptVersion) => ({
					id: `${modelRun.id}::${promptVersion.id}`,
					modelRun,
					promptVersion,
				})),
			),
		[modelRuns, promptVersions],
	);

	const comparisonReference = useMemo(() => {
		const firstRun = comparisonRuns.at(0);
		return resolvePlaygroundComparisonReference({
			firstResult: firstRun
				? {
						id: firstRun.id,
						isStreaming: runStates[firstRun.id]?.isStreaming ?? false,
						text: runStates[firstRun.id]?.text ?? "",
					}
				: undefined,
			usageEventResponse: referenceResult?.text,
		});
	}, [comparisonRuns, referenceResult?.text, runStates]);

	const resultsWithContentCount = useMemo(
		() =>
			Object.values(runStates).filter(
				(runState) =>
					runState.error ||
					runState.isStreaming ||
					runState.reasoning ||
					runState.text.trim().length > 0,
			).length,
		[runStates],
	);
	const totalResultsCount = resultsWithContentCount + (referenceResult ? 1 : 0);

	const navigationItems = useMemo(
		() =>
			[
				{
					summary:
						selectedTemplateId === NONE_TEMPLATE_VALUE ? promptName : `${promptName} · Template`,
					view: "config",
				},
				{
					summary: `${inputPreviewItems.length} Felder aktiv`,
					view: "inputs",
				},
				{
					summary: `${modelRuns.length} Modelle · ${promptVersions.length} Prompt-Versionen`,
					view: "models",
				},
				{
					summary:
						totalResultsCount > 0
							? `${totalResultsCount}/${comparisonRuns.length + (referenceResult ? 1 : 0)} mit Output`
							: "Noch keine Ergebnisse",
					view: "results",
				},
			] as { summary: string; view: PlaygroundView }[],
		[
			comparisonRuns.length,
			inputPreviewItems.length,
			modelRuns.length,
			promptName,
			promptVersions.length,
			referenceResult,
			selectedTemplateId,
			totalResultsCount,
		],
	);

	const modelSelectionHandlers = useMemo(() => {
		const handlers = new Map<string, (modelId: string) => void>();
		for (const run of modelRuns) {
			handlers.set(run.id, (modelId: string) => {
				const model = modelById.get(modelId);
				if (!model) {
					return;
				}

				setModelRuns((prev) =>
					prev.map((entry) =>
						entry.id === run.id
							? {
									...entry,
									model,
									parameters: entry.parameters,
								}
							: entry,
					),
				);
			});
		}
		return handlers;
	}, [modelById, modelRuns]);

	const removeModelRunHandlers = useMemo(() => {
		const handlers = new Map<string, () => void>();
		for (const run of modelRuns) {
			handlers.set(run.id, () => {
				setModelRuns((prev) => prev.filter((entry) => entry.id !== run.id));
				setRunStates((prev) => {
					const next: Record<string, RunState> = {};
					for (const [stateId, state] of Object.entries(prev)) {
						if (!stateId.startsWith(`${run.id}::`)) {
							next[stateId] = state;
						}
					}
					return next;
				});
			});
		}
		return handlers;
	}, [modelRuns]);

	const modelParameterChangeHandlers = useMemo(() => {
		const handlers = new Map<string, (parameters: PlaygroundParameters) => void>();
		for (const run of modelRuns) {
			handlers.set(run.id, (parameters: PlaygroundParameters) => {
				setModelRuns((prev) =>
					prev.map((entry) => (entry.id === run.id ? { ...entry, parameters } : entry)),
				);
			});
		}
		return handlers;
	}, [modelRuns]);

	const handleAddModelRun = useCallback(() => {
		setModelRuns((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				model: null,
				parameters: { ...DEFAULT_PARAMETERS },
			},
		]);
	}, []);

	const handlePromptHarnessChange = useCallback((value: string) => {
		setPromptName(value);
		setCompiledMessages([]);
		setCompiledOverride(null);
		setPromptRuntimeVariables({});

		const nextDocumentType = resolveDocumentTypeFromPromptHarness(value);
		if (nextDocumentType) {
			setDocumentType(nextDocumentType);
		}
	}, []);

	const handleMainInputValueChange = useCallback((value: string) => {
		setFormMain(value);
	}, []);

	const handleAdditionalInputValueChange = useCallback((name: string, value: string) => {
		setFormAdditional((prev) => ({
			...prev,
			[name]: value,
		}));
	}, []);

	const playgroundAdditionalInputs = useMemo(
		() =>
			docUi.additionalFields.map((field) => ({
				description: field.description,
				label: field.label,
				name: field.name,
				placeholder: field.placeholder,
				type: "textarea" as const,
			})),
		[docUi.additionalFields],
	);

	const handleCompiledMessageChange = useCallback(
		(index: number, content: string) => {
			const next = effectiveCompiledMessages.map((entry) => ({
				...entry,
			}));
			next[index] = {
				...next[index],
				content,
			};
			setCompiledOverride(next);
		},
		[effectiveCompiledMessages],
	);

	const handleComparisonMessageChange = useCallback(
		(index: number, content: string) => {
			const next = (compiledOverrideB ?? compiledMessagesB).map((entry) => ({ ...entry }));
			if (!next[index]) {
				return;
			}
			next[index] = {
				...next[index],
				content,
			};
			setCompiledOverrideB(next);
		},
		[compiledMessagesB, compiledOverrideB],
	);

	const handlePromptHarnessChangeB = useCallback((value: string) => {
		setPromptNameB(value);
		setCompiledMessagesB([]);
		setCompiledOverrideB(null);
	}, []);

	const handleTemplateChangeB = useCallback((value: string) => {
		setSelectedTemplateIdB(value);
		setCompiledOverrideB(null);
	}, []);

	const handleAddPromptComparison = useCallback(() => {
		if (isComparisonEnabled) {
			return;
		}

		// Seed Prompt B with Prompt A's current selection so it starts from a known
		// state; the admin then changes its base-prompt/template independently.
		setPromptNameB(promptName);
		setSelectedTemplateIdB(selectedTemplateId);
		setCompiledMessagesB([]);
		setCompiledOverrideB(null);
		setIsComparisonEnabled(true);
	}, [isComparisonEnabled, promptName, selectedTemplateId]);

	const handleRemovePromptComparison = useCallback(() => {
		setIsComparisonEnabled(false);
		setCompiledOverrideB(null);
		setRunStates((prev) => {
			const next: Record<string, RunState> = {};
			for (const [stateId, state] of Object.entries(prev)) {
				if (!stateId.endsWith("::prompt-b")) {
					next[stateId] = state;
				}
			}
			return next;
		});
	}, []);

	const renderInputsView = () => (
		<ScrollArea className="h-full">
			<div className="p-4">
				<AiscribeTemplateInputSection
					additionalInputData={formAdditional}
					additionalInputs={playgroundAdditionalInputs}
					additionalTextareaClassName={PLAYGROUND_EDITOR_TEXTAREA_CLASS}
					inputContextController={inputContextController}
					inputPlaceholder={docUi.mainField.placeholder}
					inputValue={formMain}
					onAdditionalInputChange={handleAdditionalInputValueChange}
					onInputValueChange={handleMainInputValueChange}
					showSubmit={false}
					mainTextareaClassName={PLAYGROUND_EDITOR_TEXTAREA_CLASS}
					textareaId="main-input"
					textareaRef={mainTextareaRef}
				/>
			</div>
		</ScrollArea>
	);

	const renderPromptConfigColumn = (column: {
		isPromptHarnessDirty: boolean;
		isTemplateDirty: boolean;
		messages: { role: "system" | "user" | "assistant"; content: string }[];
		onMessageChange: (index: number, content: string) => void;
		onPromptHarnessChange: (value: string) => void;
		onTemplateChange: (value: string) => void;
		promptName: string;
		selectedTemplateId: string;
		title: string;
	}) => {
		const hasPromptHarnessOption = promptHarnessOptionIds.includes(column.promptName);

		return (
			<div className="flex min-w-0 flex-col gap-2">
				<p className="font-medium text-xs text-solarized-base01">{column.title}</p>

				<div className="flex flex-col gap-1">
					<DirtySelectorLabel isDirty={column.isPromptHarnessDirty} label="Basis-Prompt" />
					<Select onValueChange={column.onPromptHarnessChange} value={column.promptName}>
						<SelectTrigger
							className={cn(
								"w-full border-solarized-base2 bg-solarized-base3",
								column.isPromptHarnessDirty
									? "border-solarized-orange/50 bg-solarized-orange/10"
									: "",
							)}
						>
							<SelectValue placeholder="Basis-Prompt wählen" />
						</SelectTrigger>
						<SelectContent>
							{hasPromptHarnessOption ? null : (
								<SelectItem value={column.promptName}>
									{column.promptName} (nicht verfügbar)
								</SelectItem>
							)}
							{promptHarnessOptions.map((promptHarness) => (
								<SelectItem key={promptHarness.id} value={promptHarness.id}>
									{promptHarness.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<DirtySelectorLabel
						info={TEMPLATE_SELECTOR_INFO}
						isDirty={column.isTemplateDirty}
						label="Template"
					/>
					<TemplateSelector
						className={cn(
							"w-full border-solarized-base2 bg-solarized-base3",
							column.isTemplateDirty ? "border-solarized-orange/50 bg-solarized-orange/10" : "",
						)}
						noneValue={NONE_TEMPLATE_VALUE}
						onValueChange={column.onTemplateChange}
						placeholder="Template wählen"
						templates={templateOptions}
						value={column.selectedTemplateId}
					/>
				</div>

				<PromptHarnessPreview
					messages={column.messages}
					onMessageChange={column.onMessageChange}
				/>
			</div>
		);
	};

	const renderConfigView = () => (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-2 p-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-xs text-solarized-base01">Prompt-Versionen für Vergleichs-Runs</p>
					{isComparisonEnabled ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 border-solarized-base2 px-2 text-xs"
							onClick={handleRemovePromptComparison}
						>
							<Trash2 className="h-3.5 w-3.5" />
							Prompt B entfernen
						</Button>
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 border-solarized-base2 px-2 text-xs"
							onClick={handleAddPromptComparison}
						>
							<Plus className="h-3.5 w-3.5" />
							Prompt B hinzufügen
						</Button>
					)}
				</div>

				<div className={cn("grid items-start gap-3", isComparisonEnabled ? "xl:grid-cols-2" : "")}>
					{renderPromptConfigColumn({
						isPromptHarnessDirty,
						isTemplateDirty,
						messages: effectiveCompiledMessages,
						onMessageChange: handleCompiledMessageChange,
						onPromptHarnessChange: handlePromptHarnessChange,
						onTemplateChange: setSelectedTemplateId,
						promptName,
						selectedTemplateId,
						title: "Prompt A",
					})}

					{isComparisonEnabled
						? renderPromptConfigColumn({
								isPromptHarnessDirty: false,
								isTemplateDirty: false,
								messages: promptComparisonMessages ?? [],
								onMessageChange: handleComparisonMessageChange,
								onPromptHarnessChange: handlePromptHarnessChangeB,
								onTemplateChange: handleTemplateChangeB,
								promptName: promptNameB,
								selectedTemplateId: selectedTemplateIdB,
								title: "Prompt B",
							})
						: null}
				</div>
			</div>
		</ScrollArea>
	);

	const renderModelsView = () => (
		<ScrollArea className="h-full">
			<div className="space-y-4 p-4">
				<div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4">
					<div className="space-y-1">
						<h3 className="font-medium text-sm text-solarized-base00">Model Runs</h3>
						<p className="text-xs text-solarized-base01">
							Definiere mehrere Modelle und Parameter für denselben Input- und Prompt-Stand.
						</p>
					</div>
					<Button type="button" size="sm" className="gap-2" onClick={handleAddModelRun}>
						<Plus className="h-4 w-4" />
						Run hinzufügen
					</Button>
				</div>

				<div className={cn("grid gap-4", modelRuns.length > 1 ? "2xl:grid-cols-2" : "")}>
					{modelRuns.map((run) => {
						const handleModelSelection = modelSelectionHandlers.get(run.id);
						const handleRemoveModelRun = removeModelRunHandlers.get(run.id);
						const handleParameterChange = modelParameterChangeHandlers.get(run.id);
						if (!handleModelSelection || !handleRemoveModelRun || !handleParameterChange) {
							return null;
						}

						return (
							<div
								key={run.id}
								className="space-y-4 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4"
							>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0 flex-1 space-y-2">
										<Label className="text-sm text-solarized-base01">Modell</Label>
										<ModelSelector
											options={modelSelectorOptions}
											value={run.model?.id ?? null}
											isLoading={isLoadingModels}
											searchPlaceholder="Modell oder Anbieter suchen..."
											placeholder="Modell auswählen..."
											loadingMessage="Lade Modelle..."
											emptyMessage="Keine Modelle gefunden."
											formatGroupLabel={formatModelGroupLabel}
											className="min-h-11 border-solarized-base2 bg-solarized-base3 py-2"
											popoverClassName="sm:w-[28rem]"
											renderSelected={renderSelectedModelOption}
											renderOption={renderModelSelectorOption}
											onValueChange={handleModelSelection}
										/>
									</div>

									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 self-end gap-2 text-solarized-base01 hover:text-solarized-base00 sm:self-start"
										onClick={handleRemoveModelRun}
										disabled={modelRuns.length === 1}
										title={
											modelRuns.length === 1
												? "Mindestens ein Run muss existieren"
												: "Run entfernen"
										}
									>
										<Trash2 className="h-4 w-4" />
										Remove
									</Button>
								</div>

								<Separator className="bg-solarized-base2" />

								<div className="space-y-2">
									<Label className="text-sm text-solarized-base01">Parameter</Label>
									<ParameterControls
										parameters={run.parameters}
										onChange={handleParameterChange}
										model={run.model}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</ScrollArea>
	);

	const renderResultsView = () => (
		<div className="flex h-full min-h-0 flex-col p-2">
			<ScrollArea className="min-h-0 flex-1">
				<div
					className={cn(
						"grid items-start gap-4",
						comparisonRuns.length + (referenceResult ? 1 : 0) > 1 ? "2xl:grid-cols-2" : "",
					)}
				>
					{referenceResult ? (
						<div className="flex min-w-0 flex-col gap-2 rounded-lg border border-solarized-violet/30 bg-solarized-violet/5 p-2">
							<div className="shrink-0">
								<p className="font-medium text-[10px] uppercase tracking-wide text-solarized-violet">
									Usage Event
								</p>
								<p className="truncate font-mono text-xs text-solarized-base00">
									{referenceResult.modelLabel ?? "Gespeicherter Lauf"}
								</p>
							</div>
							<ResultDisplay result={referenceResult} />
						</div>
					) : null}
					{comparisonRuns.map((comparisonRun) => (
						// eslint-disable-next-line no-use-before-define
						<RunCard
							key={comparisonRun.id}
							runId={comparisonRun.id}
							modelRun={comparisonRun.modelRun}
							documentType={documentType}
							promptJson={promptJson}
							promptName={comparisonRun.promptVersion.promptName}
							promptVersionLabel={comparisonRun.promptVersion.label}
							prepareInputContextSubmission={inputContextController.prepareSubmission}
							messagesForRun={comparisonRun.promptVersion.messages}
							comparisonReference={comparisonReference}
							clearComparisons={clearComparisons}
							runState={runStates[comparisonRun.id]}
							setRunState={setRunState}
							runTriggersRef={runTriggersRef}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);

	return (
		<Tabs
			value={activeView}
			onValueChange={(value) => setActiveView(value as PlaygroundView)}
			className="flex h-full min-w-0 flex-col gap-3 lg:flex-row"
		>
			<Card className="w-full shrink-0 border-solarized-base2 lg:min-h-0 lg:w-60">
				<CardContent className="p-2">
					<TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-1">
						{navigationItems.map((item) => (
							<TabsTrigger
								key={item.view}
								value={item.view}
								className="group h-auto w-full flex-col items-start justify-start gap-1 rounded-lg border border-transparent bg-transparent px-3 py-3 text-left text-solarized-base01 shadow-none hover:border-solarized-base2 hover:bg-solarized-base3 hover:text-solarized-base00 data-[state=active]:border-solarized-blue/40 data-[state=active]:bg-solarized-blue/10 data-[state=active]:text-solarized-blue data-[state=active]:shadow-none data-[state=active]:hover:bg-solarized-blue/10 data-[state=active]:hover:text-solarized-blue"
							>
								<span className="font-medium text-sm text-solarized-base01 group-data-[state=active]:text-solarized-blue">
									{PLAYGROUND_VIEW_META[item.view].label}
								</span>
								<span className="line-clamp-2 text-xs text-solarized-base01 group-data-[state=active]:text-solarized-blue/80">
									{item.summary}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</CardContent>
			</Card>

			<Card className="flex min-h-[560px] min-w-0 flex-1 flex-col border-solarized-base2 lg:min-h-0">
				<CardContent className="min-h-0 flex-1 p-0">
					<TabsContent
						forceMount
						value="config"
						className="m-0 h-full min-h-0 data-[state=inactive]:hidden"
					>
						{renderConfigView()}
					</TabsContent>
					<TabsContent
						forceMount
						value="inputs"
						className="m-0 h-full min-h-0 data-[state=inactive]:hidden"
					>
						{renderInputsView()}
					</TabsContent>
					<TabsContent
						forceMount
						value="models"
						className="m-0 h-full min-h-0 data-[state=inactive]:hidden"
					>
						{renderModelsView()}
					</TabsContent>
					<TabsContent
						forceMount
						value="results"
						className="m-0 h-full min-h-0 data-[state=inactive]:hidden"
					>
						{renderResultsView()}
					</TabsContent>
				</CardContent>
			</Card>
		</Tabs>
	);
};

const RunCard = ({
	runId,
	modelRun,
	documentType,
	promptJson,
	promptName,
	promptVersionLabel,
	prepareInputContextSubmission,
	messagesForRun,
	comparisonReference,
	clearComparisons,
	runState,
	setRunState,
	runTriggersRef,
}: {
	runId: string;
	modelRun: ModelRunConfig;
	documentType: DocumentType;
	promptJson: string;
	promptName: string;
	promptVersionLabel: string;
	prepareInputContextSubmission: () => Promise<InputContextSubmission>;
	messagesForRun: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	comparisonReference: PlaygroundComparisonReference | null;
	clearComparisons: () => void;
	runState: RunState | undefined;
	setRunState: (id: string, patch: Partial<RunState>) => void;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
}) => {
	const payloadRef = useRef<null | Parameters<typeof orpc.admin.scribe.run.call>[0]>(null);
	const runStartedAtRef = useRef<number | null>(null);
	const latestCompletionRef = useRef("");

	const { messages, sendMessage, status, stop, setMessages } = useChat({
		id: `admin-scribe-playground-${runId}`,
		onError: (error) => {
			runStartedAtRef.current = null;
			setRunState(runId, {
				error: error.message,
				isStreaming: false,
			});
		},
		onFinish: ({ message, messages: finishedMessages }) => {
			const startedAt = runStartedAtRef.current;
			const latencyMs = startedAt === null ? 0 : Math.max(0, Date.now() - startedAt);
			runStartedAtRef.current = null;

			const { metadata } = message as { metadata?: unknown };
			const inMemoryMetrics = parseRunMetricsFromMetadata(metadata);

			setRunState(runId, {
				isStreaming: false,
				metrics: {
					latencyMs,
					...inMemoryMetrics,
				},
			});

			const responseText =
				getTextFromUiMessage(message) ||
				getAssistantTextFromMessages(
					finishedMessages as {
						role: string;
						parts?: { type: string; text?: string }[];
					}[],
				) ||
				latestCompletionRef.current;

			if (responseText.trim()) {
				setRunState(runId, {
					text: responseText,
				});
			}
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

	const { completion, reasoning } = useMemo(() => {
		const lastAssistant = messages.findLast((m) => m.role === "assistant");
		if (!lastAssistant) {
			return { completion: "", reasoning: "" };
		}
		// Extract text and reasoning from parts (AI SDK v4 format)
		if (lastAssistant.parts && lastAssistant.parts.length > 0) {
			const textParts = lastAssistant.parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { type: "text"; text: string }).text)
				.join("");
			const reasoningParts = lastAssistant.parts
				.filter((p) => p.type === "reasoning")
				.map((p) => (p as { type: "reasoning"; text: string }).text)
				.join("");
			return { completion: textParts, reasoning: reasoningParts };
		}
		return { completion: "", reasoning: "" };
	}, [messages]);

	useEffect(() => {
		latestCompletionRef.current = completion;
	}, [completion]);

	const handleCompareRun = useCallback(async () => {
		const currentPayload = payloadRef.current;
		if (!currentPayload || !comparisonReference || comparisonReference.runId === runId) {
			return;
		}

		const responseText = (runState?.text || latestCompletionRef.current).trim();
		if (!responseText) {
			toast.error("Vergleich übersprungen: Kein Antworttext gefunden");
			return;
		}

		clearComparisons();
		setRunState(runId, {
			comparison: {
				isLoading: true,
				referenceLabel: comparisonReference.label,
			},
		});

		try {
			const comparison = await orpc.admin.scribe.evaluateComparison.call({
				documentType: currentPayload.documentType,
				inputs: JSON.parse(currentPayload.promptJson || "{}") as Record<string, unknown>,
				responses: {
					a: comparisonReference.text,
					b: responseText,
				},
			});
			setRunState(runId, {
				comparison: {
					isLoading: false,
					note: comparison.note,
					preferredResponse:
						comparison.preferredResponse === "b" ? "result" : "reference",
					referenceLabel: comparisonReference.label,
				},
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? `Vergleich fehlgeschlagen: ${error.message}`
					: "Vergleich fehlgeschlagen",
			);
			setRunState(runId, {
				comparison: {
					isLoading: false,
					referenceLabel: comparisonReference.label,
				},
			});
		}
	}, [clearComparisons, comparisonReference, runId, runState?.text, setRunState]);

	useEffect(() => {
		if (status === "streaming" || status === "submitted") {
			setRunState(runId, {
				isStreaming: true,
				reasoning: reasoning || undefined,
				text: completion,
			});
		} else if (completion) {
			setRunState(runId, {
				isStreaming: false,
				reasoning: reasoning || undefined,
				text: completion,
			});
		}
	}, [completion, reasoning, status, runId, setRunState]);

	const isRunning = status === "streaming" || status === "submitted";

	const handleStopRun = useCallback(() => {
		stop();
		runStartedAtRef.current = null;
		setRunState(runId, { isStreaming: false });
	}, [runId, setRunState, stop]);

	const startRun = useCallback(async () => {
		if (!modelRun.model) {
			toast.error("Bitte Modell auswählen");
			return;
		}

		const requestId = crypto.randomUUID();
		let inputContextPayload: InputContextSubmission;
		try {
			inputContextPayload = await prepareInputContextSubmission();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Input-Kontext konnte nicht vorbereitet werden",
			);
			return;
		}

		const compiledMessagesOverride = messagesForRun.length > 0 ? messagesForRun : undefined;
		runStartedAtRef.current = Date.now();

		payloadRef.current = {
			audioFiles:
				inputContextPayload.audioFiles.length > 0 ? inputContextPayload.audioFiles : undefined,
			compiledMessagesOverride: compiledMessagesOverride
				? compiledMessagesOverride.map((m) => ({
						content: m.content,
						role: m.role,
					}))
				: undefined,
			contextFiles:
				inputContextPayload.contextFiles.length > 0 ? inputContextPayload.contextFiles : undefined,
			documentType,
			model: modelRun.model.id,
			parameters: modelRun.parameters,
			promptJson,
			promptName,
			requestId,
		};

		clearComparisons();
		setRunState(runId, {
			error: undefined,
			isStreaming: true,
			metrics: { latencyMs: 0 },
			requestId,
			text: "",
		});
		setMessages([]);
		await sendMessage({ text: "run" });
	}, [
		modelRun.model,
		modelRun.parameters,
		messagesForRun,
		prepareInputContextSubmission,
		documentType,
		promptName,
		promptJson,
		runId,
		clearComparisons,
		setRunState,
		setMessages,
		sendMessage,
	]);

	// Register this card's run function with the parent ref
	useEffect(() => {
		const runTriggers = runTriggersRef.current;
		runTriggers.set(runId, startRun);
		return () => {
			runTriggers.delete(runId);
		};
	}, [runId, runTriggersRef, startRun]);

	return (
		<div className="flex min-w-0 flex-col gap-2 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-2">
			{/* Header row */}
			<div className="flex shrink-0 items-center justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="font-medium text-[10px] uppercase tracking-wide text-solarized-base01">
						{promptVersionLabel}
					</p>
					<p className="truncate font-mono text-xs text-solarized-base00">
						{modelRun.model?.modelId ?? "Kein Modell gewählt"}
					</p>
					{runState?.requestId && (
						<p className="truncate font-mono text-[10px] text-solarized-base01">
							{runState.requestId}
						</p>
					)}
				</div>

				<div className="flex shrink-0 gap-1.5">
					{isRunning ? (
						<Button
							type="button"
							variant="destructive"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={handleStopRun}
						>
							Stop
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							onClick={startRun}
							disabled={!modelRun.model}
							className="h-7 gap-1.5 bg-solarized-blue px-2 text-xs hover:bg-solarized-blue/90"
						>
							<Play className="h-3.5 w-3.5" />
							Run
						</Button>
					)}
				</div>
			</div>

			{/* Result display - grows with content */}
			<ResultDisplay
				onCompare={
					comparisonReference && comparisonReference.runId !== runId
						? handleCompareRun
						: undefined
				}
				result={
					runState
						? {
								comparison: runState.comparison,
								error: runState.error,
								isStreaming: runState.isStreaming,
								metrics: runState.metrics,
								reasoning: runState.reasoning,
								text: runState.text,
							}
						: null
				}
			/>
		</div>
	);
};
