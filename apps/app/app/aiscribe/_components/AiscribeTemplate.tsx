"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputBody,
	PromptInputModelSelect,
	PromptInputModelSelectContent,
	PromptInputModelSelectItem,
	PromptInputModelSelectTrigger,
	PromptInputModelSelectValue,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@repo/design-system/components/ai-elements/prompt-input";
import Inputs from "@repo/design-system/components/inputs/Inputs";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { Label } from "@repo/design-system/components/ui/label";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import parseMarkdocToInputs from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import {
	FileText,
	Loader2,
	type LucideIcon,
	Mic,
	Square,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useTextSnippets } from "@/hooks/use-text-snippets";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { USER_MESSAGES } from "@/lib/user-messages";
import type {
	AudioFile,
	DocumentType,
	SupportedModel,
} from "@/orpc/scribe/types";

import { orpc } from "@/lib/orpc";
import { MemoizedCopySection } from "./MemoizedCopySection";

interface AdditionalInputField {
	name: string;
	label: string;
	placeholder: string;
	required?: boolean;
	type?: "text" | "textarea";
	description?: string;
}

export interface AiscribeTemplateConfig {
	// Page identity
	title: string;
	description: string;
	icon: LucideIcon;

	// Document type for oRPC (replaces apiEndpoint)
	documentType: DocumentType;

	// Tab configuration
	inputTabTitle: string;
	outputTabTitle: string;

	// Form configuration
	inputFieldName: string;
	inputPlaceholder: string;
	inputDescription: string;

	// Additional input fields
	additionalInputs?: AdditionalInputField[];

	// Button text
	generateButtonText: string;
	regenerateButtonText: string;

	// Empty state messages
	emptyStateTitle: string;
	emptyStateDescription: string;

	// Optional custom processing
	customPromptProcessor?: (
		inputData: string,
		additionalInputs: Record<string, string>,
	) => Record<string, unknown>;
	customApiCall?: (
		inputData: string,
		additionalInputs: Record<string, string>,
	) => Promise<unknown>;
}

const models: Array<{ id: SupportedModel; name: string }> = [
	{ id: "auto", name: "Auto" },
	{ id: "glm-4p6", name: "GLM-4.6" },
	{ id: "claude-opus-4.5", name: "Claude Opus 4.5" },
	{ id: "gemini-3-pro", name: "Gemini 3 Pro" },
	{ id: "gemini-3-flash", name: "Gemini 3 Flash" },
];

interface AiscribeTemplateProps {
	config: AiscribeTemplateConfig;
}

interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
}

export function AiscribeTemplate({ config }: AiscribeTemplateProps) {
	const [activeTab, setActiveTab] = useState("input");
	const [inputData, setInputData] = useState("");
	const [additionalInputData, setAdditionalInputData] = useState<
		Record<string, string>
	>({});
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [model, setModel] = useState<SupportedModel>(models[0].id);
	const [isRecording, setIsRecording] = useState(false);
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	// Use ref for audio files to avoid race condition between setState and sendMessage
	const preparedAudioFilesRef = useRef<AudioFile[]>([]);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);
	const mainTextareaRef = useRef<HTMLTextAreaElement>(null);

	// Initialize text snippets hook
	useTextSnippets();

	// Use AI SDK useChat with custom oRPC transport
	const { messages, sendMessage, status, setMessages } = useChat({
		id: `scribe-${config.documentType}`,
		transport: {
			async sendMessages(options) {
				// Read from ref to get the latest audio files synchronously
				const audioFiles = preparedAudioFilesRef.current;
				return eventIteratorToUnproxiedDataStream(
					await orpc.scribeStream.call(
						{
							documentType: config.documentType,
							messages: options.messages,
							model,
							audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
						},
						{ signal: options.abortSignal },
					),
				);
			},
			reconnectToStream() {
				throw new Error("Unsupported");
			},
		},
		onError: (error) => {
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
		},
		onFinish: () => {
			toast.success("Erfolgreich generiert");
			// Clear prepared audio files ref after generation
			preparedAudioFilesRef.current = [];
		},
	});

	// Extract completion text from the last assistant message
	const completion = useMemo(() => {
		const lastAssistantMessage = messages.findLast(
			(m) => m.role === "assistant",
		);
		if (!lastAssistantMessage) return "";
		if (lastAssistantMessage.parts) {
			return lastAssistantMessage.parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { type: "text"; text: string }).text)
				.join("");
		}
		return "";
	}, [messages]);

	// Loading state from useChat status
	const isLoading = status === "streaming" || status === "submitted";

	// PERF: Use useCallback for stable callback reference
	const handleValuesChange = useCallback((data: Record<string, unknown>) => {
		setValues(data);
	}, []);

	// Check if audio recording is supported for current model
	const isAudioSupported = model === "auto" || model === "gemini-3-flash";
	const maxRecordings = 3;
	const canRecord = audioRecordings.length < maxRecordings;

	// Handle audio recording
	const handleStartRecording = async () => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				audioChunksRef.current.push(event.data);
			});

			mediaRecorder.addEventListener("stop", async () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/wav",
				});
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000; // in seconds
				const newRecording: AudioRecording = {
					blob: audioBlob,
					duration,
					id: `audio-${Date.now()}`,
				};
				// PERF: Use functional setState to avoid stale closures
				setAudioRecordings((prev) => [...prev, newRecording]);
				for (const track of stream.getTracks()) {
					track.stop();
				}
			});

			mediaRecorder.start();
			setIsRecording(true);
			toast.success("Aufnahme gestartet");
		} catch (error) {
			console.error("Error starting recording:", error);
			toast.error("Fehler beim Starten der Aufnahme");
		}
	};

	const handleStopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			toast.success("Aufnahme beendet");
		}
	};

	const handleToggleRecording = () => {
		if (isRecording) {
			handleStopRecording();
		} else {
			handleStartRecording();
		}
	};

	// PERF: Use useCallback with functional setState for stable callback reference
	const handleRemoveRecording = useCallback((id: string) => {
		setAudioRecordings((prev) =>
			prev.filter((recording) => recording.id !== id),
		);
	}, []);

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// PERF: Use useCallback with functional setState for stable callback reference
	const handleAdditionalInputChange = useCallback(
		(name: string, value: string) => {
			setAdditionalInputData((prev) => ({
				...prev,
				[name]: value,
			}));
		},
		[],
	);

	const missingRequiredFields = useMemo(() => {
		if (!config.additionalInputs) {
			return [];
		}
		const missing: string[] = [];
		for (const field of config.additionalInputs) {
			if (!field.required) {
				continue;
			}
			const value = additionalInputData[field.name];
			if (!value || value.trim().length === 0) {
				missing.push(field.label);
			}
		}
		return missing;
	}, [config.additionalInputs, additionalInputData]);

	const hasMissingRequiredFields = missingRequiredFields.length > 0;

	const requiredFieldsMessage = useMemo(() => {
		if (missingRequiredFields.length === 0) {
			return "";
		}
		if (missingRequiredFields.length === 1) {
			return `Bitte füllen Sie das Pflichtfeld "${missingRequiredFields[0]}" aus.`;
		}
		return `Bitte füllen Sie die Pflichtfelder ${missingRequiredFields.join(", ")} aus.`;
	}, [missingRequiredFields]);

	// Check if at least one input field is filled
	const areRequiredFieldsFilled = useCallback(() => {
		// Check if there are any audio recordings
		const hasAudio = audioRecordings.length > 0;

		// Check if main input field has content
		const hasMainInput = inputData.trim().length > 0;

		// Check if any additional input field has content
		const hasAnyAdditionalInput = config.additionalInputs?.some(
			(field) =>
				additionalInputData[field.name] &&
				additionalInputData[field.name].trim().length > 0,
		);

		// At least one field must be filled (audio, main input, or any additional input)
		return hasAudio || hasMainInput || hasAnyAdditionalInput;
	}, [
		audioRecordings,
		inputData,
		additionalInputData,
		config.additionalInputs,
	]);

	const handleGenerate = useCallback(async () => {
		if (hasMissingRequiredFields) {
			toast.error(requiredFieldsMessage);
			return;
		}

		if (!areRequiredFieldsFilled()) {
			toast.error(USER_MESSAGES.missingInput);
			return;
		}

		// Clear previous messages before starting a new request
		setMessages([]);
		setActiveTab("output");

		try {
			// Handle custom API call if provided
			if (config.customApiCall) {
				await config.customApiCall(inputData, additionalInputData);
			}

			// Prepare prompt
			const prompt = config.customPromptProcessor
				? config.customPromptProcessor(inputData, additionalInputData)
				: JSON.stringify({
						[config.inputFieldName]: inputData,
						...additionalInputData,
					});

			// Prepare audio files if available - update ref synchronously before sendMessage
			if (audioRecordings.length > 0 && isAudioSupported) {
				const audioFiles = await Promise.all(
					audioRecordings.map(async (recording) => {
						const reader = new FileReader();
						const audioBase64 = await new Promise<string>((resolve) => {
							reader.onloadend = () => {
								const base64String = (reader.result as string).split(",")[1];
								resolve(base64String);
							};
							reader.readAsDataURL(recording.blob);
						});
						return {
							data: audioBase64,
							mimeType: recording.blob.type,
						};
					}),
				);
				// Use ref to avoid race condition - ref update is synchronous
				preparedAudioFilesRef.current = audioFiles;
			} else {
				// Clear ref if no audio recordings
				preparedAudioFilesRef.current = [];
			}

			// Send message using AI SDK useChat
			const promptText =
				typeof prompt === "string" ? prompt : JSON.stringify(prompt);
			await sendMessage({ text: promptText });
		} catch (error) {
			// Catch any unexpected errors not handled by onError callback
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
		}
	}, [
		inputData,
		additionalInputData,
		areRequiredFieldsFilled,
		hasMissingRequiredFields,
		requiredFieldsMessage,
		setMessages,
		sendMessage,
		config.customApiCall,
		config.customPromptProcessor,
		config.inputFieldName,
		audioRecordings,
		isAudioSupported,
	]);

	useHotkeys(
		["meta+shift+1", "ctrl+shift+1"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			document.getElementById("input-field")?.focus();
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
		},
	);

	useHotkeys(
		["meta+enter", "ctrl+enter"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (!isLoading && !hasMissingRequiredFields && areRequiredFieldsFilled()) {
				handleGenerate();
			}
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
		},
	);

	const IconComponent = config.icon;

	return (
		<div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
			<div className="mx-auto max-w-7xl space-y-8">
				{/* Header Section */}
				<div className="space-y-4 text-center">
					<div className="flex items-center justify-center gap-3">
						<div className="rounded-full bg-solarized-blue/10 p-3">
							<IconComponent className="h-8 w-8 text-solarized-blue" />
						</div>
						<div>
							<h1 className="font-bold text-3xl text-primary">
								{config.title}
							</h1>
							<p className="text-lg text-muted-foreground">
								{config.description}
							</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-8 lg:grid-cols-5 xl:grid-cols-6">
					{/* Patient Info Card */}
					<div className="lg:col-span-2 xl:col-span-2">
						<Card className="h-fit border-solarized-blue/20 shadow-lg">
							<CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-green/5">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<div className="h-2 w-2 rounded-full bg-solarized-blue" />
										<CardTitle className="text-base text-foreground">
											Patienteninformationen
										</CardTitle>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-6 p-6">
								{/* Auto-extracted information and Input Fields */}
								<div className="pt-6">
									{/* Input Fields from Markdoc */}
									{completion && (
										<div className="space-y-3">
											<Inputs
												inputTags={parseMarkdocToInputs(completion || "")}
												onChange={handleValuesChange}
											/>
										</div>
									)}

									{(!completion ||
										parseMarkdocToInputs(completion).length === 0) && (
										<div className="rounded-lg border border-muted-foreground/20 border-dashed bg-muted/20 p-4 text-center">
											<p className="text-muted-foreground text-xs leading-relaxed">
												Notwendige Informationen werden automatisch aus den
												Eingaben extrahiert
											</p>
										</div>
									)}
								</div>

								{/* Privacy notice */}
								<div className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-4 text-xs">
									<p className="text-solarized-green leading-relaxed">
										🔒 Alle Daten in dieser Box werden nur lokal gespeichert und
										niemals an Server übertragen
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Main Content with Tabs */}
					<div className="lg:col-span-3 xl:col-span-4">
						<Card className="border-solarized-green/20 shadow-lg">
							<Tabs
								className="w-full"
								onValueChange={setActiveTab}
								value={activeTab}
							>
								<CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
									<TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
										<TabsTrigger
											className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
											value="input"
										>
											{config.inputTabTitle}
										</TabsTrigger>
										<TabsTrigger
											className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
											value="output"
										>
											{config.outputTabTitle}
										</TabsTrigger>
									</TabsList>
								</CardHeader>

								{/* Input Tab */}
								<TabsContent className="space-y-0" value="input">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-foreground">
											<FileText className="h-5 w-5 text-solarized-blue" />
											{config.inputTabTitle}
										</CardTitle>
										<CardDescription>{config.inputDescription}</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Privacy Warning */}
										<div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-4 text-sm">
											<p className="text-solarized-red leading-relaxed">
												⚠️ <strong>Datenschutzhinweis:</strong> Geben Sie hier
												keine privaten Patientendaten ein! Diese Informationen
												werden an eine KI gesendet. Verwenden Sie nur
												anonymisierte Daten.
											</p>
										</div>

										{/* Additional Input Fields */}
										{config.additionalInputs &&
											config.additionalInputs.length > 0 && (
												<div className="space-y-4 rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-4">
													<div className="flex items-center gap-2">
														<div className="h-1.5 w-1.5 rounded-full bg-solarized-blue" />
														<h4 className="font-medium text-foreground text-sm">
															Zusätzliche Informationen
														</h4>
													</div>
													<div className="grid gap-4">
														{config.additionalInputs.map((field) => (
															<div className="space-y-2" key={field.name}>
																<Label
																	className="font-medium text-sm"
																	htmlFor={field.name}
																>
																	{field.label}
																	{field.required && (
																		<span className="ml-1 text-red-500">*</span>
																	)}
																</Label>
																{field.type === "textarea" ? (
																	<Textarea
																		className="min-h-[180px] resize-y border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
																		disabled={isLoading}
																		id={field.name}
																		onChange={(e) =>
																			handleAdditionalInputChange(
																				field.name,
																				e.target.value,
																			)
																		}
																		placeholder={field.placeholder}
																		value={
																			additionalInputData[field.name] || ""
																		}
																	/>
																) : (
																	<Input
																		className="border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
																		disabled={isLoading}
																		id={field.name}
																		onChange={(e) =>
																			handleAdditionalInputChange(
																				field.name,
																				e.target.value,
																			)
																		}
																		placeholder={field.placeholder}
																		value={
																			additionalInputData[field.name] || ""
																		}
																	/>
																)}
																{field.description && (
																	<p className="text-muted-foreground text-xs">
																		{field.description}
																	</p>
																)}
															</div>
														))}
													</div>
												</div>
											)}

										{/* Audio Recordings Indicator */}
										{audioRecordings.length > 0 && (
											<div className="space-y-2">
												{audioRecordings.map((recording, index) => (
													<div
														className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-3"
														key={recording.id}
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-2 text-sm text-solarized-green">
																<Mic className="h-4 w-4" />
																<span>
																	Aufnahme {index + 1} (
																	{formatDuration(recording.duration)})
																</span>
															</div>
															<Button
																onClick={() =>
																	handleRemoveRecording(recording.id)
																}
																size="sm"
																type="button"
																variant="ghost"
															>
																<X className="h-4 w-4" />
															</Button>
														</div>
													</div>
												))}
											</div>
										)}

										{/* Main Input Field */}
										<PromptInput onSubmit={handleGenerate}>
											<PromptInputBody>
												<PromptInputTextarea
													className="min-h-[400px] resize-none rounded-t-lg border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
													disabled={isLoading}
													id="input-field"
													onChange={(e) => setInputData(e.target.value)}
													placeholder={config.inputPlaceholder}
													ref={mainTextareaRef}
													value={inputData}
												/>
											</PromptInputBody>
											<PromptInputToolbar>
												<PromptInputTools>
													<PromptInputActionMenu>
														<PromptInputModelSelect
															onValueChange={(value) => {
																setModel(value as SupportedModel);
															}}
															value={model}
														>
															<PromptInputModelSelectTrigger>
																<PromptInputModelSelectValue />
															</PromptInputModelSelectTrigger>
															<PromptInputModelSelectContent>
																{models.map((m) => (
																	<PromptInputModelSelectItem
																		key={m.id}
																		value={m.id}
																	>
																		{m.name}
																	</PromptInputModelSelectItem>
																))}
															</PromptInputModelSelectContent>
														</PromptInputModelSelect>
													</PromptInputActionMenu>

													<Button
														className={isRecording ? "bg-solarized-red" : ""}
														disabled={
															!isAudioSupported ||
															isLoading ||
															!(canRecord || isRecording)
														}
														onClick={handleToggleRecording}
														size="sm"
														title={
															isAudioSupported
																? canRecord || isRecording
																	? isRecording
																		? "Aufnahme stoppen"
																		: "Audioaufnahme starten"
																	: `Maximal ${maxRecordings} Aufnahmen möglich`
																: "Nur mit Auto oder Gemini 2.5 Pro verfügbar"
														}
														type="button"
														variant="ghost"
													>
														{isRecording ? (
															<Square className="h-4 w-4" />
														) : (
															<Mic className="h-4 w-4" />
														)}
													</Button>
												</PromptInputTools>
												<PromptInputSubmit
													disabled={
														isLoading ||
														hasMissingRequiredFields ||
														!areRequiredFieldsFilled()
													}
												/>
											</PromptInputToolbar>
										</PromptInput>
									</CardContent>
									<CardFooter className="flex items-center justify-center bg-muted/20">
										<div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm">
											<div className="flex items-center gap-2">
												<Kbd>⌘⇧1</Kbd>
												<span>für Fokus</span>
											</div>
											<div className="flex items-center gap-2">
												<Kbd>⌘↵</Kbd>
												<span>zum Generieren</span>
											</div>
											<Link
												className="flex items-center gap-2 rounded px-2 py-1 transition "
												href="/profile#snippets"
												tabIndex={0}
												title="Zur Text-Snippets-Verwaltung"
											>
												<Kbd>⇧F2</Kbd>
												<span>für Text-Snippets</span>
											</Link>
										</div>
									</CardFooter>
								</TabsContent>

								{/* Output Tab */}
								<TabsContent className="space-y-0" value="output">
									<CardContent>
										{(() => {
											if (isLoading && !completion) {
												return (
													<div className="flex flex-col items-center justify-center space-y-4 text-center">
														<div className="relative">
															<div className="h-20 w-20 animate-pulse rounded-full border-4 border-solarized-blue/20" />
															<div className="absolute top-0 left-0 h-20 w-20 animate-spin rounded-full border-4 border-solarized-blue border-t-transparent" />
														</div>
														<div className="space-y-2">
															<h3 className="font-semibold text-foreground text-lg">
																Wird generiert...
															</h3>
															<p className="text-muted-foreground text-sm">
																Bitte warten Sie, während der KI-Assistent Ihren
																Inhalt erstellt
															</p>
														</div>
													</div>
												);
											}

											if (completion) {
												return (
													<div className="space-y-6">
														<div className="space-y-4">
															<h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
																<div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
																{config.outputTabTitle}
															</h4>
															<ScrollArea className="h-[calc(100vh-400px)] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
																<MemoizedCopySection
																	content={
																		completion || "Keine Inhalte verfügbar"
																	}
																	values={values}
																/>
															</ScrollArea>
														</div>

														{isLoading && (
															<div className="flex items-center justify-center gap-2 text-sm text-solarized-blue">
																<Loader2 className="h-4 w-4 animate-spin" />
																<span>Wird weiter generiert...</span>
															</div>
														)}
													</div>
												);
											}

											return (
												<div className="flex flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
													<div className="rounded-full bg-muted/20 p-6">
														<FileText className="h-16 w-16" />
													</div>
													<div className="space-y-2">
														<h3 className="font-semibold text-lg">
															{config.emptyStateTitle}
														</h3>
														<p className="max-w-md text-sm">
															{config.emptyStateDescription}
														</p>
														<Button
															className="mt-4"
															onClick={() => setActiveTab("input")}
															variant="outline"
														>
															Zu Eingabe wechseln
														</Button>
													</div>
												</div>
											);
										})()}
									</CardContent>
								</TabsContent>
							</Tabs>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
