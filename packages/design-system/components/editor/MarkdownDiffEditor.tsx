"use client";

import { cn } from "@repo/design-system/lib/utils";
import { diffLines, diffWords } from "diff";
import { Check, RotateCcw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface MarkdownDiffEditorProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	minHeight?: number;
	/** Called when Cmd+Enter / Ctrl+Enter is pressed */
	onSubmit?: () => void;
	id?: string;
	className?: string;
	/** Suggested value for diff mode (can be streamed in) */
	suggestedValue?: string | null;
	/** Whether the suggested value is currently being streamed */
	isStreaming?: boolean;
	/** Called after user accepts the suggestion */
	onSuggestionAccepted?: () => void;
	/** Called after user rejects the suggestion */
	onSuggestionRejected?: () => void;
	/** Slot for action button (e.g., enhance button) - rendered top-right in normal mode */
	actionSlot?: React.ReactNode;
	/** Diff algorithm to use: "word" for word-level diff, "line" for line-level diff */
	diffMode?: "word" | "line";
}

const MIN_HEIGHT = 120;

interface DiffPart {
	value: string;
	added?: boolean;
	removed?: boolean;
}

export function MarkdownDiffEditor({
	value,
	onChange,
	placeholder,
	disabled = false,
	minHeight = MIN_HEIGHT,
	onSubmit,
	id,
	className,
	suggestedValue,
	isStreaming = false,
	onSuggestionAccepted,
	onSuggestionRejected,
	actionSlot,
	diffMode = "word",
}: MarkdownDiffEditorProps) {
	// Determine if we're in diff mode
	const isInDiffMode = suggestedValue !== undefined && suggestedValue !== null;

	// Hotkey enabled state - only when not in diff mode and not disabled
	const hotkeyEnabled = !disabled && !isInDiffMode && Boolean(onSubmit);

	// Handle Cmd+Enter / Ctrl+Enter with react-hotkeys-hook, scoped to this editor
	// The returned ref must be attached to the container for scoping to work
	const hotkeyRef = useHotkeys<HTMLDivElement>(
		["meta+enter", "ctrl+enter"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			onSubmit?.();
		},
		{
			enabled: hotkeyEnabled,
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enableOnContentEditable: true,
		},
	);

	// Compute diff based on diffMode
	const diffParts = useMemo((): DiffPart[] => {
		if (
			!isInDiffMode ||
			suggestedValue === null ||
			suggestedValue === undefined
		) {
			return [];
		}

		const parts =
			diffMode === "line"
				? diffLines(value, suggestedValue)
				: diffWords(value, suggestedValue);
		const textsAreDifferent = value !== suggestedValue;

		// If texts differ but jsdiff returns no changes (edge case),
		// treat entire proposed text as added
		if (
			textsAreDifferent &&
			!parts.some((p: DiffPart) => p.added || p.removed) &&
			suggestedValue !== undefined
		) {
			const result: DiffPart[] = [];
			if (value) {
				result.push({ value, removed: true });
			}
			result.push({ value: suggestedValue, added: true });
			return result;
		}

		return parts as DiffPart[];
	}, [value, suggestedValue, isInDiffMode, diffMode]);

	// Check if there are any changes
	const hasChanges = useMemo(
		() =>
			value !== suggestedValue ||
			diffParts.some((part) => part.added || part.removed),
		[diffParts, value, suggestedValue],
	);

	// Accept the suggestion
	const handleAccept = useCallback(() => {
		if (
			isStreaming ||
			suggestedValue === null ||
			suggestedValue === undefined
		) {
			return;
		}
		onChange(suggestedValue);
		onSuggestionAccepted?.();
	}, [isStreaming, onChange, onSuggestionAccepted, suggestedValue]);

	// Reject the suggestion
	const handleReject = useCallback(() => {
		if (isStreaming) return;
		onSuggestionRejected?.();
	}, [isStreaming, onSuggestionRejected]);

	if (isInDiffMode) {
		// Show loading state while waiting for first stream content
		if (isStreaming && suggestedValue === "") {
			return (
				<div className="space-y-3">
					<div className="relative rounded-lg border border-solarized-blue/20 bg-background text-sm">
						{/* Loading overlay */}
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-solarized-blue border-t-transparent" />
						</div>
						{/* Greyed out original text */}
						<div className="whitespace-pre-wrap p-3 opacity-40 text-sm leading-relaxed">
							{value || " "}
						</div>
					</div>
				</div>
			);
		}

		// If there are no changes after streaming completes, show the text with a subtle note
		if (!hasChanges && !isStreaming) {
			return (
				<div className="space-y-2">
					{/* Show the text as-is */}
					<div className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
						{value || " "}
					</div>
					{/* Subtle note with dismiss */}
					<div className="flex items-center justify-between text-muted-foreground text-xs">
						<span className="flex items-center gap-1.5">
							<Check className="h-3 w-3 text-solarized-green" />
							Keine Änderungen vorgeschlagen
						</span>
						<Button
							className="h-5 px-2 text-xs"
							onClick={handleReject}
							size="sm"
							type="button"
							variant="ghost"
						>
							Schließen
						</Button>
					</div>
				</div>
			);
		}

		// Diff view with changes
		return (
			<div
				className={cn(
					"rounded-lg border border-solarized-blue/30 bg-background",
					"ring-2 ring-solarized-blue/20",
					isStreaming && "animate-pulse",
				)}
			>
				<div className="space-y-3 p-3">
					{/* Diff view - word or line level highlighting */}
					<div
						className={cn(
							"rounded-lg border border-solarized-blue/20 bg-background p-3 text-sm leading-relaxed",
							diffMode === "line" ? "whitespace-pre" : "whitespace-pre-wrap",
						)}
					>
						{diffParts.map((part, idx) => {
							// Added - green background
							if (part.added) {
								return (
									<span
										className={cn(
											"bg-solarized-green/20 text-solarized-green",
											diffMode === "word" && "rounded-sm",
											diffMode === "line" && "block",
										)}
										key={idx}
									>
										{part.value}
									</span>
								);
							}

							// Removed - red background with strikethrough
							if (part.removed) {
								return (
									<span
										className={cn(
											"bg-solarized-red/20 text-solarized-red line-through",
											diffMode === "word" && "rounded-sm",
											diffMode === "line" && "block",
										)}
										key={idx}
									>
										{part.value}
									</span>
								);
							}

							// Unchanged - no styling (neutral)
							return <span key={idx}>{part.value}</span>;
						})}
					</div>

					{/* Bottom row with legend and action buttons */}
					<div className="flex items-center justify-between">
						{/* Legend */}
						<div className="flex items-center gap-4 text-muted-foreground text-xs">
							<div className="flex items-center gap-1.5">
								<div className="h-3 w-3 rounded bg-solarized-green/20" />
								<span>Hinzugefügt</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="h-3 w-3 rounded bg-solarized-red/20" />
								<span>Entfernt</span>
							</div>
						</div>

						{/* Action buttons - accept or reject all */}
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										className="h-7 w-7 p-0 bg-solarized-green text-primary-foreground hover:bg-solarized-green/90 disabled:opacity-50"
										disabled={isStreaming}
										onClick={handleAccept}
										size="sm"
										type="button"
									>
										<Check className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Alle akzeptieren</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										className="h-7 w-7 p-0 disabled:opacity-50"
										disabled={isStreaming}
										onClick={handleReject}
										size="sm"
										type="button"
										variant="destructive"
									>
										<RotateCcw className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Verwerfen</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Normal editor mode
	return (
		<div
			className={cn(
				"relative w-full",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
			ref={hotkeyRef}
		>
			<Textarea
				className={cn(
					"min-h-0 w-full resize-none bg-background text-foreground text-sm leading-relaxed shadow-none",
					"focus-visible:border-solarized-blue focus-visible:ring-1 focus-visible:ring-solarized-blue/20",
					actionSlot && "pr-10",
				)}
				disabled={disabled}
				id={id}
				onChange={(event) => onChange(event.currentTarget.value)}
				placeholder={placeholder}
				style={{ minHeight: `${minHeight}px` }}
				value={value}
			/>
			{/* Action slot (e.g., enhance button) - positioned top-right */}
			{actionSlot && (
				<div className="absolute top-2 right-2 z-10">{actionSlot}</div>
			)}
		</div>
	);
}
