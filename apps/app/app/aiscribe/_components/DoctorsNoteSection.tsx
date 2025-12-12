"use client";

import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { MarkdownDiffEditor } from "@repo/design-system/components/editor/MarkdownDiffEditor";

const MIN_HEIGHT = 120;

export interface DoctorsNoteSectionConfig {
	id: string;
	label: string;
	placeholder: string;
	description?: string;
}

export interface EnhanceOptions {
	/** Called with each streaming chunk as it arrives */
	onStream: (chunk: string) => void;
}

interface DoctorsNoteSectionProps {
	config: DoctorsNoteSectionConfig;
	value: string;
	onChange: (value: string) => void;
	/** Called to trigger enhancement. Should call onStream with chunks and resolve when complete. */
	onEnhance: (options: EnhanceOptions) => Promise<void>;
	disabled?: boolean;
}

export function DoctorsNoteSection({
	config,
	value,
	onChange,
	onEnhance,
	disabled = false,
}: DoctorsNoteSectionProps) {
	const [isEnhancing, setIsEnhancing] = useState(false);
	const [proposedText, setProposedText] = useState<string | null>(null);

	// Handle enhance button click (works even with empty field to generate new content)
	const handleEnhance = useCallback(async () => {
		if (isEnhancing) return;

		setIsEnhancing(true);
		setProposedText(""); // Start with empty proposed text (triggers diff mode)

		try {
			await onEnhance({
				onStream: (chunk: string) => {
					// Append each chunk to proposed text
					setProposedText((prev) => (prev || "") + chunk);
				},
			});
		} catch (error) {
			console.error("Enhancement failed:", error);
			setProposedText(null);
		} finally {
			setIsEnhancing(false);
		}
	}, [onEnhance, isEnhancing]);

	// Clear proposed text after suggestion is handled
	const handleSuggestionHandled = useCallback(() => {
		setProposedText(null);
	}, []);

	const canEnhance = !disabled && !isEnhancing;
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
					{isEnhancing && (
						<span className="ml-2 text-muted-foreground text-xs">
							Wird generiert...
						</span>
					)}
				</Label>
			</div>

			{/* Content area - MarkdownDiffEditor handles both edit and diff modes */}
			<MarkdownDiffEditor
				actionSlot={
					<button
						className={cn(
							"rounded-md p-1.5 transition-all",
							"hover:bg-solarized-blue/10",
							canEnhance
								? "opacity-50 hover:opacity-100 focus:opacity-100"
								: "cursor-not-allowed opacity-30",
							isEnhancing && "opacity-100",
						)}
						disabled={!canEnhance}
						onClick={handleEnhance}
						title={
							isEnhancing
								? "Wird generiert..."
								: "Mit KI generieren/verbessern (⌘↵)"
						}
						type="button"
					>
						{isEnhancing ? (
							<Loader2 className="h-4 w-4 animate-spin text-solarized-blue" />
						) : (
							<Sparkles className="h-4 w-4 text-solarized-blue" />
						)}
					</button>
				}
				className={cn("pr-10", isEnhancing && !isInDiffMode && "opacity-50")}
				disabled={disabled || isEnhancing}
				id={`section-${config.id}`}
				isStreaming={isEnhancing}
				minHeight={MIN_HEIGHT}
				onChange={onChange}
				onSubmit={handleEnhance}
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
