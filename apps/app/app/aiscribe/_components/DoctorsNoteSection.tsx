"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DiffView } from "./DiffView";

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
	const [originalText, setOriginalText] = useState<string | null>(null);
	const [proposedText, setProposedText] = useState<string | null>(null);
	const [showDiff, setShowDiff] = useState(false);
	const [capturedHeight, setCapturedHeight] = useState<number>(MIN_HEIGHT);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Handle enhance button click (works even with empty field to generate new content)
	const handleEnhance = useCallback(async () => {
		if (isEnhancing) return;

		// Capture the current textarea height before switching to diff mode
		const currentHeight = textareaRef.current?.offsetHeight ?? MIN_HEIGHT;
		setCapturedHeight(Math.max(currentHeight, MIN_HEIGHT));

		setIsEnhancing(true);
		setOriginalText(value); // Store original (can be empty)
		setProposedText(""); // Start with empty proposed text
		setShowDiff(true); // Show diff view immediately for streaming

		try {
			await onEnhance({
				onStream: (chunk: string) => {
					// Append each chunk to proposed text
					setProposedText((prev) => (prev || "") + chunk);
				},
			});
		} catch (error) {
			console.error("Enhancement failed:", error);
			setOriginalText(null);
			setProposedText(null);
			setShowDiff(false);
		} finally {
			setIsEnhancing(false);
		}
	}, [value, onEnhance, isEnhancing]);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Cmd+Enter or Ctrl+Enter to enhance
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleEnhance();
			}
		},
		[handleEnhance],
	);

	// Accept all changes
	const handleAcceptAll = useCallback(() => {
		if (proposedText !== null) {
			onChange(proposedText);
			setShowDiff(false);
			setOriginalText(null);
			setProposedText(null);
		}
	}, [proposedText, onChange]);

	// Reject all changes (revert to original)
	const handleRejectAll = useCallback(() => {
		if (originalText !== null) {
			onChange(originalText);
		}
		setShowDiff(false);
		setOriginalText(null);
		setProposedText(null);
	}, [originalText, onChange]);

	// Apply changes from diff view
	const handleApplyChanges = useCallback(
		(resultText: string) => {
			onChange(resultText);
			setShowDiff(false);
			setOriginalText(null);
			setProposedText(null);
		},
		[onChange],
	);

	// Undo entire enhancement
	const handleUndo = useCallback(() => {
		if (originalText !== null) {
			onChange(originalText);
			setShowDiff(false);
			setOriginalText(null);
			setProposedText(null);
		}
	}, [originalText, onChange]);

	const isInDiffMode =
		showDiff && originalText !== null && proposedText !== null;
	const canEnhance = !disabled && !isEnhancing;

	// Auto-resize textarea based on content
	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			// Reset height to auto to get the correct scrollHeight
			textarea.style.height = "auto";
			// Set to scrollHeight but respect minimum
			const newHeight = Math.max(textarea.scrollHeight, MIN_HEIGHT);
			textarea.style.height = `${newHeight}px`;
		}
	}, []);

	// Adjust height when value changes
	useEffect(() => {
		adjustTextareaHeight();
	}, [value, adjustTextareaHeight]);

	// Handle input change with auto-resize
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

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

				{/* Undo button - visible when in diff mode */}
				{isInDiffMode && !isEnhancing && (
					<Button
						className="h-6 gap-1 px-2 text-xs"
						onClick={handleUndo}
						size="sm"
						title="Änderungen rückgängig machen"
						type="button"
						variant="outline"
					>
						<RotateCcw className="h-3 w-3" />
						Rückgängig
					</Button>
				)}
			</div>

			{/* Content area */}
			{isInDiffMode ? (
				<div
					className={cn(
						"rounded-lg border border-solarized-blue/30 bg-background p-3",
						"ring-2 ring-solarized-blue/20",
						isEnhancing && "animate-pulse",
					)}
					style={{ minHeight: `${capturedHeight}px` }}
				>
					<DiffView
						isStreaming={isEnhancing}
						minHeight={capturedHeight - 24} // Account for padding (p-3 = 12px * 2)
						onAcceptAll={handleAcceptAll}
						onApplyChanges={handleApplyChanges}
						onRejectAll={handleRejectAll}
						originalText={originalText}
						proposedText={proposedText}
					/>
				</div>
			) : (
				<div className="relative">
					<Textarea
						className={cn(
							"min-h-[120px] resize-none overflow-hidden border-input bg-background pr-10 text-foreground transition-colors",
							"placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
							isEnhancing && "opacity-50",
						)}
						disabled={disabled || isEnhancing}
						id={`section-${config.id}`}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder={config.placeholder}
						ref={textareaRef}
						value={value}
					/>

					{/* Enhance button - always visible, generates or improves content */}
					<button
						className={cn(
							"absolute top-2 right-2 rounded-md p-1.5 transition-all",
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
				</div>
			)}

			{/* Description */}
			{config.description && !isInDiffMode && (
				<p className="text-muted-foreground text-xs">{config.description}</p>
			)}
		</div>
	);
}
