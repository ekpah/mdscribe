"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "ai";
import { Bot, Loader2, PencilLine, SendHorizonal } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { orpc } from "@/lib/orpc";
import type { ScribeAgentSection } from "@/orpc/scribe-agent";

const INTRO_TEXT =
	"Hallo! Ich bin der Dokumentations-Agent. Beschreiben Sie eine Änderung – ich kann einzelne Abschnitte des Arztbriefs neu generieren oder gezielt anpassen. Der Inhalt des Briefs links dient mir als Kontext.";

// Tool types whose successful output the client applies back into the editor.
const SECTION_EDIT_TOOL_TYPES = new Set([
	"tool-generateSection",
	"tool-editSection",
]);

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

const isTextPart = (part: { type: string }): part is MessageTextPart =>
	part.type === "text";

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

interface DoctorsNoteAgentPanelProps {
	/** Current sections of the letter, sent with each turn as the agent's context. */
	sections: ScribeAgentSection[];
	/** Stage a section edit from the agent as a proposal (reviewed via diff). */
	onProposeEdit: (sectionId: string, content: string) => void;
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
	disabled = false,
}: DoctorsNoteAgentPanelProps) => {
	const [instruction, setInstruction] = useState("");

	// Latest sections/handler read synchronously by the transport + apply effect.
	const sectionsRef = useRef(sections);
	sectionsRef.current = sections;
	const onProposeEditRef = useRef(onProposeEdit);
	onProposeEditRef.current = onProposeEdit;
	const appliedToolCallIds = useRef<Set<string>>(new Set());

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
			toast.error(
				getAiscribeErrorMessage(error) ??
					"Der Agent ist derzeit nicht erreichbar.",
			);
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				return eventIteratorToUnproxiedDataStream(
					await orpc.scribeAgent.chat.call(
						{
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

	const handleSend = useCallback(() => {
		const trimmed = instruction.trim();
		if (!trimmed || isLoading) {
			return;
		}
		void sendMessage({ text: trimmed });
		setInstruction("");
	}, [instruction, isLoading, sendMessage]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="flex h-full min-h-[28rem] flex-col rounded-xl border border-solarized-violet/20 bg-card">
			{/* Header */}
			<div className="flex items-center justify-between gap-2 border-b bg-gradient-to-r from-solarized-violet/5 to-solarized-blue/5 px-4 py-3">
				<div className="flex items-center gap-2">
					<div className="rounded-full bg-solarized-violet/10 p-1.5">
						<Bot className="h-4 w-4 text-solarized-violet" />
					</div>
					<div>
						<div className="font-semibold text-foreground text-sm">Agent</div>
						<div className="text-muted-foreground text-xs">
							Bearbeitet den Arztbrief
						</div>
					</div>
				</div>
				<Badge
					className="border-solarized-violet/30 text-solarized-violet"
					variant="outline"
				>
					Beta
				</Badge>
			</div>

			{/* Transcript */}
			<ScrollArea className="min-h-0 flex-1 px-4 py-4">
				<div className="space-y-3">
					<div className="flex justify-start">
						<div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-foreground text-sm">
							{INTRO_TEXT}
						</div>
					</div>

					{messages.map((message) => {
						const text = getMessageText(message);
						const editedSectionIds =
							message.role === "assistant" ? getAppliedSectionIds(message) : [];

						return (
							<div
								className={cn(
									"flex flex-col gap-1.5",
									message.role === "user" ? "items-end" : "items-start",
								)}
								key={message.id}
							>
								{text.length > 0 && (
									<div
										className={cn(
											"max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
											message.role === "user"
												? "bg-solarized-blue text-primary-foreground"
												: "bg-muted text-foreground",
										)}
									>
										{text}
									</div>
								)}
								{editedSectionIds.map((sectionId) => (
									<div
										className="flex items-center gap-1.5 rounded-md border border-solarized-green/30 bg-solarized-green/10 px-2 py-1 text-solarized-green text-xs"
										key={sectionId}
									>
										<PencilLine className="h-3.5 w-3.5" />
										<span>
											Vorschlag für {sectionLabelById.get(sectionId) ?? sectionId}{" "}
											– im Editor prüfen
										</span>
									</div>
								))}
							</div>
						);
					})}

					{isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							<span>Agent denkt nach…</span>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Composer */}
			<div className="border-t p-3">
				<div className="flex items-end gap-2">
					<Textarea
						className="max-h-40 min-h-[2.5rem] flex-1 resize-none [field-sizing:content]"
						disabled={disabled || isLoading}
						onChange={(event) => {
							setInstruction(event.target.value);
						}}
						onKeyDown={handleKeyDown}
						placeholder="Anweisung an den Agent (⌘↵ zum Senden)…"
						value={instruction}
					/>
					<Button
						aria-label="An Agent senden"
						className="shrink-0"
						disabled={disabled || isLoading || instruction.trim().length === 0}
						onClick={handleSend}
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
		</div>
	);
};
