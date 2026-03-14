"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { VoiceInputControls } from '@repo/design-system/components/inputs/voice-input-controls';
import type { VoiceFillAudioFile } from '@repo/design-system/components/inputs/voice-input-controls';
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from '@repo/design-system/components/ui/model-selector';
import type { ModelSelectorOption } from '@repo/design-system/components/ui/model-selector';
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronLeft, ChevronRight, Copy, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MutableRefObject, UIEvent } from 'react';
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import type { DocumentType } from "@/orpc/scribe/types";

import { allScribeDocTypes, scribeDocTypeUi } from '@/app/admin/playground/_lib/scribe-doc-types';
import type { PlaygroundDocumentType } from '@/app/admin/playground/_lib/scribe-doc-types';
import type { PlaygroundModel, PlaygroundParameters } from "@/app/admin/playground/_lib/types";
import { DEFAULT_PARAMETERS } from "@/app/admin/playground/_lib/types";
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
	presetVariables?: Record<string, unknown>;
}

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

		case "physical-exam": {
			result.main = pickString("notes");
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

interface PlaygroundModelSelectorOption extends ModelSelectorOption {
	model: PlaygroundModel;
	isTop: boolean;
	providerLabel: string;
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
	model.providerProtocol ?? model.connectionProtocol ?? getProviderFromModelId(model.modelId);

type PlaygroundView =
	| "config"
	| "inputs"
	| "compiled"
	| "models"
	| "results";
type PromptVariableSource = "input" | "runtime";

interface PromptPreviewVariable {
	key: string;
	label: string;
	source: PromptVariableSource;
	value: string;
}

const PLAYGROUND_VIEW_META: Record<
	PlaygroundView,
	{ description: string; label: string }
> = {
	compiled: {
		description: "Prompt mit Inline-Markierungen",
		label: "Prompt",
	},
	config: {
		description: "Prompt-Harness und Template konfigurieren",
		label: "Config",
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

const PROMPT_RUNTIME_LABELS: Record<string, string> = {
	contextXml: "Context XML",
	relevantTemplate: "Relevante Vorlage",
	todaysDate: "Heutiges Datum",
};

const promptHarnessToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: { content: string }[];
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
			sections.push(example.content);
		}
	}

	return sections.join("\n\n");
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

const getPromptMessageMatches = (
	content: string,
	variables: PromptPreviewVariable[],
): PromptPreviewVariable[] =>
	variables
		.filter(
			(variable) =>
				variable.value.trim().length > 0 && content.includes(variable.value),
		)
		.sort((a, b) => {
			if (a.source !== b.source) {
				return a.source === "input" ? -1 : 1;
			}
			return a.label.localeCompare(b.label);
		});

interface PromptHighlightSegment {
	source: PromptVariableSource | "plain";
	text: string;
}

const getSegmentHighlightClassName = (
	source: PromptHighlightSegment["source"],
): string => {
	if (source === "runtime") {
		return "rounded-[3px] border border-solarized-orange/40 bg-solarized-orange/12 px-0.5 text-solarized-orange";
	}
	if (source === "input") {
		return "rounded-[3px] border border-solarized-blue/40 bg-solarized-blue/12 px-0.5 text-solarized-blue";
	}
	return "";
};

const buildPromptHighlightSegments = (
	content: string,
	variables: PromptPreviewVariable[],
): PromptHighlightSegment[] => {
	if (content.length === 0) {
		return [{ source: "plain", text: "" }];
	}

	const runtimeVariables = variables.filter(
		(variable) => variable.source === "runtime" && variable.value.trim().length > 0,
	);
	const inputVariables = variables.filter(
		(variable) => variable.source === "input" && variable.value.trim().length > 0,
	);
	const allVariables = [...runtimeVariables, ...inputVariables];
	if (allVariables.length === 0) {
		return [{ source: "plain", text: content }];
	}

	const marks: (PromptVariableSource | "plain")[] = Array.from(
		{ length: content.length },
		() => "plain",
	);

	const applyVariableMatches = (
		selectedVariables: PromptPreviewVariable[],
		source: PromptVariableSource,
	) => {
		for (const variable of selectedVariables) {
			let searchStart = 0;

			while (searchStart < content.length) {
				const index = content.indexOf(variable.value, searchStart);
				if (index === -1) {
					break;
				}

				const end = index + variable.value.length;
				for (let offset = index; offset < end; offset += 1) {
					if (source === "input" || marks[offset] === "plain") {
						marks[offset] = source;
					}
				}

				searchStart = index + Math.max(variable.value.length, 1);
			}
		}
	};

	applyVariableMatches(runtimeVariables, "runtime");
	applyVariableMatches(inputVariables, "input");

	const segments: PromptHighlightSegment[] = [];
	let segmentStart = 0;
	let currentSource = marks[0] ?? "plain";
	for (let index = 1; index < marks.length; index += 1) {
		if (marks[index] === currentSource) {
			continue;
		}

		segments.push({
			source: currentSource,
			text: content.slice(segmentStart, index),
		});
		segmentStart = index;
		currentSource = marks[index] ?? "plain";
	}
	segments.push({
		source: currentSource,
		text: content.slice(segmentStart),
	});
	return segments;
};

const HighlightedPromptEditor = ({
	highlightVariables,
	onChange,
	value,
}: {
	highlightVariables: PromptPreviewVariable[];
	onChange: (value: string) => void;
	value: string;
}) => {
	const overlayContentRef = useRef<HTMLDivElement | null>(null);
	const segments = useMemo(
		() => buildPromptHighlightSegments(value, highlightVariables),
		[highlightVariables, value],
	);

	const handleScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
		const overlayContent = overlayContentRef.current;
		if (!overlayContent) {
			return;
		}

		overlayContent.style.transform = `translate(${-event.currentTarget.scrollLeft}px, ${-event.currentTarget.scrollTop}px)`;
	}, []);

	const handleValueChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<div className="relative">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
			>
				<div
					ref={overlayContentRef}
					className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-6 text-solarized-base00"
				>
						{segments.map((segment) => (
									<span
										className={cn(
											getSegmentHighlightClassName(segment.source),
										)}
										key={`${segment.source}-${segment.text}`}
									>
									{segment.text}
								</span>
						))}
				</div>
			</div>
			<textarea
				value={value}
				onChange={handleValueChange}
				onScroll={handleScroll}
				spellCheck={false}
				className="border-input placeholder:text-solarized-base01/70 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex min-h-[240px] w-full resize-y rounded-md border border-solarized-base2 bg-transparent px-3 py-2 font-mono text-xs leading-6 text-transparent shadow-xs transition-[color,box-shadow] outline-none caret-solarized-base00 selection:bg-solarized-base2/70 selection:text-solarized-base00 focus-visible:ring-[3px]"
			/>
		</div>
	);
};

const PromptHarnessPreview = ({
	inputItems,
	messages,
	onMessageChange,
	runtimeItems,
}: {
	inputItems: PromptPreviewVariable[];
	messages: { role: "system" | "user" | "assistant"; content: string }[];
	onMessageChange: (index: number, content: string) => void;
	runtimeItems: PromptPreviewVariable[];
}) => {
	const allPreviewItems = [...runtimeItems, ...inputItems];
	const copyMessageHandlers = useMemo(
		() =>
			messages.map(
				(message) => async () => {
					await navigator.clipboard.writeText(message.content);
					toast.success("Kopiert!");
				},
			),
		[messages],
	);

	const messageChangeHandlers = useMemo(
		() =>
			messages.map(
				(_, index) => (content: string) => onMessageChange(index, content),
			),
		[messages, onMessageChange],
	);

	if (messages.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/50 p-6 text-sm text-solarized-base01">
				Kompiliere den Prompt, um Harness, dynamische Inserts und gerenderte Nachrichten zu sehen.
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h3 className="font-medium text-sm text-solarized-base00">
						Prompt-Harness Vorschau
					</h3>
					<p className="text-xs text-solarized-base01">
						Direkt editierbar. Erkannte Inputs und dynamische Inserts sind oberhalb markiert.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge
						variant="outline"
						className="border-solarized-orange/40 bg-solarized-orange/10 text-solarized-orange"
					>
						Dynamisch
					</Badge>
					<Badge
						variant="outline"
						className="border-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue"
					>
						Input
					</Badge>
				</div>
			</div>

			<div className="space-y-4">
				{messages.map((message, index) => {
					const copyMessageHandler = copyMessageHandlers[index];
					const messageChangeHandler = messageChangeHandlers[index];
					if (!copyMessageHandler || !messageChangeHandler) {
						return null;
					}

					const matchingItems = getPromptMessageMatches(
						message.content,
						allPreviewItems,
					);

					return (
						<div
							className="space-y-3 rounded-lg border border-solarized-base2 bg-solarized-base3 p-4"
							key={`${message.role}-${message.content}`}
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="font-mono text-[11px] uppercase">
										{message.role}
									</Badge>
									<span className="text-xs text-solarized-base01">
										Editierbare Fassung
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 gap-2 text-solarized-base01 hover:text-solarized-base00"
									onClick={copyMessageHandler}
								>
									<Copy className="h-3.5 w-3.5" />
									Copy
								</Button>
							</div>

							{matchingItems.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{matchingItems.map((item) => (
										<Badge
											key={`${message.role}-${index}-${item.source}-${item.key}`}
											variant="outline"
											className={cn(
												item.source === "runtime"
													? "border-solarized-orange/40 bg-solarized-orange/10 text-solarized-orange"
													: "border-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue",
											)}
										>
											{item.source === "runtime" ? "Dynamisch" : "Input"} · {item.label}
										</Badge>
									))}
								</div>
							) : null}

							<HighlightedPromptEditor
								value={message.content}
								onChange={messageChangeHandler}
								highlightVariables={allPreviewItems}
							/>
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
	presetVariables,
}: PlaygroundPanelProps) => {
	const [activeView, setActiveView] = useState<PlaygroundView>("config");

	const resolvedPresetDocumentType = presetDocumentType ?? "discharge";
	const initialDocType: PlaygroundDocumentType = isPlaygroundDocumentType(
		resolvedPresetDocumentType,
	)
		? resolvedPresetDocumentType
		: "discharge";
	const [documentType, setDocumentType] =
		useState<PlaygroundDocumentType>(initialDocType);

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

	// Apply async preset document type once (usage -> playground jump-off).
	useEffect(() => {
		if (hasAppliedPresetDocTypeRef.current) {return;}
		if (!presetDocumentType) {return;}
		if (!isPlaygroundDocumentType(presetDocumentType)) {return;}

		setDocumentType(presetDocumentType);
		hasAppliedPresetDocTypeRef.current = true;
	}, [presetDocumentType]);

	// Apply async preset variables once (usage -> playground jump-off).
	useEffect(() => {
		if (hasAppliedPresetFieldsRef.current) {return;}
		if (!parsedPreset) {return;}

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
	const [promptName, setPromptName] = useState<string>(docUi.defaultPromptName);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
		NONE_TEMPLATE_VALUE,
	);
	const [compiledMessages, setCompiledMessages] = useState<
		{ role: "system" | "user" | "assistant"; content: string }[]
	>([]);
	const [compiledOverride, setCompiledOverride] = useState<Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> | null>(null);
	const [promptRuntimeVariables, setPromptRuntimeVariables] = useState<Record<string, unknown>>({});
	const [selectedTemplateExampleIndex, setSelectedTemplateExampleIndex] = useState(0);
	const [isCompiling, setIsCompiling] = useState(false);
	const compileRequestRef = useRef(0);

	const promptHarnessOptions = useMemo(() => {
		const fetchedOptions = promptHarnessesData?.items ?? [];
		if (fetchedOptions.length > 0) {
			return fetchedOptions;
		}
		return allScribeDocTypes.map(
			(docType) => scribeDocTypeUi[docType].defaultPromptName,
		);
	}, [promptHarnessesData?.items]);

	const promptHarnessDetailsQueryOptions = orpc.admin.scribe.prompts.get.queryOptions({
		input: { name: promptName },
	});
	const {
		data: selectedPromptHarnessDetails,
		isFetching: isFetchingSelectedPromptHarness,
	} = useQuery({
		...promptHarnessDetailsQueryOptions,
		enabled: promptName.trim().length > 0,
	});

	const templateDetailsQueryOptions = orpc.templates.get.queryOptions({
		input: {
			id:
				selectedTemplateId === NONE_TEMPLATE_VALUE
					? ""
					: selectedTemplateId,
		},
	});
	const { data: selectedTemplateDetails, isFetching: isFetchingSelectedTemplate } = useQuery({
		...templateDetailsQueryOptions,
		enabled: selectedTemplateId !== NONE_TEMPLATE_VALUE,
	});

	const selectedTemplateReference = useMemo(() => {
		if (!selectedTemplateDetails) {
			return "";
		}

		return buildSelectedTemplateReference({
			content: selectedTemplateDetails.content,
			examples: selectedTemplateDetails.examples ?? [],
			title: selectedTemplateDetails.title,
		});
	}, [selectedTemplateDetails]);

	const selectedTemplateExamples = selectedTemplateDetails?.examples ?? [];
	const selectedTemplateExampleCount = selectedTemplateExamples.length;
	const selectedTemplateExample =
		selectedTemplateExampleCount > 0
			? selectedTemplateExamples[selectedTemplateExampleIndex]
			: null;

	useEffect(() => {
		setSelectedTemplateExampleIndex(0);
	}, [selectedTemplateId]);

	useEffect(() => {
		if (selectedTemplateExampleCount === 0) {
			if (selectedTemplateExampleIndex !== 0) {
				setSelectedTemplateExampleIndex(0);
			}
			return;
		}

		if (selectedTemplateExampleIndex >= selectedTemplateExampleCount) {
			setSelectedTemplateExampleIndex(selectedTemplateExampleCount - 1);
		}
	}, [selectedTemplateExampleCount, selectedTemplateExampleIndex]);

	const handlePreviousTemplateExample = useCallback(() => {
		setSelectedTemplateExampleIndex((prev) => Math.max(prev - 1, 0));
	}, []);

	const handleNextTemplateExample = useCallback(() => {
		setSelectedTemplateExampleIndex((prev) =>
			Math.min(prev + 1, selectedTemplateExampleCount - 1),
		);
	}, [selectedTemplateExampleCount]);

	const promptJson = useMemo(() => {
		const data: Record<string, unknown> = {
			[docUi.mainField.name]: formMain,
		};
		for (const field of docUi.additionalFields) {
			const value = formAdditional[field.name];
			if (value !== undefined) {
				data[field.name] = value;
			}
		}
		if (selectedTemplateReference.length > 0) {
			data.relevantTemplate = selectedTemplateReference;
		}
		return JSON.stringify(data);
	}, [docUi, formMain, formAdditional, selectedTemplateReference]);

	const handleParseAudioToText = useCallback(async (audioFiles: VoiceFillAudioFile[]) => {
		toast.loading("Audio wird zu Text geparst...", {
			id: "playground-audio-parse",
		});

		try {
			const result = await orpc.scribe.voiceFill.call({
				audioFiles,
				inputFields: [
					{
						description: [
							docUi.mainField.label,
							docUi.mainField.description,
							"Transkribiere die Sprachaufnahme als Fließtext für dieses Hauptfeld.",
						]
							.filter(Boolean)
							.join(" · "),
						label: docUi.mainField.name,
					},
				],
			});

			const parsedText = result.fieldValues[docUi.mainField.name]?.trim();
			if (!parsedText) {
				throw new Error("Keine verwertbare Sprache erkannt");
			}

			setFormMain((prev) => {
				const trimmedPrevious = prev.trim();
				return trimmedPrevious.length > 0
					? `${trimmedPrevious}\n\n${parsedText}`
					: parsedText;
			});

			toast.success("Audio als Text ins Hauptfeld übernommen", {
				id: "playground-audio-parse",
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unbekannter Fehler";
			toast.error(`Audio-Parsing fehlgeschlagen: ${errorMessage}`, {
				id: "playground-audio-parse",
			});
			throw error;
		}
	}, [docUi.mainField.description, docUi.mainField.label, docUi.mainField.name]);

	const compilePrompt = useCallback(async () => {
		const requestId = compileRequestRef.current + 1;
		compileRequestRef.current = requestId;
		setIsCompiling(true);
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
				res.promptVariables
					? ({ ...res.promptVariables } as Record<string, unknown>)
					: {},
			);
		} catch (error) {
			if (compileRequestRef.current !== requestId) {
				return;
			}
			toast.error(error instanceof Error ? error.message : "Fehler beim Kompilieren");
		} finally {
			if (compileRequestRef.current === requestId) {
				setIsCompiling(false);
			}
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
	}, [
		compilePrompt,
		isFetchingSelectedTemplate,
		selectedTemplateDetails,
		selectedTemplateId,
	]);

	const [modelRuns, setModelRuns] = useState<ModelRunConfig[]>(() => [
		{
			id: crypto.randomUUID(),
			model: null,
			parameters: {
				frequencyPenalty: presetParameters?.frequencyPenalty ?? DEFAULT_PARAMETERS.frequencyPenalty,
				maxTokens: DEFAULT_PARAMETERS.maxTokens,
				presencePenalty: presetParameters?.presencePenalty ?? DEFAULT_PARAMETERS.presencePenalty,
				temperature: DEFAULT_PARAMETERS.temperature,
				thinking: presetParameters?.thinking ?? DEFAULT_PARAMETERS.thinking,
				thinkingBudget: presetParameters?.thinkingBudget ?? DEFAULT_PARAMETERS.thinkingBudget,
				thinkingExplicit: presetParameters?.thinkingExplicit ?? DEFAULT_PARAMETERS.thinkingExplicit,
				topK: presetParameters?.topK ?? DEFAULT_PARAMETERS.topK,
				topP: presetParameters?.topP ?? DEFAULT_PARAMETERS.topP,
			},
		},
	]);

	// Apply preset model when models load (first run config only)
	useEffect(() => {
		if (!presetModel || models.length === 0) {return;}
		setModelRuns((prev) => {
			const first = prev.at(0);
			if (!first || first.model) {return prev;}
			const match = models.find((m) => m.id === presetModel || m.modelId === presetModel);
			if (!match) {return prev;}
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
		setPromptName(scribeDocTypeUi[documentType].defaultPromptName);
		setCompiledMessages([]);
		setCompiledOverride(null);
		setPromptRuntimeVariables({});
	}, [documentType]);

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

	// Ref to store run trigger functions for each model
	const runTriggersRef = useRef<Map<string, () => Promise<void>>>(new Map());

	const runAllModels = useCallback(async () => {
		const triggers = [...runTriggersRef.current.values()];
		if (triggers.length === 0) {
			toast.error("Keine Modelle konfiguriert");
			return;
		}
		// Run all models in parallel
		await Promise.all(triggers.map((trigger) => trigger()));
	}, []);

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
			(group: string) =>
				PROVIDER_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1),
			[],
		);

	const renderSelectedModelOption = useCallback((selected: PlaygroundModelSelectorOption | null) => {
		if (!selected) {
			return <span className="text-solarized-base01">Modell auswählen...</span>;
		}

		return (
			<div className="min-w-0">
				<p className="truncate font-medium text-solarized-base00">
					{selected.model.name}
				</p>
				<p className="truncate text-solarized-base01 text-xs">
					{selected.providerLabel}
				</p>
			</div>
		);
	}, []);

		const renderModelSelectorOption = useCallback(
			(option: PlaygroundModelSelectorOption) => (
				<div className="flex min-w-0 items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<p className="truncate font-medium text-solarized-base00">
						{option.model.name}
					</p>
					<p className="truncate text-solarized-base01 text-xs">
						{option.model.modelId}
					</p>
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

	const runtimePromptItems = useMemo<PromptPreviewVariable[]>(() => {
		const preferredOrder = ["todaysDate", "contextXml", "relevantTemplate"];
			return Object.entries(promptRuntimeVariables)
				.map(([key, value]) => ({
				key,
				label: PROMPT_RUNTIME_LABELS[key] ?? key,
				source: "runtime" as const,
				value: serializePromptVariable(value),
				}))
				.filter((item) => item.value.trim().length > 0)
				.toSorted((a, b) => {
					const aIndex = preferredOrder.indexOf(a.key);
					const bIndex = preferredOrder.indexOf(b.key);
				if (aIndex !== -1 || bIndex !== -1) {
					if (aIndex === -1) {return 1;}
					if (bIndex === -1) {return -1;}
					return aIndex - bIndex;
				}
				return a.key.localeCompare(b.key);
			});
	}, [promptRuntimeVariables]);

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

	const navigationItems = useMemo(
		() =>
			([
				{
					summary:
						selectedTemplateId === NONE_TEMPLATE_VALUE
							? promptName
							: `${promptName} · Template`,
					view: "config",
				},
				{
					summary: `${inputPreviewItems.length} Felder aktiv`,
					view: "inputs",
				},
				{
					summary:
						compiledMessages.length > 0
							? `${compiledMessages.length} Nachrichten kompiliert`
							: "Noch nicht kompiliert",
					view: "compiled",
				},
				{
					summary: `${modelRuns.length} Vergleichs-Run${modelRuns.length === 1 ? "" : "s"}`,
					view: "models",
				},
				{
					summary:
						resultsWithContentCount > 0
							? `${resultsWithContentCount}/${modelRuns.length} mit Output`
							: "Noch keine Ergebnisse",
					view: "results",
				},
			]) as { summary: string; view: PlaygroundView }[],
		[
			compiledMessages.length,
			inputPreviewItems.length,
			modelRuns.length,
			promptName,
			resultsWithContentCount,
			selectedTemplateId,
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
					const { [run.id]: _removedRunState, ...next } = prev;
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
					prev.map((entry) =>
						entry.id === run.id ? { ...entry, parameters } : entry,
					),
				);
			});
		}
		return handlers;
	}, [modelRuns]);

	const navigationClickHandlers = useMemo(() => {
		const handlers = new Map<PlaygroundView, () => void>();
		for (const item of navigationItems) {
			handlers.set(item.view, () => {
				setActiveView(item.view);
			});
		}
		return handlers;
	}, [navigationItems]);

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

	const handleResetResults = useCallback(() => {
		setRunStates({});
		toast.success("Ergebnisse zurückgesetzt");
	}, []);

	const handlePromptHarnessChange = useCallback((value: string) => {
		setPromptName(value);
		setCompiledMessages([]);
		setCompiledOverride(null);
		setPromptRuntimeVariables({});

		const nextDocumentType = promptHarnessToDocumentType.get(value);
		if (nextDocumentType) {
			setDocumentType(nextDocumentType);
		}
	}, []);

	const handleMainInputChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setFormMain(event.target.value);
		},
		[],
	);

	const additionalFieldChangeHandlers = useMemo(() => {
		const handlers = new Map<string, (event: ChangeEvent<HTMLTextAreaElement>) => void>();
		for (const field of docUi.additionalFields) {
			handlers.set(field.name, (event: ChangeEvent<HTMLTextAreaElement>) => {
				const fieldValue = event.target.value;
				setFormAdditional((prev) => ({
					...prev,
					[field.name]: fieldValue,
				}));
			});
		}
		return handlers;
	}, [docUi.additionalFields]);

	const handleResetCompiledOverride = useCallback(() => {
		setCompiledOverride(null);
		toast.success("Override zurückgesetzt");
	}, []);

	const handleCompiledMessageChange = useCallback((index: number, content: string) => {
		const next = (compiledOverride ?? compiledMessages).map((entry) => ({
			...entry,
		}));
		next[index] = {
			...next[index],
			content,
		};
		setCompiledOverride(next);
	}, [compiledMessages, compiledOverride]);

	const renderInputsView = () => (
		<ScrollArea className="h-full">
			<div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
				<div className="space-y-4">
					<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4">
						<div className="mb-3 space-y-1">
							<h3 className="font-medium text-sm text-solarized-base00">
								{docUi.mainField.label}
							</h3>
							{docUi.mainField.description ? (
								<p className="text-xs text-solarized-base01">
									{docUi.mainField.description}
								</p>
							) : null}
						</div>
							<Textarea
								className="min-h-[320px] resize-y border-solarized-base2 bg-solarized-base3 text-sm"
								id="main-input"
								onChange={handleMainInputChange}
								placeholder={docUi.mainField.placeholder}
								value={formMain}
							/>
						</div>

						{docUi.additionalFields.length > 0 ? (
							<div className="grid gap-4 xl:grid-cols-2">
								{docUi.additionalFields.map((field) => {
									const handleAdditionalFieldChange = additionalFieldChangeHandlers.get(
										field.name,
									);
									if (!handleAdditionalFieldChange) {
										return null;
									}

									return (
										<div
											className="rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4"
											key={field.name}
										>
											<div className="mb-3 space-y-1">
												<h3 className="font-medium text-sm text-solarized-base00">
													{field.label}
												</h3>
												<p className="text-xs text-solarized-base01">{field.name}</p>
											</div>
											<Textarea
												className="min-h-[220px] resize-y border-solarized-base2 bg-solarized-base3 text-sm"
												id={field.name}
												onChange={handleAdditionalFieldChange}
												placeholder={field.placeholder}
												value={formAdditional[field.name] ?? ""}
											/>
										</div>
									);
								})}
							</div>
						) : null}
				</div>

					<div className="space-y-4">
						<div className="rounded-lg border border-solarized-blue/30 bg-solarized-blue/5 p-4">
							<div className="mb-3 space-y-1">
								<h3 className="font-medium text-sm text-solarized-base00">
									Audio zu Text
								</h3>
								<p className="text-xs text-solarized-base01">
									Parst die Aufnahme in Text und hängt sie an das Hauptfeld an. Dadurch erscheint sie direkt im Prompt JSON.
								</p>
							</div>
							<VoiceInputControls
								onSubmit={handleParseAudioToText}
								pendingLabel="Wird geparst..."
								submitLabel="Zu Text parsen"
								title="Audioaufnahme"
							/>
						</div>
				</div>
			</div>
		</ScrollArea>
	);

	const renderConfigView = () => {
		const hasPromptHarnessOption = promptHarnessOptions.includes(promptName);

		const promptHarnessContent = (() => {
			if (isFetchingSelectedPromptHarness) {
				return (
					<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
						Lade Prompt-Harness...
					</div>
				);
			}

			if (selectedPromptHarnessDetails?.messages?.length) {
				return (
					<div className="space-y-2">
						{selectedPromptHarnessDetails.messages.map((message) => (
							<div
								key={`${message.role}-${message.content}`}
								className="space-y-2 rounded-lg border border-solarized-base2 bg-solarized-base3 p-2.5"
							>
								<Badge variant="outline" className="font-mono text-[11px] uppercase">
									{message.role}
								</Badge>
								<Textarea
									readOnly
									value={serializePromptVariable(message.content)}
									className="min-h-[160px] resize-y border-solarized-base2 bg-solarized-base3 font-mono text-xs"
								/>
							</div>
						))}
					</div>
				);
			}

			return (
				<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
					Kein Prompt-Harness-Inhalt verfügbar.
				</div>
			);
		})();

		const templateContent = (() => {
			if (selectedTemplateId === NONE_TEMPLATE_VALUE) {
				return (
					<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
						Wähle ein Template aus, um Inhalt und Beispiele zu sehen.
					</div>
				);
			}

			if (isFetchingSelectedTemplate) {
				return (
					<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
						Lade Template...
					</div>
				);
			}

			if (!selectedTemplateDetails) {
				return (
					<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
						Template konnte nicht geladen werden.
					</div>
				);
			}

			return (
				<div className="space-y-2">
					<div className="space-y-1.5">
						<Label className="text-xs text-solarized-base01">Template</Label>
						<Textarea
							readOnly
							value={selectedTemplateDetails.content}
							className="min-h-[160px] resize-y border-solarized-base2 bg-solarized-base3 text-xs"
						/>
					</div>

					<div className="space-y-1.5">
						<div className="flex flex-wrap items-center justify-between gap-1.5">
							<Label className="text-xs text-solarized-base01">
								Beispiel (wird unter dem Template eingefügt)
							</Label>
							{selectedTemplateExampleCount > 0 ? (
								<div className="flex items-center gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 w-7 border-solarized-base2 p-0"
											onClick={handlePreviousTemplateExample}
											disabled={selectedTemplateExampleIndex === 0}
											title="Vorheriges Beispiel"
										>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<span className="min-w-16 text-center text-xs text-solarized-base01">
										{selectedTemplateExampleIndex + 1}/{selectedTemplateExampleCount}
									</span>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 w-7 border-solarized-base2 p-0"
											onClick={handleNextTemplateExample}
											disabled={selectedTemplateExampleIndex >= selectedTemplateExampleCount - 1}
											title="Nächstes Beispiel"
										>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							) : null}
						</div>

						{selectedTemplateExample ? (
							<Textarea
								readOnly
								value={selectedTemplateExample.content}
								className="min-h-[120px] resize-y border-solarized-base2 bg-solarized-base3 text-xs"
							/>
						) : (
							<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3 p-3 text-xs text-solarized-base01">
								Dieses Template enthält keine Beispiele.
							</div>
						)}
					</div>
				</div>
			);
		})();

		return (
			<ScrollArea className="h-full">
				<div className="space-y-3 p-3">
					<div className="grid gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-2 lg:grid-cols-2">
						<div>
						<Label className="text-sm text-solarized-base01">Basis-Prompt</Label>
						<Select
							onValueChange={handlePromptHarnessChange}
							value={promptName}
						>
							<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
								<SelectValue placeholder="Basis-Prompt waehlen" />
							</SelectTrigger>
							<SelectContent>
								{hasPromptHarnessOption ? null : (
									<SelectItem value={promptName}>
										{promptName} (nicht verfuegbar)
									</SelectItem>
								)}
								{promptHarnessOptions.map((promptHarness) => (
									<SelectItem key={promptHarness} value={promptHarness}>
										{promptHarness}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<Label className="text-sm text-solarized-base01">Template</Label>
						<Select
							value={selectedTemplateId}
							onValueChange={setSelectedTemplateId}
						>
							<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
								<SelectValue placeholder="Template waehlen" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_TEMPLATE_VALUE}>Keins</SelectItem>
								{templateOptions.map((templateOption) => (
									<SelectItem key={templateOption.id} value={templateOption.id}>
										{templateOption.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

					<div className="grid gap-2 lg:grid-cols-2">
						<div className="space-y-2 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-3">
							{promptHarnessContent}
						</div>

						<div className="space-y-2 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-3">
							{templateContent}
						</div>
					</div>
				</div>
			</ScrollArea>
		);
	};

	const renderCompiledPromptView = () => (
		<ScrollArea className="h-full">
			<div className="space-y-3 p-3">
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Badge
						variant="outline"
						className={cn(
							"border-solarized-base2 bg-solarized-base3 text-solarized-base01",
							isCompiling
								? "border-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue"
								: "",
						)}
					>
						{isCompiling ? "Aktualisiere..." : "Automatisch aktuell"}
					</Badge>
						<Button
							type="button"
							variant="outline"
							className="border-solarized-base2"
							onClick={handleResetCompiledOverride}
							disabled={compiledOverride === null}
						>
						<RotateCcw className="h-4 w-4" />
						Override zurücksetzen
					</Button>
				</div>

					<PromptHarnessPreview
						inputItems={inputPreviewItems}
						messages={compiledOverride ?? compiledMessages}
						onMessageChange={handleCompiledMessageChange}
						runtimeItems={runtimePromptItems}
					/>
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
		<ScrollArea className="h-full">
			<div className="space-y-4 p-4">
				<div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-4">
					<div className="space-y-1">
						<h3 className="font-medium text-sm text-solarized-base00">Ergebnisse</h3>
						<p className="text-xs text-solarized-base01">
							{scribeDocTypeUi[documentType].label} · {promptName}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5 border-solarized-base2 px-3 text-xs"
							onClick={handleResetResults}
						>
							<RotateCcw className="h-3.5 w-3.5" />
							Reset
						</Button>
						<Button
							type="button"
							size="sm"
							className="gap-1.5 bg-solarized-blue px-3 text-xs hover:bg-solarized-blue/90"
							onClick={runAllModels}
						>
							<Play className="h-3.5 w-3.5" />
							Run All
						</Button>
					</div>
				</div>

				<div className={cn("grid gap-4", modelRuns.length > 1 ? "2xl:grid-cols-2" : "")}>
					{modelRuns.map((run) => (
						// eslint-disable-next-line no-use-before-define
						<RunCard
							key={run.id}
							runId={run.id}
							modelRun={run}
							documentType={documentType}
							promptJson={promptJson}
							promptName={promptName}
							compiledOverride={compiledOverride}
							compiledMessages={compiledMessages}
							runState={runStates[run.id]}
							setRunState={setRunState}
							runTriggersRef={runTriggersRef}
						/>
					))}
				</div>
			</div>
		</ScrollArea>
	);

	const renderActiveView = () => {
		switch (activeView) {
			case "config": {
				return renderConfigView();
			}
			case "inputs": {
				return renderInputsView();
			}
			case "compiled": {
				return renderCompiledPromptView();
			}
			case "models": {
				return renderModelsView();
			}
			case "results": {
				return renderResultsView();
			}
			default: {
				return null;
			}
		}
	};

	return (
		<div className="flex h-full min-w-0 flex-col gap-3 lg:flex-row">
			<Card className="w-full shrink-0 border-solarized-base2 lg:min-h-0 lg:w-60">
				<CardContent className="p-2">
						<div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
							{navigationItems.map((item) => {
								const handleNavigationClick = navigationClickHandlers.get(item.view);
								if (!handleNavigationClick) {
									return null;
								}

								const isActive = item.view === activeView;
								return (
									<Button
									type="button"
									key={item.view}
									variant="ghost"
									className={cn(
										"h-auto w-full flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left",
											isActive
												? "border-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue hover:bg-solarized-blue/10 hover:text-solarized-blue"
												: "border-transparent text-solarized-base01 hover:border-solarized-base2 hover:bg-solarized-base3 hover:text-solarized-base00",
										)}
										onClick={handleNavigationClick}
									>
									<span className="font-medium text-sm">
										{PLAYGROUND_VIEW_META[item.view].label}
									</span>
									<span
										className={cn(
											"line-clamp-2 text-xs",
											isActive ? "text-solarized-blue/80" : "text-solarized-base01",
										)}
									>
										{item.summary}
									</span>
								</Button>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<Card className="flex min-h-[560px] min-w-0 flex-1 flex-col border-solarized-base2 lg:min-h-0">
				<CardContent className="min-h-0 flex-1 p-0">{renderActiveView()}</CardContent>
			</Card>
		</div>
	);
}

const RunCard = ({
	runId,
	modelRun,
	documentType,
	promptJson,
	promptName,
	compiledOverride,
	compiledMessages,
	runState,
	setRunState,
	runTriggersRef,
}: {
	runId: string;
	modelRun: ModelRunConfig;
	documentType: DocumentType;
	promptJson: string;
	promptName: string;
	compiledOverride: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> | null;
	compiledMessages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	runState: RunState | undefined;
	setRunState: (id: string, patch: Partial<RunState>) => void;
	runTriggersRef: MutableRefObject<Map<string, () => Promise<void>>>;
}) => {
	const payloadRef = useRef<null | Parameters<typeof orpc.admin.scribe.run.call>[0]>(null);

	const { messages, sendMessage, status, stop, setMessages } = useChat({
		id: `admin-scribe-playground-${modelRun.id}`,
		onError: (error) => {
			setRunState(runId, {
				error: error.message,
				isStreaming: false,
			});
		},
		onFinish: async () => {
			const requestId = payloadRef.current?.requestId;
			if (!requestId) {return;}
			try {
				const event = await orpc.admin.usage.findByRequestId.call({
					requestId,
				});
				if (!event) {return;}

				const latencyMs =
					typeof (event.metadata as Record<string, unknown> | null)?.latencyMs === "number"
						? ((event.metadata as Record<string, unknown>).latencyMs as number)
						: 0;

			setRunState(runId, {
				isStreaming: false,
				metrics: {
					cost: event.cost ? Number(event.cost) : undefined,
					inputTokens: event.inputTokens ?? undefined,
					latencyMs,
					outputTokens: event.outputTokens ?? undefined,
					reasoningTokens: event.reasoningTokens ?? undefined,
					totalTokens: event.totalTokens ?? undefined,
				},
			});
		} catch {
			// Best effort; output is still useful even without metrics.
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
		if (!lastAssistant) {return { completion: "", reasoning: "" };}
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
		setRunState(runId, { isStreaming: false });
	}, [runId, setRunState, stop]);

	const startRun = useCallback(async () => {
		if (!modelRun.model) {
			toast.error("Bitte Modell auswählen");
			return;
		}

		const requestId = crypto.randomUUID();

		const compiledMessagesOverride =
			compiledOverride ?? (compiledMessages.length > 0 ? compiledMessages : undefined);

			payloadRef.current = {
				compiledMessagesOverride: compiledMessagesOverride
					? compiledMessagesOverride.map((m) => ({
							content: m.content,
							role: m.role,
						}))
					: undefined,
			documentType,
			model: modelRun.model.id,
			parameters: modelRun.parameters,
			promptJson,
			promptName,
			requestId,
		};

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
		compiledOverride,
		compiledMessages,
		documentType,
		promptName,
		promptJson,
		runId,
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
		<div className="flex h-[350px] min-w-0 flex-col gap-2 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-2 lg:h-[400px]">
			{/* Header row */}
			<div className="flex shrink-0 items-center justify-between gap-2">
				<div className="min-w-0 flex-1">
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

			{/* Result display - takes remaining space */}
			<div className="min-h-0 flex-1">
				<ResultDisplay
					result={
						runState
							? {
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
		</div>
	);
}
