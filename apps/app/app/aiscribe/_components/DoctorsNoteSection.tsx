"use client";

import { MarkdownDiffEditor } from "@repo/design-system/components/editor/MarkdownDiffEditor";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useScribeStream } from "@/hooks/use-scribe-stream";
import type { DocumentType } from "@/orpc/scribe/types";

const MIN_HEIGHT = 120;

export interface DoctorsNoteSectionConfig {
	id: string;
	label: string;
	placeholder: string;
	description?: string;
	/** Document type for oRPC enhancement. If omitted, the field will be a plain input without enhancement. */
	documentType?: DocumentType;
	/**
	 * Build the prompt body for this section.
	 * Only required if documentType is provided.
	 * @param notes - The current text in this section
	 * @param context - Values from other visible sections (keyed by section id)
	 * @returns The prompt body to send to the API
	 */
	buildPrompt?: (
		notes: string,
		context: Record<string, string>,
	) => Record<string, unknown>;
}

interface DoctorsNoteSectionProps {
	config: DoctorsNoteSectionConfig;
	value: string;
	onChange: (value: string) => void;
	/** Context from other sections (keyed by section id) */
	context: Record<string, string>;
	disabled?: boolean;
}

export function DoctorsNoteSection({
	config,
	value,
	onChange,
	context,
	disabled = false,
}: DoctorsNoteSectionProps) {
	const [proposedText, setProposedText] = useState<string | null>(null);

	// Check if enhancement is available (has documentType and buildPrompt)
	const hasEnhancement = Boolean(config.documentType && config.buildPrompt);

	// Use oRPC streaming hook
	const scribeStream = useScribeStream({
		documentType: config.documentType ?? "discharge", // Fallback, won't be used if no documentType
		onError: (error) => {
			toast.error(error.message || "Fehler beim Generieren");
			setProposedText(null);
		},
		onFinish: () => {
			// Completion is done, proposed text is already set via the effect
		},
	});

	// Update proposed text as completion streams in
	useEffect(() => {
		if (scribeStream.isLoading && scribeStream.completion) {
			setProposedText(scribeStream.completion);
		}
	}, [scribeStream.completion, scribeStream.isLoading]);

	// Handle enhance button click
	const handleEnhance = useCallback(() => {
		if (!hasEnhancement || !config.buildPrompt) return;

		if (scribeStream.isLoading) {
			scribeStream.stop();
			return;
		}

		// Build prompt using the config's buildPrompt function
		const promptBody = config.buildPrompt(value, context);

		// Start streaming with empty proposed text (triggers diff mode)
		setProposedText("");
		scribeStream.complete(JSON.stringify(promptBody));
	}, [hasEnhancement, scribeStream, config, value, context]);

	// Clear proposed text after suggestion is handled
	const handleSuggestionHandled = useCallback(() => {
		setProposedText(null);
	}, []);

	const isLoading = scribeStream.isLoading;
	const canEnhance = hasEnhancement && !disabled && !isLoading;
	const isInDiffMode = proposedText !== null;

	return (
		<div className="group relative space-y-1.5">
			{/* Label row */}
			<div className="flex items-center justify-between">
				<Label
					className="flex items-center gap-1.5 font-medium text-foreground text-sm"
					htmlFor={`section-${config.id}`}
				>
					<div className="h-1.5 w-1.5 rounded-full bg-solarized-blue" />
					{config.label}
					{isLoading && (
						<span className="ml-2 text-muted-foreground text-xs">
							Wird generiert...
						</span>
					)}
				</Label>
			</div>

			{/* Content area - MarkdownDiffEditor handles both edit and diff modes */}
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
							title={
								isLoading
									? "Wird generiert..."
									: "Mit KI generieren/verbessern (⌘↵)"
							}
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
				className={cn(
					hasEnhancement && "pr-10",
					isLoading && !isInDiffMode && "opacity-50",
				)}
				disabled={disabled || isLoading}
				id={`section-${config.id}`}
				isStreaming={isLoading}
				minHeight={MIN_HEIGHT}
				onChange={onChange}
				onSubmit={hasEnhancement ? handleEnhance : undefined}
				onSuggestionAccepted={handleSuggestionHandled}
				onSuggestionRejected={handleSuggestionHandled}
				placeholder={config.placeholder}
				suggestedValue={proposedText}
				value={value}
			/>

			{/* Description */}
			{config.description && !isInDiffMode && (
				<p className="text-muted-foreground text-xs">{config.description}</p>
			)}
		</div>
	);
}
