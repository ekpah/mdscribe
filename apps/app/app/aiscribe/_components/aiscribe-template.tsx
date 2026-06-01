"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useTextSnippets } from "@/hooks/use-text-snippets";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { AudioFile, DocumentType, FillInputsContextFile } from "@/orpc/scribe/types";
import { useInputContextState } from "@/app/_components/input-context/input-context-controls";
import { AiscribeTemplateInputSection } from "./aiscribe-template-input-section";
import { MemoizedCopySection } from "./memoized-copy-section";

export interface AdditionalInputField {
	name: string;
	label: string;
	placeholder: string;
	required?: boolean;
	type?: "text" | "textarea";
	description?: string;
}

interface AiscribeContextMetadata {
	author: "MDScribe-Standard";
	harnessTitle: string;
	template: {
		href?: string;
		title: string;
	};
}

interface AiscribeTemplateBaseConfig {
	// Page identity
	title: string;
	description: string;
	icon: LucideIcon;
	contextMetadata: AiscribeContextMetadata;

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

interface DocumentTypeAiscribeTemplateConfig extends AiscribeTemplateBaseConfig {
	documentType: DocumentType;
	formId?: never;
}

interface CustomFormAiscribeTemplateConfig extends AiscribeTemplateBaseConfig {
	documentType?: never;
	formId: string;
}

export type AiscribeTemplateConfig =
	| DocumentTypeAiscribeTemplateConfig
	| CustomFormAiscribeTemplateConfig;

interface AiscribeTemplateProps {
	config: AiscribeTemplateConfig;
}

const ContextMetadataRow = ({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) => (
	<div className="grid gap-1">
		<div className="font-medium text-muted-foreground text-xs">{label}</div>
		<div className="text-sm text-foreground">{children}</div>
	</div>
);

export const AiscribeTemplate = ({ config }: AiscribeTemplateProps) => {
	const [activeTab, setActiveTab] = useState("input");
	const [inputData, setInputData] = useState("");
	const [additionalInputData, setAdditionalInputData] = useState<
		Record<string, string>
	>({});
	const values = useMemo<Record<string, unknown>>(() => ({}), []);
	const inputContextController = useInputContextState();
	// Use ref for audio files to avoid race condition between setState and sendMessage
	const preparedAudioFilesRef = useRef<AudioFile[]>([]);
	const preparedContextFilesRef = useRef<FillInputsContextFile[]>([]);
	const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
	const { customApiCall, customPromptProcessor, inputFieldName } = config;

	// Initialize text snippets hook
	useTextSnippets();

	const isCustomFormConfig =
		"formId" in config && typeof config.formId === "string";
	const chatId = isCustomFormConfig
		? `scribe-form-${config.formId}`
		: `scribe-${config.documentType}`;

	// Use AI SDK useChat with custom oRPC transport
	const { messages, sendMessage, status, setMessages } = useChat({
		id: chatId,
		onError: (error) => {
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
		},
		onFinish: () => {
			toast.success("Erfolgreich generiert");
			// Clear prepared media refs after generation
			preparedAudioFilesRef.current = [];
			preparedContextFilesRef.current = [];
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				// Read from refs to get the latest media files synchronously
				const audioFiles = preparedAudioFilesRef.current;
				const contextFiles = preparedContextFilesRef.current;
				const requestInput = isCustomFormConfig
					? {
							audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
							contextFiles:
								contextFiles.length > 0 ? contextFiles : undefined,
							formId: config.formId,
							messages: options.messages,
							source: "customForm" as const,
						}
					: {
							audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
							contextFiles:
								contextFiles.length > 0 ? contextFiles : undefined,
							documentType: config.documentType,
							messages: options.messages,
							source: "documentType" as const,
						};

				return eventIteratorToUnproxiedDataStream(
					await orpc.scribeStream.call(requestInput, {
						signal: options.abortSignal,
					}),
				);
			},
		},
	});

	// Extract completion text from the last assistant message
	const completion = useMemo(() => {
		const lastAssistantMessage = messages.findLast(
			(m) => m.role === "assistant",
		);
		if (!lastAssistantMessage) {return "";}
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

	const handleMainInputValueChange = useCallback((value: string) => {
		setInputData(value);
	}, []);

	const handleSwitchToInputTab = useCallback(() => {
		setActiveTab("input");
	}, []);

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
		const hasAudio = inputContextController.hasAudioRecordings;
		const hasFiles = inputContextController.hasContextFiles;

		// Check if main input field has content
		const hasMainInput = inputData.trim().length > 0;

		// Check if any additional input field has content
		const hasAnyAdditionalInput = config.additionalInputs?.some(
			(field) =>
				additionalInputData[field.name] &&
				additionalInputData[field.name].trim().length > 0,
		);

		// At least one field must be filled (text, audio, files, or additional input)
		return hasAudio || hasFiles || hasMainInput || hasAnyAdditionalInput;
	}, [
		inputContextController.hasAudioRecordings,
		inputContextController.hasContextFiles,
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
			if (customApiCall) {
				await customApiCall(inputData, additionalInputData);
			}

			// Prepare prompt
			const prompt = customPromptProcessor
				? customPromptProcessor(inputData, additionalInputData)
				: JSON.stringify({
						[inputFieldName]: inputData,
						...additionalInputData,
					});

			const inputContextPayload = await inputContextController.prepareSubmission();
			// Use refs to avoid race condition - ref updates are synchronous.
			preparedAudioFilesRef.current = inputContextPayload.audioFiles;
			preparedContextFilesRef.current = inputContextPayload.contextFiles;

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
		customApiCall,
		customPromptProcessor,
		inputFieldName,
		inputContextController,
	]);

	useHotkeys(
		["meta+shift+1", "ctrl+shift+1"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			mainTextareaRef.current?.focus();
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
			if (
				!isLoading &&
				!hasMissingRequiredFields &&
				areRequiredFieldsFilled()
			) {
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
					{/* Context Metadata Card */}
					<div className="lg:col-span-2 xl:col-span-2">
						<Card className="h-fit border-solarized-blue/20 shadow-lg">
							<CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-green/5">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<div className="h-2 w-2 rounded-full bg-solarized-blue" />
										<CardTitle className="text-base text-foreground">
											Kontext & Vorlage
										</CardTitle>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-6 p-6">
								<div className="rounded-lg border border-muted-foreground/20 border-dashed bg-muted/20 p-4">
									<div className="space-y-5">
										<ContextMetadataRow label="Template">
											{config.contextMetadata.template.href ? (
												<Link
													className="inline-flex items-center gap-1 font-medium text-solarized-blue transition hover:text-solarized-blue/80"
													href={config.contextMetadata.template.href}
													rel="noreferrer"
													target="_blank"
												>
													<span className="break-words">
														{config.contextMetadata.template.title}
													</span>
													<ExternalLink className="h-3.5 w-3.5 shrink-0" />
												</Link>
											) : (
												<span className="break-words">
													{config.contextMetadata.template.title}
												</span>
											)}
										</ContextMetadataRow>
										<ContextMetadataRow label="Prompt">
											{config.contextMetadata.harnessTitle}
										</ContextMetadataRow>
										<ContextMetadataRow label="Autor">
											{config.contextMetadata.author}
										</ContextMetadataRow>
									</div>
								</div>

								<div className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-4 text-xs">
									<p className="text-solarized-green leading-relaxed">
										Diese Angaben zeigen, welche Vorlage und welcher
										Prompt für die aktuelle Generierung verwendet werden.
									</p>
								</div>

								<div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-4 text-xs">
									<p className="text-solarized-red leading-relaxed">
										⚠️ <strong>Datenschutzhinweis:</strong> Geben Sie keine privaten
										Patientendaten ein! Diese Informationen werden an eine KI gesendet.
										Verwenden Sie nur anonymisierte Daten.
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
									<CardContent>
										<AiscribeTemplateInputSection
											additionalInputData={additionalInputData}
											additionalInputs={config.additionalInputs}
											inputContextController={inputContextController}
											inputPlaceholder={config.inputPlaceholder}
											inputValue={inputData}
											isLoading={isLoading}
											onAdditionalInputChange={handleAdditionalInputChange}
											onInputValueChange={handleMainInputValueChange}
											onSubmit={handleGenerate}
											submitDisabled={
												hasMissingRequiredFields || !areRequiredFieldsFilled()
											}
											textareaId="input-field"
											textareaRef={mainTextareaRef}
										/>
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
																onClick={handleSwitchToInputTab}
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
};
