"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { diffLines, diffWords } from "diff";
import { Check, RotateCcw } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface DiffEditorProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
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
	/** Minimum editor height in pixels */
	minHeight?: number;
}

interface DiffPart {
	value: string;
	added?: boolean;
	removed?: boolean;
}

const getDiffPartKind = (part: DiffPart): "added" | "removed" | "unchanged" => {
	if (part.added) {
		return "added";
	}
	if (part.removed) {
		return "removed";
	}
	return "unchanged";
};

export const MarkdownDiffEditor = ({
	value,
	onChange,
	placeholder,
	disabled = false,
	onSubmit,
	id,
	className,
	suggestedValue,
	isStreaming = false,
	onSuggestionAccepted,
	onSuggestionRejected,
	actionSlot,
	diffMode = "word",
	minHeight = 120,
}: DiffEditorProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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
			enableOnContentEditable: true,
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enabled: hotkeyEnabled,
		},
	);

	// Compute diff based on diffMode
	const diffParts = useMemo((): DiffPart[] => {
		if (!isInDiffMode || suggestedValue === null || suggestedValue === undefined) {
			return [];
		}

		const parts =
			diffMode === "line" ? diffLines(value, suggestedValue) : diffWords(value, suggestedValue);
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
				result.push({ removed: true, value });
			}
			result.push({ added: true, value: suggestedValue });
			return result;
		}

		return parts as DiffPart[];
	}, [value, suggestedValue, isInDiffMode, diffMode]);

	// Check if there are any changes
	const hasChanges = useMemo(
		() => value !== suggestedValue || diffParts.some((part) => part.added || part.removed),
		[diffParts, value, suggestedValue],
	);

	// Accept the suggestion
	const handleAccept = useCallback(() => {
		if (isStreaming || suggestedValue === null || suggestedValue === undefined) {
			return;
		}
		onChange(suggestedValue);
		onSuggestionAccepted?.();
	}, [isStreaming, onChange, onSuggestionAccepted, suggestedValue]);

	// Reject the suggestion
	const handleReject = useCallback(() => {
		if (isStreaming) {
			return;
		}
		onSuggestionRejected?.();
	}, [isStreaming, onSuggestionRejected]);

	const handleEditorChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			const textarea = event.currentTarget;
			textarea.style.height = "auto";
			textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
			onChange(event.currentTarget.value);
		},
		[onChange, minHeight],
	);

	useLayoutEffect(() => {
		if (isInDiffMode) {
			return;
		}

		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}

		textarea.style.height = "auto";
		textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
	}, [isInDiffMode, minHeight, value]);

	const editorStyle = useMemo(
		() =>
			({
				"--editor-min-height": `${minHeight}px`,
			}) as CSSProperties,
		[minHeight],
	);

	if (isInDiffMode) {
		// Show loading state while waiting for first stream content
		if (isStreaming && suggestedValue === "") {
			return (
				<div
					className="relative min-h-[var(--editor-min-height)] rounded-lg border border-solarized-blue/30 bg-background ring-2 ring-solarized-blue/20 field-sizing-content"
					style={editorStyle}
				>
					{/* Loading overlay */}
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 rounded-lg">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-solarized-blue border-t-transparent" />
					</div>
					{/* Greyed out original text in background */}
					<div className="whitespace-pre-wrap p-3 opacity-40 text-sm leading-relaxed">
						{value || " "}
					</div>
				</div>
			);
		}

		// If there are no changes after streaming completes, show the text with a subtle note
		if (!hasChanges && !isStreaming) {
			return (
				<div className="space-y-2" style={editorStyle}>
					{/* Show the text as-is */}
					<div className="min-h-[var(--editor-min-height)] whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed field-sizing-content">
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

		// Diff view with changes - no scrolling on individual content, grows to fit
		return (
			<div
				className={cn(
					"min-h-[var(--editor-min-height)] rounded-lg border border-solarized-blue/30 bg-background field-sizing-content",
					"ring-2 ring-solarized-blue/20",
					isStreaming && "animate-pulse",
				)}
				style={editorStyle}
			>
				<div className="space-y-3 p-3">
					{/* Diff view - word or line level highlighting, no individual scrolling */}
					<div
						className={cn(
							"min-h-[var(--editor-min-height)] rounded-lg border border-solarized-blue/20 bg-background p-3 text-sm leading-relaxed field-sizing-content",
							diffMode === "line" ? "whitespace-pre" : "whitespace-pre-wrap",
						)}
					>
						{diffParts.map((part) => {
							const partKey = `${getDiffPartKind(part)}:${part.value}`;
							// Added - green background
							if (part.added) {
								return (
									<span
										className={cn(
											"bg-solarized-green/20 text-solarized-green",
											diffMode === "word" && "rounded-sm",
											diffMode === "line" && "block",
										)}
										key={partKey}
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
										key={partKey}
									>
										{part.value}
									</span>
								);
							}

							// Unchanged - no styling (neutral)
							return <span key={partKey}>{part.value}</span>;
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
								<TooltipTrigger
									render={
										<Button
											className="h-7 w-7 p-0 bg-solarized-green text-primary-foreground hover:bg-solarized-green/90 disabled:opacity-50"
											disabled={isStreaming}
											onClick={handleAccept}
											size="sm"
											type="button"
										>
											<Check className="h-3.5 w-3.5" />
										</Button>
									}
								/>
								<TooltipContent>Alle akzeptieren</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger
									render={
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
									}
								/>
								<TooltipContent>Verwerfen</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Normal editor mode - ref captures height for diff mode transition
	return (
		<div
			ref={hotkeyRef}
			className={cn("relative w-full", disabled && "cursor-not-allowed opacity-50", className)}
			style={editorStyle}
		>
			<Textarea
				className={cn(
					"min-h-[var(--editor-min-height)] w-full resize-none overflow-hidden bg-background text-foreground text-sm leading-relaxed shadow-none [field-sizing:content]",
					"focus-visible:border-solarized-blue focus-visible:ring-1 focus-visible:ring-solarized-blue/20",
					actionSlot && "pr-10",
				)}
				disabled={disabled}
				id={id}
				onChange={handleEditorChange}
				placeholder={placeholder}
				ref={textareaRef}
				value={value}
			/>
			{/* Action slot (e.g., enhance button) - positioned top-right */}
			{actionSlot && <div className="absolute top-2 right-2 z-10">{actionSlot}</div>}
		</div>
	);
};
