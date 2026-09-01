"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "ai";
import { Bot, Info, Loader2, Mic, Paperclip, SendHorizonal, Sparkles } from "lucide-react";
import type { TagInspectorEditor } from "markdoc-md-editor/tag-inspector/tag-inspector";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AudioInput } from "@/app/_components/input-context/inputs/audio/audio-input";
import { DocumentInput } from "@/app/_components/input-context/inputs/document/document-input";
import type {
	InputContextAudioFile,
	InputContextController,
	InputContextFile,
} from "@/app/_components/input-context/types";
import { useInputContextClipboardPaste } from "@/app/_components/input-context/use-input-context-clipboard-paste";
import { useInputContextState } from "@/app/_components/input-context/use-input-context-state";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { isSuccessfulChatFinish } from "@/lib/aiscribe-toasts";
import { orpc } from "@/lib/orpc";

import { TagInspector } from "./tag-inspector-dynamic";

const INTRO_MESSAGE =
	"Beschreibe, was ich an der Vorlage ändern oder neu erstellen soll, oder stelle mir eine Frage zur Vorlage. Änderungen übernehme ich direkt in den Editor – gespeichert werden sie erst über den Speichern-Button.";
const UPDATE_TEMPLATE_TOOL_TYPE = "tool-updateTemplate";

interface MessageTextPart {
	type: "text";
	text: string;
}

interface UpdateTemplateToolPart {
	type: string;
	toolCallId?: string;
	state?: "input-streaming" | "input-available" | "output-available" | "output-error";
	output?: { content?: unknown; error?: unknown; ok?: unknown };
	errorText?: string;
}

const isTextPart = (part: { type: string }): part is MessageTextPart => part.type === "text";

const getMessageText = (message: UIMessage): string =>
	message.parts
		.filter(isTextPart)
		.map((part) => part.text)
		.join("");

const TemplateToolStatus = ({ part }: { part: UpdateTemplateToolPart }) => {
	if (part.state === "output-available" && part.output?.ok === true) {
		return (
			<div className="mr-4 rounded-lg border border-solarized-green/30 bg-solarized-green/10 px-3 py-2 text-solarized-green text-sm">
				Vorlage im Editor aktualisiert
			</div>
		);
	}

	if (
		part.state === "output-error" ||
		(part.state === "output-available" && part.output?.ok !== true)
	) {
		const error =
			typeof part.output?.error === "string"
				? part.output.error
				: (part.errorText ?? "Bearbeitung fehlgeschlagen.");
		return (
			<div className="mr-4 rounded-lg border border-solarized-red/30 bg-solarized-red/10 px-3 py-2 text-solarized-red text-sm">
				{error}
			</div>
		);
	}

	return (
		<div className="mr-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm">
			<Loader2 className="h-4 w-4 animate-spin" />
			Vorlage wird bearbeitet…
		</div>
	);
};

const TemplateAgentComposer = ({
	canSend,
	controller,
	instruction,
	isLoading,
	onInstructionChange,
	onSend,
}: {
	canSend: boolean;
	controller: InputContextController;
	instruction: string;
	isLoading: boolean;
	onInstructionChange: (value: string) => void;
	onSend: () => void;
}) => {
	const [openPanel, setOpenPanel] = useState<"audio" | "files" | null>(null);
	const [mountedPanels, setMountedPanels] = useState<Set<"audio" | "files">>(() => new Set());
	const [isRecording, setIsRecording] = useState(false);
	const handlePanelToggle = useCallback((panel: "audio" | "files") => {
		setMountedPanels((current) => (current.has(panel) ? current : new Set([...current, panel])));
		setOpenPanel((current) => (current === panel ? null : panel));
	}, []);
	const handlePaste = useInputContextClipboardPaste({
		controller,
		disabled: isLoading,
		onContextFilesAdded: () => {
			setMountedPanels((current) =>
				current.has("files") ? current : new Set([...current, "files"]),
			);
			setOpenPanel("files");
		},
	});
	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				onSend();
			}
		},
		[onSend],
	);

	return (
		<div className="flex flex-col overflow-hidden rounded-xl border border-input bg-background transition-colors focus-within:border-solarized-blue focus-within:ring-[3px] focus-within:ring-solarized-blue/20">
			{mountedPanels.has("audio") ? (
				<div
					className={cn(
						"max-h-40 overflow-y-auto border-b p-3",
						openPanel === "audio" ? undefined : "hidden",
					)}
				>
					<AudioInput
						disabled={isLoading}
						maxRecordings={controller.effectiveMaxRecordings}
						onRecordingChange={setIsRecording}
						onValueChange={controller.setAudioRecordings}
						value={controller.audioRecordings}
					/>
				</div>
			) : null}
			{mountedPanels.has("files") ? (
				<div
					className={cn(
						"max-h-40 overflow-y-auto border-b p-3",
						openPanel === "files" ? undefined : "hidden",
					)}
				>
					<DocumentInput
						disabled={isLoading}
						onAddFiles={controller.addContextFiles}
						onValueChange={controller.setContextFiles}
						value={controller.contextFiles}
					/>
				</div>
			) : null}
			<Textarea
				aria-label="Anweisung an den Template Agent"
				className="max-h-40 min-h-[5rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 shadow-none [field-sizing:content] focus-visible:ring-0"
				disabled={isLoading}
				maxLength={2000}
				onChange={(event) => onInstructionChange(event.target.value)}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
				placeholder="Anweisung an den Agent (⌘↵ zum Senden)…"
				value={instruction}
			/>
			<div className="flex items-center justify-between gap-2 px-2 pb-2">
				<div className="flex items-center gap-1">
					<Button
						aria-label="Dateien hinzufügen"
						className="relative h-9 w-9"
						disabled={isLoading}
						onClick={() => handlePanelToggle("files")}
						size="icon"
						title="Dateien hinzufügen"
						type="button"
						variant={openPanel === "files" ? "secondary" : "ghost"}
					>
						<Paperclip className="h-4 w-4" />
						{controller.hasContextFiles ? (
							<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-solarized-blue" />
						) : null}
					</Button>
					<Button
						aria-label={isRecording ? "Aufnahme läuft – Audio öffnen" : "Audio öffnen"}
						className="relative h-9 w-9"
						disabled={isLoading}
						onClick={() => handlePanelToggle("audio")}
						size="icon"
						title={isRecording ? "Aufnahme läuft – Audio öffnen" : "Audio öffnen"}
						type="button"
						variant={openPanel === "audio" ? "secondary" : "ghost"}
					>
						<Mic className={cn("h-4 w-4", isRecording && "text-solarized-red")} />
						{controller.hasAudioRecordings ? (
							<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-solarized-blue" />
						) : null}
					</Button>
				</div>
				<Button
					aria-label="Änderung anwenden"
					className="h-9 w-9 shrink-0"
					disabled={!canSend}
					onClick={onSend}
					size="icon"
					title="Änderung anwenden"
					type="button"
				>
					{isLoading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<SendHorizonal className="h-4 w-4" />
					)}
				</Button>
			</div>
		</div>
	);
};

export const TemplateEditorSidebar = ({
	content,
	editor,
	onContentChange,
}: {
	content: string;
	editor: TagInspectorEditor | null;
	onContentChange: (content: string) => void;
}) => {
	const [activeView, setActiveView] = useState("info");
	const [instruction, setInstruction] = useState("");
	const [isPreparing, setIsPreparing] = useState(false);
	const inputContext = useInputContextState();
	const contentRef = useRef(content);
	const onContentChangeRef = useRef(onContentChange);
	const appliedToolCallIds = useRef<Set<string>>(new Set());
	const submittedContextCleanupRef = useRef<(() => void) | null>(null);
	const pendingAttachmentsRef = useRef<{
		audioFiles: InputContextAudioFile[];
		contextFiles: InputContextFile[];
	}>({ audioFiles: [], contextFiles: [] });

	const { messages, sendMessage, status } = useChat({
		id: "template-agent",
		onError: (error) => {
			submittedContextCleanupRef.current = null;
			toast.error(
				getAiscribeErrorMessage(error) ?? "Der Template-Agent ist derzeit nicht erreichbar.",
			);
		},
		onFinish: ({ finishReason, isAbort, isError }) => {
			if (!isSuccessfulChatFinish({ finishReason, isAbort, isError })) {
				return;
			}
			submittedContextCleanupRef.current?.();
			submittedContextCleanupRef.current = null;
			setInstruction("");
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				const attachments = pendingAttachmentsRef.current;
				pendingAttachmentsRef.current = { audioFiles: [], contextFiles: [] };
				return eventIteratorToUnproxiedDataStream(
					await orpc.templateAgent.edit.call(
						{
							audioFiles: attachments.audioFiles,
							content: contentRef.current,
							contextFiles: attachments.contextFiles,
							messages: options.messages,
						},
						{ signal: options.abortSignal },
					),
				);
			},
		},
	});
	const isLoading = status === "streaming" || status === "submitted" || isPreparing;
	const hasAttachments = inputContext.hasAudioRecordings || inputContext.hasContextFiles;
	const canSend = !isLoading && (instruction.trim().length > 0 || hasAttachments);

	useEffect(() => {
		contentRef.current = content;
		onContentChangeRef.current = onContentChange;
	}, [content, onContentChange]);

	useEffect(() => {
		for (const message of messages) {
			if (message.role !== "assistant") {
				continue;
			}
			for (const part of message.parts) {
				if (part.type !== UPDATE_TEMPLATE_TOOL_TYPE) {
					continue;
				}
				const toolPart = part as UpdateTemplateToolPart;
				if (
					toolPart.state !== "output-available" ||
					!toolPart.toolCallId ||
					appliedToolCallIds.current.has(toolPart.toolCallId)
				) {
					continue;
				}
				if (toolPart.output?.ok === true && typeof toolPart.output.content === "string") {
					onContentChangeRef.current(toolPart.output.content);
					appliedToolCallIds.current.add(toolPart.toolCallId);
				}
			}
		}
	}, [messages]);

	const handleSend = useCallback(async () => {
		const trimmedInstruction = instruction.trim();
		if (isLoading || (!trimmedInstruction && !hasAttachments)) {
			return;
		}

		setIsPreparing(true);
		let submission: Awaited<ReturnType<typeof inputContext.prepareSubmission>>;
		try {
			submission = await inputContext.prepareSubmission();
		} catch (error) {
			setIsPreparing(false);
			toast.error(
				error instanceof Error ? error.message : "Anhänge konnten nicht vorbereitet werden.",
			);
			return;
		}
		setIsPreparing(false);

		pendingAttachmentsRef.current = {
			audioFiles: submission.audioFiles,
			contextFiles: submission.contextFiles,
		};
		const submittedAudioRecordings = inputContext.audioRecordings;
		submittedContextCleanupRef.current = () => {
			for (const recording of submittedAudioRecordings) {
				URL.revokeObjectURL(recording.url);
			}
			inputContext.setAudioRecordings([]);
			inputContext.setContextFiles([]);
		};

		const attachmentLabels = [
			submission.audioFiles.length > 0 ? `${submission.audioFiles.length} Audio` : "",
			submission.contextFiles.length > 0 ? `${submission.contextFiles.length} Datei(en)` : "",
		].filter(Boolean);
		const attachmentNote =
			attachmentLabels.length > 0 ? `\n\n📎 ${attachmentLabels.join(", ")}` : "";
		const text = `${trimmedInstruction || "Bitte berücksichtige die Anhänge."}${attachmentNote}`;
		try {
			await sendMessage({ text });
		} catch (error) {
			submittedContextCleanupRef.current = null;
			toast.error(
				getAiscribeErrorMessage(error) ?? "Der Template-Agent ist derzeit nicht erreichbar.",
			);
		}
	}, [hasAttachments, inputContext, instruction, isLoading, sendMessage]);

	return (
		<Card className="flex h-full flex-col overflow-hidden">
			<Tabs className="min-h-0 flex-1 gap-0" onValueChange={setActiveView} value={activeView}>
				<div className="shrink-0 border-b p-2">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="info">
							<Info className="mr-1.5 h-3.5 w-3.5" />
							Info
						</TabsTrigger>
						<TabsTrigger value="agent">
							<Sparkles className="mr-1.5 h-3.5 w-3.5" />
							Agent
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent className="mt-0 flex min-h-0 flex-col" value="agent">
					<div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
						<span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10">
							<Bot className="h-4 w-4 text-primary" />
						</span>
						<div>
							<p className="font-semibold text-sm">Template Agent</p>
							<p className="text-muted-foreground text-xs">Hilft und ändert die aktuelle Vorlage</p>
						</div>
					</div>
					<ScrollArea className="min-h-0 flex-1">
						<div className="space-y-3 p-3" aria-live="polite">
							<div className="mr-4 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
								{INTRO_MESSAGE}
							</div>
							{messages.map((message) => {
								if (message.role === "user") {
									return (
										<div
											className="ml-6 whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
											key={message.id}
										>
											{getMessageText(message)}
										</div>
									);
								}

								return message.parts.map((part, index) => {
									if (isTextPart(part) && part.text.trim().length > 0) {
										return (
											<div
												className="mr-4 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
												key={`${message.id}-text-${index}`}
											>
												{part.text}
											</div>
										);
									}
									if (part.type === UPDATE_TEMPLATE_TOOL_TYPE) {
										const toolPart = part as UpdateTemplateToolPart;
										return (
											<TemplateToolStatus
												key={toolPart.toolCallId ?? `${message.id}-tool-${index}`}
												part={toolPart}
											/>
										);
									}
									return null;
								});
							})}
							{isLoading ? (
								<div className="mr-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm">
									<Loader2 className="h-4 w-4 animate-spin" />
									Agent denkt nach…
								</div>
							) : null}
						</div>
					</ScrollArea>
					<div className="shrink-0 border-t p-3">
						<TemplateAgentComposer
							canSend={canSend}
							controller={inputContext}
							instruction={instruction}
							isLoading={isLoading}
							onInstructionChange={setInstruction}
							onSend={handleSend}
						/>
					</div>
				</TabsContent>

				<TabsContent className="mt-0 min-h-0" value="info">
					<TagInspector className="h-full rounded-none border-0 shadow-none" editor={editor} />
				</TabsContent>
			</Tabs>
		</Card>
	);
};
