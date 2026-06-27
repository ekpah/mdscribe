"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Bubble, BubbleContent } from "@repo/design-system/components/ui/bubble";
import { Button } from "@repo/design-system/components/ui/button";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { Marker, MarkerContent, MarkerIcon } from "@repo/design-system/components/ui/marker";
import { Message, MessageContent } from "@repo/design-system/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@repo/design-system/components/ui/message-scroller";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "ai";
import { Bot, Loader2, Mic, Paperclip, PencilLine, SendHorizonal } from "lucide-react";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

import { AudioInput } from "@/app/_components/input-context/inputs/audio/audio-input";
import type { AudioInputHandle } from "@/app/_components/input-context/inputs/audio/audio-input";
import { DocumentInput } from "@/app/_components/input-context/inputs/document/document-input";
import type {
	AudioRecording,
	InputContextAudioFile,
	InputContextController,
	InputContextFile,
	UploadedContextFile,
} from "@/app/_components/input-context/types";
import { useInputContextClipboardPaste } from "@/app/_components/input-context/use-input-context-clipboard-paste";
import { useInputContextState } from "@/app/_components/input-context/use-input-context-state";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { orpc } from "@/lib/orpc";
import type { ScribeAgentSection } from "@/orpc/scribe-agent";

const INTRO_TEXT =
	"Hallo! Ich bin der Dokumentations-Agent. Beschreiben Sie eine Änderung – ich kann einzelne Abschnitte des Arztbriefs neu generieren oder gezielt anpassen. Der Inhalt des Briefs links dient mir als Kontext.";

// Tool types whose successful output the client applies back into the editor.
const SECTION_EDIT_TOOL_TYPES = new Set(["tool-generateSection", "tool-editSection"]);

interface SectionToolOutput {
	ok?: unknown;
	sectionId?: unknown;
	content?: unknown;
	error?: unknown;
}

interface MessageTextPart {
	type: "text";
	text: string;
}

const isTextPart = (part: { type: string }): part is MessageTextPart => part.type === "text";

const getMessageText = (message: UIMessage): string =>
	message.parts
		.filter(isTextPart)
		.map((part) => part.text)
		.join("");

const getToolOutput = (part: { type: string }): SectionToolOutput | undefined =>
	(part as { output?: SectionToolOutput }).output;

const getAppliedSectionIds = (message: UIMessage): string[] => {
	const ids: string[] = [];
	for (const part of message.parts) {
		if (!SECTION_EDIT_TOOL_TYPES.has(part.type)) {
			continue;
		}
		const output = getToolOutput(part);
		if (output?.ok === true && typeof output.sectionId === "string") {
			ids.push(output.sectionId);
		}
	}
	return ids;
};

const isFileDragEvent = (event: DragEvent<HTMLDivElement>, disabled: boolean): boolean =>
	!event.defaultPrevented && !disabled && [...event.dataTransfer.types].includes("Files");

/**
 * Composer toolbar toggle (paperclip / mic) with a status dot: pulsing red while
 * recording, green once the panel holds content.
 */
const ComposerToggleButton = ({
	ariaLabel,
	disabled,
	hasValue,
	icon,
	isActive,
	isRecording = false,
	onClick,
	title,
}: {
	ariaLabel: string;
	disabled?: boolean;
	hasValue: boolean;
	icon: ReactNode;
	isActive: boolean;
	isRecording?: boolean;
	onClick: () => void;
	title?: string;
}) => {
	let indicator: ReactNode = null;
	if (isRecording) {
		indicator = (
			<span className="absolute top-1 right-1 h-1.5 w-1.5 animate-pulse rounded-full bg-solarized-red" />
		);
	} else if (hasValue) {
		indicator = (
			<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-solarized-green" />
		);
	}

	return (
		<Button
			aria-label={ariaLabel}
			aria-pressed={isActive}
			className="relative h-9 w-9 text-muted-foreground"
			disabled={disabled}
			onClick={onClick}
			size="icon"
			title={title}
			type="button"
			variant={isActive ? "secondary" : "ghost"}
		>
			{icon}
			{indicator}
		</Button>
	);
};

interface AgentComposerHandle {
	/** Expand the audio panel (used when transferred context contains recordings). */
	openAudioPanel: () => void;
	/** Expand the file panel (used when files are dropped on the card). */
	openFilesPanel: () => void;
	/** Collapse any expanded context panel (used after a successful send). */
	collapsePanels: () => void;
}

/**
 * Chat-style composer: the instruction input plus the reused audio/file context
 * panels, laid out as one card (context panels stack above the input, toggles
 * sit bottom-left, send bottom-right). Owns the expand/recording UI state and
 * the focus/record hotkeys; the captured context lives in the shared
 * `controller`. The imperative handle lets the surrounding card open the file
 * panel on drop and collapse panels after a turn is sent.
 */
const AgentComposer = forwardRef<
	AgentComposerHandle,
	{
		canSend: boolean;
		controller: InputContextController;
		disabled: boolean;
		instruction: string;
		isLoading: boolean;
		onInstructionChange: (value: string) => void;
		onSend: () => void;
	}
>(({ canSend, controller, disabled, instruction, isLoading, onInstructionChange, onSend }, ref) => {
	const [openPanel, setOpenPanel] = useState<"audio" | "files" | null>(null);
	const [mountedPanels, setMountedPanels] = useState<Set<"audio" | "files">>(() => new Set());
	const [isRecording, setIsRecording] = useState(false);
	const [recordingShortcutRequest, setRecordingShortcutRequest] = useState(0);
	const handledRecordingRequestRef = useRef(0);
	const audioInputRef = useRef<AudioInputHandle>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fieldsDisabled = disabled || isLoading;

	const markPanelMounted = useCallback((panel: "audio" | "files") => {
		setMountedPanels((previous) =>
			previous.has(panel) ? previous : new Set([...previous, panel]),
		);
	}, []);

	const handlePanelToggle = useCallback(
		(panel: "audio" | "files") => {
			markPanelMounted(panel);
			setOpenPanel((previous) => (previous === panel ? null : panel));
		},
		[markPanelMounted],
	);

	useImperativeHandle(
		ref,
		() => ({
			collapsePanels: () => {
				setOpenPanel(null);
			},
			openAudioPanel: () => {
				markPanelMounted("audio");
				setOpenPanel("audio");
			},
			openFilesPanel: () => {
				markPanelMounted("files");
				setOpenPanel("files");
			},
		}),
		[markPanelMounted],
	);

	const handleInstructionKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				onSend();
			}
		},
		[onSend],
	);
	const handleInputContextPaste = useInputContextClipboardPaste({
		controller,
		disabled: fieldsDisabled,
		onContextFilesAdded: () => {
			markPanelMounted("files");
			setOpenPanel("files");
		},
	});
	const requestRecordingToggle = useCallback(() => {
		if (disabled) {
			return;
		}
		markPanelMounted("audio");
		setOpenPanel("audio");
		setRecordingShortcutRequest((request) => request + 1);
	}, [disabled, markPanelMounted]);

	// The audio panel mounts lazily, so a record shortcut fired while it is
	// closed must wait until the panel is open before toggling the recorder.
	useEffect(() => {
		if (
			recordingShortcutRequest === 0 ||
			handledRecordingRequestRef.current === recordingShortcutRequest ||
			openPanel !== "audio"
		) {
			return;
		}
		handledRecordingRequestRef.current = recordingShortcutRequest;
		audioInputRef.current?.toggleRecording();
	}, [openPanel, recordingShortcutRequest]);

	useHotkeys(
		["meta+shift+1", "ctrl+shift+1"],
		(event) => {
			event.preventDefault();
			event.stopPropagation();
			textareaRef.current?.focus();
		},
		{ enableOnFormTags: ["INPUT", "TEXTAREA"], enabled: !disabled },
		[disabled],
	);

	useHotkeys(
		["meta+shift+2", "ctrl+shift+2"],
		(event) => {
			event.preventDefault();
			event.stopPropagation();
			requestRecordingToggle();
		},
		{ enableOnFormTags: ["INPUT", "TEXTAREA"], enabled: !disabled },
		[disabled, requestRecordingToggle],
	);

	return (
		<div className="flex flex-col overflow-hidden rounded-xl border border-input bg-background transition-colors focus-within:border-solarized-blue focus-within:ring-[3px] focus-within:ring-solarized-blue/20">
			{mountedPanels.has("audio") ? (
				<div className={cn("border-b p-3", openPanel === "audio" ? undefined : "hidden")}>
					<AudioInput
						disabled={fieldsDisabled}
						maxRecordings={controller.effectiveMaxRecordings}
						onRecordingChange={setIsRecording}
						onValueChange={controller.setAudioRecordings}
						ref={audioInputRef}
						value={controller.audioRecordings}
					/>
				</div>
			) : null}
			{mountedPanels.has("files") ? (
				<div className={cn("border-b p-3", openPanel === "files" ? undefined : "hidden")}>
					<DocumentInput
						disabled={fieldsDisabled}
						onAddFiles={controller.addContextFiles}
						onValueChange={controller.setContextFiles}
						value={controller.contextFiles}
					/>
				</div>
			) : null}

			<Textarea
				className="max-h-40 min-h-[3.25rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 shadow-none [field-sizing:content] focus-visible:ring-0"
				disabled={fieldsDisabled}
				onChange={(event) => {
					onInstructionChange(event.target.value);
				}}
				onKeyDown={handleInstructionKeyDown}
				onPaste={handleInputContextPaste}
				placeholder="Anweisung an den Agent (⌘↵ zum Senden)…"
				ref={textareaRef}
				value={instruction}
			/>

			<div className="flex items-center justify-between gap-2 px-2 pb-2">
				<div className="flex items-center gap-1">
					<ComposerToggleButton
						ariaLabel="Dateien hinzufügen"
						disabled={fieldsDisabled}
						hasValue={controller.hasContextFiles}
						icon={<Paperclip className="h-4 w-4" />}
						isActive={openPanel === "files"}
						onClick={() => {
							handlePanelToggle("files");
						}}
						title="Dateien hinzufügen"
					/>
					<ComposerToggleButton
						ariaLabel={
							isRecording ? "Aufnahme läuft – Audio-Kontext öffnen" : "Audio-Kontext öffnen"
						}
						disabled={fieldsDisabled}
						hasValue={controller.hasAudioRecordings}
						icon={<Mic className={cn("h-4 w-4", isRecording && "text-solarized-red")} />}
						isActive={openPanel === "audio"}
						isRecording={isRecording}
						onClick={() => {
							handlePanelToggle("audio");
						}}
						title={isRecording ? "Aufnahme läuft – Audio-Kontext öffnen" : "Audio-Kontext öffnen"}
					/>
				</div>
				<Button
					aria-label="An Agent senden"
					className="h-9 w-9 shrink-0"
					disabled={!canSend}
					onClick={onSend}
					size="icon"
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
});

AgentComposer.displayName = "AgentComposer";

interface DoctorsNoteAgentPanelProps {
	/** Current sections of the letter, sent with each turn as the agent's context. */
	sections: ScribeAgentSection[];
	/** Stage a section edit from the agent as a proposal (reviewed via diff). */
	onProposeEdit: (sectionId: string, content: string) => void;
	/** Context transferred from another AIScribe page into the agent composer. */
	initialContext?: {
		audioRecordings: AudioRecording[];
		contextFiles: UploadedContextFile[];
	} | null;
	disabled?: boolean;
}

/**
 * Right-column documentation agent (text-only MVP).
 *
 * Chats with `orpc.scribeAgent.chat`; the agent edits the letter by calling the
 * `editSection` tool, whose calls are applied back into the editor's section
 * state. The left letter is the agent's context, so there is no separate
 * text-context input.
 */
export const DoctorsNoteAgentPanel = ({
	sections,
	onProposeEdit,
	initialContext,
	disabled = false,
}: DoctorsNoteAgentPanelProps) => {
	const [instruction, setInstruction] = useState("");
	const [isDraggingFiles, setIsDraggingFiles] = useState(false);
	const inputContext = useInputContextState();
	const hydratedInitialContextRef = useRef(false);
	const composerRef = useRef<AgentComposerHandle>(null);

	// Latest sections/handler read synchronously by the transport + apply effect.
	const sectionsRef = useRef(sections);
	sectionsRef.current = sections;
	const onProposeEditRef = useRef(onProposeEdit);
	onProposeEditRef.current = onProposeEdit;
	const appliedToolCallIds = useRef<Set<string>>(new Set());
	const submittedContextCleanupRef = useRef<(() => void) | null>(null);
	// Attachments belong to the turn they were sent with; the transport reads and
	// clears this ref so follow-up turns are not re-sent the same media.
	const pendingAttachmentsRef = useRef<{
		audioFiles: InputContextAudioFile[];
		contextFiles: InputContextFile[];
	}>({ audioFiles: [], contextFiles: [] });

	const sectionLabelById = useMemo(() => {
		const map = new Map<string, string>();
		for (const section of sections) {
			map.set(section.id, section.label);
		}
		return map;
	}, [sections]);

	const { messages, sendMessage, status } = useChat({
		id: "scribe-agent",
		onError: (error) => {
			submittedContextCleanupRef.current = null;
			toast.error(getAiscribeErrorMessage(error) ?? "Der Agent ist derzeit nicht erreichbar.");
		},
		onFinish: () => {
			submittedContextCleanupRef.current?.();
			submittedContextCleanupRef.current = null;
			setInstruction("");
			// After a successful send, collapse any expanded panel so the text input is shown.
			composerRef.current?.collapsePanels();
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				const attachments = pendingAttachmentsRef.current;
				pendingAttachmentsRef.current = { audioFiles: [], contextFiles: [] };
				return eventIteratorToUnproxiedDataStream(
					await orpc.scribeAgent.chat.call(
						{
							audioFiles: attachments.audioFiles,
							contextFiles: attachments.contextFiles,
							messages: options.messages,
							sections: sectionsRef.current,
						},
						{ signal: options.abortSignal },
					),
				);
			},
		},
	});

	const isLoading = status === "streaming" || status === "submitted";

	useEffect(() => {
		if (hydratedInitialContextRef.current || !initialContext) {
			return;
		}
		hydratedInitialContextRef.current = true;
		inputContext.setAudioRecordings(initialContext.audioRecordings);
		inputContext.setContextFiles(initialContext.contextFiles);
		if (initialContext.contextFiles.length > 0) {
			composerRef.current?.openFilesPanel();
		} else if (initialContext.audioRecordings.length > 0) {
			composerRef.current?.openAudioPanel();
		}
	}, [initialContext, inputContext]);

	// Apply completed section-tool outputs back into the editor exactly once.
	useEffect(() => {
		for (const message of messages) {
			if (message.role !== "assistant") {
				continue;
			}
			for (const part of message.parts) {
				if (!SECTION_EDIT_TOOL_TYPES.has(part.type)) {
					continue;
				}
				const toolPart = part as {
					type: string;
					toolCallId?: string;
					state?: string;
					output?: SectionToolOutput;
				};
				const { output, state, toolCallId } = toolPart;
				if (
					!toolCallId ||
					appliedToolCallIds.current.has(toolCallId) ||
					state !== "output-available"
				) {
					continue;
				}
				if (
					output?.ok === true &&
					typeof output.sectionId === "string" &&
					typeof output.content === "string"
				) {
					onProposeEditRef.current(output.sectionId, output.content);
					appliedToolCallIds.current.add(toolCallId);
				}
			}
		}
	}, [messages]);

	const hasAttachments = inputContext.hasAudioRecordings || inputContext.hasContextFiles;
	const canSend = !(isLoading || disabled) && (instruction.trim().length > 0 || hasAttachments);

	const handleSend = useCallback(async () => {
		const trimmed = instruction.trim();
		if (isLoading || disabled) {
			return;
		}
		if (!trimmed && !hasAttachments) {
			return;
		}

		let submission: Awaited<ReturnType<typeof inputContext.prepareSubmission>>;
		try {
			submission = await inputContext.prepareSubmission();
		} catch (error) {
			if (error instanceof Error && error.message) {
				toast.error(error.message);
			}
			return;
		}

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
			inputContext.setTextContext({});
		};

		// Summarize attachments in the visible user bubble; the bytes themselves
		// travel out-of-band via the transport ref and are injected server-side.
		const attachmentNotes: string[] = [];
		if (submission.audioFiles.length > 0) {
			attachmentNotes.push(
				`${submission.audioFiles.length} Audioaufnahme${submission.audioFiles.length === 1 ? "" : "n"}`,
			);
		}
		if (submission.contextFiles.length > 0) {
			attachmentNotes.push(
				`${submission.contextFiles.length} Datei${submission.contextFiles.length === 1 ? "" : "en"}`,
			);
		}
		const attachmentNote = attachmentNotes.length > 0 ? `\n\n📎 ${attachmentNotes.join(", ")}` : "";
		const text = `${trimmed || "Bitte berücksichtige die Anhänge."}${attachmentNote}`;

		void sendMessage({ text });
	}, [disabled, hasAttachments, inputContext, instruction, isLoading, sendMessage]);

	// Files dropped anywhere on the agent card are added as context and the file
	// panel is opened so the drop is visible.
	const handleDragEnter = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!isFileDragEvent(event, disabled)) {
				return;
			}
			event.preventDefault();
			setIsDraggingFiles(true);
		},
		[disabled],
	);

	const handleDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!isFileDragEvent(event, disabled)) {
				return;
			}
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		},
		[disabled],
	);

	const handleDragLeave = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!isFileDragEvent(event, disabled)) {
				return;
			}
			// Only clear when the pointer actually leaves the card, not its children.
			if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
				return;
			}
			setIsDraggingFiles(false);
		},
		[disabled],
	);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!isFileDragEvent(event, disabled)) {
				return;
			}
			event.preventDefault();
			setIsDraggingFiles(false);
			const files = [...event.dataTransfer.files];
			if (inputContext.addContextFiles(files)) {
				composerRef.current?.openFilesPanel();
			}
		},
		[disabled, inputContext],
	);

	return (
		<MessageScrollerProvider autoScroll>
			<div
				className="relative flex h-full min-h-[28rem] flex-col rounded-xl border border-solarized-violet/20 bg-card"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{isDraggingFiles ? (
					<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-solarized-blue border-dashed bg-solarized-blue/15 text-solarized-blue backdrop-blur-sm">
						<div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 font-medium text-sm shadow-sm">
							<Paperclip className="h-4 w-4" />
							Dateien ablegen
						</div>
					</div>
				) : null}
				{/* Header */}
				<div className="flex items-center justify-between gap-2 border-b bg-gradient-to-r from-solarized-violet/5 to-solarized-blue/5 px-4 py-3">
					<div className="flex items-center gap-2">
						<div className="rounded-full bg-solarized-violet/10 p-1.5">
							<Bot className="h-4 w-4 text-solarized-violet" />
						</div>
						<div>
							<div className="font-semibold text-foreground text-sm">Agent</div>
							<div className="text-muted-foreground text-xs">Bearbeitet den Arztbrief</div>
						</div>
					</div>
					<Badge className="border-solarized-violet/30 text-solarized-violet" variant="outline">
						Beta
					</Badge>
				</div>

				{/* Transcript */}
				<MessageScroller className="min-h-0 flex-1">
					<MessageScrollerViewport className="px-4 py-4">
						<MessageScrollerContent aria-busy={isLoading}>
							<MessageScrollerItem messageId="agent-intro">
								<Message>
									<MessageContent>
										<Bubble variant="muted">
											<BubbleContent>{INTRO_TEXT}</BubbleContent>
										</Bubble>
									</MessageContent>
								</Message>
							</MessageScrollerItem>

							{messages.map((message) => {
								const text = getMessageText(message);
								const editedSectionIds =
									message.role === "assistant" ? getAppliedSectionIds(message) : [];
								const isUserMessage = message.role === "user";

								return (
									<MessageScrollerItem
										key={message.id}
										messageId={message.id}
										scrollAnchor={isUserMessage}
									>
										<Message align={isUserMessage ? "end" : "start"}>
											<MessageContent>
												{text.length > 0 && (
													<Bubble
														align={isUserMessage ? "end" : "start"}
														variant={isUserMessage ? "default" : "muted"}
													>
														<BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
													</Bubble>
												)}
												{editedSectionIds.map((sectionId) => (
													<Marker
														className="w-fit rounded-md border border-solarized-green/30 bg-solarized-green/10 px-2 py-1 text-solarized-green text-xs"
														key={sectionId}
													>
														<MarkerIcon>
															<PencilLine className="h-3.5 w-3.5" />
														</MarkerIcon>
														<MarkerContent>
															Vorschlag für {sectionLabelById.get(sectionId) ?? sectionId} – im
															Editor prüfen
														</MarkerContent>
													</Marker>
												))}
											</MessageContent>
										</Message>
									</MessageScrollerItem>
								);
							})}

							{isLoading && (
								<MessageScrollerItem messageId="agent-loading">
									<Marker className="w-fit text-muted-foreground text-xs">
										<MarkerIcon>
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										</MarkerIcon>
										<MarkerContent>Agent denkt nach…</MarkerContent>
									</Marker>
								</MessageScrollerItem>
							)}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton />
				</MessageScroller>

				{/* Composer: instruction input + reused audio/file context panels. */}
				<div className="space-y-2 border-t p-3">
					<AgentComposer
						canSend={canSend}
						controller={inputContext}
						disabled={disabled}
						instruction={instruction}
						isLoading={isLoading}
						onInstructionChange={setInstruction}
						onSend={handleSend}
						ref={composerRef}
					/>
					<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						<span className="flex items-center gap-1.5">
							<Kbd>⌘↵</Kbd> Senden
						</span>
						<span className="text-muted-foreground/40">|</span>
						<span className="flex items-center gap-1.5">
							<Kbd>⌘⇧1</Kbd> Text
						</span>
						<span className="text-muted-foreground/40">|</span>
						<span className="flex items-center gap-1.5">
							<Kbd>⌘⇧2</Kbd> Audio
						</span>
					</div>
				</div>
			</div>
		</MessageScrollerProvider>
	);
};
