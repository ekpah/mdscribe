"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { diffLines } from "diff";
import { Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface DiffViewProps {
	originalText: string;
	proposedText: string;
	isStreaming?: boolean;
	onAcceptAll: () => void;
	onRejectAll: () => void;
	onApplyChanges: (resultText: string) => void;
	/** Minimum height to maintain (matches source textarea) */
	minHeight?: number;
}

interface DiffPart {
	value: string;
	added?: boolean;
	removed?: boolean;
	accepted?: boolean;
}

export function DiffView({
	originalText,
	proposedText,
	isStreaming = false,
	onAcceptAll,
	onRejectAll,
	onApplyChanges,
	minHeight = 120,
}: DiffViewProps) {
	const [decisions, setDecisions] = useState<Map<number, boolean>>(new Map());
	const [editedParts, setEditedParts] = useState<Map<number, string>>(
		new Map(),
	);
	const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

	// Auto-resize textareas when content changes
	const adjustTextareaHeight = useCallback(
		(textarea: HTMLTextAreaElement | null) => {
			if (textarea) {
				textarea.style.height = "auto";
				textarea.style.height = `${textarea.scrollHeight}px`;
			}
		},
		[],
	);

	// Check if texts are actually different (fallback for edge cases)
	const textsAreDifferent = originalText !== proposedText;

	// Compute diff using jsdiff
	const diffParts = useMemo(() => {
		// Don't compute diff if proposed text is empty (still waiting for stream)
		if (!proposedText) return [];

		const parts = diffLines(originalText, proposedText);

		// If texts differ but jsdiff returns no changes (edge case),
		// treat entire proposed text as added
		if (
			textsAreDifferent &&
			!parts.some((p) => p.added || p.removed) &&
			proposedText
		) {
			const result: DiffPart[] = [];
			let idx = 0;
			if (originalText) {
				result.push({
					value: originalText,
					removed: true,
					accepted: decisions.get(idx),
				});
				idx++;
			}
			result.push({
				value: editedParts.get(idx) ?? proposedText,
				added: true,
				accepted: decisions.get(idx),
			});
			return result;
		}

		return parts.map((part, idx) => ({
			...part,
			value: editedParts.get(idx) ?? part.value,
			accepted: decisions.get(idx),
		})) as DiffPart[];
	}, [originalText, proposedText, decisions, editedParts, textsAreDifferent]);

	// Adjust all textarea heights when diffParts change
	useEffect(() => {
		for (const textarea of textareaRefs.current.values()) {
			adjustTextareaHeight(textarea);
		}
	}, [diffParts, adjustTextareaHeight]);

	// Check if there are any changes - also use string comparison as fallback
	const hasChanges = useMemo(
		() =>
			textsAreDifferent || diffParts.some((part) => part.added || part.removed),
		[diffParts, textsAreDifferent],
	);

	// Build result text based on decisions and edits
	const buildResultText = useCallback(() => {
		const result: string[] = [];
		for (const part of diffParts) {
			if (!part.added && !part.removed) {
				result.push(part.value);
			} else if (part.added && part.accepted !== false) {
				result.push(part.value);
			} else if (part.removed && part.accepted === false) {
				result.push(part.value);
			}
		}
		return result.join("");
	}, [diffParts]);

	// Toggle part acceptance
	const togglePart = useCallback(
		(partIndex: number, part: DiffPart) => {
			if (!part.added && !part.removed) return;
			if (isStreaming) return;

			setDecisions((prev) => {
				const next = new Map(prev);
				const current = next.get(partIndex);
				if (current === undefined) {
					next.set(partIndex, part.added ? false : true);
				} else if (current) {
					next.set(partIndex, false);
				} else {
					next.delete(partIndex);
				}
				return next;
			});
		},
		[isStreaming],
	);

	// Handle inline edit of added lines
	const handleInlineEdit = useCallback(
		(partIndex: number, newValue: string) => {
			setEditedParts((prev) => {
				const next = new Map(prev);
				// Ensure value ends with newline to maintain consistency
				const normalizedValue = newValue.endsWith("\n")
					? newValue
					: `${newValue}\n`;
				next.set(partIndex, normalizedValue);
				return next;
			});
		},
		[],
	);

	// Accept all pending changes
	const handleAcceptAll = useCallback(() => {
		if (isStreaming) return;

		setDecisions((prev) => {
			const next = new Map(prev);
			for (const [idx, part] of diffParts.entries()) {
				if (part.added || part.removed) {
					next.set(idx, true);
				}
			}
			return next;
		});
		// Apply changes and close diff
		onApplyChanges(buildResultText());
		onAcceptAll();
	}, [diffParts, onAcceptAll, onApplyChanges, buildResultText, isStreaming]);

	// Reject all changes
	const handleRejectAll = useCallback(() => {
		if (isStreaming) return;
		onRejectAll();
	}, [onRejectAll, isStreaming]);

	// Show original text greyed out while waiting for first stream content
	if (!proposedText) {
		return (
			<div className="space-y-3">
				<div
					className="relative rounded-lg border border-solarized-blue/20 bg-background text-sm"
					style={{ minHeight: `${minHeight}px` }}
				>
					{/* Loading overlay */}
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-solarized-blue border-t-transparent" />
					</div>
					{/* Greyed out original text */}
					<div className="whitespace-pre-wrap p-3 opacity-40">
						{originalText || " "}
					</div>
				</div>
			</div>
		);
	}

	// If there are no changes after streaming completes, show the text with a subtle note
	// But during streaming, always show the diff even if temporarily no changes
	if (!hasChanges && !isStreaming) {
		return (
			<div className="space-y-2">
				{/* Show the text as-is */}
				<div
					className="rounded-lg border border-border bg-background p-3 text-sm"
					style={{ minHeight: `${minHeight}px` }}
				>
					<div className="whitespace-pre-wrap">{originalText || " "}</div>
				</div>
				{/* Subtle note with dismiss */}
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span className="flex items-center gap-1.5">
						<Check className="h-3 w-3 text-solarized-green" />
						Keine Änderungen vorgeschlagen
					</span>
					<Button
						className="h-5 px-2 text-xs"
						onClick={onRejectAll}
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

	return (
		<div className="space-y-3">
			{/* Diff view - textarea-like appearance */}
			<div
				className="rounded-lg border border-solarized-blue/20 bg-background p-3 text-sm"
				style={{ minHeight: `${minHeight}px` }}
			>
				{diffParts.map((part, idx) => {
					const lines = part.value.split("\n");
					if (lines.at(-1) === "") lines.pop();

					// For added parts that are editable
					if (part.added && part.accepted !== false) {
						return (
							<div className="group relative" key={idx}>
								<textarea
									className={cn(
										"block w-full resize-none overflow-hidden rounded bg-solarized-green/15 px-1 outline-none",
										"focus:bg-solarized-green/25 focus:ring-1 focus:ring-solarized-green/30",
										isStreaming && "pointer-events-none",
									)}
									disabled={isStreaming}
									onChange={(e) => handleInlineEdit(idx, e.target.value)}
									ref={(el) => {
										if (el) {
											textareaRefs.current.set(idx, el);
											adjustTextareaHeight(el);
										} else {
											textareaRefs.current.delete(idx);
										}
									}}
									value={lines.join("\n")}
								/>
								{/* Action button to reject added part */}
								{!isStreaming && (
									<div className="absolute top-0.5 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
										<Button
											className="h-5 w-5 p-0 hover:bg-solarized-red/20 hover:text-solarized-red"
											onClick={() =>
												setDecisions((prev) => new Map(prev).set(idx, false))
											}
											size="sm"
											title="Änderung ablehnen"
											type="button"
											variant="ghost"
										>
											<X className="h-3 w-3" />
										</Button>
									</div>
								)}
							</div>
						);
					}

					// Rejected added parts
					if (part.added && part.accepted === false) {
						return (
							<div
								className={cn(
									"group cursor-pointer whitespace-pre-wrap rounded bg-solarized-red/10 px-1 line-through opacity-50 hover:opacity-75",
									isStreaming && "cursor-default",
								)}
								key={idx}
								onClick={() => togglePart(idx, part)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										togglePart(idx, part);
									}
								}}
								role={!isStreaming ? "button" : undefined}
								tabIndex={!isStreaming ? 0 : undefined}
							>
								{lines.join("\n")}
							</div>
						);
					}

					// Unchanged parts
					if (!part.added && !part.removed) {
						return (
							<div className="whitespace-pre-wrap" key={idx}>
								{lines.join("\n")}
							</div>
						);
					}

					// Removed parts
					return (
						<div
							className={cn(
								"group cursor-pointer whitespace-pre-wrap rounded px-1 transition-colors",
								part.accepted !== true &&
									"bg-solarized-red/15 line-through hover:bg-solarized-red/25",
								part.accepted === true && "bg-solarized-green/10 opacity-50",
								isStreaming && "cursor-default",
							)}
							key={idx}
							onClick={() => togglePart(idx, part)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									togglePart(idx, part);
								}
							}}
							role={!isStreaming ? "button" : undefined}
							tabIndex={!isStreaming ? 0 : undefined}
						>
							{lines.join("\n")}
							{/* Action buttons for removed parts */}
							{!isStreaming && (
								<span className="ml-2 inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
									<Button
										className={cn(
											"h-5 w-5 p-0",
											part.accepted === false &&
												"bg-solarized-green/20 text-solarized-green",
										)}
										onClick={(e) => {
											e.stopPropagation();
											setDecisions((prev) => new Map(prev).set(idx, false));
										}}
										size="sm"
										title="Behalten"
										type="button"
										variant="ghost"
									>
										<RotateCcw className="h-3 w-3" />
									</Button>
								</span>
							)}
						</div>
					);
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

				{/* Action buttons - icon only with tooltips */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								className="h-7 w-7 p-0 bg-solarized-green text-primary-foreground hover:bg-solarized-green/90 disabled:opacity-50"
								disabled={isStreaming}
								onClick={handleAcceptAll}
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
								onClick={handleRejectAll}
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
	);
}
