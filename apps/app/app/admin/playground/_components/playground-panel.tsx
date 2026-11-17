"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { ModelSelector } from "@repo/design-system/components/ui/searchable-select";
import type { ModelSelectorOption } from "@repo/design-system/components/ui/searchable-select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { Play, Plus, RotateCcw, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
	InputContextControls,
	useInputContextState,
} from "@/app/_components/input-context/input-context-controls";
import type {
	InputContextSubmission,
	InputContextTextContext,
} from "@/app/_components/input-context/types";
import { TemplateSelector } from "@/app/_components/template-selector";
import type {
	PlaygroundModel,
	PlaygroundParameters,
	PlaygroundResult,
} from "@/app/admin/playground/_lib/types";
import { orpc } from "@/lib/orpc";
import { composeTemplatePrompt } from "@/orpc/scribe/prompts/template";
import type { PromptMessage } from "@/orpc/scribe/types";

import { ParameterControls } from "./parameter-controls";
import { ResultDisplay } from "./result-display";

export interface PlaygroundPreset {
	model?: string;
	parameters?: Partial<PlaygroundParameters>;
	referenceResult?: PlaygroundResult | null;
	templateId?: string;
	textContext?: InputContextTextContext;
}

const DEFAULT_PARAMETERS: PlaygroundParameters = {
	temperature: 1,
	thinking: false,
	thinkingExplicit: false,
};
const NO_TEMPLATE = "__none__";

interface ModelRun {
	id: string;
	model: PlaygroundModel | null;
	parameters: PlaygroundParameters;
}

/** One prepared request; every run of a batch sends the same prompt and media. */
interface RunRequest {
	messages: PromptMessage[];
	submission: InputContextSubmission;
}

type ModelOption = ModelSelectorOption & { isTop: boolean; model: PlaygroundModel };

const providerOf = (model: PlaygroundModel) =>
	model.providerName ?? model.modelId.split("/")[0] ?? "other";

const finiteMetrics = (metadata: unknown): Partial<PlaygroundResult["metrics"]> =>
	Object.fromEntries(
		Object.entries(metadata && typeof metadata === "object" ? metadata : {}).filter(
			([, value]) => typeof value === "number" && Number.isFinite(value),
		),
	);

const RunCard = ({
	batch,
	modelOptions,
	onChange,
	onRemove,
	prepareRequest,
	run,
}: {
	batch: { request: RunRequest; seq: number } | null;
	modelOptions: ModelOption[];
	onChange: (patch: Partial<ModelRun>) => void;
	onRemove?: () => void;
	prepareRequest: () => Promise<RunRequest | null>;
	run: ModelRun;
}) => {
	const payloadRef = useRef<Parameters<typeof orpc.admin.scribe.run.call>[0] | null>(null);
	const [timing, setTiming] = useState({ finishedAt: 0, startedAt: 0 });
	const { error, messages, sendMessage, setMessages, status, stop } = useChat({
		experimental_throttle: 50,
		id: `admin-playground-${run.id}`,
		onFinish: () => setTiming((previous) => ({ ...previous, finishedAt: Date.now() })),
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				if (!payloadRef.current) {
					throw new Error("Missing payload");
				}
				return eventIteratorToUnproxiedDataStream(
					await orpc.admin.scribe.run.call(payloadRef.current, { signal: options.abortSignal }),
				);
			},
		},
	});
	const isRunning = status === "streaming" || status === "submitted";

	const start = async (request: RunRequest | null) => {
		if (!request) {
			return;
		}
		if (!run.model) {
			toast.error("Bitte Modell auswählen");
			return;
		}
		const { audioFiles, contextFiles } = request.submission;
		payloadRef.current = {
			audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
			contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
			messages: request.messages,
			model: run.model.id,
			parameters: run.parameters,
		};
		setTiming({ finishedAt: 0, startedAt: Date.now() });
		setMessages([]);
		await sendMessage({ text: "run" });
	};
	const startBatch = useEffectEvent((request: RunRequest) => {
		void start(request);
	});

	// "Alle starten" sends one prepared request to every run.
	useEffect(() => {
		if (batch) {
			startBatch(batch.request);
		}
	}, [batch]);

	const answer = messages.findLast((message) => message.role === "assistant");
	const textOf = (type: "reasoning" | "text") =>
		answer?.parts.flatMap((part) => (part.type === type ? [part.text] : [])).join("") ?? "";
	const result: PlaygroundResult | null =
		answer || error
			? {
					error: error?.message,
					isStreaming: isRunning,
					metrics: {
						latencyMs: timing.finishedAt ? timing.finishedAt - timing.startedAt : 0,
						...finiteMetrics(answer?.metadata),
					},
					reasoning: textOf("reasoning") || undefined,
					text: textOf("text"),
				}
			: null;

	return (
		<div className="space-y-3 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-3">
			<div className="flex items-start gap-2">
				<ModelSelector
					className="min-h-10 flex-1"
					onValueChange={(value) =>
						onChange({
							model: modelOptions.find((option) => option.value === value)?.model ?? null,
						})
					}
					options={modelOptions}
					placeholder="Modell auswählen …"
					popoverClassName="sm:w-[28rem]"
					renderOption={(option) => (
						<div className="flex min-w-0 items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate font-medium">{option.model.name}</p>
								<p className="truncate text-muted-foreground text-xs">{option.model.modelId}</p>
							</div>
							{option.isTop ? <Badge variant="outline">Top</Badge> : null}
						</div>
					)}
					searchPlaceholder="Modell oder Anbieter suchen …"
					value={run.model?.id ?? null}
				/>
				{isRunning ? (
					<Button onClick={stop} size="sm" variant="destructive">
						<Square className="h-4 w-4" />
						Stop
					</Button>
				) : (
					<Button
						disabled={!run.model}
						onClick={async () => start(await prepareRequest())}
						size="sm"
					>
						<Play className="h-4 w-4" />
						Start
					</Button>
				)}
				{onRemove ? (
					<Button aria-label="Modell entfernen" onClick={onRemove} size="sm" variant="ghost">
						<Trash2 className="h-4 w-4" />
					</Button>
				) : null}
			</div>
			<details>
				<summary className="cursor-pointer text-muted-foreground text-xs">Parameter</summary>
				<div className="pt-3">
					<ParameterControls
						model={run.model}
						onChange={(parameters) => onChange({ parameters })}
						parameters={run.parameters}
					/>
				</div>
			</details>
			<ResultDisplay result={result} />
		</div>
	);
};

export const PlaygroundPanel = ({
	models,
	preset,
	topModelIds,
}: {
	models: PlaygroundModel[];
	preset: PlaygroundPreset;
	topModelIds: string[];
}) => {
	const inputContext = useInputContextState();
	// The page mounts the panel once a referenced usage event has loaded, so the preset is final here.
	const [templateId, setTemplateId] = useState(preset.templateId ?? NO_TEMPLATE);
	const [editedMessages, setEditedMessages] = useState<PromptMessage[] | null>(null);
	const [runs, setRuns] = useState<ModelRun[]>(() => [
		{
			id: crypto.randomUUID(),
			model:
				models.find((entry) => entry.id === preset.model || entry.modelId === preset.model) ?? null,
			parameters: { ...DEFAULT_PARAMETERS, ...preset.parameters },
		},
	]);
	const [batch, setBatch] = useState<{ request: RunRequest; seq: number } | null>(null);

	const { setTextContext } = inputContext;
	useEffect(() => {
		if (preset.textContext) {
			setTextContext(preset.textContext);
		}
	}, [preset.textContext, setTextContext]);

	const { data: templates = [], isLoading: isLoadingTemplates } = useQuery(
		orpc.admin.templates.list.queryOptions(),
	);
	const { data: template } = useQuery({
		...orpc.templates.get.queryOptions({ input: { id: templateId } }),
		enabled: templateId !== NO_TEMPLATE,
	});

	const { textContext } = inputContext;
	// The same prompt the app sends for this template, without the author's personal context.
	const compiledMessages = useMemo(
		() =>
			template
				? composeTemplatePrompt({
						...textContext,
						template: { ...template, examples: template.examples ?? [] },
					})
				: [],
		[template, textContext],
	);
	const messages = editedMessages ?? compiledMessages;

	const prepareRequest = useCallback(async (): Promise<RunRequest | null> => {
		if (messages.length === 0) {
			toast.error("Bitte zuerst eine Vorlage wählen.");
			return null;
		}
		try {
			return { messages, submission: await inputContext.prepareSubmission() };
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Eingaben konnten nicht vorbereitet werden.",
			);
			return null;
		}
	}, [inputContext, messages]);

	const runAll = async () => {
		const request = await prepareRequest();
		if (request) {
			setBatch((previous) => ({ request, seq: (previous?.seq ?? 0) + 1 }));
		}
	};

	const modelOptions = useMemo<ModelOption[]>(() => {
		const top = new Set(topModelIds);
		return models.map((model) => ({
			group: providerOf(model),
			isTop: top.has(model.modelId),
			keywords: [model.modelId, model.name, providerOf(model)],
			label: model.name,
			model,
			value: model.id,
		}));
	}, [models, topModelIds]);

	const updateRun = (id: string, patch: Partial<ModelRun>) =>
		setRuns((previous) => previous.map((run) => (run.id === id ? { ...run, ...patch } : run)));

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Vorlage</CardTitle>
				</CardHeader>
				<CardContent>
					<TemplateSelector
						isLoading={isLoadingTemplates}
						noneValue={NO_TEMPLATE}
						onValueChange={(value) => {
							setTemplateId(value);
							setEditedMessages(null);
						}}
						placeholder="Vorlage auswählen …"
						templates={templates}
						value={templateId}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Eingabe</CardTitle>
				</CardHeader>
				<CardContent>
					<InputContextControls
						controller={inputContext}
						defaultPanel="text"
						showSubmit={false}
						variant="tabs"
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-2">
					<CardTitle className="text-base">Prompt</CardTitle>
					{editedMessages ? (
						<Button onClick={() => setEditedMessages(null)} size="sm" variant="ghost">
							<RotateCcw className="h-4 w-4" />
							Bearbeitung verwerfen
						</Button>
					) : null}
				</CardHeader>
				<CardContent className="space-y-3">
					{messages.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Der Prompt erscheint, sobald eine Vorlage gewählt ist.
						</p>
					) : (
						messages.map((message, index) => (
							<label className="block space-y-1" key={message.role}>
								<span className="font-medium text-muted-foreground text-xs uppercase">
									{message.role}
								</span>
								<Textarea
									className="min-h-40 font-mono text-xs leading-snug"
									onChange={(event) =>
										setEditedMessages(
											messages.map((entry, entryIndex) =>
												entryIndex === index ? { ...entry, content: event.target.value } : entry,
											),
										)
									}
									value={message.content}
								/>
							</label>
						))
					)}
					{editedMessages ? (
						<p className="text-muted-foreground text-xs">
							Bearbeitet: Änderungen an Vorlage oder Eingabe werden erst nach dem Verwerfen
							übernommen.
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-2">
					<CardTitle className="text-base">Modelle</CardTitle>
					<div className="flex gap-2">
						<Button
							onClick={() =>
								setRuns((previous) => [
									...previous,
									{
										...(previous.at(-1) ?? { model: null, parameters: DEFAULT_PARAMETERS }),
										id: crypto.randomUUID(),
									},
								])
							}
							size="sm"
							variant="outline"
						>
							<Plus className="h-4 w-4" />
							Modell
						</Button>
						<Button onClick={runAll} size="sm">
							<Play className="h-4 w-4" />
							Alle starten
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{preset.referenceResult ? (
						<div className="space-y-2 rounded-lg border border-solarized-violet/30 bg-solarized-violet/5 p-3">
							<p className="font-medium text-solarized-violet text-xs uppercase">Usage Event</p>
							<ResultDisplay result={preset.referenceResult} />
						</div>
					) : null}
					{runs.map((run) => (
						<RunCard
							batch={batch}
							key={run.id}
							modelOptions={modelOptions}
							onChange={(patch) => updateRun(run.id, patch)}
							onRemove={
								runs.length > 1
									? () => setRuns((previous) => previous.filter((entry) => entry.id !== run.id))
									: undefined
							}
							prepareRequest={prepareRequest}
							run={run}
						/>
					))}
				</CardContent>
			</Card>
		</div>
	);
};
