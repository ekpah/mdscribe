"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Copy, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { DocumentType } from "@/orpc/scribe/types";
import { orpc } from "@/lib/orpc";
import type { PlaygroundModel, PlaygroundParameters } from "../_lib/types";
import { DEFAULT_PARAMETERS } from "../_lib/types";
import { allScribeDocTypes, scribeDocTypeUi } from "../_lib/scribe-doc-types";
import { ModelSelector } from "./ModelSelector";
import { ParameterControls } from "./ParameterControls";
import { ResultDisplay } from "./ResultDisplay";

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

type InputMode = "form" | "variables";

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

export function PlaygroundPanel({
	models,
	topModelIds,
	isLoadingModels,
	presetModel,
	presetParameters,
	presetDocumentType,
	presetVariables,
}: PlaygroundPanelProps) {
	const [activeTab, setActiveTab] = useState<
		"input" | "prompt" | "models" | "results"
	>("input");

	const initialDocType = presetDocumentType ?? "discharge";
	const [documentType, setDocumentType] =
		useState<DocumentType>(initialDocType);

	const [inputMode, setInputMode] = useState<InputMode>(
		presetVariables ? "variables" : "form",
	);

	// Form input state (used to build promptJson)
	const docUi = scribeDocTypeUi[documentType];
	const [formMain, setFormMain] = useState("");
	const [formAdditional, setFormAdditional] = useState<Record<string, string>>(
		{},
	);

	// Variables mode state
	const [variablesJson, setVariablesJson] = useState(() =>
		JSON.stringify(presetVariables ?? {}, null, 2),
	);

	// Prompt selection / compilation
	const [promptName, setPromptName] = useState<string>(docUi.defaultPromptName);
	const [promptLabel, setPromptLabel] = useState<"staging" | "production">(
		"staging",
	);
	const [compiledMessages, setCompiledMessages] = useState<
		Array<{ role: "system" | "user" | "assistant"; content: string }>
	>([]);
	const [compiledOverride, setCompiledOverride] = useState<Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> | null>(null);
	const [compiledVariables, setCompiledVariables] = useState<
		Record<string, unknown>
	>({});
	const [isCompiling, setIsCompiling] = useState(false);

	const { data: promptNamesData } = useQuery(
		orpc.admin.scribe.prompts.list.queryOptions({ input: { limit: 200 } }),
	);
	const promptNames: string[] = promptNamesData?.items ?? [];

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
		return JSON.stringify(data);
	}, [docUi, formMain, formAdditional]);

	const parseVariables = (): Record<string, unknown> | null => {
		try {
			const parsed = JSON.parse(variablesJson) as unknown;
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				return null;
			}
			return parsed as Record<string, unknown>;
		} catch {
			return null;
		}
	};

	const compile = async () => {
		setIsCompiling(true);
		try {
			const variables = inputMode === "variables" ? parseVariables() : null;
			if (inputMode === "variables" && !variables) {
				toast.error("Variables JSON ist ungültig");
				return;
			}

			const res = await orpc.admin.scribe.compilePrompt.call({
				documentType,
				promptName,
				promptLabel,
				variables: variables ?? undefined,
				promptJson: inputMode === "form" ? promptJson : undefined,
			});

			setCompiledVariables(res.variablesUsed ?? {});
			setCompiledMessages(
				(res.compiledMessages ?? []).map((m) => ({
					role: m.role,
					content:
						typeof m.content === "string"
							? m.content
							: JSON.stringify(m.content),
				})),
			);
			setCompiledOverride(null);
			toast.success("Prompt kompiliert");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Fehler beim Kompilieren",
			);
		} finally {
			setIsCompiling(false);
		}
	};

	const [modelRuns, setModelRuns] = useState<ModelRunConfig[]>(() => [
		{
			id: crypto.randomUUID(),
			model: null,
			parameters: {
				temperature:
					presetParameters?.temperature ?? DEFAULT_PARAMETERS.temperature,
				maxTokens: presetParameters?.maxTokens ?? DEFAULT_PARAMETERS.maxTokens,
				thinking: presetParameters?.thinking ?? DEFAULT_PARAMETERS.thinking,
				thinkingBudget:
					presetParameters?.thinkingBudget ?? DEFAULT_PARAMETERS.thinkingBudget,
				topP: presetParameters?.topP ?? DEFAULT_PARAMETERS.topP,
				topK: presetParameters?.topK ?? DEFAULT_PARAMETERS.topK,
				frequencyPenalty:
					presetParameters?.frequencyPenalty ??
					DEFAULT_PARAMETERS.frequencyPenalty,
				presencePenalty:
					presetParameters?.presencePenalty ??
					DEFAULT_PARAMETERS.presencePenalty,
			},
		},
	]);

	// Apply preset model when models load (first run config only)
	useEffect(() => {
		if (!presetModel || models.length === 0) return;
		setModelRuns((prev) => {
			const first = prev.at(0);
			if (!first || first.model) return prev;
			const match = models.find((m) => m.id === presetModel);
			if (!match) return prev;
			return [{ ...first, model: match }, ...prev.slice(1)];
		});
	}, [presetModel, models]);

	// Keep promptName in sync with document type unless user changed it
	useEffect(() => {
		setPromptName(scribeDocTypeUi[documentType].defaultPromptName);
		setCompiledMessages([]);
		setCompiledOverride(null);
		setCompiledVariables({});
	}, [documentType]);

	const [runStates, setRunStates] = useState<Record<string, RunState>>({});

	const setRunState = useCallback((id: string, patch: Partial<RunState>) => {
		setRunStates((prev) => {
			const base: RunState = prev[id] ?? {
				text: "",
				isStreaming: false,
				metrics: { latencyMs: 0 },
			};

			return {
				...prev,
				[id]: {
					...base,
					...patch,
					metrics: {
						...base.metrics,
						...(patch.metrics ?? {}),
					},
				},
			};
		});
	}, []);

	return (
		<div className="flex h-full flex-col gap-3 lg:flex-row">
			{/* Left Panel - Tabs */}
			<Card className="w-full border-solarized-base2 lg:w-[460px] lg:shrink-0">
				<CardHeader className="border-b border-solarized-base2 px-3 py-2">
					<CardTitle className="text-sm text-solarized-base00">
						AI Scribe Playground
					</CardTitle>
				</CardHeader>

				<Tabs
					className="flex h-[calc(100%-44px)] flex-col"
					onValueChange={(v) =>
						setActiveTab(v as "input" | "prompt" | "models" | "results")
					}
					value={activeTab}
				>
					<div className="border-b border-solarized-base2 px-3 py-2">
						<TabsList className="grid h-8 w-full grid-cols-4">
							<TabsTrigger value="input" className="text-xs">
								Input
							</TabsTrigger>
							<TabsTrigger value="prompt" className="text-xs">
								Prompt
							</TabsTrigger>
							<TabsTrigger value="models" className="text-xs">
								Models
							</TabsTrigger>
							<TabsTrigger value="results" className="text-xs">
								Results
							</TabsTrigger>
						</TabsList>
					</div>

					<ScrollArea className="min-h-0 flex-1">
						<CardContent className="space-y-4 p-3">
							<TabsContent value="input" className="mt-0 space-y-3">
								<div className="space-y-2">
									<Label className="text-sm text-solarized-base01">
										Dokumenttyp
									</Label>
									<Select
										onValueChange={(v) => setDocumentType(v as DocumentType)}
										value={documentType}
									>
										<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{allScribeDocTypes.map((dt) => (
												<SelectItem key={dt} value={dt}>
													{scribeDocTypeUi[dt].label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center justify-between rounded-lg border border-solarized-base2 bg-solarized-base3 p-3">
									<div className="space-y-0.5">
										<p className="font-medium text-sm text-solarized-base00">
											Input-Modus
										</p>
										<p className="text-xs text-solarized-base01">
											Form entspricht AI Scribe UX; Variables entspricht
											\"processedInput\" aus Usage-Events.
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-xs text-solarized-base01">Form</span>
										<Switch
											checked={inputMode === "variables"}
											onCheckedChange={(checked) =>
												setInputMode(checked ? "variables" : "form")
											}
										/>
										<span className="text-xs text-solarized-base01">
											Variables
										</span>
									</div>
								</div>

								{inputMode === "form" ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label
												className="text-sm text-solarized-base01"
												htmlFor="main-input"
											>
												{docUi.mainField.label}
											</Label>
											<Textarea
												className="min-h-[140px] resize-none border-solarized-base2 bg-solarized-base3 text-sm"
												id="main-input"
												onChange={(e) => setFormMain(e.target.value)}
												placeholder={docUi.mainField.placeholder}
												value={formMain}
											/>
											{docUi.mainField.description && (
												<p className="text-xs text-solarized-base01">
													{docUi.mainField.description}
												</p>
											)}
										</div>

										{docUi.additionalFields.length > 0 && (
											<div className="space-y-4">
												<Separator className="bg-solarized-base2" />
												{docUi.additionalFields.map((field) => (
													<div className="space-y-2" key={field.name}>
														<Label
															className="text-sm text-solarized-base01"
															htmlFor={field.name}
														>
															{field.label}
														</Label>
														<Textarea
															className="min-h-[90px] resize-none border-solarized-base2 bg-solarized-base3 text-sm"
															id={field.name}
															onChange={(e) =>
																setFormAdditional((prev) => ({
																	...prev,
																	[field.name]: e.target.value,
																}))
															}
															placeholder={field.placeholder}
															value={formAdditional[field.name] ?? ""}
														/>
													</div>
												))}
											</div>
										)}

										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label className="text-sm text-solarized-base01">
													Prompt JSON (gesendet an Server)
												</Label>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 gap-2 text-solarized-base01 hover:text-solarized-base00"
													onClick={async () => {
														await navigator.clipboard.writeText(promptJson);
														toast.success("Kopiert!");
													}}
												>
													<Copy className="h-4 w-4" />
													Kopieren
												</Button>
											</div>
											<Textarea
												readOnly
												value={JSON.stringify(JSON.parse(promptJson), null, 2)}
												className="min-h-[120px] resize-none border-solarized-base2 bg-solarized-base3 font-mono text-xs"
											/>
										</div>
									</div>
								) : (
									<div className="space-y-2">
										<Label className="text-sm text-solarized-base01">
											Variables (JSON)
										</Label>
										<Textarea
											className="min-h-[340px] resize-none border-solarized-base2 bg-solarized-base3 font-mono text-xs"
											onChange={(e) => setVariablesJson(e.target.value)}
											placeholder='{"notes":"...","diagnoseblock":"..."}'
											value={variablesJson}
										/>
									</div>
								)}
							</TabsContent>

							<TabsContent value="prompt" className="mt-0 space-y-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label className="text-sm text-solarized-base01">
											Prompt Name (Langfuse)
										</Label>
										{promptNames.length > 0 ? (
											<Select
												onValueChange={(v) => setPromptName(v)}
												value={promptName}
											>
												<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{promptNames.map((name: string) => (
														<SelectItem key={name} value={name}>
															{name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<Input
												className="border-solarized-base2 bg-solarized-base3"
												onChange={(e) => setPromptName(e.target.value)}
												value={promptName}
											/>
										)}
									</div>
									<div className="space-y-2">
										<Label className="text-sm text-solarized-base01">
											Label
										</Label>
										<Select
											onValueChange={(v) =>
												setPromptLabel(v as "staging" | "production")
											}
											value={promptLabel}
										>
											<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="staging">staging</SelectItem>
												<SelectItem value="production">production</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="flex gap-2">
									<Button
										type="button"
										onClick={compile}
										disabled={isCompiling}
										className="bg-solarized-blue hover:bg-solarized-blue/90"
									>
										{isCompiling ? "Kompiliere..." : "Kompilieren"}
									</Button>
									<Button
										type="button"
										variant="outline"
										className="border-solarized-base2"
										onClick={() => {
											setCompiledOverride(null);
											toast.success("Override zurückgesetzt");
										}}
										disabled={compiledOverride === null}
									>
										<RotateCcw className="h-4 w-4" />
										Override zurücksetzen
									</Button>
								</div>

								{compiledMessages.length === 0 ? (
									<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-4 text-sm text-solarized-base01">
										Kompiliere den Prompt, um die finalen Messages zu sehen.
									</div>
								) : (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label className="text-sm text-solarized-base01">
												Inputs (variablesUsed)
											</Label>
											<Textarea
												readOnly
												value={JSON.stringify(compiledVariables, null, 2)}
												className="min-h-[120px] resize-none border-solarized-base2 bg-solarized-base3 font-mono text-xs"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-sm text-solarized-base01">
												Compiled Messages (editierbar)
											</Label>
											<div className="space-y-3">
												{(compiledOverride ?? compiledMessages).map(
													(m, idx) => (
														<div
															key={`${m.role}-${idx}`}
															className="space-y-1.5 rounded-lg border border-solarized-base2 bg-solarized-base3 p-3"
														>
															<div className="flex items-center justify-between">
																<span className="font-mono text-xs text-solarized-base01">
																	{m.role}
																</span>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-7 gap-2 text-solarized-base01 hover:text-solarized-base00"
																	onClick={async () => {
																		await navigator.clipboard.writeText(
																			m.content,
																		);
																		toast.success("Kopiert!");
																	}}
																>
																	<Copy className="h-3.5 w-3.5" />
																	Copy
																</Button>
															</div>
															<Textarea
																value={m.content}
																onChange={(e) => {
																	const next = (
																		compiledOverride ?? compiledMessages
																	).map((x) => ({ ...x }));
																	next[idx] = {
																		...next[idx],
																		content: e.target.value,
																	};
																	setCompiledOverride(next);
																}}
																className="min-h-[110px] resize-none border-solarized-base2 bg-solarized-base3 text-sm"
															/>
														</div>
													),
												)}
											</div>
										</div>
									</div>
								)}
							</TabsContent>

							<TabsContent value="models" className="mt-0 space-y-4">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<p className="font-medium text-sm text-solarized-base00">
											Model Runs
										</p>
										<p className="text-xs text-solarized-base01">
											Definiere mehrere Modelle/Parameter, die mit demselben
											Input und Prompt getestet werden.
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										className="gap-2"
										onClick={() =>
											setModelRuns((prev) => [
												...prev,
												{
													id: crypto.randomUUID(),
													model: null,
													parameters: { ...DEFAULT_PARAMETERS },
												},
											])
										}
									>
										<Plus className="h-4 w-4" />
										Add
									</Button>
								</div>

								<div className="space-y-4">
									{modelRuns.map((run) => (
										<div
											key={run.id}
											className="space-y-4 rounded-lg border border-solarized-base2 bg-solarized-base3 p-4"
										>
											<div className="flex items-center justify-between gap-2">
												<div className="space-y-2">
													<Label className="text-sm text-solarized-base01">
														Modell
													</Label>
													<ModelSelector
														models={models}
														topModelIds={topModelIds}
														isLoading={isLoadingModels}
														selectedModel={run.model}
														onSelect={(m) =>
															setModelRuns((prev) =>
																prev.map((r) =>
																	r.id === run.id ? { ...r, model: m } : r,
																),
															)
														}
													/>
												</div>

												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 gap-2 text-solarized-base01 hover:text-solarized-base00"
													onClick={() => {
														setModelRuns((prev) =>
															prev.filter((r) => r.id !== run.id),
														);
														setRunStates((prev) => {
															const next = { ...prev };
															delete next[run.id];
															return next;
														});
													}}
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
												<Label className="text-sm text-solarized-base01">
													Parameter
												</Label>
												<ParameterControls
													parameters={run.parameters}
													onChange={(p) =>
														setModelRuns((prev) =>
															prev.map((r) =>
																r.id === run.id ? { ...r, parameters: p } : r,
															),
														)
													}
													modelId={run.model?.id}
												/>
											</div>
										</div>
									))}
								</div>
							</TabsContent>

							<TabsContent value="results" className="mt-0 space-y-3">
								<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-4">
									<p className="text-sm text-solarized-base01">
										Wechsle rechts in die Ergebnis-Ansicht, um Runs zu starten
										und Ausgaben zu vergleichen.
									</p>
								</div>
							</TabsContent>
						</CardContent>
					</ScrollArea>
				</Tabs>
			</Card>

			{/* Right Panel - Results */}
			<Card className="flex min-h-0 flex-1 flex-col border-solarized-base2">
				<CardHeader className="shrink-0 border-b border-solarized-base2 px-3 py-2">
					<div className="flex items-center justify-between gap-2">
						<div className="min-w-0">
							<CardTitle className="truncate text-sm text-solarized-base00">
								Ergebnisse
							</CardTitle>
							<p className="truncate text-xs text-solarized-base01">
								{scribeDocTypeUi[documentType].label} · {promptName}
							</p>
						</div>
						<div className="flex shrink-0 gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 gap-1.5 border-solarized-base2 px-2 text-xs"
								onClick={() => {
									setRunStates({});
									toast.success("Ergebnisse zurückgesetzt");
								}}
							>
								<RotateCcw className="h-3.5 w-3.5" />
								Reset
							</Button>
							<Button
								type="button"
								size="sm"
								className="h-7 gap-1.5 bg-solarized-blue px-2 text-xs hover:bg-solarized-blue/90"
								onClick={() => setActiveTab("results")}
							>
								<Play className="h-3.5 w-3.5" />
								Run (Tab)
							</Button>
						</div>
					</div>
				</CardHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className="space-y-3 p-3">
						{modelRuns.map((run) => (
							<RunCard
								key={run.id}
								runId={run.id}
								modelRun={run}
								documentType={documentType}
								inputMode={inputMode}
								variablesJson={variablesJson}
								promptJson={promptJson}
								promptName={promptName}
								promptLabel={promptLabel}
								compiledOverride={compiledOverride}
								compiledMessages={compiledMessages}
								runState={runStates[run.id]}
								setRunState={setRunState}
							/>
						))}
					</div>
				</ScrollArea>
			</Card>
		</div>
	);
}

function RunCard({
	runId,
	modelRun,
	documentType,
	inputMode,
	variablesJson,
	promptJson,
	promptName,
	promptLabel,
	compiledOverride,
	compiledMessages,
	runState,
	setRunState,
}: {
	runId: string;
	modelRun: ModelRunConfig;
	documentType: DocumentType;
	inputMode: InputMode;
	variablesJson: string;
	promptJson: string;
	promptName: string;
	promptLabel: "staging" | "production";
	compiledOverride: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> | null;
	compiledMessages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	runState: RunState | undefined;
	setRunState: (id: string, patch: Partial<RunState>) => void;
}) {
	const payloadRef = useRef<
		null | Parameters<typeof orpc.admin.scribe.run.call>[0]
	>(null);

	const { messages, sendMessage, status, stop, setMessages } = useChat({
		id: `admin-scribe-playground-${modelRun.id}`,
		transport: {
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
			reconnectToStream() {
				throw new Error("Unsupported");
			},
		},
		onError: (error) => {
			setRunState(runId, {
				isStreaming: false,
				error: error.message,
			});
		},
		onFinish: async () => {
			const requestId = payloadRef.current?.requestId;
			if (!requestId) return;
			try {
				const event = await orpc.admin.usage.findByRequestId.call({
					requestId,
				});
				if (!event) return;

				const latencyMs =
					typeof (event.metadata as Record<string, unknown> | null)
						?.latencyMs === "number"
						? ((event.metadata as Record<string, unknown>).latencyMs as number)
						: 0;

				setRunState(runId, {
					isStreaming: false,
					metrics: {
						latencyMs,
						inputTokens: event.inputTokens ?? undefined,
						outputTokens: event.outputTokens ?? undefined,
						totalTokens: event.totalTokens ?? undefined,
						reasoningTokens: event.reasoningTokens ?? undefined,
						cost: event.cost ? Number(event.cost) : undefined,
					},
				});
			} catch {
				// Best effort; output is still useful even without metrics.
			}
		},
	});

	const completion = useMemo(() => {
		const lastAssistant = messages.findLast((m) => m.role === "assistant");
		if (!lastAssistant) return "";
		// Extract text from parts (AI SDK v4 format)
		if (lastAssistant.parts && lastAssistant.parts.length > 0) {
			return lastAssistant.parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { type: "text"; text: string }).text)
				.join("");
		}
		return "";
	}, [messages]);

	useEffect(() => {
		if (status === "streaming" || status === "submitted") {
			setRunState(runId, { isStreaming: true, text: completion });
		} else if (completion) {
			setRunState(runId, { isStreaming: false, text: completion });
		}
	}, [completion, status, runId, setRunState]);

	const isRunning = status === "streaming" || status === "submitted";

	const startRun = async () => {
		if (!modelRun.model) {
			toast.error("Bitte Modell auswählen");
			return;
		}

		const requestId = crypto.randomUUID();

		let variables: Record<string, unknown> | undefined;
		if (inputMode === "variables") {
			try {
				const parsed = JSON.parse(variablesJson) as unknown;
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					toast.error("Variables JSON ist ungültig");
					return;
				}
				variables = parsed as Record<string, unknown>;
			} catch {
				toast.error("Variables JSON ist ungültig");
				return;
			}
		}

		const compiledMessagesOverride =
			compiledOverride ??
			(compiledMessages.length > 0 ? compiledMessages : undefined);

		payloadRef.current = {
			requestId,
			model: modelRun.model.id,
			parameters: modelRun.parameters,
			documentType,
			promptName,
			promptLabel,
			variables,
			promptJson: inputMode === "form" ? promptJson : undefined,
			compiledMessagesOverride: compiledMessagesOverride
				? compiledMessagesOverride.map((m) => ({
						role: m.role,
						content: m.content,
					}))
				: undefined,
		};

		setRunState(runId, {
			requestId,
			error: undefined,
			text: "",
			metrics: { latencyMs: 0 },
			isStreaming: true,
		});
		setMessages([]);
		await sendMessage({ text: "run" });
	};

	return (
		<div className="flex h-[400px] flex-col gap-2 rounded-lg border border-solarized-base2 bg-solarized-base3/30 p-2">
			{/* Header row */}
			<div className="flex shrink-0 items-center justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="truncate font-mono text-xs text-solarized-base00">
						{modelRun.model?.id ?? "Kein Modell gewählt"}
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
							onClick={() => {
								stop();
								setRunState(runId, { isStreaming: false });
							}}
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
									text: runState.text,
									metrics: runState.metrics,
									isStreaming: runState.isStreaming,
									reasoning: runState.reasoning,
									error: runState.error,
								}
							: null
					}
				/>
			</div>
		</div>
	);
}
