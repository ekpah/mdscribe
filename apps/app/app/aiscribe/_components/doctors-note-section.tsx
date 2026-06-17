"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { MarkdownDiffEditor } from "@repo/design-system/components/editor/diff-editor";
import { cn } from "@repo/design-system/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { DocumentType } from "@/orpc/scribe/types";

const MIN_HEIGHT = 120;

export interface DoctorsNoteSectionConfig {
	id: string;
	label: string;
	placeholder: string;
	description?: string;
	/** Document type for oRPC enhancement. If omitted, the field will be a plain input without enhancement. */
	documentType?: DocumentType;
	/** When set, generation streams through this AI Vorlage (harness + template). */
	formId?: string;
	/**
	 * Build the prompt body for this section.
	 * Only required if documentType is provided.
	 * @param notes - The current text in this section
	 * @param context - Values from other visible sections (keyed by section id)
	 * @returns The prompt body to send to the API
	 */
	buildPrompt?: (notes: string, context: Record<string, string>) => Record<string, unknown>;
}

interface DoctorsNoteSectionProps {
	config: DoctorsNoteSectionConfig;
	value: string;
	onChange: (value: string) => void;
	/** Context from other sections (keyed by section id) */
	context: Record<string, string>;
	disabled?: boolean;
	/** Minimum editor height in pixels. Defaults to MIN_HEIGHT. */
	minHeight?: number;
	/**
	 * External proposed content (e.g. from the agent) shown as a diff for the
	 * user to accept/reject. Takes precedence over the section's own enhance flow.
	 */
	proposal?: string | null;
	/** Called after an external proposal is accepted or rejected. */
	onProposalResolved?: () => void;
	/** Reports the currently suggested value so sibling/agent context can use it before approval. */
	onSuggestionValueChange?: (sectionId: string, value: string | null) => void;
}

export const DoctorsNoteSection = ({
	config,
	value,
	onChange,
	context,
	disabled = false,
	minHeight = MIN_HEIGHT,
	proposal = null,
	onProposalResolved,
	onSuggestionValueChange,
}: DoctorsNoteSectionProps) => {
	const [proposedText, setProposedText] = useState<string | null>(null);

	// Check if enhancement is available (has a generator and buildPrompt)
	const hasEnhancement = Boolean(
		(config.documentType || config.formId) && config.buildPrompt,
	);

	// Use AI SDK useChat with custom oRPC transport
	const { messages, sendMessage, status, stop, setMessages } = useChat({
		id: `section-${config.id}`,
		onError: (error) => {
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
			setProposedText(null);
		},
		onFinish: () => {
			// Completion is done, proposed text is already set via the effect
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				const requestInput = config.formId
					? {
							formId: config.formId,
							messages: options.messages,
							source: "customForm" as const,
						}
					: {
							documentType: config.documentType ?? "discharge",
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
		const lastAssistantMessage = messages.findLast((m) => m.role === "assistant");
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

	const hasAnyInput = useMemo(() => {
		if (value.trim().length > 0) {
			return true;
		}
		for (const contextValue of Object.values(context)) {
			if (contextValue.trim().length > 0) {
				return true;
			}
		}
		return false;
	}, [value, context]);

	// Update proposed text as completion streams in
	useEffect(() => {
		if (isLoading && completion) {
			setProposedText(completion);
		}
	}, [completion, isLoading]);

	// Handle enhance button click
	const handleEnhance = useCallback(() => {
		if (!hasEnhancement || !config.buildPrompt) {return;}

		if (isLoading) {
			stop();
			return;
		}

		if (!hasAnyInput) {
			toast.error(USER_MESSAGES.missingInput);
			return;
		}

		// Build prompt using the config's buildPrompt function
		const promptBody = config.buildPrompt(value, context);

		// Clear previous messages and start streaming with empty proposed text (triggers diff mode)
		setMessages([]);
		setProposedText("");
		sendMessage({ text: JSON.stringify(promptBody) });
	}, [
		hasEnhancement,
		isLoading,
		stop,
		config,
		value,
		context,
		hasAnyInput,
		setMessages,
		sendMessage,
	]);

	// External (agent) proposals take precedence over the section's own enhance.
	const effectiveProposal = proposal ?? proposedText;

	useEffect(() => {
		onSuggestionValueChange?.(config.id, effectiveProposal);
	}, [config.id, effectiveProposal, onSuggestionValueChange]);

	// Clear proposed text after a suggestion is accepted or rejected.
	const handleSuggestionHandled = useCallback(() => {
		setProposedText(null);
		setMessages([]);
		onProposalResolved?.();
	}, [setMessages, onProposalResolved]);

	const canEnhance = hasEnhancement && !disabled && !isLoading;
	const isInDiffMode = effectiveProposal !== null;

	return (
		<div className="group relative h-full">
			{isLoading && (
				<span className="absolute top-2 left-3 z-10 text-muted-foreground text-xs">
					Wird generiert...
				</span>
			)}

			{/* Content area - diff editor handles both edit and diff modes */}
			<MarkdownDiffEditor
				actionSlot={
					hasEnhancement ? (
						<button
							className={cn(
								"rounded-md p-1.5 transition-all",
								"hover:bg-solarized-blue/10",
								canEnhance
									? "opacity-50 hover:opacity-100 focus:opacity-100"
									: "cursor-not-allowed opacity-30",
								isLoading && "opacity-100",
							)}
							disabled={!canEnhance}
							onClick={handleEnhance}
							title={isLoading ? "Wird generiert..." : "Mit KI generieren/verbessern (⌘↵)"}
							type="button"
						>
							{isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin text-solarized-blue" />
							) : (
								<Sparkles className="h-4 w-4 text-solarized-blue" />
							)}
						</button>
					) : undefined
				}
				className={cn(isLoading && !isInDiffMode && "opacity-50")}
				disabled={disabled || isLoading}
				id={`section-${config.id}`}
				isStreaming={isLoading}
				minHeight={minHeight}
				onChange={onChange}
				onSubmit={hasEnhancement ? handleEnhance : undefined}
				onSuggestionAccepted={handleSuggestionHandled}
				onSuggestionRejected={handleSuggestionHandled}
				placeholder={config.placeholder}
				suggestedValue={effectiveProposal}
				value={value}
			/>
		</div>
	);
};
