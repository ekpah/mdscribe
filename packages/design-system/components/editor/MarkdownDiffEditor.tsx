"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Placeholder } from "@tiptap/extensions";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { diffLines, diffWords } from "diff";
import {
	Bold,
	Check,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	RotateCcw,
	Underline as UnderlineIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "../ui/button";
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

	const editor = useEditor({
		extensions: [
			Underline,
			Markdown,
			Placeholder.configure({
				placeholder,
				includeChildren: true,
			}),
			StarterKit.configure({
				// Disable features we don't need
				blockquote: false,
				codeBlock: false,
				horizontalRule: false,
				code: false,
				strike: false,
			}),
		],
		content: value,
		editable: !disabled && !isInDiffMode,
		immediatelyRender: false,
		onUpdate: ({ editor }) => {
			const markdown = editor.getMarkdown();
			onChange(markdown);
		},
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm focus:outline-none w-full h-full max-w-none",
					"prose-headings:font-semibold prose-headings:text-foreground",
					"prose-h1:text-xl prose-h1:mb-2 prose-h1:mt-0",
					"prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-0",
					"prose-h3:text-base prose-h3:mb-1 prose-h3:mt-0",
					"prose-p:my-1 prose-p:text-foreground",
					"[&_u]:underline",
					// Placeholder styles for TipTap Placeholder extension
					"[&_.is-editor-empty:first-child]:relative",
					"[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
					"[&_.is-editor-empty:first-child]:before:text-muted-foreground",
					"[&_.is-editor-empty:first-child]:before:float-left",
					"[&_.is-editor-empty:first-child]:before:h-0",
					"[&_.is-editor-empty:first-child]:before:pointer-events-none",
				),
			},
		},
	});

	// Compute diff based on diffMode
	const diffParts = useMemo((): DiffPart[] => {
		if (!isInDiffMode || !suggestedValue) return [];

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
			suggestedValue
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
		if (isStreaming || !suggestedValue) return;
		// Immediately update editor content (parse as markdown to preserve line breaks)
		editor?.commands.setContent(suggestedValue, {
			emitUpdate: true,
			contentType: "markdown",
		});
		onSuggestionAccepted?.();
	}, [isStreaming, suggestedValue, editor, onSuggestionAccepted]);

	// Reject the suggestion
	const handleReject = useCallback(() => {
		if (isStreaming) return;
		onSuggestionRejected?.();
	}, [isStreaming, onSuggestionRejected]);

	if (!editor) {
		// Show placeholder while editor loads
		return (
			<div
				className={cn(
					"rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground",
					className,
				)}
			>
				{placeholder}
			</div>
		);
	} // Diff mode rendering

	if (isInDiffMode) {
		// Show loading state while waiting for first stream content
		if (!suggestedValue) {
			return (
				<div className="space-y-3">
					<div className="relative rounded-lg border border-solarized-blue/20 bg-background text-sm">
						{/* Loading overlay */}
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-solarized-blue border-t-transparent" />
						</div>
						{/* Greyed out original text */}
						<div className="whitespace-pre-wrap p-3 opacity-40 leading-normal">
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
					<div className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-normal">
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
							"rounded-lg border border-solarized-blue/20 bg-background p-3 text-sm leading-normal",
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
				"relative flex flex-col rounded-md border w-full h-full border-input bg-background px-3 py-2 text-sm cursor-text",
				"transition-colors focus-within:border-solarized-blue focus-within:ring-1 focus-within:ring-solarized-blue/20",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
			id={id}
			ref={hotkeyRef}
			style={{ minHeight: `${minHeight}px` }}
			tabIndex={-1}
		>
			{/* Bubble Menu - appears on text selection */}
			<BubbleMenu
				className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
				editor={editor}
			>
				<BubbleButton
					isActive={editor.isActive("bold")}
					onClick={() => editor.chain().focus().toggleBold().run()}
					title="Fett (⌘B)"
				>
					<Bold className="h-4 w-4" />
				</BubbleButton>
				<BubbleButton
					isActive={editor.isActive("italic")}
					onClick={() => editor.chain().focus().toggleItalic().run()}
					title="Kursiv (⌘I)"
				>
					<Italic className="h-4 w-4" />
				</BubbleButton>
				<BubbleButton
					isActive={editor.isActive("underline")}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					title="Unterstrichen (⌘U)"
				>
					<UnderlineIcon className="h-4 w-4" />
				</BubbleButton>

				<div className="mx-1 h-4 w-px bg-border" />

				<BubbleButton
					isActive={editor.isActive("heading", { level: 1 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
					title="Überschrift 1"
				>
					<Heading1 className="h-4 w-4" />
				</BubbleButton>
				<BubbleButton
					isActive={editor.isActive("heading", { level: 2 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
					title="Überschrift 2"
				>
					<Heading2 className="h-4 w-4" />
				</BubbleButton>
				<BubbleButton
					isActive={editor.isActive("heading", { level: 3 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
					title="Überschrift 3"
				>
					<Heading3 className="h-4 w-4" />
				</BubbleButton>
			</BubbleMenu>

			{/* Editor content */}
			<EditorContent editor={editor} />

			{/* Clickable spacer to fill remaining height - clicking focuses editor */}
			<div
				aria-hidden="true"
				className="min-h-4 flex-1"
				onClick={() => {
					if (editor && !disabled) {
						editor.chain().focus("end").run();
					}
				}}
			/>
			{/* Action slot (e.g., enhance button) - positioned top-right */}
			{actionSlot && (
				<div className="absolute top-2 right-2 z-10">{actionSlot}</div>
			)}
		</div>
	);
}

// Bubble menu button component
function BubbleButton({
	children,
	onClick,
	isActive,
	title,
}: {
	children: React.ReactNode;
	onClick: () => void;
	isActive: boolean;
	title: string;
}) {
	return (
		<button
			className={cn(
				"rounded p-1.5 transition-colors",
				isActive
					? "bg-solarized-blue text-white"
					: "text-foreground hover:bg-muted",
			)}
			onClick={onClick}
			title={title}
			type="button"
		>
			{children}
		</button>
	);
}
