"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@repo/design-system/components/ui/card";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { FileText } from "lucide-react";
import { createMdscribeSource } from "markdoc-md/citations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useCase } from "@/app/_components/input-context/case-context";
import { InputContextControls } from "@/app/_components/input-context/input-context-controls";
import type { InputContextSubmission } from "@/app/_components/input-context/types";
import { TemplateNavigation } from "@/app/templates/_components/template-navigation";
import { CitedResponse } from "@/features/response-citations/cited-response";
import { useTextSnippets } from "@/hooks/use-text-snippets";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { hasLessThanTenPercentUsageRemaining, isSuccessfulChatFinish } from "@/lib/aiscribe-toasts";
import { trackEvent } from "@/lib/analytics";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

import { ContextTemplateCard } from "./context-template-card";

/** AI Scribe for a template with at most one section; see `/aiscribe/[id]`. */
interface AiscribeTemplateConfig {
	author: string;
	templateId: string;
	title: string;
}

interface AiscribeTemplateProps {
	config: AiscribeTemplateConfig;
}

export const AiscribeTemplate = ({ config }: AiscribeTemplateProps) => {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState("input");
	const [citationFiles, setCitationFiles] = useState<ReadonlyMap<string, File>>(new Map());
	const [citationOcrResults, setCitationOcrResults] = useState<ReadonlyMap<string, OcrResult>>(
		new Map(),
	);
	const inputContextController = useCase();
	// Use ref for audio files to avoid race condition between setState and sendMessage
	const preparedAudioFilesRef = useRef<AudioFile[]>([]);
	const preparedContextFilesRef = useRef<FillInputsContextFile[]>([]);

	// Initialize text snippets hook
	useTextSnippets();

	const handleSuccessfulGeneration = useCallback(async () => {
		trackEvent("ai-scribe-used", { source: "template" });
		toast.success(USER_MESSAGES.aiscribeGenerationSuccess);

		try {
			const usage = await orpc.getUsage.call();
			if (!hasLessThanTenPercentUsageRemaining(usage.usage.monthlyUsagePercentage)) {
				return;
			}

			toast.warning(USER_MESSAGES.lowScribeUsageRemaining, {
				...(usage.subscriptionsEnabled
					? {
							action: {
								label: USER_MESSAGES.lowScribeUsageSubscriptionAction,
								onClick: () => router.push("/subscription"),
							},
						}
					: {}),
				id: "aiscribe-low-usage",
			});
		} catch {
			// A failed usage refresh must not turn a successful generation into an error.
		}
	}, [router]);

	// Use AI SDK useChat with custom oRPC transport
	const { messages, sendMessage, status, setMessages } = useChat<OcrUIMessage>({
		id: `scribe-template-${config.templateId}`,
		onData: (part) => {
			if (part.type === "data-ocr-results" && Array.isArray(part.data)) {
				inputContextController.setContextFileOcrResults(part.data);
				setCitationOcrResults(
					new Map(
						preparedContextFilesRef.current.flatMap((file, index) => {
							const result = part.data[index];
							return file.id && result
								? [[createMdscribeSource("file", file.id), result] as const]
								: [];
						}),
					),
				);
			}
		},
		onError: (error) => {
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
		},
		onFinish: ({ finishReason, isAbort, isError }) => {
			// Clear prepared media refs after generation
			preparedAudioFilesRef.current = [];
			preparedContextFilesRef.current = [];

			if (!isSuccessfulChatFinish({ finishReason, isAbort, isError })) {
				return;
			}

			void handleSuccessfulGeneration();
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				// Read from refs to get the latest media files synchronously
				const audioFiles = preparedAudioFilesRef.current;
				const contextFiles = preparedContextFilesRef.current;
				const requestInput = {
					audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
					contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
					messages: options.messages,
					templateId: config.templateId,
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
		const lastAssistantMessage = messages.findLast((m) => m.role === "assistant");
		if (!lastAssistantMessage) {
			return "";
		}
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
	const responseMessage = messages.findLast((m) => m.role === "assistant");

	const handleSwitchToInputTab = useCallback(() => {
		setActiveTab("input");
	}, []);

	// The input context prepares the submission (OCR, audio) before this runs.
	const handleGenerate = useCallback(
		async (submission: InputContextSubmission) => {
			setMessages([]);
			setActiveTab("output");

			// Use refs to avoid race condition - ref updates are synchronous.
			preparedAudioFilesRef.current = submission.audioFiles;
			preparedContextFilesRef.current = submission.contextFiles;
			setCitationFiles(new Map(submission.preparedContextFiles.map(({ file, id }) => [id, file])));
			setCitationOcrResults(
				new Map(
					submission.contextFiles.flatMap((file) =>
						file.id && file.kind === "ocr"
							? [[createMdscribeSource("file", file.id), file.ocrResult] as const]
							: [],
					),
				),
			);

			try {
				await sendMessage({ text: JSON.stringify(submission.textContext) });
			} catch (error) {
				// Catch any unexpected errors not handled by onError callback
				const message = getAiscribeErrorMessage(error);
				if (message) {
					toast.error(message);
				}
			}
		},
		[setMessages, sendMessage],
	);

	return (
		<div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
			<div className="mx-auto max-w-7xl space-y-8">
				<TemplateNavigation
					aiscribe
					entry={{ id: config.templateId, kind: "text", title: config.title }}
				/>

				<div className="grid grid-cols-1 gap-8 lg:grid-cols-5 xl:grid-cols-6">
					{/* Context Metadata Card */}
					<div className="space-y-6 lg:col-span-2 xl:col-span-2">
						<ContextTemplateCard
							author={config.author}
							note="Der Text wird nach dieser Vorlage und ihren Anweisungen generiert."
							template={{ href: `/templates/${config.templateId}`, title: config.title }}
							warning={
								<>
									⚠️ <strong>Datenschutzhinweis:</strong> Geben Sie keine privaten Patientendaten
									ein! Diese Informationen werden an eine KI gesendet. Verwenden Sie nur
									anonymisierte Daten.
								</>
							}
						/>
					</div>

					{/* Main Content with Tabs */}
					<div className="lg:col-span-3 xl:col-span-4">
						<Card className="border-solarized-green/20 shadow-lg">
							<Tabs className="w-full" onValueChange={setActiveTab} value={activeTab}>
								<CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
									<TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
										<TabsTrigger
											className="data-active:bg-solarized-blue data-active:text-primary-foreground"
											value="input"
										>
											Eingabe
										</TabsTrigger>
										<TabsTrigger
											className="data-active:bg-solarized-blue data-active:text-primary-foreground"
											value="output"
										>
											Ergebnis
										</TabsTrigger>
									</TabsList>
								</CardHeader>

								{/* Input Tab */}
								<TabsContent className="space-y-0" value="input">
									<CardContent>
										<InputContextControls
											controller={inputContextController}
											defaultPanel="text"
											disabled={isLoading}
											onSubmit={handleGenerate}
											pendingLabel="Wird generiert…"
											submitLabel="Generieren"
											variant="tabs"
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
											<div className="flex items-center gap-2">
												<Kbd>⌘⇧2</Kbd>
												<span>für Aufnahme</span>
											</div>
											<Link
												className="flex items-center gap-2 rounded px-2 py-1 transition "
												href="/profile/texteditor"
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
																Bitte warten Sie, während der KI-Assistent Ihren Inhalt erstellt
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
																Ergebnis
															</h4>
															<ScrollArea className="h-[calc(100dvh-400px)] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
																<CitedResponse
																	content={completion || "Keine Inhalte verfügbar"}
																	files={citationFiles}
																	isStreaming={isLoading}
																	key={responseMessage?.id}
																	message={responseMessage}
																	ocrResults={citationOcrResults}
																/>
															</ScrollArea>
														</div>
													</div>
												);
											}

											return (
												<div className="flex flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
													<div className="rounded-full bg-muted/20 p-6">
														<FileText className="h-16 w-16" />
													</div>
													<div className="space-y-2">
														<h3 className="font-semibold text-lg">Noch kein Text generiert</h3>
														<p className="max-w-md text-sm">
															Geben Sie Notizen, Audio oder Dateien ein, um den Text zu generieren.
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
